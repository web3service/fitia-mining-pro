# FITIA FARM — protocole d’activation de l’échange réel F-Coins ↔ FTA

**Statut : préparation uniquement. Rien n’est activé par ce document.**
L’activation est un programme en portes (gates), pas un drapeau. Aucune étape
n’est sautable sans une décision écrite du propriétaire. Toute étape peut être
annulée avant l’étape J8 (elle est conçue pour).

Date de rédaction : 2026-11-09. Auteur : revue après publication 3.7.0.

## 1. État constaté au 2026-11-09 (lecture seule)

| Élément | Valeur |
|---|---|
| Comptes FARM en production | 1 |
| Coins détenus | 530 |
| Valeur estimée du stock (prix internes) | 156 coins |
| Retraits en attente | 0 (1 retrait réglé manuellement par le passé) |
| **Passif partiel estimé** (rapport `scripts/farm-liability-report.sql`) | **686 coins ≈ 6,86 FTA** |
| Taux historique figé | 100 coins = 1 FTA |
| Trésorerie on-chain FTA (adresse 0xBcD8…c8Cc90, token 0x5c41…d1fd) | ≈ 1 997 820,47 FTA (max 21 M, 8 décimales) |
| Prix / marché secondaire FTA | $0.00, aucune liquidité |
| Migrations d’échange en production | **aucune** (les 3 migrations FARM de 2026-11 ne concernent pas l’échange) |
| `FITIA_FARM_UNVALIDATED_ECONOMY` | `false` (verrou du jeu, indépendant) |
| `FITIA_FARM_LIVE_EXCHANGE` | absent (bloqueur des anciens clients, ce document) |
| Verrou SQL | `farm_live_exchange_rate.enabled = false` + contrainte `farm_live_exchange_disabled` |
| Verrou applicatif | services live non branchés ; admin taux derrière `FITIA_FARM_LIVE_RATE_ADMIN=true` |

Limites du rapport de responsabilité : il exclut la production en cours, les
récompenses, les autres jeux, les frais et les créances futures. Il n’est pas un
audit de solvabilité.

**Fait clé : la conversion coins → FTA fonctionne déjà** via le flux manuel :
demande signée par le joueur → débit atomique serveur → file `/admin` → le
propriétaire règle le transfert FTA hors app → colle le txHash → retrait payé.
Le flux live automatise ce chemin avec du FTA réel et des garanties fortes ; il
n’apporte de la valeur qu’à l’échelle. Avec 1 compte et ~6,86 FTA, le flux
manuel reste le chemin sûr.

## 2. Pré-requis sans lesquels AUCUNE étape n’est franchie

G0 — **Validation économique écrite et signée** (propriétaire) :
- Taux de conversion validé (le brouillon interne 1 FTA / 100 coins n’est PAS
  une validation ; une variation exige annoncer l’effet sur les soldes).
- Plafonds : par retrait (le SQL borne déjà 1 000–10 000 coins), par jour,
  exposition maximale totale.
- Couverture trésorerie confirmée juste avant J8 (le solde change).
- Revue juridique : émission de FTA contre pièces de jeu (titre potentiel),
  RGPD des données de retrait, conditions d’utilisation.

G1 — **Sauvegarde + restauration vérifiées** sur la production (dump + test de
restauration sur instance jetable ; empreinte de `farm_apply` comparée avant/
après).

G2 — **Décision de fenêtre d’activation** datée et publiée aux équipes.

## 3. Étapes (chaque étape a son critère de sortie)

### J0 — Figeage du besoin
- Figer version APK cible (ex. 3.8.0 / versionCode 374+), version du serveur,
  liste exacte des clients encore en 3.7.0 après publication.
- Critère : plan signé, ce document à jour.

### J1 — Base de test isolée
- Sur la base de TEST (pas la prod) : appliquer, dans l’ordre,
  1. `20261108100000_farm_live_withdraw_prepare.sql`
  2. `20261108110000_farm_live_deposit_prepare.sql`
  3. `20261108120000_farm_live_rate_admin_prepare.sql`
  4. `20261109150000_farm_live_exchange_unlock.sql`
- Vérifier : tables `farm_live_*`, RLS, révocations `anon/authenticated`,
  triggers de version, `enabled = false` toujours.
- Brancher un serveur de test sur la base de test + MFA réels de test.
- Critère : `npm run test:farm-exchange` + tests SQL + un cycle complet signé
  à la main (devis → retrait → rejeu idempotent → échec solde insuffisant →
  devis expiré → changement de taux refusé).

### J2 — Téléphone réel
- APK de test signé (build CI dédié, non publié) sur appareil physique :
  parcours dépôt avec fournisseur Polygon réel sur fonds de TEST ; reprises
  après fermeture d’app ; concurrence de deux retraits ; latence réseau.
- Vérifier que le retrait legacy est bien refusé si `FITIA_FARM_LIVE_EXCHANGE=true`.
- Critère : procès-verbal sur 2–3 appareils (versions Android différentes).

