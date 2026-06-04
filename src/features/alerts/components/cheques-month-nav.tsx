'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function monthLabel(date: Date): string {
  return `${MESES[date.getMonth()]} ${date.getFullYear()}`
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function toParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function ChequesMonthNav({ currentMonth }: { currentMonth: string }) {
  // currentMonth viene como "YYYY-MM" desde el server.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [y, m] = currentMonth.split('-').map(Number)
  const current = new Date(y!, m! - 1, 1)
  const prev = shiftMonth(current, -1)
  const next = shiftMonth(current, +1)

  function navigate(target: Date) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('chequesMonth', toParam(target))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(prev)}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Mes anterior"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <span className="min-w-28 text-center text-xs font-medium capitalize tabular-nums">
        {monthLabel(current)}
      </span>
      <button
        type="button"
        onClick={() => navigate(next)}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Mes siguiente"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  )
}
