'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { createPagoServicio } from '../actions'
import { PAGO_METODOS, METODO_LABELS, type PagoMetodo, type PagoServicioEstado } from '../schemas'
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
  // 'pendiente' = la factura ya está pero todavía no se pagó. No genera egreso
  // en caja hasta que se salde.
  const [estado, setEstado] = useState<PagoServicioEstado>('pagado')
  const [fecha, setFecha] = useState(todayStr())
  const [vencimiento, setVencimiento] = useState('')
  const [conceptoId, setConceptoId] = useState<string>(NONE_CONCEPT)
  const [montoStr, setMontoStr] = useState('')
  const [metodo, setMetodo] = useState<PagoMetodo>(() =>
    isPagoMetodo(proveedor.metodo_pago_default) ? proveedor.metodo_pago_default : 'transferencia',
  )
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const pendiente = estado === 'pendiente'

  const metodoDefault = proveedor.metodo_pago_default
  useEffect(() => {
    if (open) {
      setEstado('pagado')
      setFecha(todayStr())
      setVencimiento('')
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
      estado,
      vencimiento: pendiente ? (vencimiento || null) : null,
      // Los pagos ya hechos generan el egreso en caja mayor al guardarse; los
      // pendientes no lo generan hasta que se saldan.
      generar_egreso_caja: true,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(pendiente ? 'Pago pendiente registrado' : 'Pago registrado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo pago — {proveedor.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Ya pagado vs pendiente: define si el egreso impacta ahora en caja.
              El riel va en `bg-secondary`, un tono por debajo del fondo del
              dialog (que es `surface`): sin ese contraste la opción no elegida
              parecía un texto suelto y no se leía como botón. */}
          <div className="inline-flex w-full items-center gap-0.5 rounded-full bg-secondary p-1 ring-1 ring-border/50">
            {([
              ['pagado', 'Ya lo pagué'],
              ['pendiente', 'Queda pendiente'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setEstado(value)}
                aria-pressed={estado === value}
                className={cn(
                  'flex-1 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  estado === value
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {pendiente ? 'Fecha de la factura' : 'Fecha'}
              </label>
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

          {pendiente ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Vencimiento (opcional)</label>
              <Input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Queda listado como pendiente hasta que lo saldes. El egreso en caja se registra
                recién ahí, con la fecha en que lo pagues y el método que elijas.
              </p>
            </div>
          ) : (
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
          )}

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
            {saving ? 'Guardando...' : pendiente ? 'Registrar pendiente' : 'Registrar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
