import { TrendingUpIcon, TrendingDownIcon, ChefHatIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { DashboardOverview } from '../queries'

function foodCostTone(pct: number | null): { label: string; cls: string; bar: string } {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted' }
  if (pct <= 30) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-600' }
  if (pct <= 35) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-600' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-700', bar: 'bg-amber-500' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500' }
}

/** Separa decimales para hacerlos más chicos. "$ 1.418.488,00" → { whole: "$ 1.418.488", decimals: ",00" } */
function splitCurrency(value: number): { whole: string; decimals: string } {
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  const lastComma = formatted.lastIndexOf(',')
  if (lastComma === -1) return { whole: formatted, decimals: '' }
  return { whole: formatted.slice(0, lastComma), decimals: formatted.slice(lastComma) }
}

export function HeroCards({ overview }: { overview: DashboardOverview }) {
  const fc = foodCostTone(overview.foodCostPct)
  const fact = splitCurrency(overview.facturacion)
  const ticket = splitCurrency(overview.ticketPromedio)
  const delta = overview.facturacionDeltaPct
  const deltaPositive = delta !== null && delta > 0
  const DeltaIcon = deltaPositive ? TrendingUpIcon : TrendingDownIcon

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-12">
      {/* === Featured: Facturación (col 6) === */}
      <div className="card-editorial relative overflow-hidden p-7 md:col-span-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, oklch(0.34 0.07 138) 0%, transparent 70%)' }}
        />
        <div className="relative space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Facturación del período
          </p>
          <p className="num-editorial text-6xl leading-[0.95] text-foreground">
            {fact.whole}
            <span className="text-3xl text-foreground/35">{fact.decimals}</span>
          </p>
          {delta !== null ? (
            <div
              className={
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ' +
                (deltaPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700')
              }
            >
              <DeltaIcon className="size-3" />
              {deltaPositive ? '+' : ''}
              {delta.toFixed(1)}% vs. período anterior
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">Sin período anterior comparable</p>
          )}
        </div>
      </div>

      {/* === Movimiento (col 3) === */}
      <div className="card-editorial p-6 md:col-span-3">
        <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
          Movimiento
        </p>
        <p className="mt-3 num-editorial text-5xl leading-none">
          {overview.cantidadVentas.toLocaleString('es-AR')}
        </p>
        <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          <p>
            <span className="tabular-nums font-medium text-foreground">ventas</span> en total
          </p>
          <p>
            <span className="tabular-nums font-medium text-foreground">{overview.cubiertosSalon}</span>{' '}
            cubiertos en salón
          </p>
        </div>
      </div>

      {/* === Ticket promedio (col 3) === */}
      <div className="card-editorial p-6 md:col-span-3">
        <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
          Ticket promedio
        </p>
        <p className="mt-3 num-editorial text-4xl leading-none">
          {ticket.whole}
          <span className="text-xl text-foreground/35">{ticket.decimals}</span>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          por venta · salón{' '}
          <span className="tabular-nums font-medium text-foreground">
            {formatCurrency(overview.ticketPromedioSalon)}
          </span>
        </p>
      </div>

      {/* === Food Cost (col 12) — wide subtotal con barra lateral === */}
      <div className="card-editorial flex items-stretch overflow-hidden md:col-span-12">
        <div className="flex flex-1 items-center justify-between gap-6 p-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
              <ChefHatIcon className="size-3" />
              Food Cost · Costo de comida
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <p className={`num-editorial text-5xl leading-none ${fc.cls}`}>
                {overview.foodCostPct !== null ? `${overview.foodCostPct.toFixed(1)}%` : '—'}
              </p>
              <p className={`text-sm font-medium ${fc.cls}`}>{fc.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-editorial text-muted-foreground">Benchmark</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">28 – 35 %</p>
            <p className="mt-2 text-xs text-muted-foreground">
              gasto:{' '}
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(overview.foodCostMonto)}
              </span>
            </p>
          </div>
        </div>
        {/* Bar lateral de ratio visual */}
        <div className="w-1.5 self-stretch bg-muted">
          <div
            className={`block w-full ${fc.bar} transition-all`}
            style={{ height: `${Math.min(100, overview.foodCostPct ?? 0)}%` }}
          />
        </div>
      </div>
    </section>
  )
}
