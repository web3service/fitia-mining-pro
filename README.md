# ⚡ FITIA PRO MINER V3.3.12 — Application Mobile Autonome & APK Android Durci

Application mobile **100% indépendante** pour l'écosystème **FITIA PRO** sur **Polygon Mainnet (Chain ID 137)**, intégrant directement son propre **portefeuille crypto non-custodial haute sécurité** et compilée en **APK Android signé (`FITIA-PRO-Miner.apk`)**.

Aucune connexion à un wallet externe (MetaMask, Trust Wallet ou WalletConnect) n'est requise.

## 🌐 Vitrine Web & Application Android Uniquement

- **`index.html` + `landing.css`** : page publique de présentation du projet et de téléchargement de l'APK. Elle ne contient ni le wallet ni ses scripts.
- **`android-src/wallet.html`** : interface du portefeuille réservée à l'APK et embarquée sous `assets/www/wallet.html`.
- **Chargement local sécurisé** : Android ouvre `https://app.fitia.pro/wallet.html`, dont le contenu est intercepté et servi depuis les assets locaux. L'origine est conservée pour préserver le coffre chiffré et les données existantes.
- **Chargement silencieux** : seule l'animation est affichée, sans messages de progression.
- **En-tête allégé** : l'adresse du wallet est remplacée par un bouton **Paramètres** ouvrant les réglages et la sécurité. L'adresse reste disponible dans la carte Portefeuille et à la réception. Dans cette modale, les sous-titres techniques, indications réseau, boutons PolygonScan/Verrouiller et émojis sont masqués sans désactiver les protections.
- **Parrainage dans Paramètres (3.3.8)** : la section Parrainage est déplacée du tableau de bord vers la modale Paramètres. Le partage de son propre code, le statut du parrain actuel et la liaison d'un parrain conservent leurs identifiants et leurs actions, sans emoji dans la modale.
- **Création et importation épurées (3.3.9)** : l’accueil conserve uniquement le logo, le nom FITIA PRO et les actions utiles. Les cartes promotionnelles, le badge Polygon, les compteurs d’étape et les emojis sont retirés des écrans d’authentification. Les boutons PIN et d’effacement restent fonctionnels, avec des libellés corrigés et des icônes SVG nettes.

---

## 🛡️ Architecture Sécurité Durcie (V3.3.12)

- **Chiffrement du Coffre-Fort à 3 Couches Indépendantes** :
  1. **Couche 1 (Utilisateur)** : `AES-256-GCM` dérivé du code PIN à 6 chiffres via `PBKDF2-SHA256` à **310 000 itérations** (sel aléatoire 128 bits, IV 96 bits). Rejet systématique des codes PIN faibles ou répétitifs (`123456`, `000000`, `121212`, `258025`, etc.).
  2. **Couche 2 (Appareil / WebCrypto)** : Sur-chiffrement par une clé `CryptoKey` `AES-256-GCM` **non-exportable (`extractable: false`)** stockée dans `IndexedDB` — même du code JavaScript ne peut pas exporter ses octets bruts.
  3. **Couche 3 (Matériel Android TEE)** : Scellement matériel `AES/GCM/NoPadding` (`AKS1:...`) via **`AndroidKeyStore`** matériel dans l'APK Android, empêchant toute attaque par force brute hors-ligne en cas d'extraction de fichiers.
- **Anti-Force Brute Multi-Persistance** : compteur d'échecs et verrouillage progressif (`30s` -> `120s` -> `300s`) synchronisés simultanément entre `localStorage`, `IndexedDB` et `SharedPreferences` natif Android (impossible à contourner en vidant le stockage Web).
- **Protections Natives Android (`MainActivity.java` & `AndroidManifest.xml`)** :
  - `FLAG_SECURE` dynamique bloquant les captures d'écran et l'enregistrement d'écran sur tous les écrans sensibles (création, affichage des 12 mots / clé privée, claviers PIN, mise en arrière-plan).
  - Protection **Anti-Tapjacking** (`setFilterTouchesWhenObscured(true)`) contre les superpositions d'écran malveillantes.
  - Nettoyage automatique du presse-papiers Android **45 secondes** après la copie des 12 mots ou de la clé privée.
  - `android:debuggable="false"`, `WebView.setWebContentsDebuggingEnabled(false)`, `android:allowBackup="false"`, `MIXED_CONTENT_NEVER_ALLOW` et `network_security_config.xml` (`cleartextTrafficPermitted="false"`).
