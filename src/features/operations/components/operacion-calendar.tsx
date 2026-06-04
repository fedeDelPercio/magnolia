'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { abrirDia } from '../actions'
import type { DiaOperativo } from '../queries'

type Props = {
  dias: DiaOperativo[]
  month: string // 'YYYY-MM'
  today: string // 'YYYY-MM-DD'
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Lunes-first.
const DOW_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function pad2(n: number) { return String(n).padStart(2, '0') }

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 1) return `${y! - 1}-12`
  return `${y}-${pad2(mo! - 1)}`
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 12) return `${y! + 1}-01`
  return `${y}-${pad2(mo! + 1)}`
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return `${MESES[mo! - 1]} ${y}`
}

type Cell = {
  fecha: string // YYYY-MM-DD
  day: number
  inCurrentMonth: boolean
  isToday: boolean
  isFuture: boolean
  dia: DiaOperativo | undefined
}

function buildGrid(month: string, today: string, dias: DiaOperativo[]): Cell[] {
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(year!, mon! - 1, 1)
  const last = new Date(year!, mon!, 0)
  // Día de la semana del primer día, ajustado a "lunes = 0".
  const firstDow = (first.getDay() + 6) % 7

  // Día anterior al inicio que corresponde al lunes de la primera semana.
  const startDate = new Date(year!, mon! - 1, 1 - firstDow)

  // Calcular cuántas semanas necesitamos (4, 5 o 6).
  const totalCells = Math.ceil((firstDow + last.getDate()) / 7) * 7

  const diaByFecha = new Map<string, DiaOperativo>()
  for (const d of dias) diaByFecha.set(d.fecha, d)

  const cells: Cell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const fecha = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    cells.push({
      fecha,
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === mon! - 1,
      isToday: fecha === today,
      isFuture: fecha > today,
      dia: diaByFecha.get(fecha),
    })
  }

  return cells
}

export function OperacionCalendar({ dias, month, today }: Props) {
  const router = useRouter()
  const [pendingFecha, setPendingFecha] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const cells = useMemo(() => buildGrid(month, today, dias), [month, today, dias])

  // Resumen del mes
  const cerrados = dias.filter((d) => d.status === 'cerrado').length
  const abiertos = dias.filter((d) => d.status === 'abierto').length
  const todayMonth = today.slice(0, 7)
  const isViewingCurrentMonth = month === todayMonth

  function navigate(m: string) {
    router.push(`/operacion?month=${m}`)
  }

  function openDay(cell: Cell) {
    if (cell.isFuture) {
      toast.info('Todavía no podés abrir un día futuro.')
      return
    }
    if (cell.dia) {
      router.push(`/operacion/${cell.dia.id}`)
      return
    }
    // Día sin registro → crear y entrar.
    setPendingFecha(cell.fecha)
    startTransition(async () => {
      const result = await abrirDia(cell.fecha)
      setPendingFecha(null)
      if (result.id) {
        router.push(`/operacion/${result.id}`)
      } else {
        toast.error(result.error ?? 'No se pudo abrir el día')
      }
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* Toolbar: nav + ver hoy + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-9" onClick={() => navigate(prevMonth(month))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="font-display text-2xl tracking-tight w-44 text-center">
            {monthLabel(month)}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => navigate(nextMonth(month))}
            disabled={month >= todayMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {/* Leyenda inline — tonos monocromáticos en línea con el sistema editorial. */}
          <div className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-foreground/80" aria-hidden />
              Cerrado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full border-[1.5px] border-foreground/70 bg-transparent" aria-hidden />
              Abierto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-700/80" aria-hidden />
              Sin abrir
            </span>
          </div>
          {(cerrados > 0 || abiertos > 0) && (
            <span className="tabular-nums">
              {cerrados > 0 && <><span className="text-foreground font-medium">{cerrados}</span> cerrado{cerrados === 1 ? '' : 's'}</>}
              {cerrados > 0 && abiertos > 0 && ' · '}
              {abiertos > 0 && <><span className="text-foreground font-medium">{abiertos}</span> abierto{abiertos === 1 ? '' : 's'}</>}
            </span>
          )}
          {!isViewingCurrentMonth && (
            <Button variant="outline" size="sm" onClick={() => navigate(todayMonth)}>
              <CalendarIcon className="size-4" />
              Ir a hoy
            </Button>
          )}
        </div>
      </div>

      {/* Calendar grid — alto fijo al viewport (svh evita que la barra dinámica del browser empuje el contenido). */}
      <div className="flex h-[calc(100svh-260px)] min-h-[360px] max-h-[700px] flex-col overflow-hidden rounded-xl border bg-card">
        {/* Day headers */}
        <div className="grid shrink-0 grid-cols-7 border-b bg-muted/40">
          {DOW_HEADERS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        {/* Cells: auto-rows-fr distribuye proporcionalmente las 4-6 semanas en el alto disponible.
            min-h-0 permite que las celdas se compriman bajo su contenido natural si es necesario. */}
        <div className="grid flex-1 grid-cols-7 auto-rows-fr min-h-0">
          {cells.map((c) => {
            const isPending = pendingFecha === c.fecha
            const estado: 'cerrado' | 'abierto' | 'vacio' = c.dia
              ? c.dia.status === 'cerrado' ? 'cerrado' : 'abierto'
              : 'vacio'

            // Celdas sin tints de color — solo varía el hover. Diferenciación visual via bullet + texto.
            const cellBg = c.inCurrentMonth ? 'hover:bg-muted/40' : 'bg-muted/20'

            return (
              <button
                key={c.fecha}
                type="button"
                onClick={() => openDay(c)}
                disabled={isPending || c.isFuture}
                className={cn(
                  'group relative flex flex-col items-stretch justify-between border-b border-r p-2 text-left transition-colors',
                  cellBg,
                  c.isFuture && 'opacity-40 cursor-not-allowed',
                  isPending && 'opacity-50',
                  '[&:nth-child(7n)]:border-r-0',
                )}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      'text-sm tabular-nums',
                      !c.inCurrentMonth && 'text-muted-foreground/50',
                      c.inCurrentMonth && !c.isToday && 'font-medium',
                      c.isToday && 'grid size-6 place-items-center rounded-full bg-foreground text-background font-semibold',
                    )}
                  >
                    {c.day}
                  </span>
                </div>

                {/* Estado del día — bullet y label en monocromo editorial.
                    Para días vacíos sólo mostramos "Abrir" si no es futuro (no se puede abrir el futuro). */}
                {c.inCurrentMonth && (estado !== 'vacio' || !c.isFuture) && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        // Cerrado: bullet sólido foreground (estado "done")
                        estado === 'cerrado' && 'bg-foreground/80',
                        // Abierto (en curso): ring grueso sin fill — distinto a cerrado a primera vista
                        estado === 'abierto' && 'border-[1.5px] border-foreground/70 bg-transparent',
                        // Sin abrir: el único acento de color, terracota apagado para invitar a la acción
                        estado === 'vacio' && 'bg-amber-700/80',
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider',
                        estado === 'cerrado' && 'text-muted-foreground',
                        estado === 'abierto' && 'text-foreground/80',
                        estado === 'vacio' && 'text-amber-800/80',
                      )}
                    >
                      {estado === 'cerrado' ? 'Cerrado' : estado === 'abierto' ? 'Abierto' : 'Abrir'}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
