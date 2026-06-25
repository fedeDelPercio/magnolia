'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BistroCajaSummary } from '../bistro-caja-queries'

type Props = { summary: BistroCajaSummary }

// Card de "Caja efectivo segun Bistrosoft" para /caja. Muestra el flujo del mes:
// aperturas + ventas efectivo + depositos - retiros = saldo esperado, contra
// el saldo reportado por los cierres de Bistro. Si hay diferencia, la muestra
// en rojo. Tiene 2 secciones colapsables: detalle de retiros por motivo y
// movimientos administrativos individuales.
export function BistroCajaCard({ summary }: Props) {
  const [retirosOpen, setRetirosOpen] = useState(false)
  const [movsOpen, setMovsOpen] = useState(false)

  if (!summary.hasData) return null

  const difAbs = Math.abs(summary.diferencia)
  const cuadra = difAbs < 1 // tolerancia de redondeo

  return (
    <div className="rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Caja efectivo (Bistrosoft)
        </p>
        <span className="text-[10px] text-muted-foreground">
          según APERTURA / RETIRO / DEPÓSITO / CIERRE registrados en Bistro
        </span>
      </div>

      <div className="space-y-1">
        <Row label="Aperturas del mes" value={summary.aperturas} sign="+" />
        <Row label="Ventas efectivo" value={summary.ventasEfectivo} sign="+" />
        <Row label="Depósitos" value={summary.depositos} sign="+" />
        <Row label="Retiros" value={-summary.retiros} sign="−" />
        <div className="flex justify-between font-medium pt-1.5 border-t">
          <span>Saldo esperado</span>
          <span className="tabular-nums">{formatCurrency(summary.saldoEsperado)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Saldo reportado en cierres</span>
          <span className="tabular-nums">{formatCurrency(summary.cierres)}</span>
        </div>
        <div className={cn(
          'flex justify-between font-semibold pt-1.5 border-t',
          cuadra ? 'text-emerald-700' : 'text-amber-700',
        )}>
          <span>{cuadra ? 'Cuadra ✓' : 'Diferencia'}</span>
          <span className="tabular-nums">
            {cuadra ? formatCurrency(0) : formatCurrency(summary.diferencia)}
          </span>
        </div>
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

function Row({ label, value, sign }: { label: string; value: number; sign: '+' | '−' }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', sign === '+' ? 'text-emerald-700' : 'text-red-600')}>
        {sign} {formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
