'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { deleteProveedor, toggleProveedorActive } from '../actions'
import { ProveedorDialog } from './proveedor-dialog'
import type { SaldoProveedor } from '../queries'
import type { Tables } from '@/types/database'
import { PROVEEDOR_TIPO_LABELS, type ProveedorTipo } from '../schemas'
import { matchesSearch } from '@/lib/text'

type Props = { proveedores: SaldoProveedor[] }

type TipoFilter = ProveedorTipo | 'todos'

const AVATAR_TONE = 'bg-foreground/5 text-foreground/70 ring-1 ring-foreground/10'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function ProveedoresClient({ proveedores }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Tables<'proveedores'> | null>(null)
  const [search, setSearch] = useState('')
  const [showInactivos, setShowInactivos] = useState(true)
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')

  const filtered = useMemo(() => {
    const s = search.trim()
    return proveedores.filter((p) => {
      if (!showInactivos && !p.active) return false
      if (tipoFilter !== 'todos' && p.tipo !== tipoFilter) return false
      if (s && !matchesSearch(p.name, s)) return false
      return true
    })
  }, [proveedores, search, showInactivos, tipoFilter])

  const countByTipo = useMemo(() => {
    const insumos = proveedores.filter((p) => p.tipo === 'insumo').length
    const servicios = proveedores.filter((p) => p.tipo === 'servicio').length
    return { insumos, servicios, todos: proveedores.length }
  }, [proveedores])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(p: SaldoProveedor) {
    setEditing(p as unknown as Tables<'proveedores'>)
    setDialogOpen(true)
  }

  function handleToggle(p: SaldoProveedor) {
    startTransition(async () => {
      const result = await toggleProveedorActive(p.id, !p.active)
      if (result.error) toast.error(result.error)
      else toast.success(p.active ? 'Proveedor desactivado' : 'Proveedor activado')
    })
  }

  function handleDelete(p: SaldoProveedor) {
    const ok = window.confirm(
      `¿Eliminar a "${p.name}"? Esta acción no se puede deshacer.\n\nSi tiene compras o pagos registrados no vas a poder eliminarlo — desactivalo en ese caso.`,
    )
    if (!ok) return
    startTransition(async () => {
      const result = await deleteProveedor(p.id)
      if (result.error) toast.error(result.error)
      else toast.success('Proveedor eliminado')
    })
  }

  const conDeuda = filtered.filter((p) => p.saldo > 0).length
  const deudaTotal = filtered.reduce((s, p) => s + (p.saldo > 0 ? p.saldo : 0), 0)

  return (
    <div className="space-y-4">
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
          <label htmlFor="proveedores-show-inactivos" className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              id="proveedores-show-inactivos"
              checked={showInactivos}
              onCheckedChange={(v) => setShowInactivos(Boolean(v))}
            />
            Mostrar inactivos
          </label>
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            Nuevo proveedor
          </Button>
        </div>
      </div>

      {/* Tabs por tipo — insumos vs servicios */}
      <div className="inline-flex items-center gap-0.5 rounded-full bg-surface p-1">
        {(['todos', 'insumo', 'servicio'] as const).map((t) => {
          const active = tipoFilter === t
          const label = t === 'todos' ? 'Todos' : PROVEEDOR_TIPO_LABELS[t]
          const count = countByTipo[t === 'insumo' ? 'insumos' : t === 'servicio' ? 'servicios' : 'todos']
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipoFilter(t)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label} <span className="text-[10px] text-muted-foreground">({count})</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
        <span>
          {filtered.length === 0
            ? search ? `Sin resultados para "${search}".` : 'Sin proveedores.'
            : `${filtered.length} de ${proveedores.length} proveedor${proveedores.length === 1 ? '' : 'es'}`}
        </span>
        {conDeuda > 0 && (
          <span>
            <span className="text-rose-700 font-medium tabular-nums">{formatCurrency(deudaTotal)}</span> de deuda en {conDeuda} proveedor{conDeuda === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card-editorial p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? `No encontramos proveedores con "${search}".`
              : 'Creá el primer proveedor para empezar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const tieneSaldo = p.saldo > 0
            return (
              <div
                key={p.id}
                className={cn(
                  'card-editorial group relative transition-colors hover:bg-muted/30',
                  !p.active && 'opacity-60',
                )}
              >
                {/* Link envuelve todo el contenido visible. El dropdown queda como sibling absolute
                    para no anidar buttons dentro del anchor (HTML inválido). */}
                <Link
                  href={`/proveedores/${p.id}`}
                  className="focus-ring flex flex-col gap-2.5 rounded-[inherit] p-3.5"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-8">
                    <div className={cn('grid size-9 shrink-0 place-items-center rounded-full text-xs font-medium', AVATAR_TONE)}>
                      {initials(p.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      {p.tipo === 'servicio' && (
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0 text-[9px] font-medium text-sky-700 ring-1 ring-sky-200">
                          Servicio
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p
                        className={cn(
                          'num-editorial text-xl leading-none tabular-nums',
                          tieneSaldo ? 'text-rose-700' : 'text-muted-foreground',
                        )}
                      >
                        {tieneSaldo ? formatCurrency(p.saldo) : '$0'}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        saldo deudor
                      </p>
                    </div>
                    {!p.active && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Inactivo
                      </span>
                    )}
                  </div>
                </Link>

                {/* Dropdown isolated en esquina superior derecha — fuera del Link */}
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="size-7" />}
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/proveedores/${p.id}`)}>
                        Ver cuenta corriente
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(p)}>
                        {p.active ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(p)}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProveedorDialog open={dialogOpen} onOpenChange={setDialogOpen} proveedor={editing} />
    </div>
  )
}
