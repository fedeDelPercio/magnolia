'use client'

import { useMemo, useState } from 'react'
import { AlertTriangleIcon, CheckIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/format'
import { topSuggestion } from '../lib/similarity'
import type { CierreCajaExtract, MatchType } from '../schemas'
import type { ProductoBasico } from '../queries'

export type ProductoLine = {
  // Identidad para tracking (puede ser un nombre o un cierre_caja_producto.id)
  key: string
  nombre: string
  categoria: string | null
  cantidad: number
  monto_total: number
}

export type MappingEntry = {
  producto_id: string | null
  match_type: MatchType
  is_manual: boolean
}

// Lista de productos con UI de mapeo. Se usa tanto en el preview de import
// como en la vista de edición de un cierre existente.
export function ProductosList({
  productos,
  mappings,
  productosOptions,
  onMap,
  onCreate,
  showMatchedAsReadonly = false,
}: {
  productos: ProductoLine[]
  mappings: Record<string, MappingEntry>
  productosOptions: ProductoBasico[]
  onMap: (key: string, producto_id: string | null) => void
  onCreate: (key: string, nombre: string, sale_price: number) => void
  showMatchedAsReadonly?: boolean
}) {
  const porCategoria = productos.reduce<Record<string, ProductoLine[]>>((acc, p) => {
    const cat = p.categoria || 'Otros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const options = productosOptions.map((p) => ({ value: p.id, label: p.name }))

  return (
    <div className="space-y-3">
      {Object.entries(porCategoria).map(([categoria, prods]) => (
        <div key={categoria} className="rounded-lg border">
          <div className="border-b px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {categoria}
          </div>
          <div className="divide-y text-sm">
            {prods.map((p) => (
              <ProductoRow
                key={p.key}
                line={p}
                match={mappings[p.key]}
                options={options}
                onMap={(producto_id) => onMap(p.key, producto_id)}
                onCreate={() => onCreate(p.key, p.nombre, p.monto_total / p.cantidad)}
                showMatchedAsReadonly={showMatchedAsReadonly}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProductoRow({
  line,
  match,
  options,
  onMap,
  onCreate,
  showMatchedAsReadonly,
}: {
  line: ProductoLine
  match: MappingEntry | undefined
  options: { value: string; label: string }[]
  onMap: (id: string | null) => void
  onCreate: () => void
  showMatchedAsReadonly: boolean
}) {
  const [creating, setCreating] = useState(false)
  const mapped = !!match?.producto_id

  // Sugerencia por similitud (solo cuando no esta mapeado). Threshold 0.4:
  // por debajo confunde mas de lo que ayuda (matches al azar), por encima
  // suele ser una sugerencia con sentido que el user puede aceptar.
  const suggestion = useMemo(() => {
    if (mapped) return null
    return topSuggestion(line.nombre, options, null, 0.4)
  }, [line.nombre, options, mapped])

  function handleCreate() {
    setCreating(true)
    onCreate()
  }

  // Columnas fijas: nombre (flex) | monto (128px, alineado a la derecha) |
  // select+sugerencia (240px) | accion (88px). items-start alinea al tope
  // asi el boton "Crear" queda al mismo alto que el select en la misma
  // fila, aunque abajo del select haya "Sugerido: ...".
  return (
    <div className="grid grid-cols-[1fr_128px_240px_88px] items-start gap-3 px-3 py-2">
      <div className="flex h-7 items-center gap-2 min-w-0">
        {mapped ? (
          <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-600" />
        )}
        <span className="text-muted-foreground tabular-nums shrink-0">{line.cantidad}×</span>
        <span className="truncate">{line.nombre}</span>
      </div>

      <span className="flex h-7 items-center justify-end tabular-nums text-muted-foreground">
        {formatCurrency(line.monto_total)}
      </span>

      <div className="min-w-0 space-y-0.5">
        {mapped && showMatchedAsReadonly ? (
          <span className="flex h-7 items-center text-xs text-muted-foreground truncate">
            → {options.find((o) => o.value === match!.producto_id)?.label ?? 'producto'}
          </span>
        ) : (
          <SearchableSelect
            options={options}
            value={match?.producto_id ?? ''}
            onValueChange={onMap}
            placeholder={mapped ? '' : 'Mapear a producto...'}
            triggerClassName="h-7 text-xs w-full"
          />
        )}
        {suggestion && (
          // pl-3 alinea el texto con el placeholder interno del SearchableSelect
          <p className="pl-3 text-[10px] leading-tight text-muted-foreground truncate">
            Sugerido:{' '}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => onMap(suggestion.value)}
            >
              {suggestion.label}
            </button>{' '}
            ({Math.round(suggestion.score * 100)}%)
          </p>
        )}
      </div>

      <div className="flex h-7 items-center justify-end">
        {!mapped && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-3 text-xs"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? <Loader2Icon className="size-3 animate-spin" /> : <PlusIcon className="size-3" />}
            Crear
          </Button>
        )}
        {mapped && !showMatchedAsReadonly && (
          <button
            type="button"
            onClick={() => onMap(null)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
            title="Quitar mapeo"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
        {mapped && showMatchedAsReadonly && (
          <span className="text-xs text-muted-foreground">{matchLabel(match.match_type)}</span>
        )}
      </div>
    </div>
  )
}

function matchLabel(t: MatchType): string {
  switch (t) {
    case 'alias': return 'mapeado'
    case 'name_exact': return 'auto (nombre)'
    case 'name_normalized': return 'auto'
    default: return ''
  }
}

// Helper para convertir el extract de Claude en ProductoLine[] usando el nombre como key
export function extractToLines(productos: CierreCajaExtract['productos']): ProductoLine[] {
  return productos.map((p, idx) => ({
    // Usamos índice para evitar colisiones si hay nombres repetidos
    key: `${p.nombre}__${idx}`,
    nombre: p.nombre,
    categoria: p.categoria,
    cantidad: p.cantidad,
    monto_total: p.monto_total,
  }))
}
