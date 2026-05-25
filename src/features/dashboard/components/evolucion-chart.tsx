'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import type { EvolucionPunto, Granularity } from '../queries'

type Props = {
  data: EvolucionPunto[]
  granularity: Granularity
}

const GRAN_LABELS: Record<Granularity, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
}

// Paleta cohesiva: dos tonos del mismo sistema (índigo oscuro y claro)
const COLOR_EFECTIVO = 'oklch(0.42 0.18 264)'   // índigo oscuro
const COLOR_DIGITAL = 'oklch(0.68 0.16 264)'    // índigo claro

export function EvolucionChart({ data, granularity }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setGranularity(g: Granularity) {
    const sp = new URLSearchParams(params.toString())
    sp.set('evGran', g)
    router.push(`${pathname}?${sp.toString()}`)
  }

  const total = data.reduce((s, d) => s + d.total, 0)
  const efectivoTotal = data.reduce((s, d) => s + d.efectivo, 0)
  const digitalTotal = data.reduce((s, d) => s + d.digital, 0)
  const efectivoPct = total > 0 ? (efectivoTotal / total) * 100 : 0
  const digitalPct = total > 0 ? (digitalTotal / total) * 100 : 0

  // SVG layout
  const width = 1100
  const height = 380
  const padding = { top: 36, right: 24, bottom: 56, left: 72 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxY = Math.max(1, ...data.map((d) => d.total))
  const barGap = 8
  const barW = Math.max(6, (innerW - barGap * Math.max(0, data.length - 1)) / Math.max(1, data.length))

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padding.top + innerH - t * innerH,
    val: maxY * t,
  }))

  const compact = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${Math.round(val / 1_000)}k`
    return `$${Math.round(val)}`
  }
  const compactTopLabel = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`
    return `${Math.round(val)}`
  }

  const xLabelStep = Math.max(1, Math.ceil(data.length / 18))

  return (
    <div className="rounded-xl border bg-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Evolución de facturación
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            <span style={{ color: COLOR_EFECTIVO }}>{efectivoPct.toFixed(0)}% efectivo</span>
            {' · '}
            <span style={{ color: COLOR_DIGITAL }}>{digitalPct.toFixed(0)}% digital</span>
            {' · '}
            <span className="text-foreground/70">total {formatCurrency(total)}</span>
          </p>
        </div>

        {/* Granularidad */}
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(['dia', 'semana', 'mes'] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={
                'px-3 py-1.5 transition-colors ' +
                (granularity === g
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted')
              }
            >
              {GRAN_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 || total === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Sin cierres cargados para este rango.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-auto max-h-[380px] w-full min-w-[640px]"
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
              const tooltip = `${d.label}
Total: ${formatCurrency(d.total)}
Efectivo: ${formatCurrency(d.efectivo)} (${pctEfectivo.toFixed(0)}%)
Digital: ${formatCurrency(d.digital)} (${pctDigital.toFixed(0)}%)`

              // Mostrar % dentro de la barra solo si el segmento es alto suficiente
              const showPctInside = barW >= 28
              const minHeightForLabel = 22

              return (
                <g key={d.period}>
                  {/* Digital (arriba) */}
                  {d.digital > 0 && (
                    <rect
                      x={x}
                      y={yDigital}
                      width={barW}
                      height={hDigital}
                      fill={COLOR_DIGITAL}
                      rx={2}
                    >
                      <title>{tooltip}</title>
                    </rect>
                  )}
                  {/* Efectivo (abajo) */}
                  {d.efectivo > 0 && (
                    <rect
                      x={x}
                      y={yEfectivo}
                      width={barW}
                      height={hEfectivo}
                      fill={COLOR_EFECTIVO}
                      rx={2}
                    >
                      <title>{tooltip}</title>
                    </rect>
                  )}

                  {/* % dentro de cada segmento (solo si entra) */}
                  {showPctInside && d.digital > 0 && hDigital >= minHeightForLabel && (
                    <text
                      x={x + barW / 2}
                      y={yDigital + hDigital / 2 + 4}
                      textAnchor="middle"
                      className="text-[11px] font-medium tabular-nums"
                      fill="white"
                    >
                      {pctDigital.toFixed(0)}%
                    </text>
                  )}
                  {showPctInside && d.efectivo > 0 && hEfectivo >= minHeightForLabel && (
                    <text
                      x={x + barW / 2}
                      y={yEfectivo + hEfectivo / 2 + 4}
                      textAnchor="middle"
                      className="text-[11px] font-medium tabular-nums"
                      fill="white"
                    >
                      {pctEfectivo.toFixed(0)}%
                    </text>
                  )}

                  {/* Total arriba de la barra */}
                  {d.total > 0 && (
                    <text
                      x={x + barW / 2}
                      y={yDigital - 6}
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-semibold tabular-nums"
                    >
                      {compactTopLabel(d.total)}
                    </text>
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
      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="block size-3 rounded-sm" style={{ backgroundColor: COLOR_EFECTIVO }} />
          <span className="text-muted-foreground">Efectivo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="block size-3 rounded-sm" style={{ backgroundColor: COLOR_DIGITAL }} />
          <span className="text-muted-foreground">Medios digitales</span>
        </div>
      </div>
    </div>
  )
}
