'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { PencilIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, AlertTriangleIcon, BoxIcon, ClipboardCheckIcon, ChevronDownIcon, HistoryIcon, ShoppingCartIcon, UtensilsIcon, ExternalLinkIcon } from 'lucide-react'

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

import { insumoSchema, UNITS, UNIT_LABELS, INSUMO_KINDS, INSUMO_KIND_LABELS, type UnitKind, type InsumoFormValues } from '../schemas'
import { createInsumo, updateInsumo, fetchInsumoHistory, fetchInsumoComprasQty, fetchInsumoUsadoEn, fetchStockAjustes, registrarAjusteStock, saveDespiece, fetchDespiece, getUltimaCompraDeInsumo } from '../actions'
import type { InsumoWithProveedor, PriceHistoryEntry, CompraQtyEntry, InsumoUsadoEn, StockAjusteEntry } from '../queries'
import type { Tables } from '@/types/database'
import { formatCurrency, formatDate } from '@/lib/format'
import { groupQtyByPeriod, QTY_GROUP_LABELS, type QtyGroupBy } from '@/lib/qty-buckets'
import { DespieceEditor, type DespieceRow } from './despiece-editor'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  insumo: InsumoWithProveedor | null
  mode: Mode
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
}

function formatStockQty(val: number, unit: UnitKind): string {
  if ((unit === 'g' || unit === 'kg') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`
  }
  if ((unit === 'ml' || unit === 'l') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} l`
  }
  return `${val.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${UNIT_LABELS[unit] ?? unit}`
}

const DEFAULT_VALUES: InsumoFormValues = {
  name: '',
  kind: 'ingrediente',
  unit: 'kg',
  current_price: 0,
  proveedor_id: null,
  perishable: false,
  shelf_life_days: null,
  track_stock: true,
  stock_inicial: 0,
  purchase_unit_label: null,
  purchase_unit_factor: null,
}

