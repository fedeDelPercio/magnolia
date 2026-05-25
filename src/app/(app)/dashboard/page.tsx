import {
  getDashboardOverview,
  getDailyVentas,
  getMixData,
  getMediosPago,
  getTopProductos,
  getProductosEnRiesgo,
  getProductosMasRentables,
  getStockCritico,
  getMenuEngineering,
  getTopInsumosGasto,
  getInsumosConSuba,
} from '@/features/dashboard/queries'
import { HeroCards } from '@/features/dashboard/components/hero-cards'
import { DailyChart } from '@/features/dashboard/components/daily-chart'
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

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string }> }

export default async function DashboardPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams
  const month = rawMonth ?? new Date().toISOString().slice(0, 7)

  const [
    overview,
    daily,
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
    getDailyVentas(month),
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
          <DailyChart data={daily} month={month} />
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
