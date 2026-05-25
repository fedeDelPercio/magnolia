'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveDigitalTaxRate } from '../actions'

type Props = { initialValue: number }

export function DigitalTaxForm({ initialValue }: Props) {
  const [value, setValue] = useState(String(initialValue))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const pct = parseFloat(value)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Ingresá un porcentaje entre 0 y 100')
      return
    }
    setSaving(true)
    const result = await saveDigitalTaxRate(pct)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Configuración guardada')
    }
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button onClick={handleSave} disabled={saving} size="sm">
          Guardar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Se aplica sobre el total de Tarjetas + QR + Online para calcular el neto a cobrar.
      </p>
    </div>
  )
}
