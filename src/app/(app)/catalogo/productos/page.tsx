import { getProductos } from '@/features/catalog/productos/queries'
import {
  getInsumosSimple,
  getRecetasParaProductos,
  getRecetasSimple,
  getDescartablesParaProductos,
} from '@/features/catalog/recetas/queries'
import { ProductosClient } from '@/features/catalog/productos/components/productos-client'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Productos — MAGNOLIA FOOD' }

// q: precarga el buscador — lo usan los links "Usado en" de insumos/sub-recetas.
type Props = { searchParams: Promise<{ q?: string }> }

export default async function ProductosPage({ searchParams }: Props) {
  const { q } = await searchParams
  const [productos, todosInsumos, recetasParaProductos, subRecetas, descartablesParaProductos] =
    await Promise.all([
      getProductos(),
      getInsumosSimple(),
      getRecetasParaProductos(),
      getRecetasSimple(),
      getDescartablesParaProductos(),
    ])

  const insumos = todosInsumos.filter((i) => i.kind === 'ingrediente')
  const insumosDescartables = todosInsumos.filter((i) => i.kind === 'descartable')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo · Productos"
        title={
          <>
            <span className="italic">Carta</span> y márgenes
          </>
        }
        description="Precio de venta, costo calculado y margen por producto."
      />

      <ProductosClient
        initialSearch={q}
        productos={productos}
        insumos={insumos}
        insumosDescartables={insumosDescartables}
        recetasParaProductos={recetasParaProductos}
        descartablesParaProductos={descartablesParaProductos}
        subRecetas={subRecetas}
      />
    </div>
  )
}
