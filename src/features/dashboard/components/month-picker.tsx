'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function shift(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y!, m! - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function label(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MESES[m! - 1]} ${y}`
}

export function MonthPicker({ month }: { month: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function go(target: string) {
    const sp = new URLSearchParams(params.toString())
    sp.set('month', target)
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-card px-1 py-1">
      <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => go(shift(month, -1))}>
        <ChevronLeftIcon className="size-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium tabular-nums">
        {label(month)}
      </span>
      <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => go(shift(month, 1))}>
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  )
}
