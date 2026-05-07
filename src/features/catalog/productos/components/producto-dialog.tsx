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
import { IngredientesEditor } from '../../recetas/components/ingredientes-editor'
import { DescartablesEditor } from './descartables-editor'
import { UNITS, UNIT_LABELS } from '../../recetas/schemas'
import type { RecetaParaProducto } from '../../recetas/queries'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto: ProductoCost | null
  recetaData: RecetaParaProducto | null
  descartables: { insumo_id: string; qty: number }[]
  mode: Mode
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  insumosDescartables: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  subRecetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
}

const DEFAULT_VALUES: ProductoFormValues = {
  name: '',
  sale_price: 0,
  receta_id: null,
  target_margin_pct: 30,
  is_dynamic: false,
  yield_qty: 1,
  yield_unit: 'u',
  ingredientes: [],
  descartables: [],
}

export function ProductoDialog({
  open,
  onOpenChange,
  producto,
  recetaData,
  descartables,
  mode,
  insumos,
  insumosDescartables,
  subRecetas,
}: Props) {
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
            receta_id: producto.receta_id ?? null,
            target_margin_pct: producto.target_margin_pct ?? 30,
            is_dynamic: producto.is_dynamic ?? false,
            yield_qty: recetaData?.yield_qty ?? 1,
            yield_unit: (recetaData?.yield_unit ?? 'u') as ProductoFormValues['yield_unit'],
            ingredientes: recetaData?.ingredientes ?? [],
            descartables: descartables,
          }
        : DEFAULT_VALUES,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id, recetaData, mode])

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? 'Nuevo producto'
              : readOnly
                ? (producto?.name ?? 'Producto')
                : `Editar — ${producto?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            id="producto-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
          >
            {/* Nombre */}
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

            {/* Precio y margen */}
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

            {/* Rendimiento */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="yield_qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rendimiento (unidades)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yield_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {(v: string | null) => (v ? UNIT_LABELS[v as keyof typeof UNIT_LABELS] ?? v : null)}
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
            </div>

            {/* Plato del día */}
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

            {/* Ingredientes */}
            <div className="border-t pt-4">
              <IngredientesEditor
                insumos={insumos}
                recetas={subRecetas}
                currentRecetaId={producto?.receta_id ?? undefined}
                readOnly={readOnly}
              />
            </div>

            {/* Descartables */}
            <div className="border-t pt-4">
              <DescartablesEditor insumos={insumosDescartables} readOnly={readOnly} />
            </div>
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
