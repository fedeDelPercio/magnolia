'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { hoyISO } from '@/lib/fecha'

import { createVacacion } from '../actions'
import { sumarDias } from '../lib/vacaciones-por-anio'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Con un empleado fijo (ficha) va directo; si no (panorama), se elige de la
  // lista. El panorama lo vuelve a montar en cada apertura (arranca sin elegir).
  empleadoId?: string
  empleados?: { id: string; name: string }[]
}

// Se pide el día en que vuelve a trabajar (así lo cuentan: "se va el 19 y
// vuelve el 26"); se guarda el último día de vacaciones, el anterior.
const formSchema = z
  .object({
    fecha_desde: z.string().min(1, 'Requerido'),
    fecha_vuelta: z.string().min(1, 'Requerido'),
    notas: z.string().optional(),
  })
  .refine((v) => v.fecha_vuelta > v.fecha_desde, {
    path: ['fecha_vuelta'],
    message: 'Tiene que volver después del primer día de vacaciones',
  })
type FormValues = z.infer<typeof formSchema>

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function diasHastaVolver(desde: string, vuelta: string): number | null {
  if (!desde || !vuelta || vuelta <= desde) return null
  return Math.round((Date.parse(vuelta) - Date.parse(desde)) / 86400000)
}

export function VacacionDialog({ open, onOpenChange, empleadoId, empleados = [] }: Props) {
  const [elegido, setElegido] = useState('')
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { fecha_desde: hoyISO(), fecha_vuelta: '', notas: '' },
  })

  useEffect(() => {
    if (!open) return
    form.reset({ fecha_desde: hoyISO(), fecha_vuelta: '', notas: '' })
  }, [open, form])

  const destino = empleadoId ?? elegido
  const nombreFijo = empleadoId ? empleados.find((e) => e.id === empleadoId)?.name : undefined
  const [desde, vuelta] = useWatch({ control: form.control, name: ['fecha_desde', 'fecha_vuelta'] })
  const dias = diasHastaVolver(desde, vuelta)

  async function onSubmit(values: FormValues) {
    if (!destino) {
      toast.error('Elegí el empleado')
      return
    }
    const result = await createVacacion(destino, {
      fecha_desde: values.fecha_desde,
      fecha_hasta: sumarDias(values.fecha_vuelta, -1),
      notas: values.notas,
    })
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
                    <FormLabel>Primer día</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_vuelta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vuelve a trabajar</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {dias !== null && (
              <p className="text-xs text-muted-foreground">
                {dias} {dias === 1 ? 'día' : 'días'} de vacaciones (del {ddmm(desde)} al {ddmm(sumarDias(vuelta, -1))})
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
