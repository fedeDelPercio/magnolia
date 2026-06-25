'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const KEY_DIGITAL_TAX = 'impuesto_digital_pct'
const KEY_LIMITE_CHEQUES = 'limite_cheques_mensual'
const KEY_COSTO_PROCESADOR_DIGITAL = 'costo_procesador_digital_pct'

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

export async function saveCostoProcesadorDigital(pct: number): Promise<{ error?: string }> {
  try {
    if (pct < 0 || pct > 100) return { error: 'El porcentaje debe estar entre 0 y 100' }
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { error } = await supabase.from('tenant_config').upsert(
      { tenant_id: tenantId, key: KEY_COSTO_PROCESADOR_DIGITAL, value: pct },
      { onConflict: 'tenant_id,key' },
    )
    if (error) return { error: error.message }
    revalidatePath('/config')
    revalidatePath('/caja')
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
