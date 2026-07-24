'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const baseSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida'),
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
  descripcion: z.string().trim().max(500).optional().nullable(),
})

// Ingreso al fondo. `origen` indica de que cuenta salio la plata:
//  - 'externo'        = aporte de afuera (no descuenta otra cuenta)
//  - 'caja_efectivo'  = derivado desde Caja Mayor (le baja el saldo)
//  - 'cuenta_digital' = derivado desde Medios Digitales (le baja el saldo)
const ingresoSchema = baseSchema.extend({
  origen: z.enum(['externo', 'caja_efectivo', 'cuenta_digital']),
})
// Egreso del fondo: salida simple con categoria editable (reusa caja_categorias).
const egresoSchema = baseSchema.extend({
  categoria: z.string().trim().min(1).max(80).nullable().optional(),
})

export type IngresoFondoInput = z.infer<typeof ingresoSchema>
export type EgresoFondoInput = z.infer<typeof egresoSchema>

export async function registrarIngresoFondo(input: IngresoFondoInput): Promise<{ error?: string }> {
  const parsed = ingresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('fondo_emergencia_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'ingreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    origen: parsed.data.origen,
    source: 'manual',
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  // El traspaso desde digital afecta el saldo digital que tambien mira el dashboard.
  if (parsed.data.origen === 'cuenta_digital') revalidatePath('/dashboard')
  return {}
}

export async function registrarEgresoFondo(input: EgresoFondoInput): Promise<{ error?: string }> {
  const parsed = egresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('fondo_emergencia_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'egreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: parsed.data.categoria ?? null,
    origen: 'externo',
    source: 'manual',
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

export async function deleteFondoMovimiento(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // Al borrar un ingreso con origen != externo, la plata "vuelve" sola a su
  // cuenta de origen (la resta desaparece de esa cuenta al recalcular su saldo).
  const { error } = await supabase
    .from('fondo_emergencia_movimientos')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
  if (error) return { error: error.message }
  revalidatePath('/caja')
  revalidatePath('/dashboard')
  return {}
}
