'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { TIPO_AUSENCIA_LABELS } from '../schemas'
import { deleteAusencia } from '../actions'
import { AusenciaQuickDialog } from './ausencia-quick-dialog'
import type { AusenciaConEmpleado } from '../queries'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 1) return `${y! - 1}-12`
  return `${y}-${String(mo! - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 12) return `${y! + 1}-01`
  return `${y}-${String(mo! + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return `${MESES[mo! - 1]} ${y}`
}

const TIPO_TONE: Record<string, string> = {
  justificada: 'border-sky-200 bg-sky-50 text-sky-700',
  injustificada: 'border-rose-200 bg-rose-50 text-rose-700',
  enfermedad: 'border-amber-200 bg-amber-50 text-amber-700',
  feriado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  licencia: 'border-violet-200 bg-violet-50 text-violet-700',
}

type Props = {
  ausencias: AusenciaConEmpleado[]
  empleados: { id: string; name: string }[]
  month: string
}

export function AsistenciaClient({ ausencias, empleados, month }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroEmpleado, setFiltroEmpleado] = useState<string>('todos')
  const [, startTransition] = useTransition()

  function navigate(m: string) {
    router.push(`/empleados/asistencia?month=${m}`)
  }

  const filtered = useMemo(() => {
    return ausencias.filter((a) => {
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false
      if (filtroEmpleado !== 'todos' && a.empleado_id !== filtroEmpleado) return false
      return true
    })
  }, [ausencias, filtroTipo, filtroEmpleado])

  // Agrupar por fecha
  const grouped = useMemo(() => {
    const map = new Map<string, AusenciaConEmpleado[]>()
    for (const a of filtered) {
      const arr = map.get(a.fecha) ?? []
      arr.push(a)
      map.set(a.fecha, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const counters = useMemo(() => {
    const c: Record<string, number> = { justificada: 0, injustificada: 0, enfermedad: 0, feriado: 0, licencia: 0 }
    for (const a of ausencias) c[a.tipo] = (c[a.tipo] ?? 0) + 1
    return c
  }, [ausencias])

  const today = new Date().toISOString().slice(0, 7)

  function handleDelete(id: string, empleadoId: string) {
    if (!confirm('¿Eliminar esta ausencia?')) return
    startTransition(async () => {
      const r = await deleteAusencia(id, empleadoId)
      if (r.error) toast.error(r.error)
      else toast.success('Ausencia eliminada')
    })
  }

  return (
    <div className="space-y-4">
      {/* Month nav + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(prevMonth(month))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="text-base font-semibold w-40 text-center">{monthLabel(month)}</h2>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => navigate(nextMonth(month))}
            disabled={month >= today}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="size-4" />
          Registrar ausencia
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(['justificada','injustificada','enfermedad','feriado','licencia'] as const).map((t) => (
          <div key={t} className={cn('rounded-lg border p-3 text-sm', TIPO_TONE[t])}>
            <p className="text-[10px] uppercase tracking-wider opacity-70">{TIPO_AUSENCIA_LABELS[t]}</p>
            <p className="mt-1 num-editorial text-xl leading-none tabular-nums">{counters[t] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="todos">Todos los tipos</option>
          {(['justificada','injustificada','enfermedad','feriado','licencia'] as const).map((t) => (
            <option key={t} value={t}>{TIPO_AUSENCIA_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filtroEmpleado}
          onChange={(e) => setFiltroEmpleado(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="todos">Todos los empleados</option>
          {empleados.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} ausencia{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Lista agrupada por fecha */}
      {grouped.length === 0 ? (
        <div className="card-editorial p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sin ausencias registradas en {monthLabel(month)}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            La asistencia se asume por defecto — solo se registran las excepciones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([fecha, items]) => (
            <div key={fecha} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 text-xs">
                <span className="font-medium tabular-nums">{fecha}</span>
                <span className="text-muted-foreground">{items.length} ausencia{items.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="divide-y text-sm">
                {items.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/empleados/${a.empleado_id}`}
                        className="font-medium hover:underline"
                      >
                        {a.empleado_name}
                      </Link>
                      <Badge variant="outline" className={cn('text-[10px]', TIPO_TONE[a.tipo])}>
                        {TIPO_AUSENCIA_LABELS[a.tipo as keyof typeof TIPO_AUSENCIA_LABELS]}
                      </Badge>
                      {a.paga && (
                        <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                          paga
                        </Badge>
                      )}
                      {a.notas && (
                        <span className="text-xs text-muted-foreground truncate">{a.notas}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-rose-700"
                      onClick={() => handleDelete(a.id, a.empleado_id)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <AusenciaQuickDialog open={dialogOpen} onOpenChange={setDialogOpen} empleados={empleados} />
    </div>
  )
}
