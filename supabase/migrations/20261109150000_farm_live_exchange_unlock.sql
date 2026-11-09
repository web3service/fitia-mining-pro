-- ═══════════════════════════════════════════════════════════════════════════
-- CANDIDAT DE REVUE — NE PAS APPLIQUER HORS DE LA PROCÉDURE DOCUMENTÉE
-- docs/FITIA-FARM-ACTIVATION.md (étape J5 « Déverrouillage »).
--
-- Cette migration retire uniquement la contrainte farm_live_exchange_disabled
-- (enabled = false) qui rend l'activation IMPOSSIBLE côté SQL.
--
-- Elle NE fait PAS passer enabled à true. L'activation effective
-- (enabled = true, rate_units validé, version = version + 1) est une action
-- manuelle séparée, exécutée par un administrateur connecté à la base de
-- production pendant la fenêtre d'activation documentée, APRÈS :
--   1. la validation économique ÉCRITE (taux, plafonds, exposition maximale) ;
--   2. la sauvegarde + un test de RESTAURATION réussi de la production ;
--   3. l'application et la validation des migrations candidates
--      farm_live_withdraw_prepare / farm_live_deposit_prepare /
--      farm_live_rate_admin_prepare sur la BASE DE TEST isolée ;
--   4. le déploiement d'un serveur dont FITIA_FARM_LIVE_EXCHANGE=true refuse
--      le retrait legacy (ancien chemin bloqué) et d'un APK adapté ;
--   5. la vérification sur appareil réel.
--
-- Ordre d'application : cette migration en dernier des quatre, dans la même
-- fenêtre d'activation. Aucune de ces quatre migrations n'est appliquée en
-- production sans la décision J3 signée. Voir le runbook pour le rollback.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.farm_live_exchange_rate
  drop constraint if exists farm_live_exchange_disabled;

comment on table public.farm_live_exchange_rate is
  'Taux de change FITIA FARM. Contrainte anti-activation retirée par migration candidate 20261109150000. La mise à true reste une action manuelle documentée (docs/FITIA-FARM-ACTIVATION.md) exécutée uniquement en fenêtre d''activation signée.';
