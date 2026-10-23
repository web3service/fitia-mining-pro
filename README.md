# ⚡ FITIA PRO MINER V3.2.1 — Application Mobile Autonome & APK Android Durci

Application mobile **100% indépendante** pour l'écosystème **FITIA PRO** sur **Polygon Mainnet (Chain ID 137)**, intégrant directement son propre **portefeuille crypto non-custodial haute sécurité** et compilée en **APK Android signé (`FITIA-PRO-Miner.apk`)**.

Aucune connexion à un wallet externe (MetaMask, Trust Wallet ou WalletConnect) n'est requise.

---

## 🛡️ Architecture Sécurité Durcie (V3.2.1)

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

---

## 🧪 Tests Automatisés & Recompilation APK

```bash
# Lancer la suite complète d'audit sécurité & tests E2E (14 suites)
npm test

# Recompiler, aligner (4 octets) et signer l'APK Android (v2 + v3)
npm run build:apk
```
