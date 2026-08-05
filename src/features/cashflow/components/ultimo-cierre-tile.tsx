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
    // Layout normalizado con las otras cards de cuentas: header de altura fija
    // (aunque no tenga botones) para que el número quede a la misma altura.
    <div className="flex h-full flex-col rounded-xl border bg-card p-3">
      <div className="flex min-h-7 items-center">
        <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wide">Último cierre efectivo</p>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(ultimo.monto)}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
        <CalendarIcon className="size-2.5" />
        {formatDateShort(ultimo.fecha)} · registrado en Bistro
      </p>
    </div>
  )
}
