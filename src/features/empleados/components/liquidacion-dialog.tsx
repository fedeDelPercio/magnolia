'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

import { formatCurrency } from '@/lib/format'
import {
  previewLiquidacion,
  confirmarLiquidacion,
  type LiquidacionPreview,
} from '../actions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si está presente, el dialog liquida sólo a este empleado. */
  empleadoId?: string
  empleadoName?: string
}

function firstDayOfThisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function lastDayOfThisMonth(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

function LiquidacionBody({
  empleadoId,
  onClose,
}: {
  empleadoId?: string
  onClose: () => void
}) {
  const [desde, setDesde] = useState(firstDayOfThisMonth())
  const [hasta, setHasta] = useState(lastDayOfThisMonth())
  const [incluirPlus, setIncluirPlus] = useState(true)
  const [generarEgreso, setGenerarEgreso] = useState(true)
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<LiquidacionPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  async function loadPreview() {
    if (!desde || !hasta || desde > hasta) {
      toast.error('Rango de fechas inválido')
      return
    }
    setLoading(true)
    const result = await previewLiquidacion({
      fecha_desde: desde,
      fecha_hasta: hasta,
      incluir_plus: incluirPlus,
      empleado_id: empleadoId,
    })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setPreview(result.data ?? null)
    setExcluidos(new Set())
  }

  function toggleExcluir(id: string) {
    setExcluidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmar() {
    if (!preview) return
    const incluidos = preview.items.filter((i) => !excluidos.has(i.empleado_id))
    if (incluidos.length === 0) {
      toast.error('No hay empleados seleccionados')
      return
    }
    startTransition(async () => {
      const result = await confirmarLiquidacion({
        fecha_desde: desde,
        fecha_hasta: hasta,
        incluir_plus: incluirPlus,
        generar_egreso: generarEgreso,
        empleado_ids: incluidos.map((i) => i.empleado_id),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.count} liquidaci${result.count === 1 ? 'ón generada' : 'ones generadas'}${
          generarEgreso ? ' (con egreso en caja)' : ''
        }`,
      )
      onClose()
    })
  }

  const totalIncluido = preview
    ? preview.items.filter((i) => !excluidos.has(i.empleado_id)).reduce((s, i) => s + i.monto_total, 0)
    : 0

  return (
    <>
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={incluirPlus} onCheckedChange={(v) => setIncluirPlus(Boolean(v))} id="liq-plus" />
            <span>Incluir plus mensual (prorrateado por días del período)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={generarEgreso}
              onCheckedChange={(v) => setGenerarEgreso(Boolean(v))}
              id="liq-egreso"
            />
            <span>Generar egreso en caja</span>
          </label>
        </div>

        <Button type="button" variant="outline" onClick={loadPreview} disabled={loading} className="w-full">
          {loading ? 'Calculando…' : preview ? 'Recalcular' : 'Calcular liquidación'}
        </Button>

        {preview && (
          <div className="space-y-2">
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="text-left px-2 py-1.5">Empleado</th>
                    <th className="text-right px-2 py-1.5">Días</th>
                    <th className="text-right px-2 py-1.5">Sueldo</th>
                    <th className="text-right px-2 py-1.5">Plus</th>
                    <th className="text-right px-2 py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        Ningún empleado para liquidar en el período.
                      </td>
                    </tr>
                  ) : (
                    preview.items.map((i) => {
                      const excluido = excluidos.has(i.empleado_id)
                      return (
                        <tr key={i.empleado_id} className={excluido ? 'opacity-40' : ''}>
                          <td className="px-2 py-1.5">
                            <Checkbox
                              checked={!excluido}
                              onCheckedChange={() => toggleExcluir(i.empleado_id)}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-medium">{i.name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                            {i.dias_trabajados}/{i.dias_programados}
                            {i.dias_ausentes_pagos > 0 && (
                              <span className="ml-1 text-amber-700">+{i.dias_ausentes_pagos}p</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatCurrency(i.monto_sueldo)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                            {i.monto_plus > 0 ? formatCurrency(i.monto_plus) : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                            {formatCurrency(i.monto_total)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-muted/40">
                  <tr>
                    <td colSpan={5} className="px-2 py-2 text-right text-sm font-medium">
                      Total a liquidar
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {formatCurrency(totalIncluido)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Días: trabajados/programados. <span className="text-amber-700">+Np</span> = ausencias pagas (feriado, licencia).
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={confirmar} disabled={!preview || preview.items.length === 0}>
          Confirmar liquidación
        </Button>
      </DialogFooter>
    </>
  )
}

export function LiquidacionDialog({ open, onOpenChange, empleadoId, empleadoName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Liquidar período{empleadoName ? ` — ${empleadoName}` : ''}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <LiquidacionBody
            empleadoId={empleadoId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
