-- DuurzaamKompas Mijn Energie — production-minded baseline for Supabase.
-- Internal SECURITY DEFINER helpers live in the non-exposed private schema.
-- Only a publishable key is used in the browser. Never expose service_role or device tokens.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  avatar_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (char_length(nickname) between 3 and 24),
  constraint profiles_nickname_chars check (nickname ~ '^[A-Za-z0-9_-]+$')
);
create unique index profiles_nickname_lower_unique on public.profiles (lower(nickname));

create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  label text not null default 'Mijn huishouden',
  municipality text,
  region_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.home_profiles (
  household_id uuid primary key references public.households(id) on delete cascade,
  home_type text,
  residents_band text,
  floor_area_m2 numeric(8,2),
  build_period text,
  insulation_level text,
  heating_type text,
  solar_installed boolean not null default false,
  solar_capacity_kwp numeric(8,2),
  battery_installed boolean not null default false,
  battery_capacity_kwh numeric(8,2),
  ev_installed boolean not null default false,
  charge_point_installed boolean not null default false,
  heat_pump_installed boolean not null default false,
  smart_control_installed boolean not null default false,
  energy_contract_type text,
  comparison_group text,
  updated_at timestamptz not null default now(),
  constraint home_profile_area_positive check (floor_area_m2 is null or floor_area_m2 > 0),
  constraint home_profile_solar_positive check (solar_capacity_kwp is null or solar_capacity_kwp >= 0),
  constraint home_profile_battery_positive check (battery_capacity_kwh is null or battery_capacity_kwh >= 0)
);

-- Connection metadata only. Credentials live in server-side secret storage, never in this table.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  provider text not null check (provider in ('home_assistant','homewizard','homey','other')),
  status text not null default 'pending' check (status in ('pending','connected','degraded','revoked','error')),
  display_label text,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz,
  last_seen_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider)
);

create table public.energy_measurements (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  source_event_id text,
  measured_at timestamptz not null,
  grid_import_w numeric(12,3),
  grid_export_w numeric(12,3),
  grid_import_total_kwh numeric(14,5),
  grid_export_total_kwh numeric(14,5),
  gas_total_m3 numeric(14,5),
  quality text not null default 'unverified' check (quality in ('unverified','validated','estimated','corrected')),
  created_at timestamptz not null default now(),
  constraint energy_measurements_nonnegative check (
    (grid_import_w is null or grid_import_w >= 0) and
    (grid_export_w is null or grid_export_w >= 0) and
    (grid_import_total_kwh is null or grid_import_total_kwh >= 0) and
    (grid_export_total_kwh is null or grid_export_total_kwh >= 0) and
    (gas_total_m3 is null or gas_total_m3 >= 0)
  )
);
create unique index energy_measurements_event_unique
  on public.energy_measurements (household_id, integration_id, source_event_id)
  where source_event_id is not null;
create index energy_measurements_household_time
  on public.energy_measurements (household_id, measured_at desc);

create table public.energy_aggregates (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  resolution text not null check (resolution in ('15m','hour','day','month')),
  bucket_start timestamptz not null,
  grid_import_kwh numeric(14,5),
  grid_export_kwh numeric(14,5),
  gas_m3 numeric(14,5),
  peak_import_kw numeric(12,4),
  own_generation_kwh numeric(14,5),
  self_consumption_ratio numeric(7,5),
  coverage_ratio numeric(7,5),
  quality text not null default 'unverified' check (quality in ('unverified','validated','estimated','incomplete')),
  created_at timestamptz not null default now(),
  unique (household_id, resolution, bucket_start),
  constraint aggregate_nonnegative check (
    (grid_import_kwh is null or grid_import_kwh >= 0) and
    (grid_export_kwh is null or grid_export_kwh >= 0) and
    (gas_m3 is null or gas_m3 >= 0) and
    (own_generation_kwh is null or own_generation_kwh >= 0)
  ),
  constraint aggregate_ratios_range check (
    (self_consumption_ratio is null or self_consumption_ratio between 0 and 1) and
    (coverage_ratio is null or coverage_ratio between 0 and 1)
  )
);
create index energy_aggregates_household_bucket
  on public.energy_aggregates (household_id, bucket_start desc);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 70),
  description text,
  visibility text not null default 'private' check (visibility in ('public','private')),
  municipality text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','completed','cancelled')),
  scoring_version text not null default 'baseline-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenge_dates_valid check (end_at > start_at)
);

