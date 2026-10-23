'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeftIcon, ChevronRightIcon, BanIcon, RotateCcwIcon, TrashIcon, PencilIcon, PlusIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { estadoVacacion, ESTADO_LABELS, ESTADO_TONE, type EstadoVacacion } from '../lib/estado-vacacion'
import { toggleVacacionCancelada, deleteVacacion, setVacacionesDeTemporada } from '../actions'
import { etiquetaTemporada, sumarDias } from '../lib/vacaciones-por-anio'
import type { VacacionConEmpleado, EmpleadoListItem } from '../queries'
import { VacacionDialog } from './vacacion-dialog'

type Props = {
  vacaciones: VacacionConEmpleado[]
  empleados: EmpleadoListItem[]
  // 2027 = temporada 2026-2027 (octubre a septiembre).
  temporada: number
}

const ESTADOS: (EstadoVacacion | 'todas')[] = ['todas', 'planificadas', 'en_curso', 'completas', 'canceladas']

function daysBetweenInclusive(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  const a = new Date(y1!, m1! - 1, d1!).getTime()
  const b = new Date(y2!, m2! - 1, d2!).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1
}

function fechaLarga(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

// "/ 14" de la tarjeta: tocándolo se cambian los días que le corresponden esa
// temporada (siguen valiendo para las siguientes hasta que se cambien).
function DiasCorresponden({ empleadoId, nombre, temporada, dias }: { empleadoId: string; nombre: string; temporada: number; dias: number }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cancelado = useRef(false)

  async function alSalir() {
    if (cancelado.current || guardando) {
      cancelado.current = false
      setEditando(false)
      return
    }
    const n = Number(texto)
    if (texto.trim() === '' || !Number.isInteger(n) || n < 0 || n > 60) {
      toast.error('Tienen que ser entre 0 y 60 días')
      setEditando(false)
      return
    }
    if (n === dias) {
      setEditando(false)
      return
    }
    setGuardando(true)
    const r = await setVacacionesDeTemporada(empleadoId, temporada, n)
    setGuardando(false)
    setEditando(false)
    if (r.error) toast.error(r.error)
    else toast.success(`${nombre}: ${n} días de vacaciones en ${etiquetaTemporada(temporada)}`)
  }

  const etiqueta = `Días de vacaciones que le corresponden a ${nombre} en ${etiquetaTemporada(temporada)}`
  if (editando) {
    return (
      <span className="text-sm text-muted-foreground">
        /{' '}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          autoFocus
          value={texto}
          disabled={guardando}
          aria-label={etiqueta}
          onChange={(ev) => setTexto(ev.target.value)}
          onFocus={(ev) => ev.target.select()}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur()
            if (ev.key === 'Escape') {
              cancelado.current = true
              ev.currentTarget.blur()
            }
          }}
          onBlur={() => void alSalir()}
          className="h-6 w-12 rounded border bg-background px-1 text-sm tabular-nums text-foreground"
        />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        setTexto(String(dias))
        setEditando(true)
      }}
      title={`Cambiar los días que le corresponden en ${etiquetaTemporada(temporada)}`}
      aria-label={`${etiqueta}: ${dias}. Cambiar`}
      className="inline-flex items-center gap-1 rounded px-0.5 text-sm tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      / {dias}
      <PencilIcon className="size-3 opacity-60" />
    </button>
  )
}

