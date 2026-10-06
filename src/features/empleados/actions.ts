'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { calcularLiquidacion } from './lib/calculo'
import { hoyISO } from '@/lib/fecha'
import { aplicarDescuentosAlPlus, type AplicacionDescuentos } from './lib/descuentos-plus'
import type {
  EmpleadoFormValues,
  HorarioFormValues,
  VacacionFormValues,
  AusenciaFormValues,
  DescuentoFormValues,
  TardanzaFormValues,
} from './schemas'
import { descuentoSchema, tardanzaSchema } from './schemas'

type Supabase = Awaited<ReturnType<typeof createClient>>

// ---- Empleados -------------------------------------------------------------

export async function createEmpleado(values: EmpleadoFormValues): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('empleados')
    .insert({
      tenant_id: tenantId,
      name: values.name,
      fecha_ingreso: values.fecha_ingreso || null,
      sueldo_diario: values.sueldo_diario,
      plus_mensual: values.plus_mensual,
      aguinaldo_estimado: values.aguinaldo_estimado,
      vacaciones_dias_anuales: values.vacaciones_dias_anuales,
      activo: values.activo,
      notas: values.notas || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/empleados')
  return { id: data.id }
}

export async function updateEmpleado(
  id: string,
  values: EmpleadoFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('empleados')
    .update({
      name: values.name,
      fecha_ingreso: values.fecha_ingreso || null,
      sueldo_diario: values.sueldo_diario,
      plus_mensual: values.plus_mensual,
      aguinaldo_estimado: values.aguinaldo_estimado,
      vacaciones_dias_anuales: values.vacaciones_dias_anuales,
      activo: values.activo,
      notas: values.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/empleados')
  revalidatePath(`/empleados/${id}`)
  return {}
}

export async function toggleEmpleadoActivo(id: string, activo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('empleados').update({ activo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/empleados')
  revalidatePath(`/empleados/${id}`)
  return {}
}

// ---- Horarios --------------------------------------------------------------

export async function saveHorario(
  empleadoId: string,
  horarios: HorarioFormValues[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error: delErr } = await supabase
    .from('empleado_horarios')
    .delete()
    .eq('empleado_id', empleadoId)
  if (delErr) return { error: delErr.message }

  if (horarios.length > 0) {
    const { error: insErr } = await supabase.from('empleado_horarios').insert(
      horarios.map((h) => ({
        empleado_id: empleadoId,
        tenant_id: tenantId,
        dow: h.dow,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
      })),
    )
    if (insErr) return { error: insErr.message }
  }

  revalidatePath(`/empleados/${empleadoId}`)
  return {}
}

// ---- Vacaciones ------------------------------------------------------------

export async function createVacacion(
  empleadoId: string,
  values: VacacionFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('empleado_vacaciones').insert({
    empleado_id: empleadoId,
    tenant_id: tenantId,
    fecha_desde: values.fecha_desde,
    fecha_hasta: values.fecha_hasta,
    notas: values.notas || null,
  })
  if (error) return { error: error.message }

  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados')
  return {}
}

export async function deleteVacacion(id: string, empleadoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('empleado_vacaciones').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados')
  revalidatePath('/empleados/vacaciones')
  return {}
}

/** Cancela o reactiva una toma de vacaciones (sin borrarla — queda en el historial). */
export async function toggleVacacionCancelada(
  id: string,
  cancelada: boolean,
  empleadoId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('empleado_vacaciones')
    .update({ cancelada })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados')
  revalidatePath('/empleados/vacaciones')
  return {}
}

// ---- Ausencias -------------------------------------------------------------

export async function createAusencia(
  empleadoId: string,
  values: AusenciaFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('empleado_ausencias').insert({
    empleado_id: empleadoId,
    tenant_id: tenantId,
    fecha: values.fecha,
    tipo: values.tipo,
    paga: values.paga,
    notas: values.notas || null,
  })
  if (error) {
    if (error.message.includes('unique')) {
      return { error: 'Ya hay una ausencia registrada para esa fecha' }
    }
    return { error: error.message }
  }

  revalidatePath(`/empleados/${empleadoId}`)
  return {}
}

export async function deleteAusencia(id: string, empleadoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('empleado_ausencias').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  return {}
}

// ---- Liquidaciones ---------------------------------------------------------

export type LiquidacionPreviewItem = {
  empleado_id: string
  name: string
  dias_programados: number
  dias_trabajados: number
  dias_ausentes_pagos: number
  monto_sueldo: number
  /** Plus neto (ya descontado). */
  monto_plus: number
  /** Lo que se descontó del plus por desperdicio u otros faltantes. */
  monto_descuentos: number
  monto_total: number
  descuentos: AplicacionDescuentos
}

export type LiquidacionPreview = {
  items: LiquidacionPreviewItem[]
  total: number
}

export async function previewLiquidacion(opts: {
  fecha_desde: string
  fecha_hasta: string
  incluir_plus: boolean
  empleado_id?: string
}): Promise<{ data?: LiquidacionPreview; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  let empQuery = supabase
    .from('empleados')
    .select(`
      id, name, sueldo_diario, plus_mensual,
      empleado_horarios(dow),
      empleado_vacaciones(fecha_desde, fecha_hasta, cancelada),
      empleado_ausencias(fecha, paga)
    `)
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('name')

  if (opts.empleado_id) empQuery = empQuery.eq('id', opts.empleado_id)

  const { data, error } = await empQuery
  if (error) return { error: error.message }

  const pendientesPorEmpleado = opts.incluir_plus
    ? await getDescuentosPendientes(supabase, (data ?? []).map((e) => e.id))
    : new Map<string, { id: string; fecha: string; monto: number }[]>()

  const items: LiquidacionPreviewItem[] = []
  let total = 0

  for (const emp of data ?? []) {
    const horarios = (emp.empleado_horarios ?? []) as { dow: number }[]
    // Las vacaciones canceladas no descuentan ni pagan días — se ignoran.
    const vacaciones = ((emp.empleado_vacaciones ?? []) as { fecha_desde: string; fecha_hasta: string; cancelada: boolean }[])
      .filter((v) => !v.cancelada)
      .map((v) => ({ fecha_desde: v.fecha_desde, fecha_hasta: v.fecha_hasta }))
    const ausencias = (emp.empleado_ausencias ?? []).filter(
      (a) => a.fecha >= opts.fecha_desde && a.fecha <= opts.fecha_hasta,
    ) as { fecha: string; paga: boolean }[]

    const calc = calcularLiquidacion({
      empleado: {
        sueldo_diario: Number(emp.sueldo_diario),
        plus_mensual: Number(emp.plus_mensual),
      },
      horarios,
      vacaciones,
      ausencias,
      fecha_desde: opts.fecha_desde,
      fecha_hasta: opts.fecha_hasta,
      incluir_plus: opts.incluir_plus,
    })

    const descuentos = aplicarDescuentosAlPlus(
      calc.monto_plus,
      pendientesPorEmpleado.get(emp.id) ?? [],
      opts.fecha_hasta,
    )
    const montoTotal = Math.round((calc.monto_sueldo + descuentos.plusNeto) * 100) / 100
    items.push({
      empleado_id: emp.id,
      name: emp.name,
      dias_programados: calc.dias_programados,
      dias_trabajados: calc.dias_trabajados,
      dias_ausentes_pagos: calc.dias_ausentes_pagos,
      monto_sueldo: calc.monto_sueldo,
      monto_plus: descuentos.plusNeto,
      monto_descuentos: descuentos.aplicado,
      monto_total: montoTotal,
      descuentos,
    })
    total += montoTotal
  }

  return { data: { items, total } }
}

export async function confirmarLiquidacion(opts: {
  fecha_desde: string
  fecha_hasta: string
  incluir_plus: boolean
  generar_egreso: boolean
  empleado_ids?: string[]
}): Promise<{ error?: string; count?: number }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const preview = await previewLiquidacion({
    fecha_desde: opts.fecha_desde,
    fecha_hasta: opts.fecha_hasta,
    incluir_plus: opts.incluir_plus,
  })
  if (preview.error || !preview.data) return { error: preview.error ?? 'Error al calcular' }

  const items = opts.empleado_ids
    ? preview.data.items.filter((i) => opts.empleado_ids!.includes(i.empleado_id))
    : preview.data.items

  let count = 0
  for (const item of items) {
    if (item.monto_total <= 0) continue

    const { data: liq, error: liqErr } = await supabase
      .from('empleado_liquidaciones')
      .insert({
        empleado_id: item.empleado_id,
        tenant_id: tenantId,
        fecha_desde: opts.fecha_desde,
        fecha_hasta: opts.fecha_hasta,
        dias_programados: item.dias_programados,
        dias_trabajados: item.dias_trabajados,
        dias_ausentes_pagos: item.dias_ausentes_pagos,
        monto_sueldo: item.monto_sueldo,
        monto_plus: item.monto_plus,
        monto_descuentos: item.monto_descuentos,
      })
      .select('id')
      .single()
    if (liqErr) return { error: `${item.name}: ${liqErr.message}` }

    let montoTotal = item.monto_total
    if (item.descuentos.ids.length > 0) {
      const vinc = await vincularDescuentos(supabase, tenantId, item.empleado_id, liq.id, item.descuentos, opts.fecha_hasta)
      if (vinc.error || !vinc.aplicados) {
        // Mismo criterio que el pago diario: sin vínculo no hay descuento.
        const plusBruto = item.monto_plus + item.monto_descuentos
        montoTotal = Math.round((item.monto_sueldo + plusBruto) * 100) / 100
        await supabase
          .from('empleado_liquidaciones')
          .update({ monto_plus: plusBruto, monto_descuentos: 0 })
          .eq('id', liq.id)
      }
    }

    if (opts.generar_egreso) {
      const { data: mov, error: movErr } = await supabase
        .from('caja_movimientos')
        .insert({
          tenant_id: tenantId,
          fecha: opts.fecha_hasta,
          tipo: 'egreso',
          categoria: 'Sueldos',
          monto: montoTotal,
          descripcion:
            montoTotal < item.monto_sueldo + item.monto_plus + item.monto_descuentos - 0.009
              ? `Sueldo de ${item.name} (${opts.fecha_desde} a ${opts.fecha_hasta}), plus con descuentos`
              : `Sueldo de ${item.name} (${opts.fecha_desde} a ${opts.fecha_hasta})`,
          ref_kind: 'liquidacion_empleado',
          ref_id: liq.id,
        })
        .select('id')
        .single()
      if (movErr) return { error: `${item.name}: egreso ${movErr.message}` }

      await supabase
        .from('empleado_liquidaciones')
        .update({ caja_movimiento_id: mov.id })
        .eq('id', liq.id)
    }
    count++
  }

  revalidatePath('/empleados')
  revalidatePath('/caja')
  revalidatePath('/dashboard')
  return { count }
}

export async function deleteLiquidacion(id: string, empleadoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Si el plus de esta liquidación generó un arrastre de descuentos y ese
  // arrastre ya se descontó en un plus posterior, borrarla haría descontar dos
  // veces (los originales vuelven a pendiente y el arrastre se borra, pero la
  // otra liquidación ya lo cobró). Hay que borrar primero la posterior.
  const { data: arrastres } = await supabase
    .from('empleado_descuentos')
    .select('id, liquidacion:empleado_liquidaciones!empleado_descuentos_liquidacion_id_fkey(fecha_desde)')
    .eq('origen_liquidacion_id', id)
    .not('liquidacion_id', 'is', null)
  if (arrastres && arrastres.length > 0) {
    const fecha = (arrastres[0] as unknown as { liquidacion: { fecha_desde: string } | null }).liquidacion?.fecha_desde
    return {
      error: `No se puede borrar: el saldo de descuentos que dejó este plus ya se descontó en el pago del ${fecha ?? 'mes siguiente'}. Borrá primero ese pago.`,
    }
  }

  // Buscar mov asociado primero para borrarlo también.
  const { data: liq } = await supabase
    .from('empleado_liquidaciones')
    .select('caja_movimiento_id')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('empleado_liquidaciones').delete().eq('id', id)
  if (error) return { error: error.message }

  if (liq?.caja_movimiento_id) {
    await supabase.from('caja_movimientos').delete().eq('id', liq.caja_movimiento_id)
  }

  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/caja')
  return {}
}

// ---- Pago diario automático -----------------------------------------------
// Modelo: en Magnolia se le paga al personal en mano cada día. Cuando se cierra
// un día en /operacion, generamos un egreso por cada empleado que tenía horario
// ese día y que no tiene una ausencia no paga. El plus mensual se incluye en el
// primer pago del mes para cada empleado.

export async function generarPagosDelDia(diaId: string): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data: dia, error: diaErr } = await supabase
    .from('dias_operativos')
    .select('id, fecha, tenant_id')
    .eq('id', diaId)
    .single()
  if (diaErr || !dia) return { count: 0, error: diaErr?.message ?? 'Día no encontrado' }
  if (dia.tenant_id !== tenantId) return { count: 0, error: 'No autorizado' }

  const fecha = dia.fecha as string
  // Local-safe parse (mismo patrón que el resto del repo)
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y!, m! - 1, d!).getDay()
  const mesActual = fecha.slice(0, 7)

  const { data: empleados, error: empErr } = await supabase
    .from('empleados')
    .select(`
      id, name, sueldo_diario, plus_mensual,
      empleado_horarios(dow),
      empleado_vacaciones(fecha_desde, fecha_hasta, cancelada),
      empleado_ausencias(fecha, paga)
    `)
    .eq('tenant_id', tenantId)
    .eq('activo', true)
  if (empErr) return { count: 0, error: empErr.message }

  let count = 0

  for (const emp of empleados ?? []) {
    // 1. ¿Trabaja este dow?
    const horarios = (emp.empleado_horarios ?? []) as { dow: number }[]
    if (!horarios.some((h) => h.dow === dow)) continue

    // 2. ¿Hay ausencia/vacación que define si se paga?
    const ausenciaDelDia = ((emp.empleado_ausencias ?? []) as { fecha: string; paga: boolean }[])
      .find((a) => a.fecha === fecha)
    const enVacaciones = ((emp.empleado_vacaciones ?? []) as { fecha_desde: string; fecha_hasta: string; cancelada: boolean }[])
      .some((v) => !v.cancelada && fecha >= v.fecha_desde && fecha <= v.fecha_hasta)

    // Vacaciones siempre se pagan; ausencia respeta su flag paga; sin nada → trabajó y se paga.
    const sePaga = enVacaciones || !ausenciaDelDia || ausenciaDelDia.paga
    if (!sePaga) continue

    // 3. Idempotencia: si ya hay liquidación de 1 día para esta fecha, skip.
    const { data: existing } = await supabase
      .from('empleado_liquidaciones')
      .select('id')
      .eq('empleado_id', emp.id)
      .eq('fecha_desde', fecha)
      .eq('fecha_hasta', fecha)
      .maybeSingle()
    if (existing) continue

    // 4. ¿Va plus mensual? Solo si todavía no se pagó en este mes y el empleado lo tiene > 0.
    // "Ya se pagó" incluye el caso en que los descuentos se comieron todo el
    // plus (monto_plus = 0 pero monto_descuentos > 0): si no, se volvería a
    // pagar al día siguiente.
    let plusAPagar = 0
    if (Number(emp.plus_mensual) > 0) {
      const { data: liqsConPlus, error: plusErr } = await supabase
        .from('empleado_liquidaciones')
        .select('id')
        .eq('empleado_id', emp.id)
        .gte('fecha_desde', `${mesActual}-01`)
        .lt('fecha_desde', mesActual === '2099-12' ? '2999-01-01' : nextMonthFirstDay(mesActual))
        .or('monto_plus.gt.0,monto_descuentos.gt.0')
        .limit(1)
      // Si no se puede saber si ya se pagó, no se paga ahora: se paga con el
      // próximo día que se cierre (pagarlo dos veces sería peor).
      if (!plusErr && (liqsConPlus ?? []).length === 0) {
        plusAPagar = Number(emp.plus_mensual)
      }
    }

    // 4b. Desperdicio u otros faltantes del empleado: se descuentan del plus.
    const descuentos = plusAPagar > 0
      ? aplicarDescuentosAlPlus(
          plusAPagar,
          (await getDescuentosPendientes(supabase, [emp.id])).get(emp.id) ?? [],
          fecha,
        )
      : null
    const plusNeto = descuentos ? descuentos.plusNeto : 0

    const sueldo = Number(emp.sueldo_diario)
    const trabajado = ausenciaDelDia ? 0 : enVacaciones ? 0 : 1
    const ausentePago = (ausenciaDelDia?.paga ? 1 : 0)

    // 5. Crear liquidación
    const { data: liq, error: liqErr } = await supabase
      .from('empleado_liquidaciones')
      .insert({
        empleado_id: emp.id,
        tenant_id: tenantId,
        fecha_desde: fecha,
        fecha_hasta: fecha,
        dias_programados: 1,
        dias_trabajados: trabajado,
        dias_ausentes_pagos: ausentePago,
        monto_sueldo: sueldo,
        monto_plus: plusNeto,
        monto_descuentos: descuentos?.aplicado ?? 0,
      })
      .select('id')
      .single()
    if (liqErr || !liq) continue

    let plusPagado = plusNeto
    if (descuentos && descuentos.ids.length > 0) {
      const vinc = await vincularDescuentos(supabase, tenantId, emp.id, liq.id, descuentos, fecha)
      if (vinc.error || !vinc.aplicados) {
        // No quedaron vinculados (error, o un cierre en paralelo los tomó):
        // se paga el plus entero y los descuentos siguen pendientes para el
        // próximo plus. Así nunca se descuenta sin dejar registro.
        plusPagado = plusAPagar
        await supabase
          .from('empleado_liquidaciones')
          .update({ monto_plus: plusAPagar, monto_descuentos: 0 })
          .eq('id', liq.id)
      }
    }

    // 6. Egreso en caja
    const descripcion = plusAPagar > 0
      ? plusPagado < plusAPagar
        ? `Sueldo de ${emp.name} + plus mensual (con descuentos)`
        : `Sueldo de ${emp.name} + plus mensual`
      : enVacaciones
        ? `Sueldo de ${emp.name} (vacaciones)`
        : ausenciaDelDia?.paga
          ? `Sueldo de ${emp.name} (${ausenciaDelDia.fecha === fecha ? 'feriado/licencia' : 'día pago'})`
          : `Sueldo de ${emp.name}`

    const { data: mov } = await supabase
      .from('caja_movimientos')
      .insert({
        tenant_id: tenantId,
        fecha,
        tipo: 'egreso',
        categoria: 'Sueldos',
        monto: sueldo + plusPagado,
        descripcion,
        ref_kind: 'liquidacion_empleado',
        ref_id: liq.id,
      })
      .select('id')
      .single()

    if (mov) {
      await supabase
        .from('empleado_liquidaciones')
        .update({ caja_movimiento_id: mov.id })
        .eq('id', liq.id)
    }

    count++
  }

  revalidatePath('/empleados')
  revalidatePath('/caja')
  revalidatePath('/dashboard')
  return { count }
}

function nextMonthFirstDay(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  if (mo === 12) return `${y! + 1}-01-01`
  return `${y}-${String(mo! + 1).padStart(2, '0')}-01`
}

// ---- Descuentos sobre el plus ---------------------------------------------

async function getDescuentosPendientes(
  supabase: Supabase,
  empleadoIds: string[],
): Promise<Map<string, { id: string; fecha: string; monto: number }[]>> {
  const out = new Map<string, { id: string; fecha: string; monto: number }[]>()
  if (empleadoIds.length === 0) return out
  const { data } = await supabase
    .from('empleado_descuentos')
    .select('id, empleado_id, fecha, monto')
    .in('empleado_id', empleadoIds)
    .is('liquidacion_id', null)
    .order('fecha')
  for (const d of data ?? []) {
    const arr = out.get(d.empleado_id) ?? []
    arr.push({ id: d.id, fecha: d.fecha, monto: Number(d.monto) })
    out.set(d.empleado_id, arr)
  }
  return out
}

// Vincula los descuentos aplicados a la liquidación del plus. Si superaron el
// plus, lo que no entró queda como un descuento pendiente nuevo (arrastre),
// atado a esta liquidación para que desaparezca si se la borra.
async function vincularDescuentos(
  supabase: Supabase,
  tenantId: string,
  empleadoId: string,
  liquidacionId: string,
  aplicacion: AplicacionDescuentos,
  fecha: string,
): Promise<{ error?: string; aplicados?: boolean }> {
  if (aplicacion.ids.length === 0) return { aplicados: true }
  const { data: vinculados, error } = await supabase
    .from('empleado_descuentos')
    .update({ liquidacion_id: liquidacionId })
    .in('id', aplicacion.ids)
    .is('liquidacion_id', null)
    .select('id')
  if (error) return { error: error.message }
  // Si otro cierre en paralelo ya tomó alguno, deshacemos lo nuestro: esta
  // liquidación se paga sin descuentos y no se crea un arrastre duplicado.
  if (!vinculados || vinculados.length !== aplicacion.ids.length) {
    if (vinculados && vinculados.length > 0) {
      await supabase
        .from('empleado_descuentos')
        .update({ liquidacion_id: null })
        .in('id', vinculados.map((v) => v.id))
        .eq('liquidacion_id', liquidacionId)
    }
    return { aplicados: false }
  }

  if (aplicacion.excedente > 0) {
    const { error: arrErr } = await supabase.from('empleado_descuentos').insert({
      tenant_id: tenantId,
      empleado_id: empleadoId,
      fecha,
      motivo: 'Saldo de descuentos que superó el plus anterior',
      monto: aplicacion.excedente,
      origen_liquidacion_id: liquidacionId,
    })
    if (arrErr) {
      // Sin el arrastre, los descuentos quedarían como cobrados sin haberse
      // cobrado: se desvinculan y esta liquidación paga el plus entero.
      await supabase
        .from('empleado_descuentos')
        .update({ liquidacion_id: null })
        .in('id', aplicacion.ids)
        .eq('liquidacion_id', liquidacionId)
      return { error: arrErr.message, aplicados: false }
    }
  }
  return { aplicados: true }
}

// Fecha válida y no futura (un "2062" mal tipeado quedaría pendiente para siempre).
function errorDeFecha(fecha: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return 'La fecha no es válida'
  if (fecha > hoyISO()) return 'La fecha no puede ser futura'
  if (fecha < '2020-01-01') return 'La fecha no es válida'
  return null
}

async function empleadoDelLocal(supabase: Supabase, tenantId: string, empleadoId: string): Promise<boolean> {
  const { data } = await supabase
    .from('empleados')
    .select('id')
    .eq('id', empleadoId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return !!data
}

export async function createDescuento(
  empleadoId: string,
  values: DescuentoFormValues,
): Promise<{ error?: string }> {
  const parsed = descuentoSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }
  const errFecha = errorDeFecha(values.fecha)
  if (errFecha) return { error: errFecha }
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  if (!(await empleadoDelLocal(supabase, tenantId, empleadoId))) return { error: 'Empleado no encontrado' }
  const { error } = await supabase.from('empleado_descuentos').insert({
    tenant_id: tenantId,
    empleado_id: empleadoId,
    fecha: values.fecha,
    motivo: values.motivo.trim(),
    producto_id: values.producto_id || null,
    cantidad: values.producto_id ? (values.cantidad ?? null) : null,
    monto: values.monto,
  })
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  return {}
}

/** Solo se pueden borrar los pendientes: uno ya descontado de un plus pagado
 *  forma parte de esa liquidación. */
export async function deleteDescuento(id: string, empleadoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('empleado_descuentos')
    .delete()
    .eq('id', id)
    .is('liquidacion_id', null)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Ese descuento ya se aplicó a un plus pagado y no se puede borrar' }
  }
  revalidatePath(`/empleados/${empleadoId}`)
  return {}
}

// ---- Llegadas tarde ---------------------------------------------------------

export async function createTardanza(
  empleadoId: string,
  values: TardanzaFormValues,
): Promise<{ error?: string }> {
  const parsed = tardanzaSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }
  const errFecha = errorDeFecha(values.fecha)
  if (errFecha) return { error: errFecha }
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  if (!(await empleadoDelLocal(supabase, tenantId, empleadoId))) return { error: 'Empleado no encontrado' }
  const { error } = await supabase.from('empleado_tardanzas').insert({
    tenant_id: tenantId,
    empleado_id: empleadoId,
    fecha: values.fecha,
    minutos: values.minutos,
    notas: values.notas?.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados/asistencia')
  return {}
}

export async function setTardanzaRecuperada(
  id: string,
  recuperada: boolean,
  empleadoId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('empleado_tardanzas')
    .update({ recuperada, recuperada_at: recuperada ? hoyISO() : null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados/asistencia')
  return {}
}

export async function deleteTardanza(id: string, empleadoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('empleado_tardanzas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/empleados/${empleadoId}`)
  revalidatePath('/empleados/asistencia')
  return {}
}
