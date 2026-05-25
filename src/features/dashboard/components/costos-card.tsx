import { ChefHatIcon, UsersIcon, ActivityIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { DashboardOverview } from '../queries'

type Tone = { label: string; cls: string; bar: string; bg: string }

function foodTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted', bg: '' }
  if (pct <= 30) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 35) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50/50' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500', bg: 'bg-rose-50/50' }
}

function laborTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted', bg: '' }
  if (pct <= 25) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 32) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 40) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50/50' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500', bg: 'bg-rose-50/50' }
}

function primeTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', cls: 'text-muted-foreground', bar: 'bg-muted', bg: '' }
  if (pct <= 55) return { label: 'óptimo', cls: 'text-emerald-700', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 65) return { label: 'saludable', cls: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50/50' }
  if (pct <= 75) return { label: 'alto', cls: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50/50' }
  return { label: 'crítico', cls: 'text-rose-700', bar: 'bg-rose-500', bg: 'bg-rose-50/50' }
}

type Row = {
  title: string             // Inglés (primario)
  subtitle: string          // Español (aclaración)
  Icon: typeof ChefHatIcon
  pct: number | null
  monto: number | null
  tone: Tone
  benchmark: string
}

export function CostosCard({ overview }: { overview: DashboardOverview }) {
  const rows: Row[] = [
    {
      title: 'Food Cost',
      subtitle: 'Costo de comida',
      Icon: ChefHatIcon,
      pct: overview.foodCostPct,
      monto: overview.foodCostMonto,
      tone: foodTone(overview.foodCostPct),
      benchmark: '28 – 35 %',
    },
    {
      title: 'Labor Cost',
      subtitle: 'Costo de personal',
      Icon: UsersIcon,
      pct: overview.laborCostPct,
      monto: overview.laborCostMonto,
      tone: laborTone(overview.laborCostPct),
      benchmark: '25 – 32 %',
    },
    {
      title: 'Prime Cost',
      subtitle: 'Costo primario (comida + personal)',
      Icon: ActivityIcon,
      pct: overview.primeCostPct,
      monto:
        overview.foodCostMonto + overview.laborCostMonto > 0
          ? overview.foodCostMonto + overview.laborCostMonto
          : null,
      tone: primeTone(overview.primeCostPct),
      benchmark: '< 65 %',
    },
  ]

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Estructura de costos
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sobre la facturación del período · comparado con benchmark gastronómico
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.title}
            className={`rounded-xl border bg-background p-5 transition-colors ${r.tone.bg}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 text-sm">
              <r.Icon className="size-4 text-muted-foreground" />
              <span className="font-semibold">{r.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{r.subtitle}</p>

            {/* Big number */}
            <div className="mt-4 flex items-baseline justify-between">
              <p className={`text-3xl font-semibold tabular-nums ${r.tone.cls}`}>
                {r.pct !== null ? `${r.pct.toFixed(1)}%` : '—'}
              </p>
              <span className={`text-sm font-medium ${r.tone.cls}`}>{r.tone.label}</span>
            </div>

            {/* Bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${r.tone.bar}`}
                style={{ width: `${Math.min(100, r.pct ?? 0)}%` }}
              />
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>benchmark {r.benchmark}</span>
              {r.monto !== null && r.monto > 0 && (
                <span className="tabular-nums">{formatCurrency(r.monto)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
