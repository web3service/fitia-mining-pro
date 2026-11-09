-- Registre de simulation uniquement : ne valide aucun paiement et ne touche
-- ni aux comptes, ni aux retraits, ni aux taux de production.
create table if not exists public.farm_exchange_quote_draft (
  quote_id uuid primary key,
  wallet text not null check (wallet ~ '^0x[0-9a-f]{40}$'),
  direction text not null check (direction in ('deposit', 'withdraw')),
  coins bigint not null check (coins between 1 and 1000000000),
  amount_units numeric(20,0) not null check (amount_units between 1 and 9999999999999999999),
  rate_units bigint not null check (rate_units between 1 and 1000000000000000),
  rate_version bigint not null check (rate_version >= 1),
  issued_at_ms bigint not null check (issued_at_ms > 0),
  expires_at_ms bigint not null check (expires_at_ms > issued_at_ms),
  created_at timestamptz not null default clock_timestamp(),
  check (coins::numeric * rate_units::numeric = amount_units * 100)
);
alter table public.farm_exchange_quote_draft enable row level security;
revoke all on public.farm_exchange_quote_draft from public, anon, authenticated, service_role;
grant select on public.farm_exchange_quote_draft to service_role;

-- Service role can only append a simulated quote through this RPC. The draft
-- rate and version are locked while copying them so stale callers cannot win.
-- Retrying the exact same ID and terms returns the original row; conflicting
-- reuse is rejected. This is NOT a reservation or authorization to transfer.
create or replace function public.farm_exchange_create_quote_draft(
  p_quote_id uuid, p_wallet text, p_direction text, p_coins bigint,
  p_amount_units numeric, p_expected_version bigint, p_issued_at_ms bigint, p_expires_at_ms bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.farm_exchange_draft%rowtype; q public.farm_exchange_quote_draft%rowtype;
begin
  if p_quote_id is null or p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$'
     or p_direction is null or p_direction not in ('deposit', 'withdraw')
     or p_coins is null or p_coins not between 1 and 1000000000
     or p_amount_units is null or p_amount_units <> trunc(p_amount_units)
     or p_amount_units not between 1 and 9999999999999999999
     or p_expected_version is null or p_expected_version < 1
     or p_issued_at_ms is null or p_issued_at_ms <= 0 or p_expires_at_ms is null
     or p_expires_at_ms <= p_issued_at_ms then raise exception 'FARM_QUOTE_PARAMS'; end if;
  -- Serialize attempts with the same UUID before checking idempotence.
  perform pg_advisory_xact_lock(hashtextextended(p_quote_id::text, 0));
  select * into q from public.farm_exchange_quote_draft where quote_id = p_quote_id;
  if found then
    if q.wallet <> p_wallet or q.direction <> p_direction or q.coins <> p_coins
       or q.amount_units <> p_amount_units or q.rate_version <> p_expected_version
       or q.issued_at_ms <> p_issued_at_ms or q.expires_at_ms <> p_expires_at_ms then
      raise exception 'FARM_QUOTE_ID_CONFLICT';
    end if;
    return to_jsonb(q) || jsonb_build_object('amount_units', q.amount_units::text, 'rate_units', q.rate_units::text);
  end if;
  select * into r from public.farm_exchange_draft where id = 1 for share;
  if not found or r.version <> p_expected_version or r.enabled then raise exception 'FARM_QUOTE_RATE_CHANGED'; end if;
  if p_coins::numeric * r.rate_units::numeric <> p_amount_units * 100 then raise exception 'FARM_QUOTE_AMOUNT'; end if;
  insert into public.farm_exchange_quote_draft (quote_id, wallet, direction, coins, amount_units, rate_units, rate_version, issued_at_ms, expires_at_ms)
  values (p_quote_id, p_wallet, p_direction, p_coins, p_amount_units, r.rate_units, r.version, p_issued_at_ms, p_expires_at_ms)
  returning * into q;
  return to_jsonb(q) || jsonb_build_object('amount_units', q.amount_units::text, 'rate_units', q.rate_units::text);
end;
$$;
revoke all on function public.farm_exchange_create_quote_draft(uuid,text,text,bigint,numeric,bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.farm_exchange_create_quote_draft(uuid,text,text,bigint,numeric,bigint,bigint,bigint) to service_role;
