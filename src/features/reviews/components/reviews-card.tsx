import Link from 'next/link'
import { StarIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewsSummary } from '../queries'

function Sparkline({ data, width = 96, height = 22 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden role="img">
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeDasharray="3 3"
        />
      </svg>
    )
  }
  // Rango fijo 3.0–5.0 → más legible que auto-scale para ratings de Maps.
  const min = 3
  const max = 5
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  const norm = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v))
    return height - ((clamped - min) / (max - min)) * height
  }
  const points = data.map((v, i) => `${i * stepX},${norm(v).toFixed(2)}`).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`
  return (
    <svg width={width} height={height} aria-hidden role="img">
      <polygon points={areaPoints} fill="currentColor" fillOpacity={0.08} />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function fmtRating(r: number | null): string {
  if (r === null) return '—'
  return r.toFixed(1)
}

export function ReviewsCard({ summary }: { summary: ReviewsSummary }) {
  // Place ID no configurado → CTA
  if (!summary.placeId) {
    return (
      <section className="card-editorial flex items-center justify-between gap-6 p-6">
        <div>
          <p className="text-eyebrow">Reseñas Google</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Activá el seguimiento de calificaciones de Google Maps para ver cómo evolucionan.
          </p>
        </div>
        <Link
          href="/config"
          className="focus-ring rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Configurar
        </Link>
      </section>
    )
  }

  // Place ID configurado pero sin snapshots todavía (corner case: sync falló)
  if (summary.rating === null || summary.totalReviews === null) {
    return (
      <section className="card-editorial p-6">
        <div className="flex items-center gap-2 text-card-title">
          <StarIcon className="size-3.5 text-amber-500" aria-hidden />
          <span>Reseñas Google</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {summary.placeName ? `${summary.placeName} · ` : ''}Esperando la primera sincronización. Recargá en unos segundos.
        </p>
      </section>
    )
  }

  const delta = summary.ratingDelta
  const hasDelta = delta !== null && Math.abs(delta) >= 0.05
  const deltaPositive = (delta ?? 0) > 0
  const DeltaIcon = deltaPositive ? TrendingUpIcon : TrendingDownIcon

  const sparkValues = summary.sparkline.map((s) => s.rating)
  // Si no hay puntos del período, mostramos al menos el último para que el SVG no quede vacío.
  const sparkFallback = sparkValues.length === 0 ? [summary.rating, summary.rating] : sparkValues

  return (
    <section className="card-editorial flex flex-col gap-4 overflow-hidden p-7 md:flex-row md:items-center md:justify-between">
      {/* Bloque izquierdo: rating + nombre */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-eyebrow">Reseñas Google</p>
          <div className="mt-3 flex items-baseline gap-2">
            <StarIcon className="size-7 -translate-y-1 fill-amber-400 text-amber-400" aria-hidden />
            <p className="num-editorial text-5xl leading-none">{fmtRating(summary.rating)}</p>
            <span className="text-sm text-muted-foreground text-metric">/ 5,0</span>
          </div>
          {summary.placeName && (
            <p className="mt-2 text-card-sub">{summary.placeName}</p>
          )}
        </div>

        {/* Sparkline */}
        <div className="hidden text-primary md:block" aria-hidden>
          <Sparkline data={sparkFallback} />
          <p className="mt-1 text-[10px] uppercase tracking-editorial text-muted-foreground">
            evolución
          </p>
        </div>
      </div>

      {/* Bloque derecho: deltas */}
      <div className="flex flex-col items-start gap-2 md:items-end">
        {hasDelta ? (
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-metric',
              deltaPositive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700',
            )}
          >
            <DeltaIcon className="size-3" aria-hidden />
            {deltaPositive ? '+' : ''}
            {delta!.toFixed(1)} vs. período anterior
          </div>
        ) : delta !== null ? (
          <p className="text-xs italic text-muted-foreground">Rating estable en el período</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sin período anterior comparable</p>
        )}

        <p className="text-sm text-muted-foreground">
          {summary.newReviewsCount !== null && summary.newReviewsCount > 0 ? (
            <>
              <span className="text-metric font-medium text-foreground">
                +{summary.newReviewsCount.toLocaleString('es-AR')}
              </span>{' '}
              reseñas nuevas ·{' '}
            </>
          ) : null}
          <span className="text-metric font-medium text-foreground">
            {summary.totalReviews.toLocaleString('es-AR')}
          </span>{' '}
          totales
        </p>
      </div>
    </section>
  )
}
