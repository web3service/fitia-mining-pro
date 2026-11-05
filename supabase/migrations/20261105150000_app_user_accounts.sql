-- FITIA PRO application accounts.
-- Passwords remain exclusively in Supabase Auth. These tables contain no PIN,
-- private key, recovery phrase, session token or wallet-signing capability.

create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  email_verified_at timestamptz,
  wallet_address text,
  wallet_verified_at timestamptz,
  certified boolean not null default false,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_profiles_username_format
    check (username ~ '^[A-Za-z0-9][A-Za-z0-9_]{2,23}$'),
  constraint app_user_profiles_wallet_format
    check (wallet_address is null or wallet_address ~ '^0x[0-9a-f]{40}$'),
  constraint app_user_profiles_wallet_badge_consistency
    check ((wallet_address is null) = (wallet_verified_at is null)),
  constraint app_user_profiles_certification_consistency
    check (certified = (certified_at is not null))
);

create unique index if not exists app_user_profiles_username_unique
  on public.app_user_profiles (lower(username));
create unique index if not exists app_user_profiles_wallet_unique
  on public.app_user_profiles (lower(wallet_address)) where wallet_address is not null;
create index if not exists app_user_profiles_email_idx
  on public.app_user_profiles (lower(email));
create index if not exists app_user_profiles_created_idx
  on public.app_user_profiles (created_at desc);

create table if not exists public.app_wallet_link_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user_profiles(user_id) on delete cascade,
  wallet_address text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_wallet_link_challenges_wallet_format
    check (wallet_address ~ '^0x[0-9a-f]{40}$')
);
create index if not exists app_wallet_link_challenges_user_idx
  on public.app_wallet_link_challenges (user_id, created_at desc);

create table if not exists public.app_user_certification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user_profiles(user_id) on delete cascade,
  certified boolean not null,
  actor text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint app_user_certification_events_actor_format
    check (actor ~ '^[A-Za-z0-9_.@-]{1,80}$')
);
create index if not exists app_user_certification_events_user_idx
  on public.app_user_certification_events (user_id, created_at desc);

alter table public.app_user_profiles enable row level security;
alter table public.app_wallet_link_challenges enable row level security;
alter table public.app_user_certification_events enable row level security;

-- No anon/authenticated policy is intentionally created. Only the server-side
-- service role can read emails, challenges and the certification journal.
revoke all on public.app_user_profiles from public, anon, authenticated;
revoke all on public.app_wallet_link_challenges from public, anon, authenticated;
revoke all on public.app_user_certification_events from public, anon, authenticated;
grant select, insert, update, delete on public.app_user_profiles to service_role;
grant select, insert, update, delete on public.app_wallet_link_challenges to service_role;
grant select on public.app_user_certification_events to service_role;

create or replace function public.app_user_link_wallet(
  p_challenge_id uuid,
  p_user_id uuid,
  p_wallet_address text
) returns public.app_user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.app_wallet_link_challenges;
  v_profile public.app_user_profiles;
begin
  if p_wallet_address is null or p_wallet_address !~ '^0x[0-9a-f]{40}$' then
    raise exception 'INVALID_WALLET';
  end if;

  select * into v_challenge
  from public.app_wallet_link_challenges
  where id = p_challenge_id and user_id = p_user_id
  for update;

  if not found or v_challenge.used_at is not null
    or v_challenge.expires_at <= now()
    or v_challenge.wallet_address <> p_wallet_address then
    raise exception 'CHALLENGE_UNAVAILABLE';
  end if;

  select * into v_profile from public.app_user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.wallet_address is not null and v_profile.wallet_address <> p_wallet_address then
    raise exception 'WALLET_ALREADY_LINKED';
  end if;
  if exists (
    select 1 from public.app_user_profiles
    where wallet_address = p_wallet_address and user_id <> p_user_id
  ) then
    raise exception 'WALLET_ALREADY_LINKED';
  end if;

  update public.app_wallet_link_challenges set used_at = now() where id = p_challenge_id;
  update public.app_user_profiles
  set wallet_address = p_wallet_address,
      wallet_verified_at = coalesce(wallet_verified_at, now()),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;
  return v_profile;
end;
$$;

create or replace function public.app_user_set_certified(
  p_user_id uuid,
  p_certified boolean,
  p_actor text default 'admin'
) returns public.app_user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.app_user_profiles;
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9_.@-]{1,80}$' then
    raise exception 'INVALID_ACTOR';
  end if;
  update public.app_user_profiles
  set certified = p_certified,
      certified_at = case when p_certified then now() else null end,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  insert into public.app_user_certification_events (user_id, certified, actor)
  values (p_user_id, p_certified, p_actor);
  return v_profile;
end;
$$;

revoke all on function public.app_user_link_wallet(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.app_user_set_certified(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.app_user_link_wallet(uuid, uuid, text) to service_role;
grant execute on function public.app_user_set_certified(uuid, boolean, text) to service_role;
grant insert on public.app_user_certification_events to service_role;
