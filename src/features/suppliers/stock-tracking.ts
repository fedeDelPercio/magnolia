import type { createClient } from '@/lib/supabase/server'

// Revierte el track_stock + stock_inicial de los insumos cuyo tracking fue
// activado por esta compra (stock_inicial_compra_id = compraId). Se usa antes
// de borrar la compra (en deleteCompra o en el rollback de applyComprobante)
// para evitar "stock fantasma" en el catalogo cuando se elimina la compra
// que disparo el tracking.
export async function revertTrackingForCompra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compraId: string,
): Promise<void> {
  const { data: insumosAfectados } = await supabase
    .from('insumos')
    .select('id')
    .eq('stock_inicial_compra_id', compraId)
  if (!insumosAfectados || insumosAfectados.length === 0) return
  await supabase
    .from('insumos')
    .update({ track_stock: false, stock_inicial: 0, stock_inicial_compra_id: null })
    .in('id', insumosAfectados.map((i) => i.id))
}
