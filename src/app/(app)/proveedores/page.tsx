import { getSaldosProveedores } from '@/features/suppliers/queries'
import { ProveedoresClient } from '@/features/suppliers/components/proveedores-client'

export const dynamic = 'force-dynamic'

export default async function ProveedoresPage() {
  const proveedores = await getSaldosProveedores()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuenta corriente, compras y pagos por proveedor.
        </p>
      </div>
      <ProveedoresClient proveedores={proveedores} />
    </div>
  )
}
