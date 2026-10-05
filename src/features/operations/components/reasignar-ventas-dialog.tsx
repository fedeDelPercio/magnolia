'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownIcon, Loader2Icon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { getVentasDelDia, reasignarVentas } from '../actions'
import { guardarAvisoPendiente } from '../aviso-pendiente'
import type { MovimientoConProducto } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  diaId: string
  movimientos: MovimientoConProducto[]
}

// Lo más común es corregir algo cobrado como "Genérico": si ese día tiene
// ventas, arranca preseleccionado como origen.
function esGenerico(name: string): boolean {
  return /^gen[eé]rico$/i.test(name.trim())
}

// Solo enteros positivos escritos tal cual ("3"), sin decimales ni notación
// científica: "1.5" o "1e1" no se aceptan en vez de truncarse en silencio.
function parseCantidad(raw: string): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

type Fila = { id: string; name: string; ventas: number }

// Se monta recién al abrirse (ver dia-client), así cada apertura arranca con
// el estado limpio. Las ventas se leen de nuevo de la base al abrir: la grilla
// pudo haberlas corregido desde que se cargó la página.
export function ReasignarVentasDialog({ open, onOpenChange, diaId, movimientos }: Props) {
  const [ventasFrescas, setVentasFrescas] = useState<Map<string, number> | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [desdeId, setDesdeId] = useState<string | null>(null)
  const [haciaId, setHaciaId] = useState('')
  const [cantidadStr, setCantidadStr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelado = false
    getVentasDelDia(diaId).then((r) => {
      if (cancelado) return
      if (r.error || !r.data) {
        setErrorCarga(r.error ?? 'No se pudieron leer las ventas del día')
        return
      }
      setVentasFrescas(new Map(r.data.map((m) => [m.id, m.ventas])))
    })
    return () => {
      cancelado = true
    }
  }, [diaId])

  const filas: Fila[] = useMemo(
    () =>
      movimientos
        .map((m) => ({
          id: m.id,
          name: m.productos.name,
          ventas: ventasFrescas?.get(m.id) ?? (Number(m.ventas) || 0),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [movimientos, ventasFrescas],
  )
  const conVentas = filas.filter((f) => f.ventas > 0)

  // Origen elegido, o Genérico por defecto si vendió algo ese día.
  const desdeEfectivo = desdeId ?? conVentas.find((f) => esGenerico(f.name))?.id ?? ''
  const desde = filas.find((f) => f.id === desdeEfectivo)
  const hacia = filas.find((f) => f.id === haciaId)
  const maxCantidad = desde?.ventas ?? 0
  const cantidad = parseCantidad(cantidadStr)
  const cantidadValida = cantidad !== null && cantidad <= maxCantidad

  const desdeOptions = conVentas.map((f) => ({
    value: f.id,
    label: `${f.name} (${f.ventas} vendid${f.ventas === 1 ? 'o' : 'os'})`,
  }))
  const haciaOptions = filas
    .filter((f) => f.id !== desdeEfectivo)
    .map((f) => ({ value: f.id, label: f.name }))

  async function handleSubmit() {
    if (!desde || !hacia || !cantidadValida || cantidad === null) return
    setSaving(true)
    const result = await reasignarVentas({
      diaId,
      desdeMovId: desde.id,
      haciaMovId: hacia.id,
      cantidad,
    })
    if (result.error) {
      setSaving(false)
      toast.error(result.error)
      return
    }
    // Recarga dura: las filas de la grilla inicializan su estado desde los
    // props y no se re-sincronizan con un router.refresh(). El aviso se
    // muestra después de recargar.
    guardarAvisoPendiente(
      `${cantidad} venta${cantidad === 1 ? '' : 's'} pasada${cantidad === 1 ? '' : 's'} de ${desde.name} a ${hacia.name}`,
    )
    window.location.reload()
  }

  const cargando = ventasFrescas === null && !errorCarga

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reasignar ventas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Para cuando en el POS se cobró un producto como otro (por ejemplo, como Genérico). Las
            unidades se restan de uno y se suman al otro, y el stock de los dos se recalcula. Corrige
            Operación y el stock; los reportes de ventas en pesos siguen mostrando lo que cobró
            Bistrosoft.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Si el ticket también se corrige en Bistrosoft, no lo reasignes acá: se contaría dos veces.
          </p>

          {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

          <div className="space-y-1">
            <label className="text-sm font-medium">Se cargó como</label>
            {cargando ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" /> Leyendo las ventas del día…
              </p>
            ) : desdeOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este día no tiene ventas cargadas.</p>
            ) : (
              <SearchableSelect
                options={desdeOptions}
                value={desdeEfectivo}
                onValueChange={(v) => {
                  setDesdeId(v ?? '')
                  if (v === haciaId) setHaciaId('')
                }}
                placeholder="Elegí el producto…"
              />
            )}
          </div>

          <div className="flex justify-center text-muted-foreground">
            <ArrowDownIcon className="size-4" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">En realidad era</label>
            <SearchableSelect
              options={haciaOptions}
              value={haciaId}
              onValueChange={(v) => setHaciaId(v ?? '')}
              placeholder="Elegí el producto…"
              disabled={!desde}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reasignar-cantidad" className="text-sm font-medium">
              Cantidad
            </label>
            <Input
              id="reasignar-cantidad"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cantidadStr}
              onChange={(e) => setCantidadStr(e.target.value)}
              placeholder="0"
              disabled={!desde}
            />
            {desde && (
              <p className="text-xs text-muted-foreground">
                Máximo {maxCantidad} (lo vendido como {desde.name} ese día).
              </p>
            )}
            {cantidadStr.trim() !== '' && !cantidadValida && desde && (
              <p className="text-xs text-red-600">
                Tiene que ser un número entero entre 1 y {maxCantidad}.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || cargando || !desde || !hacia || !cantidadValida}
          >
            {saving ? 'Guardando...' : 'Reasignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
