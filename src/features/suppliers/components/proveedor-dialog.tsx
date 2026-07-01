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

import {
  proveedorSchema,
  type ProveedorFormValues,
  type PaymentRule,
  type IvaRate,
  DOW_LABELS,
  NTH_LABELS,
  IVA_RATES,
  IVA_RATE_LABELS,
} from '../schemas'
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
  notes: '',
  iva_rate: 0,
  descuento_pct: 0,
  payment_rule: null,
}

type RuleKind = 'none' | 'boletas' | 'monto' | 'fecha_dia_mes' | 'fecha_nth_dow'

function ruleToKind(rule: PaymentRule | null | undefined): RuleKind {
  if (!rule) return 'none'
  return rule.kind
}

export function ProveedorDialog({ open, onOpenChange, proveedor }: Props) {
  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema) as Resolver<ProveedorFormValues>,
    defaultValues: DEFAULT,
  })

  const [ruleKind, setRuleKind] = useState<RuleKind>('none')
  const [ruleParams, setRuleParams] = useState<{
    n: number
    umbral: number
    dia_mes: number
    nth: number
    dow: number
  }>({ n: 4, umbral: 50000, dia_mes: 10, nth: 2, dow: 2 })

  useEffect(() => {
    if (!open) return
    const initial: ProveedorFormValues = proveedor
      ? {
          name: proveedor.name,
          contact_name: proveedor.contact_name ?? '',
          contact_phone: proveedor.contact_phone ?? '',
          contact_email: proveedor.contact_email ?? '',
          notes: proveedor.notes ?? '',
          iva_rate: (Number(proveedor.iva_rate) as IvaRate) ?? 0,
          descuento_pct: Number(proveedor.descuento_pct) || 0,
          payment_rule: (proveedor.payment_rule as PaymentRule | null) ?? null,
        }
      : DEFAULT
    form.reset(initial)
    const rule = initial.payment_rule
    const kind = ruleToKind(rule)
    setRuleKind(kind)
    if (rule) {
      if (rule.kind === 'boletas') setRuleParams((p) => ({ ...p, n: rule.n }))
      else if (rule.kind === 'monto') setRuleParams((p) => ({ ...p, umbral: rule.umbral }))
      else if (rule.kind === 'fecha_dia_mes') setRuleParams((p) => ({ ...p, dia_mes: rule.dia_mes }))
      else setRuleParams((p) => ({ ...p, nth: rule.nth, dow: rule.dow }))
    }
  }, [open, proveedor, form])

  useEffect(() => {
    let next: PaymentRule | null = null
    if (ruleKind === 'boletas') next = { kind: 'boletas', n: ruleParams.n }
    else if (ruleKind === 'monto') next = { kind: 'monto', umbral: ruleParams.umbral }
    else if (ruleKind === 'fecha_dia_mes')
      next = { kind: 'fecha_dia_mes', dia_mes: ruleParams.dia_mes }
    else if (ruleKind === 'fecha_nth_dow')
      next = { kind: 'fecha_nth_dow', nth: ruleParams.nth, dow: ruleParams.dow }
    form.setValue('payment_rule', next, { shouldValidate: false })
  }, [ruleKind, ruleParams, form])

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
        <div className="max-h-[72vh] overflow-y-auto pr-1">
        <Form {...form}>
          <form id="proveedor-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="iva_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IVA por defecto</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v) as IvaRate)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>{IVA_RATE_LABELS[field.value] ?? IVA_RATE_LABELS[0]}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IVA_RATES.map((rate) => (
                          <SelectItem key={rate} value={String(rate)} label={IVA_RATE_LABELS[rate]!}>
                            {IVA_RATE_LABELS[rate]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Al cargar compras se puede switchear.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descuento_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descuento habitual (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="0"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Pre-carga en cada compra nueva.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Regla de pago</p>
                <p className="text-xs text-muted-foreground">Cómo decidimos cuándo es momento de pagar.</p>
              </div>

              <div className="flex flex-wrap gap-1.5 text-sm">
                {([
                  ['none', 'Sin regla'],
                  ['boletas', 'Cada N boletas'],
                  ['monto', 'Al alcanzar monto'],
                  ['fecha_dia_mes', 'Día del mes'],
                  ['fecha_nth_dow', 'N-ésimo día'],
                ] as [RuleKind, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRuleKind(value)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      ruleKind === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {ruleKind === 'boletas' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Cantidad de boletas</label>
                  <Input
                    type="number"
                    min="1"
                    value={ruleParams.n}
                    onChange={(e) =>
                      setRuleParams((p) => ({ ...p, n: parseInt(e.target.value) || 1 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Alerta cuando hay {ruleParams.n} compras pendientes.
                  </p>
                </div>
              )}

              {ruleKind === 'monto' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Umbral en ARS</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={ruleParams.umbral}
                    onChange={(e) =>
                      setRuleParams((p) => ({ ...p, umbral: parseFloat(e.target.value) || 0 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Alerta cuando la deuda pendiente llega a ${ruleParams.umbral.toLocaleString('es-AR')}.
                  </p>
                </div>
              )}

              {ruleKind === 'fecha_dia_mes' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Día del mes</label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={ruleParams.dia_mes}
                    onChange={(e) =>
                      setRuleParams((p) => ({ ...p, dia_mes: parseInt(e.target.value) || 1 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Pago el día {ruleParams.dia_mes} de cada mes.
                  </p>
                </div>
              )}

              {ruleKind === 'fecha_nth_dow' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">N-ésimo</label>
                    <Select
                      value={String(ruleParams.nth)}
                      onValueChange={(v) => {
                        if (v) setRuleParams((p) => ({ ...p, nth: parseInt(v) }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue>{(v: string | null) => (v ? NTH_LABELS[parseInt(v)] : null)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)} label={NTH_LABELS[n]}>
                            {NTH_LABELS[n]}{n === 5 ? ' (último)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Día de la semana</label>
                    <Select
                      value={String(ruleParams.dow)}
                      onValueChange={(v) => {
                        if (v) setRuleParams((p) => ({ ...p, dow: parseInt(v) }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue>{(v: string | null) => (v ? DOW_LABELS[parseInt(v)] : null)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                          <SelectItem key={d} value={String(d)} label={DOW_LABELS[d]}>
                            {DOW_LABELS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Pago el {NTH_LABELS[ruleParams.nth]} {DOW_LABELS[ruleParams.dow]} del mes.
                  </p>
                </div>
              )}
            </div>

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
          </form>
        </Form>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="proveedor-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
