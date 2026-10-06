-- "Agua" y "Agua Delivery" son productos de reventa con la receta vacía: no
-- estaban vinculados al insumo Agua, así que venderlos nunca bajaba el stock
-- del insumo (solo bajaba cuando el agua iba dentro de un menú cuya receta sí
-- la tenía). Les vinculamos el insumo 1:1, igual que hace el catálogo al
-- marcar "Se compra hecho" y elegir el insumo. Con 0080, se descuenta por venta.
--
-- Acotado: solo recetas de productos de reventa con ese nombre y sin ningún
-- ingrediente, y solo si el tenant tiene exactamente un insumo llamado "Agua".

insert into public.receta_ingredientes (receta_id, kind, insumo_id, qty, unit)
select p.receta_id, 'insumo', i.id, 1, i.unit
from public.productos p
join public.insumos i
  on i.tenant_id = p.tenant_id
 and lower(trim(i.name)) = 'agua'
where p.es_reventa
  and p.receta_id is not null
  and lower(trim(p.name)) in ('agua', 'agua delivery')
  and not exists (select 1 from public.receta_ingredientes ri where ri.receta_id = p.receta_id)
  and (select count(*) from public.insumos i2
        where i2.tenant_id = p.tenant_id and lower(trim(i2.name)) = 'agua') = 1;
