'use client'

import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'

import type { ProductoFormValues } from '../schemas'
import type { Tables } from '@/types/database'

type InsumoDescartable = Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>

type Props = {
  insumos: InsumoDescartable[]
  readOnly?: boolean
}

export function DescartablesEditor({ insumos, readOnly = false }: Props) {
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

  const usedIds = new Set(fields.map((f) => f.insumo_id))
  const available = insumos.filter((i) => !usedIds.has(i.id))

  function getName(insumoId: string) {
    return insumos.find((i) => i.id === insumoId)?.name ?? '—'
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Descartables</p>

      {fields.length > 0 && (
        <div className="divide-y rounded-lg border text-sm">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-medium">{getName(field.insumo_id)}</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{field.qty} u</span>
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
