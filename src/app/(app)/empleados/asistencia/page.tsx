import { getAusenciasMes, getEmpleadosOptions } from '@/features/empleados/queries'
import { AsistenciaClient } from '@/features/empleados/components/asistencia-client'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function AsistenciaPage({ searchParams }: Props) {
  const sp = await searchParams
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth()

  const [ausencias, empleados] = await Promise.all([
    getAusenciasMes(month),
    getEmpleadosOptions(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Empleados · Asistencia"
        title={
          <>
            <span className="italic">Ausencias</span> del mes
          </>
        }
        description="Como las asistencias se asumen por defecto, acá ves sólo las excepciones: faltas, feriados, licencias y enfermedades."
        size="md"
      />
      <AsistenciaClient ausencias={ausencias} empleados={empleados} month={month} />
    </div>
  )
}
