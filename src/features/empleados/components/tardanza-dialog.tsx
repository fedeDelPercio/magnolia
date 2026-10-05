'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { createTardanza } from '../actions'
import { tardanzaSchema } from '../schemas'
import { formatMinutos } from '../lib/descuentos-plus'

type HorarioMin = { dow: number; hora_inicio: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Con un solo empleado (ficha) va fijo; con varios (asistencia) se elige.
  empleados: { id: string; name: string; horarios: HorarioMin[] }[]
  empleadoIdFijo?: string
}

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dowDe(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y!, m! - 1, d!).getDay()
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

const ATAJOS = [10, 15, 30, 60]

// Se monta recién al abrirse: cada apertura arranca limpia.
export function TardanzaDialog({ open, onOpenChange, empleados, empleadoIdFijo }: Props) {
  const [empleadoId, setEmpleadoId] = useState(empleadoIdFijo ?? '')
  const [fecha, setFecha] = useState(hoyLocal)
  const [llegada, setLlegada] = useState('')
  const [minutosStr, setMinutosStr] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const empleado = empleados.find((e) => e.id === empleadoId)
  // Hora de entrada de ese día según su horario (la primera franja).
  const entrada = empleado && fecha
    ? empleado.horarios
        .filter((h) => h.dow === dowDe(fecha))
        .map((h) => h.hora_inicio.slice(0, 5))
        .sort()[0]
    : undefined

  function entradaDe(empId: string, f: string): string | undefined {
    const e = empleados.find((x) => x.id === empId)
    if (!e || !f) return undefined
    return e.horarios
      .filter((h) => h.dow === dowDe(f))
      .map((h) => h.hora_inicio.slice(0, 5))
      .sort()[0]
  }

  // Minutos desde la hora de entrada de ese día. Se recalcula al cambiar la
  // hora, la fecha o el empleado (cada día puede tener otro horario).
  function recalcular(empId: string, f: string, hora: string) {
    const ent = entradaDe(empId, f)
    if (hora && ent) {
      const diff = aMinutos(hora) - aMinutos(ent)
      setMinutosStr(diff > 0 ? String(diff) : '')
    }
  }

  function onLlegada(v: string) {
    setLlegada(v)
    recalcular(empleadoId, fecha, v)
  }

  const minutos = parseInt(minutosStr, 10)

  async function handleSubmit() {
    if (!empleadoId) {
      toast.error('Elegí el empleado')
      return
    }
    const parsed = tardanzaSchema.safeParse({ fecha, minutos, notas: notas || undefined })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Revisá los datos')
      return
    }
    setSaving(true)
    const result = await createTardanza(empleadoId, parsed.data)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Llegada tarde registrada')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Llegada tarde{empleadoIdFijo && empleado ? ` — ${empleado.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!empleadoIdFijo && (
            <div className="space-y-1">
              <label htmlFor="tardanza-empleado" className="text-sm font-medium">Empleado</label>
              <select
                id="tardanza-empleado"
                value={empleadoId}
                onChange={(e) => {
                  setEmpleadoId(e.target.value)
                  recalcular(e.target.value, fecha, llegada)
                }}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Elegí…</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="tardanza-fecha" className="text-sm font-medium">Fecha</label>
              <Input
                id="tardanza-fecha"
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value)
                  recalcular(empleadoId, e.target.value, llegada)
                }}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="tardanza-llegada" className="text-sm font-medium">Llegó a las</label>
              <Input
                id="tardanza-llegada"
                type="time"
                value={llegada}
                onChange={(e) => onLlegada(e.target.value)}
                disabled={!entrada}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {entrada
              ? `Ese día entra a las ${entrada}. Con la hora de llegada se calculan los minutos.`
              : empleado
                ? 'Ese día no tiene horario cargado: poné los minutos a mano.'
                : 'Elegí el empleado para ver su horario.'}
          </p>

          <div className="space-y-1">
            <label htmlFor="tardanza-minutos" className="text-sm font-medium">Minutos tarde</label>
            <div className="flex items-center gap-2">
              <Input
                id="tardanza-minutos"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={minutosStr}
                onChange={(e) => setMinutosStr(e.target.value)}
                placeholder="0"
                className="w-24"
              />
              {ATAJOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutosStr(String(m))}
                  className={cn(
                    'cursor-pointer rounded-full px-2.5 py-1 text-xs ring-1 ring-border transition-colors hover:bg-muted',
                    minutos === m && 'bg-foreground text-background ring-foreground hover:bg-foreground',
                  )}
                >
                  {m < 60 ? `${m}'` : '1 h'}
                </button>
              ))}
            </div>
            {minutos > 0 && (
              <p className="text-xs text-muted-foreground">Queda debiendo {formatMinutos(minutos)}.</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="tardanza-notas" className="text-sm font-medium">Notas (opcional)</label>
            <Input
              id="tardanza-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: avisó que venía tarde"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !empleadoId || !(minutos > 0)}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
