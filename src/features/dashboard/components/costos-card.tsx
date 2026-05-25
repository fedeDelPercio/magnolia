import { ChefHatIcon, UsersIcon, ActivityIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { DashboardOverview } from '../queries'

type Tone = {
  label: string
  text: string
  bar: string
  tint: string
}

function foodTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', text: 'text-muted-foreground', bar: 'bg-muted', tint: '' }
  if (pct <= 35) return { label: 'saludable', text: 'text-emerald-700', bar: 'bg-emerald-600', tint: 'bg-emerald-50/40' }
  if (pct <= 40) return { label: 'alto', text: 'text-amber-700', bar: 'bg-amber-500', tint: 'bg-amber-50/40' }
  return { label: 'crítico', text: 'text-rose-700', bar: 'bg-rose-500', tint: 'bg-rose-50/50' }
}

function laborTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', text: 'text-muted-foreground', bar: 'bg-muted', tint: '' }
  if (pct <= 32) return { label: 'saludable', text: 'text-emerald-700', bar: 'bg-emerald-600', tint: 'bg-emerald-50/40' }
  if (pct <= 40) return { label: 'alto', text: 'text-amber-700', bar: 'bg-amber-500', tint: 'bg-amber-50/40' }
  return { label: 'crítico', text: 'text-rose-700', bar: 'bg-rose-500', tint: 'bg-rose-50/50' }
}

function primeTone(pct: number | null): Tone {
  if (pct === null) return { label: '—', text: 'text-muted-foreground', bar: 'bg-muted', tint: '' }
  if (pct <= 65) return { label: 'saludable', text: 'text-emerald-700', bar: 'bg-emerald-600', tint: 'bg-emerald-50/40' }
  if (pct <= 75) return { label: 'alto', text: 'text-amber-700', bar: 'bg-amber-500', tint: 'bg-amber-50/40' }
  return { label: 'crítico', text: 'text-rose-700', bar: 'bg-rose-500', tint: 'bg-rose-50/50' }
}

type Row = {
  title: string
  subtitle: string
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
    <section>
      {/* Section header editorial — fuera del card */}
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Estructura de costos
          </p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            <span className="italic">Cómo</span> se reparte cada peso
          </h2>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">
          Sobre la facturación del período · benchmark gastronómico
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.title}
            className={`card-editorial relative overflow-hidden p-7 ${r.tone.tint}`}
          >
            {/* Hairline accent vertical en la izquierda */}
            <div className={`absolute inset-y-0 left-0 w-0.5 ${r.tone.bar}`} />

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <r.Icon className="size-3.5 text-muted-foreground" />
                <span className="font-semibold">{r.title}</span>
              </div>
              <span className={`text-[10px] font-medium uppercase tracking-editorial ${r.tone.text}`}>
                {r.tone.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{r.subtitle}</p>

            {/* Big number — Fraunces italic */}
            <p className={`mt-6 num-editorial text-6xl leading-none ${r.tone.text}`}>
              {r.pct !== null ? `${r.pct.toFixed(1)}%` : '—'}
            </p>

            {/* Bar */}
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${r.tone.bar} transition-all`}
                style={{ width: `${Math.min(100, r.pct ?? 0)}%` }}
              />
            </div>

            {/* Footer dual */}
            <div className="mt-4 flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>
                <span className="uppercase tracking-editorial">benchmark</span>{' '}
                <span className="tabular-nums text-foreground/70">{r.benchmark}</span>
              </span>
              {r.monto !== null && r.monto > 0 && (
                <span className="tabular-nums text-foreground/80">{formatCurrency(r.monto)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
