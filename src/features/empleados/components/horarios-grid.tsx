import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DOW_LABELS_SHORT } from '../schemas'
import type { EmpleadoConHorarios } from '../queries'

type Props = { empleados: EmpleadoConHorarios[] }

// Columnas L → D para que sea más natural de leer (lunes primero).
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

function horasEntre(inicio: string, fin: string): number {
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  const minutos = (h2! * 60 + (m2 ?? 0)) - (h1! * 60 + (m1 ?? 0))
  return minutos / 60
}

export function HorariosGrid({ empleados }: Props) {
  if (empleados.length === 0) {
    return (
      <div className="card-editorial p-7 text-center">
        <p className="text-sm text-muted-foreground">Sin empleados activos.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 bg-muted/50 z-10">Empleado</th>
            {DOW_ORDER.map((dow) => (
              <th key={dow} className="text-center px-2 py-2 min-w-[78px]">
                {DOW_LABELS_SHORT[dow]}
              </th>
            ))}
            <th className="text-right px-3 py-2 min-w-[60px]">Horas / sem</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {empleados.map((emp) => {
            const slotsByDow = new Map<number, typeof emp.horarios>()
            for (const h of emp.horarios) {
              const arr = slotsByDow.get(h.dow) ?? []
              arr.push(h)
              slotsByDow.set(h.dow, arr)
            }
            const totalHoras = emp.horarios.reduce((s, h) => s + horasEntre(h.hora_inicio, h.hora_fin), 0)

            return (
              <tr key={emp.id} className="hover:bg-gray-50/40">
                <td className="px-3 py-2 sticky left-0 bg-card hover:bg-gray-50/40">
                  <Link href={`/empleados/${emp.id}`} className="font-medium hover:underline">
                    {emp.name}
                  </Link>
                </td>
                {DOW_ORDER.map((dow) => {
                  const slots = slotsByDow.get(dow) ?? []
                  return (
                    <td
                      key={dow}
                      className={cn(
                        'px-2 py-2 text-center tabular-nums text-xs',
                        slots.length === 0 ? 'text-muted-foreground' : '',
                      )}
                    >
                      {slots.length === 0 ? (
                        '—'
                      ) : (
                        slots.map((s) => (
                          <div key={s.id}>
                            {s.hora_inicio.slice(0, 5)}–{s.hora_fin.slice(0, 5)}
                          </div>
                        ))
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {totalHoras > 0 ? `${totalHoras.toFixed(0)} h` : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
