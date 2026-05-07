import { getProductos } from '@/features/catalog/productos/queries'
import {
  getInsumosSimple,
  getRecetasParaProductos,
  getRecetasSimple,
  getDescartablesParaProductos,
} from '@/features/catalog/recetas/queries'
import { ProductosClient } from '@/features/catalog/productos/components/productos-client'

export const metadata = { title: 'Productos — Magnolia' }

export default async function ProductosPage() {
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
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Precio de venta, costo calculado y margen por producto.
        </p>
      </div>
      <ProductosClient
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
