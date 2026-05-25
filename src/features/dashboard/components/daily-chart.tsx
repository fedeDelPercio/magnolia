import { formatCurrency } from '@/lib/format'
import type { DailyVentas } from '../queries'

type Props = {
  data: DailyVentas[]
  month: string
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y!, m!, 0).getDate()
}

export function DailyChart({ data, month }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0)
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Evolución de facturación
        </h2>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Sin cierres cargados para este mes.
        </p>
      </div>
    )
  }

  const days = daysInMonth(month)
  // Build a per-day series with zeros for missing days
  const map = new Map(data.map((d) => [Number(d.fecha.slice(-2)), d]))
  const series: { day: number; total: number; salon: number; mostrador: number }[] = []
  for (let day = 1; day <= days; day++) {
    const v = map.get(day)
    series.push({
      day,
      total: v?.total ?? 0,
      salon: v?.salon ?? 0,
      mostrador: v?.mostrador ?? 0,
    })
  }

  const width = 800
  const height = 220
  const padding = { top: 24, right: 16, bottom: 36, left: 56 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxY = Math.max(...series.map((s) => s.total)) || 1
  const xStep = innerW / Math.max(1, days - 1)

  const points = series.map((s, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - (s.total / maxY) * innerH,
    day: s.day,
    total: s.total,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${padding.top + innerH} L ${points[0]!.x.toFixed(1)} ${padding.top + innerH} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padding.top + innerH - t * innerH,
    val: maxY * t,
  }))

  // x-axis labels: every ~5 days
  const xLabelStep = Math.max(1, Math.floor(days / 6))
  const xLabels = points.filter((_, i) => i % xLabelStep === 0 || i === points.length - 1)

  const compact = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${Math.round(val / 1_000)}k`
    return `$${Math.round(val)}`
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Evolución de facturación
        </h2>
        <p className="text-sm tabular-nums text-muted-foreground">
          Total: <span className="font-medium text-foreground">{formatCurrency(total)}</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-auto w-full">
        <defs>
          <linearGradient id="ventasArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.45 0.18 264)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="oklch(0.45 0.18 264)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={padding.left + innerW}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray={i === 0 ? '0' : '2 4'}
            />
            <text
              x={padding.left - 8}
              y={t.y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {compact(t.val)}
            </text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill="url(#ventasArea)" />
        <path d={linePath} fill="none" stroke="oklch(0.45 0.18 264)" strokeWidth={2} />

        {/* dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.total > 0 ? 3 : 0}
            fill="oklch(0.45 0.18 264)"
          >
            <title>{`Día ${p.day}: ${formatCurrency(p.total)}`}</title>
          </circle>
        ))}

        {/* x-axis labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padding.top + innerH + 18}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {p.day}
          </text>
        ))}
      </svg>
    </div>
  )
}
