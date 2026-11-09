-- Candidat pour l'économie réelle : NON ACTIVABLE dans cet état.
-- Aucune migration automatique en production. Ne modifie aucun solde à l'installation.
-- Les signatures et la MFA doivent être vérifiées côté serveur avant chaque appel.
-- L'activation exige notamment un chemin dépôt réel et le blocage sûr des anciens clients.
create table if not exists public.farm_live_exchange_rate (
  id smallint primary key default 1 check(id = 1),
  rate_units bigint not null check(rate_units between 1 and 1000000000000000),
  version bigint not null check(version >= 1),
  enabled boolean not null default false constraint farm_live_exchange_disabled check(enabled = false)
);
insert into public.farm_live_exchange_rate(id,rate_units,version,enabled) values(1,100000000,1,false) on conflict(id) do nothing;
create table if not exists public.farm_live_withdraw_quotes (
  id uuid primary key,
  wallet text not null check(wallet ~ '^0x[0-9a-f]{40}$'),
  coins bigint not null check(coins between 1000 and 10000 and coins % 100 = 0),
  amount_units numeric(20,0) not null check(amount_units between 1 and 9999999999999999999),
  rate_units bigint not null check(rate_units between 1 and 1000000000000000),
  rate_version bigint not null check(rate_version >= 1),
  issued_at_ms bigint not null check(issued_at_ms > 0),
  expires_at_ms bigint not null check(expires_at_ms > issued_at_ms),
  check(coins::numeric * rate_units::numeric = amount_units * 100)
);
alter table public.farm_live_exchange_rate enable row level security;
alter table public.farm_live_withdraw_quotes enable row level security;
revoke all on public.farm_live_exchange_rate, public.farm_live_withdraw_quotes from public,anon,authenticated,service_role;
grant select on public.farm_live_exchange_rate, public.farm_live_withdraw_quotes to service_role;

