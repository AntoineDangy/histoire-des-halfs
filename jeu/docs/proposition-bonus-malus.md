# Bonus et malus : diagnostic et propositions (08/11/2026)

> Document de travail à trancher avec le porteur de projet. Rien n'est appliqué au jeu tant que ce n'est pas validé
> et reporté dans `decisions-jeu.md`.

## 1. Règles du jeu des compétences (déjà validées ou proposées)

| # | Règle | Statut |
|---|---|---|
| R1 | Un skipper = une compétence signature : un **bonus** et un **compromis**, présentés comme un style de navigation, jamais comme un défaut. | validée (cahier §4) |
| R2 | Chaque bonus et chaque malus doit avoir un effet **sur toutes les courses**, quel que soit le parcours. | validée le 08/11/2026 |
| R3 | **Même ampleur** pour le bonus et le compromis, vérifiée par simulation : contre 3 skippers sans compétence sur le même bateau, 19 à 31 % de victoires (25 % = équilibre parfait). | cahier §9, à confirmer |
| R4 | *Proposée* : le bonus et le compromis portent sur **le même axe** (deux faces d'un même style). Exemple : à l'aise dans la brise, moins vif dans le petit temps. Plus lisible pour un enfant, plus juste pour un passionné. | à valider |
| R5 | *Proposée* : des compétences de **types variés** (pas seulement « ± 1 case »), pour que chaque skipper se joue différemment. | à valider |

Rappel d'échelle : sur la carte réaliste, « 1 case » de la table des voiles vaut environ **75 milles** par tour de 22 h.

## 2. Diagnostic des 10 compétences actuelles

RESULTATS_SIMULATION

| Compétence | Axe du bonus | Axe du compromis | Problème |
|---|---|---|---|
| Dur au mal | brise | brise (risque) | cohérent ; même compromis que la famille Foiler (doublon) |
| Météorologue | petit temps | brise | cohérent (miroir de Dur au mal) |
| Kiffeur | portant | près | cohérent ; très fort sur les parcours de portant (Route du Rhum) |
| Grimpeur | près | portant | cohérent ; faible sur la Route du Rhum |
| Bricoleur | réparations | voiles | cohérent |
| Voilier | voiles | réparations | cohérent ; rarement utile |
| Stratège | hasard du vent | distance | cohérent |
| Régatier | départ et arrivée côtiers | brise | bonus limité au début et à la fin ; compromis sans rapport (provisoire) |
| Navigateur | courants, brume | alizés | **dépend du parcours** (contraire à R2) |
| Mental d'acier | avaries | très petit temps | compromis sans rapport |

## 3. Catalogue de nouveaux types de bonus et de malus

Chaque idée vaut sur tous les parcours. Les valeurs seront calibrées par simulation.

### A. Le moment de la course
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Finisseur** (coureur de fond) | +1 case à partir de la mi-course | −1 case pendant les 3 premiers tours | marins qui montent en puissance et gèrent leur sommeil |
| **Sprinteur** | +1 case pendant les 3 premiers tours | −1 case dans le dernier tiers de la course | départs canon, fatigue en fin de course |

### B. La flotte autour de soi
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Régatier** (au contact) | +1 case quand un concurrent est à moins de 90 milles ; peut passer une case occupée | −1 case quand il est isolé (aucun concurrent à moins de 300 milles) | les marins du circuit Figaro, qui marquent leurs adversaires |
| **Loup solitaire** | +1 case quand il est isolé | −1 case au contact de la flotte | ceux qui tentent une option à l'écart |
| **Chasseur** | +1 case quand il est derrière un concurrent à moins de 150 milles | −1 case quand il est en tête de la course | aime revenir par l'arrière, moins à l'aise pour contrôler |

### C. La conduite du bateau (régularité, manœuvres)
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Métronome** | +1 case quand il garde le même cap qu'au tour précédent | −1 case quand il change de cap de plus de 45° | régularité, bateau calé sur le pilote |
| **Manœuvrier** | virements et empannages sans perte : +1 case quand il change de cap de plus de 45° | −1 case quand il garde le même cap | « tireur de bords » au portant comme au près |

### D. Le rapport au risque
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Attaquant** | +1 case en permanence | risque +1 cran en permanence | toujours à 100 % |
| **Gestionnaire** | risque −1 cran en permanence | −1 case par vent fort (F6 et plus) | ménage son bateau pour finir |
| **Dur au mal** (revu) | +1 case par vent fort | −1 case par petit temps (F3 et moins) | à l'aise quand ça souffle, s'ennuie dans la pétole |

### E. L'information et le hasard
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Navigateur** (revu, routeur) | voit à l'avance le résultat du **dé de force** du tour avant de choisir | −1 case au tour où son routage le fait changer de voile (temps de manœuvre) | les marins réputés pour leur lecture de la météo |
| **Stratège** (actuel) | 2 relances du dé de direction par course | −1 case au tour de la relance | — |
| **Chanceux** | relance le dé événement une fois sur deux quand il tombe sur une avarie | une carte heureuse sur deux ne lui rapporte rien (« il ne s'en rend pas compte ») | la « baraka » |

### F. Le bateau et le matériel
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Bricoleur** (actuel) | +1 réparation | une voile en moins | — |
| **Préparateur** | les avaries durables (cartes) durent 1 tour de moins | une carte réparation en moins | bateau préparé au millimètre |
| **Spécialiste des voiles de portant** | +1 case sous gennaker et spi | −1 case sous J3 et solent | style de voilure plutôt qu'allure |

### G. Le savoir (quiz)
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Vieux briscard** | une fois par course, la bonne réponse est donnée d'office | ses questions sont d'un niveau au-dessus | l'expérience |
| **Pédagogue** | une mauvaise réponse ne coûte que la moitié de la pénalité | ses risques se déclenchent sur un cran de plus | celui qui explique tout |

### H. Le moral (cartes du large)
| Nom | Bonus | Compromis | Inspiration |
|---|---|---|---|
| **Mental d'acier** (revu) | « passe ton tour » devient « distance ÷ 2 » ; les avaries des cartes durent 1 tour de moins | les cartes heureuses ne rapportent rien de plus que le plaisir | ne se laisse atteindre ni par le bon ni par le mauvais |
| **Communicant** | les cartes heureuses rapportent le double | les avaries des cartes durent 1 tour de plus | porté par ses supporters, mais vit tout intensément |

## 4. Proposition de jeu de 10 compétences (à discuter)

Un mélange qui couvre tous les types, chaque style ayant une contrepartie claire :

1. Dur au mal (revu : brise / petit temps)
2. Météorologue (petit temps / brise)
3. Kiffeur (portant / près)
4. Grimpeur (près / portant)
5. Régatier (revu : au contact / isolé)
6. Navigateur (revu : voit le dé de force / temps de manœuvre)
7. Stratège (inchangé)
8. Bricoleur (inchangé)
9. Finisseur (fin de course / départ)
10. Mental d'acier (revu : résistance aux avaries / moins de bonheur)

Voilier, Attaquant, Gestionnaire, Métronome, Chanceux, Communicant, Vieux briscard… restent en réserve pour
d'autres classes (Mini 6.50, Ultim) ou d'autres saisons.
