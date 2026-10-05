'use client'

import { useRef, memo } from 'react'
import { saveMovimiento } from '../actions'
import { useGuardadoFila, type ResultadoEnvio } from '../use-guardado-fila'
import { CantidadInput } from './cantidad-input'
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

const formatoCantidad = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

// Sin conteo no hay diferencia que mostrar (al cerrar el día también queda vacía).
function DiferenciaCell({ diferencia }: { diferencia: number | null }) {
  if (diferencia === null) return <span className="text-muted-foreground">—</span>
  const rounded = Math.round(diferencia * 100) / 100
  if (rounded === 0) return <span className="tabular-nums text-green-700">0</span>
  if (rounded > 0) return <span className="tabular-nums text-blue-700">+{formatoCantidad(rounded)}</span>
  return <span className="tabular-nums text-red-600">{formatoCantidad(rounded)}</span>
}

export const MovimientoRow = memo(function MovimientoRow({ mov, readonly, hidden = false }: Props) {
  // Una vez que el usuario edita el stock anterior, queda "manual" para este día
  // y el arrastre automático deja de pisarlo.
  const stockManualRef = useRef(mov.stock_anterior_manual)

  async function enviar(s: LocalState, campos: ReadonlySet<keyof LocalState>): Promise<ResultadoEnvio> {
    const payload: Parameters<typeof saveMovimiento>[1] = {}
    if (campos.has('stock_anterior')) {
      payload.stock_anterior = s.stock_anterior
      payload.stock_anterior_manual = stockManualRef.current
    }
    if (campos.has('produccion')) payload.produccion = s.produccion
    if (campos.has('ventas')) payload.ventas = s.ventas
    if (campos.has('desperdicio')) payload.desperdicio = s.desperdicio
    if (campos.has('almuerzo')) payload.almuerzo = s.almuerzo
    if (campos.has('conteo_fisico')) payload.conteo_fisico = s.conteo_fisico
    return saveMovimiento(mov.id, payload)
  }

  const { local, cambiar, saving, sinGuardar } = useGuardadoFila<LocalState>({
    filaId: mov.id,
    diaId: mov.dia_id,
    nombre: mov.productos.name,
    inicial: {
      stock_anterior: Number(mov.stock_anterior) || 0,
      produccion: Number(mov.produccion) || 0,
      ventas: Number(mov.ventas) || 0,
      desperdicio: Number(mov.desperdicio) || 0,
      almuerzo: Number(mov.almuerzo) || 0,
      conteo_fisico: mov.conteo_fisico === null ? null : Number(mov.conteo_fisico),
    },
    enviar,
  })

  const stockTeorico =
    local.stock_anterior + local.produccion - local.ventas - local.desperdicio - local.almuerzo
  const diferencia = local.conteo_fisico === null ? null : local.conteo_fisico - stockTeorico

  function setCampo(field: keyof LocalState, value: number | null) {
    if (field === 'stock_anterior') stockManualRef.current = true
    if (field === 'conteo_fisico') cambiar('conteo_fisico', value)
    else cambiar(field, value ?? 0)
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
        <CantidadInput
          disabled={readonly}
          className={inputCls}
          value={local.stock_anterior}
          placeholder="0"
          onValueChange={(v) => setCampo('stock_anterior', v)}
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
          const esConteo = field === 'conteo_fisico'
          // El hint "Bistro: N" va en posición absoluta para que la celda mida
          // igual que las demás y los inputs queden siempre centrados en altura.
          return (
            <td key={field} className="px-2 py-2 text-right">
              <div className="relative inline-block">
                <CantidadInput
                  disabled={readonly}
                  className={inputCls}
                  value={local[field]}
                  vacioEsNull={esConteo}
                  mostrarCero={esConteo}
                  // Conteo vacío = no se contó: se ve "—", distinto de un 0 contado.
                  placeholder={esConteo ? '—' : '0'}
                  onValueChange={(v) => setCampo(field, v)}
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
                        {' '}{manualDiff > 0 ? '+' : ''}{formatoCantidad(manualDiff)} a mano
                      </span>
                    )}
                  </p>
                )}
              </div>
            </td>
          )
        },
      )}
      <td className="px-2 py-2 text-right tabular-nums text-sm">{formatoCantidad(stockTeorico)}</td>
      <td className="px-2 py-2 text-right text-sm">
        <DiferenciaCell diferencia={diferencia} />
      </td>
    </tr>
  )
})
