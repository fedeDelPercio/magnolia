'use server'

import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { cierreCajaExtractSchema, type CierreCajaExtract, type ProductoMatch, type SaveMapping } from './schemas'
import { topSuggestion } from './lib/similarity'
import type { Json } from '@/types/database'

const SYSTEM_PROMPT = `Sos un asistente experto en interpretar reportes de "Cierre de Caja" del sistema Bistrosoft (POS gastronómico argentino). Tu única tarea es extraer los datos del PDF a un JSON estructurado.

Reglas clave:
- Fechas: el PDF las muestra como "DD/MM/YYYY HH:MM:SS" (zona Argentina). Devolvelas en ISO 8601 con offset -03:00 (ej: "2026-04-30T07:38:06-03:00").
- Montos: el PDF usa formato argentino "$ 1.418.488,00" (punto = miles, coma = decimal). Devolvelos como números puros (ej: 1418488.00). Ignorá el signo $.
- Retiros: en "OTROS MOVIMIENTOS" aparecen como negativos ("$ -680.000,00"). Devolvé el valor absoluto positivo en total_retiros.
- Productos: en "DETALLE DE PRODUCTOS DESPACHADOS" cada categoría (en negrita, MAYÚSCULAS) agrupa varios productos. Solo devolvé las líneas de producto individual (las que tienen "X NombreProducto $ Monto"), no los encabezados de categoría. Asociá cada producto a su categoría padre.
- Si un campo no aparece en el PDF, usá null para texto o 0 para números.
- Excluí líneas de "DESCUENTOS" del listado de productos (son ajustes, no productos).`

const USER_PROMPT = `Extraé los datos de este cierre de caja siguiendo el esquema indicado. Sé fiel a los números del PDF — no infieras ni completes campos faltantes.`

// ---------- Helpers ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Canal derivado de la categoria del PDF de Bistrosoft. La categoria concentra
// dos ejes: {canal (SALON/DELIVERY)} x {momento (ALMUERZO/CAFETERIA/BEBIDA)}.
// Nosotros solo modelamos el canal; el momento queda descartado (agrupamiento
// de reporte, no cambia la receta del producto).
// - Cualquier categoria que empieza con "SALON " -> canal='salon'.
// - "DELIVERY XXX", "BEBIDA DELIVERY" y "GENERICO" -> canal='delivery'. Estos
//   ultimos dos aparecen bajo origin=Mostrador en la API — el mismo bucket.
// - Categorias no reconocidas o null -> null (sin senal).
type CanalPdf = 'salon' | 'delivery' | null
function canalFromCategoria(cat: string | null | undefined): CanalPdf {
  if (!cat) return null
  const upper = cat.toUpperCase()
  if (upper.startsWith('SALON')) return 'salon'
  if (upper.startsWith('DELIVERY') || upper.includes('BEBIDA DELIVERY') || upper === 'GENERICO') {
    return 'delivery'
  }
  return null
}

// Formato del item — mismo criterio que el sync API (prefijo "Menú"/"Menu").
type FormatoPdf = 'individual' | 'menu' | null
function formatoFromNombre(nombre: string | null | undefined): FormatoPdf {
  if (!nombre) return null
  return /^men[uú]\s/i.test(nombre) ? 'menu' : null
}

// Detecta "receta del dia" en el nombre — mismo patron que el sync API.
function isRecetaDelDia(nombre: string | null | undefined): boolean {
  if (!nombre) return false
  return /\b(sugerencia|sugerenca|men[uú])\s+d[ei]l?\s+d[ií]a\b/i.test(nombre)
}

// DOW (0=domingo) desde YYYY-MM-DD en hora local Argentina.
function dowFromFechaLocal(fechaLocal: string): number {
  const [y, m, d] = fechaLocal.split('-').map(Number)
  return new Date(y!, m! - 1, d!).getDay()
}

