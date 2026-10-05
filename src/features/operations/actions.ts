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
    stock_anterior?: number
    stock_anterior_manual?: boolean
    produccion?: number
    ventas?: number
    desperdicio?: number
    almuerzo?: number
    conteo_fisico?: number | null
  },
): Promise<{ error?: string; permanente?: boolean }> {
  const supabase = await createClient()

  // Un día cerrado no se edita (una pestaña vieja o un guardado demorado podía
  // escribir igual y disparar el arrastre). Para corregirlo, se reabre.
  const { data: fila } = await supabase
    .from('movimientos_diarios')
    .select('dias_operativos(status)')
    .eq('id', id)
    .maybeSingle()
  const status = (fila as unknown as { dias_operativos: { status: string } | null } | null)?.dias_operativos?.status
  if (status === 'cerrado') {
    return {
      error: 'el día ya está cerrado (quizás lo cerró otra persona). Para corregirlo, reabrilo.',
      permanente: true,
    }
  }

  const { error } = await supabase
    .from('movimientos_diarios')
    .update(fields)
    .eq('id', id)

  if (error) {
    // Mensajes de la base en castellano para la usuaria; el error real queda
    // en el log del servidor para diagnosticarlo.
    console.error('saveMovimiento', id, error)
    if (error.code === '22003') return { error: 'el número es demasiado grande', permanente: true }
    return { error: 'no se pudo guardar, probá de nuevo' }
  }
  return {}
}

export async function traerStockDiaAnterior(diaId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('resembrar_stock_inicial', { p_dia_id: diaId })
  if (error) return { error: error.message }

  revalidatePath('/operacion')
  revalidatePath(`/operacion/${diaId}`)
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

// Mueve unidades vendidas de un producto a otro dentro del mismo día. Caso
// típico: en el POS se cobró como "Genérico" algo que era una empanada. Las
// dos filas guardan el cambio como ajuste manual sobre lo que trajo Bistro
// (ventas vs ventas_bistro), así que el sync lo conserva en cada corrida.
// Solo en días abiertos: un día cerrado se reabre primero, como cualquier
// otra edición.
export async function reasignarVentas(input: {
  diaId: string
  desdeMovId: string
  haciaMovId: string
  cantidad: number
  // Ventas del origen que mostraba el diálogo. Si en la base hay otra cosa
  // (otra pestaña, un reintento después de un corte), no se aplica.
  ventasDesdeEsperadas: number
}): Promise<{ error?: string }> {
  const { diaId, desdeMovId, haciaMovId } = input
  const cantidad = Number(input.cantidad)
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return { error: 'La cantidad tiene que ser un número entero mayor a 0' }
  }
  if (desdeMovId === haciaMovId) return { error: 'Elegí un producto distinto al de origen' }

  const supabase = await createClient()

  const { data: dia } = await supabase
    .from('dias_operativos')
    .select('id, status')
    .eq('id', diaId)
    .maybeSingle()
  if (!dia) return { error: 'Día no encontrado' }
  if (dia.status !== 'abierto') return { error: 'El día está cerrado. Reabrilo para reasignar ventas.' }

  const { data: filas, error: filasErr } = await supabase
    .from('movimientos_diarios')
    .select('id, dia_id, ventas')
    .in('id', [desdeMovId, haciaMovId])
  if (filasErr) return { error: filasErr.message }
  const desde = filas?.find((f) => f.id === desdeMovId)
  const hacia = filas?.find((f) => f.id === haciaMovId)
  if (!desde || !hacia || desde.dia_id !== diaId || hacia.dia_id !== diaId) {
    return { error: 'Los productos no corresponden a este día' }
  }
  const ventasDesde = Number(desde.ventas) || 0
  if (Math.abs(ventasDesde - Number(input.ventasDesdeEsperadas)) > 0.0005) {
    return { error: 'Las ventas cambiaron mientras tanto (¿ya se reasignó?). Recargá la página para ver cómo quedó.' }
  }
  if (cantidad > ventasDesde) {
    return { error: `Solo hay ${ventasDesde} venta${ventasDesde === 1 ? '' : 's'} para reasignar` }
  }

  // Sin transacciones desde el cliente: primero restamos en el origen y, si
  // sumar en el destino falla, devolvemos el origen a como estaba.
  // El .eq('ventas') es un control de concurrencia: si alguien editó la fila
  // entre la lectura y acá, no se toca nada.
  const { data: restada, error: e1 } = await supabase
    .from('movimientos_diarios')
    .update({ ventas: ventasDesde - cantidad })
    .eq('id', desdeMovId)
    .eq('ventas', desde.ventas)
    .select('id')
  if (e1) return { error: e1.message }
  if (!restada || restada.length !== 1) {
    return { error: 'Las ventas cambiaron mientras tanto. Recargá la página y probá de nuevo.' }
  }

  const { error: e2 } = await supabase
    .from('movimientos_diarios')
    .update({ ventas: (Number(hacia.ventas) || 0) + cantidad })
    .eq('id', haciaMovId)
  if (e2) {
    await supabase.from('movimientos_diarios').update({ ventas: desde.ventas }).eq('id', desdeMovId)
    return { error: e2.message }
  }

  revalidatePath(`/operacion/${diaId}`)
  return {}
}

// Ventas actuales de un día, para que el diálogo de reasignar muestre lo que
// hay ahora en la base y no lo que había al abrir la página (la grilla pudo
// haberlas corregido mientras tanto).
export async function getVentasDelDia(
  diaId: string,
): Promise<{ data?: { id: string; ventas: number }[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('movimientos_diarios')
    .select('id, ventas')
    .eq('dia_id', diaId)
  if (error) return { error: error.message }
  return { data: (data ?? []).map((m) => ({ id: m.id, ventas: Number(m.ventas) || 0 })) }
}
