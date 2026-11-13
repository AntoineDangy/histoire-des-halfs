# Audit de l'enchaînement d'un tour (13/11/2026)

Demande du porteur de projet (13/11/2026), après le bug « les cartes s'affichent 2x et mon déplacement est incohérent » (Route du Rhum à deux, en réseau) : « je pense que le jeu va trop vite et qu'il s'emmêle. On va faire un audit des étapes entre les joueurs et les IA et chercher ce qui déconne. Le but va être de définir l'enchaînement le plus clair pour solutionner tous les petits problèmes. » Puis : « audit en solo et en multi ».

**Choix du porteur de projet (13/11/2026) : « oui tout »** (ses recommandations : E2 a, E6 a, chrono après l'animation, récapitulatif des IA, le reste tel que proposé), avec une étape de plus : **entre le vent et le large, la perte de voile** (déchirée ou affalée) due au nouveau vent, confiée à la conversation du jeu (branche `mises-a-jour-jeu`). **Fait** sur la branche `corrections-affichage` (détail `jeu/CHANGELOG.md`), non publié.

**Cet audit ne change rien au jeu en ligne.** Il décrit l'enchaînement actuel, relève ce qui s'emmêle et propose un enchaînement unique. Le porteur de projet choisit ensuite, ligne par ligne (colonne « Choix »). Seule exception, déjà enregistrée sur la branche `corrections-affichage` et **non publiée** : la correction provisoire de la carte affichée deux fois (E1).

## Comment

- **Lecture du code** de la version en ligne (0.4.239) : moteur (`engine/src/moteur.ts`, fonctions `demarrerResolution`, `avancer`, `etapeBateau`), serveur de salons (`server/src/index.ts`, délais et envoi de la partie), écran de jeu (`client/src/ecrans/Jeu.tsx`, lecture animée des événements).
- **Deux parties à deux joueurs jouées en local** (serveur de salons lancé sur le PC, Route du Rhum en Ocean Fifty, Luke Berry contre Basile Bourgnon, second joueur automatique), 3 puis 9 tours.
- **Limites** : pas d'essai sur téléphone ; « même écran » vu seulement dans le code ; la capture du porteur de projet a montré un titre « Dépassement ! » resté affiché (E8), pas reproduit.

## En bref

1. **Le moteur est juste ; c'est l'écran qui raconte le tour dans le désordre.** Le calcul suit toujours le même ordre, mais l'écran montre certaines choses en avance (décisions en réseau), d'autres trop vite (IA), d'autres pas du tout (pourquoi la distance a changé, pourquoi le routeur a choisi à ma place).
2. **En réseau, les décisions s'affichent avant leur cause.** Depuis le 13/11 (choix C1 de l'audit de fluidité), une question ou une carte réparation apparaît dès que le serveur la demande, alors que l'écran montre encore les dés du vent. Conséquence directe : la carte du large s'affichait deux fois (E1).
3. **Le chrono du choix tourne pendant l'animation** (réseau) : les 2 min 30 commencent dès que le serveur a fini le tour, pas quand l'écran du joueur a fini de le montrer. Un joueur qui regarde une question, une carte et des scènes 3D peut voir le routeur choisir à sa place : son bateau part alors où il n'a pas choisi. **C'est l'explication la plus probable du « déplacement incohérent »** (vu en local au premier tour).
4. **Le tour est découpé de façon peu lisible** : tous les dés du large d'abord (de tous les bateaux), puis tous les départs et déplacements. La carte tirée au début ne produit son effet que bien plus tard, au moment où le bateau bouge.
5. **Proposition** : un seul fil, le même en solo, en même écran et en réseau, en 4 temps annoncés à l'écran (Choix, Vent, Large, Course), chaque décision à son moment et une seule fois, une seule zone de messages, un chrono qui part quand l'écran du joueur a fini.

## L'enchaînement d'un tour aujourd'hui

Ordre de calcul du moteur (identique dans tous les modes), et ce que l'écran en montre. Durées à la vitesse ×1.

