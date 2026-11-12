# Grille plus fine et caps plus fins près du départ et de l'arrivée

Note d'étude du 11/11/2026, pour décision du porteur de projet. **Rien n'est modifié dans le jeu ni mis en ligne.**
Idée du porteur de projet (11/11/2026) : une grille plus fine, avec plus de directions, à moins de 500 milles du départ
et de l'arrivée (tour de la Guadeloupe à la Route du Rhum, Fastnet). En attendant, la solution provisoire du même jour
est en place : contournement automatique des marques, et de la côte à moins de 500 milles de l'arrivée
(`docs/decisions-jeu.md`).

## 1. Ce qui est grossier aujourd'hui (et ce qui ne l'est pas)

Mesures sur les cartes actuelles :

| Carte | Quadrillage | Taille d'une case | Distance d'un tour (IMOCA, au mieux) |
|---|---|---|---|
| Route du Rhum | 120 × 96 cases | 30 milles | 24 cases, environ 720 milles |
| Transat Café L'Or | 120 × 134 cases | 30 milles | idem |
| Rolex Fastnet | 186 × 104 cases | 2,55 milles | réglée pour 15 tours |

Trois finesses différentes jouent près d'une île, et elles n'ont pas le même poids :

1. **Le dessin des côtes** est déjà plus fin que la case : chaque case de mer qui touche une côte porte un relevé de
   4 × 4 sous-cases (7,5 milles), la « terre fine » du 10/11/2026. Le bateau, lui, s'arrête déjà à sa position exacte
   (correction du 11/11/2026), pas au centre d'une case.
2. **La grille de calcul** (30 milles) sert à tout le reste : le chemin le plus court vers l'arrivée (ce que l'IA
   et le contournement suivent), les marques et la ligne d'arrivée (des listes de cases), l'occupation d'une case
   par un seul bateau (priorité, collision dans la brume), les zones météo. La Guadeloupe fait à peine 1,5 case de
   large : le contournement automatique la suit en marches d'escalier de 30 milles.
3. **Les caps** : 16 directions, soit 22,5° entre deux caps voisins. Au bout d'un tour de 720 milles, deux caps
   voisins arrivent à **280 milles** l'un de l'autre. C'est de loin la plus grosse imprécision : la zone d'approche
   (500 milles) est plus courte qu'un seul tour. Le joueur peut déjà raccourcir son tour (« distance maximale
   souhaitée »), ce qui atténue un peu le problème.

Conclusion : une grille plus fine améliore le contournement, la ligne d'arrivée et le jugement de l'IA ; **seuls des
caps plus fins** rendent au joueur la précision de visée près d'une île. Les deux sont utiles, et indépendants.

## 2. Les approches comparées

### A. Une seconde grille, zoomée, autour du départ et de l'arrivée

Le large reste en cases de 30 milles ; dans un rayon de 500 milles autour du départ et de l'arrivée, une grille
5 fois plus fine (6 milles). Le bateau change de grille en entrant dans la zone.

- **Pour** : la carte du large ne change pas ; la finesse est seulement là où elle sert, exactement l'idée du porteur
  de projet.
- **Contre** : tout le moteur raisonne aujourd'hui dans une seule grille. Il faudrait que chaque calcul sache dans
  quelle grille est le bateau, et gérer le passage de l'une à l'autre **au milieu d'un déplacement** (un tour de
  720 milles traverse toute la zone), le chemin le plus court raccordé à la frontière, les marques à cheval, la
  priorité entre un bateau dans la zone et un autre juste dehors, les fronts météo qui y entrent, l'affichage.
- **Effort** : 8 à 12 sessions de travail. Les erreurs se logeraient surtout à la frontière, là où on ne les voit pas
  en simulation rapide.

### B. Une grille unique, plus fine partout, avec un budget de distance mis à l'échelle (recommandée)

On régénère les cartes transatlantiques avec des cases 3 fois plus petites (10 milles), ou 5 fois (6 milles), avec le
générateur actuel (`outils/generer-carte-rhum.ts`, réglage `cadre.largeur`). La distance d'un tour, comptée en cases,
est multipliée d'autant (réglage `echelle` de la course) : un tour couvre le même nombre de milles qu'aujourd'hui.

- **Pour** : **le moteur sait déjà le faire.** Le Fastnet tourne sur ce même moteur avec des cases de 2,55 milles :
  la taille de case est un réglage de chaque course (`milles_par_case`), et la jauge des 640 milles en 24 h est déjà
  calculée en milles. Une seule grille, donc pas de frontière à gérer.
- **Contre** : la finesse s'applique aussi au milieu de l'océan, où elle ne sert à rien (sans gêne pour le joueur, la
  grille est invisible). Une vingtaine de réglages sont encore exprimés « en cases » et devraient passer en milles
  (voir §4), sinon le jeu change de comportement sans qu'on l'ait voulu. Une case occupée par un seul bateau devient
  beaucoup plus petite : les priorités et collisions dans la brume deviendront rares (à revoir avec le porteur de
  projet).
- **Mesure faite le 11/11/2026** (copie agrandie de la carte, en local) :

  | Carte | Finesse | Cases | Préparation de la carte | Mémoire des chemins | 112 trajets |
  |---|---|---|---|---|---|
  | Route du Rhum | actuelle (30 milles) | 11 520 | 0,04 s | 0,3 Mo | 5 ms |
  | Route du Rhum | ×3 (10 milles) | 103 680 | 0,3 s | 2 Mo | 9 ms |
  | Route du Rhum | ×5 (6 milles) | 288 000 | 0,8 s | 7 Mo | 10 ms |
  | Café L'Or | ×3 (10 milles) | 144 720 | 0,2 s par classe | 2 Mo | 13 ms |
  | Café L'Or | ×5 (6 milles) | 402 000 | 0,8 s par classe | 6 Mo | 7 ms |

  Les déplacements et l'IA restent instantanés. La préparation de la carte (une fois par partie) passe sous la
  seconde : acceptable dans le navigateur ; **à vérifier sur le serveur réseau** (Cloudflare limite le temps de calcul
  d'une requête). Le fichier de carte passe de 20 ko à 100–400 ko (compressé à l'envoi).
