'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { TIPO_AUSENCIA, TIPO_AUSENCIA_LABELS, type TipoAusencia } from '../schemas'
import { createAusencia } from '../actions'

const quickSchema = z.object({
  empleado_id: z.string().min(1, 'Elegí un empleado'),
  fecha: z.string().min(1),
  tipo: z.enum(TIPO_AUSENCIA),
  paga: z.boolean().default(false),
  notas: z.string().optional(),
})
type QuickValues = z.infer<typeof quickSchema>

function today() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT: QuickValues = {
  empleado_id: '',
  fecha: today(),
  tipo: 'injustificada',
  paga: false,
  notas: '',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleados: { id: string; name: string }[]
}

export function AusenciaQuickDialog({ open, onOpenChange, empleados }: Props) {
  const form = useForm<QuickValues>({
    resolver: zodResolver(quickSchema) as Resolver<QuickValues>,
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (open) form.reset(DEFAULT)
  }, [open, form])

  async function onSubmit(values: QuickValues) {
    const { empleado_id, ...rest } = values
    const result = await createAusencia(empleado_id, rest)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Ausencia registrada')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar ausencia</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form id="ausencia-quick-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="empleado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empleado</FormLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => empleados.find((e) => e.id === v)?.name ?? 'Elegir empleado'}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {empleados.map((e) => (
                        <SelectItem key={e.id} value={e.id} label={e.name}>
                          {e.name}
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
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (!v) return
                      field.onChange(v as TipoAusencia)
                      if (v === 'feriado') form.setValue('paga', true)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => (v ? TIPO_AUSENCIA_LABELS[v as TipoAusencia] : null)}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPO_AUSENCIA.map((t) => (
                        <SelectItem key={t} value={t} label={TIPO_AUSENCIA_LABELS[t]}>
                          {TIPO_AUSENCIA_LABELS[t]}
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
              name="paga"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="quick-paga" />
                    <div className="space-y-0.5">
                      <FormLabel htmlFor="quick-paga" className="cursor-pointer">
                        ¿Se paga el día?
                      </FormLabel>
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
                  <FormControl><Input placeholder="Ej: certificado médico" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="ausencia-quick-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
