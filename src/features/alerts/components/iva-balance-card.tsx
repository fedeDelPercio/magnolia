import { ReceiptIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, splitCurrency } from '@/lib/format'
import { ivaBalanceTone } from '@/lib/tones'
import { SectionHeader } from '@/components/shared/section-header'
import type { IvaBalance } from '../queries'

export function IvaBalanceCard({ balance }: { balance: IvaBalance }) {
  // Estado sin configurar
  if (balance.taxRate === 0) {
    return (
      <section>
        <SectionHeader eyebrow="Balanza de IVA">
          <span className="italic">Saldo</span> fiscal del período
        </SectionHeader>
        <div className="card-editorial p-7">
          <p className="text-sm text-muted-foreground">
            Configurá el % de IVA de medios digitales en{' '}
            <a href="/config" className="focus-ring rounded-sm underline">
              Configuración
            </a>{' '}
            para activar la balanza.
          </p>
        </div>
      </section>
    )
  }

  const tone = ivaBalanceTone(balance.balance)
  const abs = Math.abs(balance.balance)
  const balanceParts = splitCurrency(abs)

  return (
    <section>
      <SectionHeader
        eyebrow="Balanza de IVA"
        trail="Débito sobre medios digitales · Crédito sobre compras de proveedores que discriminan IVA"
      >
        <span className="italic">Saldo</span> fiscal del período
      </SectionHeader>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* === Balance featured (col 1) === */}
        <div className={cn('card-editorial relative overflow-hidden p-7', tone.tint)}>
          <div className={cn('absolute inset-y-0 left-0 w-0.5', tone.bar)} aria-hidden />

          <div className="flex items-center gap-2 text-card-title">
            <ReceiptIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <span>Saldo del período</span>
          </div>
          <p className="mt-0.5 text-card-sub">IVA · alícuota {balance.taxRate}%</p>

          <p className={cn('mt-6 num-editorial text-5xl leading-none', tone.text)}>
            {tone.isAFavor ? '+' : '−'} {balanceParts.whole}
            <span className={cn('text-2xl opacity-50', tone.text)}>{balanceParts.decimals}</span>
          </p>

          <p className={cn('mt-4 text-sm font-medium', tone.text)}>
            {tone.isAFavor ? 'a favor — descuento sobre IVA débito' : 'a pagar a AFIP'}
          </p>
        </div>

        {/* === IVA débito (col 1) === */}
        <div className="card-editorial p-7">
          <div className="flex items-center gap-2 text-card-title">
            <TrendingUpIcon className="size-3.5 text-rose-600" aria-hidden />
            <span>IVA débito</span>
          </div>
          <p className="mt-0.5 text-card-sub">Lo que debemos por las ventas</p>

          <p className="mt-6 num-editorial text-4xl leading-none text-foreground">
            {formatCurrency(balance.ivaDebito)}
          </p>

          <p className="mt-4 text-card-sub">
            Sobre{' '}
            <span className="text-metric font-medium text-foreground">
              {formatCurrency(balance.digitalRevenue)}
            </span>{' '}
            de ventas digitales
          </p>
        </div>

        {/* === IVA crédito (col 1) === */}
        <div className="card-editorial p-7">
          <div className="flex items-center gap-2 text-card-title">
            <TrendingDownIcon className="size-3.5 text-emerald-600" aria-hidden />
            <span>IVA crédito</span>
          </div>
          <p className="mt-0.5 text-card-sub">Lo que descontamos por las compras</p>

          <p className="mt-6 num-editorial text-4xl leading-none text-foreground">
            {formatCurrency(balance.ivaCredito)}
          </p>

          <p className="mt-4 text-card-sub">
            Sobre{' '}
            <span className="text-metric font-medium text-foreground">
              {formatCurrency(balance.comprasConIva)}
            </span>{' '}
            en compras con IVA
          </p>
        </div>
      </div>
    </section>
  )
}
