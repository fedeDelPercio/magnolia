'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { cajaEgresoSchema, type CajaEgresoFormValues } from '@/features/suppliers/schemas'
import { createEgreso } from '../actions'

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const CATEGORIAS = [
  'Servicios (luz/gas/agua)',
  'Alquiler',
  'Sueldos',
  'Limpieza',
  'Mantenimiento',
  'Transporte',
  'Impuestos',
  'Otro',
]

export function EgresoDialog({ open, onOpenChange }: Props) {
  const form = useForm<CajaEgresoFormValues>({
    resolver: zodResolver(cajaEgresoSchema) as Resolver<CajaEgresoFormValues>,
    defaultValues: { fecha: todayStr(), categoria: '', monto: 0, descripcion: '' },
  })

  useEffect(() => {
    if (open) form.reset({ fecha: todayStr(), categoria: '', monto: 0, descripcion: '' })
  }, [open, form])

  async function onSubmit(values: CajaEgresoFormValues) {
    const result = await createEgreso(values)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Egreso registrado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar egreso</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Servicios, Alquiler..." list="categorias-egreso" {...field} />
                  </FormControl>
                  <datalist id="categorias-egreso">
                    {CATEGORIAS.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto (ARS)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
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
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl><Input placeholder="Detalle adicional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
