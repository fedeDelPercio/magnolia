import { getRecetas, getInsumosSimple } from '@/features/catalog/recetas/queries'
import { RecetasClient } from '@/features/catalog/recetas/components/recetas-client'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Recetas — Magnolia' }

export default async function RecetasPage() {
  const [recetas, insumos] = await Promise.all([getRecetas(), getInsumosSimple()])
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo · Recetas"
        title={
          <>
            <span className="italic">Recetas</span> y rendimiento
          </>
        }
        description="Composición de cada producto: ingredientes y rendimiento."
      />
      <RecetasClient recetas={recetas} insumos={insumos} />
    </div>
  )
}
