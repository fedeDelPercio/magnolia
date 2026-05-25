'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import type { EvolucionPunto, Granularity } from '../queries'

type Props = {
  data: EvolucionPunto[]
  from: string
  to: string
  granularity: Granularity
}

const GRAN_LABELS: Record<Granularity, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
}

export function EvolucionChart({ data, from, to, granularity }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    sp.set(key, value)
    router.push(`${pathname}?${sp.toString()}`)
  }

  function setGranularity(g: Granularity) {
    const sp = new URLSearchParams(params.toString())
    sp.set('evGran', g)
    // Limpiamos el rango para que se recalcule el default según granularidad
    sp.delete('evFrom')
    sp.delete('evTo')
    router.push(`${pathname}?${sp.toString()}`)
  }

  const total = data.reduce((s, d) => s + d.total, 0)
  const efectivoTotal = data.reduce((s, d) => s + d.efectivo, 0)
  const digitalTotal = data.reduce((s, d) => s + d.digital, 0)
  const efectivoPct = total > 0 ? (efectivoTotal / total) * 100 : 0
  const digitalPct = total > 0 ? (digitalTotal / total) * 100 : 0

  // SVG layout
  const width = 1000
  const height = 320
  const padding = { top: 24, right: 16, bottom: 56, left: 64 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxY = Math.max(1, ...data.map((d) => d.total))
  const barGap = 6
  const barW = Math.max(4, (innerW - barGap * Math.max(0, data.length - 1)) / Math.max(1, data.length))

  // Eje Y ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padding.top + innerH - t * innerH,
    val: maxY * t,
  }))

  const compact = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${Math.round(val / 1_000)}k`
    return `$${Math.round(val)}`
  }

  // Show only every N x-axis labels to avoid crowding
  const xLabelStep = Math.max(1, Math.ceil(data.length / 18))

  return (
    <div className="rounded-xl border bg-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Evolución de facturación
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="text-emerald-700">{efectivoPct.toFixed(0)}% efectivo</span>
            {' · '}
            <span className="text-blue-700">{digitalPct.toFixed(0)}% digital</span>
            {' · '}
            <span className="tabular-nums">
              total {formatCurrency(total)}
            </span>
          </p>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Granularidad */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(['dia', 'semana', 'mes'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={
                  'px-2.5 py-1 transition-colors ' +
                  (granularity === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted')
                }
              >
                {GRAN_LABELS[g]}
              </button>
            ))}
          </div>

          {/* Rango personalizado */}
          <div className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
            <label className="text-muted-foreground">desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setParam('evFrom', e.target.value)}
              className="bg-transparent outline-none tabular-nums"
            />
            <span className="text-muted-foreground">a</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setParam('evTo', e.target.value)}
              className="bg-transparent outline-none tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 || total === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Sin cierres cargados para este rango.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-auto max-h-[320px] w-full min-w-[640px]"
          >
            {/* Gridlines + y labels */}
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

            {/* Barras apiladas */}
            {data.map((d, i) => {
              const x = padding.left + i * (barW + barGap)
              const hTotal = (d.total / maxY) * innerH
              const hEfectivo = (d.efectivo / maxY) * innerH
              const hDigital = (d.digital / maxY) * innerH
              const yEfectivo = padding.top + innerH - hEfectivo
              const yDigital = padding.top + innerH - hTotal
              const pctEfectivo = d.total > 0 ? (d.efectivo / d.total) * 100 : 0
              const pctDigital = d.total > 0 ? (d.digital / d.total) * 100 : 0
              return (
                <g key={d.period}>
                  {/* Digital (arriba) */}
                  {d.digital > 0 && (
                    <rect
                      x={x}
                      y={yDigital}
                      width={barW}
                      height={hDigital}
                      fill="oklch(0.55 0.18 245)"
                      rx={1}
                    >
                      <title>{`${d.label}\nDigital: ${formatCurrency(d.digital)} (${pctDigital.toFixed(0)}%)\nEfectivo: ${formatCurrency(d.efectivo)} (${pctEfectivo.toFixed(0)}%)\nTotal: ${formatCurrency(d.total)}`}</title>
                    </rect>
                  )}
                  {/* Efectivo (abajo) */}
                  {d.efectivo > 0 && (
                    <rect
                      x={x}
                      y={yEfectivo}
                      width={barW}
                      height={hEfectivo}
                      fill="oklch(0.62 0.16 145)"
                      rx={1}
                    >
                      <title>{`${d.label}\nEfectivo: ${formatCurrency(d.efectivo)} (${pctEfectivo.toFixed(0)}%)\nDigital: ${formatCurrency(d.digital)} (${pctDigital.toFixed(0)}%)\nTotal: ${formatCurrency(d.total)}`}</title>
                    </rect>
                  )}
                  {/* Label x */}
                  {i % xLabelStep === 0 && (
                    <text
                      x={x + barW / 2}
                      y={padding.top + innerH + 16}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px] tabular-nums"
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="block size-3 rounded-sm" style={{ backgroundColor: 'oklch(0.62 0.16 145)' }} />
          <span className="text-muted-foreground">Efectivo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="block size-3 rounded-sm" style={{ backgroundColor: 'oklch(0.55 0.18 245)' }} />
          <span className="text-muted-foreground">Medios digitales</span>
        </div>
      </div>
    </div>
  )
}
