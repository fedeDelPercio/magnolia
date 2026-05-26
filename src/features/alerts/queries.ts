import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'
import type { PaymentRule } from '@/features/suppliers/schemas'

export type ProveedorWithRule = {
  id: string
  name: string
  payment_rule: PaymentRule | null
  discrimina_iva: boolean
  pendingCount: number
  pendingAmount: number
}

export async function getProveedoresConRegla(): Promise<ProveedorWithRule[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data: proveedores, error: provErr } = await supabase
    .from('proveedores')
    .select('id, name, payment_rule, discrimina_iva')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .not('payment_rule', 'is', null)
    .order('name')

  if (provErr) throw new Error(provErr.message)
  if (!proveedores || proveedores.length === 0) return []

  const { data: compras, error: compErr } = await supabase
    .from('compras')
    .select('proveedor_id, total, status')
    .eq('tenant_id', tenantId)
    .in('status', ['pendiente', 'pagada_parcial'])
    .in('proveedor_id', proveedores.map((p) => p.id))

  if (compErr) throw new Error(compErr.message)

  const aggMap = new Map<string, { count: number; amount: number }>()
  for (const c of compras ?? []) {
    const a = aggMap.get(c.proveedor_id) ?? { count: 0, amount: 0 }
    a.count += 1
    a.amount += Number(c.total) || 0
    aggMap.set(c.proveedor_id, a)
  }

  return proveedores.map((p) => ({
    id: p.id,
    name: p.name,
    payment_rule: p.payment_rule as PaymentRule | null,
    discrimina_iva: p.discrimina_iva,
    pendingCount: aggMap.get(p.id)?.count ?? 0,
    pendingAmount: aggMap.get(p.id)?.amount ?? 0,
  }))
}

export type IvaBalance = {
  taxRate: number
  digitalRevenue: number
  ivaDebito: number
  comprasConIva: number
  ivaCredito: number
  balance: number
}

export async function getIvaBalance(
  from: string,
  to: string,
  taxRate: number,
): Promise<IvaBalance> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [cierresRes, comprasRes] = await Promise.all([
    supabase
      .from('cierres_caja')
      .select('monto_tarjetas, monto_qr, monto_online')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre', from)
      .lt('fecha_cierre', to),
    supabase
      .from('compras')
      .select('total, proveedores!inner(discrimina_iva)')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', to),
  ])

  if (cierresRes.error) throw new Error(cierresRes.error.message)
  if (comprasRes.error) throw new Error(comprasRes.error.message)

  const digitalRevenue = (cierresRes.data ?? []).reduce(
    (s, c) => s + (c.monto_tarjetas ?? 0) + (c.monto_qr ?? 0) + (c.monto_online ?? 0),
    0,
  )

  const comprasRows = (comprasRes.data ?? []) as unknown as Array<{
    total: number
    proveedores: Pick<Tables<'proveedores'>, 'discrimina_iva'> | null
  }>
  const comprasConIva = comprasRows
    .filter((c) => c.proveedores?.discrimina_iva)
    .reduce((s, c) => s + (Number(c.total) || 0), 0)

  const ivaDebito = digitalRevenue * (taxRate / 100)
  const ivaCredito = comprasConIva * (taxRate / 100)

  return {
    taxRate,
    digitalRevenue,
    ivaDebito,
    comprasConIva,
    ivaCredito,
    balance: ivaDebito - ivaCredito,
  }
}
