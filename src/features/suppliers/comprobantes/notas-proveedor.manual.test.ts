// @vitest-environment node
//
// Banco de pruebas para iterar las instrucciones por proveedor
// (proveedores.ai_extraction_notes) contra una factura real, sin deployar.
//
//   COMPROBANTE_PDF=C:/ruta/factura.pdf NOTAS_FILE=/tmp/nota.txt \
//     npx vitest run src/features/suppliers/comprobantes/notas-proveedor.manual.test.ts \
//     --disable-console-intercept
//
// Imprime cada línea detectada y la suma de precio_total, que es lo que hay
// que comparar contra el total al pie de la columna correcta de la factura.
// Sin COMPROBANTE_PDF no hace nada (no gasta llamadas al modelo en `npm test`).
// Necesita ANTHROPIC_API_KEY en .env.local.
import { readFileSync, existsSync } from 'node:fs'
import { describe, it } from 'vitest'

const out = (...a: unknown[]) => process.stdout.write(a.map(String).join(' ') + String.fromCharCode(10))

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '')
  }
}

describe('notas por proveedor (manual)', () => {
  it('extrae un comprobante con las notas dadas', { timeout: 600_000 }, async () => {
    const pdf = process.env.COMPROBANTE_PDF
    if (!pdf || !existsSync(pdf)) {
      out('COMPROBANTE_PDF sin definir o inexistente — nada que hacer.')
      return
    }
    loadEnvLocal()
    const { extractComprobante } = await import('./claude-vision')

    const notas = process.env.NOTAS_FILE
      ? readFileSync(process.env.NOTAS_FILE, 'utf8')
      : (process.env.NOTAS ?? '')
    out(notas ? `Notas: ${notas.length} caracteres` : 'Sin notas (baseline)')

    const mime = pdf.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
    const res = await extractComprobante(readFileSync(pdf), mime, notas || null)
    if (res.error) {
      out('ERROR', res.error)
      return
    }

    let suma = 0
    for (const i of res.extract?.items ?? []) {
      suma += i.precio_total ?? 0
      out(
        `${(i.nombre ?? '').padEnd(28)} cant=${String(i.cantidad).padStart(4)}` +
          ` unit=${String(i.precio_unitario).padStart(12)} total=${String(i.precio_total).padStart(12)}`,
      )
    }
    out('SUMA precio_total =', suma.toFixed(2))
    out('total_general =', res.extract?.total_general)
    out('obs:', res.extract?.observaciones)
  })
})
