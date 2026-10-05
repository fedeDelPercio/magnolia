'use client'

import { useState, useRef, memo } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveMovimiento } from '../actions'
import { filaDeProduccion, varianteLabel } from '../grupos'
import type { MovimientoConProducto } from '../queries'

// Fila unificada: agrupa las variantes (salón, barra, menú) de un mismo
// producto en una sola linea. Tocando el nombre se despliega por dónde se
// vendió (una sub-fila por variante, solo lectura). La produccion y los ajustes (stock, desperdicio,
// almuerzo, conteo) se cargan UNA vez y se guardan en la variante base
// (Mostrador); las secundarias quedan en 0 para no duplicar el descuento de
// ingredientes. Las ventas se muestran SUMADAS y son EDITABLES: la parte de
// Bistrosoft viene por canal (y se mantiene separada por debajo para que los
// descartables de cada canal se descuenten bien); si la dueña vende por fuera
// del POS puede subir el total — la diferencia se guarda en la variante base y
// el sync la conserva en cada corrida.
//
// La PRODUCCIÓN es la excepción: se guarda en la variante que tiene la receta
// cargada, porque los ingredientes se descuentan según la receta del producto
// de esa fila. Casi siempre es la base; en los platos del día (que solo existen
// como menú) la receta está en la variante Menú y la base está vacía — si la
// producción fuera a la base no descontaría ningún insumo.

