'use client'

import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DiferenciasMes, DiferenciaProducto } from '../queries'

// Resumen mensual de diferencias de stock (conteo físico vs teórico), por
// producto agrupado como en la grilla diaria. Solo días con conteo cargado.

type Props = {
  data: DiferenciasMes
  monthLabel: string
}

function fmtU(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 1 })
}

function signedU(n: number): string {
  return `${n > 0 ? '+' : ''}${fmtU(n)}`
}

function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${Number(d)}/${Number(m)}`
}

function NetoCell({ value, suffix }: { value: number; suffix?: string }) {
  const cls = value < 0 ? 'text-red-600' : value > 0 ? 'text-blue-700' : 'text-green-700'
  return (
    <span className={cn('tabular-nums', cls)}>
      {signedU(value)}
      {suffix}
    </span>
  )
}

function ProductoRow({ p }: { p: DiferenciaProducto }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pl-4 pr-2 text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <ChevronDownIcon
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                open ? 'rotate-0' : '-rotate-90',
              )}
            />
            {p.name}
          </span>
        </td>
        <td className="px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
          {p.diasContados}
        </td>
        <td className="px-2 py-2 text-right text-sm tabular-nums text-red-600">
          {p.faltante < 0 ? fmtU(p.faltante) : '—'}
        </td>
        <td className="px-2 py-2 text-right text-sm tabular-nums text-blue-700">
          {p.sobrante > 0 ? `+${fmtU(p.sobrante)}` : '—'}
        </td>
        <td className="px-2 py-2 text-right text-sm">
          <NetoCell value={p.neto} suffix=" u" />
        </td>
        <td className="py-2 pl-2 pr-4 text-right text-sm">
          {p.pesos !== null ? (
            <NetoCell value={p.pesos} suffix="" />
          ) : (
            <span
              className="text-muted-foreground/60"
              title="Sin costo confiable (falta receta o tiene unidades incompatibles) — se muestran solo unidades."
            >
              —
            </span>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-muted/20 px-4 pb-3 pt-1">
            {p.dias.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin días con diferencia distinta de cero.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.dias.map((d) => (
                  <span
                    key={d.fecha}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] tabular-nums"
                    title={`Conteo ${fmtU(d.conteo)} · Teórico ${fmtU(d.teorico)}`}
                  >
                    <span className="text-muted-foreground">{fechaCorta(d.fecha)}</span>
                    <NetoCell value={d.dif} />
                  </span>
                ))}
              </div>
            )}
            {p.costoUnitario !== null && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Valorizado a {formatCurrency(p.costoUnitario)} por unidad (costo de receta actual).
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function DiferenciasMesResumen({ data, monthLabel }: Props) {
  const { productos, diasConConteo, netoUnidades, pesosTotal, sinCostoConfiable } = data

  return (
    <section className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl tracking-tight">
          Diferencias de stock — {monthLabel}
        </h2>
        <p className="text-xs text-muted-foreground">
          Conteo físico vs. teórico · solo días con conteo cargado
        </p>
      </div>

      {productos.length === 0 ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-center text-sm text-muted-foreground">
            Sin diferencias registradas este mes. Aparecen cuando un día tiene conteo físico
            cargado y no coincide con el stock teórico.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-2.5 text-xs">
            <span>
              <strong className="tabular-nums">{diasConConteo}</strong> día{diasConConteo === 1 ? '' : 's'} con conteo
            </span>
            <span>
              Neto: <NetoCell value={netoUnidades} suffix=" u" />
            </span>
            <span>
              Impacto: <NetoCell value={pesosTotal} />
            </span>
            {sinCostoConfiable > 0 && (
              <span className="text-muted-foreground">
                {sinCostoConfiable} producto{sinCostoConfiable === 1 ? '' : 's'} sin costo confiable (solo unidades)
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pl-4 pr-2 font-medium">Producto</th>
                  <th className="px-2 py-2 text-right font-medium" title="Días del mes con conteo cargado para este producto">Días</th>
                  <th className="px-2 py-2 text-right font-medium" title="Suma de los días donde se contó menos que el teórico">Faltante</th>
                  <th className="px-2 py-2 text-right font-medium" title="Suma de los días donde se contó más que el teórico">Sobrante</th>
                  <th className="px-2 py-2 text-right font-medium">Neto</th>
                  <th className="py-2 pl-2 pr-4 text-right font-medium">Impacto $</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productos.map((p) => (
                  <ProductoRow key={p.productoId} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
