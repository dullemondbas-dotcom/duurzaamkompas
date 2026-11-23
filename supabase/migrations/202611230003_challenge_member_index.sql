-- Speed up lookup of participants by account id.
create index if not exists challenge_members_user_id_idx on public.challenge_members(user_id);
