'use client'

import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { proveedorSchema, type ProveedorFormValues } from '../schemas'
import { createProveedor, updateProveedor } from '../actions'
import type { Tables } from '@/types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedor: Tables<'proveedores'> | null
}

const DEFAULT: ProveedorFormValues = {
  name: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  payment_terms_days: 0,
  notes: '',
}

export function ProveedorDialog({ open, onOpenChange, proveedor }: Props) {
  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema) as Resolver<ProveedorFormValues>,
    defaultValues: DEFAULT,
  })

  useEffect(() => {
    if (open) {
      form.reset(
        proveedor
          ? {
              name: proveedor.name,
              contact_name: proveedor.contact_name ?? '',
              contact_phone: proveedor.contact_phone ?? '',
              contact_email: proveedor.contact_email ?? '',
              payment_terms_days: proveedor.payment_terms_days,
              notes: proveedor.notes ?? '',
            }
          : DEFAULT,
      )
    }
  }, [open, proveedor, form])

  async function onSubmit(values: ProveedorFormValues) {
    const result = proveedor
      ? await updateProveedor(proveedor.id, values)
      : await createProveedor(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(proveedor ? 'Proveedor actualizado' : 'Proveedor creado')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input placeholder="Ej: Luchador" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto</FormLabel>
                    <FormControl><Input placeholder="Nombre" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl><Input placeholder="11 1234-5678" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="proveedor@ejemplo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_terms_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días para pago (0 = contado)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl><Input placeholder="Observaciones" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
