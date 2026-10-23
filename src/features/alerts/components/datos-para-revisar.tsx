import Link from 'next/link'
import { CheckCircle2Icon } from 'lucide-react'

import type { DatoParaRevisar, TipoRevision } from '../queries'

// Qué significa cada control y dónde se corrige. El orden es por impacto:
// primero lo que rompe costos y stock de muchos productos.
const TIPOS: { tipo: TipoRevision; titulo: string; porQue: string; href: string; donde: string; orden: 'mayor' | 'menor' }[] = [
  {
    tipo: 'receta_unidad',
    titulo: 'Recetas con una unidad que no se puede convertir',
    porQue: 'El insumo está en unidades y la receta lo pide en gramos (o al revés): se descuenta 1 a 1 y el costo sale cualquier cosa.',
    href: '/catalogo/recetas',
    donde: 'Recetas',
    orden: 'mayor',
  },
  {
    tipo: 'precio_raro',
    titulo: 'Insumos con un precio muy distinto al habitual',
    porQue: 'Casi siempre es una compra cargada en otra unidad (pack en vez de kg). Corregí la compra o el precio del insumo.',
    href: '/catalogo/insumos',
    donde: 'Insumos',
    orden: 'mayor',
  },
  {
    tipo: 'costo_mayor_precio',
    titulo: 'Productos que cuestan más de lo que se venden',
    porQue: 'Suele ser un ingrediente con la unidad o el precio mal cargado.',
    href: '/catalogo/productos',
    donde: 'Productos',
    orden: 'mayor',
  },
  {
    tipo: 'vendido_sin_receta',
    titulo: 'Se venden y no tienen receta',
    porQue: 'No tienen costo y no descuentan stock. Si se compran hechos, vinculalos a su insumo como reventa.',
    href: '/catalogo/productos',
    donde: 'Productos',
    orden: 'mayor',
  },
  {
    tipo: 'stock_negativo',
    titulo: 'Insumos con stock negativo',
    porQue: 'Se usó más de lo que se compró desde el último conteo: falta cargar una compra o hacer un conteo.',
    href: '/catalogo/insumos',
    donde: 'Insumos',
    orden: 'menor',
  },
]

const VISIBLES = 5

export function DatosParaRevisar({ datos }: { datos: DatoParaRevisar[] }) {
  if (datos.length === 0) {
    return (
      <div className="card-editorial flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <CheckCircle2Icon className="size-4 text-emerald-600" />
        No hay datos para revisar: recetas, precios y stock están en orden.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {TIPOS.map((t) => {
        const items = datos
          .filter((d) => d.tipo === t.tipo)
          .sort((a, b) => (t.orden === 'mayor' ? b.valor - a.valor : a.valor - b.valor))
        if (items.length === 0) return null
        const resto = items.slice(VISIBLES)
        return (
          <div key={t.tipo} className="card-editorial p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">{t.titulo}</h3>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800">
                {items.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.porQue}</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {items.slice(0, VISIBLES).map((d, i) => (
                <li key={`${d.nombre}-${i}`}>
                  <span className="font-medium">{d.nombre}</span>
                  <span className="text-muted-foreground"> · {d.detalle}</span>
                </li>
              ))}
            </ul>
            {resto.length > 0 && (
              <details className="mt-1.5 text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Ver {resto.length} más
                </summary>
                <ul className="mt-1.5 space-y-1.5">
                  {resto.map((d, i) => (
                    <li key={`${d.nombre}-r${i}`}>
                      <span className="font-medium">{d.nombre}</span>
                      <span className="text-muted-foreground"> · {d.detalle}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Link href={t.href} className="focus-ring mt-3 inline-block rounded-sm text-xs font-medium underline underline-offset-2">
              Corregir en {t.donde}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
