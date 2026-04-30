'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PlusIcon, MoreHorizontalIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { formatCurrency } from '@/lib/format'
import { toggleProveedorActive } from '../actions'
import { ProveedorDialog } from './proveedor-dialog'
import type { SaldoProveedor } from '../queries'
import type { Tables } from '@/types/database'

type Props = { proveedores: SaldoProveedor[] }

export function ProveedoresClient({ proveedores }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Tables<'proveedores'> | null>(null)

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {proveedores.length === 0 ? 'Sin proveedores.' : `${proveedores.length} proveedores`}
        </p>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          Nuevo proveedor
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-center">Días de pago</TableHead>
              <TableHead className="text-right">Saldo deudor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin proveedores. Creá el primero.
                </TableCell>
              </TableRow>
            ) : (
              proveedores.map((p) => (
                <TableRow
                  key={p.id}
                  className={`cursor-pointer hover:bg-gray-50 ${!p.active ? 'opacity-50' : ''}`}
                  onClick={() => router.push(`/proveedores/${p.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1">
                      {p.name}
                      <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {p.payment_terms_days === 0 ? 'Contado' : `${p.payment_terms_days} días`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.saldo > 0 ? (
                      <span className="text-red-600">{formatCurrency(p.saldo)}</span>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={p.active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}
                    >
                      {p.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProveedorDialog open={dialogOpen} onOpenChange={setDialogOpen} proveedor={editing} />
    </div>
  )
}
