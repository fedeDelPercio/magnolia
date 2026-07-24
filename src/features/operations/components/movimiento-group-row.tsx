'use client'

import { useState, useRef, memo } from 'react'
import { saveMovimiento } from '../actions'
import type { MovimientoConProducto } from '../queries'

// Fila unificada: agrupa las variantes de canal (Mostrador + Barra) de un mismo
// producto en una sola linea. La produccion y los ajustes (stock, desperdicio,
// almuerzo, conteo) se cargan UNA vez y se guardan en la variante base
// (Mostrador); las secundarias quedan en 0 para no duplicar el descuento de
// ingredientes. Las ventas se muestran SUMADAS y son de solo lectura: vienen de
// Bistrosoft por canal y se mantienen separadas por debajo para que los
// descartables de cada canal (barra/salon) se descuenten bien.

type Props = {
  primary: MovimientoConProducto
  secondaries: MovimientoConProducto[]
  name: string
  readonly: boolean
}

type LocalState = {
  stock_anterior: number
  produccion: number
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

function canalLabel(mov: MovimientoConProducto): string {
  return mov.productos.canal === 'delivery' ? 'Barra' : 'Mostrador'
}

export const MovimientoGroupRow = memo(function MovimientoGroupRow({
  primary,
  secondaries,
  name,
  readonly,
}: Props) {
  const all = [primary, ...secondaries]
  const sum = (f: keyof MovimientoConProducto) =>
    all.reduce((s, m) => s + (Number(m[f]) || 0), 0)

  // Estado inicial: sumamos entre variantes para absorber datos viejos que
  // hayan quedado cargados en la variante Barra. Al primer guardado se
  // consolidan en la primaria y las secundarias se ceran.
  const [local, setLocal] = useState<LocalState>({
    stock_anterior: sum('stock_anterior'),
    produccion: sum('produccion'),
    desperdicio: sum('desperdicio'),
    almuerzo: sum('almuerzo'),
    conteo_fisico: all.reduce((s, m) => s + (m.conteo_fisico ?? 0), 0),
  })
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Las secundarias solo se ceran una vez (idempotente igual, pero evita
  // reescrituras en cada tecla).
  const consolidatedRef = useRef(false)

  // Ventas: suma de todos los canales, solo lectura.
  const ventasSum = all.reduce((s, m) => s + (m.ventas || 0), 0)
  const ventasBreakdown = all
    .map((m) => `${canalLabel(m)}: ${m.ventas || 0}`)
    .join(' · ')

  const stockTeorico =
    local.stock_anterior + local.produccion - ventasSum - local.desperdicio - local.almuerzo
  const diferencia = local.conteo_fisico - stockTeorico

  function schedulesSave(updated: LocalState) {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSaving(true)
      // Primaria: lleva todos los ajustes + sus propias ventas (canal base).
      await saveMovimiento(primary.id, {
        stock_anterior: updated.stock_anterior,
        produccion: updated.produccion,
        ventas: primary.ventas,
        desperdicio: updated.desperdicio,
        almuerzo: updated.almuerzo,
        conteo_fisico: updated.conteo_fisico,
      })
      // Secundarias (Barra): ceramos los campos de stock/produccion pero
      // preservamos sus ventas (dato de Bistrosoft del canal).
      if (!consolidatedRef.current) {
        for (const sec of secondaries) {
          const needsReset =
            sec.stock_anterior !== 0 ||
            sec.produccion !== 0 ||
            sec.desperdicio !== 0 ||
            sec.almuerzo !== 0 ||
            (sec.conteo_fisico ?? 0) !== 0
          if (needsReset) {
            await saveMovimiento(sec.id, {
              stock_anterior: 0,
              produccion: 0,
              ventas: sec.ventas,
              desperdicio: 0,
              almuerzo: 0,
              conteo_fisico: 0,
            })
          }
        }
        consolidatedRef.current = true
      }
      setSaving(false)
    }, 700)
  }

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
        {name}
        <span
          className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
          title="Este producto agrupa las variantes Mostrador y Barra en una sola producción."
        >
          barra+salón
        </span>
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
      {(['produccion'] as const).map((field) => (
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
      ))}
      {/* Ventas: suma de canales, solo lectura (viene de Bistrosoft por canal).
          Se muestra como input deshabilitado para que el recuadro quede igual
          que el resto de las columnas. */}
      <td className="px-2 py-2 text-right">
        <input
          type="text"
          inputMode="numeric"
          disabled
          readOnly
          className={inputCls}
          value={ventasSum}
          title={`Ventas por canal (viene de Bistrosoft) — ${ventasBreakdown}`}
        />
      </td>
      {(['desperdicio', 'almuerzo', 'conteo_fisico'] as const).map((field) => (
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
      ))}
      <td className="px-2 py-2 text-right tabular-nums text-sm">{Math.round(stockTeorico)}</td>
      <td className="px-2 py-2 text-right text-sm">
        <DiferenciaCell diferencia={diferencia} />
      </td>
    </tr>
  )
})
