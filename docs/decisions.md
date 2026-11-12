# Décisions validées avec le propriétaire

Toute nouvelle règle doit être validée par le propriétaire, puis ajoutée ici avec sa date.
Les valeurs chiffrées sont reprises dans `donnees/bareme_*.csv` et `donnees/parametres.csv`.

## Notation des marins et des bateaux (validé le 05/11/2026)

### Toutes les courses comptent, en solo comme en équipage
- Toutes les courses comptent, **en solitaire comme en double ou en équipage**.
- Le **skipper** est majoré de **+50 %** par rapport à un équipier. Concrètement : skipper 100 %, co-skipper ou équipier 67 %. Ainsi, les points d'une course en solitaire restent ceux du barème.

### Formule
**Points = Base du niveau × coefficient de place × coefficient de flotte × coefficient de rôle**

### Niveaux de course

| Niveau | Nom | Base | Coefficient de flotte | Exemples |
|---|---|---|---|---|
| 1 | Monuments | 300 | **non** | Courses majeures tous les 4 ans : Vendée Globe, Route du Rhum, The Ocean Race… |
| 2 | Grandes courses | 150 | oui | Grandes courses tous les 2 ans et **course phare annuelle d'une classe** : Transat Jacques Vabre, transat Figaro, Mini Transat, Solitaire du Figaro… |
| 3 | Régates historiques | 50 | oui | **Uniquement** les régates côtières historiques qui attirent des skippers performants : Spi Ouest-France, Rolex Fastnet Race, Sydney-Hobart… |
| 4 | Championnat de saison | 25 | oui | Courses qui comptent pour le championnat de saison d'une classe. Elles valent **moins** que les régates historiques. |
| 0 | Non retenue | 0 | — | Toutes les autres courses et régates |

### Coefficient de place
1er = 1 · 2e = 0,73 · 3e = 0,53 · 4e = 0,40 · 5e = 0,30 · 6e = 0,23 · 7e = 0,17 · 8e et au-delà = 0,08 · abandon = 0.
Cette échelle reprend celle de l'ancien barème du Vendée Globe (300 / 220 / 160 / 120 / 90 / 70 / 50 / 25).

### Coefficient de flotte (niveaux 2, 3 et 4 uniquement)
- 20 partants ou plus : 1
- De 10 à 19 partants : 0,8
- De 5 à 9 partants : 0,6
- Moins de 5 partants : 0,4

### Exemples
- Vendée Globe, 1er : 300 points, quel que soit le nombre de partants.
- Transat Jacques Vabre, 1er sur 40 : skipper 150, co-skipper 100.
- Transat de niveau 2, 1er sur 4 : skipper 60.
- Fastnet, 3e sur 300 : skipper 27.
- Course de championnat, 1er sur 25 : skipper 25.

### Saisons des classes (précisé par le propriétaire)
- Chaque classe a ses **courses majeures** (tous les 4 ans), ses **grandes courses** (tous les 2 ans) et un **championnat de saison** fait de courses plus petites.
- **Figaro :**
  - la **Solitaire du Figaro** est annuelle, se court **par étapes**, et c'est la course phare : niveau 2 ;
  - la **transat Figaro** est bisannuelle et a changé de nom plusieurs fois (Transat AG2R, Transat Paprec…) : niveau 2 ;
  - les autres courses comptent pour le championnat : niveau 4.
- **Exigence :** aucune erreur d'attribution entre les variantes de noms. On rapproche par **nom + classe + année**.

