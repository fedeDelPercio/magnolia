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
  // Una vez que el usuario edita el stock anterior, queda "manual" para este día
  // y el arrastre automático deja de pisarlo.
  const stockManualRef = useRef(mov.stock_anterior_manual)

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
          stock_anterior_manual: stockManualRef.current,
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
    if (field === 'stock_anterior') stockManualRef.current = true
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
          title="Por defecto viene del cierre del día anterior. Editalo si necesitás ajustar."
        />
      </td>
      {(['produccion', 'ventas', 'desperdicio', 'almuerzo', 'conteo_fisico'] as const).map(
        (field) => {
          // Ventas = total (Bistro + ventas por fuera del POS). Es editable:
          // el sync solo reemplaza su parte y conserva la diferencia manual.
          const ventasBistro = Number(mov.ventas_bistro) || 0
          const showBistroHint = field === 'ventas' && ventasBistro > 0
          const manualDiff = local.ventas - ventasBistro
          // El hint "Bistro: N" va en posición absoluta para que la celda mida
          // igual que las demás y los inputs queden siempre centrados en altura.
          return (
            <td key={field} className="px-2 py-2 text-right">
              <div className="relative inline-block">
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
                  title={
                    field === 'ventas'
                      ? `Bistro registró ${ventasBistro}. Si vendés por fuera del POS, editá el total — la diferencia se conserva aunque se re-sincronice.`
                      : undefined
                  }
                />
                {showBistroHint && (
                  <p className="pointer-events-none absolute right-0 top-full whitespace-nowrap text-[10px] leading-none tabular-nums text-muted-foreground">
                    Bistro: {ventasBistro}
                    {manualDiff !== 0 && (
                      <span className={manualDiff > 0 ? ' text-blue-700' : ' text-red-600'}>
                        {' '}{manualDiff > 0 ? '+' : ''}{manualDiff} a mano
                      </span>
                    )}
                  </p>
                )}
              </div>
            </td>
          )
        },
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
