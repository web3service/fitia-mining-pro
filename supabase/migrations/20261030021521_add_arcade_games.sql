-- FITIA Arcade partage le compte FARM, les révisions et le registre d'idempotence.
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
  if p_action_type not in ('deposit', 'withdraw', 'buy_land', 'buy_animal', 'buy_feed', 'plant', 'harvest', 'feed', 'collect', 'sell', 'wheel_spin', 'dice_roll', 'mines_start', 'mines_reveal', 'mines_cashout', 'crash_play', 'coin_flip') then
    raise exception 'FARM_ACTION';
  end if;
  if p_action_type = 'wheel_spin' and (
    coalesce(jsonb_typeof(p_state->'wheel'), '') <> 'object'
    or coalesce(p_state #>> '{wheel,recentSpins,0,id}', '') <> p_action_id::text
  ) then
    raise exception 'FARM_WHEEL_RESULT';
  end if;
  if p_action_type = 'dice_roll' and (
    coalesce(jsonb_typeof(p_state->'dice'), '') <> 'object'
    or coalesce(p_state #>> '{dice,recentRolls,0,id}', '') <> p_action_id::text
    or coalesce(p_state #>> '{dice,recentRolls,0,stake}', '0')::bigint not in (50, 100, 200, 500)
    or coalesce(p_state #>> '{dice,recentRolls,0,target}', '0')::bigint not in (2, 3, 4, 5, 6)
    or coalesce(p_state #>> '{dice,recentRolls,0,roll}', '0')::bigint not in (1, 2, 3, 4, 5, 6)
  ) then
    raise exception 'FARM_DICE_RESULT';
  end if;
  if p_action_type = 'mines_start' and (
    coalesce(jsonb_typeof(p_state->'mines'), '') <> 'object'
    or coalesce(p_state #>> '{mines,active,id}', '') <> p_action_id::text
    or coalesce(p_state #>> '{mines,active,stake}', '0')::bigint not in (50, 100, 200, 500)
    or coalesce(p_state #>> '{mines,active,mineCount}', '0')::bigint not in (1, 3, 5, 10)
    or coalesce(p_state #>> '{mines,active,status}', '') <> 'active'
  ) then
    raise exception 'FARM_MINES_START';
  end if;
  if p_action_type = 'mines_reveal' and (
    coalesce(jsonb_typeof(p_state->'mines'), '') <> 'object'
    or coalesce(p_state #>> '{mines,active,lastAction,id}', p_state #>> '{mines,recentRounds,0,lastAction,id}', '') <> p_action_id::text
  ) then
    raise exception 'FARM_MINES_REVEAL';
  end if;
  if p_action_type = 'mines_cashout' and (
    coalesce(p_state #>> '{mines,recentRounds,0,lastAction,id}', '') <> p_action_id::text
    or coalesce(p_state #>> '{mines,recentRounds,0,status}', '') <> 'cashed'
  ) then
    raise exception 'FARM_MINES_CASHOUT';
  end if;
  if p_action_type = 'crash_play' and (
    coalesce(jsonb_typeof(p_state->'crash'), '') <> 'object'
    or coalesce(p_state #>> '{crash,recentRounds,0,id}', '') <> p_action_id::text
    or coalesce(p_state #>> '{crash,recentRounds,0,stake}', '0')::bigint not in (50, 100, 200, 500)
    or coalesce(p_state #>> '{crash,recentRounds,0,targetBps}', '0')::bigint not in (150, 200, 300, 500, 1000)
    or coalesce(p_state #>> '{crash,recentRounds,0,crashBps}', '0')::bigint not between 100 and 10000
  ) then
    raise exception 'FARM_CRASH_RESULT';
  end if;
  if p_action_type = 'coin_flip' and (
    coalesce(jsonb_typeof(p_state->'coinFlip'), '') <> 'object'
    or coalesce(p_state #>> '{coinFlip,recentFlips,0,id}', '') <> p_action_id::text
    or coalesce(p_state #>> '{coinFlip,recentFlips,0,stake}', '0')::bigint not in (50, 100, 200, 500)
    or coalesce(p_state #>> '{coinFlip,recentFlips,0,choice}', '') not in ('heads', 'tails')
    or coalesce(p_state #>> '{coinFlip,recentFlips,0,result}', '') not in ('heads', 'tails')
  ) then
    raise exception 'FARM_FLIP_RESULT';
  end if;

  insert into public.farm_actions (action_id, wallet, action_type, tx_hash)
  values (p_action_id, p_wallet, p_action_type, p_tx_hash);

  if p_withdrawal_id is not null then
    if p_action_type <> 'withdraw' or p_coins is null or p_coins < 1000 or p_coins % 100 <> 0 or p_fta_units !~ '^[0-9]+$' or p_created_at is null then
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

revoke execute on function public.farm_apply(text, bigint, jsonb, uuid, text, text, uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.farm_apply(text, bigint, jsonb, uuid, text, text, uuid, bigint, text, timestamptz) to service_role;

comment on function public.farm_apply(text, bigint, jsonb, uuid, text, text, uuid, bigint, text, timestamptz) is 'Atomic FARM and arcade mutation with idempotency, revision checks and withdrawal limits.';
