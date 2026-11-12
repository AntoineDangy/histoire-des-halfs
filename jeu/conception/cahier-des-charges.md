# Cahier des charges — Jeu « Course au large » (projet Mémoire du large)

> Document destiné à Claude Code. Il décrit le jeu, ses règles chiffrées, ses données, son architecture et les étapes de réalisation.
> Toutes les valeurs numériques de règles sont des **valeurs initiales à calibrer par simulation** (voir §9). Elles sont centralisées dans des fichiers de configuration, jamais codées en dur.

---

## 0. Instructions générales pour Claude Code

1. Travailler **phase par phase** (§12). Ne pas commencer une phase avant que les critères d'acceptation de la précédente soient remplis.
2. Le moteur de jeu est **pur, déterministe et testé** : aucune dépendance à l'interface, au réseau ou au hasard non initialisé (générateur aléatoire à graine).
3. **Ne jamais inventer de données réelles** (skippers, bateaux, palmarès, records, architectes). Les fichiers de données réelles sont fournis par le porteur de projet. En attendant, utiliser uniquement des **données fictives clairement marquées** (`"fictif": true`).
4. Aucun texte dévalorisant sur une personne réelle. Les malus sont décrits comme des **compromis de style de navigation**, jamais comme des défauts.
5. Interface en français. Prévoir l'internationalisation (fichiers de traduction) sans traduire.
6. Chaque phase se termine par : tests verts, lint propre, une courte note `CHANGELOG.md`.

---

## 1. Vision et périmètre

**Concept** : jeu de course au large au tour par tour, inspiré de *Course au Large* (MB, 1987), associé au site Mémoire du large. Il doit être à la fois ludique et pédagogique. Le joueur choisit une course, une classe, un skipper (parmi le top 10 de la saison de chaque classe) et un bateau. Il navigue en choisissant un cap et une voile face à un vent changeant.

**Public** : grand public (y compris des enfants) et passionnés.

**Durée d'une partie** : 10 à 15 minutes en format standard, 30 minutes au maximum (tours du monde).

**Modes de jeu**
| Mode | Description | Phase |
|---|---|---|
| Solo contre IA | 1 humain + 1 à 5 IA | MVP |
| Local même écran | 2 à 6 humains sur un appareil, possibilité d'ajouter des IA | MVP |
| Réseau local | Un serveur lancé sur un PC du bureau ou de la maison ; les joueurs rejoignent depuis leur navigateur sur le même réseau | Phase 4 |
| En ligne (Internet) | Hors périmètre initial ; l'architecture ne doit pas l'empêcher | Futur |

**Progression** : les victoires débloquent des éléments de **décoration du bateau** (§8).

---

## 2. Arbitrages de conception (à valider par le porteur de projet)

