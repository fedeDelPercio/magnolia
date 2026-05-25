import { getCajaMovimientos } from '@/features/cashflow/queries'
import { getMonthlyVentasSummary } from '@/features/cierres/queries'
import { getDigitalTaxRate } from '@/features/config/queries'
import { CajaClient } from '@/features/cashflow/components/caja-client'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

export default async function CajaPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? new Date().toISOString().slice(0, 7)

  const [movimientos, ventasSummary, taxRate] = await Promise.all([
    getCajaMovimientos(month),
    getMonthlyVentasSummary(month),
    getDigitalTaxRate(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresos, egresos y flujo de efectivo mensual.
        </p>
      </div>
      <CajaClient
        movimientos={movimientos}
        month={month}
        ventasSummary={ventasSummary}
        taxRate={taxRate}
      />
    </div>
  )
}
