-- Empêche un ancien serveur de réécrire les fermes mises à niveau avec un
-- schéma qui ne connaît pas leurs nouvelles cultures ou leur inventaire.
-- S'applique aussi aux écritures Aviator, pas seulement à farm_apply.
create or replace function public.farm_prevent_state_downgrade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(old.state->'version') = 'number' and (old.state->>'version')::numeric >= 2 then
    if coalesce(jsonb_typeof(new.state->'version'), '') <> 'number' then
      raise exception 'FARM_STATE_VERSION';
    end if;
    if (new.state->>'version')::numeric < (old.state->>'version')::numeric then
      raise exception 'FARM_STATE_VERSION';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.farm_prevent_state_downgrade() from public, anon, authenticated;
drop trigger if exists farm_state_version_guard on public.farm_accounts;
create trigger farm_state_version_guard before update of state on public.farm_accounts
for each row execute function public.farm_prevent_state_downgrade();
