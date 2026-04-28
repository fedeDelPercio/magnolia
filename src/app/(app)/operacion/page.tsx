import { getDias } from '@/features/operations/queries'
import { OperacionList } from '@/features/operations/components/operacion-list'

export const dynamic = 'force-dynamic'

export default async function OperacionPage() {
  const dias = await getDias()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operación diaria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrá producción, ventas y movimientos de stock por día.
        </p>
      </div>
      <OperacionList dias={dias} />
    </div>
  )
}
