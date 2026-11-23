-- Rebuild the analytics pipeline to include the last three complete annual periods.
create or replace function private.run_energy_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$
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
$$;
notify pgrst,'reload schema';
