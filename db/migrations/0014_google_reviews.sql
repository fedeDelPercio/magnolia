-- Snapshots de Google Maps reviews por tenant.
-- Cada snapshot guarda el estado del lugar en un momento dado (rating, total
-- de reviews, últimas 5 reviews públicas) para construir histórico y deltas.
-- El Place ID se guarda en tenant_config con key='google_place_id'.

create table public.google_review_snapshots (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  place_id        text not null,
  fetched_at      timestamptz not null default now(),
  rating          numeric(2,1) not null,
  total_reviews   integer not null,
  latest_reviews  jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index idx_google_review_snapshots_tenant_fetched
  on public.google_review_snapshots(tenant_id, fetched_at desc);

alter table public.google_review_snapshots enable row level security;

create policy "google_review_snapshots_all" on public.google_review_snapshots
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

comment on table public.google_review_snapshots is
  'Snapshots diarios del estado público de un lugar en Google Maps (rating, conteo, últimas reviews).';
comment on column public.google_review_snapshots.latest_reviews is
  'Array JSON de hasta 5 reviews más recientes devueltas por Places API. Schema: [{ name, author, rating, text, time, languageCode }].';
