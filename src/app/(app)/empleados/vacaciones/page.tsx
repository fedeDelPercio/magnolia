import { getTodasVacaciones, getEmpleados } from '@/features/empleados/queries'
import { VacacionesPanorama } from '@/features/empleados/components/vacaciones-panorama'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ año?: string }> }

export default async function VacacionesPage({ searchParams }: Props) {
  const sp = await searchParams
  const año = sp.año ? parseInt(sp.año) : new Date().getFullYear()
  const [vacaciones, empleados] = await Promise.all([
    getTodasVacaciones({ año }),
    getEmpleados({ incluirInactivos: true }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Empleados · Vacaciones"
        title={
          <>
            <span className="italic">Panorama</span> de vacaciones
          </>
        }
        description="Todas las tomas de vacaciones del año, su estado actual y los días restantes por persona."
        size="md"
      />
      <VacacionesPanorama vacaciones={vacaciones} empleados={empleados} año={año} />
    </div>
  )
}
