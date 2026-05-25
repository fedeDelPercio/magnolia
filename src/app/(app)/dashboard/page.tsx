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
import { MonthPicker } from '@/features/dashboard/components/month-picker'
import { CostosCard } from '@/features/dashboard/components/costos-card'
import { MenuEngineeringMatrix } from '@/features/dashboard/components/menu-engineering'
import {
  TopInsumosGastoCard,
  InsumosSubasCard,
} from '@/features/dashboard/components/insumos-cards'

function defaultEvolutionRange(gran: Granularity): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now)
  to.setDate(to.getDate() + 1)
  const from = new Date(now)
  if (gran === 'dia') from.setDate(now.getDate() - 30)
  else if (gran === 'semana') from.setDate(now.getDate() - 7 * 12)
  else {
    from.setMonth(now.getMonth() - 11)
    from.setDate(1)
  }
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(from), to: iso(to) }
}

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    month?: string
    evFrom?: string
    evTo?: string
    evGran?: string
  }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams
  const month = sp.month ?? new Date().toISOString().slice(0, 7)

  const granularity: Granularity =
    sp.evGran === 'dia' || sp.evGran === 'semana' || sp.evGran === 'mes' ? sp.evGran : 'mes'
  const defaults = defaultEvolutionRange(granularity)
  const evFrom = sp.evFrom ?? defaults.from
  const evTo = sp.evTo ?? defaults.to

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
    getDashboardOverview(month),
    getFacturacionEvolution(evFrom, evTo, granularity),
    getMixData(month),
    getMediosPago(month),
    getTopProductos(month, 10),
    getProductosEnRiesgo(),
    getProductosMasRentables(month, 5),
    getStockCritico(0.3),
    getMenuEngineering(month),
    getTopInsumosGasto(month, 5),
    getInsumosConSuba(month, 15),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen del negocio del mes en curso.
          </p>
        </div>
        <MonthPicker month={month} />
      </div>

      <HeroCards overview={overview} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EvolucionChart data={evolution} from={evFrom} to={evTo} granularity={granularity} />
        </div>
        <CostosCard overview={overview} />
      </div>

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
