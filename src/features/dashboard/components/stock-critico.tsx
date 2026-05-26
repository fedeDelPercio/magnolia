import Link from 'next/link'
import { PackageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatQuantity } from '@/lib/format'
import { stockTone } from '@/lib/tones'
import type { InsumoCritico } from '../queries'

export function StockCriticoCard({ insumos }: { insumos: InsumoCritico[] }) {
  return (
    <div className="card-editorial p-6">
      <div className="flex items-center gap-2">
        <PackageIcon className="size-3.5 text-rose-600" aria-hidden />
        <h3 className="text-eyebrow">Stock crítico</h3>
      </div>
      <p className="mt-1 text-card-sub">Insumos por debajo del 30% de referencia</p>

      {insumos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ningún insumo en stock crítico.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {insumos.map((i) => {
            const tone = stockTone(i.pct)
            return (
              <li key={i.id} className="space-y-1">
                <Link
                  href="/catalogo/insumos"
                  className="focus-ring -mx-1 flex items-baseline justify-between gap-3 rounded-sm px-1 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="truncate font-medium">{i.name}</span>
                  <div className="shrink-0 text-right">
                    <span className={cn('text-metric font-medium', tone.text)}>
                      {formatQuantity(i.stock_actual, i.unit)}
                    </span>
                    <span className="ml-2 text-[11px] text-metric text-muted-foreground">
                      de {formatQuantity(i.stock_referencia, i.unit)}
                    </span>
                  </div>
                </Link>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', tone.bar)}
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
