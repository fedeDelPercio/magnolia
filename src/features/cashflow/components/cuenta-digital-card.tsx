'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDownIcon, ArrowUpIcon, ListIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { runWithResilience, classifyNetworkError } from '@/lib/network-resilience'
import { registrarEgresoDigital, registrarIngresoDigital, eliminarMovimientoDigital } from '../caja-mayor-actions'
import type { CuentaDigitalSummary } from '../cuenta-digital-queries'
import { AJUSTE_CATEGORIA, FONDO_EMERGENCIA_CATEGORIA } from '../constants'

type Props = { summary: CuentaDigitalSummary }

export function CuentaDigitalCard({ summary }: Props) {
  const [egresoOpen, setEgresoOpen] = useState(false)
  const [ingresoOpen, setIngresoOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const saldoTone = summary.saldo > 0
    ? 'text-emerald-700'
    : summary.saldo < 0
      ? 'text-red-600'
      : 'text-muted-foreground'

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dinero en cuenta digital</p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', saldoTone)}>
            {formatCurrency(summary.saldo)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            ventas netas (−{summary.costoProcesadorPct}% proc.) − transferencias
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailOpen(true)}>
            <ListIcon className="size-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setIngresoOpen(true)}>
            <ArrowUpIcon className="size-3 mr-0.5 text-emerald-700" />
            Ingreso
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEgresoOpen(true)}>
            <ArrowDownIcon className="size-3 mr-0.5 text-red-600" />
            Egreso
          </Button>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>+ {formatCurrency(summary.ingresosMes)} ing. mes</span>
        <span>− {formatCurrency(summary.egresosMes)} egr. mes</span>
      </div>

      <MovimientoDigitalDialog tipo="egreso" open={egresoOpen} onOpenChange={setEgresoOpen} />
      <MovimientoDigitalDialog tipo="ingreso" open={ingresoOpen} onOpenChange={setIngresoOpen} />
      <DetalleDialog open={detailOpen} onOpenChange={setDetailOpen} summary={summary} />
    </div>
  )
}

