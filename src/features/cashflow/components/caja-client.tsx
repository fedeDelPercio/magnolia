'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { formatCurrency, formatDate } from '@/lib/format'
import { EgresoDialog } from './egreso-dialog'
import type { CajaMovimiento } from '../queries'

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

type Props = { movimientos: CajaMovimiento[]; month: string }

export function CajaClient({ movimientos, month }: Props) {
  const router = useRouter()
  const [egresoOpen, setEgresoOpen] = useState(false)

  const totalIngresos = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)

  const totalEgresos = movimientos
    .filter((m) => m.tipo === 'egreso')
    .reduce((s, m) => s + m.monto, 0)

  const saldo = totalIngresos - totalEgresos

  function navigate(newMonth: string) {
    router.push(`/caja?month=${newMonth}`)
  }

  const today = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(prevMonth(month))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="text-base font-semibold w-40 text-center">{monthLabel(month)}</h2>
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
        <Button onClick={() => setEgresoOpen(true)}>
          <PlusIcon className="size-4" />
          Registrar egreso
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos</p>
          <p className="mt-1 font-mono font-semibold text-green-700">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Egresos</p>
          <p className="mt-1 font-mono font-semibold text-red-600">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Resultado</p>
          <p className={`mt-1 font-mono font-semibold text-lg ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg border divide-y text-sm">
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
