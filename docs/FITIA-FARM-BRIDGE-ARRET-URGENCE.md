# FARM — Arrêt d'urgence du bridge (CONVERT / WITHDRAW FTA)

**Portée.** Cette procédure gèle les flux argent du *bridge* historique :

- **CONVERT** — transfert on-chain FTA → trésor `0xbcd8a903f41157a269615725ac66c8d9d0c8cc90`, crédit F-Coins (`api/farm`, action `deposit`, vérifié on-chain) ;
- **WITHDRAW** — débit F-Coins + demande de paiement FTA manuelle par l'admin (`withdraw`, MFA + cooldown 24 h + un seul retrait en cours).

**Drapeau :** `FITIA_FARM_BRIDGE_ENABLED` (variable d'environnement Vercel / serveur).

| Valeur | Effet |
| --- | --- |
| *(absente)* — défaut | Bridge **actif**, comportement inchangé. |
| `true` | Bridge actif (identique). |
| `false` | **CONVERT et nouveaux retraits refusés** : `503` + code `FARM_BRIDGE_PAUSED`, message « Les conversions FARM sont temporairement suspendues. Les retraits en attente seront honorés. » Le vérificateur on-chain n'est même pas sollicité. |

**Non arrêté volontairement** (toujours disponibles) :

- `completeWithdrawal` — l'admin peut payer les retraits **déjà en attente** (vérifié on-chain trésor → wallet) ;
- `listWithdrawals`, `resolvePending`, `view` — nécessaire pour honorer les engagements en cours.

**Procédure de gel**

1. Vercel → projet `fitia-mining-pro` → Settings → Environment Variables → `FITIA_FARM_BRIDGE_ENABLED` = `false` (Production).
2. Redéployer (Deployments → … → Redeploy). Un changement de variable n'est **pas** appliqué aux fonctions serverless déjà déployées — sans redéploiement, le bridge reste actif.
3. Sur serveur self-hosted : exporter la variable puis redémarrer le processus.
4. Vérification :
   - `POST /api/farm` `{ "action": "withdraw", … }` signé → doit répondre `503` avec `"code": "FARM_BRIDGE_PAUSED"` ;
   - `view` doit exposer `features.bridgePaused: true`.

**Réactivation**

1. Remettre `FITIA_FARM_BRIDGE_ENABLED=true` (ou supprimer la variable) → redéployer.
2. Aucun changement de code, migration ou release APK nécessaire.

**Clients déjà installés.** Une version antérieure à la bannière dédiée affichera une erreur générique devant le code `FARM_BRIDGE_PAUSED` — acceptable en situation d'incident avec communication utilisateur (écran de statut / réseaux).

**Tests**

```
node scripts/run_farm_bridge_gate_tests.js
```

Couvre : défaut actif, CONVERT/WITHDRAW bloqués en 503 sans appel on-chain, coins non débités, paiement admin d'un retrait en attente toujours possible, `resolvePending` ouvert, réactivation sans changement de code.

**Historique.** Drapeau introduit après audit (2026-11-10) en réponse au constat « aucun arrêt d'urgence des flux argent ». L'activation du chemin live (`FITIA_FARM_LIVE_EXCHANGE`) est indépendante et documentée dans `docs/FITIA-FARM-ACTIVATION.md`.
