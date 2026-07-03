'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AlertTriangleIcon, ChevronDownIcon, HistoryIcon, MinusIcon, PencilIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

import { productoSchema, type ProductoFormValues } from '../schemas'
import { createProducto, updateProducto, updateProductoPrecio, fetchProductoPriceHistory } from '../actions'
import type { ConceptoBasico, ProductoCost, ProductoPriceHistoryEntry } from '../queries'
import type { Tables } from '@/types/database'
import { IngredientesEditor } from '../../recetas/components/ingredientes-editor'
import { DescartablesEditor } from './descartables-editor'
import { UNITS, UNIT_LABELS } from '../../recetas/schemas'
import type { RecetaParaProducto } from '../../recetas/queries'
import { formatCurrency, formatDate } from '@/lib/format'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto: ProductoCost | null
  recetaData: RecetaParaProducto | null
  descartables: { insumo_id: string; qty: number }[]
  mode: Mode
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  insumosDescartables: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]
  subRecetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
  conceptos: ConceptoBasico[]
}

const DEFAULT_VALUES: ProductoFormValues = {
  name: '',
  sale_price: 0,
  receta_id: null,
  target_margin_pct: 30,
  is_dynamic: false,
  yield_qty: 1,
  yield_unit: 'u',
  ingredientes: [],
  descartables: [],
  concepto_name: null,
  canal: null,
  formato: null,
}

