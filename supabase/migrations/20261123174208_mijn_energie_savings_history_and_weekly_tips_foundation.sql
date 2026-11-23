-- Personal baselines, savings periods, weekly tips and append-only tip actions.
create table public.energy_baselines (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 fuel_type text not null check(fuel_type in ('electricity_import','electricity_total','gas')),
 baseline_method text not null check(baseline_method in ('measured_history','profile_estimate','manual')),
 reference_start date, reference_end date, model_version text not null,
 base_daily_value numeric(16,6), weather_coefficient numeric(16,8), occupants_baseline numeric(6,2),
 equipment_snapshot jsonb not null default '{}'::jsonb,
 model_parameters jsonb not null default '{}'::jsonb,
 coverage_ratio numeric(5,4) not null default 0 check(coverage_ratio between 0 and 1),
 quality_score integer not null default 0 check(quality_score between 0 and 100),
 quality_label text not null default 'insufficient' check(quality_label in ('insufficient','indicative','good')),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint energy_baselines_reference_window check((reference_start is null and reference_end is null) or (reference_start is not null and reference_end is not null and reference_end>=reference_start))
);
create unique index energy_baselines_active_household_fuel on public.energy_baselines(household_id,fuel_type) where is_active;
create index energy_baselines_household on public.energy_baselines(household_id,created_at desc);
alter table public.energy_baselines enable row level security;
create policy energy_baselines_select_members on public.energy_baselines for select to authenticated using(private.is_household_member(household_id));
grant select on public.energy_baselines to authenticated;

create table public.energy_savings_periods (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 period_type text not null check(period_type in ('week','month','year')),
 period_start date not null, period_end date not null,
 electricity_baseline_id uuid references public.energy_baselines(id) on delete set null,
 gas_baseline_id uuid references public.energy_baselines(id) on delete set null,
 actual_grid_import_kwh numeric(16,6), reference_grid_import_kwh numeric(16,6), grid_import_difference_kwh numeric(16,6),
 actual_gas_m3 numeric(16,6), reference_gas_m3 numeric(16,6), gas_difference_m3 numeric(16,6),
 estimated_variable_cost_difference_eur numeric(14,4),
 cost_method text not null default 'unavailable' check(cost_method in ('unavailable','fixed_rate','interval_rate','indicative')),
 calculation_details jsonb not null default '{}'::jsonb,
 coverage_ratio numeric(5,4) not null default 0 check(coverage_ratio between 0 and 1),
 quality_score integer not null default 0 check(quality_score between 0 and 100),
 quality_label text not null default 'insufficient' check(quality_label in ('insufficient','indicative','good')),
 model_version text not null, computed_at timestamptz not null default now(), created_at timestamptz not null default now(),
 constraint energy_savings_period_window check(period_end>=period_start),
 unique(household_id,period_type,period_start,model_version)
);
create index energy_savings_periods_household_period on public.energy_savings_periods(household_id,period_start desc);
alter table public.energy_savings_periods enable row level security;
create policy energy_savings_select_members on public.energy_savings_periods for select to authenticated using(private.is_household_member(household_id));
grant select on public.energy_savings_periods to authenticated;

create table public.household_weekly_tips (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 week_start date not null, tip_code text not null,
 title text not null, summary text not null, why_this_tip text not null, action_text text not null,
 expected_effect text,
 cost_band text not null default 'unknown' check(cost_band in ('none','low','medium','high','unknown')),
 effort_band text not null default 'easy' check(effort_band in ('easy','moderate','high')),
 source_name text, source_url text, source_checked_at date,
 context_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'new' check(status in ('new','saved','accepted','completed','dismissed','snoozed')),
 completed_at timestamptz, dismissed_at timestamptz, created_at timestamptz not null default now(),
 unique(household_id,week_start)
);
create index household_weekly_tips_household_week on public.household_weekly_tips(household_id,week_start desc);
alter table public.household_weekly_tips enable row level security;
create policy household_weekly_tips_select_members on public.household_weekly_tips for select to authenticated using(private.is_household_member(household_id));
grant select on public.household_weekly_tips to authenticated;

