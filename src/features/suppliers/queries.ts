import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type SaldoProveedor = {
  id: string
  tenant_id: string
  name: string
  active: boolean
  total_compras: number
  total_pagado: number
  saldo: number
  d0_30: number
  d31_60: number
  d61_90: number
  d90plus: number
  // Campos del perfil expuestos por la vista para que el dialog de edición
  // los reciba sin tener que hacer una query extra a `proveedores`.
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  discrimina_iva: boolean
  payment_rule: unknown
}

export type CompraWithItems = Tables<'compras'> & {
  compra_items: (Tables<'compra_items'> & {
    insumos: Pick<Tables<'insumos'>, 'name' | 'unit'>
  })[]
}

export type PagoProveedor = Tables<'pagos_proveedor'>

export async function getSaldosProveedores(): Promise<SaldoProveedor[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('saldos_proveedores')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SaldoProveedor[]
}

export async function getSaldoProveedor(proveedorId: string): Promise<SaldoProveedor | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('saldos_proveedores')
    .select('*')
    .eq('id', proveedorId)
    .single()

  if (error) return null
  return data as unknown as SaldoProveedor
}

export async function getComprasByProveedor(proveedorId: string): Promise<CompraWithItems[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      compra_items(
        *,
        insumos(name, unit)
      )
    `)
    .eq('proveedor_id', proveedorId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as CompraWithItems[]
}

export async function getPagosByProveedor(proveedorId: string): Promise<PagoProveedor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pagos_proveedor')
    .select('*')
    .eq('proveedor_id', proveedorId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
