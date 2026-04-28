'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LockIcon, LockOpenIcon, ArrowLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cerrarDia, reabrirDia } from '../actions'
import { MovimientoRow } from './movimiento-row'
import type { DiaConMovimientos } from '../queries'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatFecha(fechaStr: string) {
  const parts = fechaStr.split('-').map(Number)
  const [year, month, day] = [parts[0]!, parts[1]!, parts[2]!]
  return `${day} de ${MESES[month - 1]!} de ${year}`
}

type Props = { dia: DiaConMovimientos }

export function DiaClient({ dia }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const readonly = dia.status === 'cerrado'
  const movimientos = [...dia.movimientos_diarios].sort((a, b) =>
    a.productos.name.localeCompare(b.productos.name, 'es'),
  )

  function handleCerrar() {
    setLoading(true)
    startTransition(async () => {
      const result = await cerrarDia(dia.id)
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Día cerrado correctamente')
        router.refresh()
      }
    })
  }

  function handleReabrir() {
    setLoading(true)
    startTransition(async () => {
      const result = await reabrirDia(dia.id)
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Día reabierto')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/operacion')} className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{formatFecha(dia.fecha)}</h1>
            <p className="text-sm text-muted-foreground">{movimientos.length} productos</p>
          </div>
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
        </div>

        <div className="flex gap-2">
          {dia.status === 'abierto' ? (
            <Button onClick={handleCerrar} disabled={loading}>
              <LockIcon className="size-4" />
              {loading ? 'Cerrando...' : 'Cerrar día'}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleReabrir} disabled={loading}>
              <LockOpenIcon className="size-4" />
              {loading ? 'Reabriendo...' : 'Reabrir'}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <th className="py-2.5 pl-4 pr-2 text-left">Producto</th>
              <th className="px-2 py-2.5 text-right">Stock ant.</th>
              <th className="px-2 py-2.5 text-right">Produc.</th>
              <th className="px-2 py-2.5 text-right">Ventas</th>
              <th className="px-2 py-2.5 text-right">Desperd.</th>
              <th className="px-2 py-2.5 text-right">Almuerzo</th>
              <th className="px-2 py-2.5 text-right">Conteo</th>
              <th className="px-2 py-2.5 text-right">Teórico</th>
              <th className="px-2 py-2.5 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  Sin productos. Agregá productos activos desde el catálogo.
                </td>
              </tr>
            ) : (
              movimientos.map((mov) => (
                <MovimientoRow key={mov.id} mov={mov} readonly={readonly} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {readonly && (
        <p className="text-center text-xs text-muted-foreground">
          El día está cerrado. Los datos son de solo lectura.
        </p>
      )}
      {!readonly && movimientos.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Los cambios se guardan automáticamente.
        </p>
      )}
    </div>
  )
}
