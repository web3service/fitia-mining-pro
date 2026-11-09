-- Isolation stricte : tables de simulation distinctes, sans lien avec
-- farm_accounts ou farm_withdrawals et sans opération sur la chaîne.
create table if not exists public.farm_exchange_sim_accounts (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  coins bigint not null check (coins between 0 and 1000000000)
);
create table if not exists public.farm_exchange_sim_withdrawals (
  quote_id uuid primary key references public.farm_exchange_quote_draft(quote_id),
  wallet text not null references public.farm_exchange_sim_accounts(wallet),
  coins bigint not null check (coins between 1 and 1000000000),
  amount_units numeric(20,0) not null check (amount_units between 1 and 9999999999999999999),
  rate_units bigint not null check (rate_units between 1 and 1000000000000000),
  rate_version bigint not null check (rate_version >= 1),
  status text not null default 'simulated' check (status = 'simulated'),
  created_at timestamptz not null default clock_timestamp(),
  check (coins::numeric * rate_units::numeric = amount_units * 100)
);
alter table public.farm_exchange_sim_accounts enable row level security;
alter table public.farm_exchange_sim_withdrawals enable row level security;
revoke all on public.farm_exchange_sim_accounts, public.farm_exchange_sim_withdrawals from public, anon, authenticated, service_role;
grant select on public.farm_exchange_sim_accounts, public.farm_exchange_sim_withdrawals to service_role;

-- Cette fonction ne vérifie pas les signatures : le service de simulation
-- doit vérifier la signature du wallet avant d'appeler. Horloge de base,
-- verrouillage et débit sont vérifiés dans une seule transaction SQL.
create or replace function public.farm_exchange_sim_withdraw(p_quote_id uuid, p_wallet text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rate_row public.farm_exchange_draft%rowtype;
  q public.farm_exchange_quote_draft%rowtype;
  previous public.farm_exchange_sim_withdrawals%rowtype;
  saved public.farm_exchange_sim_withdrawals%rowtype;
  now_ms bigint;
begin
  if p_quote_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' then raise exception 'FARM_SIM_PARAMS'; end if;
  -- Lock order: rate, quote, account. Compatible with quote creation/rate update.
  select * into rate_row from public.farm_exchange_draft where id = 1 for share;
  if not found or rate_row.enabled then raise exception 'FARM_SIM_RATE'; end if;
  select * into q from public.farm_exchange_quote_draft where quote_id = p_quote_id for update;
  if not found or q.wallet <> p_wallet or q.direction <> 'withdraw' then raise exception 'FARM_SIM_QUOTE'; end if;
  -- An already committed request is immutable even after a rate change or expiry.
  select * into previous from public.farm_exchange_sim_withdrawals where quote_id = p_quote_id;
  if found then return to_jsonb(previous) || jsonb_build_object('amount_units', previous.amount_units::text, 'rate_units', previous.rate_units::text); end if;
  now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  if now_ms < q.issued_at_ms or now_ms >= q.expires_at_ms then raise exception 'FARM_SIM_EXPIRED'; end if;
  if rate_row.version <> q.rate_version or rate_row.rate_units <> q.rate_units then raise exception 'FARM_SIM_RATE_CHANGED'; end if;
  update public.farm_exchange_sim_accounts set coins = coins - q.coins where wallet = p_wallet and coins >= q.coins;
  if not found then raise exception 'FARM_SIM_BALANCE'; end if;
  insert into public.farm_exchange_sim_withdrawals(quote_id,wallet,coins,amount_units,rate_units,rate_version)
    values(q.quote_id,q.wallet,q.coins,q.amount_units,q.rate_units,q.rate_version) returning * into saved;
  return to_jsonb(saved) || jsonb_build_object('amount_units', saved.amount_units::text, 'rate_units', saved.rate_units::text);
end;
$$;
revoke all on function public.farm_exchange_sim_withdraw(uuid,text) from public, anon, authenticated;
grant execute on function public.farm_exchange_sim_withdraw(uuid,text) to service_role;
