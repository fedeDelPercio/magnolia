'use client'

import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  HistoryIcon,
  MinusIcon,
  PencilIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  PackageIcon,
} from 'lucide-react'

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
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

import {
  productoDialogFormSchema,
  type ProductoDialogFormValues,
  type ProductoConVariantesFormValues,
  type VariantData,
  type VariantKey,
  VARIANT_LABELS,
} from '../schemas'
import {
  saveProductoConVariantes,
  updateProductoPrecio,
  fetchProductoPriceHistory,
} from '../actions'
import type { ProductoPriceHistoryEntry } from '../queries'
import type { Tables } from '@/types/database'
import { IngredientesEditor } from '../../recetas/components/ingredientes-editor'
import { DescartablesEditor } from './descartables-editor'
import { UNITS, UNIT_LABELS, type UnitKind } from '../../recetas/schemas'
import type { RecetaParaProducto } from '../../recetas/queries'
import { formatCurrency, formatDate } from '@/lib/format'

// Input consolidada del producto (base) + sus 0-2 variantes activas. Se calcula
// en productos-client uniendo por concepto_id. null = create mode.
export type ProductoDialogInput = {
  productoBaseId: string | null
  name: string
  target_margin_pct: number
  is_dynamic: boolean
  yield_qty: number
  yield_unit: UnitKind
  base: VariantData
  delivery: VariantData | null
  menu: VariantData | null
}

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  input: ProductoDialogInput | null
  mode: Mode
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  insumosDescartables: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  subRecetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]
}

const DEFAULT_VALUES: ProductoDialogFormValues = {
  name: '',
  sale_price: 0,
  receta_id: null,
  target_margin_pct: 30,
  is_dynamic: false,
  yield_qty: 1,
  yield_unit: 'u',
  ingredientes: [],
  descartables: [],
}

const EMPTY_VARIANT: VariantData = {
  producto_id: null,
  receta_id: null,
  sale_price: 0,
  ingredientes: [],
  descartables: [],
}

