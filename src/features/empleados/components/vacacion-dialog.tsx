'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { vacacionSchema, type VacacionFormValues } from '../schemas'
import { createVacacion } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleadoId: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT: VacacionFormValues = {
  fecha_desde: today(),
  fecha_hasta: today(),
  notas: '',
}

export function VacacionDialog({ open, onOpenChange, empleadoId }: Props) {
  const form = useForm<VacacionFormValues>({
    resolver: zodResolver(vacacionSchema) as Resolver<VacacionFormValues>,
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (open) form.reset(DEFAULT)
  }, [open, form])

  async function onSubmit(values: VacacionFormValues) {
    const result = await createVacacion(empleadoId, values)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Vacaciones registradas')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar vacaciones</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="vacacion-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="fecha_desde"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desde</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_hasta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hasta</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl><Input placeholder="Ej: 7 días, resto del año" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="vacacion-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
