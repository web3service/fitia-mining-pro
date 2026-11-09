-- Simulation seulement : aucune transaction n'est envoyée, aucun remboursement
-- réel n'est déclaré et aucune table de solde ou retrait réel n'est modifiée.
create table if not exists public.farm_exchange_sim_refunds (
  source_tx_hash text not null,
  source_log_index integer not null,
  payout_tx_hash text not null check (payout_tx_hash ~ '^0x[0-9a-f]{64}$'),
  payout_log_index integer not null check (payout_log_index >= 0),
  payout_block_number bigint not null check (payout_block_number >= 0),
  payout_block_hash text not null check (payout_block_hash ~ '^0x[0-9a-f]{64}$'),
  payout_block_time_ms bigint not null check (payout_block_time_ms > 0),
  status text not null default 'simulated_only' check (status = 'simulated_only'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (source_tx_hash, source_log_index),
  unique (payout_tx_hash, payout_log_index),
  foreign key (source_tx_hash, source_log_index) references public.farm_exchange_receipt_draft (tx_hash, log_index),
  check (source_tx_hash <> payout_tx_hash or source_log_index <> payout_log_index)
);
alter table public.farm_exchange_sim_refunds enable row level security;
revoke all on public.farm_exchange_sim_refunds from public, anon, authenticated, service_role;
grant select on public.farm_exchange_sim_refunds to service_role;

-- Les deux reçus, adresses, montants et blocs doivent avoir été vérifiés sur
-- Polygon par le serveur de simulation AVANT cet appel. Cette fonction ne
-- vérifie pas la chaîne et ne prouve jamais qu'un remboursement a eu lieu.
create or replace function public.farm_exchange_sim_record_refund(
  p_source_tx_hash text, p_source_log_index integer, p_payout_tx_hash text, p_payout_log_index integer,
  p_payout_block_number bigint, p_payout_block_hash text, p_payout_block_time_ms bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare source public.farm_exchange_receipt_draft%rowtype; existing public.farm_exchange_sim_refunds%rowtype; saved public.farm_exchange_sim_refunds%rowtype;
begin
  if p_source_tx_hash is null or p_source_tx_hash !~ '^0x[0-9a-f]{64}$' or p_source_log_index is null or p_source_log_index < 0
    or p_payout_tx_hash is null or p_payout_tx_hash !~ '^0x[0-9a-f]{64}$' or p_payout_log_index is null or p_payout_log_index < 0
    or p_payout_block_number is null or p_payout_block_number < 0 or p_payout_block_hash is null or p_payout_block_hash !~ '^0x[0-9a-f]{64}$'
    or p_payout_block_time_ms is null or p_payout_block_time_ms <= 0 then raise exception 'FARM_SIM_REFUND_PARAMS'; end if;
  -- Same event lock is used by the receipt insertion trigger below.
  perform pg_advisory_xact_lock(hashtextextended(p_payout_tx_hash || ':' || p_payout_log_index::text, 1));
  select * into source from public.farm_exchange_receipt_draft where tx_hash = p_source_tx_hash and log_index = p_source_log_index for update;
  if not found or source.status <> 'refund_required' then raise exception 'FARM_SIM_REFUND_SOURCE'; end if;
  select * into existing from public.farm_exchange_sim_refunds where source_tx_hash = p_source_tx_hash and source_log_index = p_source_log_index;
  if found then
    if existing.payout_tx_hash <> p_payout_tx_hash or existing.payout_log_index <> p_payout_log_index
      or existing.payout_block_number <> p_payout_block_number or existing.payout_block_hash <> p_payout_block_hash
      or existing.payout_block_time_ms <> p_payout_block_time_ms then raise exception 'FARM_SIM_REFUND_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  if p_payout_block_number < source.block_number or (p_payout_block_number = source.block_number and p_payout_log_index <= source.log_index)
    or exists(select 1 from public.farm_exchange_receipt_draft where tx_hash = p_payout_tx_hash and log_index = p_payout_log_index)
    then raise exception 'FARM_SIM_REFUND_EVENT'; end if;
  insert into public.farm_exchange_sim_refunds(source_tx_hash, source_log_index, payout_tx_hash, payout_log_index, payout_block_number, payout_block_hash, payout_block_time_ms)
  values(p_source_tx_hash, p_source_log_index, p_payout_tx_hash, p_payout_log_index, p_payout_block_number, p_payout_block_hash, p_payout_block_time_ms) returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.farm_exchange_sim_record_refund(text,integer,text,integer,bigint,text,bigint) from public, anon, authenticated;
grant execute on function public.farm_exchange_sim_record_refund(text,integer,text,integer,bigint,text,bigint) to service_role;

-- Prevent later receipt insertion from reusing an event already registered as
-- an outgoing simulated refund. Both paths acquire the same advisory lock.
create or replace function public.farm_exchange_sim_prevent_event_reuse()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tx_hash || ':' || new.log_index::text, 1));
  if exists(select 1 from public.farm_exchange_sim_refunds where payout_tx_hash = new.tx_hash and payout_log_index = new.log_index) then
    raise exception 'FARM_SIM_RECEIPT_EVENT_USED';
  end if;
  return new;
end;
$$;
revoke all on function public.farm_exchange_sim_prevent_event_reuse() from public, anon, authenticated, service_role;
drop trigger if exists farm_exchange_sim_prevent_event_reuse on public.farm_exchange_receipt_draft;
create trigger farm_exchange_sim_prevent_event_reuse before insert on public.farm_exchange_receipt_draft
for each row execute function public.farm_exchange_sim_prevent_event_reuse();
