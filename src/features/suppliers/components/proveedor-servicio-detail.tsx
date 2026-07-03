'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MoreHorizontalIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createConceptoServicio,
  updateConceptoServicio,
  deleteConceptoServicio,
  deletePagoServicio,
  deleteProveedor,
} from '../actions'
import { PagoServicioDialog } from './pago-servicio-dialog'
import { ConceptoServicioDialog } from './concepto-servicio-dialog'
import { ProveedorDialog } from './proveedor-dialog'
import type { SaldoProveedor, ConceptoServicio, PagoServicio } from '../queries'
import type { Tables } from '@/types/database'

type Props = {
  proveedor: SaldoProveedor
  conceptos: ConceptoServicio[]
  pagos: PagoServicio[]
}

function pctChange(newVal: number, oldVal: number): number | null {
  if (oldVal === 0) return null
  return ((newVal - oldVal) / oldVal) * 100
}

// Mini gráfico SVG del incremento de precios en el tiempo para un concepto.
// Escala vertical con margen extra arriba/abajo para que los picos no toquen el borde.
function PriceMiniChart({ entries }: { entries: { fecha: string; monto: number }[] }) {
  if (entries.length < 2) return null
  const width = 600
  const height = 100
  const padding = { top: 14, right: 8, bottom: 14, left: 8 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const prices = entries.map((e) => e.monto)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || maxP || 1
  const yMin = minP - range * 0.15
  const yMax = maxP + range * 0.15
  const yRange = yMax - yMin || 1
  const xStep = innerW / (entries.length - 1)
  const points = entries.map((e, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - ((e.monto - yMin) / yRange) * innerH,
  }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${points[0]!.x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden>
      <path d={areaPath} fill="currentColor" opacity="0.08" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="currentColor" />
      ))}
    </svg>
  )
}

