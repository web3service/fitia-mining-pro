-- Lecture seule. Estimation PARTIELLE au tarif FARM local, à vérifier avant usage.
-- N'inclut ni les productions en cours, ni les bonus, autres jeux, frais ou créances futures.
-- Les retraits pending utilisent leur montant FTA enregistré, jamais un taux recalculé.
-- Les coins et stocks sont estimés au taux historique 100 coins = 1 FTA ; ce rapport n’active aucun taux.
-- La projection est incomplète si invalid_fta_amounts est non nul.
-- Aucun compte, wallet, secret ou détail individuel n'est retourné.
WITH prices(product, price) AS (
  VALUES ('wheat',12), ('carrot',18), ('maize',12), ('tomato',18),
         ('eggs',30), ('wool',65), ('milk',90)
), accounts AS (
  SELECT state FROM public.farm_accounts
), balances AS (
  SELECT count(*) AS accounts,
    coalesce(sum(CASE WHEN state->>'coins' ~ '^[0-9]{1,10}$' THEN (state->>'coins')::numeric ELSE 0 END),0) AS coins,
    count(*) FILTER (WHERE coalesce(state->>'coins','') !~ '^[0-9]{1,10}$') AS invalid_balances,
    count(*) FILTER (WHERE coalesce(jsonb_typeof(state->'inventory'),'') <> 'object') AS invalid_inventories
  FROM accounts
), inventories AS (
  SELECT coalesce(sum(CASE WHEN e.value ~ '^[0-9]{1,7}$' THEN e.value::numeric * p.price ELSE 0 END),0) AS coins,
    count(*) FILTER (WHERE e.value !~ '^[0-9]{1,7}$') AS invalid_quantities,
    count(*) FILTER (WHERE p.product IS NULL AND e.value <> '0') AS unknown_products
  FROM accounts a
  CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(a.state->'inventory')='object' THEN a.state->'inventory' ELSE '{}'::jsonb END) e
  LEFT JOIN prices p ON p.product = e.key
), withdrawals AS (
  SELECT count(*) AS requests, coalesce(sum(coins),0) AS coins,
    count(*) FILTER (WHERE coalesce(fta_units, '') !~ '^[0-9]{1,20}$') AS invalid_fta_amounts,
    coalesce(sum(CASE WHEN fta_units ~ '^[0-9]{1,20}$' THEN fta_units::numeric ELSE 0 END), 0) AS fta_units
  FROM public.farm_withdrawals WHERE status='pending'
)
SELECT balances.accounts, balances.coins AS balance_coins,
  inventories.coins AS known_inventory_value_coins,
  withdrawals.requests AS pending_requests, withdrawals.coins AS pending_withdrawal_coins,
  balances.coins + inventories.coins + withdrawals.coins AS partial_liability_coins,
  withdrawals.fta_units::text AS pending_withdrawal_fta_units,
  (balances.coins + inventories.coins) / 100 + withdrawals.fta_units / 100000000 AS partial_liability_fta,
  withdrawals.invalid_fta_amounts, balances.invalid_balances, balances.invalid_inventories, inventories.invalid_quantities, inventories.unknown_products
FROM balances CROSS JOIN inventories CROSS JOIN withdrawals;
