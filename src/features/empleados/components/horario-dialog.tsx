'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

import { DOW_LABELS } from '../schemas'
import { saveHorario } from '../actions'
import type { EmpleadoHorario } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleadoId: string
  horarios: EmpleadoHorario[]
}

type Row = { activo: boolean; hora_inicio: string; hora_fin: string }

function buildInitialRows(horarios: EmpleadoHorario[]): Row[] {
  const next: Row[] = Array.from({ length: 7 }, () => ({
    activo: false,
    hora_inicio: '08:00',
    hora_fin: '16:00',
  }))
  for (const h of horarios) {
    // Si hay turnos partidos, mostramos sólo el primero del día. Editar múltiples queda fuera de scope.
    if (!next[h.dow]!.activo) {
      next[h.dow] = {
        activo: true,
        hora_inicio: h.hora_inicio.slice(0, 5),
        hora_fin: h.hora_fin.slice(0, 5),
      }
    }
  }
  return next
}

function HorarioDialogBody({
  empleadoId,
  horarios,
  onClose,
}: {
  empleadoId: string
  horarios: EmpleadoHorario[]
  onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() => buildInitialRows(horarios))
  const [pending, startTransition] = useTransition()

  function updateRow(dow: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === dow ? { ...r, ...patch } : r)))
  }

  function save() {
    const payload = rows
      .map((r, dow) => ({ dow, ...r }))
      .filter((r) => r.activo)
      .map(({ dow, hora_inicio, hora_fin }) => ({ dow, hora_inicio, hora_fin }))

    startTransition(async () => {
      const result = await saveHorario(empleadoId, payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Horario actualizado')
      onClose()
    })
  }

  return (
    <>
      <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
        {DOW_LABELS.map((label, dow) => {
          const r = rows[dow]!
          return (
            <div key={dow} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 rounded-md border p-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={r.activo} onCheckedChange={(v) => updateRow(dow, { activo: Boolean(v) })} />
                <span className="w-20">{label}</span>
              </label>
              <Input
                type="time"
                value={r.hora_inicio}
                onChange={(e) => updateRow(dow, { hora_inicio: e.target.value })}
                disabled={!r.activo}
              />
              <span className="text-center text-muted-foreground">a</span>
              <Input
                type="time"
                value={r.hora_fin}
                onChange={(e) => updateRow(dow, { hora_fin: e.target.value })}
                disabled={!r.activo}
              />
            </div>
          )
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function HorarioDialog({ open, onOpenChange, empleadoId, horarios }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar horario semanal</DialogTitle>
        </DialogHeader>
        {open && (
          <HorarioDialogBody
            empleadoId={empleadoId}
            horarios={horarios}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
