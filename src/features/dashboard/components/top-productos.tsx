import { formatCurrency } from '@/lib/format'
import type { TopProducto } from '../queries'

type Props = {
  productos: TopProducto[]
}

export function TopProductosCard({ productos }: Props) {
  const maxCantidad = Math.max(1, ...productos.map((p) => p.cantidad))

  return (
    <div className="card-editorial p-6">
      <h3 className="text-eyebrow">Top productos vendidos</h3>
      {productos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin ventas registradas en el período.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {productos.map((p, i) => {
            const pct = (p.cantidad / maxCantidad) * 100
            return (
              <li key={p.nombre} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-metric text-xs text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate font-medium">{p.nombre}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-metric font-medium">{Math.round(p.cantidad)}</span>
                    <span className="ml-2 text-metric text-xs text-muted-foreground">
                      {formatCurrency(p.monto)}
                    </span>
                  </div>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
