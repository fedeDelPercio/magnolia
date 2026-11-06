// Las listas del detalle de proveedor muestran las últimas 10 y el resto se
// despliega a pedido: con todo abierto había que scrollear mucho para llegar a
// los historiales de abajo.
export const LIMITE_LISTA = 10

export function visibles<T>(items: T[], abierto: boolean): T[] {
  return abierto ? items : items.slice(0, LIMITE_LISTA)
}

export function VerMas({
  total,
  abierto,
  onToggle,
  className = 'border-t px-5 py-2.5',
  textoMenos = `solo las últimas ${LIMITE_LISTA}`,
}: {
  total: number
  abierto: boolean
  onToggle: () => void
  className?: string
  // Lo que queda a la vista al cerrar (en un ranking: "solo los primeros 10").
  textoMenos?: string
}) {
  if (total <= LIMITE_LISTA) return null
  return (
    <div className={`${className} text-center`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        className="focus-ring rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {abierto ? `Ver menos (${textoMenos})` : `Ver más (${total - LIMITE_LISTA} más)`}
      </button>
    </div>
  )
}
