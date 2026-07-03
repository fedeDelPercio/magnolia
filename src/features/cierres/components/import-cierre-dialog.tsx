'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  UploadIcon,
  FileTextIcon,
  Loader2Icon,
  AlertTriangleIcon,
} from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import {
  extractCierreCaja,
  saveCierreCaja,
  createProductoForAlias,
} from '../actions'
import type { CierreCajaExtract, MatchType, SaveMapping } from '../schemas'
import type { ProductoBasico } from '../queries'
import { ProductosList, extractToLines, type MappingEntry, type ProductoLine } from './productos-list'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productos: ProductoBasico[]
}

type Phase = 'idle' | 'extracting' | 'previewing' | 'saving'

export function ImportCierreDialog({ open, onOpenChange, productos: productosInit }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<CierreCajaExtract | null>(null)
  const [lines, setLines] = useState<ProductoLine[]>([])
  const [mappings, setMappings] = useState<Record<string, MappingEntry>>({})
  const [productos, setProductos] = useState<ProductoBasico[]>(productosInit)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setPhase('idle')
      setPreview(null)
      setLines([])
      setMappings({})
      setProductos(productosInit)
      setFileName(null)
    }
  }, [open, productosInit])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPhase('extracting')

    const formData = new FormData()
    formData.append('file', file)
    const result = await extractCierreCaja(formData)

    if (result.error || !result.data) {
      toast.error(result.error ?? 'Error al extraer')
      setPhase('idle')
      setFileName(null)
      return
    }

    const newLines = extractToLines(result.data.productos)
    setPreview(result.data)
    setLines(newLines)
    // Matches viene en el mismo orden que data.productos (y extractToLines
    // preserva ese orden), asi que indexamos por posicion. Antes indexabamos
    // por nombre — colisionaba cuando dos lineas tenian el mismo item vendido
    // en canales distintos (ej: "Empanada de Carne" en salon y delivery),
    // porque el ultimo match pisaba al anterior.
    const matches = result.matches ?? []
    const initial: Record<string, MappingEntry> = {}
    newLines.forEach((line, idx) => {
      const m = matches[idx]
      initial[line.key] = {
        producto_id: m?.producto_id ?? null,
        match_type: m?.match_type ?? null,
        is_manual: false,
      }
    })
    setMappings(initial)
    setPhase('previewing')
  }

  async function handleConfirm() {
    if (!preview) return
    setPhase('saving')

    const saveMappings: SaveMapping[] = lines.map((line) => {
      const m = mappings[line.key]
      // Persistir alias cuando: (a) el user cambio manualmente el mapeo, o
      // (b) el server auto-matcheo por fuzzy y el user confirmo sin cambiarlo.
      // Asi el proximo cierre con el mismo texto matchea via alias exacto y
      // no depende del threshold de similitud.
      const confirmedFuzzy = m?.match_type === 'fuzzy_auto' && !m?.is_manual
      return {
        nombre: line.nombre,
        producto_id: m?.producto_id ?? null,
        save_as_alias: (!!m?.is_manual || confirmedFuzzy) && !!m?.producto_id,
      }
    })

    const result = await saveCierreCaja(preview, saveMappings)
    if (result.error) {
      toast.error(result.error)
      setPhase('previewing')
      return
    }
    toast.success(
      result.movimientosCreados
        ? `Cierre importado. Se autocompletaron las ventas de ${result.movimientosCreados} productos.`
        : 'Cierre importado.',
    )
    onOpenChange(false)
    router.refresh()
  }

  function handleMap(key: string, producto_id: string | null) {
    setMappings((prev) => ({
      ...prev,
      [key]: { producto_id, match_type: producto_id ? 'alias' : null, is_manual: true },
    }))
  }

  async function handleCreateProduct(key: string, nombre: string, sale_price: number) {
    const result = await createProductoForAlias(nombre, sale_price, nombre)
    if (result.error || !result.id) {
      toast.error(result.error ?? 'No se pudo crear el producto')
      return
    }
    setProductos((prev) => [...prev, { id: result.id!, name: result.name! }])
    setMappings((prev) => ({
      ...prev,
      [key]: { producto_id: result.id!, match_type: 'alias', is_manual: false },
    }))
    toast.success(`Producto "${result.name}" creado y vinculado`)
  }

  const unmapped = lines.filter((l) => !mappings[l.key]?.producto_id)
  const mappedCount = lines.length - unmapped.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar cierre Bistrosoft</DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Subí el PDF de cierre de caja</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El sistema extrae los datos con AI y autocompleta las ventas del día.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelected}
                className="hidden"
              />
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                Seleccionar PDF
              </Button>
            </div>
          </div>
        )}

        {phase === 'extracting' && (
          <div className="rounded-xl border bg-card p-5 flex items-center gap-3 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            <FileTextIcon className="size-4 text-muted-foreground" />
            <span>{fileName}</span>
            <span className="text-muted-foreground">
              · Claude está extrayendo los datos, puede demorar 20-40 segundos...
            </span>
          </div>
        )}

        {(phase === 'previewing' || phase === 'saving') && preview && (
          <div className="space-y-4">
            {/* Stats principales */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-3 divide-x border-b">
                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total vendido</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(preview.total_vendido)}</p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket promedio</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">{formatCurrency(preview.ticket_promedio)}</p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cant. ventas</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{preview.cantidad_ventas}</p>
                </div>
              </div>

              <div className="px-5 py-3 border-b">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Por medio de pago
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                  <PagoRow label="Efectivo" value={preview.monto_efectivo} />
                  <PagoRow label="Tarjetas" value={preview.monto_tarjetas} />
                  <PagoRow label="QR" value={preview.monto_qr} />
                  <PagoRow label="Online" value={preview.monto_online} />
                </div>
              </div>
            </div>

            {/* Banner no-mapeados */}
            {unmapped.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {unmapped.length} producto{unmapped.length !== 1 ? 's' : ''} sin mapear
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Mapeá o creá los que correspondan para autocompletar sus ventas. Los que dejes sin mapear igual quedan guardados en el cierre y los podés mapear después.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Productos vendidos · {mappedCount} de {lines.length} mapeados
              </p>
              <ProductosList
                productos={lines}
                mappings={mappings}
                productosOptions={productos}
                onMap={handleMap}
                onCreate={handleCreateProduct}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={phase === 'saving'}>
            Cancelar
          </Button>
          {(phase === 'previewing' || phase === 'saving') && (
            <Button type="button" onClick={handleConfirm} disabled={phase === 'saving'}>
              {phase === 'saving' ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Confirmar e importar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PagoRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}
