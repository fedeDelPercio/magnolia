'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { PlusIcon, MoreHorizontalIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { formatCurrency } from '@/lib/format'
import { UNIT_LABELS, type UnitKind } from '../schemas'
import { toggleInsumoActive } from '../actions'
import { InsumoDialog } from './insumo-dialog'
import type { InsumoWithProveedor } from '../queries'
import type { Tables } from '@/types/database'

function StockBar({ insumo }: { insumo: InsumoWithProveedor }) {
  if (!insumo.track_stock || !insumo.stock) return null

  const actual = insumo.stock.stock_actual ?? 0
  const referencia = insumo.stock.stock_referencia ?? 0
  const unit = (insumo.stock.unit ?? insumo.unit) as UnitKind

  const pct = referencia > 0 ? Math.min(100, Math.max(0, (actual / referencia) * 100)) : 0

  const fillColor =
    pct > 60 ? 'bg-emerald-400' : pct > 30 ? 'bg-amber-400' : 'bg-rose-400'

  function fmt(val: number) {
    if ((unit === 'g' || unit === 'kg') && val >= 1000)
      return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`
    if ((unit === 'ml' || unit === 'l') && val >= 1000)
      return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} l`
    return `${val.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit] ?? unit}`
  }

  return (
    <div className="w-36 space-y-1.5">
      <div className="h-0.5 w-full rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] leading-none text-muted-foreground/70 tabular-nums">
        {fmt(actual)} · {fmt(referencia)}
      </p>
    </div>
  )
}

type Props = {
  insumos: InsumoWithProveedor[]
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
}

type DialogMode = 'view' | 'edit' | 'create'

type KindFilter = 'todos' | 'ingrediente' | 'descartable'

export function InsumosClient({ insumos, proveedores }: Props) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InsumoWithProveedor | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

  const filtered = useMemo(
    () =>
      insumos.filter((i) => {
        if (kindFilter !== 'todos' && i.kind !== kindFilter) return false
        return i.name.toLowerCase().includes(search.toLowerCase())
      }),
    [insumos, search, kindFilter],
  )

  function openCreate() {
    setEditing(null)
    setMode('create')
    setDialogOpen(true)
  }

  function openView(insumo: InsumoWithProveedor) {
    setEditing(insumo)
    setMode('view')
    setDialogOpen(true)
  }

  function openEdit(insumo: InsumoWithProveedor) {
    setEditing(insumo)
    setMode('edit')
    setDialogOpen(true)
  }

  function handleToggleActive(insumo: InsumoWithProveedor) {
    startTransition(async () => {
      const result = await toggleInsumoActive(insumo.id, !insumo.active)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(insumo.active ? 'Insumo desactivado' : 'Insumo activado')
      }
    })
  }

  const KIND_FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'ingrediente', label: 'Ingredientes' },
    { value: 'descartable', label: 'Descartables' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar insumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setKindFilter(f.value)}
                className={`px-3 py-1.5 transition-colors ${
                  kindFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          Nuevo insumo
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Precio actual</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {search || kindFilter !== 'todos' ? 'No se encontraron insumos' : 'Sin insumos. Creá el primero.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((insumo) => (
                <TableRow
                  key={insumo.id}
                  className={`cursor-pointer hover:bg-muted/50 ${!insumo.active ? 'opacity-50' : ''}`}
                  onClick={() => openView(insumo)}
                >
                  <TableCell className="font-medium">{insumo.name}</TableCell>
                  <TableCell>{UNIT_LABELS[insumo.unit]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(insumo.current_price)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {insumo.proveedores?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {insumo.kind === 'descartable' && (
                        <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                          Descartable
                        </Badge>
                      )}
                      {insumo.perishable && (
                        <Badge variant="outline" className="text-xs">
                          Perecedero
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StockBar insumo={insumo} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={insumo.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-normal'
                        : 'border-border bg-muted/40 text-muted-foreground font-normal'}
                    >
                      {insumo.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(insumo)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(insumo)}>
                          {insumo.active ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InsumoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        insumo={editing}
        mode={mode}
        proveedores={proveedores}
      />
    </div>
  )
}
