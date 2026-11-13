# Audit de fluidité des parties (13/11/2026)

Demande du porteur de projet (13/11/2026) : « je veux absolument améliorer la jouabilité en accélérant les tours de jeu. Tu dois faire un audit des parties et notamment des parties en réseau avec ou sans IA afin d'identifier les lenteurs et toutes les situations où ce n'est pas fluide. On fera l'analyse au cas par cas des situations à modifier ensuite. »

**Cet audit ne change rien au jeu.** Il relève les situations ; le porteur de projet choisit ensuite, ligne par ligne, ce qu'on modifie (colonne « Choix », à remplir).

## Comment les chiffres ont été obtenus

- **Lecture du code** (version de la branche `mises-a-jour-jeu` du 13/11/2026) : chaque durée d'animation, chaque minuterie, chaque clic obligatoire, avec l'endroit du code (fichier:ligne) pour pouvoir le retrouver.
- **Parties rejouées avec le vrai moteur** sur le PC portable : 30 parties de Route du Rhum en IMOCA (1 humain joué par le routeur + 3 IA), auxquelles on applique les durées d'animation du jeu ; 48 parties « réseau » simulées (le serveur refait exactement ce qu'il fait en ligne : calcul, sauvegarde, envoi à chaque joueur), sur le Rhum, la Transat Café L'Or, le Fastnet et le Vendée Globe, avec 4 et 8 bateaux.
- **Limites** : rien n'a été chronométré dans un navigateur ni sur le serveur en ligne ; les temps sur téléphone sont **estimés** (3 à 5 fois plus lents que le PC). Les durées sont données à la vitesse ×1.

## En bref

1. **Ce qui prend le temps, ce sont les animations et les attentes, pas le calcul.** Le calcul d'un tour (IA comprises) prend moins d'un dixième de seconde sur PC. Un tour en solo (1 joueur + 3 IA) impose en revanche **environ 32 secondes d'animations**, et **6 clics** en moyenne ; une partie de Rhum en IMOCA, c'est environ **9 minutes d'animations** à ×1, sans compter la réflexion.
2. **Les plus gros postes** : les scènes 3D de 10 s (8,6 s par tour en moyenne), les dés du vent (6,5 s à chaque tour), le dé du large du joueur (1 clic puis 3,6 s), et environ 7,5 s par tour de « temps morts » pendant lesquels les IA tirent leurs cartes et leurs dés sans rien montrer.
3. **En réseau**, le jeu s'arrête à chaque décision d'un joueur (question, relance, carte réparation), **une à la fois**, et chacune attend que ce joueur ait fini de regarder son animation. Il n'y a **aucun minuteur** : un joueur distrait bloque toute la table. Le serveur renvoie aussi **toute la partie** (60 à 230 Ko) à chaque clic de chaque joueur.
4. **Sans toucher aux règles**, quatre corrections simples (A2 à A5 ci-dessous) ramèneraient le temps imposé d'un tour solo d'environ 32 s à **environ 8 s** (hors scènes 3D, dont la durée de 10 s est une demande du porteur de projet du 10/11/2026).
5. Deux **erreurs probables** ont été repérées au passage (E1, E2), à vérifier en jeu.

## Durée d'un tour aujourd'hui

