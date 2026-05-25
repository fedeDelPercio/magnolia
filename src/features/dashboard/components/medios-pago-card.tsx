import { BanknoteIcon, CreditCardIcon, QrCodeIcon, GlobeIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { MediosPago } from '../queries'

type Props = {
  data: MediosPago
}

const ITEMS: {
  key: keyof MediosPago
  label: string
  Icon: typeof BanknoteIcon
  iconBg: string
  iconFg: string
  bar: string
}[] = [
  { key: 'efectivo', label: 'Efectivo', Icon: BanknoteIcon, iconBg: 'bg-emerald-50', iconFg: 'text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'tarjetas', label: 'Tarjetas', Icon: CreditCardIcon, iconBg: 'bg-blue-50', iconFg: 'text-blue-700', bar: 'bg-blue-500' },
  { key: 'qr', label: 'QR', Icon: QrCodeIcon, iconBg: 'bg-violet-50', iconFg: 'text-violet-700', bar: 'bg-violet-500' },
  { key: 'online', label: 'Online', Icon: GlobeIcon, iconBg: 'bg-cyan-50', iconFg: 'text-cyan-700', bar: 'bg-cyan-500' },
]

export function MediosPagoCard({ data }: Props) {
  const total = data.efectivo + data.tarjetas + data.qr + data.online
  const digital = data.tarjetas + data.qr + data.online
  const efectivoPct = total > 0 ? (data.efectivo / total) * 100 : 0
  const digitalPct = total > 0 ? (digital / total) * 100 : 0

  return (
    <div className="card-editorial p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Medios de pago
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          <span className="text-emerald-700">{efectivoPct.toFixed(0)}% efectivo</span>
          {' · '}
          <span className="text-blue-700">{digitalPct.toFixed(0)}% digital</span>
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        {ITEMS.map(({ key, label, Icon, iconBg, iconFg, bar }) => {
          const monto = data[key]
          const pct = total > 0 ? (monto / total) * 100 : 0
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`grid size-7 place-items-center rounded-md ${iconBg} ${iconFg}`}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(monto)}</span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
