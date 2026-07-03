'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDaysIcon, InfoIcon } from 'lucide-react'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { setRecetaDelDia } from '../actions'
import { DOW_LABELS, type RecetaDelDiaAsignacion } from '../queries'

type Props = {
  asignaciones: Array<{ dow: number; asignacion: RecetaDelDiaAsignacion | null }>
  productos: Array<{ id: string; name: string; concepto_name: string | null }>
}

// DOW en el orden que Caro espera (Lunes primero). Reordenamos para render pero
// mantenemos el DOW original (0=domingo, 1=lunes, ...) al guardar.
const DOW_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0]

export function RecetaDelDiaClient({ asignaciones, productos }: Props) {
  const [pending, startTransition] = useTransition()
  const [savingDow, setSavingDow] = useState<number | null>(null)

  const byDow = new Map(asignaciones.map((a) => [a.dow, a.asignacion]))

  // Opciones del SearchableSelect: mostramos "Concepto — variante" cuando aplica
  // para que Caro sepa que esta eligiendo una variante especifica del concepto.
  const options = productos.map((p) => ({
    value: p.id,
    label: p.concepto_name && p.concepto_name.toLowerCase() !== p.name.toLowerCase()
      ? `${p.concepto_name} — ${p.name}`
      : p.name,
  }))

  function handleChange(dow: number, producto_id: string | null) {
    setSavingDow(dow)
    startTransition(async () => {
      const result = await setRecetaDelDia(dow, producto_id)
      setSavingDow(null)
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

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2 text-sm text-primary">
          <InfoIcon className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Receta del día por día de la semana</p>
            <p className="mt-1 text-xs text-primary/80">
              Cuando Bistrosoft envía un item tipo <em>&quot;Sugerencia del día&quot;</em>
              {' '}o <em>&quot;Menú del día&quot;</em>, el sistema lo mapea al producto
              asignado al día correspondiente. Si el producto tiene variantes
              (canal / formato), se elige la variante que corresponda al ticket automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Grilla de dias */}
      <div className="rounded-xl border bg-card divide-y">
        {DOW_ORDER.map((dow) => {
          const asignacion = byDow.get(dow) ?? null
          const isSaving = savingDow === dow && pending
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
                <SearchableSelect
                  options={options}
                  value={asignacion?.producto_id ?? ''}
                  onValueChange={(v) => handleChange(dow, v || null)}
                  placeholder="Sin asignar — clic para elegir producto..."
                  triggerClassName="h-9 text-sm w-full"
                />
              </div>
              <div className="text-xs text-right">
                {isSaving ? (
                  <span className="text-muted-foreground italic">Guardando...</span>
                ) : asignacion ? (
                  <button
                    type="button"
                    onClick={() => handleChange(dow, null)}
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