- **Effort** : 3 à 4 sessions pour ×3 (convertir les réglages en milles, régénérer les deux cartes, recaler par
  simulation le nombre de tours, contrôles visuels du tour de la Guadeloupe), plus 1 session pour le serveur réseau.

### C. Garder la grille, affiner seulement ce qui se voit (la plus légère)

Cases de 30 milles inchangées ; dans les 500 milles : relevé des côtes plus fin (8 × 8 sous-cases au lieu de 4 × 4)
et caps plus fins (voir §3).

- **Pour** : 2 à 3 sessions, peu de risque.
- **Contre** : le chemin de contournement, la ligne d'arrivée et l'IA restent à 30 milles ; c'est l'imprécision
  qu'on voulait corriger autour de la Guadeloupe.

### Variante écartée : des tours plus courts près des côtes

Couper le tour en deux (deux caps par tour) dans la zone d'approche serait le plus réaliste, mais tous les bateaux
jouent le même tour en même temps : cela toucherait la météo, le réseau et l'ordre de résolution. Hors de proportion
pour le gain.

## 3. Des caps plus fins (s'ajoute à A, B ou C)

Passer de 16 à **32 caps** (11,25° d'écart) dans les 500 milles du départ et de l'arrivée, en gardant 16 caps au large
pour ne pas alourdir la rose des caps.

- Le moteur garde le vent par pas de 45° ; seules les allures intermédiaires sont nouvelles. Les tables des voiles ne
  donnent que 45°, 90°, 135° et 180° : l'interpolation existante (22,5°) doit être généralisée. Les noms d'allure
  (« bon plein », « petit largue »…) n'existent pas pour 56° : afficher l'allure la plus proche.
- Écran : une rose de 32 caps dans la zone d'approche (ou 16 caps et un réglage fin ±11°, plus lisible sur téléphone).
- Les seuils des alizés et des courants sont exprimés en « crans » de 22,5° : à convertir en degrés.
- L'IA essaie deux fois plus de caps : sans conséquence mesurable.
- **Effort** : 2 sessions. **Règle à valider** : 32 caps, ou 16 caps et un réglage fin ?

## 4. Risques communs à chiffrer

| Risque | A (2 grilles) | B (grille unique fine) | C (léger) |
|---|---|---|---|
| **Sauvegardes** : aucune partie en cours n'est gardée dans le navigateur (seulement les réglages) | sans effet | sans effet | sans effet |
| **Réseau** : une partie en cours sur le serveur au moment de la mise en ligne serait cassée (positions dans l'ancienne grille) | à publier hors partie | idem | sans effet (32 caps : idem) |
| **Serveur** : temps de préparation de la carte | moyen | à mesurer (0,3 à 0,8 s) | sans effet |
| **IA** : elle suit le chemin le plus court de la grille | à refaire à la frontière | meilleure, sans rien changer | inchangée |
| **Chemins les plus courts** (champs de distance) | raccord entre grilles, délicat | recalcul simple, déjà fait pour le Fastnet | inchangés |
| **Réglages en cases** à convertir en milles : vue des concurrents (2,5 cases), dérive du courant, largeur des bords de louvoyage, rayon des zones côtières, rayons des fronts, de la molle et de l'anticyclone (`regles.json`), seuils du contournement, taille minimale d'affichage d'une case | double jeu de réglages | une fois | sans objet |
| **Équilibre du jeu** (nombre de tours, priorités, collisions) | à recaler | à recaler par simulation (`outils/sim-classes.ts`) | faible |

## 5. Recommandation

1. **B à ×3 (cases de 10 milles)** pour la Route du Rhum et la Transat Café L'Or : c'est le moyen le plus sûr d'avoir
   une Guadeloupe, des marques et une ligne d'arrivée dessinées finement, parce que le moteur fonctionne déjà ainsi
   sur le Fastnet. Le ×5 coûte peu de plus en calcul ; on choisira après avoir vu le ×3.
2. **Ensuite, si la visée reste trop grossière**, les caps fins du §3, seulement dans les 500 milles.
3. Écarter A : même résultat visible que B pour le joueur, trois fois plus de travail et des erreurs difficiles à voir.

Première étape proposée (1 session, sans rien publier) : régénérer la Route du Rhum à 10 milles par case sur une
copie, convertir les réglages en milles, puis comparer en simulation (nombre de tours, contournement de la
Guadeloupe, durée de préparation) avec la carte actuelle. Le contournement automatique près de l'arrivée reste en
place tant qu'il est utile.

## 6. Questions au porteur de projet

1. D'accord pour une grille plus fine **partout** (B) plutôt que seulement près des côtes (A), puisque le joueur ne
   voit pas la grille ?
2. Caps plus fins : 32 caps dans la zone d'approche, ou 16 caps plus un réglage fin de ±11° ?
3. Avec des cases de 10 milles, deux bateaux se gêneront beaucoup plus rarement (priorité, collision dans la brume).
   Faut-il élargir la zone de priorité (par exemple 30 milles autour du bateau) pour garder ces situations ?
