/* eslint-disable */
/**
 * Seed de un tenant "Magnolia Demo" con 6 meses de datos ficticios.
 *
 * - Crea tenant + usuario demo@magnolia.com (owner).
 * - Copia el catálogo desde un tenant fuente (Magnolia Test por default).
 * - Genera ~180 cierres de caja con variabilidad realista (weekday/weekend,
 *   crecimiento +5% MoM, ruido ±15%).
 * - Genera compras a proveedores y movimientos diarios de stock.
 *
 * Uso:
 *   node scripts/seed-demo.mjs
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const DEMO_TENANT_NAME = 'Magnolia Demo'
const DEMO_EMAIL = 'demo@magnolia.com'
const DEMO_PASSWORD = 'DemoMagnolia2026!'

// Rango: 6 meses hacia atrás desde hoy (fecha del contexto: 2026-05-26)
const TODAY = new Date('2026-05-26T00:00:00Z')
const MONTHS_BACK = 6
const START = new Date(TODAY)
START.setUTCMonth(START.getUTCMonth() - MONTHS_BACK)

// Ventas base por día (ARS), mes inicial
const BASE_DAILY = 40000

// Crecimiento mes a mes
const MONTHLY_GROWTH = 0.05

// Multiplicadores día de semana → 0=Dom 1=Lun ... 6=Sáb
const WEEKDAY_MULTIPLIER = [1.4, 0.9, 0.95, 1.0, 1.05, 1.3, 1.5]

// Carga manual del .env.local (dotenv-style básico)
function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2]
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function iso(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
function isoTs(d) {
  return d.toISOString()
}
function rand(min, max) {
  return min + Math.random() * (max - min)
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}
function noise(pct = 0.15) {
  return 1 + (Math.random() * 2 - 1) * pct
}
function round2(n) {
  return Math.round(n * 100) / 100
}
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Tenant + user + membership
// ────────────────────────────────────────────────────────────────────────────

async function findSourceTenant() {
  const { data, error } = await admin
    .from('tenants')
    .select('id, name')
    .order('created_at', { ascending: true })
  if (error) throw error
  // Priorizar "Magnolia Test"; si no hay, primero el más viejo que no sea Demo
  const test = data.find((t) => t.name === 'Magnolia Test')
  if (test) return test
  const nonDemo = data.find((t) => t.name !== DEMO_TENANT_NAME)
  if (!nonDemo) throw new Error('No hay tenant fuente para copiar catálogo')
  return nonDemo
}

async function ensureDemoTenant() {
  const { data: existing } = await admin
    .from('tenants')
    .select('id, name')
    .eq('name', DEMO_TENANT_NAME)
    .maybeSingle()
  if (existing) {
    console.log(`  ✓ tenant existente ${existing.id}`)
    return existing.id
  }
  const { data, error } = await admin
    .from('tenants')
    .insert({ name: DEMO_TENANT_NAME, currency: 'ARS' })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  + tenant creado ${data.id}`)
  return data.id
}

async function ensureDemoUser() {
  // Buscar si ya existe
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users?.find((u) => u.email === DEMO_EMAIL)
  if (found) {
    console.log(`  ✓ user existente ${found.id}`)
    return found.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  console.log(`  + user creado ${data.user.id}`)
  return data.user.id
}

async function ensureMembership(userId, tenantId) {
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (existing) return console.log(`  ✓ membership existente`)
  const { error } = await admin.from('memberships').insert({
    user_id: userId,
    tenant_id: tenantId,
    role: 'owner',
    status: 'active',
  })
  if (error) throw error
  console.log(`  + membership owner creado`)
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Wipe demo (idempotente)
// ────────────────────────────────────────────────────────────────────────────

async function wipeDemoData(tenantId) {
  // Cascadea por foreign keys; igual borramos en orden seguro.
  await admin.from('cierre_caja_productos').delete().in(
    'cierre_caja_id',
    (await admin.from('cierres_caja').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? [],
  )
  await admin.from('cierres_caja').delete().eq('tenant_id', tenantId)
  await admin.from('compra_items').delete().in(
    'compra_id',
    (await admin.from('compras').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? [],
  )
  await admin.from('compras').delete().eq('tenant_id', tenantId)
  await admin.from('pagos_proveedor').delete().eq('tenant_id', tenantId)
  await admin.from('caja_movimientos').delete().eq('tenant_id', tenantId)
  await admin.from('movimientos_diarios').delete().in(
    'dia_id',
    (await admin.from('dias_operativos').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? [],
  )
  await admin.from('dias_operativos').delete().eq('tenant_id', tenantId)
  await admin.from('productos').delete().eq('tenant_id', tenantId)
  await admin.from('receta_ingredientes').delete().in(
    'receta_id',
    (await admin.from('recetas').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? [],
  )
  await admin.from('recetas').delete().eq('tenant_id', tenantId)
  await admin.from('insumo_price_history').delete().eq('tenant_id', tenantId)
  await admin.from('insumos').delete().eq('tenant_id', tenantId)
  await admin.from('proveedores').delete().eq('tenant_id', tenantId)
  await admin.from('tenant_config').delete().eq('tenant_id', tenantId)
  console.log(`  ✓ datos previos del demo borrados`)
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Copiar catálogo
// ────────────────────────────────────────────────────────────────────────────

async function copyCatalog(srcTenantId, dstTenantId) {
  // Proveedores
  const { data: srcProvs } = await admin
    .from('proveedores')
    .select('*')
    .eq('tenant_id', srcTenantId)
  const provMap = new Map()
  if (srcProvs?.length) {
    const rows = srcProvs.map((p) => ({
      tenant_id: dstTenantId,
      name: p.name,
      contact_name: p.contact_name,
      contact_phone: p.contact_phone,
      contact_email: p.contact_email,
      payment_terms_days: p.payment_terms_days,
      notes: p.notes,
      active: p.active,
      discrimina_iva: p.discrimina_iva,
      payment_rule: p.payment_rule,
    }))
    const { data, error } = await admin.from('proveedores').insert(rows).select('id, name')
    if (error) throw error
    for (const r of data) {
      const src = srcProvs.find((p) => p.name === r.name)
      if (src) provMap.set(src.id, r.id)
    }
    console.log(`  + ${data.length} proveedores`)
  }

  // Insumos
  const { data: srcInsumos } = await admin
    .from('insumos')
    .select('*')
    .eq('tenant_id', srcTenantId)
  const insMap = new Map()
  if (srcInsumos?.length) {
    const rows = srcInsumos.map((i) => ({
      tenant_id: dstTenantId,
      name: i.name,
      unit: i.unit,
      current_price: i.current_price,
      proveedor_id: i.proveedor_id ? provMap.get(i.proveedor_id) ?? null : null,
      perishable: i.perishable,
      shelf_life_days: i.shelf_life_days,
      active: i.active,
      kind: i.kind,
      track_stock: i.track_stock,
      stock_inicial: i.stock_inicial,
    }))
    const { data, error } = await admin.from('insumos').insert(rows).select('id, name')
    if (error) throw error
    for (const r of data) {
      const src = srcInsumos.find((x) => x.name === r.name)
      if (src) insMap.set(src.id, r.id)
    }
    console.log(`  + ${data.length} insumos`)
  }

  // Recetas
  const { data: srcRecetas } = await admin
    .from('recetas')
    .select('*')
    .eq('tenant_id', srcTenantId)
  const recMap = new Map()
  if (srcRecetas?.length) {
    const rows = srcRecetas.map((r) => ({
      tenant_id: dstTenantId,
      name: r.name,
      category: r.category,
      yield_qty: r.yield_qty,
      yield_unit: r.yield_unit,
      notes: r.notes,
      active: r.active,
    }))
    const { data, error } = await admin.from('recetas').insert(rows).select('id, name')
    if (error) throw error
    for (const r of data) {
      const src = srcRecetas.find((x) => x.name === r.name)
      if (src) recMap.set(src.id, r.id)
    }
    console.log(`  + ${data.length} recetas`)
  }

  // Receta ingredientes (incluye sub-recetas — necesita mapeo)
  if (recMap.size > 0) {
    const { data: srcIng } = await admin
      .from('receta_ingredientes')
      .select('*')
      .in('receta_id', [...recMap.keys()])
    if (srcIng?.length) {
      const rows = srcIng.map((ri) => ({
        receta_id: recMap.get(ri.receta_id),
        kind: ri.kind,
        insumo_id: ri.insumo_id ? insMap.get(ri.insumo_id) ?? null : null,
        sub_receta_id: ri.sub_receta_id ? recMap.get(ri.sub_receta_id) ?? null : null,
        qty: ri.qty,
        unit: ri.unit,
      }))
      const { error } = await admin.from('receta_ingredientes').insert(rows)
      if (error) throw error
      console.log(`  + ${rows.length} ingredientes`)
    }
  }

  // Productos
  const { data: srcProductos } = await admin
    .from('productos')
    .select('*')
    .eq('tenant_id', srcTenantId)
  const prodMap = new Map()
  if (srcProductos?.length) {
    const rows = srcProductos.map((p) => ({
      tenant_id: dstTenantId,
      name: p.name,
      sale_price: p.sale_price,
      receta_id: p.receta_id ? recMap.get(p.receta_id) ?? null : null,
      target_margin_pct: p.target_margin_pct,
      is_dynamic: p.is_dynamic,
      active: p.active,
    }))
    const { data, error } = await admin.from('productos').insert(rows).select('id, name')
    if (error) throw error
    for (const r of data) {
      const src = srcProductos.find((x) => x.name === r.name)
      if (src) prodMap.set(src.id, r.id)
    }
    console.log(`  + ${data.length} productos`)
  }

  // Producto descartables (si existen)
  const { data: srcDesc } = await admin
    .from('producto_descartables')
    .select('*')
    .in('producto_id', [...prodMap.keys()])
  if (srcDesc?.length) {
    const rows = srcDesc.map((d) => ({
      producto_id: prodMap.get(d.producto_id),
      insumo_id: insMap.get(d.insumo_id),
      qty: d.qty,
    })).filter((d) => d.producto_id && d.insumo_id)
    if (rows.length) {
      const { error } = await admin.from('producto_descartables').insert(rows)
      if (error) throw error
      console.log(`  + ${rows.length} descartables`)
    }
  }

  return { provMap, insMap, prodMap }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Cierres de caja (1 por día, con variabilidad)
// ────────────────────────────────────────────────────────────────────────────

async function generateCierres(tenantId, prodIds, productPrices) {
  // Asignar weight a productos: 30% "estrellas" (top), 50% normales, 20% "perros"
  const weighted = prodIds.map((id) => {
    const r = Math.random()
    const weight = r < 0.3 ? rand(3, 6) : r < 0.8 ? rand(0.6, 1.5) : rand(0.05, 0.3)
    return { id, weight }
  })
  const sumWeight = weighted.reduce((s, p) => s + p.weight, 0)

  const cierres = []
  const products = []
  let monthCounter = 0
  let lastMonth = -1

  for (let d = new Date(START); d < TODAY; d.setUTCDate(d.getUTCDate() + 1)) {
    const fecha = iso(d)
    if (d.getUTCMonth() !== lastMonth) {
      monthCounter++
      lastMonth = d.getUTCMonth()
    }
    const growthFactor = Math.pow(1 + MONTHLY_GROWTH, monthCounter - 1)
    const weekFactor = WEEKDAY_MULTIPLIER[d.getUTCDay()]
    const totalVentas = round2(BASE_DAILY * growthFactor * weekFactor * noise(0.15))

    // Distribución medios de pago
    const efectivoPct = 0.5 + rand(-0.05, 0.05)
    const tarjetasPct = 0.3 + rand(-0.05, 0.05)
    const qrPct = 0.1 + rand(-0.03, 0.03)
    const onlinePct = Math.max(0, 1 - efectivoPct - tarjetasPct - qrPct)

    const montoEfectivo = round2(totalVentas * efectivoPct)
    const montoTarjetas = round2(totalVentas * tarjetasPct)
    const montoQr = round2(totalVentas * qrPct)
    const montoOnline = round2(totalVentas * onlinePct)

    // Salón vs Mostrador
    const salonPct = 0.35 + rand(-0.05, 0.05)
    const montoSalon = round2(totalVentas * salonPct)
    const montoMostrador = round2(totalVentas - montoSalon)

    // Cubiertos: salón / ticket promedio salón (~$6500)
    const ticketSalon = rand(5000, 8000)
    const cubiertos = Math.max(1, Math.round(montoSalon / ticketSalon))

    // Cantidad de ventas: mostrador transactions + grupos de cubiertos
    const transMostrador = Math.max(1, Math.round(montoMostrador / rand(4000, 6500)))
    const gruposSalon = Math.max(1, Math.round(cubiertos / rand(1.5, 2.5)))
    const cantidadVentas = transMostrador + gruposSalon
    const ticketPromedio = round2(totalVentas / cantidadVentas)

    const fechaApertura = `${fecha}T11:00:00.000Z`
    const fechaCierre = `${fecha}T23:30:00.000Z`

    cierres.push({
      tenant_id: tenantId,
      fecha_apertura: fechaApertura,
      fecha_cierre: fechaCierre,
      monto_efectivo: montoEfectivo,
      monto_tarjetas: montoTarjetas,
      monto_qr: montoQr,
      monto_online: montoOnline,
      monto_cuenta_cliente: 0,
      monto_salon: montoSalon,
      monto_mostrador: montoMostrador,
      cubiertos,
      cantidad_ventas: cantidadVentas,
      cantidad_comandas: cantidadVentas,
      total_comandas: cantidadVentas,
      total_ventas: totalVentas,
      total_vendido: totalVentas,
      ticket_promedio: ticketPromedio,
      efectivo_apertura: 5000,
      efectivo_cierre: round2(5000 + montoEfectivo * 0.9),
      total_depositos: 0,
      total_retiros: 0,
      operador: 'demo',
      razon_social: 'Magnolia Demo',
    })
  }

  // Insertar cierres en batches y capturar IDs
  console.log(`  ▶ insertando ${cierres.length} cierres…`)
  const cierreIds = []
  for (const batch of chunk(cierres, 50)) {
    const { data, error } = await admin
      .from('cierres_caja')
      .insert(batch)
      .select('id, total_ventas')
    if (error) throw error
    cierreIds.push(...data)
  }
  console.log(`  ✓ ${cierreIds.length} cierres insertados`)

  // Por cada cierre, generar cierre_caja_productos
  console.log(`  ▶ generando productos por cierre…`)
  const allProductRows = []
  for (const cierre of cierreIds) {
    const remaining = Number(cierre.total_ventas)
    let assigned = 0
    // Elegir 10-20 productos al azar ponderados
    const picks = []
    const numItems = randInt(10, 20)
    for (let i = 0; i < numItems; i++) {
      const r = Math.random() * sumWeight
      let acc = 0
      for (const p of weighted) {
        acc += p.weight
        if (r <= acc) {
          picks.push(p.id)
          break
        }
      }
    }
    // Asignar cantidades proporcionales al weight
    const pickedSet = new Set(picks)
    const pickedArr = [...pickedSet]
    for (const prodId of pickedArr) {
      const price = productPrices.get(prodId) ?? 5000
      const weight = weighted.find((w) => w.id === prodId).weight
      const targetMonto = (remaining * weight) / pickedArr.reduce((s, id) => s + weighted.find((w) => w.id === id).weight, 0)
      const cantidad = Math.max(1, Math.round(targetMonto / price))
      const montoTotal = round2(cantidad * price)
      assigned += montoTotal
      allProductRows.push({
        cierre_caja_id: cierre.id,
        producto_id: prodId,
        nombre: '', // se completa abajo
        cantidad,
        monto_total: montoTotal,
      })
    }
  }
  // Necesitamos los nombres — fetch en lote
  const { data: prodNames } = await admin
    .from('productos')
    .select('id, name')
    .eq('tenant_id', tenantId)
  const nameMap = new Map(prodNames.map((p) => [p.id, p.name]))
  for (const row of allProductRows) row.nombre = nameMap.get(row.producto_id) ?? 'Producto'

  console.log(`  ▶ insertando ${allProductRows.length} ventas de productos…`)
  for (const batch of chunk(allProductRows, 500)) {
    const { error } = await admin.from('cierre_caja_productos').insert(batch)
    if (error) throw error
  }
  console.log(`  ✓ ventas de productos insertadas`)
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Compras a proveedores
// ────────────────────────────────────────────────────────────────────────────

async function generateCompras(tenantId, provMap, insMap) {
  // Para cada proveedor, generar 1-2 compras por semana
  const proveedorIds = [...provMap.values()]
  if (proveedorIds.length === 0) {
    console.log('  (sin proveedores, salto compras)')
    return
  }

  // Insumos por proveedor
  const { data: insumos } = await admin
    .from('insumos')
    .select('id, unit, current_price, proveedor_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
  const insumosByProv = new Map()
  for (const i of insumos ?? []) {
    if (!i.proveedor_id) continue
    if (!insumosByProv.has(i.proveedor_id)) insumosByProv.set(i.proveedor_id, [])
    insumosByProv.get(i.proveedor_id).push(i)
  }

  const compras = []
  for (let d = new Date(START); d < TODAY; d.setUTCDate(d.getUTCDate() + 7)) {
    for (const provId of proveedorIds) {
      // 70% de probabilidad de compra semanal por proveedor
      if (Math.random() > 0.7) continue
      const fechaCompra = iso(d)
      const insumosProv = insumosByProv.get(provId) ?? []
      if (insumosProv.length === 0) continue

      const numItems = randInt(2, Math.min(5, insumosProv.length))
      const items = []
      let totalCompra = 0
      const shuffled = [...insumosProv].sort(() => Math.random() - 0.5).slice(0, numItems)
      for (const ins of shuffled) {
        const qty = round2(rand(1, 20))
        const unitPrice = round2(ins.current_price * rand(0.95, 1.1))
        const subTotal = round2(qty * unitPrice)
        totalCompra += subTotal
        items.push({ insumo_id: ins.id, qty, unit: ins.unit, unit_price: unitPrice })
      }
      compras.push({
        tenant_id: tenantId,
        proveedor_id: provId,
        fecha: fechaCompra,
        status: Math.random() < 0.8 ? 'pagada' : 'pendiente',
        total: round2(totalCompra),
        _items: items,
      })
    }
  }

  // Insertar compras y luego items
  console.log(`  ▶ insertando ${compras.length} compras…`)
  for (const batch of chunk(compras, 50)) {
    const inserts = batch.map(({ _items, ...c }) => c)
    const { data, error } = await admin.from('compras').insert(inserts).select('id')
    if (error) throw error
    const itemRows = []
    for (let i = 0; i < batch.length; i++) {
      const compraId = data[i].id
      for (const it of batch[i]._items) {
        itemRows.push({ compra_id: compraId, ...it })
      }
    }
    if (itemRows.length) {
      const { error: e2 } = await admin.from('compra_items').insert(itemRows)
      if (e2) throw e2
    }
  }
  console.log(`  ✓ compras + items insertados`)
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Tenant config (IVA)
// ────────────────────────────────────────────────────────────────────────────

async function setTenantConfig(tenantId) {
  await admin.from('tenant_config').upsert(
    { tenant_id: tenantId, key: 'impuesto_digital_pct', value: 21 },
    { onConflict: 'tenant_id,key' },
  )
  console.log('  ✓ tenant_config: IVA 21%')
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed Magnolia Demo')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  console.log('\n▶ 1. Source tenant')
  const src = await findSourceTenant()
  console.log(`  source = ${src.name} (${src.id})`)

  console.log('\n▶ 2. Tenant demo')
  const demoTenantId = await ensureDemoTenant()

  console.log('\n▶ 3. User demo@magnolia.com')
  const demoUserId = await ensureDemoUser()
  await ensureMembership(demoUserId, demoTenantId)

  console.log('\n▶ 4. Wipe datos previos del demo')
  await wipeDemoData(demoTenantId)

  console.log('\n▶ 5. Copiar catálogo')
  const { provMap, insMap, prodMap } = await copyCatalog(src.id, demoTenantId)

  console.log('\n▶ 6. Tenant config')
  await setTenantConfig(demoTenantId)

  console.log('\n▶ 7. Generar 6 meses de cierres')
  const prodIds = [...prodMap.values()]
  const { data: prods } = await admin
    .from('productos')
    .select('id, sale_price')
    .eq('tenant_id', demoTenantId)
  const productPrices = new Map(prods.map((p) => [p.id, Number(p.sale_price) || 5000]))
  await generateCierres(demoTenantId, prodIds, productPrices)

  console.log('\n▶ 8. Generar compras')
  await generateCompras(demoTenantId, provMap, insMap)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Seed completo')
  console.log(`\nLogin:`)
  console.log(`  Email:    ${DEMO_EMAIL}`)
  console.log(`  Password: ${DEMO_PASSWORD}`)
}

main().catch((e) => {
  console.error('\n❌ Error:', e?.message ?? e)
  if (e?.details) console.error('Detalles:', e.details)
  process.exit(1)
})
