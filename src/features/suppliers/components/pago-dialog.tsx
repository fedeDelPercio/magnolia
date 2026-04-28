'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { pagoSchema, METODO_LABELS, type PagoFormValues } from '../schemas'
import { createPago } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedorId: string
  proveedorName: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function PagoDialog({ open, onOpenChange, proveedorId, proveedorName }: Props) {
  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema) as Resolver<PagoFormValues>,
    defaultValues: { fecha: todayStr(), monto: 0, metodo: 'transferencia', descripcion: '' },
  })

  useEffect(() => {
    if (open) form.reset({ fecha: todayStr(), monto: 0, metodo: 'transferencia', descripcion: '' })
  }, [open, form])

  async function onSubmit(values: PagoFormValues) {
    const result = await createPago(proveedorId, values)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Pago registrado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pago a {proveedorName}</DialogTitle>
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

            <div className="grid grid-cols-2 gap-3">
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
                name="metodo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => v ? METODO_LABELS[v] ?? v : null}
                        </SelectValue>
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['efectivo', 'transferencia', 'cheque', 'otro'] as const).map((m) => (
                          <SelectItem key={m} value={m} label={METODO_LABELS[m]}>{METODO_LABELS[m]}</SelectItem>
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
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl><Input placeholder="Ej: Factura #1234" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Registrar pago'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
