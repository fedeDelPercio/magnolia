'use client'

import { CalendarIcon } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/format'
import type { UltimoCierre } from '../caja-mayor-queries'

export function UltimoCierreTile({ ultimo }: { ultimo: UltimoCierre }) {
  if (!ultimo) {
    return (
      <div className="rounded-xl border bg-card p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Último cierre efectivo</p>
        <p className="mt-1 text-xs text-muted-foreground">Sin cierres sincronizados.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Último cierre efectivo</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(ultimo.monto)}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
        <CalendarIcon className="size-2.5" />
        {formatDateShort(ultimo.fecha)} · registrado en Bistro
      </p>
    </div>
  )
}
