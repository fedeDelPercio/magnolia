import { formatCurrency } from '@/lib/format'
import type { MenuEngineeringPoint } from '../queries'

type Props = {
  data: { points: MenuEngineeringPoint[]; medianCantidad: number; medianMargen: number }
}

const CUADRANTE_INFO = {
  estrella: { label: 'Estrellas', hex: '#059669', tint: '#ECFDF5', desc: 'Volumen + rentabilidad. Potenciar.' },
  caballito: { label: 'Caballitos', hex: '#2563EB', tint: '#EFF6FF', desc: 'Mucho volumen, poco margen. Bajar costo o subir precio.' },
  acertijo: { label: 'Acertijos', hex: '#D97706', tint: '#FFFBEB', desc: 'Buen margen, poca venta. Promover o reubicar.' },
  perro: { label: 'Perros', hex: '#E11D48', tint: '#FFF1F2', desc: 'Poca venta y poco margen. Considerar sacar de carta.' },
} as const

export function MenuEngineeringMatrix({ data }: Props) {
  const { points, medianCantidad, medianMargen } = data

  if (points.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Menu Engineering
        </h2>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin productos mapeados al catálogo en este mes.
        </p>
      </div>
    )
  }

  // SVG layout
  const width = 800
  const height = 460
  const padding = { top: 36, right: 32, bottom: 48, left: 72 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const maxCantidad = Math.max(...points.map((p) => p.cantidad), 1)
  const maxMargen = Math.max(...points.map((p) => p.margen_unitario), 1)
  const minMargen = Math.min(...points.map((p) => p.margen_unitario), 0)

  // El eje Y arranca abajo del mínimo (puede ser 0 o negativo)
  const yMin = Math.min(0, minMargen)
  const yMax = maxMargen

  const xScale = (v: number) => padding.left + (v / maxCantidad) * innerW
  const yScale = (v: number) => padding.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH

  const xMedian = xScale(medianCantidad)
  const yMedian = yScale(medianMargen)

  // Cuadrantes (rectángulos de fondo, con tinte)
  const quadRects = [
    { kind: 'acertijo' as const, x: padding.left, y: padding.top, w: xMedian - padding.left, h: yMedian - padding.top },
    { kind: 'estrella' as const, x: xMedian, y: padding.top, w: padding.left + innerW - xMedian, h: yMedian - padding.top },
    { kind: 'perro' as const, x: padding.left, y: yMedian, w: xMedian - padding.left, h: padding.top + innerH - yMedian },
    { kind: 'caballito' as const, x: xMedian, y: yMedian, w: padding.left + innerW - xMedian, h: padding.top + innerH - yMedian },
  ]

  // Contar productos por cuadrante para el resumen
  const counts: Record<MenuEngineeringPoint['cuadrante'], number> = {
    estrella: 0, caballito: 0, acertijo: 0, perro: 0,
  }
  for (const p of points) counts[p.cuadrante]++

  // Etiquetas: solo los top 2 más extremos de cada cuadrante (por monto)
  const topByQuad = new Map<string, MenuEngineeringPoint[]>()
  for (const p of points) {
    const arr = topByQuad.get(p.cuadrante) ?? []
    arr.push(p)
    topByQuad.set(p.cuadrante, arr)
  }
  const labelSet = new Set<string>()
  for (const [, arr] of topByQuad) {
    arr.sort((a, b) => b.monto - a.monto).slice(0, 2).forEach((p) => labelSet.add(p.id))
  }

  const compact = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`
    return `${Math.round(v)}`
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Menu Engineering
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Popularidad × rentabilidad por producto · {points.length} productos analizados
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[640px]">
          {/* Cuadrantes de fondo */}
          {quadRects.map((q) => (
            <rect key={q.kind} x={q.x} y={q.y} width={q.w} height={q.h} fill={CUADRANTE_INFO[q.kind].tint} />
          ))}

          {/* Borde del área de plot */}
          <rect
            x={padding.left}
            y={padding.top}
            width={innerW}
            height={innerH}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
          />

          {/* Líneas de mediana */}
          <line
            x1={xMedian}
            x2={xMedian}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 4"
          />
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={yMedian}
            y2={yMedian}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 4"
          />

          {/* Labels de cuadrante (esquinas) */}
          <text x={padding.left + 8} y={padding.top + 18} className="fill-amber-700 text-[11px] font-semibold uppercase tracking-wider">
            Acertijo
          </text>
          <text x={padding.left + innerW - 8} y={padding.top + 18} textAnchor="end" className="fill-emerald-700 text-[11px] font-semibold uppercase tracking-wider">
            Estrella
          </text>
          <text x={padding.left + 8} y={padding.top + innerH - 8} className="fill-rose-700 text-[11px] font-semibold uppercase tracking-wider">
            Perro
          </text>
          <text x={padding.left + innerW - 8} y={padding.top + innerH - 8} textAnchor="end" className="fill-blue-700 text-[11px] font-semibold uppercase tracking-wider">
            Caballito
          </text>

          {/* Eje Y labels */}
          <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            ${compact(yMax)}
          </text>
          <text x={padding.left - 8} y={yMedian + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            ${compact(medianMargen)}
          </text>
          <text x={padding.left - 8} y={padding.top + innerH + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            ${compact(yMin)}
          </text>
          <text
            x={20}
            y={padding.top + innerH / 2}
            transform={`rotate(-90 20 ${padding.top + innerH / 2})`}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] uppercase tracking-wider"
          >
            margen unitario
          </text>

          {/* Eje X labels */}
          <text x={padding.left} y={padding.top + innerH + 18} className="fill-muted-foreground text-[10px] tabular-nums">
            0
          </text>
          <text x={xMedian} y={padding.top + innerH + 18} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
            {medianCantidad}
          </text>
          <text x={padding.left + innerW} y={padding.top + innerH + 18} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            {Math.round(maxCantidad)}
          </text>
          <text
            x={padding.left + innerW / 2}
            y={padding.top + innerH + 36}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] uppercase tracking-wider"
          >
            unidades vendidas
          </text>

          {/* Puntos */}
          {points.map((p) => {
            const cx = xScale(p.cantidad)
            const cy = yScale(p.margen_unitario)
            const info = CUADRANTE_INFO[p.cuadrante]
            const r = Math.min(10, 3 + Math.sqrt(p.monto) / 60)
            return (
              <g key={p.id}>
                <circle cx={cx} cy={cy} r={r} fill={info.hex} fillOpacity={0.7} stroke={info.hex} strokeWidth={1.5}>
                  <title>{`${p.name}\n${Math.round(p.cantidad)} unid. × ${formatCurrency(p.margen_unitario)} = ${formatCurrency(p.monto)}\nCuadrante: ${info.label}`}</title>
                </circle>
                {labelSet.has(p.id) && (
                  <text
                    x={cx + r + 4}
                    y={cy + 3}
                    className="fill-foreground text-[10px] font-medium"
                  >
                    {p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Resumen por cuadrante */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(CUADRANTE_INFO) as [keyof typeof CUADRANTE_INFO, typeof CUADRANTE_INFO[keyof typeof CUADRANTE_INFO]][]).map(
          ([key, info]) => (
            <div key={key} className="rounded-lg border p-2.5" style={{ backgroundColor: info.tint }}>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: info.hex }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: info.hex }}>
                  {info.label}
                </span>
                <span className="ml-auto text-xs tabular-nums font-medium" style={{ color: info.hex }}>
                  {counts[key]}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-tight text-foreground/70">{info.desc}</p>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
