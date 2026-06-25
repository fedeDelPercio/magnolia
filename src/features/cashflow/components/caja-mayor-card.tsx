'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, MinusIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon, ListIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  registrarEgresoCajaMayor,
  registrarIngresoCajaMayor,
  deleteCajaMayorMovimiento,
} from '../caja-mayor-actions'
import type { CajaMayorMovimiento, CajaMayorSummary } from '../caja-mayor-queries'

type Props = { summary: CajaMayorSummary; month: string }

const ORIGEN_LABEL: Record<CajaMayorMovimiento['origen'], string> = {
  externo: 'externo',
  caja_efectivo: 'caja efectivo',
  cuenta_digital: 'cuenta digital',
}

export function CajaMayorCard({ summary }: Props) {
  const [ingresoOpen, setIngresoOpen] = useState(false)
  const [egresoOpen, setEgresoOpen] = useState(false)
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
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caja mayor</p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', saldoTone)}>
            {formatCurrency(summary.saldo)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            tesorería fuera del POS
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailOpen(true)}>
            <ListIcon className="size-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setIngresoOpen(true)}>
            <PlusIcon className="size-3 mr-0.5" />
            In
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEgresoOpen(true)}>
            <MinusIcon className="size-3 mr-0.5" />
            Eg
          </Button>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>+ {formatCurrency(summary.ingresosMes)} ing. mes</span>
        <span>− {formatCurrency(summary.egresosMes)} egr. mes</span>
      </div>

      <IngresoDialog open={ingresoOpen} onOpenChange={setIngresoOpen} />
      <EgresoDialog open={egresoOpen} onOpenChange={setEgresoOpen} />
      <DetalleDialog open={detailOpen} onOpenChange={setDetailOpen} summary={summary} />
    </div>
  )
}

function DetalleDialog({
  open, onOpenChange, summary,
}: { open: boolean; onOpenChange: (v: boolean) => void; summary: CajaMayorSummary }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle · Caja Mayor del mes</DialogTitle>
        </DialogHeader>
        {summary.movimientosMes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos en este mes.</p>
        ) : (
          <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
            {summary.movimientosMes.map((m) => (
              <MovimientoRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MovimientoRow({ m }: { m: CajaMayorMovimiento }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
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
            <p className="font-medium truncate">{m.descripcion ?? '(sin descripción)'}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatDate(m.fecha)}
              {m.tipo === 'ingreso' && m.origen !== 'externo' && (
                <span className="ml-1 text-sky-700">· desde {ORIGEN_LABEL[m.origen]}</span>
              )}
              {m.source === 'bistro' && <span className="ml-1 text-sky-700">· auto Bistro</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn(
            'tabular-nums font-medium',
            m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-600',
          )}>
            {m.tipo === 'ingreso' ? '+' : '−'} {formatCurrency(m.monto)}
          </span>
          {m.source === 'manual' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              title="Borrar movimiento"
            >
              <TrashIcon className="size-3" />
            </Button>
          )}
        </div>
      </div>
      <DeleteMovimientoDialog open={deleteOpen} onOpenChange={setDeleteOpen} m={m} />
    </>
  )
}

// Dialog explicito de borrado que muestra el EFECTO de la operacion sobre las
// otras cuentas para que el user no tenga que adivinar. Ej: si borro un
// ingreso con origen=cuenta_digital, aviso que la plata "vuelve" a digital.
function DeleteMovimientoDialog({
  open, onOpenChange, m,
}: { open: boolean; onOpenChange: (v: boolean) => void; m: CajaMayorMovimiento }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteCajaMayorMovimiento(m.id)
    setDeleting(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Movimiento borrado')
    onOpenChange(false)
    router.refresh()
  }

  const efectoCajaMayor = m.tipo === 'ingreso'
    ? `Caja mayor: − ${formatCurrency(m.monto)}`
    : `Caja mayor: + ${formatCurrency(m.monto)}`

  const efectoOrigen = m.tipo === 'ingreso' && m.origen !== 'externo'
    ? m.origen === 'caja_efectivo'
      ? `Caja efectivo: + ${formatCurrency(m.monto)} (vuelve la plata)`
      : `Cuenta digital: + ${formatCurrency(m.monto)} (vuelve la plata)`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Borrar este movimiento?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">{m.descripcion ?? '(sin descripción)'}</p>
            <p className="text-muted-foreground mt-0.5">
              {formatDate(m.fecha)} · {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de {formatCurrency(m.monto)}
              {m.tipo === 'ingreso' && m.origen !== 'externo' && ` desde ${ORIGEN_LABEL[m.origen]}`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Efecto</p>
            <p className="text-xs">{efectoCajaMayor}</p>
            {efectoOrigen && <p className="text-xs">{efectoOrigen}</p>}
            {!efectoOrigen && m.tipo === 'ingreso' && (
              <p className="text-xs text-muted-foreground">
                (no afecta otras cuentas — fue un ingreso externo)
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Borrando...' : 'Borrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EgresoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10))
    setMonto('')
    setDescripcion('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await registrarEgresoCajaMayor({ fecha, monto: m, descripcion: descripcion.trim() || null })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Egreso registrado')
    reset()
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar egreso de Caja Mayor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cm-eg-fecha">Fecha</Label>
            <Input id="cm-eg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-eg-monto">Monto</Label>
            <Input id="cm-eg-monto" type="number" min="0" step="0.01" placeholder="50000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-eg-desc">Descripción (opcional)</Label>
            <Textarea id="cm-eg-desc" placeholder="Ej: pago alquiler junio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar egreso'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IngresoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [origen, setOrigen] = useState<'externo' | 'caja_efectivo' | 'cuenta_digital'>('caja_efectivo')
  const [saving, setSaving] = useState(false)

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10))
    setMonto('')
    setDescripcion('')
    setOrigen('caja_efectivo')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await registrarIngresoCajaMayor({
      fecha,
      monto: m,
      descripcion: descripcion.trim() || null,
      origen,
    })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Ingreso registrado')
    reset()
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar ingreso a Caja Mayor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cm-in-origen">De dónde sale el dinero</Label>
            <select
              id="cm-in-origen"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={origen}
              onChange={(e) => setOrigen(e.target.value as typeof origen)}
            >
              <option value="caja_efectivo">Caja efectivo (Bistro)</option>
              <option value="cuenta_digital">Cuenta digital</option>
              <option value="externo">Externo (aporte, préstamo, etc.)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              {origen === 'caja_efectivo' && 'Se descuenta del saldo de caja efectivo.'}
              {origen === 'cuenta_digital' && 'Se descuenta del saldo de cuenta digital.'}
              {origen === 'externo' && 'No descuenta de otra cuenta — entra desde afuera.'}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-in-fecha">Fecha</Label>
            <Input id="cm-in-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-in-monto">Monto</Label>
            <Input id="cm-in-monto" type="number" min="0" step="0.01" placeholder="50000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cm-in-desc">Descripción (opcional)</Label>
            <Textarea id="cm-in-desc" placeholder="Ej: cierre de caja del 24/06" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar ingreso'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
