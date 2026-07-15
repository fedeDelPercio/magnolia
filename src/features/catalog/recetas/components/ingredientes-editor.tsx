'use client'

import { useImperativeHandle, useState, type Ref } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { PlusIcon, TrashIcon, AlertTriangleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'

import { UNITS, UNIT_LABELS, type UnitKind } from '../../insumos/schemas'
import type { IngredienteFormValues } from '../schemas'
import type { Tables } from '@/types/database'
import { normalizeQty, unitsCompatible, compatibleUnitsFor } from '../lib/unit-conversion'
import { formatCurrency } from '@/lib/format'

// El form que contiene ingredientes puede ser el del producto o el de una
// sub-receta. Ambos exponen yield_qty y yield_unit, que usamos para calcular
// el costo por unidad de rendimiento.
type FormWithIngredientes = {
  ingredientes: IngredienteFormValues[]
  yield_qty?: number
  yield_unit?: string
}

type RecetaConCosto = Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'> & {
  total_cost?: number
}

export type IngredientesEditorHandle = {
  /**
   * Si el user dejo un ingrediente "pendiente" en la fila de agregar (con
   * insumo/receta y cantidad completos) pero no toco el boton +, lo suma al
   * form. Se llama desde el submit del dialog para no perder lo que la user
   * penso que ya habia agregado.
   */
  flushPending: () => void
}

type Props = {
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  recetas: RecetaConCosto[]
  currentRecetaId?: string
  readOnly?: boolean
  ref?: Ref<IngredientesEditorHandle>
}

type NewIngState = {
  kind: 'insumo' | 'receta'
  refId: string
  qty: string
  unit: UnitKind
}

const EMPTY_ING: NewIngState = {
  kind: 'insumo',
  refId: '',
  qty: '',
  unit: 'kg',
}

