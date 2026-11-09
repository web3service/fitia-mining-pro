# FITIA FARM — analyse économique préliminaire

**Non validé pour publication.** Cette estimation utilise uniquement la configuration locale, pas les réserves ni les données réelles. Les F-Coins existants restent convertibles à 100 coins = 1 FTA ; aucun solde ou paramètre de retrait n'a été modifié. Un retrait est une demande et non une garantie de paiement.

Pour recalculer : `node scripts/farm-economy-audit.js`.

## Hypothèses et résultats

Le tableau ci-dessous est la base **sans arrosage ni soins**. Calcul idéal par compte déjà installé : production redémarrée instantanément dès la fin de chaque cycle, ventes immédiates, capital et stock suffisants, aucun temps mort ni frais. Six parcelles et douze animaux au maximum ; le coût du terrain et des animaux n'est pas inclus. La nourriture est valorisée au coût moyen d'un paquet (20 coins pour 5), avec stock initial ou reliquats disponibles. Ce modèle ne prédit pas un usage réel ; il montre l'ordre de grandeur maximal **sans tenir compte d'autres jeux, bonus ou nouvelles récompenses**.

| Production | Gain net/cycle | Cycles idéaux/jour | Gain maximal/jour à pleine capacité |
|---|---:|---:|---:|
| Blé ou maïs | 14 coins/parcelle | 48 | 4 032 coins |
| Carotte ou tomate | 21 coins/parcelle | 24 | 3 024 coins |
| Poule | 26 coins/animal | 6 | 1 872 coins |
| Canard | 26 coins/animal | 6 | 1 872 coins |
| Chèvre | 86 coins/animal | 2 | 2 064 coins |
| Mouton | 61 coins/animal | 3 | 2 196 coins |
| Vache | 86 coins/animal | 2 | 2 064 coins |

Sans arrosage ni soins, blé + 12 moutons : **6 228 coins, soit 62,28 FTA par jour théorique par compte**, hors investissement initial et autres fonctions. Ce n'est pas une garantie de gain ni de retrait. Le plafond actuel est de 10 000 coins par demande, au minimum 1 000 coins, avec 24 h entre demandes et une demande en attente avant paiement ; ces limites ne suppriment pas l'accumulation de dette. Plusieurs comptes, la thésaurisation de stocks, les autres jeux et les ventes fractionnées peuvent modifier l'exposition totale.

Le moulin local convertit un blé en deux aliments : valeur du blé vendu **12 coins**, coût moyen des deux aliments achetés **8 coins**. Le joueur perd donc 4 coins d'opportunité dans cette comparaison, hors contraintes pratiques. La recette n'est pas optimisée et n'a pas été validée pour production.

## Ce qu'il faut avant activation

1. Mesurer, sur données autorisées et à jour, les passifs : soldes, stocks vendables et productions en cours, demandes non payées, bonus et autres jeux. Éviter le double comptage des retraits déjà débités des soldes.
2. Comparer ces engagements à la trésorerie FTA réellement disponible, réservée et vérifiée, ainsi qu'aux flux entrants/sortants et coûts de réseau ; prévoir un fonds de réserve, des seuils d'alerte et un responsable du paiement.
3. Simuler divers taux d'activité, scénarios de croissance et multi-comptes, et les pics de retrait ; faire revoir le modèle et les règles par une personne compétente.
4. Ne pas modifier les soldes existants ni supprimer les demandes en attente pour équilibrer les chiffres. Toute modification future de rendement, reproduction, engrais, récompense convertible ou prix exige un plan de migration, une analyse de dette et validation avant déploiement.

Les déblocages actuels de jardin et lanternes sont purement décoratifs et ne créent aucun objet vendable ou FTA. Ils ne constituent pas un mécanisme anti-triche : le score augmente notamment à chaque vente partielle.

## Engrais et reproduction en développement

