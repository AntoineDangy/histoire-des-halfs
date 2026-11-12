# Références visuelles et dimensions des 13 bateaux « de légende »

Document préparatoire à la modélisation 3D (Blender). Rien n'est modélisé ici.

Conventions :
- Photos stockées dans `jeu/conception/references/vintage/<id-court>/`, uniquement sous licence libre (CC0, CC BY, CC BY-SA), vignettes Commons de 1280 px de large. Les pages sources sont sur Wikimedia Commons.
- « Fiche du site » = la page de l'auteur du site histoiredeshalfs.com, lue en local dans `donnees/site/html/` (fichier source indiqué pour chaque bateau). Ce sont des données de l'auteur, citées comme telles.
- Une dimension absente de ce document est « non trouvée » : aucune valeur n'a été déduite ni inventée. Les valeurs de règle de classe (IMOCA 60 pieds = 18,28 m, Class40 = 40 pieds) ne sont pas des mesures du bateau et ne sont pas reprises comme telles.
- Plusieurs photos de coques montrent le bateau sous un nom ou une configuration postérieurs (grément, quille, couleurs). L'identité de la coque est établie par la liste des noms successifs de la fiche du site et, quand ils existent, par les descriptions et catégories Commons. Les écarts de configuration sont signalés.

## Points d'attention (à lire avant de modéliser)

