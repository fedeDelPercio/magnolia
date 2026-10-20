import { getTodasVacaciones, getEmpleados, temporadaActual } from '@/features/empleados/queries'
import { VacacionesPanorama } from '@/features/empleados/components/vacaciones-panorama'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

// ?temporada=2027 → 2026-2027 (ver lib/vacaciones-por-anio).
type Props = { searchParams: Promise<{ temporada?: string }> }

export default async function VacacionesPage({ searchParams }: Props) {
  const sp = await searchParams
  const pedida = sp.temporada ? parseInt(sp.temporada, 10) : NaN
  const temporada = pedida >= 2000 && pedida <= 2100 ? pedida : temporadaActual()
  const [vacaciones, empleados] = await Promise.all([
    getTodasVacaciones({ temporada }),
    getEmpleados({ incluirInactivos: true, temporada }),
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
        description="Las vacaciones van de octubre a septiembre. Tomas de la temporada y días que le quedan a cada uno; tocá el total de una persona para cambiar los días que le corresponden."
        size="md"
      />
      <VacacionesPanorama vacaciones={vacaciones} empleados={empleados} temporada={temporada} />
    </div>
  )
}
