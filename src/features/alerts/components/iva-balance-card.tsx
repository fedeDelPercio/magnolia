import { ReceiptIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { IvaBalance } from '../queries'

function splitCurrency(value: number): { whole: string; decimals: string } {
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  const lastComma = formatted.lastIndexOf(',')
  if (lastComma === -1) return { whole: formatted, decimals: '' }
  return { whole: formatted.slice(0, lastComma), decimals: formatted.slice(lastComma) }
}

export function IvaBalanceCard({ balance }: { balance: IvaBalance }) {
  // Estado sin configurar
  if (balance.taxRate === 0) {
    return (
      <section>
        <div className="mb-4">
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Balanza de IVA
          </p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            <span className="italic">Saldo</span> fiscal del período
          </h2>
        </div>
        <div className="card-editorial p-7">
          <p className="text-sm text-muted-foreground">
            Configurá el % de IVA de medios digitales en{' '}
            <a href="/config" className="underline">Configuración</a> para activar la balanza.
          </p>
        </div>
      </section>
    )
  }

  const isAFavor = balance.balance < 0
  const abs = Math.abs(balance.balance)
  const balanceParts = splitCurrency(abs)
  const balanceTone = isAFavor ? 'text-emerald-700' : 'text-rose-700'
  const balanceTint = isAFavor ? 'bg-emerald-50/40' : 'bg-rose-50/50'
  const balanceBar = isAFavor ? 'bg-emerald-600' : 'bg-rose-500'

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Balanza de IVA
          </p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            <span className="italic">Saldo</span> fiscal del período
          </h2>
        </div>
        <p className="hidden text-xs text-muted-foreground md:block">
          Débito sobre medios digitales · Crédito sobre compras de proveedores que discriminan IVA
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* === Balance featured (col 1) === */}
        <div className={`card-editorial relative overflow-hidden p-7 ${balanceTint}`}>
          <div className={`absolute inset-y-0 left-0 w-0.5 ${balanceBar}`} />

          <div className="flex items-center gap-2 text-sm">
            <ReceiptIcon className="size-3.5 text-muted-foreground" />
            <span className="font-semibold">Saldo del período</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            IVA · alícuota {balance.taxRate}%
          </p>

          <p className={`mt-6 num-editorial text-5xl leading-none ${balanceTone}`}>
            {isAFavor ? '+' : '−'} {balanceParts.whole}
            <span className={`text-2xl ${balanceTone} opacity-40`}>{balanceParts.decimals}</span>
          </p>

          <p className={`mt-4 text-sm font-medium ${balanceTone}`}>
            {isAFavor ? 'a favor — descuento sobre IVA débito' : 'a pagar a AFIP'}
          </p>
        </div>

        {/* === IVA débito (col 1) === */}
        <div className="card-editorial p-7">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUpIcon className="size-3.5 text-rose-600" />
            <span className="font-semibold">IVA débito</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Lo que debemos por las ventas</p>

          <p className="mt-6 num-editorial text-4xl leading-none text-foreground">
            {formatCurrency(balance.ivaDebito)}
          </p>

          <p className="mt-4 text-xs text-muted-foreground">
            Sobre{' '}
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(balance.digitalRevenue)}
            </span>{' '}
            de ventas digitales
          </p>
        </div>

        {/* === IVA crédito (col 1) === */}
        <div className="card-editorial p-7">
          <div className="flex items-center gap-2 text-sm">
            <TrendingDownIcon className="size-3.5 text-emerald-600" />
            <span className="font-semibold">IVA crédito</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lo que descontamos por las compras
          </p>

          <p className="mt-6 num-editorial text-4xl leading-none text-foreground">
            {formatCurrency(balance.ivaCredito)}
          </p>

          <p className="mt-4 text-xs text-muted-foreground">
            Sobre{' '}
            <span className="tabular-nums font-medium text-foreground">
              {formatCurrency(balance.comprasConIva)}
            </span>{' '}
            en compras con IVA
          </p>
        </div>
      </div>
    </section>
  )
}
