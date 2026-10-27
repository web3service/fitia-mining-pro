# FITIA PRO — Panneau d’administration

Le panneau d’administration est une application Node.js séparée du wallet et de la vitrine publique. Il gère indépendamment `announcements.json` pour les annonces et `promotions.json` pour les cartes cadeaux et badges de la boutique.

## Fonctions

- tableau de bord : annonces actives, programmées, expirées et total ;
- création, modification, duplication et suppression ;
- catégories `event`, `information`, `referral` et `security` ;
- dates de début et de fin facultatives, converties en ISO 8601 ;
- titres et messages en français, anglais, allemand, chinois et sango ;
- aperçu mobile avant enregistrement ;
- recherche, filtres et réorganisation de l’ordre d’affichage ;
- activation ou désactivation du canal distant ;
- détection des modifications concurrentes grâce à la révision du manifeste ;
- sélection d’une machine ou d’une batterie par son numéro visible dans la boutique ;
- présentations `gift` (carte cadeau de Noël) et `badge` (badge promotionnel) ;
- textes de décoration traduits, aperçu mobile, programmation et activation globale.

Le wallet accepte jusqu’à 12 annonces actives simultanément. Le serveur conserve jusqu’à 50 entrées, y compris les annonces programmées ou expirées.

## Cartes cadeaux et badges de la boutique

La numérotation commence à **1** : `1` désigne le premier article du contrat, `2` le deuxième, etc. L’API conserve cet emplacement sous forme d’indice technique commençant à zéro. Un article ne peut posséder qu’une seule décoration et le serveur accepte au maximum 50 décorations.

Les dates `startsAt` et `expiresAt` sont facultatives. Le wallet ignore les entrées futures, expirées ou invalides. Une décoration dont l’article n’existe plus n’est simplement affichée nulle part. Les textes sont limités à 32 caractères et insérés comme texte, jamais comme HTML.

Ce canal est **strictement visuel** : il ne change ni les prix lus sur la blockchain, ni les boutons, ni les transactions d’achat. Une promotion tarifaire réelle reste une opération distincte du propriétaire du contrat. Les annonces et les décorations possèdent des fichiers, des révisions et des publications indépendants.

L’administration peut publier `promotions.json` sans reconstruire l’APK, mais l’affichage exige une version du wallet qui embarque `promotions.js`. L’APK signé existant n’est pas modifié par une publication JSON.

## Sécurité

- mot de passe administrateur exigé, sans stockage dans le navigateur ;
- cookie de session `HttpOnly` et `SameSite=Strict`, expiration après 30 minutes ;
- jeton CSRF exigé pour chaque mutation et contrôle de l’origine ;
- limitation des tentatives de connexion ;
- CSP stricte, aucune dépendance JavaScript distante et rendu dynamique avec `textContent` ;
- secret GitHub conservé exclusivement dans l’environnement du serveur ;
- fichiers du wallet, dépôt Git et autres sources non exposés par le serveur d’administration.

Aucune phrase de récupération, clé privée, clé de signature APK ou donnée du wallet n’est nécessaire au panneau.

## 1. Essais en mode local

Le mode local modifie uniquement le fichier configuré sur le serveur. Il ne publie rien dans l’application des utilisateurs.

```bash
cp announcements.json /tmp/fitia-admin-announcements.json
cp promotions.json /tmp/fitia-admin-promotions.json
export FITIA_ADMIN_PASSWORD='remplacer-par-un-mot-de-passe-long'
export FITIA_ADMIN_LOCAL_MODE=1
export FITIA_ADMIN_DATA_FILE=/tmp/fitia-admin-announcements.json
export FITIA_ADMIN_PROMOTIONS_FILE=/tmp/fitia-admin-promotions.json
npm run admin
```

Ouvrez ensuite `http://localhost:8090`. Le port d’écoute est `0.0.0.0:8090` afin de permettre aussi l’utilisation derrière un reverse proxy.

## 2. Publication dans l’application

Le mode GitHub lit et met à jour `announcements.json` ou `promotions.json` avec l’API Contents de GitHub. Le wallet récupère ensuite chaque manifeste depuis la branche `main` lors de son prochain rafraîchissement.

Configurez côté serveur un secret GitHub limité au dépôt et autorisant **Contents: Read and write**. Ne placez jamais ce secret dans le code, le navigateur, Git ou une conversation.

```bash
export FITIA_ADMIN_PASSWORD='remplacer-par-un-mot-de-passe-long'
export FITIA_GITHUB_TOKEN='secret-conserve-uniquement-sur-le-serveur'
export FITIA_ADMIN_GITHUB_OWNER=web3service
export FITIA_ADMIN_GITHUB_REPO=fitia-mining-pro
export FITIA_ADMIN_GITHUB_BRANCH=main
npm run admin
```

