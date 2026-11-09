-- Brouillon uniquement : cette migration n'active aucun taux variable.
-- Le verrou CHECK interdit toute activation tant qu'une migration ultérieure,
-- accompagnée de devis et de protections validées, ne l'a pas retiré.
create table if not exists public.farm_exchange_draft (
  id smallint primary key default 1 check (id = 1),
  rate_units bigint not null check (rate_units between 1 and 1000000000000000),
  version bigint not null default 1 check (version >= 1),
  enabled boolean not null default false check (enabled = false),
  updated_at timestamptz not null default now()
);
create table if not exists public.farm_exchange_draft_history (
  id bigint generated always as identity primary key,
  old_rate_units bigint not null,
  new_rate_units bigint not null,
  version bigint not null unique,
  actor text not null check (actor = 'admin'),
  created_at timestamptz not null default now()
);
alter table public.farm_exchange_draft enable row level security;
alter table public.farm_exchange_draft_history enable row level security;
revoke all on public.farm_exchange_draft, public.farm_exchange_draft_history from public, anon, authenticated;
grant select on public.farm_exchange_draft, public.farm_exchange_draft_history to service_role;
insert into public.farm_exchange_draft (id, rate_units, version, enabled)
values (1, 100000000, 1, false) on conflict (id) do nothing;

create or replace function public.farm_exchange_stage_rate(p_rate_units bigint, p_expected_version bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare prior public.farm_exchange_draft%rowtype; changed public.farm_exchange_draft%rowtype;
begin
  if p_rate_units is null or p_rate_units < 1 or p_rate_units > 1000000000000000
     or p_expected_version is null or p_expected_version < 1 then
    raise exception 'FARM_EXCHANGE_PARAMS';
  end if;
  select * into prior from public.farm_exchange_draft where id = 1 for update;
  if not found or prior.version <> p_expected_version then raise exception 'FARM_EXCHANGE_REVISION'; end if;
  if prior.enabled then raise exception 'FARM_EXCHANGE_ACTIVE'; end if;
  if prior.rate_units = p_rate_units then raise exception 'FARM_EXCHANGE_UNCHANGED'; end if;
  update public.farm_exchange_draft
  set rate_units = p_rate_units, version = prior.version + 1, updated_at = clock_timestamp()
  where id = 1 returning * into changed;
  insert into public.farm_exchange_draft_history(old_rate_units, new_rate_units, version, actor, created_at)
  values(prior.rate_units, changed.rate_units, changed.version, 'admin', changed.updated_at);
  return jsonb_build_object('rateUnits', changed.rate_units::text, 'version', changed.version, 'enabled', changed.enabled, 'updatedAt', changed.updated_at);
end;
$$;
revoke all on function public.farm_exchange_stage_rate(bigint, bigint) from public, anon, authenticated;
grant execute on function public.farm_exchange_stage_rate(bigint, bigint) to service_role;
