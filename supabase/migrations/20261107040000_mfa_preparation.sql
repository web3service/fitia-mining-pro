-- Preparation only: no API enables this feature until the full flow is ready.
-- The server stores only an encrypted seed and hashes of high-entropy recovery
-- codes. This table is never directly accessible to application users.
create table if not exists public.app_mfa_factors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision >= 1),
  -- Keep a null tombstone on disable so revisions cannot repeat (ABA).
  record jsonb check (record is null or (jsonb_typeof(record) = 'object' and pg_column_size(record) <= 16384)),
  updated_at timestamptz not null default now()
);
alter table public.app_mfa_factors enable row level security;
revoke all on public.app_mfa_factors from public, anon, authenticated;
grant select, insert, update, delete on public.app_mfa_factors to service_role;

-- Compare-and-swap is the transaction boundary for replay prevention, recovery
-- redemption and shared per-account lockout. No browser may call this RPC.
create or replace function public.app_mfa_compare_and_swap(
  p_user_id uuid, p_expected_revision bigint, p_record jsonb
) returns boolean
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare changed integer;
begin
  if p_user_id is null or p_expected_revision < -1 or p_expected_revision = 0 then
    raise exception 'Invalid MFA revision';
  end if;
  if p_record is not null and (jsonb_typeof(p_record) <> 'object' or pg_column_size(p_record) > 16384) then
    raise exception 'Invalid MFA record';
  end if;
  -- Serialize enrollment/disable with protected withdrawals for this wallet.
  perform 1 from public.app_user_profiles where user_id = p_user_id for update;
  if p_expected_revision = -1 then
    if p_record is null then return false; end if;
    insert into public.app_mfa_factors(user_id, record) values (p_user_id, p_record)
      on conflict (user_id) do nothing;
  else
    update public.app_mfa_factors set record = p_record, revision = revision + 1, updated_at = now()
      where user_id = p_user_id and revision = p_expected_revision;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.app_mfa_compare_and_swap(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.app_mfa_compare_and_swap(uuid, bigint, jsonb) to service_role;

-- Protect FARM server-side, including requests from old/modified clients.
-- An approval is created only by verifying MFA, and is tied to one exact
-- wallet, action and amount. Its removal and the withdrawal are one transaction.
create or replace function public.app_mfa_guard_farm_withdrawal()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user_id uuid;
  v_record jsonb;
  v_approval jsonb;
begin
  select user_id into v_user_id from public.app_user_profiles
    where wallet_address = new.wallet for update;
  if v_user_id is null then return new; end if;
  select record into v_record from public.app_mfa_factors where user_id = v_user_id for update;
  if v_record is null or v_record->'enabled' = 'false'::jsonb then return new; end if;
  if v_record->'enabled' is distinct from 'true'::jsonb then raise exception 'FARM_MFA_CONFIG'; end if;
  v_approval := v_record->'withdrawalApproval';
  if v_approval is null or v_approval->>'wallet' is distinct from new.wallet
    or v_approval->>'actionId' is distinct from new.id::text
    or v_approval->>'coins' is distinct from new.coins::text
    or not coalesce(v_approval->>'expiresAt' ~ '^[0-9]{13}$', false)
    or (v_approval->>'expiresAt')::bigint < floor(extract(epoch from clock_timestamp()) * 1000)::bigint then
    raise exception 'FARM_MFA_REQUIRED';
  end if;
  update public.app_mfa_factors set record = record - 'withdrawalApproval', revision = revision + 1, updated_at = now()
    where user_id = v_user_id;
  return new;
end;
$$;
revoke all on function public.app_mfa_guard_farm_withdrawal() from public, anon, authenticated;
drop trigger if exists app_mfa_farm_withdrawal_guard on public.farm_withdrawals;
create trigger app_mfa_farm_withdrawal_guard before insert on public.farm_withdrawals
  for each row execute function public.app_mfa_guard_farm_withdrawal();
