import { ChefHatIcon, UsersIcon, ActivityIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { DashboardOverview } from '../queries'

type Tone = { label: string; cls: string; bar: string }

function foodTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted' }
  if (pct <= 30) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (pct <= 35) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500' }
}

function laborTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted' }
  if (pct <= 25) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (pct <= 32) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500' }
}

function primeTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted' }
  if (pct <= 55) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (pct <= 65) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (pct <= 75) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500' }
}

type Row = {
  label: string
  Icon: typeof ChefHatIcon
  pct: number | null
  monto: number | null
  tone: Tone
  benchmark: string
}

export function CostosCard({ overview }: { overview: DashboardOverview }) {
  const rows: Row[] = [
    {
      label: 'Food Cost',
      Icon: ChefHatIcon,
      pct: overview.foodCostPct,
      monto: overview.foodCostMonto,
      tone: foodTone(overview.foodCostPct),
      benchmark: 'benchmark 28-35%',
    },
    {
      label: 'Labor Cost',
      Icon: UsersIcon,
      pct: overview.laborCostPct,
      monto: overview.laborCostMonto,
      tone: laborTone(overview.laborCostPct),
      benchmark: 'benchmark 25-32%',
    },
    {
      label: 'Prime Cost',
      Icon: ActivityIcon,
      pct: overview.primeCostPct,
      monto:
        overview.foodCostMonto + overview.laborCostMonto > 0
          ? overview.foodCostMonto + overview.laborCostMonto
          : null,
      tone: primeTone(overview.primeCostPct),
      benchmark: 'benchmark < 65%',
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Estructura de costos
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Sobre la facturación del mes — comparado con benchmark gastronómico
      </p>

      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <r.Icon className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">· {r.benchmark}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-lg font-semibold tabular-nums ${r.tone.cls}`}>
                  {r.pct !== null ? `${r.pct.toFixed(1)}%` : '—'}
                </span>
                <span className={`ml-1.5 text-xs font-medium ${r.tone.cls}`}>{r.tone.label}</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${r.tone.bar}`}
                style={{ width: `${Math.min(100, r.pct ?? 0)}%` }}
              />
            </div>
            {r.monto !== null && r.monto > 0 && (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {formatCurrency(r.monto)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
