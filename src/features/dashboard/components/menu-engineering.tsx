'use client'

import { useState } from 'react'
import { formatCurrency, compactNumber } from '@/lib/format'
import { MenuEngineeringHelp } from './menu-engineering-help'
import { SectionHeader } from '@/components/shared/section-header'
import type { MenuEngineeringPoint } from '../queries'

type Props = {
  data: {
    points: MenuEngineeringPoint[]
    thresholdCantidad: number
    thresholdMargen: number
    sinReceta: number
  }
}

// Orden de las claves = orden de la leyenda inferior. Sigue la lectura por
// columnas de la matriz: izquierda (Acertijo↖, Perro↙), luego derecha
// (Estrella↗, Caballito↘). El acceso por key no depende del orden.
const CUADRANTE_INFO = {
  acertijo: { label: 'Acertijos', hex: '#D97706', tint: '#FFFBEB', desc: 'Buen margen, poca venta. Promover o reubicar.' },
  perro: { label: 'Perros', hex: '#E11D48', tint: '#FFF1F2', desc: 'Poca venta y poco margen. Considerar sacar de carta.' },
  estrella: { label: 'Estrellas', hex: '#059669', tint: '#ECFDF5', desc: 'Volumen + rentabilidad. Potenciar.' },
  caballito: { label: 'Caballitos', hex: '#2563EB', tint: '#EFF6FF', desc: 'Mucho volumen, poco margen. Bajar costo o subir precio.' },
} as const

type HoveredPoint = { p: MenuEngineeringPoint; cx: number; cy: number }

export function MenuEngineeringMatrix({ data }: Props) {
  const { points, thresholdCantidad, thresholdMargen, sinReceta } = data
  const [hovered, setHovered] = useState<HoveredPoint | null>(null)

  if (points.length === 0) {
    return (
      <section>
        <SectionHeader eyebrow="Menu Engineering" action={<MenuEngineeringHelp />}>
          <span className="italic">Qué</span> hacer con cada producto
        </SectionHeader>
        <div className="card-editorial p-6">
          <p className="text-center text-sm text-muted-foreground">
            Sin productos mapeados al catálogo en este período.
          </p>
        </div>
      </section>
    )
  }

  // SVG layout — aspect ratio wide para desktop, cap de altura
  const width = 1000
  const height = 380
  const padding = { top: 30, right: 28, bottom: 42, left: 64 }
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

  const xMid = xScale(thresholdCantidad)
  const yMid = yScale(thresholdMargen)

  // Cuadrantes (rectángulos de fondo, con tinte) — visualmente iguales (50/50)
  const quadRects = [
    { kind: 'acertijo' as const, x: padding.left, y: padding.top, w: xMid - padding.left, h: yMid - padding.top },
    { kind: 'estrella' as const, x: xMid, y: padding.top, w: padding.left + innerW - xMid, h: yMid - padding.top },
    { kind: 'perro' as const, x: padding.left, y: yMid, w: xMid - padding.left, h: padding.top + innerH - yMid },
    { kind: 'caballito' as const, x: xMid, y: yMid, w: padding.left + innerW - xMid, h: padding.top + innerH - yMid },
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

  return (
    <section>
      <SectionHeader
        eyebrow="Menu Engineering"
        action={<MenuEngineeringHelp />}
        trail={`Popularidad × rentabilidad · ${points.length} productos analizados${
          sinReceta > 0 ? ` · ${sinReceta} sin receta quedan afuera` : ''
        }`}
      >
        <span className="italic">Qué</span> hacer con cada producto
      </SectionHeader>

      <div className="card-editorial p-6">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto max-h-[380px] w-full min-w-[640px]"
        >
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

          {/* Líneas divisorias (50/50 visual) */}
          <line
            x1={xMid}
            x2={xMid}
            y1={padding.top}
            y2={padding.top + innerH}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 4"
          />
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={yMid}
            y2={yMid}
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
            ${compactNumber(yMax)}
          </text>
          <text x={padding.left - 8} y={yMid + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            ${compactNumber(thresholdMargen)}
          </text>
          <text x={padding.left - 8} y={padding.top + innerH + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            ${compactNumber(yMin)}
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
          <text x={xMid} y={padding.top + innerH + 18} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
            {Math.round(thresholdCantidad)}
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
            const isHovered = hovered?.p.id === p.id
            return (
              <g
                key={p.id}
                className="cursor-pointer"
                onMouseEnter={() => setHovered({ p, cx, cy })}
                onMouseLeave={() => setHovered((h) => (h?.p.id === p.id ? null : h))}
              >
                {/* Hit target invisible mas grande, para que sea facil apuntar
                    incluso a los puntos chicos */}
                <circle cx={cx} cy={cy} r={Math.max(r, 12)} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={info.hex}
                  fillOpacity={isHovered ? 1 : 0.7}
                  stroke={info.hex}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
                {labelSet.has(p.id) && !isHovered && (
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

          {/* Tooltip custom: muestra el nombre de CUALQUIER punto al pasar el
              cursor (no solo los top-2 etiquetados). Se dibuja al final para
              quedar por encima del resto. */}
          {hovered && (() => {
            const { p, cx, cy } = hovered
            const info = CUADRANTE_INFO[p.cuadrante]
            const line1 = p.name
            const line2 = `${Math.round(p.cantidad)} u · cobrado ${formatCurrency(p.precio_real)} · margen ${formatCurrency(p.margen_unitario)}/u`
            const charW = 6.4
            const boxW = Math.max(line1.length, line2.length) * charW + 22
            const boxH = 54
            let bx = cx + 14
            if (bx + boxW > padding.left + innerW) bx = cx - boxW - 14
            if (bx < padding.left) bx = padding.left
            let by = cy - boxH - 10
            if (by < padding.top) by = cy + 16
            return (
              <g pointerEvents="none">
                <rect
                  x={bx}
                  y={by}
                  width={boxW}
                  height={boxH}
                  rx={6}
                  fill="white"
                  stroke={info.hex}
                  strokeOpacity={0.6}
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}
                />
                <text x={bx + 11} y={by + 19} className="fill-foreground text-[12px] font-semibold">
                  {line1}
                </text>
                <text x={bx + 11} y={by + 35} className="fill-muted-foreground text-[11px] tabular-nums">
                  {line2}
                </text>
                <text
                  x={bx + 11}
                  y={by + 48}
                  fill={info.hex}
                  className="text-[10px] font-semibold uppercase tracking-wider"
                >
                  {info.label}
                </text>
              </g>
            )
          })()}
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
    </section>
  )
}
