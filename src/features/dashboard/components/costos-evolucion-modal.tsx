'use client'

import { useEffect, useState } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CostosEvolucionPunto } from '../costos-evolucion-queries'

type Metric = 'food' | 'labor' | 'prime'

const METRIC_INFO: Record<Metric, { label: string; color: string; benchmark: string; pickPct: (p: CostosEvolucionPunto) => number | null }> = {
  food: {
    label: 'Food Cost',
    color: '#15803d', // emerald-700
    benchmark: '28 – 35 %',
    pickPct: (p) => p.foodCostPct,
  },
  labor: {
    label: 'Labor Cost',
    color: '#1d4ed8', // blue-700
    benchmark: '25 – 32 %',
    pickPct: (p) => p.laborCostPct,
  },
  prime: {
    label: 'Prime Cost',
    color: '#a16207', // yellow-700
    benchmark: '< 65 %',
    pickPct: (p) => p.primeCostPct,
  },
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  metric: Metric | null
}

// Modal que se abre al clickear una card de costos en el dashboard. Muestra
// la evolucion de la metrica seleccionada (food / labor / prime cost) a lo
// largo de los ultimos 6 meses como un grafico de linea simple en SVG.
export function CostosEvolucionModal({ open, onOpenChange, metric }: Props) {
  const [data, setData] = useState<CostosEvolucionPunto[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !metric || data !== null) return
    setLoading(true)
    fetch('/api/dashboard/costos-evolucion?months=6')
      .then((r) => r.json())
      .then((rows: CostosEvolucionPunto[]) => setData(rows))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [open, metric, data])

  // Reset data al cerrar para que la proxima apertura refetchee
  useEffect(() => {
    if (!open) setData(null)
  }, [open])

  const info = metric ? METRIC_INFO[metric] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Evolución de {info?.label ?? 'Costo'} · últimos 6 meses
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading || !data ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin datos.</p>
          ) : info ? (
            <>
              <Chart data={data} metric={metric!} color={info.color} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Benchmark gastronómico: <strong>{info.benchmark}</strong></span>
                <span>Eje Y: % · Eje X: mes</span>
              </div>
              <Tabla data={data} metric={metric!} />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Chart({ data, metric, color }: { data: CostosEvolucionPunto[]; metric: Metric; color: string }) {
  const W = 600
  const H = 240
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 32

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const values = data.map((d) => METRIC_INFO[metric].pickPct(d))
  const numericValues = values.filter((v): v is number => v !== null)
  // Auto-scale: rango con un poco de holgura
  const minRaw = numericValues.length > 0 ? Math.min(...numericValues) : 0
  const maxRaw = numericValues.length > 0 ? Math.max(...numericValues) : 100
  const yMin = Math.max(0, Math.floor((minRaw - 5) / 5) * 5)
  const yMax = Math.ceil((maxRaw + 5) / 5) * 5
  const yRange = Math.max(1, yMax - yMin)

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0
  const points = values.map((v, i) => {
    if (v === null) return null
    const x = padL + i * xStep
    const y = padT + innerH - ((v - yMin) / yRange) * innerH
    return { x, y, v, label: data[i]!.label }
  })

  const path = points
    .map((p, i) => (p === null ? '' : `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`))
    .filter(Boolean)
    .join(' ')

  // Gridlines en Y cada 5%
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax; v += 5) yTicks.push(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid horizontal */}
      {yTicks.map((tick) => {
        const y = padT + innerH - ((tick - yMin) / yRange) * innerH
        return (
          <g key={tick}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="2 4" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6b7280">
              {tick}%
            </text>
          </g>
        )
      })}

      {/* Linea */}
      <path d={path} stroke={color} strokeWidth="2" fill="none" />

      {/* Puntos */}
      {points.map((p, i) =>
        p ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill={color}
            >
              {p.v.toFixed(1)}%
            </text>
          </g>
        ) : null,
      )}

      {/* Eje X labels */}
      {data.map((d, i) => {
        const x = padL + i * xStep
        return (
          <text
            key={i}
            x={x}
            y={H - padB + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

function Tabla({ data, metric }: { data: CostosEvolucionPunto[]; metric: Metric }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Mes</th>
            <th className="text-right px-3 py-2 font-medium">{METRIC_INFO[metric].label}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => {
            const v = METRIC_INFO[metric].pickPct(d)
            return (
              <tr key={d.month} className="border-t">
                <td className="px-3 py-2">{d.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {v !== null ? `${v.toFixed(1)}%` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
