'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { toggleEmpleadoActivo } from '../actions'
import { EmpleadoDialog } from './empleado-dialog'
import type { Empleado, EmpleadoListItem } from '../queries'

type Props = { empleados: EmpleadoListItem[] }

// Avatar neutro — tono editorial alineado al resto del sistema.
const AVATAR_TONE = 'bg-foreground/5 text-foreground/70 ring-1 ring-foreground/10'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function EmpleadosClient({ empleados }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Empleado | null>(null)
  const [showInactivos, setShowInactivos] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return empleados.filter((e) => {
      if (!showInactivos && !e.activo) return false
      if (s && !e.name.toLowerCase().includes(s)) return false
      return true
    })
  }, [empleados, showInactivos, search])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(e: EmpleadoListItem) {
    const emp: Empleado = {
      id: e.id,
      tenant_id: e.tenant_id,
      name: e.name,
      fecha_ingreso: e.fecha_ingreso,
      sueldo_diario: e.sueldo_diario,
      plus_mensual: e.plus_mensual,
      aguinaldo_estimado: e.aguinaldo_estimado,
      vacaciones_dias_anuales: e.vacaciones_dias_anuales,
      activo: e.activo,
      notas: e.notas,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }
    setEditing(emp)
    setDialogOpen(true)
  }

  function handleToggle(e: EmpleadoListItem) {
    startTransition(async () => {
      const result = await toggleEmpleadoActivo(e.id, !e.activo)
      if (result.error) toast.error(result.error)
      else toast.success(e.activo ? 'Empleado desactivado' : 'Empleado activado')
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="empleados-show-inactivos" className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              id="empleados-show-inactivos"
              checked={showInactivos}
              onCheckedChange={(v) => setShowInactivos(Boolean(v))}
            />
            Mostrar inactivos
          </label>
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            Nuevo empleado
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length === 0
          ? search
            ? `Sin resultados para "${search}".`
            : 'Sin empleados.'
          : `${filtered.length} de ${empleados.length} empleado${empleados.length === 1 ? '' : 's'}`}
      </p>

      {/* Grid de cards */}
      {filtered.length === 0 ? (
        <div className="card-editorial p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? `No encontramos a nadie con "${search}".`
              : 'Sin empleados cargados. Empezá por crear el primero.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => {
            const vacExceso = e.dias_vacaciones_restantes === 0 && e.vacaciones_dias_anuales > 0
            return (
              <div
                key={e.id}
                className={cn(
                  'card-editorial group relative transition-colors hover:bg-muted/30',
                  !e.activo && 'opacity-60',
                )}
              >
                <Link
                  href={`/empleados/${e.id}`}
                  className="focus-ring flex flex-col gap-2.5 rounded-[inherit] p-3.5"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-8">
                    <div className={cn('grid size-9 shrink-0 place-items-center rounded-full text-xs font-medium', AVATAR_TONE)}>
                      {initials(e.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{e.name}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {e.fecha_ingreso ? `Ingreso ${e.fecha_ingreso}` : 'Sin fecha de ingreso'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="num-editorial text-xl leading-none tabular-nums">
                        {formatCurrency(Number(e.sueldo_diario))}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        sueldo / día
                      </p>
                    </div>
                    {!e.activo && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Inactivo
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 border-t pt-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plus mensual</span>
                      <span className="tabular-nums">
                        {Number(e.plus_mensual) > 0 ? formatCurrency(Number(e.plus_mensual)) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vacaciones</span>
                      <span className={cn('tabular-nums', vacExceso && 'text-amber-700 font-medium')}>
                        {e.dias_vacaciones_restantes} / {e.vacaciones_dias_anuales} d
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Dropdown isolated en esquina superior derecha — fuera del Link para evitar anidar botones en anchor */}
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="size-7" />}
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(e)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/empleados/${e.id}`)}>
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(e)}>
                        {e.activo ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EmpleadoDialog open={dialogOpen} onOpenChange={setDialogOpen} empleado={editing} />
    </div>
  )
}
