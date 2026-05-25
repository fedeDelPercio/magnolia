import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const KEY_DIGITAL_TAX = 'impuesto_digital_pct'

export async function getDigitalTaxRate(): Promise<number> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', KEY_DIGITAL_TAX)
    .maybeSingle()
  if (!data) return 0
  const val = data.value
  return typeof val === 'number' ? val : 0
}
