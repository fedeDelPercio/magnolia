import { getProductos } from '@/features/catalog/productos/queries'
import { getRecetasSimple } from '@/features/catalog/recetas/queries'
import { ProductosClient } from '@/features/catalog/productos/components/productos-client'

export const metadata = { title: 'Productos — Magnolia' }

export default async function ProductosPage() {
  const [productos, recetas] = await Promise.all([getProductos(), getRecetasSimple()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Productos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Precio de venta, costo calculado y margen por producto.
        </p>
      </div>
      <ProductosClient productos={productos} recetas={recetas} />
    </div>
  )
}
