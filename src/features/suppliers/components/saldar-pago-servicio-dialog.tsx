'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format'

import { saldarPagoServicio } from '../actions'
import { PAGO_METODOS, METODO_LABELS, type PagoMetodo } from '../schemas'
import type { PagoServicio } from '../queries'

function isPagoMetodo(v: string | null): v is PagoMetodo {
  return !!v && (PAGO_METODOS as readonly string[]).includes(v)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pago: PagoServicio | null
  // Metodo habitual del proveedor: precarga el select para ahorrar un click.
  metodoDefault: string | null
}

export function SaldarPagoServicioDialog({ open, onOpenChange, pago, metodoDefault }: Props) {
  const [fecha, setFecha] = useState(todayStr())
  const [metodo, setMetodo] = useState<PagoMetodo>('transferencia')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFecha(todayStr())
      setMetodo(isPagoMetodo(metodoDefault) ? metodoDefault : 'transferencia')
    }
  }, [open, metodoDefault])

  if (!pago) return null

  async function handleSubmit() {
    if (!pago) return
    setSaving(true)
    const result = await saldarPagoServicio(pago.id, { fecha, metodo })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Pago saldado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Saldar pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-surface px-3 py-2.5">
            <p className="text-sm font-medium">
              {pago.concepto?.name ?? 'Sin concepto'} · {formatCurrency(pago.monto)}
            </p>
            <p className="text-xs text-muted-foreground">
              Factura del {formatDate(pago.fecha)}
              {pago.vencimiento && ` · vence ${formatDate(pago.vencimiento)}`}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Fecha de pago</label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              El egreso en caja se registra con esta fecha.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Método de pago</label>
            <Select value={metodo} onValueChange={(v) => { if (isPagoMetodo(v)) setMetodo(v) }}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => (v ? METODO_LABELS[v] ?? v : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGO_METODOS.map((m) => (
                  <SelectItem key={m} value={m} label={METODO_LABELS[m]}>
                    {METODO_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {metodo === 'transferencia' && (
              <p className="text-xs text-muted-foreground">
                Se descuenta de Medios Digitales.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Saldar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
