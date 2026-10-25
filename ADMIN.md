# FITIA PRO — Panneau d’administration

Le panneau d’administration est une application Node.js séparée du wallet et de la vitrine publique. Il gère le fichier `announcements.json` déjà lu par le centre d’annonces de l’application.

## Fonctions

- tableau de bord : annonces actives, programmées, expirées et total ;
- création, modification, duplication et suppression ;
- catégories `event`, `information`, `referral` et `security` ;
- dates de début et de fin facultatives, converties en ISO 8601 ;
- titres et messages en français, anglais, allemand, chinois et sango ;
- aperçu mobile avant enregistrement ;
- recherche, filtres et réorganisation de l’ordre d’affichage ;
- activation ou désactivation du canal distant ;
- détection des modifications concurrentes grâce à la révision du manifeste.

Le wallet accepte jusqu’à 12 annonces actives simultanément. Le serveur conserve jusqu’à 50 entrées, y compris les annonces programmées ou expirées.

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
export FITIA_ADMIN_PASSWORD='remplacer-par-un-mot-de-passe-long'
export FITIA_ADMIN_LOCAL_MODE=1
export FITIA_ADMIN_DATA_FILE=/tmp/fitia-admin-announcements.json
npm run admin
```

Ouvrez ensuite `http://localhost:8090`. Le port d’écoute est `0.0.0.0:8090` afin de permettre aussi l’utilisation derrière un reverse proxy.

## 2. Publication dans l’application

Le mode GitHub lit et met à jour `announcements.json` avec l’API Contents de GitHub. Le wallet récupère ensuite le manifeste depuis la branche `main` lors de son prochain rafraîchissement.

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

La branche configurée doit autoriser cette écriture. Seul `announcements.json` est modifié : le panneau ne change ni le code du wallet, ni l’APK, ni les releases.

## Variables d’environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `FITIA_ADMIN_PASSWORD` | Mot de passe de connexion, 12 à 256 caractères | obligatoire |
| `FITIA_GITHUB_TOKEN` | Secret GitHub côté serveur pour la publication | vide |
| `FITIA_ADMIN_LOCAL_MODE` | `1` pour utiliser le fichier local | actif si aucun token |
| `FITIA_ADMIN_DATA_FILE` | Fichier utilisé en mode local | `announcements.json` |
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

La suite comprend 12 contrôles du serveur autonome, un test d’interface et 5 contrôles Vercel : authentification, CSRF, origines, validation, dates, conflits, réorganisation, suppression, limitation des tentatives, sessions serverless, publication GitHub simulée et prévention XSS.

Le workflow **Test FITIA admin panel** exécute ces contrôles sur les pull requests concernées et sur `main`.
