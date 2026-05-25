'use client'

import { useState } from 'react'
import { AlertTriangleIcon, CheckIcon, Loader2Icon, PlusIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/format'
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

  function handleCreate() {
    setCreating(true)
    onCreate()
  }

  return (
    <div className="grid grid-cols-[1fr_auto_240px_auto] items-center gap-3 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {mapped ? (
          <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-600" />
        )}
        <span className="text-muted-foreground tabular-nums shrink-0">{line.cantidad}×</span>
        <span className="truncate">{line.nombre}</span>
      </div>

      <span className="tabular-nums text-muted-foreground">{formatCurrency(line.monto_total)}</span>

      {mapped && showMatchedAsReadonly ? (
        <span className="text-xs text-muted-foreground truncate">
          → {options.find((o) => o.value === match!.producto_id)?.label ?? 'producto'}
        </span>
      ) : (
        <SearchableSelect
          options={options}
          value={match?.producto_id ?? ''}
          onValueChange={onMap}
          placeholder={mapped ? '' : 'Mapear a producto...'}
          triggerClassName="h-7 text-xs"
        />
      )}

      {!mapped && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
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
