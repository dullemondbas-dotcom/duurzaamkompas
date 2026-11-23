create index if not exists energy_ingest_tokens_created_by_idx on private.energy_ingest_tokens(created_by);
create index if not exists energy_ingest_tokens_household_id_idx on private.energy_ingest_tokens(household_id);
create index if not exists energy_model_versions_approved_by_idx on private.energy_model_versions(approved_by);
create index if not exists energy_savings_periods_electricity_baseline_idx on public.energy_savings_periods(electricity_baseline_id);
create index if not exists energy_savings_periods_gas_baseline_idx on public.energy_savings_periods(gas_baseline_id);
create index if not exists energy_tip_events_tip_id_idx on public.energy_tip_events(tip_id);
create index if not exists energy_tip_events_user_id_idx on public.energy_tip_events(user_id);