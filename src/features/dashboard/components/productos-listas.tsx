import Link from 'next/link'
import { AlertTriangleIcon, TrophyIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { ProductoRiesgo, ProductoRentable } from '../queries'

export function ProductosEnRiesgo({ productos }: { productos: ProductoRiesgo[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 text-amber-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Productos en riesgo
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Margen actual debajo del objetivo
      </p>

      {productos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Todos los productos cumplen su margen objetivo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {productos.map((p) => (
            <li key={p.id} className="py-2.5">
              <Link
                href="/catalogo/productos"
                className="flex items-center justify-between gap-3 hover:opacity-80"
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums">
                    <span className="text-rose-700">{p.margin_pct.toFixed(0)}%</span>
                    <span className="text-muted-foreground"> / {p.target_margin_pct.toFixed(0)}%</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    −{p.deficit_pct.toFixed(0)} pts
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

export function ProductosMasRentables({ productos }: { productos: ProductoRentable[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <TrophyIcon className="size-4 text-emerald-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Productos más rentables
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Mayor aporte de margen este mes
      </p>

      {productos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin datos de margen aún. Cargá cierres con productos mapeados al catálogo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {productos.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="tabular-nums text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate text-sm font-medium">{p.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm tabular-nums font-medium text-emerald-700">
                  {formatCurrency(p.margen_total)}
                  <span className="ml-1.5 text-xs font-normal">
                    · {p.margin_pct.toFixed(0)}%
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {Math.round(p.cantidad)} unid. × {formatCurrency(p.margen_unitario)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
