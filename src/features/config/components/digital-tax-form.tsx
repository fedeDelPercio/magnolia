'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveDigitalTaxRate } from '../actions'

type Props = { initialValue: number }

export function DigitalTaxForm({ initialValue }: Props) {
  const [persisted, setPersisted] = useState(initialValue)
  const [draft, setDraft] = useState(String(initialValue))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const pct = parseFloat(draft)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Ingresá un porcentaje entre 0 y 100')
      return
    }
    setSaving(true)
    const result = await saveDigitalTaxRate(pct)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Configuración guardada')
    setPersisted(pct)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(String(persisted))
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Impuesto sobre medios digitales
        </Label>
        <div className="flex items-center gap-3">
          <p className="text-2xl font-semibold tabular-nums">{persisted}%</p>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" />
            <span className="ml-1.5">Editar</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se aplica sobre Tarjetas + QR + Online para calcular el neto a cobrar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="digital-tax">Impuesto sobre medios digitales (%)</Label>
      <div className="flex items-center gap-2 max-w-xs">
        <Input
          id="digital-tax"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-32"
          autoFocus
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button onClick={handleCancel} disabled={saving} size="sm" variant="ghost">
          Cancelar
        </Button>
      </div>
    </div>
  )
}