// Convierte una fecha ISO 8601 (con o sin offset) a YYYY-MM-DD en hora Argentina.
function fechaLocalArgentina(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// Convierte un ISO timestamptz a YYYY-MM-DD en hora Argentina
function fechaArgentina(iso: string): string {
  const d = new Date(iso)
  // 'en-CA' devuelve formato ISO YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// ---------- Extracción ----------

export type ExtractResult = {
  data?: CierreCajaExtract
  matches?: ProductoMatch[]
  error?: string
}

export async function extractCierreCaja(formData: FormData): Promise<ExtractResult> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Archivo no recibido' }
  if (file.type !== 'application/pdf') return { error: 'El archivo debe ser un PDF' }
  if (file.size > 32 * 1024 * 1024) return { error: 'El PDF supera los 32MB' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY no configurada' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const client = new Anthropic({ apiKey })
    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(cierreCajaExtractSchema) },
    })

    if (!response.parsed_output) return { error: 'No se pudo parsear la respuesta del modelo' }

    const data = response.parsed_output
    const dow = dowFromFechaLocal(fechaLocalArgentina(data.fecha_cierre))
    const matches = await resolveMatches(
      data.productos.map((p) => ({
        nombre: p.nombre,
        canal: canalFromCategoria(p.categoria),
        formato: formatoFromNombre(p.nombre),
      })),
      dow,
    )

    return { data, matches }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido al extraer' }
  }
}

// ---------- Matching ----------

// resolveMatches acepta name+canal+formato por linea. Los nuevos ejes se usan
// para: (a) redirigir el resultado a la variante correcta cuando el producto
// matcheado tiene siblings del mismo concepto; (b) ranking fuzzy: preferimos
// candidatos con la misma variante.
export type ResolveInput = {
  nombre: string
  canal: 'salon' | 'delivery' | null
  formato: 'individual' | 'menu' | null
}

export async function resolveMatches(
  inputs: ResolveInput[],
  dow?: number,
): Promise<ProductoMatch[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [productosRes, aliasesRes, recetaDiaRes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, name, concepto_id, canal, formato')
      .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('producto_aliases')
      .select('alias, producto_id')
      .eq('tenant_id', tenantId)
      .eq('source', 'bistrosoft'),
    dow !== undefined
      ? supabase
          .from('receta_del_dia')
          .select('producto_id')
          .eq('tenant_id', tenantId)
          .eq('dow', dow)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
  ])

  if (productosRes.error || aliasesRes.error) {
    return inputs.map((i) => ({ nombre: i.nombre, producto_id: null, match_type: null }))
  }

  const recetaDelDiaProductoId = recetaDiaRes.data?.producto_id ?? null

  const byExact = new Map<string, string>()
  const byNorm = new Map<string, string>()
  type ProdInfo = {
    id: string
    concepto_id: string | null
    canal: 'salon' | 'delivery' | null
    formato: 'individual' | 'menu' | null
  }
  const byId = new Map<string, ProdInfo>()
  const byConcepto = new Map<string, ProdInfo[]>()
  for (const p of productosRes.data ?? []) {
    byExact.set(p.name, p.id)
    byNorm.set(normalize(p.name), p.id)
    const info: ProdInfo = {
      id: p.id,
      concepto_id: p.concepto_id,
      canal: p.canal,
      formato: p.formato,
    }
    byId.set(p.id, info)
    if (p.concepto_id) {
      const list = byConcepto.get(p.concepto_id) ?? []
      list.push(info)
      byConcepto.set(p.concepto_id, list)
    }
  }
  const aliasMap = new Map<string, string>()
  for (const a of aliasesRes.data ?? []) {
    aliasMap.set(normalize(a.alias), a.producto_id)
  }

  // Redirige a la variante correcta del concepto si aplica.
  function redirectToVariant(
    productoId: string,
    canal: 'salon' | 'delivery' | null,
    formato: 'individual' | 'menu' | null,
  ): string {
    const p = byId.get(productoId)
    if (!p || !p.concepto_id) return productoId
    const siblings = byConcepto.get(p.concepto_id) ?? []
    const exact = siblings.find((s) => s.canal === canal && s.formato === formato)
    return exact?.id ?? productoId
  }

  // Opciones para el fallback fuzzy — solo se recorre cuando alias/exact/norm
  // fallaron, asi que el costo es marginal.
  const productoOptions = (productosRes.data ?? []).map((p) => ({ value: p.id, label: p.name }))

  return inputs.map(({ nombre, canal, formato }) => {
    const norm = normalize(nombre)
    // Receta del dia primero: si el nombre matchea el patron y hay asignacion
    // para este DOW, gana sobre alias/name porque el nombre generico
    // ("Sugerencia del dia") es el mismo todos los dias — el alias apuntaria al
    // producto de un dia especifico y no rotaria.
    if (isRecetaDelDia(nombre) && recetaDelDiaProductoId) {
      const id = redirectToVariant(recetaDelDiaProductoId, canal, formato)
      return { nombre, producto_id: id, match_type: 'alias' as const }
    }
    if (aliasMap.has(norm)) {
      const id = redirectToVariant(aliasMap.get(norm)!, canal, formato)
      return { nombre, producto_id: id, match_type: 'alias' as const }
    }
    if (byExact.has(nombre)) {
      const id = redirectToVariant(byExact.get(nombre)!, canal, formato)
      return { nombre, producto_id: id, match_type: 'name_exact' as const }
    }
    if (byNorm.has(norm)) {
      const id = redirectToVariant(byNorm.get(norm)!, canal, formato)
      return { nombre, producto_id: id, match_type: 'name_normalized' as const }
    }
    // Fallback fuzzy: mismo threshold que la UI (0.4). Se auto-aplica pero
    // marcado con match_type='fuzzy_auto' para que el user lo distinga
    // visualmente y pueda revisar antes de confirmar el cierre.
    const fuzzy = topSuggestion(nombre, productoOptions, null, 0.4)
    if (fuzzy) {
      const id = redirectToVariant(fuzzy.value, canal, formato)
      return { nombre, producto_id: id, match_type: 'fuzzy_auto' as const }
    }
    return { nombre, producto_id: null, match_type: null }
  })
}

