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

import { formatCurrency, formatPct } from '@/lib/format'
import { toggleProductoActive } from '../actions'
import { ProductoDialog } from './producto-dialog'
import type { ProductoCost } from '../queries'
import type { Tables } from '@/types/database'
import type { RecetaParaProducto, DescartableParaProducto } from '../../recetas/queries'

type Props = {
  productos: ProductoCost[]
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  insumosDescartables: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  recetasParaProductos: RecetaParaProducto[]
  descartablesParaProductos: DescartableParaProducto[]
  subRecetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
}

function MarginBadge({ margin, target }: { margin: number; target: number }) {
  const ok = margin >= target
  return (
    <Badge
      variant="outline"
      className={ok
        ? 'border-primary/25 bg-primary/10 tabular-nums text-xs text-primary'
        : 'border-rose-200/70 bg-rose-50/60 tabular-nums text-xs text-rose-800/90'}
    >
      {formatPct(margin)}
    </Badge>
  )
}

type DialogMode = 'view' | 'edit' | 'create'

export function ProductosClient({ productos, insumos, insumosDescartables, recetasParaProductos, descartablesParaProductos, subRecetas }: Props) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductoCost | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

  const recetaMap = useMemo(
    () => new Map(recetasParaProductos.map((r) => [r.id, r])),
    [recetasParaProductos],
  )

  const descartablesMap = useMemo(
    () => new Map(descartablesParaProductos.map((d) => [d.producto_id, d.descartables])),
    [descartablesParaProductos],
  )

  const filtered = useMemo(
    () =>
      productos.filter((p) => (p.name ?? '').toLowerCase().includes(search.toLowerCase())),
    [productos, search],
  )

  function openCreate() {
    setEditing(null)
    setMode('create')
    setDialogOpen(true)
  }

  function openView(producto: ProductoCost) {
    setEditing(producto)
    setMode('view')
    setDialogOpen(true)
  }

  function openEdit(producto: ProductoCost) {
    setEditing(producto)
    setMode('edit')
    setDialogOpen(true)
  }

  function handleToggleActive(producto: ProductoCost) {
    if (!producto.id) return
    startTransition(async () => {
      const result = await toggleProductoActive(producto.id!, !producto.active)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(producto.active ? 'Producto desactivado' : 'Producto activado')
      }
    })
  }

  const currentRecetaData = editing?.receta_id ? (recetaMap.get(editing.receta_id) ?? null) : null
  const currentDescartables = editing?.id ? (descartablesMap.get(editing.id) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:max-w-xs md:flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate} className="md:shrink-0">
          <PlusIcon className="size-4" />
          Nuevo producto
        </Button>
      </div>

      {/* Cards mobile */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            {search ? 'No se encontraron productos' : 'Sin productos. Creá el primero.'}
          </div>
        ) : (
          filtered.map((producto) => (
            <div
              key={producto.id}
              className={`rounded-xl border bg-card p-3 ${!producto.active ? 'opacity-50' : ''}`}
              onClick={() => openView(producto)}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{producto.name}</p>
                    <p className="shrink-0 text-sm tabular-nums">{formatCurrency(producto.sale_price ?? 0)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Costo {formatCurrency(producto.total_cost ?? 0)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <MarginBadge margin={producto.margin_pct ?? 0} target={producto.target_margin_pct ?? 30} />
                    {producto.is_dynamic && <Badge variant="outline" className="text-xs">Variable</Badge>}
                    {!producto.active && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(producto)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(producto)}>
                        {producto.active ? 'Desactivar' : 'Activar'}
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
              <TableHead className="text-right">Precio venta</TableHead>
              <TableHead className="text-right">Costo total</TableHead>
              <TableHead className="text-center">Margen</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search ? 'No se encontraron productos' : 'Sin productos. Creá el primero.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((producto) => (
                <TableRow
                  key={producto.id}
                  className={`cursor-pointer hover:bg-muted/50 ${!producto.active ? 'opacity-50' : ''}`}
                  onClick={() => openView(producto)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {producto.name}
                      {producto.is_dynamic && (
                        <Badge variant="outline" className="text-xs">
                          Variable
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(producto.sale_price ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(producto.total_cost ?? 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    <MarginBadge
                      margin={producto.margin_pct ?? 0}
                      target={producto.target_margin_pct ?? 30}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={producto.active
                        ? 'border-primary/25 bg-primary/10 text-primary font-normal'
                        : 'border-border bg-muted/40 text-muted-foreground font-normal'}
                    >
                      {producto.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(producto)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(producto)}>
                          {producto.active ? 'Desactivar' : 'Activar'}
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

      <ProductoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        producto={editing}
        recetaData={currentRecetaData}
        descartables={currentDescartables}
        mode={mode}
        insumos={insumos}
        insumosDescartables={insumosDescartables}
        subRecetas={subRecetas}
      />
    </div>
  )
}
