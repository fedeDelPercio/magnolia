-- UNIQUE parcial en (tenant_id, ref_kind, ref_id) para movimientos que
-- referencian una transaccion bistro (ref_kind='bistro_tx'). Habilita
-- ON CONFLICT DO NOTHING al derivar movimientos automaticos del sync,
-- garantizando idempotencia si se re-sincroniza el mismo dia.
create unique index if not exists caja_movimientos_bistro_ref_unique
  on public.caja_movimientos (tenant_id, ref_kind, ref_id)
  where ref_kind = 'bistro_tx' and ref_id is not null;
