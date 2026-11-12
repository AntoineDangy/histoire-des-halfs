// Configuration des séries refondues. Chaque série suit le même schéma sur le site d'origine :
// un sommaire, une liste alphabétique, puis des pages thématiques (résultats, n° de voile, séries de production…).
// Une série n'est publiée que lorsque son sommaire a été aspiré ; sa liste peut arriver plus tard.
// `list` peut être une liste de { rel, label } quand la série réunit plusieurs listes d'origine (filtre par catégorie).
// `current: true` : série de la course au large actuelle, mise en avant dans le menu et sur l'accueil.
// `keep` : ne garde que les bateaux de cette catégorie (une liste d'origine partagée entre plusieurs rubriques).
// Page de classe : `origine` (la course dont la classe est née, si c'est le cas), `etapes` (étapes marquantes, d'après
// l'aperçu Wikipédia et l'archive de l'auteur), `phare` (courses phares dont les vainqueurs ont marqué la classe :
// `histoire` = clé de content/courses-histoire.json filtrée par `classe`, `palmares` = clé de content/palmares.json,
// `solitaire` = content/solitaire.json, `page` = page de résultats de l'auteur), `archis: false` quand le décompte
// par architecte n'a pas de sens (monotypes).
// `classeRe` : nom de la classe dans les palmarès des courses (Wikipédia), pour retrouver les courses où elle a couru.
// `idBy: 'number'` : un bateau sans fiche est rattaché par son numéro (coque ou classe) : en Class 40, « USA 37 » et
// « GBR 37 » sont le même bateau (fiche CQ37). `numberWithPlan` : le numéro ne suffit pas (Mini : numéros réattribués),
// on le complète par le code de plan. `numberFirst` : numéro en tête de liste. `numberLabel` : intitulé de la colonne.

// La liste des maxis d'origine mêle plusieurs classes : son intertitre « MOD 70 » classe les monotypes, un bateau dont
// la fiche mentionne la classe Ultim (il y a couru) est un « Ultim », le reste est « Maxi, G Class ».
const MAXIS_LIST = { rel: 'Histoire des 60 ORMA/Liste des Maxis.htm', label: 'Maxi, G Class', sections: { 'MOD 70': 'MOD 70' }, refine: [{ re: /\bultim/i, label: 'Ultim' }] };

