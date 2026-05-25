'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, PlusIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon, PencilIcon, TrashIcon, CheckCircleIcon, MoreHorizontalIcon, AlertTriangleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { formatCurrency, formatDate } from '@/lib/format'
import { METODO_LABELS } from '../schemas'
import { deleteCompra, updateCompraStatus } from '../actions'
import { CompraDialog } from './compra-dialog'
import { PagoDialog } from './pago-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SaldoProveedor, CompraWithItems, PagoProveedor } from '../queries'
import type { Tables } from '@/types/database'

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
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
}

type InsumoHistory = {
  name: string
  unit: string
  entries: { fecha: string; unit_price: number }[]
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

function PriceLineChart({ entries, unit }: { entries: { fecha: string; unit_price: number }[]; unit: string }) {
  if (entries.length < 2) return null

  const width = 600
  const height = 140
  const padding = { top: 28, right: 32, bottom: 26, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const prices = entries.map((e) => e.unit_price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || maxP || 1
  const yMin = minP - range * 0.15
  const yMax = maxP + range * 0.15
  const yRange = yMax - yMin || 1

  const xStep = innerW / (entries.length - 1)
  const points = entries.map((e, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - ((e.unit_price - yMin) / yRange) * innerH,
    fecha: e.fecha,
    price: e.unit_price,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${(padding.top + innerH).toFixed(2)} L ${points[0]!.x.toFixed(2)} ${(padding.top + innerH).toFixed(2)} Z`

  const compactCurrency = (val: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="mx-auto w-1/2 min-w-[300px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* área degradada */}
        <defs>
          <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#priceArea)" />

        {/* línea */}
        <path d={linePath} fill="none" stroke="rgb(59 130 246)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* puntos */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="rgb(59 130 246)" strokeWidth="2" />
            <title>{`${formatDateShort(p.fecha)}: ${formatCurrency(p.price)}/${unit}`}</title>
          </g>
        ))}

        {/* etiquetas de monto encima de cada punto */}
        {points.map((p, i) => (
          <text
            key={`v-${i}`}
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 10, fontWeight: 600 }}
          >
            {compactCurrency(p.price)}
          </text>
        ))}

        {/* labels eje X */}
        {points.map((p, i) => {
          const isFirst = i === 0
          const isLast = i === points.length - 1
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
          return (
            <text key={`d-${i}`} x={p.x} y={padding.top + innerH + 14} textAnchor={anchor} className="fill-muted-foreground" style={{ fontSize: 9 }}>
              {formatDateShort(p.fecha)}
            </text>
          )
        })}
        </svg>
      </div>
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
      map.get(key)!.entries.push({ fecha: compra.fecha, unit_price: item.unit_price })
    }
  }
  return Array.from(map.values())
    .filter((h) => h.entries.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function ProveedorDetail({ proveedor, compras, pagos, insumos }: Props) {
  const router = useRouter()
  const [compraOpen, setCompraOpen] = useState(false)
  const [editingCompra, setEditingCompra] = useState<CompraWithItems | null>(null)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [pagoDefaultMonto, setPagoDefaultMonto] = useState<number | undefined>(undefined)
  const [pagoCompraId, setPagoCompraId] = useState<string | undefined>(undefined)
  const [deletingCompraId, setDeletingCompraId] = useState<string | null>(null)

  async function handleDeleteCompra(compraId: string) {
    setDeletingCompraId(compraId)
    const result = await deleteCompra(compraId, proveedor.id)
    setDeletingCompraId(null)
    if (result.error) toast.error(result.error)
  }

  async function handleMarkPagada(compraId: string) {
    const result = await updateCompraStatus(compraId, 'pagada', proveedor.id)
    if (result.error) toast.error(result.error)
  }

  function handleSaldar(compra: CompraWithItems) {
    setPagoDefaultMonto(compra.total)
    setPagoCompraId(compra.id)
    setPagoOpen(true)
  }

  const hasAging = proveedor.d31_60 > 0 || proveedor.d61_90 > 0 || proveedor.d90plus > 0
  const priceHistory = buildPriceHistory(compras)

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPagoOpen(true)}>
            Registrar pago
          </Button>
          <Button onClick={() => setCompraOpen(true)}>
            <PlusIcon className="size-4" />
            Registrar compra
          </Button>
        </div>
      </div>

      {/* Saldo card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-3 divide-x">
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total compras</p>
            <p className="mt-1.5 tabular-nums text-lg font-semibold">{formatCurrency(proveedor.total_compras)}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total pagado</p>
            <p className="mt-1.5 tabular-nums text-lg font-semibold text-green-700">{formatCurrency(proveedor.total_pagado)}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo deudor</p>
            <p className={`mt-1.5 tabular-nums text-lg font-semibold ${proveedor.saldo > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {formatCurrency(proveedor.saldo)}
            </p>
          </div>
        </div>

        {hasAging && (
          <div className="border-t px-6 py-3 flex flex-wrap gap-4 text-sm">
            {proveedor.d0_30 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="text-muted-foreground">0-30 d:</span>
                <span className="tabular-nums font-medium">{formatCurrency(proveedor.d0_30)}</span>
              </div>
            )}
            {proveedor.d31_60 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-yellow-400 shrink-0" />
                <span className="text-yellow-700">31-60 d:</span>
                <span className="tabular-nums font-medium text-yellow-800">{formatCurrency(proveedor.d31_60)}</span>
              </div>
            )}
            {proveedor.d61_90 > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-400 shrink-0" />
                <span className="text-orange-700">61-90 d:</span>
                <span className="tabular-nums font-medium text-orange-800">{formatCurrency(proveedor.d61_90)}</span>
              </div>
            )}
            {proveedor.d90plus > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-red-700">+90 d:</span>
                <span className="tabular-nums font-medium text-red-800">{formatCurrency(proveedor.d90plus)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compras */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold">Compras</h2>
          {compras.length > 0 && (
            <span className="text-xs text-muted-foreground">{compras.length} registro{compras.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {compras.length === 0 ? (
          <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">
            Sin compras registradas.
          </div>
        ) : (
          <div className="border-t divide-y text-sm">
            {compras.map((c) => (
              <div key={c.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{formatDate(c.fecha)}</p>
                    {c.due_date && (
                      <p className="text-xs text-muted-foreground">Vence: {formatDate(c.due_date)}</p>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-semibold">{formatCurrency(c.total)}</span>

                    {/* Status: solo texto, sin borde que lo confunda con botón */}
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      c.status === 'pagada'
                        ? 'bg-green-100 text-green-700'
                        : c.status === 'pagada_parcial'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-600'
                    }`}>
                      {STATUS_LABELS[c.status]}
                    </span>

                    {c.status !== 'pagada' && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleSaldar(c)}
                      >
                        <CheckCircleIcon className="size-3" />
                        Saldar
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
                          <DropdownMenuItem onClick={() => handleMarkPagada(c.id)}>
                            <CheckCircleIcon className="size-3.5 mr-2" />
                            Marcar como pagada
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deletingCompraId === c.id}
                          onClick={() => handleDeleteCompra(c.id)}
                        >
                          <TrashIcon className="size-3.5 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {c.compra_items.length > 0 && (
                  <div className="mt-2 space-y-0.5 pl-0">
                    {c.compra_items.map((item) => (
                      <p key={item.id} className="text-xs text-muted-foreground">
                        {item.insumos.name} · {item.qty} {item.insumos.unit} · {formatCurrency(item.unit_price)}/{item.insumos.unit}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium">{formatDate(p.fecha)}</p>
                  <p className="text-xs text-muted-foreground">
                    {METODO_LABELS[p.metodo] ?? p.metodo}
                    {p.descripcion ? ` — ${p.descripcion}` : ''}
                  </p>
                </div>
                <span className="tabular-nums font-semibold text-green-700">{formatCurrency(p.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evolución de precios por insumo */}
      {priceHistory.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-base font-semibold">Evolución de precios</h2>
          </div>
          <div className="border-t divide-y">
            {priceHistory.map((insumo) => (
              <div key={insumo.name} className="text-sm">
                <div className="px-5 py-2.5 text-sm font-semibold bg-card">
                  {insumo.name}
                </div>
                <div className="divide-y border-t">
                  {[...insumo.entries].reverse().map((entry, idx, arr) => {
                    const prev = arr[idx + 1]
                    const changePct = prev ? ((entry.unit_price - prev.unit_price) / prev.unit_price) * 100 : null
                    const isLarge = changePct !== null && changePct >= 20
                    return (
                      <div key={entry.fecha + idx} className="grid grid-cols-[1fr_auto_120px] items-center gap-3 px-5 py-2">
                        <span className="text-muted-foreground">{formatDate(entry.fecha)}</span>
                        <span className="tabular-nums text-right">{formatCurrency(entry.unit_price)} / {insumo.unit}</span>
                        <span className="flex items-center justify-end gap-0.5 text-xs tabular-nums">
                          {changePct !== null ? (
                            <span className={`flex items-center gap-0.5 ${isLarge ? 'font-semibold text-red-600' : changePct > 0 ? 'text-muted-foreground' : changePct < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
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
                {insumo.entries.length >= 2 && (
                  <div className="border-t">
                    <PriceLineChart entries={insumo.entries} unit={insumo.unit} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CompraDialog
        open={compraOpen}
        onOpenChange={(v) => { setCompraOpen(v); if (!v) setEditingCompra(null) }}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        insumos={insumos}
        compra={editingCompra ?? undefined}
      />
      <PagoDialog
        open={pagoOpen}
        onOpenChange={(v) => { setPagoOpen(v); if (!v) { setPagoDefaultMonto(undefined); setPagoCompraId(undefined) } }}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        defaultMonto={pagoDefaultMonto}
        compraId={pagoCompraId}
      />
    </div>
  )
}
