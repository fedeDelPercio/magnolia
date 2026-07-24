'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  PlusIcon, MinusIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon, ListIcon, ShieldIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { crearCajaCategoria } from '../caja-mayor-actions'
import {
  registrarIngresoFondo,
  registrarEgresoFondo,
  deleteFondoMovimiento,
} from '../fondo-emergencia-actions'
import type { FondoEmergenciaMovimiento, FondoEmergenciaSummary } from '../fondo-emergencia-queries'

type Origen = FondoEmergenciaMovimiento['origen']

const ORIGEN_LABEL: Record<Origen, string> = {
  externo: 'aporte externo',
  caja_efectivo: 'caja mayor',
  cuenta_digital: 'medios digitales',
}

type Props = { summary: FondoEmergenciaSummary; categorias: string[] }

export function FondoEmergenciaCard({ summary, categorias }: Props) {
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
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <ShieldIcon className="size-3 text-amber-600" />
            Fondo de emergencia
          </p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', saldoTone)}>
            {formatCurrency(summary.saldo)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            reserva para imprevistos
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

      <IngresoFondoDialog open={ingresoOpen} onOpenChange={setIngresoOpen} />
      <EgresoFondoDialog open={egresoOpen} onOpenChange={setEgresoOpen} categorias={categorias} />
      <DetalleDialog open={detailOpen} onOpenChange={setDetailOpen} summary={summary} />
    </div>
  )
}

// Boton reutilizable para "Derivar a fondo" desde otra cuenta (Caja Mayor /
// Medios Digitales). Crea un ingreso al fondo con el origen fijo de esa cuenta.
export function DerivarFondoButton({ origen, label }: { origen: Exclude<Origen, 'externo'>; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <ShieldIcon className="size-3 mr-0.5 text-amber-600" />
        {label ?? 'A fondo'}
      </Button>
      <IngresoFondoDialog open={open} onOpenChange={setOpen} origenFijo={origen} />
    </>
  )
}

function DetalleDialog({
  open, onOpenChange, summary,
}: { open: boolean; onOpenChange: (v: boolean) => void; summary: FondoEmergenciaSummary }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle · Fondo de emergencia del mes</DialogTitle>
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

function MovimientoRow({ m }: { m: FondoEmergenciaMovimiento }) {
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
              {m.categoria && (
                <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-foreground">
                  {m.categoria}
                </span>
              )}
              {m.tipo === 'ingreso' && m.origen !== 'externo' && (
                <span className="ml-1 text-sky-700">· desde {ORIGEN_LABEL[m.origen]}</span>
              )}
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
        </div>
      </div>
      <DeleteMovimientoDialog open={deleteOpen} onOpenChange={setDeleteOpen} m={m} />
    </>
  )
}

