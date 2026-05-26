import { getInsumos, getProveedores } from '@/features/catalog/insumos/queries'
import { InsumosClient } from '@/features/catalog/insumos/components/insumos-client'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Insumos — Magnolia' }

export default async function InsumosPage() {
  const [insumos, proveedores] = await Promise.all([getInsumos(), getProveedores()])
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo · Insumos"
        title={
          <>
            <span className="italic">Materias</span> primas
          </>
        }
        description="Precio actual, historial de costos y stock de referencia."
      />
      <InsumosClient insumos={insumos} proveedores={proveedores} />
    </div>
  )
}
