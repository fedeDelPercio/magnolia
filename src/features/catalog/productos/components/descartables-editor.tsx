'use client'

import { useImperativeHandle, useState, type Ref } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'

import type { ProductoFormValues } from '../schemas'
import type { Tables } from '@/types/database'
import { formatCurrency } from '@/lib/format'

type InsumoDescartable = Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>

export type DescartablesEditorHandle = {
  /**
   * Si el user dejo un descartable "pendiente" en la fila de agregar (con
   * insumo y cantidad completos) pero no toco el boton +, lo suma al form.
   * Se llama desde el submit del dialog para no perder lo que la user penso
   * que ya habia agregado.
   */
  flushPending: () => void
}

type Props = {
  insumos: InsumoDescartable[]
  readOnly?: boolean
  ref?: Ref<DescartablesEditorHandle>
}

export function DescartablesEditor({ insumos, readOnly = false, ref }: Props) {
  const form = useFormContext<ProductoFormValues>()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'descartables',
  })

  const [newInsumoId, setNewInsumoId] = useState('')
  const [newQty, setNewQty] = useState('')

  function handleAdd() {
    const qty = parseFloat(newQty)
    if (!newInsumoId || isNaN(qty) || qty <= 0) return
    append({ insumo_id: newInsumoId, qty })
    setNewInsumoId('')
    setNewQty('')
  }

  useImperativeHandle(
    ref,
    () => ({
      flushPending: () => {
        const qty = parseFloat(newQty)
        if (!newInsumoId || isNaN(qty) || qty <= 0) return
        append({ insumo_id: newInsumoId, qty })
        setNewInsumoId('')
        setNewQty('')
      },
    }),
    [newInsumoId, newQty, append],
  )

  const usedIds = new Set(fields.map((f) => f.insumo_id))
  const available = insumos.filter((i) => !usedIds.has(i.id))

  function getName(insumoId: string) {
    return insumos.find((i) => i.id === insumoId)?.name ?? '—'
  }

  // Descartables se cuentan en 'u' y el insumo tambien esta en 'u', asi que
  // el costo es directo qty × current_price. Si en el futuro algun descartable
  // tuviera otra unidad, habria que convertir aca.
  function getLineCost(insumoId: string, qty: number): number | null {
    const insumo = insumos.find((i) => i.id === insumoId)
    if (!insumo || insumo.current_price == null) return null
    return qty * Number(insumo.current_price)
  }

  const totalCost = fields.reduce(
    (acc, f) => acc + (getLineCost(f.insumo_id, f.qty) ?? 0),
    0,
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Descartables</p>

      {fields.length > 0 && (
        <div className="divide-y rounded-lg border text-sm">
          <div className="flex items-center gap-4 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            <span className="flex-1">Descartable</span>
            <span className="w-20 text-right">Cantidad</span>
            <span className="w-24 text-right">Costo</span>
            {!readOnly && <span className="w-6" />}
          </div>
          {fields.map((field, idx) => {
            const cost = getLineCost(field.insumo_id, field.qty)
            return (
              <div key={field.id} className="flex items-center gap-4 px-3 py-2">
                <span className="flex-1 font-medium truncate">{getName(field.insumo_id)}</span>
                <span className="w-20 tabular-nums text-right text-muted-foreground">
                  {field.qty} u
                </span>
                <span className="w-24 tabular-nums text-right text-foreground/80">
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
            <div className="flex items-center gap-4 px-3 py-2 bg-muted/30">
              <span className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Costo descartables
              </span>
              <span className="w-20" />
              <span className="w-24 tabular-nums text-right font-medium">
                {formatCurrency(totalCost)}
              </span>
              {!readOnly && <span className="w-6" />}
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-end gap-2 rounded-lg border border-dashed p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">Descartable</p>
            <SearchableSelect
              options={available.map((i) => ({ value: i.id, label: i.name }))}
              value={newInsumoId}
              onValueChange={(v) => setNewInsumoId(v ?? '')}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Cantidad</p>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-24"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newInsumoId || !newQty}
            className="shrink-0"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      )}

      {fields.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">Sin descartables asignados.</p>
      )}
    </div>
  )
}
