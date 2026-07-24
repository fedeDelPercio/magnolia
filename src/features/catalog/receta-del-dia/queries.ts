import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { mondayOf, addWeeks } from '@/lib/week'

export { DOW_LABELS, type RecetaDelDiaAsignacion, type RecetaSemana } from './constants'
import { SEMANA_OFFSETS, type RecetaDelDiaAsignacion, type RecetaSemana } from './constants'

// Devuelve el menú de 4 semanas: las 2 pasadas + la actual + la próxima.
// La semana actual se calcula con la fecha de hoy (lunes de esta semana), así
// que rota sola cada lunes. Cada semana trae sus 7 días (asignación null si no
// hay). Solo la actual y la próxima son editables.
export async function getRecetaDelDiaSemanas(): Promise<RecetaSemana[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const currentMonday = mondayOf(new Date())
  const weeks = SEMANA_OFFSETS.map((offset) => ({
    offset,
    week_start: addWeeks(currentMonday, offset),
  }))
  const weekStarts = weeks.map((w) => w.week_start)

  const { data, error } = await supabase
    .from('receta_del_dia')
    .select(
      'week_start, dow, producto_id, productos:productos!inner(name, concepto_id, producto_conceptos:producto_conceptos(name))',
    )
    .eq('tenant_id', tenantId)
    .in('week_start', weekStarts)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as Array<{
    week_start: string
    dow: number
    producto_id: string
    productos: {
      name: string
      concepto_id: string | null
      producto_conceptos: { name: string } | null
    }
  }>

  // Index por 'week_start|dow'
  const byKey = new Map<string, RecetaDelDiaAsignacion>()
  for (const r of rows) {
    byKey.set(`${r.week_start}|${r.dow}`, {
      dow: r.dow,
      producto_id: r.producto_id,
      producto_name: r.productos.name,
      concepto_id: r.productos.concepto_id,
      concepto_name: r.productos.producto_conceptos?.name ?? null,
    })
  }

  return weeks.map((w) => ({
    week_start: w.week_start,
    offset: w.offset,
    editable: w.offset >= 0, // actual (0) y próxima (1)
    dias: Array.from({ length: 7 }, (_, dow) => ({
      dow,
      asignacion: byKey.get(`${w.week_start}|${dow}`) ?? null,
    })),
  }))
}