- **Gardes Transactionnels & Réseau** :
  - Validation stricte **HTTPS + Anti-SSRF** (blocage RFC1918, loopback, IPv6 privé et métadonnées cloud) sur les nœuds RPC personnalisés.
  - Blocage préventif des envois vers l'adresse nulle (`0x000...000`) et vers les adresses de contrats (`USDT`, `FTA`, `Core`, `Mine`) pour éviter toute perte irréversible de tokens.
  - Verrouillage automatique sur inactivité (premier plan et arrière-plan) avec purge atomique des clés en RAM.

---

## ⛓️ Connexion Directe Blockchain & Contrat `FitiaMiningV3_Mine` (V3.2)

- **Multi-RPC Polygon Mainnet avec basculement automatique** et plancher de gaz EIP-1559 (`maxPriorityFeePerGas >= 30 Gwei`).
- **Double Vue Financière Claire** :
  1. **Mon Portefeuille Polygon (On-Chain)** : soldes réels `POL` (gaz), `USDT` (ERC-20) et `FTA` (ERC-20), avec **QR Code de réception hors-ligne** et envoi direct protégé par PIN.
  2. **Compte Minage (Contrat FITIA Core)** : soldes internes `uBal` / `fBal` utilisés par `FitiaMiningV3_Mine` et le `Swap`, avec **auto-dépôt intelligent** lors d'un achat en boutique ou d'un swap.
- **Compatibilité `FitiaMiningV3_Mine` V3.2 & V3.0** : synchronisation temps réel sur `myInfo(address)`, gestion de `shopExpiry` et fallback automatique sur les contrats V3.0.
- **Historique & notifications locaux par adresse** : toutes les transactions initiées via le signer sont enregistrées avec leur type, montant disponible, état (`pending` / confirmée / échouée), hash et lien PolygonScan. Les transactions en attente sont revérifiées après déverrouillage ou retour au premier plan. Chaque résultat final affiche le statut réel du reçu on-chain, son bloc et, lorsqu'ils sont disponibles, le nom exact du custom error ou le motif du contrat avec sa traduction. En l'absence de motif, l'historique l'indique explicitement sans en inventer. Aucune clé privée, phrase de récupération ou réponse RPC sensible n'est enregistrée dans ce module.
- Le centre d'activité couvre les envois, approbations, dépôts, retraits, achats, connexions de machines, claims, parrainages et swaps. Il ne prétend pas resynchroniser les opérations on-chain antérieures ou externes, qui restent consultables sur PolygonScan.
- **Réclamation des récompenses** : affiche « Réclamation en attente… » au clic puis « Réclamation confirmée » uniquement après un reçu réussi. Une réponse RPC 403 est revérifiée par le hash de transaction et n'est jamais présentée comme une erreur du contrat ; sans reçu, l'opération reste en attente.

---

## 📣 Annonces Officielles dans l’Application

- **Bannière permanente sur l’accueil** pour les informations, événements, parrainages et messages de sécurité. Elle ne peut pas être fermée accidentellement.
- Rotation de droite à gauche toutes les **8 secondes**, avec une transition de **1,4 seconde**, des points de sélection et la navigation par balayage horizontal. La rotation se met en pause hors de l’accueil, en arrière-plan et lorsque le wallet est verrouillé.
- **`announcements.json`** permet de publier des annonces traduites sans modifier le wallet. Chaque entrée possède un identifiant unique, une catégorie et des dates `startsAt` / `expiresAt` facultatives ; les annonces futures, expirées ou invalides sont ignorées.
- Les textes sont validés, limités en longueur et insérés uniquement avec `textContent`. Aucun HTML, lien ou visuel distant n’est accepté. En cas de coupure réseau, des annonces locales traduites restent disponibles.

---

## 📲 Mise à Jour dans l’Application & Signature Stable