Chaque enregistrement vérifie la révision SHA actuelle avant la publication. Si une autre personne a modifié le manifeste entre-temps, le panneau refuse d’écraser son travail et demande un rechargement.

La branche configurée doit autoriser cette écriture. Chaque enregistrement ne modifie que le manifeste concerné : le panneau ne change ni le code du wallet, ni l’APK, ni les releases.

## FITIA STORE

La section **FITIA STORE** gère `store-products.json` et les photos de `assets/store/`. Chaque fiche accepte un produit en stock propre ou en dropshipping, un prix en USDT ou FTA, un stock public, un délai de livraison et l’adresse Polygon de réception du vendeur.

Le catalogue est public : n’y enregistrez aucune donnée de client. Le wallet ne transmet pas les adresses postales à GitHub, Vercel ou Polygon. Après le paiement direct au vendeur, l’acheteur partage explicitement un reçu contenant la référence, le hash de transaction et ses informations de livraison. L’historique local ne conserve que le récapitulatif du paiement, sans coordonnées postales.

Les routes d’administration associées sont `/api/admin/store-products` et `/api/admin/store-assets`. Elles utilisent la même session, la même protection CSRF et la même vérification de révision que les autres manifestes. Le stock public doit être actualisé par le vendeur après les ventes et auprès du fournisseur dropshipping.

### Produits numériques et licences

Le type **Téléchargement** accepte un e-book, APK, exécutable Windows, logiciel ou archive de **3 Mo maximum par fichier**. Le type **Licence** accepte de 1 à 500 clés par import, une par ligne. Pour un téléchargement, sélectionnez le fichier avant de publier ; pour une licence, ajoutez les clés avant la première publication. Le stock public d’une licence est recalculé depuis les clés encore disponibles lors de l’enregistrement dans l’admin.

Le coffre utilise AES-256-GCM. GitHub ne contient que `digital-vault.json`, qui chiffre les licences et les métadonnées indispensables aux commandes. **Aucun octet d’un fichier payant, même chiffré, n’est écrit sur GitHub.** Le fichier chiffré est enregistré dans un bucket Supabase privé, sous `paid/<identifiant>.bin`, puis lu par le serveur avec une authentification secrète avant remise à l’acheteur. Sans configuration externe valide, le dépôt d’un téléchargement est refusé : il n’existe aucun repli vers GitHub. Les licences restent utilisables sans bucket.

La clé du coffre est dérivée côté serveur de `FITIA_ADMIN_PASSWORD` et `FITIA_GITHUB_TOKEN`, sans transmettre ces secrets au navigateur. **Ne remplacez aucun de ces deux secrets sans une migration prévue du coffre** : l’ancien ciphertext deviendrait indéchiffrable. Une variable `FITIA_DIGITAL_VAULT_KEY` de 32 octets, hexadécimale ou base64, peut être configurée pour utiliser une clé dédiée stable. La clé de service Supabase est un secret serveur à privilèges élevés : ne la placez jamais dans le catalogue, le wallet, GitHub ou une variable publique.

Le paiement reste un transfert ERC-20 direct au vendeur, sans commission. Avant le transfert, `/api/store-digital` vérifie le stock et signe un intent contenant uniquement le panier, le montant et le vendeur. Après le transfert, le serveur vérifie indépendamment la transaction USDT/FTA, son expéditeur, le destinataire, le montant entier exact et trois confirmations Polygon. L’acheteur signe aussi une demande avec son wallet : le hash et l’adresse publics ne suffisent donc pas à récupérer le contenu.

Les licences sont attribuées avec écriture optimiste et ne peuvent pas être réutilisées. Une commande payée lors d’une course de stock reste enregistrée comme « à préparer » et peut être récupérée après réassort, sans nouveau paiement. Les téléchargements utilisent une capability signée valable 15 minutes ; ils peuvent être régénérés par une nouvelle signature de l’acheteur. Les clés et tokens ne sont jamais conservés dans le `localStorage` du wallet.

La limite applicative de 3 Mo évite de dépasser les limites de requête/réponse Vercel. Le palier Supabase Free retenu comprend 1 Go de fichiers et 5 Go d’égress mensuels ; conservez le projet sur ce palier sans ajout payant et surveillez l’usage. Un projet gratuit inactif peut être mis en pause par le fournisseur : les téléchargements redeviennent disponibles après sa réactivation, sans modifier les commandes. Les fichiers plus volumineux ou un trafic supérieur nécessitent une autre capacité avant d’être mis en vente.

