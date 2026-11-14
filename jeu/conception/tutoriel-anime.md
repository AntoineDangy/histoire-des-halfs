# Nouveau tutoriel animé : scénario à valider (14/11/2026)

Branche `tutoriel`. Ce document et la maquette `maquette-tutoriel.html` (même dossier, à ouvrir dans un navigateur) ont servi à choisir avant d'écrire le code.

**Décision du propriétaire (14/11/2026)** : « tu me mets les 2 possibilités, dans le tutoriel, le guide, dans l'onglet des regels, le petit film "comment ça marche" ». **Réalisé le 14/11/2026** (non publié) : le guide de la partie 2 dans le tutoriel (`client/src/tutoriel/Guide.tsx`), le film de la partie 1 en tête de l'écran des règles (`client/src/tutoriel/Film.tsx`). Écarts : trois petits conseils seulement (tempête, front annoncé, voile usée) ; bulle du vent « Le vent : sa direction et sa force. ».

**Demande du propriétaire (14/11/2026)** : « je veux un tutoriel animé, très clair, qui aide les enfants à comprendre et les gens qui ne connaissent rien à la voile à comprendre la logique du jeu et ce qu'il y a à faire. »

**Sa règle pour l'interface (14/11/2026)** : « pour les interactions avec le joueur, limite les informations aux strictes minimum. les regles générales donnent le détail mais dans l'interface de jeu on doit être fun, simple et factuel. » Pour le tutoriel : une phrase courte par écran (une petite ligne en plus au besoin), des mots d'enfant, plus d'images et d'animations que de texte. Les chiffres et les détails restent dans l'écran des règles.

## 1. Le tutoriel actuel, joué en local (version 0.4.280)

Joué le 14/11 à la place d'un enfant de 10 ans et d'un adulte qui n'a jamais fait de voile (Jérémie Beyou contre Jean Le Cam, Route du Rhum, 2 tours).

**Ce qui est obscur ou trop long**
1. **On arrive directement dans une vraie partie** : carte, vue 3D, classement, journal, girouette, voiles, bouton « Valider »… sept zones d'un coup, et personne ne dit d'abord quel est le but ni comment avance un voilier.
2. **Les bulles font 2 à 4 phrases**, avec des mots de marin ou de joueur expérimenté : bâbord, marques de parcours, dérive du courant, routeur, louvoyage, « risque −1 cran », F3, F8.
3. **La bulle cache ce qu'elle explique** : en bas à gauche, elle couvre les voiles (Réduite, J3, Solent) pendant tout le choix du premier tour ; on ne peut pas la fermer, seulement quitter le tutoriel.
4. **Les explications arrivent quand on ne peut pas les lire** : la carte du large et la question ouvrent leur fenêtre par-dessus la bulle.
5. **Le tutoriel est passif** : il ne demande aucun geste, ne vérifie rien et ne dit jamais « bravo ». On peut tout ignorer.
6. **L'idée principale du jeu n'est pas montrée** : le vent pousse le bateau, on ne peut pas aller face au vent, on choisit avant les dés. Le louvoyage n'est expliqué que si l'on choisit un cap face au vent.
7. **Le premier conseil fait échouer** : « Visez l'ouest pour sortir de la Manche » ; en touchant la mer à l'ouest de Saint-Malo, on obtient « terre sur la route » en rouge et le jeu choisit la voilure réduite pour 60 milles.
8. **Les mêmes bulles reviennent au tour 2** (cap, vent, dé du large), mot pour mot.
9. **C'est une course entière** : la bulle « Arrivée » n'apparaît qu'au bout d'une dizaine de tours ou plus. Trop long pour apprendre.

**Ce qui est dépassé par les règles d'aujourd'hui**
1. « Touchez une direction sur la rose » : on touche maintenant **la mer, à l'endroit visé** (13/11).
2. La bulle « Choisissez une voile » (étape 2/5, « le Solent est un bon compromis ») **n'apparaît plus jamais** : la voile conseillée est choisie d'office (13/11). La numérotation saute donc de 1/5 à 3/5.
3. « Le bouton Conseil du routeur » s'appelle maintenant « routeur » ; la route devient rouge quand la terre la barre, ce que la bulle ne dit pas.
4. « Vous lancez le dé du large » : c'est maintenant **une boussole**, une par joueur, toutes ensemble (13/11).
5. « Au-delà de F8, le dé tempête entre en jeu » : la tempête commence à F9, avec une boussole de tempête ; démâtage = rapatriement au port ; chavirage d'un multicoque = fin de course (13-14/11).
6. **L'ordre du tour a changé** : le vent, puis **les voiles**, puis le large, puis la course (13/11). L'étape des voiles (trop de toile, changement de voile quand le vent tourne) n'est pas expliquée.
7. Pas un mot sur : l'usure (jauge sous chaque voile), l'escale volontaire (« ⚓ port »), la cape au-delà de F9, la compétence du skipper (Coriace).

