import Link from 'next/link'
import { TrendingUpIcon, PackageOpenIcon, AlertTriangleIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { InsumoGasto, InsumoSubaAlert } from '../queries'

const UNIT_LABELS: Record<string, string> = { kg: 'kg', g: 'g', l: 'l', ml: 'ml', u: 'u' }

function fmtQty(val: number, unit: string): string {
  if ((unit === 'g' || unit === 'kg') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`
  }
  if ((unit === 'ml' || unit === 'l') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} l`
  }
  return `${val.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit] ?? unit}`
}

export function TopInsumosGastoCard({ insumos }: { insumos: InsumoGasto[] }) {
  const maxGasto = Math.max(1, ...insumos.map((i) => i.total_gastado))

  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <PackageOpenIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top insumos en gasto
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Dónde se va la plata este mes</p>

      {insumos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin compras registradas en el mes.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {insumos.map((i, idx) => {
            const pct = (i.total_gastado / maxGasto) * 100
            return (
              <li key={i.id} className="space-y-1">
                <Link
                  href="/catalogo/insumos"
                  className="flex items-baseline justify-between gap-3 text-sm hover:opacity-80"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="tabular-nums text-xs text-muted-foreground/60">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate font-medium">{i.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="tabular-nums font-medium">{formatCurrency(i.total_gastado)}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                      {fmtQty(i.qty_total, i.unit)}
                    </span>
                  </div>
                </Link>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function InsumosSubasCard({ alerts }: { alerts: InsumoSubaAlert[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 text-rose-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Insumos con suba
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Variación &gt;15% vs. mes anterior</p>

      {alerts.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin subas significativas este mes.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {alerts.map((a) => (
            <li key={a.id} className="py-2.5">
              <Link
                href="/catalogo/insumos"
                className="flex items-baseline justify-between gap-3 hover:opacity-80"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  {a.proveedor_actual && (
                    <p className="truncate text-[11px] text-muted-foreground">{a.proveedor_actual}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-0.5 text-sm tabular-nums font-medium text-rose-700">
                    <TrendingUpIcon className="size-3.5" />
                    +{a.variacion_pct.toFixed(0)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatCurrency(a.precio_anterior)} → {formatCurrency(a.precio_actual)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
