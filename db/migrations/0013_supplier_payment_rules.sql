-- Reglas de pago configurables por proveedor + flag para balanza de IVA.
-- Shapes válidos de payment_rule (jsonb):
--   { "kind": "boletas", "n": 4 }
--   { "kind": "monto", "umbral": 50000 }
--   { "kind": "fecha", "fecha_kind": "dia_mes", "dia_mes": 10 }
--   { "kind": "fecha", "fecha_kind": "nth_dow", "nth": 2, "dow": 2 }

alter table public.proveedores
  add column discrimina_iva boolean not null default false,
  add column payment_rule jsonb;

comment on column public.proveedores.discrimina_iva is
  'Si true, las compras a este proveedor cuentan como IVA crédito en la balanza fiscal.';
comment on column public.proveedores.payment_rule is
  'Regla de pago configurable. Ver schema en src/features/suppliers/schemas.ts (paymentRuleSchema).';
