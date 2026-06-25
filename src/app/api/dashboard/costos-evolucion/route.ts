import { NextResponse } from 'next/server'
import { getCostosEvolucion } from '@/features/dashboard/costos-evolucion-queries'

export const dynamic = 'force-dynamic'

// Endpoint usado por el modal de evolucion en /dashboard.
// Se llama desde el cliente con fetch (no podemos pasar la query directo al
// componente client porque getDashboardOverview usa cookies/server).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const months = Math.max(1, Math.min(24, Number(url.searchParams.get('months') ?? '6')))
    const data = await getCostosEvolucion(months)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
