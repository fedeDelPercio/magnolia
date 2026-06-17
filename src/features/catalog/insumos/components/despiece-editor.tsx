'use client'

import { useEffect, useState } from 'react'
import { TrashIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { UNIT_LABELS, type UnitKind } from '../schemas'
import { listInsumosForDespiece } from '../actions'

export type DespieceRow = {
  hijo_id: string
  qty_por_unidad: string // string para input controlado
  hijo_name?: string
  hijo_unit?: string
}

type Insumo = { id: string; name: string; unit: string }

type Props = {
  parentId: string | null
  rows: DespieceRow[]
  onChange: (rows: DespieceRow[]) => void
  disabled?: boolean
}

export function DespieceEditor({ parentId, rows, onChange, disabled }: Props) {
  const [insumos, setInsumos] = useState<Insumo[]>([])

  useEffect(() => {
    void listInsumosForDespiece(parentId).then(setInsumos)
  }, [parentId])

  function update(idx: number, patch: Partial<DespieceRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function remove(idx: number) {
    onChange(rows.filter((_, i) => i !== idx))
  }
  function addRow() {
    onChange([...rows, { hijo_id: '', qty_por_unidad: '' }])
  }

  const usedIds = new Set(rows.map((r) => r.hijo_id).filter(Boolean))

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Agregá los insumos hijos que se generan al comprar una unidad de este insumo.
        </p>
      )}
      {rows.map((row, idx) => {
        const hijo = insumos.find((i) => i.id === row.hijo_id)
        const unitLabel = hijo ? UNIT_LABELS[hijo.unit as UnitKind] ?? hijo.unit : '?'
        const options = insumos
          .filter((i) => i.id === row.hijo_id || !usedIds.has(i.id))
          .map((i) => ({ value: i.id, label: i.name }))
        return (
          <div key={idx} className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-muted-foreground">Insumo hijo</label>
              <SearchableSelect
                options={options}
                value={row.hijo_id}
                onValueChange={(v) => update(idx, { hijo_id: v ?? '' })}
                placeholder="Elegí un insumo"
                triggerClassName="h-8 text-xs"
                disabled={disabled}
              />
            </div>
            <div className="w-28">
              <label className="text-[11px] text-muted-foreground">Cant. ({unitLabel})</label>
              <Input
                type="number"
                min="0"
                step="0.001"
                className="h-8 text-xs"
                value={row.qty_por_unidad}
                disabled={disabled}
                onChange={(e) => update(idx, { qty_por_unidad: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              disabled={disabled}
              onClick={() => remove(idx)}
              title="Quitar"
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={disabled}
        onClick={addRow}
      >
        <PlusIcon className="size-3.5" /> Agregar hijo
      </Button>
    </div>
  )
}
