# Préparation MFA : non activée

La fonctionnalité est en cours d’intégration et n’est pas activée en production.
`totp.js`, `secrets.js` et `service.js` sont des composants côté serveur. Une
migration et un adaptateur de stockage sont préparés, mais la migration n’est
pas appliquée. Un contrôleur et des routes d’API sont testés par injection,
mais ils ne sont pas accessibles dans la configuration actuelle de production.
Des écrans Android, la demande de code pour les opérations et le contrôle FARM
sont préparés et testés localement ; le verrou SQL doit être déployé avant
l’activation pour protéger aussi contre les anciens clients.
Il ne faut pas présenter leur présence comme une protection active.

## Périmètre convenu

- Activation volontaire par compte. La connexion par mot de passe reste possible
  sans code Authenticator, y compris pour un utilisateur qui a activé la
  protection des opérations.
- Une fois activée, vérifier la protection avant les opérations choisies
  (envois du portefeuille et retraits), et prévoir des codes de récupération à
  usage unique. Le PIN du wallet reste distinct.
- Un wallet auto-hébergé peut toujours signer ailleurs avec sa phrase de
  récupération. Le contrôle de l’interface n’est pas une protection on-chain.

## Conditions avant activation

1. Concevoir l’enrôlement et sa confirmation en exigeant une réauthentification
   récente. Ne jamais activer un facteur avant qu’un code valide soit vérifié.
   Assurer l’affichage local sécurisé du QR code et ne jamais journaliser la clé.
2. Stocker les secrets chiffrés, avec clé de chiffrement gérée hors de la base,
   et prévoir sauvegarde et rotation. Ne pas déployer la clé de test ni utiliser
   les primitives directement sans gestion de clés opérationnelle.
3. Mettre en place et tester en base la migration préparée. L’adaptateur utilise
   un compare-and-swap pour partager les modifications entre instances ; les
   tests simulent les courses et la logique SQL a aussi été vérifiée dans une
   transaction annulée sur le projet Supabase de test, y compris le rejet
   d’un retrait non autorisé et d’un montant modifié. Il reste à tester les
   courses réelles sur PostgreSQL et le parcours complet. Une
   limite de tentatives **partagée entre instances** doit accepter un
   code TOTP ou un code de récupération au plus une fois grâce à une opération
   atomique côté base. L’outil `verifyTotp` retourne le compteur à consommer ;
   il ne réalise pas lui-même cette protection transactionnelle. Les codes de
   récupération doivent être stockés uniquement sous forme de hachages et
   supprimés atomiquement à l’utilisation. Couvrir les courses concurrentes.
   La récupération ne doit pas reposer uniquement sur le badge email actuel :
   le changement d’adresse n’en vérifie pas encore la possession.
4. Pour les retraits FARM, valider en environnement de test le contrôle
   raccordé et vérifier côté serveur l’association compte-wallet,
   l’activation MFA et une autorisation limitée à l’action et à ses paramètres,
   y compris lors des reprises réseau. Les clients actuels signent leurs requêtes
   directement : modifier uniquement l’interface serait contournable.
5. Pour les envois on-chain, valider la demande de code dans le client immédiatement
   avant la signature, après affichage du destinataire et du montant, et annuler
   si la session ou les paramètres changent. Une signature faite ailleurs ne
   sera pas bloquée ; il ne faut pas prétendre le contraire.
6. Provisionner une clé stable `FITIA_MFA_ENCRYPTION_KEY` en base64 (32 octets)
   hors du dépôt, sauvegardée et protégée. Déployer la migration puis l’API et
   l’APK coordonnés avant `FITIA_MFA_ENABLED=true` ; tester les indisponibilités.
   Ne jamais désactiver ce drapeau si des comptes ont activé MFA : les opérations
   côté client doivent échouer en cas de panne, jamais contourner la protection.
7. Tester l’enrôlement, les échecs, la récupération, la révocation, les courses,
   les changements de compte, les anciens clients et les pannes ; ne pas activer
   en production tant que la migration et les parcours n’ont pas été audités.