- **`update-current.json`** publie la version disponible pour FITIA PRO 3.3.7 et les versions suivantes, l’URL GitHub Release et le SHA-256 de l’APK. La version 3.3.9 est proposée directement aux installations 3.3.7 et 3.3.8, qui utilisent le même certificat.
- **Mise à jour obligatoire à partir de 3.3.9** : toute version supérieure ouvre une modale non fermable qui reste affichée pendant le téléchargement et jusqu’à l’installation. Il n’existe ni bouton « Plus tard », ni report mémorisé, ni contournement par la fermeture générique des modales ou le bouton Retour Android.
- **Message professionnel et générique** : les notes distantes et le détail des versions ne sont pas affichés. La modale indique uniquement que des améliorations de sécurité et de nouvelles fonctionnalités sont disponibles, avec l’action de téléchargement et d’installation.
- **Canaux historiques protégés** : `update-stable.json` reste volontairement sur 3.3.6 et `update.json` sur 3.3.5 afin de ne jamais proposer automatiquement un APK signé avec un certificat incompatible.
- **Migration manuelle vers 3.3.9** : depuis 3.3.5 ou 3.3.6, sauvegardez d’abord les 12 mots du wallet, installez manuellement l’APK 3.3.9 et désinstallez l’ancienne version si Android refuse le changement de signataire. Les mises à jour 3.3.7+ utilisent le nouveau certificat stable et le canal intégré.
- Le téléchargement natif accepte uniquement les releases HTTPS du dépôt officiel, limite la taille du fichier et vérifie son SHA-256 avant d’ouvrir le programme d’installation Android. Le provider interne expose uniquement cet APK en lecture seule.
- Android demande toujours l’autorisation d’installation et la confirmation de l’utilisateur. Le canal de mise à jour dans l’application est actif, tandis que la vitrine publique reste en maintenance.
- **Nouveau certificat stable à partir de 3.3.7** : le build réutilise `android-src/keystore/fitia-release.p12` (dossier ignoré par Git) et vérifie l’empreinte publique `fa3494fb50ee2240f477b7cb21bb0d8606cedceac36a263e1e877f34319fdf72` épinglée dans `android-src/release-certificate-sha256.txt`. Il ne génère pas de nouvelle clé automatiquement et refuse de produire un APK avec un certificat différent. Aucune continuité avec les certificats 3.3.5 ou 3.3.6 n’est revendiquée.
- La clé privée et ses mots de passe doivent être sauvegardés hors Git dans un emplacement sécurisé. Les variables `FITIA_ANDROID_KEYSTORE`, `FITIA_ANDROID_KEYSTORE_PASSWORD`, `FITIA_ANDROID_KEY_PASSWORD` et `FITIA_ANDROID_KEY_ALIAS` permettent d’utiliser un emplacement externe. Si `FITIA_ANDROID_KEY_ALIAS` est absent, le compilateur détecte automatiquement l’unique entrée `PrivateKeyEntry`, y compris avec un alias généré par Windows.
- Le workflow manuel **Build signed Android APK** restaure la clé depuis les secrets `FITIA_ANDROID_KEYSTORE_BASE64` et `FITIA_ANDROID_KEYSTORE_PASSWORD`, vérifie le certificat et exécute les tests. Son option `commit_build` permet d’enregistrer l’APK testé et `update-current.json` sur une branche non principale : le job de signature reste en lecture seule et un job séparé, sans accès à la clé, effectue le commit.

---

## 🛠️ Panneau d’administration FITIA PRO

Une application Node.js séparée permet de gérer les événements et annonces du wallet : programmation, traductions, aperçu mobile, réorganisation et publication sécurisée de `announcements.json`.

```bash
# Démarrer le serveur d’administration (configuration décrite dans ADMIN.md)
npm run admin

# Exécuter les tests serveur et interface du panneau
npm run test:admin
```

Consultez **`ADMIN.md`** pour les modes local et GitHub, les variables d’environnement et les règles de déploiement. Le panneau ne fait partie ni de la vitrine publique ni de l’APK.

---

## 🧪 Tests Automatisés & Recompilation APK

```bash
# Lancer la suite complète d'audit sécurité & tests E2E (29 tests)
npm test

# Recompiler, aligner (4 octets) et signer l'APK Android (v2 + v3)
npm run build:apk
```
