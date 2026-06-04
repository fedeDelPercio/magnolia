import { getDiasMes } from '@/features/operations/queries'
import { OperacionCalendar } from '@/features/operations/components/operacion-calendar'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

function todayLocal() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type Props = { searchParams: Promise<{ month?: string }> }

export default async function OperacionPage({ searchParams }: Props) {
  const today = todayLocal()
  const sp = await searchParams
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7)

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Auto-creamos el día de hoy si no existe, sólo cuando estamos viendo el mes actual.
  if (month === today.slice(0, 7)) {
    const { data: existing } = await supabase
      .from('dias_operativos')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('fecha', today)
      .maybeSingle()

    if (!existing) {
      await supabase.rpc('abrir_dia', { p_tenant_id: tenantId, p_fecha: today })
    }
  }

  const dias = await getDiasMes(month)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title={
          <>
            <span className="italic">Día</span> a día
          </>
        }
        size="md"
      />
      <OperacionCalendar dias={dias} month={month} today={today} />
    </div>
  )
}
