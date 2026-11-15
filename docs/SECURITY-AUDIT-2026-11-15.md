# Audit de sécurité & traduction — FITIA PRO MINER (2026-11-15)

Branche : `arena/24e0bee4-fitia-mining-pro` (base `961a1e8`). Périmètre client-side : `server.js`
(statique), `wallet.html`, `app.js`, `store.js`, `mfa-client.js`, pages satellites
(`index.html`, `privacy.html`, `referral.html`/`referral.js`, `reset-password.html`/`reset-password.js`),
plus vérifications transversales (secrets, HTTP, CSP, dépendances). Le backend Vercel (`api/*`)
et l'admin sont restés hors périmètre.

## 1. Correctifs appliqués

### server.js
- **En-têtes des réponses d'erreur (403/404/405)** : elles n'envoyaient que `nosniff` (et parfois rien).
  Elles envoient désormais le jeu complet : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **HSTS** : `max-age=63072000` → `max-age=63072000; includeSubDomains; preload` sur le chemin 200.
- **CSP des réponses 200 corrigée** (`script-src 'none'; connect-src 'none'` → `script-src 'self';
  connect-src 'self' https://fitia-mining-pro.vercel.app`) : l'ancienne politique aurait **bloqué**
  `referral.js` et `reset-password.js` (seuls fichiers JS autorisés par `ALLOWED_ROOT_FILES`). Les métas
  CSP par page restent plus strictes (`index.html`/`privacy.html` : `script-src 'none'`, aucun script ;
  `referral.html` : `script-src 'self'` ; `reset-password.html` : connect-src `'self' + vercel.app`).
  Vérifié par la suite `[HTTP-SERVER]` (55/56 — voir §4).

### Pages satellites (index / privacy / referral / reset-password)
- **Contenu 100 % anglais** (balise `<html lang="en">`), plus aucun français visible.
- **referral** : formulaire de lead supprimé (plus aucun envoi tiers), le code lu depuis `/parrainage/<code>`
  est validé par regex (`FITIA-[0-9]{1,78}` ou adresse `0x…`) avant usage, copie professionnelle EN.
  Glyphe directionnel (`→`) retiré (politique anti-glyphs `[UI-GLYPHS]`).
- **privacy.html** : page EN-only ; l'assertion du test `[APPLINKS-PRIVACY]` a été portée de la
  version bilingue FR/EN vers l'exigence EN-only (le test exigeait un contenu qui violait la tâche).
- CSP méta vérifiées et cohérentes avec les scripts réellement chargés par chaque page.

