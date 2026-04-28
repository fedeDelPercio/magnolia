'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, CalendarIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { abrirDia } from '../actions'
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

function todayLocal() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type Props = { dias: DiaOperativo[] }

export function OperacionList({ dias }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [opening, setOpening] = useState(false)

  const today = todayLocal()
  const todayExists = dias.some((d) => d.fecha === today)

  function handleAbrirHoy() {
    setOpening(true)
    startTransition(async () => {
      const result = await abrirDia(today)
      setOpening(false)
      if (result.error) {
        toast.error(result.error)
      } else if (result.id) {
        router.push(`/operacion/${result.id}`)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dias.length === 0 ? 'Sin días registrados.' : `${dias.length} ${dias.length === 1 ? 'día registrado' : 'días registrados'}`}
        </p>
        {!todayExists && (
          <Button onClick={handleAbrirHoy} disabled={opening}>
            <PlusIcon className="size-4" />
            {opening ? 'Abriendo...' : 'Abrir hoy'}
          </Button>
        )}
        {todayExists && (
          <Button
            variant="outline"
            onClick={() => router.push(`/operacion/${dias.find((d) => d.fecha === today)!.id}`)}
          >
            <CalendarIcon className="size-4" />
            Ver hoy
          </Button>
        )}
      </div>

      <div className="rounded-lg border divide-y">
        {dias.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No hay días operativos. Abrí el de hoy para empezar.
          </div>
        ) : (
          dias.map((dia) => (
            <button
              key={dia.id}
              onClick={() => router.push(`/operacion/${dia.id}`)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{formatFecha(dia.fecha)}</p>
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
          ))
        )}
      </div>
    </div>
  )
}
