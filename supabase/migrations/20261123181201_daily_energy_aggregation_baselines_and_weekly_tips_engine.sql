-- Reproducible source for the daily energy engine, weekly tip selection and platform admin.
alter table public.energy_aggregates
  add column if not exists grid_coverage_ratio numeric(5,4)
    check (grid_coverage_ratio is null or grid_coverage_ratio between 0 and 1),
  add column if not exists gas_coverage_ratio numeric(5,4)
    check (gas_coverage_ratio is null or gas_coverage_ratio between 0 and 1);

alter table private.energy_tip_catalog
  add column if not exists priority integer not null default 100,
  add column if not exists requires_measurement boolean not null default false;

create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  granted_by text not null default 'initial-project-owner'
);
alter table private.platform_admins enable row level security;
drop policy if exists platform_admins_deny_client_access on private.platform_admins;
create policy platform_admins_deny_client_access on private.platform_admins
  for all to public using (false) with check (false);
revoke all on table private.platform_admins from public,anon,authenticated,service_role;
grant usage on schema private to authenticated,service_role;

insert into private.platform_admins(user_id)
select hm.user_id from public.household_members hm
where hm.role='owner' order by hm.joined_at asc limit 1
on conflict(user_id) do nothing;

CREATE OR REPLACE FUNCTION private.admin_list_energy_factors()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.factor_type,f.valid_from desc) from private.energy_calculation_factors f),'[]'::jsonb);
end;
$function$

CREATE OR REPLACE FUNCTION private.admin_list_energy_tips()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.priority,c.tip_code) from private.energy_tip_catalog c),'[]'::jsonb);
end;
$function$

CREATE OR REPLACE FUNCTION private.admin_run_energy_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
  return private.run_energy_analytics();
end;
$function$