function DetalleDialog({
  open, onOpenChange, summary,
}: { open: boolean; onOpenChange: (v: boolean) => void; summary: CuentaDigitalSummary }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function attemptDelete(id: string, toastId: string | number): Promise<void> {
    try {
      const res = await runWithResilience(
        () => eliminarMovimientoDigital(id),
        { onRetrying: () => toast.loading('Sin señal — reintentando...', { id: toastId }) },
      )
      setDeletingId(null)
      if (res.error) { toast.error(res.error, { id: toastId }); return }
      toast.success('Eliminado — saldo restaurado', { id: toastId })
      router.refresh()
    } catch (err) {
      setDeletingId(null)
      toast.error(classifyNetworkError(err), {
        id: toastId,
        duration: 15_000,
        action: { label: 'Reintentar', onClick: () => attemptDelete(id, toast.loading('Reintentando...')) },
      })
    }
  }

  function handleDelete(id: string, descripcion: string, monto: number) {
    if (!confirm(`Eliminar "${descripcion}" por ${formatCurrency(monto)}?\n\nEl saldo va a volver a la cuenta digital.`)) return
    setDeletingId(id)
    const toastId = toast.loading(`Eliminando "${descripcion}"...`)
    startTransition(() => attemptDelete(id, toastId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle · Cuenta digital del mes</DialogTitle>
        </DialogHeader>
        {summary.movimientosMes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos en este mes.</p>
        ) : (
          <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
            {summary.movimientosMes.map((m) => {
              const busy = deletingId === m.id && isPending
              return (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'rounded-full p-1 shrink-0',
                    m.tipo === 'ingreso' ? 'bg-emerald-100' : 'bg-red-100',
                  )}>
                    {m.tipo === 'ingreso'
                      ? <ArrowUpIcon className="size-3 text-emerald-700" />
                      : <ArrowDownIcon className="size-3 text-red-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.descripcion}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(m.fecha)}
                      {m.source === 'traspaso_caja_mayor' && <span className="ml-1 text-sky-700">· caja mayor</span>}
                      {m.source === 'bistro_venta' && <span className="ml-1 text-sky-700">· Bistro</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'tabular-nums font-medium',
                    m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-600',
                  )}>
                    {m.tipo === 'ingreso' ? '+' : '−'} {formatCurrency(m.monto)}
                  </span>
                  {m.eliminable && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.descripcion, m.monto)}
                      disabled={busy}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      aria-label="Eliminar egreso"
                      title="Eliminar egreso"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Categorias que la card ofrece para egresos digitales. La default es
// "Egreso digital" (caso general: transferencia, MP, banco). "Pago a
// empleados" impacta labor cost en el dashboard.
const EGRESO_CATEGORIAS = [
  { value: 'Egreso digital', label: 'Egreso digital (default)' },
  { value: 'Pago a empleados', label: 'Pago a empleados' },
  { value: 'Pago a proveedores', label: 'Pago a proveedores' },
  { value: FONDO_EMERGENCIA_CATEGORIA, label: 'Fondo de emergencia (deriva al fondo)' },
  { value: AJUSTE_CATEGORIA, label: 'Ajuste de caja (corrección de saldo)' },
] as const

// El ingreso tiene solo dos categorías: plata que entró de verdad (default) o
// una corrección de saldo.
const INGRESO_CATEGORIAS = [
  { value: 'Ingreso digital', label: 'Ingreso digital (default)' },
  { value: AJUSTE_CATEGORIA, label: 'Ajuste de caja (corrección de saldo)' },
] as const

function MovimientoDigitalDialog({
  tipo, open, onOpenChange,
}: { tipo: 'ingreso' | 'egreso'; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const defaultCategoria = tipo === 'ingreso' ? 'Ingreso digital' : 'Egreso digital'
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<string>(defaultCategoria)

  const label = tipo === 'ingreso' ? 'ingreso' : 'egreso'
  const placeholder = tipo === 'ingreso'
    ? 'Ej: transferencia recibida, devolución, adelanto'
    : 'Ej: transferencia banco, MP, etc.'

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10))
    setMonto('')
    setDescripcion('')
    setCategoria(defaultCategoria)
  }

  async function submitPayload(payload: {
    fecha: string; monto: number; descripcion: string; categoria: string
  }, toastId: string | number): Promise<void> {
    try {
      const res = await runWithResilience(
        () => tipo === 'ingreso'
          ? registrarIngresoDigital(payload)
          : registrarEgresoDigital(payload),
        {
          onRetrying: () => toast.loading('Sin señal — reintentando...', { id: toastId }),
        },
      )
      if (res.error) { toast.error(res.error, { id: toastId }); return }
      toast.success(tipo === 'ingreso' ? 'Ingreso registrado' : `${payload.categoria} registrado`, { id: toastId })
      router.refresh()
    } catch (err) {
      toast.error(classifyNetworkError(err), {
        id: toastId,
        duration: 15_000,
        action: { label: 'Reintentar', onClick: () => submitPayload(payload, toast.loading('Reintentando...')) },
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) { toast.error('Monto inválido'); return }
    const descripcionFinal = descripcion.trim() || categoria
    const payload = { fecha, monto: m, descripcion: descripcionFinal, categoria }
    // Cerramos el modal al toque y disparamos la request en background con
    // retry automatico en fallos de red. El toast id se comparte entre
    // intentos para que el user vea un solo status.
    reset()
    onOpenChange(false)
    const toastId = toast.loading(
      `Registrando ${tipo === 'ingreso' ? 'ingreso' : 'egreso'} de ${formatCurrency(m)}...`,
    )
    await submitPayload(payload, toastId)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar {label} de cuenta digital</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dig-fecha">Fecha</Label>
            <Input id="dig-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dig-monto">Monto</Label>
            <Input id="dig-monto" type="number" min="0" step="0.01" placeholder="50000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dig-cat">Categoría</Label>
            <select
              id="dig-cat"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {(tipo === 'ingreso' ? INGRESO_CATEGORIAS : EGRESO_CATEGORIAS).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {categoria === 'Pago a empleados' && (
              <p className="text-[11px] text-emerald-700">
                Se suma al labor cost del dashboard.
              </p>
            )}
            {categoria === FONDO_EMERGENCIA_CATEGORIA && (
              <p className="text-[11px] text-amber-700">
                La plata se deriva al fondo de emergencia (sale de esta cuenta).
              </p>
            )}
            {categoria === AJUSTE_CATEGORIA && (
              <p className="text-[11px] text-sky-700">
                Corrige el saldo de la cuenta — no cuenta como {tipo === 'ingreso' ? 'ingreso' : 'gasto'} real del mes.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="dig-desc">Descripción (opcional)</Label>
            <Textarea id="dig-desc" placeholder={placeholder} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Registrar {label}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