export function ProductoDialog({
  open,
  onOpenChange,
  input,
  mode,
  insumos,
  insumosDescartables,
  subRecetas,
}: Props) {
  const form = useForm<ProductoDialogFormValues>({
    resolver: zodResolver(productoDialogFormSchema) as Resolver<ProductoDialogFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const [editing, setEditing] = useState(mode !== 'view')
  const [activeVariant, setActiveVariant] = useState<VariantKey>('base')
  // Data de las variantes que NO estan activas en el form ahora mismo.
  // Cuando el user cambia de tab, snapshotamos el form y guardamos aca; luego
  // cargamos la variante destino desde este mapa al form.
  const [inactiveVariants, setInactiveVariants] = useState<Partial<Record<VariantKey, VariantData>>>({})
  // Habilitacion de variantes opcionales (delivery/menu).
  const [enabled, setEnabled] = useState<{ delivery: boolean; menu: boolean }>({
    delivery: false,
    menu: false,
  })
  const [priceHistory, setPriceHistory] = useState<ProductoPriceHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [quickPriceOpen, setQuickPriceOpen] = useState(false)
  const [quickPrice, setQuickPrice] = useState('')
  const [quickPriceSubmitting, setQuickPriceSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
    setActiveVariant('base')
    setShowHistory(false)
    setQuickPriceOpen(false)
    setQuickPrice('')

    if (!input) {
      form.reset(DEFAULT_VALUES)
      setInactiveVariants({})
      setEnabled({ delivery: false, menu: false })
      setPriceHistory([])
      return
    }

    // Cargamos la variante base al form; las otras van a inactiveVariants.
    form.reset({
      name: input.name,
      sale_price: input.base.sale_price,
      receta_id: input.base.receta_id,
      target_margin_pct: input.target_margin_pct,
      is_dynamic: input.is_dynamic,
      yield_qty: input.yield_qty,
      yield_unit: input.yield_unit,
      ingredientes: input.base.ingredientes,
      descartables: input.base.descartables,
    })
    const inactive: Partial<Record<VariantKey, VariantData>> = {}
    if (input.delivery) inactive.delivery = input.delivery
    if (input.menu) inactive.menu = input.menu
    setInactiveVariants(inactive)
    setEnabled({ delivery: !!input.delivery, menu: !!input.menu })

    if (input.productoBaseId) {
      void fetchProductoPriceHistory(input.productoBaseId).then(({ data }) => setPriceHistory(data))
    } else {
      setPriceHistory([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, input, mode])

  const readOnly = !editing
  const isCreate = mode === 'create'

  function snapshotFormAsVariant(): VariantData {
    const cur = form.getValues()
    return {
      producto_id: inactiveVariants[activeVariant]?.producto_id ?? null,
      receta_id: cur.receta_id ?? null,
      sale_price: cur.sale_price,
      ingredientes: cur.ingredientes,
      descartables: cur.descartables,
    }
  }

  function switchVariant(next: VariantKey) {
    if (next === activeVariant) return
    // Snapshot de la variante actual al mapa de inactivas
    const snap = snapshotFormAsVariant()
    setInactiveVariants((prev) => ({ ...prev, [activeVariant]: snap }))
    // Cargar la variante destino al form (usando la data snapshoteada + shared)
    const target = next === activeVariant ? snap : inactiveVariants[next]
    if (target) {
      const cur = form.getValues()
      form.reset({
        ...cur,
        receta_id: target.receta_id ?? null,
        sale_price: target.sale_price,
        ingredientes: target.ingredientes,
        descartables: target.descartables,
      })
    }
    setActiveVariant(next)
  }

  function toggleVariantEnabled(key: 'delivery' | 'menu', on: boolean) {
    if (!on) {
      // Deshabilitar: quitamos del mapa y volvemos al base.
      setInactiveVariants((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
      setEnabled((prev) => ({ ...prev, [key]: false }))
      if (activeVariant === key) switchVariant('base')
      return
    }
    // Habilitar: si no hay data guardada, copiamos del snapshot actual del form
    // para que el user tenga como punto de partida los ingredientes/precio del
    // base — mucho mas rapido que empezar de cero.
    setEnabled((prev) => ({ ...prev, [key]: true }))
    setInactiveVariants((prev) => {
      if (prev[key]) return prev
      const baseSnap = activeVariant === 'base' ? snapshotFormAsVariant() : (prev.base ?? EMPTY_VARIANT)
      return {
        ...prev,
        [key]: {
          ...baseSnap,
          producto_id: null,
          receta_id: null,
        },
      }
    })
    // Al habilitar una variante, saltamos a su tab para que el user vea que
    // paso y pueda editarla.
    setTimeout(() => switchVariant(key), 0)
  }

  async function onSubmit(values: ProductoDialogFormValues) {
    // Snapshot del form al mapa antes de armar el payload.
    const activeData: VariantData = {
      producto_id: inactiveVariants[activeVariant]?.producto_id ?? null,
      receta_id: values.receta_id ?? null,
      sale_price: values.sale_price,
      ingredientes: values.ingredientes,
      descartables: values.descartables,
    }
    const dataFor = (key: VariantKey): VariantData | null => {
      if (key === activeVariant) return activeData
      return inactiveVariants[key] ?? null
    }
    const payload: ProductoConVariantesFormValues = {
      name: values.name,
      target_margin_pct: values.target_margin_pct,
      is_dynamic: values.is_dynamic,
      yield_qty: values.yield_qty,
      yield_unit: values.yield_unit,
      base: dataFor('base') ?? EMPTY_VARIANT,
      delivery: enabled.delivery ? dataFor('delivery') : null,
      menu: enabled.menu ? dataFor('menu') : null,
    }
    const result = await saveProductoConVariantes(input?.productoBaseId ?? null, payload)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(input ? 'Producto actualizado' : 'Producto creado')
      onOpenChange(false)
    }
  }

  async function handleQuickPriceUpdate() {
    const productoId = inactiveVariants[activeVariant]?.producto_id ?? input?.productoBaseId
    if (!productoId) return
    const price = parseFloat(quickPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Ingresá un precio válido')
      return
    }
    setQuickPriceSubmitting(true)
    const result = await updateProductoPrecio(productoId, price)
    setQuickPriceSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Precio actualizado')
      setQuickPriceOpen(false)
      setQuickPrice('')
      if (productoId) {
        void fetchProductoPriceHistory(productoId).then(({ data }) => setPriceHistory(data))
      }
    }
  }

  const showTabs = enabled.delivery || enabled.menu
  const currentVariantId = inactiveVariants[activeVariant]?.producto_id ?? input?.productoBaseId ?? null

  // Cuando delivery esta activo, "Base" se llama "Base - Mostrador" para que
  // quede clara la contraposicion con delivery en todos lados donde aparezca
  // el label (tab, precio, historial).
  function variantLabel(key: VariantKey): string {
    if (key === 'base' && enabled.delivery) return 'Base - Mostrador'
    return VARIANT_LABELS[key]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? 'Nuevo producto'
              : readOnly
                ? (input?.name ?? 'Producto')
                : `Editar — ${input?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto space-y-4 pr-1">
          {/* Historial de precios */}
          {!isCreate && currentVariantId && (
            <div className="rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <HistoryIcon className="size-4 text-muted-foreground" />
                  Historial de precios ({variantLabel(activeVariant)})
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
                        const target = form.getValues().target_margin_pct
                        const marginOk =
                          entry.margin_pct != null && target != null
                            ? entry.margin_pct >= target
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
              {/* Nombre (shared) */}
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

              {/* Margen + Rendimiento (shared) */}
              <div className="grid grid-cols-2 gap-3">
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
                <FormField
                  control={form.control}
                  name="yield_qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rendimiento</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="yield_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad de rendimiento</FormLabel>
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

              {/* Plato del día (shared) */}
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

              {/* Variantes: checkboxes */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Variantes
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-background'
                  } ${enabled.delivery ? 'border-primary/40 bg-primary/5' : 'bg-background/60'}`}>
                    <Checkbox
                      checked={enabled.delivery}
                      onCheckedChange={(v) => toggleVariantEnabled('delivery', Boolean(v))}
                      disabled={readOnly}
                    />
                    <span>Variante Delivery</span>
                  </label>
                  <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-background'
                  } ${enabled.menu ? 'border-primary/40 bg-primary/5' : 'bg-background/60'}`}>
                    <Checkbox
                      checked={enabled.menu}
                      onCheckedChange={(v) => toggleVariantEnabled('menu', Boolean(v))}
                      disabled={readOnly}
                    />
                    <span>Variante Menú</span>
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Al activar una variante podés setear un precio + ingredientes distintos.
                  Usá el switch de arriba para editar cada una.
                </p>
              </div>

              {/* Tab switch — solo si hay variantes activas. Cuando delivery
                  esta tildado, el tab base se llama "Base - Mostrador" para
                  dejar clara la contraposicion salon/mostrador vs delivery. */}
              {showTabs && (
                <div className="sticky top-0 z-10 -mx-1 rounded-xl border bg-card/95 p-1 backdrop-blur-sm">
                  <div className="flex gap-1">
                    {(['base', 'delivery', 'menu'] as const).map((key) => {
                      if (key !== 'base' && !enabled[key]) return null
                      const active = activeVariant === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => switchVariant(key)}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {variantLabel(key)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Precio de venta — de la variante activa */}
              <div>
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <PackageIcon className="inline-block mr-1 size-3 text-muted-foreground" />
                        Precio {variantLabel(activeVariant)}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            $
                          </span>
                          <CurrencyInput
                            className="pl-7 tabular-nums"
                            disabled={readOnly}
                            value={field.value ? String(field.value) : ''}
                            onValueChange={(raw) => field.onChange(parseFloat(raw) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {readOnly && !isCreate && currentVariantId && (
                  <div className="mt-1.5">
                    {!quickPriceOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPrice(String(form.getValues().sale_price ?? 0))
                          setQuickPriceOpen(true)
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Actualizar precio de esta variante
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
                            if (e.key === 'Enter') { e.preventDefault(); void handleQuickPriceUpdate() }
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

              {/* Ingredientes — de la variante activa */}
              <div className="border-t pt-4">
                <IngredientesEditor
                  insumos={insumos}
                  recetas={subRecetas}
                  currentRecetaId={form.getValues().receta_id ?? undefined}
                  readOnly={readOnly}
                />
              </div>

              {/* Descartables — de la variante activa */}
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