create table public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  joined_at timestamptz not null default now(),
  membership_status text not null default 'active' check (membership_status in ('active','left','removed')),
  unique (challenge_id, user_id)
);

create table public.challenge_scores (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  challenge_member_id uuid not null references public.challenge_members(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_score numeric(7,3) not null check (total_score between 0 and 100),
  improvement_pct numeric(8,3),
  data_coverage numeric(7,5) not null default 0 check (data_coverage between 0 and 1),
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (challenge_member_id, period_start, period_end),
  constraint score_period_valid check (period_end >= period_start)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  purpose text not null check (purpose in ('household_profile','energy_measurements','challenge_participation','public_challenge','partner_contact_share','product_updates')),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  context jsonb not null default '{}'::jsonb
);
create index consent_records_user_purpose on public.consent_records (user_id, purpose, granted_at desc);

-- Narrow private membership predicates avoid recursive RLS policies.
create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin','member')
  );
$$;

create or replace function private.is_household_admin(target_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin')
  );
$$;

create or replace function private.is_challenge_member(target_challenge_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.challenge_members cm
    where cm.challenge_id = target_challenge_id
      and cm.user_id = auth.uid()
      and cm.membership_status = 'active'
  );
$$;

create or replace function private.is_public_active_challenge(target_challenge_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = target_challenge_id
      and c.visibility = 'public'
      and c.status in ('scheduled','active','completed')
  );
$$;

-- Trigger functions are private, have a fixed empty search_path and are not callable as RPC.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  chosen_nickname text;
  fallback_nickname text;
begin
  fallback_nickname := 'Energie' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(new.id::text,'-',''),1,6));
  chosen_nickname := new.raw_user_meta_data ->> 'nickname';
  if chosen_nickname is null or chosen_nickname !~ '^[A-Za-z0-9_-]{3,24}$' then
    chosen_nickname := fallback_nickname;
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, chosen_nickname)
  on conflict do nothing;

  if not exists (select 1 from public.profiles p where p.id = new.id) then
    insert into public.profiles (id, nickname)
    values (new.id, fallback_nickname)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.add_household_owner()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_household_created_add_owner on public.households;
create trigger on_household_created_add_owner
  after insert on public.households
  for each row execute function private.add_household_owner();

