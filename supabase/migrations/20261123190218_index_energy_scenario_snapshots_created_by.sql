create index if not exists energy_scenario_snapshots_created_by_idx on public.energy_scenario_snapshots(created_by, created_at desc);
