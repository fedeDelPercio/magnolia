'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createConceptoServicio, updateConceptoServicio } from '../actions'
import type { ConceptoServicio } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedorId: string
  editing: ConceptoServicio | null
}

export function ConceptoServicioDialog({ open, onOpenChange, proveedorId, editing }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(editing?.name ?? '')
  }, [open, editing])

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Ingresá un nombre')
      return
    }
    setSaving(true)
    const result = editing
      ? await updateConceptoServicio(editing.id, { name: trimmed })
      : await createConceptoServicio(proveedorId, { name: trimmed })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(editing ? 'Concepto actualizado' : 'Concepto creado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar concepto' : 'Nuevo concepto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre</label>
          <Input
            autoFocus
            placeholder="Ej: Internet 500MB, Luz Bimestral, Gas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            El concepto agrupa pagos para trackear cómo evoluciona su precio en el tiempo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
