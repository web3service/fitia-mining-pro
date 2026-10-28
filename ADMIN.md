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

## FITIA FARM

La section **Retraits FITIA FARM** affiche les demandes de conversion des coins en FTA. Le taux public est de **1 FTA = 100 coins**. Les retraits utilisent des multiples de 100 coins, avec une demande par 24 heures et au maximum une demande en attente par wallet. Aucune conversion en euros ou dollars n’est proposée.

Pour clôturer une demande :

1. envoyez depuis la trésorerie officielle le montant FTA exact vers le wallet indiqué ;
2. attendez au moins trois confirmations Polygon ;
3. collez le hash du transfert dans la carte du retrait, puis appuyez sur **Vérifier et clôturer**.

Le serveur vérifie le contrat FTA, l’expéditeur, le destinataire, le montant et les confirmations avant de passer le statut à `paid`. Une capture d’écran ou un hash sans transfert correspondant ne suffit jamais. La route `/api/admin/farm-withdrawals` exige la session administrateur et le jeton CSRF.

Les tables privées et leurs transactions atomiques sont définies dans `supabase/migrations/20261028000200_create_farm_game.sql`. Le service utilise les variables serveur `FITIA_SUPABASE_URL` et `FITIA_SUPABASE_SERVICE_ROLE_KEY`, déjà séparées du navigateur. Ne placez jamais de clé privée de trésorerie dans Vercel, Supabase, Git ou le panneau : le paiement est effectué depuis le wallet de la trésorerie, puis seulement vérifié par le serveur.

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
| `FITIA_ADMIN_GITHUB_OWNER` | Propriétaire du dépôt | `web3service` |
| `FITIA_ADMIN_GITHUB_REPO` | Nom du dépôt | `fitia-mining-pro` |
| `FITIA_ADMIN_GITHUB_BRANCH` | Branche publiée | `main` |
| `FITIA_ADMIN_PORT` | Port HTTP du panneau | `8090` |

## Déploiement Vercel

Le projet contient une fonction serverless `api/admin.js` et les réécritures nécessaires dans `vercel.json`. Le panneau sera disponible sur **`https://votre-domaine/admin/`** après configuration.

1. Ouvrez le projet Vercel, puis **Settings → Environment Variables**.
2. Ajoutez `FITIA_ADMIN_PASSWORD` avec un mot de passe long et unique.
3. Ajoutez `FITIA_GITHUB_TOKEN` avec le secret GitHub côté serveur autorisant **Contents: Read and write** sur ce dépôt.
4. Activez ces variables pour **Production**, et pour **Preview** si vous souhaitez tester les déploiements de PR.
5. Redéployez le projet après leur ajout.

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