export function ProveedorServicioDetail({ proveedor, conceptos, pagos }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingProv, setEditingProv] = useState(false)
  const [conceptoDialog, setConceptoDialog] = useState<{
    open: boolean
    editing: ConceptoServicio | null
  }>({ open: false, editing: null })
  const [pagoDialog, setPagoDialog] = useState(false)

  // Agrupamos pagos por concepto (los sueltos van a 'sin-concepto') y ordenamos
  // por fecha ascendente dentro de cada grupo para el mini-chart de evolución.
  const pagosPorConcepto = useMemo(() => {
    const map = new Map<string, PagoServicio[]>()
    for (const p of pagos) {
      const key = p.concepto_id ?? '__sin_concepto__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.fecha.localeCompare(b.fecha))
    }
    return map
  }, [pagos])

  function handleDeleteConcepto(c: ConceptoServicio) {
    const hasPagos = pagosPorConcepto.get(c.id)?.length ?? 0
    const msg = hasPagos > 0
      ? `¿Eliminar el concepto "${c.name}"? Tiene ${hasPagos} pago(s) — quedarán como pagos sueltos sin concepto.`
      : `¿Eliminar el concepto "${c.name}"?`
    if (!window.confirm(msg)) return
    startTransition(async () => {
      const result = await deleteConceptoServicio(c.id)
      if (result.error) toast.error(result.error)
      else toast.success('Concepto eliminado')
    })
  }

  function handleDeletePago(p: PagoServicio) {
    if (!window.confirm(`¿Eliminar este pago de ${formatCurrency(p.monto)} del ${formatDate(p.fecha)}?`)) return
    startTransition(async () => {
      const result = await deletePagoServicio(p.id)
      if (result.error) toast.error(result.error)
      else toast.success('Pago eliminado')
    })
  }

  function handleDeleteProveedor() {
    if (!window.confirm(`¿Eliminar el proveedor "${proveedor.name}"? Se van a borrar todos sus conceptos y pagos.`)) return
    startTransition(async () => {
      const result = await deleteProveedor(proveedor.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Proveedor eliminado')
        router.push('/proveedores')
      }
    })
  }

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const ultimoPago = pagos[0] ?? null

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 size-8 text-muted-foreground"
              onClick={() => router.push('/proveedores')}
              aria-label="Volver"
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-eyebrow">Proveedor de servicios</p>
              <h1 className="mt-1 font-display text-3xl leading-tight tracking-tight truncate">{proveedor.name}</h1>
              {proveedor.contact_name && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {proveedor.contact_name}
                  {proveedor.contact_phone && ` · ${proveedor.contact_phone}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setEditingProv(true)}>
              <PencilIcon className="size-4" />
              Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="size-9" />}>
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDeleteProveedor}
                  className="text-destructive focus:text-destructive"
                >
                  Eliminar proveedor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card-editorial p-5">
            <p className="text-eyebrow">Total pagado</p>
            <p className="mt-3 num-editorial text-2xl">{formatCurrency(totalPagado)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              en {pagos.length} pago{pagos.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="card-editorial p-5">
            <p className="text-eyebrow">Conceptos activos</p>
            <p className="mt-3 num-editorial text-2xl">{conceptos.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">servicios distintos</p>
          </div>
          <div className="card-editorial p-5">
            <p className="text-eyebrow">Último pago</p>
            {ultimoPago ? (
              <>
                <p className="mt-3 num-editorial text-2xl">{formatCurrency(ultimoPago.monto)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(ultimoPago.fecha)}
                  {ultimoPago.concepto?.name && ` · ${ultimoPago.concepto.name}`}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground italic">Sin pagos</p>
            )}
          </div>
        </div>

        {/* Conceptos + evolución */}
        <div className="card-editorial p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <p className="text-eyebrow">Conceptos</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada concepto agrupa pagos para ver cómo evoluciona el precio.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setConceptoDialog({ open: true, editing: null })}
            >
              <PlusIcon className="size-4" />
              Nuevo concepto
            </Button>
          </div>

          {conceptos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Sin conceptos. Creá uno (ej: &quot;Internet 500MB&quot;) para agrupar los pagos.
            </p>
          ) : (
            <div className="divide-y">
              {conceptos.map((c) => {
                const arr = pagosPorConcepto.get(c.id) ?? []
                const primero = arr[0] ?? null
                const ultimo = arr[arr.length - 1] ?? null
                const pct = primero && ultimo && arr.length >= 2
                  ? pctChange(Number(ultimo.monto), Number(primero.monto))
                  : null
                return (
                  <div key={c.id} className="py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {arr.length === 0 ? 'Sin pagos aún' : `${arr.length} pago${arr.length === 1 ? '' : 's'}`}
                          {ultimo && ` · último: ${formatCurrency(ultimo.monto)} el ${formatDate(ultimo.fecha)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pct !== null && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs tabular-nums ${
                              pct > 0 ? 'text-rose-700' : pct < 0 ? 'text-emerald-700' : 'text-muted-foreground'
                            }`}
                            title={`De ${formatCurrency(primero!.monto)} el ${formatDate(primero!.fecha)} a ${formatCurrency(ultimo!.monto)} el ${formatDate(ultimo!.fecha)}`}
                          >
                            {pct > 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => setConceptoDialog({ open: true, editing: c })}
                          title="Editar concepto"
                          disabled={pending}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteConcepto(c)}
                          title="Eliminar concepto"
                          disabled={pending}
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    {arr.length >= 2 && (
                      <div className="text-primary/70">
                        <PriceMiniChart entries={arr.map((p) => ({ fecha: p.fecha, monto: Number(p.monto) }))} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagos */}
        <div className="card-editorial p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <p className="text-eyebrow">Pagos</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada pago se registra como egreso en caja mayor.
              </p>
            </div>
            <Button size="sm" onClick={() => setPagoDialog(true)}>
              <PlusIcon className="size-4" />
              Nuevo pago
            </Button>
          </div>

          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Sin pagos registrados. Cargá el primero para arrancar a trackear.
            </p>
          ) : (
            <div className="divide-y text-sm">
              {pagos.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.concepto?.name ?? <span className="italic text-muted-foreground">Sin concepto</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.fecha)}
                      {p.notas && ` · ${p.notas}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">{formatCurrency(p.monto)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeletePago(p)}
                      title="Eliminar pago"
                      disabled={pending}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConceptoServicioDialog
        open={conceptoDialog.open}
        onOpenChange={(v) => setConceptoDialog((s) => ({ ...s, open: v }))}
        proveedorId={proveedor.id}
        editing={conceptoDialog.editing}
      />

      <PagoServicioDialog
        open={pagoDialog}
        onOpenChange={setPagoDialog}
        proveedor={proveedor}
        conceptos={conceptos}
      />

      <ProveedorDialog
        open={editingProv}
        onOpenChange={setEditingProv}
        proveedor={proveedor as unknown as Tables<'proveedores'>}
      />
    </>
  )
}
