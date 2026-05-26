import { ShoppingBagIcon, UtensilsIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { MixData } from '../queries'

type Props = {
  data: MixData
}

export function MixCard({ data }: Props) {
  const total = data.salon + data.mostrador
  const salonPct = total > 0 ? (data.salon / total) * 100 : 0
  const mostradorPct = total > 0 ? (data.mostrador / total) * 100 : 0
  const ticketSalon = data.cubiertosSalon > 0 ? data.salon / data.cubiertosSalon : 0
  const ticketMostrador =
    data.transaccionesMostrador > 0 ? data.mostrador / data.transaccionesMostrador : 0

  return (
    <div className="card-editorial p-6">
      <h3 className="text-eyebrow">Salón vs Mostrador</h3>

      {/* Stacked bar */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${salonPct}%` }}
            title={`Salón ${salonPct.toFixed(0)}%`}
          />
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${mostradorPct}%` }}
            title={`Mostrador ${mostradorPct.toFixed(0)}%`}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {/* SALÓN */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
            <UtensilsIcon className="size-3 text-muted-foreground" aria-hidden />
            <span className="font-medium text-muted-foreground">Salón</span>
            <span className="ml-auto text-metric text-muted-foreground">
              {salonPct.toFixed(0)}%
            </span>
          </div>
          <p className="num-editorial text-2xl leading-none">{formatCurrency(data.salon)}</p>
          <div className="space-y-0.5 text-card-sub">
            <p className="text-metric">{data.cubiertosSalon} cubiertos</p>
            <p className="text-metric">{formatCurrency(ticketSalon)} por persona</p>
          </div>
        </div>

        {/* MOSTRADOR */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden />
            <ShoppingBagIcon className="size-3 text-muted-foreground" aria-hidden />
            <span className="font-medium text-muted-foreground">Mostrador</span>
            <span className="ml-auto text-metric text-muted-foreground">
              {mostradorPct.toFixed(0)}%
            </span>
          </div>
          <p className="num-editorial text-2xl leading-none">{formatCurrency(data.mostrador)}</p>
          <div className="space-y-0.5 text-card-sub">
            <p className="text-metric">{data.transaccionesMostrador} transacciones</p>
            <p className="text-metric">{formatCurrency(ticketMostrador)} por venta</p>
          </div>
        </div>
      </div>
    </div>
  )
}