| Étape du moteur | Solo (1 joueur + IA) | Même écran (2 à 4 joueurs) | Réseau (2 à 4 joueurs) |
|---|---|---|---|
| **0. Choix du cap et de la voile** (les IA choisissent au dernier moment) | Le joueur choisit, « Valider » | Écran « Je suis X » puis choix, joueur par joueur | Tous en même temps ; **chrono 2 min 30 parti dès la fin du calcul du tour précédent**, puis le routeur choisit |
| **1. Dés du vent** (un seul jet pour toute la carte) | 3,5 s (un clic ou Espace passe) | idem | idem, chacun à son rythme |
| **2. Dés du large de TOUS les bateaux**, dans l'ordre de passage (dernier du classement en premier) : rien, question ou carte du large ; carte avec avarie : décision « carte réparation ? » | Joueur : clic « Lancer le dé », puis question (fenêtre, 30 s) ou carte (paquet 1,7 s + clic) ; IA : 0,15 s chacune, dé « rien » non montré | Chaque joueur lance son dé ; ses décisions n'apparaissent qu'une fois l'animation arrivée au bout | **Décision affichée dès que le serveur la demande**, souvent pendant les dés du vent ; dé des autres joueurs : 4 s sans clic ; carte des autres : bandeau 2 s ; le serveur attend chaque décision, **une à la fois**, 1 min 30 au plus |
| **3. Bateau par bateau**, même ordre : départ (cap, voile, distance « possible » avec le nouveau vent), dé tempête (F9 et plus), case noire et décision de réparation, voile inutilisable, déplacement | Joueur : départ 0,9 s, déplacement animé ; IA : départ 0,12 s, déplacements groupés ; scène 3D de 8 s si coup de vent, petit temps ou louvoyage du joueur | idem | idem ; une décision (case noire) peut à nouveau tout arrêter |
| **4. Fin de tour** : dépassements, bateaux à vue, arrivées, fronts annoncés | Une scène 3D de 8 s (la plus forte), parfois deux | idem | idem |

## Ce qui s'emmêle

