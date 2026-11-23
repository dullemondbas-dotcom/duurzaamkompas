-- Reassert the restricted execution grants for the household creation RPC.
revoke all on function private.create_my_household(text) from public, anon;
grant execute on function private.create_my_household(text) to authenticated;

revoke all on function public.create_my_household(text) from public, anon;
grant execute on function public.create_my_household(text) to authenticated;
