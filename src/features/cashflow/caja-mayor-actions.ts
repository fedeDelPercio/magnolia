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

const egresoSchema = baseSchema
const ingresoSchema = baseSchema.extend({
  origen: z.enum(['externo', 'caja_efectivo', 'cuenta_digital']),
})

export type EgresoInput = z.infer<typeof egresoSchema>
export type IngresoInput = z.infer<typeof ingresoSchema>

export async function registrarEgresoCajaMayor(input: EgresoInput): Promise<{ error?: string }> {
  const parsed = egresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('caja_mayor_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'egreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    source: 'manual',
    origen: 'externo',
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

// Ingreso manual a Caja Mayor con origen explicito. Si origen='caja_efectivo'
// el monto se descuenta del saldo de caja efectivo (sumando virtualmente como
// retiro en BistroCajaSummary). Si origen='cuenta_digital' se descuenta del
// saldo de cuenta digital. Si origen='externo' es plata que entro desde afuera
// (prestamo, aporte, etc.) y solo suma a caja mayor.
export async function registrarIngresoCajaMayor(input: IngresoInput): Promise<{ error?: string }> {
  const parsed = ingresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('caja_mayor_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'ingreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    source: 'manual',
    origen: parsed.data.origen,
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

export async function deleteCajaMayorMovimiento(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // Solo permitimos borrar movimientos manuales — los que vienen de Bistro
  // se manejan desde el flujo de sincronizacion para no romper el linkeo.
  const { error } = await supabase
    .from('caja_mayor_movimientos')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

// Registra un egreso de cuenta digital (transferencia bancaria, pago Mercado
// Pago, etc.) que no este vinculado a un pago a proveedor. Crea un row en
// caja_movimientos con categoria 'Egreso digital' para que se identifique
// como digital en el calculo del saldo.
const egresoDigitalSchema = baseSchema.extend({
  categoria: z.string().trim().max(80).optional(),
})

export type EgresoDigitalInput = z.infer<typeof egresoDigitalSchema>

export async function registrarEgresoDigital(input: EgresoDigitalInput): Promise<{ error?: string }> {
  const parsed = egresoDigitalSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('caja_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'egreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: 'Egreso digital',
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}
