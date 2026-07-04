'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { PlusIcon, MoreHorizontalIcon, SearchIcon, ClipboardListIcon } from 'lucide-react'

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
import { toggleProductoActive, deleteProducto } from '../actions'
import { ProductoDialog, type ProductoDialogInput } from './producto-dialog'
import type { ProductoCost } from '../queries'
import type { Tables } from '@/types/database'
import type { RecetaParaProducto, DescartableParaProducto } from '../../recetas/queries'
import type { VariantData } from '../schemas'

type Props = {
  productos: ProductoCost[]
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  insumosDescartables: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  recetasParaProductos: RecetaParaProducto[]
  descartablesParaProductos: DescartableParaProducto[]
  subRecetas: (Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'> & { total_cost?: number })[]
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
  const [onlySinReceta, setOnlySinReceta] = useState(false)
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

  // Los productos con concepto_id agrupan variantes (base + delivery + menu).
  // Solo mostramos la fila "base" (canal=null|salon + formato=null|individual)
  // por cada concepto; al abrirla se ven las variantes en tabs. Los productos
  // standalone (sin concepto) se muestran tal cual. Cuando hay al menos una
  // variante activa la usamos como base; si todas estan inactivas, mostramos
  // igual una fila gris para que el usuario pueda reactivar o eliminar.
  const collapsed = useMemo(() => {
    const seen = new Set<string>()
    const out: ProductoCost[] = []
    const pickBase = (arr: ProductoCost[]) =>
      arr.find(
        (s) =>
          (s.canal === null || s.canal === 'salon') &&
          (s.formato === null || s.formato === 'individual'),
      ) ??
      arr.find((s) => s.canal === null && s.formato === null) ??
      arr[0]!
    for (const p of productos) {
      if (!p.concepto_id) {
        out.push(p)
        continue
      }
      if (seen.has(p.concepto_id)) continue
      const allSiblings = productos.filter((s) => s.concepto_id === p.concepto_id)
      if (allSiblings.length === 0) continue
      const activeSiblings = allSiblings.filter((s) => s.active)
      const arr = activeSiblings.length > 0 ? activeSiblings : allSiblings
      seen.add(p.concepto_id)
      out.push(pickBase(arr))
    }
    return out
  }, [productos])

  const filtered = useMemo(
    () =>
      collapsed.filter((p) => {
        if (onlySinReceta && p.receta_id) return false
        return (p.name ?? '').toLowerCase().includes(search.toLowerCase())
      }),
    [collapsed, search, onlySinReceta],
  )

  function buildDialogInput(target: ProductoCost | null): ProductoDialogInput | null {
    if (!target) return null
    // Reunir siblings por concepto_id. Si el producto es standalone, solo el.
    // Solo consideramos siblings activos: los inactivos son soft-deleteados y
    // no queremos que aparezcan como variantes tildadas.
    const siblings = target.concepto_id
      ? productos.filter((p) => p.concepto_id === target.concepto_id && p.active)
      : [target]
    const base =
      siblings.find(
        (s) =>
          (s.canal === null || s.canal === 'salon') &&
          (s.formato === null || s.formato === 'individual'),
      ) ??
      siblings.find((s) => s.canal === null && s.formato === null) ??
      target
    const delivery = siblings.find((s) => s.canal === 'delivery' && s.formato !== 'menu') ?? null
    const menu = siblings.find((s) => s.formato === 'menu' && s.canal !== 'delivery') ?? null

    const dataFor = (p: ProductoCost | null): VariantData | null => {
      if (!p || !p.id) return null
      const receta = p.receta_id ? recetaMap.get(p.receta_id) : null
      return {
        producto_id: p.id,
        receta_id: p.receta_id ?? null,
        sale_price: p.sale_price ?? 0,
        ingredientes: receta?.ingredientes ?? [],
        descartables: descartablesMap.get(p.id) ?? [],
      }
    }

    const baseReceta = base.receta_id ? recetaMap.get(base.receta_id) : null
    return {
      productoBaseId: base.id ?? null,
      name: base.name ?? '',
      target_margin_pct: base.target_margin_pct ?? 30,
      is_dynamic: base.is_dynamic ?? false,
      yield_qty: baseReceta?.yield_qty ?? 1,
      yield_unit: (baseReceta?.yield_unit ?? 'u') as ProductoDialogInput['yield_unit'],
      base: dataFor(base) ?? { producto_id: null, receta_id: null, sale_price: 0, ingredientes: [], descartables: [] },
      delivery: dataFor(delivery),
      menu: dataFor(menu),
    }
  }

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

  function handleDelete(producto: ProductoCost) {
    if (!producto.id) return
    const hasVariants = !!producto.concepto_id
    const msg = hasVariants
      ? `¿Eliminar "${producto.name}" y todas sus variantes? Se van a borrar los precios, ingredientes y descartables. Esta accion no se puede deshacer.`
      : `¿Eliminar "${producto.name}"? Esta accion no se puede deshacer.`
    if (!window.confirm(msg)) return
    startTransition(async () => {
      const result = await deleteProducto(producto.id!)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Producto eliminado')
      }
    })
  }

  const dialogInput = buildDialogInput(editing)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-1 md:flex-row md:items-center">
          <div className="relative md:max-w-xs md:flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlySinReceta((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              onlySinReceta
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <ClipboardListIcon className="size-3.5" />
            Sin receta
          </button>
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
            {search || onlySinReceta ? 'No se encontraron productos' : 'Sin productos. Creá el primero.'}
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
                      <DropdownMenuItem
                        onClick={() => handleDelete(producto)}
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
                  {search || onlySinReceta ? 'No se encontraron productos' : 'Sin productos. Creá el primero.'}
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
                        <DropdownMenuItem
                          onClick={() => handleDelete(producto)}
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

      <ProductoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        input={dialogInput}
        mode={mode}
        insumos={insumos}
        insumosDescartables={insumosDescartables}
        subRecetas={subRecetas}
      />
    </div>
  )
}
