'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon,
  ArrowUpIcon, ArrowDownIcon, ArrowLeftRightIcon, PiggyBankIcon,
  XIcon, Trash2Icon,
} from 'lucide-react'

import { eliminarMovimientoDigital } from '../caja-mayor-actions'
import { runWithResilience, classifyNetworkError } from '@/lib/network-resilience'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EgresoDialog } from './egreso-dialog'
import { BistroCajaCard } from './bistro-caja-card'
import { CajaMayorCard } from './caja-mayor-card'
import { CuentaDigitalCard } from './cuenta-digital-card'
import { FondoEmergenciaCard } from './fondo-emergencia-card'
import { UltimoCierreTile } from './ultimo-cierre-tile'
import type { CajaMovimiento } from '../queries'
import type { BistroCajaSummary } from '../bistro-caja-queries'
import type { CajaMayorSummary, UltimoCierre } from '../caja-mayor-queries'
import type { CuentaDigitalSummary } from '../cuenta-digital-queries'
import type { FondoEmergenciaSummary } from '../fondo-emergencia-queries'
import type { MonthlyVentasSummary } from '@/features/cierres/queries'
import { METODO_LABELS } from '@/features/suppliers/schemas'
import { AJUSTE_CATEGORIA } from '../constants'

// Tono visual por método: cheque destaca en amber porque no es flujo realizado todavía.
const METODO_TONE: Record<string, string> = {
  efectivo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  transferencia: 'border-sky-200 bg-sky-50 text-sky-700',
  cheque: 'border-amber-200 bg-amber-50 text-amber-800',
  otro: 'border-gray-200 bg-gray-50 text-gray-700',
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 1) return `${y! - 1}-12`
  return `${y}-${String(mo! - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  if (mo === 12) return `${y! + 1}-01`
  return `${y}-${String(mo! + 1).padStart(2, '0')}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return `${MESES[mo! - 1]} ${y}`
}

type Props = {
  movimientos: CajaMovimiento[]
  month: string
  ventasSummary?: MonthlyVentasSummary
  // Costo del procesador digital (Mercado Pago, banco, etc.). Se descuenta
  // sobre las ventas digitales para mostrar el neto real en caja. NO es IVA:
  // el IVA digital queda en /dashboard como balanza fiscal aparte.
  costoProcesadorPct?: number
  bistroCaja?: BistroCajaSummary
  cajaMayor?: CajaMayorSummary
  ultimoCierre?: UltimoCierre
  cuentaDigital?: CuentaDigitalSummary
  cajaCategorias?: string[]
  fondoEmergencia?: FondoEmergenciaSummary
}