Engrais : coût 4 coins, une seule application, durée initiale réduite de 10 %, rendement inchangé. Le calcul suppose l’application immédiate : blé 27 minutes et 10 coins nets par cycle, carotte 54 minutes et 17 coins nets. En tenant compte de l’arrosage gratuit (5 %), de l’engrais (10 % supplémentaires) et des soins (5 %), le script teste les combinaisons de cycles arrosés, avec ou sans engrais. À pleine capacité, ses estimations idéales sont 4 200 coins pour le blé et 3 150 pour la carotte. Avec douze moutons soignés, le maximum calculé est 6 396 coins, soit 63,96 FTA par jour théorique et par compte, hors récompenses de mission et autres jeux. L’engrais peut néanmoins aider à récolter plus tôt selon l’horaire ; ces calculs idéalisés ne garantissent pas la solvabilité.

Canard et chèvre reproduisent respectivement les paramètres économiques de la poule et de la vache, sans nouveau type de produit. Reproduction : deux adultes disponibles de la même espèce, une place libre, 90 % du prix d'achat de l'animal (arrondi à l’entier supérieur) et un aliment ; le petit attend un cycle avant de produire. Le nombre total d'animaux reste plafonné à 12. Le jeune revient moins cher mais produit plus tard : l’économie est de 25 coins pour une poule ou un canard, 50 pour un mouton, 70 pour une vache ou une chèvre, moins le coût de l’aliment. Avec dix naissances de chèvres à partir de deux parents, l’économie brute maximale sur les prix d’achat est 700 coins, moins dix aliments ; elle est bornée par les douze places tant qu’aucune revente ou suppression d’animal n’existe. Cette économie peut ensuite être convertie indirectement en FTA et doit être intégrée au bilan des passifs. Les calculs n'incluent pas une stratégie à cheval sur plusieurs jours, la fluctuation réelle des stocks, tous les mini-jeux ou les tricheries et ne remplacent pas la vérification des réserves et passifs. Aucun changement n'est déployé.

## Relevé partiel en lecture seule

`scripts/farm-liability-report.sql` calcule des totaux agrégés des soldes, stocks connus et demandes en attente, sans retourner de comptes individuels. La requête a été exécutée sur la base de test. Vérifier que ses prix sont identiques aux prix déployés avant de l'utiliser ailleurs. Elle signale les champs invalides et produits inconnus ; dans ces cas son résultat ne doit pas servir de bilan. Elle ne couvre pas les productions en cours, bonus, jeux, obligations futures ni frais ; ce n’est ni un passif complet ni une preuve de solvabilité. Comparer ensuite avec la trésorerie FTA disponible, à vérifier par un moyen fiable.

## Récompenses de mission proposées

Six récompenses uniques de 10 F-Coins et quatre de 5 représentent jusqu’à 80 coins, soit 0,8 FTA de dette supplémentaire par compte, si toutes sont réclamées. N comptes éligibles représentent jusqu’à 0,8 × N FTA en plus, sans compter les autres mécanismes. Les comptes multiples ne sont pas limités par identité réelle ; certaines actions, notamment les ventes fractionnées, sont facilement répétables. Ces récompenses peuvent être obtenues après réalisation des objectifs, sans financement additionnel automatique. Il faut les inclure dans le passif non réclamé, les simulations, les contrôles anti-abus et la décision économique avant déploiement. Elles sont testées localement mais non activées en production.

## Scénarios pour plusieurs comptes

`node scripts/farm-economy-audit.js 10 30` estime dix comptes très actifs pendant trente jours. La simulation multiplie la production idéale par le nombre de comptes et de jours, et ajoute une seule fois les missions ; elle ne tient pas compte des horaires traversant minuit ni des autres jeux. Par exemple, hors missions : 1 compte = 63,96 FTA par jour, 10 comptes = 639,6 FTA par jour et 100 comptes = 6 396 FTA par jour. Sur 30 jours, 10 comptes représentent 19 188 FTA de production idéale et jusqu’à 8 FTA de missions, soit 19 196 FTA. Ce n’est pas un paiement prédit ni une preuve de solvabilité ; les soldes existants, stocks, frais, abus, dépôts et autres engagements ne sont pas inclus. Il n'existe pas encore de plafond global de nouveaux gains implémenté ni de réserve verrouillée pour la ferme.
