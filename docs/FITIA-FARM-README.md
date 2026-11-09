# FITIA FARM — aperçu et code en développement

**Statut : travail en cours, non publié.** Cette archive ne contient pas de nouvel APK ; une construction de contrôle a réussi sur GitHub Actions mais n'est pas publiée et n'est pas destinée à être installée. Ne pas installer l'ancien APK du dépôt en pensant qu'il contient ces modifications. Le mode démonstration est isolé, utilise un portefeuille de test généré dans le navigateur et des données en mémoire : les F-Coins, transferts et retraits y sont fictifs, sans connexion à Polygon ou au compte réel. Les données sont effacées à l'arrêt du serveur ; « Réinitialiser » et « Nouvelle ferme » les réinitialisent aussi.

## Démarrer sous Windows

1. Décompresser l'archive dans un dossier.
2. Installer Node.js 22 et ouvrir PowerShell dans le dossier décompressé.
3. Exécuter :

```powershell
npm install --no-package-lock
node scripts/preview-farm.js
```

4. Sur le même ordinateur, ouvrir **http://localhost:4173/**. Garder PowerShell ouvert. Pour arrêter l'aperçu : `Ctrl+C`.
5. Ouvrir « Outils et raccourcis de démonstration » pour essayer les actions ; la ferme commence avec deux chèvres et une culture en pousse pour essayer la reproduction et l’engrais. « Rendre les productions prêtes » accélère artificiellement les productions et la croissance des jeunes animaux de démonstration. « Nouvelle ferme » permet d'essayer l'achat du terrain et du premier animal.

L'aperçu est adapté aux écrans de téléphone. Un aperçu HTTPS peut aussi être ouvert sur un téléphone ; l'accès local par adresse IP dépend du réseau, du pare-feu et des règles de sécurité du navigateur. Aucun test sur téléphone physique n'a encore été effectué.

## Fonctions développées

- Scène 3D isométrique orthographique tactile, rotation par quarts de tour, six parcelles, blé, carotte, maïs et tomate ; plantation, temps de pousse, récolte et vente.
- Poules, canards, moutons, chèvres et vaches ; nourriture, délais, collecte et soins une fois par cycle.
- Reproduction : deux adultes disponibles de même espèce, à 90 % du prix de l’animal et un aliment ; le jeune grandit un cycle avant de produire. Engrais : 4 F-Coins, réduit de 10 % la durée initiale, une fois par culture.
- Puits : arrosage une fois par culture avant maturité ; l’arrosage et les soins réduisent de 5 % la durée initiale, sans modifier le rendement par cycle ; ces règles restent à valider avant activation.
- Moulin : transformation de blé en nourriture ; tracteur : récolte groupée ; silo : nourrissage et collecte groupés ; grange : inventaire et marché.
- Vente partielle et historique récent ; dix missions à récompense unique : six de 10 et quatre de 5 F-Coins, et niveau avec jardin fleuri et lanternes décoratives aux niveaux 2 et 3. Les récompenses sont en développement et ne sont pas actives sur les comptes réels.
- Simulation isolée des dépôts et demandes de retrait. En production, le système existant conserve 100 coins = 1 FTA et le retrait reste une demande en attente jusqu'à confirmation de paiement.

Les fonctionnalités sont encore en développement ; les bâtiments et machines représentés ne sont pas tous fonctionnels. Les prix et la recette du moulin restent à examiner ; les autres fonctionnalités et limites sont détaillées dans `docs/FITIA-FARM-ROADMAP.md`. Le multijoueur de la ferme n'est pas opérationnel.

## Tests automatisés

Après `npm install`, exécuter depuis la racine :

```powershell
node scripts/run_farm_tests.js
node scripts/run_farm_ui_tests.js
node scripts/run_farm_3d_tests.js
node scripts/run_farm_preview_tests.js
node scripts/farm-economy-audit.js
node scripts/run_game_experience_tests.js
node scripts/run_arcade_tests.js
node scripts/run_multiplayer_aviator_tests.js
```

La dernière exécution locale de `npm test` échoue sur la comparaison avec l’ancien APK, qui ne contient pas les nouvelles sources ; une construction de contrôle signée a depuis réussi sur GitHub Actions ; elle n'est pas incluse ici et ne doit pas être installée. Les tests utilisent des dépôts mémoire et une interface simulée : ils ne remplacent ni les tests d'une vraie base, ni ceux d'un téléphone physique ou d'un transfert réel. Certains messages restent à traduire.

## Android et publication

Le code Android et `scripts/build_apk.py` sont inclus, mais l'APK doit être construit avec la toolchain requise et la **clé officielle déjà existante** dans l'environnement de publication. Aucune clé de signature n'est incluse dans cette archive. Ne pas générer une nouvelle clé pour remplacer la signature officielle. Avant toute publication : appliquer et vérifier les migrations sur un environnement de test, sauvegarder les données, tester les opérations et la compatibilité de retour arrière, vérifier l'économie, puis effectuer des tests sur téléphone. Les migrations fournies ne sont pas encore appliquées durablement.

L’analyse préliminaire des gains et les points à valider avant publication figurent dans `docs/FITIA-FARM-ECONOMIE.md`. Le test 3D utilise la géométrie et le raycasting Three.js réels mais un rendu simulé ; il ne remplace pas un test sur téléphone.

La vue isométrique conserve la même taille apparente pour les objets proches et éloignés. Sur téléphone, pincer pour zoomer et glisser horizontalement pour tourner ; les boutons de caméra permettent aussi de changer de vue. La sélection, le cadrage en portrait et la projection ont été testés automatiquement avec Three.js et un rendu simulé. Un essai sur téléphone physique reste nécessaire.

Les F-Coins prévus pour la version finale sont ceux du compte serveur existant, convertibles suivant les règles en vigueur ; l’aperçu isolé ne touche jamais aux vrais comptes. Les nouvelles récompenses n’ont pas été déployées et leur financement doit être validé.

L'aménagement propose deux plans enregistrés côté serveur pour la grange et la maison, sans incidence financière, et trois couleurs au choix pour la grange, la maison, le moulin, le puits, le silo et le tracteur. Un déplacement par flèches est disponible pour les six bâtiments et machines sur des grilles limitées, avec contrôle des collisions. Le placement n’est pas libre sur toute la carte. Aucun de ces changements locaux n'est publié.

Le marché permet aussi la vente de plusieurs produits sélectionnés en une seule opération aux prix du serveur. Les actions individuelles principales conservent leur identifiant en cas de réponse perdue ; le bouton « Vérifier l'action en attente » permet de reprendre ou résoudre cette opération. Effacer les données locales peut empêcher cette reprise.

### Test navigateur sur aperçu isolé

Le test optionnel `npm run test:farm-browser` utilise Playwright et un navigateur Chromium déjà installé. Démarrer au préalable `node scripts/preview-farm.js`, puis renseigner `FARM_CHROMIUM_PATH` avec le chemin du navigateur. Le script refuse les adresses non locales et vérifie la bannière d'argent fictif avant de lancer des actions. Le rendu logiciel et l'écran tactile simulé ne remplacent pas un téléphone physique.
