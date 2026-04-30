'use client'

import { useState, useRef, useCallback, memo } from 'react'
import { saveMovimiento } from '../actions'
import type { MovimientoConProducto } from '../queries'

type Props = {
  mov: MovimientoConProducto
  readonly: boolean
}

type LocalState = {
  stock_anterior: number
  produccion: number
  ventas: number
  desperdicio: number
  almuerzo: number
  conteo_fisico: number
}

function numInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return v === 0 ? '' : String(v)
}

function DiferenciaCell({ diferencia }: { diferencia: number }) {
  const rounded = Math.round(diferencia)
  if (rounded === 0) return <span className="tabular-nums text-green-700">0</span>
  if (rounded > 0) return <span className="tabular-nums text-blue-700">+{rounded}</span>
  return <span className="tabular-nums text-red-600">{rounded}</span>
}

export const MovimientoRow = memo(function MovimientoRow({ mov, readonly }: Props) {
  const [local, setLocal] = useState<LocalState>({
    stock_anterior: mov.stock_anterior,
    produccion: mov.produccion,
    ventas: mov.ventas,
    desperdicio: mov.desperdicio,
    almuerzo: mov.almuerzo,
    conteo_fisico: mov.conteo_fisico ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stockTeorico =
    local.stock_anterior + local.produccion - local.ventas - local.desperdicio - local.almuerzo

  const diferencia = local.conteo_fisico - stockTeorico

  const schedulesSave = useCallback(
    (updated: LocalState) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        setSaving(true)
        await saveMovimiento(mov.id, {
          stock_anterior: updated.stock_anterior,
          produccion: updated.produccion,
          ventas: updated.ventas,
          desperdicio: updated.desperdicio,
          almuerzo: updated.almuerzo,
          conteo_fisico: updated.conteo_fisico,
        })
        setSaving(false)
      }, 700)
    },
    [mov.id],
  )

  function handleChange(field: keyof LocalState, raw: string) {
    const parsed = raw === '' ? 0 : parseInt(raw, 10)
    const value = isNaN(parsed) ? 0 : Math.max(0, parsed)
    const updated = { ...local, [field]: value }
    setLocal(updated)
    schedulesSave(updated)
  }

  const inputCls =
    'w-16 rounded border border-input bg-background px-1.5 py-1 text-right tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground'

  return (
    <tr className={saving ? 'opacity-70' : ''}>
      <td className="py-2 pl-4 pr-2 font-medium text-sm">
        {mov.productos.name}
        {saving && <span className="ml-1 text-xs text-muted-foreground">·</span>}
      </td>
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={readonly}
          className={inputCls}
          value={numInput(local.stock_anterior)}
          placeholder="0"
          onChange={(e) => handleChange('stock_anterior', e.target.value)}
        />
      </td>
      {(['produccion', 'ventas', 'desperdicio', 'almuerzo', 'conteo_fisico'] as const).map(
        (field) => (
          <td key={field} className="px-2 py-2 text-right">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              disabled={readonly}
              className={inputCls}
              value={numInput(local[field])}
              placeholder="0"
              onChange={(e) => handleChange(field, e.target.value)}
            />
          </td>
        ),
      )}
      <td className="px-2 py-2 text-right tabular-nums text-sm">
        {Math.round(stockTeorico)}
      </td>
      <td className="px-2 py-2 text-right text-sm">
        <DiferenciaCell diferencia={diferencia} />
      </td>
    </tr>
  )
})
