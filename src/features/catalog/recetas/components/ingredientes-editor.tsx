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

import { UNITS, UNIT_LABELS, type UnitKind } from '../../insumos/schemas'
import type { RecetaFormValues } from '../schemas'
import type { Tables } from '@/types/database'

type Props = {
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
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
  const form = useFormContext<RecetaFormValues>()
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

  function getLabel(field: RecetaFormValues['ingredientes'][number]): string {
    if (field.kind === 'insumo') {
      return insumos.find((i) => i.id === field.insumo_id)?.name ?? '—'
    }
    return recetas.find((r) => r.id === field.sub_receta_id)?.name ?? '—'
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ingredientes</p>

      {/* Current ingredients list */}
      {fields.length > 0 && (
        <div className="divide-y rounded-lg border text-sm">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {field.kind === 'insumo' ? 'Insumo' : 'Sub-receta'}
                </Badge>
                <span className="font-medium">{getLabel(field)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  {field.qty} {UNIT_LABELS[field.unit]}
                </span>
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
          ))}
        </div>
      )}

      {/* Add ingredient row */}
      {!readOnly && (
      <div className="flex items-end gap-2 rounded-lg border border-dashed p-3">
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

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">
            {newIng.kind === 'insumo' ? 'Insumo' : 'Receta'}
          </p>
          <Select value={newIng.refId} onValueChange={handleRefChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar...">
                {(v: string | null) => {
                  if (!v) return null
                  const list = newIng.kind === 'insumo' ? insumos : availableRecetas
                  return list.find((i) => i.id === v)?.name ?? v
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(newIng.kind === 'insumo' ? insumos : availableRecetas).map((item) => (
                <SelectItem key={item.id} value={item.id} label={item.name}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Cantidad</p>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={newIng.qty}
            onChange={(e) => setNewIng((prev) => ({ ...prev, qty: e.target.value }))}
            className="w-24"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Unidad</p>
          <Select
            value={newIng.unit}
            onValueChange={(v) => setNewIng((prev) => ({ ...prev, unit: v as UnitKind }))}
          >
            <SelectTrigger className="w-24">
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
