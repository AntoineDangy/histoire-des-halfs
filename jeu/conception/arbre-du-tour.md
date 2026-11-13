# Arbre de décisions d'un tour (13/11/2026)

Demande du porteur de projet (13/11/2026), après une partie où une tempête de force 11 a tout embrouillé : « comment avoir un enchaînement des événements, des décisions, des conséquences et des animations cohérent ? Fais-moi un arbre de décisions qui décrit tout ça étape par étape, avec ce qui se passe du côté des joueurs humains et des IA. »

**Ce document ne change rien au jeu.** Il décrit le tour tel qu'il est calculé aujourd'hui (moteur : `engine/src/moteur.ts`, fonctions `demarrerResolution`, `avancer`, `etapeBateau`, `calculerTour`, `deTempete`, `resoudreRisque`, `deplacer`, `escaleTechnique`, `finirTour` ; écran : `client/src/ecrans/Jeu.tsx` et `client/src/jeu/enchainement.ts`), relève ce qui ne se tient pas, puis propose un arbre cohérent. Il complète l'audit de l'enchaînement de la branche `corrections-affichage` (`audit-enchainement.md`, validé le 13/11), qui a réglé **quand** l'écran montre les choses ; celui-ci règle **dans quel ordre le jeu les fait et ce qu'elles entraînent**.

Légende : 🧑 joueur humain · 🤖 IA · 🎬 animation · ⚠ incohérence relevée.

## 1. Le tour d'aujourd'hui, étape par étape

