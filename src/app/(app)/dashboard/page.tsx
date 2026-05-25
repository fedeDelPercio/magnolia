import {
  getDashboardOverview,
  getFacturacionEvolution,
  getMixData,
  getMediosPago,
  getTopProductos,
  getProductosEnRiesgo,
  getProductosMasRentables,
  getStockCritico,
  getMenuEngineering,
  getTopInsumosGasto,
  getInsumosConSuba,
  type Granularity,
} from '@/features/dashboard/queries'
import { HeroCards } from '@/features/dashboard/components/hero-cards'
import { EvolucionChart } from '@/features/dashboard/components/evolucion-chart'
import { MixCard } from '@/features/dashboard/components/mix-card'
import { MediosPagoCard } from '@/features/dashboard/components/medios-pago-card'
import { TopProductosCard } from '@/features/dashboard/components/top-productos'
import {
  ProductosEnRiesgo,
  ProductosMasRentables,
} from '@/features/dashboard/components/productos-listas'
import { StockCriticoCard } from '@/features/dashboard/components/stock-critico'
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header'
import { CostosCard } from '@/features/dashboard/components/costos-card'
import { MenuEngineeringMatrix } from '@/features/dashboard/components/menu-engineering'
import {
  TopInsumosGastoCard,
  InsumosSubasCard,
} from '@/features/dashboard/components/insumos-cards'

export const dynamic = 'force-dynamic'

function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(from), to: iso(to) }
}

type Props = {
  searchParams: Promise<{
    from?: string
    to?: string
    evGran?: string
  }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams
  const defaults = defaultRange()
  const from = sp.from ?? defaults.from
  const to = sp.to ?? defaults.to

  const granularity: Granularity =
    sp.evGran === 'dia' || sp.evGran === 'semana' || sp.evGran === 'mes' ? sp.evGran : 'mes'

  const [
    overview,
    evolution,
    mix,
    mediosPago,
    topProductos,
    enRiesgo,
    masRentables,
    stockCritico,
    menuEng,
    topInsumos,
    insumosSubas,
  ] = await Promise.all([
    getDashboardOverview(from, to),
    getFacturacionEvolution(from, to, granularity),
    getMixData(from, to),
    getMediosPago(from, to),
    getTopProductos(from, to, 10),
    getProductosEnRiesgo(),
    getProductosMasRentables(from, to, 5),
    getStockCritico(0.3),
    getMenuEngineering(from, to),
    getTopInsumosGasto(from, to, 5),
    getInsumosConSuba(from, to, 15),
  ])

  return (
    <div className="space-y-6">
      <DashboardHeader from={from} to={to} />

      <HeroCards overview={overview} />

      <EvolucionChart data={evolution} granularity={granularity} />

      <CostosCard overview={overview} />

      <MenuEngineeringMatrix data={menuEng} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MixCard data={mix} />
        <div className="lg:col-span-2">
          <MediosPagoCard data={mediosPago} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopProductosCard productos={topProductos} />
        <ProductosMasRentables productos={masRentables} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopInsumosGastoCard insumos={topInsumos} />
        <InsumosSubasCard alerts={insumosSubas} />
        <ProductosEnRiesgo productos={enRiesgo} />
      </div>

      <StockCriticoCard insumos={stockCritico} />
    </div>
  )
}
