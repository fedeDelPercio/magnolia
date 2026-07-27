'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LockIcon, LockOpenIcon, ArrowLeftIcon, UploadIcon, FileTextIcon, AlertTriangleIcon, RotateCcwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import { cerrarDia, reabrirDia, traerStockDiaAnterior } from '../actions'
import { MovimientoRow } from './movimiento-row'
import { MovimientoGroupRow } from './movimiento-group-row'
import type { DiaConMovimientos, MovimientoConProducto } from '../queries'
import type { CierreCajaWithProductos, ProductoBasico } from '@/features/cierres/queries'
import { ImportCierreDialog } from '@/features/cierres/components/import-cierre-dialog'
import { CierreDetailDialog } from '@/features/cierres/components/cierre-detail-dialog'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatFecha(fechaStr: string) {
  const parts = fechaStr.split('-').map(Number)
  const [year, month, day] = [parts[0]!, parts[1]!, parts[2]!]
  return `${day} de ${MESES[month - 1]!} de ${year}`
}

type MovimientoGroup = {
  key: string
  name: string
  primary: MovimientoConProducto
  secondaries: MovimientoConProducto[]
}

// Agrupa las variantes de canal (Mostrador base + Barra/delivery) de un mismo
// producto en un solo grupo, para mostrar una produccion unica por producto.
// El menu del dia (formato='menu') y los productos sin concepto quedan como
// grupos propios de una sola fila.
function buildMovimientoGroups(movs: MovimientoConProducto[]): MovimientoGroup[] {
  const map = new Map<string, MovimientoConProducto[]>()
  for (const m of movs) {
    const p = m.productos
    const isMenu = p.formato === 'menu'
    const key = p.concepto_id && !isMenu ? `concepto:${p.concepto_id}` : `prod:${m.producto_id}`
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  const groups: MovimientoGroup[] = []
  for (const [key, arr] of map) {
    // Primaria = variante base (canal null). Fallback: la primera.
    const primary = arr.find((m) => m.productos.canal === null) ?? arr[0]!
    const secondaries = arr.filter((m) => m.id !== primary.id)
    groups.push({ key, name: primary.productos.name, primary, secondaries })
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return groups
}

type Props = {
  dia: DiaConMovimientos
  cierres: CierreCajaWithProductos[]
  productosCatalogo: ProductoBasico[]
  taxRate?: number
}

export function DiaClient({ dia, cierres, productosCatalogo, taxRate = 0 }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedCierre, setSelectedCierre] = useState<CierreCajaWithProductos | null>(null)

  const readonly = dia.status === 'cerrado'
  const groups = buildMovimientoGroups(dia.movimientos_diarios)

  function handleCerrar() {
    setLoading(true)
    startTransition(async () => {
      const result = await cerrarDia(dia.id)
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        const n = result.sueldosPagados ?? 0
        toast.success(
          n > 0
            ? `Día cerrado. Se pagaron ${n} sueldo${n === 1 ? '' : 's'} en caja.`
            : 'Día cerrado correctamente',
        )
        router.refresh()
      }
    })
  }

  function handleTraerStock() {
    if (
      !window.confirm(
        'Esto reemplaza el stock anterior de todos los productos con lo que quedó el día previo (conteo físico, o teórico si no se contó). ¿Continuar?',
      )
    )
      return
    setLoading(true)
    startTransition(async () => {
      const result = await traerStockDiaAnterior(dia.id)
      if (result.error) {
        setLoading(false)
        toast.error(result.error)
      } else {
        // Recarga dura: las filas inicializan su estado local desde los props y
        // no se re-sincronizan con un router.refresh(), así que sin esto el
        // stock nuevo no se vería reflejado en los inputs.
        window.location.reload()
      }
    })
  }

  function handleReabrir() {
    setLoading(true)
    startTransition(async () => {
      const result = await reabrirDia(dia.id)
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Día reabierto')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/operacion')} className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{formatFecha(dia.fecha)}</h1>
            <p className="text-sm text-muted-foreground">{groups.length} productos</p>
          </div>
          <Badge
            variant="outline"
            className={
              dia.status === 'abierto'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }
          >
            {dia.status === 'abierto' ? 'Abierto' : 'Cerrado'}
          </Badge>
        </div>

        <div className="flex gap-2">
          {dia.status === 'abierto' ? (
            <>
              <Button variant="outline" onClick={handleTraerStock} disabled={loading}>
                <RotateCcwIcon className="size-4" />
                Traer stock anterior
              </Button>
              <Button onClick={handleCerrar} disabled={loading}>
                <LockIcon className="size-4" />
                {loading ? 'Cerrando...' : 'Cerrar día'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleReabrir} disabled={loading}>
              <LockOpenIcon className="size-4" />
              {loading ? 'Reabriendo...' : 'Reabrir'}
            </Button>
          )}
        </div>
      </div>

      {/* Cierre Bistrosoft section */}
      <CierreBistrosoftSection
        cierres={cierres}
        onImport={() => setImportOpen(true)}
        onView={(c) => setSelectedCierre(c)}
      />

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <th className="py-2.5 pl-4 pr-2 text-left">Producto</th>
              <th className="px-2 py-2.5 text-right">Stock ant.</th>
              <th className="px-2 py-2.5 text-right">Produc.</th>
              <th className="px-2 py-2.5 text-right">Ventas</th>
              <th className="px-2 py-2.5 text-right">Desperd.</th>
              <th className="px-2 py-2.5 text-right">Almuerzo</th>
              <th className="px-2 py-2.5 text-right">Conteo</th>
              <th className="px-2 py-2.5 text-right">Teórico</th>
              <th className="px-2 py-2.5 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  Sin productos. Agregá productos activos desde el catálogo.
                </td>
              </tr>
            ) : (
              groups.map((g) =>
                g.secondaries.length === 0 ? (
                  <MovimientoRow key={g.primary.id} mov={g.primary} readonly={readonly} />
                ) : (
                  <MovimientoGroupRow
                    key={g.key}
                    primary={g.primary}
                    secondaries={g.secondaries}
                    name={g.name}
                    readonly={readonly}
                  />
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      {readonly && (
        <p className="text-center text-xs text-muted-foreground">
          El día está cerrado. Los datos son de solo lectura.
        </p>
      )}
      {!readonly && groups.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Los cambios se guardan automáticamente.
        </p>
      )}

      <ImportCierreDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        productos={productosCatalogo}
      />
      {selectedCierre && (
        <CierreDetailDialog
          open={!!selectedCierre}
          onOpenChange={(v) => !v && setSelectedCierre(null)}
          cierre={selectedCierre}
          productos={productosCatalogo}
          taxRate={taxRate}
        />
      )}
    </div>
  )
}

function CierreBistrosoftSection({
  cierres,
  onImport,
  onView,
}: {
  cierres: CierreCajaWithProductos[]
  onImport: () => void
  onView: (c: CierreCajaWithProductos) => void
}) {
  if (cierres.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileTextIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Cierre Bistrosoft</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Subí el PDF de cierre de caja para autocompletar las ventas del día.
              </p>
            </div>
          </div>
          <Button type="button" onClick={onImport}>
            <UploadIcon className="size-4" />
            Importar cierre
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <p className="text-sm font-medium">Cierre Bistrosoft</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cierres.length} cierre{cierres.length !== 1 ? 's' : ''} importado{cierres.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onImport}>
          <UploadIcon className="size-3.5" />
          Importar otro
        </Button>
      </div>
      <div className="border-t divide-y text-sm">
        {cierres.map((c) => {
          const unmapped = c.cierre_caja_productos.filter((p) => !p.producto_id).length
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onView(c)}
              className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <span>
                    {c.operador ?? 'Sin operador'} · {c.cantidad_ventas} ventas · {c.cubiertos} cubiertos
                  </span>
                  <span
                    className={
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ' +
                      (c.source === 'api'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {c.source === 'api' ? 'API' : 'PDF'}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Efectivo {formatCurrency(c.monto_efectivo)} · Tarjetas {formatCurrency(c.monto_tarjetas)} · QR {formatCurrency(c.monto_qr)} · Online {formatCurrency(c.monto_online)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {unmapped > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangleIcon className="size-3.5" />
                    {unmapped} sin mapear
                  </span>
                )}
                <span className="tabular-nums font-semibold">{formatCurrency(c.total_vendido)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
