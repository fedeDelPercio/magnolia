'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { PencilIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

import { productoSchema, type ProductoFormValues } from '../schemas'
import { createProducto, updateProducto } from '../actions'
import type { ProductoCost } from '../queries'
import type { Tables } from '@/types/database'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto: ProductoCost | null
  mode: Mode
  recetas: Pick<Tables<'recetas'>, 'id' | 'name'>[]
}

const DEFAULT_VALUES: ProductoFormValues = {
  name: '',
  sale_price: 0,
  receta_id: null,
  descartable_cost: 0,
  target_margin_pct: 30,
  is_dynamic: false,
}

export function ProductoDialog({ open, onOpenChange, producto, mode, recetas }: Props) {
  const form = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema) as Resolver<ProductoFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const [editing, setEditing] = useState(mode !== 'view')

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
    form.reset(
      producto
        ? {
            name: producto.name ?? '',
            sale_price: producto.sale_price ?? 0,
            receta_id: producto.receta_id,
            descartable_cost: producto.descartable_cost ?? 0,
            target_margin_pct: producto.target_margin_pct ?? 30,
            is_dynamic: producto.is_dynamic ?? false,
          }
        : DEFAULT_VALUES,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id, mode])

  const readOnly = !editing
  const isCreate = mode === 'create'

  async function onSubmit(values: ProductoFormValues) {
    const result = producto
      ? await updateProducto(producto.id!, values)
      : await createProducto(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(producto ? 'Producto actualizado' : 'Producto creado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Nuevo producto' : readOnly ? producto?.name ?? 'Producto' : `Editar — ${producto?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id="producto-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Quiche lorraine" disabled={readOnly} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio de venta (ARS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_margin_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margen objetivo (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="receta_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receta (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                    value={field.value ?? '_none'}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin receta">
                          {(v: string | null) => (!v || v === '_none') ? 'Sin receta' : (recetas.find((r) => r.id === v)?.name ?? v)}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none" label="Sin receta">Sin receta</SelectItem>
                      {recetas.map((r) => (
                        <SelectItem key={r.id} value={r.id} label={r.name}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descartable_cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo descartable (ARS)</FormLabel>
                  <FormControl>
                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_dynamic"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
                    />
                    <FormLabel className="cursor-pointer">
                      Plato del día (nombre variable)
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (readOnly || isCreate) onOpenChange(false)
              else setEditing(false)
            }}
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {readOnly ? (
            // Workaround Base UI: ver receta-dialog.tsx
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PencilIcon className="size-4" />
              Editar
            </button>
          ) : (
            <Button type="submit" form="producto-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
