# Jeu « Course au large » : décisions, écarts et questions ouvertes

## Décisions validées par le porteur de projet

| Date | Décision |
|---|---|
| 12/11/2026 | **Navigateur et Météorologue : malus seulement pour les grands changements** (passage près ↔ portant ; virage de 90° et plus). **Une même coque peut être menée par plusieurs skippers** dans le jeu, sans importance. |
| 12/11/2026 | **Compétences en un mot, liées à la vraie vie du marin** (remplacent les traits de caractère) ; 15 skippers en IMOCA, Class40 et Ocean Fifty, skippers actuels de la classe d'abord ; plus de femmes en IMOCA ; Kevin Escoffier n'apparaît pas dans le jeu. Navigateur et Météorologue **estiment** le prochain vent (force / orientation), avec un risque d'erreur (juste 3 fois sur 4), et perdent 1 case à chaque changement de voile / de cap. Détail : `conception/competences.md`. |
| 12/11/2026 | **Une même coque peut figurer plusieurs fois en Ultim sous ses noms successifs**, chacune avec le skipper qui l'a menée (confirmé par le porteur de projet) : Macif / Actual / Actual Ultim 3 (trimaran de 2015), Gitana 17 / Maxi Edmond de Rothschild, Idec Sport / IDEC. Groupe Dubreuil est l'ex-11th Hour Racing (2021). |
| 12/11/2026 | **Skippers = top 20 2021-2026 de leur classe** (ceux qui ont un trait de caractère, `donnees/traits_marins.csv`) ; les femmes déjà présentes sont gardées ; **Jean Le Cam et son IMOCA à dérives restent** (s'il sort un jour, il ira en skipper de légende). Femmes de légende à ajouter : Isabelle Autissier, Florence Arthaud, Ellen MacArthur. |
| 12/11/2026 | **Les traits de caractère remplacent les compétences de la bêta** : le trait, tiré du palmarès du site, donne seul le bonus et le compromis du skipper. Pouvoirs recalibrés par simulation sur les règles actuelles : `conception/traits-de-caractere.md` (valeurs à valider par le porteur de projet). |
| 08/11/2026 | Bêta jouable en local : classe IMOCA seule, 4 skippers, pour tester la jouabilité avant de passer à plus grande échelle. |
| 08/11/2026 | Le jeu est destiné à être intégré au site Mémoire du large : il vit dans le dépôt partagé, dossier `jeu/`. |
| 08/11/2026 | Skippers **réels** (pas fictifs) : Charlie Dalin → Stratège ; Yoann Richomme → Régatier ; Jérémie Beyou → Dur au mal ; Jean Le Cam → Bricoleur. Bateaux : Macif Santé Prévoyance, Paprec Arkéa, Charal (foilers), Tout commence en Finistère – Armor-lux (dérives droites). Sources et architectes à vérifier. |
| 08/11/2026 | Modes : solo contre IA **et** même écran. |
| 08/11/2026 | Vue rapprochée 3D incluse dès la bêta, en version simple (reprise du prototype IMOCA). |
| 08/11/2026 | Architecture finale du cahier des charges dès la bêta (TypeScript, Vite, React, Vitest). Node.js installé sur le PC fixe. |
| 08/11/2026 | **Cartographie dans l'esprit des grandes courses** : vraies côtes (Natural Earth, domaine public), projection de Mercator, orthodromie, traces colorées par la vitesse, distances en milles. |
| 08/11/2026 | **Quadrillage fin et invisible** (120 × 96 cases d'environ 30 milles) ; les distances de la table des voiles sont converties en cases par une « échelle » de 2,5 propre à la course. Déplacement en ligne droite réelle (une diagonale n'est plus gratuite). |
| 08/11/2026 | **16 caps** (tous les 22,5°). Le vent garde 8 directions et tourne de 45°. Allures intermédiaires : bon plein, petit largue, grand largue (distance = moyenne des allures voisines). On ne peut pas remonter à moins de 45° du vent. |
| 08/11/2026 | **Principe : chaque bonus et chaque malus doit avoir un effet sur toutes les courses, quel que soit le parcours.** |
| 08/11/2026 | Déplacements et trajectoires affichés en **lignes droites** (le quadrillage reste invisible ; distances inchangées). |
| 08/11/2026 | **Chronologie d'un tour** : les dés du vent apparaissent, on les lance, le résultat s'affiche avec une phrase récapitulative ; puis le **dé événement** de chaque bateau : rien sur 1 à 5 ; sur 6, le paquet de cartes apparaît et on tire une **carte du large**. |
| 08/11/2026 | **Cartes du large** : moitié de moments heureux (dauphins, photo, message de la famille, surprise dans le ravitaillement, boîte à outils = +1 réparation…), moitié d'avaries réalistes mais rattrapables (foil ou dérive touché par un OFNI, ballast, chute, empannage non maîtrisé, pilote, vérin de quille, énergie, filet, spi déchiré, grain, cargo…), traduites en milles perdus ou en effets de quelques tours. Une carte réparation annule une avarie. Fichier : `packages/data/config/evenements.json`. |
| 08/11/2026 | **Les illustrations des cartes devront être dessinées** pour la version finale (celles de la bêta sont provisoires). |
| 08/11/2026 | **La vue 3D sert à raconter un moment** (un bateau en double un autre, une voile perdue, une flotte qui navigue à vue), et se ferme seule. Plus de vue 3D ni de validation à chaque tour. |
| 08/11/2026 | **Vue 3D : état de la mer selon l'échelle de Beaufort** (forces 1 à 12 : hauteur et longueur des vagues, moutons à partir de force 4, ciel et visibilité) ; **sillage et vague d'étrave** proportionnels à la vitesse du bateau. |
| 09/11/2026 | **Jeu en réseau** (bêta) : 2 à 4 joueurs humains, chacun sur son appareil, l'IA complète la flotte (2 à 10 bateaux). L'hôte crée un salon (code de 4 lettres + lien d'invitation `?salon=CODE`), chacun choisit son skipper, l'hôte lance. Serveur arbitre : Cloudflare Worker + Durable Objects (`packages/server`, https://course-au-large-serveur.antoine-dangy.workers.dev) ; choix secrets jusqu'au jet des dés ; reconnexion automatique ; l'hôte peut confier à l'IA le bateau d'un joueur déconnecté. |
| 09/11/2026 | **10 skippers Imoca** (validés) : Dalin, Richomme, Beyou, Le Cam, Herrmann (Communicant), Ruyant (Navigateur), Simon (Mental d'acier), Mettraux (Météorologue), Davies (Voilier), Crémer (Kiffeur). **Nombre de bateaux au choix** (2 à 10), l'IA complète la flotte au hasard. |
| 09/11/2026 | **Briefing de début de partie** (objectif, tour de jeu, choix, dangers), masquable définitivement, accessible ensuite par le bouton « Aide ». **Vue 3D** déclenchée par plus de moments forts (louvoyage, coup de vent, petit temps, collision, arrivée), une fois par tour au plus. |
| 09/11/2026 | **Tutoriel de la bêta** : « Ma première course » depuis l'accueil, Jérémie Beyou contre une IA facile, questions Moussaillon sans chrono ; un coach affiche des bulles d'aide selon la situation (cap, voile, validation, dés du vent, dé événement, risque, quiz, réparation, louvoyage, fronts). |
| 09/11/2026 | **Au plus 2 fronts par course** ; **molle** possible (6 courses sur 10) à l'approche de l'arrivée : vent F1–2 et direction qui change à chaque tour. |
| 09/11/2026 | **Brume** étendue à l'ouest de la Bretagne et ajoutée aux Açores : les bateaux y sont invisibles les uns des autres (carte, prévisions, IA) et peuvent se percuter (chacun perd une carte réparation, ou sa voile hissée s'il n'en a plus). |
| 09/11/2026 | **Bricoleur (Jean Le Cam)** : il garde toutes ses voiles ; nouveau compromis : −1 case au tour où il joue une carte réparation (il bricole au lieu de barrer). |
| 09/11/2026 | **Fronts météo** : une dépression est annoncée 2 tours à l'avance (bulletin + trajectoire en pointillés), puis traverse la carte d'ouest en est. Dans le front : vent fort (F7–8) d'une direction donnée ; derrière, dans la traîne : vent basculé de 90° et faibli. Options : attaquer sous petite toile, contourner, s'abriter, jouer la bascule. Chacun choisit avec le vent qui souffle là où il est (IA comprise). Réglages dans `config/regles.json` (`fronts`), à calibrer. |
| 09/11/2026 | **Louvoyage** : face au vent (cap à moins de 45°), choisi ou subi après le jet des dés, le bateau tire des bords avec une voile de près et avance dans l'axe visé de **60 %** de sa distance au près ; trajectoire prévue affichée en zigzag à ±40°. Avec une voile de portant hissée, il reste sur place. Valeurs dans `config/regles.json` (`louvoyage`). |
| 09/11/2026 | **Jeu en ligne** pour les bêta-testeurs : https://course-au-large.pages.dev (Cloudflare Pages, projet `course-au-large`, déploiement par `wrangler pages deploy`). |
| 08/11/2026 | **Équité humain / IA** : tout le monde choisit avec le vent ACTUEL, avant le jet des dés ; un cap à moins de 45° du vent actuel ou une voile inutilisable est refusé par le moteur, pour l'IA comme pour l'humain (l'IA pouvait auparavant « parier » sur un cap face au vent). |
| 08/11/2026 | **Tous les bateaux partent de la même case** (ligne de départ devant Saint-Malo). |
| 08/11/2026 | **Compétences** : axes libres entre bonus et compromis ; nouveaux types retenus : **information et hasard**, **moral et cartes du large** (en plus de la météo, des allures et des ressources). Valeurs calibrées par simulation par Claude, puis validées par le porteur de projet. Voir `proposition-bonus-malus.md`. |
| 08/11/2026 | **Niveau de questions « Skipper » relevé** (vent apparent, polaire, routage, VMG, DST, AIS, water-ballast…). |
| 08/11/2026 | **Récapitulatif visuel de l'état du bateau** (voiles, réparations, avaries en cours, position) en haut du panneau. |

## Choix provisoires faits par Claude (à confirmer)

- **Monorepo en `npm workspaces`** au lieu de pnpm (aucune installation supplémentaire). Même structure `packages/`.
- **Arbitrages A1 à A7** du cahier appliqués tels que proposés (tours simultanés, vent global + zones, etc.).
- **Pénalités** : « perte de voile » = la voile est perdue mais le bateau avance ; « passe ton tour » = le bateau avance ce tour et passe le suivant ; « recul » = recule d'une case au lieu d'avancer. Tirage pondéré 4/2/2/2.
- **Case noire (monocoque)** : comme en 1987, le bateau n'avance pas ; la voile est perdue sauf si on joue une réparation.
- **Bulletin météo** : une « tendance » (−1, 0, +1) est tirée à chaque tour et biaise le dé de direction du tour suivant ; le bulletin l'affiche.
- **Profil d'allure foiler** : −1 case au plein vent arrière (correction §10b.4 bis), à faire relire par un connaisseur.
- **Route du Rhum** : règle d'escale « libre » et 1 tour = 22 h sont provisoires (le cahier interdit de les inventer).
- **Abri côtier** proposé seulement par vent de force 6 et plus.

## Décisions du 09/11/2026

- **Les bateaux ne se barrent plus la route** (une case fait 30 milles) : ils peuvent passer et s'arrêter sur la case d'un concurrent. Seule la collision dans la brume subsiste. Conséquence : le bonus du Régatier « peut traverser une case occupée » disparaît ; il garde « +1 case en zone côtière » (à rééquilibrer, voir les questions ouvertes).
- **Collision dans la brume**, pour les deux bateaux : à moins de 200 milles des côtes, rapatriement au port le plus proche (la case côtière la plus proche), 1 tour de pénalité, puis départ du port ; au large, réparation en mer, 2 tours immobilisé. Plus de carte réparation retirée. Valeurs dans `regles.json` (`collision`).
- Le tableau de bord affiche la distance si le vent ne bouge pas (pas de moyenne) ; échelle 500 / 100 / 30 milles sur la carte.
- Journal des mouvements dans le jeu (bêta), avec contrôles automatiques.
- Fréquence des collisions gardée telle quelle (pas de dé supplémentaire).
- **Régatier** : en compensation, il n'entre jamais en collision dans la brume (ni abordeur, ni abordé). Bonus : « +1 case en zone côtière ; n'entre jamais en collision dans la brume ».

- **Alizés** (09/11/2026) : vent propre à la zone, régulier, de Nord-Est à Est, force 4 à 6 (mêmes dés, mais bornés ; force d'un cran au plus par tour). Bonus de +1 point conservé pour les caps S, SW, W. Valeurs dans la course (`vent_regulier`).

## Décisions du 09/11/2026 (nouvelles classes)

- **Un seul rang : « Légendaire »**, sans effet de jeu particulier. Les légendaires sont des bateaux robustes et fiables, qui auront plus tard leurs propres animations.
- **Classe « Vintage »** sélectionnable comme une classe (IMOCA…) : tous les skippers y courent sur des bateaux légendaires.
- **PRB** : vainqueur du Vendée Globe 2000 (Michel Desjoyeaux) et 2004 (Vincent Riou), confirmé par le porteur de projet (la base du site n'a pas 2004).
- **Ordre** : Ultims, Class40, Ocean Fifty, puis Vintage. Bêta : top 10 Class40, marins de renom passés en Ultim depuis 2015 (femmes si possible) ; compétences existantes réutilisables.
- **3D** : Ultim d'après le prototype existant ; Class40 et Ocean Fifty à construire selon la méthode de l'IMOCA (analyse des caractéristiques, validation sur photos récentes).
- Sélection des marins validée et corrigée : `jeu/conception/nouvelles-classes.md` (Ultims : même coque possible si chaque skipper garde le nom de son époque ; Ocean Fifty : liste officielle 2026, Elvest mené par Matthieu Perraut).
- **Durée d'une Route du Rhum** : 7 tours en moyenne en Ultim, 10 en IMOCA et Ocean Fifty, 15 en Class40.
- **Suspense** : avaries à la mesure de la vitesse, plus de cartes du large dans les classes rapides, météo calée sur la durée de chaque classe, escale technique après une avarie grave. (Écart en heures : non retenu.)

## Décisions du 10/11/2026

- **Coefficient de vitesse selon la force du vent** (F1 0,3 · F2 0,5 · F3 0,7 · F4 0,85 · F5-F6 1 · F7 1,05 · F8 1 · F9 0,9 · F10+ 0,75), appliqué à la table des voiles (`regles.json`, `coefficient_force`).
- **Brume** déplacée dans le golfe de Gascogne, entre la pointe de Bretagne et le cap Finisterre. **DST d'Ouessant** réduit.
- **Règle de priorité** : deux bateaux ne finissent jamais sur la même case. Même bord : celui qui arrive se déroute d'une case sous le vent, derrière. Bords opposés : le bateau bâbord amures passe derrière (règle 10 des Règles de course à la voile ; pour le même bord, les règles 11 et 12 font s'écarter le bateau au vent ou celui qui arrive par derrière).
- **Collision** (remplace la règle du 09/11) : seulement dans la brume, quand un bateau finit sur la case d'un concurrent invisible ; les deux perdent une carte réparation et sont immobilisés 1 tour. Le Régatier n'entre jamais en collision. Mesure : 0,03 à 0,35 collision par course.
- Vitesses de classe calées par simulation (40 courses par classe) : Ultim 7 tours, IMOCA 10, Ocean Fifty 10, Class40 environ 15.

- **Hangar par type de bateau** (10/11/2026) : IMOCA à foils, IMOCA à dérives, Class40, Ocean Fifty, Ultim volant, Ultim ancienne génération ; Vintage plus tard (modélisation plus complexe).

- **Publication des modèles 3D** (10/11/2026) : seulement quand tous les modèles seront faits et qu'une animation de chacun aura été montrée au porteur de projet. Pas avant.
- **Carte** : quatre coques différentes vues du dessus (IMOCA, Class40, Ocean Fifty, Ultim), le trimaran pour les multicoques.

## Décisions du 10/11/2026 : le dé du large et l'usure des voiles (principe validé, chiffres à valider)

- **Un seul dé par bateau et par tour.** 5 ou 6 : on tire une **carte du large** (les cartes portent les risques et les avaries ; il faut plus de variété). 3 ou 4 : **question** de culture marine ; bonne réponse : le risque est écarté ; mauvaise réponse : **usure** de la voile hissée (mauvaise manœuvre).
- **Usure des voiles** : elle augmente de toute façon à chaque tour d'utilisation, plus vite par vent fort et selon la voile (spi et gennaker vite, solent moins, foc / J3 encore moins). Au-delà d'un niveau d'usure, **la voile est perdue**, avec une animation de la perte.
- **On ne perd que les voiles d'avant.** La grand-voile peut être usée ou abîmée (par une carte) ; on la répare en passant un tour ou en jouant une carte réparation.
- L'usure dépend de la **classe** et de la **durée de la course**.
- Pas de F0 ni de F12 en course.
- **Grand-voile** : pas d'usure au fil des tours ; elle ne subit que des avaries par les cartes (réparée en passant un tour ou avec une carte réparation).
- **Dé tempête** : au-delà de F8, on lance un dé tempête. F9 : 6 ; F10 : 4, 5 ou 6 ; F11 : 2 à 6 → démâtage (monocoque) ou chavirage (multicoque). Les vents de F9 à F11 viennent des fronts.
- **Alizés et fronts** : les dés de vent (force et direction) y jouent pleinement, pour garder le suspense dans ces zones.
- **Anticyclone** : zone de hautes pressions qui apparaît au hasard pendant la traversée, comme les fronts, avec deux fois moins de chances qu'un front.
- Faces 1 et 2 du dé du large : rien (choix par défaut, à confirmer). Case noire : perte immédiate de la voile, sauf carte réparation (comme en 1987, à confirmer).

## Décisions du 10/11/2026 : Transat Café L'Or, double et Pot-au-noir

- **Transat Café L'Or : course en double.** Le joueur choisit un skipper (son bateau court) puis un co-skipper ; **leurs bonus s'additionnent**, leurs compromis aussi. Le co-skipper doit avoir une autre compétence que le skipper (proposition du cahier, appliquée). L'IA forme ses équipages de la même façon. En réseau, le co-skipper est tiré au hasard (choix à l'écran plus tard).
- **Points de passage obligés par classe** (demande du porteur de projet ; édition 2025, sources : outremers360.com, Figaro Nautisme) : Ultim, île de l'Ascension à tribord (6 200 milles) ; IMOCA, archipel des Canaries à tribord (4 350) ; Ocean Fifty, île de Sal (Cap-Vert) à tribord (4 600) ; Class40, archipel des Açores à tribord (3 750). Le Havre → Fort-de-France pour tous. Dans le jeu, chaque marque est une **ligne à franchir** (pointillés jaunes) partant de l'île vers le sud : il faut passer au sud de l'île (Ascension : contournée par le sud). Interprétation de « à tribord » à confirmer.
- **Pot-au-noir** (demande du porteur de projet) : son vent est tiré au hasard pour chaque bateau et à chaque tour : **pétole** (F0 à F1, le bateau n'avance presque pas) ou **grain violent** (F6 à F8), d'une direction au hasard. Proportion provisoire : un grain sur trois (`regles.json`, `pot_au_noir`), à valider. Il n'existe que sur la carte de la Transat Café L'Or (le Pot-au-noir est au sud de la Route du Rhum).
- **Alizés de sud-est** (vérifiés à la demande du porteur de projet ; sources : Figaro Nautisme, Universalis) : sous l'équateur, les alizés soufflent du sud-est. Leur zone a désormais son propre vent régulier, soumis aux dés (d'Est à Sud-Sud-Est, F3 à 6), comme celle des alizés de nord-est ; le moteur gère plusieurs zones d'alizés. Bonus pour les caps W, NW, N ; pas de malus « alizés contraires » (le près les pénalise déjà).
- **Ultim : point de passage à l'est de la pointe du Brésil** (demande du porteur de projet) : ligne par 5° S, de 40 à 230 milles au large du cap São Roque, après Ascension.
- **Parcours obligatoire dessiné** (demande du porteur de projet) : ligne jaune en pointillés du port de départ à l'arrivée, par les marques (route la plus courte en mer).
- **Ultim : marque de l'île de l'Ascension retirée** (décision du porteur de projet, 10/11/2026). Seul reste le point de passage à l'est de la pointe du Brésil. Parcours de 5 714 milles sur la carte (la distance officielle 2025, 6 200 milles avec Ascension, n'est plus affichée). Simulation : 13 tours (contre 17 avec Ascension).
- **Ultim : la marque du Brésil est une bouée** (décisions du porteur de projet, 10/11/2026) : bouée du cap São Roque, à **500 milles** à l'est de la pointe du Brésil (5° S, 26,9° W), à laisser à bâbord en remontant vers le nord (on passe à l'est de la bouée). Parcours de 5 960 milles sur la carte ; simulation : 14 tours.
- **Pot-au-noir dessiné sur la carte** (demande du porteur de projet) : bande sombre, grains et éclairs, avec son nom. Les flèches des alizés de sud-est montrent désormais un vent de sud-est.

## Décision du 10/11/2026 : modèle 3D de l'Ultim

- L'Ultim volant du jeu reprend le design du **Maxi Banque Populaire XI** (cotes de la fiche officielle : 32 m × 23 m, flotteurs de 32 m, foils de 9 m, dérive en T de 5 m, trois safrans à plan porteur, casquette de 12 m). Flotteurs fins, pas de bout-dehors. Appendices, mât et bôme modélisés comme pièces séparées, animées par le jeu.
- L'Ultim ancienne génération reprend le design d'**IDEC Sport** (ex-Groupama 3). **Décidé le 10/11/2026** : Macif 2015 (et Actual, même bateau) est le premier Ultim à foils (porteur de projet) ; il passe dans la famille « Ultim volant ». Restent en ancienne génération : IDEC Sport / IDEC. Les non-volants des années 2010 étaient plutôt les Sodebo.

## Décision du 10/11/2026 : modèle 3D de l'IMOCA

- L'IMOCA à foils du jeu reprend le design de **MACIF Santé Prévoyance** (Charlie Dalin, 2023). Appendices conformes à la jauge (une quille pendulaire, deux safrans, deux foils) ; mât de 27 m au-dessus du pont (tirant d'air de 29 m).
- L'IMOCA à dérives reprend le design de **Macif 2011** (François Gabart, vainqueur du Vendée Globe 2012-2013, aujourd'hui Café Joyeux). Pas de filières sur les modèles d'IMOCA.

## Décision du 10/11/2026 : modèle 3D de l'Ocean Fifty

- Ocean Fifty sur la structure de **Solidaires en Peloton** (deux bras en arche, filets), préférée par le porteur de projet à la « structure en K » des derniers VPLP ; version du 10/11/2026 acceptée par le porteur de projet (« on s'en contentera »), aux cotes de la jauge (15,24 m × 15,24 m, tirant d'eau 3,50 m, tirant d'air 23,77 m).

## Décision du 10/11/2026 : modèle 3D du Class40

- Class40 sur le design de **Crédit Mutuel** (David Raison, 2019) : quille fixe (pas pendulaire, confirmé par le porteur de projet), pas de dérives (jauge), deux safrans au tableau, long bout-dehors, mât non tournant sans outriggers.

## Décision du 10/11/2026 : premier bateau Vintage

- **Pen Duick III** (goélette d'Éric Tabarly, 1967) : modèle 3D validé par le porteur de projet (cotes Wikipédia, photos libres récentes). Reste à créer la classe Vintage dans le jeu et le gréement de goélette (deux mâts).

## Décisions du 10/11/2026 : plans de voilure et échelle de Beaufort

- **Plans de voilure réalistes** pour tous les supports (demande du porteur de projet) : surfaces réelles des voiles (sources dans `packages/client/src/jeu/voilure.ts` et le journal des versions). **Estimées** (à affiner si une source est trouvée) : tourmentins, J3, gennakers de l'IMOCA, grand-voile et voiles de portant du Class40, voiles d'avant de l'Ocean Fifty.
- **Échelle de Beaufort en 3D** (point 7 de la liste) faite : voilure de l'IMOCA par force selon `conception/risque-un-de-et-beaufort.md` (indicative), démâtage à F11, naufrage à F12.
- **Rolex Fastnet Race faite le 10/11/2026** (non publiée) : carte Bretagne-Irlande-Angleterre, marées alternées, brume, rails ; 15 tours pour toutes les classes. Positions des courants et des rails **stylisées, à vérifier**. Ancienne demande : la **Rolex Fastnet Race**, sur une carte de la Bretagne, de l'Irlande et de l'Angleterre, avec des systèmes météo propres à la zone ; course d'environ 3 jours, **15 tours en moyenne quelle que soit la classe**. Puis la **classe Vintage**, qui courra la Route du Rhum et le Fastnet (règles à valider).

## Décision du 10/11/2026 : flotte Vintage

- **Liste validée** par le porteur de projet : les bateaux « avant 2000 » de `conception/bateaux-legendaires.md` (Pen Duick III, Écureuil d'Aquitaine II, Bagages Superior, PRB, Groupe Sceta, Crédit Agricole, Aquitaine Innovations, Primagaz, Fauve, Fleury Michon, Elf Aquitaine III, Jet Services V, Groupama, Roaring Forty).
- **Chaque voilier de légende sera modélisé individuellement en 3D** (comme Pen Duick III), d'après ses cotes sourcées et des photos libres.
- Courses : Route du Rhum et Rolex Fastnet Race. Restent à décider : skippers de l'époque, vitesse et fragilité, mélange monocoques et multicoques.

## Décisions du 10/11/2026 (soir) : classe Vintage et hangar

- **Classe Vintage** : le porteur de projet a tranché, « il faut faire ça » : flotte de 14 bateaux de `conception/bateaux-legendaires.md` §5, un skipper de l'époque par bateau (sourcé dans le palmarès du site), Route du Rhum et Rolex Fastnet Race.
- **Deux familles Vintage seulement : monocoques et multicoques** (Pen Duick III est un monocoque). Effets provisoires : ceux de l'IMOCA à dérives (monocoques) et du trimaran de 50 pieds (multicoques). **À valider** : effets, vitesse (12 tours de 28 h au Rhum), compétences des 14 skippers (provisoires).
- **Modélisation : Blender et glTF** pour chaque bateau de légende, comme Pen Duick III. Blender 5.3 installé sur le PC portable le 10/11/2026 avec l'accord du porteur de projet.
- **Pen Duick III** : deux mâts de même hauteur, tirant d'air 18,80 m (source bateaux.com), correction du modèle validé (15,5 m estimés). La grande misaine à wishbone n'est pas dessinée (première forme jugée incohérente par le porteur de projet ; pas de plan trouvé).
- **« Ton hangar à bateaux »** : seul bouton gardé sur l'accueil (l'écran Beaufort est retiré) ; chaque bateau a son échelle de Beaufort dans sa vue 3D, avec des nuages.
- **Logo Ocean Fifty** en tête de grand-voile des Ocean Fifty (demande du porteur de projet).

## Décisions du 10/11/2026 (nuit) : après les essais du porteur de projet

- **Louvoyage : 60 % de la distance au près, conservé** (le porteur de projet a confirmé). Calcul sur la distance au près affichée, arrondie à la case.
- **Casse assurée** : une voile que la table des voiles donne en casse assurée (niveau 5) le reste, quels que soient les bonus de famille ou de compétence. Correction d'une situation jugée « totalement injuste » par le porteur de projet (spi porté par F8 par un monocoque robuste). **À confirmer** par le porteur de projet.
- **Pen Duick III : spi symétrique** sur tangon (demande du porteur de projet, vues de référence fournies).
- **Carte du Fastnet** élargie à l'ouest (13,2° W).

- **Scènes 3D de course : 10 secondes**, avec possibilité de passer la scène (demande du porteur de projet, 10/11/2026).

- **Vintage : deux classements** (décision du porteur de projet, 10/11/2026) : monocoques et multicoques dans la même flotte, chacun son classement ; la course se termine quand chaque catégorie a son vainqueur.

- **Briefing de départ** refait au ton des règles (demande du porteur de projet, 10/11/2026), point 8 de la liste « À faire ».

- **Vent à F1 : le dé de force n'indique jamais une baisse** (règle du porteur de projet, appliquée le 11/11/2026 ; `regles.json`, `de_force_min`).

## Décisions du 11/11/2026 : modélisation des bateaux de légende

- **Photos d'abord** : chaque modélisation commence par la recherche de photos du bateau (`conception/vintage-references.md`). Sans photo libre (Crédit Agricole 1982, Roaring Forty, Primagaz, Jet Services V, Groupama 1), les photos non libres servent de **simple référence visuelle**, sans être stockées ni publiées (décision du porteur de projet).
- **Blender et glTF**, un générateur par famille réglé par `packages/data/config/modeles-vintage.json` (une seule source de cotes pour Blender, la 3D et le plan de voilure).
- **Jet Services V est un catamaran** (fiche du site, Wikipédia), pas un trimaran : il lui faudra un modèle de catamaran.
- Spi symétrique sur tangon pour les bateaux de légende sans bout-dehors.

## Décisions du 11/11/2026 : jouabilité et téléphone (demandes du porteur de projet)

- **Dé du large** : 1, rien ; 2-3, question de culture marine ; 4-5-6, carte du large (remplace la règle du 10/11). Le joueur lance lui-même le dé (bouton « Lancer le dé du large »).
- **Cartes du large** : environ un tiers d'avantages (plus ou moins forts), un tiers d'histoires neutres, un tiers d'avaries (plus ou moins pénalisantes), en poids de tirage (42 cartes).
- **Carte réparation** : elle divise par deux l'effet d'une avarie (au lieu de l'annuler). Recul arrondi, durée divisée par deux, « immobile » ou « voile perdue » deviennent « distance divisée par deux » (la voile est gardée), « distance divisée par deux » devient « moins un quart ».
- **Pot-au-noir** : un bateau qui y entre s'arrête au milieu, fin de son tour. Au tour suivant il lance le dé : pair, il repart ; impair, il passe son tour (remplace le vent tiré au hasard du 10/11).
- **Fronts et anticyclones** : ils commencent comme prévu, puis leur vent évolue avec les dés du tour, de façon cumulée (au plus 90° et 2 forces d'écart avec le vent prévu).
- **Vent de départ** tiré au hasard : direction parmi les huit, force 2 à 5 (point 9 de la liste « À faire »).
- **Priorité** : le bateau déjà sur la case garde sa place ; celui qui arrive s'arrête sur la dernière case libre de son trajet (compté dans son déplacement, plus de déroutement après coup).
- **Voiles interdites par le vent** : plus de « case noire » à choisir ; la voile est grisée avec la mention « vent trop fort ».
- **Spi de gros temps** pour les monocoques (F6 à F8, petite surface ; distances et usure provisoires).
- **Fastnet Rock laissé à bâbord** (règle du porteur de projet) : on arrive par l'est, on passe au nord du rocher, puis à l'ouest, puis au sud ; trois lignes à toucher dans cet ordre, le rocher est une case de terre. Sans le tour complet, la marque ne compte pas.
- **Louvoyage** : le bateau suit réellement les bords en zigzag (±40° de l'axe) dessinés dans l'aperçu, en ne passant que par la mer (bord opposé, ou l'axe, si un bord touche la terre). La trace montre ces bords.
- **Courant** : la dérive s'ajoute pas à pas au déplacement (environ un tiers de case par case parcourue, au plus 1,5 case) ; le bateau n'est plus décalé d'une case après son déplacement.
- **Affichage** : journal de bord défilant (les événements restent lisibles) ; sur téléphone, la carte reste à l'écran et les commandes du bateau se superposent en bas (repliables) ; trace des bords de louvoyage à 45° du vent ; silhouettes fines des monocoques (d'après les croquis du porteur de projet) ; voile perdue toujours montrée en 3D ; Ultim volant au-dessus de l'eau dès F3 ; Ocean Fifty, Ultim non volant et multicoques de légende gîtés de 15° (F3) à 30° (F7), 30° au plus (12/11/2026, remplace 20 à 40°).
- **Gennaker** : utilisable à partir du travers seulement (90°) ; spi et spi de gros temps à partir de 112,5°.
- **Ocean Fifty** : même équilibre que l'IMOCA, même durée de course et même distance par tour (décision du porteur de projet).
- **Quiz** : 80 questions (32 nouvelles, à relire par le porteur de projet).

- **Jauge de distance IMOCA et Ocean Fifty** (11/11/2026) : sur les transatlantiques, jamais plus de 640 milles en 24 h (record de l'IMOCA), bonus des compétences et des cartes compris. Avec des tours de 28 h et des cases de 30 milles : 24 cases au plus par tour (720 milles). Le Fastnet, calé à part, n'est pas concerné. Réglage : `distance_max_24h` dans `familles.json`.
- **Départage des arrivées au même tour** (11/11/2026) : d'abord le taux de bonnes réponses au quiz, puis le nombre de bonnes réponses, puis le moins de milles parcourus sur toute la course (choix du porteur de projet). Une scène 3D montre le passage de la ligne : bouée jaune à bâbord, bateau comité à moteur à tribord, ligne de flotteurs entre les deux ; tous les bateaux arrivés ce tour-là la franchissent, dans l'ordre du départage.
- **Vent au-delà de F8** (11/11/2026) : le dé de force n'est plus borné à F8 ; le vent général peut monter jusqu'à F11, et le dé tempête joue (F9 à F11). Effet mesuré (6 Rhum simulés par classe) : environ 3,5 chavirages d'Ultim par course (0 avant) et 1 à 2 escales techniques par course (0 avant) ; durées presque inchangées. Équilibre à revoir avec le porteur de projet.
- **Fastnet : 32 caps sur toute la course** (12/11/2026, demande du porteur de projet) ; ailleurs, les demi-caps restent réservés aux 500 derniers milles. Les **îles Scilly sont dessinées** sur la carte (cases de terre), pour qu'on comprenne pourquoi on ne passe pas.
- **Aucun nombre de tours prévisible affiché** (12/11/2026, décision du porteur de projet : « c'est de la course au large, il faut de l'inconnu ») : ni à la configuration, ni dans l'en-tête de la partie, ni au briefing. Les durées mesurées en simulation restent un outil de réglage, jamais montré au joueur. En revanche, le briefing indique **ce que représente un tour** (« Un tour représente environ 1 jour de course » à la Route du Rhum, 3 jours au tour du monde, 5 heures au Fastnet ; arrondi : en heures sous 12 h, sinon en jours ; durée de la classe choisie), demande du porteur de projet du même jour.
- **L'IA réduit sa distance maximale** (12/11/2026, idée du porteur de projet : « pour sortir il suffit de réduire la distance max et d'attendre le tour suivant ») : comme un joueur, elle s'arrête au meilleur point de son trajet (avant la côte, au bon endroit pour virer). Simulation Rhum (20 parties) : vainqueur en 13 tours (médiane) ; de la Tête à l'Anglais à l'arrivée, 1 tour en médiane, 5 au pire (12 avant).
- **Fastnet : nord de Bishop Rock à l'aller, sud au retour** (12/11/2026, parcours officiel fourni par le porteur de projet) : ligne invisible de Bishop Rock vers le nord, à franchir avant le Fastnet ; DST inchangés. Simulation IMOCA (12 parties) : vainqueur en 18 tours (médiane). **Décision du porteur de projet (12/11/2026) : on garde 18 tours**, pas de recalage de la vitesse.
- **Plus de contournement automatique** (12/11/2026, décision du porteur de projet, remplace celle du 11/11) : « finir en plusieurs tours redonne du suspense ». Une marque franchie, le bateau garde son cap ; la côte l'arrête, même près de l'arrivée. Au Rhum, une ligne invisible à l'ouest de Basse-Terre oblige, après la Tête à l'Anglais, à contourner l'île par le nord puis par l'ouest avant d'arriver. Simulation (20 parties, 4 IA) : vainqueur en 14 tours (médiane ; 12 avec le contournement), 0 à 5 tours entre la Tête à l'Anglais et l'arrivée, une fois 12.
- **Arrivée du Rhum simplifiée** (12/11/2026, décisions du porteur de projet, remplace la règle suivante) : **la Tête à l'Anglais**, dessinée en bouée cardinale nord juste au nord de Basse-Terre (16,40° N, 61,78° W ; en réalité un rocher laissé à bâbord, figaronautisme.meteoconsult.fr), à passer au nord, puis la **zone d'arrivée entre le sud de la Guadeloupe et le nord de la Dominique** (3 cases), dessinée comme un point jaune à damier fondu. La carte trace de nouveau la route directe en blanc (Saint-Malo → bouée → Pointe-à-Pitre) au lieu du parcours en pointillés jaunes. Source du parcours réel : routedurhum.com/parcours (tour de la Guadeloupe, dévent de la Soufrière). Simulation (20 parties, 4 IA) : vainqueur en 12 tours (médiane, comme avant). Après la Tête à l'Anglais, les bateaux peuvent descendre par l'est de Grande-Terre ou par l'ouest de Basse-Terre (cases de 30 milles).
- ~~Ancienne règle~~ **Arrivée du Rhum par le nord, Guadeloupe à bâbord** (11/11/2026) : ligne invisible à l'ouest de Basse-Terre, puis bouée de Vieux-Fort (ligne invisible vers le sud-ouest), puis l'arrivée à Pointe-à-Pitre, pour toutes les classes.
- **Contournement des marques** (11/11/2026, choix du porteur de projet) : une marque franchie, le bateau file vers la suivante dans le même tour avec la distance qui lui reste, au plus court par la mer. **Près de l'arrivée** (500 milles, idée du porteur de projet) : un bateau arrêté par la côte la contourne de la même façon. Simulation : Rhum IMOCA 12 tours, Ultim 8, Class40 15, Ocean Fifty 11 ; Fastnet IMOCA 16 (22 à 27 avant) ; Café L'Or IMOCA 16 (18 avant). Idée du porteur de projet pour plus tard : une grille plus fine (et plus de directions) à moins de 500 milles du départ et de l'arrivée.
- **32 caps à l'approche de l'arrivée, en essai** (11/11/2026, décision du porteur de projet) : à moins de 500 milles de l'arrivée, on peut viser entre deux des 16 caps (demi-caps de 11,25°), grâce à une rosace intérieure de la rose des caps, sans changer le reste de l'écran. Distance d'une voile à un demi-cap : moyenne exacte des deux allures voisines (inutilisable si l'une l'est) ; l'IA les utilise aussi. Étude des autres pistes (grille plus fine) : `conception/grille-fine-approche.md`.

## Décisions du 12/11/2026 : météo à l'écran et ordre des animations (porteur de projet)

- **Tendance du vent** : « probable ne veut pas dire certaine ». La rotation probable n'apparaît que pour un skipper Météorologue (ou une compétence marquée `voit_tendance`), formulée « rotation attendue vers … (non certaine) » ; les prévisions s'affichent « vent attendu » (demande du porteur de projet, 12/11/2026). Les autres skippers, humains comme IA, raisonnent sur le dé de direction sans biais (`voitTendance`, `facesDirectionConnues` dans `engine/src/apercu.ts`).
- **Bloc météo** : petite pastille sur la carte qui ne masque rien d'important ; girouette animée. Le vent affiché est toujours celui de la zone où se trouve le joueur.
- **Tours du monde** : tour de jeu sur la carte plate → déplacement de tous les bateaux sur le globe → scènes 3D du tour → retour à la carte plate (`fileScenes` dans `client/src/ecrans/Jeu.tsx`).

## Décision du 12/11/2026 : perte de voile (porteur de projet)

- Quand une voile va être perdue (case noire d'un monocoque, carte « spi déchiré ») : **endurer** = la voile est perdue, le bateau avance de la moitié de la distance prévue ; **réparer** = la voile est sauvée, le bateau n'avance pas ce tour. Le chavirage d'un multicoque reste inchangé (réparer : redressé sans avancer ; sinon immobilisé 2 tours).

- **Avarie réparée : jamais plus de la moitié de l'avance prévue du tour** (décision du porteur de projet, 12/11/2026), sauf la voile sauvée par une réparation (pas d'avance, règle ci-dessus). *Remplacée par le barème ci-dessous.*
- **Barème des avaries en part du tour** (décision du porteur de projet, 12/11/2026) : légère 25 %, moyenne et chute 50 %, lourde 75 %, tour perdu 100 % ; réparée : la moitié. Voile : endurer = voile perdue et 50 % ; réparer = voile sauvée, tour perdu. Règle en deux phrases : contre une perte de temps, la réparation divise la perte par deux ; contre une perte de voile, on choisit entre le tour et la voile.
- **Avaries durables** (décision du porteur de projet, 12/11/2026, complète le barème) : « les pénalités qui durent plusieurs tours suivent le principe de la perte de %, appliqué à la distance du premier puis du deuxième tour ; la carte réparation annule l'impact sur le deuxième tour mais coûte plus cher au premier tour ». Codé : encaissée, la même part à chaque tour ; réparée, **1,5 fois la part** sur le tour de la carte (au plus 100 %), rien ensuite (**facteur 1,5 validé par le porteur de projet le 12/11/2026**). Règles et coach restent généraux (« les cartes réparation permettent de limiter l'impact »), le détail est dans la fenêtre de la carte. **Référence pour les développeurs : `docs/avaries-et-reparations.md`.**

## À faire (liste du porteur de projet, 10/11/2026)

1. Définir les nouvelles courses : Transat Café L'Or (double), Lorient – Bermudes – Lorient (Ocean Fifty, double, sans escale), Vendée Globe, The Ocean Race (étapes), Arkéa Ultim Challenge, Globe 40 (Class40, double, étapes). Cahier : `conception/nouvelles-courses.md`.
2. Lier les skippers du jeu à leur fiche du site « Mémoire du large ».
3. Ajuster les bonus et malus (compétences des 32 nouveaux skippers provisoires ; famille « Ultim ancienne génération » à valider).
4. Multiplier les questions du quiz (80 le 11/11/2026, à poursuivre).
5. Multiplier les cartes du large, en s'inspirant d'événements réels des courses récentes (avec sources).
6. 3D : modèles Blender fidèles pour chaque type (Class40 en cours, puis Ocean Fifty, IMOCA, Ultim ; Vintage plus tard).
7. ~~Hangar : animation pédagogique de l'échelle de Beaufort~~ (faite le 10/11/2026).
8. Revoir le briefing avant le départ (demande du porteur de projet, 10/11/2026).
9. ~~Vent au départ tiré au hasard~~ (fait le 11/11/2026).

## Questions ouvertes

1. **Système de bonus et malus** (demande du porteur de projet, 08/11/2026) : à revoir ensemble pour un système cohérent et efficace, où chaque effet compte sur toutes les courses.
   - Régatier : le compromis « mers du Sud » est remplacé **provisoirement** par « −1 case par vent fort (F6 et plus) ».
   - Navigateur (pas encore dans la bêta) dépend aussi du parcours (courants, brume, alizés) : à revoir.
   - Sur la carte réaliste (400 parties, `reports/equilibrage-beta.md`) : Dalin 25 %, Le Cam 17 %, Beyou 30 %, Richomme 29 % ; durée médiane 15 tours.
2. Zones météo et zones interdites (DST Ouessant, DST Finisterre) placées de façon stylisée : à vérifier.
3. Règle d'escale réelle de la Route du Rhum et durée d'un tour.
4. Sources des justifications des 4 skippers, et vérification des architectes et des années des bateaux.
5. Relecture des 36 questions du quiz.
6. ~~Fréquence des collisions~~ : **tranché le 09/11/2026, on garde tel quel** (collision dès qu'un bateau entre dans une case de brume occupée ; ≈ 1 tour sur 9 en simulation).
8. Bateau d'Alexia Barrier en Ultim : à préciser.
7. ~~Régatier~~ : tranché le 09/11/2026, il n'entre jamais en collision.

- **11/11/2026 : modèles 3D des multicoques de légende validés par le porteur de projet** (rendus `jeu/conception/multicoques-legende-rendus.png`, générateur `jeu/outils/blender/vintage_multi.py`, cotes dans `modeles-vintage.json`, valeurs estimées signalées). Jet Services V en catamaran.
- **11/11/2026 : alizés bornés à 90° (porteur de projet).** Hémisphère nord : le vent des alizés oscille au plus du Nord à l'Est (directions 0 à 4 sur 16) ; hémisphère sud : du Sud à l'Est (4 à 8). Remplace les plages NE-SE et E-SSE.
- **11/11/2026 : le joueur voit le vent de sa zone (porteur de projet).** Les dés agissent partout, mais l'écran des dés et le bandeau montrent le vent de la zone où se trouve le bateau (vent général, alizés, front, traîne, molle, anticyclone), jamais celui d'une zone où il n'est pas.
- **11/11/2026 : spi de gros temps dans le hangar des monocoques**, avec sa propre forme 3D (plus petit, hissé plus bas, plus plat que le spi). Surfaces estimées : IMOCA 220 m² (à dérives 210), Class40 105 m², bateaux de légende 55 % du grand spi.
- **11/11/2026 : voiles d'époque des bateaux de légende validées (porteur de projet, d'après ses photos d'Écureuil d'Aquitaine II, Aquitaine Innovations, Groupama et Foncia).** Génois amuré à l'étrave, point d'écoute bas à l'aplomb du mât ; génois léger un peu plus grand ; grand-voile à tête pointue jusqu'en 1997, petite tête carrée dès 1998 ; voiles d'avant blanches avant 1985, Kevlar doré de 1985 à 1994, Mylar crème ensuite.
- **12/11/2026 : écrans du hangar et des règles** : le bouton « ← Accueil » reste toujours visible en bas de l'écran. **Tableau de bord** : le réglage « Distance max » est juste sous le choix des voiles, avant l'explication des risques (porteur de projet).
- **12/11/2026 : tours du monde (porteur de projet).** Un tour de jeu = **3 jours** de course (2 jours d'abord ; puis 4, mais distances par tour peu crédibles ; décision finale du même jour : Vendée Globe en 60 à 70 jours, soit 20 à 25 tours ; Arkéa Ultim Challenge en 15 à 20 tours) ; le moteur compte la vraie distance (case de 1° de longitude : 60 milles × cos latitude). Courses à préparer : Arkéa Ultim Challenge, Vendée Globe, Globe 40 (plan : `conception/nouvelles-courses.md`).
- **12/11/2026 : météo mondiale des tours du monde (porteur de projet : « les grandes tendances de la météo mondiale », plan validé : « Oui, lance »).**
  - Rotation du vent selon l'hémisphère : autour d'un anticyclone, sens des aiguilles d'une montre au nord, sens inverse au sud.
  - Anticyclones permanents à leur position moyenne : Açores, Sainte-Hélène (dessinés au départ et à l'arrivée), Mascareignes, île de Pâques. Rayon de 900 à 1 000 milles ; ils bougent un peu chaque tour autour de leur position ; calme au centre.
  - Dépressions qui naissent dans la bande des vents d'ouest (Atlantique nord, mers du Sud) en amont des bateaux qui y naviguent, annoncées un tour à l'avance, filent vers l'est à 20 nœuds, rayon de 450 à 700 milles. Front de SW puis bascule au NW au nord ; front de NW puis bascule au SW au sud. Elles remplacent les fronts et l'anticyclone tirés au hasard des transatlantiques.
  - Grands courants dessinés sur la carte, qui font dériver les bateaux : Gulf Stream, dérive nord-atlantique, Canaries, nord- et sud-équatorial, Brésil, Benguela, Aiguilles, Leeuwin, est-australien, Kuroshio, Humboldt, Malouines, circumpolaire antarctique.
  - Positions, tailles et tracés STYLISÉS d'après la climatologie générale (`outils/courses-monde.ts`). Simulation : Vendée Globe ≈ 23-24 tours, Arkéa ≈ 18 tours.
- **12/11/2026 : pot-au-noir des tours du monde.** Malgré les tours de 3 jours (un dé impair coûte 3 jours), le porteur de projet garde la règle commune (arrêt au milieu, dé pair pour repartir) : « Garder la règle ».
- **12/11/2026 : vue globe des tours du monde (porteur de projet : « met un globe »).** Bouton « 🌍 Vue globe » sur le Vendée Globe et l'Arkéa Ultim Challenge : la carte (côtes, zone des glaces, courants, anticyclones, dépressions, route, bateaux et traces) est reportée sur une sphère en 3D, un seul Atlantique, vraies proportions du Grand Sud. On la fait tourner à la main ; elle suit le bateau du joueur à chaque tour et au bouton « Centrer ». Le jeu se joue toujours sur la carte plate (bouton « 🗺 Carte plate »).
- **12/11/2026 : escale interdite au Vendée Globe (porteur de projet).** Le Vendée Globe a les mêmes ports de repli que l'Arkéa Ultim Challenge (Le Cap, Hobart, Rio, Recife, Las Palmas). Un bateau gravement endommagé (chavirage, deuxième voile perdue) à moins de 500 milles d'un port s'y arrête et abandonne (course sans escale ni assistance) ; plus loin, il continue avec ses avaries. À l'Arkéa, il fait une escale technique (1 tour perdu) et repart.
- **12/11/2026 : globe, corrections (porteur de projet : « le zoom du globe n'affine pas la résolution, les bateaux n'apparaissent pas »).** Côtes, bateaux (pastille et nom de taille fixe à l'écran) et traces dessinés en 3D : nets à tous les zooms. Sur téléphone, les boutons de la carte sont en colonne au milieu du bord droit (le bouton Valider les recouvrait).
- **12/11/2026 : globe, retouches (porteur de projet : « pas de zoom, pas de bateau et des infos qui se chevauchent »).** Les boutons + et − zooment le globe quand il est ouvert ; les bateaux sont dessinés avec leur coque (comme sur la carte plate), tournée dans le sens de la marche ; les noms des bateaux proches sont empilés ; les noms des courants ne sont plus écrits en double.
