'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EgresoDialog } from './egreso-dialog'
import type { CajaMovimiento } from '../queries'
import type { MonthlyVentasSummary } from '@/features/cierres/queries'
import { METODO_LABELS } from '@/features/suppliers/schemas'

// Tono visual por método: cheque destaca en amber porque no es flujo realizado todavía.
const METODO_TONE: Record<string, string> = {
  efectivo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  transferencia: 'border-sky-200 bg-sky-50 text-sky-700',
  cheque: 'border-amber-200 bg-amber-50 text-amber-800',
  otro: 'border-gray-200 bg-gray-50 text-gray-700',
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 1) return `${y! - 1}-12`
  return `${y}-${String(mo! - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 12) return `${y! + 1}-01`
  return `${y}-${String(mo! + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return `${MESES[mo! - 1]} ${y}`
}

type Props = {
  movimientos: CajaMovimiento[]
  month: string
  ventasSummary?: MonthlyVentasSummary
  taxRate?: number
}

export function CajaClient({ movimientos, month, ventasSummary, taxRate = 0 }: Props) {
  const router = useRouter()
  const [egresoOpen, setEgresoOpen] = useState(false)

  const ingresosMovimientos = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)

  const ventasTotal = ventasSummary?.total ?? 0
  const totalIngresos = ingresosMovimientos + ventasTotal

  const totalEgresos = movimientos
    .filter((m) => m.tipo === 'egreso')
    .reduce((s, m) => s + m.monto, 0)

  const saldo = totalIngresos - totalEgresos
  const digitalBruto = ventasSummary?.digital ?? 0
  const digitalImpuestos = taxRate > 0 ? digitalBruto * (taxRate / 100) : 0
  const digitalNeto = digitalBruto - digitalImpuestos

  function navigate(newMonth: string) {
    router.push(`/caja?month=${newMonth}`)
  }

  const today = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(prevMonth(month))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="flex-1 text-center text-base font-semibold sm:w-40 sm:flex-none">{monthLabel(month)}</h2>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => navigate(nextMonth(month))}
            disabled={month >= today}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Button onClick={() => setEgresoOpen(true)} className="sm:shrink-0">
          <PlusIcon className="size-4" />
          Registrar egreso
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos</p>
          <p className="mt-1 tabular-nums font-semibold text-green-700">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Egresos</p>
          <p className="mt-1 tabular-nums font-semibold text-red-600">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Resultado</p>
          <p className={`mt-1 tabular-nums font-semibold text-lg ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
      </div>

      {/* Ventas del mes (cierres) */}
      {ventasTotal > 0 && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ventas del mes</p>
            {ventasSummary && ventasSummary.count > 0 && (
              <span className="text-xs text-muted-foreground">{ventasSummary.count} cierre{ventasSummary.count !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efectivo</span>
              <span className="tabular-nums">{formatCurrency(ventasSummary?.efectivo ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medios digitales (bruto)</span>
              <span className="tabular-nums">{formatCurrency(digitalBruto)}</span>
            </div>
            {taxRate > 0 && digitalBruto > 0 && (
              <>
                <div className="flex justify-between text-red-600 pl-3">
                  <span>− Imp. digitales ({taxRate}%)</span>
                  <span className="tabular-nums">− {formatCurrency(digitalImpuestos)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground pl-3">
                  <span>Neto digital</span>
                  <span className="tabular-nums">{formatCurrency(digitalNeto)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold pt-1.5 border-t">
              <span>Total ventas</span>
              <span className="tabular-nums text-green-700">
                {formatCurrency(taxRate > 0 ? (ventasSummary?.efectivo ?? 0) + digitalNeto : ventasTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border bg-card divide-y text-sm overflow-hidden">
        {movimientos.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            Sin movimientos en {monthLabel(month)}.
          </div>
        ) : (
          movimientos.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-1 ${m.tipo === 'ingreso' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {m.tipo === 'ingreso'
                    ? <ArrowUpIcon className="size-3.5 text-green-700" />
                    : <ArrowDownIcon className="size-3.5 text-red-600" />}
                </div>
                <div>
                  <p className="font-medium">{m.categoria}</p>
                  {m.descripcion && <p className="text-xs text-muted-foreground">{m.descripcion}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(m.fecha)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.metodo && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'tabular-nums',
                      m.metodo === 'cheque' && m.cleared_at
                        ? METODO_TONE.efectivo
                        : METODO_TONE[m.metodo] ?? METODO_TONE.otro,
                    )}
                  >
                    {METODO_LABELS[m.metodo] ?? m.metodo}
                    {m.metodo === 'cheque' && m.cleared_at
                      ? ` · cobrado ${formatDateShort(m.cleared_at)}`
                      : m.metodo === 'cheque' && m.due_date
                        ? ` · vence ${formatDateShort(m.due_date)}`
                        : null}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={m.tipo === 'ingreso'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-600'}
                >
                  {m.tipo === 'ingreso' ? '+' : '−'} {formatCurrency(m.monto)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      <EgresoDialog open={egresoOpen} onOpenChange={setEgresoOpen} />
    </div>
  )
}
