'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { pagoSchema, METODO_LABELS, type PagoFormValues } from '../schemas'
import { createPago } from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedorId: string
  proveedorName: string
  defaultMonto?: number
  compraId?: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(isoDate: string, months: number): string {
  // "Cheque a 30 días" en la práctica PyME argentina = mismo día del mes siguiente.
  // Si el día no existe en el mes destino (ej. 31/01 + 1 mes), cae al último día.
  const [y, m, d] = isoDate.split('-').map(Number)
  const targetMonthIdx = (m! - 1) + months
  const targetYear = y! + Math.floor(targetMonthIdx / 12)
  const targetMonth = ((targetMonthIdx % 12) + 12) % 12
  const lastDayOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(d!, lastDayOfTarget)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type Plazo = '30' | '60' | 'otro'

export function PagoDialog({ open, onOpenChange, proveedorId, proveedorName, defaultMonto, compraId }: Props) {
  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema) as Resolver<PagoFormValues>,
    defaultValues: { fecha: todayStr(), monto: 0, metodo: 'transferencia', descripcion: '' },
  })
  const [plazo, setPlazo] = useState<Plazo>('30')

  useEffect(() => {
    if (open) {
      form.reset({ fecha: todayStr(), monto: defaultMonto ?? 0, metodo: 'transferencia', descripcion: '' })
      setPlazo('30')
    }
  }, [open, defaultMonto, form])

  // Auto-recalcular due_date cuando cambia fecha o plazo (sólo si metodo=cheque)
  const metodo = form.watch('metodo')
  const fecha = form.watch('fecha')
  useEffect(() => {
    if (metodo !== 'cheque') {
      form.setValue('due_date', undefined)
      return
    }
    if (plazo === '30' || plazo === '60') {
      // "30 días" = 1 mes calendario; "60 días" = 2 meses calendario.
      const months = plazo === '30' ? 1 : 2
      form.setValue('due_date', addMonths(fecha, months), { shouldValidate: true })
    }
    // 'otro' deja el due_date como esté (lo edita el user)
  }, [metodo, fecha, plazo, form])

  async function onSubmit(values: PagoFormValues) {
    const result = await createPago(proveedorId, values, compraId)
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            {metodo === 'cheque' && (
              <div className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-3">
                <FormLabel>Plazo del cheque</FormLabel>
                <div className="flex gap-2">
                  {(['30', '60', 'otro'] as const).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={plazo === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPlazo(p)}
                      className={cn('flex-1', plazo === p && 'pointer-events-none')}
                    >
                      {p === 'otro' ? 'Otro' : `${p} días`}
                    </Button>
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Vence el</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ''}
                          disabled={plazo !== 'otro'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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