type Props = {
  primary: MovimientoConProducto
  secondaries: MovimientoConProducto[]
  name: string
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

function DiferenciaCell({ diferencia }: { diferencia: number }) {
  const rounded = Math.round(diferencia)
  if (rounded === 0) return <span className="tabular-nums text-green-700">0</span>
  if (rounded > 0) return <span className="tabular-nums text-blue-700">+{rounded}</span>
  return <span className="tabular-nums text-red-600">{rounded}</span>
}

export const MovimientoGroupRow = memo(function MovimientoGroupRow({
  primary,
  secondaries,
  name,
  readonly,
  hidden = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const all = [primary, ...secondaries]
  const sum = (f: keyof MovimientoConProducto) =>
    all.reduce((s, m) => s + (Number(m[f]) || 0), 0)

  // Estado inicial: sumamos entre variantes para absorber datos viejos que
  // hayan quedado cargados en la variante Barra. Al primer guardado se
  // consolidan en la primaria y las secundarias se ceran.
  const [local, setLocal] = useState<LocalState>({
    stock_anterior: sum('stock_anterior'),
    produccion: sum('produccion'),
    ventas: sum('ventas'),
    desperdicio: sum('desperdicio'),
    almuerzo: sum('almuerzo'),
    conteo_fisico: all.every((m) => m.conteo_fisico === null)
      ? null
      : all.reduce((s, m) => s + (m.conteo_fisico ?? 0), 0),
  })
  // Solo se guardan los campos que la persona tocó (ver movimiento-row): así
  // una pestaña vieja no pisa ventas reasignadas ni graba un conteo vacío como 0.
  const dirtyRef = useRef<Set<Campo>>(new Set())
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Las secundarias solo se ceran una vez (idempotente igual, pero evita
  // reescrituras en cada tecla).
  const consolidatedRef = useRef(false)
  // El stock del grupo se carga en la primaria; si el usuario lo edita queda
  // "manual" y el arrastre automático deja de pisarlo.
  const stockManualRef = useRef(primary.stock_anterior_manual)

  const filaProduccion = filaDeProduccion(primary, secondaries)

  // Parte Bistro de las ventas, por canal. El total editado se reparte:
  // las secundarias conservan sus ventas (dato de Bistro del canal) y la
  // diferencia va a la variante base.
  const ventasBistroSum = all.reduce((s, m) => s + (Number(m.ventas_bistro) || 0), 0)
  const ventasSecundarias = secondaries.reduce((s, m) => s + (m.ventas || 0), 0)
  const ventasBreakdown = all
    .map((m) => `${varianteLabel(m.productos)}: ${Number(m.ventas_bistro) || 0}`)
    .join(' · ')
  const ventasManualDiff = local.ventas - ventasBistroSum

  const stockTeorico =
    local.stock_anterior + local.produccion - local.ventas - local.desperdicio - local.almuerzo
  const diferencia = (local.conteo_fisico ?? 0) - stockTeorico

  function schedulesSave(updated: LocalState) {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      // Datos viejos cargados en una variante secundaria: la primera vez que se
      // guarda el grupo se pasan a la primaria (stock, desperdicio, almuerzo,
      // conteo, producción) y la secundaria queda en 0 / sin contar. Las ventas
      // de las secundarias no se tocan nunca: son el dato de Bistro del canal.
      const aConsolidar = consolidatedRef.current
        ? []
        : secondaries.filter((sec) => {
            const esFilaProduccion = sec.id === filaProduccion.id
            return (
              sec.stock_anterior !== 0 ||
              (!esFilaProduccion && sec.produccion !== 0) ||
              sec.desperdicio !== 0 ||
              sec.almuerzo !== 0 ||
              sec.conteo_fisico !== null
            )
          })
      const campos = new Set<Campo>(dirtyRef.current)
      if (aConsolidar.length > 0) {
        for (const c of ['stock_anterior', 'produccion', 'desperdicio', 'almuerzo', 'conteo_fisico'] as const) {
          campos.add(c)
        }
      }
      if (campos.size === 0) return

      setSaving(true)
      // Primaria: lleva los ajustes + sus ventas = total editado menos lo que
      // quedó en las secundarias (así el grupo suma exactamente el total).
      const payload: Parameters<typeof saveMovimiento>[1] = {}
      if (campos.has('stock_anterior')) {
        payload.stock_anterior = updated.stock_anterior
        payload.stock_anterior_manual = stockManualRef.current
      }
      if (campos.has('produccion')) {
        payload.produccion = filaProduccion.id === primary.id ? updated.produccion : 0
      }
      if (campos.has('ventas')) payload.ventas = Math.max(0, updated.ventas - ventasSecundarias)
      if (campos.has('desperdicio')) payload.desperdicio = updated.desperdicio
      if (campos.has('almuerzo')) payload.almuerzo = updated.almuerzo
      if (campos.has('conteo_fisico')) payload.conteo_fisico = updated.conteo_fisico
      await saveMovimiento(primary.id, payload)
      if (campos.has('produccion') && filaProduccion.id !== primary.id) {
        await saveMovimiento(filaProduccion.id, { produccion: updated.produccion })
      }
      for (const sec of aConsolidar) {
        const esFilaProduccion = sec.id === filaProduccion.id
        await saveMovimiento(sec.id, {
          stock_anterior: 0,
          ...(esFilaProduccion ? {} : { produccion: 0 }),
          desperdicio: 0,
          almuerzo: 0,
          conteo_fisico: null,
        })
      }
      consolidatedRef.current = true
      setSaving(false)
    }, 700)
  }

  function handleChange(field: Campo, raw: string) {
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

  // Apertura de ventas por variante. La base se lleva lo editado a mano, así
  // que sus ventas son el total menos lo que vendieron las demás.
  const apertura = all.map((m) => ({
    id: m.id,
    label: varianteLabel(m.productos),
    ventas: m.id === primary.id ? Math.max(0, local.ventas - ventasSecundarias) : m.ventas || 0,
    bistro: Number(m.ventas_bistro) || 0,
  }))
  const variantesLabel = apertura.map((a) => a.label.toLowerCase()).join(' · ')

  return (
    <>
    <tr hidden={hidden} className={saving ? 'opacity-70' : ''}>
      <td className="py-2 pl-4 pr-2 font-medium text-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group/nombre -ml-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 text-left hover:bg-muted"
          title={`Agrupa ${variantesLabel} en una sola producción. Tocá para ver por dónde se vendió.`}
        >
          <ChevronRightIcon
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
          {name}
          <span className="ml-0.5 whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground group-hover/nombre:bg-background">
            {variantesLabel}
          </span>
        </button>
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
      {/* Ventas: total del grupo, EDITABLE. La parte Bistro por canal se
          muestra abajo (absoluta, para no desalinear la celda); la diferencia
          manual (ventas por fuera del POS) se guarda en la variante base y
          sobrevive a los re-sync. */}
      <td className="px-2 py-2 text-right">
        <div className="relative inline-block">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            disabled={readonly}
            className={inputCls}
            value={numInput(local.ventas)}
            placeholder="0"
            onChange={(e) => handleChange('ventas', e.target.value)}
            title={`Bistro por canal — ${ventasBreakdown}. Si vendés por fuera del POS, editá el total: la diferencia se conserva aunque se re-sincronice.`}
          />
          {ventasBistroSum > 0 && (
            <p className="pointer-events-none absolute right-0 top-full whitespace-nowrap text-[10px] leading-none tabular-nums text-muted-foreground">
              Bistro: {ventasBistroSum}
              {ventasManualDiff !== 0 && (
                <span className={ventasManualDiff > 0 ? ' text-blue-700' : ' text-red-600'}>
                  {' '}{ventasManualDiff > 0 ? '+' : ''}{ventasManualDiff} a mano
                </span>
              )}
            </p>
          )}
        </div>
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
            value={
              field === 'conteo_fisico'
                ? local.conteo_fisico === null ? '' : String(local.conteo_fisico)
                : numInput(local[field])
            }
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
    {open &&
      apertura.map((a) => (
        <tr key={a.id} hidden={hidden} className="bg-muted/30 text-xs text-muted-foreground">
          <td className="py-1.5 pl-10 pr-2">{a.label}</td>
          <td colSpan={2} />
          <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
            {a.ventas !== a.bistro && (
              <span
                className="mr-1 text-[10px] text-muted-foreground"
                title="Lo que registró Bistrosoft para esta variante. La diferencia se cargó a mano."
              >
                (Bistro {a.bistro})
              </span>
            )}
            {/* Mismo ancho que el input de arriba, para que el número caiga debajo. */}
            <span className="inline-block w-16 text-center">{a.ventas}</span>
          </td>
          <td colSpan={5} />
        </tr>
      ))}
    </>
  )
})
