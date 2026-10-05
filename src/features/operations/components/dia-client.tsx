'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LockIcon, LockOpenIcon, ArrowLeftIcon, UploadIcon, FileTextIcon, AlertTriangleIcon, RotateCcwIcon, SearchIcon, ArrowDownIcon, ArrowUpIcon, ArrowRightLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { matchesSearch } from '@/lib/text'
import { formatCurrency } from '@/lib/format'
import { cerrarDia, reabrirDia, traerStockDiaAnterior } from '../actions'
import { MovimientoRow } from './movimiento-row'
import { MovimientoGroupRow } from './movimiento-group-row'
import { ReasignarVentasDialog } from './reasignar-ventas-dialog'
import { esVarianteBase, grupoKey, varianteOrden } from '../grupos'
import { guardarAvisoPendiente, leerAvisoPendiente } from '../aviso-pendiente'
import { guardarPendientes, hayPendientes } from '../guardados-pendientes'
import { EVENTO_GUARDADO_IMPOSIBLE } from '../use-guardado-fila'
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
  // Nombres de todas las variantes: el buscador encuentra el producto aunque
  // se escriba el nombre de la variante.
  searchText: string
  primary: MovimientoConProducto
  secondaries: MovimientoConProducto[]
}

// Agrupa las variantes (salón, barra, menú) de un mismo producto en un solo
// grupo: una fila por producto, con una producción única. Los productos sin
// concepto quedan como grupos propios de una sola fila. Ver ../grupos.ts.
function buildMovimientoGroups(movs: MovimientoConProducto[]): MovimientoGroup[] {
  const map = new Map<string, MovimientoConProducto[]>()
  for (const m of movs) {
    const key = grupoKey(m.producto_id, m.productos)
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  const groups: MovimientoGroup[] = []
  for (const [key, arr] of map) {
    // Primaria = variante base (salón). Fallback: la primera.
    const primary = arr.find((m) => esVarianteBase(m.productos)) ?? arr[0]!
    // Orden fijo de la apertura: salón, barra, menú.
    const secondaries = arr
      .filter((m) => m.id !== primary.id)
      .sort((x, y) => varianteOrden(x.productos) - varianteOrden(y.productos))
    const searchText = arr.map((m) => m.productos.name).join(' ')
    groups.push({ key, name: primary.productos.name, searchText, primary, secondaries })
  }
  return groups
}

// ---- Orden de la grilla --------------------------------------------------
// Se ordena por los valores GUARDADOS (los que vinieron del server), no por lo
// que se está tipeando: si no, las filas saltarían de lugar mientras se carga.

type NumField = 'stock_anterior' | 'produccion' | 'ventas' | 'desperdicio' | 'almuerzo' | 'conteo_fisico'
type SortField = 'name' | NumField | 'teorico' | 'diferencia'
type Sort = { field: SortField; dir: 'asc' | 'desc' }

// Por defecto, lo que tiene stock arriba: es lo que hay que mirar hoy.
const DEFAULT_SORT: Sort = { field: 'stock_anterior', dir: 'desc' }

const COLUMNAS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Producto' },
  { field: 'stock_anterior', label: 'Stock ant.' },
  { field: 'produccion', label: 'Produc.' },
  { field: 'ventas', label: 'Ventas' },
  { field: 'desperdicio', label: 'Desperd.' },
  { field: 'almuerzo', label: 'Almuerzo' },
  { field: 'conteo_fisico', label: 'Conteo' },
  { field: 'teorico', label: 'Teórico' },
  { field: 'diferencia', label: 'Diferencia' },
]

function groupValue(g: MovimientoGroup, field: Exclude<SortField, 'name'>): number {
  const all = [g.primary, ...g.secondaries]
  const sum = (f: NumField) => all.reduce((s, m) => s + (Number(m[f]) || 0), 0)
  if (field === 'teorico' || field === 'diferencia') {
    const teorico =
      sum('stock_anterior') + sum('produccion') - sum('ventas') - sum('desperdicio') - sum('almuerzo')
    return field === 'teorico' ? teorico : sum('conteo_fisico') - teorico
  }
  return sum(field)
}

// Sin conteo no hay diferencia (la grilla muestra "—"): al ordenar por
// Diferencia esos productos van al final, en cualquier sentido.
function sinContar(g: MovimientoGroup): boolean {
  return [g.primary, ...g.secondaries].every((m) => m.conteo_fisico === null)
}

