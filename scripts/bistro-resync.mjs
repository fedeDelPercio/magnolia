/* eslint-disable */
// Dispara una re-sincronización Bistro para un rango de fechas específico.
// Usa la UI real (login + form en /config) para llamar a la server action.
// Necesario después de cambiar VENTA_TYPES para que cierres_caja se rearme
// con la lógica nueva sin esperar al próximo sync manual.

import { chromium } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const FROM = process.env.SYNC_FROM || '2026-06-01'
const TO = process.env.SYNC_TO || '2026-06-03'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errors.push(`console.error: ${t}`)
  }
})

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(800)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

// /config — escribir las fechas y disparar sync
await page.goto(`${BASE}/config`, { waitUntil: 'networkidle' })
await page.getByText('Conexión Bistrosoft API').waitFor({ state: 'visible', timeout: 10000 })

const dateInputs = await page.locator('input[type="date"]').all()
console.log(`  · ${dateInputs.length} inputs date encontrados`)

const fromInput = page.locator('input[type="date"]').first()
const toInput = page.locator('input[type="date"]').nth(1)
await fromInput.fill(FROM)
await toInput.fill(TO)
console.log(`  · fechas: ${FROM} → ${TO}`)

// OJO: en /config hay DOS botones parecidos — "Sincronizar ahora" es el de
// snapshots de Google Maps; el de Bistro dice "Sincronizar" a secas. Con el
// regex /Sincronizar ahora/i este script apretaba el de Google y el sync de
// Bistro nunca corria (y encima "terminaba OK").
const syncBtn = page.getByRole('button', { name: 'Sincronizar', exact: true })
const btnVisible = await syncBtn.isVisible().catch(() => false)
console.log(`  · botón "Sincronizar ahora" visible: ${btnVisible}`)
await page.screenshot({ path: 'scripts/.shots/bistro-resync-before.png', fullPage: true })

console.log(`▶ clickeando "Sincronizar ahora"`)
await syncBtn.click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'scripts/.shots/bistro-resync-after-click.png', fullPage: true })

// Esperar a que se deje de ver "Sincronizando" — timeout largo porque el sync tarda
await page.waitForFunction(
  () => {
    const btns = Array.from(document.querySelectorAll('button'))
    return !btns.some((b) => /sincronizando/i.test(b.textContent ?? ''))
  },
  { timeout: 240000 },
)
await page.waitForTimeout(2000)
await page.screenshot({ path: 'scripts/.shots/bistro-resync-done.png', fullPage: true })
console.log('  ✓ sync completado')

await browser.close()

if (errors.length) {
  console.error('\n✗ ERRORES detectados:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
console.log('\n✓ Re-sync OK')