// ---------- Crear producto desde un alias no mapeado ----------

export async function createProductoForAlias(
  name: string,
  sale_price: number,
  alias: string,
): Promise<{ id?: string; name?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { data: producto, error: insertErr } = await supabase
      .from('productos')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        sale_price: Math.max(0, sale_price),
        receta_id: null,
        target_margin_pct: 0,
        is_dynamic: false,
        active: true,
      })
      .select('id, name')
      .single()

    if (insertErr) return { error: insertErr.message }

    // Guardo el alias para que el próximo cierre lo encuentre automáticamente
    if (alias.trim() && alias.trim() !== name.trim()) {
      await supabase.from('producto_aliases').insert({
        tenant_id: tenantId,
        producto_id: producto.id,
        alias: alias.trim(),
        source: 'bistrosoft',
      })
    }

    // No revalidamos /catalogo/productos acá: la creación se hace desde el preview
    // del cierre y queremos preservar el estado local del componente (mappings,
    // selección actual). El producto nuevo se ve la próxima vez que el usuario
    // entre a /catalogo/productos.
    return { id: producto.id, name: producto.name }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// ---------- Guardado ----------

export type SaveResult = { id?: string; error?: string; movimientosCreados?: number }

export async function saveCierreCaja(
  data: CierreCajaExtract,
  mappings: SaveMapping[],
): Promise<SaveResult> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { productos, ...header } = data

    // 1. Insertar cierre
    const { data: cierre, error: insertErr } = await supabase
      .from('cierres_caja')
      .insert({
        tenant_id: tenantId,
        fecha_apertura: header.fecha_apertura,
        fecha_cierre: header.fecha_cierre,
        operador: header.operador,
        razon_social: header.razon_social,
        efectivo_apertura: header.efectivo_apertura,
        efectivo_cierre: header.efectivo_cierre,
        total_vendido: header.total_vendido,
        total_ventas: header.total_ventas,
        total_comandas: header.total_comandas,
        cantidad_comandas: header.cantidad_comandas,
        cantidad_ventas: header.cantidad_ventas,
        cubiertos: header.cubiertos,
        ticket_promedio: header.ticket_promedio,
        monto_efectivo: header.monto_efectivo,
        monto_tarjetas: header.monto_tarjetas,
        monto_qr: header.monto_qr,
        monto_online: header.monto_online,
        monto_cuenta_cliente: header.monto_cuenta_cliente,
        monto_mostrador: header.monto_mostrador,
        monto_salon: header.monto_salon,
        total_retiros: header.total_retiros,
        total_depositos: header.total_depositos,
        raw_payload: JSON.parse(JSON.stringify(data)) as Json,
      })
      .select('id')
      .single()

    if (insertErr) return { error: insertErr.message }
    const cierreId = cierre.id

    // 2. Mappings viene en arreglo paralelo a productos (mismo indice = mismo
    // item). Antes lo indexabamos por nombre, lo que colapsaba items con el
    // mismo nombre vendidos en distintos canales (ej: "Empanada de Carne" en
    // salon y delivery apuntando cada uno a una variante distinta).
    const saveAlias = new Map<string, string>() // alias -> producto_id
    for (const m of mappings) {
      if (m.save_as_alias && m.producto_id) {
        saveAlias.set(m.nombre.trim(), m.producto_id)
      }
    }

    // 3. Insertar cierre_caja_productos con producto_id donde mapeó + canal y
    // formato derivados de la categoria del PDF y del nombre.
    if (productos.length > 0) {
      const { error: prodErr } = await supabase.from('cierre_caja_productos').insert(
        productos.map((p, i) => ({
          cierre_caja_id: cierreId,
          categoria: p.categoria,
          nombre: p.nombre,
          cantidad: p.cantidad,
          monto_total: p.monto_total,
          producto_id: mappings[i]?.producto_id ?? null,
          canal: canalFromCategoria(p.categoria),
          formato: formatoFromNombre(p.nombre),
        })),
      )
      if (prodErr) return { error: prodErr.message }
    }

    // 4. Persistir alias para mapeos manuales. Como el unique index es
    // funcional (lower(trim(alias))) hacemos insert por uno y ignoramos
    // los duplicados (alias ya conocido).
    for (const [alias, producto_id] of saveAlias) {
      await supabase
        .from('producto_aliases')
        .insert({ tenant_id: tenantId, producto_id, alias, source: 'bistrosoft' })
      // Si falla por duplicado, ya está guardado; no nos importa.
    }

    // 5. Resolver dia_operativo (buscar; si no existe, abrir vía RPC)
    const fechaDia = fechaArgentina(header.fecha_cierre)
    let diaId: string | null = null
    const { data: diaExistente } = await supabase
      .from('dias_operativos')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('fecha', fechaDia)
      .maybeSingle()
    if (diaExistente) {
      diaId = diaExistente.id
    } else {
      const { data: diaNuevoId } = await supabase.rpc('abrir_dia', {
        p_tenant_id: tenantId,
        p_fecha: fechaDia,
      })
      if (diaNuevoId) diaId = diaNuevoId
    }

    let movimientosCreados = 0
    if (diaId) {
      // Link cierre → dia
      await supabase.from('cierres_caja').update({ dia_operativo_id: diaId }).eq('id', cierreId)

      // Para cada producto mapeado: upsert movimientos_diarios sumando ventas.
      // Iteramos con indice para leer mappings[i] (arreglo paralelo).
      const matched = productos
        .map((p, i) => ({ p, productoId: mappings[i]?.producto_id ?? null }))
        .filter((m): m is { p: typeof productos[number]; productoId: string } => !!m.productoId)
      for (const { p, productoId } of matched) {
        const { data: existing } = await supabase
          .from('movimientos_diarios')
          .select('id, ventas')
          .eq('dia_id', diaId)
          .eq('producto_id', productoId)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('movimientos_diarios')
            .update({ ventas: Number(existing.ventas) + p.cantidad })
            .eq('id', existing.id)
        } else {
          await supabase.from('movimientos_diarios').insert({
            dia_id: diaId,
            producto_id: productoId,
            ventas: p.cantidad,
          })
        }
        movimientosCreados++
      }
    }

    revalidatePath('/operacion/cierres')
    revalidatePath('/operacion')
    return { id: cierreId, movimientosCreados }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido al guardar' }
  }
}

