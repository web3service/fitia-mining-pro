# Durcissement 3.7.13 — items 4, 5, 7, 8 (Play Integrity, FCM, SIWE, Observabilité)

État après fusion de la 3.7.12 : les quatre chantiers sont **implémentés, testés et livrés désactivés par défaut**.
Aucune modification du flux d'envoi, du login Supabase existant ou des versements. Rien n'est activé tant que les
variables d'environnement et la configuration externe (Firebase, Play Console, Supabase) ne sont pas posées.

| Item | Contenu livré | État d'activation |
|------|---------------|-------------------|
| 4 — Play Integrity | `api/integrity.js`, `integrity-service.js`, challenges HMAC, verdict appareil exigé | ❌ désactivé (503 sans `INTEGRITY_SERVICE_ACCOUNT_JSON` + `FITIA_SESSION_SECRETS`) |
| 5 — Push FCM | `api/push.js`, `push-service.js`, envoi opérateur `POST /api/push/send`, purge auto des jetons UNREGISTERED | ❌ désactivé (503 sans `FCM_SERVICE_ACCOUNT_JSON` / `FCM_PROJECT_ID`, envoi sans `PUSH_ADMIN_TOKEN`) |
| 7 — SIWE + rotation | `siwe-message.js`, `siwe-service.js`, `siwe-client.js`, `api/siwe.js`, nonces à usage unique HMAC | ❌ désactivé (503 sans `FITIA_SESSION_SECRETS` ; stockage Supabase requis pour le rejeu multi-instances) |
| 8 — Observabilité | `error-reporter.js` (opt-in), `api/errors.js` + `errors-service.js` (alternative légère à Sentry) | ⚠️ ingest ouvert mais **client opt-in uniquement** (`localStorage fitia.errorReporting=on`) |

## Activation

### Prérequis communs

1. Générer les secrets HMAC de session (32 octets min.) :
   ```
   openssl rand -base64 48
   ```
2. Poser `FITIA_SESSION_SECRETS` = `"<kid1>:<secret1>,<kid2>:<secret2>"` sur Vercel (Production).
   - Le **premier** secret signe les nouveaux jetons ; **tous** les secrets connus vérifient.
   - Rotation sans downtime : ajouter `kid2:secret2` à gauche, déployer, retirer `kid1` après expiration des jetons (5–15 min).
3. Exécuter `supabase/migrations/20261113000001_hardening_tables.sql` dans le SQL Editor Supabase
   (tables `siwe_nonces`, `push_tokens`, `app_errors` — RLS sans policies, accès `service_role` uniquement).
   ✅ **Déjà appliqué en production** le 2026-11-13 via le connecteur (migration `hardening_tables`) sur `fitia-pro-miner`.
   Les routes lisent `FITIA_SUPABASE_URL` / `FITIA_SUPABASE_SERVICE_ROLE_KEY` (mêmes variables que `account-service.js`).

### Item 4 — Play Integrity

1. Google Cloud : créer un projet lié à Play Console ; activer **Play Integrity API**.
2. Créer un service account, lui donner accès Play Console (App integrity → verdicts) ou au minimum l'API.
3. Vercel env : `INTEGRITY_SERVICE_ACCOUNT_JSON` (JSON compact du service account),
   `INTEGRITY_PACKAGE_NAME=com.fitia.miningpro`, optionnel `INTEGRITY_MIN_DEVICE_VERDICTS` (défaut `MEETS_DEVICE_INTEGRITY,MEETS_STRONG_INTEGRITY`),
   `INTEGRITY_APP_CERT_SHA256` (SHA-256 du certificat de l'APK, base64 — voir `release-certificate-sha256.txt` pour l'empreinte pinnée),
   `INTEGRITY_REQUIRE_PLAY_RECOGNIZED=1` pour rejeter les APK non reconnus par Play
   (⚠️ à laisser à 0 tant que la distribution passe par GitHub Releases : le verdict `appRecognitionVerdict` vaudra `UNRECOGNIZED_VERSION`).
4. Le client natif n'existe pas encore : l'APK actuel ne peut pas produire de jeton Play Integrity
   (pipeline aapt2/ecj, pas de Gradle, pas de dépendance `com.google.android.play:integrity`).
   `FitiaNative.requestIntegrityToken` est donc un **stub documenté** : l'endpoint est prêt à recevoir
   des jetons réels dès qu'une intégration native (migration Gradle + Play Console) sera livrée.
   Jusque-là, toute vérification côté client est advisory.
5. Test : `curl -s -X POST https://fitia-mining-pro.vercel.app/api/integrity/challenge -H 'Content-Type: application/json' -d '{}'`

### Item 5 — Push FCM

