-- Simulation uniquement : aucune écriture de compte, aucun transfert ni remboursement.
-- Le service doit avoir vérifié le reçu Polygon avant cet appel. Ce registre
-- n'est pas une preuve de paiement et ne doit jamais être exposé au client.
create table if not exists public.farm_exchange_receipt_draft (
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer not null check (log_index >= 0),
  quote_id uuid not null references public.farm_exchange_quote_draft(quote_id),
  block_number bigint not null check (block_number >= 0),
  block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  block_time_ms bigint not null check (block_time_ms > 0),
  status text not null check (status in ('eligible', 'refund_required')),
  reason text not null check (reason in ('on_time', 'late', 'duplicate_payment', 'before_issue')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (tx_hash, log_index),
  check ((status = 'eligible' and reason = 'on_time') or (status = 'refund_required' and reason <> 'on_time'))
);
-- One eligible transfer per quote, but record all additional transfers for
-- reconciliation. The index is defense in depth alongside the quote row lock.
create unique index if not exists farm_exchange_receipt_draft_eligible_quote
  on public.farm_exchange_receipt_draft (quote_id) where status = 'eligible';
alter table public.farm_exchange_receipt_draft enable row level security;
revoke all on public.farm_exchange_receipt_draft from public, anon, authenticated, service_role;
grant select on public.farm_exchange_receipt_draft to service_role;

create or replace function public.farm_exchange_record_receipt_draft(
  p_quote_id uuid, p_tx_hash text, p_log_index integer, p_block_number bigint,
  p_block_hash text, p_block_time_ms bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.farm_exchange_quote_draft%rowtype; r public.farm_exchange_receipt_draft%rowtype; reason_value text; status_value text;
begin
  if p_quote_id is null or p_tx_hash is null or p_tx_hash !~ '^0x[0-9a-f]{64}$'
    or p_log_index is null or p_log_index < 0 or p_block_number is null or p_block_number < 0
    or p_block_hash is null or p_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_block_time_ms is null or p_block_time_ms <= 0 then raise exception 'FARM_RECEIPT_PARAMS'; end if;
  -- Lock the event first, then quote, in a consistent order. Reuse of one
  -- event across two quotes cannot race through the existence check.
  perform pg_advisory_xact_lock(hashtextextended(p_tx_hash || ':' || p_log_index::text, 1));
  select * into r from public.farm_exchange_receipt_draft where tx_hash = p_tx_hash and log_index = p_log_index;
  if found then
    if r.quote_id <> p_quote_id or r.block_number <> p_block_number or r.block_hash <> p_block_hash or r.block_time_ms <> p_block_time_ms
      then raise exception 'FARM_RECEIPT_CONFLICT'; end if;
    return to_jsonb(r);
  end if;
  select * into q from public.farm_exchange_quote_draft where quote_id = p_quote_id for update;
  if not found or q.direction <> 'deposit' then raise exception 'FARM_RECEIPT_QUOTE'; end if;
  if p_block_time_ms < q.issued_at_ms then reason_value := 'before_issue';
  elsif p_block_time_ms >= q.expires_at_ms then reason_value := 'late';
  elsif exists(select 1 from public.farm_exchange_receipt_draft where quote_id = p_quote_id and status = 'eligible') then reason_value := 'duplicate_payment';
  else reason_value := 'on_time'; end if;
  status_value := case when reason_value = 'on_time' then 'eligible' else 'refund_required' end;
  insert into public.farm_exchange_receipt_draft (tx_hash, log_index, quote_id, block_number, block_hash, block_time_ms, status, reason)
  values (p_tx_hash, p_log_index, p_quote_id, p_block_number, p_block_hash, p_block_time_ms, status_value, reason_value)
  returning * into r;
  return to_jsonb(r);
end;
$$;
revoke all on function public.farm_exchange_record_receipt_draft(uuid,text,integer,bigint,text,bigint) from public, anon, authenticated;
grant execute on function public.farm_exchange_record_receipt_draft(uuid,text,integer,bigint,text,bigint) to service_role;
