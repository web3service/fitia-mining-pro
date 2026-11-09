-- Lecture seule et agrégée : utiliser uniquement les montants FTA enregistrés,
-- jamais le nouveau taux, pour les retraits déjà en attente.
-- En cas de montant invalide, ne pas utiliser la somme comme passif complet.
select count(*) as pending_requests,
       count(*) filter (where coalesce(fta_units, '') !~ '^[0-9]{1,20}$') as invalid_amounts,
       coalesce(sum(case when fta_units ~ '^[0-9]{1,20}$' then fta_units::numeric else 0 end), 0)::text as pending_fta_units
from public.farm_withdrawals where status = 'pending';