1. Firebase : créer un projet (ou en rattacher un), ajouter l'app Android `com.fitia.miningpro`.
2. Service account Firebase (Admin SDK) → `FCM_SERVICE_ACCOUNT_JSON` ; `FCM_PROJECT_ID`.
3. Générer `PUSH_ADMIN_TOKEN` (opérateur uniquement) ; l'en-tête `x-fitia-admin-token` l'exige.
4. Enregistrement appareil : `POST /api/push/register { token, platform }` (public, validé, anti-abus par rate-limit).
   Désinscription : `POST /api/push/unregister`.
5. Envoi opérateur :
   ```
   curl -s -X POST https://fitia-mining-pro.vercel.app/api/push/send \
     -H "Content-Type: application/json" \
     -H "x-fitia-admin-token: $PUSH_ADMIN_TOKEN" \
     -d '{"title":"FITIA PRO","body":"Mise à jour disponible"}'
   ```
   Jetons FCM renvoyant `UNREGISTERED`/404 sont **purgés automatiquement**.
6. **Client natif requis** : comme pour l'item 4, le WebView Android n'embarque pas le SDK FCM
   (`google-services.json`, plugin Gradle, `FirebaseMessagingService`). Sans migration Gradle, aucun push
   ne sera reçu sur l'APK actuel. Pour la PWA/navigateur, une alternative Web Push (VAPID) peut être ajoutée
   ultérieurement ; hors périmètre ici.
7. Contenu des notifications : aucun secret, aucun montant ; données via champ `data` limité (20 clés, 400 car.).

### Item 7 — SIWE + rotation

- Message EIP-4361 généré par `siwe-client.js` (`FitiaSiwe.loginWithWallet`) ; signature person_sign via le wallet
  existant (`app.signer`) ; vérification serveur dans `api/siwe.js` avec **nonce à usage unique** brûlé avant acceptation.
- Le flux d'auth Supabase actuel (`/api/account/*`, challenge lié wallet existant) est **inchangé** :
  SIWE est livré comme brique d'identité standard, prête à être branchée en remplacement progressif, pas en parallèle silencieux.
- Rotation des clés HMAC (voir Prérequis) : le `kid` de chaque jeton apparaît dans le payload ; vérification multi-secrets.
- Rejeu : le nonce est stocké dans `siwe_nonces` (contrainte PK) ; en mémoire si Supabase n'est pas configuré (dev uniquement).
- Rotation du secret Supabase / JWT : hors de ce document — la rotation HMAC ne touche pas les sessions Supabase existantes.

### Item 8 — Observabilité (erreurs client)

- **Opt-in** : `localStorage.setItem('fitia.errorReporting', 'on')` ou `window.FITIA_ERROR_REPORTING = true` avant chargement.
  Désactivé par défaut ; 10 rapports/session max ; URL sans query string ; emails/JWT/adresses rédigés ; aucune clé ni PII envoyée.
- Endpoint `POST /api/errors/ingest` (202, 60/min/IP) → table `app_errors` si Supabase configuré, sinon drop silencieux (`stored:false`).
- **Alternative à Sentry livrée ainsi volontairement** : pas de DSN, pas de CSP relâchée, pas de vendor tiers.
  Pour brancher Sentry plus tard : poser le DSN + ajouter `connect-src`/`script-src` Sentry au CSP et remplacer
  l'endpoint du reporter ; le reste (sanitization, opt-in, plafonds) est identique.
- **E2E CI** : `scripts/run_farm_browser_tests.js` reste le seul test navigateur réel (ferme WebGL, SwiftShader).
  Un workflow manuel a été ajouté (`.github/workflows/e2e-farm.yml`, `workflow_dispatch` uniquement) :
  il installe Chromium via Playwright et exécute le smoke test contre le preview local. Il n'est pas branché sur `main`
  (un rouge en CI permanente sur un test WebGL serait plus de bruit que de valeur) ; à lancer manuellement avant release.

## Sécurité — rappels

- `api/push/send` exige `PUSH_ADMIN_TOKEN` ; `assertAdminToken` est à temps constant et **fail-closed** sans en-tête.
- Toutes les routes renvoient les mêmes en-têtes (`X-Content-Type-Options`, HSTS, `X-Frame-Options: DENY`,
  CSP `default-src 'none'`, `Cache-Control: no-store`) ; CORS limité à `app.fitia.pro` / `fitia-mining-pro.vercel.app`.
- SIWE/Integrity/Push sans secrets configurés répondent `503 …_NOT_CONFIGURED`, jamais d'accès en mode dégradé silencieux.
- Les jetons SIWE/Integrity expirent en 5 minutes ; les erreurs ne fuient ni stack ni secret vers le client.

## Tests

`npm run test:hardening` (inclus dans `npm test`) — 30 tests : rotation HMAC, SIWE roundtrip + rejeu,
verdicts Play Integrity (mockés), envoi FCM + purge UNREGISTERED (mockés), redactions d'erreurs, handlers sans infra.
