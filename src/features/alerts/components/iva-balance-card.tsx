import { ReceiptIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { IvaBalance } from '../queries'

type Props = {
  balance: IvaBalance
}

export function IvaBalanceCard({ balance }: Props) {
  const isAFavor = balance.balance < 0
  const abs = Math.abs(balance.balance)

  if (balance.taxRate === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ReceiptIcon className="size-4 text-muted-foreground" />
          Balanza de IVA
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Configurá el % de IVA de medios digitales en{' '}
          <a href="/config" className="underline">Configuración</a> para activar la balanza.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ReceiptIcon className="size-4 text-muted-foreground" />
            Balanza de IVA · {balance.taxRate}%
          </div>
          <p className="text-xs text-muted-foreground">Mes en curso</p>
        </div>
        <div className="text-right">
          <p
            className={`text-2xl font-semibold tabular-nums ${
              isAFavor ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isAFavor ? '+' : '−'} {formatCurrency(abs)}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAFavor ? 'a favor' : 'a pagar'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUpIcon className="size-3.5 text-rose-600" />
            IVA débito
          </div>
          <p className="mt-1 tabular-nums font-medium">{formatCurrency(balance.ivaDebito)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sobre {formatCurrency(balance.digitalRevenue)} de ventas digitales
          </p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDownIcon className="size-3.5 text-emerald-600" />
            IVA crédito
          </div>
          <p className="mt-1 tabular-nums font-medium">{formatCurrency(balance.ivaCredito)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sobre {formatCurrency(balance.comprasConIva)} en compras con IVA
          </p>
        </div>
      </div>
    </div>
  )
}
