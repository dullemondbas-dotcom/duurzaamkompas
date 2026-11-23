-- DuurzaamKompas: least-privilege refinements after initial schema deployment.

-- Index the foreign keys most likely to be used for household ownership,
-- member lookups, challenges, consent and meter ingestion.
create index if not exists households_owner_user_id_idx on public.households(owner_user_id);
create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists home_profiles_household_id_idx on public.home_profiles(household_id);
create index if not exists challenges_created_by_idx on public.challenges(created_by);
create index if not exists challenge_members_household_id_idx on public.challenge_members(household_id);
create index if not exists challenge_scores_challenge_id_idx on public.challenge_scores(challenge_id);
create index if not exists consent_records_household_id_idx on public.consent_records(household_id);
create index if not exists energy_measurements_integration_id_idx on public.energy_measurements(integration_id);

-- Default-deny future objects in the exposed public schema. Future migrations must
-- explicitly grant only the privileges required by their RLS policies.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from public, anon, authenticated, service_role;

-- The scores table intentionally has no direct client access. This explicit
-- deny-all policy documents that choice and keeps direct table reads closed.
drop policy if exists challenge_scores_deny_direct on public.challenge_scores;
create policy challenge_scores_deny_direct on public.challenge_scores
  for select to authenticated using (false);

-- Allow members to join/rejoin only public challenges, and only under their own user id.
drop policy if exists challenge_members_join_public on public.challenge_members;
create policy challenge_members_join_public on public.challenge_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_public_active_challenge(challenge_id)
  );

drop policy if exists challenge_members_rejoin_own on public.challenge_members;
create policy challenge_members_rejoin_own on public.challenge_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.is_public_active_challenge(challenge_id)
  );

grant insert on public.challenge_members to authenticated;
grant update (membership_status) on public.challenge_members to authenticated;

-- The joining operation now runs as the caller and is constrained by the table grants + RLS.
create or replace function public.join_public_challenge(target_challenge_id uuid)
returns uuid
language plpgsql security invoker
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
revoke all on function public.join_public_challenge(uuid) from public, anon;
grant execute on function public.join_public_challenge(uuid) to authenticated;

-- Only the consent owner may revoke consent. The invoker function is constrained
-- by a column-level UPDATE grant and an owner-only RLS policy.
drop policy if exists consents_update_own on public.consent_records;
create policy consents_update_own on public.consent_records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant update (revoked_at) on public.consent_records to authenticated;

create or replace function public.revoke_consent(target_consent_id uuid)
returns boolean
language plpgsql security invoker
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
revoke all on function public.revoke_consent(uuid) from public, anon;
grant execute on function public.revoke_consent(uuid) to authenticated;

-- The leaderboard deliberately emits nicknames and scores only. The narrowly scoped
-- SECURITY DEFINER implementation lives in non-exposed schema private; the public
-- RPC wrapper is SECURITY INVOKER and returns only those safe columns.
create or replace function private.get_challenge_leaderboard_data(target_challenge_id uuid)
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
revoke all on function private.get_challenge_leaderboard_data(uuid) from public, anon;
grant execute on function private.get_challenge_leaderboard_data(uuid) to authenticated;
grant usage on schema private to authenticated;

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
language sql stable security invoker
set search_path = ''
as $$
  select * from private.get_challenge_leaderboard_data(target_challenge_id);
$$;
revoke all on function public.get_challenge_leaderboard(uuid) from public, anon;
grant execute on function public.get_challenge_leaderboard(uuid) to authenticated;
