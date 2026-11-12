# Bateaux légendaires, Ultims, Class 40 et « vintages » : proposition à valider

Demande du porteur de projet (09/11/2026) : la Route du Rhum se court sur plusieurs supports. Il faut ajouter
les **Ultims**, les **Class 40**, et un mode **« vintage »** pour jouer de vieux bateaux mythiques mis à l'eau
avant 2000. Cela demande un rang **« légendaire »** (ou « mythique ») pour certains bateaux, à chercher dans la base.

Rien n'est codé : ce document propose des critères et une première liste, **à valider**. Les faits viennent de
la base du site (`site/public/data/bateaux.json`, `donnees/site/palmares.csv`, issus de histoiredeshalfs.com).
Ceux qui n'y sont pas sont marqués **« à vérifier »** avec une source à trouver.

## 1. Critères proposés pour le rang « légendaire »

Un bateau est légendaire s'il remplit **au moins un** de ces critères :

1. **Vainqueur du Vendée Globe**, ou **vainqueur de la Route du Rhum toutes classes confondues**.
2. **Au moins deux victoires** dans les grandes courses : Route du Rhum (dans sa classe), Vendée Globe,
   Transat anglaise, Transat Jacques Vabre, Barcelona World Race, BOC Challenge / Around Alone, Québec-Saint-Malo.
3. **Détenteur d'un grand record** : Trophée Jules Verne, record de la traversée de l'Atlantique.
4. **Bateau qui a marqué l'histoire** de la course au large (premier de son espèce, skipper mythique),
   sur proposition et validation du porteur de projet.

Deux niveaux possibles, à trancher :
- **Légendaire** : critères 1 à 3, vérifiables dans la base.
- **Mythique** : critère 4 ou plusieurs critères à la fois (Pen Duick, PRB, Groupama 3…).

## 2. Candidats trouvés dans la base

### Mis à l'eau avant 2000 (mode « vintage »)

