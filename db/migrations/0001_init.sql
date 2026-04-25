-- ============================================================
-- 0001_init.sql
-- Fundaciones: tenants, memberships, RLS helper, audit_log
-- ============================================================

-- ---- Tenants ------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'ARS',
  timezone    text not null default 'America/Argentina/Buenos_Aires',
  config      jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---- Memberships -------------------------------------------
create type public.membership_role as enum ('owner', 'admin', 'kitchen', 'cashier');
create type public.membership_status as enum ('active', 'inactive', 'invited');

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        public.membership_role not null default 'owner',
  status      public.membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create index idx_memberships_user_id   on public.memberships(user_id);
create index idx_memberships_tenant_id on public.memberships(tenant_id);

-- ---- RLS helper --------------------------------------------
-- Returns all tenant_ids for which the current user is an active member.
-- SECURITY DEFINER ensures this runs as the function owner (no recursive RLS).
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

-- ---- Audit log ---------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text not null,
  record_id   uuid,
  before      jsonb,
  after       jsonb,
  ts          timestamptz not null default now()
);

create index idx_audit_log_tenant_ts on public.audit_log(tenant_id, ts desc);

-- ---- Tenant config -----------------------------------------
create table public.tenant_config (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ---- updated_at trigger helper -----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ---- RLS: tenants ------------------------------------------
alter table public.tenants enable row level security;

create policy "tenants_select" on public.tenants
  for select using (id in (select public.current_tenant_ids()));

create policy "tenants_insert" on public.tenants
  for insert with check (true); -- any authenticated user can create a tenant

create policy "tenants_update" on public.tenants
  for update using (id in (select public.current_tenant_ids()))
  with check (id in (select public.current_tenant_ids()));

-- ---- RLS: memberships --------------------------------------
alter table public.memberships enable row level security;

create policy "memberships_select" on public.memberships
  for select using (user_id = auth.uid() or tenant_id in (select public.current_tenant_ids()));

create policy "memberships_insert" on public.memberships
  for insert with check (tenant_id in (select public.current_tenant_ids()));

create policy "memberships_update" on public.memberships
  for update using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: audit_log ----------------------------------------
alter table public.audit_log enable row level security;

create policy "audit_log_select" on public.audit_log
  for select using (tenant_id in (select public.current_tenant_ids()));

-- audit_log is append-only from server side; no direct insert from client
create policy "audit_log_insert" on public.audit_log
  for insert with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: tenant_config ------------------------------------
alter table public.tenant_config enable row level security;

create policy "tenant_config_all" on public.tenant_config
  for all using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- Auth hook: create tenant on signup --------------------
-- This function runs after a user signs up and creates their tenant + membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_name      text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'restaurant_name',
    split_part(new.email, '@', 1)
  );

  insert into public.tenants (name)
  values (v_name)
  returning id into v_tenant_id;

  insert into public.memberships (user_id, tenant_id, role, status)
  values (new.id, v_tenant_id, 'owner', 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
