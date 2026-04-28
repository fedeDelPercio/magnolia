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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

import { recetaSchema, UNITS, UNIT_LABELS, type UnitKind, type RecetaFormValues } from '../schemas'
import { createReceta, updateReceta } from '../actions'
import { IngredientesEditor } from './ingredientes-editor'
import type { RecetaWithIngredientes } from '../queries'
import type { Tables } from '@/types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  receta: RecetaWithIngredientes | null
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  recetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
}

const DEFAULT_VALUES: RecetaFormValues = {
  name: '',
  category: '',
  yield_qty: 1,
  yield_unit: 'u',
  notes: '',
  ingredientes: [],
}

export function RecetaDialog({ open, onOpenChange, receta, insumos, recetas }: Props) {
  const form = useForm<RecetaFormValues>({
    resolver: zodResolver(recetaSchema) as Resolver<RecetaFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open) {
      form.reset(
        receta
          ? {
              name: receta.name,
              category: receta.category ?? '',
              yield_qty: receta.yield_qty,
              yield_unit: receta.yield_unit,
              notes: receta.notes ?? '',
              ingredientes: receta.receta_ingredientes.map((ri) => ({
                kind: ri.kind,
                insumo_id: ri.insumo_id ?? undefined,
                sub_receta_id: ri.sub_receta_id ?? undefined,
                qty: ri.qty,
                unit: ri.unit,
              })),
            }
          : DEFAULT_VALUES,
      )
    }
  }, [open, receta, form])

  async function onSubmit(values: RecetaFormValues) {
    const result = receta ? await updateReceta(receta.id, values) : await createReceta(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(receta ? 'Receta actualizada' : 'Receta creada')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{receta ? 'Editar receta' : 'Nueva receta'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Base de tarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Tartas, Postres..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="yield_qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rendimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.001"
                          step="any"
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
                  name="yield_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Temperatura de horno, tiempos de reposo..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <IngredientesEditor
              insumos={insumos}
              recetas={recetas}
              currentRecetaId={receta?.id}
            />

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
