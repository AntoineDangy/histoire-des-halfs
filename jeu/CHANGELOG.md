# Journal des versions

## Mise en ligne 33278827 (13/11/2026, soir), serveur réseau 7b09904b
Avec l'accord du porteur de projet (« Corrige puis publie ») : version 0.4.227, branche `mises-a-jour-jeu` passée dans `main`.
- **Transat Café L'Or et Rolex Fastnet Race jouables en réseau** (entrée ci-dessous, branche `reseau-transat-fastnet` fusionnée).
- **Correction, réseau** : la réponse à une question part toute seule 20 s après avoir répondu, sans attendre « Continuer ». Avant, sans ce clic, le serveur jouait au bout d'1 min 30 la réponse par défaut, comptée fausse, même après une bonne réponse (remarqué pendant l'essai de la fusion). Une seule réponse envoyée, même si le joueur clique au même moment.
- Vérifié : 59 tests, types du moteur, du client et du serveur. En ligne : version 0.4.227 affichée ; salon Transat Café L'Or (IMOCA, 6 équipages en double) créé sur le serveur publié, course lancée ; question répondue sans cliquer sur « Continuer » : réponse partie seule, comptée juste dans le journal, décision suivante affichée ; aucune erreur.

## 13/11/2026 · Transat Café L'Or et Rolex Fastnet Race en réseau (branche `reseau-transat-fastnet`, fusionnée dans `mises-a-jour-jeu` et publiée le 13/11/2026)
- Demande du porteur de projet. L'écran « Créer une partie » du jeu en réseau propose la **course** : Route du Rhum, Transat Café L'Or, Rolex Fastnet Race (avant, le serveur lançait toujours la Route du Rhum). La liste des classes suit la course (pas de Vintage à la Transat Café L'Or) et le nombre de bateaux s'arrête au maximum possible : à la Transat, course en double, chaque équipage reçoit un co-skipper tiré au hasard, donc 7 bateaux au plus (5 en Ultim). Le salon d'attente affiche la course.
- Le serveur ramène tout réglage impossible à une partie possible (course inconnue ou tour du monde → Route du Rhum, classe non admise → IMOCA, nombre de bateaux borné) ; un changement de classe par l'hôte remet à zéro les choix de skippers.
- Vérifié : 4 tests ajoutés (55 tests) et essai du serveur de salons en local : Transat demandée en Vintage avec 10 bateaux → IMOCA, 7 bateaux, 7 co-skippers ; Fastnet en Vintage lancé ; Vendée Globe demandé → Route du Rhum. Écran non vu dans un navigateur.
- Fusion dans `mises-a-jour-jeu` (13/11/2026, soir) : 59 tests ; partie réseau essayée en local sur la Transat (IMOCA, 4 équipages en double) et le Fastnet (Vintage, 6 bateaux, deux classements), premier tour résolu, aucune erreur.
- Serveur réseau publié avec le jeu (7b09904b).

## Mise en ligne 9d97c2ed (13/11/2026, après-midi), serveur réseau add1c9e3
Avec l'accord du porteur de projet (« Oui, mets en ligne ») : version 0.4.221, branche `mises-a-jour-jeu` passée dans `main`. Contient les trois entrées du 13/11 ci-dessous : Ultim calés sur leurs records de distance en 24 h, molle des Antilles dessinée et brume du sud-ouest de l'Irlande, tours plus rapides et réseau plus sûr. Vérifié en ligne : version affichée sur l'accueil, salon réseau créé sur le serveur publié, course lancée, premier tour résolu par le serveur (décision du Stratège affichée aussitôt), sans erreur.

## 13/11/2026 · Tours plus rapides et réseau plus sûr (suite de l'audit de fluidité, branche `mises-a-jour-jeu`, non publié)
Choix du porteur de projet dans `jeu/conception/audit-fluidite.md` : E1, E2, A1 (8 s), A2 à A5, C1, C2, C4, C5, C6.
- **Scènes 3D de 8 s** au lieu de 10 (la ligne d'arrivée est franchie un peu plus vite pour tenir dans la scène).
- **Dés du vent** : résultat à 1,2 s, suite à 3,5 s au lieu de 6,5 ; « Continuer », un clic sur les dés ou la barre d'espace passent plus tôt.
- **Dé du large** : résultat à 0,7 s et suite à 1,7 s après le clic (au lieu de 3,6 s) ; nouvelle case « Lancer mon dé tout seul les prochaines fois », mémorisée sur l'appareil.
- **IA** : leurs moments sans rien à montrer passent presque sans attendre (cartes et dés 0,15 s au lieu de 1,8 et 0,9 s) ; la consigne du tour résume leurs cartes et questions du tour précédent ; leurs déplacements qui se suivent sont animés ensemble.
- **Erreurs corrigées** : une carte du large qui immobilise n'est plus présentée comme une voile inutilisable (message de la carte, 2,5 s, sans scène de voile affalée) ; passer l'animation ou changer de vitesse juste après le dé du large ne saute plus l'événement suivant.
- **Réseau** : la décision (question, relance, réparation) s'affiche dès que le serveur la demande ; la carte du large d'un autre joueur est annoncée 2 s sans clic ; **délais du serveur** (2 min 30 pour le cap, puis le routeur choisit ; 1 min 30 pour une décision, puis réponse par défaut ; temps restant affiché ; chiffres provisoires) ; la question en réseau part seule une fois le temps écoulé ; « Confier à l'IA » possible après une minute d'attente ; l'hôte qui part passe son rôle ; ping toutes les 20 s et connexion morte repérée des deux côtés ; reconnexion immédiate au retour sur l'onglet ; messages gardés pendant une coupure ; refus du serveur affichés ; page rechargée reconnectée seule ; place reprise depuis un autre onglet ; bateau confié à l'IA repris en revenant.
- Vérifié : 55 tests, types du client, du moteur et du serveur ; partie en réseau à deux joueurs et deux IA sur un serveur de salons lancé en local (minuteur, décision immédiate, carte de l'autre sans clic, rechargement, reprise depuis un autre onglet). **Le serveur réseau a changé : à la mise en ligne, publier aussi le serveur.**

## 13/11/2026 · Audit de fluidité des parties (branche `mises-a-jour-jeu`, aucun changement du jeu)
- Demande du porteur de projet : accélérer les tours de jeu, d'abord par un audit des parties (solo, même écran, réseau, avec ou sans IA). Note : `jeu/conception/audit-fluidite.md`, 33 situations, une ligne chacune (où, combien, pourquoi, pistes), à choisir au cas par cas.
- Mesures : lecture du code et parties rejouées avec le moteur (30 parties solo, 48 parties réseau simulées). Un tour solo impose environ 32 s d'animations et 6 clics ; le calcul (IA comprises) reste sous 0,1 s par tour sur PC ; en réseau, chaque décision d'un joueur bloque la table jusqu'à sa réponse, sans minuteur, et la partie entière (60 à 230 Ko) est renvoyée à chaque clic.

## 13/11/2026 · Molle des Antilles redessinée, brume au sud-ouest de l'Irlande (branche `mises-a-jour-jeu`, non publié)
- **Molle de la Route du Rhum** (demande du porteur de projet) : la zone de vent faible et instable n'est plus un cercle centré à l'est de Pointe-à-Pitre (il débordait de 150 milles sur l'Atlantique). C'est désormais **la zone qu'il a dessinée**, relevée point par point : allongée et arrondie, elle épouse à l'est l'arc antillais (Barbuda, Antigua, est de Grande-Terre et de la Désirade sans les dépasser, est de la Dominique et de la Martinique) et s'étale à l'ouest jusqu'au bord de la carte, du nord d'Anguilla à la hauteur de Saint-Vincent (environ 250 × 350 milles). Elle reste tirée au hasard au départ (6 courses sur 10), avec un vent F1-2 qui change de direction à chaque tour, et ne dépend plus de la classe. Le moteur sait maintenant décrire une molle par son contour (champ `molle.contour` de la course) ; les autres courses gardent leur cercle. Vérifié à l'écran en local.
- **Brume du sud-ouest de l'Irlande** (demande du porteur de projet) : vaste zone de brume de 49,5° N à 51,35° N, de 14° W au méridien du Fastnet Rock, posée sur les trois cartes qui couvrent ce secteur : **Rolex Fastnet Race** (du bord ouest de la carte jusqu'au rocher, 53 × 45 cases ; la ligne de passage à l'ouest du rocher reste hors de la brume, mais le tour du rocher y entre), **Route du Rhum** et **Transat Café L'Or** (8 × 6 cases au nord-ouest d'Ouessant). Les tours du monde (cases de 60 milles, sans brume) ne changent pas. Rappel : une case de brume compte double et le tableau de bord ne l'annonce pas (« pas maintenant », 13/11).
- Molle et brume aussi inscrites dans l'outil qui génère les cartes (`outils/courses-atlantique.ts` pour la brume ; la molle dessinée n'est que dans `route-du-rhum.json`, comme la jauge des Ultim du 13/11 : à reporter si l'on régénère la carte).
- 2 tests ajoutés (55 tests). Le moteur a changé : à la mise en ligne, publier aussi le serveur réseau.

## 13/11/2026 · Ultim calés sur leurs records de distance en 24 h (branche `mises-a-jour-jeu`, non publié)
- Demande du porteur de projet : dans les meilleures conditions, bonus compris, un Ultim ne fait pas plus que le record de distance en 24 h de son mode de navigation (Wikipédia) : 851 milles en solitaire (Route du Rhum), 908 milles en équipage (Transat Café L'Or en double, Rolex Fastnet Race au prorata du tour de 4,8 h). Avant, le meilleur tour d'un Ultim faisait 1 530 milles en 23 h (1 597 en 24 h) au Rhum et à la Transat.
- Mesuré (`outils/mesure-max-24h.ts`, nouvel outil : toutes voiles, forces, allures, familles et compétences) : Route du Rhum 27 cases = 810 milles par tour de 23 h (845 en 24 h, la case suivante dépasserait 851), Transat 29 cases = 870 milles (908 en 24 h), Fastnet 71 cases = 181 milles par tour (905 en 24 h). La jauge de chaque course plafonne aussi les cartes « bonne nouvelle ». Toute l'échelle de l'Ultim baisse dans la même proportion (comme pour l'IMOCA le 12/11), l'Arkéa Ultim Challenge garde sa durée.
- Durée des courses (simulation, 20 parties, 4 IA, médiane du vainqueur) : Route du Rhum 9 → 16 tours (cible de la course 12 à 18 ; IMOCA 21 dans la même simulation), Transat Café L'Or 14 → 22 (cible 12 à 18), Rolex Fastnet Race 21 → 18 (cible 13 à 17), Arkéa 18 → 18. **À revoir** : l'usure des voiles et la fréquence des fronts de l'Ultim restent calées sur une course de 7 tours (`tours_moyens`).
- Açores vérifiées : la zone de brume (12 × 9 cases autour de l'archipel, 09/11/2026) coûte le double par case. Même cap, même avance de 20 cases : 14 cases parcourues en la traversant (420 milles), 20 en passant au nord ou au sud. Règle voulue (« dans la brume, on avance moins vite »), mais le tableau de bord annonce les milles sans tenir compte de la brume ; seul l'aperçu du trajet sur la carte s'arrête plus tôt.
- 2 tests ajoutés (53 tests).

## Mise en ligne 10b36b30 (12/11/2026, nuit), serveur réseau d9dc2a52
Avec l'accord du porteur de projet (« corrige et met en ligne ») :
- **Échelle des distances IMOCA et Ocean Fifty, 640 milles en 24 h au plus** : un bord de spi à F7 proposait 720 milles. Toute l'échelle est réduite dans la même proportion (vitesse de classe 1,75 → 1,35) et les tours passent de 28 h à 24 h : le maximum mesuré est 630 milles en 24 h. Vendée Globe recalé (échelle 5,5 → 7,1) pour garder sa longueur.
- **Ocean Fifty** : même échelle que l'IMOCA, moins rapide au près (330 milles contre 390), plus rapide au portant (profil d'allure par angle).
- **Téléphone** : une fenêtre (question, mauvaise réponse) plus haute que l'écran défile désormais ; son bouton Valider ou Fermer est toujours atteignable.

## Mise en ligne 787e37e8 (12/11/2026, nuit), serveur réseau 9176d054
Avec l'accord du porteur de projet (« met en ligne avec la nouvelle interface et les essais réalisés ») :
- **Nouvelle interface** (branche d'essai `essai-interface`, fusionnée dans main) : rose des caps sur la carte autour du bateau, voiles en boutons dessinés en bas, distance maximale réglée sur la carte, journal à droite et masquable, aperçu 3D du bateau sous la voile choisie, scène 3D de la voile devenue inutilisable.
- Angles des voiles : code 0 dès le travers, gennaker dès 112,5°, spi dès 135°. Bon plein plus rapide que le près.
- Planisphère complet sans bande de couleur inversée au nord (contour de l'Eurasie coupé à Béring).
- Louvoyage : plus de saut de deux cases près d'une côte.

## Mise en ligne 1dd25f15 (12/11/2026, soir), serveur réseau 565f9fa3
Corrections demandées par le porteur de projet après essais :
- Bonus et malus en pourcentage (+20 % / −20 % par cran, cumulés) : fin des « toutes les voiles à 90 mn » en Class40 et des écarts ×2 entre allures.
- Alizés : l'écran des dés explique quand la force reste bornée (F3 à F7).
- Carte : plus de pointillés jaunes (parcours obligatoire, lignes de passage) ; zoom 4 fois plus fin ; bateaux 1,3 fois plus grands.
- Vendée Globe et Arkéa Ultim Challenge retirés de la version en ligne (jouables en local).
- Plantage de l'affichage : message avec l'erreur et bouton « Reprendre la partie » au lieu d'un écran noir.

## Mise en ligne 1dea1110 (12/11/2026), serveur réseau 911f3a56 · chacun choisit le niveau de ses questions
Avec l'accord du propriétaire (« Merge and publish ») : branche `mises-a-jour-jeu` fusionnée dans `main`, jeu « Version 0.4.200 ». Vérifié en ligne : essai à deux joueurs sur le serveur publié (mêmes résultats qu'en local) et salon ouvert dans le navigateur (choix du niveau, liste des équipages, choix mémorisé ; faces du dé du large justes sur « Créer une partie »).

- Demande du porteur de projet. Dans le salon d'attente, chaque joueur choisit le niveau de ses propres questions de culture marine (Moussaillon, Skipper, Vieux loup de mer) jusqu'au départ ; la liste des équipages montre le niveau de chacun. Avant, le serveur donnait le niveau 2 à tout le monde. Le choix est mémorisé sur l'appareil et repris à la prochaine partie ; sans choix, niveau 2. Les IA restent au niveau 2.
- Écran « Créer une partie » : les faces du dé du large sont lues dans la configuration (il affichait encore 3-4 pour les questions et 5-6 pour les cartes, au lieu de 2-3 et 4-5-6).
- Vérifié : 2 tests ajoutés (51 tests), et essai du serveur de salons en local avec deux joueurs (niveau mémorisé à l'arrivée, changement de niveau, niveau inconnu refusé, niveaux transmis aux bateaux au départ, plus de changement après le départ).
- **À la mise en ligne, publier aussi le serveur réseau** (le protocole change). Un ancien serveur ignore simplement le nouveau message : tout le monde reste au niveau 2.

## 12/11/2026 · le jeu devient open source
- Demande du propriétaire : le jeu est publié dans le dépôt public https://github.com/AntoineDangy/histoire-des-halfs (dossier `jeu/`), sous licence MIT, et chacun peut le déployer. README réécrit (démarrer, tester, déployer son serveur de salons et son site). L'adresse du serveur de salons se règle à la construction (`VITE_SERVEUR`), le serveur officiel restant la valeur par défaut. Non recopiés : le livret de règles du jeu MB de 1987, les photos de référence des bateaux, les images de travail. Recopie : `outils/open-source/publier.mjs` (à la racine du dépôt privé), qui met à jour tout le dépôt public (site, données, outils et jeu).

## Mise en ligne 44042581 (12/11/2026), serveur réseau inchangé (50ed74b3) · numéro de version à l'accueil
Avec l'accord du propriétaire (« Publish both ») ; vérifié en ligne : « Version 0.4.196 · mise à jour le 12 novembre 2026 à 11 h 59 ». Le site est mis en ligne en même temps (adf6b9f4, « Version 1.0.173 »).
- Demande du porteur de projet : l'accueil de la bêta affiche « Version 0.4.N · mise à jour le … à … h … » sous le titre (heure de Paris). « 0.4 » vient de `jeu/package.json` (passé de 0.1.0 à 0.4.0, après les v0.2 et v0.3 de l'état du projet) ; N est le nombre d'enregistrements git du dossier `jeu/`, il monte tout seul ; la date est celle de la construction. L'enregistrement exact s'affiche au survol. Code : `packages/client/vite.config.ts` et `src/version.ts`. Le site affiche la même chose en bas de son accueil.

## Mise en ligne bb4fc865 (12/11/2026), serveur réseau 50ed74b3 · perte de voile et avaries
Avec l'accord du propriétaire (« publie et mets en ligne ») : tout ce qui suit, jusqu'ici non publié. Vérifié en ligne : nouvelle page des règles, textes des cartes dans le code publié, serveur réseau qui répond. Modèles 3D : les 20 du build étaient déjà en ligne.

- **Avaries durables en part de chaque tour** (décision du porteur de projet) : une avarie qui dure plusieurs tours coûte sa part du barème (25 %, 50 %…) de l'avance prévue à chaque tour, et non plus des milles fixes. **Réparée, elle coûte plus cher sur le tour de la carte (1,5 fois la part, facteur validé par le porteur de projet) et plus rien ensuite.** Avarie d'un tour réparée : la moitié, comme avant. Le risque en plus (quille, crochet de ris) compte ce tour, et les suivants seulement si l'avarie est encaissée. Corrigé au passage : le premier tour d'une avarie durable comptait double. Règles, coach et tableau de bord parlent maintenant de façon générale (« les cartes réparation permettent de limiter l'impact ») ; le chiffre exact est dans la fenêtre de la carte. Le tableau de bord affiche les vraies faces du dé du large (4-5-6 carte, 2-3 question, 1 rien ; il disait encore 5-6 / 3-4 / 1-2). Contrôle du journal : un bateau qui n'a qu'une case d'avance peut rester dans sa case sans anomalie. Document pour les développeurs : `docs/avaries-et-reparations.md`. 49 tests. Simulation au Rhum (20 parties par classe) : IMOCA 13 tours, Class40 18, Ultim 9 (médianes), inchangé à un tour près.
- **Barème des avaries en part du tour** (décision du porteur de projet, après comparaison des situations) : la perte d'une carte ne se compte plus en milles fixes, mais en part de l'avance prévue du tour, la même quels que soient le vent et la course : légère (−1) 25 %, moyenne (−2) et chute à l'eau 50 %, lourde (−3) 75 %, tour perdu 100 % ; **réparée, la perte est divisée par deux**. Voile menacée : endurer = voile perdue et 50 % ; réparer = voile sauvée, tour perdu. Les tours suivants d'une avarie durable restent comptés dans la table des voiles. Avant, une carte légère clouait le bateau par F2 et ne coûtait qu'un quart du tour par F4, et le water-ballast enduré coûtait plus qu'une voile perdue. Cartes, fenêtre de réparation et règles affichent les pourcentages (`perteCarte`, partagé par le moteur et l'écran). Test ajouté (47 tests). Simulation au Rhum : durées inchangées à un tour près par rapport à la version publiée.

- **Règle du porteur de projet** : quand une voile va être perdue en course, on choisit. **Endurer** : la voile est perdue, mais le bateau avance de la moitié de la distance prévue. **Réparer** (carte réparation) : la voile est sauvée, mais le bateau n'avance pas ce tour. S'applique à la case noire d'un monocoque (avant : voile perdue et aucune avance) et à la carte « spi déchiré » (avant : réparée, la voile était gardée avec une demi-avance). Le chavirage d'un multicoque ne change pas.
- **Une avarie réparée ne coûte jamais plus de la moitié de l'avance prévue** (décision du porteur de projet, après une partie où, la carte « Rupture du water-ballast » réparée par F2, son bateau était resté sur place) : la perte d'une carte est une distance fixe (réparée : 4 cases, 120 milles au Rhum en IMOCA) qui effaçait tout le tour par petit temps, quand l'avance fond avec le vent. La voile sauvée par une réparation reste sans avance, par règle. Test ajouté (46 tests).
- Textes mis à jour : fenêtre de choix (boutons « Endurer : perdre la voile, avancer de moitié » et « Réparer : garder la voile, sans avancer » ; texte propre au chavirage d'un multicoque), dé de risque, tableau de bord, règles, coach. Test ajouté (45 tests).

## Mise en ligne 8c9302bd (12/11/2026), serveur réseau 55a82deb
Avec l'accord du propriétaire (« met en ligne ») : le malus du **Navigateur** et du **Météorologue** ne joue plus que pour les **grands changements** (décision du propriétaire). Navigateur : prévision de force juste 9 fois sur 10, −1 case au passage d'une voile de près à une voile de portant ou l'inverse. Météorologue : prévision d'orientation juste 3 fois sur 4, −2 cases pour un virage de 90° et plus. Finesse : +1 case F≤3, −1 case dès F5. Simulations : `conception/competences.md` (Météorologue un peu fort, 32 %). Une même coque menée par plusieurs skippers est acceptée (décision du propriétaire).

## Mise en ligne 139afd34 (12/11/2026), serveur réseau e7b6e84a
- Météo affichée en « vent attendu » et « rotation attendue (non certaine) », y compris dans la description du Navigateur et du Météorologue. Réglage d'équilibre des compétences encore à décider (simulations dans `jeu/reports/`).

## Mise en ligne cd94cb9f (12/11/2026), serveur réseau dd6f857f
Première mise en ligne de tout le travail en cours, avec l'accord du propriétaire (« quand tu as fini… met en ligne ») :
- **Tours du monde** : Vendée Globe (sans escale : une escale technique = abandon) et Arkéa Ultim Challenge, tour de 3 jours, météo mondiale (anticyclones, dépressions, rotation selon l'hémisphère), grands courants.
- **Globe** : on décide sur la carte plate ; pendant la lecture du tour, les bateaux se déplacent sur le globe, puis viennent les scènes 3D du tour, puis retour à la carte plate. Bouton « Vue globe » pour regarder seulement.
- **Météo sur la carte** : petite pastille en haut à droite, girouette animée (rotation par le plus court chemin, filets de vent qui défilent selon la force). Le vent affiché est toujours celui de la zone du joueur (y compris le panneau « En attente »).
- **Tendance du bulletin** (« rotation probable… non certaine ») réservée au Météorologue ; l'aide au choix et l'IA des autres skippers ne s'en servent plus.
- **16 compétences en un mot et 15 skippers par classe** (session « lien site-jeu », commit 1471ae9), prévisions du Navigateur et du Météorologue justes 3 fois sur 4.
- Correction : l'espérance de distance affichée pondère bien chaque jet de dé par sa probabilité.


## Mise en ligne 8b5de487 (12/11/2026), serveur inchangé (c346597e)
Construite depuis la version en ligne (213f54d + Fastnet c06e2d4, anciens skippers), avec seulement ces corrections :
- La scène 3D d'un début de tour (coup de vent, louvoyage) se joue après le dé de risque, plus avant.
- Dé de tempête et dé du pot-au-noir animés comme le dé de risque.
- Le message du haut ne répète plus le journal de bord pendant la lecture d'un tour.
- Téléphone : classement dégagé, échelles au-dessus du bouton « Commandes », boutons de la carte en colonne à droite (plus sous « Valider »).
Non publiés : tours du monde, globe, météo sur la carte, nouveaux skippers et compétences.
## 12/11/2026 · 16 compétences en un mot, 15 skippers par classe (non publié)

- Décision du porteur de projet : **une compétence en un mot** par skipper, liée à ce qu'il est dans la vraie vie, à la place des « traits de caractère ». 16 compétences : Stratège, Navigateur, Météorologue, Finesse, Régatier, Coriace, Bricoleur, Voilier, Glisseur, Grimpeur, Imperturbable, Communicant, Polyvalent, Économe, Attaquant, Prudent, Méticuleux. Plusieurs jouent sur **l'usure et la perte des voiles** (Voilier, Économe, Attaquant, Bricoleur, Méticuleux). Détail, bonus, compromis et justification de chaque skipper : `conception/competences.md`.
- **Navigateur** : estime la force du prochain vent (prévision juste 3 fois sur 4), −1 case à chaque changement de voile. **Météorologue** : connaît la tendance du bulletin et estime l'orientation du prochain vent (juste 3 fois sur 4), −1 case à chaque changement de cap. La prévision s'affiche sur la carte, n'est envoyée qu'au skipper concerné en réseau, et l'IA s'en sert avec la même incertitude.
- **15 skippers en IMOCA, Class40 et Ocean Fifty** (11 en Ultim, 14 légendes) : skippers actuels de la classe d'abord. Ajouts : Violette Dorange, Élodie Bonafous, Sam Goodchild, Benjamin Dutreux (IMOCA) ; Cédric Château, William Mathelin-Moreaux, Fabien Delahaye, Pierre Leboucher, Mélodie Schaffer (Class40) ; Erwan Le Draoulec (Lazare), Léonard Legrand, Laurent Bourguès (La French Fab), Matthieu Perraut, Thomas Rouxel (Ocean Fifty). Eric Péron retiré. Kevin Escoffier n'apparaît pas dans le jeu.
- Années et architectes des bateaux alignés sur la base du site. Textes des compétences neutres (skippers hommes et femmes).

## 12/11/2026 · les traits de caractère remplacent les compétences (non publié)

- Décision du porteur de projet : le trait de caractère de chaque skipper, tiré de son palmarès sur le site, donne seul son bonus et son compromis. 11 traits dans `config/competences.json` (`trait_…`), attribués aux 57 skippers (légendes et hors top 20 calculés par la même méthode).
- Les anciennes compétences étaient déséquilibrées par les changements de règles (10 à 43 % de victoires). Pouvoirs des traits calibrés par simulation (`outils/sim-competences.ts`, nouvelle variable `FILTRE`) : tous entre 19 et 31 % de victoires en IMOCA et en Ocean Fifty (100 parties chacun). Détail : `conception/traits-de-caractere.md`.
- Bateaux : Groupe Dubreuil = ex-11th Hour Racing (2021, Verdier) ; Actual Ultim 3 daté 2015 (même coque que Macif et Actual) ; années complétées depuis la base du site (La Boulangère Bio 2022 ; Crédit Mutuel 2019 ; Wewise 2017) ; adresses des fiches du site complétées pour les IMOCA. Gitana 18 : mise à l'eau le 14 février 2026 (Wikipédia), corrigé dans le jeu et sur le site.
- Écrans : « trait de caractère » au lieu de « compétence » (accueil, règles, choix du co-skipper, hangar, relance du vent).

## 12/11/2026 · mise en ligne (jeu 02908478, serveur c346597e)

Version en ligne précédente (213f54d, sans skippers ni tours du monde) plus les 32 caps du Fastnet et les Scilly dessinées (c06e2d4), avec l'accord du propriétaire. Toujours **sans** les skippers (8a3612d) ni le Vendée Globe et l'Arkéa Ultim Challenge (9752bb4).

## 12/11/2026 · Fastnet : 32 caps sur toute la course, Scilly dessinées (en ligne : jeu 02908478)

- Rolex Fastnet Race : la rosace des demi-caps (32 caps) est disponible du départ à l'arrivée (demande du porteur de projet) ; les autres courses gardent la règle des 500 milles de l'arrivée. Réglage : `regles.json`, `demi_caps.courses`.
- Les îles Scilly sont dessinées sur la carte (leurs cases de terre, en petits octogones) : elles bloquaient le passage sans être visibles, car absentes des côtes au 1:50 m.

## 12/11/2026 · mise en ligne (jeu 01705346, serveur a17c6219)

Version de GitHub (77c370a) **sans** le changement de skippers (8a3612d, en attente) ni les tours du monde (pas encore branchés). Comprend : tour de Basse-Terre par le nord et l'ouest au Rhum (plus de contournement automatique), l'IA qui s'arrête avant la côte, le Fastnet par le nord de Bishop Rock à l'aller (18 tours), la durée d'un tour au briefing, la question du record du Vendée Globe corrigée.

## 12/11/2026 · l'IA réduit sa distance, Fastnet par le nord de Bishop Rock à l'aller (non publié)

- IA : elle peut réduire sa distance maximale pour s'arrêter au meilleur point (avant la côte) ; fini les bateaux bloqués plusieurs tours près de l'arrivée (Rhum : 5 tours au pire de la Tête à l'Anglais à l'arrivée, 12 avant).
- Rolex Fastnet Race : passage obligatoire au nord de Bishop Rock à l'aller, au sud au retour (parcours officiel) ; DST inchangés. Durée simulée : 18 tours (cible 15), à recaler.

## 12/11/2026 · skippers du jeu = top 20 de leur classe (non publié)

- Règle du porteur de projet (11/11) : les skippers du jeu sont ceux du top 20 2021-2026 de leur classe, qui ont un trait de caractère (`donnees/traits_marins.csv`). Les femmes déjà dans le jeu sont gardées. Comparaison : `controles/2026-11-11/skippers-jeu-top20.md`.
- Jean Le Cam et son IMOCA à dérives restent (décision du porteur de projet : s'il sort un jour, il ira en skipper de légende). Paul Meilhat (Biotherm, FRA 2030) est ajouté en 11e IMOCA, « Skipper Blanc », sans compétence en attendant son trait.
- 6 skippers remplacés, à la même place (couleurs, nom générique et compétence provisoire repris) : Greg Leonard → Ambrogio Beccaria (Alla Grande-Pirelli) ; Aymeric Chappellier → Frans Budel (Sec. Hayai) ; Matthieu Perraut → Sébastien Rogues (Primonial) ; Erwan Le Draoulec → Oren Nataf (Rayon Vert) ; Laurent Bourguès → Eric Péron (Komilfo) ; Léonard Legrand → Gilles Lamire (Groupe GCA - Mille et Un Sourires). Bateaux, architectes, années et numéros pris dans la base du site.
- Lien d'Actual Ultim 3 vers le site corrigé (`ultim/actual-leader-2`, et non le Maxi Edmond de Rothschild).

## 12/11/2026 · plus de contournement automatique, tour de Basse-Terre par l'ouest (non publié)

- Contournement automatique retiré (décision du porteur de projet) : une marque franchie, le bateau garde son cap ; la côte l'arrête, même près de l'arrivée. L'aperçu de route ne part plus du mauvais côté de l'île.
- Route du Rhum : après la Tête à l'Anglais, ligne invisible à l'ouest de Basse-Terre : on contourne la Guadeloupe par le nord puis l'ouest avant d'arriver.
- 44 tests ; simulation 20 parties : vainqueur en 14 tours (médiane, 12 avant).

## 12/11/2026 · arrivée du Rhum simplifiée (non publié)

- Route du Rhum : la Tête à l'Anglais, bouée cardinale nord juste au nord de Basse-Terre (passer au nord), puis la zone d'arrivée entre le sud de la Guadeloupe et le nord de la Dominique ; les deux anciennes marques (ligne à l'ouest de Basse-Terre, bouée de Vieux-Fort) sont retirées.
- Carte : arrivée dessinée comme un point jaune à damier léger et fondu, à la taille de la zone (on voit les îles dessous) ; route directe blanche Saint-Malo → bouée → Pointe-à-Pitre au lieu du parcours en pointillés jaunes.
- 44 tests ; simulation 20 parties : vainqueur en 12 tours (médiane, comme avant).

## 11/11/2026 (nuit, 9) · 32 caps à l'approche de l'arrivée, en essai (non publié)

- À moins de 500 milles de l'arrivée, une rosace apparaît à l'intérieur de la rose des caps : 16 demi-caps entre les 16 caps (pas de 11,25°), aux noms marins (N¼NE = Nord quart Nord-Est). Au large, la rose ne change pas.
- Distance d'une voile à un demi-cap : moyenne exacte des deux allures voisines ; voile inutilisable si l'une des deux l'est. Allure affichée « entre le largue et le grand largue ».
- L'IA essaie aussi les demi-caps dans la zone. Réglage : `demi_caps.milles_arrivee` dans `config/regles.json`. 44 tests.

## 12/11/2026 · retour à l'accueil, distance max, gîte des multicoques

**Mis en ligne le 12/11/2026 : jeu afa9d624, serveur 6d6a3f20.** Comprend aussi les voiles d'époque des bateaux de légende, l'arrivée du Rhum (Tête à l'Anglais, zone d'arrivée à damier, route directe) et les 32 caps près de l'arrivée, validés par le porteur de projet.

- Hangar et règles : le bouton « ← Accueil » reste toujours visible en bas de l'écran.
- Tableau de bord : « Distance max » juste sous le choix des voiles, avant l'explication des risques.
- 3D : l'Ocean Fifty, l'Ultim non volant et les multicoques de légende gîtent de 15° (force 3) à 30° (force 7), 30° au plus.

## 11/11/2026 (nuit, fin, 12) · voiles d'époque des bateaux de légende (non publié, à valider)

- Calées sur les photos du porteur de projet (Écureuil d'Aquitaine II, Aquitaine Innovations, Groupama, Foncia).
- Génois : amuré à l'étrave, têtière presque en tête de mât, point d'écoute bas, à peu près à l'aplomb du mât (au lieu du solent moderne). Génois léger : un peu plus grand, bordure au ras du pont (au lieu du code 0 à point d'écoute haut).
- Grand-voile : tête pointue jusqu'en 1997, petite tête carrée à partir de 1998 (Groupama, PRB) ; surface portée par le rond de chute, modéré avant 1985, marqué ensuite (grand-voiles lattées). Aussi pour Pen Duick III.
- Couleur des voiles d'avant : tergal blanc avant 1985, génois en Kevlar doré de 1985 à 1994, Mylar crème ensuite ; les multicoques de légende n'ont plus de voiles noires (carbone). Plan de voilure du hangar en voiles claires pour tous les bateaux de légende.

## 11/11/2026 (nuit, fin, 11) · vent de sa zone, alizés bornés, spi de gros temps au hangar (publié : jeu 38d3299c, serveur 5b0259e4, sans les 32 caps)

- Écran des dés et bandeau : le joueur voit le vent de SA zone (vent général, alizés, front, traîne, molle, anticyclone), avant et après les dés ; le vent d'une zone où il n'est pas ne s'affiche plus. En même écran, les autres joueurs humains sont listés dessous. Le moteur transmet le vent local de chaque bateau avec l'événement « vent ».
- Alizés : hémisphère nord, du Nord à l'Est ; hémisphère sud, du Sud à l'Est (90° au plus). Cartes de la Route du Rhum et de la Transat Café L'Or régénérées. Simulation : IMOCA 12 tours (inchangé), Class40 16.
- Hangar : spi de gros temps pour les monocoques, avec sa forme 3D (plus petit, hissé plus bas, plus plat). Surfaces estimées.

## 11/11/2026 (nuit, fin, 10) · voiles d'avant de l'Ultim (publié le 11/11 à la demande du porteur de projet, jeu 1d0a75a0 ; serveur inchangé ; toujours sans l'essai des 32 caps)

- Ultim (volant et ancienne génération) : code 0, gennaker et spi ne sont plus réglés sur la longueur de coque (32 m, très longue pour le mât), mais sur la hauteur du mât comme l'IMOCA. Le point d'écoute revient vers le milieu du bateau au lieu du tableau arrière. Les voiles suivent la bôme quand le bateau abat, et ne recouvrent plus la grand-voile (écart de 13 à 21°). Ordre des tailles respecté.

## 11/11/2026 (nuit, fin, 9) · multicoques de légende, boutons Valider (publié le 11/11 à la demande du porteur de projet, jeu dfe2fa84, serveur 9470778a ; sans l'essai des 32 caps, laissé de côté à sa demande)

- Multicoques de légende redessinés : générateur Blender `jeu/outils/blender/vintage_multi.py`, cotes sourcées (section « multicoques » de `modeles-vintage.json`, valeurs estimées listées). Trimarans à bras droits ou profilés, filets, mât-aile (mât à barres de flèche pour Fauve), dérives ; Jet Services V en catamaran (trois bras, mât sur le bras central). Rendus : `jeu/conception/multicoques-legende-rendus.png`. Validés par le porteur de projet le 11/11.
- Bouton « Valider » de la carte remonté au-dessus des boutons de zoom, qu'il cachait.
- Écrans de préparation (réglages, choix des skippers, salon réseau) : la barre « Retour / Valider » reste visible en bas de l'écran.

## 11/11/2026 (nuit, fin, 8) · les voiles d'avant suivent la grand-voile, tutoriel (publié le 11/11 à la demande du porteur de projet, jeu 3167acf9 ; serveur inchangé ; un premier envoi, cd732e11, contenait par erreur un travail en cours d'une autre session et a été remplacé quelques minutes plus tard)

- IMOCA et Class40 : quand le bateau abat, la bôme s'ouvre et le point d'écoute du code 0, du gennaker et du spi tourne autour du mât pour rester devant la grand-voile (écart d'au moins 7 à 18°). Au largue et au vent arrière, le spi ne touche plus la grand-voile (remarque du porteur de projet). Contrôlé au hangar.
- Tutoriel mis à jour selon les règles en vigueur : dé du large (1 rien, 2-3 question, 4-6 carte), case noire, réparation qui réduit l'avarie de moitié, voiles grisées, vent jusqu'à la tempête, marques de parcours (Guadeloupe à bâbord), bouton « Valider » sur la carte, départage des arrivées au même tour.

## 11/11/2026 (nuit, fin, 7) · Guadeloupe à bâbord, contournement, voiles 3D (publié le 11/11 à la demande du porteur de projet, jeu 3b3bcb62, serveur 9efb5fd7)

- Route du Rhum : arrivée par le nord, Guadeloupe laissée à bâbord (ligne invisible à l'ouest de Basse-Terre, bouée de Vieux-Fort).
- Contournement automatique : une marque franchie, le bateau file vers la suivante dans le même tour ; à moins de 500 milles de l'arrivée, un bateau arrêté par la côte la contourne.
- Voiles d'avant 3D redessinées dans l'ordre réel des tailles (code 0 < gennaker < spi), surfaces proches du plan réel de l'IMOCA. Class40 : code 0 118 m².

## 11/11/2026 (nuit, fin, 6) · règles à jour et vent jusqu'à F11 (publié le 11/11 à la demande du porteur de projet, jeu ef689b66, serveur 9c20c088)

- Règles de l'accueil et briefing alignés sur les décisions du 11/11 (dé du large, voiles, priorité, courants, pot-au-noir, DST, Fastnet, classes, jauge, départage, ligne d'arrivée).
- Le dé de force n'est plus borné à F8 : vent général jusqu'à F11, dé tempête de F9 à F11. Simulation : environ 3,5 chavirages d'Ultim par course.

## 11/11/2026 (nuit, fin, 5) · départage et ligne d'arrivée (publié le 11/11 à la demande du porteur de projet, jeu f1181b05, serveur 57ad9f18)

- Arrivées au même tour : départage au taux de bonnes réponses au quiz, puis au nombre de bonnes réponses, puis au moins de milles parcourus.
- Scène 3D du passage de la ligne : bouée jaune, bateau comité à moteur, ligne de flotteurs ; tous les arrivés du tour, dans l'ordre du départage.

## 11/11/2026 (nuit, fin, 4) · jauge de distance IMOCA et Ocean Fifty (publié le 11/11 à la demande du porteur de projet, jeu fd6af195, serveur e105e421)

- Transatlantiques : 640 milles en 24 h au plus, bonus compris (24 cases par tour de 28 h). Fastnet non concerné. Simulation de 6 Rhum : médiane 12 tours pour les deux classes.

## 11/11/2026 (nuit, fin, 3) · bouton Valider et dé en réseau (publié le 11/11 à la demande du porteur de projet, jeu 3ccc7194)

- Bouton Valider toujours visible, posé sur la carte (ordinateur et téléphone), grisé tant que les choix manquent.
- Réseau : seul le joueur concerné lance le dé du large ; chez les autres, il roule tout seul.

## 11/11/2026 (nuit, fin, suite) · spi et gennaker à l'échelle (publié le 11/11 à la demande du porteur de projet, jeu f6894725)

- 3D des monocoques : spi et gennaker n'étaient plus proportionnés (triangle étiré pour atteindre la surface). Bordure bornée à 0,6 × longueur, point d'écoute au niveau du pont vers l'arrière, creux réduit. Contrôlé dans le hangar (IMOCA).

## 11/11/2026 (nuit, fin) · une seule marque au Fastnet (publié le 11/11 à la demande du porteur de projet, jeu 4bb5e90d, serveur 2095c1f7)

- Fastnet : seule la bouée du phare est dessinée (« à laisser à bâbord »), cochée une fois le tour complet. Les lignes de contrôle nord et sud restent exigées par le moteur, invisibles (champ `cachee`), et ne figurent plus au briefing ni dans le choix de la course.

## 11/11/2026 (nuit, suite) · gennaker et Ocean Fifty (publié le 11/11 à la demande du porteur de projet, jeu d1a4a97f, serveur ec1b7ee5)

- Gennaker proposé au bon plein (67,5°) en Ultim : l'angle intermédiaire reprenait la valeur du travers moins 1. Chaque voile de portant a désormais un angle minimal : gennaker à partir du travers (90°), spi et spi de gros temps à partir de 112,5°. Le code 0 reste possible au bon plein.
- Ocean Fifty aligné sur l'IMOCA (demande du porteur de projet : même durée de course, même distance par tour) : vitesse 1,75 et tours de 28 h (au lieu de 2,05 et 25 h) ; au Fastnet, même réglage que l'IMOCA. Simulation au Rhum (6 courses) : médiane de 12 tours pour les deux classes.

## 11/11/2026 (nuit) · DST de la sortie de Manche, position exacte des bateaux (publié le 11/11 avec l'accord du porteur de projet, jeu d470132d, serveur f6fb4eff)

- DST à leur vraie place (d'après la carte fournie par le porteur de projet) : carte du Fastnet, DST d'Ouessant au nord-ouest d'Ouessant et trois rails des Scilly (ouest, sud, Land's End) ; carte du Rhum et de la Transat Café L'Or (cases de 30 milles), une case pour le DST d'Ouessant au nord-ouest de l'île, passage côtier laissé libre (les rails des Scilly, plus fins qu'une case, fermaient la Manche).
- Bug des « crochets » en fin de déplacement corrigé : le bateau restait affiché au centre de sa case et glissait du point exact où il s'arrêtait vers ce centre. Il garde maintenant sa position exacte (`pos`), d'où il repart au tour suivant.
- Bateau dessiné dans le sens réel de sa marche (dernier tronçon de sa trace), points de trace en double supprimés.
- À surveiller : au Fastnet, les DST des Scilly et de Land's End allongent la course (un essai IMOCA à 27 tours au lieu d'environ 19).

## 11/11/2026 (soir) · déplacements sans décalage (publié le 11/11 avec l'accord du porteur de projet, jeu d1f41efa, serveur abba82c8)

- Sur la carte, le bateau avance le long du trajet réellement suivi (bords de louvoyage, dérive du courant) ; un déplacement pas encore joué n'est plus dessiné à l'avance (fini la ligne droite).
- Priorité intégrée au déplacement : hors brume, le bateau qui arrive sur une case occupée s'arrête sur la dernière case libre de son trajet ; plus de déroutement après coup.
- Défaut connu : au départ de Cowes (Solent), quelques courts morceaux de trace passent sur la terre en Ultim (défaut antérieur, 6 sur 370 segments).

## 11/11/2026 (fin) · interface téléphone (publié le 11/11 avec l'accord du porteur de projet, jeu 485effc8)

- En-tête repliable (bouton ☰ / ✕) : replié par défaut sur téléphone, il ne garde que le tour et « Passer l'animation » (43 px au lieu de 123).
- Commandes du bateau : une croix pour les masquer, un bouton « ⛵ Commandes » sur la carte pour les rouvrir.
- Bouton « Valider » posé sur la carte dès que le cap et la voile sont choisis, même commandes masquées.
- Dé du large : la fenêtre ne déborde plus de l'écran ; sa légende suit la règle en vigueur (4-5-6 carte, 2-3 question, 1 rien).

## 11/11/2026 (suite) · Fastnet à bâbord, louvoyage par la mer, courant intégré (publié le 11/11 avec l'accord du porteur de projet, jeu c9209e80, serveur b339e6f0)

- Fastnet Rock : tour complet imposé, rocher laissé à bâbord (nord, ouest, sud), vérifié par simulation.
- Louvoyage : le moteur fait suivre au bateau les bords en zigzag de l'aperçu, par la mer ; l'aperçu dessine exactement ce trajet ; la trace aussi.
- Courant : dérive intégrée au déplacement, plus de recul ou de décalage après coup. Contrôle des traces (`outils/controle-marques.ts`) : 0 segment sur la terre au Fastnet, 1 sur 200 au Rhum (raccord en fin de tour près d'une côte, défaut antérieur).

## 11/11/2026 · jouabilité et téléphone (publié le 11/11 à la demande du porteur de projet, jeu c82f85ff, serveur 3c0ddf34)

- Moteur : dé du large 1 / 2-3 / 4-6, carte réparation qui divise l'avarie par deux, pot-au-noir (arrêt au milieu, dé pair pour repartir), fronts et anticyclones qui évoluent avec les dés, vent de départ au hasard, priorité au bateau déjà en place, spi de gros temps des monocoques, trace des bords de louvoyage.
- Rolex Fastnet Race : le rocher devient une case de terre et doit être contourné (deux lignes, ouest puis nord) ; des bateaux passaient entre le rocher et la côte. Outil de contrôle : `outils/controle-marques.ts`.
- Interface : journal de bord défilant, dé du large lancé par le joueur, voiles interdites par le vent grisées, carte toujours visible sur téléphone avec commandes superposées, silhouettes fines des monocoques, voile perdue toujours montrée en 3D, Ultim qui volent, gîte des Ocean Fifty et Ultim non volants.
- Contenu : 18 cartes du large (12 histoires neutres), 32 questions.

## 11/11/2026 · les 7 monocoques Vintage modélisés (publié le 11/11 avec l'accord du porteur de projet, jeu f3551dae)

- **Recherche préalable** (demande du porteur de projet : des photos de chaque bateau avant toute modélisation) : `conception/vintage-references.md` et `conception/references/vintage/` (17 photos libres de Wikimedia Commons, auteurs et licences cités ; dimensions sourcées). Pour les bateaux sans photo libre, photos non libres en simple référence visuelle, jamais stockées (décision du porteur de projet).
- **Un seul générateur Blender** (`outils/blender/vintage_mono.py`), réglé bateau par bateau par `packages/data/config/modeles-vintage.json` : la même fiche de cotes sert au modèle 3D, au gréement et aux voiles du jeu, et au plan de voilure du hangar (valeurs sources et valeurs estimées signalées). Modèles : Écureuil d'Aquitaine II, Bagages Superior, PRB, Groupe Sceta, Crédit Agricole (forme générique de 1982, faute de photo libre), Aquitaine Innovations (mât-aile et écarteurs de pont), Roaring Forty.
- **En 3D** (`buildMonoVintage`) : coque, rouf, quille à bulbe (aileron long en 1982), un ou deux safrans, bout-dehors, mât ou mât-aile avec barres de flèche ou écarteurs, bôme animée ; spi symétrique sur tangon pour les bateaux sans bout-dehors, gennaker sur le bout-dehors sinon ; démâtage et naufrage de l'échelle de Beaufort. Chaque monocoque de légende a désormais son modèle dans le hangar et en course (champ `modele_3d`).

## 11/11/2026 · vent : à F1, le dé ne baisse plus (publié le 11/11 avec l'accord du porteur de projet, jeu b0db0214, serveur dc49b144)

- **Règle du porteur de projet appliquée** (« à F1, pas de baisse », notée dans `conception/refonte-risque-et-vent.md` mais jamais codée) : quand le vent général est à F1, le dé de force n'a plus de face négative (+2, +1, 0, 0, +1, +2) ; avant, il affichait −2 et le vent restait collé à F1. Le prévisionnel du tableau de bord et l'IA utilisent le même dé (`facesForce`). Mesure sur 60 courses : F1 passe de 13 % à 8 % du temps, la plus longue période de petit temps de 12 à 8 tours. Test ajouté (40 tests).

## 11/11/2026 · les bateaux ne coupent plus par la terre (publié le 11/11 avec l'accord du porteur de projet, jeu b0db0214, serveur dc49b144)

- **Correction signalée par le porteur de projet** : en sortant du Havre, des bateaux passaient sur le Cotentin. Les cases de la Route du Rhum et de la Transat font 30 milles ; une case n'était terre que si 5 de ses 9 points de contrôle l'étaient, si bien qu'une presqu'île ou un cap plus étroits qu'une case restaient « en mer ». Désormais, chaque case de mer qui touche une côte porte un **relevé fin de la terre** (16 sous-cases, d'après le vrai tracé des côtes ; `terre_fine` dans les cartes, régénérées) : le trajet du bateau s'arrête au bord de la terre (contrôle tous les huitièmes de case), le calcul des distances (IA, parcours obligatoire), le courant et la règle de priorité en tiennent compte. Le centre de chaque case de mer reste libre (départs, ports, arrivée).
- **Trace et animation** : elles passent par le point exact où s'arrête la ligne droite, au lieu de relier directement les centres des cases (ce raccourci rognait aussi la côte). Contrôle sur 6 Transat Café L'Or en Ocean Fifty : 13 segments de trace sur 242 passaient sur la terre, il n'en reste que 3 sur 400, de simples frôlements d'environ un mille.
- Tests : un bateau ne traverse jamais la terre depuis les départs du Havre et de Saint-Malo, quel que soit le cap (39 tests).

## 10/11/2026 (nuit) · briefing de départ en schémas (publié le 10/11 avec l'accord du porteur de projet, déploiement a2f34805)

- **Briefing avant le départ** refait à la demande du porteur de projet (« personne ne lit ça avant d'aller sur l'eau », « plus de schéma, moins de texte ») : une ligne d'accroche par course de légende (Route du Rhum 1978 gagnée à 98 secondes, route du café, Fastnet depuis 1925) et la monture selon la classe ; **schéma du parcours** (départ, passages obligés de la classe, arrivée) ; **le tour de jeu en quatre pictogrammes** (cap + voile, le vent tourne, le dé du large, on avance) ; trois vignettes (F3 ça file, F8 ça casse, face au vent on tire des bords) ; double et deux classements signalés. Bouton « Larguez les amarres ! ». Le détail reste dans les règles et le hangar.

## 10/11/2026 (nuit) · Vintage : deux classements, monocoques et multicoques (publié le 10/11 avec l'accord du porteur de projet, jeu a2f34805 et serveur 40740226)

- Décision du porteur de projet : monocoques et multicoques de légende courent dans la même flotte, mais avec **un classement par catégorie** (comme Rhum Mono et Rhum Multi). Moteur : catégorie du bateau (`categorie`, `categoriesPartie`, `classementCategorie`), vainqueur annoncé dans chaque catégorie (`vainqueurs`), la course se termine quand chaque catégorie a son vainqueur (ou n'a plus de bateau en course), message de fin avec les deux vainqueurs. Écran de course : classement en deux listes ; écran d'arrivée : un podium et un tableau par catégorie ; configuration et briefing l'expliquent. Test ajouté (38 tests).

## 10/11/2026 (nuit) · scènes 3D de 10 secondes (publié le 10/11 avec l'accord du porteur de projet, déploiement 132206e9)

- **Scènes 3D de course : 10 secondes** à la vitesse normale (au lieu d'environ 4 s ; ×2 et ×4 les raccourcissent toujours), avec une barre de temps et un bouton **« Passer la scène »** qui reprend aussitôt le déroulé du tour (demande du porteur de projet). Le bouton « Passer l'animation » de l'en-tête passe toujours tout le tour.

## 10/11/2026 (nuit) · corrections après les essais du porteur de projet (publié le 10/11 avec l'accord du porteur de projet)

- **Spi par force 8 : injustice corrigée.** Un monocoque « robuste » (monocoque de légende, IMOCA à dérives, Class40) faisait passer son spi de « casse assurée » à « risque très élevé », qui ne coûte plus que de l'usure : Titouan Lamazou (IA) gagnait au Fastnet sous spi par F8, quand Éric Tabarly (« Dur au mal ») restait en casse assurée. Désormais, **une voile que la table donne en casse assurée le reste**, quels que soient les bonus ; la robustesse aide toujours pour les autres voiles (solent par F7-F8 : 4 → 3). Test ajouté.
- **Carte du Fastnet élargie vers l'ouest** (13,2° W au lieu de 10,8° W, cases de même taille) : le bord de la carte, à 46 milles du Fastnet Rock, coupait les bords de près vers le sud-ouest. Sur la carte, un bord de 112 milles paraissait plus court qu'un louvoyage de 69 milles, et le bateau s'arrêtait vraiment au bord.
- **Louvoyage** : la règle des 60 % est conservée (décision du porteur de projet). Il est désormais calculé sur la distance au près telle qu'elle est affichée (arrondie à la case), pour que les deux chiffres montrés la respectent toujours. Test ajouté.
- **Fastnet : durée de l'IMOCA recalée** (demande du porteur de projet) : réglage de classe 1,35 au lieu de 1,15 ; simulation (30 courses) : médiane 15 tours, au lieu de 18 sur la carte élargie. Autres classes (24 courses) : Ultim 16, Ocean Fifty 16, Class40 15, Vintage 16. Route du Rhum inchangée : IMOCA 10, Ultim 7, Ocean Fifty 9, Class40 15, Vintage 12.
- **Pen Duick III : spi symétrique** (vues de référence fournies par le porteur de projet) : têtière en pointe en tête du mât de misaine, deux points d'écoute symétriques, guindant et chute bombés, bordure courbe, toile très creuse ; amuré au bout d'un tangon de 5,8 m, avec bras et écoute ; têtière collée en tête du mât de misaine et toile plus creuse (remarque du porteur de projet) ; surface du plan de voilure (110 m² pour le spi de brise, 140 m² pour le spi, estimées). Plan de voilure 2D : spi amuré au tangon.

## 10/11/2026 (soir) · classe Vintage, Pen Duick III gréé, « Ton hangar à bateaux » avec une échelle de Beaufort par bateau (publié le 10/11 avec l'accord du porteur de projet)

- **Classe Vintage jouable** sur la Route du Rhum et la Rolex Fastnet Race (pas sur la Transat Café L'Or) : 14 bateaux de légende et leurs skippers, sourcés dans la base du site (année, architecte, et une course du palmarès qui prouve le skipper : Tabarly sur Pen Duick III, Lamazou, Gautier, Desjoyeaux, Auguin, Jeantot, Parlier, Kleinjans, Bourgnon, Pierre Antoine sur Olmix, Poupon, Maurel, Madec, Cammas). **Deux familles** (décision du porteur de projet) : monocoques de légende (effets de l'IMOCA à dérives) et multicoques de légende (effets du trimaran de 50 pieds). Compétences et réglages **provisoires, à valider**.
- Moteur : monocoques et multicoques courent ensemble ; la case noire et le dé tempête donnent un chavirage ou un démâtage selon le bateau (famille), et non plus selon la classe.
- Réglages : 12 tours de 28 h au Rhum (vitesse 1,45) ; Fastnet à 15 tours visés (réglage de classe 1,3). Simulation (`outils/sim-vintage.ts`, 40 courses, 4 monocoques contre 4 multicoques) : Rhum médiane 12 tours, victoires 40 % monocoques et 60 % multicoques ; Fastnet médiane 16 tours, 48 % et 53 %.
- **Pen Duick III gréé en goélette** : deux mâts de même hauteur (tirant d'air 18,80 m, bateaux.com ; le modèle Blender est corrigé, il avait 15,5 m estimés), deux bômes animées, grand-voile et misaine lattée en tergal blanc, foc, génois et spis. Plan de voilure : 152 m² au près (Wikipédia), misaine de 36 m² et grande misaine à wishbone de 93,60 m² (bateaux.com) ; grand-voile et génois estimés pour retrouver les 152 m². La grande misaine n'est pas dessinée (forme inconnue).
- Chaque bateau Vintage pourra avoir son modèle 3D (champ `modele_3d`, chargé à la demande) ; en attendant, monocoques sur le modèle de l'IMOCA à dérives et multicoques sur celui de l'Ocean Fifty, signalés « provisoire » dans le hangar.
- **« Ton hangar à bateaux »** (nouveau nom, seul bouton gardé sur l'accueil) : l'écran Beaufort de l'accueil et le volet Beaufort avec un IMOCA sont retirés ; **chaque bateau a son échelle de Beaufort** dans sa vue 3D (curseur F0 à F12, voilure adaptée au type : monocoque, goélette ou multicoque, démâtage et naufrage d'un monocoque, chavirage d'un multicoque). **Nuages** dans le ciel 3D : quelques cumulus blancs par beau temps, ciel chargé et gris, puis plafond bas et noir dans la tempête ; ils défilent avec le vent. On choisit le bateau montré parmi ceux de la famille.
- **Logo de la classe Ocean Fifty** en tête de grand-voile des Ocean Fifty (redessiné d'après le logo fourni par le porteur de projet).
- Correction : numéros et marquages des grand-voiles étaient en miroir ; ils se lisent à l'endroit des deux côtés.
- Hangar : le panneau ne déborde plus à droite (tableaux à la largeur du panneau), commandes de la vue 3D sous la scène.

## 10/11/2026 · plan de voilure et échelle de Beaufort plus visibles (publié le 10/11 avec l'accord du porteur de projet)

- Le porteur de projet ne trouvait ni l'échelle de Beaufort ni le plan de voilure : bouton « L'échelle de Beaufort en 3D » sur l'accueil (écran dédié) ; dans le hangar, volet Beaufort ouvert d'emblée.
- **Plan de voilure dessiné** dans la fiche de chaque bateau du hangar : profil (coque, mât, bôme, bout-dehors), grand-voile à tête carrée et voile d'avant choisie, avec surfaces en m², voiles estimées signalées et source.
- Accueil : présentation à jour (Route du Rhum, Transat Café L'Or, Rolex Fastnet Race).
- Carte : silhouette du Class40 plus fine (demande du porteur de projet), étrave en pointe comme le modèle 3D.

## 10/11/2026 · Rolex Fastnet Race (publiée le 10/11 avec l'accord du porteur de projet)

- **Nouvelle course : Rolex Fastnet Race**, parcours 2025 (rolexfastnetrace.com, Figaro Nautisme) : Cowes, Needles, Manche, Land's End, mer Celtique, tour du Fastnet Rock, retour au sud des Scilly (Bishop Rock), arrivée à Cherbourg ; 702 milles sur la carte pour 695 officiels.
- **Nouvelle carte** Bretagne, Irlande, Angleterre (cases d'environ 2,5 milles), côtes réelles ; îles Scilly ajoutées à la main (absentes des côtes au 1:50 m).
- **Météo propre à la zone** : courants de marée qui s'inversent à chaque tour (Needles, Portland Bill, Start Point, Lizard, Land's End, raz Blanchard), brume des Scilly, rails de navigation interdits (Land's End, Casquets), vent dominant de sud-ouest et dépressions atlantiques. Positions stylisées.
- **15 tours en moyenne quelle que soit la classe** (demande du porteur de projet) : sur cette course, toutes les classes ont la même durée de tour (4,8 h, soit environ 3 jours) ; un réglage par classe, calé par simulation, compense leurs effets propres. Simulation (8 courses par classe, médiane du vainqueur) : IMOCA 16, Ultim 16, Ocean Fifty 15, Class40 14 tours.
- Moteur : courants de marée alternés, vitesse unique par course ; générateur de cartes paramétrable (cadre, finesse, échelle, îles ajoutées, marques communes à toutes les classes).
- Correction : les distances en milles (classement, récapitulatif, journal, cartes du large, fin de course) utilisaient l'échelle de la Route du Rhum quelle que soit la course ; elles suivent maintenant la course jouée.

## 10/11/2026 · plans de voilure réalistes et échelle de Beaufort en 3D (publié le 10/11 avec l'accord du porteur de projet)

- **Plans de voilure de tous les bateaux** (`packages/client/src/jeu/voilure.ts`) : chaque voile est dessinée à sa vraie surface. Grand-voile à tête carrée et rond de chute sur la vraie bôme, avec ris ; tourmentin, J3, solent, code 0, gennaker et spi amurés au bon endroit (étai intérieur, étrave, bout-dehors), point d'écoute calculé pour la surface. Surfaces : IMOCA (grand-voile 160-180, J2 100-110, code 0 ≈ 200, spi ≈ 400 ; Figaro Nautisme), Macif 2011 (300 au près, 550 au portant ; VPLP), Banque Populaire XI (GV 310, J0 450, J1 250, J2 180, J3 60 ; fiche officielle), IDEC Sport (411/678 ; Wikipédia), Ocean Fifty (≈ 200/250-265, GV ≈ 100 ; VPLP, bateaux.com), Class40 (115 au près ; jauge) ; tourmentin, J3 et voiles de portant du Class40 et de l'Ocean Fifty estimés. Contrôle : `outils/mesure-voilure.ts` (écart de 0 à 5 %).
- Dans le jeu, « J3 » montre un vrai J3 et « Voilure réduite » un tourmentin avec deux ris ; le hangar propose les six voiles.
- **Échelle de Beaufort en 3D** dans le hangar : curseur de force 0 à 12, mer et ciel correspondants, fiche (vent en nœuds et km/h, vagues, état de la mer, avis météo) ; un IMOCA réduit sa toile (code 0, gennaker, solent, ris, J3, tourmentin, à sec de toile), démâte à F11 (le mât casse et tombe à l'eau) et sombre à F12. Sources : Met Office, Environnement Canada, seuils de Météo-France ; voilure indicative.
- L'Ultim ancienne génération a son mât de 33,5 m (IDEC Sport) dans le jeu.

## 10/11/2026 · Pen Duick III en 3D, premier bateau Vintage (non publié, pas encore dans le jeu)

- `outils/blender/penduick3.py` → `pen_duick_3.glb`. Cotes Wikipédia : 17,45 m hors tout, 13 m à la flottaison, 4,21 m, tirant d'eau 2,75 m, 13,5 t, goélette marconi en aluminium (Éric Tabarly, chantiers de la Perrière, 1967). Photos libres récentes (Wikimedia Commons, 2019-2025) : coque noire basse, pont clair, élancements, deux mâts de hauteur voisine (misaine à 6 m de l'étrave, grand mât à 11 m ; hauteur 15,5 m estimée sur photo), petit rouf, cockpit arrière. Quille et safran estimés (non visibles). Pas encore branché : la classe Vintage et le gréement à deux mâts restent à créer dans le jeu.

## 10/11/2026 · flotte 3D complète (publiée le 10/11 avec l'accord du porteur de projet : Ultim, Ultim ancienne génération, IMOCA à foils et à dérives, Ocean Fifty, Class40)

## 10/11/2026 · modèle Blender de l'Ultim, première version (non publié)

- `outils/blender/ultim.py` : plateforme d'Ultim volant (coque centrale 32 m, flotteurs 28,5 m, largeur 23 m, bras en arche profilés, filets, rouf vitré, cockpit), d'après la jauge Ultim 32/23 et le prototype 3D validé, relue sur photos libres de Wikimedia Commons (CC BY-SA 4.0 : SVR Lazartigue, Gitana 17, Banque Populaire XI, Sodebo Ultim 3). Rendus de contrôle : `conception/rendus-blender/ultim-*.png`.
- Appendices, mât et bôme modélisés (demande du porteur de projet) : foils en C sous les flotteurs (forme relevée sur une photo de Banque Populaire XI chaviré), trois safrans et dérive centrale à plan porteur en T, mât-aile à barres de flèche, bôme, bout-dehors. Pièces séparées, accrochées aux éléments animés du jeu (foil au vent relevé, mât et bôme qui pivotent). Cotes exactes non publiées : proportions estimées sur photos.
- Branché dans le hangar et la vue 3D (Ultim volant) ; l'Ultim ancienne génération garde le modèle du code.
- Design de référence : **Maxi Banque Populaire XI** (décision du porteur de projet). Cotes de la fiche officielle (voile.banquepopulaire.fr) : flotteurs de 32 m (fins, en lame), casquette de 12 m, foils de 9 m, dérive en T de 5 m, trois safrans à plan porteur ; pas de bout-dehors (voiles d'avant amurées à l'étrave) ; têtes des safrans de flotteur au-dessus du pont ; bras en arche marquée.
- **Ultim ancienne génération** sur le design d'**IDEC Sport** (ex-Groupama 3 ; décision du porteur de projet). Cotes Wikipédia : 31,5 m × 22,5 m, tirant d'eau 5,70 m, mât de 33,5 m. Bras droits, flotteurs volumineux plus courts que la coque à étrave haute (photos), dérives courbes dans les flotteurs, dérive centrale droite, safrans sans plan porteur. Même script : `ultim.py -- ancien` → `ultim_ancien.glb`. Branché dans le hangar et la vue 3D.
- **IMOCA à foils** sur le design de **MACIF Santé Prévoyance** (décision du porteur de projet) : `outils/blender/imoca.py` → `imoca.glb`. Cotes officielles (macif.fr) : 18,28 m × 5,5 m, tirant d'eau 4,50 m, 8 t ; jauge IMOCA (imoca.org) : tirant d'air 29 m (mât ramené à 27 m au-dessus du pont dans le jeu), mât-aile avec 4° de quête, quille pendulaire à aileron acier et bulbe, deux safrans, deux foils. Formes et appendices relevés sur photos libres (Wikimedia Commons, CC BY-SA 4.0) : étrave haute et arrondie, bouchain, pont bombé, long rouf vitré, cockpit ouvert, safrans relevables au tableau arrière, foils en C, court bout-dehors. Pièces accrochées aux animations (quille qui bascule, foil au vent relevé, bôme). 
- **IMOCA à dérives** sur le design de **Macif 2011** (François Gabart, vainqueur du Vendée Globe 2012-2013 ; aujourd'hui Café Joyeux ; décision du porteur de projet) : `imoca.py -- derives` → `imoca_derives.glb`. Cotes VPLP / Wikipédia : 18,28 m × 5,70 m, tirant d'eau 4,50 m, tirant d'air 29 m. Photos libres (Wikimedia Commons, CC BY-SA 2.0 à 4.0) : franc-bord bas, étrave fine, long bout-dehors, deux dérives droites inclinées, petit rouf, grand cockpit, safrans sous la coque.
- Filières retirées des IMOCA (demande du porteur de projet : trop visibles).
- Bouts-dehors des IMOCA refaits (le porteur de projet les jugeait irréalistes ; ils étaient dessinés comme une lame d'un mètre d'épaisseur) : tube rond en carbone de 16 à 10 cm, presque horizontal, tenu par une sous-barbe, dont l'extrémité est le point d'amure des voiles d'avant (2,3 m devant l'étrave).
- Outriggers des IMOCA refaits d'après les photos de MACIF et de Charal envoyées par le porteur de projet : un long tube noir unique de chaque côté, qui part du pont près du pied de mât, s'écarte d'environ 2,7 m au-delà du bordé en remontant légèrement ; hauban frappé à son extrémité et câble qui le retient vers le flanc.
- **Ocean Fifty** modélisé dans Blender (`outils/blender/oceanfifty.py` → `ocean_fifty.glb`) : jauge (Wikipédia) 15,24 m × 15,24 m, tirant d'eau 3,50 m, tirant d'air 23,77 m (mât de 21,6 m au-dessus du pont), deux foils monotypes, quatre safrans et dérives au plus ; structure de **Solidaires en Peloton** (dessin VPLP envoyé par le porteur de projet, préférée à la « structure en K » des derniers VPLP, jugée moins belle) : deux bras en arche, avant et arrière, bras courbe derrière le bras arrière (du flotteur à l'arrière de la coque centrale), filets entre les bras, cellule de vie ; C-foils, trois safrans droits, dérive centrale. Photos libres (Wikimedia Commons). Le jeu dessine désormais chaque trimaran avec ses propres cotes (largeur, mât, bras) : l'Ocean Fifty n'est plus un Ultim réduit.
- **Class40** complété sur le design de **Crédit Mutuel** (David Raison, 2019 ; profil et rendus envoyés par le porteur de projet, rendu de Team SNEF) : quille **fixe** à bulbe (tirant d'eau 3,00 m ; elle ne bascule plus dans le jeu), deux safrans suspendus au tableau arrière, pas de dérives (interdites par la jauge 2025, ffvoile.fr), long bout-dehors avec sous-barbe, mât non tournant de 18 m à deux étages de barres de flèche, sans outriggers, bôme.
- Class40 : étrave et pont refaits d'après le rendu de Crédit Mutuel envoyé par le porteur de projet : étrave pointue en plan (ni en cuillère ni en nez arrondi) : presque toute la largeur jusqu'aux trois quarts puis ogive courte et pleine jusqu'à la pointe (plan de François Chevalier, 2020, envoyé par le porteur de projet), fond qui remonte avant l'étrave, longueur hors tout ramenée à 12,19 m (forme validée par le porteur de projet) ; rouf long, bas et presque triangulaire en plan, fondu dans le pont : il naît en pointe devant le mât et s'élargit en montant jusqu'au cockpit, hublots sur les flancs inclinés, panneaux solaires sur le dessus.
- Ocean Fifty rapproché du dessin de Solidaires en Peloton (comparaison sous le même angle, outil `outils/blender/vue.py`) : bras en carénages profilés (corde ramenée à 1 m et 0,85 m : jugés trop larges par le porteur de projet, version validée), filets clairs de la coque aux flotteurs, casquette arrondie entre le mât et le bras arrière sur un cockpit creux, têtes des dérives de flotteur au-dessus du pont (couleur du skipper, comme les safrans), bras courbe partant du milieu du bras arrière ; dérive centrale gardée (demande du porteur de projet).
- Voiles des IMOCA recollées au mât (signalé par le porteur de projet) : le mât-aile est incliné de 4° (quête de la jauge) et tourne avec la bôme ; mât, bôme et grand-voile pivotent autour de cet axe incliné ; la têtière des voiles d'avant et les étais suivent le mât.
- Fiche officielle de la classe (imoca.org) : MACIF Santé Prévoyance, architecte Guillaume Verdier, CDK Technologies avec MerConcept, étrave spatulée et double bouchain, franc-bord plus haut.
- Macif (2015) et Actual (même bateau) passent dans la famille « Ultim volant » : premier Ultim à foils (porteur de projet). 35 tests.

## 10/11/2026 · bouée du Brésil et Pot-au-noir sur la carte (publié le 10/11 avec l'accord du porteur de projet)

- Ultim : la marque du Brésil devient une bouée, à 500 milles à l'est du cap São Roque, à laisser à bâbord. Parcours de 5 960 milles ; 14 tours en simulation.
- Carte : le Pot-au-noir est dessiné (bande sombre, grains, éclairs) ; les flèches des alizés de sud-est indiquent un vent de sud-est (elles montraient par erreur un vent de nord-est). 35 tests.

## 10/11/2026 · Ultim sans Ascension (publié le 10/11 avec l'accord du porteur de projet)

- Transat Café L'Or : la marque de l'île de l'Ascension est retirée du parcours des Ultim (décision du porteur de projet) ; reste le point de passage à l'est de la pointe du Brésil. Parcours de 5 714 milles sur la carte ; durée en simulation : 13 tours (médiane du vainqueur, 8 courses). 35 tests.

## 10/11/2026 · Transat Café L'Or en double (publié le 10/11 avec l'accord du porteur de projet)

- **Nouvelle course : Transat Café L'Or**, Le Havre → Fort-de-France, en double, pour les quatre classes. Carte réelle prolongée jusqu'à 11° Sud pour les Ultim (Ascension, côte du Brésil).
- **Un parcours par classe** avec sa marque obligatoire (Ascension, Canaries, Sal, Açores à tribord), dessinée en pointillés jaunes sur la carte et rappelée dans la configuration et le briefing. Longueurs sur la carte : Ultim 6 707 milles (officiel 6 200), IMOCA 4 459 (4 350), Ocean Fifty 4 582 (4 600), Class40 3 967 (3 750).
- **Course en double** : choix du skipper puis du co-skipper, compétences additionnées, noms « A & B ».
- **Pot-au-noir aléatoire** : pétole ou grain violent, au hasard, pour chaque bateau et à chaque tour ; annoncé dans le journal.
- Correction du moteur : avec une marque, la distance restante tient compte de l'endroit où on la franchit (les IA longeaient la ligne sans la franchir).
- Écran de configuration : choix de la course ; briefing adapté à la course jouée (et débarrassé de l'ancien dé événement).
- Outils : `generer-carte-rhum.ts` produit toutes les cartes atlantiques (`courses-atlantique.ts`), `mesure-parcours.ts`, `suivi-partie.ts`. Route du Rhum inchangée. 35 tests.
- Alizés de sud-est avec leur propre vent régulier (d'E à SSE, F3 à 6) ; le moteur gère plusieurs zones d'alizés.
- Ultim : point de passage à l'est de la pointe du Brésil, après Ascension.
- Parcours obligatoire tracé en pointillés jaunes, du port de départ à l'arrivée par les marques.
- Simulation (médiane du vainqueur) : IMOCA 11 tours, Ocean Fifty 15, Class40 17, Ultim 17 (route de 6 700 milles, deux traversées du Pot-au-noir, remontée au près vers Ascension).

## 10/11/2026 · règles du jeu réécrites (publié le 10/11 avec l'accord du porteur de projet)

- Bouton « Règles » dans l'écran de jeu : les règles illustrées s'ouvrent par-dessus la partie.

- Page « Règles du jeu » réécrite pour être claire, imagée et à jour : un tour en quatre temps, rose des allures, les voiles, l'usure (barres « tours à F7 » lues dans les réglages), le dé du large et le dé tempête dessinés, la météo (alizés, fronts, anticyclone, molle, brume, courant), les règles entre concurrents (priorités, collision, zones interdites, ports), les classes et le hangar, l'arrivée. Les chiffres sont lus dans les réglages du jeu.

## 10/11/2026 · dé du large, usure des voiles, tempête, anticyclone (publié le 10/11 avec l'accord du porteur de projet)

- **Un seul dé par bateau et par tour, le dé du large** : 5-6 carte du large, 3-4 question de culture marine (mauvaise réponse : la voile hissée s'use de 20 %), 1-2 rien. Fin du dé de risque séparé et des pénalités tirées au hasard ; la case noire reste (voile perdue sauf carte réparation).
- **Usure des voiles d'avant** à chaque tour, selon la voile et la force du vent (référence transat : spi perdu en 3 tours à F7, gennaker 4, Code 0 5, solent 8, J3 15), la classe (Ultim ×1,2, Class40 ×0,8) et la durée de la course. À 100 %, la voile explose. Escale : voiles remises à neuf ; voile recousue à 50 %. La grand-voile ne s'use pas.
- **Dé tempête** au-delà de F8 (F9 : 6 ; F10 : 4-6 ; F11 : 2-6) : démâtage (gréement de fortune) ou chavirage ; escale technique si un port est proche. Les fronts peuvent monter jusqu'à F11.
- **Alizés** : les dés jouent pleinement (Nord-Est à Sud-Est, F3 à F7).
- **Anticyclone** : peut apparaître pendant la traversée (deux fois moins souvent qu'un front, une fois par course au plus) ; calme au centre, vent qui tourne autour dans le sens horaire ; dessiné sur la carte.
- Tableau de bord : barre d'usure par voile et explication en clair ; dé du large et questions adaptés ; textes des règles, du briefing et du tutoriel mis à jour. IA adaptée (coût de l'usure et de la tempête).
- Mesures (30 courses par classe) : durées tenues (Ultim 7, IMOCA 11, Ocean Fifty 9, Class40 14 tours), questions un tour sur trois, 0,5 à 0,7 démâtage par course en monocoque, 0,6 à 0,8 chavirage en multicoque, anticyclone dans 75 à 90 % des courses. Outil : `outils/mesure-usure.ts`. 35 tests.

## 10/11/2026 · coques sur la carte (publié le 10/11 à la demande du porteur de projet, avec la coque Class40 de Blender dans le hangar)

- Sur la carte, chaque bateau a la silhouette de son type : IMOCA (étrave fine, foils jaunes pour les foilers), Class40 (plus court, étrave ronde), Ocean Fifty et Ultim (trimarans, l'Ultim plus grand).
- Rappel : la 3D (dont la coque Class40 de Blender) ne sera publiée qu'une fois tous les modèles faits et leurs animations montrées au porteur de projet.

## 10/11/2026 · essai de modélisation dans Blender (publié le 10/11 avec la version suivante)

- Blender 5.2.3 installé (gratuit, avec l'accord du porteur de projet). Script `outils/blender/class40.py` : coque de Class40 construite d'après les cotes de la jauge (12,19 × 4,50 m, étrave ronde de scow, bouchain, fond qui remonte à l'avant), exportée en glTF (`packages/client/public/modeles/class40.glb`, 125 Ko), repeinte aux couleurs du skipper par le jeu ; gréement et voiles toujours générés par le code.
- Script `outils/blender/apercu.py` : rendus de contrôle (trois quarts, profil, dessus) dans `conception/rendus-blender/`, pour comparer aux photos.
- Défauts corrigés : nez d'étrave qui plongeait (il remonte en arrondi), cockpit ouvert à l'arrière avec hiloires, liston fin et continu ; franc-bord relevé et bouchain plus vif d'après les photos du SNSM 209 (2025). Photos de référence libres (Wikimedia Commons) : catégories Class40-209 SNSM Faites un don ! (2025), Class40-202 Crédit mutuel (2024), Class40-182 Paprec Arkéa (2022), et « TheTransat24 Class40 01.jpg » (MFonzatti, CC BY-SA 4.0).

## 10/11/2026 · 3D par type de bateau (publié le 10/11 avec l'accord du porteur de projet)

- Le trimaran du prototype Ultim validé est intégré au jeu : Ultim volant (foils dans les flotteurs, safrans en T, il décolle de l'eau), Ultim ancienne génération (dérives droites, sans vol), Ocean Fifty (même architecture à 50 pieds, provisoire).
- IMOCA à dérives droites : dérives droites à la place des foils courbes. Class40 : coque IMOCA réduite à 40 pieds (provisoire).
- Hangar et vue 3D de course utilisent le modèle du type de bateau ; caméra reculée selon la taille.

## 10/11/2026 · le hangar (publié le 10/11 avec l'accord du porteur de projet)

- Hangar organisé par type de bateau (décision du porteur de projet) : IMOCA à foils, IMOCA à dérives droites, Class40, Ocean Fifty, Ultim volant, Ultim ancienne génération ; Vintage plus tard.
- Nouvelle famille « Ultim ancienne génération » (Idec Sport, IDEC, Macif 2015, Actual) : ne vole pas (pas de bonus au travers et au largue), plus robuste (risque +1 seulement à F7 et plus). Effets à valider.

- Nouvel écran « Le hangar » (accueil) : par classe, la flotte en 2D vue du dessus (IMOCA à foils ou à dérives, Class40 à étrave ronde, trimarans Ultim et Ocean Fifty) ; pour chaque bateau, la 3D (allure et voile au choix, on tourne autour), l'architecture (avantages, inconvénients), la vitesse et la voile la plus rapide selon l'allure et la force du vent, le risque de chaque voile, la comparaison avec un autre bateau et des conseils tactiques.
- En 3D, les Ultim, Ocean Fifty et Class40 utilisent encore la coque IMOCA (modèles en préparation).

## 10/11/2026 · dé de risque visible (non publié)

- Le dé rouge de risque du jeu de 1987 est montré comme les dés du vent : il roule, puis s'affichent la règle (« Risque modéré : incident si le dé fait 1 à 3 ») et le résultat (incident et question, ou passage sans encombre). Case noire : message de casse, sans dé.

## 10/11/2026 · quatre classes, vitesse selon le vent, priorités (publié le 10/11 avec l'accord du porteur de projet)

- Classes Ultim, Ocean Fifty et Class40 en plus de l'IMOCA : 42 skippers réels, choix de la classe en solo, même écran et réseau ; durée moyenne d'une Route du Rhum : 7 tours (Ultim), 10 (IMOCA, Ocean Fifty), 15 (Class40).
- Suspense : avaries à la mesure de la vitesse (Ultim fragile, Class40 robuste), cartes du large plus fréquentes dans les classes rapides, fronts et molle à l'échelle de chaque classe, escale technique après une avarie grave.
- Vitesse selon la force du vent (fin des 690 milles par F2).
- Brume dans le golfe de Gascogne ; DST d'Ouessant réduit ; règle de priorité entre bateaux ; collision rare (brume seulement) : −1 carte réparation et 1 tour pour les deux.
- Corrigé : des bateaux rapatriés dans la brume se percutaient à chaque tour (bloqués toute la course).
- Journal des mouvements : origine du vent (général, alizé, front, traîne, molle) et déroutements de priorité.

## 09/11/2026 · console des risques pour débutants

- Les trois petites pastilles « si le vent tourne » sont supprimées : le risque dépend de la force du vent, pas de sa direction, elles étaient donc presque toujours identiques.
- À la place, l'encadré de la voile choisie répond à « Et si le vent change, après les dés ? » : s'il tourne de 45°, la distance possible (ou voile inutilisable) ; s'il forcit, le nouveau risque (calculé avec la force maximale du dé, bornée dans les alizés).
- Légende réécrite ; textes du tutoriel et des règles mis à jour.

## 09/11/2026 · alizés réguliers

- Vérification : le bonus des alizés s'appliquait bien (+1 point, 60 à 90 mn), mais le vent était le même sur toute la carte ; aller chercher les alizés ne payait presque pas.
- Décision du porteur de projet : dans la zone des alizés souffle un vent propre, régulier, de Nord-Est à Est, force 4 à 6 (les dés le font varier dans ces bornes, la force d'un cran au plus). Le bonus de +1 point est conservé. Bandeau dans le tableau de bord ; l'IA et la prévision du Navigateur en tiennent compte.
- Effet mesuré (60 parties) : 422 mn par tour dans la zone contre 255 hors zone ; rang final moyen 1,4 pour les bateaux qui y passent 3 tours ou plus, 6,5 pour ceux qui l'évitent. Outil : `outils/verifier-alizes.ts`. 33 tests.

## 09/11/2026 · quiz et explication du risque

- Tableau de bord : chaque voile affiche son pourcentage de risque (« Modéré · 50 % ») ; sous la liste, une légende des petits carrés et, pour la voile choisie, un encadré qui explique en clair la chance d'incident, le quiz, les avaries possibles (avec leurs probabilités), la carte réparation et la case noire.

- Les réponses du quiz sont affichées dans un ordre tiré au hasard à chaque question : dans les données, la bonne réponse était 36 fois sur 48 en deuxième position (B).

## 09/11/2026 · vue 3D indisponible signalée

- Collisions et pertes de voile jamais montrées en 3D : quand le joueur doit décider en cours de tour (réparation, quiz) ou en réseau, la suite du tour n'est pas encore connue ; un moment plus faible (petit temps, louvoyage) prenait l'unique scène du tour. Désormais un moment plus fort a toujours sa scène.
- Vue 3D grise : non reproduite (forces 6, 9 et 12, chute de voile). Robustesse : le contexte graphique est vraiment libéré à la fin d'une partie (le navigateur n'en accepte qu'une quinzaine), et sa perte en cours de partie est signalée au lieu de laisser une fenêtre vide.

- Signalement « les animations 3D n'apparaissent pas ». Vérifié dans le navigateur, en local et en ligne, en solo et en réseau : la vue 3D s'ouvre (dépassement, collision…). Cause probable : appareil ou navigateur sans accélération graphique (WebGL), cas où le jeu désactivait la 3D en silence. Désormais un message l'explique et indique comment activer l'accélération graphique ; une erreur de création de la scène 3D est aussi rattrapée.

## 09/11/2026 · fin du blocage, nouvelle collision, corrections

- Régatier : n'entre jamais en collision dans la brume (compensation de la fin du blocage). 32 tests.
- Les bateaux ne se barrent plus la route ; seule la collision dans la brume subsiste (décision du porteur de projet).
- Nouvelle règle de collision : rapatriement à la côte avec 1 tour de pénalité à moins de 200 milles des côtes, 2 tours de réparation au large. Les cartes réparation ne sont plus retirées automatiquement (c'était la cause de leur « disparition »).
- Si tous les bateaux sont immobilisés en même temps, le tour s'enchaîne tout seul (la partie pouvait se bloquer).
- Dé de direction : flèches de rotation redessinées (arc et pointe pleine), sans caractères ↻ ↺ mal affichés par certaines polices.
- Vue 3D : la scène du tour est réservée au moment le plus fort (voile perdue, collision, arrivée avant un dépassement, une navigation à vue ou un petit temps) : la perte de voile n'est plus escamotée.
- Réseau : les boutons de réparation n'apparaissent plus sur la carte du large d'un autre joueur. Journal des mouvements : mise en page du tableau corrigée.

## 09/11/2026 · journal des mouvements et correction du tracé

- **Journal des mouvements** (bouton « Journal » en haut de l'écran de jeu) : pour chaque bateau et chaque tour, vent et distance annoncés au choix, vent après les dés, carte, risque, avarie, distance autorisée, distance parcourue, issue (bloqué par la terre, un bateau, la brume…). Chaque ligne est contrôlée automatiquement (distance dépassée ou non parcourue, terre traversée, saut de case, immobilisation sans raison). Export en tableur (CSV).
- **Erreur corrigée** : le tracé en ligne droite perdait jusqu'à une case et demie par tour sur les caps en diagonale (ex. 300 mn annoncés, 255 parcourus ; un bateau à 30 mn pouvait rester sur place). Le bateau parcourt maintenant exactement la distance autorisée, à l'arrondi de la case près ; la brume ralentit progressivement au lieu de bloquer.
- Un Régatier qui ne peut pas s'arrêter sur une case occupée est signalé « bloqué par un bateau » ; un arrêt dans la brume est signalé « la brume le ralentit ».
- Outils : `outils/controle-mouvements.ts` (contrôle de milliers de déplacements : aucune anomalie sur 10 130), `outils/detail-anomalie.ts`, `outils/mesure-distances.ts`. 32 tests.
- Point ouvert (à décider) : au départ, tous les bateaux sont sur la même case et se barrent la route ; celui qui bouge en dernier perd beaucoup de distance.

## 09/11/2026 · échelle de la carte

- Retour du porteur de projet : le tableau de bord n'affiche que la distance réelle au moment du choix, si le vent ne bouge pas. La distance moyenne attendue est retirée de l'affichage (le calcul reste dans le moteur, `distanceAttendue`, pour les outils de mesure).
- Échelle des distances sur la carte (en bas à gauche) : 500, 100 ou 30 milles selon le zoom (1 case = 30 milles).

## 09/11/2026 · distance attendue

- Signalement : « les distances du joueur semblent sous-évaluées par rapport aux IA ». Diagnostic par `outils/mesure-distances.ts` : le moteur est équitable (sur 120 parties, un humain qui fait les choix de l'IA parcourt 69 % de la distance annoncée, l'IA 70 %). L'écart venait de l'affichage : le tableau de bord donnait la distance « si le vent ne bouge pas », alors que le vent tourne 2 fois sur 3 et que la force change. L'IA calcule la moyenne sur tous les jets ; un joueur qui choisit la plus grosse distance affichée ne parcourt que 47 % de l'annonce.
- Le tableau de bord affiche désormais, pour chaque voile, la **distance moyenne attendue** (≈ … mn) après les dés de vent et le dé de risque, et le **risque de case noire** (💥 %) si le vent forcit. Même calcul que l'IA. Validé par simulation : 183 mn attendus pour 177 parcourus (IA).
- Test ajouté (31 tests).

## 0.3.0 bêta (08/11/2026)

- Dé événement et 24 cartes du large (heureuses ou avaries), tirées juste après les dés du vent ; carte réparation possible contre une avarie ; effets temporaires sur plusieurs tours.
- Dés du vent plus lisibles : dé de direction rond et bleu, dé de force carré et orange, apparition puis lancer puis résultat avec une phrase récapitulative ; durée d'affichage allongée (bouton « Continuer »).
- Paquet de cartes animé puis carte illustrée (illustrations provisoires, à faire dessiner).
- Récapitulatif de l'état du bateau ; trajectoires et déplacements en lignes droites.
- Vue 3D réservée aux moments de course : dépassement, navigation à vue, voile perdue (nouveaux événements du moteur).
- Vue 3D : mer selon l'échelle de Beaufort (vagues, moutons, ciel), sillage et vague d'étrave, vitesse en nœuds ; un seul moment 3D par tour.
- Corrections : la partie ne se bloque plus quand le seul joueur humain est immobilisé ; le « Conseil du routeur » ne propose plus de cap face au vent actuel.
- Quiz : niveau Skipper plus technique (48 questions au total).
- 22 tests ; simulation 400 parties : médiane 15 tours, victoires de 21 à 31 %.

## 0.2.0 bêta (08/11/2026)

- Carte réaliste de la Route du Rhum : côtes Natural Earth 1:50 m, projection de Mercator, orthodromie, zones (alizés, brume, courant des Canaries, DST Ouessant et Finisterre), ports d'escale réels.
- Quadrillage fin et invisible (≈ 30 milles par case) ; distances et classement en milles.
- 16 caps et allures intermédiaires ; déplacement en ligne droite réelle, sans couper les coins de terre ; champ de distance euclidien.
- Carte façon tracker : traces colorées par la vitesse, coques orientées selon le cap, graticule ; rose des 16 caps dans le tableau de bord ; bouton « Conseil du routeur ».
- Régatier : compromis « −1 case par vent fort » (provisoire) au lieu de « mers du Sud ».
- Outil `outils/sim-variantes.ts` pour comparer des réglages de compétence.

## 0.1.0 bêta (08/11/2026)

- Moteur de règles (§3 à §5) : vent à deux dés et tendance, allures, 6 voiles, risque et cartes réparation, pénalités, quiz, navigation à sec de toile, naufrage, ports, abri côtier, brume, courant, alizés, 10 compétences, 2 familles IMOCA, ordre de résolution inverse du classement, champ de distance, classement et temps de course fictif. Générateur aléatoire à graine, parties rejouables. 15 tests.
- IA facile et moyenne (espérance sur les 36 tirages de vent).
- Données : 4 skippers et bateaux réels (IMOCA), Route du Rhum stylisée, 36 questions de quiz.
- Client web : accueil, règles, configuration, choix des skippers (cartes avec diagramme polaire), écran de jeu (carte 2D zoomable, tableau de bord, « si le vent tourne », détails du calcul), quiz, réparation, relance du Stratège, même écran avec écran de passation, vue rapprochée 3D, fin de partie (podium, tableau, carnet de bord).
- Outil de simulation d'équilibrage et rapport `reports/equilibrage-beta.md`.

## Non publié — tours du monde (12/11/2026)
- Vendée Globe et Arkéa Ultim Challenge : carte du monde déroulée (Atlantique dessiné au départ et à l'arrivée), trois caps à laisser à bâbord, zone d'exclusion des glaces et zones de vent régulier (stylisées).
- Un tour = 3 jours ; vraie distance (60 milles × cos latitude par case). Simulation : Vendée Globe ≈ 23 tours, Arkéa ≈ 18 tours.
- Carte du monde entière à l'écran, côtes rognées au cadre, route affichée le long de la zone des glaces.
- Vue globe (3D) des tours du monde : bouton « 🌍 Vue globe », globe qui suit le bateau du joueur.
- Globe : côtes, bateaux et traces en 3D, nets au zoom. Vendée Globe : un bateau gravement endommagé qui rejoint un port abandonne.
- Téléphone : boutons de la carte en colonne à droite, plus sous le bouton Valider.
- Météo mondiale : anticyclones permanents (Açores, Sainte-Hélène, Mascareignes, île de Pâques), rotation du vent selon l'hémisphère, dépressions qui filent vers l'est, grands courants océaniques.
