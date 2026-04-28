import { getRecetas, getInsumosSimple } from '@/features/catalog/recetas/queries'
import { RecetasClient } from '@/features/catalog/recetas/components/recetas-client'

export const metadata = { title: 'Recetas — Magnolia' }

export default async function RecetasPage() {
  const [recetas, insumos] = await Promise.all([getRecetas(), getInsumosSimple()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Recetas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Composición de cada producto: ingredientes y rendimiento.
        </p>
      </div>
      <RecetasClient recetas={recetas} insumos={insumos} />
    </div>
  )
}
