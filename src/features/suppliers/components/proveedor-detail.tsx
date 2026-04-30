'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { formatCurrency, formatDate } from '@/lib/format'
import { METODO_LABELS } from '../schemas'
import { CompraDialog } from './compra-dialog'
import { PagoDialog } from './pago-dialog'
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

export function ProveedorDetail({ proveedor, compras, pagos, insumos }: Props) {
  const router = useRouter()
  const [compraOpen, setCompraOpen] = useState(false)
  const [pagoOpen, setPagoOpen] = useState(false)

  const hasAging = proveedor.d31_60 > 0 || proveedor.d61_90 > 0 || proveedor.d90plus > 0

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
            <p className="text-sm text-muted-foreground">
              {proveedor.payment_terms_days === 0 ? 'Contado' : `${proveedor.payment_terms_days} días de pago`}
            </p>
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
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total compras</p>
            <p className="mt-0.5 tabular-nums font-medium">{formatCurrency(proveedor.total_compras)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total pagado</p>
            <p className="mt-0.5 tabular-nums font-medium">{formatCurrency(proveedor.total_pagado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo deudor</p>
            <p className={`mt-0.5 tabular-nums font-semibold text-lg ${proveedor.saldo > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {formatCurrency(proveedor.saldo)}
            </p>
          </div>
        </div>

        {hasAging && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {proveedor.d0_30 > 0 && (
              <div className="rounded border px-3 py-1.5">
                <span className="text-xs text-muted-foreground block">0-30 días</span>
                <span className="tabular-nums">{formatCurrency(proveedor.d0_30)}</span>
              </div>
            )}
            {proveedor.d31_60 > 0 && (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-1.5">
                <span className="text-xs text-yellow-700 block">31-60 días</span>
                <span className="tabular-nums text-yellow-800">{formatCurrency(proveedor.d31_60)}</span>
              </div>
            )}
            {proveedor.d61_90 > 0 && (
              <div className="rounded border border-orange-200 bg-orange-50 px-3 py-1.5">
                <span className="text-xs text-orange-700 block">61-90 días</span>
                <span className="tabular-nums text-orange-800">{formatCurrency(proveedor.d61_90)}</span>
              </div>
            )}
            {proveedor.d90plus > 0 && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5">
                <span className="text-xs text-red-700 block">+90 días</span>
                <span className="tabular-nums text-red-800">{formatCurrency(proveedor.d90plus)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compras */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Compras</h2>
        {compras.length === 0 ? (
          <div className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
            Sin compras registradas.
          </div>
        ) : (
          <div className="rounded-lg border divide-y text-sm">
            {compras.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{formatDate(c.fecha)}</p>
                    {c.due_date && (
                      <p className="text-xs text-muted-foreground">Vence: {formatDate(c.due_date)}</p>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-medium">{formatCurrency(c.total)}</span>
                    <Badge variant="outline" className={STATUS_CLASSES[c.status] ?? ''}>
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </div>
                </div>
                {c.compra_items.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {c.compra_items.map((item) => (
                      <p key={item.id} className="text-xs text-muted-foreground">
                        {item.insumos.name} — {item.qty} {item.insumos.unit} × {formatCurrency(item.unit_price)}
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
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pagos</h2>
        {pagos.length === 0 ? (
          <div className="rounded-lg border py-6 text-center text-sm text-muted-foreground">
            Sin pagos registrados.
          </div>
        ) : (
          <div className="rounded-lg border divide-y text-sm">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{formatDate(p.fecha)}</p>
                  <p className="text-xs text-muted-foreground">
                    {METODO_LABELS[p.metodo] ?? p.metodo}
                    {p.descripcion ? ` — ${p.descripcion}` : ''}
                  </p>
                </div>
                <span className="tabular-nums font-medium text-green-700">{formatCurrency(p.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <CompraDialog
        open={compraOpen}
        onOpenChange={setCompraOpen}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
        paymentTermsDays={proveedor.payment_terms_days}
        insumos={insumos}
      />
      <PagoDialog
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        proveedorId={proveedor.id}
        proveedorName={proveedor.name}
      />
    </div>
  )
}
