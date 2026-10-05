'use client'

import { useState, useRef, memo } from 'react'
import { toast } from 'sonner'
import { saveMovimiento } from '../actions'
import { quitarPendiente, registrarPendiente } from '../guardados-pendientes'
import type { MovimientoConProducto } from '../queries'

type Props = {
  mov: MovimientoConProducto
  readonly: boolean
  // Oculta por el buscador. Se esconde con CSS en vez de desmontar: la fila
  // guarda su estado local (y un guardado pendiente) que se perdería.
  hidden?: boolean
}

type LocalState = {
  stock_anterior: number
  produccion: number
  ventas: number
  desperdicio: number
  almuerzo: number
  // null = no se contó (el arrastre usa el teórico); 0 = se contó y no quedó nada.
  conteo_fisico: number | null
}

type Campo = keyof LocalState

function numInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return v === 0 ? '' : String(v)
}

// Sin conteo no hay diferencia que mostrar (al cerrar el día también queda vacía).
function DiferenciaCell({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null) return <span className="text-muted-foreground">—</span>
  const rounded = Math.round(diferencia)
  if (rounded === 0) return <span className="tabular-nums text-green-700">0</span>
  if (rounded > 0) return <span className="tabular-nums text-blue-700">+{rounded}</span>
  return <span className="tabular-nums text-red-600">{rounded}</span>
}

export const MovimientoRow = memo(function MovimientoRow({ mov, readonly, hidden = false }: Props) {
  const [local, setLocal] = useState<LocalState>({
    stock_anterior: mov.stock_anterior,
    produccion: mov.produccion,
    ventas: mov.ventas,
    desperdicio: mov.desperdicio,
    almuerzo: mov.almuerzo,
    conteo_fisico: mov.conteo_fisico,
  })
  const [saving, setSaving] = useState(false)
  // Hubo un guardado que falló y todavía no se pudo reintentar.
  const [sinGuardar, setSinGuardar] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Solo se guardan los campos que la persona tocó. Si se mandara la fila
  // entera, una pestaña abierta desde antes pisaría con valores viejos lo que
  // cambió mientras tanto (una reasignación de ventas, el sync de Bistro) y un
  // conteo vacío se grabaría como 0.
  // Se vacía cuando el guardado sale bien: los campos ya guardados no se vuelven
  // a mandar con valores viejos si después se edita otra columna.
  const dirtyRef = useRef<Set<Campo>>(new Set())
  // Último estado tipeado, todavía sin guardar.
  const pendingRef = useRef<LocalState | null>(null)
  // Una vez que el usuario edita el stock anterior, queda "manual" para este día
  // y el arrastre automático deja de pisarlo.
  const stockManualRef = useRef(mov.stock_anterior_manual)

  const stockTeorico =
    local.stock_anterior + local.produccion - local.ventas - local.desperdicio - local.almuerzo

  const diferencia = local.conteo_fisico === null ? null : local.conteo_fisico - stockTeorico

  async function guardar(): Promise<boolean> {
    clearTimeout(timer.current)
    quitarPendiente(mov.id)
    const updated = pendingRef.current
    pendingRef.current = null
    if (!updated) return true
    const campos = new Set(dirtyRef.current)
    dirtyRef.current.clear()
    const payload: Parameters<typeof saveMovimiento>[1] = {}
    if (campos.has('stock_anterior')) {
      payload.stock_anterior = updated.stock_anterior
      payload.stock_anterior_manual = stockManualRef.current
    }
    if (campos.has('produccion')) payload.produccion = updated.produccion
    if (campos.has('ventas')) payload.ventas = updated.ventas
    if (campos.has('desperdicio')) payload.desperdicio = updated.desperdicio
    if (campos.has('almuerzo')) payload.almuerzo = updated.almuerzo
    if (campos.has('conteo_fisico')) payload.conteo_fisico = updated.conteo_fisico
    if (Object.keys(payload).length === 0) return true
    setSaving(true)
    let error: string | null = null
    try {
      const res = await saveMovimiento(mov.id, payload)
      if (res.error) error = res.error
    } catch {
      error = 'sin conexión'
    } finally {
      setSaving(false)
    }
    if (error) {
      // No se pierde nada: los campos y el valor vuelven a quedar pendientes
      // (si mientras tanto se tipeó algo más, se manda lo más nuevo) y el
      // cierre del día lo reintenta antes de cerrar.
      for (const c of campos) dirtyRef.current.add(c)
      if (!pendingRef.current) pendingRef.current = updated
      registrarPendiente(mov.id, mov.productos.name, guardar)
      setSinGuardar(true)
      toast.error(`No se guardó ${mov.productos.name} (${error}). Se vuelve a intentar al seguir editando o al cerrar el día.`)
      return false
    }
    setSinGuardar(false)
    return true
  }

  function schedulesSave(updated: LocalState) {
    pendingRef.current = updated
    clearTimeout(timer.current)
    registrarPendiente(mov.id, mov.productos.name, guardar)
    timer.current = setTimeout(() => void guardar(), 700)
  }

  function handleChange(field: Campo, raw: string, invalido = false) {
    // Las cantidades no pueden ser negativas: un "-" tipeado se ignora (antes
    // se guardaba como 0, que en el conteo es "contado 0"). En un input
    // numérico el "-" solo llega como valor vacío con badInput.
    if (invalido || raw.trim().startsWith('-')) return
    const parsed = raw === '' ? 0 : parseInt(raw, 10)
    const num = isNaN(parsed) ? 0 : Math.max(0, parsed)
    // Borrar el conteo lo vuelve a "no contado", no a "contado 0".
    const value = field === 'conteo_fisico' && raw.trim() === '' ? null : num
    if (field === 'stock_anterior') stockManualRef.current = true
    dirtyRef.current.add(field)
    const updated = { ...local, [field]: value }
    setLocal(updated)
    schedulesSave(updated)
  }

  const inputCls =
    'w-16 rounded border border-input bg-background px-1.5 py-1 text-right tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground'

  return (
    <tr hidden={hidden} className={saving ? 'opacity-70' : ''}>
      <td className="py-2 pl-4 pr-2 font-medium text-sm">
        {mov.productos.name}
        {saving && <span className="ml-1 text-xs text-muted-foreground">·</span>}
        {sinGuardar && !saving && (
          <span className="ml-1.5 rounded bg-red-50 px-1 py-0.5 text-[10px] font-normal text-red-700 ring-1 ring-red-200">
            sin guardar
          </span>
        )}
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
          onChange={(e) => handleChange('stock_anterior', e.target.value, e.target.validity.badInput)}
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
                  value={
                    field === 'conteo_fisico'
                      ? local.conteo_fisico === null ? '' : String(local.conteo_fisico)
                      : numInput(local[field])
                  }
                  // Conteo vacío = no se contó: se ve "—", distinto de un 0 contado.
                  placeholder={field === 'conteo_fisico' ? '—' : '0'}
                  onChange={(e) => handleChange(field, e.target.value, e.target.validity.badInput)}
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
