'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, InfoIcon } from 'lucide-react'

import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BistroCajaSummary } from '../bistro-caja-queries'

type Props = { summary: BistroCajaSummary }

// Card de "Caja efectivo segun Bistrosoft" para /caja. Logica nueva:
//
//   Cambio neto del mes = ventas + depositos - retiros - traspasos
//     (lo que la matematica dice que DEBERIA haber cambiado el saldo).
//   Variacion real      = saldoFinal - saldoInicial
//     (lo que efectivamente cambio el saldo de la caja segun el primer
//     APERTURA y el ultimo CIERRE del mes).
//   Diferencia          = variacionReal - cambioNeto
//     (faltante o sobrante real del mes; idealmente cero).
export function BistroCajaCard({ summary }: Props) {
  const [retirosOpen, setRetirosOpen] = useState(false)
  const [movsOpen, setMovsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  if (!summary.hasData) return null

  const mesEnCurso = summary.saldoFinal === null
  const difAbs = summary.diferencia !== null ? Math.abs(summary.diferencia) : 0
  const cuadra = !mesEnCurso && difAbs < 1

  return (
    <div className="rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Caja efectivo (Bistrosoft)
        </p>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setHelpOpen((v) => !v)}
        >
          <InfoIcon className="size-3" />
          ¿cómo se calcula?
        </button>
      </div>

      {helpOpen && (
        <div className="mb-3 rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground space-y-1">
          <p><strong>Saldo inicial / final:</strong> primer APERTURA y último CIERRE del mes.</p>
          <p><strong>Variación real:</strong> cuánto cambió el saldo físico (final − inicial).</p>
          <p><strong>Cambio neto:</strong> lo que la suma de movimientos del mes dice que debería haber cambiado.</p>
          <p><strong>Diferencia:</strong> faltante/sobrante = variación real − cambio neto. Si es 0, todo cuadra.</p>
        </div>
      )}

      <div className="space-y-1">
        <Row label="Saldo inicial (apertura)" value={summary.saldoInicial} muted />
        <Row label="Ventas efectivo" value={summary.ventasEfectivo} sign="+" />
        <Row label="Depósitos" value={summary.depositos} sign="+" />
        <Row label="Retiros" value={-summary.retiros} sign="−" />
        {summary.traspasosACajaMayor > 0 && (
          <Row label="Traspasos a caja mayor" value={-summary.traspasosACajaMayor} sign="−" />
        )}
        <div className="flex justify-between font-medium pt-1.5 border-t">
          <span>Cambio neto del mes</span>
          <span className={cn('tabular-nums', summary.cambioNeto >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {summary.cambioNeto >= 0 ? '+ ' : '− '}
            {formatCurrency(Math.abs(summary.cambioNeto))}
          </span>
        </div>

        {mesEnCurso ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            Mes en curso · todavía no hay cierre final para comparar. Saldo esperado al cierre:{' '}
            <strong className="tabular-nums">{formatCurrency(summary.saldoInicial + summary.cambioNeto)}</strong>.
          </div>
        ) : (
          <>
            <div className="flex justify-between text-muted-foreground pt-1.5 border-t">
              <span>Saldo final (último cierre{summary.saldoFinalFecha ? ` ${formatDateShort(summary.saldoFinalFecha)}` : ''})</span>
              <span className="tabular-nums">{formatCurrency(summary.saldoFinal ?? 0)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Variación real (final − inicial)</span>
              <span className={cn('tabular-nums', (summary.variacionReal ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {(summary.variacionReal ?? 0) >= 0 ? '+ ' : '− '}
                {formatCurrency(Math.abs(summary.variacionReal ?? 0))}
              </span>
            </div>
            <div className={cn(
              'flex justify-between font-semibold pt-1.5 border-t',
              cuadra ? 'text-emerald-700' : 'text-amber-700',
            )}>
              <span>{cuadra ? 'Cuadra ✓' : 'Diferencia (faltante/sobrante)'}</span>
              <span className="tabular-nums">
                {cuadra ? formatCurrency(0) : formatCurrency(summary.diferencia ?? 0)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Retiros por motivo */}
      {summary.retirosByMotivo.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium hover:text-foreground"
            onClick={() => setRetirosOpen((v) => !v)}
          >
            {retirosOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            Detalle de retiros · {formatCurrency(summary.retiros)}
          </button>
          {retirosOpen && (
            <div className="mt-2 space-y-1">
              {summary.retirosByMotivo.map((r) => (
                <div key={r.motivo} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {r.motivo} <span className="text-[10px]">({r.count})</span>
                  </span>
                  <span className="tabular-nums text-red-600">− {formatCurrency(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movimientos individuales */}
      {summary.movimientos.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium hover:text-foreground"
            onClick={() => setMovsOpen((v) => !v)}
          >
            {movsOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            Movimientos administrativos ({summary.movimientos.length})
          </button>
          {movsOpen && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-md border divide-y">
              {summary.movimientos.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium">{m.transaction_type}</p>
                    {m.comments && (
                      <p className="text-[11px] text-muted-foreground truncate">{m.comments}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateShort(m.fecha_local)}
                      {m.user_name ? ` · ${m.user_name.trim()}` : ''}
                    </p>
                  </div>
                  <span className={cn(
                    'tabular-nums shrink-0 ml-2',
                    m.bucket === 'retiro' ? 'text-red-600' : 'text-emerald-700',
                  )}>
                    {m.bucket === 'retiro' ? '− ' : '+ '}
                    {formatCurrency(Math.abs(m.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, sign, muted }: { label: string; value: number; sign?: '+' | '−'; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        'tabular-nums',
        muted ? 'text-foreground' : sign === '+' ? 'text-emerald-700' : 'text-red-600',
      )}>
        {sign ? `${sign} ` : ''}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
