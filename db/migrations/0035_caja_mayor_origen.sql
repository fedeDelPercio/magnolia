-- Para los ingresos a Caja Mayor, queremos saber DE DONDE sale la plata,
-- asi se descuenta de la cuenta origen automaticamente:
--   externo        -> sin contra-cuenta (entrada externa, ej. prestamo)
--   caja_efectivo  -> se descuenta del saldo "Caja efectivo (Bistro)"
--   cuenta_digital -> se descuenta del saldo "Cuenta digital"
-- Para egresos (tipo='egreso') el origen no aplica — sale a un destino externo.

alter table public.caja_mayor_movimientos
  add column origen text not null default 'externo'
  check (origen in ('externo','caja_efectivo','cuenta_digital'));