### J3 — Décision de production (écrite)
- Revue finale G0–G2 + résultats J1/J2. Décision GO/NO-GO datée.

### J4 — Sauvegarde production
- Backup complet + test de restauration sur instance jetable. Consigner
  l’empreinte de `farm_apply` et des triggers `farm_*` avant/après restauration.

### J5 — Migrations de production (dans la fenêtre J2–J6, même session)
- Appliquer les mêmes quatre migrations qu’en J1, dans le même ordre, sur la
  production, via le connecteur Supabase (pas de CI automatique).
- Vérifications post-migration : `farm_live_exchange_rate` existe,
  `enabled = false`, `farm_apply` md5 inchangé, triggers FARM présents,
  0 compte affecté, rapport de responsabilité recalculé (doit être identique).

### J6 — Déploiement serveur (taux encore désactivés)
- Déployer le serveur avec `FITIA_FARM_LIVE_RATE_ADMIN=true` (UI admin taux
  visible, rateEnabled=false affiché), `FITIA_FARM_LIVE_EXCHANGE` **absent**
  (legacy encore permis à ce stade) — les retraits se font encore manuellement.
- Critère : site OK, admin OK, `/api/account/session` et serverless OK, aucun
  changement comportemental côté joueur.

### J7 — Distribution du client live
- Publier l’APK intégrant le chemin live (devis signés, affichage taux+version,
  signature, MFA) ; `FITIA_FARM_LIVE_EXCHANGE=true` côté serveur **au moment où
  les clients live sont la norme** — sinon les clients 3.7.0 sont refusés
  au retrait (c’est le blocage recherché, à assumer publiquement).
- Fenêtre de grâce recommandée : 2–4 semaines avec annonce in-app + email.

### J8 — Activation du taux (action manuelle, jamais une migration)
- `update public.farm_live_exchange_rate set enabled = true, rate_units = <TAUX_VALIDÉ>, version = version + 1 where id = 1;`
- Surveillance 72 h : file de retraits, montants, erreurs RPC, remboursements,
  `scripts/farm-liability-report.sql` quotidien, trésorerie on-chain.
- Rollback immédiat : `update public.farm_live_exchange_rate set enabled = false;`
  (les retraits redeviennent impossibles côté serveur ; aucun solde ne change).

### J9 — Après activation
- 7 jours sans incident → lever `FITIA_FARM_LIVE_RATE_ADMIN` si l’UI taux
  n’est plus nécessaire, sinon documenter l’accès restreint.
- Rapprochement mensuel trésorerie ↔ engagements (rapport + explorateur).

## 4. Rollback (ordre inverse)

1. `enabled = false` (immédiat, aucune donnée touchée).
2. Redéployer le serveur sans `FITIA_FARM_LIVE_EXCHANGE` si nécessaire.
3. Si J5 a déjà tourné et que J8 échoue avant activation : laisser les
   migrations en place (elles n’activent rien) ; ne PAS les supprimer.
4. Restauration complète uniquement si la corruption de données est avérée —
   sinon les opérations SQL sont conçues pour être idempotentes.

## 5. Ce qui ne doit JAMAIS être fait

- Appliquer J5/J8 sans G0–G2 ou sans J4.
- Mettre `enabled = true` dans une migration ou via un script CI.
- Distribuer le client live sans le blocage legacy (ancien chemin) actif.
- Activer l’échange avant que le remboursement des dépôts tardifs/invalides
  ne soit implémenté et testé (il ne l’est pas aujourd’hui).
- Considérer l’estimation de responsabilité comme un audit de solvabilité.

## 6. Annexes

- Rapport de responsabilité (prod) : `scripts/farm-liability-report.sql`
  (lecture seule ; ne renvoie aucun identifiant individuel).
- Verrou anti-activation : contrainte `farm_live_exchange_disabled`
  (`check (enabled = false)`) sur `farm_live_exchange_rate` ; retirée uniquement
  par la migration candidate `20261109150000_farm_live_exchange_unlock.sql`.
- Blocage des anciens clients : serveur, `FITIA_FARM_LIVE_EXCHANGE=true` →
  retrait legacy refusé (`FARM_CLIENT_UPDATE_REQUIRED`, HTTP 409), boutons
  retrait masqués côté client (`view().features.liveExchange`).
- Migrations candidates : `20261108100000`, `20261108110000`, `20261108120000`,
  `20261109150000`. Toutes : « préparées, testées localement, jamais appliquées
  à la production sans J3 ».
- Tests associées : `npm run test:farm-exchange`, `scripts/run_farm_economy_gate_tests.js`
  (2 scénarios `FITIA_FARM_LIVE_EXCHANGE` : retrait legacy accepté par défaut /
  refusé avec `FARM_CLIENT_UPDATE_REQUIRED` quand le drapeau vaut « true »).
