import { getRecetaDelDia } from '@/features/catalog/receta-del-dia/queries'
import { RecetaDelDiaClient } from '@/features/catalog/receta-del-dia/components/receta-del-dia-client'
import { getConceptos, getProductos } from '@/features/catalog/productos/queries'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Receta del día — MAGNOLIA FOOD' }

export default async function RecetaDelDiaPage() {
  const [asignaciones, productos, conceptos] = await Promise.all([
    getRecetaDelDia(),
    getProductos(),
    getConceptos(),
  ])

  const conceptoNameById = new Map(conceptos.map((c) => [c.id, c.name]))

  const productosOptions = productos
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id!,
      name: p.name ?? '',
      concepto_name: p.concepto_id ? (conceptoNameById.get(p.concepto_id) ?? null) : null,
    }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo · Receta del día"
        title={
          <>
            <span className="italic">Menú</span> por día
          </>
        }
        description="Asigná qué producto se cocina como sugerencia o menú del día en cada día de la semana."
      />
      <RecetaDelDiaClient asignaciones={asignaciones} productos={productosOptions} />
    </div>
  )
}