const BUCKET_FILTERS: { key: CajaMovimiento['bucket']; label: string; chip: string }[] = [
  { key: 'ingreso', label: 'Ingresos', chip: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' },
  { key: 'egreso', label: 'Egresos', chip: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' },
  { key: 'traspaso', label: 'Traspasos', chip: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100' },
  { key: 'ganancia_duenos', label: 'Ganancia dueños', chip: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' },
]
const ALL_CAT = '__all__'

export function CajaClient({ movimientos, month, ventasSummary, costoProcesadorPct = 0, bistroCaja, cajaMayor, ultimoCierre, cuentaDigital, cajaCategorias = [], fondoEmergencia }: Props) {
  const router = useRouter()
  const [egresoOpen, setEgresoOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()

  async function attemptDelete(id: string, desc: string, toastId: string | number): Promise<void> {
    try {
      const res = await runWithResilience(
        () => eliminarMovimientoDigital(id),
        { onRetrying: () => toast.loading('Sin señal — reintentando...', { id: toastId }) },
      )
      setDeletingId(null)
      if (res.error) { toast.error(res.error, { id: toastId }); return }
      toast.success('Movimiento eliminado', { id: toastId })
      router.refresh()
    } catch (err) {
      setDeletingId(null)
      toast.error(classifyNetworkError(err), {
        id: toastId,
        duration: 15_000,
        action: { label: 'Reintentar', onClick: () => attemptDelete(id, desc, toast.loading('Reintentando...')) },
      })
    }
  }

  function handleDelete(m: { id: string; categoria: string; descripcion: string | null; monto: number }) {
    const desc = m.descripcion || m.categoria
    if (!confirm(`Eliminar "${desc}" por ${formatCurrency(m.monto)}?`)) return
    setDeletingId(m.id)
    const toastId = toast.loading(`Eliminando "${desc}"...`)
    startDelete(() => attemptDelete(m.id, desc, toastId))
  }

  // Filtros locales sobre la lista. No tocan los KPIs del mes (Ingresos/Egresos/
  // Resultado) para que esos sigan siendo la foto mensual estable — los filtros
  // son para navegar dentro del mes, no para redefinirlo.
  const [bucketFilter, setBucketFilter] = useState<Set<CajaMovimiento['bucket']>>(new Set())
  const [categoriaFilter, setCategoriaFilter] = useState<string>(ALL_CAT)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Categorias disponibles en la lista de este mes (para el select).
  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const m of movimientos) if (m.categoria) set.add(m.categoria)
    return Array.from(set).sort()
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (bucketFilter.size > 0 && !bucketFilter.has(m.bucket)) return false
      if (categoriaFilter !== ALL_CAT && m.categoria !== categoriaFilter) return false
      if (dateFrom && m.fecha < dateFrom) return false
      if (dateTo && m.fecha > dateTo) return false
      return true
    })
  }, [movimientos, bucketFilter, categoriaFilter, dateFrom, dateTo])

  const hasFilters =
    bucketFilter.size > 0 || categoriaFilter !== ALL_CAT || dateFrom !== '' || dateTo !== ''

  function toggleBucket(key: CajaMovimiento['bucket']) {
    setBucketFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearFilters() {
    setBucketFilter(new Set())
    setCategoriaFilter(ALL_CAT)
    setDateFrom('')
    setDateTo('')
  }

  // Los totales del mes solo consideran movimientos reales (ingresos/egresos)
  // y ganancia dueños (que sale del sistema). Los traspasos POS -> caja fuerte
  // se listan como informativos pero no afectan totales — cambian de bolsillo,
  // no hay perdida ni entrada de dinero.
  // Los 'Ajuste de caja' corrigen el saldo de una cuenta (conteo real vs.
  // sistema) pero no son plata que entro o salio en el mes — excluirlos de los
  // totales para que una correccion grande no distorsione el Resultado.
  const ingresosMovimientos = movimientos
    .filter((m) => m.bucket === 'ingreso' && m.categoria !== AJUSTE_CATEGORIA)
    .reduce((s, m) => s + m.monto, 0)

  const ventasTotal = ventasSummary?.total ?? 0
  const totalIngresos = ingresosMovimientos + ventasTotal

  const totalEgresos = movimientos
    .filter((m) => (m.bucket === 'egreso' || m.bucket === 'ganancia_duenos') && m.categoria !== AJUSTE_CATEGORIA)
    .reduce((s, m) => s + m.monto, 0)

  const saldo = totalIngresos - totalEgresos
  const digitalBruto = ventasSummary?.digital ?? 0
  const digitalCostoProcesador = costoProcesadorPct > 0 ? digitalBruto * (costoProcesadorPct / 100) : 0
  const digitalNeto = digitalBruto - digitalCostoProcesador

  function navigate(newMonth: string) {
    router.push(`/caja?month=${newMonth}`)
  }

  const today = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(prevMonth(month))}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="flex-1 text-center text-base font-semibold sm:w-40 sm:flex-none">{monthLabel(month)}</h2>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => navigate(nextMonth(month))}
            disabled={month >= today}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Button onClick={() => setEgresoOpen(true)} className="sm:shrink-0">
          <PlusIcon className="size-4" />
          Registrar egreso
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos</p>
          <p className="mt-1 tabular-nums font-semibold text-green-700 text-2xl sm:text-3xl">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Egresos</p>
          <p className="mt-1 tabular-nums font-semibold text-red-600 text-2xl sm:text-3xl">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Resultado</p>
          <p className={`mt-1 tabular-nums font-semibold text-2xl sm:text-3xl ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
      </div>

      {/* Cuentas: Ultimo cierre + Cuenta Digital + Caja Mayor + Fondo emergencia */}
      {(ultimoCierre !== undefined || cajaMayor || cuentaDigital || fondoEmergencia) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ultimoCierre !== undefined && <UltimoCierreTile ultimo={ultimoCierre} />}
          {cuentaDigital && <CuentaDigitalCard summary={cuentaDigital} />}
          {cajaMayor && <CajaMayorCard summary={cajaMayor} month={month} categorias={cajaCategorias} />}
          {fondoEmergencia && <FondoEmergenciaCard summary={fondoEmergencia} categorias={cajaCategorias} />}
        </div>
      )}

      {/* Caja efectivo Bistro (solo si hay aperturas/cierres del mes) */}
      {bistroCaja && <BistroCajaCard summary={bistroCaja} />}

      {/* Ventas del mes (cierres) */}
      {ventasTotal > 0 && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ventas del mes</p>
            {ventasSummary && ventasSummary.count > 0 && (
              <span className="text-xs text-muted-foreground">{ventasSummary.count} cierre{ventasSummary.count !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efectivo</span>
              <span className="tabular-nums">{formatCurrency(ventasSummary?.efectivo ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medios digitales (bruto)</span>
              <span className="tabular-nums">{formatCurrency(digitalBruto)}</span>
            </div>
            {costoProcesadorPct > 0 && digitalBruto > 0 && (
              <>
                <div className="flex justify-between text-red-600 pl-3">
                  <span>− Costo procesador ({costoProcesadorPct}%)</span>
                  <span className="tabular-nums">− {formatCurrency(digitalCostoProcesador)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground pl-3">
                  <span>Neto digital</span>
                  <span className="tabular-nums">{formatCurrency(digitalNeto)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold pt-1.5 border-t">
              <span>Total ventas</span>
              <span className="tabular-nums text-green-700">
                {formatCurrency(costoProcesadorPct > 0 ? (ventasSummary?.efectivo ?? 0) + digitalNeto : ventasTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {BUCKET_FILTERS.map((b) => {
            const active = bucketFilter.has(b.key)
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => toggleBucket(b.key)}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
                  active
                    ? b.chip.replace('hover:', '') + ' ring-2 ring-offset-1 ring-current/20'
                    : 'border-gray-200 bg-white text-muted-foreground hover:bg-gray-50',
                )}
                aria-pressed={active}
              >
                {b.label}
              </button>
            )
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 text-xs text-muted-foreground hover:bg-gray-50"
            >
              <XIcon className="size-3" />
              Limpiar
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-muted-foreground shrink-0">Categoría</label>
            <Select value={categoriaFilter} onValueChange={(v) => setCategoriaFilter(v ?? ALL_CAT)}>
              <SelectTrigger className="h-8 flex-1 min-w-0">
                <SelectValue>
                  {(v: string | null) => (v === ALL_CAT || !v ? 'Todas' : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CAT} label="Todas">Todas</SelectItem>
                {categoriasDisponibles.map((c) => (
                  <SelectItem key={c} value={c} label={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[9.5rem]"
            />
            <label className="text-xs text-muted-foreground shrink-0">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[9.5rem]"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-card divide-y text-sm overflow-hidden">
        {movimientos.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            Sin movimientos en {monthLabel(month)}.
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No hay movimientos que coincidan con los filtros.
          </div>
        ) : (
          movimientosFiltrados.map((m) => {
            // Tono e icono por bucket. Traspaso (POS -> caja fuerte) va con
            // arrow left-right en neutro. Ganancia duenos va con PiggyBank
            // en purpura (queda fuera del sistema). Ingreso/egreso normales
            // se pintan como antes con up/down verde/rojo.
            const bucketStyle: Record<typeof m.bucket, { bg: string; icon: React.ReactNode; badge: string; sign: string }> = {
              ingreso: {
                bg: 'bg-green-100',
                icon: <ArrowUpIcon className="size-3.5 text-green-700" />,
                badge: 'border-green-200 bg-green-50 text-green-700',
                sign: '+',
              },
              egreso: {
                bg: 'bg-red-100',
                icon: <ArrowDownIcon className="size-3.5 text-red-600" />,
                badge: 'border-red-200 bg-red-50 text-red-600',
                sign: '−',
              },
              traspaso: {
                bg: 'bg-slate-100',
                icon: <ArrowLeftRightIcon className="size-3.5 text-slate-600" />,
                badge: 'border-slate-200 bg-slate-50 text-slate-600',
                sign: '↔',
              },
              ganancia_duenos: {
                bg: 'bg-purple-100',
                icon: <PiggyBankIcon className="size-3.5 text-purple-700" />,
                badge: 'border-purple-200 bg-purple-50 text-purple-700',
                sign: '−',
              },
            }
            const style = bucketStyle[m.bucket]
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-1 ${style.bg}`}>{style.icon}</div>
                  <div>
                    <p className="font-medium">{m.categoria}</p>
                    {m.descripcion && <p className="text-xs text-muted-foreground">{m.descripcion}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(m.fecha)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.metodo && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums',
                        m.metodo === 'cheque' && m.cleared_at
                          ? METODO_TONE.efectivo
                          : METODO_TONE[m.metodo] ?? METODO_TONE.otro,
                      )}
                    >
                      {METODO_LABELS[m.metodo] ?? m.metodo}
                      {m.metodo === 'cheque' && m.cleared_at
                        ? ` · cobrado ${formatDateShort(m.cleared_at)}`
                        : m.metodo === 'cheque' && m.due_date
                          ? ` · vence ${formatDateShort(m.due_date)}`
                          : null}
                    </Badge>
                  )}
                  <Badge variant="outline" className={style.badge}>
                    {style.sign} {formatCurrency(m.monto)}
                  </Badge>
                  {m.eliminable && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id && isDeleting}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      aria-label="Eliminar movimiento"
                      title="Eliminar movimiento"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <EgresoDialog open={egresoOpen} onOpenChange={setEgresoOpen} />
    </div>
  )
}
