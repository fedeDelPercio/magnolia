'use client'

import { CalendarIcon } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import type { UltimoCierre } from '../caja-mayor-queries'

// Tile compacto que muestra el ultimo CIERRE DE CAJA registrado en Bistro.
// Es informativo: no es del mes filtrado en /caja, es siempre el ultimo dato
// disponible (tipicamente el cierre de ayer).
export function UltimoCierreTile({ ultimo }: { ultimo: UltimoCierre }) {
  if (!ultimo) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Último cierre de caja</p>
        <p className="mt-1 text-sm text-muted-foreground">Sin cierres sincronizados todavía.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Último cierre de caja</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(ultimo.monto)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="size-3" />
            {formatDate(ultimo.fecha)}
          </p>
        </div>
      </div>
    </div>
  )
}
