import { getDashboardOverview } from './queries'

export type CostosEvolucionPunto = {
  month: string         // YYYY-MM
  label: string         // 'jun 26'
  foodCostPct: number | null
  laborCostPct: number | null
  primeCostPct: number | null
}

// Devuelve los ultimos N meses con sus food/labor/prime cost % calculados
// desde getDashboardOverview (1 corrida por mes en paralelo). Util para el
// modal de evolucion que abre al clickear las cards de Costos en el dashboard.
export async function getCostosEvolucion(months = 6): Promise<CostosEvolucionPunto[]> {
  // Construyo los meses (de mas antiguo a mas reciente para que el grafico
  // los lea izquierda -> derecha cronologicamente).
  const now = new Date()
  const ranges: Array<{ month: string; label: string; from: string; to: string }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '') +
      ' ' + String(d.getFullYear()).slice(-2)
    ranges.push({ month, label, from: iso(d), to: iso(next) })
  }

  const overviews = await Promise.all(
    ranges.map((r) => getDashboardOverview(r.from, r.to)),
  )

  return ranges.map((r, idx) => ({
    month: r.month,
    label: r.label,
    foodCostPct: overviews[idx]!.foodCostPct,
    laborCostPct: overviews[idx]!.laborCostPct,
    primeCostPct: overviews[idx]!.primeCostPct,
  }))
}
