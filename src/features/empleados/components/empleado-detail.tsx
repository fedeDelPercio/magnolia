'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BanIcon,
  CalendarIcon,
  ClockIcon,
  EditIcon,
  PlusIcon,
  RotateCcwIcon,
  TrashIcon,
  CalendarDaysIcon,
  PalmtreeIcon,
  ReceiptIcon,
  UserIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'

import type { EmpleadoDetalle } from '../queries'
import { DOW_LABELS_SHORT, TIPO_AUSENCIA_LABELS } from '../schemas'
import { estadoVacacion, ESTADO_LABELS, ESTADO_TONE } from '../lib/estado-vacacion'
import { deleteVacacion, deleteAusencia, toggleVacacionCancelada } from '../actions'
import { EmpleadoDialog } from './empleado-dialog'
import { HorarioDialog } from './horario-dialog'
import { VacacionDialog } from './vacacion-dialog'
import { AusenciaDialog } from './ausencia-dialog'

type Props = { detalle: EmpleadoDetalle }

function antiguedad(fechaIngreso: string | null): string {
  if (!fechaIngreso) return '—'
  const [y, m, d] = fechaIngreso.split('-').map(Number)
  const desde = new Date(y!, m! - 1, d!)
  const hoy = new Date()
  const meses = (hoy.getFullYear() - desde.getFullYear()) * 12 + (hoy.getMonth() - desde.getMonth())
  if (meses < 1) return 'menos de 1 mes'
  if (meses < 12) return `${meses} mes${meses === 1 ? '' : 'es'}`
  const años = Math.floor(meses / 12)
  const mesesResto = meses % 12
  if (mesesResto === 0) return `${años} año${años === 1 ? '' : 's'}`
  return `${años} año${años === 1 ? '' : 's'} y ${mesesResto} mes${mesesResto === 1 ? '' : 'es'}`
}

const TIPO_AUSENCIA_TONE: Record<string, string> = {
  justificada: 'border-sky-200 bg-sky-50 text-sky-700',
  injustificada: 'border-rose-200 bg-rose-50 text-rose-700',
  enfermedad: 'border-amber-200 bg-amber-50 text-amber-700',
  feriado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  licencia: 'border-violet-200 bg-violet-50 text-violet-700',
}

