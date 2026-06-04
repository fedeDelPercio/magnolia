import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type CierreCaja = Tables<'cierres_caja'>
export type CierreCajaProducto = Tables<'cierre_caja_productos'>

export type CierreCajaWithProductos = CierreCaja & {
  cierre_caja_productos: CierreCajaProducto[]
}

export type ProductoBasico = { id: string; name: string }

export async function getCierresByDia(diaId: string): Promise<CierreCajaWithProductos[]> {
  const supabase = await createClient()
  const [cierresRes, productosRes] = await Promise.all([
    supabase
      .from('cierres_caja')
      .select('*')
      .eq('dia_operativo_id', diaId)
      .order('fecha_cierre', { ascending: false }),
    supabase
      .from('cierre_caja_productos')
      .select('*')
      .in(
        'cierre_caja_id',
        // workaround: fetch all rows; we'll filter client-side
        (
          await supabase
            .from('cierres_caja')
            .select('id')
            .eq('dia_operativo_id', diaId)
        ).data?.map((c) => c.id) ?? [],
      ),
  ])
  if (cierresRes.error) throw new Error(cierresRes.error.message)
  const productosByCierre = new Map<string, CierreCajaProducto[]>()
  for (const p of productosRes.data ?? []) {
    const arr = productosByCierre.get(p.cierre_caja_id) ?? []
    arr.push(p)
    productosByCierre.set(p.cierre_caja_id, arr)
  }
  return (cierresRes.data ?? []).map((c) => ({
    ...c,
    cierre_caja_productos: productosByCierre.get(c.id) ?? [],
  }))
}

export async function getProductosForMatching(): Promise<ProductoBasico[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('productos')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCierresCaja(): Promise<CierreCaja[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .order('fecha_cierre', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getMonthlyDigitalTotal(month: string): Promise<number> {
  const supabase = await createClient()
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from('cierres_caja_active')
    .select('monto_tarjetas, monto_qr, monto_online')
    .gte('fecha_cierre', from)
    .lt('fecha_cierre', to)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (sum, c) => sum + (c.monto_tarjetas ?? 0) + (c.monto_qr ?? 0) + (c.monto_online ?? 0),
    0,
  )
}

export type MonthlyVentasSummary = {
  total: number
  efectivo: number
  digital: number
  count: number
}

export async function getMonthlyVentasSummary(month: string): Promise<MonthlyVentasSummary> {
  const supabase = await createClient()
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from('cierres_caja_active')
    .select('monto_efectivo, monto_tarjetas, monto_qr, monto_online')
    .gte('fecha_cierre', from)
    .lt('fecha_cierre', to)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const efectivo = rows.reduce((s, c) => s + (c.monto_efectivo ?? 0), 0)
  const digital = rows.reduce(
    (s, c) => s + (c.monto_tarjetas ?? 0) + (c.monto_qr ?? 0) + (c.monto_online ?? 0),
    0,
  )
  return { total: efectivo + digital, efectivo, digital, count: rows.length }
}

export async function getCierreCaja(id: string): Promise<CierreCajaWithProductos | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*, cierre_caja_productos(*)')
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as CierreCajaWithProductos
}
