'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { PlusIcon, TrashIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { formatCurrency } from '@/lib/format'
import { UNIT_LABELS } from '@/features/catalog/insumos/schemas'
import { createCompra } from '../actions'
import type { Tables } from '@/types/database'

type InsumoOpt = Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>

type LineItem = {
  insumo_id: string
  insumo_name: string
  qty: number
  unit: Tables<'insumos'>['unit']
  unit_price: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedorId: string
  proveedorName: string
  paymentTermsDays: number
  insumos: InsumoOpt[]
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function CompraDialog({
  open,
  onOpenChange,
  proveedorId,
  proveedorName,
  paymentTermsDays,
  insumos,
}: Props) {
  const [fecha, setFecha] = useState(todayStr())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)

  // New item form state. `newTotal` es el monto total pagado por la cantidad
  // ingresada (no el precio por unidad). Calculamos unit_price al agregar.
  const [newInsumoId, setNewInsumoId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newTotal, setNewTotal] = useState('')

  useEffect(() => {
    if (open) {
      const today = todayStr()
      setFecha(today)
      setDueDate(paymentTermsDays > 0 ? addDays(today, paymentTermsDays) : '')
      setNotes('')
      setItems([])
      setNewInsumoId('')
      setNewQty('')
      setNewTotal('')
    }
  }, [open, paymentTermsDays])

  function handleFechaChange(val: string) {
    setFecha(val)
    if (paymentTermsDays > 0) setDueDate(addDays(val, paymentTermsDays))
  }

  function handleSelectInsumo(id: string | null) {
    if (!id) return
    setNewInsumoId(id)
    // No pre-llenamos precio porque ahora el campo es el total pagado, que
    // depende de la cantidad. La dueña sabe el total que pagó.
  }

  function buildPendingItem(): LineItem | null {
    const insumo = insumos.find((i) => i.id === newInsumoId)
    if (!insumo || !newQty || !newTotal) return null
    const qty = parseFloat(newQty)
    const total = parseFloat(newTotal)
    if (isNaN(qty) || qty <= 0 || isNaN(total) || total <= 0) return null
    return {
      insumo_id: insumo.id,
      insumo_name: insumo.name,
      qty,
      unit: insumo.unit,
      unit_price: total / qty,
    }
  }

  function addItem() {
    const item = buildPendingItem()
    if (!item) return
    setItems((prev) => [...prev, item])
    setNewInsumoId('')
    setNewQty('')
    setNewTotal('')
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((acc, i) => acc + i.qty * i.unit_price, 0)
  const pendingItem = buildPendingItem()
  const canSubmit = items.length > 0 || pendingItem !== null

  async function handleSubmit() {
    // Si quedó un ítem pendiente sin "agregar", lo incluimos automáticamente.
    const allItems = pendingItem ? [...items, pendingItem] : items
    if (allItems.length === 0) {
      toast.error('Agregá al menos un ítem')
      return
    }
    setSaving(true)
    const result = await createCompra(
      proveedorId,
      fecha,
      dueDate || null,
      notes || null,
      allItems.map((i) => ({ insumo_id: i.insumo_id, qty: i.qty, unit: i.unit, unit_price: i.unit_price })),
    )
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Compra registrada. Precios de insumos actualizados.')
      onOpenChange(false)
    }
  }

  const selectedInsumo = insumos.find((i) => i.id === newInsumoId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar compra — {proveedorName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => handleFechaChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vencimiento de pago</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Input placeholder="Ej: Factura B 0001-00012345" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Ítems</p>

            {items.length > 0 && (
              <div className="rounded-lg border divide-y text-sm">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <span className="font-medium">{item.insumo_name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {item.qty} {UNIT_LABELS[item.unit]}
                        <span className="ml-1 text-xs">({formatCurrency(item.unit_price)} / {UNIT_LABELS[item.unit]})</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{formatCurrency(item.qty * item.unit_price)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end px-3 py-2 font-medium">
                  Total: {formatCurrency(total)}
                </div>
              </div>
            )}

            {/* Add item row */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Insumo</label>
                <Select onValueChange={handleSelectInsumo} value={newInsumoId}>
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Seleccioná...">
                      {(v: string | null) => v ? (insumos.find((i) => i.id === v)?.name ?? v) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={i.id} label={i.name}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Cant. {selectedInsumo ? `(${UNIT_LABELS[selectedInsumo.unit]})` : ''}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  className="h-8 text-sm"
                  placeholder="0"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                />
              </div>
              <div className="w-28 space-y-1">
                <label className="text-xs text-muted-foreground">Precio total</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-sm"
                  placeholder="0"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={addItem}
                disabled={!newInsumoId || !newQty || !newTotal}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>

            {selectedInsumo && newQty && newTotal && parseFloat(newQty) > 0 && parseFloat(newTotal) > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                ≈ {formatCurrency(parseFloat(newTotal) / parseFloat(newQty))} por {UNIT_LABELS[selectedInsumo.unit]}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Guardando...' : 'Registrar compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
