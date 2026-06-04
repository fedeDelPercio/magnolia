'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const KEY_DIGITAL_TAX = 'impuesto_digital_pct'
const KEY_LIMITE_CHEQUES = 'limite_cheques_mensual'

export async function saveDigitalTaxRate(pct: number): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { error } = await supabase.from('tenant_config').upsert(
      { tenant_id: tenantId, key: KEY_DIGITAL_TAX, value: pct },
      { onConflict: 'tenant_id,key' },
    )
    if (error) return { error: error.message }
    revalidatePath('/config')
    revalidatePath('/caja')
    revalidatePath('/operacion', 'layout')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function saveLimiteChequesMensual(monto: number): Promise<{ error?: string }> {
  try {
    if (monto < 0) return { error: 'El monto no puede ser negativo' }
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { error } = await supabase.from('tenant_config').upsert(
      { tenant_id: tenantId, key: KEY_LIMITE_CHEQUES, value: monto },
      { onConflict: 'tenant_id,key' },
    )
    if (error) return { error: error.message }
    revalidatePath('/config')
    revalidatePath('/alertas')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
