# Compétences des skippers (12/11/2026)

**Décision du propriétaire (12/11/2026)** : chaque skipper a **une compétence en un mot**, liée à ce qu'il est dans la vraie vie, avec un bonus et un compromis équilibrés. Elle remplace les compétences de la bêta et les « traits de caractère » (abandonnés). Données : `packages/data/config/competences.json` et `packages/data/skippers.json`.

Méthode d'équilibrage : chaque compétence affronte 3 skippers sans compétence sur le même bateau, Route du Rhum (`outils/sim-competences.ts`, variable `FILTRE`). 25 % de victoires = équilibre parfait ; zone acceptée 19 à 31 %.

Navigateur et Météorologue **estiment** le prochain vent (force pour l'un, orientation pour l'autre) : la prévision est juste 3 fois sur 4, sinon elle annonce une autre face du dé. Elle n'est montrée qu'au skipper concerné (en réseau aussi).

| Compétence | Bonus | Compromis |
|---|---|---|
| ♟ Stratège | Lit le plan d'eau : 1 relance du dé de direction du vent par course | −1 case au tour de la relance |
| 🧭 Navigateur | Annonce la force attendue du prochain vent (prévision juste 9 fois sur 10) | −1 case au passage d'une voile de près à une voile de portant, ou l'inverse (table à cartes) |
| ☁ Météorologue | Connaît la tendance du bulletin et annonce l'orientation attendue du prochain vent (prévision juste 3 fois sur 4) | −2 cases pour un virage de 90° ou plus (table à cartes) |
| 🪶 Finesse | +1 case par petit temps (F3 et moins) | −1 case dès la bonne brise (F5 et plus) |
| ⚑ Régatier | +1 case en zone côtière ; n'entre jamais en collision dans la brume | −1 case par gros temps (F7 et plus) |
| ⛈ Coriace | +1 case par gros temps (F7 et plus) | Risque +1 cran dès la bonne brise (F5 et plus) |
| 🔧 Bricoleur | +2 cartes réparation au départ | −1 case au tour où une carte réparation est jouée (bricole au lieu de barrer) |
| ✂ Voilier | Ses voiles s'usent un peu moins (−20 %) et, tous les 3 tours, recoud une voile perdue en naviguant à mi-distance | Une carte réparation en moins au départ |
| ➹ Glisseur | +1 case au largue et au vent arrière | −1 case au près |
| ⛰ Grimpeur | +1 case au près | −1 case au largue et au vent arrière |
| ◆ Imperturbable | « Passe ton tour » devient « distance divisée par 2 » ; les avaries des cartes du large durent 1 tour de moins | Les cartes heureuses ne lui rapportent que la moitié |
| 📣 Communicant | Porté par ses supporters : les cartes heureuses lui rapportent un tiers de plus | Vit tout intensément : les avaries des cartes du large durent 1 tour de plus |
| ✦ Polyvalent | +1 case au vent de travers | −1 case au près |
| 🪡 Économe | Ménage les voiles : elles s'usent deux fois moins vite | −1 case au portant par vent fort (F6 et plus) : pas question de forcer |
| ⚡ Attaquant | +1 case dès la jolie brise (F4 et plus) | Tire sur le matériel : les voiles s'usent 60 % plus vite |
| 🛡 Prudent | Risque −1 cran par vent fort (F6 et plus) : réduit la toile à temps | −1 case par vent fort (F6 et plus) |
| 🔍 Méticuleux | Bateau préparé au millimètre : une carte d'avarie tirée retourne dans le paquet et une autre est tirée | Une carte réparation en moins au départ |

## Skippers, bateaux et compétences

### IMOCA

