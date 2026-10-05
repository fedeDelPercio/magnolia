import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type Empleado = Tables<'empleados'>
export type EmpleadoHorario = Tables<'empleado_horarios'>
export type EmpleadoVacacion = Tables<'empleado_vacaciones'>
export type EmpleadoAusencia = Tables<'empleado_ausencias'>
export type EmpleadoLiquidacion = Tables<'empleado_liquidaciones'>
export type EmpleadoDescuento = Tables<'empleado_descuentos'> & {
  productos: { name: string } | null
  // Fecha de la liquidación en que se descontó (si ya se aplicó).
  liquidacion: { fecha_desde: string } | null
}
export type EmpleadoTardanza = Tables<'empleado_tardanzas'>

export type EmpleadoListItem = Empleado & {
  dias_vacaciones_tomados: number
  dias_vacaciones_restantes: number
}

export type EmpleadoDetalle = {
  empleado: Empleado
  horarios: EmpleadoHorario[]
  vacaciones: EmpleadoVacacion[]
  ausencias: EmpleadoAusencia[]
  liquidaciones: EmpleadoLiquidacion[]
  descuentos: EmpleadoDescuento[]
  tardanzas: EmpleadoTardanza[]
  dias_vacaciones_tomados: number
  dias_vacaciones_restantes: number
}

function diffDaysInclusive(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  const a = new Date(y1!, m1! - 1, d1!).getTime()
  const b = new Date(y2!, m2! - 1, d2!).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1
}

function totalDiasVacacionesDelAño(vacaciones: EmpleadoVacacion[], año: number): number {
  // Las canceladas no descuentan días del año.
  return vacaciones
    .filter((v) => !v.cancelada)
    .filter((v) => v.fecha_desde.startsWith(String(año)) || v.fecha_hasta.startsWith(String(año)))
    .reduce((acc, v) => acc + diffDaysInclusive(v.fecha_desde, v.fecha_hasta), 0)
}

