import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type DiaOperativo = Tables<'dias_operativos'>

export type MovimientoConProducto = Tables<'movimientos_diarios'> & {
  productos: Pick<Tables<'productos'>, 'name' | 'sale_price'>
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

export async function getDia(diaId: string): Promise<DiaConMovimientos | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select(`
      *,
      movimientos_diarios(
        *,
        productos(name, sale_price)
      )
    `)
    .eq('id', diaId)
    .single()

  if (error || !data) return null

  // Si el día está abierto, sincronizamos: agregamos movimientos para
  // productos activos que se crearon después de abrir el día.
  // Para esos movimientos nuevos, heredamos stock_anterior del último día
  // cerrado (mismo tenant, fecha anterior). Los días cerrados son inmutables.
  if (data.status === 'abierto') {
    const existingProductIds = new Set(
      (data.movimientos_diarios as Array<{ producto_id: string }>).map((m) => m.producto_id),
    )

    const { data: activeProducts } = await supabase
      .from('productos')
      .select('id')
      .eq('tenant_id', data.tenant_id)
      .eq('active', true)

    const missing = (activeProducts ?? []).filter((p) => !existingProductIds.has(p.id))

    if (missing.length > 0) {
      // Buscamos el último día cerrado anterior para heredar stock
      const { data: prevClosed } = await supabase
        .from('dias_operativos')
        .select('id')
        .eq('tenant_id', data.tenant_id)
        .eq('status', 'cerrado')
        .lt('fecha', data.fecha)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Mapa producto_id → conteo_fisico del último día cerrado
      const prevStock = new Map<string, number>()
      if (prevClosed) {
        const { data: prevMovs } = await supabase
          .from('movimientos_diarios')
          .select('producto_id, conteo_fisico')
          .eq('dia_id', prevClosed.id)
          .in(
            'producto_id',
            missing.map((p) => p.id),
          )
        for (const m of prevMovs ?? []) {
          prevStock.set(m.producto_id, m.conteo_fisico ?? 0)
        }
      }

      await supabase.from('movimientos_diarios').insert(
        missing.map((p) => ({
          dia_id: diaId,
          producto_id: p.id,
          stock_anterior: prevStock.get(p.id) ?? 0,
          produccion: 0,
          ventas: 0,
          desperdicio: 0,
          almuerzo: 0,
        })),
      )

      const { data: refreshed } = await supabase
        .from('dias_operativos')
        .select(`
          *,
          movimientos_diarios(
            *,
            productos(name, sale_price)
          )
        `)
        .eq('id', diaId)
        .single()

      return refreshed as unknown as DiaConMovimientos
    }
  }

  return data as unknown as DiaConMovimientos
}