-- A caller must authenticate the wallet. Time and exchange terms are server-side.
create or replace function public.farm_live_create_withdraw_quote(p_id uuid,p_wallet text,p_coins bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.farm_live_exchange_rate%rowtype; q public.farm_live_withdraw_quotes%rowtype; n bigint; amount numeric;
begin
  if p_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' or p_coins is null or p_coins not between 1000 and 10000 or p_coins % 100 <> 0 then raise exception 'FARM_LIVE_PARAMS'; end if;
  select * into r from public.farm_live_exchange_rate where id=1 for share;
  if not found or not r.enabled then raise exception 'FARM_LIVE_DISABLED'; end if;
  amount:=p_coins::numeric*r.rate_units::numeric/100;
  if amount<>trunc(amount) or amount<1 or amount>9999999999999999999 then raise exception 'FARM_LIVE_AMOUNT'; end if;
  n:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  insert into public.farm_live_withdraw_quotes(id,wallet,coins,amount_units,rate_units,rate_version,issued_at_ms,expires_at_ms)
    values(p_id,p_wallet,p_coins,amount,r.rate_units,r.version,n,n+300000) returning * into q;
  return jsonb_build_object('quoteId',q.id::text,'wallet',q.wallet,'direction','withdraw','coins',q.coins::text,'amountUnits',q.amount_units::text,'rateUnits',q.rate_units::text,'rateVersion',q.rate_version,'issuedAt',q.issued_at_ms,'expiresAt',q.expires_at_ms);
end; $$;

-- Uses the original real FARM tables. Exactly one transaction locks the account,
-- debits its existing coins, journals the action and freezes the FTA payout.
-- The function does NOT validate wallet signatures or MFA by itself.
create or replace function public.farm_live_withdraw(p_id uuid,p_wallet text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.farm_live_exchange_rate%rowtype; q public.farm_live_withdraw_quotes%rowtype; account public.farm_accounts%rowtype;
  existing public.farm_withdrawals%rowtype; n bigint; balance bigint; withdraw_time timestamptz;
begin
  if p_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' then raise exception 'FARM_LIVE_PARAMS'; end if;
  select * into r from public.farm_live_exchange_rate where id=1 for share;
  select * into q from public.farm_live_withdraw_quotes where id=p_id for update;
  if not found or q.wallet <> p_wallet then raise exception 'FARM_LIVE_QUOTE'; end if;
  select * into existing from public.farm_withdrawals where id=p_id;
  if found then
    if existing.wallet<>p_wallet or existing.coins<>q.coins or existing.fta_units<>q.amount_units::text then raise exception 'FARM_LIVE_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'coins',existing.coins,'ftaUnits',existing.fta_units,'status',existing.status);
  end if;
  if r.id is null or not r.enabled then raise exception 'FARM_LIVE_DISABLED'; end if;
  if q.rate_version<>r.version or q.rate_units<>r.rate_units then raise exception 'FARM_LIVE_RATE_CHANGED'; end if;
  withdraw_time:=clock_timestamp(); n:=floor(extract(epoch from withdraw_time)*1000)::bigint;
  if n<q.issued_at_ms or n>=q.expires_at_ms then raise exception 'FARM_LIVE_EXPIRED'; end if;
  select * into account from public.farm_accounts where wallet=p_wallet for update;
  if not found or (account.state->>'wallet') is distinct from p_wallet or (account.state #> '{land,owned}') is distinct from 'true'::jsonb
    or (case when jsonb_typeof(account.state->'animals')='array' then jsonb_array_length(account.state->'animals')=0 else true end)
    or coalesce(account.state->>'coins','') !~ '^[0-9]{1,10}$' then raise exception 'FARM_LIVE_ACCOUNT'; end if;
  balance:=(account.state->>'coins')::bigint;
  if balance>1000000000 or balance<q.coins then raise exception 'FARM_LIVE_BALANCE'; end if;
  if exists(select 1 from public.farm_withdrawals where wallet=p_wallet and status='pending') then raise exception 'FARM_LIVE_PENDING'; end if;
  if exists(select 1 from public.farm_withdrawals where wallet=p_wallet and created_at>withdraw_time-interval '24 hours') then raise exception 'FARM_LIVE_COOLDOWN'; end if;
  insert into public.farm_actions(action_id,wallet,action_type) values(p_id,p_wallet,'withdraw');
  insert into public.farm_withdrawals(id,wallet,coins,fta_units,status,created_at) values(p_id,p_wallet,q.coins,q.amount_units::text,'pending',withdraw_time) returning * into existing;
  update public.farm_accounts set state=jsonb_set(jsonb_set(state,'{coins}',to_jsonb(balance-q.coins)),'{updatedAt}',to_jsonb(n)),revision=revision+1,updated_at=withdraw_time where wallet=p_wallet;
  return jsonb_build_object('id',existing.id,'coins',existing.coins,'ftaUnits',existing.fta_units,'status',existing.status);
end; $$;
revoke all on function public.farm_live_create_withdraw_quote(uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.farm_live_withdraw(uuid,text) from public,anon,authenticated;
grant execute on function public.farm_live_create_withdraw_quote(uuid,text,bigint) to service_role;
grant execute on function public.farm_live_withdraw(uuid,text) to service_role;

-- Lecture des termes exacts pour vérifier la signature du wallet côté serveur.
create or replace function public.farm_live_get_withdraw_quote(p_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('quoteId',q.id::text,'wallet',q.wallet,'direction','withdraw','coins',q.coins::text,'amountUnits',q.amount_units::text,'rateUnits',q.rate_units::text,'rateVersion',q.rate_version,'issuedAt',q.issued_at_ms,'expiresAt',q.expires_at_ms)
  from public.farm_live_withdraw_quotes q where q.id=p_id;
$$;
revoke all on function public.farm_live_get_withdraw_quote(uuid) from public,anon,authenticated;
grant execute on function public.farm_live_get_withdraw_quote(uuid) to service_role;
