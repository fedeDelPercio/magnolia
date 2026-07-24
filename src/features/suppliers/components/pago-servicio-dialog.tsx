'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { createPagoServicio } from '../actions'
import { PAGO_METODOS, METODO_LABELS, type PagoMetodo } from '../schemas'
import type { ConceptoServicio, SaldoProveedor } from '../queries'

function isPagoMetodo(v: string | null): v is PagoMetodo {
  return !!v && (PAGO_METODOS as readonly string[]).includes(v)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedor: SaldoProveedor
  conceptos: ConceptoServicio[]
}

const NONE_CONCEPT = '__none__'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function PagoServicioDialog({ open, onOpenChange, proveedor, conceptos }: Props) {
  const [fecha, setFecha] = useState(todayStr())
  const [conceptoId, setConceptoId] = useState<string>(NONE_CONCEPT)
  const [montoStr, setMontoStr] = useState('')
  const [metodo, setMetodo] = useState<PagoMetodo>(() =>
    isPagoMetodo(proveedor.metodo_pago_default) ? proveedor.metodo_pago_default : 'transferencia',
  )
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const metodoDefault = proveedor.metodo_pago_default
  useEffect(() => {
    if (open) {
      setFecha(todayStr())
      // Si hay un solo concepto, lo dejamos pre-seleccionado — flujo típico
      // (ej. proveedor de un solo servicio como Fibertel = Internet).
      setConceptoId(conceptos.length === 1 ? conceptos[0]!.id : NONE_CONCEPT)
      setMontoStr('')
      setMetodo(isPagoMetodo(metodoDefault) ? metodoDefault : 'transferencia')
      setNotas('')
    }
  }, [open, conceptos, metodoDefault])

  async function handleSubmit() {
    const monto = parseFloat(montoStr)
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingresá un monto mayor a 0')
      return
    }
    setSaving(true)
    const result = await createPagoServicio(proveedor.id, {
      fecha,
      monto,
      metodo,
      concepto_id: conceptoId === NONE_CONCEPT ? null : conceptoId,
      notas: notas || undefined,
      // Los pagos de servicio siempre generan un egreso en caja mayor —
      // no hay caso practico donde interese cargar el pago sin egreso.
      generar_egreso_caja: true,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Pago registrado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo pago — {proveedor.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Monto</label>
              <CurrencyInput
                value={montoStr}
                onValueChange={setMontoStr}
                placeholder="0"
              />
            </div>
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

          <div className="space-y-1">
            <label className="text-sm font-medium">Concepto</label>
            <Select value={conceptoId} onValueChange={(v) => setConceptoId(v ?? NONE_CONCEPT)}>
              <SelectTrigger>
                <SelectValue>
                  {conceptoId === NONE_CONCEPT
                    ? 'Sin concepto'
                    : conceptos.find((c) => c.id === conceptoId)?.name ?? 'Sin concepto'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_CONCEPT} label="Sin concepto">
                  Sin concepto
                </SelectItem>
                {conceptos.map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Elegir concepto permite trackear la evolución del precio en el tiempo. Si no hay,
              podés cargarlo desde &quot;Nuevo concepto&quot; antes.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Input
              placeholder="Ej: factura 0001-00000123, período junio 2026"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !montoStr}>
            {saving ? 'Guardando...' : 'Registrar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
