'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, MoreHorizontalIcon, SearchIcon, BoxIcon } from 'lucide-react'

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
import { toggleInsumoActive, deleteInsumo, getUltimaCompraDeInsumo } from '../actions'
import { InsumoDialog } from './insumo-dialog'
import type { InsumoWithProveedor } from '../queries'
import type { Tables } from '@/types/database'
import { matchesSearch } from '@/lib/text'

function StockBar({ insumo }: { insumo: InsumoWithProveedor }) {
  if (!insumo.track_stock || !insumo.stock) return null

  const actual = insumo.stock.stock_actual ?? 0
  const referencia = insumo.stock.stock_referencia ?? 0
  const unit = (insumo.stock.unit ?? insumo.unit) as UnitKind

  const pct = referencia > 0 ? Math.min(100, Math.max(0, (actual / referencia) * 100)) : 0

  const tone =
    pct > 60 ? { bar: 'bg-emerald-500', text: 'text-emerald-700' } :
    pct > 30 ? { bar: 'bg-amber-500', text: 'text-amber-700' } :
               { bar: 'bg-rose-500', text: 'text-rose-700' }

  function fmt(val: number) {
    if ((unit === 'g' || unit === 'kg') && val >= 1000)
      return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`
    if ((unit === 'ml' || unit === 'l') && val >= 1000)
      return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} l`
    return `${val.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit] ?? unit}`
  }

  return (
    <div className="w-36 space-y-1">
      <div className="h-1 w-full rounded-full bg-neutral-300 overflow-hidden">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] leading-none tabular-nums text-muted-foreground">
        {fmt(actual)} de {fmt(referencia)} · <span className={`font-medium ${tone.text}`}>{Math.round(pct)}%</span>
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
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('todos')
  const [onlyTrackStock, setOnlyTrackStock] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InsumoWithProveedor | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

  const filtered = useMemo(
    () =>
      insumos.filter((i) => {
        if (kindFilter !== 'todos' && i.kind !== kindFilter) return false
        if (onlyTrackStock && !i.track_stock) return false
        return matchesSearch(i.name, search)
      }),
    [insumos, search, kindFilter, onlyTrackStock],
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

  // Atajo "Corregir precio": salta a EDITAR la ultima compra que incluyo el
  // insumo. Ahi se corrige cantidad o monto (o se revisa la equivalencia) y
  // al guardar se recalculan current_price + historial por el flujo normal.
  async function handleCorregirPrecio(insumo: InsumoWithProveedor) {
    const toastId = toast.loading('Buscando la última compra...')
    const res = await getUltimaCompraDeInsumo(insumo.id)
    if (!res) {
      toast.error(
        `"${insumo.name}" no tiene compras registradas — el precio se edita desde "Editar".`,
        { id: toastId },
      )
      return
    }
    toast.dismiss(toastId)
    router.push(`/proveedores/${res.proveedorId}?editCompra=${res.compraId}`)
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

  function handleDelete(insumo: InsumoWithProveedor) {
    const ok = window.confirm(
      `¿Eliminar "${insumo.name}"? Se va a borrar el insumo y todas sus referencias (compras, recetas, productos, historial). Esta accion no se puede deshacer.`,
    )
    if (!ok) return
    startTransition(async () => {
      const result = await deleteInsumo(insumo.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Insumo "${insumo.name}" eliminado`)
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-1 md:flex-row md:items-center">
          <div className="relative md:max-w-xs md:flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar insumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => setOnlyTrackStock((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                onlyTrackStock
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <BoxIcon className="size-3.5" />
              Con stock
            </button>
          </div>
        </div>
        <Button onClick={openCreate} className="md:shrink-0">
          <PlusIcon className="size-4" />
          Nuevo insumo
        </Button>
      </div>

      {/* Cards mobile */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {search || kindFilter !== 'todos' || onlyTrackStock ? 'No se encontraron insumos' : 'Sin insumos. Creá el primero.'}
          </div>
        ) : (
          filtered.map((insumo) => (
            <div
              key={insumo.id}
              className={`rounded-xl border bg-card p-3 ${!insumo.active ? 'opacity-50' : ''}`}
              onClick={() => openView(insumo)}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{insumo.name}</p>
                    <p className="shrink-0 text-sm tabular-nums">{formatCurrency(insumo.current_price)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {UNIT_LABELS[insumo.unit]} · {insumo.proveedores?.name ?? 'Sin proveedor'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {insumo.kind === 'descartable' && (
                      <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">Descartable</Badge>
                    )}
                    {insumo.perishable && <Badge variant="outline" className="text-xs">Perecedero</Badge>}
                    {!insumo.active && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
                  </div>
                  {insumo.track_stock && (
                    <div className="mt-2">
                      <StockBar insumo={insumo} />
                    </div>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(insumo)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCorregirPrecio(insumo)}>
                        Corregir precio (ir a la compra)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(insumo)}>
                        {insumo.active ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(insumo)}
                        className="text-destructive focus:text-destructive"
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tabla desktop */}
      <div className="hidden rounded-xl border bg-card overflow-hidden md:block">
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
                  {search || kindFilter !== 'todos' || onlyTrackStock ? 'No se encontraron insumos' : 'Sin insumos. Creá el primero.'}
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
                        ? 'border-primary/25 bg-primary/10 text-primary font-normal'
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
                        <DropdownMenuItem onClick={() => handleCorregirPrecio(insumo)}>
                          Corregir precio (ir a la compra)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(insumo)}>
                          {insumo.active ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(insumo)}
                          className="text-destructive focus:text-destructive"
                        >
                          Eliminar
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
