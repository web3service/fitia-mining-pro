-- Annulation atomique d'une action de jeu incertaine ; aucune transaction FTA
-- ou demande de retrait ne doit utiliser ce mécanisme côté client.
create or replace function public.farm_resolve_pending(p_wallet text, p_action_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  action_owner text;
  action_kind text;
begin
  if p_wallet is null or p_wallet !~ '^0x[0-9a-f]{40}$' or p_action_id is null then
    raise exception 'FARM_PARAMS';
  end if;
  -- La contrainte unique sur action_id arbitre atomiquement avec farm_apply.
  insert into public.farm_actions (action_id, wallet, action_type)
  values (p_action_id, p_wallet, 'cancelled')
  on conflict (action_id) do nothing;
  select wallet, action_type into action_owner, action_kind
    from public.farm_actions where action_id = p_action_id;
  if action_owner is distinct from p_wallet then
    raise exception 'FARM_CONFLICT';
  end if;
  return case when action_kind = 'cancelled' then 'cancelled' else 'committed' end;
end;
$$;
revoke all on function public.farm_resolve_pending(text, uuid) from public, anon, authenticated;
grant execute on function public.farm_resolve_pending(text, uuid) to service_role;
