import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

import { getEmpleado } from '@/features/empleados/queries'
import { EmpleadoDetail } from '@/features/empleados/components/empleado-detail'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function EmpleadoDetailPage({ params }: Props) {
  const { id } = await params
  const detalle = await getEmpleado(id)
  if (!detalle) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/empleados"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-3.5" />
        Volver a empleados
      </Link>
      <EmpleadoDetail detalle={detalle} />
    </div>
  )
}
