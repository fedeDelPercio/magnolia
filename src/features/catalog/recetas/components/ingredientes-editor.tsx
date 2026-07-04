'use client'

import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'

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
import { normalizeQty } from '../lib/unit-conversion'
import { formatCurrency } from '@/lib/format'

type FormWithIngredientes = { ingredientes: IngredienteFormValues[] }

type Props = {
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  recetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
  currentRecetaId?: string
  readOnly?: boolean
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

export function IngredientesEditor({ insumos, recetas, currentRecetaId, readOnly = false }: Props) {
  const form = useFormContext<FormWithIngredientes>()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredientes',
  })

  const [newIng, setNewIng] = useState<NewIngState>(EMPTY_ING)

  const availableRecetas = recetas.filter((r) => r.id !== currentRecetaId)

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

  // Costo variable de la linea. Solo lo calculamos para insumos (no sub-recetas
  // porque para eso haria falta traer recipe_cost y sumar recursivo). Aplica
  // conversion kg<->g / l<->ml igual que el calculo del backend.
  function getLineCost(field: IngredienteFormValues): number | null {
    if (field.kind !== 'insumo') return null
    const insumo = insumos.find((i) => i.id === field.insumo_id)
    if (!insumo || insumo.current_price == null) return null
    const qtyInInsumoUnit = normalizeQty(field.qty, field.unit, insumo.unit)
    return qtyInInsumoUnit * Number(insumo.current_price)
  }

  const totalCost = fields.reduce((acc, f) => acc + (getLineCost(f) ?? 0), 0)

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ingredientes</p>

      {/* Current ingredients list */}
      {fields.length > 0 && (
        <div className="divide-y rounded-lg border text-sm">
          {fields.map((field, idx) => {
            const cost = getLineCost(field)
            return (
              <div key={field.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-xs">
                    {field.kind === 'insumo' ? 'Insumo' : 'Sub-receta'}
                  </Badge>
                  <span className="font-medium truncate">{getLabel(field)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  <span className="tabular-nums">
                    {field.qty} {UNIT_LABELS[field.unit]}
                  </span>
                  {cost !== null && (
                    <span className="tabular-nums text-xs text-foreground/70 min-w-[70px] text-right">
                      {formatCurrency(cost)}
                    </span>
                  )}
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={() => remove(idx)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {totalCost > 0 && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Costo variable (insumos)
              </span>
              <span className="tabular-nums font-medium">{formatCurrency(totalCost)}</span>
            </div>
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
                {UNITS.map((u) => (
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
