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
import { UNIT_LABELS } from '../schemas'
import { toggleInsumoActive } from '../actions'
import { InsumoDialog } from './insumo-dialog'
import type { InsumoWithProveedor } from '../queries'
import type { Tables } from '@/types/database'

type Props = {
  insumos: InsumoWithProveedor[]
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
}

type DialogMode = 'view' | 'edit' | 'create'

export function InsumosClient({ insumos, proveedores }: Props) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InsumoWithProveedor | null>(null)
  const [mode, setMode] = useState<DialogMode>('create')
  const [, startTransition] = useTransition()

  const filtered = useMemo(
    () =>
      insumos.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [insumos, search],
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
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
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {search ? 'No se encontraron insumos' : 'Sin insumos. Creá el primero.'}
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
                  <TableCell className="text-right font-mono">
                    {formatCurrency(insumo.current_price)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {insumo.proveedores?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    {insumo.perishable && (
                      <Badge variant="outline" className="text-xs">
                        Perecedero
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={insumo.active
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'}
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