export function IngredientesEditor({ insumos, recetas, currentRecetaId, readOnly = false, ref }: Props) {
  const form = useFormContext<FormWithIngredientes>()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredientes',
  })

  const [newIng, setNewIng] = useState<NewIngState>(EMPTY_ING)

  useImperativeHandle(
    ref,
    () => ({
      flushPending: () => {
        if (!newIng.refId || !newIng.qty) return
        const qty = parseFloat(newIng.qty)
        if (isNaN(qty) || qty <= 0) return
        append({
          kind: newIng.kind,
          insumo_id: newIng.kind === 'insumo' ? newIng.refId : undefined,
          sub_receta_id: newIng.kind === 'receta' ? newIng.refId : undefined,
          qty,
          unit: newIng.unit,
        })
        setNewIng(EMPTY_ING)
      },
    }),
    [newIng, append],
  )

  const availableRecetas = recetas.filter((r) => r.id !== currentRecetaId)

  // Unidad "target" del ingrediente/sub-receta actualmente seleccionado en la
  // fila de agregar. La usamos para restringir el Select de "Unidad" a la
  // misma familia (peso/vol/count/porcion). Si todavia no hay nada elegido,
  // mostramos todas las unidades — no queremos un dropdown vacio.
  function getTargetUnit(kind: 'insumo' | 'receta', refId: string): UnitKind | null {
    if (!refId) return null
    if (kind === 'insumo') return insumos.find((i) => i.id === refId)?.unit ?? null
    return (recetas.find((r) => r.id === refId)?.yield_unit as UnitKind | undefined) ?? null
  }

  const newIngTarget = getTargetUnit(newIng.kind, newIng.refId)
  const newIngUnitOptions = (newIngTarget
    ? (compatibleUnitsFor(newIngTarget) as UnitKind[])
    : [...UNITS])

  function handleKindChange(kind: 'insumo' | 'receta') {
    setNewIng({ ...EMPTY_ING, kind, unit: kind === 'insumo' ? 'kg' : 'u' })
  }

  function handleRefChange(refId: string | null) {
    if (!refId) return
    const unit: UnitKind =
      newIng.kind === 'insumo'
        ? (insumos.find((i) => i.id === refId)?.unit ?? 'kg')
        : (recetas.find((r) => r.id === refId)?.yield_unit ?? 'u')
    setNewIng((prev) => ({ ...prev, refId, unit }))
  }

  function handleAdd() {
    if (!newIng.refId || !newIng.qty) return
    const qty = parseFloat(newIng.qty)
    if (isNaN(qty) || qty <= 0) return

    append({
      kind: newIng.kind,
      insumo_id: newIng.kind === 'insumo' ? newIng.refId : undefined,
      sub_receta_id: newIng.kind === 'receta' ? newIng.refId : undefined,
      qty,
      unit: newIng.unit,
    })
    setNewIng(EMPTY_ING)
  }

  function getLabel(field: IngredienteFormValues): string {
    if (field.kind === 'insumo') {
      return insumos.find((i) => i.id === field.insumo_id)?.name ?? '—'
    }
    return recetas.find((r) => r.id === field.sub_receta_id)?.name ?? '—'
  }

  // Costo variable de la linea, tanto para insumos como sub-recetas. Espeja
  // la logica de recipe_cost() en Postgres:
  //   insumo:     qty × factor(unit_conversion) × current_price
  //   sub-receta: qty × (total_cost / yield_qty)
  // Nota: para sub-recetas el SQL NO convierte unidades — si consumis "150 g"
  // de una receta con yield en "porcion", multiplica igual y da ruido. Ese
  // caso se detecta con unitsCompatible y marcamos warning.
  function getLineCost(field: IngredienteFormValues): number | null {
    if (field.kind === 'insumo') {
      const insumo = insumos.find((i) => i.id === field.insumo_id)
      if (!insumo || insumo.current_price == null) return null
      const qtyInInsumoUnit = normalizeQty(field.qty, field.unit, insumo.unit)
      return qtyInInsumoUnit * Number(insumo.current_price)
    }
    const receta = recetas.find((r) => r.id === field.sub_receta_id)
    if (!receta || receta.total_cost == null || !receta.yield_qty) return null
    const costPerYieldUnit = Number(receta.total_cost) / Number(receta.yield_qty)
    return Number(field.qty) * costPerYieldUnit
  }

  // Devuelve true si la unidad consumida es compatible con la unidad del
  // ingrediente. Cuando NO son compatibles el costo calculado es ruido
  // (para sub-recetas, ej. yield=porcion y consumido=g).
  function hasUnitMismatch(field: IngredienteFormValues): boolean {
    if (field.kind === 'insumo') {
      const insumo = insumos.find((i) => i.id === field.insumo_id)
      if (!insumo) return false
      return !unitsCompatible(field.unit, insumo.unit)
    }
    const receta = recetas.find((r) => r.id === field.sub_receta_id)
    if (!receta || !receta.yield_unit) return false
    return !unitsCompatible(field.unit, receta.yield_unit)
  }

  const totalCost = fields.reduce((acc, f) => acc + (getLineCost(f) ?? 0), 0)

  // Leemos yield_qty y yield_unit del form (reactivo). Sirven para mostrar
  // "Por porcion / Por unidad" bajo el total. Si no existen (form no los
  // maneja), omitimos la fila.
  const yieldQty = form.watch('yield_qty')
  const yieldUnit = form.watch('yield_unit')
  const perUnitCost =
    totalCost > 0 && yieldQty && Number(yieldQty) > 0 ? totalCost / Number(yieldQty) : null
  const yieldUnitLabel =
    yieldUnit && (UNIT_LABELS[yieldUnit as UnitKind] ?? yieldUnit)

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ingredientes</p>

      {/* Current ingredients list */}
      {fields.length > 0 && (
        <div className="divide-y rounded-lg border text-sm">
          {/* Header — sin borde divisorio pero da estructura visual a las cols */}
          <div className="flex items-center gap-4 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            <span className="flex-1">Ingrediente</span>
            <span className="w-20 text-right">Cantidad</span>
            <span className="w-24 text-right">Costo</span>
            {!readOnly && <span className="w-6" />}
          </div>
          {fields.map((field, idx) => {
            const cost = getLineCost(field)
            const mismatch = hasUnitMismatch(field)
            return (
              <div key={field.id} className="flex items-center gap-4 px-3 py-2">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-xs">
                    {field.kind === 'insumo' ? 'Insumo' : 'Sub-receta'}
                  </Badge>
                  <span className="font-medium truncate">{getLabel(field)}</span>
                </div>
                <span className="w-20 tabular-nums text-right text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {mismatch && (
                      <AlertTriangleIcon
                        className="size-3 text-amber-600"
                        aria-label="Unidades no compatibles — el costo puede estar mal"
                      />
                    )}
                    {field.qty} {UNIT_LABELS[field.unit]}
                  </span>
                </span>
                <span
                  className={`w-24 tabular-nums text-right ${
                    mismatch ? 'text-amber-700' : 'text-foreground/80'
                  }`}
                  title={
                    mismatch
                      ? 'La unidad consumida no coincide con la unidad del ingrediente — el costo es aproximado. Ajustá las unidades para arreglarlo.'
                      : undefined
                  }
                >
                  {cost !== null ? formatCurrency(cost) : '—'}
                </span>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => remove(idx)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
          {totalCost > 0 && (
            <>
              <div className="flex items-center gap-4 px-3 py-2 bg-muted/30">
                <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Costo total
                </span>
                <span className="w-20" />
                <span className="w-24 tabular-nums text-right font-medium">
                  {formatCurrency(totalCost)}
                </span>
                {!readOnly && <span className="w-6" />}
              </div>
              {perUnitCost !== null && yieldUnitLabel && (
                <div className="flex items-center gap-4 px-3 py-2 bg-muted/30">
                  <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Costo por {yieldUnitLabel}
                  </span>
                  <span className="w-20 tabular-nums text-right text-[11px] text-muted-foreground/80">
                    {yieldQty} {yieldUnitLabel}
                  </span>
                  <span className="w-24 tabular-nums text-right font-medium">
                    {formatCurrency(perUnitCost)}
                  </span>
                  {!readOnly && <span className="w-6" />}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add ingredient row */}
      {!readOnly && (
      <div className="space-y-2 rounded-lg border border-dashed p-3">
        {/* Row 1: Tipo + selector */}
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <Select
              value={newIng.kind}
              onValueChange={(v) => handleKindChange(v as 'insumo' | 'receta')}
            >
              <SelectTrigger className="w-28">
                <SelectValue>
                  {(v: string | null) => v === 'insumo' ? 'Insumo' : v === 'receta' ? 'Sub-receta' : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insumo" label="Insumo">Insumo</SelectItem>
                <SelectItem value="receta" label="Sub-receta">Sub-receta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              {newIng.kind === 'insumo' ? 'Insumo' : 'Receta'}
            </p>
            <SearchableSelect
              options={(newIng.kind === 'insumo' ? insumos : availableRecetas).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={newIng.refId}
              onValueChange={handleRefChange}
            />
          </div>
        </div>

        {/* Row 2: Cantidad + Unidad + agregar */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">Cantidad</p>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={newIng.qty}
              onChange={(e) => setNewIng((prev) => ({ ...prev, qty: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Unidad</p>
            <Select
              value={newIng.unit}
              onValueChange={(v) => setNewIng((prev) => ({ ...prev, unit: v as UnitKind }))}
            >
              <SelectTrigger className="w-28">
                <SelectValue>
                  {(v: string | null) => v ? UNIT_LABELS[v as UnitKind] ?? v : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {newIngUnitOptions.map((u) => (
                  <SelectItem key={u} value={u} label={UNIT_LABELS[u]}>
                    {UNIT_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newIng.refId || !newIng.qty}
            className="shrink-0"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      )}

      {form.formState.errors.ingredientes && (
        <p className="text-xs text-destructive">
          {typeof form.formState.errors.ingredientes === 'object' &&
          'message' in form.formState.errors.ingredientes
            ? String(form.formState.errors.ingredientes.message)
            : 'Revisá los ingredientes'}
        </p>
      )}
    </div>
  )
}