create or replace function private.add_challenge_creator()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.challenge_members (challenge_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_challenge_created_add_creator on public.challenges;
create trigger on_challenge_created_add_creator
  after insert on public.challenges
  for each row execute function private.add_challenge_creator();

create or replace function public.join_public_challenge(target_challenge_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_member_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_public_active_challenge(target_challenge_id) then
    raise exception 'Challenge is not open for public joining';
  end if;
  insert into public.challenge_members (challenge_id, user_id)
  values (target_challenge_id, auth.uid())
  on conflict (challenge_id, user_id)
  do update set membership_status = 'active'
  returning id into new_member_id;
  return new_member_id;
end;
$$;

create or replace function public.get_challenge_leaderboard(target_challenge_id uuid)
returns table (
  rank_position bigint,
  nickname text,
  score numeric,
  improvement_pct numeric,
  data_coverage numeric,
  period_start date,
  period_end date
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_public_active_challenge(target_challenge_id)
     and not private.is_challenge_member(target_challenge_id) then
    raise exception 'Not permitted to view this challenge';
  end if;
  return query
  with latest_scores as (
    select distinct on (cs.challenge_member_id)
      cs.challenge_member_id, cs.total_score, cs.improvement_pct,
      cs.data_coverage, cs.period_start, cs.period_end, cm.user_id
    from public.challenge_scores cs
    join public.challenge_members cm on cm.id = cs.challenge_member_id
    where cs.challenge_id = target_challenge_id
      and cm.membership_status = 'active'
    order by cs.challenge_member_id, cs.period_end desc, cs.computed_at desc
  )
  select pg_catalog.row_number() over (order by ls.total_score desc, ls.improvement_pct desc nulls last),
         p.nickname, ls.total_score, ls.improvement_pct, ls.data_coverage,
         ls.period_start, ls.period_end
  from latest_scores ls
  join public.profiles p on p.id = ls.user_id
  order by ls.total_score desc, ls.improvement_pct desc nulls last;
end;
$$;

create or replace function public.revoke_consent(target_consent_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.consent_records
  set revoked_at = coalesce(revoked_at, pg_catalog.now())
  where id = target_consent_id and user_id = auth.uid();
  return found;
end;
$$;

-- RLS on every exposed table.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.home_profiles enable row level security;
alter table public.integrations enable row level security;
alter table public.energy_measurements enable row level security;
alter table public.energy_aggregates enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_scores enable row level security;
alter table public.consent_records enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy households_select_members on public.households
  for select to authenticated using (private.is_household_member(id));
create policy households_insert_owner on public.households
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy households_update_admin on public.households
  for update to authenticated using (private.is_household_admin(id)) with check (private.is_household_admin(id));
create policy households_delete_owner on public.households
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy household_members_select_same_household on public.household_members
  for select to authenticated using (private.is_household_member(household_id));
create policy household_members_remove_self_or_admin on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()) or private.is_household_admin(household_id));

create policy home_profiles_select_members on public.home_profiles
  for select to authenticated using (private.is_household_member(household_id));
create policy home_profiles_insert_admin on public.home_profiles
  for insert to authenticated with check (private.is_household_admin(household_id));
create policy home_profiles_update_admin on public.home_profiles
  for update to authenticated using (private.is_household_admin(household_id)) with check (private.is_household_admin(household_id));
create policy home_profiles_delete_admin on public.home_profiles
  for delete to authenticated using (private.is_household_admin(household_id));

create policy integrations_select_admin on public.integrations
  for select to authenticated using (private.is_household_admin(household_id));

create policy measurements_select_household_members on public.energy_measurements
  for select to authenticated using (private.is_household_member(household_id));
create policy aggregates_select_household_members on public.energy_aggregates
  for select to authenticated using (private.is_household_member(household_id));

create policy challenges_select_public_or_member on public.challenges
  for select to authenticated using (
    (visibility = 'public' and status in ('scheduled','active','completed'))
    or created_by = (select auth.uid())
    or private.is_challenge_member(id)
  );
create policy challenges_insert_creator on public.challenges
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy challenges_update_creator on public.challenges
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy challenges_delete_creator on public.challenges
  for delete to authenticated using (created_by = (select auth.uid()));

create policy challenge_members_select_own on public.challenge_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy consents_select_own on public.consent_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consent_records
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Explicit minimum grants: a grant makes an object reachable, while RLS decides row access.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.home_profiles to authenticated;
grant select on public.integrations to authenticated;
grant select on public.energy_measurements to authenticated;
grant select on public.energy_aggregates to authenticated;
grant select, insert, update, delete on public.challenges to authenticated;
grant select on public.challenge_members to authenticated;
grant select, insert on public.consent_records to authenticated;

-- Only logged-in users may call these public RPCs. Remove PostgreSQL's default PUBLIC execute.
revoke all on function public.join_public_challenge(uuid) from public, anon;
revoke all on function public.get_challenge_leaderboard(uuid) from public, anon;
revoke all on function public.revoke_consent(uuid) from public, anon;
grant execute on function public.join_public_challenge(uuid) to authenticated;
grant execute on function public.get_challenge_leaderboard(uuid) to authenticated;
grant execute on function public.revoke_consent(uuid) to authenticated;

-- Internal predicate functions are not exposed as Data API RPCs.
revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_admin(uuid) from public, anon;
revoke all on function private.is_challenge_member(uuid) from public, anon;
revoke all on function private.is_public_active_challenge(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_admin(uuid) to authenticated;
grant execute on function private.is_challenge_member(uuid) to authenticated;
grant execute on function private.is_public_active_challenge(uuid) to authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.add_household_owner() from public, anon, authenticated;
revoke all on function private.add_challenge_creator() from public, anon, authenticated;

comment on table public.energy_measurements is 'Private household readings. Never expose this table in public leaderboards or partner feeds.';
comment on table public.integrations is 'Connection metadata only. Credentials belong in server-side secret storage.';
comment on table public.challenge_scores is 'Server-computed challenge scores. Clients cannot write scores.';
