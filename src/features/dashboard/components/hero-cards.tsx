import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort } from '@/lib/format'
import type { DashboardOverview } from '../queries'

export function HeroCards({ overview }: { overview: DashboardOverview }) {
  const facturacionDelta = overview.facturacionDeltaPct
  const facturacionDeltaPositive = facturacionDelta !== null && facturacionDelta > 0
  const FacturacionDeltaIcon = facturacionDeltaPositive ? TrendingUpIcon : TrendingDownIcon

  const margenDelta = overview.margenOperativoDeltaPct
  const margenDeltaPositive = margenDelta !== null && margenDelta > 0
  const MargenDeltaIcon = margenDeltaPositive ? TrendingUpIcon : TrendingDownIcon

  const movimientosDelta = overview.cantidadVentasDeltaPct
  const movimientosDeltaPositive = movimientosDelta !== null && movimientosDelta > 0
  const MovimientosDeltaIcon = movimientosDeltaPositive ? TrendingUpIcon : TrendingDownIcon

  const ticketDelta = overview.ticketPromedioDeltaPct
  const ticketDeltaPositive = ticketDelta !== null && ticketDelta > 0
  const TicketDeltaIcon = ticketDeltaPositive ? TrendingUpIcon : TrendingDownIcon

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-12">
      {/* === Fila 1: Facturación + Movimientos === */}
      {/* Facturación (col 6) */}
      <div className="card-editorial relative flex flex-col justify-between overflow-hidden p-7 md:col-span-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, oklch(0.34 0.07 138) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <p className="text-eyebrow">Facturación del período</p>
          <p className="mt-4 num-editorial text-[3.25rem] leading-none text-foreground">
            {formatCurrencyShort(overview.facturacion)}
          </p>
        </div>
        <div className="relative mt-5">
          {facturacionDelta !== null ? (
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
                facturacionDeltaPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              )}
              title="Mismo tramo del mes anterior"
            >
              <FacturacionDeltaIcon className="size-3" aria-hidden />
              {facturacionDeltaPositive ? '+' : ''}
              {facturacionDelta.toFixed(1)}% vs. mes anterior
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">Sin mes anterior comparable</p>
          )}
        </div>
      </div>

      {/* Movimientos (col 6) */}
      <div className="card-editorial flex flex-col justify-between p-7 md:col-span-6">
        <div>
          <p className="text-eyebrow">Movimientos</p>
          <p className="mt-4 num-editorial text-[3.25rem] leading-none text-metric">
            {overview.cantidadVentas.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="mt-5 space-y-1.5">
          {movimientosDelta !== null && (
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
                movimientosDeltaPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              )}
              title="Mismo tramo del mes anterior"
            >
              <MovimientosDeltaIcon className="size-3" aria-hidden />
              {movimientosDeltaPositive ? '+' : ''}
              {movimientosDelta.toFixed(1)}% vs. mes anterior
            </div>
          )}
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>
              <span className="text-metric font-medium text-foreground">ventas</span> en total
            </p>
            <p>
              <span className="text-metric font-medium text-foreground">{overview.cubiertosSalon}</span>{' '}
              cubiertos en salón
            </p>
          </div>
        </div>
      </div>

      {/* === Fila 2: Margen operativo + Ticket promedio === */}
      {/* Margen operativo (col 6) */}
      <div className="card-editorial flex flex-col justify-between p-7 md:col-span-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-eyebrow">Margen operativo</p>
          {overview.margenOperativoPct !== null && (
            <span className="text-metric text-xs font-medium text-emerald-700">
              {overview.margenOperativoPct.toFixed(0)}% margen
            </span>
          )}
        </div>
        {overview.margenOperativo !== null ? (
          <>
            <p className="mt-4 num-editorial text-[3.25rem] leading-none text-foreground">
              {formatCurrencyShort(overview.margenOperativo)}
            </p>
            <div className="mt-5 space-y-1.5">
              {margenDelta !== null ? (
                <div
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
                    margenDeltaPositive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700',
                  )}
                  title="Mismo tramo del mes anterior"
                >
                  <MargenDeltaIcon className="size-3" aria-hidden />
                  {margenDeltaPositive ? '+' : ''}
                  {margenDelta.toFixed(1)}% vs. mes anterior
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">Sin mes anterior comparable</p>
              )}
              <p className="text-xs text-muted-foreground">
                facturación − food{' '}
                <span className="text-metric font-medium text-foreground">
                  {formatCurrencyShort(overview.foodCostMonto)}
                </span>{' '}
                − labor{' '}
                <span className="text-metric font-medium text-foreground">
                  {formatCurrencyShort(overview.laborCostMonto)}
                </span>
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 num-editorial text-[3.25rem] leading-none text-muted-foreground">—</p>
            <p className="mt-5 text-xs italic text-muted-foreground">
              Cargá recetas y sueldos para calcular el margen operativo
            </p>
          </>
        )}
      </div>

      {/* Ticket promedio (col 6) */}
      <div className="card-editorial flex flex-col justify-between p-7 md:col-span-6">
        <div>
          <p className="text-eyebrow">Ticket promedio</p>
          <p className="mt-4 num-editorial text-[3.25rem] leading-none">
            {formatCurrencyShort(overview.ticketPromedio)}
          </p>
        </div>
        <div className="mt-5 space-y-1.5">
          {ticketDelta !== null && (
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
                ticketDeltaPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700',
              )}
              title="Mismo tramo del mes anterior"
            >
              <TicketDeltaIcon className="size-3" aria-hidden />
              {ticketDeltaPositive ? '+' : ''}
              {ticketDelta.toFixed(1)}% vs. mes anterior
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            por venta · salón{' '}
            <span className="text-metric font-medium text-foreground">
              {formatCurrency(overview.ticketPromedioSalon)}
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
