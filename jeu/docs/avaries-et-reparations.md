# Avaries et cartes réparation : la règle complète

Ce document décrit pour les développeurs le fonctionnement du moteur. Les joueurs n'en voient qu'une version générale :
la page des règles et le coach disent seulement qu'« une avarie fait perdre une part de l'avance, parfois pendant
plusieurs tours » et que « les cartes réparation permettent d'en limiter l'impact ». Le détail chiffré n'apparaît que
dans la fenêtre de la carte, au moment où le joueur choisit de réparer ou non.

Décisions du porteur de projet du 12/11/2026, facteur de réparation des avaries durables (× 1,5) compris : il l'a
validé le même jour.

## 1. Le principe

Une avarie ne coûte pas une distance fixe. Elle coûte **une part de l'avance prévue du tour**, la même quels que soient
le vent, la classe et la course. L'ancienne règle, en milles fixes, clouait un bateau sur place par petit temps et ne
lui coûtait presque rien par vent fort.

### Barème `p` (part de l'avance perdue)

| Effet de la carte (`evenements.json`) | Gravité | `p` |
|---|---|---|
| `distance: -1` | légère | 25 % |
| `distance: -2` | moyenne | 50 % |
| `demi: true` (chute à l'eau) | moyenne | 50 % |
| `distance: -3` | lourde | 75 % |
| `immobile: true` (filet de pêche) | tour perdu | 100 % |

Formule : `p = min(1, 0,25 × −distance)`, ou 0,5 pour `demi`, ou 1 pour `immobile`.

### Ce que coûte chaque situation

| Situation | Tour de la carte | Tours suivants |
|---|---|---|
| Avarie d'un tour, encaissée | `p` | rien |
| Avarie d'un tour, réparée | `p / 2` | rien |
| Avarie durable (`tours: N`), encaissée | `p` | `p` à chacun des `N − 1` tours suivants |
| Avarie durable, réparée | `min(1, p × 1,5)` | rien |
| Voile menacée (`perte_voile`), endurée | voile perdue + 50 % | rien |
| Voile menacée, réparée | voile sauvée + 100 % (tour perdu) | rien |

Pour la carte « spi déchiré », le choix se fait entre la voile et le tour, pas entre deux pertes de temps.

**Risque en plus** (`risque: +1`, cartes « quille » et « crochet de ris ») : le risque compte sur le tour de la carte,
que l'avarie soit réparée ou non. Si elle est encaissée, il compte aussi à chacun des tours suivants. Si elle est
réparée, il s'arrête là.

**Bonnes nouvelles** : les milles en plus (`distance` positive) restent en unités de la table des voiles. Les cartes de
risque −1 sur plusieurs tours (`nuit_calme`, `veille_meteo`) ne sont pas des avaries. Elles ne passent ni par le
barème ni par la réparation.

## 2. Le déroulé d'un tour, fonction par fonction

Tout le code est dans `packages/engine/src/` :

1. **Tirage** (`moteur.ts`, `avancer` → `tirerEvenement`). Le dé du large est lancé pour tous les bateaux, juste
   après le jet du vent et avant tout calcul de distance. Une avarie tirée par un bateau qui a encore des cartes
   réparation pose une question :
   - pour un joueur humain, c'est l'attente `reparation`, motif `evenement` ;
   - l'IA répare si l'avarie est grave (`immobile`, `perte_voile`, durable ou `distance ≤ −2`) ou si elle a au moins
     2 cartes.
2. **Effets immédiats** (`traiterReparationEvenement` → `appliquerTirage`). La fonction :
   - compte l'avarie dans les statistiques et ajoute la carte réparation gagnée, le cas échéant ;
   - pour une avarie **durable non réparée**, pousse un `Modificateur` avec `perte = p`, `distance = 0`,
     `risque = e.risque`, `toursRestants = N − 1` et `nouveau = true` ;
   - pour une voile menacée non réparée, retire la voile (`perdreVoile`).
3. **Calcul de la distance du tour** (`regles.ts`, `calculerDistance`). Les modificateurs `nouveau` sont **ignorés** : le
   tour de la carte est compté à l'étape suivante, pas ici. Même chose pour le risque dans `calculerRisque`.
4. **Effet sur le tour de la carte** (`moteur.ts`, `resoudreEvenement`). Le moteur fait dans l'ordre :
   - il ajoute les milles d'une bonne nouvelle ;
   - il applique `ctx.distance = round(ctx.distance × (1 − perteCarte(e, reparee)))` ;
   - il ajoute `e.risque`.

   Une perte de 100 % ou une distance tombée à 0 laisse le bateau sur place, avec l'événement `bloque`.
5. **Fin du tour** (`finirTour`). Un modificateur `nouveau` passe à `false` sans perdre de tour. Les autres perdent
   un tour (`toursRestants--`) et sont retirés à 0.
6. **Tours suivants** (`calculerDistance`). Après le plafond de jauge, chaque modificateur `perte` multiplie la
   distance par `1 − perte`, avec au moins 1 case. Une ligne de détail s'affiche dans le tableau de bord, par exemple
   « Foil endommagé : avance −25 % (encore 2 tours) : −3 ». La même perte apparaît dans le récapitulatif du bateau
   (`client/src/jeu/RecapBateau.tsx`). Le risque du modificateur est compté par `calculerRisque`.

La fonction `perteCarte(e, reparee)` est la **seule source du barème**. Le moteur et l'écran l'utilisent tous les deux :
`client/src/jeu/CarteEvenement.tsx` s'en sert pour le texte de la carte et pour la phrase « Réparer… ». Pour changer un
chiffre, on ne change que cette fonction et la constante `REPARATION_DURABLE`.

### Détails à connaître

- **Plusieurs avaries en même temps se multiplient.** Avec 25 % puis 50 %, il reste 0,75 × 0,5 = 37,5 % de l'avance.
  La perte totale ne dépasse donc jamais 100 %.
- **Arrondis.** Chaque perte est arrondie à la case (`Math.round`). Les tours suivants gardent au moins 1 case. Le tour
  de la carte peut tomber à 0 : le bateau reste alors sur place.
- **Moral du skipper.** La durée `tours` est celle de `effetModule`. Une compétence `avarie_tours` (±1) l'allonge ou la
  raccourcit. Une avarie ramenée à 1 tour est traitée comme une avarie d'un tour : réparée, elle coûte `p / 2`.
- **Fenêtre de la carte.** Elle affiche l'effet brut de la carte (`carte.effet`), sans la modulation par la
  compétence.
- **Case noire et dé de risque.** Ce ne sont pas des cartes : ils passent par `traiterReparation`, motifs
  `voile_noire` et `penalite`. Pour une case noire d'un monocoque :
  - en endurant, la voile est perdue et le bateau avance de moitié ;
  - en réparant, la voile est sauvée mais le bateau n'avance pas.

  Le chavirage d'un multicoque ne change pas. Ces règles sont dans `decisions-jeu.md`.

## 3. Exemples chiffrés

Avance prévue de 12 cases au tour de la carte, 8 au tour suivant, 10 au troisième :

| Carte | Encaissée | Réparée |
|---|---|---|
| Foil endommagé (−1, 3 tours) | 12→9, 8→6, 10→8 : **7 cases perdues** | 12→8 (−37,5 %) : **4 cases perdues** |
| Pilote automatique (−1, 2 tours) | 12→9, 8→6 : **5 cases perdues** | 12→8 : **4 cases perdues** |
| Empannage non maîtrisé (−2, 2 tours) | 12→6, 8→4 : **10 cases perdues** | 12→3 (−75 %) : **9 cases perdues** |
| Crochet de ris (risque +1, 2 tours) | risque +1, puis +1 | risque +1 ce tour seulement |
| Water-ballast (−3, 1 tour) | 12→3 | 12→8 (−37,5 %) |
| Spi déchiré | voile perdue, 12→6 | voile gardée, 12→0 |

À avance égale d'un tour à l'autre, réparer une avarie durable fait gagner :
- 1,375 tour sur une avarie légère de 3 tours (0,75 contre 0,375) ;
- 0,125 tour sur une avarie légère de 2 tours ;
- 0,25 tour sur une avarie moyenne de 2 tours.

## 4. Tests

Les tests sont dans `packages/engine/test/moteur.test.ts`. Ils vérifient :
- le barème, y compris les avaries durables réparées ;
- la perte des tours suivants dans `calculerDistance` (qui ignore le modificateur `nouveau`) et la multiplication de
  deux avaries ;
- le risque d'un modificateur dans `calculerRisque` ;
- qu'une avarie durable réparée ne laisse pas de modificateur et qu'une avarie encaissée en laisse un avec la même `p` ;
- la case noire, endurée ou réparée ;
- le water-ballast réparé par F2.

## 5. Historique

- 11/11/2026 : la réparation divise l'effet par deux (`effetReduit`, aujourd'hui supprimée).
- 12/11/2026 : barème en part du tour. Une avarie réparée coûte la moitié. Pour une voile menacée, on choisit entre le
  tour et la voile.
- 12/11/2026, ensuite : décision du porteur de projet sur les avaries durables. « Les pénalités qui durent plusieurs
  tours suivent le principe de la perte de %, appliqué à la distance du premier puis du deuxième tour. La carte
  réparation annule l'impact sur le deuxième tour mais coûte plus cher au premier tour. »
- **Corrigé en même temps.** Avant, le modificateur d'une avarie durable comptait déjà sur le tour de la carte, en plus
  de l'effet de la carte. Le premier tour comptait donc double, et l'avarie durait un tour de trop au total.
- **Facteur × 1,5 validé par le porteur de projet (12/11/2026).** C'est la constante `REPARATION_DURABLE` de
  `moteur.ts`. Avec ce facteur, réparer reste intéressant, mais ne fait presque rien gagner sur les avaries légères de
  2 tours. Avec × 2, réparer ne ferait jamais rien gagner sur 2 tours à avance égale. Ne pas le changer sans l'accord du
  porteur de projet.
- Simulation au Rhum (20 parties par classe, 4 IA) : 13 tours en IMOCA, 18 en Class40 et 9 en Ultim pour le
  vainqueur (médianes). C'est inchangé à un tour près.