// Actualiza el mapeo de UN cierre_caja_producto post-import.
// - Si el producto ya tenía mapeo previo, resta la cantidad de movimientos_diarios.
// - Si el nuevo producto_id es no-null, suma la cantidad a movimientos_diarios del producto nuevo.
// - Si save_as_alias y producto_id, persiste el alias para próximos cierres.
export async function updateCierreProductoMapping(
  cierreProductoId: string,
  newProductoId: string | null,
  saveAsAlias: boolean = true,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    // 1. Cargar el row + cierre para saber dia_operativo_id y cantidad
    const { data: cp, error: cpErr } = await supabase
      .from('cierre_caja_productos')
      .select('id, cierre_caja_id, producto_id, cantidad, nombre')
      .eq('id', cierreProductoId)
      .single()
    if (cpErr || !cp) return { error: cpErr?.message ?? 'No encontrado' }

    const { data: cierre } = await supabase
      .from('cierres_caja')
      .select('dia_operativo_id')
      .eq('id', cp.cierre_caja_id)
      .single()
    const diaId = cierre?.dia_operativo_id ?? null

    // 2. Revertir mapeo anterior si existía
    if (cp.producto_id && diaId) {
      const { data: existing } = await supabase
        .from('movimientos_diarios')
        .select('id, ventas')
        .eq('dia_id', diaId)
        .eq('producto_id', cp.producto_id)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('movimientos_diarios')
          .update({ ventas: Math.max(0, Number(existing.ventas) - Number(cp.cantidad)) })
          .eq('id', existing.id)
      }
    }

    // 3. Actualizar el mapeo en cierre_caja_productos
    await supabase
      .from('cierre_caja_productos')
      .update({ producto_id: newProductoId })
      .eq('id', cierreProductoId)

    // 4. Aplicar al nuevo producto
    if (newProductoId && diaId) {
      const { data: existing } = await supabase
        .from('movimientos_diarios')
        .select('id, ventas')
        .eq('dia_id', diaId)
        .eq('producto_id', newProductoId)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('movimientos_diarios')
          .update({ ventas: Number(existing.ventas) + Number(cp.cantidad) })
          .eq('id', existing.id)
      } else {
        await supabase.from('movimientos_diarios').insert({
          dia_id: diaId,
          producto_id: newProductoId,
          ventas: cp.cantidad,
        })
      }

      // 5. Guardar alias para futuros cierres. Como el unique index es
      // funcional (lower(trim(alias))), no podemos usar onConflict — hacemos
      // delete del alias previo si existe y luego insert. Esto garantiza que
      // si el mismo texto ya estaba asignado a otro producto, se reemplaza
      // por el nuevo (el ultimo mapeo manual del user gana).
      if (saveAsAlias) {
        const aliasNorm = cp.nombre.trim().toLowerCase()
        const { data: existing } = await supabase
          .from('producto_aliases')
          .select('id, alias, producto_id')
          .eq('tenant_id', tenantId)
          .eq('source', 'bistrosoft')
        const dup = (existing ?? []).find((a) => a.alias.trim().toLowerCase() === aliasNorm)
        if (dup && dup.producto_id !== newProductoId) {
          await supabase.from('producto_aliases').delete().eq('id', dup.id)
        }
        if (!dup || dup.producto_id !== newProductoId) {
          await supabase
            .from('producto_aliases')
            .insert({ tenant_id: tenantId, producto_id: newProductoId, alias: cp.nombre, source: 'bistrosoft' })
        }
      }
    }

    revalidatePath('/operacion')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function deleteCierreCaja(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Cargar cierre + productos para revertir ventas auto-llenadas
    const [cierreRes, productosRes] = await Promise.all([
      supabase.from('cierres_caja').select('dia_operativo_id').eq('id', id).single(),
      supabase.from('cierre_caja_productos').select('producto_id, cantidad').eq('cierre_caja_id', id),
    ])

    if (cierreRes.data?.dia_operativo_id && productosRes.data) {
      const diaId = cierreRes.data.dia_operativo_id
      for (const cp of productosRes.data) {
        if (!cp.producto_id) continue
        const { data: existing } = await supabase
          .from('movimientos_diarios')
          .select('id, ventas')
          .eq('dia_id', diaId)
          .eq('producto_id', cp.producto_id)
          .maybeSingle()
        if (existing) {
          const nuevaVenta = Math.max(0, Number(existing.ventas) - Number(cp.cantidad))
          await supabase
            .from('movimientos_diarios')
            .update({ ventas: nuevaVenta })
            .eq('id', existing.id)
        }
      }
    }

    const { error } = await supabase.from('cierres_caja').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/operacion/cierres')
    revalidatePath('/operacion')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