### i18n / intégrité des dictionnaires (qualité, cause de bugs de rendu)
- Dictionnaires `app.js` **réparés** : 240 clés qui avaient été insérées *hors* des objets `fr/en/de/zh`
  (au niveau racine de l'objet `i18n`) ont été déplacées dans leurs dictionnaires — `this.t()` les ignorait.
- Parité stricte : **526 clés × 5 langues (fr/en/de/zh/sg)**, zéro doublon, zéro clé manquante/extra
  (vérifié par évaluation VM de l'objet `i18n`, pas seulement par regex).
- Clés `hub*` (hub des jeux) ajoutées à de/zh/sg (absentes depuis l'origine, présentes en fr/en).
- `store.js` : DE/ZH réels (SG = copie anglaise), 113 clés × 5, nouveau support `data-store-i18n-aria-label`.
- `mfa-client.js` : traductions DE/ZH ajoutées (SG = copie EN) — les 5 langues de l'app couvrent le MFA.
- `wallet.html` : tous les textes/`placeholder`/`aria-label`/`title` liés à l'i18n normalisés (EN par défaut
  au first paint), nouveaux branchements (`data-i18n`, boutons ✕, annonces, assistant, modales d'info jeux).
- **Vue `#view-hub` restaurée** : la suppression préalable de son contenu statique cassait le Hub
  (`game-experience-hub.js` déplace les `.hub-card` existants, il ne les crée pas) et faisait échouer
  2 suites (`run_farm_ui_tests.js`, `run_game_experience_tests.js`). Restauration + normalisation EN ;
  farm UI 34/34, game experience 9/9 de nouveau ✅. Les jeux restent EN-only (choix produit, décision actée).
- `app.js` : ~20 chaînes FR codées en dur (toasts RPC/biométrie, `formatTimeRemaining`, `getErrorMessage`,
  confirmations) migrées vers des clés de dictionnaire (19 nouvelles clés × 5 langues).

### Vérifications transverses
- **`npm audit` : 0 vulnérabilité** (lockfile éphémère créé pour l'audit puis supprimé, convention du repo).
- **XSS** : revue des 32 usages `innerHTML` d'`app.js` — toutes les interpolations sont soit échappées
  (`escapeHtml`), soit numériques/internes/constantes ; les bulles de chat utilisent `textContent` ;
  `typing.innerHTML = '● ● ●'` est statique. Aucun sink exploitable trouvé.
- **Secrets** : aucun fichier suivi contenant `.env`, keystore (`android-src/keystore/` ignoré),
  clé privée ou secret client ; aucune clé API/service-role dans le code client (grep exhaustif).
- **Contenu mixte** : aucune ressource `http://` (uniquement namespaces SVG/URLs de test).
- **Comparaison APK ↔ sources** : voir §4 (échec attendu de `[APK-BINARY]`).

## 2. Points vérifiés sans changement (déjà conformes)

- **Coffre-fort PIN** : AES-256-GCM, clé dérivée PBKDF2-SHA256 **310 000 itérations** (OWASP),
  seconde couche AndroidKeyStore optionnelle ; la phrase de récupération ne quitte jamais l'appareil ;
  presse-papier effacé automatiquement après 45 s.
- **`wallet.html` CSP** : `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*; img-src 'self' data: blob: https://raw.githubusercontent.com`.
  - `script-src 'unsafe-inline'` est **requis** par les handlers inline (`onclick="App.…"`) — voir §5 risques.
  - `connect-src https://*` est **requis** par les endpoints RPC Polygon publics (variables selon opérateur) — voir §5.
- **Garde-fous transactionnels** : blocage adresse burn (`0x000…0`), blocage adresses de contrats
  USDT/FTA/Core/Mine, anti-poisoning (adresses ressemblantes détectées avant PIN), limite de taux PIN
  avec compte à rebours, MFA/TOTP optionnel, SIWE + rotation HMAC (désactivé par défaut, code livré).
- **Mise à jour in-app** : HTTPS, vérification SHA-256 **et** certificat de signature avant installation,
  `UpdateProvider` interne (lecture seule, canonical path).
- **assetlinks.json** : empreinte SHA-256 du certificat release ; `autoVerify` dans le manifest.
- **vercel.json** : en-têtes CSP/DENY par chemin public ; rewrite `/parrainage/*` → `referral.html`.
  Repo **public** → le code client est public par conception, aucun gain à servir `android-src/` statiquement
  hormis cohérence (déjà le cas).

## 3. Décisions produit/scope actées (2026-11-15)

- **Interfaces de jeux EN-only** (vue dynamique `game-experience-*.js` + conteneur statique) : pas de
  localisation FR/DE/ZH/SG — comme au HEAD. L'app reste i18n FR/EN/DE/ZH/SG partout ailleurs.
- **Assistant local (`assistant.js`)** : FR/EN avec fallback EN pour de/zh/sg — conservé tel quel.
- Backend Vercel (`api/*`) et admin : hors périmètre de cet audit.

## 4. État des tests (branch), 2026-11-15

| Suite | Résultat |
|---|---|
| farm UI / game experience / wheel / dice / arcade / multiplayer | 34/34, 9/9, 10/10, 7/7, 13/13, 6/6 |
| farm (unités, échange, pglite exclus) | 48/48 + 26 suites échange ✅ |
| account / MFA (unités, UI, API, e2e) / TOTP / admin | ✅ verts |
| store (18/18) / store-orders (12/12) / hardening (34/34) | ✅ verts |
| `[HTTP-SERVER]` avec le nouveau `server.js` | ✅ vert |
| `[UI-GLYPHS]`, `[APPLINKS-PRIVACY]` | ✅ verts après correctifs |
| `[APK-BINARY]` | ❌ **attendu** : l'APK commité date de la v3.7.20 (pré-branche) ; l'assertion
  « wallet embarqué == `android-src/wallet.html` » ne peut passer qu'après **rebuild signé** de l'APK
  depuis ces sources (CI `build-apk.yml` avec `commit_build=true`, puis merge/release — clé de signature
  hors de ce sandbox). Aucune autre assertion d'APK-BINARY n'échoue. |

Note : la suite `npm test` s'arrête à `run_security_tests.js` (chaînage `&&`) à cause d'APK-BINARY ;
les suites situées après dans la chaîne (`store_order`, `store`, `hardening`) ont été exécutées
directement et sont vertes. Le déclenchement CI de l'APK depuis ce sandbox renvoie HTTP 403.

## 5. Risques acceptés / à traiter plus tard

1. `script-src 'unsafe-inline'` (wallet.html) — migrer les handlers inline vers `addEventListener`
   ou des nonces CSP, puis retirer l'exception.
2. `connect-src https://*` — restreindre à une allowlist d'opérateurs RPC si la liste se stabilise.
3. `frame-ancestors` en meta ignoré par les navigateurs — la protection clickjacking réelle vient des
   en-têtes (`X-Frame-Options` + CSP header `frame-ancestors`), pas des metas.
4. Headers Vercel limités aux pages publiques ; `reset-password.html` sur Vercel n'autorise en CSP
   que `connect-src 'self'` (suffisant sur l'apex : l'API est same-origin ; le miroir `pages.dev`
   dispose de sa propre config, hors repo). HSTS absent de `vercel.json` — à ajouter pour les domaines
   custom si besoin (l'apex *.vercel.app est déjà HTTPS/HSTS côté plateforme).
5. `assistant.js` : détection de "secret" en entrée heuristique (regex + longueur) — meilleure approche :
   blocage strict des 6/12/24 mots sans question, à évaluer.
6. **Release** : APK v3.7.20 embarque l'ancien client (avant cette branche). La v3.7.21 devra être
   construite par la CI depuis ce commit avant publication des notes de version.

## 6. Recommandations

- Intégrer `npm audit` et ces suites UI dans la vérif pré-release (déjà le cas pour les tests via CI).
- Planifier la migration `unsafe-inline` → nonces (point 1) ; mesurer d'abord la part des handlers inline.
- Ajouter un linter `i18n:parity` (script VM comme celui utilisé ici) en pré-commit pour éviter la
  régression de parité constatée (526×5).
- Rejouer `[APK-BINARY]` après rebuild CI ; publier v3.7.21 avec notes « i18n FR/EN/DE/ZH/SG, durcissement en-têtes statiques ».
