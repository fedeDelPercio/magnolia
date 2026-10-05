import { AlertTriangleIcon, MinusIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'

import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

// Variación del precio de una línea contra el último precio pagado por el
// insumo. Los dos precios tienen que venir BRUTOS (con el descuento e IVA de su
// compra): es lo que se guarda en insumos.current_price.
//
// Umbrales: una suba de 20 % o más se marca en rojo. Una baja de 30 % o más
// también se marca: en una factura casi siempre es una cantidad o unidad mal
// leída, no una oferta.
const SUBA_FUERTE = 20
const BAJA_FUERTE = -30

export function VariacionPrecio({
  anterior,
  nuevo,
  className,
}: {
  anterior: number
  nuevo: number
  className?: string
}) {
  if (!(anterior > 0) || !(nuevo > 0)) return null
  const pct = ((nuevo - anterior) / anterior) * 100
  const neutro = Math.abs(pct) < 0.05
  const suba = !neutro && pct > 0
  const subaFuerte = pct >= SUBA_FUERTE
  const bajaFuerte = pct <= BAJA_FUERTE
  const Icono = neutro ? MinusIcon : suba ? TrendingUpIcon : TrendingDownIcon

  return (
    <span
      className={cn(
        'flex items-center gap-1 tabular-nums',
        subaFuerte
          ? 'font-semibold text-red-600'
          : bajaFuerte
            ? 'font-semibold text-amber-700'
            : neutro || suba
              ? 'text-muted-foreground'
              : 'text-green-600',
        className,
      )}
      title={
        bajaFuerte
          ? 'Baja muy grande: revisá la cantidad y la unidad de esta línea'
          : 'Último precio pagado por este insumo, con el descuento e IVA de esa compra'
      }
    >
      {(subaFuerte || bajaFuerte) && <AlertTriangleIcon className="size-3" />}
      <Icono className="size-3" />
      Último c/desc. e IVA: {formatCurrency(anterior)} · {neutro ? '0.0' : `${suba ? '+' : ''}${pct.toFixed(1)}`}%
    </span>
  )
}
