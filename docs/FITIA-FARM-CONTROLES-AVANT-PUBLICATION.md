# FITIA FARM — contrôles avant publication

Cette liste prépare la publication, elle ne l'autorise pas. La version en développement n'est pas le FARM actuellement publié. Ne pas installer l'ancien APK en pensant qu'il contient la nouvelle version.

## 1. Réserve et engagements

- Exécuter `scripts/farm-liability-report.sql` en lecture seule et conserver uniquement le résultat agrégé. Vérifier que les prix de la requête correspondent aux prix effectivement en production. Tous les compteurs d'erreurs doivent être à zéro.
- Ajouter au bilan les productions en cours, les récompenses et engagements des autres jeux, les frais de réseau, les fonds réservés à d'autres usages et les obligations futures. Ne pas compter deux fois les retraits déjà débités du solde.
- Vérifier le solde de FTA du **bon contrat** et le solde POL pour les frais :
  - [FTA FARM sur PolygonScan](https://polygonscan.com/token/0x5c418b12c7e9c2A8e9A71A68c6d9b319E7B1d1fd?a=0xbcd8a903f41157a269615725ac66c8d9d0c8cc90)
  - [Adresse de trésorerie et POL sur PolygonScan](https://polygonscan.com/address/0xbcd8a903f41157a269615725ac66c8d9d0c8cc90)
- Un solde visible sur un explorateur n'établit ni la liquidité, ni la disponibilité exclusive des fonds, ni la solvabilité future. Refaire ces contrôles juste avant publication ; les soldes changent. Voir `FITIA-FARM-ECONOMIE.md` pour les hypothèses et limites.

## 2. Base de test et migration

- Sauvegarder et vérifier la restauration avant toute migration. Comparer la fonction `farm_apply` installée au fichier de migration ; éviter d'écraser une évolution plus récente.
- Appliquer et tester les migrations locales **sur une base de test isolée** avec l'outil de migration, puis tester le serveur complet et les versions anciennes. Vérifier soldes, stocks, retraits existants, permissions et remise en route après échec.
- Tester en vraies connexions concurrentes les nouvelles actions et leur résolution, les réponses perdues et les reprises. Les expériences réalisées jusqu'ici ne couvrent pas toutes les courses. Prévoir une stratégie de retour arrière compatible avec les états version 2 ; ne pas supprimer le garde-fou pour débloquer un ancien serveur.
- Rien de ceci ne modifie la production tant qu'une publication n'a pas été décidée.

## 3. Téléphone

- Dans l'aperçu HTTPS isolé, vérifier visuellement sur plusieurs tailles Android : chargement de la 3D, cadrage, rotation, pincement, sélection des six parcelles et des bâtiments, plantation, récolte, soins, reproduction, engrais, navigation et retours d'erreur. Vérifier mémoire, fluidité et consommation.
- Les conversions et retraits de l'aperçu sont **fictifs**. Il ne teste pas les transferts Polygon réels ni l'APK Android.
- Une fois un APK de test signé disponible et le serveur de test préparé, tester le parcours Android complet avec comptes et fonds de test, y compris reprise après fermeture. Ne pas envoyer de vrais fonds à des comptes de test.

## 4. APK et décision

- Construire l'APK avec la clé officielle dans l'environnement autorisé ; vérifier son empreinte, les assets, les tests de sécurité, le manifeste et l'installation en mise à jour. Ne jamais générer une nouvelle clé de signature officielle pour contourner l'absence de l'originale.
- Une construction de contrôle a réussi sur GitHub Actions (run `42514683483`, sources `8c5e480`) avec vérification du certificat officiel et suites de tests. L’artefact est conservé par GitHub 30 jours ; il n’a pas été publié en release. Le téléchargement dans cet environnement a échoué (accès au stockage d’artefacts). Le numéro de version reste celui de la version publique existante et le client cible toujours le serveur réel : **ne pas installer ni distribuer cet APK de contrôle** avant préparation d’un environnement de test isolé, des migrations et d’une version distincte. Aucun test sur téléphone réel n'a été effectué.
- Ne pas activer les migrations ou publier le serveur et l'APK avant la décision de publication, la sauvegarde et la validation financière et technique.