create table public.energy_tip_events (
 id bigint generated always as identity primary key,
 tip_id uuid not null references public.household_weekly_tips(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_type text not null check(event_type in ('saved','accepted','completed','dismissed','snoozed')),
 note text, created_at timestamptz not null default now()
);
create index energy_tip_events_household_time on public.energy_tip_events(household_id,created_at desc);
alter table public.energy_tip_events enable row level security;
create policy energy_tip_events_select_members on public.energy_tip_events for select to authenticated using(private.is_household_member(household_id));
grant select on public.energy_tip_events to authenticated;

create table private.energy_tip_catalog (
 tip_code text primary key, category text not null, title text not null, summary text not null,
 why_template text not null, action_text text not null, expected_effect_template text,
 trigger_type text not null, trigger_parameters jsonb not null default '{}'::jsonb,
 cost_band text not null default 'unknown', effort_band text not null default 'easy',
 source_name text, source_url text, source_checked_at date, enabled boolean not null default false,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.energy_tip_catalog enable row level security;
create policy energy_tip_catalog_deny_client_access on private.energy_tip_catalog for all to public using(false) with check(false);

create table private.energy_calculation_factors (
 id uuid primary key default gen_random_uuid(),
 factor_type text not null check(factor_type in ('electricity_variable_price','gas_variable_price','electricity_emission','gas_emission','heating_degree_days')),
 fuel_type text not null check(fuel_type in ('electricity','gas','weather')),
 unit text not null, factor_value numeric(18,8) not null,
 valid_from date not null, valid_until date,
 source_name text not null, source_url text not null, methodology text,
 verified_at timestamptz not null, created_at timestamptz not null default now(),
 constraint energy_factor_validity check(valid_until is null or valid_until>=valid_from)
);
create index energy_calculation_factors_validity on private.energy_calculation_factors(factor_type,valid_from desc);
alter table private.energy_calculation_factors enable row level security;
create policy energy_calculation_factors_deny_client_access on private.energy_calculation_factors for all to public using(false) with check(false);

create table private.energy_model_versions (
 model_name text not null, version text not null, definition jsonb not null,
 is_active boolean not null default false, approved_by uuid references auth.users(id),
 approved_at timestamptz, created_at timestamptz not null default now(),
 primary key(model_name,version)
);
alter table private.energy_model_versions enable row level security;
create policy energy_model_versions_deny_client_access on private.energy_model_versions for all to public using(false) with check(false);

grant all on private.energy_tip_catalog to service_role;
grant all on private.energy_calculation_factors to service_role;
grant all on public.energy_baselines to service_role;
grant all on public.energy_savings_periods to service_role;
grant all on public.household_weekly_tips to service_role;
grant all on public.energy_tip_events to service_role;
grant usage,select on sequence public.energy_tip_events_id_seq to service_role;

create or replace function private.set_my_weekly_tip_status(p_tip_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_household_id uuid; v_status text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_status,'')));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if v_status not in ('saved','accepted','completed','dismissed','snoozed') then raise exception 'Invalid tip status'; end if;
 select household_id into v_household_id from public.household_weekly_tips where id=p_tip_id;
 if v_household_id is null or not private.is_household_member(v_household_id) then raise exception 'Tip not found or not permitted'; end if;
 update public.household_weekly_tips set status=v_status,
  completed_at=case when v_status='completed' then coalesce(completed_at,pg_catalog.now()) else completed_at end,
  dismissed_at=case when v_status='dismissed' then coalesce(dismissed_at,pg_catalog.now()) else dismissed_at end
 where id=p_tip_id;
 insert into public.energy_tip_events(tip_id,household_id,user_id,event_type,note)
 values(p_tip_id,v_household_id,auth.uid(),v_status,nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_note,'')),500),''));
 return true;
end; $$;
revoke all on function private.set_my_weekly_tip_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function private.set_my_weekly_tip_status(uuid,text,text) to authenticated;
create or replace function public.set_my_weekly_tip_status(p_tip_id uuid,p_status text,p_note text default null)
returns boolean language sql security invoker set search_path='' as $$
 select private.set_my_weekly_tip_status(p_tip_id,p_status,p_note);
$$;
revoke all on function public.set_my_weekly_tip_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_my_weekly_tip_status(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
