import { RangePicker } from './range-picker'

const MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function rangeHeadline(from: string, to: string): { eyebrow: string; headline: string; trail: string } {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  // Mes calendario único
  const isFullMonth =
    fd === 1 && td === 1 &&
    ((fm === 12 && tm === 1 && ty === fy! + 1) || (tm === fm! + 1 && ty === fy))
  if (isFullMonth) {
    return {
      eyebrow: 'Resumen del mes',
      headline: MES[fm! - 1]!,
      trail: String(fy),
    }
  }
  // Año calendario completo
  if (fm === 1 && fd === 1 && tm === 1 && td === 1 && ty === fy! + 1) {
    return { eyebrow: 'Resumen del año', headline: String(fy), trail: '' }
  }
  // Multi-mes alineado a calendario
  if (fd === 1 && td === 1) {
    const tLastDay = new Date(ty!, tm! - 1, 0) // último día del mes anterior a "to"
    const lastM = tLastDay.getMonth()
    const lastY = tLastDay.getFullYear()
    if (lastY === fy) {
      return {
        eyebrow: 'Resumen del período',
        headline: `${MES[fm! - 1]} — ${MES[lastM]}`,
        trail: String(fy),
      }
    }
    return {
      eyebrow: 'Resumen del período',
      headline: `${MES[fm! - 1]} ${fy} — ${MES[lastM]} ${lastY}`,
      trail: '',
    }
  }
  // Rango libre con días arbitrarios
  const fmt = (y: number, m: number, d: number) =>
    `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  const toLastDay = new Date(ty!, tm! - 1, td! - 1)
  return {
    eyebrow: 'Resumen del período',
    headline: `${fmt(fy!, fm!, fd!)} — ${fmt(toLastDay.getFullYear(), toLastDay.getMonth() + 1, toLastDay.getDate())}`,
    trail: String(fy),
  }
}

export function DashboardHeader({ from, to }: { from: string; to: string }) {
  const { eyebrow, headline, trail } = rangeHeadline(from, to)

  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-2">
      <div className="space-y-1">
        <p className="text-eyebrow">{eyebrow}</p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight md:text-6xl">
          <span className="italic">{headline}</span>
          {trail && <span className="ml-3 text-foreground/30 text-metric">{trail}</span>}
        </h1>
      </div>
      <RangePicker from={from} to={to} />
    </header>
  )
}