export const SERIES_DEFS = [
  {
    classeRe: /^IMOCA$/, slug: 'imoca', title: 'IMOCA 60', short: 'IMOCA', current: true, eyebrow: 'Monocoques 60 pieds open · Vendée Globe, Route du Rhum, Jacques Vabre',
    lead: 'Les monocoques de 60 pieds de la course au large en solitaire et en double, du BOC Challenge 1986 aux foilers du Vendée Globe.',
    listIntro: 'Tous les noms portés par les 60 pieds au fil des courses, et leur nom de baptême.',
    sommaire: "Histoire des 60'/Sommaire.htm", list: "Histoire des 60'/Liste des 60'.htm", archi: "Histoire des 60'/Architectes.htm",
    origine: { texte: 'La classe naît des tours du monde en solitaire : le BOC Challenge, puis le Vendée Globe, créé en 1989.' },
    etapes: [
      ['1986', 'BOC Challenge : les 60 pieds open courent le tour du monde en solitaire, avec escales.'],
      ['1989', 'Premier Vendée Globe, tour du monde en solitaire sans escale ni assistance.'],
      ['1991', 'Fondation de l’IMOCA par Christophe Auguin, Isabelle Autissier, Alain Gautier et Jean-Luc Van Den Heede.'],
      ['1997', 'Après les chavirages du Vendée Globe et la disparition de Gerry Roufs, les tests de redressement deviennent obligatoires.'],
      ['1998', 'La fédération internationale reconnaît la classe.'],
      ['2013', 'Mât et quille monotypes, pour contenir les coûts.'],
      ['2015', 'Génération des foils.'],
      ['2023', 'Les IMOCA courent The Ocean Race en équipage.'],
    ],
    phare: [
      { titre: 'Vendée Globe', palmares: 'vendee-globe' },
      { titre: 'Route du Rhum, IMOCA', histoire: 'Route du Rhum – Destination Guadeloupe', classe: /^IMOCA$/ },
      { titre: 'Transat Jacques Vabre, IMOCA', histoire: 'Transat Café L\'Or', classe: /^IMOCA$/ },
    ],
    pages: [
      { rel: "Histoire des 60'/R R R R.htm", slug: 'resultats', title: 'Résultats', results: true, lead: 'Vendée Globe, Route du Rhum, Transat Jacques Vabre, BOC et Around Alone : les classements, édition par édition.' },
      { rel: "Histoire des 60'/N N N N.htm", slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Retrouver un 60 pieds par son numéro de voile. Un même numéro peut avoir été porté par plusieurs bateaux.' },
      { rel: '2024 VG    VG      VG.htm', slug: 'vendee-globe-2024', title: 'Vendée Globe 2024', lead: 'Les inscrits et les bateaux du dixième Vendée Globe.' },
      { rel: '2020 VG.htm', slug: 'vendee-globe-2020', title: 'Vendée Globe 2020', lead: 'Les inscrits et les bateaux du Vendée Globe 2020-2021.' },
    ],
  },
  // Multicoques : une rubrique par classe, comme pour les monocoques Open.
  {
    classeRe: /^Ultim$/, slug: 'ultim', title: 'Ultim', short: 'Ultim', current: true, eyebrow: 'Trimarans géants · Route du Rhum, Arkea Ultim Challenge, Jules Verne',
    lead: 'Les trimarans géants, jusqu’à 32 m de long et 23 m de large, capables de faire le tour du monde en solitaire en volant sur leurs foils.',
    listIntro: 'Sont classés ici les grands multicoques qui ont couru dans la classe Ultim, des anciens maxis reconvertis aux Ultim volants d’aujourd’hui.',
    sommaire: 'Histoire des 60 ORMA/Sommaire.htm', list: [MAXIS_LIST], keep: 'Ultim',
    origine: { texte: 'La classe naît de la Route du Rhum : en 2010, la catégorie Ultime y réunit les multicoques de plus de 60 pieds, sans limite de taille.' },
    etapes: [
      ['2010', 'Route du Rhum : naissance de la catégorie Ultime, gagnée par Franck Cammas sur Groupama 3.'],
      ['2015', 'Un collectif autour des équipes Banque Populaire, Macif et Sodebo encadre la longueur des bateaux.'],
      ['2018', 'La jauge Ultim 32/23 (32 m de long, 23 m de large) est entérinée par la Fédération française de voile.'],
      ['2024', 'Arkéa Ultim Challenge, premier tour du monde en solitaire de la classe, gagné par Charles Caudrelier en 50 jours.'],
      ['2026', 'Sodebo Ultim 3 et Thomas Coville battent le record du Trophée Jules Verne.'],
    ],
    phare: [
      { titre: 'Route du Rhum, Ultim', histoire: 'Route du Rhum – Destination Guadeloupe', classe: /^Ultim$/ },
      { titre: 'Transat Jacques Vabre, Ultim', histoire: 'Transat Café L\'Or', classe: /^Ultim$/ },
    ],
    pages: [],
  },
  {
    // Le site d'origine range les 50 pieds à part (dossier « 50 multis »).
    classeRe: /^(Multi ?50|Ocean Fifty)$/, slug: 'ocean-fifty', title: 'Ocean Fifty', short: 'Ocean Fifty', current: true, eyebrow: 'Trimarans de 50 pieds · ex-Multi 50',
    lead: 'Les trimarans de 50 pieds, de la classe Multi 50 à l’Ocean Fifty d’aujourd’hui : les multicoques de course les plus accessibles.',
    listIntro: 'Les noms portés par les bateaux lors des différentes courses, et leur nom de baptême.',
    sommaire: "50 multis/Sommaire 50' multis.htm", list: "50 multis/Liste des 50' multis.htm", archi: "50 multis/Architectes 50' multis.htm",
    origine: { texte: 'La classe s’est construite autour de la catégorie des 50 pieds de la Route du Rhum.' },
    etapes: [
      ['1998', 'Franck-Yves Escoffier gagne la Route du Rhum en 50 pieds, puis encore en 2002 et 2006.'],
      ['2021', 'La classe Multi50 devient Ocean Fifty (16 mars) et lance son circuit, le Pro Sailing Tour (mai).'],
      ['2024', 'Ocean Fifty Series : titre de Sébastien Rogues.'],
      ['2025', 'Ocean Fifty Series : titre de Baptiste Hulin.'],
    ],
    phare: [
      { titre: 'Route du Rhum, 50 pieds', histoire: 'Route du Rhum – Destination Guadeloupe', classe: /^(Multi50|Ocean Fifty)$/ },
      { titre: 'Transat Jacques Vabre, 50 pieds', histoire: 'Transat Café L\'Or', classe: /^(Multi50|Ocean Fifty)$/ },
      { titre: 'Ocean Fifty Series', histoire: 'Ocean Fifty Series – Act 1 Sainte-Maxime', classe: /championnat/i },
    ],
    pages: [
      { rel: "50 multis/R50' multis.htm", slug: 'resultats', title: 'Résultats', results: true, lead: 'Historique et classements des multicoques de 50 pieds.' },
    ],
  },
  {
    classeRe: /^MOD ?70$/, slug: 'mod-70', title: 'MOD 70', short: 'MOD 70', eyebrow: 'Trimarans monotypes de 70 pieds',
    lead: 'Le trimaran monotype de 70 pieds, héritier des ORMA : sept bateaux identiques, de la Krys Ocean Race aux courses d’aujourd’hui.',
    listIntro: 'Les MOD 70 sous leurs différents noms, avec leur numéro de coque (#1 à #7).',
    sommaire: 'Histoire des 60 ORMA/Sommaire.htm', list: [MAXIS_LIST], keep: 'MOD 70',
    archis: false,
    modeles: [{ nom: 'MOD 70', annee: 2011, architecte: 'VPLP', exemplaires: 7 }],
    modelesSource: { titre: 'Multi One Design (Wikipédia)', url: 'https://fr.wikipedia.org/wiki/Multi_One_Design' },
    etapes: [
      ['2009', 'Lancement du programme Multi One Design 70, dessiné par VPLP, à l’initiative de Stève Ravussin et Marco Simeoni.'],
      ['2011', 'Les sept trimarans sont mis à l’eau à partir de mars.'],
      ['2012', 'Krys Ocean Race, de New York à Brest, et European Tour par étapes.'],
      ['2013', 'Route des Princes et Transat Jacques Vabre.'],
      ['Ensuite', 'Trop courts pour la jauge Ultim 32/23, les MOD 70 courent sous de nouveaux noms, comme Maserati ou Argo.'],
    ],
    phare: [
      { titre: 'Transat Jacques Vabre, MOD 70', histoire: 'Transat Café L\'Or', classe: /^MOD ?70$/ },
    ],
    pages: [],
  },
  {
    classeRe: /^Multicoques 60/, slug: 'orma-60', title: 'ORMA 60′', short: 'ORMA 60', eyebrow: 'Trimarans de 60 pieds · années 1980 – 2000',
    lead: 'Les trimarans ORMA de 60 pieds : Route du Rhum, Transat Jacques Vabre, Grands Prix… l’âge d’or des multicoques de course.',
    listIntro: 'Les noms portés par chaque 60 pieds au fil des courses, et leur nom de baptême.',
    sommaire: 'Histoire des 60 ORMA/Sommaire.htm', list: "Histoire des 60 ORMA/Liste des 60' ORMA.htm", archi: 'Histoire des 60 ORMA/Architectes.htm',
    etapes: [
      ['1996', 'Fondation de l’Ocean Racing Multihull Association, qui régit les trimarans de 60 pieds.'],
      ['2002', 'Route du Rhum : trois des dix-huit ORMA seulement rallient la Guadeloupe.'],
      ['2006', 'Le championnat se limite aux Grands Prix.'],
      ['2007', 'L’ORMA décide de passer à un 70 pieds monotype.'],
      ['2010', 'La catégorie Ultime de la Route du Rhum prend le relais.'],
    ],
    phare: [
      { titre: 'Route du Rhum, vainqueurs', histoire: 'Route du Rhum – Destination Guadeloupe', classe: /Classement général/, de: 1990, a: 2006 },
      { titre: 'Transat Jacques Vabre, 60 pieds', histoire: 'Transat Café L\'Or', classe: /Multicoques 60/ },
    ],
    pages: [
      { rel: 'Histoire des 60 ORMA/R R R R.htm', slug: 'resultats', title: 'Résultats', results: true, lead: 'Les grandes courses des multicoques océaniques.' },
    ],
  },
  {
    classeRe: /^Record$/, slug: 'maxis-g-class', title: 'Maxis et G Class', short: 'Maxi multicoque', eyebrow: 'Grands multicoques hors jauge',
    lead: 'Les grands multicoques hors jauge, des catamarans géants de The Race aux recordmen du Trophée Jules Verne.',
    listIntro: 'Les grands multicoques qui n’ont pas couru dans la classe Ultim (voir la rubrique Ultim pour les autres).',
    sommaire: 'Histoire des 60 ORMA/Sommaire.htm', list: [MAXIS_LIST], keep: 'Maxi, G Class',
    origine: { texte: 'Les maxis naissent des records : le Trophée Jules Verne (1993), puis The Race (2000), tour du monde sans limite de taille.' },
    etapes: [
      ['1993', 'Premier Trophée Jules Verne : Bruno Peyron et Commodore Explorer bouclent le tour du monde en 79 jours.'],
      ['2000', 'The Race : six maxis quittent Barcelone le 31 décembre ; Club Med et Grant Dalton l’emportent.'],
      ['2005', 'Orange II et Bruno Peyron abaissent le record du Trophée Jules Verne.'],
      ['2010', 'Record pour Groupama 3, puis pour Banque Populaire V en 2012.'],
      ['2017', 'Idec Sport (ex-Groupama 3) et Francis Joyon battent le record.'],
    ],
    phare: [
      { titre: 'Trophée Jules Verne, records', histoire: 'Trophée Jules Verne – tentative Sodebo Ultim 3', classe: /Record/ },
    ],
    pages: [],
  },
  {
    // La colonne « plan » de la liste donne le modèle (Pogo 40, Akilaria, Mach 40) ; l'architecte est dans la fiche.
    listColonne: 'modele',
    classeRe: /^Class ?40$/, slug: 'class-40', title: 'Class 40', short: 'Class 40', current: true, idBy: 'number', numberLabel: 'N° de voile', numberFromFile: /^CQ\s?(\d{1,3})\b/i, eyebrow: 'Class 40 et 40 pieds Open',
    lead: 'La classe la plus nombreuse de la course au large : des 40 pieds au coût maîtrisé, et leurs ancêtres les 40 pieds Open.',
    listIntro: 'Les noms portés par les bateaux lors des différentes courses, et leur nom de baptême.',
    sommaire: "Histoire des 40' monos/Sommaire 40' mono.htm", list: "Histoire des 40' monos/Liste des 40' mono.htm", archi: "Histoire des 40' monos/Architectes 40' mono.htm",
    etapes: [
      ['2004', 'Patrice Carpentier fédère architectes, coureurs et chantiers autour d’un 40 pieds de course au coût accessible.'],
      ['2005', 'L’association de la classe est présentée au Salon nautique.'],
      ['2006', 'Route du Rhum : 25 Class40 au départ, plus que toute autre catégorie.'],
      ['Aujourd’hui', 'Les numéros de coque dépassent 200.'],
    ],
    phare: [
      { titre: 'Route du Rhum, Class 40', histoire: 'Route du Rhum – Destination Guadeloupe', classe: /^Class ?40$/ },
      { titre: 'Transat Jacques Vabre, Class 40', histoire: 'Transat Café L\'Or', classe: /^Class ?40$/ },
    ],
    pages: [
      { rel: "Histoire des 40' monos/R40' mono.htm", slug: 'resultats', title: 'Résultats', results: true, raceFrom: 'heading', lead: 'Les principales courses des Class 40.' },
      { rel: "Histoire des 40' monos/N40' mono.htm", slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Les Class 40 par numéro de voile, avec leur historique.' },
    ],
  },
  {
    // Les trois générations de monotypes de la Solitaire du Figaro, rangées par le site d'origine avec les 40 pieds.
    slug: 'figaro', title: 'Figaro Bénéteau', short: 'Figaro', current: true, eyebrow: 'Monotypes de la Solitaire du Figaro · depuis 1990',
    lead: 'Les monotypes de la Solitaire du Figaro, du Figaro Solo de 1990 au Figaro 3 à foils : l’école de la course au large en solitaire, où la plupart des skippers du Vendée Globe ont appris le métier.',
    listIntro: 'Les trois générations de Figaro Bénéteau, avec les noms portés au fil des saisons.',
    // Page générée (build.mjs, solitairePage) : la Solitaire de 1970 à aujourd'hui.
    links: [['figaro/la-solitaire/', 'La Solitaire, 1970 →']],
    sommaire: "Histoire des 40' monos/Sommaire Figaro 2.htm",
    list: [
      { rel: "Histoire des 40' monos/Liste des Figaro Solo.htm", label: 'Figaro Solo' },
      { rel: "Histoire des 40' monos/Liste des Figaro 2.htm", label: 'Figaro 2' },
      { rel: "Histoire des 40' monos/Liste des Figaro 3.htm", label: 'Figaro 3' },
    ],
    archis: false,
    // Monotype : l'onglet « Architectes » présente les modèles successifs (d'après Wikipédia, Figaro Bénéteau).
    modeles: [
      { nom: 'Figaro (Solo)', annee: 1990, architecte: 'Groupe Finot, avec Jean Berret', chantier: 'Bénéteau', exemplaires: 140, cat: 'Figaro Solo' },
      { nom: 'Figaro II', annee: 2003, architecte: 'Marc Lombard', chantier: 'Bénéteau', exemplaires: 96, cat: 'Figaro 2' },
      { nom: 'Figaro III', annee: 2017, architecte: 'VPLP (Van Peteghem Lauriot-Prévost)', chantier: 'Bénéteau', cat: 'Figaro 3' },
    ],
    modelesSource: { titre: 'Figaro Bénéteau (Wikipédia)', url: 'https://fr.wikipedia.org/wiki/Figaro_B%C3%A9n%C3%A9teau' },
    origine: { texte: 'La classe naît de la Solitaire : la Course de l’Aurore, créée en 1970, devenue Course puis Solitaire du Figaro en 1980, se court en monotype Bénéteau depuis 1990.', href: 'figaro/la-solitaire/', lien: 'La Solitaire, de 1970 à aujourd’hui' },
    etapes: [
      ['1970', 'Première Course de l’Aurore, de Brest à Pornic, sur des voiliers de série puis des Half Tonners.'],
      ['1980', 'La course prend le nom du Figaro.'],
      ['1990', 'Premier Figaro Bénéteau, dessiné par le Groupe Finot avec Jean Berret : 140 exemplaires.'],
      ['2003', 'Figaro II de Marc Lombard, à ballasts et double safran : 96 exemplaires.'],
      ['2017', 'Lancement du Figaro III de VPLP, premier monotype équipé de foils.'],
      ['2019', 'Le Figaro III court sa première Solitaire.'],
    ],
    phare: [
      { titre: 'La Solitaire du Figaro', solitaire: true, de: 1990, href: 'figaro/la-solitaire/' },
    ],
    pages: [
      { rel: "Histoire des 40' monos/Résultats Figaro 2.htm", slug: 'resultats-figaro-2', title: 'Résultats Figaro 2', lead: 'Les saisons du Figaro 2 et le Championnat de France des solitaires.' },
      { rel: "Histoire des 40' monos/Résultats Figaro 3.htm", slug: 'resultats-figaro-3', title: 'Résultats Figaro 3', lead: 'Les saisons du Figaro 3.' },
      { rel: "Histoire des 40' monos/Sommaire Figaro Solo.htm", slug: 'figaro-solo', title: 'Le Figaro Solo', lead: 'Le premier Figaro Bénéteau, monotype de la Solitaire de 1990 à 2002.' },
      { rel: "Histoire des 40' monos/Sommaire Figaro 3.htm", slug: 'figaro-3', title: 'Le Figaro 3', lead: 'Le Figaro à foils, depuis 2019.' },
      { rel: "Histoire des 40' monos/Numéros 40' Figaro 2.htm", slug: 'numeros-figaro-2', title: 'Numéros Figaro 2', lead: 'Retrouver un Figaro 2 par son numéro de voile.' },
      { rel: "Histoire des 40' monos/Numéros Figaro 3.htm", slug: 'numeros-figaro-3', title: 'Numéros Figaro 3', lead: 'Retrouver un Figaro 3 par son numéro de voile.' },
    ],
  },
  {
    // TP52 : monocoques de 52 pieds courus en équipage. Les rôles à bord et le palmarès viennent de l'extraction
    // outils/tp52/extraire.py (donnees/tp52/), selon les règles validées par le propriétaire (docs/decisions.md, § TP52).
    slug: 'tp52', title: 'TP52', short: 'TP52', tp52: true, eyebrow: 'Monocoques de 52 pieds courus en équipage',
    lead: 'Des 52 pieds construits à une jauge à boîte, la Transpac 52 : la MedCup jusqu’en 2011, puis le 52 Super Series.',
    listIntro: 'Les TP52 dans l’ordre de la liste de l’auteur, avec leurs noms successifs.',
    sommaire: "50' monos/TP Sommaire.htm", list: "50' monos/TP Liste.htm", archi: "50' monos/TP Architectes.htm",
    etapes: [
      ['2011', 'Fin de l’Audi MedCup, le circuit où couraient les TP52.'],
      ['2012', 'Création du 52 Super Series, à l’initiative de l’Argentin Alberto Roemmers.'],
    ],
    pages: [
      { rel: "50' monos/TP Numéros.htm", slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Retrouver un TP52 par son numéro de voile.' },
    ],
  },
  {
    slug: 'half-tonners', title: 'Half Tonners', short: 'Half Tonner', eyebrow: 'Jauge RORC puis IOR · 1966 – 1993',
    lead: "Voiliers de course d'environ 9 m construits pour courir à rating fixe, sans handicap. Ils ont fait la Solitaire de l'Aurore puis du Figaro, la Half Ton Cup, et naviguent encore aujourd'hui en IRC.",
    listIntro: "La liste réunit les bateaux du palmarès de la Half Ton Cup et de l'Aurore-Figaro, ainsi que ceux de la classe V IOR puis IRC.",
    sommaire: 'index 2.HTML', list: 'Half Liste.htm', archi: 'Archi.htm', aliases: ['Intro Anglais.htm'],
    links: [['figaro/la-solitaire/', 'La Solitaire, 1970 →']],
    origine: { texte: 'La classe naît de la Half Ton Cup, disputée pour la première fois à La Rochelle en 1967, dans le sillage de la One Ton Cup ; en France, les Half Tonners font aussi la Course de l’Aurore puis la Solitaire du Figaro.', href: 'half-tonners/half-ton-cup/', lien: 'Toutes les Half Ton Cup' },
    etapes: [
      ['1966', 'Coupe de l’Atlantique des 18 pieds, à La Rochelle.'],
      ['1967', 'Première Half Ton Cup, à La Rochelle, au rating de 19 pieds RORC.'],
      ['1970', 'Première Course de l’Aurore, future Solitaire du Figaro.'],
      ['1971', 'Passage à la jauge IOR, au rating de 21,7 pieds.'],
      ['1979', 'Le rating est relevé.'],
      ['1990', 'Le monotype Figaro Bénéteau arrive sur la Solitaire ; les Half Tonners y courent encore avec lui cette année-là.'],
      ['1993', 'Dernière Half Ton Cup, à Bayona.'],
      ['2003', 'Half Ton Classics Cup à Nieuport : les anciens halfs courent de nouveau, en IRC.'],
    ],
    phare: [
      { titre: 'Half Ton Cup', page: 'Half Ton Cup.htm', de: 1967, a: 1993 },
      { titre: 'Course de l’Aurore et Solitaire du Figaro', solitaire: true, a: 1989, href: 'figaro/la-solitaire/' },
    ],
    pages: [
      // `race` : nom de course donné aux classements de la page dans les fiches skipper ; `raceFrom` : 'title' (en-tête
      // d'édition, Mini Transat…) ou 'heading' (intertitre avant les lignes, quand une année réunit plusieurs courses).
      { rel: 'Half Ton Cup.htm', slug: 'half-ton-cup', title: 'Half Ton Cup', results: true, race: 'Half Ton Cup', lead: 'Le championnat du monde des Half Tonners, édition par édition, de La Rochelle 1966 aux Half Ton Classics d’aujourd’hui.' },
      { rel: 'Figaro.htm', slug: 'solitaire-figaro', title: "Solitaire de l'Aurore et du Figaro", results: true, race: "Solitaire de l'Aurore / du Figaro", lead: "Les halfs ont été les bateaux de la Solitaire de l'Aurore, devenue Solitaire du Figaro, jusqu'à l'arrivée du monotype." },
      { rel: 'No Voile.htm', slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Retrouver un Half Tonner à partir de son numéro de voile.' },
      { rel: 'Liste S S S S.htm', slug: 'series-de-production', title: 'Séries de production', lead: 'Les modèles de série construits à la jauge Half Ton, de l’Arpège au Super Arlequin.' },
    ],
  },
  {
    slug: 'quarter-tonners', title: 'Quarter Tonners', short: 'Quarter Tonner', eyebrow: 'Jauge IOR · 1967 – 1996',
    lead: 'Les plus petits bateaux de la jauge IOR : environ 7,50 m, courus à rating fixe pour la Quarter Ton Cup entre 1967 et 1996.',
    listIntro: 'Les noms portés par les bateaux lors des différentes courses, et leur nom de baptême.',
    sommaire: 'Quarter Tonner/Sommaire quarter.htm', list: 'Quarter Tonner/Quarter Liste.htm', archi: 'Quarter Tonner/Q Architectes.htm',
    origine: { texte: 'La classe naît de la Quarter Ton Cup, championnat du monde des plus petits bateaux de la jauge IOR.', href: 'quarter-tonners/quarter-ton-cup/', lien: 'Toutes les Quarter Ton Cup' },
    etapes: [
      ['1967', 'Première Quarter Ton Cup.'],
      ['Années 1980', 'Deux plans de Jacques Fauroux, Bullit puis Lacydon Protis, remportent la coupe.'],
      ['1996', 'Dernière Quarter Ton Cup à la jauge IOR : 29 coupes depuis 1967, 577 participations connues sur 21 éditions.'],
      ['2005', 'La Quarter Ton Cup renaît à Cowes, en IRC.'],
    ],
    phare: [
      { titre: 'Quarter Ton Cup', page: 'Quarter Tonner/Quarter R R R.htm', a: 1996 },
    ],
    pages: [
      { rel: 'Quarter Tonner/Quarter R R R.htm', slug: 'quarter-ton-cup', title: 'Quarter Ton Cup', results: true, looseEditions: true, race: 'Quarter Ton Cup', lead: 'Les résultats de la Quarter Ton Cup, édition par édition.' },
      { rel: 'Quarter Tonner/Quarter No Voile.htm', slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Retrouver un Quarter Tonner à partir de son numéro de voile.' },
      { rel: 'Quarter Tonner/Q S S S.htm', slug: 'series-de-production', title: 'Séries de production', lead: 'Les modèles de série construits à la jauge Quarter Ton.' },
    ],
  },
  {
    slug: 'trois-quarts-tonners', title: 'Trois-quarts Tonners', short: '3/4 Tonner', eyebrow: 'Jauge IOR · 1974 – 1994',
    lead: 'Voiliers de course de la Three Quarter Ton Cup, courue à rating fixe de 24,5 pieds IOR entre 1974 et 1994.',
    listIntro: 'Les noms portés par les bateaux lors des différentes courses, et leur nom de baptême.',
    sommaire: 'Trois Quart/Trois Quart tonner Sommaire.htm', list: 'Trois Quart/Trois Quart tonner Liste.htm', archi: 'Trois Quart/Trois Quart tonner Architectes.htm',
    origine: { texte: 'La classe naît de la Three Quarter Ton Cup, courue à rating fixe de 1974 à 1994.', href: 'trois-quarts-tonners/three-quarter-ton-cup/', lien: 'Toutes les Three Quarter Ton Cup' },
    etapes: [
      ['1974', 'Première Three Quarter Ton Cup ; le C&C 3/4 Ton est construit à quinze exemplaires au Canada.'],
      ['1977', 'Lancement du SHE 36 de Sparkman & Stephens.'],
      ['1984', 'À Kiel, les DB-2 de Dehler prennent les trois premières places de la coupe.'],
      ['1994', 'Dernière coupe, avec la fin de la jauge IOR.'],
    ],
    phare: [
      { titre: 'Three Quarter Ton Cup', page: 'Trois Quart/TQT R R R.htm', a: 1994 },
    ],
    pages: [
      { rel: 'Trois Quart/TQT R R R.htm', slug: 'three-quarter-ton-cup', title: 'Three Quarter Ton Cup', results: true, race: 'Three Quarter Ton Cup', lead: 'Les résultats de la Three Quarter Ton Cup, édition par édition.' },
      { rel: 'Trois Quart/Trois Quart tonner Numero Voile.htm', slug: 'numeros-de-voile', title: 'Numéros de voile', lead: 'Retrouver un Trois-quarts Tonner à partir de son numéro de voile.' },
      { rel: 'Trois Quart/TQT S S S.htm', slug: 'series-de-production', title: 'Séries de production', lead: 'Les modèles de série construits à la jauge Three Quarter Ton.' },
    ],
  },
  {
    // Un Mini se désigne d'abord par son numéro de coque : colonne en tête de liste, numéro avant le nom sur la fiche.
    classeRe: /^(Proto|Série)$/, slug: 'minis', title: 'Mini 6.50', short: 'Mini 6.50', current: true, idBy: 'number', numberLabel: 'N° de coque', numberFirst: true, numberWithPlan: true, listOptions: { mini: true }, eyebrow: 'Mini Transat · depuis 1977',
    lead: 'Prototypes et séries de 6,50 m : le banc d’essai de la course au large, de la première Mini Transat à aujourd’hui.',
    listIntro: 'Chaque Mini est référencé par son numéro de coque, par son nom et par son architecte.',
    sommaire: 'Histoire des Minis/Sommaire.htm', list: 'Histoire des Minis/Liste des minis.htm', archi: 'Histoire des Minis/Architectes.htm',
    origine: { texte: 'La classe naît de la Mini Transat, créée en 1977 par Bob Salmon pour traverser l’Atlantique en solitaire sur des voiliers de 6,50 m au plus.' },
    etapes: [
      ['1977', 'Première Mini Transat, gagnée par Daniel Gilard.'],
      ['1984', 'Les coureurs fondent l’association Voiles 6,50, chargée de la jauge et du circuit.'],
      ['1985', 'La Mini Transat part désormais de France.'],
      ['1994', 'La gestion sportive passe à la Classe Mini.'],
      ['2011', 'Le Magnum à étrave ronde de David Raison gagne : il inspirera les Class40 et les IMOCA.'],
    ],
    phare: [
      // 1987 : un seul classement, sans Proto ni Série.
      { titre: 'Mini Transat', histoire: 'Mini Transat Legallais', classe: /^(Proto|Série|Classement général)$/ },
    ],
    pages: [
      { rel: 'Histoire des Minis/R R R R.htm', slug: 'resultats', title: 'Résultats', results: true, looseEditions: true, raceFrom: 'title', lead: 'Mini Transat et grandes courses du circuit, édition par édition.' },
      { rel: 'Histoire des Minis/N N N N.htm', slug: 'numeros', title: 'Numéros de coque', lead: 'Retrouver un Mini à partir de son numéro.' },
      { rel: 'Histoire des Minis/S S S S.htm', slug: 'series-de-production', title: 'Séries', lead: 'Les Minis de série : Pogo, Nacira, Zéro, Maxi…' },
      { rel: 'Histoire des Minis/Concurrents.htm', slug: 'concurrents', title: 'Concurrents', lead: 'Les skippers et leurs bateaux.' },
    ],
  },
];

// Catalogue complet de l'archive d'origine, rangé en trois grandes familles (menu principal, page Séries, accueil).
// Une entrée avec `local` pointe vers une série refondue (si elle est publiée) ; les autres renvoient à l'archive d'origine.
// `nav: true` : la famille a son menu déroulant dans l'en-tête.
// Monocoques : les principales classes de la course au large dans le menu, les autres dans « Monocoques historiques »
// (`parent` : rubrique du menu à surligner, `more` : lien en bas du menu déroulant).
export const CATALOG = [
  { id: 'monocoques', family: 'Monocoques', short: 'Monocoques', nav: true, more: { href: 'monocoques-historiques/', label: 'Autres monocoques historiques' }, items: [
    ['IMOCA 60', "Histoire des 60'/Sommaire.htm", 'imoca'], ['Class 40', "Histoire des 40' monos/Sommaire 40' mono.htm", 'class-40'],
    ['Figaro Bénéteau', 'Histoire des 40\' monos/Sommaire Figaro 2.htm', 'figaro'], ['Mini 6.50', 'Histoire des Minis/Sommaire.htm', 'minis']] },
  { id: 'monocoques-historiques', family: 'Monocoques historiques', short: 'Monocoques historiques', parent: 'monocoques', items: [
    ['Half Tonners', 'index 2.HTML', 'half-tonners'], ['Quarter Tonners', 'Quarter Tonner/Sommaire quarter.htm', 'quarter-tonners'],
    ['Trois-quarts Tonners', 'Trois Quart/Trois Quart tonner Sommaire.htm', 'trois-quarts-tonners'],
    ['One Tonners', 'One Tonner/One tonner Sommaire.htm'], ['Two Tonners', 'One Tonner/00 TT Sommaire.htm'], ['Liste IOR toutes tailles', 'index IOR.htm'],
    ['Muscadet', 'Muscadet/Mu Sommaire.htm'], ['50\' monocoques', '50\' monos/Sommaire 50 monos.htm'], ['TP 52', '50\' monos/TP Sommaire.htm'],
    ['Maxis monocoques', 'Maxis Monos/00 M Sommaire.htm']] },
  { id: 'multicoques', family: 'Multicoques', short: 'Multicoques', nav: true, items: [
    ['Ultim', 'Histoire des 60 ORMA/Liste des Maxis.htm', 'ultim'], ['Ocean Fifty', "50 multis/Sommaire 50' multis.htm", 'ocean-fifty'],
    ['MOD 70', 'Histoire des 60 ORMA/Liste des Maxis.htm', 'mod-70'], ['ORMA 60′', 'Histoire des 60 ORMA/Sommaire.htm', 'orma-60'],
    ['Maxis et G Class', 'Histoire des 60 ORMA/Liste des Maxis.htm', 'maxis-g-class'],
    ['Formule 40', 'Quarter Tonner/Sommaire formule 40.htm'], ['Liste générale des multis', '50 multis/Liste des multis.htm']] },
  { id: 'transversal', family: 'Transversal', items: [
    ['Architectes, toutes séries', 'Architectes.htm'], ['Courses', 'index Courses.htm'],
    // Une course, pas une classe : rangée avec les courses.
    ['Whitbread et Volvo Ocean Race', 'Histoire des 60\'/W som.htm'], ['Classement des navigateurs solitaires', 'Classement Solo.htm'],
    ['Archives photographiques de la revue « Bateaux »', '0 Bx Archives.htm'], ['Photos', 'Photos.htm']] },
];
