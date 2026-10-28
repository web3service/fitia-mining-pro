create table if not exists public.farm_accounts (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_actions (
  action_id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  action_type text not null,
  tx_hash text unique check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.farm_withdrawals (
  id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  coins bigint not null check (coins > 0),
  fta_units text not null check (fta_units ~ '^[0-9]+$'),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null,
  paid_at timestamptz,
  payout_tx_hash text unique check (payout_tx_hash is null or payout_tx_hash ~ '^0x[0-9a-f]{64}$')
);

create index if not exists farm_withdrawals_wallet_idx on public.farm_withdrawals (wallet, created_at desc);
create index if not exists farm_withdrawals_status_idx on public.farm_withdrawals (status, created_at desc);
create index if not exists farm_actions_wallet_idx on public.farm_actions (wallet, created_at desc);

alter table public.farm_accounts enable row level security;
alter table public.farm_actions enable row level security;
alter table public.farm_withdrawals enable row level security;
revoke all on public.farm_accounts, public.farm_actions, public.farm_withdrawals from anon, authenticated;
grant select, insert, update, delete on public.farm_accounts, public.farm_actions, public.farm_withdrawals to service_role;

create or replace function public.farm_apply(
  p_wallet text,
  p_expected_revision bigint,
  p_state jsonb,
  p_action_id uuid,
  p_action_type text,
  p_tx_hash text default null,
  p_withdrawal_id uuid default null,
  p_coins bigint default null,
  p_fta_units text default null,
  p_created_at timestamptz default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if p_wallet !~ '^0x[0-9a-f]{40}$' then raise exception 'FARM_WALLET'; end if;
  if p_expected_revision < 0 then raise exception 'FARM_REVISION'; end if;
  if jsonb_typeof(p_state) <> 'object' or p_state->>'wallet' <> p_wallet then raise exception 'FARM_STATE'; end if;
  if (p_state->>'coins')::bigint < 0 or (p_state->>'coins')::bigint > 1000000000 then raise exception 'FARM_COINS'; end if;
  if p_action_type not in ('deposit', 'withdraw', 'buy_land', 'buy_animal', 'buy_feed', 'plant', 'harvest', 'feed', 'collect', 'sell') then
    raise exception 'FARM_ACTION';
  end if;

  insert into public.farm_actions (action_id, wallet, action_type, tx_hash)
  values (p_action_id, p_wallet, p_action_type, p_tx_hash);

  if p_withdrawal_id is not null then
    if p_action_type <> 'withdraw' or p_coins is null or p_coins <= 0 or p_fta_units !~ '^[0-9]+$' or p_created_at is null then
      raise exception 'FARM_WITHDRAWAL';
    end if;
    insert into public.farm_withdrawals (id, wallet, coins, fta_units, status, created_at)
    values (p_withdrawal_id, p_wallet, p_coins, p_fta_units, 'pending', p_created_at);
  end if;

  if p_expected_revision = 0 then
    insert into public.farm_accounts (wallet, state, revision, updated_at)
    values (p_wallet, p_state, 1, now())
    on conflict (wallet) do nothing;
    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then raise exception 'FARM_REVISION'; end if;
  else
    update public.farm_accounts
    set state = p_state, revision = revision + 1, updated_at = now()
    where wallet = p_wallet and revision = p_expected_revision;
    if not found then raise exception 'FARM_REVISION'; end if;
  end if;
end;
$$;

create or replace function public.farm_complete_withdrawal(
  p_id uuid,
  p_tx_hash text,
  p_paid_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tx_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'FARM_TX_HASH'; end if;
  update public.farm_withdrawals
  set status = 'paid', payout_tx_hash = p_tx_hash, paid_at = p_paid_at
  where id = p_id and status = 'pending';
  if not found then raise exception 'FARM_WITHDRAWAL_STATUS'; end if;
end;
$$;

revoke execute on function public.farm_apply(text, bigint, jsonb, uuid, text, text, uuid, bigint, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.farm_complete_withdrawal(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.farm_apply(text, bigint, jsonb, uuid, text, text, uuid, bigint, text, timestamptz) to service_role;
grant execute on function public.farm_complete_withdrawal(uuid, text, timestamptz) to service_role;

comment on table public.farm_accounts is 'Server-authoritative FITIA FARM coin balances and game state. No private keys or seed phrases.';
comment on table public.farm_withdrawals is 'FTA-only withdrawal requests. Coins are debited atomically with request creation.';
