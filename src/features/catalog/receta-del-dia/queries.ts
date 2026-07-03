import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

// Etiquetas DOW: 0=domingo, 1=lunes, ..., 6=sabado. Usamos el orden que devuelve
// getDay() del Date de JS para no tener que hacer conversiones.
export const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

export type RecetaDelDiaAsignacion = {
  dow: number
  producto_id: string
  producto_name: string
  concepto_id: string | null
  concepto_name: string | null
}

// Devuelve las 7 asignaciones (una por DOW), con producto null si no hay.
// El componente pinta los slots vacios como "Sin asignar".
export async function getRecetaDelDia(): Promise<Array<{ dow: number; asignacion: RecetaDelDiaAsignacion | null }>> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('receta_del_dia')
    .select(
      'dow, producto_id, productos:productos!inner(name, concepto_id, producto_conceptos:producto_conceptos(name))',
    )
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as Array<{
    dow: number
    producto_id: string
    productos: {
      name: string
      concepto_id: string | null
      producto_conceptos: { name: string } | null
    }
  }>

  const byDow = new Map<number, RecetaDelDiaAsignacion>()
  for (const r of rows) {
    byDow.set(r.dow, {
      dow: r.dow,
      producto_id: r.producto_id,
      producto_name: r.productos.name,
      concepto_id: r.productos.concepto_id,
      concepto_name: r.productos.producto_conceptos?.name ?? null,
    })
  }

  return Array.from({ length: 7 }, (_, dow) => ({
    dow,
    asignacion: byDow.get(dow) ?? null,
  }))
}
