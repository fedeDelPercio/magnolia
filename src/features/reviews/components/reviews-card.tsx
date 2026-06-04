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

  const newReviews = summary.newReviewsCount
  const grewReviews = newReviews !== null && newReviews > 0

  const sparkValues = summary.sparkline.map((s) => s.rating)
  const sparkFallback = sparkValues.length === 0 ? [summary.rating, summary.rating] : sparkValues

  return (
    <section className="card-editorial overflow-hidden p-7">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-eyebrow">Reseñas Google</p>
        {summary.placeName && <p className="text-card-sub">{summary.placeName}</p>}
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-8">
        {/* Métrica 1 — Calificación */}
        <div className="flex flex-col justify-between">
          <div className="flex items-baseline gap-2">
            <StarIcon className="size-7 -translate-y-1 fill-amber-400 text-amber-400" aria-hidden />
            <p className="num-editorial text-5xl leading-none">{fmtRating(summary.rating)}</p>
            <span className="text-metric text-sm text-muted-foreground">/ 5,0</span>
          </div>
          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-editorial text-muted-foreground">
              Calificación
            </p>
            {hasDelta ? (
              <span
                className={cn(
                  'mt-1 inline-flex items-center gap-1 text-xs font-medium text-metric',
                  deltaPositive ? 'text-emerald-700' : 'text-rose-700',
                )}
              >
                <DeltaIcon className="size-3" aria-hidden />
                {deltaPositive ? '+' : ''}
                {delta!.toFixed(1)} vs. período anterior
              </span>
            ) : (
              <p className="mt-1 text-xs italic text-muted-foreground">
                {delta !== null ? 'Estable en el período' : 'Sin comparable aún'}
              </p>
            )}
          </div>
        </div>

        {/* divisor */}
        <div className="hidden w-px self-stretch bg-border sm:block" aria-hidden />

        {/* Métrica 2 — Reseñas totales (co-protagonista) */}
        <div className="flex flex-col justify-between">
          <p className="num-editorial text-5xl leading-none">
            {summary.totalReviews.toLocaleString('es-AR')}
          </p>
          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-editorial text-muted-foreground">
              Reseñas en Google
            </p>
            {grewReviews ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-metric text-emerald-700">
                <TrendingUpIcon className="size-3" aria-hidden />+
                {newReviews!.toLocaleString('es-AR')} en el período
              </span>
            ) : newReviews === 0 ? (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Sin reseñas nuevas en el período
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Tu base — ojo que esto suba
              </p>
            )}
          </div>
        </div>

        {/* Sparkline del rating — a la derecha */}
        <div className="hidden flex-col justify-end text-primary sm:ml-auto sm:flex" aria-hidden>
          <Sparkline data={sparkFallback} width={120} height={36} />
          <p className="mt-1 text-[10px] uppercase tracking-editorial text-muted-foreground">
            Evolución del rating
          </p>
        </div>
      </div>
    </section>
  )
}