| Bateau | Classe dans la base | Lancé | Ce qui le distingue (d'après la base) | Fiche |
|---|---|---|---|---|
| Pen Duick III | classé « IMOCA 60 », **erreur probable** (goélette de Tabarly) | 1967 | Bateau d'Éric Tabarly ; palmarès à compléter | `imoca/pen-duick-iii/` |
| Écureuil d'Aquitaine II | IMOCA 60 | 1989 | Vainqueur du Vendée Globe 1989 (Titouan Lamazou) | `imoca/ecureuil-d-aquitaine-2-11/` |
| Bagages Superior | IMOCA 60 | 1992 | Vainqueur du Vendée Globe 1992 (Alain Gautier) | `imoca/bagages-superior-101/` |
| PRB | IMOCA 60 | 1999 | Vainqueur du Vendée Globe 2000 (Michel Desjoyeaux). **Double vainqueur** avec Vincent Riou en 2004 : **absent de la base, à vérifier** | `imoca/aito/` |
| Groupe Sceta | IMOCA 60 | 1990 | BOC Challenge 1990 (Christophe Auguin) et autres victoires | `imoca/groupe-sceta/` |
| Crédit Agricole / Crédit Agricole 3 | IMOCA 60 | 1982 / 1986 | BOC Challenge 1982 et 1986 (Philippe Jeantot) | `imoca/c-c-a-s/`, `imoca/credit-agricole-3-85/` |
| Aquitaine Innovations | IMOCA 60 | 1996 | Transat Jacques Vabre 1997 (Yves Parlier, Éric Tabarly) | `imoca/aquitaine-innovations-1/` |
| Primagaz | ORMA 60 | 1990 | Route du Rhum 1994 (Laurent Bourgnon), Québec-Saint-Malo 1992 et autres | `orma-60/primagaz/` |
| Fauve (Gamin, Olmix…) | Ocean Fifty | 1991 | **Trois Routes du Rhum** dans sa classe : 1998, 2002, 2018 | `ocean-fifty/fauve/` |
| Fleury Michon IX, X, XI | ORMA 60 / IMOCA 60 | 1988 à 1992 | Lignée de Philippe Poupon ; TJV 1993 pour le IX | `orma-60/fleury-michon-ix/`… |
| Elf Aquitaine III | ORMA 60 | 1988 | Transat anglaise 1990 | `orma-60/elf-aquitaine-iii/` |
| Jet Services V | Ultim | 1987 | Québec-Saint-Malo 1988 (Serge Madec) ; record de l'Atlantique à vérifier | `ultim/jet-services-v/` |
| Groupama | ORMA 60 | 1998 | Québec-Saint-Malo 2000 et Transats (Franck Cammas) | `orma-60/groupama/` |
| Roaring Forty | Class 40 | 1997 | Route du Rhum 2006 en Class 40 (Michel Kleinjans) | `class-40/boatmatch-com/` |

### Après 2000 (légendes modernes, pour les modes normaux)

| Bateau | Classe | Lancé | Ce qui le distingue (d'après la base) |
|---|---|---|---|
| Groupama 3 (Banque Populaire VII, IDEC Sport) | Ultim | 2006 | **Trois Routes du Rhum** (2010, 2014, 2018) ; Trophée Jules Verne à vérifier |
| Macif (SMA) | IMOCA 60 | 2011 | Vendée Globe 2012, Routes du Rhum 2014 et 2018 |
| Foncia | IMOCA 60 | 2007 | Vendée Globe 2008, Barcelona World Race 2014 |
| Banque Populaire VIII | IMOCA 60 | 2015 | Vendée Globe 2016 |
| Kingfisher | IMOCA 60 | 2000 | Route du Rhum 2002 (Ellen MacArthur) |
| Maxi Edmond de Rothschild | Ultim | 2017 | Route du Rhum 2022 |
| Crêpes Whaou 3 | Ocean Fifty | 2009 | Route du Rhum 2014 et plusieurs Transats |
| Banque Populaire V | Ultim | 2008 | Trophée Jules Verne à vérifier |

## 3. Trous et erreurs repérés dans la base (à signaler à la session du site)

- **Route du Rhum 1978 à 1990** : aucun vainqueur dans le palmarès. Olympus Photo (Mike Birch, 1978),
  Elf Aquitaine (Marc Pajot, 1982), Fleury Michon VIII (Philippe Poupon, 1986), Pierre 1er (Florence Arthaud, 1990)
  sont à chercher, avec leur source.
- **Vendée Globe 1996** (Christophe Auguin, Géodis) et **2004** (Vincent Riou, PRB) : absents.
- **Pen Duick III** est rangé dans les IMOCA 60 : c'est une goélette de 1967. Pen Duick II, IV (Manureva) et VI
  n'apparaissent pas.
- Dans le palmarès, « Transat » désigne selon les classes la Transat anglaise ou la Transat Jacques Vabre :
  les décomptes de victoires « Transat » ci-dessus sont à confirmer.

## 4. Ce que cela demande dans le jeu (proposition)

1. **Ultims** : multicoques (la règle de chavirage existe déjà), nettement plus rapides que les IMOCA, risque
   de chavirage par vent fort. Table des voiles et allures propre.
2. **Class 40** : monocoques plus lents que les IMOCA, robustes. Table propre.
3. **Mode vintage** : flotte de bateaux d'avant 2000 (toutes classes ou classe par classe), plus lents et plus
   fragiles que les modernes, avec leurs skippers de l'époque.
4. **Rang légendaire** : badge et fiche historique (sources citées), dans le choix des bateaux. Effet en jeu à décider :
   purement honorifique, ou petit atout (par exemple une carte réparation de plus).
5. Chaque bateau garde son identifiant du site (`id_site`), pour renvoyer vers sa fiche.

## 5. Flotte Vintage validée et skippers sourcés (10/11/2026, base du site : donnees/site/palmares.csv)

| Bateau | Type | Skipper retenu | Preuve dans la base |
|---|---|---|---|
| Pen Duick III | goélette (modèle 3D fait) | Éric Tabarly | Morgan Cup 1967, 1er |
| Écureuil d'Aquitaine II | monocoque 60' | Titouan Lamazou | Vendée Globe 1989, 1er |
| Bagages Superior | monocoque 60' | Alain Gautier | Vendée Globe 1992, 1er |
| PRB | monocoque 60' | Michel Desjoyeaux | Vendée Globe 2000, 1er |
| Groupe Sceta | monocoque 60' | Christophe Auguin | BOC Challenge 1990, 1er |
| Crédit Agricole | monocoque 60' | Philippe Jeantot | BOC Challenge 1982, 1er |
| Aquitaine Innovations | monocoque 60' | Yves Parlier | Route du Café 1997, 1er |
| Primagaz | trimaran ORMA 60 | Laurent Bourgnon | Route du Rhum 1990, 3e |
| Fauve (Olmix) | trimaran 50' | Pierre Antoine | Route du Rhum 2018, 1er |
| Fleury Michon IX | trimaran ORMA 60 | Philippe Poupon | C.STAR 1988, 1er |
| Elf Aquitaine III | trimaran ORMA 60 | Jean Maurel | Québec-Saint-Malo 1988, 4e |
| Jet Services V | grand trimaran | Serge Madec | Québec-Saint-Malo 1988, 1er |
| Groupama | trimaran ORMA 60 | Franck Cammas | Route du Rhum 1998, 3e |
| Roaring Forty | Class40 | Michel Kleinjans | AZAB 2003, 2e |

**Fait le 10/11/2026 (soir, PC portable, non publié)** : classe Vintage jouable au Rhum et au Fastnet, en deux familles
(`vintage_monocoque`, `vintage_multicoque`, décision du porteur de projet), 14 bateaux (`vin-…` dans `bateaux.json`) et
skippers ; Pen Duick III gréé en goélette dans le hangar et en course ; voir `jeu/CHANGELOG.md`. Noms portés retenus :
celui de la course qui prouve le skipper (Olmix pour Pierre Antoine en 2018, le bateau étant baptisé Fauve).

**11/11/2026 : les 7 monocoques sont modélisés et publiés** (générateur `jeu/outils/blender/vintage_mono.py`, cotes dans
`jeu/packages/data/config/modeles-vintage.json`, références dans `jeu/conception/vintage-references.md`).

**Reste** : les 6 multicoques. Écrire `jeu/outils/blender/vintage_multi.py` sur le modèle de `vintage_mono.py` (section
« multicoques » à ajouter au fichier des cotes : longueur, largeur, flotteurs, bras de liaison, mât-aile, couleurs) et une
fonction 3D `buildMultiVintage` dans `scene3d.ts` (sur le modèle de `buildMonoVintage` et de `buildTrimaran`) ; puis le champ
`modele_3d` des bateaux. Trimarans : Primagaz (élargi d'environ 2 m en 1993 : forme du Rhum 1994), Olmix / Fauve (50 pieds),
Fleury Michon IX, Elf Aquitaine III, Groupama 1. **Jet Services V est un catamaran.** Valider les réglages provisoires.

Ancien plan de reprise (fait) :
1. `packages/data/config/familles.json` : classe `VINTAGE` (vitesse, tours_moyens, heures_par_tour, usure_facteur :
   PROVISOIRES, à valider) et familles `vintage_goelette`, `vintage_monocoque`, `vintage_multicoque` (effets
   provisoires, par exemple ceux d'`imoca_derives` et d'`ultim_ancien`).
2. `skippers.json` et `bateaux.json` : les 14 entrées ci-dessus (compétences provisoires, `source` = palmarès du site).
3. 3D : modèle `pen_duick_3` (glb déjà publié dans `public/modeles/`) avec gréement de goélette (deux mâts, deux
   bômes, voiles d'avant) dans `scene3d.ts` ; en attendant leur modèle individuel, les monocoques prennent
   `imoca_derives`, les multicoques `ocean_fifty`. Plan de voilure : 152 m² au près (Wikipédia).
4. Hangar (bouton « Vintage »), silhouettes sur la carte, Fastnet : ajouter `VINTAGE` aux classes et à
   `echelle_classe` dans `outils/courses-atlantique.ts`, régénérer la carte (`npx tsx outils/generer-carte-rhum.ts rolex-fastnet`).
5. Simuler (`COURSE=rolex-fastnet npx tsx outils/sim-classes.ts 8 VINTAGE`), tester, puis mettre en ligne (accord donné).
