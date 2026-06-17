'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CameraIcon, Loader2Icon, TrashIcon, CheckCircleIcon, AlertTriangleIcon, PencilIcon } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { formatCurrency } from '@/lib/format'
import { UNIT_LABELS, type UnitKind } from '@/features/catalog/insumos/schemas'
import { InsumoDialog } from '@/features/catalog/insumos/components/insumo-dialog'
import type { InsumoWithProveedor } from '@/features/catalog/insumos/queries'
import { uploadAndParseComprobante, applyComprobante, discardComprobante, refreshInsumoForComprobante, type ApplyItem } from '../comprobantes/actions'
import { createInsumo, getInsumoFullForEdit, getDespiecesByParents } from '@/features/catalog/insumos/actions'
import type { ItemConMatch } from '../comprobantes/schemas'
import type { Tables } from '@/types/database'

type InsumoOpt = Pick<
  Tables<'insumos'>,
  'id' | 'name' | 'unit' | 'current_price' | 'purchase_unit_label' | 'purchase_unit_factor'
>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedorId: string
  proveedorName: string
  insumos: InsumoOpt[]
  proveedoresList: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
}

type Stage = 'pick' | 'parsing' | 'review'

// Línea editable del modal de revisión. assignedInsumoId es lo que el user
// terminó eligiendo (puede ser el sugerido por la IA, otro existente, o uno
// recién creado inline).
type LineDraft = {
  detected: ItemConMatch['detected']
  candidates: ItemConMatch['candidates']
  assignedInsumoId: string | null
  qtyInput: string         // cantidad EN unidad de compra del insumo (cajón, kg, etc)
  totalInput: string       // precio total facturado
  discarded: boolean
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ComprobanteUploadDialog({
  open,
  onOpenChange,
  proveedorId,
  proveedorName,
  insumos,
  proveedoresList,
}: Props) {
  const [stage, setStage] = useState<Stage>('pick')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(todayStr())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [observaciones, setObservaciones] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Insumos visibles para asignar (base + creados inline durante esta sesión)
  const [localInsumos, setLocalInsumos] = useState<InsumoOpt[]>(insumos)

  // Edicion inline de un insumo asignado: abre el InsumoDialog encima del modal.
  const [editingInsumo, setEditingInsumo] = useState<InsumoWithProveedor | null>(null)
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)

  // Cache de despieces de los insumos seleccionados: parent_id -> hijos[].
  // Lo refetcheamos cuando cambian las asignaciones para que el preview refleje
  // ediciones hechas en el modal anidado.
  const [despieces, setDespieces] = useState<Record<string, Array<{ hijo_name: string; qty_por_unidad: number; hijo_unit: string }>>>({})

  useEffect(() => {
    const ids = Array.from(new Set(lines.map((l) => l.assignedInsumoId).filter(Boolean) as string[]))
    if (ids.length === 0) {
      setDespieces({})
      return
    }
    void getDespiecesByParents(ids).then(setDespieces)
  }, [lines, localInsumos])

  async function openEditInsumo(insumoId: string) {
    setLoadingEdit(insumoId)
    const full = await getInsumoFullForEdit(insumoId)
    setLoadingEdit(null)
    if (!full) {
      toast.error('No se pudo cargar el insumo')
      return
    }
    setEditingInsumo(full as InsumoWithProveedor)
  }

  async function handleInsumoDialogClose(open: boolean) {
    if (open) return
    const wasEditing = editingInsumo?.id
    setEditingInsumo(null)
    if (!wasEditing) return
    // Refrescar el insumo editado en el cache local para que la conversion y
    // el label se actualicen sin tener que cerrar/reabrir el modal padre.
    const refreshed = await refreshInsumoForComprobante(wasEditing)
    if (refreshed) {
      setLocalInsumos((prev) => prev.map((i) => (i.id === refreshed.id ? refreshed : i)))
    }
  }

  function reset() {
    setStage('pick')
    setUploadId(null)
    setFecha(todayStr())
    setDueDate('')
    setNotes('')
    setLines([])
    setObservaciones(null)
    setLocalInsumos(insumos)
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      // Si el user cierra durante revisión sin aplicar, descartamos el upload
      // para que no quede basura en Storage/DB.
      if (stage === 'review' && uploadId) {
        void discardComprobante(uploadId)
      }
      reset()
    }
    onOpenChange(v)
  }

  async function handleFile(file: File) {
    setStage('parsing')
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadAndParseComprobante(proveedorId, fd)
    if (result.error || !result.items) {
      toast.error(result.error ?? 'No se pudo procesar el comprobante')
      setStage('pick')
      return
    }

    setUploadId(result.uploadId ?? null)
    if (result.fecha) setFecha(result.fecha)
    setObservaciones(result.observaciones ?? null)

    setLines(
      result.items.map((it) => {
        const insumo = it.suggested_insumo_id
          ? insumos.find((i) => i.id === it.suggested_insumo_id) ?? null
          : null
        // Cantidad inicial: si el insumo tiene presentación y la IA detectó
        // una cantidad en la presentación (ej. "2 cajones"), la usamos tal cual.
        // El user puede editar después.
        return {
          detected: it.detected,
          candidates: it.candidates,
          assignedInsumoId: insumo?.id ?? null,
          qtyInput: String(it.detected.cantidad ?? ''),
          totalInput: String(it.detected.precio_total ?? ''),
          discarded: false,
        }
      }),
    )
    setStage('review')
  }

  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  async function handleCreateInline(idx: number, name: string) {
    const detected = lines[idx]?.detected
    if (!detected) return
    const guessedUnit: UnitKind =
      detected.unidad && ['kg', 'g', 'l', 'ml', 'u', 'docena', 'porcion'].includes(detected.unidad)
        ? (detected.unidad as UnitKind)
        : 'u'
    const res = await createInsumo({
      name: name.trim(),
      kind: 'ingrediente',
      unit: guessedUnit,
      current_price: 0,
      proveedor_id: proveedorId,
      perishable: false,
      shelf_life_days: null,
      track_stock: false,
      stock_inicial: 0,
    })
    if (res.error || !res.data) {
      toast.error(res.error ?? 'No se pudo crear el insumo')
      return
    }
    const created = res.data as InsumoOpt
    setLocalInsumos((prev) => [...prev, created])
    updateLine(idx, { assignedInsumoId: created.id })
    toast.success(`Insumo "${created.name}" creado`)
  }

  function buildApplyItems(): ApplyItem[] {
    const items: ApplyItem[] = []
    for (const line of lines) {
      if (line.discarded || !line.assignedInsumoId) continue
      const qty = parseFloat(line.qtyInput)
      const total = parseFloat(line.totalInput)
      if (isNaN(qty) || qty <= 0 || isNaN(total) || total <= 0) continue

      const insumo = localInsumos.find((i) => i.id === line.assignedInsumoId)
      if (!insumo) continue
      // Si el insumo tiene presentación (cajón = N unidades base), la cantidad
      // ingresada está en la presentación → convertimos a unidad base.
      const factor =
        insumo.purchase_unit_label && insumo.purchase_unit_factor
          ? Number(insumo.purchase_unit_factor)
          : 1
      const qtyBase = qty * factor
      items.push({
        insumo_id: insumo.id,
        qty: qtyBase,
        unit: insumo.unit,
        unit_price: total / qtyBase,
      })
    }
    return items
  }

  async function handleApply() {
    if (!uploadId) return
    const items = buildApplyItems()
    if (items.length === 0) {
      toast.error('Asigná insumo, cantidad y precio total a al menos una línea')
      return
    }
    setSaving(true)
    const result = await applyComprobante(uploadId, proveedorId, fecha, dueDate || null, notes || null, items)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Compra registrada (${items.length} items)`)
    reset()
    onOpenChange(false)
  }

  const computedTotal = lines.reduce((acc, l) => {
    if (l.discarded) return acc
    const t = parseFloat(l.totalInput)
    return acc + (isNaN(t) ? 0 : t)
  }, 0)
  const aplicables = lines.filter((l) => !l.discarded && l.assignedInsumoId && parseFloat(l.qtyInput) > 0 && parseFloat(l.totalInput) > 0).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {stage === 'pick' && `Cargar comprobante — ${proveedorName}`}
            {stage === 'parsing' && 'Leyendo comprobante...'}
            {stage === 'review' && `Revisar items detectados — ${proveedorName}`}
          </DialogTitle>
        </DialogHeader>

        {stage === 'pick' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
              <CameraIcon className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Subí la foto o PDF del comprobante</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WebP o PDF · hasta 15 MB
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mx-auto mt-4 max-w-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              La IA detecta los items, los matchea con tu catálogo de insumos y vos confirmás antes de guardar la compra.
            </p>
          </div>
        )}

        {stage === 'parsing' && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2Icon className="size-10 animate-spin text-primary" />
            <p className="text-sm">Procesando con IA — esto puede tardar 10-30 segundos.</p>
          </div>
        )}

        {stage === 'review' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Fecha</label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Vencimiento de pago</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Notas</label>
              <Input placeholder="Ej: Factura B 0001-00012345" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {observaciones && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>La IA observó:</strong> {observaciones}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {lines.length} item{lines.length === 1 ? '' : 's'} detectado{lines.length === 1 ? '' : 's'}
              </p>
              <div className="max-h-[400px] overflow-y-auto rounded-lg border divide-y">
                {lines.map((line, idx) => {
                  const insumo = localInsumos.find((i) => i.id === line.assignedInsumoId)
                  const unidadLabel = insumo
                    ? insumo.purchase_unit_label && insumo.purchase_unit_factor
                      ? insumo.purchase_unit_label
                      : UNIT_LABELS[insumo.unit as UnitKind] ?? insumo.unit
                    : line.detected.unidad ?? '?'
                  const qty = parseFloat(line.qtyInput) || 0
                  const total = parseFloat(line.totalInput) || 0
                  const factor =
                    insumo?.purchase_unit_label && insumo.purchase_unit_factor
                      ? Number(insumo.purchase_unit_factor)
                      : 1
                  const qtyBase = qty * factor
                  const unitPriceBase = qtyBase > 0 ? total / qtyBase : 0
                  const baseLabel = insumo ? UNIT_LABELS[insumo.unit as UnitKind] ?? insumo.unit : ''

                  const topCandidate = line.candidates[0]
                  const showSuggestion = !!topCandidate && !line.assignedInsumoId

                  return (
                    <div
                      key={idx}
                      className={`p-3 ${line.discarded ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{line.detected.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            IA detectó: {line.detected.cantidad} {line.detected.unidad ?? '?'} · {formatCurrency(line.detected.precio_total)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => updateLine(idx, { discarded: !line.discarded })}
                          title={line.discarded ? 'Restaurar' : 'Descartar item'}
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>

                      {!line.discarded && (
                        <div className="mt-2 grid grid-cols-12 items-end gap-2">
                          <div className="col-span-6 space-y-1">
                            <label className="text-[11px] text-muted-foreground">Insumo a vincular</label>
                            <div className="flex items-center gap-1">
                              <SearchableSelect
                                options={localInsumos.map((i) => ({ value: i.id, label: i.name }))}
                                value={line.assignedInsumoId ?? ''}
                                onValueChange={(v) => updateLine(idx, { assignedInsumoId: v })}
                                onCreate={(search) => handleCreateInline(idx, search || line.detected.nombre)}
                                placeholder="Sin asignar"
                                triggerClassName="h-8 text-xs flex-1"
                              />
                              {line.assignedInsumoId && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0"
                                  title="Editar insumo (equivalencias, unidad, etc.)"
                                  disabled={loadingEdit === line.assignedInsumoId}
                                  onClick={() => openEditInsumo(line.assignedInsumoId!)}
                                >
                                  {loadingEdit === line.assignedInsumoId ? (
                                    <Loader2Icon className="size-3.5 animate-spin" />
                                  ) : (
                                    <PencilIcon className="size-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {showSuggestion && (
                              <p className="text-[10px] text-muted-foreground">
                                Sugerido: <button
                                  type="button"
                                  className="underline hover:text-foreground"
                                  onClick={() => updateLine(idx, { assignedInsumoId: topCandidate.insumo_id })}
                                >
                                  {topCandidate.name}
                                </button> ({Math.round(topCandidate.score * 100)}% similitud)
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[11px] text-muted-foreground">Cant. ({unidadLabel})</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              className="h-8 text-xs"
                              value={line.qtyInput}
                              onChange={(e) => updateLine(idx, { qtyInput: e.target.value })}
                            />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <label className="text-[11px] text-muted-foreground">Precio total</label>
                            <CurrencyInput
                              className="h-8 text-xs"
                              value={line.totalInput}
                              onValueChange={(v) => updateLine(idx, { totalInput: v })}
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {insumo ? (
                              <CheckCircleIcon className="size-4 text-emerald-600" />
                            ) : (
                              <AlertTriangleIcon className="size-4 text-amber-500" />
                            )}
                          </div>
                          {insumo && qtyBase > 0 && total > 0 && (() => {
                            const hijos = line.assignedInsumoId ? despieces[line.assignedInsumoId] : null
                            if (hijos && hijos.length > 0) {
                              const sumQty = hijos.reduce((s, h) => s + h.qty_por_unidad, 0)
                              const unitPriceHijo = sumQty > 0 ? total / (qty * sumQty) : 0
                              return (
                                <p className="col-span-12 text-[10px] text-emerald-700">
                                  Va a sumar stock a: {hijos.map((h) => `${(qty * h.qty_por_unidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${h.hijo_name}`).join(' · ')} · {formatCurrency(unitPriceHijo)} por unidad hija
                                </p>
                              )
                            }
                            return (
                              <p className="col-span-12 text-[10px] text-muted-foreground">
                                = {qtyBase.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {baseLabel} · {formatCurrency(unitPriceBase)} / {baseLabel}
                              </p>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
              <span>
                <strong>{aplicables}</strong> de {lines.length} items listos
              </span>
              <span className="tabular-nums font-medium">Total facturado: {formatCurrency(computedTotal)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === 'pick' && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {stage === 'review' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Descartar
              </Button>
              <Button type="button" onClick={handleApply} disabled={saving || aplicables === 0}>
                {saving ? 'Guardando...' : `Registrar compra (${aplicables})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      {editingInsumo && (
        <InsumoDialog
          open={!!editingInsumo}
          onOpenChange={handleInsumoDialogClose}
          insumo={editingInsumo}
          mode="edit"
          proveedores={proveedoresList}
        />
      )}
    </Dialog>
  )
}