CREATE OR REPLACE FUNCTION private.admin_save_energy_factor(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_factor_type text; v_fuel_type text; v_valid_from date; v_id uuid;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid factor payload'; end if;
  v_factor_type:=coalesce(p_payload->>'factor_type','');
  v_fuel_type:=coalesce(p_payload->>'fuel_type','');
  v_valid_from:=(p_payload->>'valid_from')::date;
  if coalesce(p_payload->>'source_url','') !~ '^https://' then raise exception 'Factor source must use HTTPS'; end if;
  if v_factor_type not in ('electricity_variable_price','gas_variable_price','electricity_emission','gas_emission','heating_degree_days')
     or v_fuel_type not in ('electricity','gas','weather') then raise exception 'Unsupported factor type'; end if;

  update private.energy_calculation_factors set valid_until=v_valid_from-1
  where factor_type=v_factor_type and fuel_type=v_fuel_type
    and valid_from<v_valid_from and valid_until is null;

  insert into private.energy_calculation_factors(
    factor_type,fuel_type,unit,factor_value,valid_from,valid_until,source_name,source_url,methodology,verified_at
  ) values (
    v_factor_type,v_fuel_type,left(coalesce(p_payload->>'unit',''),30),
    (p_payload->>'factor_value')::numeric,v_valid_from,
    case when coalesce(p_payload->>'valid_until','')='' then null else (p_payload->>'valid_until')::date end,
    left(coalesce(p_payload->>'source_name',''),120),p_payload->>'source_url',
    nullif(left(coalesce(p_payload->>'methodology',''),1000),''),now()
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'factor_type',v_factor_type,'valid_from',v_valid_from);
end;
$function$

CREATE OR REPLACE FUNCTION private.admin_save_energy_tip(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text; v_source text; v_saved private.energy_tip_catalog%rowtype;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid tip payload'; end if;
  v_code:=lower(btrim(coalesce(p_payload->>'tip_code','')));
  if v_code !~ '^[a-z0-9_]{3,64}$' then raise exception 'tip_code must contain 3-64 lowercase letters, digits or underscores'; end if;
  v_source:=nullif(btrim(coalesce(p_payload->>'source_url','')),'');
  if v_source is not null and v_source !~ '^https://' then raise exception 'Tip source must use HTTPS'; end if;
  if length(btrim(coalesce(p_payload->>'title','')))<3
     or length(btrim(coalesce(p_payload->>'summary','')))<10
     or length(btrim(coalesce(p_payload->>'action_text','')))<5 then
    raise exception 'Title, summary and action are required';
  end if;
  insert into private.energy_tip_catalog(
    tip_code,category,title,summary,why_template,action_text,expected_effect_template,
    trigger_type,trigger_parameters,cost_band,effort_band,source_name,source_url,
    source_checked_at,enabled,priority,requires_measurement,version,updated_at
  ) values (
    v_code,coalesce(nullif(p_payload->>'category',''),'general'),
    left(btrim(p_payload->>'title'),120),left(btrim(p_payload->>'summary'),800),
    coalesce(nullif(p_payload->>'why_template',''),'Deze tip is geselecteerd op basis van je huishoudenprofiel.'),
    left(btrim(p_payload->>'action_text'),500),nullif(left(coalesce(p_payload->>'expected_effect_template',''),500),''),
    coalesce(nullif(p_payload->>'trigger_type',''),'profile_general'),
    case when jsonb_typeof(p_payload->'trigger_parameters')='object' then p_payload->'trigger_parameters' else '{}'::jsonb end,
    coalesce(nullif(p_payload->>'cost_band',''),'unknown'),coalesce(nullif(p_payload->>'effort_band',''),'easy'),
    nullif(left(coalesce(p_payload->>'source_name',''),100),''),
    v_source,
    case when coalesce(p_payload->>'source_checked_at','')='' then null else (p_payload->>'source_checked_at')::date end,
    coalesce((p_payload->>'enabled')::boolean,false),coalesce((p_payload->>'priority')::integer,100),
    coalesce((p_payload->>'requires_measurement')::boolean,false),coalesce((p_payload->>'version')::integer,1),now()
  )
  on conflict(tip_code) do update set
    category=excluded.category,title=excluded.title,summary=excluded.summary,why_template=excluded.why_template,
    action_text=excluded.action_text,expected_effect_template=excluded.expected_effect_template,
    trigger_type=excluded.trigger_type,trigger_parameters=excluded.trigger_parameters,
    cost_band=excluded.cost_band,effort_band=excluded.effort_band,source_name=excluded.source_name,
    source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,enabled=excluded.enabled,
    priority=excluded.priority,requires_measurement=excluded.requires_measurement,
    version=excluded.version,updated_at=now()
  returning * into v_saved;
  return to_jsonb(v_saved);
end;
$function$

CREATE OR REPLACE FUNCTION private.compute_energy_savings_period(p_household_id uuid, p_period_type text, p_period_start date, p_period_end date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_period_days integer:=p_period_end-p_period_start+1;
  v_actual_days integer:=0; v_baseline_days integer:=0; v_min_weekday integer:=0; v_weekday_groups integer:=0;
  v_actual_kwh numeric; v_reference_kwh numeric; v_gas_actual numeric;
  v_coverage numeric; v_weekday_values jsonb; v_weekday_counts jsonb;
  v_baseline_start date; v_baseline_end date; v_baseline_avg numeric; v_baseline_coverage numeric;
  v_baseline_id uuid; v_quality integer; v_label text; v_details jsonb;
begin
  if p_period_type not in ('week','month','year') or p_period_end<p_period_start then raise exception 'Invalid savings period'; end if;

  select
    count(*) filter(where grid_import_kwh is not null and coalesce(grid_coverage_ratio,0)>=0.8),
    sum(grid_import_kwh) filter(where grid_import_kwh is not null and coalesce(grid_coverage_ratio,0)>=0.8),
    sum(gas_m3) filter(where gas_m3 is not null and coalesce(gas_coverage_ratio,0)>=0.8)
  into v_actual_days,v_actual_kwh,v_gas_actual
  from public.energy_aggregates
  where household_id=p_household_id and resolution='day'
    and bucket_start>=(p_period_start::timestamp at time zone 'Europe/Amsterdam')
    and bucket_start<((p_period_end+1)::timestamp at time zone 'Europe/Amsterdam');

  if coalesce(v_actual_days,0)=0 and v_gas_actual is null then return false; end if;
  v_coverage:=case when v_period_days>0 then v_actual_days::numeric/v_period_days else 0 end;

  with valid_days as (
    select (bucket_start at time zone 'Europe/Amsterdam')::date local_day,
      grid_import_kwh,grid_coverage_ratio,row_number() over(order by bucket_start desc) rn
    from public.energy_aggregates
    where household_id=p_household_id and resolution='day'
      and grid_import_kwh is not null and coalesce(grid_coverage_ratio,0)>=0.8
      and bucket_start>=((p_period_start-56)::timestamp at time zone 'Europe/Amsterdam')
      and bucket_start<(p_period_start::timestamp at time zone 'Europe/Amsterdam')
  ), recent as (select * from valid_days where rn<=28),
  weekdays as (
    select extract(isodow from local_day)::integer dow,avg(grid_import_kwh) avg_kwh,count(*)::integer sample_count
    from recent group by 1
  )
  select
    (select count(*) from recent),
    (select min(sample_count) from weekdays),
    (select count(*) from weekdays),
    (select min(local_day) from recent),
    (select max(local_day) from recent),
    (select avg(grid_import_kwh) from recent),
    (select avg(grid_coverage_ratio) from recent),
    (select jsonb_object_agg(dow::text,round(avg_kwh,4)) from weekdays),
    (select jsonb_object_agg(dow::text,sample_count) from weekdays)
  into v_baseline_days,v_min_weekday,v_weekday_groups,v_baseline_start,v_baseline_end,
       v_baseline_avg,v_baseline_coverage,v_weekday_values,v_weekday_counts;

  if coalesce(v_baseline_days,0)>=28 and coalesce(v_min_weekday,0)>=3
     and v_weekday_groups=7
     and coalesce(v_actual_days,0)>=ceil(v_period_days*0.8) then
    select sum((v_weekday_values->>(extract(isodow from d)::integer)::text)::numeric)
    into v_reference_kwh
    from generate_series(p_period_start,p_period_end,interval '1 day') d
    where v_weekday_values ? (extract(isodow from d)::integer)::text;

    insert into public.energy_baselines(
      household_id,fuel_type,baseline_method,reference_start,reference_end,model_version,
      base_daily_value,model_parameters,coverage_ratio,quality_score,quality_label,is_active
    ) values (
      p_household_id,'electricity_import','measured_history',v_baseline_start,v_baseline_end,
      'dk-energy-v1.0',v_baseline_avg,
      jsonb_build_object(
        'weekday_average_kwh',v_weekday_values,'weekday_sample_count',v_weekday_counts,
        'valid_days',v_baseline_days,'target_period_start',p_period_start,
        'target_period_end',p_period_end,'method','trailing_28_valid_days_split_by_iso_weekday',
        'measure_boundary','grid_import_only'
      ),v_baseline_coverage,70,'indicative',false
    ) returning id into v_baseline_id;
  end if;

  v_quality:=least(100,round(coalesce(v_coverage,0)*100)::integer);
  v_label:=case when coalesce(v_coverage,0)>=0.8 and v_baseline_id is not null then 'indicative' else 'insufficient' end;
  v_details:=jsonb_build_object(
    'formula','sum(reference_kwh_by_iso_weekday - measured_grid_import_kwh)',
    'valid_actual_days',coalesce(v_actual_days,0),'period_days',v_period_days,
    'baseline_valid_days',coalesce(v_baseline_days,0),
    'weekday_reference_kwh',v_weekday_values,'weekday_samples',v_weekday_counts,
    'measure_boundary','grid_import_only',
    'interpretation','A change in grid import is not necessarily a change in total household electricity consumption when solar generation or batteries are present.',
    'weather_normalisation','not_yet_applied'
  );

  insert into public.energy_savings_periods(
    household_id,period_type,period_start,period_end,electricity_baseline_id,gas_baseline_id,
    actual_grid_import_kwh,reference_grid_import_kwh,grid_import_difference_kwh,
    actual_gas_m3,reference_gas_m3,gas_difference_m3,
    estimated_variable_cost_difference_eur,cost_method,calculation_details,
    coverage_ratio,quality_score,quality_label,model_version,computed_at
  ) values (
    p_household_id,p_period_type,p_period_start,p_period_end,v_baseline_id,null,
    v_actual_kwh,v_reference_kwh,
    case when v_reference_kwh is not null and v_actual_kwh is not null then v_reference_kwh-v_actual_kwh else null end,
    v_gas_actual,null,null,null,'unavailable',v_details,v_coverage,v_quality,v_label,'dk-energy-v1.0',now()
  )
  on conflict(household_id,period_type,period_start,model_version) do update set
    period_end=excluded.period_end,electricity_baseline_id=excluded.electricity_baseline_id,
    actual_grid_import_kwh=excluded.actual_grid_import_kwh,
    reference_grid_import_kwh=excluded.reference_grid_import_kwh,
    grid_import_difference_kwh=excluded.grid_import_difference_kwh,
    actual_gas_m3=excluded.actual_gas_m3,reference_gas_m3=excluded.reference_gas_m3,
    gas_difference_m3=excluded.gas_difference_m3,
    estimated_variable_cost_difference_eur=excluded.estimated_variable_cost_difference_eur,
    cost_method=excluded.cost_method,calculation_details=excluded.calculation_details,
    coverage_ratio=excluded.coverage_ratio,quality_score=excluded.quality_score,
    quality_label=excluded.quality_label,computed_at=now();

  return true;
end;
$function$

CREATE OR REPLACE FUNCTION private.generate_weekly_energy_tips()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h record; v_today date:=(now() at time zone 'Europe/Amsterdam')::date;
  v_week_start date; v_tip record; v_reason text; v_count integer:=0;
  v_peak numeric; v_export numeric;
begin
  v_week_start:=v_today-(extract(isodow from v_today)::integer-1);
  for h in
    select hh.id household_id,hp.home_type,hp.residents_band,hp.floor_area_m2,hp.build_period,
      hp.insulation_level,hp.heating_type,hp.solar_installed,hp.solar_capacity_kwp,
      hp.battery_installed,hp.ev_installed,hp.heat_pump_installed,hp.smart_control_installed,
      hp.energy_contract_type
    from public.households hh left join public.home_profiles hp on hp.household_id=hh.id
  loop
    if exists(select 1 from public.household_weekly_tips t where t.household_id=h.household_id and t.week_start=v_week_start) then
      continue;
    end if;

    select max(e.peak_import_kw),sum(e.grid_export_kwh) into v_peak,v_export
    from public.energy_aggregates e
    where e.household_id=h.household_id and e.resolution='day'
      and e.bucket_start>=((v_today-14)::timestamp at time zone 'Europe/Amsterdam')
      and e.bucket_start<(v_today::timestamp at time zone 'Europe/Amsterdam');

    select c.* into v_tip
    from private.energy_tip_catalog c
    where c.enabled
      and (not c.requires_measurement or exists(
        select 1 from public.energy_aggregates a where a.household_id=h.household_id
          and a.resolution='day' and a.bucket_start>=((v_today-28)::timestamp at time zone 'Europe/Amsterdam')
      ))
      and case c.trigger_type
        when 'profile_solar' then coalesce(h.solar_installed,false) and not coalesce(h.battery_installed,false)
        when 'profile_solar_ev' then coalesce(h.solar_installed,false) and coalesce(h.ev_installed,false)
        when 'profile_partial_insulation_gas' then
          coalesce(h.insulation_level,'') in ('Beperkt of onbekend','Gedeeltelijk geïsoleerd')
          and coalesce(h.heating_type,'') ilike '%gas%'
        when 'profile_gas_heating' then coalesce(h.heating_type,'') ilike '%gas%'
        when 'profile_heat_pump' then coalesce(h.heat_pump_installed,false)
        when 'measured_peak' then coalesce(v_peak,0)>=coalesce((c.trigger_parameters->>'min_peak_kw')::numeric,4)
        when 'measured_export' then coalesce(v_export,0)>=coalesce((c.trigger_parameters->>'min_export_kwh')::numeric,1)
        when 'profile_general' then true
        else false
      end
      and not exists(
        select 1 from public.household_weekly_tips old
        where old.household_id=h.household_id and old.tip_code=c.tip_code
          and old.week_start>=v_week_start-84
      )
    order by c.priority,c.tip_code limit 1;

    if v_tip.tip_code is null then continue; end if;

    v_reason:=case v_tip.trigger_type
      when 'profile_solar' then 'Je woningprofiel vermeldt zonnepanelen. Daarom kijken we hoe je meer eigen zonnestroom direct kunt gebruiken.'
      when 'profile_solar_ev' then 'Je hebt zonnepanelen en een elektrische auto. Laden op momenten met eigen opwek kan het eigen verbruik verhogen.'
      when 'profile_partial_insulation_gas' then 'Je profiel vermeldt gedeeltelijke isolatie en gasverwarming. Daarom richten we de tip op warmteverlies en slimmer verwarmen.'
      when 'profile_gas_heating' then 'Je woningprofiel vermeldt gasverwarming. Daarom is deze tip gericht op het beperken van warmtevraag.'
      when 'profile_heat_pump' then 'Je profiel vermeldt een warmtepomp. De tip is afgestemd op elektrisch en efficiënt verwarmen.'
      when 'measured_peak' then 'Je recente meetgegevens laten een relatief hoge piek in netafname zien.'
      when 'measured_export' then 'Je recente meetgegevens laten teruglevering zien. Er kan ruimte zijn om geschikte apparaten op zonnige momenten te gebruiken.'
      else 'Deze laagdrempelige actie past bij veel huishoudens en vraagt geen grote investering.'
    end;

    insert into public.household_weekly_tips(
      household_id,week_start,tip_code,title,summary,why_this_tip,action_text,
      expected_effect,cost_band,effort_band,source_name,source_url,source_checked_at,
      context_snapshot,status
    ) values (
      h.household_id,v_week_start,v_tip.tip_code,v_tip.title,v_tip.summary,v_reason,
      v_tip.action_text,v_tip.expected_effect_template,v_tip.cost_band,v_tip.effort_band,
      v_tip.source_name,v_tip.source_url,v_tip.source_checked_at,
      jsonb_build_object(
        'trigger_type',v_tip.trigger_type,'solar_installed',coalesce(h.solar_installed,false),
        'heating_type',h.heating_type,'insulation_level',h.insulation_level,
        'peak_import_kw',v_peak,'recent_export_kwh',v_export
      ),'new'
    ) on conflict(household_id,week_start) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$function$

CREATE OR REPLACE FUNCTION private.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from private.platform_admins pa where pa.user_id=auth.uid());
$function$

CREATE OR REPLACE FUNCTION private.process_energy_daily_aggregates(p_days integer DEFAULT 70)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rows integer:=0;
  v_local_today date:=(now() at time zone 'Europe/Amsterdam')::date;
begin
  if p_days<2 or p_days>120 then raise exception 'p_days must be between 2 and 120'; end if;
  with day_windows as (
    select g::date local_day,
      (g::date::timestamp at time zone 'Europe/Amsterdam') day_start,
      ((g::date+1)::timestamp at time zone 'Europe/Amsterdam') day_end
    from generate_series((v_local_today-p_days)::timestamp,(v_local_today-1)::timestamp,interval '1 day') g
  ),
  raw as (
    select m.id,m.household_id,m.integration_id,m.measured_at,
      m.grid_import_w,m.grid_export_w,m.grid_import_total_kwh,m.grid_export_total_kwh,m.gas_total_m3,
      lag(m.measured_at) over w prev_at,
      lag(m.grid_import_w) over w prev_import_w,
      lag(m.grid_export_w) over w prev_export_w,
      lag(m.grid_import_total_kwh) over w prev_import_total,
      lag(m.grid_export_total_kwh) over w prev_export_total,
      lag(m.gas_total_m3) over w prev_gas_total
    from public.energy_measurements m
    where m.integration_id is not null
      and m.measured_at >= ((v_local_today-p_days-1)::timestamp at time zone 'Europe/Amsterdam')
      and m.measured_at < (v_local_today::timestamp at time zone 'Europe/Amsterdam')
      and m.quality in ('unverified','validated')
    window w as (partition by m.household_id,m.integration_id order by m.measured_at,m.id)
  ),
  intervals as (
    select r.household_id,r.integration_id,r.prev_at,r.measured_at,
      extract(epoch from (r.measured_at-r.prev_at))::numeric seconds,
      case
        when r.grid_import_total_kwh is not null and r.prev_import_total is not null
          and r.grid_import_total_kwh>=r.prev_import_total
          and r.grid_import_total_kwh-r.prev_import_total<=10
          and extract(epoch from (r.measured_at-r.prev_at))<=900
          then r.grid_import_total_kwh-r.prev_import_total
        when r.grid_import_w is not null and r.prev_import_w is not null
          and r.grid_import_w>=0 and r.prev_import_w>=0
          and extract(epoch from (r.measured_at-r.prev_at))<=900
          then ((r.grid_import_w+r.prev_import_w)/2.0)
            * extract(epoch from (r.measured_at-r.prev_at))/3600000.0
        else null end import_kwh,
      case
        when r.grid_export_total_kwh is not null and r.prev_export_total is not null
          and r.grid_export_total_kwh>=r.prev_export_total
          and r.grid_export_total_kwh-r.prev_export_total<=10
          and extract(epoch from (r.measured_at-r.prev_at))<=900
          then r.grid_export_total_kwh-r.prev_export_total
        when r.grid_export_w is not null and r.prev_export_w is not null
          and r.grid_export_w>=0 and r.prev_export_w>=0
          and extract(epoch from (r.measured_at-r.prev_at))<=900
          then ((r.grid_export_w+r.prev_export_w)/2.0)
            * extract(epoch from (r.measured_at-r.prev_at))/3600000.0
        else null end export_kwh,
      case
        when r.gas_total_m3 is not null and r.prev_gas_total is not null
          and r.gas_total_m3>=r.prev_gas_total
          and r.gas_total_m3-r.prev_gas_total<=1.2
          then r.gas_total_m3-r.prev_gas_total
        else null end gas_m3
    from raw r
    where r.prev_at is not null and r.measured_at>r.prev_at
      and extract(epoch from (r.measured_at-r.prev_at))<=7200
  ),
  interval_day_parts as (
    select i.household_id,i.integration_id,d.local_day,
      i.import_kwh*(o.overlap_seconds/nullif(i.seconds,0)) import_kwh,
      i.export_kwh*(o.overlap_seconds/nullif(i.seconds,0)) export_kwh,
      i.gas_m3*(o.overlap_seconds/nullif(i.seconds,0)) gas_m3,
      case when i.import_kwh is not null or i.export_kwh is not null then o.overlap_seconds else 0 end grid_seconds,
      case when i.gas_m3 is not null then o.overlap_seconds else 0 end gas_seconds
    from intervals i
    join day_windows d on i.measured_at>d.day_start and i.prev_at<d.day_end
    cross join lateral (
      select greatest(0,extract(epoch from (
        least(i.measured_at,d.day_end)-greatest(i.prev_at,d.day_start)
      )))::numeric overlap_seconds
    ) o
    where o.overlap_seconds>0
  ),
  daily_by_source as (
    select household_id,integration_id,local_day,
      sum(import_kwh) filter(where import_kwh is not null) grid_import_kwh,
      sum(export_kwh) filter(where export_kwh is not null) grid_export_kwh,
      sum(gas_m3) filter(where gas_m3 is not null) gas_m3,
      sum(grid_seconds) grid_seconds,sum(gas_seconds) gas_seconds
    from interval_day_parts
    group by household_id,integration_id,local_day
  ),
  power_peaks as (
    select m.household_id,m.integration_id,
      (m.measured_at at time zone 'Europe/Amsterdam')::date local_day,
      max(m.grid_import_w)/1000.0 peak_import_kw
    from public.energy_measurements m
    where m.integration_id is not null and m.grid_import_w is not null
      and m.measured_at>=((v_local_today-p_days)::timestamp at time zone 'Europe/Amsterdam')
      and m.measured_at<(v_local_today::timestamp at time zone 'Europe/Amsterdam')
    group by m.household_id,m.integration_id,(m.measured_at at time zone 'Europe/Amsterdam')::date
  ),
  scored as (
    select d.*,
      least(1.0,d.grid_seconds/nullif(extract(epoch from (
        ((d.local_day+1)::timestamp at time zone 'Europe/Amsterdam')
        -(d.local_day::timestamp at time zone 'Europe/Amsterdam')
      )),0)) grid_coverage,
      least(1.0,d.gas_seconds/nullif(extract(epoch from (
        ((d.local_day+1)::timestamp at time zone 'Europe/Amsterdam')
        -(d.local_day::timestamp at time zone 'Europe/Amsterdam')
      )),0)) gas_coverage,
      pp.peak_import_kw
    from daily_by_source d left join power_peaks pp
      on pp.household_id=d.household_id and pp.integration_id=d.integration_id and pp.local_day=d.local_day
  ),
  ranked_grid as (
    select s.*,row_number() over (
      partition by household_id,local_day
      order by coalesce(grid_coverage,0) desc,
        (grid_import_kwh is not null)::integer+(grid_export_kwh is not null)::integer desc
    ) rn
    from scored s where grid_seconds>0
  ),
  ranked_gas as (
    select s.*,row_number() over (
      partition by household_id,local_day order by coalesce(gas_coverage,0) desc,gas_seconds desc
    ) rn
    from scored s where gas_seconds>0
  ),
  household_days as (select household_id,local_day from scored group by household_id,local_day),
  chosen as (
    select h.household_id,h.local_day,
      g.grid_import_kwh,g.grid_export_kwh,g.peak_import_kw,g.grid_coverage,
      gas.gas_m3,gas.gas_coverage
    from household_days h
    left join ranked_grid g on g.household_id=h.household_id and g.local_day=h.local_day and g.rn=1
    left join ranked_gas gas on gas.household_id=h.household_id and gas.local_day=h.local_day and gas.rn=1
  )
  insert into public.energy_aggregates(
    household_id,resolution,bucket_start,grid_import_kwh,grid_export_kwh,gas_m3,
    peak_import_kw,own_generation_kwh,self_consumption_ratio,coverage_ratio,quality,
    grid_coverage_ratio,gas_coverage_ratio
  )
  select c.household_id,'day',(c.local_day::timestamp at time zone 'Europe/Amsterdam'),
    c.grid_import_kwh,c.grid_export_kwh,c.gas_m3,c.peak_import_kw,null,null,
    greatest(coalesce(c.grid_coverage,0),coalesce(c.gas_coverage,0)),
    case when greatest(coalesce(c.grid_coverage,0),coalesce(c.gas_coverage,0))>=0.8 then 'unverified' else 'incomplete' end,
    c.grid_coverage,c.gas_coverage
  from chosen c
  where c.grid_import_kwh is not null or c.grid_export_kwh is not null or c.gas_m3 is not null
  on conflict(household_id,resolution,bucket_start) do update set
    grid_import_kwh=excluded.grid_import_kwh,grid_export_kwh=excluded.grid_export_kwh,
    gas_m3=excluded.gas_m3,peak_import_kw=excluded.peak_import_kw,
    coverage_ratio=excluded.coverage_ratio,quality=excluded.quality,
    grid_coverage_ratio=excluded.grid_coverage_ratio,gas_coverage_ratio=excluded.gas_coverage_ratio;

  get diagnostics v_rows=row_count;
  return v_rows;
end;
$function$

CREATE OR REPLACE FUNCTION private.refresh_active_energy_baselines()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_count integer:=0; h record; v_days integer; v_min_weekday integer; v_weekday_groups integer;
  v_start date; v_end date; v_average numeric; v_coverage numeric;
  v_weekday_values jsonb; v_weekday_counts jsonb;
begin
  for h in select distinct household_id from public.energy_aggregates
    where resolution='day' and grid_import_kwh is not null and coalesce(grid_coverage_ratio,0)>=0.8
  loop
    with valid_days as (
      select (bucket_start at time zone 'Europe/Amsterdam')::date local_day,
        grid_import_kwh,grid_coverage_ratio,
        row_number() over(order by bucket_start desc) rn
      from public.energy_aggregates
      where household_id=h.household_id and resolution='day'
        and grid_import_kwh is not null and coalesce(grid_coverage_ratio,0)>=0.8
        and bucket_start>=(((now() at time zone 'Europe/Amsterdam')::date-56)::timestamp at time zone 'Europe/Amsterdam')
        and bucket_start<((now() at time zone 'Europe/Amsterdam')::date::timestamp at time zone 'Europe/Amsterdam')
    ), recent as (select * from valid_days where rn<=28),
    weekdays as (
      select extract(isodow from local_day)::integer dow,avg(grid_import_kwh) avg_kwh,count(*)::integer sample_count
      from recent group by 1
    )
    select
      (select count(*) from recent),
      (select min(sample_count) from weekdays),
      (select count(*) from weekdays),
      (select min(local_day) from recent),
      (select max(local_day) from recent),
      (select avg(grid_import_kwh) from recent),
      (select avg(grid_coverage_ratio) from recent),
      (select jsonb_object_agg(dow::text,round(avg_kwh,4)) from weekdays),
      (select jsonb_object_agg(dow::text,sample_count) from weekdays)
    into v_days,v_min_weekday,v_weekday_groups,v_start,v_end,v_average,v_coverage,v_weekday_values,v_weekday_counts;

    if coalesce(v_days,0)>=28 and coalesce(v_min_weekday,0)>=3 and v_weekday_groups=7 then
      insert into public.energy_baselines(
        household_id,fuel_type,baseline_method,reference_start,reference_end,model_version,
        base_daily_value,model_parameters,coverage_ratio,quality_score,quality_label,is_active
      ) values (
        h.household_id,'electricity_import','measured_history',v_start,v_end,'dk-energy-v1.0',
        v_average,jsonb_build_object(
          'weekday_average_kwh',v_weekday_values,'weekday_sample_count',v_weekday_counts,
          'valid_days',v_days,'method','trailing_28_valid_days_split_by_iso_weekday',
          'measure_boundary','grid_import_only'
        ),v_coverage,70,'indicative',true
      )
      on conflict(household_id,fuel_type) where is_active do update set
        reference_start=excluded.reference_start,reference_end=excluded.reference_end,
        model_version=excluded.model_version,base_daily_value=excluded.base_daily_value,
        model_parameters=excluded.model_parameters,coverage_ratio=excluded.coverage_ratio,
        quality_score=excluded.quality_score,quality_label=excluded.quality_label,updated_at=now();
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;
$function$

CREATE OR REPLACE FUNCTION private.run_energy_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date:=(now() at time zone 'Europe/Amsterdam')::date;
  v_week_start date; v_month_start date; v_start date;
  v_daily_rows integer; v_baselines integer; v_periods integer:=0; v_tips integer;
  h record;
begin
  v_daily_rows:=private.process_energy_daily_aggregates(70);
  v_baselines:=private.refresh_active_energy_baselines();
  v_week_start:=v_today-(extract(isodow from v_today)::integer-1);

  for h in select id from public.households loop
    for v_start in select g::date from generate_series(v_week_start-84,v_week_start-7,interval '7 days') g loop
      if private.compute_energy_savings_period(h.id,'week',v_start,v_start+6) then v_periods:=v_periods+1; end if;
    end loop;
    v_month_start:=date_trunc('month',v_today::timestamp)::date;
    for v_start in select g::date from generate_series(
      (v_month_start-interval '12 months')::timestamp,
      (v_month_start-interval '1 month')::timestamp,interval '1 month'
    ) g loop
      if private.compute_energy_savings_period(h.id,'month',v_start,(v_start+interval '1 month - 1 day')::date) then
        v_periods:=v_periods+1;
      end if;
    end loop;
    for v_start in select g::date from generate_series(
      (date_trunc('year',v_today::timestamp)-interval '3 years')::timestamp,
      (date_trunc('year',v_today::timestamp)-interval '1 year')::timestamp,
      interval '1 year'
    ) g loop
      if private.compute_energy_savings_period(
        h.id,'year',v_start,(v_start+interval '1 year - 1 day')::date
      ) then
        v_periods:=v_periods+1;
      end if;
    end loop;
  end loop;

  v_tips:=private.generate_weekly_energy_tips();
  return jsonb_build_object(
    'daily_rows_upserted',v_daily_rows,'active_baselines_refreshed',v_baselines,
    'savings_periods_upserted',v_periods,'weekly_tips_created',v_tips,'ran_at',now()
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_list_energy_factors()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_list_energy_factors(); $function$

CREATE OR REPLACE FUNCTION public.admin_list_energy_tips()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_list_energy_tips(); $function$

CREATE OR REPLACE FUNCTION public.admin_run_energy_analytics()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_run_energy_analytics(); $function$

CREATE OR REPLACE FUNCTION public.admin_save_energy_factor(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_save_energy_factor(p_payload); $function$

CREATE OR REPLACE FUNCTION public.admin_save_energy_tip(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_save_energy_tip(p_payload); $function$

CREATE OR REPLACE FUNCTION public.is_my_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.is_platform_admin(); $function$

-- Internal functions must not be callable by ordinary API roles.
revoke all on function private.is_platform_admin() from public,anon,authenticated,service_role;
grant execute on function private.is_platform_admin() to authenticated;
revoke all on function public.is_my_platform_admin() from public,anon,authenticated,service_role;
grant execute on function public.is_my_platform_admin() to authenticated;

revoke all on function private.process_energy_daily_aggregates(integer) from public,anon,authenticated,service_role;
revoke all on function private.refresh_active_energy_baselines() from public,anon,authenticated,service_role;
revoke all on function private.compute_energy_savings_period(uuid,text,date,date) from public,anon,authenticated,service_role;
revoke all on function private.generate_weekly_energy_tips() from public,anon,authenticated,service_role;
revoke all on function private.run_energy_analytics() from public,anon,authenticated,service_role;
grant execute on function private.run_energy_analytics() to postgres;

revoke all on function private.admin_list_energy_tips() from public,anon,authenticated,service_role;
grant execute on function private.admin_list_energy_tips() to authenticated;
revoke all on function public.admin_list_energy_tips() from public,anon,authenticated,service_role;
grant execute on function public.admin_list_energy_tips() to authenticated;
revoke all on function private.admin_save_energy_tip(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.admin_save_energy_tip(jsonb) to authenticated;
revoke all on function public.admin_save_energy_tip(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_energy_tip(jsonb) to authenticated;
revoke all on function private.admin_list_energy_factors() from public,anon,authenticated,service_role;
grant execute on function private.admin_list_energy_factors() to authenticated;
revoke all on function public.admin_list_energy_factors() from public,anon,authenticated,service_role;
grant execute on function public.admin_list_energy_factors() to authenticated;
revoke all on function private.admin_save_energy_factor(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.admin_save_energy_factor(jsonb) to authenticated;
revoke all on function public.admin_save_energy_factor(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_energy_factor(jsonb) to authenticated;
revoke all on function private.admin_run_energy_analytics() from public,anon,authenticated,service_role;
grant execute on function private.admin_run_energy_analytics() to authenticated;
revoke all on function public.admin_run_energy_analytics() from public,anon,authenticated,service_role;
grant execute on function public.admin_run_energy_analytics() to authenticated;

insert into private.energy_tip_catalog(
  tip_code,category,title,summary,why_template,action_text,expected_effect_template,
  trigger_type,trigger_parameters,cost_band,effort_band,source_name,source_url,
  source_checked_at,enabled,version,priority,requires_measurement
) values
('avoid_peak_usage','electricity','Spreid grote stroomverbruikers','Start apparaten met een hoog vermogen liever na elkaar dan allemaal tegelijk. Zo beperk je onnodige gelijktijdige pieken.','De recente meetgegevens laten een relatief hoge piek in netafname zien.','Kies één moment waarop je grote apparaten na elkaar kunt laten draaien.','Kan de gelijktijdige piek verminderen. Dit is geen kWh-besparing zolang het totale energiegebruik gelijk blijft.','measured_peak','{"min_peak_kw":4}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/energiezuinig-wonen/energiezuinige-woning/','2026-11-23',true,1,15,true),
('cv_eco_setting','heating','Controleer de eco-stand van je cv-ketel','Veel combiketels hebben een eco- en comfortstand voor warm water. Controleer in de handleiding wat de eco-stand bij jouw toestel doet.','Je profiel vermeldt een cv-ketel op gas. De instelling voor warm tapwater kan daarom relevant zijn.','Zoek in de handleiding van je cv-ketel naar de eco-stand voor warm water. Verander geen instellingen waarvan je de werking niet kent.','Bij geschikte toestellen kan de eco-stand onnodig warmhouden beperken. Het effect verschilt per ketel en gebruik.','profile_gas_heating','{}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/verwarmen-met-gas/cv-ketel-onderhoud-en-instelling/','2026-11-23',true,1,50,false),
('draught_check','heating','Loop een rondje langs tocht en kieren','Controleer ramen, buitendeuren, de brievenbus en doorvoeren op voelbare tocht. Kleine kieren kun je vaak met geschikte tochtwering aanpakken.','Je profiel noemt een oudere woning met gedeeltelijke isolatie en gasverwarming. Daarom is het logisch eerst onnodig warmteverlies na te lopen.','Controleer deze week twee plekken waar je tocht voelt. Noteer wat je eenvoudig zelf kunt afdichten en wat je beter laat beoordelen.','Minder onnodig warmteverlies en mogelijk minder warmtevraag. Het effect hangt af van de gevonden kieren.','profile_partial_insulation_gas','{}'::jsonb,'low','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/duurzaam-verwarmen-en-koelen/hulp-bij-energie-besparen/','2026-11-23',true,1,20,false),
('heating_rooms','heating','Verwarm alleen de ruimtes die je gebruikt','Draai radiatoren lager in kamers waar niemand is en houd binnendeuren dicht. Kijk wat comfortabel blijft in jouw woning.','Je profiel vermeldt gasverwarming. Het beperken van onnodig verwarmde ruimtes is een praktische eerste stap.','Kies één kamer die weinig wordt gebruikt en controleer of de radiator daar lager kan, zonder comfort of vochtproblemen te veroorzaken.','Minder onnodige warmtevraag; de werkelijke gasverandering kunnen we pas met voldoende meterdata vergelijken.','profile_gas_heating','{}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/duurzaam-verwarmen-en-koelen/bespaartips-verwarming/','2026-11-23',true,1,30,false),
('shorter_shower','hot_water','Maak je douchebeurt iets korter','Een douchetimer of vaste playlist kan helpen om korter te douchen zonder dat het ingewikkeld wordt.','Je profiel vermeldt gasverwarming. Warm tapwater kan daardoor een relevant onderdeel van het gasverbruik zijn.','Probeer deze week één douchebeurt vijf minuten te houden en kijk of dat voor je werkt.','Minder warm water nodig. Het precieze gas- en watereffect hangt af van douchekop, temperatuur en uitgangssituatie.','profile_gas_heating','{}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/tests-en-tools/verduurzamen-doe-het-zelf/','2026-11-23',true,1,60,false),
('solar_shift_appliances','electricity','Haal meer uit je eigen zonnestroom','Plan een was- of vaatwasbeurt op een moment waarop je zonnepanelen stroom opwekken. Start grote apparaten liever na elkaar dan tegelijk.','Je woningprofiel vermeldt zonnepanelen. Daardoor kan het slim zijn om flexibel stroomgebruik te verplaatsen naar uren met eigen opwek.','Plan deze week één was- of vaatwasbeurt rond de zonnige uren en gebruik zo mogelijk de uitgestelde start.','Meer eigen zonnestroom direct gebruiken. De daadwerkelijke kWh-verandering wordt pas zichtbaar na aansluiting van meetgegevens.','profile_solar','{}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/zonnepanelen/verbruik-zelf-meer-zonnestroom/','2026-11-23',true,1,10,false),
('thermostat_routine','heating','Kijk of de thermostaat een graadje lager kan','Probeer een comfortabele instelling rond 19 graden wanneer je thuis bent en pas de nachtinstelling aan op je verwarmingssysteem. Bij vloerverwarming of een volledig elektrische warmtepomp gelden andere adviezen.','Je woningprofiel vermeldt gasverwarming. De juiste instelling verschilt per woning en verwarmingssysteem.','Bekijk deze week je dag- en nachtprogramma en probeer alleen een kleine aanpassing die comfortabel blijft.','Mogelijk minder gas voor ruimteverwarming. De uitkomst is afhankelijk van woning, weer en instellingen.','profile_gas_heating','{}'::jsonb,'none','easy','Milieu Centraal','https://www.milieucentraal.nl/energie-besparen/duurzaam-verwarmen-en-koelen/zuinige-verwarming/','2026-11-23',true,1,40,false)
on conflict(tip_code) do update set
  category=excluded.category,title=excluded.title,summary=excluded.summary,
  why_template=excluded.why_template,action_text=excluded.action_text,
  expected_effect_template=excluded.expected_effect_template,trigger_type=excluded.trigger_type,
  trigger_parameters=excluded.trigger_parameters,cost_band=excluded.cost_band,
  effort_band=excluded.effort_band,source_name=excluded.source_name,source_url=excluded.source_url,
  source_checked_at=excluded.source_checked_at,enabled=excluded.enabled,version=excluded.version,
  priority=excluded.priority,requires_measurement=excluded.requires_measurement,updated_at=now();

create extension if not exists pg_cron;
select cron.schedule('mijn-energie-daily-analytics','15 3 * * *','select private.run_energy_analytics();');
notify pgrst,'reload schema';
