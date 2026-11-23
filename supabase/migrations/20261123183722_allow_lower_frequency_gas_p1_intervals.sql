-- Give gas-only measurement intervals up to two hours while keeping electricity/power intervals at 15 minutes.
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
notify pgrst,'reload schema';
