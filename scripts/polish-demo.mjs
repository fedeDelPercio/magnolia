/* eslint-disable */
/**
 * Polish del tenant Magnolia Demo:
 *  - Ajusta sale_prices de productos heredados para target food cost ~35%.
 *  - Suma 12 productos sintéticos (cafés, sandwiches, tortas) sin receta,
 *    con descartable_cost para que aporten al food cost.
 *  - Regenera compras con cantidades realistas por unidad de insumo.
 *  - Regenera cierre_caja_productos incluyendo todos los productos.
 *  - Genera movimientos diarios de stock para los últimos 60 días.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2]
  }
}
loadEnv()

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const TODAY = new Date('2026-05-26T00:00:00Z')
const START = new Date(TODAY); START.setUTCMonth(START.getUTCMonth() - 6)

function iso(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
function rand(min, max) { return min + Math.random() * (max - min) }
function randInt(min, max) { return Math.floor(rand(min, max + 1)) }
function noise(pct = 0.15) { return 1 + (Math.random() * 2 - 1) * pct }
function round2(n) { return Math.round(n * 100) / 100 }
function chunk(arr, size) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out }

// Productos sintéticos a sumar (cafetería típica)
const SYNTHETIC_PRODUCTS = [
  { name: 'Espresso', sale_price: 1500, target_margin_pct: 70 },
  { name: 'Cortado', sale_price: 1800, target_margin_pct: 70 },
  { name: 'Capuccino', sale_price: 2500, target_margin_pct: 65 },
  { name: 'Café con leche', sale_price: 2200, target_margin_pct: 70 },
  { name: 'Latte', sale_price: 2800, target_margin_pct: 65 },
  { name: 'Submarino', sale_price: 2900, target_margin_pct: 60 },
  { name: 'Sandwich JyQ', sale_price: 5500, target_margin_pct: 50 },
  { name: 'Sandwich Veggie', sale_price: 5800, target_margin_pct: 50 },
  { name: 'Torta Chocolate (porción)', sale_price: 4500, target_margin_pct: 55 },
  { name: 'Cheesecake (porción)', sale_price: 5200, target_margin_pct: 55 },
  { name: 'Brownie', sale_price: 3200, target_margin_pct: 60 },
  { name: 'Medialuna', sale_price: 1500, target_margin_pct: 55 },
]

async function main() {
  console.log('🎨 Polish Magnolia Demo')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Tenant demo
  const { data: demoT } = await admin.from('tenants').select('id').eq('name', 'Magnolia Demo').single()
  const tenantId = demoT.id
  console.log(`\ntenant = ${tenantId}`)

  // 2. Ajustar sale_prices de productos heredados (food cost ~35%)
  console.log('\n▶ Ajustando sale_prices heredados…')
  const { data: prodCosts } = await admin
    .from('product_costs')
    .select('id, name, sale_price, total_cost')
    .eq('tenant_id', tenantId)
  let adjusted = 0
  for (const p of prodCosts ?? []) {
    const cost = Number(p.total_cost) || 0
    if (cost <= 0) continue
    const newPrice = round2(cost / 0.35) // food cost target 35%
    const { error } = await admin
      .from('productos')
      .update({ sale_price: newPrice, target_margin_pct: 65 })
      .eq('id', p.id)
    if (!error) {
      adjusted++
      console.log(`  · ${p.name}: $${p.sale_price} → $${newPrice} (cost=$${cost})`)
    }
  }
  console.log(`  ✓ ${adjusted} productos ajustados`)

  // 3. Sumar productos sintéticos (idempotente: si ya existe el nombre, skip)
  console.log('\n▶ Sumando productos sintéticos…')
  const { data: existing } = await admin.from('productos').select('name').eq('tenant_id', tenantId)
  const existingNames = new Set(existing.map((p) => p.name))
  const newProducts = SYNTHETIC_PRODUCTS.filter((p) => !existingNames.has(p.name)).map((p) => ({
    tenant_id: tenantId,
    ...p,
    active: true,
    is_dynamic: false,
  }))
  if (newProducts.length > 0) {
    const { error } = await admin.from('productos').insert(newProducts)
    if (error) throw error
    console.log(`  + ${newProducts.length} productos sintéticos`)
  } else {
    console.log(`  (ya existían los sintéticos)`)
  }

  // 4. Wipe + regenerar compras con cantidades realistas
  console.log('\n▶ Regenerando compras realistas…')
  const oldComprasIds = (await admin.from('compras').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? []
  if (oldComprasIds.length) {
    await admin.from('compra_items').delete().in('compra_id', oldComprasIds)
    await admin.from('compras').delete().eq('tenant_id', tenantId)
  }

  const { data: provs } = await admin
    .from('proveedores')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
  const { data: insumos } = await admin
    .from('insumos')
    .select('id, name, unit, current_price, proveedor_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
  const insumosByProv = new Map()
  for (const i of insumos) {
    if (!i.proveedor_id) continue
    if (!insumosByProv.has(i.proveedor_id)) insumosByProv.set(i.proveedor_id, [])
    insumosByProv.get(i.proveedor_id).push(i)
  }

  // qty máximo razonable por unit (por compra individual)
  const maxQtyByUnit = { kg: 8, g: 1500, l: 15, ml: 1500, u: 30, docena: 10, porcion: 20 }

  const compras = []
  for (let d = new Date(START); d < TODAY; d.setUTCDate(d.getUTCDate() + 7)) {
    for (const prov of provs) {
      if (Math.random() > 0.65) continue
      const insumosProv = insumosByProv.get(prov.id) ?? []
      if (insumosProv.length === 0) continue
      const numItems = randInt(2, Math.min(4, insumosProv.length))
      const items = []
      let total = 0
      const shuffled = [...insumosProv].sort(() => Math.random() - 0.5).slice(0, numItems)
      for (const ins of shuffled) {
        const maxQty = maxQtyByUnit[ins.unit] ?? 10
        const qty = round2(rand(maxQty * 0.2, maxQty))
        const unitPrice = round2(Math.max(50, Number(ins.current_price) * rand(0.95, 1.1)))
        const sub = round2(qty * unitPrice)
        total += sub
        items.push({ insumo_id: ins.id, qty, unit: ins.unit, unit_price: unitPrice })
      }
      compras.push({
        tenant_id: tenantId,
        proveedor_id: prov.id,
        fecha: iso(d),
        status: Math.random() < 0.85 ? 'pagada' : 'pendiente',
        total: round2(total),
        _items: items,
      })
    }
  }
  console.log(`  ▶ insertando ${compras.length} compras…`)
  for (const batch of chunk(compras, 50)) {
    const inserts = batch.map(({ _items, ...c }) => c)
    const { data, error } = await admin.from('compras').insert(inserts).select('id')
    if (error) throw error
    const itemRows = []
    for (let i = 0; i < batch.length; i++) {
      for (const it of batch[i]._items) itemRows.push({ compra_id: data[i].id, ...it })
    }
    if (itemRows.length) {
      const { error: e2 } = await admin.from('compra_items').insert(itemRows)
      if (e2) throw e2
    }
  }
  console.log(`  ✓ compras + items insertados`)

  // 5. Regenerar cierre_caja_productos para incluir TODOS los productos (los sintéticos también)
  console.log('\n▶ Regenerando ventas de productos en los cierres…')
  const { data: cierres } = await admin
    .from('cierres_caja')
    .select('id, total_vendido, fecha_cierre')
    .eq('tenant_id', tenantId)
    .order('fecha_cierre', { ascending: true })
  const { data: allProds } = await admin
    .from('productos')
    .select('id, name, sale_price')
    .eq('tenant_id', tenantId)
    .eq('active', true)
  // Borrar ventas previas
  const cierreIds = cierres.map((c) => c.id)
  await admin.from('cierre_caja_productos').delete().in('cierre_caja_id', cierreIds)

  // Asignar weights estables por producto (algunos best-sellers, otros perros)
  const weighted = allProds.map((p) => {
    const r = Math.random()
    const weight = r < 0.25 ? rand(4, 8) : r < 0.7 ? rand(0.8, 2) : rand(0.1, 0.5)
    return { id: p.id, name: p.name, price: Number(p.sale_price) || 2000, weight }
  })
  const sumW = weighted.reduce((s, p) => s + p.weight, 0)

  const allProductRows = []
  for (const cierre of cierres) {
    const total = Number(cierre.total_vendido)
    // Elegir 10-18 productos al azar ponderados
    const picks = new Set()
    const numItems = randInt(10, Math.min(18, allProds.length))
    while (picks.size < numItems) {
      const r = Math.random() * sumW
      let acc = 0
      for (const p of weighted) {
        acc += p.weight
        if (r <= acc) { picks.add(p.id); break }
      }
    }
    const pickedArr = [...picks].map((id) => weighted.find((w) => w.id === id))
    const sumPicked = pickedArr.reduce((s, p) => s + p.weight, 0)
    for (const p of pickedArr) {
      const targetMonto = (total * p.weight) / sumPicked
      const cantidad = Math.max(1, Math.round(targetMonto / p.price))
      const montoTotal = round2(cantidad * p.price)
      allProductRows.push({
        cierre_caja_id: cierre.id,
        producto_id: p.id,
        nombre: p.name,
        cantidad,
        monto_total: montoTotal,
      })
    }
  }
  console.log(`  ▶ insertando ${allProductRows.length} ventas (con ${allProds.length} productos)…`)
  for (const batch of chunk(allProductRows, 500)) {
    const { error } = await admin.from('cierre_caja_productos').insert(batch)
    if (error) throw error
  }
  console.log(`  ✓ ventas regeneradas`)

  // 6. Movimientos diarios + dias_operativos para últimos 60 días (stock crítico)
  console.log('\n▶ Generando dias_operativos + movimientos para últimos 60 días…')
  const startMov = new Date(TODAY); startMov.setUTCDate(startMov.getUTCDate() - 60)
  // Limpiar previos del demo
  const prevDias = (await admin.from('dias_operativos').select('id').eq('tenant_id', tenantId)).data?.map((r) => r.id) ?? []
  if (prevDias.length) {
    await admin.from('movimientos_diarios').delete().in('dia_id', prevDias)
    await admin.from('dias_operativos').delete().eq('tenant_id', tenantId)
  }

  const diasRows = []
  for (let d = new Date(startMov); d < TODAY; d.setUTCDate(d.getUTCDate() + 1)) {
    diasRows.push({
      tenant_id: tenantId,
      fecha: iso(d),
      status: 'cerrado',
      closed_at: `${iso(d)}T23:30:00.000Z`,
    })
  }
  const { data: diasInserted } = await admin.from('dias_operativos').insert(diasRows).select('id, fecha')
  console.log(`  + ${diasInserted.length} días operativos`)

  // Para cada producto + cada día, generar 1 movimiento_diario
  const movRows = []
  for (const dia of diasInserted) {
    for (const p of allProds) {
      const ventas = randInt(0, 30)
      const produccion = ventas + randInt(0, 5)
      const desperdicio = Math.random() < 0.2 ? randInt(0, 2) : 0
      movRows.push({
        dia_id: dia.id,
        producto_id: p.id,
        produccion,
        ventas,
        desperdicio,
        almuerzo: 0,
        stock_anterior: 0,
        stock_calculado: produccion - ventas - desperdicio,
      })
    }
  }
  console.log(`  ▶ insertando ${movRows.length} movimientos…`)
  for (const batch of chunk(movRows, 500)) {
    const { error } = await admin.from('movimientos_diarios').insert(batch)
    if (error) throw error
  }
  console.log(`  ✓ movimientos insertados`)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Polish completo')
}

main().catch((e) => {
  console.error('\n❌ Error:', e?.message ?? e)
  if (e?.details) console.error('Detalles:', e.details)
  process.exit(1)
})
