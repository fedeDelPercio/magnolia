import { AlertTriangleIcon, CheckCircle2Icon, FileSignatureIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { SectionHeader } from '@/components/shared/section-header'
import { ChequesMonthNav } from './cheques-month-nav'
import type { ChequesMesSummary } from '../queries'

type Tone = {
  label: string
  tint: string
  bar: string
  text: string
  icon: typeof AlertTriangleIcon
}

const TONE_OK: Tone = {
  label: 'En rango',
  tint: 'bg-emerald-50/40',
  bar: 'bg-emerald-500',
  text: 'text-emerald-700',
  icon: CheckCircle2Icon,
}
const TONE_WARN: Tone = {
  label: 'Cerca del tope',
  tint: 'bg-amber-50/60',
  bar: 'bg-amber-500',
  text: 'text-amber-700',
  icon: AlertTriangleIcon,
}
const TONE_ALERT: Tone = {
  label: 'Tope superado',
  tint: 'bg-rose-50/60',
  bar: 'bg-rose-500',
  text: 'text-rose-700',
  icon: AlertTriangleIcon,
}

function toneFor(pct: number): Tone {
  if (pct >= 100) return TONE_ALERT
  if (pct >= 80) return TONE_WARN
  return TONE_OK
}

export function ChequesMesCard({ summary }: { summary: ChequesMesSummary }) {
  // monthStart viene como "YYYY-MM-DD" (primer día del mes). Usamos YYYY-MM para el nav.
  const monthParam = summary.monthStart.slice(0, 7)

  // Estado sin configurar
  if (summary.limite === 0) {
    return (
      <section>
        <SectionHeader eyebrow="Cheques">
          <span className="italic">Vencimientos</span> del mes
        </SectionHeader>
        <div className="card-editorial p-7">
          <p className="text-sm text-muted-foreground">
            Configurá un tope mensual de vencimiento de cheques en{' '}
            <a href="/config" className="focus-ring rounded-sm underline">
              Configuración
            </a>{' '}
            para activar la alerta.
          </p>
        </div>
      </section>
    )
  }

  const pct = summary.limite > 0 ? (summary.totalVenciendoMes / summary.limite) * 100 : 0
  const tone = toneFor(pct)
  const Icon = tone.icon
  const disponible = summary.limite - summary.totalVenciendoMes
  const barWidth = Math.min(100, pct)

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Cheques
          </p>
          <h2 className="mt-1 font-display text-3xl leading-tight tracking-tight">
            <span className="italic">Vencimientos</span> del mes
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline">
            Tope {formatCurrency(summary.limite)} mensual
          </span>
          <ChequesMonthNav currentMonth={monthParam} />
        </div>
      </div>

      <div className={cn('card-editorial relative overflow-hidden p-7', tone.tint)}>
        <div className={cn('absolute inset-y-0 left-0 w-0.5', tone.bar)} aria-hidden />

        <div className="flex items-center gap-2 text-card-title">
          <FileSignatureIcon className="size-3.5 text-muted-foreground" aria-hidden />
          <span>Por debitar en {summary.monthLabel}</span>
        </div>
        <p className="mt-0.5 text-card-sub">
          {summary.emitidos.length} cheque{summary.emitidos.length === 1 ? '' : 's'} con vencimiento este mes
        </p>

        <div className="mt-6 flex items-baseline justify-between gap-6">
          <p className="num-editorial text-5xl leading-none text-foreground">
            {formatCurrency(summary.totalVenciendoMes)}
          </p>
          <div className="text-right">
            <p className={cn('num-editorial text-4xl leading-none tabular-nums', tone.text)}>
              {pct.toFixed(0)}%
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              del tope
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full transition-all', tone.bar)}
              style={{ width: `${barWidth}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-end text-xs text-muted-foreground">
            <span className="tabular-nums">
              {disponible >= 0 ? (
                <>
                  {formatCurrency(disponible)} <span className="opacity-70">disponibles</span>
                </>
              ) : (
                <>
                  Exceso de {formatCurrency(Math.abs(disponible))}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Estado */}
        <div className={cn('mt-5 flex items-center gap-2 text-sm font-medium', tone.text)}>
          <Icon className="size-4" aria-hidden />
          <span>
            {tone === TONE_OK && 'En rango — todavía tenés margen para emitir.'}
            {tone === TONE_WARN && 'Cerca del tope — emití con cuidado lo que reste del mes.'}
            {tone === TONE_ALERT && 'Superaste el tope mensual. Revisá lo que firmaste.'}
          </span>
        </div>

        {/* Detalle expandible: lista de cheques */}
        {summary.emitidos.length > 0 && (
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Ver el detalle
            </summary>
            <ul className="mt-3 divide-y rounded-lg border bg-background/60">
              {summary.emitidos.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-card-title">{e.proveedorName ?? 'Sin proveedor'}</p>
                    <p className="text-xs text-muted-foreground">
                      Emitido {e.fecha} · vence <span className="tabular-nums">{e.dueDate}</span>
                    </p>
                  </div>
                  <span className="text-metric font-medium tabular-nums">
                    {formatCurrency(e.monto)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