- **Charlie Dalin** (Macif Santé Prévoyance) : Stratège. Vainqueur du Vendée Globe 2024 par la justesse de ses choix de route.
- **Yoann Richomme** (Paprec Arkéa) : Régatier. Double vainqueur de la Solitaire du Figaro : un régatier hors pair.
- **Jérémie Beyou** (Charal) : Coriace. Cinq Vendée Globe : il tient dans le gros temps.
- **Jean Le Cam** (Tout commence en Finistère – Armor-lux) : Bricoleur. Le « Roi Jean », célèbre pour sa débrouillardise à bord.
- **Boris Herrmann** (Malizia - Seaexplorer) : Communicant. Navigateur engagé, il embarque le public et la science dans ses courses.
- **Thomas Ruyant** (Vulnerable) : Attaquant. Vainqueur de la Route du Rhum 2022 en IMOCA : il attaque.
- **Sébastien Simon** (Groupe Dubreuil) : Imperturbable. 3e du Vendée Globe 2024 malgré un foil cassé : imperturbable.
- **Justine Mettraux** (Teamwork - Team SNEF) : Polyvalent. Mini, Figaro, The Ocean Race, IMOCA : à l'aise partout.
- **Samantha Davies** (Initiatives-Cœur) : Voilier. Plusieurs Vendée Globe : elle fait durer son bateau et ses voiles.
- **Clarisse Crémer** (L'Occitane en Provence) : Glisseur. 12e du Vendée Globe 2020 dès sa première participation, rapide au portant.
- **Paul Meilhat** (Biotherm) : Navigateur. Vainqueur de la Route du Rhum 2018 en IMOCA et de The Ocean Race Europe 2025.
- **Violette Dorange** (DeVenir) : Économe. Plus jeune concurrente du Vendée Globe 2024, qu'elle a terminé en ménageant son bateau.
- **Élodie Bonafous** (Horizon29) : Méticuleux. Issue du circuit Figaro, elle prépare son bateau au détail.
- **Sam Goodchild** (Vulnérable) : Prudent. Marin complet, venu des multicoques Ocean Fifty : il sait lever le pied.
- **Benjamin Dutreux** (4CAD - La Mie Câline) : Grimpeur. Régatier passé par le Figaro, solide au près.

### Ultim

- **Thomas Coville** (Sodebo Ultim 3) : Imperturbable. Après plusieurs tentatives, il a battu le record du tour du monde en solitaire en 2016.
- **François Gabart** (Macif) : Glisseur. Record du tour du monde en solitaire en 2017 : la vitesse pure.
- **Yves Le Blevec** (Actual) : Méticuleux. Régulier dans les cinq premiers : un bateau préparé avec minutie.
- **Armel Le Cléac'h** (Banque Populaire XI) : Stratège. Le « Chacal », vainqueur du Vendée Globe 2016.
- **Franck Cammas** (Gitana 17) : Régatier. Vainqueur de la Volvo Ocean Race 2011-2012 et barreur en Coupe de l'America.
- **Anthony Marchand** (Actual Ultim 3) : Polyvalent. Figaro, IMOCA, Ultim : passé par toutes les classes.
- **Charles Caudrelier** (Gitana 18) : Navigateur. Vainqueur de la Route du Rhum 2022 et de l'Arkéa Ultim Challenge 2024.
- **Tom Laperche** (SVR-Lazartigue) : Attaquant. Jeune skipper offensif, révélé sur le circuit Figaro.
- **Francis Joyon** (Idec Sport) : Coriace. Records du tour du monde en solitaire et en équipage : un marin coriace.
- **Sébastien Josse** (Maxi Edmond de Rothschild) : Voilier. Grand marin du large, qui fait durer son matériel.
- **Alexia Barrier** (IDEC) : Communicant. Engagée pour l'océan, elle porte ses projets avec le public.

### Class40

- **Pablo Santurde** (Ibsa Group) : Méticuleux. Dans les cinq premiers 15 fois sur 21 courses : un bateau préparé au détail.
- **Antoine Carpentier** (Crédit Mutuel) : Navigateur. Vainqueur de la Globe 40 2025 : un navigateur au long cours.
- **Corentin Douguet** (Faites un Don sur Snsm.org) : Finesse. Figariste de longue date, il lit le petit temps.
- **Amélie Grassi** (La Boulangère Bio) : Coriace. Marin du large, elle tient dans la brise.
- **Ian Lipinski** (Crédit Mutuel (2019)) : Bricoleur. Ingénieur, il connaît et répare lui-même son bateau.
- **Axel Trehin** (Exalt) : Polyvalent. Régulier dans toutes les conditions.
- **Achille Nebout** (Amarris) : Régatier. Régatier du Figaro, à l'aise près des côtes.
- **Ambrogio Beccaria** (Alla Grande-Pirelli) : Attaquant. 15 victoires en 35 courses : il attaque sans cesse.
- **Frans Budel** (Sec. Hayai) : Économe. Vainqueur de la Globe 40 2022 : il a fait durer son bateau autour du monde.
- **Guillaume Pirouelle** (Seafrigo - Sogestran) : Glisseur. Vainqueur de la Transat Café L'Or 2025 en Class40, rapide au portant.
- **Cédric Château** (Sogestran - Seafrigo) : Prudent. Toujours aux avant-postes, sans casse.
- **William Mathelin-Moreaux** (Les Invincibles) : Communicant. Il fait vivre ses courses au public.
- **Fabien Delahaye** (Legallais) : Météorologue. Figariste expérimenté, il lit finement la météo.
- **Pierre Leboucher** (Penfret) : Imperturbable. Longue carrière en Class40 : rien ne le déstabilise.
- **Mélodie Schaffer** (Whiskey Jack) : Voilier. Tour du monde de la Globe 40 : elle a fait durer ses voiles.

### Ocean Fifty

- **Basile Bourgnon** (Edenred) : Grimpeur. Jeune régatier, solide au près.
- **Sébastien Rogues** (Primonial) : Coriace. Champion des Ocean Fifty Series 2024 : il pousse dans la brise.
- **Oren Nataf** (Rayon Vert) : Communicant. Il fait partager l'aventure de Rayon Vert.
- **Luke Berry** (Le Rire Médecin - Lamotte) : Polyvalent. Mini, Class40, Ocean Fifty : passé par toutes les classes.
- **Erwan Le Roux** (Plastic Odyssey Fifty) : Stratège. Double vainqueur de la Route du Rhum en catégorie Rhum Multi.
- **Gilles Lamire** (Groupe GCA - Mille et Un Sourires) : Économe. Cinq Routes du Rhum terminées : il ménage son trimaran.
- **Thibaut Vauchel-Camus** (Solidaires en Peloton) : Attaquant. 5 victoires en 12 courses : un tempérament de gagneur.
- **Anne-Claire Le Berre** (Upwind by MerConcept) : Méticuleux. Issue du Figaro, préparation soignée avec MerConcept.
- **Baptiste Hulin** (Viabilis Océans) : Navigateur. Régulier dans les cinq premiers.
- **Pierre Quiroga** (Wewise) : Prudent. Régulier, il évite la casse.
- **Erwan Le Draoulec** (Lazare) : Glisseur. Révélé sur la Mini Transat, rapide au portant.
- **Léonard Legrand** (Sodebo Fifty) : Régatier. À l'aise près des côtes, sur Sodebo Fifty.
- **Laurent Bourguès** (La French Fab) : Bricoleur. Débrouillard, il répare tout à bord.
- **Matthieu Perraut** (Elvest) : Finesse. À l'aise dans le petit temps.
- **Thomas Rouxel** (Viabilis Océans) : Voilier. Équipier recherché des grands multicoques, il connaît ses voiles.

### Légendes

- **Éric Tabarly** (Pen Duick III) : Imperturbable. Le père de la course au large moderne, calme en toutes circonstances.
- **Titouan Lamazou** (Écureuil d'Aquitaine II) : Navigateur. Vainqueur du premier Vendée Globe (1989-1990).
- **Alain Gautier** (Bagages Superior) : Économe. Vainqueur du Vendée Globe 1992-1993.
- **Michel Desjoyeaux** (PRB) : Stratège. « Le Professeur », deux fois vainqueur du Vendée Globe.
- **Christophe Auguin** (Groupe Sceta) : Méticuleux. Trois tours du monde en solitaire gagnés : une préparation sans faille.
- **Philippe Jeantot** (Crédit Agricole) : Coriace. Deux fois vainqueur du BOC Challenge, fondateur du Vendée Globe.
- **Yves Parlier** (Aquitaine Innovations) : Bricoleur. « L'Extraterrestre » a refait son mât en course au Vendée Globe 2000-2001.
- **Michel Kleinjans** (Roaring Forty) : Prudent. Vainqueur de la Route du Rhum 2006 en Class40.
- **Laurent Bourgnon** (Primagaz) : Glisseur. Double vainqueur de la Route du Rhum en multicoque, rapide au portant.
- **Pierre Antoine** (Olmix) : Communicant. Vainqueur de la Route du Rhum 2018 en Rhum Multi, figure populaire de la course.
- **Philippe Poupon** (Fleury Michon IX) : Météorologue. Vainqueur de la Route du Rhum 1986 et de la Solitaire du Figaro, fin lecteur de la météo.
- **Jean Maurel** (Elf Aquitaine III) : Grimpeur. Régatier du multicoque des années 1980.
- **Serge Madec** (Jet Services V) : Attaquant. Recordman de la traversée de l'Atlantique sur Jet Services V.
- **Franck Cammas** (Groupama) : Régatier. Vainqueur de la Route du Rhum 2010 sur Groupama 3, barreur de Coupe de l'America.

## Simulations (12/11/2026, 60 parties par essai, ±6 points d'incertitude)

Réglage actuel (en ligne, jeu cd94cb9f) : Navigateur 12 % (IMOCA) et 13 % (Ocean Fifty), Météorologue 12 % et 15 %, Finesse 42 % et 33 %. **Hors de la zone 19-31 % : à régler avec le propriétaire.**

Essais (IMOCA sauf mention) :
- Navigateur sans malus, prévision juste 3 fois sur 4 : 30 %. Avec le malus de −1 case à chaque changement de voile : 12 % (juste 9 fois sur 10), 13 % (toujours juste), 13 % (juste 9 fois sur 10 + 1 carte réparation). **Le malus à chaque changement de voile coûte bien plus que ce que rapporte la prévision.**
- Météorologue sans malus (juste 3 fois sur 4) : 33 %. Juste 9 fois sur 10 avec −1 case à chaque changement de cap : 25 % en IMOCA, mais 12 % en Ocean Fifty.
- Finesse : +1 case F≤3, −1 case F≥5 : 32 % ; +1 case F≤2, −1 case F≥5 : 27 % en IMOCA, 15 % en Ocean Fifty.

Pistes à proposer au propriétaire : malus seulement pour un grand changement (cap de 90° et plus ; passage d'une voile de près à une voile de portant), ou une fois par course au lieu de chaque tour.

**Réglage retenu (12/11/2026, décision du propriétaire : malus seulement pour les grands changements)** :
- Navigateur : prévision juste 9 fois sur 10, −1 case au passage d'une voile de près (Réduite, J3, Solent) à une voile de portant (Code 0, Gennaker, Spi, Spi gros temps) ou l'inverse : 27 % (IMOCA), 18 % (Ocean Fifty).
- Météorologue : prévision juste 3 fois sur 4, −2 cases pour un virage de 90° ou plus : 32 % et 33 %, légèrement fort (sa force vient surtout de la tendance du bulletin, qu'il est seul à connaître).
- Finesse : +1 case F≤3, −1 case dès F5 : 32 % et 17 % (moyenne 24 %).
