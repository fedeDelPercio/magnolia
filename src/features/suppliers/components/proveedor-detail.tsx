'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, ChevronDownIcon, PlusIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, PencilIcon, TrashIcon, CheckCircleIcon, MoreHorizontalIcon, AlertTriangleIcon, CameraIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { groupQtyByPeriod, QTY_GROUP_LABELS, type QtyBucket, type QtyGroupBy } from '@/lib/qty-buckets'
import { METODO_LABELS, type PagoMetodo } from '../schemas'
import { deleteCompra, deleteProveedor, updateCompraStatus, setChequeCleared, deletePago } from '../actions'
import { CompraDialog } from './compra-dialog'
import { PagoDialog } from './pago-dialog'
import { ProveedorDialog } from './proveedor-dialog'
import { ComprobanteUploadDialog } from './comprobante-upload-dialog'
import { RangePicker } from '@/features/dashboard/components/range-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SaldoProveedor, CompraWithItems, PagoProveedor } from '../queries'
import type { Tables } from '@/types/database'
import { hoyISO } from '@/lib/fecha'

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  pagada_parcial: 'Pago parcial',
  pagada: 'Pagada',
}

const STATUS_CLASSES: Record<string, string> = {
  pendiente: 'border-red-200 bg-red-50 text-red-700',
  pagada_parcial: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  pagada: 'border-green-200 bg-green-50 text-green-700',
}

type Props = {
  proveedor: SaldoProveedor
  compras: CompraWithItems[]
  pagos: PagoProveedor[]
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price' | 'purchase_unit_label' | 'purchase_unit_factor' | 'track_stock'>[]
  proveedoresList: Pick<Tables<'proveedores'>, 'id' | 'name'>[]
  from: string
  to: string
  // Deep-link "Corregir precio" del catálogo: abre el dialog de edición de
  // esta compra al montar (y limpia el query param).
  editCompraId?: string
}

type InsumoHistory = {
  name: string
  unit: string
  entries: { fecha: string; unit_price: number; qty: number }[]
}