function sortGroups(groups: MovimientoGroup[], sort: Sort): MovimientoGroup[] {
  const byName = (a: MovimientoGroup, b: MovimientoGroup) => a.name.localeCompare(b.name, 'es')
  const sign = sort.dir === 'asc' ? 1 : -1
  const field = sort.field
  return [...groups].sort((a, b) => {
    if (field === 'name') return sign * byName(a, b)
    if (field === 'diferencia') {
      const na = sinContar(a)
      const nb = sinContar(b)
      if (na !== nb) return na ? 1 : -1
      if (na && nb) return byName(a, b)
    }
    return sign * (groupValue(a, field) - groupValue(b, field)) || byName(a, b)
  })
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
  const [reasignarOpen, setReasignarOpen] = useState(false)

  // Reasignar ventas recarga la página; el aviso de éxito queda guardado para
  // mostrarlo acá, después de la recarga.
  useEffect(() => {
    const aviso = leerAvisoPendiente()
    if (!aviso) return
    // El <Toaster> se monta después que la página y descarta lo que llega
    // antes de suscribirse: se emite en el siguiente ciclo.
    const t = setTimeout(() => {
      if (aviso.tipo === 'error') toast.error(aviso.msg, { duration: 10000 })
      else toast.success(aviso.msg)
    }, 150)
    return () => clearTimeout(t)
  }, [])

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)

  const readonly = dia.status === 'cerrado'
  const groups = useMemo(
    () => sortGroups(buildMovimientoGroups(dia.movimientos_diarios), sort),
    [dia.movimientos_diarios, sort],
  )
  const q = search.trim()
  const visibles = q ? groups.filter((g) => matchesSearch(g.searchText, q)).length : groups.length

  // Primer toque: nombre A-Z, números de mayor a menor. Segundo toque: invierte.
  function handleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'name' ? 'asc' : 'desc' },
    )
  }

  // Lo tipeado tiene que llegar a la base antes de cerrar o traer stock. Si
  // algo no se pudo guardar, la acción se frena.
  async function asegurarGuardado(accion: string): Promise<boolean> {
    let fallidos: string[]
    try {
      fallidos = await guardarPendientes(dia.id)
    } catch {
      fallidos = ['algunos productos']
    }
    if (fallidos.length === 0) return true
    toast.error(
      `No se pudo guardar ${fallidos.join(', ')}: ${accion}. Revisá la conexión y probá de nuevo.`,
    )
    return false
  }

  // Red de seguridad para lo tipeado:
  // - al ocultar la página (cambiar de app, bloquear el celular) se manda lo
  //   pendiente sin esperar el debounce;
  // - al volver la conexión se reintenta lo que había fallado;
  // - si se intenta cerrar o recargar la pestaña con algo sin guardar, el
  //   navegador pregunta antes de salir.
  useEffect(() => {
    const diaId = dia.id
    function alOcultar() {
      if (document.visibilityState === 'hidden') void guardarPendientes(diaId)
    }
    // Al cerrar o recargar la pestaña, pagehide llega con la página todavía
    // "visible": se manda igual.
    function alSalir() {
      void guardarPendientes(diaId)
    }
    let recargaProgramada = false
    function alGuardadoImposible(e: Event) {
      // Una sola recarga aunque varias filas reboten a la vez; el aviso se
      // muestra después de recargar.
      if (recargaProgramada) return
      recargaProgramada = true
      const msg = (e as CustomEvent<string>).detail
      guardarAvisoPendiente(
        `${msg ?? 'Hay cambios que no se guardaron'}. La pantalla se actualizó para mostrar lo que quedó guardado.`,
        'error',
      )
      window.location.reload()
    }
    // Reintento automático de lo que quedó "sin guardar".
    const reintento = setInterval(() => {
      if (hayPendientes(diaId)) void guardarPendientes(diaId)
    }, 30000)
    // Navegación dentro de la app (menú, flecha atrás, links) con algo sin
    // guardar: primero se intenta guardar y, si no se puede, se pregunta.
    function alHacerClic(e: MouseEvent) {
      if (!hayPendientes(diaId)) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return
      const destino = new URL(a.href, window.location.href)
      if (destino.origin !== window.location.origin || destino.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      void guardarPendientes(diaId).then((fallidos) => {
        if (
          fallidos.length === 0 ||
          window.confirm(
            `No se pudo guardar ${fallidos.join(', ')}. Si salís ahora se pierde. ¿Salir igual?`,
          )
        ) {
          router.push(destino.pathname + destino.search)
        }
      })
    }
    function alVolverConexion() {
      void guardarPendientes(diaId).then((fallidos) => {
        if (fallidos.length > 0) {
          toast.error(`Todavía no se pudo guardar ${fallidos.join(', ')}. Se vuelve a intentar solo en un rato.`)
        }
      })
    }
    function antesDeSalir(e: BeforeUnloadEvent) {
      if (!hayPendientes(diaId)) return
      void guardarPendientes(diaId)
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', alSalir)
    window.addEventListener('online', alVolverConexion)
    window.addEventListener('beforeunload', antesDeSalir)
    window.addEventListener(EVENTO_GUARDADO_IMPOSIBLE, alGuardadoImposible)
    document.addEventListener('click', alHacerClic, true)
    return () => {
      clearInterval(reintento)
      document.removeEventListener('click', alHacerClic, true)
      document.removeEventListener('visibilitychange', alOcultar)
      window.removeEventListener('pagehide', alSalir)
      window.removeEventListener('online', alVolverConexion)
      window.removeEventListener('beforeunload', antesDeSalir)
      window.removeEventListener(EVENTO_GUARDADO_IMPOSIBLE, alGuardadoImposible)
    }
  }, [dia.id, router])

  // La flecha "atrás" es un botón (no un link): pasa por el mismo control de
  // pendientes que la navegación por links.
  async function volverAlCalendario() {
    if (hayPendientes(dia.id)) {
      const fallidos = await guardarPendientes(dia.id)
      if (
        fallidos.length > 0 &&
        !window.confirm(`No se pudo guardar ${fallidos.join(', ')}. Si salís ahora se pierde. ¿Salir igual?`)
      ) {
        return
      }
    }
    router.push('/operacion')
  }

  function handleCerrar() {
    setLoading(true)
    startTransition(async () => {
      if (!(await asegurarGuardado('el día no se cerró'))) {
        setLoading(false)
        return
      }
      let result: Awaited<ReturnType<typeof cerrarDia>>
      try {
        result = await cerrarDia(dia.id)
      } catch {
        setLoading(false)
        toast.error('Sin conexión: no sabemos si el día se cerró. Recargá la página para ver cómo quedó.')
        return
      }
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
      if (!(await asegurarGuardado('no se trajo el stock'))) {
        setLoading(false)
        return
      }
      let result: Awaited<ReturnType<typeof traerStockDiaAnterior>>
      try {
        result = await traerStockDiaAnterior(dia.id)
      } catch {
        setLoading(false)
        toast.error('Sin conexión: no sabemos si se trajo el stock. Recargá la página para ver cómo quedó.')
        return
      }
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
          <Button variant="ghost" size="icon" onClick={volverAlCalendario} className="size-8" aria-label="Volver">
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

        <div className="flex flex-wrap gap-2">
          {dia.status === 'abierto' ? (
            <>
              <Button
                variant="outline"
                onClick={() => setReasignarOpen(true)}
                disabled={loading}
                title="Pasar ventas cargadas en un producto equivocado (ej. Genérico) al correcto"
              >
                <ArrowRightLeftIcon className="size-4" />
                Reasignar ventas
              </Button>
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

      {/* Buscador */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="pl-9"
          />
        </div>
        {q && (
          <p className="text-xs text-muted-foreground">
            {visibles} de {groups.length} productos
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COLUMNAS.map((c) => {
                const active = sort.field === c.field
                const Arrow = sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon
                const isName = c.field === 'name'
                return (
                  <th
                    key={c.field}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={isName ? 'py-2.5 pl-4 pr-2 text-left' : 'px-2 py-2.5 text-right'}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(c.field)}
                      title="Ordenar por esta columna"
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap uppercase tracking-wide hover:text-foreground',
                        active && 'text-foreground',
                      )}
                    >
                      {c.label}
                      <Arrow className={cn('size-3', !active && 'invisible')} />
                    </button>
                  </th>
                )
              })}
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
              groups.map((g) => {
                const hidden = q !== '' && !matchesSearch(g.searchText, q)
                return g.secondaries.length === 0 ? (
                  <MovimientoRow key={g.primary.id} mov={g.primary} readonly={readonly || loading} hidden={hidden} />
                ) : (
                  <MovimientoGroupRow
                    key={g.key}
                    primary={g.primary}
                    secondaries={g.secondaries}
                    name={g.name}
                    readonly={readonly || loading}
                    hidden={hidden}
                  />
                )
              })
            )}
            {groups.length > 0 && visibles === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No hay productos que coincidan con &quot;{q}&quot;.
                </td>
              </tr>
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

      {reasignarOpen && (
        <ReasignarVentasDialog
          open={reasignarOpen}
          onOpenChange={setReasignarOpen}
          diaId={dia.id}
          movimientos={dia.movimientos_diarios}
        />
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
