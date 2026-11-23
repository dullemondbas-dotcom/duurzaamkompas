-- Defense in depth: no client can access hashed ingestion credentials.
create policy energy_ingest_tokens_deny_all
on private.energy_ingest_tokens
for all
to public
using (false)
with check (false);

-- Atomic per-connector ingestion pacing: max one accepted measurement per five seconds.
create or replace function private.ingest_energy_measurement(p_token_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_integration_id uuid; v_household_id uuid; v_measured_at timestamptz; v_source_event_id text;
 v_grid_import_w numeric; v_grid_export_w numeric; v_grid_import_total_kwh numeric;
 v_grid_export_total_kwh numeric; v_gas_total_m3 numeric; v_measurement_id bigint;
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

 update private.energy_ingest_tokens set last_used_at=pg_catalog.now()
 where integration_id=v_integration_id
   and (last_used_at is null or last_used_at<=pg_catalog.now()-interval '5 seconds');
 if not found then raise exception 'Measurement rate limit exceeded'; end if;

 insert into public.energy_measurements(household_id,integration_id,source_event_id,measured_at,grid_import_w,grid_export_w,grid_import_total_kwh,grid_export_total_kwh,gas_total_m3,quality)
 values(v_household_id,v_integration_id,v_source_event_id,v_measured_at,v_grid_import_w,v_grid_export_w,v_grid_import_total_kwh,v_grid_export_total_kwh,v_gas_total_m3,'unverified')
 on conflict(household_id,integration_id,source_event_id) where source_event_id is not null
 do update set measured_at=excluded.measured_at,grid_import_w=excluded.grid_import_w,grid_export_w=excluded.grid_export_w,
  grid_import_total_kwh=excluded.grid_import_total_kwh,grid_export_total_kwh=excluded.grid_export_total_kwh,gas_total_m3=excluded.gas_total_m3,quality='unverified'
 returning id into v_measurement_id;

 update public.integrations set status='connected',connected_at=coalesce(connected_at,pg_catalog.now()),
 last_seen_at=pg_catalog.now(),last_error_code=null,updated_at=pg_catalog.now()
 where id=v_integration_id;
 return pg_catalog.jsonb_build_object('accepted',true,'integration_id',v_integration_id,'measurement_id',v_measurement_id,'measured_at',v_measured_at);
end; $$;

notify pgrst,'reload schema';
