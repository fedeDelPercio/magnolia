import { getTodasVacaciones, getEmpleados, añoActual } from '@/features/empleados/queries'
import { VacacionesPanorama } from '@/features/empleados/components/vacaciones-panorama'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ año?: string }> }

export default async function VacacionesPage({ searchParams }: Props) {
  const sp = await searchParams
  const pedido = sp.año ? parseInt(sp.año, 10) : NaN
  const año = pedido >= 2000 && pedido <= 2100 ? pedido : añoActual()
  const [vacaciones, empleados] = await Promise.all([
    getTodasVacaciones({ año }),
    getEmpleados({ incluirInactivos: true, año }),
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
        description="Las tomas de vacaciones del año y los días que le quedan a cada uno. Tocá el total de una persona para cambiar los días que le corresponden ese año."
        size="md"
      />
      <VacacionesPanorama vacaciones={vacaciones} empleados={empleados} año={año} />
    </div>
  )
}
