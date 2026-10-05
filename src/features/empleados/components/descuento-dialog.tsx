'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/format'

import { createDescuento } from '../actions'
import { descuentoSchema } from '../schemas'
import type { ProductoConCosto } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleadoId: string
  empleadoName: string
  plusMensual: number
  pendienteActual: number
  productos: ProductoConCosto[]
}

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SIN_PRODUCTO = ''

// Se monta recién al abrirse (ver empleado-detail): cada apertura arranca limpia.
export function DescuentoDialog({
  open,
  onOpenChange,
  empleadoId,
  empleadoName,
  plusMensual,
  pendienteActual,
  productos,
}: Props) {
  const [fecha, setFecha] = useState(hoyLocal)
  const [motivo, setMotivo] = useState('')
  const [productoId, setProductoId] = useState(SIN_PRODUCTO)
  const [cantidadStr, setCantidadStr] = useState('')
  const [montoStr, setMontoStr] = useState('')
  // Si la persona tocó el monto a mano, dejamos de sugerirlo.
  const [montoManual, setMontoManual] = useState(false)
  const [saving, setSaving] = useState(false)

  const producto = productos.find((p) => p.id === productoId)
  const cantidad = parseFloat(cantidadStr)
  const sugerido =
    producto && producto.costo > 0 && cantidad > 0
      ? Math.round(producto.costo * cantidad * 100) / 100
      : null

  function sugerir(nextProductoId: string, nextCantidadStr: string) {
    if (montoManual) return
    const p = productos.find((x) => x.id === nextProductoId)
    const c = parseFloat(nextCantidadStr)
    if (p && p.costo > 0 && c > 0) setMontoStr(String(Math.round(p.costo * c * 100) / 100))
  }

  const monto = parseFloat(montoStr)
  const pendienteNuevo = pendienteActual + (monto > 0 ? monto : 0)
  const plusEstimado = Math.max(0, plusMensual - pendienteNuevo)

  async function handleSubmit() {
    const parsed = descuentoSchema.safeParse({
      fecha,
      motivo,
      producto_id: productoId || null,
      cantidad: productoId && cantidad > 0 ? cantidad : null,
      monto: monto > 0 ? monto : 0,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Revisá los datos')
      return
    }
    setSaving(true)
    const result = await createDescuento(empleadoId, parsed.data)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Descuento registrado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descuento del plus — {empleadoName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Para desperdicio u otro faltante que es responsabilidad de {empleadoName}. Se resta del
            próximo plus mensual que se le pague.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="descuento-fecha" className="text-sm font-medium">Fecha</label>
              <Input id="descuento-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Monto</label>
              <CurrencyInput
                value={montoStr}
                onValueChange={(v) => {
                  setMontoStr(v)
                  setMontoManual(true)
                }}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="descuento-motivo" className="text-sm font-medium">¿Qué pasó?</label>
            <Input
              id="descuento-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se quemó una bandeja de medialunas"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Producto (opcional)</label>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <SearchableSelect
                options={[
                  { value: SIN_PRODUCTO, label: 'Sin producto' },
                  ...productos.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={productoId}
                onValueChange={(v) => {
                  const next = v ?? SIN_PRODUCTO
                  setProductoId(next)
                  sugerir(next, cantidadStr)
                }}
                placeholder="Elegí el producto…"
              />
              <Input
                aria-label="Cantidad"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={cantidadStr}
                disabled={!producto}
                onChange={(e) => {
                  setCantidadStr(e.target.value)
                  sugerir(productoId, e.target.value)
                }}
                placeholder="Cant."
              />
            </div>
            {producto && (
              <p className="text-xs text-muted-foreground">
                {producto.costo > 0
                  ? <>Costo por unidad {formatCurrency(producto.costo)}{sugerido !== null && <> · sugerido {formatCurrency(sugerido)}</>}</>
                  : 'Este producto no tiene costo cargado: poné el monto a mano.'}
                {montoManual && sugerido !== null && Math.abs(sugerido - (monto || 0)) > 0.009 && (
                  <button
                    type="button"
                    className="ml-1 cursor-pointer text-blue-700 underline-offset-2 hover:underline"
                    onClick={() => {
                      setMontoStr(String(sugerido))
                      setMontoManual(false)
                    }}
                  >
                    usar sugerido
                  </button>
                )}
              </p>
            )}
          </div>

          {plusMensual > 0 ? (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">
              Plus mensual {formatCurrency(plusMensual)} · descuentos pendientes con este{' '}
              {formatCurrency(pendienteNuevo)} · próximo plus{' '}
              <span className="font-medium text-foreground">{formatCurrency(plusEstimado)}</span>
              {pendienteNuevo > plusMensual && ' (lo que sobra pasa al mes siguiente)'}
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              {empleadoName} no tiene plus mensual cargado: el descuento queda pendiente hasta que se
              le pague un plus.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !motivo.trim() || !(monto > 0)}>
            {saving ? 'Guardando...' : 'Registrar descuento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
