'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDaysIcon, InfoIcon, LockIcon } from 'lucide-react'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { setRecetaDelDia } from '../actions'
import { DOW_LABELS, semanaLabel, type RecetaSemana } from '../constants'

type Props = {
  semanas: RecetaSemana[]
  productos: Array<{ id: string; name: string; concepto_name: string | null }>
}

// DOW en el orden que Caro espera (Lunes primero). Reordenamos para render pero
// mantenemos el DOW original (0=domingo, 1=lunes, ...) al guardar.
const DOW_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0]

// Rango de fechas legible de la semana (lun–dom) a partir del week_start.
function rangoSemana(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const lun = new Date(y!, m! - 1, d!)
  const dom = new Date(y!, m! - 1, d! + 6)
  const fmt = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`
  return `${fmt(lun)} – ${fmt(dom)}`
}

export function RecetaDelDiaClient({ semanas, productos }: Props) {
  const [pending, startTransition] = useTransition()
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // Arranca en la semana en curso (offset 0).
  const [activeOffset, setActiveOffset] = useState<number>(0)

  const activa = semanas.find((s) => s.offset === activeOffset) ?? semanas[0]

  const options = productos.map((p) => ({
    value: p.id,
    label: p.concepto_name && p.concepto_name.toLowerCase() !== p.name.toLowerCase()
      ? `${p.concepto_name} — ${p.name}`
      : p.name,
  }))

  function handleChange(week_start: string, dow: number, producto_id: string | null) {
    const key = `${week_start}|${dow}`
    setSavingKey(key)
    startTransition(async () => {
      const result = await setRecetaDelDia(week_start, dow, producto_id)
      setSavingKey(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          producto_id
            ? `${DOW_LABELS[dow]}: receta del día actualizada`
            : `${DOW_LABELS[dow]}: receta del día eliminada`,
        )
      }
    })
  }

  if (!activa) return null
  const readOnly = !activa.editable

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2 text-sm text-primary">
          <InfoIcon className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Menú de la semana</p>
            <p className="mt-1 text-xs text-primary/80">
              Cada semana tiene su propio menú por día. Editás la semana actual y la próxima;
              las 2 pasadas quedan de solo lectura. La semana &quot;actual&quot; se actualiza sola cada lunes.
              Cuando Bistrosoft envía un item <em>&quot;Sugerencia del día&quot;</em> o <em>&quot;Menú del día&quot;</em>,
              se mapea al producto asignado a esa semana y día.
            </p>
          </div>
        </div>
      </div>

      {/* Selector de semana */}
      <div className="flex flex-wrap gap-1.5">
        {semanas.map((s) => {
          const active = s.offset === activeOffset
          return (
            <button
              key={s.week_start}
              type="button"
              onClick={() => setActiveOffset(s.offset)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-foreground',
              )}
            >
              <span className="font-medium">{semanaLabel(s.offset)}</span>
              <span className={cn('ml-1.5 text-xs', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {rangoSemana(s.week_start)}
              </span>
            </button>
          )
        })}
      </div>

      {readOnly && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon className="size-3" />
          Semana pasada — solo lectura.
        </p>
      )}

      {/* Grilla de dias de la semana activa */}
      <div className="rounded-xl border bg-card divide-y">
        {DOW_ORDER.map((dow) => {
          const asignacion = activa.dias.find((d) => d.dow === dow)?.asignacion ?? null
          const key = `${activa.week_start}|${dow}`
          const isSaving = savingKey === key && pending
          return (
            <div
              key={dow}
              className="grid grid-cols-[120px_1fr_120px] items-center gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="size-4 text-muted-foreground" />
                <span className="font-medium">{DOW_LABELS[dow]}</span>
              </div>
              <div className="min-w-0">
                {readOnly ? (
                  <span className="text-sm text-muted-foreground">
                    {asignacion
                      ? (asignacion.concepto_name && asignacion.concepto_name.toLowerCase() !== asignacion.producto_name.toLowerCase()
                          ? `${asignacion.concepto_name} — ${asignacion.producto_name}`
                          : asignacion.producto_name)
                      : <span className="italic text-muted-foreground/50">Sin asignar</span>}
                  </span>
                ) : (
                  <SearchableSelect
                    options={options}
                    value={asignacion?.producto_id ?? ''}
                    onValueChange={(v) => handleChange(activa.week_start, dow, v || null)}
                    placeholder="Sin asignar — clic para elegir producto..."
                    triggerClassName="h-9 text-sm w-full"
                  />
                )}
              </div>
              <div className="text-xs text-right">
                {isSaving ? (
                  <span className="text-muted-foreground italic">Guardando...</span>
                ) : !readOnly && asignacion ? (
                  <button
                    type="button"
                    onClick={() => handleChange(activa.week_start, dow, null)}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                  >
                    Quitar
                  </button>
                ) : (
                  <span className="text-muted-foreground/40 italic">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
