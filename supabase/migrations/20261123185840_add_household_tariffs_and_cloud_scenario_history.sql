-- Added to the connected Supabase project as migration add_household_tariffs_and_cloud_scenario_history
create table if not exists public.household_energy_tariffs (
  household_id uuid primary key references public.households(id) on delete cascade,
  electricity_import_eur_per_kwh numeric(12,6),
  electricity_export_eur_per_kwh numeric(12,6),
  gas_eur_per_m3 numeric(12,6),
  contract_label text,
  tariff_type text not null default 'fixed'
    check (tariff_type in ('fixed','dynamic','variable','unknown')),
  valid_from date,
  updated_at timestamptz not null default now(),
  constraint household_energy_tariffs_import_nonnegative
    check (electricity_import_eur_per_kwh is null or electricity_import_eur_per_kwh >= 0),
  constraint household_energy_tariffs_export_nonnegative
    check (electricity_export_eur_per_kwh is null or electricity_export_eur_per_kwh >= 0),
  constraint household_energy_tariffs_gas_nonnegative
    check (gas_eur_per_m3 is null or gas_eur_per_m3 >= 0)
);
create table if not exists public.energy_scenario_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Mijn berekening'
    check (char_length(label) between 1 and 80),
  input_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  annual_saving_eur numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists energy_scenario_snapshots_household_created_idx
  on public.energy_scenario_snapshots(household_id, created_at desc);
alter table public.household_energy_tariffs enable row level security;
alter table public.energy_scenario_snapshots enable row level security;
create policy household_energy_tariffs_select_members
  on public.household_energy_tariffs for select to authenticated
  using (private.is_household_member(household_id));
create policy household_energy_tariffs_insert_admin
  on public.household_energy_tariffs for insert to authenticated
  with check (private.is_household_admin(household_id));
create policy household_energy_tariffs_update_admin
  on public.household_energy_tariffs for update to authenticated
  using (private.is_household_admin(household_id))
  with check (private.is_household_admin(household_id));
create policy household_energy_tariffs_delete_admin
  on public.household_energy_tariffs for delete to authenticated
  using (private.is_household_admin(household_id));
create policy energy_scenario_snapshots_select_members
  on public.energy_scenario_snapshots for select to authenticated
  using (private.is_household_member(household_id));
create policy energy_scenario_snapshots_insert_own
  on public.energy_scenario_snapshots for insert to authenticated
  with check (created_by = (select auth.uid())
    and private.is_household_member(household_id));
create policy energy_scenario_snapshots_delete_own_or_admin
  on public.energy_scenario_snapshots for delete to authenticated
  using (created_by = (select auth.uid())
    or private.is_household_admin(household_id));
revoke all on table public.household_energy_tariffs from anon;
revoke all on table public.energy_scenario_snapshots from anon;
grant select, insert, update, delete on table public.household_energy_tariffs to authenticated;
grant select, insert, delete on table public.energy_scenario_snapshots to authenticated;
