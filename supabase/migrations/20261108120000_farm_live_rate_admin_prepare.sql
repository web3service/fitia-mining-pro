-- Réglage du futur taux réel. Le verrou farm_live_exchange_disabled demeure :
-- cette migration ne peut pas activer l'économie et ne modifie aucun solde.
create table if not exists public.farm_live_rate_history (
  version bigint primary key check(version >= 2),
  old_rate_units bigint not null check(old_rate_units between 1 and 1000000000000000),
  new_rate_units bigint not null check(new_rate_units between 1 and 1000000000000000),
  actor text not null check(actor = 'admin'),
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.farm_live_rate_history enable row level security;
revoke all on public.farm_live_rate_history from public,anon,authenticated,service_role;
grant select on public.farm_live_rate_history to service_role;

-- Caller MUST enforce authenticated admin, CSRF and any required step-up.
-- Quote creation and withdrawal lock the same rate row with FOR SHARE.
create or replace function public.farm_live_set_rate(p_rate_units bigint,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.farm_live_exchange_rate%rowtype; updated public.farm_live_exchange_rate%rowtype; changed timestamptz;
begin
  if p_rate_units is null or p_rate_units not between 1 and 1000000000000000 or p_expected_version is null or p_expected_version not between 1 and 9007199254740990 then raise exception 'FARM_LIVE_RATE_PARAMS'; end if;
  select * into previous from public.farm_live_exchange_rate where id=1 for update;
  if not found or previous.version<>p_expected_version then raise exception 'FARM_LIVE_RATE_REVISION'; end if;
  if previous.rate_units=p_rate_units then raise exception 'FARM_LIVE_RATE_UNCHANGED'; end if;
  changed:=clock_timestamp();
  update public.farm_live_exchange_rate set rate_units=p_rate_units,version=previous.version+1 where id=1 returning * into updated;
  insert into public.farm_live_rate_history(version,old_rate_units,new_rate_units,actor,changed_at) values(updated.version,previous.rate_units,updated.rate_units,'admin',changed);
  return jsonb_build_object('rateUnits',updated.rate_units::text,'version',updated.version,'enabled',updated.enabled,'changedAt',changed);
end; $$;
revoke all on function public.farm_live_set_rate(bigint,bigint) from public,anon,authenticated;
grant execute on function public.farm_live_set_rate(bigint,bigint) to service_role;
