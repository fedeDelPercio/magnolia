import { getHorariosAllEmpleados } from '@/features/empleados/queries'
import { HorariosGrid } from '@/features/empleados/components/horarios-grid'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

export default async function HorariosPage() {
  const empleados = await getHorariosAllEmpleados()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Empleados · Horarios"
        title={
          <>
            <span className="italic">Horario</span> semanal del plantel
          </>
        }
        description="Quién trabaja cuándo. Click sobre el empleado para editar su horario."
        size="md"
      />
      <HorariosGrid empleados={empleados} />
    </div>
  )
}
