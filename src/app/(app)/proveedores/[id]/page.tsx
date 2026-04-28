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

type Props = { params: Promise<{ id: string }> }

export default async function ProveedorPage({ params }: Props) {
  const { id } = await params

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
    .select('id, name, unit, current_price')
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
      />
    </div>
  )
}
