import { TrendingUpIcon, TrendingDownIcon, ChefHatIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, splitCurrency } from '@/lib/format'
import { foodCostTone } from '@/lib/tones'
import type { DashboardOverview } from '../queries'

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
      <div className="card-editorial relative flex flex-col justify-between overflow-hidden p-7 md:col-span-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, oklch(0.34 0.07 138) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <p className="text-eyebrow">Facturación del período</p>
          <p className="mt-4 num-editorial text-[2.75rem] leading-none text-foreground">
            {fact.whole}
            <span className="text-2xl text-foreground/35">{fact.decimals}</span>
          </p>
        </div>
        <div className="relative mt-5">
          {delta !== null ? (
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
                deltaPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              )}
            >
              <DeltaIcon className="size-3" aria-hidden />
              {deltaPositive ? '+' : ''}
              {delta.toFixed(1)}% vs. período anterior
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">Sin período anterior comparable</p>
          )}
        </div>
      </div>

      {/* === Movimiento (col 3) === */}
      <div className="card-editorial flex flex-col justify-between p-7 md:col-span-3">
        <div>
          <p className="text-eyebrow">Movimiento</p>
          <p className="mt-4 num-editorial text-[2.75rem] leading-none text-metric">
            {overview.cantidadVentas.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="mt-5 space-y-0.5 text-xs text-muted-foreground">
          <p>
            <span className="text-metric font-medium text-foreground">ventas</span> en total
          </p>
          <p>
            <span className="text-metric font-medium text-foreground">{overview.cubiertosSalon}</span>{' '}
            cubiertos en salón
          </p>
        </div>
      </div>

      {/* === Ticket promedio (col 3) === */}
      <div className="card-editorial flex flex-col justify-between p-7 md:col-span-3">
        <div>
          <p className="text-eyebrow">Ticket promedio</p>
          <p className="mt-4 num-editorial text-[2.75rem] leading-none">
            {ticket.whole}
            <span className="text-2xl text-foreground/35">{ticket.decimals}</span>
          </p>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          por venta · salón{' '}
          <span className="text-metric font-medium text-foreground">
            {formatCurrency(overview.ticketPromedioSalon)}
          </span>
        </p>
      </div>

      {/* === Food Cost (col 12) — wide subtotal con barra lateral === */}
      <div className="card-editorial flex items-stretch overflow-hidden md:col-span-12">
        <div className="flex flex-1 items-center justify-between gap-6 p-6">
          <div>
            <div className="flex items-center gap-2 text-eyebrow">
              <ChefHatIcon className="size-3" aria-hidden />
              Food Cost · Costo de comida
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <p className={cn('num-editorial text-5xl leading-none', fc.text)}>
                {overview.foodCostPct !== null ? `${overview.foodCostPct.toFixed(1)}%` : '—'}
              </p>
              <p className={cn('text-sm font-medium', fc.text)}>{fc.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-eyebrow">Benchmark</p>
            <p className="mt-1 text-sm text-metric text-muted-foreground">28 – 35 %</p>
            <p className="mt-2 text-xs text-muted-foreground">
              gasto:{' '}
              <span className="text-metric font-medium text-foreground">
                {formatCurrency(overview.foodCostMonto)}
              </span>
            </p>
          </div>
        </div>
        {/* Bar lateral de ratio visual */}
        <div className="w-1.5 self-stretch bg-muted" aria-hidden>
          <div
            className={cn('block w-full transition-all', fc.bar)}
            style={{ height: `${Math.min(100, overview.foodCostPct ?? 0)}%` }}
          />
        </div>
      </div>
    </section>
  )
}
