-- Candidat pour dépôt réel, non branché à une API et verrouillé inactif.
-- La preuve et signature doivent être vérifiées côté serveur AVANT l'appel.
-- Ne pas activer avant protection des anciens clients et traitement des remboursements.
create table if not exists public.farm_live_deposit_quotes (
  id uuid primary key, wallet text not null check(wallet ~ '^0x[0-9a-f]{40}$'),
  coins bigint not null check(coins between 1 and 1000000000),
  amount_units numeric(20,0) not null check(amount_units between 1 and 9999999999999999999),
  rate_units bigint not null check(rate_units between 1 and 1000000000000000),
  rate_version bigint not null check(rate_version >= 1),
  issued_at_ms bigint not null check(issued_at_ms > 0),
  expires_at_ms bigint not null check(expires_at_ms > issued_at_ms),
  check(coins::numeric * rate_units::numeric = amount_units * 100)
);
create table if not exists public.farm_live_deposit_events (
  tx_hash text primary key check(tx_hash ~ '^0x[0-9a-f]{64}$'),
  event_id uuid not null unique references public.farm_actions(action_id),
  quote_id uuid not null references public.farm_live_deposit_quotes(id),
  log_index integer not null check(log_index >= 0),
  block_number bigint not null check(block_number >= 0),
  block_hash text not null check(block_hash ~ '^0x[0-9a-f]{64}$'),
  block_time_ms bigint not null check(block_time_ms > 0),
  status text not null check(status in ('credited','refund_required')),
  reason text not null check(reason in ('on_time','late','before_issue','duplicate_payment','account_unavailable','balance_limit')),
  created_at timestamptz not null default clock_timestamp(),
  check((status='credited' and reason='on_time') or (status='refund_required' and reason<>'on_time'))
);
create unique index if not exists farm_live_deposit_quote_credited on public.farm_live_deposit_events(quote_id) where status='credited';
alter table public.farm_live_deposit_quotes enable row level security;
alter table public.farm_live_deposit_events enable row level security;
revoke all on public.farm_live_deposit_quotes, public.farm_live_deposit_events from public,anon,authenticated,service_role;
grant select on public.farm_live_deposit_quotes, public.farm_live_deposit_events to service_role;

