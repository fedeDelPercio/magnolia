import Link from 'next/link'
import { AlertTriangleIcon, TrophyIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { ProductoRiesgo, ProductoRentable } from '../queries'

export function ProductosEnRiesgo({ productos }: { productos: ProductoRiesgo[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="size-3.5 text-amber-600" aria-hidden />
        <h3 className="text-eyebrow">Productos en riesgo</h3>
      </div>
      <p className="mt-1 text-card-sub">Margen actual debajo del objetivo</p>

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
                className="focus-ring -mx-1 flex items-center justify-between gap-3 rounded-sm px-1 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-metric">
                    <span className="text-rose-700">{p.margin_pct.toFixed(0)}%</span>
                    <span className="text-muted-foreground"> / {p.target_margin_pct.toFixed(0)}%</span>
                  </p>
                  <p className="text-[11px] text-metric text-muted-foreground">
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
        <TrophyIcon className="size-3.5 text-emerald-600" aria-hidden />
        <h3 className="text-eyebrow">Productos más rentables</h3>
      </div>
      <p className="mt-1 text-card-sub">Mayor aporte de margen este período</p>

      {productos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sin datos de margen aún. Cargá cierres con productos mapeados al catálogo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {productos.map((p, i) => (
            <li key={p.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="text-metric text-xs text-muted-foreground/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate text-sm font-medium">{p.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-metric font-medium text-emerald-700">
                    {formatCurrency(p.margen_total)}
                    <span className="ml-1.5 text-xs font-normal">
                      · {p.margin_pct.toFixed(0)}%
                    </span>
                  </p>
                  <p className="text-[11px] text-metric text-muted-foreground">
                    {Math.round(p.cantidad)} unid. × {formatCurrency(p.margen_unitario)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
