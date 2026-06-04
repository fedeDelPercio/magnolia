import { getSaldosProveedores } from '@/features/suppliers/queries'
import { ProveedoresClient } from '@/features/suppliers/components/proveedores-client'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

export default async function ProveedoresPage() {
  const proveedores = await getSaldosProveedores()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Proveedores"
        title={
          <>
            <span className="italic">Cuenta</span> corriente
          </>
        }
        size="md"
      />
      <ProveedoresClient proveedores={proveedores} />
    </div>
  )
}