## Variables d’environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `FITIA_ADMIN_PASSWORD` | Mot de passe de connexion, 12 à 256 caractères | obligatoire |
| `FITIA_GITHUB_TOKEN` | Secret GitHub côté serveur pour la publication | vide |
| `FITIA_ADMIN_LOCAL_MODE` | `1` pour utiliser le fichier local | actif si aucun token |
| `FITIA_ADMIN_DATA_FILE` | Annonces utilisées en mode local | `announcements.json` |
| `FITIA_ADMIN_PROMOTIONS_FILE` | Décorations utilisées en mode local | `promotions.json` |
| `FITIA_ADMIN_STORE_DATA_FILE` | Catalogue STORE utilisé en mode local | `store-products.json` |
| `FITIA_ADMIN_STORE_ASSET_DIRECTORY` | Photos STORE utilisées en mode local | `assets/store/` |
| `FITIA_ADMIN_DIGITAL_VAULT_FILE` | Coffre chiffré utilisé en mode local | `digital-vault.json` |
| `FITIA_ADMIN_DIGITAL_ASSET_DIRECTORY` | Fichiers chiffrés utilisés en mode local | `digital-assets/` |
| `FITIA_DIGITAL_VAULT_KEY` | Clé AES dédiée facultative, 32 octets hex/base64 | dérivation depuis les deux secrets serveur |
| `FITIA_SUPABASE_URL` ou `SUPABASE_URL` | URL HTTPS du projet Supabase | obligatoire pour les téléchargements |
| `FITIA_SUPABASE_SERVICE_ROLE_KEY` | Secret serveur ; aliases `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | obligatoire pour les téléchargements |
| `FITIA_SUPABASE_BUCKET` | Bucket privé des ciphertexts | `fitia-paid-private` |
| `FITIA_ADMIN_GITHUB_OWNER` | Propriétaire du dépôt | `web3service` |
| `FITIA_ADMIN_GITHUB_REPO` | Nom du dépôt | `fitia-mining-pro` |
| `FITIA_ADMIN_GITHUB_BRANCH` | Branche publiée | `main` |
| `FITIA_ADMIN_PORT` | Port HTTP du panneau | `8090` |

## Déploiement Vercel

Le projet contient les fonctions serverless `api/admin.js` et `api/store-digital.js`, ainsi que les réécritures nécessaires dans `vercel.json`. Le panneau sera disponible sur **`https://votre-domaine/admin/`** après configuration.

1. Ouvrez le projet Vercel, puis **Settings → Environment Variables**.
2. Ajoutez `FITIA_ADMIN_PASSWORD` avec un mot de passe long et unique.
3. Ajoutez `FITIA_GITHUB_TOKEN` avec le secret GitHub côté serveur autorisant **Contents: Read and write** sur ce dépôt.
4. Connectez Supabase, créez le bucket privé `fitia-paid-private`, puis configurez son URL et sa clé de service uniquement côté serveur.
5. Activez ces variables pour **Production**, et pour **Preview** si vous souhaitez tester les déploiements de PR.
6. Redéployez le projet après leur ajout et vérifiez que l’admin indique le stockage externe comme configuré.

Les variables `FITIA_ADMIN_GITHUB_OWNER`, `FITIA_ADMIN_GITHUB_REPO` et `FITIA_ADMIN_GITHUB_BRANCH` sont facultatives et reprennent par défaut `web3service`, `fitia-mining-pro` et `main`.

Ne transmettez ces secrets ni dans le code, ni dans Git, ni dans une conversation. La fonction Vercel exige le mode GitHub : elle ne propose pas d’écriture dans le système de fichiers temporaire de Vercel. Les sessions sont signées et utilisent un cookie `Secure`, `HttpOnly` et `SameSite=Strict`.

La limitation des tentatives intégrée est appliquée par instance serverless. Pour une protection distribuée supplémentaire, une règle de limitation peut aussi être configurée dans le pare-feu Vercel lorsque cette option est disponible sur le compte.

`admin-server.js` reste exclu du déploiement Vercel. Seuls l’interface statique et la fonction serverless sont publiés. Les en-têtes CSP de `/admin/` interdisent les scripts et styles externes.

## Déploiement Node.js séparé

Le serveur autonome reste disponible avec `npm run admin` pour un hébergement Node.js séparé derrière HTTPS. Ne réutilisez pas le serveur public du wallet pour exposer l’administration.

## Tests

Node.js 22 est recommandé. Les tests serveur n’utilisent aucun vrai compte ni token. La publication GitHub est simulée.

```bash
npm install --prefix /tmp/test-deps --no-package-lock --no-audit --no-fund jsdom@26.1.0
npm run test:admin
```

La suite comprend 15 contrôles du serveur autonome, un test d’interface et 8 contrôles Vercel : authentification, CSRF, origines, validation, dates, conflits, réorganisation, suppression, décorations ciblées, catalogue et photos STORE, limitation des tentatives, sessions serverless, publication GitHub simulée et prévention XSS. Les paiements et la confidentialité STORE sont vérifiés séparément avec `npm run test:store`.

Le workflow **Test FITIA admin panel** exécute ces contrôles sur les pull requests concernées et sur `main`.
