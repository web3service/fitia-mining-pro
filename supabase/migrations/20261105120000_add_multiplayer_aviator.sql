-- Une seule salle Aviator mondiale, avec règlement atomique des comptes FARM.
create table if not exists public.aviator_state (
  id smallint primary key default 1 check (id = 1),
  state jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.aviator_state enable row level security;
revoke all on public.aviator_state from public, anon, authenticated;
grant select, insert, update on public.aviator_state to service_role;

comment on table public.aviator_state is 'Authoritative shared Aviator round. No anonymous or authenticated client access.';

create or replace function public.aviator_apply(
  p_expected_revision bigint,
  p_state jsonb,
  p_accounts jsonb,
  p_action_id uuid default null,
  p_wallet text default null,
  p_action_type text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account jsonb;
  account_wallet text;
  expected_account_revision bigint;
  affected_rows integer;
begin
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'AVIATOR_REVISION'; end if;
  if jsonb_typeof(p_state) <> 'object'
    or p_state->>'version' <> '3'
    or coalesce(jsonb_typeof(p_state->'history'), '') <> 'array'
    or jsonb_array_length(p_state->'history') > 12
    or not (p_state ? 'active')
    or (p_state->'active' <> 'null'::jsonb and (
      coalesce(jsonb_typeof(p_state->'active'), '') <> 'object'
      or coalesce(jsonb_typeof(p_state->'active'->'bets'), '') <> 'array'
      or jsonb_array_length(p_state->'active'->'bets') > 100
    )) then
    raise exception 'AVIATOR_STATE';
  end if;
  if jsonb_typeof(p_accounts) <> 'array' or jsonb_array_length(p_accounts) > 200 then raise exception 'AVIATOR_ACCOUNTS'; end if;
  if (p_action_id is null) <> (p_wallet is null) or (p_action_id is null) <> (p_action_type is null) then
    raise exception 'AVIATOR_ACTION';
  end if;
  if p_action_id is not null and (
    p_wallet !~ '^0x[0-9a-f]{40}$'
    or p_action_type not in ('crash_start', 'crash_bet', 'crash_cashout', 'crash_sync')
  ) then
    raise exception 'AVIATOR_ACTION';
  end if;

  if p_expected_revision = 0 then
    insert into public.aviator_state (id, state, revision, updated_at)
    values (1, p_state, 1, now())
    on conflict (id) do nothing;
    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then raise exception 'AVIATOR_REVISION'; end if;
  else
    update public.aviator_state
    set state = p_state, revision = revision + 1, updated_at = now()
    where id = 1 and revision = p_expected_revision;
    if not found then raise exception 'AVIATOR_REVISION'; end if;
  end if;

  if p_action_id is not null then
    insert into public.farm_actions (action_id, wallet, action_type, tx_hash)
    values (p_action_id, p_wallet, p_action_type, null);
  end if;

  for account in select value from jsonb_array_elements(p_accounts) loop
    account_wallet := account->>'wallet';
    expected_account_revision := (account->>'expectedRevision')::bigint;
    if account_wallet !~ '^0x[0-9a-f]{40}$'
      or expected_account_revision is null or expected_account_revision < 0
      or coalesce(jsonb_typeof(account->'state'), '') <> 'object'
      or account->'state'->>'wallet' <> account_wallet
      or (account->'state'->>'coins')::bigint < 0
      or (account->'state'->>'coins')::bigint > 1000000000 then
      raise exception 'AVIATOR_ACCOUNT';
    end if;

    if expected_account_revision = 0 then
      insert into public.farm_accounts (wallet, state, revision, updated_at)
      values (account_wallet, account->'state', 1, now())
      on conflict (wallet) do nothing;
      get diagnostics affected_rows = row_count;
      if affected_rows = 0 then raise exception 'FARM_REVISION'; end if;
    else
      update public.farm_accounts
      set state = account->'state', revision = revision + 1, updated_at = now()
      where wallet = account_wallet and revision = expected_account_revision;
      if not found then raise exception 'FARM_REVISION'; end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.aviator_apply(bigint, jsonb, jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.aviator_apply(bigint, jsonb, jsonb, uuid, text, text) to service_role;

comment on function public.aviator_apply(bigint, jsonb, jsonb, uuid, text, text) is 'Atomically advances the shared Aviator round, applies coin debits/credits and records signed action idempotency.';
