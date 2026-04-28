import { getCajaMovimientos } from '@/features/cashflow/queries'
import { CajaClient } from '@/features/cashflow/components/caja-client'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

export default async function CajaPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? new Date().toISOString().slice(0, 7)

  const movimientos = await getCajaMovimientos(month)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresos, egresos y flujo de efectivo mensual.
        </p>
      </div>
      <CajaClient movimientos={movimientos} month={month} />
    </div>
  )
}
