import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type InsumoStock = {
  stock_actual: number | null
  stock_referencia: number | null
  unit: string | null
}

export type InsumoWithProveedor = Tables<'insumos'> & {
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'> | null
  stock: InsumoStock | null
}

export async function getInsumos(): Promise<InsumoWithProveedor[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Filtro explícito por tenant activo: RLS sola mezcla los tenants de un
  // usuario miembro de varios (ver nota en recetas/queries.ts).
  const [insumosResult, stockResult] = await Promise.all([
    supabase.from('insumos').select('*, proveedores(id, name)').eq('tenant_id', tenantId).order('name'),
    supabase
      .from('insumo_stock')
      .select('insumo_id, stock_actual, stock_referencia, unit')
      .eq('tenant_id', tenantId),
  ])

  if (insumosResult.error) throw insumosResult.error

  const stockMap = new Map(
    (stockResult.data ?? []).map((s) => [s.insumo_id, s]),
  )

  return (insumosResult.data as unknown as InsumoWithProveedor[]).map((i) => ({
    ...i,
    stock: stockMap.get(i.id) ?? null,
  }))
}

export async function getProveedores(): Promise<Pick<Tables<'proveedores'>, 'id' | 'name'>[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('proveedores')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}

export type PriceHistoryEntry = Pick<
  Tables<'insumo_price_history'>,
  'id' | 'price' | 'source' | 'valid_from'
> & {
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'> | null
}

export async function getInsumoHistory(insumoId: string): Promise<PriceHistoryEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumo_price_history')
    .select('id, price, source, valid_from, proveedores(id, name)')
    .eq('insumo_id', insumoId)
    .order('valid_from', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as unknown as PriceHistoryEntry[]
}

// Cantidad comprada por compra para un insumo — se muestra en la ficha del
// catálogo junto al historial de precios (renegociar volumen / detectar desvíos).
export type CompraQtyEntry = {
  id: string
  qty: number
  fecha: string
  proveedor_name: string | null
}

export async function getInsumoComprasQty(insumoId: string): Promise<CompraQtyEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('compra_items')
    .select('id, qty, compras!inner(fecha, proveedores(name))')
    .eq('insumo_id', insumoId)
  if (error) throw error

  type Row = { id: string; qty: number; compras: { fecha: string; proveedores: { name: string } | null } }
  // Supabase no ordena el padre por columnas del embed — ordenamos acá.
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({
      id: r.id,
      qty: r.qty,
      fecha: r.compras.fecha,
      proveedor_name: r.compras.proveedores?.name ?? null,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 30)
}

// "Usado en": productos que contienen el insumo (via receta expandida o como
// descartable) con la apertura de consumo de stock, + sub-recetas que lo
// llevan directo. Para detectar errores de armado ("la carne picada tendría
// que estar también en las empanadas") y ver cómo se reparte el gasto.
export type InsumoUsadoEn = {
  productos: {
    producto_id: string
    producto_name: string
    via: 'receta' | 'descartable'
    qty_por_unidad: number
    consumido: number
  }[]
  subRecetas: { id: string; name: string }[]
}

export async function getInsumoUsadoEn(insumoId: string): Promise<InsumoUsadoEn> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const [usoRes, directoRes, prodBackedRes] = await Promise.all([
    supabase.rpc('insumo_usado_en', { p_insumo_id: insumoId }),
    // Recetas que llevan el insumo DIRECTO — para separar las sub-recetas.
    supabase
      .from('receta_ingredientes')
      .select('receta_id, recetas!receta_ingredientes_receta_id_fkey(id, name)')
      .eq('kind', 'insumo')
      .eq('insumo_id', insumoId),
    supabase.from('productos').select('receta_id').eq('tenant_id', tenantId).not('receta_id', 'is', null),
  ])
  if (usoRes.error) throw usoRes.error

  // Una receta que es backing 1:1 de un producto no es una "sub-receta" para
  // el usuario (ya aparece como producto en la lista de arriba).
  const backed = new Set((prodBackedRes.data ?? []).map((p) => p.receta_id))
  const subRecetas = ((directoRes.data ?? []) as unknown as { receta_id: string; recetas: { id: string; name: string } | null }[])
    .filter((r) => r.recetas && !backed.has(r.receta_id))
    .map((r) => ({ id: r.recetas!.id, name: r.recetas!.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const productos = (usoRes.data ?? [])
    .map((r) => ({
      producto_id: r.producto_id,
      producto_name: r.producto_name,
      via: (r.via === 'descartable' ? 'descartable' : 'receta') as 'receta' | 'descartable',
      qty_por_unidad: Number(r.qty_por_unidad) || 0,
      consumido: Number(r.consumido) || 0,
    }))
    .sort((a, b) => b.consumido - a.consumido || a.producto_name.localeCompare(b.producto_name))

  return { productos, subRecetas }
}

export type StockAjusteEntry = {
  id: string
  stock_teorico: number
  stock_real: number
  diferencia: number
  notas: string | null
  created_at: string
}

export async function getStockAjustes(insumoId: string): Promise<StockAjusteEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumo_stock_ajustes')
    .select('id, stock_teorico, stock_real, diferencia, notas, created_at')
    .eq('insumo_id', insumoId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as StockAjusteEntry[]
}
