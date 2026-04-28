'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

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

import { insumoSchema, UNITS, UNIT_LABELS, type InsumoFormValues } from '../schemas'
import { createInsumo, updateInsumo } from '../actions'
import type { InsumoWithProveedor } from '../queries'
import type { Tables } from '@/types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  insumo: InsumoWithProveedor | null
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
}

const DEFAULT_VALUES: InsumoFormValues = {
  name: '',
  unit: 'kg',
  current_price: 0,
  proveedor_id: null,
  perishable: false,
  shelf_life_days: null,
}

export function InsumoDialog({ open, onOpenChange, insumo, proveedores }: Props) {
  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(insumoSchema) as Resolver<InsumoFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const perishable = form.watch('perishable')

  useEffect(() => {
    if (open) {
      form.reset(
        insumo
          ? {
              name: insumo.name,
              unit: insumo.unit,
              current_price: insumo.current_price,
              proveedor_id: insumo.proveedor_id,
              perishable: insumo.perishable,
              shelf_life_days: insumo.shelf_life_days,
            }
          : DEFAULT_VALUES,
      )
    }
  }, [open, insumo, form])

  async function onSubmit(values: InsumoFormValues) {
    const result = insumo ? await updateInsumo(insumo.id, values) : await createInsumo(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(insumo ? 'Insumo actualizado' : 'Insumo creado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{insumo ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Harina 000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {UNIT_LABELS[u]}
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
                name="current_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio por unidad (ARS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
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
              name="proveedor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                    value={field.value ?? '_none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin proveedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Sin proveedor</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
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
              name="perishable"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="perishable-check"
                    />
                    <FormLabel htmlFor="perishable-check" className="cursor-pointer">
                      Perecedero
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {perishable && (
              <FormField
                control={form.control}
                name="shelf_life_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vida útil (días)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ej: 7"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