export async function getEmpleados(opts: { incluirInactivos?: boolean } = {}): Promise<EmpleadoListItem[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  let query = supabase
    .from('empleados')
    .select('*, empleado_vacaciones(fecha_desde, fecha_hasta, cancelada)')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  if (!opts.incluirInactivos) query = query.eq('activo', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const año = new Date().getFullYear()
  return (data ?? []).map(({ empleado_vacaciones, ...emp }) => {
    const vacs = (empleado_vacaciones ?? []) as Pick<EmpleadoVacacion, 'fecha_desde' | 'fecha_hasta' | 'cancelada'>[]
    const tomados = totalDiasVacacionesDelAño(vacs as EmpleadoVacacion[], año)
    const restantes = Math.max(0, emp.vacaciones_dias_anuales - tomados)
    return {
      ...(emp as Empleado),
      dias_vacaciones_tomados: tomados,
      dias_vacaciones_restantes: restantes,
    }
  })
}

export async function getEmpleado(id: string): Promise<EmpleadoDetalle | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()
  if (error || !empleado) return null

  // Descuentos y llegadas tarde: todo lo pendiente + lo resuelto de los últimos
  // 120 días (el historial viejo no aporta en la ficha).
  const desde120 = isoDaysAgo(120)
  const [horariosRes, vacacionesRes, ausenciasRes, liquidacionesRes, descuentosRes, tardanzasRes] = await Promise.all([
    supabase.from('empleado_horarios').select('*').eq('empleado_id', id).order('dow'),
    supabase
      .from('empleado_vacaciones')
      .select('*')
      .eq('empleado_id', id)
      .order('fecha_desde', { ascending: false }),
    supabase
      .from('empleado_ausencias')
      .select('*')
      .eq('empleado_id', id)
      .gte('fecha', isoDaysAgo(60))
      .order('fecha', { ascending: false }),
    supabase
      .from('empleado_liquidaciones')
      .select('*')
      .eq('empleado_id', id)
      .order('fecha_desde', { ascending: false })
      .limit(6),
    supabase
      .from('empleado_descuentos')
      .select('*, productos(name), liquidacion:empleado_liquidaciones!empleado_descuentos_liquidacion_id_fkey(fecha_desde)')
      .eq('empleado_id', id)
      .or(`liquidacion_id.is.null,fecha.gte.${desde120}`)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('empleado_tardanzas')
      .select('*')
      .eq('empleado_id', id)
      .or(`recuperada.eq.false,fecha.gte.${desde120}`)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  if (descuentosRes.error) throw new Error(descuentosRes.error.message)
  if (tardanzasRes.error) throw new Error(tardanzasRes.error.message)

  const año = new Date().getFullYear()
  const vacaciones = vacacionesRes.data ?? []
  const tomados = totalDiasVacacionesDelAño(vacaciones, año)
  const restantes = Math.max(0, empleado.vacaciones_dias_anuales - tomados)

  return {
    empleado,
    horarios: horariosRes.data ?? [],
    vacaciones,
    ausencias: ausenciasRes.data ?? [],
    liquidaciones: liquidacionesRes.data ?? [],
    descuentos: (descuentosRes.data ?? []) as unknown as EmpleadoDescuento[],
    tardanzas: tardanzasRes.data ?? [],
    dias_vacaciones_tomados: tomados,
    dias_vacaciones_restantes: restantes,
  }
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Estimación del costo mensual de sueldos del tenant: para cada empleado activo, cuenta los días
 * programados del mes (según horarios) × sueldo_diario + plus_mensual.
 * Es una estimación bruta (no contempla ausencias futuras, vacaciones, etc.).
 */
export async function getCostoMensualEstimado(month: string): Promise<{ total: number; count: number }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('empleados')
    .select('id, sueldo_diario, plus_mensual, empleado_horarios(dow)')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
  if (error) throw new Error(error.message)

  const [year, mon] = month.split('-').map(Number)
  const diasMes = new Date(year!, mon!, 0).getDate()

  let total = 0
  for (const emp of data ?? []) {
    const dows = new Set(((emp.empleado_horarios ?? []) as { dow: number }[]).map((h) => h.dow))
    let diasProgramados = 0
    for (let d = 1; d <= diasMes; d++) {
      const dow = new Date(year!, mon! - 1, d).getDay()
      if (dows.has(dow)) diasProgramados++
    }
    total += diasProgramados * Number(emp.sueldo_diario) + Number(emp.plus_mensual)
  }

  return { total, count: (data ?? []).length }
}

// ---- Vistas globales ------------------------------------------------------

export type VacacionConEmpleado = EmpleadoVacacion & {
  empleado_name: string
  empleado_activo: boolean
}

/**
 * Trae todas las vacaciones del tenant para mostrar el panorama global.
 * Filtros opcionales: por año (matchea fecha_desde o fecha_hasta) y por empleado.
 */
export async function getTodasVacaciones(opts: { año?: number; empleadoId?: string } = {}): Promise<VacacionConEmpleado[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  let query = supabase
    .from('empleado_vacaciones')
    .select('*, empleados!inner(name, activo)')
    .eq('tenant_id', tenantId)
    .order('fecha_desde', { ascending: true })

  if (opts.empleadoId) query = query.eq('empleado_id', opts.empleadoId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let rows = (data ?? []).map((r) => {
    const row = r as unknown as EmpleadoVacacion & {
      empleados: { name: string; activo: boolean } | null
    }
    return {
      ...row,
      empleado_name: row.empleados?.name ?? '—',
      empleado_activo: row.empleados?.activo ?? false,
    } as VacacionConEmpleado
  })

  if (opts.año !== undefined) {
    const y = String(opts.año)
    rows = rows.filter((v) => v.fecha_desde.startsWith(y) || v.fecha_hasta.startsWith(y))
  }

  return rows
}

export type EmpleadoConHorarios = Empleado & {
  horarios: EmpleadoHorario[]
}

/**
 * Para la vista de horarios global: todos los empleados activos con su grilla L-D.
 */
export async function getHorariosAllEmpleados(): Promise<EmpleadoConHorarios[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('empleados')
    .select('*, empleado_horarios(*)')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map(({ empleado_horarios, ...emp }) => ({
    ...(emp as Empleado),
    horarios: (empleado_horarios ?? []) as EmpleadoHorario[],
  }))
}

export type AusenciaConEmpleado = EmpleadoAusencia & {
  empleado_name: string
}

/**
 * Trae las ausencias de un mes (formato 'YYYY-MM').
 */
export async function getAusenciasMes(month: string): Promise<AusenciaConEmpleado[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('empleado_ausencias')
    .select('*, empleados!inner(name)')
    .eq('tenant_id', tenantId)
    .gte('fecha', from)
    .lt('fecha', nextMonth)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => {
    const row = r as unknown as EmpleadoAusencia & { empleados: { name: string } | null }
    return { ...row, empleado_name: row.empleados?.name ?? '—' } as AusenciaConEmpleado
  })
}

/** Lista compacta para selectores. */
export async function getEmpleadosOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('empleados')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Para hidratar el nombre del empleado en /caja cuando ref_kind='liquidacion_empleado'. */
export async function getEmpleadosNamesByIds(
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('empleado_liquidaciones')
    .select('id, empleados(name)')
    .in('id', ids)
  if (error) return new Map()
  const out = new Map<string, string>()
  for (const r of data ?? []) {
    const emp = (r as unknown as { id: string; empleados: { name: string } | null }).empleados
    if (emp) out.set((r as { id: string }).id, emp.name)
  }
  return out
}

// ---- Descuentos y llegadas tarde ------------------------------------------

/** Productos para el selector del descuento por desperdicio, con su costo por
 *  unidad (para sugerir el monto). Solo la variante base de cada producto. */
export type ProductoConCosto = { id: string; name: string; costo: number }

export async function getProductosConCosto(): Promise<ProductoConCosto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const [prodRes, costRes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, name, canal, formato, concepto_id')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('name'),
    supabase.from('product_costs').select('id, total_cost').eq('tenant_id', tenantId),
  ])
  if (prodRes.error) throw new Error(prodRes.error.message)
  const costos = new Map((costRes.data ?? []).map((c) => [c.id as string, Number(c.total_cost) || 0]))
  const productos = prodRes.data ?? []
  // Si la base no tiene costo (platos del día: la receta está en la variante
  // Menú), se usa el de otra variante del mismo producto.
  const costoVariante = new Map<string, number>()
  for (const p of productos) {
    if (!p.concepto_id) continue
    const c = costos.get(p.id) ?? 0
    if (c > (costoVariante.get(p.concepto_id) ?? 0)) costoVariante.set(p.concepto_id, c)
  }
  return productos
    .filter((p) => p.canal === null && p.formato !== 'menu')
    .map((p) => {
      const propio = costos.get(p.id) ?? 0
      const costo = propio > 0 ? propio : p.concepto_id ? (costoVariante.get(p.concepto_id) ?? 0) : 0
      return { id: p.id, name: p.name, costo }
    })
}

export type TardanzaConEmpleado = EmpleadoTardanza & { empleado_name: string }

/** Llegadas tarde de un mes ('YYYY-MM') + las pendientes de recuperar de antes. */
export async function getTardanzasMes(month: string): Promise<TardanzaConEmpleado[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('empleado_tardanzas')
    .select('*, empleados!inner(name)')
    .eq('tenant_id', tenantId)
    .lt('fecha', nextMonth)
    .or(`fecha.gte.${from},recuperada.eq.false`)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => {
    const row = r as unknown as EmpleadoTardanza & { empleados: { name: string } | null }
    return { ...row, empleado_name: row.empleados?.name ?? '—' } as TardanzaConEmpleado
  })
}
