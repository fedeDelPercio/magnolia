import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import {
  getSaldoProveedor,
  getComprasByProveedor,
  getPagosByProveedor,
} from '@/features/suppliers/queries'
import { ProveedorDetail } from '@/features/suppliers/components/proveedor-detail'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}

function defaultRange(): { from: string; to: string } {
  // Default: últimos 3 meses (alineado a calendario).
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(from), to: iso(to) }
}

export default async function ProveedorPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : def.from
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : def.to

  const [proveedor, compras, pagos] = await Promise.all([
    getSaldoProveedor(id),
    getComprasByProveedor(id),
    getPagosByProveedor(id),
  ])

  if (!proveedor) notFound()

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data: insumos } = await supabase
    .from('insumos')
    .select('id, name, unit, current_price, purchase_unit_label, purchase_unit_factor')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <ProveedorDetail
        proveedor={proveedor}
        compras={compras}
        pagos={pagos}
        insumos={insumos ?? []}
        from={from}
        to={to}
      />
    </div>
  )
}
