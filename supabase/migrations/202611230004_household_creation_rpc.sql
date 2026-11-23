-- Create a household using the authenticated identity from the signed JWT.
-- The caller cannot supply an owner id, so this narrowly scoped SECURITY DEFINER
-- helper can bypass the direct INSERT policy without allowing cross-user ownership.

create or replace function private.create_my_household(p_municipality text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  signed_in_user_id uuid := auth.uid();
  selected_household_id uuid;
begin
  if signed_in_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select hm.household_id
    into selected_household_id
  from public.household_members hm
  where hm.user_id = signed_in_user_id
  order by hm.joined_at asc
  limit 1;

  if selected_household_id is not null then
    update public.households
    set municipality = coalesce(nullif(pg_catalog.btrim(p_municipality), ''), municipality),
        updated_at = pg_catalog.now()
    where id = selected_household_id;
    return selected_household_id;
  end if;

  -- Repair a possible owner row without its membership link.
  select h.id
    into selected_household_id
  from public.households h
  where h.owner_user_id = signed_in_user_id
  order by h.created_at asc
  limit 1;

  if selected_household_id is not null then
    insert into public.household_members (household_id, user_id, role)
    values (selected_household_id, signed_in_user_id, 'owner')
    on conflict (household_id, user_id) do nothing;

    update public.households
    set municipality = coalesce(nullif(pg_catalog.btrim(p_municipality), ''), municipality),
        updated_at = pg_catalog.now()
    where id = selected_household_id;
    return selected_household_id;
  end if;

  insert into public.households (owner_user_id, label, municipality)
  values (
    signed_in_user_id,
    'Mijn huishouden',
    nullif(pg_catalog.btrim(p_municipality), '')
  )
  returning id into selected_household_id;

  -- The existing household-created trigger adds the owner membership.
  return selected_household_id;
end;
$$;

revoke all on function private.create_my_household(text) from public, anon, authenticated;
grant execute on function private.create_my_household(text) to authenticated;

create or replace function public.create_my_household(p_municipality text default null)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_my_household(p_municipality);
$$;

revoke all on function public.create_my_household(text) from public, anon;
grant execute on function public.create_my_household(text) to authenticated;
