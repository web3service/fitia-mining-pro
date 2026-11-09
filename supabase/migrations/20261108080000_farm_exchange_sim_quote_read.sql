-- Lecture interne des termes de simulation, avec montants entiers exacts.
-- Cette fonction ne valide pas une signature et n'active aucun taux réel.
create or replace function public.farm_exchange_sim_get_quote(p_quote_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'quoteId', quote_id::text, 'wallet', wallet, 'direction', direction,
    'coins', coins::text, 'amountUnits', amount_units::text, 'rateUnits', rate_units::text,
    'rateVersion', rate_version, 'issuedAt', issued_at_ms, 'expiresAt', expires_at_ms
  ) from public.farm_exchange_quote_draft where quote_id = p_quote_id;
$$;
revoke all on function public.farm_exchange_sim_get_quote(uuid) from public, anon, authenticated;
grant execute on function public.farm_exchange_sim_get_quote(uuid) to service_role;
