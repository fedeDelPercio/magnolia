'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { AJUSTE_CATEGORIA, FONDO_EMERGENCIA_CATEGORIA } from './constants'

const baseSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida'),
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
  descripcion: z.string().trim().max(500).optional().nullable(),
})

const egresoSchema = baseSchema.extend({
  categoria: z.string().trim().min(1).max(80).nullable().optional(),
})
const ingresoSchema = baseSchema.extend({
  origen: z.enum(['externo', 'caja_efectivo', 'cuenta_digital']),
  // Marca opcional para ingresos que son correccion de saldo ('Ajuste de
  // caja'). Van con origen='externo' (no descuentan de otra cuenta) y la
  // categoria queda en la fila para el detalle y para excluirlos de metricas.
  categoria: z.string().trim().max(80).nullable().optional(),
})

export type EgresoInput = z.infer<typeof egresoSchema>
export type IngresoInput = z.infer<typeof ingresoSchema>

export async function registrarEgresoCajaMayor(input: EgresoInput): Promise<{ error?: string }> {
  const parsed = egresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Categoría especial: deriva al fondo de emergencia (doble asiento). En vez de
  // un egreso de caja mayor, creamos un ingreso al fondo con origen caja mayor;
  // getCajaMayorSummary lo resta del saldo de caja mayor.
  if (parsed.data.categoria === FONDO_EMERGENCIA_CATEGORIA) {
    const { error } = await supabase.from('fondo_emergencia_movimientos').insert({
      tenant_id: tenantId,
      fecha: parsed.data.fecha,
      tipo: 'ingreso',
      monto: parsed.data.monto,
      descripcion: parsed.data.descripcion ?? null,
      origen: 'caja_efectivo',
      source: 'manual',
      created_by: user?.id ?? null,
    })
    if (error) return { error: error.message }
    revalidatePath('/caja')
    return {}
  }

  const { error } = await supabase.from('caja_mayor_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'egreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: parsed.data.categoria ?? null,
    source: 'manual',
    origen: 'externo',
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

// Crea una categoria nueva desde el modal de egreso — devuelve el name para
// que la UI la agregue al select y quede seleccionada. Idempotente por nombre
// (case-insensitive): si ya existe, devuelve el existente.
export async function crearCajaCategoria(name: string): Promise<{ name?: string; error?: string }> {
  const clean = name.trim()
  if (!clean) return { error: 'El nombre no puede estar vacio' }
  if (clean.length > 80) return { error: 'El nombre es demasiado largo' }
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Si ya existe con el mismo nombre (case-insensitive), reutilizamos.
  const { data: existing } = await supabase
    .from('caja_categorias')
    .select('name')
    .eq('tenant_id', tenantId)
    .ilike('name', clean)
    .maybeSingle()
  if (existing) {
    revalidatePath('/caja')
    return { name: existing.name }
  }

  const { data, error } = await supabase
    .from('caja_categorias')
    .insert({ tenant_id: tenantId, name: clean })
    .select('name')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/caja')
  return { name: data.name }
}

// Ingreso manual a Caja Mayor con origen explicito. Si origen='caja_efectivo'
// el monto se descuenta del saldo de caja efectivo (sumando virtualmente como
// retiro en BistroCajaSummary). Si origen='cuenta_digital' se descuenta del
// saldo de cuenta digital. Si origen='externo' es plata que entro desde afuera
// (prestamo, aporte, etc.) y solo suma a caja mayor.
export async function registrarIngresoCajaMayor(input: IngresoInput): Promise<{ error?: string }> {
  const parsed = ingresoSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('caja_mayor_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'ingreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: parsed.data.categoria ?? null,
    source: 'manual',
    origen: parsed.data.origen,
    created_by: user?.id ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

export async function deleteCajaMayorMovimiento(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  // Solo permitimos borrar movimientos manuales — los que vienen de Bistro
  // se manejan desde el flujo de sincronizacion para no romper el linkeo.
  const { error } = await supabase
    .from('caja_mayor_movimientos')
    .delete()
    .eq('id', id)
    .eq('source', 'manual')
  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

// Registra un egreso de cuenta digital (transferencia bancaria, pago Mercado
// Pago, etc.) que no este vinculado a un pago a proveedor. Default de
// categoria = 'Egreso digital' pero el user puede elegir otras (ej.
// 'Pago a empleados' para que impacte en labor cost del dashboard).
const egresoDigitalSchema = baseSchema.extend({
  categoria: z.string().trim().min(1).max(80).optional(),
})

export type EgresoDigitalInput = z.infer<typeof egresoDigitalSchema>

export async function registrarEgresoDigital(input: EgresoDigitalInput): Promise<{ error?: string }> {
  const parsed = egresoDigitalSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Categoría especial: deriva al fondo de emergencia (doble asiento). Creamos
  // un ingreso al fondo con origen cuenta digital; getCuentaDigitalSummary lo
  // resta del saldo digital.
  if (parsed.data.categoria === FONDO_EMERGENCIA_CATEGORIA) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('fondo_emergencia_movimientos').insert({
      tenant_id: tenantId,
      fecha: parsed.data.fecha,
      tipo: 'ingreso',
      monto: parsed.data.monto,
      descripcion: parsed.data.descripcion ?? null,
      origen: 'cuenta_digital',
      source: 'manual',
      created_by: user?.id ?? null,
    })
    if (error) return { error: error.message }
    revalidatePath('/caja')
    revalidatePath('/dashboard')
    return {}
  }

  const { error } = await supabase.from('caja_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'egreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: parsed.data.categoria ?? 'Egreso digital',
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  revalidatePath('/dashboard')
  return {}
}

// Registra un ingreso a cuenta digital que NO viene del POS (ej. una
// transferencia recibida externa, devolucion, adelanto). Categoria
// 'Ingreso digital' para que la query lo sume al saldo. Whitelist estricta:
// la unica otra categoria valida es 'Ajuste de caja' — cualquier otra
// desapareceria silenciosamente del saldo digital (la query filtra por
// categoria) y el ingreso "se perderia".
export async function registrarIngresoDigital(input: EgresoDigitalInput): Promise<{ error?: string }> {
  const parsed = egresoDigitalSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('caja_movimientos').insert({
    tenant_id: tenantId,
    fecha: parsed.data.fecha,
    tipo: 'ingreso',
    monto: parsed.data.monto,
    descripcion: parsed.data.descripcion ?? null,
    categoria: parsed.data.categoria === AJUSTE_CATEGORIA ? AJUSTE_CATEGORIA : 'Ingreso digital',
  })

  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}

// Elimina un movimiento digital MANUAL (Ingreso/Egreso digital sin ref_kind).
// Deshace el movimiento — el saldo de cuenta digital se recalcula solo. Bloquea
// movimientos vinculados a otras entidades (pagos, traspasos) para que se
// gestionen desde su feature de origen.
export async function eliminarMovimientoDigital(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: row, error: readErr } = await supabase
    .from('caja_movimientos')
    .select('id, categoria, ref_kind')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!row) return { error: 'Movimiento no encontrado' }
  // Cualquier caja_movimiento SIN ref_kind es un mov manual cargado por el
  // user desde /caja (Egreso dialog) o la card digital. Se puede borrar. Con
  // ref_kind: viene de pagos a proveedor, sync Bistro, o liquidaciones — se
  // gestionan desde su feature de origen.
  if (row.ref_kind) {
    return { error: 'Este movimiento no se puede eliminar desde acá' }
  }

  const { error } = await supabase.from('caja_movimientos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/caja')
  return {}
}