export function ProductoDialog({
  open,
  onOpenChange,
  producto,
  recetaData,
  descartables,
  mode,
  insumos,
  insumosDescartables,
  subRecetas,
  conceptos,
}: Props) {
  // Mapa id -> name para poblar el input "concepto" cuando se abre en edicion.
  const conceptoNameById = new Map(conceptos.map((c) => [c.id, c.name]))
  const form = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema) as Resolver<ProductoFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const [editing, setEditing] = useState(mode !== 'view')
  const [priceHistory, setPriceHistory] = useState<ProductoPriceHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [quickPriceOpen, setQuickPriceOpen] = useState(false)
  const [quickPrice, setQuickPrice] = useState('')
  const [quickPriceSubmitting, setQuickPriceSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
    setShowHistory(false)
    setQuickPriceOpen(false)
    setQuickPrice('')
    form.reset(
      producto
        ? {
            name: producto.name ?? '',
            sale_price: producto.sale_price ?? 0,
            receta_id: producto.receta_id ?? null,
            target_margin_pct: producto.target_margin_pct ?? 30,
            is_dynamic: producto.is_dynamic ?? false,
            yield_qty: recetaData?.yield_qty ?? 1,
            yield_unit: (recetaData?.yield_unit ?? 'u') as ProductoFormValues['yield_unit'],
            ingredientes: recetaData?.ingredientes ?? [],
            descartables: descartables,
            concepto_name: producto.concepto_id
              ? (conceptoNameById.get(producto.concepto_id) ?? null)
              : null,
            canal: producto.canal ?? null,
            formato: producto.formato ?? null,
          }
        : DEFAULT_VALUES,
    )
    if (producto?.id) {
      fetchProductoPriceHistory(producto.id).then(({ data }) => setPriceHistory(data))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id, recetaData, mode])

  const readOnly = !editing
  const isCreate = mode === 'create'

  async function onSubmit(values: ProductoFormValues) {
    const result = producto
      ? await updateProducto(producto.id!, values)
      : await createProducto(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(producto ? 'Producto actualizado' : 'Producto creado')
      onOpenChange(false)
    }
  }

  async function handleQuickPriceUpdate() {
    if (!producto?.id) return
    const price = parseFloat(quickPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Ingresá un precio válido')
      return
    }
    setQuickPriceSubmitting(true)
    const result = await updateProductoPrecio(producto.id, price)
    setQuickPriceSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Precio actualizado')
      setQuickPriceOpen(false)
      setQuickPrice('')
      fetchProductoPriceHistory(producto.id).then(({ data }) => setPriceHistory(data))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? 'Nuevo producto'
              : readOnly
                ? (producto?.name ?? 'Producto')
                : `Editar — ${producto?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto space-y-4 pr-1">
        {/* Historial de precios y rentabilidad */}
        {!isCreate && producto && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <HistoryIcon className="size-4 text-muted-foreground" />
                Historial de precios
                {priceHistory.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                    {priceHistory.length}
                  </span>
                )}
              </span>
              <ChevronDownIcon className={`size-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="border-t">
                {priceHistory.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Sin historial registrado</p>
                ) : (
                  <div className="divide-y text-sm">
                    {priceHistory.map((entry, idx) => {
                      const prev = priceHistory[idx + 1]
                      const marginChange =
                        prev?.margin_pct != null && entry.margin_pct != null
                          ? entry.margin_pct - prev.margin_pct
                          : null
                      const marginOk =
                        entry.margin_pct != null && producto.target_margin_pct != null
                          ? entry.margin_pct >= (producto.target_margin_pct ?? 0)
                          : null
                      const isLargeDrop = marginChange !== null && marginChange <= -5
                      return (
                        <div key={entry.id} className="grid grid-cols-[1fr_auto_auto_6rem] items-center gap-3 px-4 py-3">
                          <span className="text-xs text-muted-foreground">{formatDate(entry.valid_from.slice(0, 10))}</span>
                          <span className="tabular-nums font-medium">{formatCurrency(entry.sale_price)}</span>
                          {entry.total_cost != null ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              Costo {formatCurrency(entry.total_cost)}
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                            {entry.margin_pct != null ? (
                              <span className={`flex items-center gap-0.5 font-medium ${
                                marginOk === true ? 'text-emerald-600' : marginOk === false ? 'text-rose-600' : ''
                              }`}>
                                {isLargeDrop && <AlertTriangleIcon className="size-3" />}
                                {marginChange !== null ? (
                                  marginChange > 0
                                    ? <TrendingUpIcon className="size-3" />
                                    : marginChange < 0
                                      ? <TrendingDownIcon className="size-3" />
                                      : <MinusIcon className="size-3" />
                                ) : null}
                                {entry.margin_pct.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form
            id="producto-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Nombre */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Quiche lorraine" disabled={readOnly} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Precio y margen */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de venta (ARS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={readOnly}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Actualizar precio rápido (solo en vista) */}
                {readOnly && !isCreate && producto && (
                  <div className="mt-1.5">
                    {!quickPriceOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPrice(String(producto.sale_price ?? 0))
                          setQuickPriceOpen(true)
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Actualizar precio
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quickPrice}
                          onChange={(e) => setQuickPrice(e.target.value)}
                          className="h-7 text-xs w-28"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleQuickPriceUpdate() }
                            if (e.key === 'Escape') setQuickPriceOpen(false)
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={handleQuickPriceUpdate}
                          disabled={quickPriceSubmitting}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={() => setQuickPriceOpen(false)}
                        >
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="target_margin_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margen objetivo (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Rendimiento */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="yield_qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rendimiento (unidades)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        disabled={readOnly}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yield_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={readOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {(v: string | null) => (v ? UNIT_LABELS[v as keyof typeof UNIT_LABELS] ?? v : null)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u} label={UNIT_LABELS[u]}>
                            {UNIT_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Plato del día */}
            <FormField
              control={form.control}
              name="is_dynamic"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
                    />
                    <FormLabel className="cursor-pointer">
                      Plato del día (nombre variable)
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Variantes: concepto + canal + formato */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Variantes
              </div>
              <FormField
                control={form.control}
                name="concepto_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Concepto (opcional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Quiche Calabaza"
                        disabled={readOnly}
                        list="conceptos-list"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <datalist id="conceptos-list">
                      {conceptos.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                    <p className="text-[10px] text-muted-foreground">
                      Agrupador para variantes. Si el concepto no existe, se crea al guardar.
                      Dejalo vacio para un producto standalone.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="canal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Canal</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                        value={field.value ?? '__none__'}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {(v: string | null) => {
                                if (!v || v === '__none__') return 'Sin canal'
                                return v === 'salon' ? 'Salón' : 'Delivery'
                              }}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__" label="Sin canal">
                            Sin canal
                          </SelectItem>
                          <SelectItem value="salon" label="Salón">
                            Salón
                          </SelectItem>
                          <SelectItem value="delivery" label="Delivery">
                            Delivery
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="formato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Formato</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                        value={field.value ?? '__none__'}
                        disabled={readOnly}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {(v: string | null) => {
                                if (!v || v === '__none__') return 'Sin formato'
                                return v === 'menu' ? 'Menú' : 'Individual'
                              }}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__" label="Sin formato">
                            Sin formato
                          </SelectItem>
                          <SelectItem value="individual" label="Individual">
                            Individual
                          </SelectItem>
                          <SelectItem value="menu" label="Menú">
                            Menú
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Ingredientes */}
            <div className="border-t pt-4">
              <IngredientesEditor
                insumos={insumos}
                recetas={subRecetas}
                currentRecetaId={producto?.receta_id ?? undefined}
                readOnly={readOnly}
              />
            </div>

            {/* Descartables */}
            <div className="border-t pt-4">
              <DescartablesEditor insumos={insumosDescartables} readOnly={readOnly} />
            </div>

          </form>
        </Form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (readOnly || isCreate) onOpenChange(false)
              else setEditing(false)
            }}
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {readOnly ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PencilIcon className="size-4" />
              Editar
            </button>
          ) : (
            <Button type="submit" form="producto-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