export function EmpleadoDetail({ detalle }: Props) {
  const { empleado, horarios, vacaciones, ausencias, liquidaciones } = detalle
  const [empleadoOpen, setEmpleadoOpen] = useState(false)
  const [horarioOpen, setHorarioOpen] = useState(false)
  const [vacOpen, setVacOpen] = useState(false)
  const [ausOpen, setAusOpen] = useState(false)
  const [, startTransition] = useTransition()

  function handleDeleteVacacion(id: string) {
    if (!confirm('¿Borrar definitivamente este registro? Si solo querés cancelarlas, usá el botón de cancelar.')) return
    startTransition(async () => {
      const r = await deleteVacacion(id, empleado.id)
      if (r.error) toast.error(r.error)
      else toast.success('Vacaciones eliminadas')
    })
  }

  function handleToggleCancelVacacion(id: string, currentlyCancelled: boolean) {
    const next = !currentlyCancelled
    const msg = next ? '¿Cancelar esta toma de vacaciones?' : '¿Reactivar esta toma de vacaciones?'
    if (!confirm(msg)) return
    startTransition(async () => {
      const r = await toggleVacacionCancelada(id, next, empleado.id)
      if (r.error) toast.error(r.error)
      else toast.success(next ? 'Vacaciones canceladas' : 'Vacaciones reactivadas')
    })
  }

  function handleDeleteAusencia(id: string) {
    if (!confirm('¿Eliminar esta ausencia?')) return
    startTransition(async () => {
      const r = await deleteAusencia(id, empleado.id)
      if (r.error) toast.error(r.error)
      else toast.success('Ausencia eliminada')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
            Empleado
          </p>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight">{empleado.name}</h1>
          {!empleado.activo && (
            <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Inactivo
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Card 1: Identidad */}
        <div className="card-editorial p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-card-title">
              <UserIcon className="size-3.5 text-muted-foreground" />
              <span>Identidad</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEmpleadoOpen(true)}>
              <EditIcon className="size-3.5" /> Editar
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Fecha de ingreso</dt>
              <dd className="tabular-nums">{empleado.fecha_ingreso ?? '—'}</dd>
              <dd className="text-xs text-muted-foreground">{antiguedad(empleado.fecha_ingreso)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sueldo por día</dt>
              <dd className="tabular-nums font-medium">{formatCurrency(Number(empleado.sueldo_diario))}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Plus mensual</dt>
              <dd className="tabular-nums">
                {Number(empleado.plus_mensual) > 0
                  ? formatCurrency(Number(empleado.plus_mensual))
                  : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Aguinaldo estimado</dt>
              <dd className="tabular-nums">
                {Number(empleado.aguinaldo_estimado) > 0
                  ? formatCurrency(Number(empleado.aguinaldo_estimado))
                  : <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
          </dl>
          {empleado.notas && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{empleado.notas}</p>
          )}
        </div>

        {/* Card 2: Horario semanal */}
        <div className="card-editorial p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-card-title">
              <ClockIcon className="size-3.5 text-muted-foreground" />
              <span>Horario semanal</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setHorarioOpen(true)}>
              <EditIcon className="size-3.5" /> Editar
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {DOW_LABELS_SHORT.map((label, dow) => {
              const slots = horarios.filter((h) => h.dow === dow)
              return (
                <div key={dow} className="rounded-md border bg-background/60 p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  {slots.length === 0 ? (
                    <p className="mt-1 text-muted-foreground">—</p>
                  ) : (
                    slots.map((s) => (
                      <p key={s.id} className="mt-1 tabular-nums">
                        {s.hora_inicio.slice(0, 5)}
                        <br />
                        {s.hora_fin.slice(0, 5)}
                      </p>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Card 3: Vacaciones */}
        <div className="card-editorial p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-card-title">
              <PalmtreeIcon className="size-3.5 text-muted-foreground" />
              <span>Vacaciones {new Date().getFullYear()}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setVacOpen(true)}>
              <PlusIcon className="size-3.5" /> Registrar
            </Button>
          </div>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="num-editorial text-3xl leading-none">
              {detalle.dias_vacaciones_restantes}
            </span>
            <span className="text-sm text-muted-foreground">
              de {empleado.vacaciones_dias_anuales} días disponibles ({detalle.dias_vacaciones_tomados} tomados)
            </span>
          </div>
          {vacaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vacaciones cargadas.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-background/60 text-sm">
              {vacaciones.map((v) => {
                const estado = estadoVacacion(v)
                return (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('tabular-nums', v.cancelada && 'line-through opacity-60')}>
                          {v.fecha_desde} → {v.fecha_hasta}
                        </p>
                        <Badge variant="outline" className={cn('text-[10px]', ESTADO_TONE[estado])}>
                          {ESTADO_LABELS[estado]}
                        </Badge>
                      </div>
                      {v.notas && <p className="text-xs text-muted-foreground">{v.notas}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        onClick={() => handleToggleCancelVacacion(v.id, v.cancelada)}
                        title={v.cancelada ? 'Reactivar' : 'Cancelar'}
                      >
                        {v.cancelada
                          ? <RotateCcwIcon className="size-3.5" />
                          : <BanIcon className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-rose-700"
                        onClick={() => handleDeleteVacacion(v.id)}
                        title="Borrar"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Card 4: Ausencias últimos 60 días */}
        <div className="card-editorial p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-card-title">
              <CalendarDaysIcon className="size-3.5 text-muted-foreground" />
              <span>Ausencias (últimos 60 días)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAusOpen(true)}>
              <PlusIcon className="size-3.5" /> Registrar
            </Button>
          </div>
          {ausencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ausencias registradas.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-background/60 text-sm">
              {ausencias.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="tabular-nums">{a.fecha}</span>
                    <Badge variant="outline" className={cn('text-[10px]', TIPO_AUSENCIA_TONE[a.tipo])}>
                      {TIPO_AUSENCIA_LABELS[a.tipo as keyof typeof TIPO_AUSENCIA_LABELS]}
                    </Badge>
                    {a.paga && (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                        paga
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.notas && <span className="hidden text-xs text-muted-foreground md:inline">{a.notas}</span>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-rose-700"
                      onClick={() => handleDeleteAusencia(a.id)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 5: Liquidaciones recientes */}
        <div className="card-editorial p-5 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-card-title">
              <ReceiptIcon className="size-3.5 text-muted-foreground" />
              <span>Liquidaciones recientes</span>
            </div>
          </div>
          {liquidaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin liquidaciones generadas.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-background/60 text-sm">
              {liquidaciones.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <CalendarIcon className="size-3.5 text-muted-foreground" />
                    <span className="tabular-nums">
                      {l.fecha_desde === l.fecha_hasta ? l.fecha_desde : `${l.fecha_desde} → ${l.fecha_hasta}`}
                    </span>
                    {Number(l.monto_plus) > 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-700">+ plus</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">{formatCurrency(Number(l.monto_total))}</span>
                    {l.caja_movimiento_id && (
                      <Link href="/caja" className="text-xs text-blue-600 hover:underline">
                        Ver en caja
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <EmpleadoDialog open={empleadoOpen} onOpenChange={setEmpleadoOpen} empleado={empleado} />
      <HorarioDialog
        open={horarioOpen}
        onOpenChange={setHorarioOpen}
        empleadoId={empleado.id}
        horarios={horarios}
      />
      <VacacionDialog open={vacOpen} onOpenChange={setVacOpen} empleadoId={empleado.id} />
      <AusenciaDialog open={ausOpen} onOpenChange={setAusOpen} empleadoId={empleado.id} />
    </div>
  )
}
