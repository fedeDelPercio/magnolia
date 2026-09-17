// Agrupado de productos en Operación: UNA fila por producto. Las variantes de
// un mismo concepto (salón, barra, menú) comparten stock, producción y conteo;
// solo las ventas quedan separadas por variante.
//
// OJO: la BD tiene que agrupar igual — ver stock_arrastre_previo y
// sync_stock_siguientes (db/migrations/0078). Si cambia el criterio acá, cambia
// allá, o el stock inicial deja de coincidir con lo que muestra la grilla.

type ProductoAgrupable = {
  concepto_id: string | null
  canal: string | null
  formato: string | null
}

export function grupoKey(productoId: string, p: ProductoAgrupable): string {
  return p.concepto_id ? `concepto:${p.concepto_id}` : `prod:${productoId}`
}

// Variante base: donde viven stock, producción y conteo del grupo.
export function esVarianteBase(p: ProductoAgrupable): boolean {
  return p.canal === null && p.formato !== 'menu'
}

export function varianteLabel(p: ProductoAgrupable): string {
  if (p.formato === 'menu') return p.canal === 'delivery' ? 'Menú (barra)' : 'Menú'
  return p.canal === 'delivery' ? 'Barra' : 'Salón'
}

// Orden de las variantes dentro de un grupo: salón, barra, menú.
export function varianteOrden(p: ProductoAgrupable): number {
  return (p.formato === 'menu' ? 2 : 0) + (p.canal === 'delivery' ? 1 : 0)
}
