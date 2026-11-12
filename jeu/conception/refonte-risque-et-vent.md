# Refonte du risque, des questions, des pertes de voile et du vent : bilan et propositions (10/11/2026)

Demande du porteur de projet : revoir les règles du risque, des questions, des pertes de voile et l'utilité du dé
de risque ; revoir l'évolution de la force du vent (on reste trop longtemps à des forces très faibles).
Mesures : `outils/mesure-risques.ts` et `outils/mesure-vent.ts` (30 à 60 courses simulées par classe, IA contre IA).

## 1. Bilan mesuré du risque (par tour et par bateau)

| | IMOCA | Ultim | Ocean Fifty | Class40 |
|---|---|---|---|---|
| Dé de risque lancé | 73 % | 74 % | 71 % | 73 % |
| Incident, donc **question** | **40 %** | 45 % | 38 % | 40 % |
| Bonne réponse | 71 % | 68 % | 73 % | 73 % |
| Avarie (après question ou carte réparation) | 11 % | 15 % | 10 % | 11 % |
| Case noire | 0,3 % | 1,0 % | 1,4 % | 0,1 % |
| Voile perdue | 0,6 % | 0,7 % | 0,9 % | 0,7 % |

**Défauts :**
1. **Trop de questions** : une question presque un tour sur deux. Elles deviennent une corvée et perdent leur valeur.
2. **Le dé de risque décide peu** : il mène surtout à une question, que l'on réussit 7 fois sur 10.
3. **Les conséquences ne dépendent pas de la voile** : un incident avec un spi par force 7 donne la même pénalité
   tirée au hasard (déplacement divisé par deux, recul…) qu'un incident sous solent.
4. **La perte de voile est presque inexistante** (moins de 1 tour sur 100) : la gestion des voiles, cœur du jeu
   de 1987, ne pèse pas. L'IA évite la case noire, et la pénalité « perte de voile » est rare.
5. Rien ne récompense la prise de risque quand elle passe, à part la distance.

## 2. Propositions pour le risque (à choisir, combinables)

**A. Moins d'incidents.** Seuils abaissés d'un cran : faible 1 sur 6, modéré 2 sur 6, élevé 3 sur 6, très élevé 4 sur 6.

**B. Conséquence à la mesure de la voile et du risque** (au lieu d'une pénalité tirée au hasard) :
- risque faible : le bateau perd un peu de distance (un quart) ;
- modéré : déplacement divisé par deux ;
- élevé : voile endommagée, inutilisable au tour suivant ;
- très élevé : voile perdue ;
- case noire : voile perdue sans avancer (comme en 1987).
Une carte réparation annule toujours la conséquence.

**C. La question devient une chance de s'en sortir, pas un passage obligé** : après un incident, le joueur choisit
de répondre à une question (bonne réponse : l'incident est évité ; mauvaise : la conséquence s'applique) ou de jouer
une carte réparation. Les questions deviennent plus rares (≈ 1 tour sur 6) et donc plus marquantes.

**D. Récompenser l'audace** : sur un 6 au dé de risque, avec un risque modéré ou plus, « ça passe en force » :
+1 case. Le dé de risque devient une vraie tension, dans les deux sens.

## 3. Vent : bilan et propositions

Mesure (vent général, après les dés) : F1 16 %, F2 10 %, F3 14 %, F4 15 %, F5 17 %, F6 11 %, F7 8 %, F8 8 %.
Les séquences de petit temps (F1-F2) durent en moyenne 4 tours, jusqu'à 15 tours de suite.

**Cause** : le dé de force (−2, −1, 0, 0, +1, +2) est borné à F1 : à F1, tout tirage négatif laisse le vent à F1.
Le vent « colle » donc aux extrêmes (F1 16 %, F8 16 %).

**L'idée du porteur de projet** (« à F1, pas de baisse ») ne change rien telle quelle : c'est déjà ce que fait la
borne. Pour qu'elle marche, il faut que **les baisses deviennent des hausses** près du minimum.

**Proposition : un vent qui revient vers la moyenne.**
- F1 et F2 : dé (0, +1, +1, +1, +2, +2) : il ne baisse jamais, et remonte presque toujours ;
- F3 à F6 : dé actuel (−2, −1, 0, 0, +1, +2) ;
- F7 et F8 : dé (−2, −2, −1, 0, 0, +1) : les coups de vent finissent par passer.

Simulation : F1 3 %, F2 9 %, F3 17 %, F4 17 %, F5 18 %, F6 16 %, F7 11 %, F8 9 % ; petit temps de 1,4 tour en moyenne
(au lieu de 4,3). Le petit temps reste possible (molle d'arrivée, fronts), mais ne s'installe plus.
