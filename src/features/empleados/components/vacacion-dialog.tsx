'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { hoyISO } from '@/lib/fecha'

import { vacacionSchema, type VacacionFormValues } from '../schemas'
import { createVacacion } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Con un empleado fijo (ficha) va directo; si no (panorama), se elige de la
  // lista. El panorama lo vuelve a montar en cada apertura (arranca sin elegir).
  empleadoId?: string
  empleados?: { id: string; name: string }[]
}

function diasEntre(desde: string, hasta: string): number | null {
  if (!desde || !hasta || hasta < desde) return null
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1
}

export function VacacionDialog({ open, onOpenChange, empleadoId, empleados = [] }: Props) {
  const [elegido, setElegido] = useState('')
  const form = useForm<VacacionFormValues>({
    resolver: zodResolver(vacacionSchema) as Resolver<VacacionFormValues>,
    defaultValues: { fecha_desde: hoyISO(), fecha_hasta: hoyISO(), notas: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({ fecha_desde: hoyISO(), fecha_hasta: hoyISO(), notas: '' })
  }, [open, form])

  const destino = empleadoId ?? elegido
  const nombreFijo = empleadoId ? empleados.find((e) => e.id === empleadoId)?.name : undefined
  const [desde, hasta] = useWatch({ control: form.control, name: ['fecha_desde', 'fecha_hasta'] })
  const dias = diasEntre(desde, hasta)

  async function onSubmit(values: VacacionFormValues) {
    if (!destino) {
      toast.error('Elegí el empleado')
      return
    }
    const result = await createVacacion(destino, values)
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
          <DialogTitle>Registrar vacaciones{nombreFijo ? ` — ${nombreFijo}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="vacacion-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!empleadoId && (
              <div className="space-y-1">
                <label htmlFor="vacacion-empleado" className="text-sm font-medium">Empleado</label>
                <select
                  id="vacacion-empleado"
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Elegí…</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
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
            {dias !== null && (
              <p className="text-xs text-muted-foreground">
                {dias} {dias === 1 ? 'día' : 'días'} corridos
              </p>
            )}
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