| # | Arbitrage | Justification |
|---|---|---|
| A1 | **Tours simultanés** : tous les joueurs choisissent cap et voile en même temps, puis le tour est résolu pour tous. En local même écran, la saisie se fait à tour de rôle, écran masqué. | Le jeu original est séquentiel et le vent passe d'un joueur à l'autre. Avec 4 à 6 joueurs sur 30 tours, une partie dépasserait 30 minutes. Le mode simultané divise la durée par le nombre de joueurs. |
| A2 | **Vent global par tour** (2 dés, comme dans l'original), modifié localement par des **zones météo** sur la carte. | Cela garde la tension des dés de l'original et ajoute la diversité géographique (alizés, pot au noir, mers du Sud). |
| A3 | **Une course = une classe.** | Validé. |
| A4 | **1 compétence signature par skipper**, avec bonus et malus de même ampleur. | Validé. L'équilibre est vérifié par simulation (§9). |
| A5 | **Profil de bateau par famille d'architecture**, pas par modèle. | Cela limite le nombre de profils à justifier. |
| A6 | **Chavirage des multicoques** : une case noire immobilise le bateau 2 tours, au lieu de seulement lui faire perdre une voile. | Cela reflète la réalité des multicoques sans éliminer le joueur. |
| A7 | **Quiz facultatif** (activé par défaut). Quand il est désactivé, un risque déclenché est un échec direct, modéré par les cartes réparation. | Le jeu reste jouable par des enfants ou en partie rapide. |

---

## 3. Règles du jeu

### 3.1 Plateau
- Grille de cases carrées. Déplacements dans **8 directions** (N, NE, E, SE, S, SW, W, NW). Une diagonale compte pour 1 case, comme dans l'original.
- Le déplacement d'un tour se fait **en ligne droite**. Le joueur peut s'arrêter avant la distance maximale (1 case minimum si possible), sauf s'il navigue à sec de toile.
- Deux bateaux ne peuvent pas occuper la même case. Un bateau ne peut pas traverser une case occupée (exception : compétence Régatier).

**Types de cases** (configurables par carte) :
| Type | Effet |
|---|---|
| `mer` | aucun effet |
| `terre`, `haut_fond` | infranchissable |
| `cote` | abri possible contre la tempête (règle III-6 de l'original) |
| `port` | réparation complète ; soumis à la règle d'escale de la course (§3.9) |
| `zone_exclusion_glaces` | infranchissable (équivalent moderne des icebergs) |
| `brume` | chaque case compte double |
| `courant` (direction) | dévie le bateau d'1 case dans la direction du courant |
| `alize` (direction favorable) | +1 case si le cap est favorable, −1 sinon |
| `pot_au_noir` | force du vent plafonnée à 1 ; direction tirée au hasard à chaque tour |
| `mers_du_sud` | force du vent +2 (plafonnée à 8) |
| `zone_cotiere` | sert à la compétence Régatier (départ, arrivée, caps) |

### 3.2 Vent
- État global : `direction` (8 valeurs, par pas de 45°) et `force` (1 à 8).
- **Ordre du tour, repris de l'original et essentiel au jeu** : les joueurs choisissent cap et voile **avec le vent actuel** ; ensuite seulement, les dés de vent sont lancés ; le déplacement et le risque sont calculés **avec le nouveau vent**. Le cap et la voile ne peuvent plus être changés après le jet. C'est ce qui crée la tension : un Spi choisi au largue peut se retrouver en case noire si le vent tourne.
- À chaque tour : dé de force (−2, −1, 0, 0, +1, +2) et dé de direction (−45°, 0°, +45°, faces réparties 2/2/2). Force bornée entre 1 et 8.
- Les zones météo modifient le vent **pour la case de départ du bateau** pendant ce tour.
- **Bulletin météo** : l'interface affiche la tendance du tour suivant (sens probable), sauf en classe Mini 6.50, qui navigue sans routage. C'est un clin d'œil pédagogique, désactivable.

### 3.3 Allure
Angle entre le cap choisi et la direction **d'où vient** le vent :
| Angle | Allure | Règle |
|---|---|---|
| 0° | bout au vent | déplacement impossible |
| 45° | près | |
| 90° | travers | |
| 135° | largue | |
| 180° | vent arrière | |

### 3.4 Voiles (6 cartes par joueur, plus 2 cartes réparation)
Distance de base par allure (« — » : voile inutilisable à cette allure) :

| Voile | Près 45° | Travers 90° | Largue 135° | Arrière 180° |
|---|---|---|---|---|
| Voilure réduite (GV arisée + tourmentin) | 1 | 2 | 2 | 2 |
| J3 / Foc | 2 | 3 | 3 | 2 |
| Solent / J2 | 3 | 3 | 3 | 2 |
| Code 0 | — | 4 | 4 | 2 |
| Gennaker | — | 3 | 5 | 4 |
| Spi | — | — | 5 | 6 |

**Modificateurs de force** :
- F1–2 : −1 case (minimum 1), sauf Code 0, Gennaker et Spi.
- F7–8 : +1 case pour la voilure réduite, le J3 et le Solent.

**Niveau de risque** par voile et par plage de force (0 = blanc, 1 = bleu, 2 = vert, 3 = jaune, 4 = rouge, 5 = noir) :

| Voile | F1–2 | F3–4 | F5–6 | F7–8 |
|---|---|---|---|---|
| Voilure réduite | 0 | 0 | 0 | 1 |
| J3 | 0 | 0 | 1 | 2 |
| Solent | 0 | 1 | 2 | 4 |
| Code 0 | 1 | 2 | 4 | 5 |
| Gennaker | 0 | 2 | 3 | 5 |
| Spi | 0 | 2 | 4 | 5 |

Le niveau de risque final est borné entre 0 et 5 après application des bonus et malus.

### 3.5 Résolution du risque (reprise de l'original)
Jet d'un dé à 6 faces. Un événement de risque survient si le résultat est **≤ niveau de risque** (bleu : 1–2 ; vert : 1–3 ; jaune : 1–4 ; rouge : 1–5). Le blanc ne nécessite pas de jet. Le noir provoque une perte de voile automatique (un chavirage pour les multicoques, §2-A6).

Quand un événement de risque survient :
1. **Quiz activé** : une question du niveau choisi par le joueur. Bonne réponse : le bateau avance normalement. Mauvaise réponse : pénalité.
2. **Quiz désactivé** : pénalité directe.
3. La pénalité peut être annulée par une **carte réparation**.

**Pénalités** (tirées dans un paquet d'« avaries ») :
- déplacement divisé par 2 ;
- perte de la voile hissée ;
- le joueur passe le tour suivant ;
- recul d'1 case.

La répartition est configurable.

### 3.6 Navigation à sec de toile et naufrage
Règles III-3 et III-4 de l'original : sans voile, le bateau doit effectuer la distance complète de la voilure réduite, sans pouvoir s'arrêter. S'il touche une côte ou un obstacle, il perd 1 voile et 1 réparation, ou 2 voiles s'il n'a plus de réparation. S'il n'a plus de voile, il **retourne au port le plus proche**. Ce retour remplace le retour au départ de l'original, jugé trop punitif pour les courses longues.

### 3.7 Parcours, marques et fin de partie
- Un parcours est une suite de **portes** : départ, marques ou caps à franchir, arrivée.
- La partie se termine quand le premier bateau franchit l'arrivée **et que le tour en cours est résolu**. Les joueurs déjà arrivés sont départagés par la distance dépassée au-delà de la ligne, puis par le nombre de voiles et de réparations restantes, comme dans l'original.
- Les autres joueurs sont classés selon leur **distance restante** (champ de distance précalculé, §6.3).
- Option « course complète » : les autres continuent jusqu'à l'arrivée ou pendant N tours supplémentaires.
- Un **temps de course fictif** est affiché (1 tour = X heures, défini par course), à titre pédagogique.

### 3.8 Ordre de résolution en tours simultanés
- Au moment de choisir, chaque joueur peut fixer une **distance maximale souhaitée** (par défaut : le maximum). Cela remplace l'arrêt volontaire de l'original.
- Les déplacements sont résolus **dans l'ordre inverse du classement** : le dernier bouge en premier. C'est un léger mécanisme de rattrapage, qui évite aussi les conflits de case.
- Un bateau bloqué par une case occupée s'arrête sur la case libre précédente.

### 3.9 Règles propres à chaque course (paramètres à valider)
Chaque course définit une `regle_escale` :
- `libre` : un port répare tout ;
- `penalite` : une escale coûte N tours ;
- `interdite` : une escale fait sortir le joueur du classement (format sans assistance).

Les valeurs réelles de chaque course sont à confirmer par le porteur de projet. **Ne pas les inventer.**

---

## 4. Compétences des skippers (10 compétences signature)

Chaque skipper réel reçoit **une** compétence, validée par le porteur de projet, avec une justification et une source (§6.1). Les intitulés affichés restent positifs. Le malus est présenté comme le revers d'un style de navigation.

| Compétence | Bonus | Malus (compromis) |
|---|---|---|
| **Dur au mal** | +1 case en F ≥ 6 | risque +1 cran en F ≥ 6 |
| **Météorologue** | +1 case en F ≤ 3 | −1 case en F ≥ 6 |
| **Kiffeur** (portant) | +1 case à 135° et 180° | −1 case à 45° |
| **Grimpeur** (près) | +1 case à 45° | −1 case à 135° et 180° |
| **Bricoleur** | +1 carte réparation au départ | 1 voile en moins au départ, au choix (l'outillage prend la place d'une voile) |
| **Voilier** (réparation de voile) | une fois tous les 5 tours, récupère une voile perdue en naviguant à mi-distance pendant ce tour | 1 carte réparation en moins au départ |
| **Stratège** | 2 relances du dé de direction de vent par course, pour son propre bateau | −1 case au tour où il relance |
| **Régatier** | +1 case en `zone_cotiere` ; peut traverser une case occupée | risque +1 cran en `mers_du_sud` |
| **Navigateur** | ignore les courants défavorables ; la brume compte 1 case au lieu de 2 | ne bénéficie pas du bonus des alizés |
| **Mental d'acier** | une pénalité « passe ton tour » devient « déplacement divisé par 2 » | −1 case en F ≤ 2 |

Règles :
- Les bonus et malus de distance s'appliquent **après** les modificateurs de voile et de force. Distance minimale : 1 si la voile est utilisable.
- Toute compétence doit passer les critères d'équilibre (§9). Sinon, ses valeurs sont ajustées dans `config/competences.json` et non dans le code.
- Un **skipper fictif** personnalisable (nom libre, compétence au choix) est toujours disponible.

---

## 5. Classes et profils de bateaux

### 5.1 Classes
IMOCA, Class40, Mini 6.50, Ultim, Ocean Fifty.

**Règles de classe** :
- Multicoques (Ultim, Ocean Fifty) : chavirage sur case noire (§2-A6).
- Mini 6.50 : pas de bulletin météo (§3.2).
- Les autres spécificités sont à proposer au porteur de projet, sans les implémenter d'office.

### 5.2 Familles d'architecture (profils initiaux à valider)
Le bonus et le malus de chaque famille ont la même ampleur. Chaque bateau réel est rattaché à une famille dans `data/bateaux.json`, avec son architecte et une justification sourcée (renseignés par le porteur de projet).

| Classe | Famille | Bonus | Malus |
|---|---|---|---|
| IMOCA | Foiler | +1 case à 90° et 135° en F ≥ 4 | risque +1 cran en F ≥ 6 |
| IMOCA | Dérives droites | risque −1 cran en F ≥ 6 | −1 case à 135° en F ≥ 4 |
| Class40 | Scow | +1 case à 135° et 180° | −1 case à 45° en F ≥ 5 |
| Class40 | Étrave classique | +1 case à 45° | −1 case à 180° |
| Mini 6.50 | Proto | +1 case à 135° et 180° en F ≥ 3 | risque +1 cran en F ≥ 5 |
| Mini 6.50 | Série | risque −1 cran en toutes conditions | −1 case à 135° en F ≥ 5 |
| Ultim | Dernière génération | +1 case à 90° et 135° | risque +1 cran en F ≥ 5 |
| Ultim | Génération précédente | risque −1 cran en F ≥ 5 | −1 case à 135° |
| Ocean Fifty | Puissant | +1 case à 90° | risque +1 cran en F ≥ 6 |
| Ocean Fifty | Polyvalent | risque −1 cran en F ≥ 6 | −1 case à 90° |

---

## 6. Données

Tous les fichiers sont en JSON, validés par schéma (Zod ou JSON Schema). Un script `npm run data:check` vérifie les schémas, l'unicité des identifiants, la présence des sources et les références croisées.

### 6.1 `data/skippers.json` (fourni par le porteur de projet)
```json
{
  "saison": "2026",
  "skippers": [
    {
      "id": "skipper-exemple-1",
      "nom_affiche": "Skipper Exemple",
      "classe": "IMOCA",
      "rang_saison": 1,
      "competence": "dur_au_mal",
      "justification": "Phrase courte et positive sur la réputation du marin",
      "source": "URL ou référence de l'article",
      "url_fiche_site": "https://.../skippers/skipper-exemple",
      "bateau_id": "bateau-exemple-1",
      "fictif": true
    }
  ]
}
```
Contraintes : 10 skippers par classe au maximum ; `justification` et `source` obligatoires si `fictif` vaut `false`.

### 6.2 `data/bateaux.json`
Champs : `id`, `nom`, `classe`, `famille`, `architecte`, `annee`, `justification_famille`, `source`, `url_fiche_site`, `fictif`.

Une option de configuration `affichage_noms_reels` (vrai/faux) permet de remplacer les noms de skippers et de bateaux par des noms génériques. **Aucun logo de sponsor réel** ne doit apparaître.

### 6.3 `data/courses/<id>.json`
Champs :
- `id`, `nom`, `classes_autorisees`, `regle_escale`, `heures_par_tour`, `duree_cible_tours` ;
- `carte` : largeur, hauteur, `bouclage_horizontal` (vrai pour les tours du monde), couches de cases ;
- `portes` (départ, marques, arrivée) ;
- `zones_meteo` ;
- `vent_initial` ;
- `url_fiche_site` ;
- `record_reference` (facultatif, fourni et sourcé par le porteur de projet).

Le champ de distance jusqu'à l'arrivée (parcours en largeur, BFS, qui respecte les obstacles et l'ordre des portes) est **précalculé** au chargement de la carte.

**Courses à prévoir** (rattachement aux classes à valider par le porteur de projet) : Route du Rhum, Transat Jacques Vabre (nom selon l'édition), Mini Transat, Vendée Globe, Arkea Ultim Challenge, Globe40, plus une course courte d'initiation.

**Calibrage de la durée** :

| Format | Tours cibles | Durée visée (4 joueurs) |
|---|---|---|
| Initiation | 8–10 | ≈ 5 min |
| Transat | 12–18 | 10–15 min |
| Tour du monde | 25–35 | 25–30 min |

Hypothèse : environ 40 s par tour en mode simultané. Les cartes de tour du monde sont stylisées (projection déformée, bouclage horizontal) et non géographiquement exactes.

### 6.4 `data/quiz/*.json`
```json
{
  "id": "q-0001",
  "niveau": 1,
  "categorie": "histoire | matelotage | meteo | vocabulaire | reglementation | bateaux",
  "question": "…",
  "choix": ["…", "…", "…", "…"],
  "reponse": 2,
  "explication": "…",
  "source": "…",
  "url_fiche_site": "…"
}
```
- Niveaux : 1 Moussaillon, 2 Skipper, 3 Vieux loup de mer.
- Les questions viennent à la fois des données du site et de thèmes généraux (nœuds, météo, vocabulaire, règles de barre).
- **Générateur facultatif** : un script qui produit des questions « histoire » à partir de l'export JSON du site (le format est à définir quand la gestion du site sera connue). Prévoir une interface d'adaptateur `SourceDonneesSite`.
- Chaque explication propose un lien « En savoir plus » vers la fiche du site.
- Pas de question en double dans une même partie. Délai de réponse configurable (20 s par défaut, désactivable pour les enfants).

---

## 7. Intelligence artificielle
Trois niveaux :
- **Facile** : choisit la meilleure distance immédiate avec un bruit aléatoire, sans tenir compte du risque.
- **Moyen** : maximise l'espérance de gain de distance (champ de distance), pénalisée par le risque attendu.
- **Difficile** : anticipation sur 2 tours (expectimax sur les dés de vent), gestion des réparations, recherche d'abri par tempête.

Au quiz, l'IA répond juste avec une probabilité qui dépend de son niveau et du niveau de la question (configurable).

L'IA utilise **exactement** le même moteur et les mêmes informations qu'un humain (pas de connaissance des tirages futurs).

---

## 8. Progression et décoration
- Profil joueur local (pseudo, statistiques, déblocages), stocké dans `localStorage` en mode navigateur et dans un fichier côté serveur en mode réseau local.
- Les victoires et podiums donnent des **points de palmarès**, qui débloquent : couleurs de coque, motifs, numéro de voile, pavillon (dont le Gwenn ha Du parmi les pavillons régionaux), sponsor **fictif** au choix dans une liste, trophées affichés sur le profil.
- Éditeur simple du bateau, avec aperçu (silhouette SVG par classe).
- **Aucun contenu payant ni publicité.**

---

## 9. Équilibrage par simulation (obligatoire)
Script `npm run sim` :
- parties IA « moyenne » contre IA « moyenne », avec graine aléatoire ;
- 10 000 parties par combinaison : compétence × famille × course.

**Critères d'acceptation** :
- Face à un skipper sans compétence, sur un même bateau, chaque compétence a un **taux de victoire entre 45 % et 55 %**, en moyenne sur l'ensemble des courses de sa classe.
- Sur une course donnée, aucune compétence ne dépasse 62 % (une spécialisation est permise, pas une domination).
- Les mêmes critères s'appliquent aux familles de bateaux d'une même classe.
- La durée médiane en tours se situe dans la fourchette cible de chaque course (§6.3).

Le script produit un rapport `reports/equilibrage.md` (tableaux) et propose des ajustements de valeurs. Il n'applique jamais ces ajustements automatiquement.

---

## 10. Architecture technique

```
/packages
  /engine     TypeScript pur : règles, état, RNG à graine, IA, champ de distance. 0 dépendance UI.
  /client     Application web (Vite + React ou Svelte), rendu du plateau en Canvas/PixiJS ou SVG.
  /server     Node.js + WebSocket : salons, serveur autoritaire, sert aussi le client compilé.
  /data       Fichiers JSON + schémas.
  /tools      Scripts : data:check, sim, génération de quiz.
```

- **Monorepo** (pnpm workspaces), TypeScript strict, tests Vitest, lint ESLint et Prettier.
- **État de jeu sérialisable.** Les actions sont des messages (`ChoisirCapEtVoile`, `RepondreQuiz`, `JouerReparation`…). Le moteur expose `appliquer(etat, action) → nouvelEtat` et `resoudreTour(etat)`. Une partie peut être rejouée à partir de la graine et de la liste d'actions.
- **Mode navigateur seul** (solo et même écran) : compilation statique intégrable au site (sous-dossier ou iframe), sans serveur.
- **Mode réseau local** :
  - un exécutable unique (`npx` ou binaire empaqueté) **et** une image Docker ;
  - au démarrage, affiche l'adresse IP locale et un **QR code** ;
  - salons avec code à 4 lettres, sans compte, reconnexion automatique (jeton de session) ;
  - le serveur est autoritaire : il valide toutes les actions et tire tous les dés.
- **Interface** : voir §10 bis.

---

## 10 bis. Interface de jeu

### 10b.1 Principes
- **Une décision par tour = deux gestes** : toucher un cap, toucher une voile, puis valider. Tout le reste est de l'information.
- **La réglette de l'original devient un tableau de bord numérique** : la distance et le risque de chaque voile se calculent en direct pour le cap sélectionné.
- **Lisible par un enfant de 8 ans, riche pour un passionné** : les informations avancées (probabilités, détail des modificateurs) sont dans un panneau « Détails » replié par défaut.
- **Responsive** : PC en paysage, tablette, mobile en portrait. Toutes les commandes sont tactiles. Cibles de 44 px minimum.
- **Accessibilité** : les couleurs de risque sont toujours doublées d'un pictogramme et d'un libellé (daltonisme) ; contraste AA ; jeu entièrement utilisable au clavier sur PC.
- Animations courtes (≤ 600 ms) et désactivables ; sons facultatifs (vent, winch, dés).

### 10b.2 Liste des écrans
| # | Écran | Contenu |
|---|---|---|
| E1 | **Accueil** | Jouer, Tutoriel, Hangar (décoration), Profil et palmarès, Règles, Options |
| E2 | **Configuration de la partie** | Mode (solo, même écran, réseau local) ; choix de la course (vignette de carte, durée estimée, classes possibles) ; choix de la classe ; nombre d'humains et d'IA (avec niveau) ; options : quiz activé ou non, niveau de quiz par joueur, bulletin météo, noms réels ou génériques, délai de réponse |
| E3 | **Choix du skipper et du bateau** | Deux rangées de **cartes à collectionner** : carte skipper (nom, rang de la saison, icône et intitulé de la compétence, bonus en vert, compromis en gris neutre, lien « Voir sa fiche ») et carte bateau (nom, architecte, famille, **diagramme polaire simplifié** en 4 allures). Option « skipper fictif ». En même écran, chaque joueur choisit à son tour |
| E4 | **Salon réseau** | Code du salon en grand, QR code, liste des joueurs avec statut « prêt », choix du bateau par chaque joueur sur son propre appareil, bouton « Lancer » réservé à l'hôte |
| E5 | **Écran de jeu** | Voir §10b.3 |
| E6 | **Fenêtre quiz** | Question, 4 réponses en gros boutons, compte à rebours facultatif, puis explication et lien « En savoir plus » vers la fiche du site |
| E7 | **Fin de partie** | Podium animé ; classement complet avec temps de course fictif ; **carnet de bord** (décisions clés, avaries, questions rencontrées, liens vers les fiches skipper, bateau et course) ; points de palmarès gagnés et éléments débloqués ; « Rejouer » et « Changer de course » |
| E8 | **Hangar** | Éditeur de décoration avec aperçu du bateau (silhouette SVG par classe) : coque, motif, numéro de voile, pavillon, sponsor fictif ; éléments verrouillés affichés avec la condition de déblocage |
| E9 | **Tutoriel** | Course d'initiation guidée en 5 étapes : choisir un cap, choisir une voile, comprendre le jet de vent, comprendre le risque, utiliser une réparation. Bulles d'aide, actions imposées, durée inférieure à 5 min |
| E10 | **Règles** | Version illustrée et courte des règles, avec renvoi au tutoriel |

### 10b.3 Écran de jeu (E5)

**Disposition PC et tablette paysage**
```
┌───────────────────────────────────────────────────────────────┐
│ Tour 7/≈15 · Route du Rhum · IMOCA        [Classement ▾] [⚙] │
├──────────────────────────────────────────┬────────────────────┤
│                                          │  VENT ACTUEL       │
│                                          │  girouette · F4    │
│              CARTE                       │  Tendance : ↻ (*)  │
│   (zoom, déplacement, bateaux,           ├────────────────────┤
│    zones météo, portes, sillages,        │  ROSE DES CAPS     │
│    trajectoire prévisionnelle            │  8 directions,     │
│    en pointillés)                        │  allure affichée   │
│                                          ├────────────────────┤
│                                          │  VOILES (6 cartes) │
│                                          │  distance · risque │
│                                          │  par voile         │
│                                          ├────────────────────┤
│                                          │  Réparations : ●●  │
│                                          │  Distance max : [–]│
│                                          │  [  VALIDER  ]     │
├──────────────────────────────────────────┴────────────────────┤
│ Journal : « Tour 6 – Le vent a tourné de 45°… »               │
└───────────────────────────────────────────────────────────────┘
(*) masquée en Mini 6.50
```

**Disposition mobile portrait** : la carte occupe tout l'écran ; un **tiroir bas** (bottom sheet) contient le vent, la rose des caps, les voiles et le bouton Valider ; le classement et le journal sont accessibles par des icônes en haut. Le tiroir se replie pendant l'animation de résolution.

**Composants**
- **Carte** :
  - quadrillage discret ;
  - zones météo matérialisées par des textures (alizés : flèches d'écume, pot au noir : nuages, mers du Sud : houle, brume : voile grisé) ;
  - portes et marques numérotées, zone d'exclusion des glaces hachurée ;
  - bateaux colorés selon la décoration du joueur, sillage des 3 derniers tours ;
  - la **trajectoire prévisionnelle** du cap sélectionné est affichée en pointillés, cases bloquantes en rouge ;
  - info-bulle par case au survol ou appui long.
- **Vent** : girouette animée, force sous forme de chiffre avec libellé (« F4 – Jolie brise ») et bulletin de tendance.
- **Rose des caps** : 8 boutons autour d'un bateau stylisé. Le bouton bout au vent est grisé. Chaque bouton affiche son allure (près, travers, largue, arrière).
- **Cartes voiles** : pour le cap choisi, chaque carte affiche la distance et la pastille de risque (couleur, pictogramme, libellé). Les voiles inutilisables ou perdues sont grisées avec leur raison. Un indicateur « **si le vent tourne** » montre en 3 mini-pastilles le risque obtenu si le vent tourne de −45°, 0° ou +45°. C'est l'aide pédagogique clé, puisque le choix se fait avant le jet (§3.2). Le panneau « Détails » liste les modificateurs appliqués (voile, force, famille, compétence, zone).
- **Classement** : position, nom, distance restante, icônes d'état (abri, avarie, escale).
- **Journal** : une ligne par événement, phrases simples.

### 10b.3 bis Deux vues, une caméra (exigence du porteur de projet)
Le jeu alterne deux vues, selon la phase du tour :

| Phase | Vue | Contenu |
|---|---|---|
| **Choix stratégique** (cap, voile, distance) | **Vue générale** : carte du parcours ou de la zone qui englobe tous les bateaux, zoom et déplacement libres | Carte, zones météo, portes, tous les bateaux sous forme de pions, trajectoire prévisionnelle, tableau de bord (§10b.3) |
| **Résolution du tour** | **Vue rapprochée** : caméra centrée sur le bateau du joueur | Scène animée : mer en mouvement, **bateau du joueur dessiné avec sa décoration** (coque, bandes, numéro de voile, pavillon, couleur des voiles), voiles hissées conformes au choix et à l'allure, sillage ; **concurrents proches** affichés autour dans leur propre décoration, avec leur écart en cases ; concurrents hors champ signalés par une flèche en bord d'écran ; quadrillage discret et points de passage des cases parcourues |

**Transition** : zoom animé de la vue générale vers le bateau (≈ 800 ms) après le jet des dés de vent, puis dézoom vers la vue générale au bilan du tour. Si l'option système « réduire les animations » est active, un fondu remplace le zoom et la mer est figée.

**Éléments permanents de la vue rapprochée** :
- bandeau d'étapes (Jet du vent, Votre bateau, Concurrents, Bilan) ;
- nouveau vent ;
- encart des dés (vent, puis risque) ;
- **mini-carte** de la vue générale, avec le cadre de la zone affichée ;
- boutons « x1 / x2 » et « Passer l'animation ».

**Selon le mode de jeu** :
- même écran : la caméra suit successivement chaque bateau humain, dans l'ordre de résolution (§3.8) ;
- réseau local : chaque appareil suit son propre bateau ;
- les IA sont résolues en accéléré et ne déclenchent qu'un court panoramique si elles sont dans le champ.

**Rendu 3D de la vue rapprochée** :
- **Moteur** : Three.js (WebGL). La vue générale reste la carte tactique en 2D. La transition fait passer de la carte à la scène 3D, centrée sur le bateau du joueur.
- **Scène** :
  - mer animée (houle et clapot calculés en coordonnées monde, légère transparence pour laisser voir la quille et les foils) ;
  - ciel et brume de distance ;
  - sillage en particules ;
  - concurrents proches avec étiquette ;
  - caméra orbitale (glisser pour tourner, molette ou pincement pour zoomer).
- **Modèles** : un modèle glTF par **famille d'architecture** (§5.2), réalisé par un infographiste 3D. Style réaliste et sobre, environ 20 000 à 40 000 triangles par bateau. Chaque modèle doit être **relu par un connaisseur de la classe** avant intégration.
- **Pièces animées et orientées par le moteur de jeu** : gîte, tangage, bôme, voile d'avant selon l'allure, quille pendulaire, foils (sortis ou relevés), safrans.
- **Décoration** : matériaux paramétrables (coque, bandes, pont), texture de grand-voile générée (numéro de voile lisible des deux côtés, bande de couleur), couleur des voiles de portant, pavillon.
- **Performances** : 60 i/s visés sur un PC de bureau, 30 i/s sur un téléphone récent. **Repli automatique sur la vue 2D** si WebGL est indisponible ou trop lent.
- **Référence** : le prototype « Prototype 3D – Course au large » (IMOCA procédural) sert de base de travail. Il ne remplace pas les modèles définitifs.
- Le hangar (E8) réutilise exactement ce rendu pour l'aperçu.

### 10b.4 Déroulement d'un tour à l'écran
1. **Phase de choix** : le joueur sélectionne un cap, puis une voile ; la trajectoire et les pastilles se mettent à jour ; il valide. Selon le mode :
   - réseau : un indicateur montre qui a déjà validé ;
   - même écran : un écran intermédiaire « Passez l'appareil à … » masque les choix ;
   - optionnel : chrono de choix.
2. **Jet du vent** : animation des 2 dés (1 s), puis rotation de la girouette et mise à jour de la force.
3. **Résolution, joueur par joueur** dans l'ordre §3.8 :
   - recalcul de l'allure ;
   - jet de risque animé si nécessaire ;
   - quiz (fenêtre E6) ;
   - proposition de jouer une carte réparation (« Annuler la pénalité ? Oui / Non ») ;
   - déplacement animé du bateau.
   Les IA sont résolues en accéléré.
4. **Bilan du tour** : le journal est mis à jour, avec un bandeau éventuel (« Vous entrez dans le pot au noir »). Puis retour à la phase de choix.

### 10b.4 bis Exigence de réalisme technique (site de passionnés)
**Règle de conception (exigence du porteur de projet)** : chaque modèle de bateau est dessiné à partir d'un **dossier de photos de référence** du ou des bateaux les plus récents de sa classe et de sa famille : vues de profil, de trois quarts, de l'étrave et du pont, en navigation et au ponton. Ce dossier est constitué avant toute modélisation et archivé dans `assets/references/<classe>/<famille>/`, avec la source et les crédits de chaque photo. Ces photos servent uniquement de référence de travail : elles ne sont jamais publiées dans le jeu sans droits. Aucun logo ni marquage de sponsor n'est reproduit sans autorisation.

Aucune erreur grossière n'est tolérée. Toute représentation de bateau doit passer une **grille de relecture**, validée par le porteur de projet ou un expert désigné. **Les dimensions et équipements autorisés par chaque classe doivent être tirés des règles de jauge officielles en vigueur, et non de mémoire.**

| Point de contrôle | Exigence |
|---|---|
| Proportions | longueur, largeur, hauteur de mât et tirant d'eau conformes à la jauge de la classe |
| Équipements autorisés | foils, quille pendulaire, nombre de safrans, type de mât : selon la jauge de chaque classe et de chaque famille (ex. : présence ou absence de foils en Class40 et en Mini série, à confirmer dans les règles de classe) |
| Quille pendulaire | basculée **au vent** |
| Foils (monocoques) | foil **sous le vent** sorti, foil au vent relevé |
| Gîte | toujours du côté sous le vent |
| Grand-voile et bôme | bôme du côté sous le vent, ouverture cohérente avec l'allure |
| Voile d'avant | adaptée à l'allure : foc ou J au près, code 0 au travers, gennaker ou spi asymétrique au portant ; jamais de spi au près |
| Multicoques | flotteur au vent soulagé ou hors de l'eau quand le vent fraîchit ; appendices propres aux multicoques, sans quille |
| Changement d'amure | virement ou empannage : tout le gréement bascule de côté |
| Numéro de voile | lisible des deux côtés |
| Voiles | membranes de couleur conforme aux photos de référence ; les voiles des classes modernes sont généralement sombres (carbone anthracite), pas blanches |
| Accastillage visible | filières, chandeliers, balcon avant, bout-dehors, roof et cockpit à leur emplacement réel |
| Vocabulaire | termes français exacts dans l'interface (amures, lofer, abattre, empanner…) |

**Correction à intégrer dans les tables de vitesse (§3.4)** : sur les bateaux modernes à foils et les multicoques, la vitesse maximale se situe entre le travers et le largue, et le plein vent arrière est lent. Ces bateaux tirent des bords au portant. La table actuelle, héritée du jeu de 1987, fait du Spi au vent arrière l'allure la plus rapide, ce qui est faux pour ces classes. Il faut ajouter un **profil d'allure par classe et par famille** (modificateur par angle), calibré par simulation et relu par un connaisseur.

### 10b.5 Direction graphique (à valider)
Deux pistes possibles, à trancher avec le porteur de projet :
- **A – Carte marine et jeu de plateau** : papier, cartouches, typographie de carte ancienne, pions. Proche de l'esprit de l'original et de l'histoire.
- **B – Tracker de course moderne** : fond océan sombre, interface façon cartographie de suivi de course, données nettes.

Dans les deux cas, il faut reprendre la charte du site Mémoire du large une fois stabilisée (couleurs, typographies, logo). Les tokens de design (couleurs, espacements, typographies) sont centralisés dans un seul fichier.

---

## 11. Hors périmètre initial
Comptes en ligne, jeu sur Internet, classement mondial, chat, monétisation, données météo réelles, mode multiclasse avec temps compensé.

---

## 12. Phases de réalisation

| Phase | Contenu | Critères d'acceptation |
|---|---|---|
| **P0 – Moteur** | Règles §3 à §5, RNG, champ de distance, sérialisation, IA facile et moyenne, 1 carte d'initiation fictive | Couverture ≥ 90 % du moteur ; tests sur chaque règle de l'original repris ; partie entièrement rejouable à partir de la graine |
| **P1 – MVP jouable** | Client web : écrans E1, E2, E3, E5, E6, E7, E9 ; solo contre IA et même écran ; 1 course transat ; 2 classes ; données fictives ; quiz avec 60 questions d'exemple | Partie complète jouable sur mobile et PC ; durée médiane conforme ; un nouveau joueur termine le tutoriel sans aide extérieure |
| **P2 – Contenu et équilibrage** | Les 5 classes, toutes les familles, toutes les compétences, simulation §9, IA difficile, courses listées en §6.3, dont 1 tour du monde | Rapport d'équilibrage conforme aux critères §9 |
| **P3 – Données réelles** | Import de `skippers.json`, `bateaux.json` et de l'export du site ; adaptateur `SourceDonneesSite` ; générateur de quiz « histoire » | `data:check` vert ; aucun skipper réel sans justification ni source |
| **P4 – Réseau local** | Serveur, salons, QR code, reconnexion, binaire et Docker | 6 joueurs sur 3 appareils différents ; coupure Wi-Fi de 30 s sans perte de partie |
| **P5 – Progression** | Profil, palmarès, éditeur de décoration | Déblocages persistants après redémarrage |
| **P6 – Intégration site** | Compilation statique intégrée au site, liens croisés jeu ↔ fiches | Validation par le porteur de projet |

---

## 13. Points ouverts (à fournir par le porteur de projet)
1. Liste du top 10 de la saison par classe, avec la compétence choisie, sa justification et sa source.
2. Liste des bateaux associés, leur architecte et leur famille.
3. Format d'export des données du site (JSON, API, CMS).
4. Liste définitive des courses par classe et règle d'escale de chacune.
5. Validation des arbitrages A1 à A7 (§2).
6. Nom du jeu et charte graphique (reprise de celle du site ?).
7. Choix de la direction graphique A ou B (§10b.5).
