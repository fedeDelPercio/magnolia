import { getDias } from '@/features/operations/queries'
import { OperacionList } from '@/features/operations/components/operacion-list'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

export const dynamic = 'force-dynamic'

function todayLocal() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function OperacionPage() {
  const today = todayLocal()
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Auto-creamos el día de hoy si no existe — sin botón "Abrir hoy" explícito
  const { data: existing } = await supabase
    .from('dias_operativos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('fecha', today)
    .maybeSingle()

  if (!existing) {
    await supabase.rpc('abrir_dia', { p_tenant_id: tenantId, p_fecha: today })
  }

  const dias = await getDias()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operación diaria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrá producción, ventas y movimientos de stock por día.
        </p>
      </div>
      <OperacionList dias={dias} today={today} />
    </div>
  )
}
