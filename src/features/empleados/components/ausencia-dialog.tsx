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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { ausenciaSchema, type AusenciaFormValues, TIPO_AUSENCIA, TIPO_AUSENCIA_LABELS, type TipoAusencia } from '../schemas'
import { createAusencia } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  empleadoId: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const DEFAULT: AusenciaFormValues = {
  fecha: today(),
  tipo: 'injustificada',
  paga: false,
  notas: '',
}

export function AusenciaDialog({ open, onOpenChange, empleadoId }: Props) {
  const form = useForm<AusenciaFormValues>({
    resolver: zodResolver(ausenciaSchema) as Resolver<AusenciaFormValues>,
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (open) form.reset(DEFAULT)
  }, [open, form])

  async function onSubmit(values: AusenciaFormValues) {
    const result = await createAusencia(empleadoId, values)
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
          <form id="ausencia-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      // Auto-marcar paga=true para feriados (default lógico)
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
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="ausencia-paga" />
                    <div className="space-y-0.5">
                      <FormLabel htmlFor="ausencia-paga" className="cursor-pointer">
                        ¿Se paga el día?
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Feriados y licencias justificadas suelen pagarse; ausencias injustificadas no.
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
                  <FormControl><Input placeholder="Ej: certificado médico, llegó tarde, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="ausencia-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