function DeleteMovimientoDialog({
  open, onOpenChange, m,
}: { open: boolean; onOpenChange: (v: boolean) => void; m: FondoEmergenciaMovimiento }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteFondoMovimiento(m.id)
    setDeleting(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Movimiento borrado')
    onOpenChange(false)
    router.refresh()
  }

  const efectoFondo = m.tipo === 'ingreso'
    ? `Fondo: − ${formatCurrency(m.monto)}`
    : `Fondo: + ${formatCurrency(m.monto)}`

  const efectoOrigen = m.tipo === 'ingreso' && m.origen !== 'externo'
    ? `${ORIGEN_LABEL[m.origen] === 'caja mayor' ? 'Caja mayor' : 'Medios digitales'}: + ${formatCurrency(m.monto)} (vuelve la plata)`
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
            <p className="text-xs">{efectoFondo}</p>
            {efectoOrigen && <p className="text-xs">{efectoOrigen}</p>}
            {!efectoOrigen && m.tipo === 'ingreso' && (
              <p className="text-xs text-muted-foreground">
                (no afecta otras cuentas — fue un aporte externo)
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

function IngresoFondoDialog({
  open, onOpenChange, origenFijo,
}: { open: boolean; onOpenChange: (v: boolean) => void; origenFijo?: Exclude<Origen, 'externo'> }) {
  const router = useRouter()
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [origen, setOrigen] = useState<Origen>(origenFijo ?? 'externo')
  const [saving, setSaving] = useState(false)

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10))
    setMonto('')
    setDescripcion('')
    setOrigen(origenFijo ?? 'externo')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await registrarIngresoFondo({
      fecha,
      monto: m,
      descripcion: descripcion.trim() || null,
      origen,
    })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Ingreso al fondo registrado')
    reset()
    onOpenChange(false)
    router.refresh()
  }

  const title = origenFijo ? 'Derivar a fondo de emergencia' : 'Registrar ingreso al fondo'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!origenFijo && (
            <div className="space-y-1">
              <Label htmlFor="fe-in-origen">De dónde sale el dinero</Label>
              <select
                id="fe-in-origen"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={origen}
                onChange={(e) => setOrigen(e.target.value as Origen)}
              >
                <option value="externo">Externo (aporte, ahorro, etc.)</option>
                <option value="caja_efectivo">Caja Mayor</option>
                <option value="cuenta_digital">Medios Digitales</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                {origen === 'externo' && 'No descuenta de otra cuenta — entra desde afuera.'}
                {origen === 'caja_efectivo' && 'Se descuenta del saldo de Caja Mayor.'}
                {origen === 'cuenta_digital' && 'Se descuenta del saldo de Medios Digitales.'}
              </p>
            </div>
          )}
          {origenFijo && (
            <p className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              Se descuenta de {origenFijo === 'caja_efectivo' ? 'Caja Mayor' : 'Medios Digitales'} y suma al fondo.
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="fe-in-fecha">Fecha</Label>
            <Input id="fe-in-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fe-in-monto">Monto</Label>
            <Input id="fe-in-monto" type="number" min="0" step="0.01" placeholder="50000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fe-in-desc">Descripción (opcional)</Label>
            <Textarea id="fe-in-desc" placeholder="Ej: reserva del mes" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : origenFijo ? 'Derivar' : 'Registrar ingreso'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EgresoFondoDialog({
  open, onOpenChange, categorias,
}: { open: boolean; onOpenChange: (v: boolean) => void; categorias: string[] }) {
  const router = useRouter()
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [addingCategoria, setAddingCategoria] = useState(false)
  const [newCategoria, setNewCategoria] = useState('')
  const [savingCategoria, setSavingCategoria] = useState(false)
  const [localCategorias, setLocalCategorias] = useState(categorias)
  const [saving, setSaving] = useState(false)

  function reset() {
    setFecha(new Date().toISOString().slice(0, 10))
    setMonto('')
    setDescripcion('')
    setCategoria('')
    setAddingCategoria(false)
    setNewCategoria('')
  }

  async function handleAddCategoria() {
    const clean = newCategoria.trim()
    if (!clean) return
    setSavingCategoria(true)
    const res = await crearCajaCategoria(clean)
    setSavingCategoria(false)
    if (res.error || !res.name) {
      toast.error(res.error ?? 'No se pudo crear')
      return
    }
    if (!localCategorias.some((c) => c.toLowerCase() === res.name!.toLowerCase())) {
      setLocalCategorias([...localCategorias, res.name].sort((a, b) => a.localeCompare(b)))
    }
    setCategoria(res.name)
    setAddingCategoria(false)
    setNewCategoria('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await registrarEgresoFondo({
      fecha,
      monto: m,
      descripcion: descripcion.trim() || null,
      categoria: categoria.trim() || null,
    })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Egreso del fondo registrado')
    reset()
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar egreso del fondo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fe-eg-fecha">Fecha</Label>
            <Input id="fe-eg-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fe-eg-monto">Monto</Label>
            <Input id="fe-eg-monto" type="number" min="0" step="0.01" placeholder="50000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="fe-eg-cat">Categoría (opcional)</Label>
              {!addingCategoria && (
                <button
                  type="button"
                  onClick={() => setAddingCategoria(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Nueva
                </button>
              )}
            </div>
            {addingCategoria ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  placeholder="Ej: Mejora en maquinaria"
                  value={newCategoria}
                  onChange={(e) => setNewCategoria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddCategoria() }
                    if (e.key === 'Escape') { setAddingCategoria(false); setNewCategoria('') }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCategoria}
                  disabled={savingCategoria || !newCategoria.trim()}
                >
                  {savingCategoria ? '...' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddingCategoria(false); setNewCategoria('') }}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <select
                id="fe-eg-cat"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— Sin categoría —</option>
                {localCategorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="fe-eg-desc">Descripción (opcional)</Label>
            <Textarea id="fe-eg-desc" placeholder="Ej: reparación heladera" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
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
