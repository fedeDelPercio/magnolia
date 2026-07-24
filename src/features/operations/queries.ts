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

  // Si el día está abierto, sincronizamos: agregamos movimientos para
  // productos activos que se crearon después de abrir el día.
  // Para esos movimientos nuevos, heredamos stock_anterior del último día
  // previo (sin exigir que esté cerrado — en la práctica quedan abiertos):
  // el conteo físico si se cargó, o el teórico en vivo si no.
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

    if (missing.length > 0) {
      // Buscamos el último día anterior (cualquier estado) para heredar stock
      const { data: prevDia } = await supabase
        .from('dias_operativos')
        .select('id')
        .eq('tenant_id', data.tenant_id)
        .lt('fecha', data.fecha)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Mapa producto_id → stock final del día anterior (conteo físico si se
      // cargó, o teórico en vivo: stock_ant + prod - ventas - desperd - almuerzo)
      const prevStock = new Map<string, number>()
      if (prevDia) {
        const { data: prevMovs } = await supabase
          .from('movimientos_diarios')
          .select('producto_id, conteo_fisico, stock_anterior, produccion, ventas, desperdicio, almuerzo')
          .eq('dia_id', prevDia.id)
          .in(
            'producto_id',
            missing.map((p) => p.id),
          )
        for (const m of prevMovs ?? []) {
          const teorico =
            (m.stock_anterior ?? 0) + (m.produccion ?? 0) - (m.ventas ?? 0) - (m.desperdicio ?? 0) - (m.almuerzo ?? 0)
          prevStock.set(m.producto_id, m.conteo_fisico ?? teorico)
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