### Niveaux des courses (validé le 09/11/2026)
Table de référence : `donnees/niveaux_courses.csv` (variantes de noms regroupées ; colonne `statut`).
- **Niveau 1 (Monuments)** : Vendée Globe, Route du Rhum, The Ocean Race (ex-Whitbread, ex-Volvo), BOC Challenge / Around Alone / Velux 5 Oceans, Arkea Ultim Challenge, et **Globe 40** pour la classe Class40.
- **Niveau 2 (Grandes courses)** : Transat Jacques Vabre / Café L'Or, Transat anglaise (OSTAR, The Transat CIC), Mini Transat, transat Figaro (AG2R, Paprec…), Solitaire du Figaro (et Course de l'Aurore), Québec–Saint-Malo, Brest Atlantiques, New York–Vendée, Retour à la Base, Transat en double (Twostar, Lorient–Saint-Barth), Admiral's Cup, Ocean Race Europe, Ton Cups jusqu'en 1995, **Barcelona World Race et Golden Globe** (retirés du niveau 1 par le propriétaire).
- **Niveau 3 (Régates historiques, liste fermée)** : Rolex Fastnet Race, Spi Ouest-France, Sydney-Hobart, Rolex Middle Sea Race, RORC Caribbean 600, Tour de France à la voile ; ajoutés le 11/11/2026 : Transpac (Los Angeles–Honolulu) et Newport–Bermuda.
- **Partants inconnus** : coefficient de flotte **0,8**.

### Niveau 4, catégories et étapes (validé le 11/11/2026)
- **Niveau 4 (championnat)** : listes de courses par classe de `donnees/niveaux_courses.csv`, validées telles quelles (IMOCA, Class40, Figaro, Mini 6.50, multicoques), avec deux changements :
  - **Ocean Race Europe : niveau 3** (et non 2) ;
  - **Les Sables–Les Açores–Les Sables : niveau 3** pour les Mini 6.50, un cran en dessous de la Mini Transat.
- Le circuit TP52 : voir « TP52 » plus bas (validé le 11/11/2026).
- **Ton Cups après 1995 (époque rétro) : niveau 4.**
- **Global Ocean Race (Class40, 2008-2009 et 2011-2012) : niveau 1**, comme la Globe 40. Les fiches l’appellent « Ocean Race » : elle ne se confond ni avec The Ocean Race ni avec l’Ocean Globe Race.
- **Catégories d'une course multi-classes** (Route du Rhum : Rhum Mono, Rhum Multi, catégories amateurs) : **niveau 4**.
- **Courses par étapes :** le classement général compte, et **chaque victoire d'étape rapporte 10 points**, quel que soit le niveau de la course (skipper 10, co-skipper ou équipier 67 %). Les prologues et les manches de régate ne sont pas des étapes.
- Les courses sans niveau valent 0.
- ~~Bateaux d'avant 1986 rangés en IMOCA : faut-il une classe « pré-IMOCA » ?~~ Tranché le 09/11/2026 : pas de classe à part, ils restent dans la liste des 60 pieds Open (voir « Harmonisation »).

