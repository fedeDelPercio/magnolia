import { getCajaMovimientos } from '@/features/cashflow/queries'
import { getBistroCajaMovimientos } from '@/features/cashflow/bistro-caja-queries'
import { getMonthlyVentasSummary } from '@/features/cierres/queries'
import { getDigitalTaxRate } from '@/features/config/queries'
import { CajaClient } from '@/features/cashflow/components/caja-client'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

export default async function CajaPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? new Date().toISOString().slice(0, 7)

  const [movimientos, ventasSummary, taxRate, bistroCaja] = await Promise.all([
    getCajaMovimientos(month),
    getMonthlyVentasSummary(month),
    getDigitalTaxRate(),
    getBistroCajaMovimientos(month),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Caja"
        title={
          <>
            <span className="italic">Flujo</span> de efectivo
          </>
        }
        description="Ingresos, egresos y resultado mensual."
      />
      <CajaClient
        movimientos={movimientos}
        month={month}
        ventasSummary={ventasSummary}
        taxRate={taxRate}
        bistroCaja={bistroCaja}
      />
    </div>
  )
}
