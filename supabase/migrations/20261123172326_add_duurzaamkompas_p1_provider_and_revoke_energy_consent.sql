alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
 check(provider in ('home_assistant','homewizard','duurzaamkompas_p1','homey','other'));
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
notify pgrst,'reload schema';
