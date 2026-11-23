-- Secure per-household energy connector credentials and normalized ingestion.
create table if not exists private.energy_ingest_tokens (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
alter table private.energy_ingest_tokens enable row level security;
revoke all on table private.energy_ingest_tokens from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

create or replace function private.create_my_energy_integration(p_provider text,p_display_label text,p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid:=auth.uid(); v_household_id uuid; v_integration_id uuid;
  v_provider text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_provider,'')));
  v_label text:=nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_display_label,'')),80),'');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_provider not in ('home_assistant','homewizard') then raise exception 'Unsupported integration provider'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid connector credential digest'; end if;
  select hm.household_id into v_household_id from public.household_members hm
   where hm.user_id=v_user_id and hm.role in ('owner','admin')
   order by case when hm.role='owner' then 0 else 1 end,hm.joined_at limit 1;
  if v_household_id is null or not private.is_household_admin(v_household_id) then raise exception 'A household owner or administrator is required'; end if;
  insert into public.consent_records(user_id,household_id,purpose,policy_version,context)
  values(v_user_id,v_household_id,'energy_measurements','mijn-energie-energy-data-2026-11-v1',
    pg_catalog.jsonb_build_object('provider',v_provider,'source','mijn-energie-app','scope','private_household_energy_measurements'));
  insert into public.integrations(household_id,provider,status,display_label,connected_at,last_seen_at,last_error_code,updated_at)
  values(v_household_id,v_provider,'pending',v_label,null,null,null,pg_catalog.now())
  on conflict(household_id,provider) do update set status='pending',display_label=excluded.display_label,
    connected_at=null,last_seen_at=null,last_error_code=null,updated_at=pg_catalog.now()
  returning id into v_integration_id;
  insert into private.energy_ingest_tokens(integration_id,household_id,token_hash,created_by,created_at,revoked_at,last_used_at)
  values(v_integration_id,v_household_id,p_token_hash,v_user_id,pg_catalog.now(),null,null)
  on conflict(integration_id) do update set household_id=excluded.household_id,token_hash=excluded.token_hash,
    created_by=excluded.created_by,created_at=pg_catalog.now(),revoked_at=null,last_used_at=null;
  return pg_catalog.jsonb_build_object('integration_id',v_integration_id,'provider',v_provider,'status','pending','display_label',v_label);
