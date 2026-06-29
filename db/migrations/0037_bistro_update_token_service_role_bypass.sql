-- Mismo bypass que ya tenia bistro_get_credentials (migration 0031): permitir
-- que el cron (corre con service_role, sin user logueado) refresque el token
-- cacheado. Antes esta funcion validaba SOLO con current_tenant_ids(), que esta
-- vacio en el contexto del cron => "tenant access denied" al expirar el token.
-- Solo funcionaba mientras el token cacheado seguia vigente.
create or replace function public.bistro_update_token(
  p_tenant_id uuid,
  p_token text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- service_role salta el check (cron jobs, scripts internos).
  if auth.role() = 'service_role'
     or exists (select 1 from public.current_tenant_ids() t where t = p_tenant_id)
  then
    update public.bistro_credentials
       set last_token            = p_token,
           last_token_expires_at = p_expires_at,
           updated_at            = now()
     where tenant_id = p_tenant_id;
  else
    raise exception 'tenant access denied';
  end if;
end;
$function$;
