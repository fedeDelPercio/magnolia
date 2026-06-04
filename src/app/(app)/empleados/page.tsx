import { getEmpleados } from '@/features/empleados/queries'
import { EmpleadosClient } from '@/features/empleados/components/empleados-client'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

export default async function EmpleadosPage() {
  const empleados = await getEmpleados({ incluirInactivos: true })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipo"
        title={
          <>
            <span className="italic">Empleados</span> y liquidaciones
          </>
        }
        size="md"
      />
      <EmpleadosClient empleados={empleados} />
    </div>
  )
}
