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

import { insumoSchema, UNITS, UNIT_LABELS, type UnitKind, type InsumoFormValues } from '../schemas'
import { createInsumo, updateInsumo } from '../actions'
import type { InsumoWithProveedor } from '../queries'
import type { Tables } from '@/types/database'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  insumo: InsumoWithProveedor | null
  mode: Mode
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

export function InsumoDialog({ open, onOpenChange, insumo, mode, proveedores }: Props) {
  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(insumoSchema) as Resolver<InsumoFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const [editing, setEditing] = useState(mode !== 'view')

  const perishable = form.watch('perishable')

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, insumo?.id, mode])

  const readOnly = !editing
  const isCreate = mode === 'create'

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
          <DialogTitle>
            {isCreate ? 'Nuevo insumo' : readOnly ? insumo?.name ?? 'Insumo' : `Editar — ${insumo?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form id="insumo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Harina 000" disabled={readOnly} {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {(v: string | null) => v ? UNIT_LABELS[v as UnitKind] ?? v : null}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u} label={UNIT_LABELS[u]}>
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
              name="proveedor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                    value={field.value ?? '_none'}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin proveedor">
                          {(v: string | null) => (!v || v === '_none') ? 'Sin proveedor' : (proveedores.find((p) => p.id === v)?.name ?? v)}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none" label="Sin proveedor">Sin proveedor</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id} label={p.name}>
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
                      disabled={readOnly}
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
                        disabled={readOnly}
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
            <Button type="submit" form="insumo-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