- Jet Services V (n° 12) est un catamaran (fiche du site et Wikipédia FR), pas un trimaran.
- Fauve / Olmix (n° 9) : l'architecte est « Browns » dans la base du site ; l'orthographe n'a pas été vérifiée.
- Crédit Agricole (n° 5) : les catégories Commons « Crédit Agricole II (ship, 1984) » et « Credit Agricole IV (ship, 1989) » sont d'autres bateaux (non utilisés).
- Elf Aquitaine III (n° 11) : les seules photos libres trouvées montrent la coque sous le nom Défi Cancale en 2010, avec un gréement tardif (mât non-aile, grand-voile verte). Elles servent pour les volumes (coques, bras, plate-forme), pas pour la configuration de 1988.
- Primagaz (n° 8) : la coque retenue est celle du trimaran VPLP de 1990 (R.M.O., puis Primagaz en 1992, Kingfisher, Foncia en 1999 d'après Wikipédia FR « Primagaz (ORMA) »). La fiche du site (M12) la confirme (noms Primagaz, Foncia, Rmo...). La configuration de la Route du Rhum 1994 diffère de celle de 1990 (voir plus bas).
- Groupama (n° 13) : c'est « Groupama 1 » (VPLP 1998, fiche VPLP), pas Groupama 2 (2004) ni 3 (2006). La catégorie Commons « ORMA-Groupama-2 » trouvée en recherche concerne l'autre bateau et n'a pas été retenue.

---

## 1. Écureuil d'Aquitaine II (IMOCA 60, 1989) — `ecureuil-d-aquitaine-2/`

Fiche : `imoca/ecureuil-d-aquitaine-2-11` (source : `Histoire des 60'/A4.htm`). Plan Bouvet-Petit, chantier Capt Flint, Titouan Lamazou (Vendée Globe 1989-1990, gagnant). Noms successifs : Groupe LG (Bertrand de Broc puis Gerry Roufs, Groupe LG-Traitmat avec Hervé Laurent en 1996), Hawaiian Express, Prime Time America, Carrecamino, Margaret Anna. Wikipédia FR (« Écureuil d'Aquitaine II ») : retrouvé en 2019, restauré et renommé T One One.

### Photos libres retenues
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `profil.jpg` | Profil bâbord complet, coque blanche, un seul mât, bôme, livrée « Le Département de la Vendée », n° 11, entrée du port des Sables-d'Olonne | Arnaud 25 | CC0 | 2025-06-26 | https://commons.wikimedia.org/wiki/File:Port_des_Sables-d%27Olonne_3.jpg |
| `pont-cockpit-1996.jpg` | Détail du pont et du cockpit (roue, winchs, rouf arrière) au départ du Vendée Globe 1996 sous le nom Groupe LG-Traitmat, franc-bord peint | Eric Houdas | CC BY-SA 4.0 | photo de 1996, fichier du 2016-12-13 | https://commons.wikimedia.org/wiki/File:Groupe_LG-Traitmat.jpg |

Réserve : la photo `profil.jpg` est classée dans la catégorie Commons « Écureuil d'Aquitaine II (ship, 1989) » et porte le numéro 11 (celui de la fiche), mais sa description Commons ne cite pas le nom du bateau ; à confirmer visuellement avant de s'y fier pour la forme exacte de l'étrave et du rouf (restauration de 2019 possible).

Références visuelles non libres (non stockées) : fiche de l'auteur (photos T. Vigoureux, archives de la revue « Bateaux », page « Plus de photos ») ; fichier source local `donnees/site/html/Histoire des 60'/A4.htm`.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Longueur (hors tout selon la fiche : « Lf ») | 17,25 m | fiche du site (A4) |
| Largeur | 5,20 m | fiche du site (A4) |
| Tirant d'eau | 3,5 m | fiche du site (A4) |
| Déplacement | 11 t dont 5 t de lest | fiche du site (A4) |
| Hauteur de mât | 23,3 m | fiche du site (A4) |
| Surface de voilure | 235 m² et 475 m² (deux valeurs, sans légende ; probablement près et portant, non confirmé) | fiche du site (A4) |
| Construction | composite | fiche du site (A4) |

Particularités : quille fixe lestée (lest de 5 t), mono-mât sloop. Pas de mât-aile ni de ballasts mentionnés. Couleurs d'origine de 1989 : non trouvées.

Manque : couleurs de la livrée de 1989 (Écureuil d'Aquitaine), plans de formes, photos au sec (carène, quille, safran), vue de dessus.

---

## 2. Bagages Superior (IMOCA 60, 1992) — `bagages-superior/`

Fiche : `imoca/bagages-superior-101` (source : `Histoire des 60'/F3.htm`). Plan Finot-Conq, chantier CDK Technologies (Port-la-Forêt), Alain Gautier (Vendée Globe 1992-1993, gagnant en 110 j 02 h). Noms : Cafe Le Gall-Le Gout, Le Havre 2000, Euroka - Un Univers de Service (UUDS), Exide Challenger, Globe, Operon Racing... Wikipédia FR (« Bagages Superior ») : en 1999, nouvelle quille mobile plus profonde et plus lourde.

### Photos libres retenues (coque sous le nom Operon Racing, 2011, après le Velux 5 Oceans)
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `trois-quarts-avant.jpg` | Trois-quarts avant bâbord au ponton : étrave, franc-bord bleu foncé, pont rouge, bout-dehors court, pied de mât | Jean-Pierre Bazard | CC BY-SA 3.0 | 2011-06-04 | https://commons.wikimedia.org/wiki/File:Le_voilier_de_course_Operon_Racing_(1).JPG |
| `arriere-safran.jpg` | Arrière : tableau, plateforme, safran(s), bôme, pont rouge, rouf | Jean-Pierre Bazard | CC BY-SA 3.0 | 2011-06-04 | https://commons.wikimedia.org/wiki/File:Le_voilier_de_course_Operon_Racing_(8).JPG |
| `pont-vu-de-l-arriere.jpg` | Vue de dessus-arrière : cockpit, rouf, plan de pont, éoliennes, tableau arrière en amont, deux safrans visibles | Kristina D.C. Hoeppner | CC BY-SA 2.0 | 2011-01-30 | https://commons.wikimedia.org/wiki/File:Operon_Racing_Eco_60.jpg |

Autres photos libres existantes (non stockées, même auteur que les deux premières) : catégorie https://commons.wikimedia.org/wiki/Category:Operon_Racing_(ship,_1992) (14 vues dont le mât à plat, n° 14).

Réserve : la configuration de 2011 (pont rouge, rouf d'Operon, quille et mât modifiés) n'est pas celle de 1992 ; la forme de la coque et du pont reste valable.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Longueur | 20,10 m (valeur inhabituelle pour un 60 pieds ; elle inclut peut-être le bout-dehors, non précisé) | fiche du site (F3) |
| Largeur | 5,8 m | fiche du site (F3) |
| Déplacement | 10 t | fiche du site (F3) |
| Surface de voilure | 260 m² | fiche du site (F3) |
| Tirant d'eau, hauteur de mât | non trouvés | — |

La fiche mentionne « 2 mats » (sic) : sens non éclairci (deux mâts ? deux mâts de rechange ?), à ne pas exploiter. Sur les photos de 2011 : un seul mât.

Manque : tirant d'eau d'origine, hauteur du mât, couleurs d'origine de 1992 (Bagages Superior), photos au sec (quille, safran), de dessus avec le gréement d'origine.

---

## 3. PRB (IMOCA 60, 1999) — `prb/`

Fiche : `imoca/aito` (source : `Histoire des 60'/F14.htm`, intitulée « PRB 2, 85 »). Plan Finot-Conq, chantier Mag, Michel Desjoyeaux (Vendée Globe 2000-2001, gagnant). Noms : Prb, Aito, Armor Lux - Le Finistère Assurance, Fruit, Prb 2, Roxy, Virbac.

### Photos libres retenues
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `au-sec-carene.jpg` | Coque hors d'eau sur berceau, vue latérale basse : carène, étrave, flanc, bout-dehors, safran pivotant (orange) visible à l'arrière | Madamedekeravel | CC BY-SA 4.0 | 2024-06-15 | https://commons.wikimedia.org/wiki/File:Imoca_prb_2000.jpg |
| `arriere-roxy.jpg` | Trois-quarts arrière sous le nom Roxy (Vendée Globe 2008) : tableau, deux safrans pivotants, arceau/jambes de bastaque, rouf | Poulpy | CC BY 3.0 | 2008-11-01 | https://commons.wikimedia.org/wiki/File:60_feet_Roxy.jpg |
| `trois-quarts-avant-roxy.jpg` | Trois-quarts avant au ponton (Roxy, 2009) : étrave, bout-dehors, franc-bord pourpre et turquoise, pont, mât | Ehainry | CC BY 4.0 | 2009-02-16 | https://commons.wikimedia.org/wiki/File:Roxy_LS.JPG |

La légende Commons de la première photo identifie la coque : « IMOCA PRB 2000 (ex Roxy, ex Fruit, actuellement Aïto) ». Autres photos libres déjà présentes dans `donnees/site/commons/files/` (non recopiées) : `imoca__aito__14955266.jpg`, `imoca__aito__14955290.jpg`, `imoca__aito__17464779.jpg` (Richard Barley, CC BY 2.0, 2009-02-14).

Réserve : Roxy (2008) a été remâtée (gréement non aile) ; le mât-aile CDK d'origine n'apparaît sur aucune photo libre trouvée.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Lest | 3,2 t (quille pivotante) | fiche du site (F14) |
| Longueur, largeur, tirant d'eau, déplacement total, hauteur de mât, voilure | non trouvés | — |

Particularités (fiche du site, F14) : construit dans le même moule que Sodebo, chez Mag, avec le pont issu du moule de Whirlpool ; mât-aile CDK ; quille pivotante ; barre d'écoute de grand-voile circulaire ; une seule dérive centrale, qui peut servir de lame de rechange aux safrans pivotants ; ballasts. Démâtage en mai 1999 (fiche). Couleurs de 1999-2000 : non trouvées sur une source libre.

Manque : dimensions principales, couleurs de la livrée PRB, photo du mât-aile d'origine, vue de dessus.

---

## 4. Groupe Sceta (IMOCA 60, 1990) — `groupe-sceta/`

Fiche : `imoca/groupe-sceta` (source : `Histoire des 60'/F2.htm`). Plan Finot-Conq, chantier Marc Pinta (La Rochelle), Christophe Auguin (BOC Challenge 1990-1991, gagnant des 60 pieds). Noms : Accor, Cacolac d'Aquitaine, Crédit Immobilier de France, Geb-Fauba, Imoca Escola, Mirabaud, Un Autre Regard, Victoria Group...

### Photos libres retenues (coque sous le nom Crédit Immobilier de France, Marc Thiercelin, Vendée Globe 1996)
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `profil-quai-1996.jpg` | Profil bâbord au ponton : coque grise-bleutée avec n° 2 jaune, franc-bord bas, mât et bôme, pont blanc | Eric Houdas | CC BY-SA 4.0 | photo de 1996 (fichier du 2016-12-13) | https://commons.wikimedia.org/wiki/File:Cr%C3%A9dit_Immobilier_De_France.jpg |
| `pont-cockpit-1996.jpg` | Pont et cockpit à la barre à roue, grand-voile lattée, rouf | Eric Houdas | CC BY-SA 4.0 | 1996-11-01 | https://commons.wikimedia.org/wiki/File:Marc_Thiercelin.jpg |

La légende Commons de la seconde photo dit : « Crédit Immobilier de France (ex-Groupe Sceta) au départ du Vendée Globe 1996-1997 ». Ne pas confondre avec « Mirabaud (ship, 2006) » (Commons), qui est un autre bateau (Farr, 2006).

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Largeur | 5,90 m | fiche du site (F2) |
| Poids | allégé de 2 t par rapport à Générali Concorde (valeur absolue non donnée) | Wikipédia FR « Groupe Sceta » |
| Longueur, tirant d'eau, déplacement, hauteur de mât, voilure | non trouvés | — |

Particularités : coque polyester / fibre de verre (au lieu de l'aluminium de Générali Concorde), deux safrans (Wikipédia FR « Groupe Sceta »). Couleurs du Groupe Sceta de 1990 : non trouvées (la livrée visible est celle de 1996).

Manque : dimensions principales, couleurs de 1990, photo au sec (quille et safrans), vue de dessus.

---

## 5. Crédit Agricole (monocoque en aluminium, 1982) (aucune photo, pas de dossier)

Fiche : `imoca/c-c-a-s` (source : `50' monos/G Credit Agricole.htm`). Plan Guy Ribadeau-Dumas, chantier Nautalu, aluminium, Philippe Jeantot (BOC Challenge 1982-1983, 1er des 16 partants en 156 j 02 h 26). Noms : Crédit Agricole, Crédit Agricole 1, C.C.A.S, Noé, Bo.

### Photos libres : aucune
Rien trouvé sur Commons (recherches par noms et catégories). Les catégories « Crédit Agricole II (ship, 1984) » et « Credit Agricole IV (ship, 1989) » concernent d'autres bateaux de Jeantot.

Références visuelles non libres (non stockées) : fiche de l'auteur (extraits « Les Cahiers du Yachting » avril 1982 et « Voiles et Voiliers » octobre 1982) ; fichier local `donnees/site/html/50' monos/G Credit Agricole.htm`.

### Dimensions (toutes : fiche du site)
| Donnée | Valeur |
|---|---|
| Longueur | 17 m |
| Largeur | 4,55 m |
| Tirant d'eau | 3 m |
| Déplacement | 15 000 kg |
| Lest | 5 500 kg |
| Ballasts | 2 x 1 500 l |
| Tirant d'air | 20,50 m |
| Surface de voilure au près | 150 m² |

Particularités : coque aluminium, ballasts d'eau, un mât (tirant d'air 20,5 m). Couleurs : non trouvées.

Manque : toute photo libre ; couleurs de la coque ; forme de l'étrave, de la quille et du safran.

---

## 6. Aquitaine Innovations (IMOCA 60, 1996) — `aquitaine-innovations/`

Fiche : `imoca/aquitaine-innovations-1` (source : `Histoire des 60'/F6.htm`). Plan Finot-Conq, construit par Thierry Elluère, Yves Parlier (Vendée Globe 1996-1997). Noms : Aquarelle.com, Cervin EnR, Energies Autour Du Monde, Garnier, Garnier Belgium, Tiscali.

### Photos libres retenues
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `flanc-1996.jpg` | Flanc bâbord bleu marine avec lettrage « Aquitaine Innovations », pont, mât-aile et barres de flèche-écarteurs, équipage au ponton, légende Commons : Yves Parlier au départ du Vendée Globe 1996 | Eric Houdas | CC BY-SA 4.0 | photo de 1996 (fichier du 2016-12-13) | https://commons.wikimedia.org/wiki/File:Yves_Parlier.jpg |
| `trois-quarts-cervin-enr-2008.jpg` | Trois-quarts avant à Québec sous le nom Cervin EnR (Transat Québec-Saint-Malo 2008) : coque rouge, étrave, bout-dehors, mât en carbone noir, haubans au pont | Gilbert Bochenek | CC BY-SA 3.0 | 2008-07 | https://commons.wikimedia.org/wiki/File:Transat-Qu%C3%A9bec-St-Malo-2008.JPG |

Non retenue : « Groupe LG de Gerry Roufs » (classée par erreur dans la catégorie Commons de ce bateau, présente dans l'index local) : ce n'est pas la même coque.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Largeur | 5,90 m | fiche du site (F6) |
| Surface de voilure | 292 m² / 545 m² (près / portant, non légendé) | fiche du site (F6) |
| Gain estimé sur un Vendée Globe | 1,5 jour (grément) | fiche du site (F6) |
| Longueur, tirant d'eau, déplacement, hauteur de mât | non trouvés | — |

Particularités (fiche du site) : gréement de thonier ; mât-aile dont les haubans reviennent sur des barres de flèche-écarteurs sur le pont (visibles sur `flanc-1996.jpg`). Couleurs : bleu marine avec lettrage blanc en 1996 (photo) ; rouge en 2008 (Cervin EnR).

Manque : dimensions principales, vue de dessus, photo au sec.

---

## 7. Roaring Forty (Open 40, 1997) (aucune photo, pas de dossier)

Fiche : `class-40/boatmatch-com` (source : `Histoire des 40' monos/Q10.htm`). Plan Lutra, Open 40, NED 5753. Noms : Roaring Forty (BEL 56 à la Route du Rhum 2006 avec Michel Kleinjans, 1er des 6 de la classe 3 monocoques en 23 j 20 h 35), Boatmatch.com, Immo Bib.

### Photos libres : aucune
Recherches Commons sur « Roaring Forty », « Boatmatch », « Immo Bib », « Kleinjans » et la Route du Rhum 2006 sans résultat. Les photos de Class40 de la catégorie Route du Rhum 2006 n'ont pas été vérifiées une à une (non identifiables sans n° de voile lisible).

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Largeur hors tout | 3,95 m | fiche du site (Q10) |
| Tirant d'eau | 2,92 m | fiche du site (Q10) |
| Longueur, déplacement, hauteur de mât, voilure | non trouvés (Open 40 = 40 pieds nominal, non mesuré) | — |

Particularités : mât cassé à la liaison pied de mât au 11e jour du Rhum 2006, réparé à l'époxy (fiche). Couleurs : non trouvées.

Manque : toute photo libre, dimensions principales, couleurs, plan de pont.

---

## 8. Primagaz (trimaran ORMA 60, 1990) (aucune photo, pas de dossier)

Fiche : `orma-60/primagaz` (source : `Histoire des 60 ORMA/M12.htm`, « R.M.O. Tri Z »). Plan VPLP (Van Péteghem-Lauriot Prévost), chantier B&B (La Trinité), Laurent Bourgnon. Route du Rhum 1990 : 3e sous le nom R.M.O. ; Route du Rhum 1994 : 1er (14 j 06 h 30) ; 1998 : 1er. Noms : Primagaz, Bayer, Baygon, Casino d'Etretat, Foncia, HiQ, Nautica, Nuku Hiva, Primaguada, Région Guadeloupe-Terre de Passions, Rexona Men, Rmo.

### Photos libres : aucune
Rien sous les noms Primagaz, R.M.O., Kingfisher, Foncia (trimaran de 1990), HiQ, Rexona Men... La catégorie « Foncia (ship, 2001) » est un autre trimaran (VPLP 2001) ; « Primagaz » sur Commons ne contient que des camions et des conteneurs de gaz.

Références visuelles non libres (non stockées) : fiche VPLP https://www.vplp.fr/en/racing/primagaz/ (fiche technique, photo éventuelle non vérifiée) ; fiche de l'auteur (photos T. Martinez et P. Gins, archives de la revue « Bateaux ») ; Wikipédia FR « Primagaz (ORMA) » (texte, sans photo).

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Longueur | 18,28 m | fiche VPLP « Primagaz » |
| Largeur | 15 m (1990) | fiche VPLP ; fiche du site (M12) : 15 m |
| Tirant d'eau | 1,54 m / 2,88 m (non légendé ; probablement dérives relevées / baissées) | fiche VPLP |
| Tirant d'air | 27,50 m | fiche VPLP |
| Surface de voilure | 330 m² / 490 m² (non légendé) | fiche VPLP |
| Poids | 6,2 t | fiche du site (M12) |
| Matériau | carbone | fiche VPLP |

Évolutions (fiche du site, M12) : 1993, nouveaux bras de liaison élargissant la plate-forme de 2 m, dérives asymétriques sur les flotteurs, suppression de la dérive centrale ; nouveau mât sans barre de flèche, hauteur max 30 m, grand-voile 198 m², gennaker 267 m². Donc à la Route du Rhum 1994 (cible du jeu) la largeur est d'environ 17 m (15 m + 2 m : addition, non donnée comme telle par la source) et le mât est sans barre de flèche, avec dérives de flotteurs. 1995 : nouveaux flotteurs plus volumineux.

Particularités : trimaran à 3 coques, un bras de liaison avant et un arrière (« bras de liaison avant » cité dans la fiche). Couleurs : non trouvées.

Manque : toute photo libre, déplacement vérifié, couleurs de la livrée Primagaz, configuration exacte de 1994.

---

## 9. Olmix, baptisé Fauve (trimaran 50 pieds, 1991) — `fauve/`

Fiche : `ocean-fifty/fauve` (source : `50 multis/50 Gamin.htm`). Plan « Jean Pierre Browns et Patrice Gaudry » (2e construit ; le 1er par Patrice Gaudry, vendu aux Antilles vers 2001), construit par Bruno Louit. FRA 7. Noms : Fauve, Gamin, Deleage, Deleage et Diazo, Imagine, Inizme, Abri Services, La Mer Révèle Nos Sens, Olmix, Groupe Olmix, Votre NOM sur le Rhum. Pierre Antoine (Route du Rhum 2018 sous Olmix).

### Photos libres retenues (coque sous le nom Olmix, 2016, n° FRA 7 ; le mot « Gamin » est lisible sur la coque dans la deuxième photo)
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `trois-quarts-1.jpg` | Vue plongeante trois-quarts avant : flotteur bâbord, bras de liaison avant et arrière, filet, étrave de la coque centrale, grand-voile à corne grise, foc rouge | Cephas | CC BY-SA 4.0 | 2016-07-10 | https://commons.wikimedia.org/wiki/File:OLMIX_1.jpg |
| `trois-quarts-2.jpg` | Vue plongeante trois-quarts arrière sous gîte : coque centrale bleue, flotteurs, bras, filet | Cephas | CC BY-SA 4.0 | 2016-07-10 | https://commons.wikimedia.org/wiki/File:OLMIX_3.jpg |

Une troisième vue est disponible (non stockée) : https://commons.wikimedia.org/wiki/File:OLMIX_2.jpg (même auteur et licence). Catégorie Commons : « Olmix (ship, 1991) ».

### Dimensions (fiche du site)
| Donnée | Valeur |
|---|---|
| Longueur | 15,24 m |
| Largeur | 11,0 m |
| Déplacement | 5,7 t |
| Tirant d'eau | 3,0 m |
| Grand-voile | 100 m² |
| Génois | 50 m² |
| Gennaker | 220 m² |

Évolution (fiche) : 2002, dérive rallongée, nouveau gréement en carbone avec un mât plus haut de 2 m, jeu de voiles neuf et plus grand. Hauteur de mât absolue : non trouvée.

Particularités visibles : trimaran 50 pieds, flotteurs fins à étrave inclinée, bras de liaison avant et arrière en profil aérodynamique, mât non-aile haubané, bout-dehors court sur la coque centrale ; coque et flotteurs bleu et blanc (Olmix, 2016).

Manque : couleurs de 1991 (Fauve), vue de profil et de dessus, photo au sec (dérives, safran), orthographe de l'architecte.

---

## 10. Fleury Michon IX (trimaran ORMA 60, 1988) — `fleury-michon-ix/`

Fiche : `orma-60/fleury-michon-ix` (source : `Histoire des 60 ORMA/M8.htm`). Plan Nigel Irens, chantier Jeanneau Techniques Avancées, Philippe Poupon (Trophée des Multicoques 1988 : 3e sur 10). Noms : Ad Maiora, Biscuits La Trinitaine, First Hotel, Groupe Pierre 1er, Haute Normandie, Nokia, Ocean 3. N° de voile SWE 2 (équipe suédoise).

### Photos libres retenues
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `profil-nokia-2005.png` | Profil bâbord de la coque centrale et du flotteur sous le nom Nokia, au ponton avant la Round Gotland Race 2005 : coques blanches et bleues, plate-forme, bôme, grand-voile et foc | jmmattss | CC BY 2.0 | 2005-07-01 | https://commons.wikimedia.org/wiki/File:Orma_60_trimaran_Nokia_in_Sandhamn.png |

La photo est dans la catégorie Commons « Fleury Michon IX (ship, 1988) ». Réserve : elle date de 2005 (voilure, peintures de Nokia, éventuel gréement modifié), pas de la configuration de 1988. Prise de profil, flotteur au premier plan : utile pour la proportion coque centrale / flotteurs.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Largeur | 14,58 m | fiche du site (M8) |
| Poids | 5,5 t | fiche du site (M8) |
| Longueur, tirant d'eau, hauteur de mât, voilure | non trouvés (un ORMA 60 mesure 60 pieds nominaux, non mesuré ici) | — |

Particularités : trimaran, bras de liaison en travers de la plate-forme. Couleurs de 1988 (Fleury Michon, Poupon) : non trouvées.

Manque : couleurs de 1988, dimensions principales, vue de dessus, photo au sec, vue avant.

---

## 11. Elf Aquitaine III (trimaran ORMA 60, 1988) — `elf-aquitaine-iii/`

Fiche : `orma-60/elf-aquitaine-iii` (source : `Histoire des 60 ORMA/M6.htm`, « Tri 07 »). Plan Ollier, chantier Multiplast, Jean Maurel (Trophée des Multicoques 1988 : 4e sur 10). Noms : Allianz Via, Défi Cancale, Gitana IX, Groupe Cga, Harris Wilson, Laiterie de St Malo, Le Bistrot Français, Madinina, Sensation, Horizons Loisirs.

### Photos libres retenues (coque sous le nom Défi Cancale, Route du Rhum 2010, n° 35)
| Fichier local | Montre | Auteur | Licence | Date | Page source |
|---|---|---|---|---|---|
| `au-ponton-2010.jpg` | Trimaran au ponton à Saint-Malo, vue de face-trois-quarts : mât en carbone blanc, bôme, bras de liaison, plate-forme, étrave de la coque centrale et d'un flotteur, voile verte ferlée | Erwan1972 | CC BY-SA 3.0 | non renseignée (Route du Rhum à Saint-Malo, 2010) | https://commons.wikimedia.org/wiki/File:D%C3%A9fi_Cancale.jpg |
| `en-navigation-2010.jpg` | Trimaran sous voiles, vu de loin à l'arrière, grand-voile verte et blanche n° 35, plate-forme et flotteurs | Barbetorte | CC BY-SA 3.0 | 2010-10-31 | https://commons.wikimedia.org/wiki/File:D%C3%A9fi_Cancale_Rhum_2010_40.JPG |

L'identité de la coque repose sur la liste des noms de la fiche (Défi Cancale) et sur la catégorie Commons « Défi Cancale (ship, 1988) » ; elle n'a pas pu être recoupée avec une source plus précise. Autre photo de la catégorie (non retenue, trop petite pour servir) : « Route-du-Rhum-Cap-Fréhel.jpg ».

### Dimensions (fiche du site, M6)
| Donnée | Valeur |
|---|---|
| Largeur | 14,50 m |
| Poids | 5,5 t |
| Surface de voile | 247 m² |
| Longueur, tirant d'eau, hauteur de mât | non trouvés |

Particularités (fiche du site) : bras démontables ; coques, mât, bôme et bras en carbone ; construit chez Multiplast. Couleurs de 1988 (Elf Aquitaine) : non trouvées ; coques blanches avec liserés sombres en 2010 (photo `au-ponton-2010.jpg`).

Manque : photos de 1988, dimensions principales, vue de dessus nette, profil, brochure du bateau (la fiche renvoie à une brochure reçue en 2022, en bas de page, non libre).

---

## 12. Jet Services V (catamaran, 1987) (aucune photo, pas de dossier)

Attention : catamaran, pas trimaran (fiche `ultim/jet-services-v`, source `50 multis/G O8.htm` ; Wikipédia FR « Commodore Explorer »). Plan Ollier (Gilles Ollier), chantier Multiplast, Serge Madec (Trophée des Multicoques 1988 : 1er sur 10 ; New York-Cap Lizard 1988 en 7 j 06 h 30 ; Québec-Saint-Malo 1988, 1er). Noms : Jet Services V, Commodore Explorer (Bruno Peyron, Trophée Jules Verne 1993 en 79 j 06 h 15 min 56 s), Explorer, Pays de Loire - Explorer, Warta Polpharma, Polpharma-Warta.

### Photos libres : aucune
Recherches Commons « Jet Services », « Commodore Explorer », « Polpharma », « Warta » sans fichier de bateau. Aucune catégorie de bateau correspondante.

Références visuelles non libres (non stockées) : fiche de l'auteur (nombreuses photos de presse, Bateaux, Voiles et Voiliers, « Course au Large ») dans `donnees/site/html/50 multis/G O8.htm`.

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Longueur | 22,8 m | fiche du site (O8) |
| Grand-voile / foc | 250 m² / 70 m² | fiche du site (O8) |
| Matériau | carbone intégral | fiche du site (O8) |
| Longueur | 26,30 m | Wikipédia FR « Commodore Explorer » (probablement après modification de 1993) |
| Largeur | 13,60 m | Wikipédia FR « Commodore Explorer » |
| Déplacement | 10,5 t | Wikipédia FR « Commodore Explorer » |
| Hauteur du mât | 31 m | Wikipédia FR « Commodore Explorer » |
| Voilure | 300 m² / 777 m² (non légendé) | Wikipédia FR « Commodore Explorer » |
| Tirant d'eau | non trouvé | — |

Les deux jeux de chiffres divergent (22,8 m contre 26,30 m) : à distinguer par période (Jet Services V 1987-1992 d'après la fiche ; Wikipédia ne précise pas la date de ses valeurs).

Particularités : catamaran en carbone, grand-voile et foc (fiche) ; équipage de 8 noms cités pour 1987. Couleurs : non trouvées.

Manque : toute photo libre, tirant d'eau, largeur en 1987, couleurs de la coque.

---

## 13. Groupama 1 (trimaran ORMA 60, 1998) (aucune photo, pas de dossier)

Fiche : `orma-60/groupama` (source : `Histoire des 60 ORMA/M20.htm`, « Tri 24 »). Plan VPLP, construit par CDK Technologies, JMV Industries et B&B (même moule de coque centrale que Brocéliande), Franck Cammas (Route du Rhum 1998 : 3e sur 11 en 12 j 19 h 26 ; champion ORMA 2000 et 2001). Noms : Groupama, Akron Aoton, Candide, HiQ Sailing Team, Sjovillan.

### Photos libres : aucune
Les catégories Commons « Groupama 2 (ship, 2004) » et « Groupama 3 (ship, 2006) » concernent d'autres bateaux ; « ORMA-Groupama-2 (5) » et « (6) » aussi. Aucune photo trouvée sous Groupama (1998), HiQ, Akron Aoton, Candide ou Sjovillan.

Références visuelles non libres (non stockées) : fiche VPLP https://vplp.fr/en/?p=20310 ; fiche de l'auteur (photo Dominic Bourgeois, archives de « Bateaux », démâtage de 2002 ; photo Voiles et Marins 1998-99) ; article sur la reconversion de « Candide » https://www.multihulls-world.com/news-catamaran-trimaran/candide-the-reconversion-of-an-exceptional-racer (titre lu seulement ; non vérifié que ce soit la même coque).

### Dimensions
| Donnée | Valeur | Source |
|---|---|---|
| Longueur | 18,28 m | fiche VPLP « Groupama 1 » |
| Largeur | 17,60 m | fiche VPLP ; fiche du site (M20) : 17,3 m (écart de 0,30 m, non expliqué) |
| Tirant d'eau | 1,6 m / 4,1 m (non légendé) | fiche VPLP |
| Tirant d'air | 30,48 m | fiche VPLP |
| Surface de voilure | 308 m² / 420 m² (non légendé) ; au près 300 m² selon la fiche du site | fiche VPLP ; fiche du site (M20) |
| Poids | 5,7 t | fiche du site (M20) |
| Mât-aile | 23 m² (surface, selon la fiche du site, formulation « mat aile: 23m2 ») ; hauteur : non trouvée distincte du tirant d'air | fiche du site (M20) |
| Matériau | carbone | fiche VPLP |

Particularités : mât-aile, trois coques fines, bras de liaison (nombre non précisé), flotteurs refaits par JMV après la saison 1998 (« changement des flotteurs » en 1999, fiche du site). Couleurs : non trouvées.

Manque : toute photo libre, couleurs de la livrée Groupama 1998, nombre et profil des bras.

---

## Tableau récapitulatif

| N° | Bateau | Photos libres stockées | Dimensions sourcées |
|---|---|---|---|
| 1 | Écureuil d'Aquitaine II | 2 (dont 1 à confirmer) | oui (complètes sauf voilure non légendée) |
| 2 | Bagages Superior | 3 | partielles (L 20,10 m à vérifier, B, déplacement, voilure) |
| 3 | PRB | 3 | non (seulement lest 3,2 t) |
| 4 | Groupe Sceta | 2 | non (largeur 5,90 m seulement) |
| 5 | Crédit Agricole (1982) | 0 | oui (complètes) |
| 6 | Aquitaine Innovations | 2 | partielles (largeur, voilure) |
| 7 | Roaring Forty | 0 | partielles (largeur, tirant d'eau) |
| 8 | Primagaz | 0 | oui (VPLP + site, sauf déplacement) |
| 9 | Olmix / Fauve | 2 | oui (sauf hauteur de mât) |
| 10 | Fleury Michon IX | 1 | partielles (largeur, poids) |
| 11 | Elf Aquitaine III | 2 | partielles (largeur, poids, voile) |
| 12 | Jet Services V (catamaran) | 0 | oui (deux jeux de valeurs divergents) |
| 13 | Groupama 1 | 0 | oui (VPLP + site, sauf déplacement distinct) |

Bateaux sans aucune photo libre : Crédit Agricole (1982), Roaring Forty, Primagaz, Jet Services V, Groupama 1.

## Journal des sources consultées

- Commons (API, requêtes espacées d'au moins 4 s, User-Agent générique) : catégories « Écureuil d'Aquitaine II (ship, 1989) », « Groupe LG-Traitmat (ship, 1989) », « Operon Racing (ship, 1992) », « PRB (ship, 2000) », « Crédit immobilier de France 2 (ship, 1990) », « Aquitaine Innovations (ship, 1996) », « Cervin EnR (ship, 1996) », « Olmix (ship, 1991) », « Fleury Michon IX (ship, 1988) », « Défi Cancale (ship, 1988) », « ORMA », « Open 60' », « Primagaz », « Laurent Bourgnon », « Franck Cammas ».
- Wikipédia FR : « Primagaz (ORMA) », « Commodore Explorer », « Groupe Sceta », « Écureuil d'Aquitaine II », « Bagages Superior ».
- Fiches VPLP : https://www.vplp.fr/en/racing/primagaz/ et https://vplp.fr/en/?p=20310.
- Fiches de l'auteur (histoiredeshalfs.com), en local.
- Non trouvés après recherche web : dimensions de Groupe Sceta, de Roaring Forty (Lutra) et photo libre des bateaux n° 5, 7, 8, 12 et 13.