export function VacacionesPanorama({ vacaciones, empleados, temporada }: Props) {
  const router = useRouter()
  const [filtroEstado, setFiltroEstado] = useState<EstadoVacacion | 'todas'>('todas')
  const [, startTransition] = useTransition()
  const [registrarOpen, setRegistrarOpen] = useState(false)
  // Desde la tarjeta va con el empleado elegido; desde el botón de arriba, se elige.
  const [registrarPara, setRegistrarPara] = useState<string | undefined>(undefined)
  const [aperturas, setAperturas] = useState(0)
  const activos = useMemo(() => empleados.filter((e) => e.activo).map((e) => ({ id: e.id, name: e.name })), [empleados])

  function abrirRegistrar(empleadoId?: string) {
    setRegistrarPara(empleadoId)
    setAperturas((n) => n + 1)
    setRegistrarOpen(true)
  }

  const enriched = useMemo(
    () =>
      vacaciones.map((v) => ({
        ...v,
        estado: estadoVacacion(v),
        dias: daysBetweenInclusive(v.fecha_desde, v.fecha_hasta),
      })),
    [vacaciones],
  )

  const filtered = useMemo(
    () => (filtroEstado === 'todas' ? enriched : enriched.filter((v) => v.estado === filtroEstado)),
    [enriched, filtroEstado],
  )

  const counts = useMemo(() => {
    const c: Record<EstadoVacacion, number> = { planificadas: 0, en_curso: 0, completas: 0, canceladas: 0 }
    for (const v of enriched) c[v.estado]++
    return c
  }, [enriched])

  const totalDiasActivos = useMemo(
    () => enriched.filter((v) => v.estado !== 'canceladas').reduce((s, v) => s + v.dias, 0),
    [enriched],
  )

  // Resumen por empleado: días tomados en la temporada (excluye canceladas) vs los que le corresponden.
  // Incluye empleados activos sin tomas (para que vean su saldo intacto).
  const porEmpleado = useMemo(() => {
    const tomadosPorId = new Map<string, number>()
    for (const v of enriched) {
      if (v.estado === 'canceladas') continue
      tomadosPorId.set(v.empleado_id, (tomadosPorId.get(v.empleado_id) ?? 0) + v.dias)
    }
    const rows = empleados
      .filter((e) => e.activo || tomadosPorId.has(e.id))
      .map((e) => {
        const tomados = tomadosPorId.get(e.id) ?? 0
        const asignados = e.dias_vacaciones_corresponden
        const restantes = Math.max(0, asignados - tomados)
        const pct = asignados > 0 ? Math.min(100, (tomados / asignados) * 100) : 0
        return {
          id: e.id,
          name: e.name,
          activo: e.activo,
          tomados,
          asignados,
          restantes,
          pct,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [enriched, empleados])

  const totalAsignado = useMemo(
    () => empleados.filter((e) => e.activo).reduce((s, e) => s + e.dias_vacaciones_corresponden, 0),
    [empleados],
  )
  const totalRestantes = Math.max(0, totalAsignado - totalDiasActivos)

  function handleToggleCancel(v: VacacionConEmpleado) {
    const next = !v.cancelada
    const msg = next ? '¿Cancelar esta toma de vacaciones?' : '¿Reactivar esta toma de vacaciones?'
    if (!confirm(msg)) return
    startTransition(async () => {
      const r = await toggleVacacionCancelada(v.id, next, v.empleado_id)
      if (r.error) toast.error(r.error)
      else toast.success(next ? 'Vacaciones canceladas' : 'Vacaciones reactivadas')
    })
  }

  function handleDelete(v: VacacionConEmpleado) {
    if (!confirm('¿Borrar definitivamente este registro? Si sólo querés "cancelarla", usá el botón de cancelar.')) return
    startTransition(async () => {
      const r = await deleteVacacion(v.id, v.empleado_id)
      if (r.error) toast.error(r.error)
      else toast.success('Vacaciones eliminadas')
    })
  }

  return (
    <div className="space-y-4">
      {/* Year nav + counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" aria-label="Temporada anterior" onClick={() => router.push(`/empleados/vacaciones?temporada=${temporada - 1}`)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="text-base font-semibold w-28 text-center tabular-nums">{etiquetaTemporada(temporada)}</h2>
          <Button variant="outline" size="icon" className="size-8" aria-label="Temporada siguiente" onClick={() => router.push(`/empleados/vacaciones?temporada=${temporada + 1}`)}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            <span className="text-foreground font-medium tabular-nums">{totalDiasActivos}</span>
            {totalAsignado > 0 && (
              <> / <span className="font-medium tabular-nums">{totalAsignado}</span></>
            )}
            {' '}días tomados
          </span>
          {totalAsignado > 0 && (
            <span>
              <span className="text-foreground font-medium tabular-nums">{totalRestantes}</span> restantes en total
            </span>
          )}
          {activos.length > 0 && (
            <Button size="sm" onClick={() => abrirRegistrar()}>
              <PlusIcon className="size-3.5" /> Registrar vacaciones
            </Button>
          )}
        </div>
      </div>

      {/* Resumen por empleado: cuánto tomó y cuánto le queda */}
      {porEmpleado.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {porEmpleado.map((e) => {
            const exceso = e.tomados > e.asignados
            const sinTomar = e.tomados === 0
            const tone = exceso
              ? 'border-rose-200 bg-rose-50/50'
              : e.restantes <= 2 && e.asignados > 0
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-border bg-card'
            const barTone = exceso
              ? 'bg-rose-500'
              : e.pct >= 80
                ? 'bg-amber-500'
                : 'bg-emerald-500'

            return (
              <div key={e.id} className={cn('rounded-xl border p-3', tone, !e.activo && 'opacity-60')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">
                    {e.name}
                    {!e.activo && <span className="ml-1 text-[10px] text-muted-foreground">(inactivo)</span>}
                  </p>
                  {e.activo && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-my-1 size-6 shrink-0 text-muted-foreground"
                      onClick={() => abrirRegistrar(e.id)}
                      title={`Registrar vacaciones de ${e.name}`}
                      aria-label={`Registrar vacaciones de ${e.name}`}
                    >
                      <PlusIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="flex items-baseline gap-1">
                    <span className="num-editorial text-xl leading-none tabular-nums">{e.tomados}</span>
                    <DiasCorresponden empleadoId={e.id} nombre={e.name} temporada={temporada} dias={e.asignados} />
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {exceso ? (
                      <span className="text-rose-700">+{e.tomados - e.asignados} excedidos</span>
                    ) : sinTomar ? (
                      <span>Sin tomar</span>
                    ) : (
                      <><span className="text-foreground font-medium">{e.restantes}</span> rest.</>
                    )}
                  </p>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full transition-all', barTone)} style={{ width: `${Math.min(100, e.pct)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter chips with counters */}
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map((est) => {
          const active = filtroEstado === est
          const count = est === 'todas' ? enriched.length : counts[est]
          return (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {est === 'todas' ? 'Todas' : ESTADO_LABELS[est]} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Tabla */}
      {/* En celular la tabla se corre de costado (si no, se cortaban los botones). */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Empleado</th>
              <th className="text-left px-3 py-2">Desde</th>
              <th className="text-left px-3 py-2">Vuelve</th>
              <th className="text-right px-3 py-2">Días</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Notas</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Sin vacaciones que coincidan con el filtro.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className={cn(!v.empleado_activo && 'opacity-60')}>
                  <td className="px-3 py-2">
                    <Link href={`/empleados/${v.empleado_id}`} className="font-medium hover:underline">
                      {v.empleado_name}
                    </Link>
                    {!v.empleado_activo && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(inactivo)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fechaLarga(v.fecha_desde)}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fechaLarga(sumarDias(v.fecha_hasta, 1))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.dias}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn('text-[10px]', ESTADO_TONE[v.estado])}>
                      {ESTADO_LABELS[v.estado]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{v.notas ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        onClick={() => handleToggleCancel(v)}
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
                        onClick={() => handleDelete(v)}
                        title="Borrar"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <VacacionDialog
        key={aperturas}
        open={registrarOpen}
        onOpenChange={setRegistrarOpen}
        empleadoId={registrarPara}
        empleados={activos}
      />
    </div>
  )
}