| Mode | Animations imposées (rien passé) | En passant tout ce qui peut l'être | Clics par tour |
|---|---|---|---|
| Solo, 1 joueur + 3 IA | environ 32 s (90 % des tours sous 38 s) | environ 19 s | 4 au minimum, 6 en moyenne |
| Même écran, 2 joueurs | environ 30 s | environ 16 s | 10 au minimum, 13 en moyenne |
| Même écran, 2 joueurs + 2 IA | environ 40 s | environ 22 s | environ 13 |
| Réseau, 2 joueurs, 4 bateaux | environ 25 s + scènes 3D + attente de 1 décision (jusqu'à 2) | | |
| Réseau, 4 joueurs, 8 bateaux | environ 46 s + scènes 3D + attente de 2 décisions en série (jusqu'à 3 à 5) | | |

Répartition en solo (1 joueur + 3 IA), par tour : scènes 3D 8,6 s · dés du vent 6,5 s · dé du large du joueur 3,6 s · cartes des IA 2,7 s · dés du large des IA 2,2 s · déplacements des IA 2,2 s · déplacement du joueur 1,4 s · débuts de tour des IA 1,1 s · paquet de la carte du joueur 0,9 s · début de tour du joueur 0,7 s.

## Choix du porteur de projet (13/11/2026)

Retenus et **faits le 13/11/2026** (branche `mises-a-jour-jeu`, non publié) : E1, E2, A2, A3, A4, A5, C1, C2, C4, C5, C6, et A1 avec des scènes 3D de **8 s** au lieu de 10. Réglages et délais : `jeu/docs/decisions-jeu.md` (13/11/2026). Vérifié en local : partie en réseau à deux joueurs et deux IA sur un serveur de salons lancé sur le PC (minuteur du choix, décision affichée tout de suite, carte de l'autre joueur sans clic, page rechargée reconnectée, place reprise depuis un autre onglet).

Pas faits dans ces lignes retenues : en C1, « préparer questions et réparations pendant le choix du cap » (il faudrait tirer le dé du large avant les déplacements, donc changer l'ordre du tour : à décider à part) ; en A4, la petite icône sur le bateau (le résumé dans la consigne du tour la remplace) ; en A5, l'animation plus légère de la carte (c'est D5, non retenu).

## Les situations, une par ligne

### A. Le déroulé d'un tour (tous les modes)

| N° | Où | Combien | Pourquoi | Pistes | Choix |
|---|---|---|---|---|---|
| A1 | **Scènes 3D** pendant le tour (dépassement, navigation à vue, petit temps, coup de vent, louvoyage, voile perdue, arrivée) | 10 s chacune ; 0,86 scène par tour en solo (8,6 s), 1,15 à 2 joueurs + 2 IA ; deux dans le même tour possibles ; « Passer la scène » = 1 clic à chaque fois (`Jeu.tsx:47`, `:386`, `:708`) | Durée fixe (demande du 10/11/2026) et moments déclencheurs fréquents | Durée selon le moment (4 à 5 s pour un dépassement ou « à vue ») ; ne plus montrer « à vue » et « petit temps » à chaque fois ; réglage « scènes : toutes / importantes / aucune » | **Retenu : 8 s au lieu de 10 (13/11), fait** |
| A2 | **Dés du vent**, à chaque tour | 6,5 s ; le résultat est visible à 2,2 s, « Continuer » n'apparaît qu'à 2,2 s (`Jeu.tsx:265-268`, `:681`) | Temps de lecture fixe | Avance automatique vers 3 à 3,5 s ; toucher l'écran ou la barre d'espace pour passer ; enchaîner directement sur le dé du large | **Retenu (13/11), fait** |
| A3 | **Dé du large du joueur**, à chaque tour et pour chaque joueur humain | 1 clic obligatoire, puis 3,6 s qu'on ne peut pas passer (`Jeu.tsx:279-286`, `:668-673`) | Le moteur a déjà tiré le dé : le clic n'est qu'une mise en scène | Option « lancer automatiquement » ; avancer dès le résultat (environ 1,5 s) ; un seul clic pour « Lancer » et « Continuer » | **Retenu (13/11), fait** |
| A4 | **Temps morts des IA** (cartes, dés du large, questions, débuts de tour des IA) | Environ 7,5 s par tour en solo (carte d'une IA 1,8 s, dé d'une IA 0,9 s, début de tour 0,38 s) (`Jeu.tsx:237`, `:287`, `:298`) | Le bandeau est masqué pendant la lecture ; seule une ligne du journal change, et le journal est fermé par défaut sur téléphone (`Jeu.tsx:67`, `:661`) | Durée presque nulle pour ces moments ; un résumé groupé (« IA : 2 cartes, 1 question ») ; une petite icône sur le bateau concerné | **Retenu (13/11), fait** |
| A5 | **Déplacements des bateaux**, un par un | Environ 3,6 s par tour en solo + 1,8 s de débuts de tour (140 ms par case pour le joueur, 70 ms pour une IA) (`Jeu.tsx:436-456`) | Lecture bateau par bateau ; l'animation redessine toute la carte 25 fois par seconde | Faire bouger toutes les IA en même temps ; animation plus légère (voir D5) | **Retenu (13/11), fait** |
| A6 | **Carte du large du joueur** (un tour sur deux) | Paquet de 1,7 s (on peut le toucher pour passer), **non accéléré par ×2 ou ×4** ; puis texte à lire et 1 clic (`CarteEvenement.tsx:95`) | Durée fixe, ne suit pas la vitesse choisie | Tirage en 0,8 s ; suivre la vitesse ; carte sans effet affichée en bandeau, sans clic | |
| A7 | **Question du large** (un tour sur trois, quiz activé) | 2 clics (réponse puis « Continuer »), chrono de 20 s par défaut, explication à lire (`Modales.tsx:44-63`) | Validation en deux temps | Avance automatique après 3 s sur une bonne réponse | |
| A8 | **Dés spéciaux** (tempête, pot-au-noir, case noire, voile inutilisable) | 4,2 s, 3,8 s, 5 s, sans pouvoir les passer un par un (`Jeu.tsx:244`, `:394-426`) | Durées fixes | Toucher pour passer ; environ 2,5 s | |
| A9 | **Bouton de vitesse ×1 / ×2 / ×4** | Revient à ×1 à chaque partie ; caché sur téléphone ; le changer **relance l'animation en cours depuis le début** (`Jeu.tsx:75`, `:470`, `styles.css:489`) | Réglage non mémorisé ; la vitesse fait repartir la lecture | Mémoriser le réglage ; le laisser visible sur téléphone ; changer de vitesse sans recommencer | |
| A10 | **« Passer l'animation »** | Tout ou rien : saute aussi la carte du large du joueur, qu'il ne voit pas (`Jeu.tsx:491-498`) | Un seul bouton pour toute la lecture | « Passer jusqu'à ma prochaine décision » | |
| A11 | **Début de partie** | Solo : 5 clics, 4 écrans + le briefing ; même écran à 2 : environ 8 clics | Configuration complète à chaque fois | Bouton « Partie rapide » sur l'accueil (derniers réglages, skipper au hasard) | |
| A12 | **Fin de partie** | Scène d'arrivée de 10 s, puis « Voir les résultats » et « Rejouer » (2 clics) | | Rien d'urgent | |

### B. Même écran

| N° | Où | Combien | Pourquoi | Pistes | Choix |
|---|---|---|---|---|---|
| B1 | **Passage de main** entre joueurs, à chaque tour | +1 clic par joueur et par tour ; chaque joueur lance aussi son dé du large ; cartes et questions s'affichent pour tous (`Jeu.tsx:505`, `Modales.tsx:127-137`). Les animations ne sont pas répétées pour chacun (bon point) | Écran « à toi de jouer » pour cacher le choix de l'autre | Bouton « Valider et passer à <nom> » qui fait les deux | |
| B2 | **Aperçu 3D du volet de droite** (grand écran) | Détruit puis recréé à chaque passage de main : saccade estimée 0,1 à 0,3 s, non mesurée (`Jeu.tsx:718-721`, `Apercu3D.tsx:33-47`) | Le composant 3D est retiré puis remis | Le garder en place, simplement masqué | |

### C. Réseau

| N° | Où | Combien | Pourquoi | Pistes | Choix |
|---|---|---|---|---|---|
| C1 | **Décisions des joueurs pendant la résolution** (question, relance, carte réparation) | 1 décision bloquante par tour à 2 joueurs (jusqu'à 2) ; 2 par tour à 4 joueurs + 4 IA (jusqu'à 3 à 5) ; 31 sur une partie de 15 tours. Chacune attend la fin de l'animation du joueur concerné, puis sa réponse (`moteur.ts:437-467`, `Jeu.tsx:506`) | Le moteur s'arrête à la première décision ; le serveur attend, renvoie la partie, s'arrête à la suivante : **tout se fait en file**, rien en parallèle | Afficher la décision dès que le serveur la demande, sans attendre la fin de l'animation ; préparer questions et choix de réparation pendant la phase de choix du cap ; réponse par défaut après N secondes | **Retenu (13/11), fait** |
| C2 | **Aucun minuteur** (choix du cap, question, relance, réparation) | Un joueur lent ou parti, mais toujours connecté, bloque la table sans limite. Le chrono du quiz affiche seulement « Temps écoulé » : rien n'est envoyé tant qu'on ne clique pas sur « Continuer » (`Modales.tsx:18-28`, `:62`). « Confier à l'IA » n'est proposé qu'à l'hôte, et seulement si le joueur paraît déconnecté (`Jeu.tsx:619-620`) | Le serveur n'a ni alarme ni délai : tout repose sur un clic | Minuteur côté serveur qui joue la réponse par défaut ou passe la main à l'IA ; « Confier à l'IA » aussi pour un joueur inactif ; transmettre le rôle d'hôte si l'hôte part | **Retenu (13/11), fait** |
| C3 | **Animations rejouées chez chacun**, à son rythme | Tour estimé à 25 s (2 joueurs, 4 bateaux), 35 s (1 joueur, 8 bateaux), 46 s (4 joueurs, 8 bateaux), sans scène 3D ni clics ; le choix du tour suivant n'est proposé qu'une fois l'animation finie (`Jeu.tsx:502-504`). Le dé du large de chaque autre joueur roule 4 s chez tous (`Jeu.tsx:273-278`) | Chaque appareil lit tous les événements ; le plus lent fixe la cadence de la table | Animations des autres raccourcies ou regroupées en réseau ; pouvoir choisir son cap pendant la fin de l'animation ; dé du large lancé automatiquement en réseau | |
| C4 | **Cartes du large des autres joueurs** | Chaque joueur doit cliquer « Continuer » sur la carte de **chaque autre** joueur, après 1,7 s de paquet (`Jeu.tsx:290-296`, `:782`) | Aucun test « est-ce ma carte ? » | Cartes des autres en bandeau automatique de 2 s | **Retenu (13/11), fait** |
| C5 | **Coupures** (téléphone en veille, changement d'application) | Pas de « ping » : une connexion à moitié morte paraît active plusieurs minutes (estimation) ; reconnexion après 1, 2, 4, 8 puis 10 s, seulement une fois la coupure constatée, pas au retour sur l'onglet ; un clic envoyé pendant une coupure est **perdu sans prévenir** ; les refus du serveur ne s'affichent pas pendant la course (`index.ts:149-156`, `reseau.ts:68-82`, `Reseau.tsx:76-97`) | Ni ping, ni file d'attente, ni accusé de réception | Ping régulier ; reconnexion immédiate au retour sur l'onglet ; renvoi des clics perdus et affichage des refus | **Retenu (13/11), fait** |
| C6 | **Recharger la page / changer d'appareil** | Rechargement : retour au formulaire « Rejoindre », à recliquer ; nouvel onglet ou autre appareil : « La course a déjà commencé », **la place est perdue** ; un bateau confié à l'IA ne peut pas être repris (`Reseau.tsx:31`, `index.ts:162`, `:211`) | Le jeton du joueur n'est gardé que dans l'onglet | Reconnexion automatique ; jeton gardé sur l'appareil ou code de reprise ; reprendre son bateau à l'IA | **Retenu (13/11), fait** |
| C7 | **Toute la partie renvoyée à chaque message** | 60 à 130 Ko par envoi au Rhum (jusqu'à 230 Ko en fin de partie à 8 bateaux, 330 à 430 Ko au Fastnet ou à la Transat) ; à 4 joueurs, environ 2,7 Mo par tour, environ 10 Mo par joueur sur une partie. Quand un joueur valide son cap, tout est renvoyé à tous, juste pour afficher « a choisi ». Composition : 65 % d'événements, 29 % de journal des mouvements (outil bêta) (`index.ts:241-256`) | Simplicité : on envoie tout | N'envoyer que les nouveautés (environ 10 fois moins) ; ne pas envoyer le journal bêta ; petit message « X a choisi » ; temps estimé gagné : 0,1 à 0,5 s par message en 4G, davantage en mauvaise couverture | |
| C8 | **Réveil du salon** après un moment calme | Moins de 0,2 s (estimation) | Le serveur relit tout le salon | Mineur | |
| C9 | **Calcul du serveur** au dernier choix | 50 à 100 ms par tour (jusqu'à 240 ms au Fastnet à 8 bateaux) : pas un problème de temps. **À vérifier** : la limite de calcul de l'offre gratuite de Cloudflare | Les IA ne sont calculées qu'après le dernier humain, alors qu'elles ne dépendent pas de ses choix | Calculer les IA pendant que les humains réfléchissent | |
| C10 | **Code de salon** | 4 lettres tirées au hasard sans vérifier qu'elles sont libres : un nouveau salon peut écraser une partie en cours (rare) (`index.ts:19-35`) | | Vérifier que le code est libre | |
| C11 | **Choix de la course en réseau** | Sur `mises-a-jour-jeu`, le réseau ne joue que la Route du Rhum ; la Transat et le Fastnet en réseau sont prêts sur la branche `reseau-transat-fastnet`, pas encore fusionnée | | Fusionner cette branche (déjà prévu) | |

### D. Calcul et affichage (tous les modes)

| N° | Où | Combien | Pourquoi | Pistes | Choix |
|---|---|---|---|---|---|
| D1 | **Clic « Valider »** en solo et en même écran | L'écran se fige le temps du calcul : 20 à 50 ms à 4 bateaux, 40 à 100 ms à 8 (jusqu'à 240 ms au Fastnet) sur PC ; 0,1 à 1 s estimé sur téléphone (`Jeu.tsx:163-176`) | Le moteur et les IA calculent dans la page, sur le même fil que l'affichage | Calcul en arrière-plan (« Web Worker ») ; IA calculées pendant que le joueur réfléchit | |
| D2 | **Calcul des IA** | Chaque décision trace environ 1 000 routes dont seulement 200 différentes : le même calcul est refait 5 fois ; le Fastnet, à 32 caps partout, double le travail (`ia.ts:137-179`) | Pas de mémoire des routes déjà tracées | Garder en mémoire les routes déjà calculées (calcul divisé par environ 5) | |
| D3 | **Rose des caps** (aperçu des 16 ou 32 caps) | 3 à 10 ms, jusqu'à 33 ms sur PC ; en réseau, recalculée chaque fois qu'un autre joueur valide (`TableauBord.tsx:259-269`) | Recalcul à chaque nouvel état reçu | Ne recalculer que si la position ou le vent du bateau change | |
| D4 | **Mer 3D** de l'aperçu du bateau (grand écran) et des scènes 3D | 9,5 ms par image juste pour calculer les vagues et l'écume (57 % du temps disponible pour une image), en continu ; saccades probables sur téléphone (`scene3d.ts:1360`, `:1453`, `:1918-1937`) | La mer (22 800 points) et 5 000 particules d'écume sont recalculées par le processeur à chaque image | Mer moins détaillée ou calculée par la carte graphique ; aperçu figé, redessiné seulement quand le cap ou la voile change ; moins d'écume | |
| D5 | **Carte 2D** | Redessinée en entier à chaque changement (19 500 points de côtes au Rhum), environ 25 fois par seconde pendant les déplacements, et à chaque glissement ou zoom (`Carte.tsx:655-657`, `:747-775`) ; quelques ms sur PC, plus de 10 ms estimées sur téléphone | Rien n'est gardé en mémoire d'une image à l'autre | Garder le fond (côtes, zones, quadrillage) en image toute prête ; ne redessiner que les bateaux | |
| D6 | **Chargement** | Programme de 3,2 Mo (1 Mo compressé) en un seul fichier, dont les côtes des tours du monde non proposés en ligne (1,1 Mo) ; les 6 modèles 3D (6,7 Mo) sont chargés à chaque partie, **quelle que soit la classe jouée** (`scene3d.ts:18-32`) | Tout est chargé d'avance | Charger seulement le modèle de la classe jouée ; compresser les modèles ; charger la 3D et les côtes à la demande | |

### E. Erreurs probables repérées au passage (à vérifier en jeu)

| N° | Où | Ce qui se passe | Pourquoi | Piste | Choix |
|---|---|---|---|---|---|
| E1 | **Carte du large qui immobilise** (environ 3 % des tours) | Message « Impossible d'avancer avec cette voile, vous allez tout casser ! » pendant 5 s, parfois avec la scène 3D de la voile qui s'affale, alors que la cause est la carte (`moteur.ts:905`, `Jeu.tsx:88`, `:242-244`, `:836`) | Le jeu confond l'immobilisation par la carte avec une voile inutilisable | Distinguer les deux cas (l'événement de la carte ne porte pas de voile) | **Retenu (13/11), fait** |
| E2 | **Dé du large, puis « Passer » ou changement de vitesse** dans les 3,6 s | Le jeu avance d'un cran de trop : **l'événement suivant est sauté**, probablement les dés du vent du tour suivant (`Jeu.tsx:668-673` : les deux minuteries du bouton « Lancer le dé du large » ne sont jamais annulées) | Minuteries non annulées | Annuler ces minuteries | **Retenu (13/11), fait** |

## Ordre conseillé (proposition, à décider)

1. **E1 et E2** : erreurs, sans changement de règle.
2. **A2, A3, A4, A5** : le plus grand gain sans toucher aux règles (un tour solo passerait d'environ 32 s à environ 8 s d'animations imposées, hors scènes 3D).
3. **Réseau : C1, C2, C4** (décisions sans attendre la fin de l'animation, minuteur, cartes des autres sans clic), puis C5 et C6 (coupures, reprise).
4. **A1** (scènes 3D) : le levier le plus fort, mais la durée de 10 s est une décision du porteur de projet (10/11/2026).
5. Le reste (A6 à A11, B, C7, D) selon les envies : surtout utile sur téléphone.

*Mesures et lecture du code : 13/11/2026, branche `mises-a-jour-jeu` (après le commit 172b0ce). Les scripts de mesure n'ont pas été gardés dans le dépôt ; les chiffres ci-dessus suffisent pour décider, et on remesurera après chaque modification.*
