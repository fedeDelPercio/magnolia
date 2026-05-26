import { ChefHatIcon, UsersIcon, ActivityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { foodCostTone, laborCostTone, primeCostTone, type Tone } from '@/lib/tones'
import { SectionHeader } from '@/components/shared/section-header'
import type { DashboardOverview } from '../queries'

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
      tone: foodCostTone(overview.foodCostPct),
      benchmark: '28 – 35 %',
    },
    {
      title: 'Labor Cost',
      subtitle: 'Costo de personal',
      Icon: UsersIcon,
      pct: overview.laborCostPct,
      monto: overview.laborCostMonto,
      tone: laborCostTone(overview.laborCostPct),
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
      tone: primeCostTone(overview.primeCostPct),
      benchmark: '< 65 %',
    },
  ]

  return (
    <section>
      <SectionHeader
        eyebrow="Estructura de costos"
        trail="Sobre la facturación del período · benchmark gastronómico"
      >
        <span className="italic">Cómo</span> se reparte cada peso
      </SectionHeader>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.title}
            className={cn('card-editorial relative overflow-hidden p-7', r.tone.tint)}
          >
            {/* Hairline accent vertical en la izquierda */}
            <div className={cn('absolute inset-y-0 left-0 w-0.5', r.tone.bar)} aria-hidden />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-card-title">
                <r.Icon className="size-3.5 text-muted-foreground" aria-hidden />
                <span>{r.title}</span>
              </div>
              <span className={cn('text-eyebrow', r.tone.text)}>{r.tone.label}</span>
            </div>
            <p className="mt-0.5 text-card-sub">{r.subtitle}</p>

            {/* Big number — Fraunces italic */}
            <p className={cn('mt-6 num-editorial text-6xl leading-none', r.tone.text)}>
              {r.pct !== null ? `${r.pct.toFixed(1)}%` : '—'}
            </p>

            {/* Bar */}
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full transition-all', r.tone.bar)}
                style={{ width: `${Math.min(100, r.pct ?? 0)}%` }}
              />
            </div>

            <div className="mt-4 flex items-baseline justify-between text-[11px] text-muted-foreground">
              <span>
                <span className="uppercase tracking-editorial">benchmark</span>{' '}
                <span className="text-metric text-foreground/70">{r.benchmark}</span>
              </span>
              {r.monto !== null && r.monto > 0 && (
                <span className="text-metric text-foreground/80">{formatCurrency(r.monto)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