create or replace function public.farm_live_create_deposit_quote(p_id uuid,p_wallet text,p_coins bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.farm_live_exchange_rate%rowtype; q public.farm_live_deposit_quotes%rowtype; n bigint; amount numeric;
begin
  if p_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' or p_coins is null or p_coins not between 1 and 1000000000 then raise exception 'FARM_LIVE_PARAMS'; end if;
  select * into r from public.farm_live_exchange_rate where id=1 for share;
  if not found or not r.enabled then raise exception 'FARM_LIVE_DISABLED'; end if;
  amount:=p_coins::numeric*r.rate_units::numeric/100;
  if amount<>trunc(amount) or amount<1 or amount>9999999999999999999 then raise exception 'FARM_LIVE_AMOUNT'; end if;
  n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  insert into public.farm_live_deposit_quotes(id,wallet,coins,amount_units,rate_units,rate_version,issued_at_ms,expires_at_ms)
  values(p_id,p_wallet,p_coins,amount,r.rate_units,r.version,n,n+300000) returning * into q;
  return jsonb_build_object('quoteId',q.id::text,'wallet',q.wallet,'direction','deposit','coins',q.coins::text,'amountUnits',q.amount_units::text,'rateUnits',q.rate_units::text,'rateVersion',q.rate_version,'issuedAt',q.issued_at_ms,'expiresAt',q.expires_at_ms);
end; $$;
create or replace function public.farm_live_get_deposit_quote(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('quoteId',q.id::text,'wallet',q.wallet,'direction','deposit','coins',q.coins::text,'amountUnits',q.amount_units::text,'rateUnits',q.rate_units::text,'rateVersion',q.rate_version,'issuedAt',q.issued_at_ms,'expiresAt',q.expires_at_ms)
  from public.farm_live_deposit_quotes q where q.id=p_id;
$$;

-- Input is trusted evidence from a server-side Polygon verifier, never client JSON.
-- The transaction hash is reserved in the legacy FARM action journal as well:
-- old and new paths cannot both consume the same transaction. A transfer that
-- cannot be credited is journalled for reconciliation; no refund is sent here.
create or replace function public.farm_live_record_deposit(
  p_quote_id uuid,p_event_id uuid,p_wallet text,p_tx_hash text,p_log_index integer,
  p_block_number bigint,p_block_hash text,p_block_time_ms bigint
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.farm_live_exchange_rate%rowtype; q public.farm_live_deposit_quotes%rowtype;
  e public.farm_live_deposit_events%rowtype; a public.farm_accounts%rowtype; reason_value text; status_value text; balance bigint; now_ms bigint;
begin
  if p_quote_id is null or p_event_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$'
    or p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-f]{64}$' or p_log_index is null or p_log_index<0
    or p_block_number is null or p_block_number<0 or p_block_hash is null or p_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_time_ms is null or p_block_time_ms<=0 then raise exception 'FARM_LIVE_PARAMS'; end if;
  select * into r from public.farm_live_exchange_rate where id=1 for share;
  if not found or not r.enabled then raise exception 'FARM_LIVE_DISABLED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tx_hash,2));
  select * into e from public.farm_live_deposit_events where tx_hash=p_tx_hash;
  if found then
    if e.quote_id<>p_quote_id or e.event_id<>p_event_id or e.log_index<>p_log_index or e.block_number<>p_block_number or e.block_hash<>p_block_hash or e.block_time_ms<>p_block_time_ms then raise exception 'FARM_LIVE_DEPOSIT_CONFLICT'; end if;
    select * into q from public.farm_live_deposit_quotes where id=p_quote_id;
    if not found or q.wallet<>p_wallet then raise exception 'FARM_LIVE_QUOTE'; end if;
    return to_jsonb(e);
  end if;
  select * into q from public.farm_live_deposit_quotes where id=p_quote_id for update;
  if not found or q.wallet<>p_wallet then raise exception 'FARM_LIVE_QUOTE'; end if;
  -- Reserve the transaction in the same unique tx_hash ledger used by legacy
  -- deposits. Any failure later in this function rolls back the reservation.
  insert into public.farm_actions(action_id,wallet,action_type,tx_hash) values(p_event_id,p_wallet,'deposit_pending_reconciliation',p_tx_hash);
  if p_block_time_ms<q.issued_at_ms then reason_value:='before_issue';
  elsif p_block_time_ms>=q.expires_at_ms then reason_value:='late';
  elsif exists(select 1 from public.farm_live_deposit_events where quote_id=p_quote_id and status='credited') then reason_value:='duplicate_payment';
  else
    select * into a from public.farm_accounts where wallet=p_wallet for update;
    if not found or (a.state->>'wallet') is distinct from p_wallet or coalesce(a.state->>'coins','') !~ '^[0-9]{1,10}$' then reason_value:='account_unavailable';
    else
      balance:=(a.state->>'coins')::bigint;
      if balance>1000000000 or balance+q.coins>1000000000 then reason_value:='balance_limit'; else reason_value:='on_time'; end if;
    end if;
  end if;
  status_value:=case when reason_value='on_time' then 'credited' else 'refund_required' end;
  insert into public.farm_live_deposit_events(tx_hash,event_id,quote_id,log_index,block_number,block_hash,block_time_ms,status,reason)
  values(p_tx_hash,p_event_id,p_quote_id,p_log_index,p_block_number,p_block_hash,p_block_time_ms,status_value,reason_value) returning * into e;
  if status_value='credited' then
    now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
    update public.farm_accounts set state=jsonb_set(jsonb_set(state,'{coins}',to_jsonb(balance+q.coins)),'{updatedAt}',to_jsonb(now_ms)),revision=revision+1,updated_at=clock_timestamp() where wallet=p_wallet;
    update public.farm_actions set action_type='deposit' where action_id=p_event_id;
  end if;
  return to_jsonb(e);
end; $$;
revoke all on function public.farm_live_create_deposit_quote(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.farm_live_get_deposit_quote(uuid) from public,anon,authenticated;
revoke all on function public.farm_live_record_deposit(uuid,uuid,text,text,integer,bigint,text,bigint) from public,anon,authenticated;
grant execute on function public.farm_live_create_deposit_quote(uuid,text,bigint) to service_role;
grant execute on function public.farm_live_get_deposit_quote(uuid) to service_role;
grant execute on function public.farm_live_record_deposit(uuid,uuid,text,text,integer,bigint,text,bigint) to service_role;
