'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const egresoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida'),
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
  descripcion: z.string().trim().min(1, 'Pone una descripcion').max(500),
})

export type EgresoInput = z.infer<typeof egresoSchema>

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
    descripcion: parsed.data.descripcion,
    source: 'manual',
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
