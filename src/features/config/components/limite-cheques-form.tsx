'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveLimiteChequesMensual } from '../actions'

type Props = { initialValue: number }

// Formato con puntos de miles (sin decimales). Sólo dígitos en input.
function formatThousands(value: number | string): string {
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function parseThousands(formatted: string): number {
  return Number(formatted.replace(/\D/g, '')) || 0
}

export function LimiteChequesForm({ initialValue }: Props) {
  const [persisted, setPersisted] = useState(initialValue)
  const [draft, setDraft] = useState(formatThousands(initialValue))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const monto = parseThousands(draft)
    if (monto < 0) {
      toast.error('El monto no puede ser negativo')
      return
    }
    setSaving(true)
    const result = await saveLimiteChequesMensual(monto)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(monto > 0 ? 'Límite guardado' : 'Límite desactivado')
    setPersisted(monto)
    setDraft(formatThousands(monto))
    setEditing(false)
  }

  function handleCancel() {
    setDraft(formatThousands(persisted))
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tope de vencimientos por mes
        </Label>
        <div className="flex items-center gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {persisted > 0 ? `$${formatThousands(persisted)}` : (
              <span className="text-muted-foreground italic">sin límite</span>
            )}
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" />
            <span className="ml-1.5">Editar</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Suma de cheques cuyo vencimiento cae en el mes corriente. Alerta amarilla al 80%, roja al
          superar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="limite-cheques">Tope de vencimientos por mes (ARS)</Label>
      <div className="flex items-center gap-2 max-w-md">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          id="limite-cheques"
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(formatThousands(e.target.value))}
          placeholder="0 = sin límite"
          className="w-44 tabular-nums"
          autoFocus
        />
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
