import { TrendingUpIcon, TrendingDownIcon, UsersIcon, ReceiptIcon, ChefHatIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { DashboardOverview } from '../queries'

function pctTone(pct: number, kind: 'higher_better' | 'lower_better'): {
  text: string
  Icon: typeof TrendingUpIcon
  cls: string
} {
  const positive = pct > 0
  const goodDirection = kind === 'higher_better' ? positive : !positive
  return {
    text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    Icon: positive ? TrendingUpIcon : TrendingDownIcon,
    cls: goodDirection ? 'text-emerald-600' : 'text-rose-600',
  }
}

function foodCostTone(pct: number | null): { label: string; cls: string } {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground' }
  if (pct <= 30) return { label: 'óptimo', cls: 'text-emerald-700' }
  if (pct <= 35) return { label: 'saludable', cls: 'text-emerald-600' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-600' }
  return { label: 'crítico', cls: 'text-rose-700' }
}

type Props = {
  overview: DashboardOverview
}

export function HeroCards({ overview }: Props) {
  const facturacionDelta =
    overview.facturacionDeltaPct !== null ? pctTone(overview.facturacionDeltaPct, 'higher_better') : null
  const fc = foodCostTone(overview.foodCostPct)

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Facturación */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ReceiptIcon className="size-3.5" />
          Facturación del mes
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(overview.facturacion)}</p>
        {facturacionDelta && (
          <p className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${facturacionDelta.cls}`}>
            <facturacionDelta.Icon className="size-3" />
            {facturacionDelta.text} vs. mes anterior
          </p>
        )}
        {!facturacionDelta && (
          <p className="mt-1 text-xs text-muted-foreground">Sin datos del mes anterior</p>
        )}
      </div>

      {/* Cubiertos */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <UsersIcon className="size-3.5" />
          Cubiertos en salón
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {overview.cubiertosSalon.toLocaleString('es-AR')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">personas que se sentaron</p>
      </div>

      {/* Ticket promedio salón */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ReceiptIcon className="size-3.5" />
          Ticket promedio salón
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {formatCurrency(overview.ticketPromedioSalon)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">por cubierto</p>
      </div>

      {/* Food cost % */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ChefHatIcon className="size-3.5" />
          Food cost %
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {overview.foodCostPct !== null ? `${overview.foodCostPct.toFixed(1)}%` : '—'}
        </p>
        <p className={`mt-1 text-xs ${fc.cls}`}>{fc.label}</p>
      </div>
    </section>
  )
}