| N° | Situation | Modes | Constaté ? | Pourquoi | Piste | Choix |
|---|---|---|---|---|---|---|
| E1 | **Carte du large affichée deux fois** : d'abord dans la fenêtre « carte réparation » (titre seul), puis la carte entière quand l'animation y arrive | Réseau | Oui, en local, dès le 1er tour (« Coup de fatigue ») | La décision part en avance (C1) et l'animation remontre ensuite la carte (`Jeu.tsx`, fenêtre de réparation affichée sans attendre l'animation) | **Fait sur la branche, provisoire** : la carte est montrée une fois, en entière, avec son choix ; l'animation ne la rouvre plus | |
| E2 | **Décisions avant leur cause** : question du large, carte réparation, case noire (« votre spi va exploser ! ») apparaissent avant que l'écran n'arrive au dé ou au bateau concerné, souvent pendant les dés du vent ; ensuite l'écran « lance » un dé dont le joueur connaît déjà le résultat | Réseau | Oui, en local | Choix C1 du 13/11 : ne plus faire attendre les autres joueurs pendant l'animation | (a) décision à son moment dans l'animation (clair, quelques secondes d'attente en plus pour les autres) ; (b) garder l'avance, avec la correction provisoire (dé lancé seul quand son résultat est connu) | |
| E3 | **Chrono du choix qui tourne pendant l'animation** : « Plus que 60 s » peut arriver tôt ; à zéro, le routeur choisit le cap et la voile, et le bateau part où le joueur n'a pas choisi | Réseau | Oui, en local (tour 1 : « Temps écoulé : le routeur choisit… ») | Les 2 min 30 partent à la fin du calcul du tour (`server/src/index.ts`, `planifier`), alors que l'animation d'un tour à deux dure de 20 s à plus d'une minute (question 30 s, cartes, scènes 3D de 8 s) | Faire partir le chrono quand l'écran du joueur a fini de montrer le tour (l'écran le signale au serveur) ; à défaut, allonger le délai | |
| E4 | **« Le routeur a choisi pour vous » passe inaperçu** : une ligne de journal, 0,9 s de bandeau au tour suivant | Réseau | Oui, en local | Message traité comme un événement ordinaire | Fenêtre claire au début du tour : « Temps écoulé : le routeur a choisi pour vous cap X, voile Y » | |
| E5 | **Distance prévue et distance réelle** : l'aperçu montre la distance avec le vent actuel (règle du 09/11) ; après les dés, le bateau peut faire bien moins (vu en local : 450 milles prévus, 190 faits, vent passé de F5 à F3) sans que l'écran dise pourquoi | Tous | Oui, en local | Le départ du bateau s'affiche 0,9 s (« 180 milles possibles ») sans rappeler le prévu | Au départ du bateau : « prévu 450 milles → 190 : le vent a faibli (F5 → F3) » | |
| E6 | **Tous les dés du large d'abord, tous les déplacements ensuite** : la carte tirée au début produit son effet bien plus tard ; en réseau, chaque décision arrête tout le monde au milieu des dés du large, puis une seconde fois éventuellement (case noire) | Tous, surtout réseau | Lecture du code (`moteur.ts`, `avancer`) | Ordre de calcul du moteur | (a) garder l'ordre, mais l'annoncer (« Le large », puis « La course ») ; (b) chaque bateau joue son tour d'un bloc : dé du large, carte ou question, départ, déplacement (ordre du moteur à changer, mêmes dés, même équilibre) | |
| E7 | **IA trop rapides** : leurs dés du large, cartes, questions et départs passent en 0,12 à 0,15 s ; leurs déplacements sont groupés ; on ne voit pas ce qu'elles ont fait (résumé seulement au tour suivant, dans la consigne) | Solo, réseau avec IA | Lecture du code | Choix A4 et A5 de l'audit de fluidité (13/11) | Un récapitulatif de 2 à 3 s à la fin du « Large » (« Les IA : 2 cartes, Arc-en-ciel et Latte cassée ; 1 question réussie ») ; déplacements groupés gardés, 1,5 s au moins | |
| E8 | **Titre de scène 3D « Dépassement ! » resté affiché** pendant l'attente des choix, sous le panneau « en attente de » | Réseau | Capture du porteur de projet ; **pas reproduit** | Cause non trouvée à la lecture | À reproduire ; en tout cas, aucune scène 3D pendant le choix | |
| E9 | **Messages empilés au même endroit** : panneau « en attente de », « Plus que N s », « Connexion perdue », erreurs, bandeaux s'affichent tous en bas au centre et se recouvrent | Réseau surtout | Lecture du code (même emplacement pour tous) ; visible sur la capture | Chaque message a été ajouté séparément | Une seule zone de messages, qui les empile au lieu de les superposer | |
| E10 | **Même écran : décisions à la fin de l'animation, sans passation** : la question du joueur 2 apparaît sur l'écran commun sans « Je suis X », et chaque joueur doit lancer son dé du large | Même écran | Lecture du code (non joué) | L'écran de passation ne sert qu'au choix du cap | Passation aussi pour les décisions (« X, à toi : question du large ») ; dé lancé seul | |
| E11 | **Plusieurs scènes 3D de 8 s dans un tour** (un moment plus fort qui arrive après en a une aussi ; scène de début de tour repoussée après la case noire) | Tous | Lecture du code | Règle « un moment plus fort a quand même sa scène » | Au plus une scène par tour, en fin de tour ; les autres moments en bandeau | |

## L'enchaînement proposé : un seul fil, partout le même

Principes : **l'écran raconte le tour dans l'ordre du calcul ; chaque décision arrive à son moment, une seule fois ; chaque temps du tour est annoncé ; un seul endroit pour les messages.** En réseau, chacun voit la même histoire au même moment, à quelques secondes près.

1. **Choix** (« Tour 5 · Choix ») : cap et voile. Réseau : chrono de 2 min 30 à partir du moment où **ton** écran a fini le tour précédent ; à zéro, une fenêtre dit ce que le routeur a choisi. Même écran : « Je suis X » avant chaque joueur, comme aujourd'hui.
2. **Le vent** (« 1/3 Le vent ») : les dés du vent, comme aujourd'hui (3,5 s, un clic passe).
3. **Le large** (« 2/3 Le large »), bateau par bateau dans l'ordre de passage : dé du large, puis son résultat ; pour un joueur, la question ou la carte (avec le choix « carte réparation ? ») arrive **à ce moment**, une seule fois, dans tous les modes. Les autres joueurs voient « X tire la carte… », puis « X réfléchit… ». Les IA : un récapitulatif de 2 à 3 s à la fin.
   *Variante (E6 b)* : fusionner « Le large » et « La course » : chaque bateau joue son tour d'un bloc (dé du large, carte ou question, départ, déplacement).
4. **La course** (« 3/3 La course »), bateau par bateau : départ avec la distance prévue et la distance réelle (et la raison de l'écart), tempête ou case noire avec la décision à ce moment, déplacement. IA groupées, 1,5 s au moins.
5. **Fin de tour** : classement, **une seule** scène 3D (le moment le plus fort), fronts annoncés ; puis retour au choix.

Effet attendu sur les petits problèmes : E1, E2 et E10 disparaissent (une décision, un moment, une fois) ; E3 et E4 ne surprennent plus personne ; E5 est expliqué à l'écran ; E7 et E11 rendent le tour lisible sans le rallonger beaucoup ; E9 supprime les superpositions. En réseau, l'attente des autres pendant une décision passe de « 0 s mais dans le désordre » à « le temps que l'écran arrive à la décision » (quelques secondes).

## Questions au porteur de projet

1. Décisions en réseau (E2) : **à leur moment dans l'animation** (a), ou en avance comme aujourd'hui (b) ?
2. Ordre du tour (E6) : garder « tous les dés du large, puis tous les déplacements », annoncé à l'écran (a), ou **chaque bateau d'un bloc** (b, ordre du moteur à changer) ?
3. Chrono du choix en réseau (E3) : partir quand l'écran du joueur a fini le tour (oui / non) ?
4. IA (E7) : récapitulatif de 2 à 3 s de ce qu'elles ont fait au large (oui / non) ?
5. Le reste (E4, E5, E8 à E11) : d'accord pour le faire tel que proposé ?
