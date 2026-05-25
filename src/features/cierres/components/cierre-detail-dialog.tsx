'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangleIcon, ChevronDownIcon, Loader2Icon, TrashIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import {
  updateCierreProductoMapping,
  createProductoForAlias,
  deleteCierreCaja,
} from '../actions'
import type { CierreCajaWithProductos, ProductoBasico } from '../queries'
import { ProductosList, type MappingEntry, type ProductoLine } from './productos-list'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cierre: CierreCajaWithProductos
  productos: ProductoBasico[]
  taxRate?: number
}

export function CierreDetailDialog({ open, onOpenChange, cierre, productos: productosInit, taxRate = 0 }: Props) {
  const router = useRouter()
  const [productos, setProductos] = useState<ProductoBasico[]>(productosInit)
  const [deleting, setDeleting] = useState(false)
  const [savingMap, setSavingMap] = useState<Set<string>>(new Set())
  const [digitalExpanded, setDigitalExpanded] = useState(false)

  const lines: ProductoLine[] = cierre.cierre_caja_productos.map((p) => ({
    key: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    cantidad: Number(p.cantidad),
    monto_total: Number(p.monto_total),
  }))

  const mappings: Record<string, MappingEntry> = {}
  for (const p of cierre.cierre_caja_productos) {
    mappings[p.id] = {
      producto_id: p.producto_id,
      match_type: p.producto_id ? 'alias' : null,
      is_manual: false,
    }
  }

  const unmapped = lines.filter((l) => !mappings[l.key]?.producto_id)
  const mappedCount = lines.length - unmapped.length

  const mediosDigitales = cierre.monto_tarjetas + cierre.monto_qr + cierre.monto_online
  const impuestos = taxRate > 0 ? mediosDigitales * (taxRate / 100) : 0
  const netoDigital = mediosDigitales - impuestos

  async function handleMap(cpId: string, producto_id: string | null) {
    setSavingMap((prev) => new Set(prev).add(cpId))
    const result = await updateCierreProductoMapping(cpId, producto_id, true)
    setSavingMap((prev) => {
      const next = new Set(prev)
      next.delete(cpId)
      return next
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(producto_id ? 'Producto mapeado y ventas actualizadas' : 'Mapeo removido')
    router.refresh()
  }

  async function handleCreate(cpId: string, nombre: string, sale_price: number) {
    setSavingMap((prev) => new Set(prev).add(cpId))
    const result = await createProductoForAlias(nombre, sale_price, nombre)
    if (result.error || !result.id) {
      setSavingMap((prev) => {
        const next = new Set(prev)
        next.delete(cpId)
        return next
      })
      toast.error(result.error ?? 'No se pudo crear el producto')
      return
    }
    setProductos((prev) => [...prev, { id: result.id!, name: result.name! }])
    const mapResult = await updateCierreProductoMapping(cpId, result.id, false)
    setSavingMap((prev) => {
      const next = new Set(prev)
      next.delete(cpId)
      return next
    })
    if (mapResult.error) {
      toast.error(mapResult.error)
      return
    }
    toast.success(`Producto "${result.name}" creado y vinculado`)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este cierre? Las ventas autocompletadas se van a revertir.')) return
    setDeleting(true)
    const result = await deleteCierreCaja(cierre.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Cierre eliminado')
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cierre del {formatFechaArg(cierre.fecha_cierre)} — {cierre.operador ?? 'Sin operador'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats principales */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-3 divide-x border-b">
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total vendido</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(cierre.total_vendido)}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket promedio</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">{formatCurrency(cierre.ticket_promedio)}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cant. ventas</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{cierre.cantidad_ventas}</p>
              </div>
            </div>

            {/* Medios de pago */}
            <div className="px-5 py-3 border-b">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Por medio de pago
              </p>
              <div className="space-y-1 text-sm">
                {/* Efectivo */}
                <PagoRow label="Efectivo" value={cierre.monto_efectivo} />

                {/* Medios digitales — cabecera clickeable */}
                <div>
                  <button
                    type="button"
                    onClick={() => setDigitalExpanded((v) => !v)}
                    className="flex w-full justify-between items-center py-0.5 hover:text-foreground transition-colors text-left"
                  >
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ChevronDownIcon
                        className={`size-3.5 transition-transform ${digitalExpanded ? 'rotate-180' : ''}`}
                      />
                      Medios digitales
                    </span>
                    <span className="tabular-nums">{formatCurrency(mediosDigitales)}</span>
                  </button>

                  {/* Desglose individual */}
                  {digitalExpanded && (
                    <div className="pl-5 mt-0.5 space-y-0.5 text-xs text-muted-foreground border-l ml-1.5">
                      {cierre.monto_tarjetas > 0 && (
                        <PagoRow label="Tarjetas" value={cierre.monto_tarjetas} />
                      )}
                      {cierre.monto_qr > 0 && (
                        <PagoRow label="QR" value={cierre.monto_qr} />
                      )}
                      {cierre.monto_online > 0 && (
                        <PagoRow label="Online" value={cierre.monto_online} />
                      )}
                    </div>
                  )}

                  {/* Deducción de impuestos */}
                  {taxRate > 0 && mediosDigitales > 0 && (
                    <div className="pl-5 mt-1 space-y-0.5 text-xs border-l ml-1.5 border-dashed">
                      <div className="flex justify-between text-red-600">
                        <span>− Imp. digitales ({taxRate}%)</span>
                        <span className="tabular-nums">− {formatCurrency(impuestos)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-foreground pt-0.5 border-t">
                        <span>Neto digital</span>
                        <span className="tabular-nums">{formatCurrency(netoDigital)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Banner no-mapeados */}
          {unmapped.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {unmapped.length} producto{unmapped.length !== 1 ? 's' : ''} sin mapear
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Mapealos o creá productos para que sus ventas se sumen a Operación Diaria.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Productos · {mappedCount} de {lines.length} mapeados
            </p>
            {savingMap.size > 0 && (
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Loader2Icon className="size-3 animate-spin" />
                Actualizando mapeo...
              </p>
            )}
            <ProductosList
              productos={lines}
              mappings={mappings}
              productosOptions={productos}
              onMap={handleMap}
              onCreate={handleCreate}
            />
          </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            Eliminar cierre
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PagoRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}

function formatFechaArg(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
