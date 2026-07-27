import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type DiaOperativo = Tables<'dias_operativos'>

export type MovimientoConProducto = Tables<'movimientos_diarios'> & {
  productos: Pick<Tables<'productos'>, 'name' | 'sale_price' | 'concepto_id' | 'canal' | 'formato'>
}

export type DiaConMovimientos = DiaOperativo & {
  movimientos_diarios: MovimientoConProducto[]
}

export async function getDias(): Promise<DiaOperativo[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('fecha', { ascending: false })
    .limit(60)

  if (error) throw new Error(error.message)
  return data
}

/** Días operativos en un mes específico ('YYYY-MM'). */
export async function getDiasMes(month: string): Promise<DiaOperativo[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('dias_operativos')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('fecha', from)
    .lt('fecha', nextMonth)
    .order('fecha', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function getDia(diaId: string): Promise<DiaConMovimientos | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select(`
      *,
      movimientos_diarios(
        *,
        productos(name, sale_price, concepto_id, canal, formato)
      )
    `)
    .eq('id', diaId)
    .single()

  if (error || !data) return null

  // Si el día está abierto: (1) agregamos movimientos para productos activos
  // creados después de abrir el día; (2) arrastramos automáticamente el
  // stock_anterior desde el día previo en las filas NO editadas a mano
  // (conteo físico, o teórico en vivo si no se contó; cortado en 0). Así el
  // stock inicial siempre refleja lo que quedó ayer sin tener que cerrar el día.
  // Los días cerrados son inmutables.
  if (data.status === 'abierto') {
    const existingProductIds = new Set(
      (data.movimientos_diarios as unknown as Array<{ producto_id: string }>).map((m) => m.producto_id),
    )

    const { data: activeProducts } = await supabase
      .from('productos')
      .select('id')
      .eq('tenant_id', data.tenant_id)
      .eq('active', true)

    const missing = (activeProducts ?? []).filter((p) => !existingProductIds.has(p.id))

    let changed = false

    if (missing.length > 0) {
      // Los insertamos en 0; sync_stock_inicial les deriva el stock del día previo.
      await supabase.from('movimientos_diarios').insert(
        missing.map((p) => ({
          dia_id: diaId,
          producto_id: p.id,
          produccion: 0,
          ventas: 0,
          desperdicio: 0,
          almuerzo: 0,
        })),
      )
      changed = true
    }

    const { data: synced } = await supabase.rpc('sync_stock_inicial', { p_dia_id: diaId })
    if ((synced ?? 0) > 0) changed = true

    if (changed) {
      const { data: refreshed } = await supabase
        .from('dias_operativos')
        .select(`
          *,
          movimientos_diarios(
            *,
            productos(name, sale_price, concepto_id, canal, formato)
          )
        `)
        .eq('id', diaId)
        .single()

      return refreshed as unknown as DiaConMovimientos
    }
  }

  return data as unknown as DiaConMovimientos
}
