import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

const KEY_DIGITAL_TAX = 'impuesto_digital_pct'
const KEY_LIMITE_CHEQUES = 'limite_cheques_mensual'
const KEY_COSTO_PROCESADOR_DIGITAL = 'costo_procesador_digital_pct'

// Default 6% (Mercado Pago promedio). Se aplica en /caja sobre los ingresos
// digitales para reflejar el neto que realmente queda disponible.
const DEFAULT_COSTO_PROCESADOR_DIGITAL = 6

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

// 0 = sin límite configurado. La UI lo trata como "feature deshabilitado".
export async function getLimiteChequesMensual(): Promise<number> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', KEY_LIMITE_CHEQUES)
    .maybeSingle()
  if (!data) return 0
  const val = data.value
  return typeof val === 'number' ? val : 0
}

// Costo del procesador de pagos digitales (Mercado Pago, banco, etc.).
// Se aplica en /caja sobre los ingresos digitales para mostrar el neto real
// (separado del IVA digital, que se computa solo para la balanza fiscal).
export async function getCostoProcesadorDigital(): Promise<number> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', KEY_COSTO_PROCESADOR_DIGITAL)
    .maybeSingle()
  if (!data) return DEFAULT_COSTO_PROCESADOR_DIGITAL
  const val = data.value
  return typeof val === 'number' ? val : DEFAULT_COSTO_PROCESADOR_DIGITAL
}
