'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { abrirDia } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
}

export function CargarDiaDialog({ open, onOpenChange, today }: Props) {
  const router = useRouter()
  const [fecha, setFecha] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setFecha('')
  }, [open])

  async function handleSubmit() {
    if (!fecha) return
    setLoading(true)
    const result = await abrirDia(fecha)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.id) {
      onOpenChange(false)
      router.push(`/operacion/${result.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cargar otro día</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha</label>
            <Input
              type="date"
              max={today}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si ya existe, te llevamos directo. Si no, lo creamos.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!fecha || loading}>
              {loading ? 'Abriendo...' : 'Continuar'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
