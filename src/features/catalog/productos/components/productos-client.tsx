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

type Props = {
  productos: ProductoCost[]
  recetas: Pick<Tables<'recetas'>, 'id' | 'name'>[]
}

function MarginBadge({ margin, target }: { margin: number; target: number }) {
  const ok = margin >= target
  return (
    <Badge
      variant="outline"
      className={ok
        ? 'border-green-200 bg-green-50 tabular-nums text-xs text-green-700'
        : 'border-red-200 bg-red-50 tabular-nums text-xs text-red-600'}
    >
      {formatPct(margin)}
    </Badge>
  )
}

type DialogMode = 'view' | 'edit' | 'create'

export function ProductosClient({ productos, recetas }: Props) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductoCost | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          Nuevo producto
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Receta</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                  <TableCell className="text-muted-foreground">
                    {producto.receta_name ?? '—'}
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
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'}
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
        mode={mode}
        recetas={recetas}
      />
    </div>
  )
}