### Étape 0 · Le choix (tous en même temps)
- 🧑 Choisit un cap (rose, touche sur la mer, point bleu qui tourne) et une voile (conseillée d'office par le routeur), règle la distance. En réseau : 2 min 30, à partir de la fin de l'animation, puis le routeur choisit.
- 🤖 Choisit cap, voile et distance au dernier moment (`choisirIA`).
- Rien n'est encore tiré au hasard.

### Étape 1 · Le vent (un seul jet pour toute la carte)
- Dés du vent : force et direction. Puis le vent **local** de chaque bateau : vent général, alizés, front ou traîne, molle, anticyclone.
- 🎬 Dés du vent (3,5 s), titre « Le vent ».

### Étape 2 · Le large (tous les bateaux d'un coup, depuis le 13/11)
- Un dé par bateau. 1 : rien ; 2-3 : question de culture marine ; 4-5-6 : carte du large.
- 🎬 Boussoles sur camembert, une par joueur, toutes ensemble, 3 s. Dés des IA non montrés.
- Ensuite, bateau par bateau, dans l'ordre de passage (dernier du classement en premier) :
  - **Question** → 🧑 fenêtre de la question ; bonne réponse : rien ; mauvaise : la voile hissée s'use (mauvaise manœuvre). 🤖 réussite tirée au hasard selon son niveau.
  - **Carte heureuse ou neutre** → effet noté pour le déplacement (milles en plus, rien…).
  - **Carte qui fait mal** → s'il reste une carte réparation : 🧑 « Réparer ou encaisser ? » (carte 3D si une voile est en jeu) ; 🤖 répare si c'est grave ou s'il a 2 cartes. Effet noté pour le déplacement (voile perdue tout de suite).

### Étape 3 · La course, bateau par bateau (dernier du classement en premier)
Pour chaque bateau, dans cet ordre :
1. **Passe son tour ?** (escale, démâtage, chavirage, carte) → oui : « passe son tour », rien d'autre.
2. **À l'abri de la côte ?** → oui : reste à l'abri.
3. **Pot-au-noir** (s'il y est arrêté) → dé : pair, il repart ; impair, il passe son tour.
4. **Vent du bateau** (avec le dé de direction du tour) → **Stratège** : 🧑 « relancer le dé de direction ? » ; 🤖 décide seul.
5. **Voile utilisable avec ce vent ?** → non : **affalage**, le bateau n'avance pas ce tour (🎬 scène « Voile inutilisable », en carte 3D).
6. **Départ** : allure, distance possible, risque de la voile (case bleue à noire).
7. **Tempête (F9 et plus)** → dé de tempête (F9 : 6 ; F10 : 4 à 6 ; F11 : 2 à 6) :
   - tient bon → continue ;
   - **monocoque démâté** → ne garde que la voile réduite (« gréement de fortune »), passe 1 tour ;
   - **multicoque chaviré** → passe 2 tours ;
   - puis **escale technique** (voir 10).
   - 🎬 aujourd'hui : un simple dé « Dé de tempête · F11 », pas de scène de démâtage.
8. **Risque de la voile** (couleur de la case : bleu, vert, jaune, rouge, noir, selon la voile et la force du vent). **Le dé de risque n'existe plus depuis le 10/11/2026** (corrigé le 13/11 : la première version de ce document le décrivait encore) :
   - **case noire** (trop de toile pour ce vent) → 🧑 « Réparer ou endurer ? » (endurer : voile perdue, demi-avance ; réparer : voile gardée, pas d'avance) ; 🤖 décide seul ; un multicoque chavire ;
   - **sinon, l'usure** : à chaque tour, la voile hissée s'use selon la voile et la force (spi à F7 et plus : 34 % par tour, J3 : 7 %, voile réduite : 3 %) ; à 100 %, elle explose et est perdue ; une mauvaise réponse à une question du large ajoute 20 %.
9. **Déplacement** : louvoyage, courants, brume (collisions), terre, zones interdites, priorité entre bateaux, arrivée.
10. **Escale technique** (si avarie grave : démâtage, chavirage, deuxième voile perdue) : si un port de secours est à moins de 500 milles, le bateau est **posé directement dans ce port**, **tout est réparé**, il passe 1 tour ; sinon il reste en mer avec ses avaries.

### Étape 4 · Fin de tour
- Dépassements, bateaux à vue, arrivées et podium, fronts qui avancent, usure des voiles, classement.
- 🎬 au plus une scène 3D par tour (le moment le plus fort), en fin de tour ; les voiles perdues ou inutilisables gardent la leur, au moment où elles arrivent.

## 2. Ce qui ne se tient pas (la tempête du 13/11 et le reste)

| N° | Constat | Pourquoi | Conséquence vue par le porteur de projet |
|---|---|---|---|
| T1 | **L'escale technique téléporte le bateau** jusqu'à 500 milles, même vers l'avant | Étape 3.10 : le bateau est posé dans le port le plus proche, quelle que soit sa direction | Les IA démâtées près de la Bretagne se retrouvent à La Corogne, 400 milles plus loin, réparées (3 533 milles restants contre 3 935 pour Yoann) |
| T2 | **Même tempête, sorts opposés, sans explication** | Escale (tout réparé) pour les uns ; pour un bateau resté en mer, gréement de fortune jusqu'au bout (seule la voile réduite) ; aucun message ne dit pourquoi (port trop loin ? décision ?) | « Le bateau de Yoann est resté en mer sans autre voile que la toile réduite : on ne comprend plus rien » |
| T3 | **F11 démâte presque toute la flotte d'un coup** | Dé de tempête 2 à 6 à F11 (5 chances sur 6), pour chaque bateau dans le front | Toute la flotte s'arrête au même tour |
| T4 | **Démâté sans port proche : la course est finie en pratique** | Les voiles perdues ne reviennent qu'au port (ou une à une, pour la compétence Voilier) | Le joueur continue des dizaines de tours sous voile réduite |
| T5 | **La tempête n'est pas racontée** | Dé de tempête montré comme un dé ordinaire ; pas de scène de démâtage ni de chavirage | Pas de « vous êtes au cœur de la tempête, votre gréement souffre ! » |
| T6 | **Aucun port de secours français** (corrigé le 13/11 : Lorient ajouté) | Ports : La Corogne, Açores, Madère, Canaries, Cap-Vert | Démâté en Bretagne → Espagne |
| T7 | **Les voiles se perdent à trois moments différents** | Affalage (3.5), tempête (3.7), case noire et risque (3.8), carte du large (étape 2) | Le joueur ne sait plus quelle voile il a ni pourquoi ; le porteur de projet veut « les voiles » entre le vent et le large |
| T8 | **La relance du Stratège arrive dans « la course »**, alors qu'elle porte sur le vent | Étape 3.4 | Une question sur le vent après les cartes et les questions du large |
| T9 | **Les cartes qui changent le risque ou la voile** agissent au déplacement | Étape 2 tirée avant l'étape 3 | Si l'on place les voiles avant le large (T7), ces cartes ne jouent qu'au tour suivant |

## 3. Proposition : un arbre cohérent (à valider)

Principe : **une cause, un moment, une conséquence visible.** Chaque étape a son titre à l'écran ; tout ce qui touche aux voiles et au gréement se règle **avant** le large, au même endroit ; rien ne téléporte un bateau vers l'avant.

1. **Le choix** (inchangé).
2. **Le vent** : dés du vent ; **relance du Stratège ici**, juste après le jet (T8).
3. **Les voiles et le gréement** (nouvelle étape, tous les bateaux d'un coup, en carte 3D pour les joueurs) :
   - voile inutilisable → affalage (🎬 voile affalée, explication dessous) ;
   - **tempête F9 et plus** → 🎬 « Vous êtes au cœur d'une tempête, votre gréement souffre ! », puis la boussole ou le dé de tempête ; démâtage (🎬 le mât tombe) ou chavirage (🎬 le bateau se couche) ;
   - **case noire et dé de risque** → décision « réparer ou endurer » en carte 3D (« Endurer » fait lâcher la voile, déjà fait).
   - 🤖 mêmes règles, résumé en une ligne (« Les IA : 2 démâtages, 1 voile perdue »).
4. **Le large** : boussoles, puis questions et cartes. Une carte qui touche le risque ou une voile s'applique **au tour suivant** (T9, à décider).
5. **La course** : déplacements, collisions, arrivée ; IA groupées.
6. **Fin de tour** : classement, une scène 3D, fronts annoncés.

**Démâtage et chavirage (T1 à T4), deux variantes :**
- **(a) Le bateau rejoint le port par la mer.** Démâté, il met le cap sur le port de secours le plus proche (Lorient, La Corogne, Açores…) sous gréement de fortune, à petite vitesse, sur la carte et au fil des tours ; au port : réparation complète, 1 tour perdu, puis il repart **de ce port**. Jamais de téléportation. 🧑 choisit : « rejoindre Lorient » ou « continuer sous gréement de fortune ».
- **(b) Réparation sur place.** Pas de déplacement : le bateau passe 2 tours (démâtage) ou 3 tours (chavirage) sur place, puis repart avec un gréement de fortune amélioré (voile réduite et J3, par exemple). Plus simple, sans port.

**Force de la tempête (T3)** : garder 5 chances sur 6 de démâter à F11, ou réduire (par exemple F9 : rien ; F10 : 6 ; F11 : 5 et 6), la voile réduite ou la cape protégeant mieux.

## 4. Décisions du porteur de projet (13/11/2026)

- **Étape « Les voiles » entre le vent et le large** : oui. **Si une voile est perdue à cette étape, le tour du bateau s'arrête là : pas de dé du large.**
- **Propositions de la partie 3 appliquées**, sauf T9 : **une carte du large ne s'applique pas si le bateau a déjà une pénalité ce tour** (au lieu de la reporter au tour suivant).
- **Démâtage (monocoque)** : le bateau est **rapatrié par la mer au port de secours le plus proche** (n'importe lequel de la liste, pas seulement Lorient) ; **1 tour pour rentrer au port, 1 tour de réparation**. Le trajet **respecte les zones de course** : jamais à travers la terre ni les DST.
- **Chavirage d'un multicoque : fin de course.**
- **Tempêtes** : chances de démâter inchangées (F9 : 6 ; F10 : 4 à 6 ; F11 : 2 à 6).
- **La boussole** (camembert à 6 parts) remplace les dés.
- **Relance du Stratège** juste après les dés du vent ; **animations** de tempête, de démâtage et de chavirage en carte 3D, rejouées pour les autres joueurs (propositions de la partie 3).
- À critiquer puis améliorer ensemble : **la cohérence des règles de perte de voile quand le vent tourne ou forcit** (réponse dans la discussion du jeu du 13/11).

## 5. Questions de départ au porteur de projet (réponses ci-dessus)

1. **Étape « Les voiles » entre le vent et le large** : d'accord pour y regrouper affalage, tempête, case noire et dé de risque, et pour appliquer au tour suivant les cartes du large qui changent le risque ou la voile ?
2. **Démâtage et chavirage** : variante (a), le bateau rejoint le port par la mer, ou (b), réparation sur place ?
3. **Tempête** : garder les chances actuelles de démâter (F11 : 5 sur 6) ou les réduire ?
4. **Relance du Stratège** : la placer juste après les dés du vent ?
5. **Animations** : d'accord pour le message « Vous êtes au cœur d'une tempête, votre gréement souffre ! » et des scènes de démâtage et de chavirage, en carte 3D, rejouées pour les autres joueurs ?
