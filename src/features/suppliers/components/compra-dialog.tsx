'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { PlusIcon, TrashIcon, AlertTriangleIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { formatCurrency } from '@/lib/format'
import { UNITS, UNIT_LABELS, INSUMO_KINDS, INSUMO_KIND_LABELS, type UnitKind, type InsumoKind } from '@/features/catalog/insumos/schemas'
import { createInsumo } from '@/features/catalog/insumos/actions'
import { createCompra, updateCompra } from '../actions'
import type { Tables } from '@/types/database'
import type { CompraWithItems } from '../queries'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type InsumoOpt = Pick<
  Tables<'insumos'>,
  'id' | 'name' | 'unit' | 'current_price' | 'purchase_unit_label' | 'purchase_unit_factor'
>

type NewInsumoForm = {
  name: string
  kind: InsumoKind
  unit: UnitKind
}

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
  insumos: InsumoOpt[]
  compra?: CompraWithItems
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_NEW_INSUMO: NewInsumoForm = { name: '', kind: 'ingrediente', unit: 'kg' }

export function CompraDialog({
  open,
  onOpenChange,
  proveedorId,
  proveedorName,
  insumos,
  compra,
}: Props) {
  const isEdit = !!compra
  const [fecha, setFecha] = useState(todayStr())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)

  // Insumos locales: base del prop + los creados inline en este dialog
  const [localInsumos, setLocalInsumos] = useState<InsumoOpt[]>(insumos)

  // New item form state
  const [newInsumoId, setNewInsumoId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newTotal, setNewTotal] = useState('')

  // Mini-form para crear insumo inline
  const [creatingInsumo, setCreatingInsumo] = useState(false)
  const [newInsumoForm, setNewInsumoForm] = useState<NewInsumoForm>(EMPTY_NEW_INSUMO)
  const [savingInsumo, setSavingInsumo] = useState(false)

  useEffect(() => {
    if (open) {
      if (compra) {
        setFecha(compra.fecha)
        setDueDate(compra.due_date ?? '')
        setNotes(compra.notes ?? '')
        setItems(
          compra.compra_items.map((ci) => ({
            insumo_id: ci.insumo_id,
            insumo_name: ci.insumos.name,
            qty: ci.qty,
            unit: ci.unit as Tables<'insumos'>['unit'],
            unit_price: ci.unit_price,
          })),
        )
      } else {
        setFecha(todayStr())
        setDueDate('')
        setNotes('')
        setItems([])
      }
      setNewInsumoId('')
      setNewQty('')
      setNewTotal('')
      setLocalInsumos(insumos)
      setCreatingInsumo(false)
      setNewInsumoForm(EMPTY_NEW_INSUMO)
    }
  }, [open, insumos, compra])

  function handleStartCreateInsumo(search: string) {
    setNewInsumoForm({ ...EMPTY_NEW_INSUMO, name: search })
    setCreatingInsumo(true)
  }

  async function handleSaveNewInsumo() {
    if (!newInsumoForm.name.trim()) return
    setSavingInsumo(true)
    const result = await createInsumo({
      name: newInsumoForm.name.trim(),
      kind: newInsumoForm.kind,
      unit: newInsumoForm.unit,
      current_price: 0,
      proveedor_id: proveedorId,
      perishable: false,
      shelf_life_days: null,
      track_stock: false,
      stock_inicial: 0,
    })
    setSavingInsumo(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.data) {
      const created = result.data as InsumoOpt
      setLocalInsumos((prev) => [...prev, created])
      setNewInsumoId(created.id)
    }
    setCreatingInsumo(false)
    setNewInsumoForm(EMPTY_NEW_INSUMO)
  }

  function handleSelectInsumo(id: string | null) {
    if (!id) return
    setNewInsumoId(id)
    // No pre-llenamos precio porque ahora el campo es el total pagado, que
    // depende de la cantidad. La dueña sabe el total que pagó.
  }

  function buildPendingItem(): LineItem | null {
    const insumo = localInsumos.find((i) => i.id === newInsumoId)
    if (!insumo || !newQty || !newTotal) return null
    const qty = parseFloat(newQty)
    const total = parseFloat(newTotal)
    if (isNaN(qty) || qty <= 0 || isNaN(total) || total <= 0) return null
    // Si el insumo tiene presentación de compra definida (ej "cajón = 10 kg"),
    // la cantidad ingresada está en cajones y la convertimos a unidad base
    // (la DB y el resto del sistema sólo entienden unidad base).
    const factor =
      insumo.purchase_unit_label && insumo.purchase_unit_factor
        ? insumo.purchase_unit_factor
        : 1
    const qtyBase = qty * factor
    return {
      insumo_id: insumo.id,
      insumo_name: insumo.name,
      qty: qtyBase,
      unit: insumo.unit,
      unit_price: total / qtyBase,
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
    const allItems = pendingItem ? [...items, pendingItem] : items
    if (allItems.length === 0) {
      toast.error('Agregá al menos un ítem')
      return
    }
    const mapped = allItems.map((i) => ({ insumo_id: i.insumo_id, qty: i.qty, unit: i.unit, unit_price: i.unit_price }))
    setSaving(true)
    const result = isEdit
      ? await updateCompra(compra!.id, proveedorId, fecha, dueDate || null, notes || null, mapped)
      : await createCompra(proveedorId, fecha, dueDate || null, notes || null, mapped)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Compra actualizada.' : 'Compra registrada. Precios de insumos actualizados.')
      onOpenChange(false)
    }
  }

  const selectedInsumo = localInsumos.find((i) => i.id === newInsumoId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar compra' : 'Registrar compra'} — {proveedorName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
                      <span className="tabular-nums">{formatCurrency(item.qty * item.unit_price)}</span>
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
                <SearchableSelect
                  options={localInsumos.map((i) => ({ value: i.id, label: i.name }))}
                  value={newInsumoId}
                  onValueChange={handleSelectInsumo}
                  onCreate={handleStartCreateInsumo}
                  triggerClassName="h-8 text-sm"
                />
              </div>
              <div className="w-20 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Cant. {selectedInsumo
                    ? selectedInsumo.purchase_unit_label && selectedInsumo.purchase_unit_factor
                      ? `(${selectedInsumo.purchase_unit_label})`
                      : `(${UNIT_LABELS[selectedInsumo.unit]})`
                    : ''}
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

            {/* Mini-form para crear insumo inline */}
            {creatingInsumo && (
              <div className="rounded-lg border border-dashed p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo insumo</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-muted-foreground">Nombre</label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="Ej: Lomo de cerdo"
                      value={newInsumoForm.name}
                      onChange={(e) => setNewInsumoForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tipo</label>
                    <Select
                      value={newInsumoForm.kind}
                      onValueChange={(v) => setNewInsumoForm((f) => ({ ...f, kind: v as InsumoKind }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue>
                          {(v: string | null) => v ? INSUMO_KIND_LABELS[v as InsumoKind] : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {INSUMO_KINDS.map((k) => (
                          <SelectItem key={k} value={k} label={INSUMO_KIND_LABELS[k]}>
                            {INSUMO_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Unidad</label>
                    <Select
                      value={newInsumoForm.unit}
                      onValueChange={(v) => setNewInsumoForm((f) => ({ ...f, unit: v as UnitKind }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue>
                          {(v: string | null) => v ? UNIT_LABELS[v as UnitKind] : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u} label={UNIT_LABELS[u]}>
                            {UNIT_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 flex-1 text-xs"
                      disabled={!newInsumoForm.name.trim() || savingInsumo}
                      onClick={handleSaveNewInsumo}
                    >
                      {savingInsumo ? 'Creando...' : 'Crear'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setCreatingInsumo(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedInsumo && newQty && newTotal && parseFloat(newQty) > 0 && parseFloat(newTotal) > 0 && (() => {
              const qtyInput = parseFloat(newQty)
              const total = parseFloat(newTotal)
              const factor =
                selectedInsumo.purchase_unit_label && selectedInsumo.purchase_unit_factor
                  ? selectedInsumo.purchase_unit_factor
                  : 1
              const qtyBase = qtyInput * factor
              const newUnitPrice = total / qtyBase
              const baseLabel = UNIT_LABELS[selectedInsumo.unit]
              const prevPrice = selectedInsumo.current_price
              const changePct = prevPrice > 0 ? ((newUnitPrice - prevPrice) / prevPrice) * 100 : null
              const isLarge = changePct !== null && changePct >= 20
              const hasPresentation = factor !== 1
              return (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {hasPresentation && (
                      <>= {qtyBase.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {baseLabel} · </>
                    )}
                    {formatCurrency(newUnitPrice)} / {baseLabel}
                  </span>
                  {changePct !== null && prevPrice > 0 && (
                    <span className={`flex items-center gap-1 tabular-nums ${isLarge ? 'font-semibold text-red-600' : changePct > 0 ? 'text-muted-foreground' : changePct < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {isLarge && <AlertTriangleIcon className="size-3" />}
                      {changePct > 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                      Último: {formatCurrency(prevPrice)} · {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })()}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
