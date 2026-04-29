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

import { UNIT_LABELS } from '../../insumos/schemas'
import { toggleRecetaActive } from '../actions'
import { RecetaDialog } from './receta-dialog'
import type { RecetaWithIngredientes } from '../queries'
import type { Tables } from '@/types/database'

type Props = {
  recetas: RecetaWithIngredientes[]
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
}

type DialogMode = 'view' | 'edit' | 'create'

export function RecetasClient({ recetas, insumos }: Props) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecetaWithIngredientes | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

  const filtered = useMemo(
    () => recetas.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [recetas, search],
  )

  const recetasSimple = useMemo(
    () =>
      recetas.map((r) => ({
        id: r.id,
        name: r.name,
        yield_unit: r.yield_unit,
        yield_qty: r.yield_qty,
      })),
    [recetas],
  )

  function openCreate() {
    setEditing(null)
    setMode('create')
    setDialogOpen(true)
  }

  function openView(receta: RecetaWithIngredientes) {
    setEditing(receta)
    setMode('view')
    setDialogOpen(true)
  }

  function openEdit(receta: RecetaWithIngredientes) {
    setEditing(receta)
    setMode('edit')
    setDialogOpen(true)
  }

  function handleToggleActive(receta: RecetaWithIngredientes) {
    startTransition(async () => {
      const result = await toggleRecetaActive(receta.id, !receta.active)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(receta.active ? 'Receta desactivada' : 'Receta activada')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar receta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          Nueva receta
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Rendimiento</TableHead>
              <TableHead className="text-center">Ingredientes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search ? 'No se encontraron recetas' : 'Sin recetas. Creá la primera.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((receta) => (
                <TableRow
                  key={receta.id}
                  className={`cursor-pointer hover:bg-muted/50 ${!receta.active ? 'opacity-50' : ''}`}
                  onClick={() => openView(receta)}
                >
                  <TableCell className="font-medium">{receta.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {receta.category ?? '—'}
                  </TableCell>
                  <TableCell>
                    {receta.yield_qty} {UNIT_LABELS[receta.yield_unit]}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {receta.receta_ingredientes.length}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={receta.active
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'}
                    >
                      {receta.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(receta)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(receta)}>
                          {receta.active ? 'Desactivar' : 'Activar'}
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

      <RecetaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        receta={editing}
        mode={mode}
        insumos={insumos}
        recetas={recetasSimple}
      />
    </div>
  )
}
