import { formatCurrency } from '@/lib/format'
import type { TopProducto } from '../queries'

type Props = {
  productos: TopProducto[]
}

export function TopProductosCard({ productos }: Props) {
  const maxCantidad = Math.max(1, ...productos.map((p) => p.cantidad))

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Top productos vendidos
      </h2>
      {productos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin ventas registradas en el mes.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {productos.map((p, i) => {
            const pct = (p.cantidad / maxCantidad) * 100
            return (
              <li key={p.nombre} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="tabular-nums text-xs text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate font-medium">{p.nombre}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="tabular-nums font-medium">{Math.round(p.cantidad)}</span>
                    <span className="ml-2 tabular-nums text-xs text-muted-foreground">
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
