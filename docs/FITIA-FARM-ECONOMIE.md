# FITIA FARM — analyse économique préliminaire

**Non validé pour publication.** Cette estimation utilise uniquement la configuration locale, pas les réserves ni les données réelles. Les F-Coins existants restent convertibles à 100 coins = 1 FTA ; aucun solde ou paramètre de retrait n'a été modifié. Un retrait est une demande et non une garantie de paiement.

Pour recalculer : `node scripts/farm-economy-audit.js`.

## Hypothèses et résultats

Calcul idéal par compte déjà installé : production redémarrée instantanément dès la fin de chaque cycle, ventes immédiates, capital et stock suffisants, aucun temps mort ni frais. Six parcelles et douze animaux au maximum ; le coût du terrain et des animaux n'est pas inclus. La nourriture est valorisée au coût moyen d'un paquet (20 coins pour 5), avec stock initial ou reliquats disponibles. Ce modèle ne prédit pas un usage réel ; il montre l'ordre de grandeur maximal **sans tenir compte d'autres jeux, bonus ou nouvelles récompenses**.

| Production | Gain net/cycle | Cycles idéaux/jour | Gain maximal/jour à pleine capacité |
|---|---:|---:|---:|
| Blé ou maïs | 14 coins/parcelle | 48 | 4 032 coins |
| Carotte ou tomate | 21 coins/parcelle | 24 | 3 024 coins |
| Poule | 26 coins/animal | 6 | 1 872 coins |
| Canard | 26 coins/animal | 6 | 1 872 coins |
| Chèvre | 86 coins/animal | 2 | 2 064 coins |
| Mouton | 61 coins/animal | 3 | 2 196 coins |
| Vache | 86 coins/animal | 2 | 2 064 coins |

Blé + 12 moutons : **6 228 coins, soit 62,28 FTA par jour théorique par compte**, hors investissement initial et autres fonctions. Ce n'est pas une garantie de gain ni de retrait. Le plafond actuel est de 10 000 coins par demande, au minimum 1 000 coins, avec 24 h entre demandes et une demande en attente avant paiement ; ces limites ne suppriment pas l'accumulation de dette. Plusieurs comptes, la thésaurisation de stocks, les autres jeux et les ventes fractionnées peuvent modifier l'exposition totale.

Le moulin local convertit un blé en deux aliments : valeur du blé vendu **12 coins**, coût moyen des deux aliments achetés **8 coins**. Le joueur perd donc 4 coins d'opportunité dans cette comparaison, hors contraintes pratiques. La recette n'est pas optimisée et n'a pas été validée pour production.

## Ce qu'il faut avant activation

1. Mesurer, sur données autorisées et à jour, les passifs : soldes, stocks vendables et productions en cours, demandes non payées, bonus et autres jeux. Éviter le double comptage des retraits déjà débités des soldes.
2. Comparer ces engagements à la trésorerie FTA réellement disponible, réservée et vérifiée, ainsi qu'aux flux entrants/sortants et coûts de réseau ; prévoir un fonds de réserve, des seuils d'alerte et un responsable du paiement.
3. Simuler divers taux d'activité, scénarios de croissance et multi-comptes, et les pics de retrait ; faire revoir le modèle et les règles par une personne compétente.
4. Ne pas modifier les soldes existants ni supprimer les demandes en attente pour équilibrer les chiffres. Toute modification future de rendement, reproduction, engrais, récompense convertible ou prix exige un plan de migration, une analyse de dette et validation avant déploiement.

Les déblocages actuels de jardin et lanternes sont purement décoratifs et ne créent aucun objet vendable ou FTA. Ils ne constituent pas un mécanisme anti-triche : le score augmente notamment à chaque vente partielle.

## Engrais et reproduction en développement

Engrais : coût 4 coins, une seule application, durée initiale réduite de 10 %, rendement inchangé. Le calcul suppose l’application immédiate : blé 27 minutes et 10 coins nets par cycle, carotte 54 minutes et 17 coins nets. Pour 24 h à pleine capacité, le script teste toutes les combinaisons de cycles ordinaires et fertilisés par parcelle pour chaque espèce : les meilleurs résultats restent 4 032 coins pour le blé et 3 024 pour la carotte. L’engrais peut néanmoins aider à récolter plus tôt selon l’horaire ; ces calculs idéalisés ne garantissent pas la solvabilité.

Canard et chèvre reproduisent respectivement les paramètres économiques de la poule et de la vache, sans nouveau type de produit. Reproduction : deux adultes disponibles de la même espèce, une place libre, 90 % du prix d'achat de l'animal (arrondi à l’entier supérieur) et un aliment ; le petit attend un cycle avant de produire. Le nombre total d'animaux reste plafonné à 12. Le jeune revient moins cher mais produit plus tard : l’économie est de 25 coins pour une poule ou un canard, 50 pour un mouton, 70 pour une vache ou une chèvre, moins le coût de l’aliment. Avec dix naissances de chèvres à partir de deux parents, l’économie brute maximale sur les prix d’achat est 700 coins, moins dix aliments ; elle est bornée par les douze places tant qu’aucune revente ou suppression d’animal n’existe. Cette économie peut ensuite être convertie indirectement en FTA et doit être intégrée au bilan des passifs. Les calculs n'incluent pas une stratégie à cheval sur plusieurs jours, la fluctuation réelle des stocks, tous les mini-jeux ou les tricheries et ne remplacent pas la vérification des réserves et passifs. Aucun changement n'est déployé.

## Relevé partiel en lecture seule

`scripts/farm-liability-report.sql` calcule des totaux agrégés des soldes, stocks connus et demandes en attente, sans retourner de comptes individuels. La requête a été exécutée sur la base de test. Vérifier que ses prix sont identiques aux prix déployés avant de l'utiliser ailleurs. Elle signale les champs invalides et produits inconnus ; dans ces cas son résultat ne doit pas servir de bilan. Elle ne couvre pas les productions en cours, bonus, jeux, obligations futures ni frais ; ce n’est ni un passif complet ni une preuve de solvabilité. Comparer ensuite avec la trésorerie FTA disponible, à vérifier par un moyen fiable.