export function InsumoDialog({ open, onOpenChange, insumo, mode, proveedores }: Props) {
  const router = useRouter()
  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(insumoSchema) as Resolver<InsumoFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  // Atajo "Corregir precio": cierra la ficha y salta a EDITAR la última compra
  // que incluyó este insumo (la que fijó current_price). Ahí se corrige
  // cantidad/monto y el guardado recalcula precio + historial + stock.
  const [buscandoCompra, setBuscandoCompra] = useState(false)
  async function handleCorregirPrecio() {
    if (!insumo) return
    setBuscandoCompra(true)
    const res = await getUltimaCompraDeInsumo(insumo.id)
    setBuscandoCompra(false)
    if (!res) {
      toast.error('Este insumo no tiene compras registradas — editá el precio desde esta ficha.')
      return
    }
    onOpenChange(false)
    router.push(`/proveedores/${res.proveedorId}?editCompra=${res.compraId}`)
  }

  const [editing, setEditing] = useState(mode !== 'view')

  // UI-only: la dueña piensa en "compré X cantidad por $Y", no en "$Z por unidad".
  // Calculamos current_price = packTotal / packQty al guardar.
  const [packQty, setPackQty] = useState('1')
  const [packTotal, setPackTotal] = useState('')
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [comprasQty, setComprasQty] = useState<CompraQtyEntry[]>([])
  const [showComprasQty, setShowComprasQty] = useState(false)
  const [comprasQtyGroupBy, setComprasQtyGroupBy] = useState<QtyGroupBy>('compra')
  const [usadoEn, setUsadoEn] = useState<InsumoUsadoEn>({ productos: [], subRecetas: [] })
  const [showUsadoEn, setShowUsadoEn] = useState(false)
  const [stockAjustes, setStockAjustes] = useState<StockAjusteEntry[]>([])
  const [showAjusteForm, setShowAjusteForm] = useState(false)
  const [ajusteStockReal, setAjusteStockReal] = useState('')
  const [ajusteNotas, setAjusteNotas] = useState('')
  const [ajusteSubmitting, setAjusteSubmitting] = useState(false)

  // Despiece: toggle + filas. Si el insumo ya es padre se popula al abrir.
  const [isDespieceParent, setIsDespieceParent] = useState(false)
  const [despieceRows, setDespieceRows] = useState<DespieceRow[]>([])

  const perishable = form.watch('perishable')
  const trackStock = form.watch('track_stock')
  const selectedUnit = form.watch('unit')

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
    form.reset(
      insumo
        ? {
            name: insumo.name,
            kind: (insumo.kind ?? 'ingrediente') as InsumoFormValues['kind'],
            unit: insumo.unit,
            current_price: insumo.current_price,
            proveedor_id: insumo.proveedor_id,
            perishable: insumo.perishable,
            shelf_life_days: insumo.shelf_life_days,
            track_stock: insumo.track_stock,
            stock_inicial: insumo.stock_inicial,
            purchase_unit_label: insumo.purchase_unit_label,
            purchase_unit_factor: insumo.purchase_unit_factor,
          }
        : DEFAULT_VALUES,
    )
    // Reseteamos el helper de pack al abrir el dialog
    if (insumo) {
      setPackQty('1')
      setPackTotal(String(insumo.current_price || ''))
      setIsDespieceParent(!!insumo.is_despiece_parent)
      Promise.all([
        fetchInsumoHistory(insumo.id).then(({ data }) => setPriceHistory(data)),
        fetchInsumoComprasQty(insumo.id).then(({ data }) => setComprasQty(data)),
        fetchInsumoUsadoEn(insumo.id).then(({ data }) => setUsadoEn(data)),
        fetchStockAjustes(insumo.id).then(({ data }) => setStockAjustes(data)),
        insumo.is_despiece_parent
          ? fetchDespiece(insumo.id).then(({ data }) =>
              setDespieceRows(
                data.map((d) => ({
                  hijo_id: d.hijo_id,
                  qty_por_unidad: String(d.qty_por_unidad),
                  hijo_name: d.hijo_name,
                  hijo_unit: d.hijo_unit,
                })),
              ),
            )
          : Promise.resolve(setDespieceRows([])),
      ])
    } else {
      setPackQty('1')
      setPackTotal('')
      setPriceHistory([])
      setStockAjustes([])
      setIsDespieceParent(false)
      setDespieceRows([])
    }
    setShowHistory(false)
    setShowAjusteForm(false)
    setAjusteStockReal('')
    setAjusteNotas('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, insumo?.id, mode])

  // Cada vez que cambian cantidad o total, actualizamos el form's current_price
  useEffect(() => {
    const qty = parseFloat(packQty)
    const total = parseFloat(packTotal)
    if (!isNaN(qty) && qty > 0 && !isNaN(total) && total >= 0) {
      form.setValue('current_price', total / qty, { shouldValidate: false })
    }
  }, [packQty, packTotal, form])

  const readOnly = !editing
  const isCreate = mode === 'create'

  async function handleRegistrar() {
    if (!insumo?.stock) return
    const stockRealNum = parseFloat(ajusteStockReal)
    if (ajusteStockReal === '' || isNaN(stockRealNum)) return
    const stockTeorico = insumo.stock.stock_actual ?? 0
    setAjusteSubmitting(true)
    const result = await registrarAjusteStock(
      insumo.id,
      stockTeorico,
      stockRealNum,
      ajusteNotas || undefined,
    )
    setAjusteSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Ajuste registrado')
      setShowAjusteForm(false)
      setAjusteStockReal('')
      setAjusteNotas('')
      fetchStockAjustes(insumo.id).then(({ data }) => setStockAjustes(data))
    }
  }

  async function onSubmit(values: InsumoFormValues) {
    // Si es padre con despiece, validamos antes de tocar nada
    const despieceItems = isDespieceParent
      ? despieceRows
          .map((r) => ({ hijo_id: r.hijo_id, qty_por_unidad: parseFloat(r.qty_por_unidad) }))
          .filter((r) => r.hijo_id && Number.isFinite(r.qty_por_unidad) && r.qty_por_unidad > 0)
      : []
    if (isDespieceParent && despieceItems.length === 0) {
      toast.error('Agregá al menos un hijo con cantidad o destildá "Se despieza al comprarse"')
      return
    }

    const result = insumo
      ? await updateInsumo(insumo.id, values)
      : await createInsumo(values)

    if (result.error) {
      toast.error(result.error)
      return
    }

    const targetId = insumo?.id ?? (result as { data?: { id: string } }).data?.id
    if (targetId) {
      // Guardar/limpiar despiece. Si pasamos de padre a no-padre, mandamos
      // lista vacia y la action limpia el despiece + desmarca el flag.
      const despieceResult = await saveDespiece(targetId, despieceItems)
      if (despieceResult.error) {
        toast.error(`Insumo guardado pero el despiece falló: ${despieceResult.error}`)
        return
      }
    }

    toast.success(insumo ? 'Insumo actualizado' : 'Insumo creado')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Nuevo insumo' : readOnly ? insumo?.name ?? 'Insumo' : `Editar — ${insumo?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto space-y-4 pr-1">
        {/* Stock teórico hero — solo cuando existe insumo + track_stock activo */}
        {!isCreate && insumo && insumo.track_stock && insumo.stock && (() => {
          const actual = insumo.stock.stock_actual ?? 0
          const referencia = insumo.stock.stock_referencia ?? 0
          const stockUnit = (insumo.stock.unit ?? insumo.unit) as UnitKind
          const pct = referencia > 0 ? Math.min(100, Math.max(0, (actual / referencia) * 100)) : 0
          const tone =
            pct > 60 ? { bar: 'bg-emerald-500', label: 'text-emerald-700' } :
            pct > 30 ? { bar: 'bg-amber-500', label: 'text-amber-700' } :
                       { bar: 'bg-rose-500', label: 'text-rose-700' }
          return (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <BoxIcon className="size-3.5" />
                    Stock teórico
                  </div>
                  <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone.label}`}>
                    {formatStockQty(actual, stockUnit)}
                  </p>
                </div>
                {referencia > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">de referencia</p>
                    <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
                      {formatStockQty(referencia, stockUnit)}
                    </p>
                  </div>
                )}
              </div>
              {referencia > 0 && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )
        })()}

        {/* Stock control / conteo físico */}
        {!isCreate && insumo && insumo.track_stock && insumo.stock && (() => {
          const stockTeorico = insumo.stock.stock_actual ?? 0
          const stockUnit = (insumo.stock.unit ?? insumo.unit) as UnitKind
          const stockRealNum = parseFloat(ajusteStockReal)
          const diferencia = ajusteStockReal !== '' && !isNaN(stockRealNum) ? stockRealNum - stockTeorico : null
          return (
            <div className="rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => setShowAjusteForm((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <ClipboardCheckIcon className="size-4 text-muted-foreground" />
                  Controlar stock
                  {stockAjustes.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({stockAjustes.length} ajuste{stockAjustes.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
                <ChevronDownIcon className={`size-4 transition-transform ${showAjusteForm ? 'rotate-180' : ''}`} />
              </button>

              {showAjusteForm && (
                <div className="space-y-3 border-t px-4 py-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Stock real contado</label>
                      <div className="flex w-fit items-center overflow-hidden rounded-md border text-sm">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          value={ajusteStockReal}
                          onChange={(e) => setAjusteStockReal(e.target.value)}
                          className="w-24 bg-background px-3 py-1.5 tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="border-l bg-muted/50 px-2.5 py-1.5 text-muted-foreground select-none">
                          {UNIT_LABELS[stockUnit] ?? stockUnit}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">Stock teórico</p>
                      <p className="py-1.5 text-sm tabular-nums font-medium">
                        {formatStockQty(stockTeorico, stockUnit)}
                      </p>
                    </div>
                  </div>

                  {diferencia !== null && (
                    <div className={`flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                      diferencia > 0 ? 'text-emerald-600' : diferencia < 0 ? 'text-rose-600' : 'text-muted-foreground'
                    }`}>
                      {diferencia > 0 ? <TrendingUpIcon className="size-4" /> : diferencia < 0 ? <TrendingDownIcon className="size-4" /> : <MinusIcon className="size-4" />}
                      Diferencia: {diferencia > 0 ? '+' : ''}{formatStockQty(diferencia, stockUnit)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Notas (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: conteo del lunes a la mañana"
                      value={ajusteNotas}
                      onChange={(e) => setAjusteNotas(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={ajusteStockReal === '' || isNaN(stockRealNum) || ajusteSubmitting}
                    onClick={handleRegistrar}
                  >
                    {ajusteSubmitting ? 'Registrando...' : 'Registrar ajuste'}
                  </Button>

                  {stockAjustes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Historial de ajustes</p>
                      <div className="divide-y rounded-lg border text-sm">
                        {stockAjustes.map((aj) => (
                          <div key={aj.id} className="flex items-center justify-between px-3 py-2">
                            <div className="space-y-0.5">
                              <p className="text-xs text-muted-foreground">{formatDate(aj.created_at.slice(0, 10))}</p>
                              {aj.notas && <p className="text-xs italic text-muted-foreground">{aj.notas}</p>}
                            </div>
                            <div className="space-y-0.5 text-right">
                              <p className="tabular-nums font-medium">{formatStockQty(aj.stock_real, stockUnit)}</p>
                              <p className={`text-xs tabular-nums ${
                                aj.diferencia > 0 ? 'text-emerald-600' : aj.diferencia < 0 ? 'text-rose-600' : 'text-muted-foreground'
                              }`}>
                                {aj.diferencia > 0 ? '+' : ''}{formatStockQty(aj.diferencia, stockUnit)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Precios del proveedor */}
        {!isCreate && insumo && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <HistoryIcon className="size-4 text-muted-foreground" />
                Precios del proveedor
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
                      const changePct = prev ? ((entry.price - prev.price) / prev.price) * 100 : null
                      const isLarge = changePct !== null && Math.abs(changePct) >= 20
                      const proveedorName = entry.proveedores?.name
                      return (
                        <div key={entry.id} className="grid grid-cols-[1fr_auto_5.5rem] items-center gap-3 px-4 py-3">
                          <div className="space-y-0.5">
                            <p className="text-muted-foreground">{formatDate(entry.valid_from.slice(0, 10))}</p>
                            <p className="text-xs text-muted-foreground/80">
                              {proveedorName ?? 'Sin proveedor'}
                              {entry.source === 'compra' && <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">· compra</span>}
                            </p>
                          </div>
                          <span className="tabular-nums font-medium text-right">{formatCurrency(entry.price)}</span>
                          <div className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                            {changePct !== null ? (
                              <span className={`flex items-center gap-0.5 ${isLarge ? 'font-semibold text-red-600' : changePct > 0 ? 'text-muted-foreground' : changePct < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {isLarge && <AlertTriangleIcon className="size-3" />}
                                {changePct > 0 ? <TrendingUpIcon className="size-3" /> : changePct < 0 ? <TrendingDownIcon className="size-3" /> : <MinusIcon className="size-3" />}
                                {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
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

        {/* Usado en: productos que llevan este insumo (receta expandida o
            descartable) con apertura del consumo de stock, + sub-recetas que
            lo llevan directo. Sirve para detectar armados incompletos y ver
            cómo se reparte el gasto de stock entre productos. */}
        {!isCreate && insumo && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowUsadoEn((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <UtensilsIcon className="size-4 text-muted-foreground" />
                Usado en
                {(usadoEn.productos.length > 0 || usadoEn.subRecetas.length > 0) && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                    {usadoEn.productos.length + usadoEn.subRecetas.length}
                  </span>
                )}
              </span>
              <ChevronDownIcon className={`size-4 transition-transform ${showUsadoEn ? 'rotate-180' : ''}`} />
            </button>

            {showUsadoEn && (() => {
              const totalConsumido = usadoEn.productos.reduce((s, p) => s + p.consumido, 0)
              return (
                <div className="border-t">
                  {usadoEn.productos.length === 0 && usadoEn.subRecetas.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      Ningún producto ni sub-receta usa este insumo — si debería estar en alguno, falta cargarlo en su receta.
                    </p>
                  ) : (
                    <>
                      {usadoEn.productos.length > 0 && (
                        <div className="divide-y text-sm">
                          {usadoEn.productos.map((p) => {
                            const share = totalConsumido > 0 ? (p.consumido / totalConsumido) * 100 : null
                            return (
                              <div key={`${p.producto_id}-${p.via}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onOpenChange(false)
                                      router.push(`/catalogo/productos?q=${encodeURIComponent(p.producto_name)}`)
                                    }}
                                    className="flex items-center gap-1 text-left font-medium hover:underline underline-offset-2"
                                  >
                                    <span className="truncate">{p.producto_name}</span>
                                    <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                                  </button>
                                  <p className="text-xs text-muted-foreground">
                                    {formatStockQty(p.qty_por_unidad, insumo.unit as UnitKind)} por unidad
                                    {p.via === 'descartable' && ' · como descartable'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="tabular-nums font-medium">
                                    {formatStockQty(p.consumido, insumo.unit as UnitKind)}
                                  </p>
                                  <p className="text-xs tabular-nums text-muted-foreground">
                                    {share !== null && p.consumido > 0 ? `${share.toFixed(1)}% del consumo` : 'sin consumo'}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                          {totalConsumido > 0 && (
                            <p className="px-4 py-2 text-[11px] text-muted-foreground">
                              Consumo desde el último control de stock, expandiendo sub-recetas.
                            </p>
                          )}
                        </div>
                      )}
                      {usadoEn.subRecetas.length > 0 && (
                        <div className="border-t px-4 py-2.5">
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">También en sub-recetas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {usadoEn.subRecetas.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  onOpenChange(false)
                                  router.push(`/catalogo/recetas?q=${encodeURIComponent(r.name)}`)
                                }}
                                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted"
                              >
                                {r.name}
                                <ExternalLinkIcon className="size-2.5 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Cantidad comprada por compra — para renegociar volumen con el
            proveedor o detectar desvíos (se compró más/menos que lo habitual). */}
        {!isCreate && insumo && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowComprasQty((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <ShoppingCartIcon className="size-4 text-muted-foreground" />
                Cantidad comprada
                {comprasQty.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                    {comprasQty.length}
                  </span>
                )}
              </span>
              <ChevronDownIcon className={`size-4 transition-transform ${showComprasQty ? 'rotate-180' : ''}`} />
            </button>

            {showComprasQty && (
              <div className="border-t">
                {comprasQty.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Sin compras registradas</p>
                ) : (() => {
                  // Por compra: una fila por compra (con proveedor). Agrupado:
                  // suma por semana/mes, con cuántas compras la componen.
                  const rows =
                    comprasQtyGroupBy === 'compra'
                      ? comprasQty.map((e) => ({
                          key: e.id,
                          label: formatDate(e.fecha),
                          sub: e.proveedor_name ?? 'Sin proveedor',
                          qty: e.qty,
                        }))
                      : [...groupQtyByPeriod(comprasQty, comprasQtyGroupBy)].reverse().map((b) => ({
                          key: b.fecha,
                          label: b.label,
                          sub: `${b.compras} compra${b.compras !== 1 ? 's' : ''}`,
                          qty: b.qty,
                        }))
                  return (
                    <div>
                      <div className="flex items-center gap-1 border-b px-4 py-2">
                        {(Object.keys(QTY_GROUP_LABELS) as QtyGroupBy[]).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setComprasQtyGroupBy(g)}
                            className={`rounded-md px-2 py-1 text-xs transition-colors ${
                              comprasQtyGroupBy === g ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {QTY_GROUP_LABELS[g]}
                          </button>
                        ))}
                      </div>
                      <div className="divide-y text-sm">
                        {rows.map((row, idx) => {
                          const prev = rows[idx + 1]
                          const changePct = prev && prev.qty > 0 ? ((row.qty - prev.qty) / prev.qty) * 100 : null
                          return (
                            <div key={row.key} className="grid grid-cols-[1fr_auto_5.5rem] items-center gap-3 px-4 py-3">
                              <div className="space-y-0.5">
                                <p className="text-muted-foreground">{row.label}</p>
                                <p className="text-xs text-muted-foreground/80">{row.sub}</p>
                              </div>
                              <span className="tabular-nums font-medium text-right">
                                {formatStockQty(row.qty, insumo.unit as UnitKind)}
                              </span>
                              <div className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                                {changePct !== null ? (
                                  <span className="flex items-center gap-0.5 text-muted-foreground">
                                    {changePct > 0 ? <TrendingUpIcon className="size-3" /> : changePct < 0 ? <TrendingDownIcon className="size-3" /> : <MinusIcon className="size-3" />}
                                    {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form id="insumo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Harina 000" disabled={readOnly} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string | null) => v ? INSUMO_KIND_LABELS[v as InsumoFormValues['kind']] ?? v : null}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INSUMO_KINDS.map((k) => (
                        <SelectItem key={k} value={k} label={INSUMO_KIND_LABELS[k]}>
                          {INSUMO_KIND_LABELS[k]}
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
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string | null) => v ? UNIT_LABELS[v as UnitKind] ?? v : null}
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

            {isCreate ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <label className="text-sm font-medium leading-none">Precio de referencia</label>
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Cantidad</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="1"
                      value={packQty}
                      onChange={(e) => setPackQty(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Precio total (ARS)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={packTotal}
                      onChange={(e) => setPackTotal(e.target.value)}
                    />
                  </div>
                </div>
                {(() => {
                  const qty = parseFloat(packQty)
                  const total = parseFloat(packTotal)
                  const unitLabel = form.watch('unit') ? UNIT_LABELS[form.watch('unit') as UnitKind] : 'unidad'
                  if (!isNaN(qty) && qty > 0 && !isNaN(total) && total > 0) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatCurrency(total / qty)} por {unitLabel}
                      </p>
                    )
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      Podés dejarlo en 0 — se completa solo con la primera compra.
                    </p>
                  )
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Precio actual</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums">
                    {formatCurrency(form.watch('current_price') || 0)} <span className="font-normal text-muted-foreground">/ {UNIT_LABELS[selectedUnit as UnitKind] ?? selectedUnit}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">Se actualiza al registrar compras</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={buscandoCompra}
                  onClick={handleCorregirPrecio}
                  title="Abre la última compra que incluyó este insumo para corregir cantidad o monto"
                >
                  <PencilIcon className="size-3 mr-1" />
                  {buscandoCompra ? 'Buscando...' : 'Corregir precio'}
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="proveedor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '_none' ? null : v)}
                    value={field.value ?? '_none'}
                    disabled={readOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin proveedor">
                          {(v: string | null) => (!v || v === '_none') ? 'Sin proveedor' : (proveedores.find((p) => p.id === v)?.name ?? v)}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none" label="Sin proveedor">Sin proveedor</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id} label={p.name}>
                          {p.name}
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
              name="perishable"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
                      id="perishable-check"
                    />
                    <FormLabel htmlFor="perishable-check" className="cursor-pointer">
                      Perecedero
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {perishable && (
              <FormField
                control={form.control}
                name="shelf_life_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vida útil (días)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ej: 7"
                        disabled={readOnly}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Cómo se compra — presentación opcional distinta de la unidad de stock.
                Ej: "Cajón de naranjas" donde unit=kg pero se compra en cajones de 10kg.
                Si se completa, el form de compra captura cantidades en cajones y el
                backend convierte a unidad base al guardar. */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Cómo se compra</p>
                <p className="text-xs text-muted-foreground">
                  Si el insumo se compra en una presentación distinta de su unidad de stock
                  (ej. cajón, maple, bolsa), definí la equivalencia acá.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <FormField
                  control={form.control}
                  name="purchase_unit_label"
                  render={({ field }) => (
                    <FormItem className="flex-1 min-w-[150px]">
                      <FormLabel className="text-xs text-muted-foreground">Presentación</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: cajón, maple, bolsa"
                          disabled={readOnly}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            field.onChange(v === '' ? null : e.target.value)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchase_unit_factor"
                  render={({ field }) => (
                    <FormItem className="flex-1 min-w-[120px]">
                      <FormLabel className="text-xs text-muted-foreground">
                        Equivale a ({UNIT_LABELS[selectedUnit as UnitKind] ?? selectedUnit})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          disabled={readOnly}
                          value={field.value == null ? '' : field.value}
                          onChange={(e) => {
                            const v = e.target.value
                            field.onChange(v === '' ? null : parseFloat(v) || null)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {(() => {
                const label = form.watch('purchase_unit_label')
                const factor = form.watch('purchase_unit_factor')
                const unitLabel = UNIT_LABELS[selectedUnit as UnitKind] ?? selectedUnit
                if (label && factor && factor > 0) {
                  return (
                    <p className="text-xs text-muted-foreground">
                      1 {label} = {factor.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {unitLabel}
                    </p>
                  )
                }
                return (
                  <p className="text-xs text-muted-foreground">
                    Dejá en blanco si el insumo se compra directamente en {unitLabel}.
                  </p>
                )
              })()}
            </div>

            {/* Despiece — el insumo se compra entero (ej. cajon de pollo) y al
                guardar la compra el stock se reparte automaticamente entre
                los insumos hijos definidos aca. */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="despiece-toggle"
                  checked={isDespieceParent}
                  disabled={readOnly}
                  onCheckedChange={(v) => setIsDespieceParent(v === true)}
                />
                <label htmlFor="despiece-toggle" className="cursor-pointer text-sm font-medium">
                  Se despieza al comprarse
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Por cada unidad comprada de este insumo, se va a sumar stock a los hijos definidos
                acá. El costo total se reparte entre todas las unidades hijas generadas. Este insumo
                no acumula stock propio.
              </p>
              {isDespieceParent && (
                <DespieceEditor
                  parentId={insumo?.id ?? null}
                  rows={despieceRows}
                  onChange={setDespieceRows}
                  disabled={readOnly}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="track_stock"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={readOnly}
                      id="track-stock-check"
                    />
                    <FormLabel htmlFor="track-stock-check" className="cursor-pointer">
                      Controlar stock
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {trackStock && (
              <FormField
                control={form.control}
                name="stock_inicial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock inicial</FormLabel>
                    <div className="flex w-fit items-center overflow-hidden rounded-md border border-input text-sm shadow-xs">
                      <FormControl>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          disabled={readOnly}
                          value={field.value === 0 ? '' : field.value}
                          onChange={(e) => {
                            const v = e.target.value
                            field.onChange(v === '' ? 0 : parseFloat(v) || 0)
                          }}
                          className="w-24 bg-background px-3 py-1.5 tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </FormControl>
                      <span className="border-l border-input bg-muted/50 px-2.5 py-1.5 text-muted-foreground select-none">
                        {UNIT_LABELS[selectedUnit as UnitKind] ?? selectedUnit}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}


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
            // Workaround Base UI: ver receta-dialog.tsx
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PencilIcon className="size-4" />
              Editar
            </button>
          ) : (
            <Button type="submit" form="insumo-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
