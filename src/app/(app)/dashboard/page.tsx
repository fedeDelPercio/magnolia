import {
  getDashboardOverview,
  getDailyVentas,
  getMixData,
  getMediosPago,
  getTopProductos,
  getProductosEnRiesgo,
  getProductosMasRentables,
  getStockCritico,
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
  ] = await Promise.all([
    getDashboardOverview(month),
    getDailyVentas(month),
    getMixData(month),
    getMediosPago(month),
    getTopProductos(month, 10),
    getProductosEnRiesgo(),
    getProductosMasRentables(month, 5),
    getStockCritico(0.3),
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
        <MediosPagoCard data={mediosPago} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MixCard data={mix} />
        <TopProductosCard productos={topProductos} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ProductosMasRentables productos={masRentables} />
        <ProductosEnRiesgo productos={enRiesgo} />
        <StockCriticoCard insumos={stockCritico} />
      </div>
    </div>
  )
}