// Formato DD-MM-YYYY con año completo, usado en tooltips/labels del chart de
// precios donde puede haber puntos de varios años. No confundir con el helper
// formatDateShort de lib/format (DD/MM/YY, para chips con espacio limitado).
function formatDateChart(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

// Chart de línea genérico para series por fecha: lo usan Evolución de precios
// (value = precio unitario) y Evolución de cantidad comprada (value = cantidad).
function TrendLineChart({
  entries,
  formatShort,
  formatTitle,
  idPrefix,
}: {
  // label reemplaza a la fecha en eje X y tooltip (ej. "jul 26" para buckets mensuales).
  entries: { fecha: string; value: number; label?: string | undefined }[]
  // Etiqueta compacta arriba de cada punto (ej. "$ 1.234" o "12 kg").
  formatShort: (val: number) => string
  // Tooltip nativo del punto, con más detalle.
  formatTitle: (val: number) => string
  idPrefix: string
}) {
  if (entries.length < 2) return null

  // viewBox amplio. preserveAspectRatio=none + w-full hace que escale full-width
  // sin distorsionar tipografía (uso vector text que escala uniformemente con SVG).
  const width = 1200
  const height = 160
  const padding = { top: 28, right: 24, bottom: 28, left: 24 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = entries.map((e) => e.value)
  const minP = Math.min(...values)
  const maxP = Math.max(...values)
  const range = maxP - minP || maxP || 1
  const yMin = minP - range * 0.15
  const yMax = maxP + range * 0.15
  const yRange = yMax - yMin || 1

  const xStep = innerW / (entries.length - 1)
  const points = entries.map((e, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - ((e.value - yMin) / yRange) * innerH,
    axisLabel: e.label ?? formatDateChart(e.fecha),
    value: e.value,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${(padding.top + innerH).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(padding.top + innerH).toFixed(2)} Z`

  // ID único por gráfico (varios charts en la misma página) — derivado de la primera fecha + cantidad.
  const gradientId = `${idPrefix}-${entries[0]?.fecha}-${entries.length}`

  return (
    <div className="px-5 pt-3 pb-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full text-foreground/80"
        preserveAspectRatio="none"
      >
        {/* área degradada — usa currentColor para alinearse con la paleta editorial */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* línea */}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* puntos */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
            <title>{`${p.axisLabel}: ${formatTitle(p.value)}`}</title>
          </g>
        ))}

        {/* etiquetas de valor encima de cada punto */}
        {points.map((p, i) => (
          <text
            key={`v-${i}`}
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 10, fontWeight: 500 }}
          >
            {formatShort(p.value)}
          </text>
        ))}

        {/* labels eje X */}
        {points.map((p, i) => {
          const isFirst = i === 0
          const isLast = i === points.length - 1
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
          return (
            <text
              key={`d-${i}`}
              x={p.x}
              y={padding.top + innerH + 16}
              textAnchor={anchor}
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {p.axisLabel}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function buildPriceHistory(compras: CompraWithItems[]): InsumoHistory[] {
  const map = new Map<string, InsumoHistory>()
  const sorted = [...compras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const compra of sorted) {
    for (const item of compra.compra_items) {
      const key = item.insumos.name
      if (!map.has(key)) {
        map.set(key, { name: item.insumos.name, unit: item.insumos.unit, entries: [] })
      }
      map.get(key)!.entries.push({ fecha: compra.fecha, unit_price: item.unit_price, qty: item.qty })
    }
  }
  return Array.from(map.values())
    .filter((h) => h.entries.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Cantidades con formato es-AR y la unidad del insumo ("12,5 kg", "30 u").
function formatQty(val: number, unit: string): string {
  return `${val.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unit}`
}

function ChequeClearedButton({ pagoId, cleared }: { pagoId: string; cleared: boolean }) {
  const [busy, setBusy] = useState(false)
  async function handleClick() {
    setBusy(true)
    const today = hoyISO()
    const res = await setChequeCleared(pagoId, cleared ? null : today)
    setBusy(false)
    if (res.error) toast.error(res.error)
    else toast.success(cleared ? 'Cheque pendiente de nuevo' : 'Cheque marcado como cobrado')
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`text-[10px] underline-offset-2 hover:underline disabled:opacity-50 ${
        cleared ? 'text-muted-foreground' : 'text-emerald-700 font-medium'
      }`}
    >
      {cleared ? 'Deshacer' : 'Marcar cobrado'}
    </button>
  )
}

export function ProveedorDetail({ proveedor, compras, pagos, insumos, proveedoresList, from, to, editCompraId }: Props) {
  const router = useRouter()
  const [compraOpen, setCompraOpen] = useState(false)
  const [comprobanteOpen, setComprobanteOpen] = useState(false)
  const [editingCompra, setEditingCompra] = useState<CompraWithItems | null>(null)

  // Deep-link desde "Corregir precio" en el catálogo de insumos: abrir el
  // dialog de edición de la compra pedida y limpiar el param para que un
  // refresh no lo reabra.
  useEffect(() => {
    if (!editCompraId) return
    const compra = compras.find((c) => c.id === editCompraId)
    if (compra) {
      setEditingCompra(compra)
      setCompraOpen(true)
    } else {
      toast.error('No se encontró la compra a editar')
    }
    router.replace(`/proveedores/${proveedor.id}`, { scroll: false })
    // Solo al montar / cambiar el param — compras es estable en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCompraId])
  const [pagoOpen, setPagoOpen] = useState(false)
  const [pagoDefaultMonto, setPagoDefaultMonto] = useState<number | undefined>(undefined)
  const [pagoCompraId, setPagoCompraId] = useState<string | undefined>(undefined)
  const [editingPago, setEditingPago] = useState<PagoProveedor | null>(null)
  const [anulandoPagoId, setAnulandoPagoId] = useState<string | null>(null)
  const [deletingCompraId, setDeletingCompraId] = useState<string | null>(null)
  const [expandedCompras, setExpandedCompras] = useState<Set<string>>(new Set())
  const [selectedInsumo, setSelectedInsumo] = useState<string | null>(null)
  const [selectedInsumoQty, setSelectedInsumoQty] = useState<string | null>(null)
  const [qtyGroupBy, setQtyGroupBy] = useState<QtyGroupBy>('compra')
  const [editProveedorOpen, setEditProveedorOpen] = useState(false)

  function toggleExpandedCompra(id: string) {
    setExpandedCompras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Mapa compra → pago para mostrar método al lado del badge "Pagada".
  // Si una compra tiene varios pagos (parciales), nos quedamos con el más reciente.
  const pagoPorCompra = new Map<string, PagoProveedor>()
  // Y compra → total pagado, para el faltante de los pagos parciales.
  const pagadoPorCompra = new Map<string, number>()
  for (const p of pagos) {
    if (!p.compra_id) continue
    const prev = pagoPorCompra.get(p.compra_id)
    if (!prev || p.fecha > prev.fecha) pagoPorCompra.set(p.compra_id, p)
    pagadoPorCompra.set(p.compra_id, (pagadoPorCompra.get(p.compra_id) ?? 0) + Number(p.monto))
  }

  function faltanteDeCompra(compra: CompraWithItems): number {
    return Math.max(0, Number(compra.total) - (pagadoPorCompra.get(compra.id) ?? 0))
  }

  async function handleDeleteCompra(compra: CompraWithItems) {
    const pagosDeLaCompra = pagos.filter((p) => p.compra_id === compra.id).length
    const ok = window.confirm(
      `¿Eliminar la compra del ${formatDate(compra.fecha)} por ${formatCurrency(Number(compra.total))}? No se puede deshacer.${
        pagosDeLaCompra > 0
          ? `\n\nTiene ${pagosDeLaCompra} pago${pagosDeLaCompra === 1 ? '' : 's'}: no se borra${pagosDeLaCompra === 1 ? '' : 'n'}, queda${pagosDeLaCompra === 1 ? '' : 'n'} como pago sin compra.`
          : ''
      }`,
    )
    if (!ok) return
    setDeletingCompraId(compra.id)
    const result = await deleteCompra(compra.id, proveedor.id)
    setDeletingCompraId(null)
    if (result.error) toast.error(result.error)
    else toast.success('Compra eliminada')
  }

  async function handleDeleteProveedor() {
    const ok = window.confirm(
      `¿Eliminar a "${proveedor.name}"? Esta acción no se puede deshacer.\n\nSi tiene compras o pagos registrados no vas a poder eliminarlo — desactivalo en ese caso.`,
    )
    if (!ok) return
    const result = await deleteProveedor(proveedor.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Proveedor eliminado')
    router.push('/proveedores')
  }

  async function handleMarkPagada(compra: CompraWithItems) {
    const falta = faltanteDeCompra(compra)
    if (falta > 0.01) {
      const cubierto = aging.cobertura.get(compra.id) ?? 0
      const avisoCobertura =
        cubierto >= 100
          ? `\n\nOjo: ${proveedor.name} tiene pagos sin compra (o pagados de más en otra compra) que alcanzan para cubrir ${formatCurrency(cubierto)} de esta compra. Si ya se pagó con eso, no la marques así: se registraría otro pago.`
          : ''
      const ok = window.confirm(
        `¿Marcar como pagada la compra del ${formatDate(compra.fecha)}?\n\nSe registra un pago de ${formatCurrency(falta)} (método "otro", con fecha de hoy) y su egreso en caja. Si sabés cómo y cuándo se pagó, mejor usá "Saldar".${avisoCobertura}`,
      )
      if (!ok) return
    }
    const result = await updateCompraStatus(compra.id, 'pagada', proveedor.id)
    if (result.error) toast.error(result.error)
    else toast.success('Compra marcada como pagada')
  }

  async function handleAnularPago(p: PagoProveedor) {
    const compra = p.compra_id ? compraPorId.get(p.compra_id) : undefined
    const ok = window.confirm(
      `¿Anular el pago de ${formatCurrency(p.monto)} del ${formatDate(p.fecha)}${compra ? ` (compra del ${formatDate(compra.fecha)} por ${formatCurrency(Number(compra.total))})` : ' (sin compra asociada)'}?

Se borra el pago y su egreso en caja. Si estaba asociado a una compra, la compra vuelve a quedar pendiente (o con pago parcial).`,
    )
    if (!ok) return
    setAnulandoPagoId(p.id)
    const result = await deletePago(p.id)
    setAnulandoPagoId(null)
    if (result.error) toast.error(result.error)
    else toast.success('Pago anulado')
  }

  function handleSaldar(compra: CompraWithItems) {
    // Si ya hubo pagos parciales, el dialog abre con lo que FALTA, no el total.
    setPagoDefaultMonto(faltanteDeCompra(compra))
    setPagoCompraId(compra.id)
    setPagoOpen(true)
  }

  // Antigüedad de la deuda. La vista suma el total de cada compra impaga sin
  // restar pagos parciales ni pagos sueltos, y podía mostrar "+90 d" mayor que
  // el saldo. Acá se resta lo pagado de cada compra y los pagos sin compra se
  // aplican a las compras más viejas, así los tramos suman lo mismo que el saldo.
  // Mismo criterio de tramos que la vista: días desde el vencimiento (sin
  // vencimiento = 0-30).
  const aging = useMemo(() => {
    const tramos = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }
    // Cuánto de la plata suelta le toca a cada compra (para avisar al saldarla).
    const cobertura = new Map<string, number>()
    // "Sueltos" = plata pagada que no está cubriendo ninguna compra: pagos sin
    // compra + lo pagado de más en cada compra (pagos duplicados, redondeos).
    let sueltos = pagos.filter((p) => !p.compra_id).reduce((s, p) => s + Number(p.monto), 0)
    for (const c of compras) {
      sueltos += Math.max(0, (pagadoPorCompra.get(c.id) ?? 0) - Number(c.total))
    }
    const hoy = hoyISO()
    const diasDesde = (iso: string) => {
      const [y1, m1, d1] = iso.split('-').map(Number)
      const [y2, m2, d2] = hoy.split('-').map(Number)
      return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86400000)
    }
    // Por lo que falta pagar, no por el estado (una compra editada puede
    // figurar "pagada" con faltante).
    const impagas = compras
      .filter((c) => Number(c.total) - (pagadoPorCompra.get(c.id) ?? 0) > 0.009)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    for (const c of impagas) {
      let falta = Math.max(0, Number(c.total) - (pagadoPorCompra.get(c.id) ?? 0))
      const aplicado = Math.min(falta, sueltos)
      if (aplicado > 0) cobertura.set(c.id, aplicado)
      falta -= aplicado
      sueltos -= aplicado
      if (falta <= 0.009) continue
      // Vencimiento: el de la compra; si no tiene, fecha + plazo habitual del
      // proveedor (sin plazo, la fecha de la compra). Antes "sin vencimiento"
      // contaba siempre como 0-30 días y la deuda vieja no se veía nunca.
      const plazo = Number(proveedor.payment_terms_days) || 0
      const dias = c.due_date ? diasDesde(c.due_date) : diasDesde(c.fecha) - plazo
      if (dias <= 30) tramos.d0_30 += falta
      else if (dias <= 60) tramos.d31_60 += falta
      else if (dias <= 90) tramos.d61_90 += falta
      else tramos.d90plus += falta
    }
    return { ...tramos, cobertura }
    // pagadoPorCompra se deriva de `pagos` en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compras, pagos, proveedor.payment_terms_days])
  const hasAging = aging.d31_60 > 0 || aging.d61_90 > 0 || aging.d90plus > 0
  // Saldo a favor: se pagó más de lo comprado (la vista lo muestra como 0).
  const saldoAFavor = Math.max(0, Number(proveedor.total_pagado) - Number(proveedor.total_compras))
  // Plata pagada sin compra (o de más en otra compra) que, aplicada a las
  // compras más viejas, alcanza a la que se está saldando: puede estar ya
  // pagada con eso. Por debajo de $100 no se avisa (redondeos).
  const coberturaSaldar = pagoCompraId ? (aging.cobertura.get(pagoCompraId) ?? 0) : 0
  const compraPorId = new Map(compras.map((c) => [c.id, c]))

  // Filtros de tiempo aplican a compras y al historial de precios derivado.
  // Los pagos y el saldo total se mantienen completos (son acumulados, no de período).
  const comprasFiltradas = useMemo(
    () => compras.filter((c) => c.fecha >= from && c.fecha < to),
    [compras, from, to],
  )
  const priceHistory = useMemo(() => buildPriceHistory(comprasFiltradas), [comprasFiltradas])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/proveedores')} className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{proveedor.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangePicker from={from} to={to} />
          <Button variant="outline" onClick={() => setPagoOpen(true)}>
            Registrar pago
          </Button>
          <Button variant="outline" onClick={() => setComprobanteOpen(true)}>
            <CameraIcon className="size-4" />
            Cargar comprobante
          </Button>
          <Button onClick={() => setCompraOpen(true)}>
            <PlusIcon className="size-4" />
            Registrar compra
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setEditProveedorOpen(true)}>
                <PencilIcon className="size-3.5 mr-2" />
                Editar proveedor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDeleteProveedor}
              >
                <TrashIcon className="size-3.5 mr-2" />
                Eliminar proveedor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Saldo card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total compras</p>
            <p className="mt-1.5 tabular-nums text-lg font-semibold">{formatCurrency(proveedor.total_compras)}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total pagado</p>
            <p className="mt-1.5 tabular-nums text-lg font-semibold text-green-700">{formatCurrency(proveedor.total_pagado)}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {saldoAFavor > 0.009 ? 'Saldo a favor' : 'Saldo deudor'}
            </p>
            <p className={`mt-1.5 tabular-nums text-lg font-semibold ${proveedor.saldo > 0 ? 'text-red-600' : saldoAFavor > 0.009 ? 'text-sky-700' : 'text-green-700'}`}>
              {proveedor.saldo > 0
                ? formatCurrency(proveedor.saldo)
                : saldoAFavor > 0.009
                  ? formatCurrency(saldoAFavor)
                  : 'Al día'}
            </p>
            {saldoAFavor > 0.009 && (
              <p className="mt-0.5 text-xs text-muted-foreground">Se pagó más de lo comprado.</p>
            )}
          </div>
        </div>

        {hasAging && (
          <div className="border-t px-6 py-3 flex flex-wrap gap-4 text-sm">
            {aging.d0_30 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="text-muted-foreground">0-30 d:</span>
                <span className="tabular-nums font-medium">{formatCurrency(aging.d0_30)}</span>
              </div>
            )}
            {aging.d31_60 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-yellow-400 shrink-0" />
                <span className="text-yellow-700">31-60 d:</span>
                <span className="tabular-nums font-medium text-yellow-800">{formatCurrency(aging.d31_60)}</span>
              </div>
            )}
            {aging.d61_90 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-400 shrink-0" />
                <span className="text-orange-700">61-90 d:</span>
                <span className="tabular-nums font-medium text-orange-800">{formatCurrency(aging.d61_90)}</span>
              </div>
            )}
            {aging.d90plus > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-red-700">+90 d:</span>
                <span className="tabular-nums font-medium text-red-800">{formatCurrency(aging.d90plus)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compras */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold">Compras</h2>
          {comprasFiltradas.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {comprasFiltradas.length} registro{comprasFiltradas.length !== 1 ? 's' : ''}
              {comprasFiltradas.length !== compras.length && (
                <> de {compras.length} totales</>
              )}
            </span>
          )}
        </div>
        {comprasFiltradas.length === 0 ? (
          <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
            {compras.length === 0
              ? 'Sin compras registradas.'
              : 'No hay compras en este rango de fechas.'}
          </div>
        ) : (
          <div className="border-t divide-y text-sm">
            {comprasFiltradas.map((c) => {
              const isExpanded = expandedCompras.has(c.id)
              const itemCount = c.compra_items.length
              return (
              <div key={c.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpandedCompra(c.id)}
                    aria-expanded={isExpanded}
                    className="focus-ring -m-1 flex items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-muted/30"
                  >
                    <ChevronDownIcon
                      className={`size-3.5 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium">{formatDate(c.fecha)}</p>
                      <p className="text-xs text-muted-foreground">
                        {itemCount} ítem{itemCount === 1 ? '' : 's'}
                        {c.due_date && <> · Vence {formatDate(c.due_date)}</>}
                      </p>
                      {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-semibold">{formatCurrency(c.total)}</span>

                    {/* Status: solo texto, sin borde que lo confunda con botón */}
                    {(() => {
                      const pago = pagoPorCompra.get(c.id)
                      const isCheque = c.status === 'pagada' && pago?.metodo === 'cheque'
                      const chequePending = isCheque && !pago?.cleared_at
                      const metodoStr = pago ? (METODO_LABELS[pago.metodo] ?? pago.metodo).toLowerCase() : null
                      const esParcial = c.status === 'pagada_parcial'
                      const faltante = esParcial ? faltanteDeCompra(c) : 0
                      const label =
                        c.status === 'pagada' && metodoStr
                          ? `Pagada · ${metodoStr}`
                          : esParcial && faltante > 0
                            ? `Pago parcial · faltan ${formatCurrency(faltante)}`
                            : STATUS_LABELS[c.status]
                      const tone =
                        c.status === 'pagada'
                          ? chequePending
                            ? 'bg-amber-100 text-amber-800'
                            : 'border-primary/25 bg-primary/10 text-primary'
                          : esParcial
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-rose-50/80 text-rose-800/90'
                      return (
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded-full border border-transparent ${tone}`}
                          title={
                            isCheque && pago?.due_date
                              ? chequePending
                                ? `Cheque vence ${formatDate(pago.due_date)}`
                                : `Cheque cobrado ${formatDate(pago.cleared_at!)}`
                              : esParcial
                                ? `Pagado ${formatCurrency(Number(c.total) - faltante)} de ${formatCurrency(c.total)}`
                                : undefined
                          }
                        >
                          {label}
                          {isCheque && pago?.due_date && (
                            <span className="ml-1 opacity-70 tabular-nums">{formatDateShort(pago.due_date)}</span>
                          )}
                        </span>
                      )
                    })()}

                    {c.status !== 'pagada' && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => handleSaldar(c)}
                      >
                        <CheckCircleIcon className="size-3" />
                        {c.status === 'pagada_parcial' ? 'Saldar resto' : 'Saldar'}
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <MoreHorizontalIcon className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => { setEditingCompra(c); setCompraOpen(true) }}>
                          <PencilIcon className="size-3.5 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {c.status !== 'pagada' && (
                          <DropdownMenuItem onClick={() => handleMarkPagada(c)}>
                            <CheckCircleIcon className="size-3.5 mr-2" />
                            Marcar como pagada
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deletingCompraId === c.id}
                          onClick={() => handleDeleteCompra(c)}
                        >
                          <TrashIcon className="size-3.5 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {isExpanded && itemCount > 0 && (
                  <div className="mt-3 ml-6 space-y-0.5 border-l pl-3">
                    {c.compra_items.map((item) => (
                      <p key={item.id} className="text-xs text-muted-foreground">
                        {item.insumos.name} · {item.qty} {item.insumos.unit} · {formatCurrency(item.unit_price)}/{item.insumos.unit}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagos */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold">Pagos</h2>
          {pagos.length > 0 && (
            <span className="text-xs text-muted-foreground">{pagos.length} registro{pagos.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {pagos.length === 0 ? (
          <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
            Sin pagos registrados.
          </div>
        ) : (
          <div className="border-t divide-y text-sm">
            {pagos.map((p) => {
              const chequePending = p.metodo === 'cheque' && !p.cleared_at
              const metodoTone =
                p.metodo === 'cheque'
                  ? chequePending
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : p.metodo === 'transferencia'
                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                    : p.metodo === 'efectivo'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{formatDate(p.fecha)}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${metodoTone}`}
                      >
                        {METODO_LABELS[p.metodo] ?? p.metodo}
                        {p.metodo === 'cheque' && !chequePending && ' · cobrado'}
                      </span>
                      {p.metodo === 'cheque' && p.due_date && (
                        <span className={`text-xs tabular-nums ${chequePending ? 'text-amber-700' : 'text-muted-foreground line-through'}`}>
                          {formatDateShort(p.due_date)}
                        </span>
                      )}
                      {p.metodo === 'cheque' && p.cleared_at && (
                        <span className="text-xs text-emerald-700 tabular-nums">
                          cobrado {formatDateShort(p.cleared_at)}
                        </span>
                      )}
                      {p.metodo === 'cheque' && (
                        <ChequeClearedButton pagoId={p.id} cleared={!!p.cleared_at} />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(() => {
                        const compra = p.compra_id ? compraPorId.get(p.compra_id) : undefined
                        const ref = compra
                          ? `Compra del ${formatDateShort(compra.fecha)} por ${formatCurrency(Number(compra.total))}`
                          : 'Sin compra asociada'
                        return p.descripcion ? `${ref} · ${p.descripcion}` : ref
                      })()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums font-semibold text-green-700">{formatCurrency(p.monto)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Acciones del pago"
                        disabled={anulandoPagoId === p.id}
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:size-6"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => { setEditingPago(p); setPagoOpen(true) }}>
                          <PencilIcon className="size-3.5 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleAnularPago(p)}
                        >
                          <TrashIcon className="size-3.5 mr-2" />
                          Anular pago
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Evolución de precios — un insumo por vez para evitar listas larguísimas */}
      {priceHistory.length > 0 && (() => {
        // Default: primer insumo alfabético si no hay selección o la seleccionada ya no está en el rango.
        const activeHistory =
          priceHistory.find((h) => h.name === selectedInsumo) ?? priceHistory[0]!
        const entries = activeHistory.entries
        const reversed = [...entries].reverse()
        return (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
              <h2 className="text-base font-semibold">Evolución de precios</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="insumo-select" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Insumo
                </label>
                <select
                  id="insumo-select"
                  value={activeHistory.name}
                  onChange={(e) => setSelectedInsumo(e.target.value)}
                  className="focus-ring rounded-md border bg-background px-2.5 py-1 text-sm tabular-nums"
                >
                  {priceHistory.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-t divide-y text-sm">
              {reversed.map((entry, idx, arr) => {
                const prev = arr[idx + 1]
                const changePct = prev ? ((entry.unit_price - prev.unit_price) / prev.unit_price) * 100 : null
                const isLarge = changePct !== null && changePct >= 20
                return (
                  <div key={entry.fecha + idx} className="grid grid-cols-[1fr_auto_120px] items-center gap-3 px-5 py-2">
                    <span className="text-muted-foreground">{formatDate(entry.fecha)}</span>
                    <span className="tabular-nums text-right">{formatCurrency(entry.unit_price)} / {activeHistory.unit}</span>
                    <span className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                      {changePct !== null ? (
                        <span className={`flex items-center gap-0.5 ${isLarge ? 'font-semibold text-rose-700' : changePct > 0 ? 'text-muted-foreground' : changePct < 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {isLarge && <AlertTriangleIcon className="size-3" />}
                          {changePct > 0 ? <TrendingUpIcon className="size-3" /> : changePct < 0 ? <TrendingDownIcon className="size-3" /> : <MinusIcon className="size-3" />}
                          {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
            {entries.length >= 2 && (
              <div className="border-t">
                <TrendLineChart
                  entries={entries.map((e) => ({ fecha: e.fecha, value: e.unit_price }))}
                  formatShort={(v) =>
                    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)
                  }
                  formatTitle={(v) => `${formatCurrency(v)}/${activeHistory.unit}`}
                  idPrefix="priceArea"
                />
              </div>
            )}
          </div>
        )
      })()}

      {/* Evolución de cantidad comprada — mismo patrón que precios, pero con la
          cantidad de cada compra, agrupable por semana/mes (suma del período).
          Sirve para renegociar volumen o detectar desvíos. */}
      {priceHistory.length > 0 && (() => {
        const activeHistory =
          priceHistory.find((h) => h.name === selectedInsumoQty) ?? priceHistory[0]!
        const buckets: QtyBucket[] =
          qtyGroupBy === 'compra'
            ? activeHistory.entries.map((e) => ({ fecha: e.fecha, label: formatDate(e.fecha), qty: e.qty, compras: 1 }))
            : groupQtyByPeriod(activeHistory.entries, qtyGroupBy)
        const reversed = [...buckets].reverse()
        return (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
              <div>
                <h2 className="text-base font-semibold">Evolución de cantidad comprada</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {qtyGroupBy === 'compra'
                    ? 'Cuánto se le compró en cada compra del período'
                    : `Total comprado por ${qtyGroupBy === 'semana' ? 'semana' : 'mes'} en el período`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-md border p-0.5 text-xs">
                  {(Object.keys(QTY_GROUP_LABELS) as QtyGroupBy[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setQtyGroupBy(g)}
                      className={`focus-ring rounded px-2 py-1 transition-colors ${
                        qtyGroupBy === g ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {QTY_GROUP_LABELS[g]}
                    </button>
                  ))}
                </div>
                <label htmlFor="insumo-qty-select" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Insumo
                </label>
                <select
                  id="insumo-qty-select"
                  value={activeHistory.name}
                  onChange={(e) => setSelectedInsumoQty(e.target.value)}
                  className="focus-ring rounded-md border bg-background px-2.5 py-1 text-sm tabular-nums"
                >
                  {priceHistory.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-t divide-y text-sm">
              {reversed.map((bucket, idx, arr) => {
                const prev = arr[idx + 1]
                const changePct = prev && prev.qty > 0 ? ((bucket.qty - prev.qty) / prev.qty) * 100 : null
                return (
                  <div key={bucket.fecha + idx} className="grid grid-cols-[1fr_auto_120px] items-center gap-3 px-5 py-2">
                    <span className="text-muted-foreground">
                      {bucket.label}
                      {qtyGroupBy !== 'compra' && (
                        <span className="text-xs text-muted-foreground/70"> · {bucket.compras} compra{bucket.compras !== 1 ? 's' : ''}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-right">{formatQty(bucket.qty, activeHistory.unit)}</span>
                    <span className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                      {changePct !== null ? (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          {changePct > 0 ? <TrendingUpIcon className="size-3" /> : changePct < 0 ? <TrendingDownIcon className="size-3" /> : <MinusIcon className="size-3" />}
                          {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
            {buckets.length >= 2 && (
              <div className="border-t">
                <TrendLineChart
                  entries={buckets.map((b) => ({ fecha: b.fecha, value: b.qty, label: b.chartLabel }))}
                  formatShort={(v) => formatQty(v, activeHistory.unit)}
                  formatTitle={(v) => formatQty(v, activeHistory.unit)}
                  idPrefix="qtyArea"
                />
              </div>
            )}
          </div>
        )
      })()}

      <ComprobanteUploadDialog
        open={comprobanteOpen}
        onOpenChange={setComprobanteOpen}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        proveedorIvaRate={(Number(proveedor.iva_rate) as 0 | 10.5 | 21) || 0}
        proveedorDescuentoPct={Number(proveedor.descuento_pct) || 0}
        insumos={insumos}
        proveedoresList={proveedoresList}
      />
      <CompraDialog
        open={compraOpen}
        onOpenChange={(v) => { setCompraOpen(v); if (!v) setEditingCompra(null) }}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        proveedorIvaRate={(Number(proveedor.iva_rate) as 0 | 10.5 | 21) || 0}
        proveedorDescuentoPct={Number(proveedor.descuento_pct) || 0}
        insumos={insumos}
        compra={editingCompra ?? undefined}
      />
      <PagoDialog
        open={pagoOpen}
        onOpenChange={(v) => { setPagoOpen(v); if (!v) { setPagoDefaultMonto(undefined); setPagoCompraId(undefined); setEditingPago(null) } }}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        defaultMonto={pagoDefaultMonto}
        defaultMetodo={(proveedor.metodo_pago_default as PagoMetodo | null) ?? undefined}
        compraId={pagoCompraId}
        pago={editingPago}
        saldoAFavor={coberturaSaldar >= 100 ? coberturaSaldar : 0}
        compraLabel={(() => {
          const id = editingPago?.compra_id ?? pagoCompraId
          const compra = id ? compraPorId.get(id) : undefined
          return compra
            ? `Compra del ${formatDate(compra.fecha)} por ${formatCurrency(Number(compra.total))}`
            : undefined
        })()}
      />
      {/* La vista saldos_proveedores expone los campos del perfil (incl.
          ai_extraction_notes) justamente para poder abrir el dialog de edición
          sin otra query — mismo cast que en proveedor-servicio-detail. */}
      <ProveedorDialog
        open={editProveedorOpen}
        onOpenChange={setEditProveedorOpen}
        proveedor={proveedor as unknown as Tables<'proveedores'>}
      />
    </div>
  )
}