## Records (validé le 05/11/2026)
- Un record homologué rapporte un **bonus important** :
  - tour du monde en solitaire : 300 (autant qu'une victoire au Vendée Globe) ;
  - traversée de l'Atlantique Nord en solitaire : 150 ;
  - distance en 24 h en solitaire : 100.
  Voir `donnees/types_records.csv`.
- Le **détenteur actuel** touche 100 % du bonus. Quand le record est battu, l'**ancien détenteur** garde le bonus moins **30 %** (paramètre `reduction_ancien_record`). Ce doit rester un bonus important dans une carrière.
- Un marin qui bat **son propre** record n'est compté qu'une fois, avec sa meilleure performance.
- Les records déjà saisis (historique du tour du monde en solitaire) sont **à vérifier auprès du WSSRC**.

## Classements (validé le 05/11/2026)
- Classements **glissants** calculés par rapport à une **année de référence quelconque** : all time, 20 ans, 10 ans, année en cours. Avec 1985 comme référence, on retrouve le classement de 1985. Il faudra aussi pouvoir choisir une période libre (de l'année X à l'année Y).
- « All time » commence à l'**année de démarrage** : 1960 (paramètre).
- Classements **toutes classes** et **filtrables par classe** (IMOCA, Ultim, Figaro, Mini 6.50, Class40…). De nouvelles classes, y compris anciennes, arriveront depuis le site : le système doit les accepter sans modification.
- Il y a deux classements : les **marins** et les **bateaux**. Un bateau cumule les points des résultats obtenus avec lui.

## Organisation (validé le 05/11/2026)
- Le but final est un **site internet robuste et fiable**. Aucun fichier Excel n'est nécessaire.
- **Source de vérité :** les fichiers CSV de `donnees/`, versionnés dans un dépôt GitHub privé. Les deux projets (base et site) vivent dans ce même dépôt.
- Les **captures brutes** du site sont archivées hors Git, en HTML + JSON, dans des dossiers datés. Elles servent à relire les fiches et à repérer les incohérences.

## Harmonisation des deux projets (validé le 09/11/2026)
Détail et alternatives écartées : `docs/harmonisation.md`.
1. **Langages** : Node.js pour le site et son scraping ; Python pour la base et les classements.
2. **Source de vérité en deux couches** : les corrections du site se font dans ses compléments sourcés (`site/content/`) ; la base exportée (`donnees/site/`) se régénère et ne se corrige jamais à la main ; barème et ancien classement restent dans `donnees/*.csv`.
3. **Identifiants figés** : les adresses actuelles du site deviennent les identifiants définitifs, dans un registre ; un nom corrigé ne change plus l'identifiant ; les anciennes adresses publiées sont redirigées.
4. **Pages de l'auteur dans Git**, en fichiers HTML ordinaires (pas de zip) : tout ce qui sert à reconstruire le site va dans Git ; les captures de contrôle, qu'on peut recréer, vont sur Google Drive.
5. **Écriture officielle des classes**, site et base : IMOCA, Ultim, Ocean Fifty, MOD70, Class40, Figaro, Mini 6.50 ; ORMA 60, Maxis, Half Tonner, Quarter Tonner, Trois-quarts Tonner.
6. **60 pieds d'avant l'IMOCA** : pas de classe « pré-IMOCA », ils restent dans la liste des 60 pieds Open.
7. **Rôles** : skipper → skipper (100 %) ; co-skipper ou équipier → équipier (67 %) ; propriétaire et marin « cité, pas à bord » → aucun point.
8. **Mise en ligne** : jamais sans l'accord explicite du propriétaire, donné pour cette mise en ligne (site et jeu).
9. **Photos** : seulement des photos libres de droit (Wikimedia Commons), créditées avec auteur et licence ; pas de photo du site de l'auteur sans son accord écrit.

## Site (décisions prises avec le propriétaire, 03 au 09/11/2026)
- **Nom** : « Mémoire du large », sous-titre « Bateaux, courses et marins ». Il se présente comme une référence fondée sur des **sources ouvertes** (histoiredeshalfs.com, Wikipédia, sites des courses) ; l'auteur de histoiredeshalfs.com reste crédité, avec son adresse de contact. Accueil : « Des bateaux, des courses, et ceux qui leur donnent vie : les marins », avec « les courses qui ont fait naître des légendes » dans le sous-titre.
- **Fiche bateau** : une frise visuelle (un point par changement de nom ou événement notable), les noms successifs (le « (2) » des homonymes n'est pas affiché), une chronologie détaillée. Un bateau commandé mais pas encore à l'eau est présenté « en projet, mise à l'eau prévue en … », jamais comme construit.
- **Exactitude** : une annonce de vente republiée n'est pas un événement de navigation ; un marin cité dans un hommage, une comparaison ou un sauvetage n'est pas à bord ; on distingue skipper, co-skippers et tiers.
- **Page d'une classe**, en onglets : *La classe* (histoire sourcée et course d'origine, étapes marquantes, « Ils ont marqué la classe » : vainqueurs de la course phare et disparus en mer, courses passées liées à leurs résultats, archives de l'auteur) ; *Les bateaux* (liste par numéro à la mise à l'eau et nom de baptême ; les noms passés sont cherchables mais pas affichés) ; *Calendrier* (la saison, en vue calendrier) ; *Architectes* (architectes, plans et chantiers de la classe).
- **Base des bateaux** : architecte, modèle et **chantier de construction** (jamais un chantier de refit) ; un clic sur un architecte, un plan ou un chantier liste tous ses bateaux de la classe ; les différentes écritures d'un même nom sont unifiées ; Structures construit tous les Pogo (Mini et Class40).
- **Menu** : « Monocoques » (IMOCA, Class40, Figaro, Mini) avec un lien « Autres monocoques historiques » ; « Multicoques » classe par classe ; pas de « Monocoques Open » ; une course (Whitbread) ne figure pas parmi les classes.
- **Courses** : une page par course avec son palmarès classe par classe (complet depuis la première édition), puis une page par édition (podium d'après les sites officiels ou Wikipédia) ; noms de bateaux et de skippers liés à leurs fiches. Un bateau n'est lié à sa fiche que si la base le confirme pour cette année (en cas de doute, pas de lien). Accueil : « L'histoire des grandes courses » (Vendée Globe, Route du Rhum, Transat Jacques-Vabre, The Ocean Race, Solitaire du Figaro, Mini Transat, Fastnet, Trophée Jules-Verne) et un lien vers toutes les courses.
- **Solitaire du Figaro** : une page retrace la Course de l'Aurore (1970) → Solitaire du Figaro → Figaro 1, 2 et 3, avec un palmarès sourcé.
- **Calendrier** : un vrai calendrier (vue année et vue mois), une fiche par course, une légende des couleurs de classes ; pas de longs textes.
- **Liste des skippers** : nombre de victoires, pas de colonne « Classements » ; années d'activité sur une ligne.
- **Design** : sélecteur Moderne / Rétro dans l'en-tête ; photos en vitrine mises de côté jusqu'à la reprise du design.

## Une seule version, assumée (validé le 10/11/2026)
- Le site est celui du propriétaire : il **assume une seule version des faits**. On n'affiche **jamais** de désaccord entre l'auteur et la rédaction (ni « selon l'auteur… selon la classe… », ni « les deux versions restent visibles »).
- Quand deux sources se contredisent (fiche de l'auteur, site officiel d'une classe…), on **vérifie** (relire la fiche d'origine, chercher une troisième source fiable) puis on **corrige** le site dans ses compléments sourcés, avec la source. Tant que ce n'est pas tranché, le doute reste dans les rapports internes (`controles/`), pas sur le site.
- Les ajouts restent signalés « Ajout de la rédaction » avec leurs sources (règle du projet).

## Lecture des fiches bateaux (validé le 09/11/2026)
- **Nom de baptême** : c'est le premier nom daté du bateau, et le titre de sa fiche sur le site le reprend. Quand la lecture automatique se trompe, le nom est établi à la main d'après la fiche d'origine, avec la ligne qui le prouve (`site/content/baptemes.json`). Jamais de nom déduit d'une seule source douteuse (nom de photo, revue).
- **Numéro de voile « à la mise à l'eau »** : le numéro de la liste de l'auteur ; celui de l'en-tête de la fiche reste affiché parmi les numéros portés. Exception constatée sur le trimaran Macif (« M13 Macif, FRA 301 », devenu « Actual Leader 2, FRA 53 ») : dans les classes modernes, le numéro écrit avec le nom de baptême fait foi quand la fiche montre que le bateau a changé de numéro ensuite. Corrections : `site/content/numeros.json`.
- **Adresses** : l'adresse d'une fiche publiée ne change plus (registre `donnees/identifiants.csv`).
- **Un bateau, une fiche** (09/11/2026) : un dossier de l'auteur qui raconte la vie d'un seul bateau sous ses noms successifs donne un seul bateau, même si son nom de fichier n'a pas de chiffre (Groupama 3 était présenté comme cinq bateaux). Liste vérifiée sur l'en-tête de chaque dossier : `site/content/dossiers-un-bateau.json`. En cas de doute de l'auteur (« le même ou différents bateaux ? »), on ne fusionne pas.

## TP52 : rôles à bord (09/11/2026)
Les TP52 courent en équipage ; l'auteur indique rarement « Skipper: » (une vingtaine de cas). Il écrit surtout un nom en capitales, en brun, après le résultat. Extraction : `outils/tp52/extraire.py`.
1. **Nom seul en capitales sur un résultat** (aucun « Skipper: » écrit) : **skipper**, marqué « à vérifier » (convention de l'auteur). Validé.
2. **Nom en capitales à côté d'un « Skipper: » écrit** (« Mark JONES , Skipper: Dick Watts ») : **équipier (67 %)**, car en TP52 le propriétaire est à bord. Il en va de même pour un nom marqué « Owner » sur un résultat. Un propriétaire cité hors d'un résultat (vente, achat) ne marque rien. Validé le 09/11/2026, en remplacement de « propriétaire sans point ».
- La règle 1 ne vaut que pour un nom **écrit en capitales**. Un nom en minuscules sans étiquette garde un rôle inconnu.
3. **Résultat sans nom** : le skipper n'est reporté que si le résultat nommé précédent et le suivant, dans la même saison et sous le même nom de bateau, portent le même skipper. Il est alors marqué « déduit ». Sinon, skipper inconnu. Validé (dans 80 cas sur 108, le nom changeait entre les deux).
4. **Équipage déclaré en tête d'année** (avant la première course, par exemple la MedCup 2006) : il vaut pour les courses de la saison sous le même nom de bateau, sauf pour une course qui nomme quelqu'un d'autre. Il est marqué « équipage de saison ». Validé le 09/11/2026.
5. **« Skipper » et « Helm » (barreur) différents** : celui écrit « Skipper » marque 100 %, le barreur compte comme équipier (67 %). Validé le 09/11/2026.
- « X et Y », « X & Y » sans autre étiquette : rôle inconnu (peut-être deux co-propriétaires), on ne devine pas.
- Étiquettes écrites : Skipper / Helm / barreur → skipper ; Tactician / Navigator / Strategist / Crew / with / avec → équipier ; Owner → propriétaire ; Coach → cité. Un marin rattaché à aucun résultat (annonce de vente, article) est cité et ne marque aucun point.
- **Niveaux des courses TP52 (validé le 11/11/2026)** :
  - **Mondial TP52** = niveau 2 : c'est la course phare annuelle de la classe (Rolex TP52 Global puis World Championship, Gaastra 52 World Championship). Les ORC Worlds n'en sont pas ;
  - **épreuves du circuit** (MedCup 2005-2011, puis 52 Super Series) = niveau 4. Le classement de saison du circuit ne s'y ajoute pas (niveau 0) ;
  - **Transpac** (Los Angeles–Honolulu) et **Newport–Bermuda** entrent dans la liste fermée des régates historiques (niveau 3), pour toutes les classes ;
  - **place retenue** : celle qu'écrit l'auteur, même dans une catégorie à handicap (« 3e/9 IRC A » compte avec 9 partants).
- **Pourquoi le propriétaire est à bord** : faits vérifiés : la classe n'impose pas que le propriétaire barre. La jauge (règle C.2.1) renvoie aux statuts de la classe et permet aux épreuves d'imposer un propriétaire-barreur ou un barreur amateur. La règle C.2.2 compte le poids du propriétaire dans celui de l'équipage. Le 52 Super Series admet un barreur professionnel, mais le propriétaire est alors à bord comme « invité ». Sources : jauge TP52 2023 (transpac52.org), avis de course du 52 Super Series 2026.
- **Frise « En un coup d'œil »** (09/11/2026) : elle commence à la **mise à l'eau** ; l'annonce, la commande et le chantier n'y figurent pas (sauf bateau encore en projet). Un bateau n'y est **perdu qu'une fois** : l'épave retrouvée plus tard reste dans la chronologie détaillée, pas dans la frise. La chronologie détaillée, elle, reste complète.
