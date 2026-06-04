import Link from 'next/link'
import { CalendarIcon, FileTextIcon, DollarSignIcon, AlertCircleIcon, CheckCircle2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    ? {
        statusText: 'text-amber-700',
        valueText: 'text-amber-800',
        bar: 'bg-amber-500',
        accent: 'bg-amber-500',
        tint: 'bg-amber-50/40',
      }
    : {
        statusText: 'text-emerald-700',
        valueText: 'text-foreground',
        bar: 'bg-primary/70',
        accent: 'bg-emerald-500/60',
        tint: '',
      }

  return (
    <Link
      href={`/proveedores/${proveedorId}`}
      className={cn(
        'card-editorial focus-ring relative block overflow-hidden p-5 transition-colors hover:bg-muted/30',
        tone.tint,
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-0.5', tone.accent)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 text-card-title">
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{proveedorName}</span>
          </div>
          <p className="text-card-sub">{describePaymentRule(rule)}</p>
        </div>
        <StatusIcon className={cn('size-4 shrink-0', tone.statusText)} aria-hidden />
      </div>

      {evaluation.kind === 'boletas' && (
        <div className="mt-4 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn('num-editorial text-2xl leading-none', tone.valueText)}>
              {evaluation.current} {evaluation.current === 1 ? 'boleta' : 'boletas'}
            </span>
            <span className="text-card-sub text-metric">
              alerta al llegar a {evaluation.target}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${evaluation.pct}%` }} />
          </div>
        </div>
      )}

      {evaluation.kind === 'monto' && (
        <div className="mt-4 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn('num-editorial text-2xl leading-none', tone.valueText)}>
              {formatCurrency(evaluation.current)}
            </span>
            <span className="text-card-sub text-metric">
              alerta al llegar a {formatCurrency(evaluation.target)}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${evaluation.pct}%` }} />
          </div>
        </div>
      )}

      {evaluation.kind === 'fecha' && (
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className={cn('num-editorial text-2xl leading-none', tone.valueText)}>
            {evaluation.label}
          </span>
          <span className="text-card-sub text-metric">{evaluation.nextDate}</span>
        </div>
      )}
    </Link>
  )
}
