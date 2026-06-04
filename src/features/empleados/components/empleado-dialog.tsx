'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

import { empleadoSchema, type EmpleadoFormValues } from '../schemas'
import { createEmpleado, updateEmpleado } from '../actions'
import type { Empleado } from '../queries'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleado: Empleado | null
}

const DEFAULT: EmpleadoFormValues = {
  name: '',
  fecha_ingreso: '',
  sueldo_diario: 0,
  plus_mensual: 0,
  aguinaldo_estimado: 0,
  vacaciones_dias_anuales: 14,
  activo: true,
  notas: '',
}

export function EmpleadoDialog({ open, onOpenChange, empleado }: Props) {
  const form = useForm<EmpleadoFormValues>({
    resolver: zodResolver(empleadoSchema) as Resolver<EmpleadoFormValues>,
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (!open) return
    const initial: EmpleadoFormValues = empleado
      ? {
          name: empleado.name,
          fecha_ingreso: empleado.fecha_ingreso ?? '',
          sueldo_diario: Number(empleado.sueldo_diario),
          plus_mensual: Number(empleado.plus_mensual),
          aguinaldo_estimado: Number(empleado.aguinaldo_estimado),
          vacaciones_dias_anuales: empleado.vacaciones_dias_anuales,
          activo: empleado.activo,
          notas: empleado.notas ?? '',
        }
      : DEFAULT
    form.reset(initial)
  }, [open, empleado, form])

  async function onSubmit(values: EmpleadoFormValues) {
    const result = empleado
      ? await updateEmpleado(empleado.id, values)
      : await createEmpleado(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(empleado ? 'Empleado actualizado' : 'Empleado creado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{empleado ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          <Form {...form}>
            <form id="empleado-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Ej: Brisa" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fecha_ingreso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de ingreso (opcional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="sueldo_diario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sueldo / día (ARS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plus_mensual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plus mensual (ARS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="aguinaldo_estimado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aguinaldo estimado</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vacaciones_dias_anuales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vacaciones (días/año)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="60"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="empleado-activo"
                      />
                      <div className="space-y-0.5">
                        <FormLabel htmlFor="empleado-activo" className="cursor-pointer">
                          Activo
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Si lo desactivás, deja de aparecer en liquidaciones.
                        </p>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl><Input placeholder="Observaciones" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="empleado-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
