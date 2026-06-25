'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, ArrowDownIcon, ArrowUpIcon, ListIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { registrarEgresoDigital } from '../caja-mayor-actions'
import type { CuentaDigitalSummary } from '../cuenta-digital-queries'

type Props = { summary: CuentaDigitalSummary }

export function CuentaDigitalCard({ summary }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
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
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDialogOpen(true)}>
            <PlusIcon className="size-3 mr-0.5" />
            Egreso
          </Button>
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>+ {formatCurrency(summary.ingresosMes)} ing. mes</span>
        <span>− {formatCurrency(summary.egresosMes)} egr. mes</span>
      </div>

      <EgresoDigitalDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <DetalleDialog open={detailOpen} onOpenChange={setDetailOpen} summary={summary} />
    </div>
  )
}

function DetalleDialog({
  open, onOpenChange, summary,
}: { open: boolean; onOpenChange: (v: boolean) => void; summary: CuentaDigitalSummary }) {
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
            {summary.movimientosMes.map((m) => (
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
                <span className={cn(
                  'tabular-nums font-medium shrink-0',
                  m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-600',
                )}>
                  {m.tipo === 'ingreso' ? '+' : '−'} {formatCurrency(m.monto)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EgresoDigitalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
    const res = await registrarEgresoDigital({ fecha, monto: m, descripcion: descripcion.trim() || 'Egreso digital' })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Egreso digital registrado')
    reset()
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar egreso de cuenta digital</DialogTitle>
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
            <Label htmlFor="dig-desc">Descripción (opcional)</Label>
            <Textarea id="dig-desc" placeholder="Ej: transferencia banco, MP, etc." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
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
