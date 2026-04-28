'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { CajaEgresoFormValues } from '@/features/suppliers/schemas'

export async function createEgreso(values: CajaEgresoFormValues): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('caja_movimientos').insert({
    tenant_id: tenantId,
    fecha: values.fecha,
    tipo: 'egreso',
    categoria: values.categoria,
    monto: values.monto,
    descripcion: values.descripcion || null,
    ref_kind: 'gasto_manual',
  })

  if (error) return { error: error.message }

  revalidatePath('/caja')
  return {}
}
