import { getInsumos, getProveedores } from '@/features/catalog/insumos/queries'
import { InsumosClient } from '@/features/catalog/insumos/components/insumos-client'

export const metadata = { title: 'Insumos — Magnolia' }

export default async function InsumosPage() {
  const [insumos, proveedores] = await Promise.all([getInsumos(), getProveedores()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Insumos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Materias primas con precio actual e historial.
        </p>
      </div>
      <InsumosClient insumos={insumos} proveedores={proveedores} />
    </div>
  )
}
