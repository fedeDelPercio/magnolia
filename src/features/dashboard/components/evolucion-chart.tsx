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

// Paleta editorial olive: dos tonos del mismo hue para coherencia con la app
const COLOR_EFECTIVO = 'oklch(0.36 0.08 138)'   // oliva profundo
const COLOR_DIGITAL = 'oklch(0.68 0.08 138)'    // oliva pálido (mismo hue, más claro)

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
  const height = 360
  const padding = { top: 44, right: 24, bottom: 56, left: 72 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxY = Math.max(1, ...data.map((d) => d.total))
  const barGap = 6
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
    <section>
      {/* Section header editorial — fuera del card */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Evolución
          </p>
          <h2 className="mt-1 font-display text-3xl leading-tight tracking-tight">
            <span className="italic">Así</span> está evolucionando la facturación de Magnolia
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs tabular-nums text-muted-foreground">
            <span style={{ color: COLOR_EFECTIVO }} className="font-medium">
              {efectivoPct.toFixed(0)}% efectivo
            </span>
            {'  ·  '}
            <span style={{ color: COLOR_DIGITAL }} className="font-medium">
              {digitalPct.toFixed(0)}% digital
            </span>
          </p>
          <div className="flex rounded-full border bg-card overflow-hidden text-xs">
            {(['dia', 'semana', 'mes'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={
                  'px-3.5 py-1.5 transition-colors ' +
                  (granularity === g
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {GRAN_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-editorial p-6">
        {data.length === 0 || total === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin cierres cargados para este rango.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-auto max-h-[360px] w-full min-w-[640px]"
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
                    strokeOpacity={0.07}
                    strokeDasharray={i === 0 ? '0' : '2 4'}
                  />
                  <text
                    x={padding.left - 12}
                    y={t.y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums tracking-tight"
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

                const showPctInside = barW >= 32
                const minHeightForLabel = 24

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
                        rx={1}
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
                        rx={1}
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
                        fillOpacity={0.95}
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
                        fillOpacity={0.95}
                      >
                        {pctEfectivo.toFixed(0)}%
                      </text>
                    )}

                    {/* Total arriba de la barra — Fraunces serif */}
                    {d.total > 0 && (
                      <text
                        x={x + barW / 2}
                        y={yDigital - 8}
                        textAnchor="middle"
                        className="fill-foreground text-[12px] tabular-nums"
                        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
                      >
                        {compactTopLabel(d.total)}
                      </text>
                    )}

                    {/* Label x */}
                    {i % xLabelStep === 0 && (
                      <text
                        x={x + barW / 2}
                        y={padding.top + innerH + 18}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px] tabular-nums tracking-tight"
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
        <div className="mt-4 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-4 rounded-sm" style={{ backgroundColor: COLOR_EFECTIVO }} />
            <span className="text-muted-foreground">
              Efectivo · <span className="tabular-nums text-foreground/70">{formatCurrency(efectivoTotal)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-4 rounded-sm" style={{ backgroundColor: COLOR_DIGITAL }} />
            <span className="text-muted-foreground">
              Medios digitales · <span className="tabular-nums text-foreground/70">{formatCurrency(digitalTotal)}</span>
            </span>
          </div>
          <span className="ml-auto text-muted-foreground tabular-nums">
            Total: <span className="font-medium text-foreground">{formatCurrency(total)}</span>
          </span>
        </div>
      </div>
    </section>
  )
}
