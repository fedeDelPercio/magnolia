import Link from 'next/link'
import { PackageIcon } from 'lucide-react'
import type { InsumoCritico } from '../queries'

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

export function StockCriticoCard({ insumos }: { insumos: InsumoCritico[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <PackageIcon className="size-4 text-rose-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stock crítico
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Insumos por debajo del 30% de referencia</p>

      {insumos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ningún insumo en stock crítico.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {insumos.map((i) => {
            const tone =
              i.pct < 15
                ? { text: 'text-rose-700', bar: 'bg-rose-500' }
                : { text: 'text-amber-700', bar: 'bg-amber-500' }
            return (
              <li key={i.id} className="space-y-1">
                <Link
                  href="/catalogo/insumos"
                  className="flex items-baseline justify-between gap-3 text-sm hover:opacity-80"
                >
                  <span className="truncate font-medium">{i.name}</span>
                  <div className="shrink-0 text-right">
                    <span className={`tabular-nums font-medium ${tone.text}`}>
                      {fmtQty(i.stock_actual, i.unit)}
                    </span>
                    <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                      de {fmtQty(i.stock_referencia, i.unit)}
                    </span>
                  </div>
                </Link>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${Math.max(2, i.pct)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