end; $$;
revoke all on function private.create_my_energy_integration(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_my_energy_integration(text,text,text) to authenticated;
create or replace function public.create_my_energy_integration(p_provider text,p_display_label text,p_token_hash text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.create_my_energy_integration(p_provider,p_display_label,p_token_hash); $$;
revoke all on function public.create_my_energy_integration(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.create_my_energy_integration(text,text,text) to authenticated;

create or replace function private.revoke_my_energy_integration(p_integration_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_household_id uuid; v_provider text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select i.household_id,i.provider into v_household_id,v_provider from public.integrations i where i.id=p_integration_id;
  if v_household_id is null then return false; end if;
  if not private.is_household_admin(v_household_id) then raise exception 'Not permitted to revoke this integration'; end if;
  update private.energy_ingest_tokens set revoked_at=coalesce(revoked_at,pg_catalog.now()) where integration_id=p_integration_id;
  update public.integrations set status='revoked',updated_at=pg_catalog.now() where id=p_integration_id;
  update public.consent_records set revoked_at=coalesce(revoked_at,pg_catalog.now())
   where user_id=auth.uid() and household_id=v_household_id and purpose='energy_measurements'
     and context->>'provider'=v_provider and revoked_at is null;
  return true;
end; $$;
revoke all on function private.revoke_my_energy_integration(uuid) from public,anon,authenticated,service_role;
grant execute on function private.revoke_my_energy_integration(uuid) to authenticated;
create or replace function public.revoke_my_energy_integration(p_integration_id uuid)
returns boolean language sql security invoker set search_path = '' as $$ select private.revoke_my_energy_integration(p_integration_id); $$;
revoke all on function public.revoke_my_energy_integration(uuid) from public,anon,authenticated,service_role;
grant execute on function public.revoke_my_energy_integration(uuid) to authenticated;

create or replace function private.ingest_energy_measurement(p_token_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integration_id uuid; v_household_id uuid; v_measured_at timestamptz; v_source_event_id text;
 v_grid_import_w numeric; v_grid_export_w numeric; v_grid_import_total_kwh numeric; v_grid_export_total_kwh numeric;
 v_gas_total_m3 numeric; v_measurement_id bigint;
begin
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid integration credential'; end if;
 if p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid measurement payload'; end if;
 select t.integration_id,t.household_id into v_integration_id,v_household_id
 from private.energy_ingest_tokens t join public.integrations i on i.id=t.integration_id
 where t.token_hash=p_token_hash and t.revoked_at is null and i.status in ('pending','connected','degraded');
 if v_integration_id is null then raise exception 'Invalid or revoked integration credential'; end if;
 v_source_event_id:=nullif(pg_catalog.btrim(p_payload->>'source_event_id'),'');
 if v_source_event_id is null or pg_catalog.char_length(v_source_event_id)>128 then raise exception 'A source_event_id of 1 to 128 characters is required'; end if;
 if coalesce(p_payload->>'measured_at','')='' then raise exception 'measured_at is required'; end if;
 v_measured_at:=(p_payload->>'measured_at')::timestamptz;
 if v_measured_at<pg_catalog.now()-interval '36 hours' or v_measured_at>pg_catalog.now()+interval '2 minutes' then raise exception 'Measurement timestamp is outside the accepted window'; end if;
 v_grid_import_w:=nullif(p_payload->>'grid_import_w','')::numeric;
 v_grid_export_w:=nullif(p_payload->>'grid_export_w','')::numeric;
 v_grid_import_total_kwh:=nullif(p_payload->>'grid_import_total_kwh','')::numeric;
 v_grid_export_total_kwh:=nullif(p_payload->>'grid_export_total_kwh','')::numeric;
 v_gas_total_m3:=nullif(p_payload->>'gas_total_m3','')::numeric;
 if v_grid_import_w<0 or v_grid_export_w<0 or v_grid_import_total_kwh<0 or v_grid_export_total_kwh<0 or v_gas_total_m3<0 then raise exception 'Measurement values cannot be negative'; end if;
 if v_grid_import_w is null and v_grid_export_w is null and v_grid_import_total_kwh is null and v_grid_export_total_kwh is null and v_gas_total_m3 is null then raise exception 'At least one measurement value is required'; end if;
 insert into public.energy_measurements(household_id,integration_id,source_event_id,measured_at,grid_import_w,grid_export_w,grid_import_total_kwh,grid_export_total_kwh,gas_total_m3,quality)
 values(v_household_id,v_integration_id,v_source_event_id,v_measured_at,v_grid_import_w,v_grid_export_w,v_grid_import_total_kwh,v_grid_export_total_kwh,v_gas_total_m3,'unverified')
 on conflict(household_id,integration_id,source_event_id) where source_event_id is not null
 do update set measured_at=excluded.measured_at,grid_import_w=excluded.grid_import_w,grid_export_w=excluded.grid_export_w,
  grid_import_total_kwh=excluded.grid_import_total_kwh,grid_export_total_kwh=excluded.grid_export_total_kwh,gas_total_m3=excluded.gas_total_m3,quality='unverified'
 returning id into v_measurement_id;
 update private.energy_ingest_tokens set last_used_at=pg_catalog.now() where integration_id=v_integration_id;
 update public.integrations set status='connected',connected_at=coalesce(connected_at,pg_catalog.now()),last_seen_at=pg_catalog.now(),last_error_code=null,updated_at=pg_catalog.now() where id=v_integration_id;
 return pg_catalog.jsonb_build_object('accepted',true,'integration_id',v_integration_id,'measurement_id',v_measurement_id,'measured_at',v_measured_at);
end; $$;
revoke all on function private.ingest_energy_measurement(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.ingest_energy_measurement(text,jsonb) to service_role;
create or replace function public.ingest_energy_measurement(p_token_hash text,p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.ingest_energy_measurement(p_token_hash,p_payload); $$;
revoke all on function public.ingest_energy_measurement(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ingest_energy_measurement(text,jsonb) to service_role;
notify pgrst,'reload schema';
