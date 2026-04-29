'use client'

import { useRouter } from 'next/navigation'
import { CalendarIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DiaOperativo } from '../queries'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatTime(isoStr: string) {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatFecha(fechaStr: string) {
  const parts = fechaStr.split('-').map(Number)
  const [year, month, day] = [parts[0]!, parts[1]!, parts[2]!]
  return `${day} de ${MESES[month - 1]!} de ${year}`
}

type Props = { dias: DiaOperativo[]; today: string }

export function OperacionList({ dias, today }: Props) {
  const router = useRouter()

  const todayDia = dias.find((d) => d.fecha === today)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dias.length === 1 ? '1 día registrado' : `${dias.length} días registrados`}
        </p>
        {todayDia && (
          <Button
            variant="outline"
            onClick={() => router.push(`/operacion/${todayDia.id}`)}
          >
            <CalendarIcon className="size-4" />
            Ver hoy
          </Button>
        )}
      </div>

      <div className="rounded-lg border divide-y">
        {dias.map((dia) => {
          const isToday = dia.fecha === today
          return (
            <button
              key={dia.id}
              onClick={() => router.push(`/operacion/${dia.id}`)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{formatFecha(dia.fecha)}</p>
                    {isToday && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
                        Hoy
                      </Badge>
                    )}
                  </div>
                  {dia.closed_at && (
                    <p className="text-xs text-muted-foreground">
                      Cerrado {formatTime(dia.closed_at)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    dia.status === 'abierto'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }
                >
                  {dia.status === 'abierto' ? 'Abierto' : 'Cerrado'}
                </Badge>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
