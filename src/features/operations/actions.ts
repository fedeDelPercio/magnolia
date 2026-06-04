'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { generarPagosDelDia } from '@/features/empleados/actions'

export async function abrirDia(fecha: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Idempotente: si ya existe el día devolvemos su id
  const { data: existing } = await supabase
    .from('dias_operativos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('fecha', fecha)
    .maybeSingle()

  if (existing) {
    return { id: existing.id }
  }

  const { data, error } = await supabase.rpc('abrir_dia', {
    p_tenant_id: tenantId,
    p_fecha: fecha,
  })

  if (error) return { error: error.message }

  revalidatePath('/operacion')
  return { id: data as string }
}

export async function saveMovimiento(
  id: string,
  fields: {
    produccion?: number
    ventas?: number
    desperdicio?: number
    almuerzo?: number
    conteo_fisico?: number | null
  },
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('movimientos_diarios')
    .update(fields)
    .eq('id', id)

  if (error) return { error: error.message }
  return {}
}

export async function cerrarDia(diaId: string): Promise<{ error?: string; sueldosPagados?: number }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('cerrar_dia', { p_dia_id: diaId })
  if (error) return { error: error.message }

  // Al cerrar el día, generamos automáticamente los pagos de sueldos del personal
  // que trabajó ese día (modelo "se paga en mano cada día"). Es idempotente:
  // re-cerrar el mismo día no duplica los egresos.
  const pagos = await generarPagosDelDia(diaId)

  revalidatePath('/operacion')
  revalidatePath(`/operacion/${diaId}`)
  revalidatePath('/caja')
  return { sueldosPagados: pagos.count }
}

export async function reabrirDia(diaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('dias_operativos')
    .update({ status: 'abierto', closed_at: null, closed_by: null })
    .eq('id', diaId)

  if (error) return { error: error.message }

  revalidatePath('/operacion')
  revalidatePath(`/operacion/${diaId}`)
  return {}
}
