import Link from 'next/link'
import { CalendarIcon, FileTextIcon, DollarSignIcon, AlertCircleIcon, CheckCircle2Icon } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { describePaymentRule, type RuleEvaluation } from '@/features/suppliers/payment-rules'
import type { PaymentRule } from '@/features/suppliers/schemas'

type Props = {
  proveedorId: string
  proveedorName: string
  rule: PaymentRule
  evaluation: RuleEvaluation
}

function ruleIcon(kind: RuleEvaluation['kind']) {
  if (kind === 'boletas') return FileTextIcon
  if (kind === 'monto') return DollarSignIcon
  return CalendarIcon
}

export function RuleAlertCard({ proveedorId, proveedorName, rule, evaluation }: Props) {
  const Icon = ruleIcon(evaluation.kind)
  const StatusIcon = evaluation.triggered ? AlertCircleIcon : CheckCircle2Icon
  const tone = evaluation.triggered
    ? { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-800', bar: 'bg-amber-500' }
    : { border: 'border-border', bg: 'bg-card', text: 'text-muted-foreground', bar: 'bg-primary' }

  return (
    <Link
      href={`/proveedores/${proveedorId}`}
      className={`block rounded-xl border ${tone.border} ${tone.bg} p-4 transition-colors hover:bg-muted/40`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{proveedorName}</span>
          </div>
          <p className="text-xs text-muted-foreground">{describePaymentRule(rule)}</p>
        </div>
        <StatusIcon className={`size-4 shrink-0 ${tone.text}`} />
      </div>

      {evaluation.kind === 'boletas' && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className={`text-base font-semibold tabular-nums ${tone.text}`}>
              {evaluation.current} / {evaluation.target}
            </span>
            <span className="text-xs text-muted-foreground">boletas pendientes</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${evaluation.pct}%` }} />
          </div>
        </div>
      )}

      {evaluation.kind === 'monto' && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className={`text-base font-semibold tabular-nums ${tone.text}`}>
              {formatCurrency(evaluation.current)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              de {formatCurrency(evaluation.target)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${evaluation.pct}%` }} />
          </div>
        </div>
      )}

      {evaluation.kind === 'fecha' && (
        <div className="mt-3 flex items-baseline justify-between">
          <span className={`text-base font-semibold ${tone.text}`}>
            {evaluation.label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{evaluation.nextDate}</span>
        </div>
      )}
    </Link>
  )
}