**Vu en passant, hors tutoriel** (pour la conversation des bugs d'affichage, `corrections-affichage`, à vérifier) : pendant les dés du vent, le classement montre déjà les distances d'après le déplacement ; au tour 1, la vue 3D indiquait « Solent / J2 » alors que le gennaker était choisi ; au tour 2, le bouton « routeur » touché avant de choisir un cap n'a rien changé.

## 2. Le scénario proposé

Deux parties : **un petit film** de 9 scènes animées avant la course (environ 2 minutes, chaque scène se passe d'un « Suivant »), puis **la course du tutoriel**, dont le premier tour est guidé geste par geste. Tutoiement proposé (à valider : le jeu dit « vous »).

Une **frise du tour** revient dans les scènes 4 à 8 et dans le jeu guidé : **👆 Choisis → 🎲 Le vent → ⛵ Les voiles → 🎡 Le large → ➜ Ça avance**. C'est « ce qu'il y a à faire à chaque tour », en une ligne.

### Partie 1 · Le petit film

| Scène | Ce que le joueur voit (animation) | Ce qu'il fait | La phrase à l'écran |
|---|---|---|---|
| 1 · Le but | Une carte de Saint-Malo à la Guadeloupe ; deux bateaux font la course en pointillés jusqu'au drapeau. | Il regarde. | « Traverse l'océan à la voile. » *Le premier arrivé gagne !* |
| 2 · Le vent et le cap | Le vent souffle (traits qui défilent) ; la flèche orange montre d'où il vient. Autour du bateau, le cercle de couleurs des allures (le même que dans les règles). Il touche un rond : le bateau tourne, sa route apparaît ; face au vent, elle zigzague et va moins loin. | **Il touche une direction** (sinon la scène se joue seule). | « Le vent vient de la flèche orange. » puis, selon son choix : « Face au vent : on zigzague. » *C'est le louvoyage : on avance moins.* / « Vent de côté : ça file ! » / « Vent dans le dos : sors le spi ! » |
| 3 · Les voiles | Une jauge de vent monte (F3, F6, F8, F10) ; à chaque cran, les voiles trop grandes se grisent (Spi, Solent, J3, Réduite), comme dans le jeu. À F10 : « à la cape, on range tout ». | Il regarde. | « Plus il y a de vent, plus la voile est petite. » *Le jeu te propose la bonne voile.* |
| 4 · Ton tour (frise : Choisis) | Un écran de jeu simplifié ; une main touche la mer, la route en pointillés apparaît, la voile conseillée s'allume, la main appuie sur « Valider ». | Il regarde le geste. | « Touche la mer où tu veux aller. » *Puis « Valider ». Tout le monde choisit en même temps.* |
| 5 · Le vent change (frise : Le vent) | Les deux dés du jeu roulent (rond : la direction ; carré : la force) ; la flèche du vent tourne, la force change. | Il regarde (les dés relancent tout seuls). | « Puis les dés font tourner le vent. » *Ton bateau avance avec ce vent-là. Bien deviné ?* |
| 6 · Trop de vent ? (frise : Les voiles) | Le vent forcit, le spi tremble puis s'envole ; « Trop de toile : la voile lâche ! » ; une carte réparation arrive et la voile revient : « Voile repêchée ! » | Il regarde. | « Trop de vent pour ta voile ? Elle lâche ! » *Tu avances moins. Une carte réparation peut la sauver.* |
| 7 · La roue du large (frise : Le large) | La boussole du large tourne (1 gris, 2-3 bleu, 4-5-6 jaune) et s'arrête : rien, une vraie question du jeu, ou une vraie carte (banc de dauphins, nuit de sommeil, OFNI). | Il regarde. | « La roue du large : rien, une question… ou une carte ! » *Mauvaise réponse ? Ta voile s'use un peu.* |
| 8 · Ça avance… gare aux fronts ! (frise : Ça avance) | Les bateaux avancent sur leur route ; un front rouge avec un éclair traverse la carte en suivant ses pointillés rouges. | Il regarde. | « Les bateaux avancent. Gare aux fronts ! » *Un front, c'est du gros vent qui se déplace. Dans la tempête, le mât peut casser.* |
| 9 · L'arrivée | La ligne entre la bouée jaune et le bateau du comité ; le bateau la coupe, confettis, « 1er ! ». | **Il touche « ⛵ À toi de jouer ! »** | « Coupe la ligne le premier : gagné ! » *La ligne est entre la bouée jaune et le bateau du comité.* |

Un bouton « Passer » permet de sauter le film à tout moment (pour ceux qui le connaissent déjà).

### Partie 2 · La course du tutoriel, premier tour guidé

Même course qu'aujourd'hui (Jérémie Beyou contre Jean Le Cam, IA facile, questions Moussaillon sans chrono). L'écran de jeu s'assombrit, sauf ce qu'il faut toucher, entouré d'un halo jaune ; une main animée montre le geste ; une bulle de quelques mots, placée **à côté** de la zone (jamais dessus).

| Moment | Zone éclairée | Geste attendu | Bulle |
|---|---|---|---|
| Tour 1, choix | La girouette du vent | Toucher l'écran pour continuer | « Le vent vient d'ici. » |
| | Un point sûr au large, au nord-ouest de Saint-Malo (route libre) | **Toucher la mer** (le guide attend) | « Touche la mer ici. » |
| | Les voiles (la conseillée s'allume) | Toucher pour continuer | « Ta voile est déjà choisie. » |
| | Le bouton « Valider » | **Valider** (le guide attend) | « Valider ! » |
| Tour 1, résolution | Rien d'assombri : la frise du tour et un grand titre suivent les animations du jeu | Regarder | « 🎲 Le vent change ! », « ⛵ Tes voiles tiennent ! » (ou « Trop de vent : ta voile a lâché ! »), « 🎡 La roue du large ! », « ➜ Ça avance ! » |
| Tour 2, choix | Aucune ; une bulle seule | Refaire le geste sans aide | « À toi : même geste ! » |
| Fin du tour 2 | Carte au centre | Choisir | « Bravo, tu sais jouer ! » [Continuer la course] [Accueil] |

**Ensuite, si le joueur continue la course** : une bulle d'une ligne, une seule fois, la première fois que l'événement arrive, qui disparaît seule ; jamais par-dessus une fenêtre du jeu :
- front annoncé : « Un front arrive : gros vent ! » ;
- voile qui lâche : « Trop de vent : ta voile a lâché. » ;
- avarie, carte réparation proposée : « Une carte réparation peut t'aider. » ;
- tempête : « Tempête ! Ton mât va-t-il tenir ? » ;
- voile usée aux trois quarts : « Ta voile s'use : regarde la jauge. » ;
- arrivée proche : « La ligne est là : fonce ! ».

Ce qui reste exact dans le scénario quand on rééquilibre : il ne cite aucun chiffre de règle (sauf la jauge F3 à F10 de la scène 3 et les faces des boussoles, qui suivent les réglages du jeu).

## 3. Deux façons de l'animer (maquette `maquette-tutoriel.html`)

- **Façon 1 · Le petit film** : les 9 scènes ci-dessus, dessinées et animées, avant la course. Avantage : on explique le vent, les allures et les voiles sur un écran calme, sans la carte ni les panneaux ; deux minutes suffisent ; on peut le revoir depuis l'accueil. Limite : ce n'est pas encore le vrai écran de jeu.
- **Façon 2 · Le guide dans la partie** : seulement une vraie course, avec l'écran assombri sauf la zone à toucher, une main animée et une phrase. Avantage : on apprend les gestes sur le vrai écran. Limite : le vent, les allures et les voiles sont difficiles à expliquer sur un écran chargé et pendant que le jeu tourne.

**Recommandation : les deux, dans cet ordre** (le scénario de la partie 2 ci-dessus) : le petit film pour la logique, puis le guide au premier tour pour les gestes. Environ 4 minutes en tout, puis le joueur continue la course ou revient à l'accueil.

**Comment ce serait fait** (pour mémoire) : le film en dessins animés légers dans le jeu (pas de vidéo, rien à télécharger), avec les dessins du jeu déjà existants (dés et boussoles, icônes des voiles, rose des allures des règles) ; le guide à la place des bulles actuelles (`Coach.tsx`). Les fenêtres de jeu ne changent pas.

## 4. Questions au propriétaire

1. **Quelle façon ?** Le film puis le premier tour guidé (recommandé), le film seul, ou le guide seul ?
2. **Tutoyer dans le tutoriel ?** (proposé : « tu », pour les enfants ; le reste du jeu garde « vous »).
3. **Arrêter le tutoriel après 2 tours** avec « Continuer la course » ou « Accueil » (proposé), ou le garder jusqu'à l'arrivée ?
4. Faut-il **revoir le film depuis l'accueil** sans lancer de course (proposé : oui, bouton « 🎬 Comment on joue ? ») ?
