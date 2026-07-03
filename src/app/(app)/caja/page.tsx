import { getCajaMovimientos } from '@/features/cashflow/queries'
import { getBistroCajaMovimientos } from '@/features/cashflow/bistro-caja-queries'
import { getCajaCategorias, getCajaMayorSummary, getUltimoCierreCaja } from '@/features/cashflow/caja-mayor-queries'
import { getCuentaDigitalSummary } from '@/features/cashflow/cuenta-digital-queries'
import { getMonthlyVentasSummary } from '@/features/cierres/queries'
import { getCostoProcesadorDigital } from '@/features/config/queries'
import { CajaClient } from '@/features/cashflow/components/caja-client'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

export default async function CajaPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? new Date().toISOString().slice(0, 7)
  // En /caja descontamos el costo del procesador (Mercado Pago default 6%) —
  // NO el IVA digital del 21%, que sirve solo para la balanza fiscal del
  // dashboard. Eso refleja el dinero que efectivamente queda disponible.
  const costoProcesadorPct = await getCostoProcesadorDigital()

  const [movimientos, ventasSummary, bistroCaja, cajaMayor, ultimoCierre, cuentaDigital, categorias] = await Promise.all([
    getCajaMovimientos(month),
    getMonthlyVentasSummary(month),
    getBistroCajaMovimientos(month),
    getCajaMayorSummary(month),
    getUltimoCierreCaja(),
    getCuentaDigitalSummary(month, costoProcesadorPct),
    getCajaCategorias(),
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
        costoProcesadorPct={costoProcesadorPct}
        bistroCaja={bistroCaja}
        cajaMayor={cajaMayor}
        ultimoCierre={ultimoCierre}
        cuentaDigital={cuentaDigital}
        cajaCategorias={categorias}
      />
    </div>
  )
}
