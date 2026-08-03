-- Instrucciones especificas por proveedor para la IA que escanea comprobantes.
-- Campo libre opcional: solo los proveedores con facturas "raras" (columnas
-- ambiguas, formatos particulares) lo necesitan. Se inyecta al prompt de
-- extraccion cuando se sube un comprobante de ese proveedor, con prioridad
-- sobre las reglas generales.
alter table proveedores add column if not exists ai_extraction_notes text;
