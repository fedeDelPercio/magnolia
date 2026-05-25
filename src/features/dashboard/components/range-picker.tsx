'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'

type Preset = { label: string; range: () => { from: string; to: string } }

const MES_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

const PRESETS: Preset[] = [
  {
    label: 'Este mes',
    range: () => {
      const now = new Date()
      return { from: iso(startOfMonth(now)), to: iso(startOfNextMonth(now)) }
    },
  },
  {
    label: 'Mes anterior',
    range: () => {
      const now = new Date()
      const start = startOfMonth(addMonths(now, -1))
      const end = startOfMonth(now)
      return { from: iso(start), to: iso(end) }
    },
  },
  {
    label: 'Últimos 3 meses',
    range: () => {
      const now = new Date()
      return { from: iso(addMonths(now, -3)), to: iso(now) }
    },
  },
  {
    label: 'Últimos 6 meses',
    range: () => {
      const now = new Date()
      return { from: iso(addMonths(now, -6)), to: iso(now) }
    },
  },
  {
    label: 'Año actual',
    range: () => {
      const now = new Date()
      return {
        from: iso(new Date(now.getFullYear(), 0, 1)),
        to: iso(new Date(now.getFullYear() + 1, 0, 1)),
      }
    },
  },
]

/** Parsea 'YYYY-MM-DD' como fecha local (sin timezone shift). */
function parseLocal(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

function rangeLabel(from: string, to: string): string {
  const f = parseLocal(from)
  const t = parseLocal(to)

  // Si from = primer día del mes y to = primer día del mes siguiente, es un mes calendario
  const isFullMonth =
    f.d === 1 &&
    t.d === 1 &&
    ((f.m === 12 && t.m === 1 && t.y === f.y + 1) || (t.m === f.m + 1 && t.y === f.y))
  if (isFullMonth) return `${MES_NAMES[f.m - 1]} ${f.y}`

  // Año calendario completo
  if (f.m === 1 && f.d === 1 && t.m === 1 && t.d === 1 && t.y === f.y + 1) {
    return `Año ${f.y}`
  }

  // Restamos 1 día al "to" porque el rango es exclusivo
  const tLastDay = new Date(t.y, t.m - 1, t.d - 1)
  const fmt = (y: number, m: number, d: number) =>
    `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  return `${fmt(f.y, f.m, f.d)} – ${fmt(tLastDay.getFullYear(), tLastDay.getMonth() + 1, tLastDay.getDate())}`
}

type Props = {
  from: string
  to: string
}

export function RangePicker({ from, to }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    setCustomFrom(from)
    setCustomTo(to)
  }, [from, to])

  function apply(newFrom: string, newTo: string) {
    const sp = new URLSearchParams(params.toString())
    sp.set('from', newFrom)
    sp.set('to', newTo)
    router.push(`${pathname}?${sp.toString()}`)
    setOpen(false)
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom < customTo) {
      apply(customFrom, customTo)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium tabular-nums hover:bg-muted/40"
      >
        <CalendarIcon className="size-4 text-muted-foreground" />
        {rangeLabel(from, to)}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border bg-popover shadow-lg">
          <ul className="divide-y divide-border/70 text-sm">
            {PRESETS.map((p) => {
              const r = p.range()
              const isActive = r.from === from && r.to === to
              return (
                <li key={p.label}>
                  <button
                    type="button"
                    onClick={() => apply(r.from, r.to)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 ${
                      isActive ? 'font-medium text-primary' : ''
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Personalizado
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1 text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">a</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1 text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!customFrom || !customTo || customFrom >= customTo}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
