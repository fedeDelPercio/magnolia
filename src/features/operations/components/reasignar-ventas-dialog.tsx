'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { reasignarVentas } from '../actions'
import type { MovimientoConProducto } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  diaId: string
  movimientos: MovimientoConProducto[]
}

// Lo más común es corregir algo cobrado como "Genérico": si ese día tiene
// ventas, arranca preseleccionado como origen.
function esGenerico(m: MovimientoConProducto): boolean {
  return /^gen[eé]rico$/i.test(m.productos.name.trim())
}

// Se monta recién al abrirse (ver dia-client), así cada apertura arranca con
// el estado limpio sin necesidad de resetearlo en un efecto.
export function ReasignarVentasDialog({ open, onOpenChange, diaId, movimientos }: Props) {
  const conVentas = useMemo(
    () =>
      movimientos
        .filter((m) => (Number(m.ventas) || 0) > 0)
        .sort((a, b) => a.productos.name.localeCompare(b.productos.name, 'es')),
    [movimientos],
  )
  const todos = useMemo(
    () => [...movimientos].sort((a, b) => a.productos.name.localeCompare(b.productos.name, 'es')),
    [movimientos],
  )

  const [desdeId, setDesdeId] = useState(() => conVentas.find(esGenerico)?.id ?? '')
  const [haciaId, setHaciaId] = useState('')
  const [cantidadStr, setCantidadStr] = useState('')
  const [saving, setSaving] = useState(false)

  const desde = movimientos.find((m) => m.id === desdeId)
  const hacia = movimientos.find((m) => m.id === haciaId)
  const maxCantidad = Number(desde?.ventas) || 0
  const cantidad = parseInt(cantidadStr, 10)
  const cantidadValida = Number.isInteger(cantidad) && cantidad > 0 && cantidad <= maxCantidad

  const desdeOptions = conVentas.map((m) => ({
    value: m.id,
    label: `${m.productos.name} (${Number(m.ventas) || 0} vendid${Number(m.ventas) === 1 ? 'o' : 'os'})`,
  }))
  const haciaOptions = todos
    .filter((m) => m.id !== desdeId)
    .map((m) => ({ value: m.id, label: m.productos.name }))

  async function handleSubmit() {
    if (!desde || !hacia || !cantidadValida) return
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
    toast.success(
      `${cantidad} venta${cantidad === 1 ? '' : 's'} pasada${cantidad === 1 ? '' : 's'} de ${desde.productos.name} a ${hacia.productos.name}`,
    )
    // Recarga dura: las filas de la grilla inicializan su estado desde los
    // props y no se re-sincronizan con un router.refresh().
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reasignar ventas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Para cuando en el POS se cobró un producto como otro (por ejemplo, como Genérico). Las
            unidades se restan de uno y se suman al otro, y el stock de los dos se recalcula. El
            cambio se mantiene aunque Bistrosoft vuelva a sincronizar el día.
          </p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Se cargó como</label>
            {desdeOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este día no tiene ventas cargadas.</p>
            ) : (
              <SearchableSelect
                options={desdeOptions}
                value={desdeId}
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
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              max={maxCantidad || undefined}
              value={cantidadStr}
              onChange={(e) => setCantidadStr(e.target.value)}
              placeholder="0"
              disabled={!desde}
            />
            {desde && (
              <p className="text-xs text-muted-foreground">
                Máximo {maxCantidad} (lo vendido como {desde.productos.name} ese día).
              </p>
            )}
            {cantidadStr !== '' && !cantidadValida && desde && (
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
            disabled={saving || !desde || !hacia || !cantidadValida}
          >
            {saving ? 'Guardando...' : 'Reasignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
