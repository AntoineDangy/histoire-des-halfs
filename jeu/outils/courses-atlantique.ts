// Paramètres des courses atlantiques générées par outils/generer-carte-rhum.ts.
// Zones météo et zones interdites STYLISÉES ; règles d'escale et durée du tour PROVISOIRES.

type Rect = (lonA: number, latA: number, lonB: number, latB: number) => [number, number, number, number];

export interface Marque {
  id: string;
  nom: string;
  /** Ligne à franchir, de (lon, lat) à (lon, lat). */
  de: [number, number];
  a: [number, number];
  /** Bouée : seule la bouée (au point « de ») est dessinée ; on la franchit en passant du côté de « a ». */
  bouee?: boolean;
  /** Contrôle invisible : le moteur l'exige, mais seule la marque voisine est dessinée et annoncée (11/11/2026). */
  cachee?: boolean;
  /** Bouée cardinale (dessin) : « nord » = on passe au nord de la bouée (12/11/2026). */
  cardinale?: 'nord';
}

export interface ConfigCourse {
  id: string;
  nom: string;
  sous_titre: string;
  note: string;
  classes: string[];
  double?: boolean;
  /** Hauteur de la carte en cases (96 : jusqu'à 7° N ; 134 : jusqu'à 11° S). */
  hauteur: number;
  depart: { nom: string; lon: number; lat: number; zone: [number, number] };
  arrivee: { nom: string; lon: number; lat: number };
  ports: Record<string, [number, number]>;
  /** Marques de parcours par classe (vide : arrivée seule). */
  marques: Record<string, Marque[]>;
  distances?: Record<string, number>;
  /** Cadre de la carte (par défaut : l'Atlantique de la Route du Rhum). */
  cadre?: { lonMin: number; lonMax: number; latMax: number; largeur: number };
  milles_par_case?: number;
  echelle?: number;
  heures_par_tour?: number;
  duree_cible_tours?: number[];
  vitesse_unique?: boolean;
  echelle_classe?: Record<string, number>;
  vent_initial?: { direction: number; force: number };
  rayon_cotier?: number;
  rayon_arrivee?: number;
  /** Point de passage de la route directe affichée (lon, lat) : orthodromie en deux morceaux (12/11/2026). */
  via?: [number, number];
  /** Points de passage successifs de la route directe affichée (lon, lat), à la place de `via` (Fastnet, 13/11/2026). */
  vias?: [number, number][];
  /** Centre de la zone d'arrivée (lon, lat), s'il diffère du port d'arrivée (12/11/2026). */
  centre_arrivee?: [number, number];
  /** Aire minimale (en cases²) d'une île gardée sur la carte. */
  ile_min?: number;
  /** Îles ajoutées à la main (lon, lat), absentes des côtes au 1:50 m. */
  iles?: [number, number][];
  // Cadre [lon min, lat min, lon max, lat max] où les cases de terre de `iles` sont dessinées sur la carte.
  traces_detail?: [number, number, number, number];
  /** Nombre de tours du vainqueur mesuré en simulation (IA contre IA), par classe. */
  tours_estimes?: Record<string, number>;
  zones: (rect: Rect) => unknown[];
  lieux: [string, number, number, string][];
}

const PORTS_ATLANTIQUE: Record<string, [number, number]> = {
  'Brest': [-4.49, 48.38], 'La Rochelle': [-1.15, 46.16], 'Lisbonne': [-9.42, 38.69], 'Ponta Delgada (Açores)': [-25.67, 37.74], // ajoutés le 13/11/2026 (porteur de projet)
  'Lorient': [-3.37, 47.7], 'La Corogne': [-8.4, 43.37], // Lorient : port de secours en France (13/11/2026, porteur de projet)
  'Horta (Açores)': [-28.63, 38.53], 'Funchal (Madère)': [-16.91, 32.65], 'Las Palmas (Canaries)': [-15.43, 28.14], 'Mindelo (Cap-Vert)': [-24.98, 16.89],
};

const zonesNord = (rect: Rect) => [
  { type: 'alize', nom: 'Alizés', rect: rect(-58, 12, -22, 26), favorables: [8, 10, 12], defavorables: [0, 2, 4], texte: 'ALIZÉS · vent de N à E, F3 à 7 · favorables vers S, SW, W',
    // Décision du 09/11/2026 : vent propre à la zone, régulier. Décision du 11/11/2026 (porteur de projet) : dans l'hémisphère
    // nord, il oscille au plus de 90°, du Nord à l'Est.
    vent_regulier: { directions: [0, 4], forces: [3, 7], depart: { direction: 2, force: 5 } } },
  // Décision du 10/11/2026 : brume dans le golfe de Gascogne, entre la pointe de Bretagne et le cap Finisterre.
  { type: 'brume', nom: 'Brume', rect: rect(-9.6, 44.2, -5.6, 47.4), texte: 'Brume : bateaux invisibles, risque de collision' },
  { type: 'brume', nom: 'Brume des Açores', rect: rect(-31.5, 36.8, -24.8, 40.2), texte: 'Brume des Açores' },
  // Demande du porteur de projet (13/11/2026) : vaste zone de brume au sud-ouest de l'Irlande (49,5° N à 51,35° N, de 14° W
  // au méridien du Fastnet Rock), la même que sur la carte du Fastnet.
  { type: 'brume', nom: "Brume du sud-ouest de l'Irlande", rect: rect(-14, 49.5, -9.7, 51.35), texte: "Brume du sud-ouest de l'Irlande" },
  { type: 'courant', nom: 'Courant des Canaries', rect: rect(-21, 20.5, -14.5, 30), direction: 10, texte: 'Courant des Canaries' },
  // DST d'Ouessant (11/11/2026) : sur cette carte à cases de 30 milles, une seule case à sa vraie place, au nord-ouest
  // d'Ouessant, en laissant le passage côtier ; les rails des Scilly, plus fins qu'une case, fermeraient la Manche (ils sont
  // dessinés sur la carte du Fastnet, plus fine).
  { type: 'zone_interdite', nom: 'DST Ouessant', rect: rect(-5.75, 48.6, -5.5, 48.9), texte: 'DST Ouessant' },
  { type: 'zone_interdite', nom: 'DST Finisterre', rect: rect(-11.0, 42.8, -10.1, 43.5), texte: 'DST Finisterre' }, // décalé d'une case vers le large le 13/11/2026 : passage le long du cap
];

const LIEUX_ATLANTIQUE: [string, number, number, string][] = [
  ['Ouessant', -5.1, 48.46, 'repere'], ['Cap Finisterre', -9.27, 42.88, 'repere'], ['Açores', -28, 38.6, 'repere'],
  ['Madère', -16.95, 32.75, 'repere'], ['Canaries', -15.6, 28.3, 'repere'], ['Cap-Vert', -24, 15.6, 'repere'], ['Antilles', -62, 14.3, 'repere'],
];

export const COURSES: ConfigCourse[] = [
  {
    id: 'route-du-rhum',
    nom: 'Route du Rhum',
    sous_titre: 'Saint-Malo → Pointe-à-Pitre',
    note: "Course de la bêta. Carte réaliste générée par outils/generer-carte-rhum.ts (côtes Natural Earth 1:50 m, domaine public ; projection de Mercator). Zones météo et zones interdites STYLISÉES. Règle d'escale et durée du tour PROVISOIRES, à valider par le porteur de projet.",
    classes: ['IMOCA'],
    hauteur: 96,
    depart: { nom: 'Saint-Malo', lon: -2.02, lat: 48.65, zone: [-2.35, 49.0] },
    arrivee: { nom: 'Pointe-à-Pitre', lon: -61.53, lat: 16.24 },
    ports: PORTS_ATLANTIQUE,
    // Arrivée simplifiée (décision du porteur de projet, 12/11/2026, remplace le tour par Vieux-Fort du 11/11) : une bouée
    // cardinale nord sur la case au nord de la Guadeloupe, à laisser au sud (on passe au nord : ligne invisible vers le
    // nord), puis la zone d'arrivée de Pointe-à-Pitre. Parcours réel (routedurhum.com/parcours) : tour de la Guadeloupe
    // dans le dévent de la Soufrière, simplifié ici à l'échelle des cases de 30 milles.
    marques: {
      '*': [
        // La Tête à l'Anglais (12/11/2026, porteur de projet) : en réalité un rocher au nord-ouest de Basse-Terre, laissé à
        // bâbord (figaronautisme.meteoconsult.fr, 16/11/2022) ; dessinée en bouée cardinale nord, à passer au nord.
        { id: 'tete_a_l_anglais', nom: "La Tête à l'Anglais : passer au nord", de: [-61.78, 16.4], a: [-61.78, 21.5], bouee: true, cardinale: 'nord' },
        // Contrôle invisible (12/11/2026, porteur de projet) : après la Tête à l'Anglais, on contourne Basse-Terre par l'ouest
        // (ligne à l'ouest de la côte, vers l'ouest) ; sans lui, la route la plus courte passait par l'est de Grande-Terre.
        { id: 'basse_terre_ouest', nom: "Côte ouest de Basse-Terre", de: [-62.0, 16.1], a: [-66.0, 16.1], cachee: true },
      ],
    },
    // Zone d'arrivée (12/11/2026, porteur de projet) : entre le sud de la Guadeloupe et le nord de la Dominique.
    centre_arrivee: [-61.5, 15.8],
    rayon_arrivee: 1.1,
    // Route directe affichée (trait blanc) : Saint-Malo → bouée → Pointe-à-Pitre.
    via: [-61.78, 16.55],
    zones: zonesNord,
    lieux: [['Saint-Malo', -2.02, 48.65, 'depart'], ['Pointe-à-Pitre', -61.53, 16.24, 'arrivee'], ...LIEUX_ATLANTIQUE],
  },
  {
    id: 'transat-cafe-lor',
    nom: "Transat Café L'Or",
    sous_titre: 'Le Havre → Fort-de-France · en double',
    note: "Course en double (ex-Transat Jacques-Vabre), édition 2025 : un parcours par classe, avec une marque obligatoire (sources : outremers360.com, Figaro Nautisme). Carte réaliste générée par outils/generer-carte-rhum.ts (côtes Natural Earth 1:50 m, domaine public), prolongée jusqu'à 11° S pour les Ultim. Zones météo STYLISÉES. Les marques sont des lignes à franchir : elles obligent à laisser l'île ou l'archipel à tribord.",
    classes: ['ULTIM', 'IMOCA', 'OCEAN_FIFTY', 'CLASS40'],
    double: true,
    hauteur: 134,
    depart: { nom: 'Le Havre', lon: 0.1, lat: 49.49, zone: [-0.2, 49.75] },
    arrivee: { nom: 'Fort-de-France', lon: -61.07, lat: 14.6 },
    ports: { ...PORTS_ATLANTIQUE, 'Salvador de Bahia': [-38.5, -12.97] },
    // Laisser une île à tribord en descendant vers le sud-ouest, c'est passer au sud (ou à l'est) de l'île :
    // la ligne part de l'île vers le sud.
    marques: {
      ULTIM: [
        // Décision du porteur de projet (10/11/2026) : la marque de l'île de l'Ascension (parcours réel 2025) est
        // retirée du jeu. Reste le point de passage à l'est de la pointe du Brésil (cap São Roque), pour remonter
        // le long de la côte brésilienne comme en course, par 5° S (décalée deux fois vers l'est le 10/11/2026 à la
        // demande du porteur de projet).
        // C'est une BOUÉE (demande du porteur de projet, 10/11/2026), à 500 milles à l'est du cap São Roque, à laisser
        // à bâbord en remontant vers le nord : on passe à l'est de la bouée (ligne invisible vers l'est).
        { id: 'bresil', nom: 'Bouée du cap São Roque, à laisser à bâbord', de: [-26.9, -5.0], a: [-21.0, -5.0], bouee: true },
      ],
      IMOCA: [{ id: 'canaries', nom: 'Archipel des Canaries à tribord', de: [-15.6, 27.7], a: [-15.6, 20] }],
      OCEAN_FIFTY: [{ id: 'sal', nom: 'Île de Sal (Cap-Vert) à tribord', de: [-22.9, 16.55], a: [-22.9, 10] }],
      CLASS40: [{ id: 'acores', nom: 'Archipel des Açores à tribord', de: [-25.1, 36.9], a: [-25.1, 12] }],
    },
    // Ultim : pas de distance officielle affichée, le parcours du jeu (sans Ascension) n'est plus celui de 2025 (6 200 milles).
    distances: { IMOCA: 4350, OCEAN_FIFTY: 4600, CLASS40: 3750 },
    // Mesuré le 10/11/2026 (outils/sim-classes.ts, médiane du vainqueur) ; à recaler après l'équilibrage.
    tours_estimes: { ULTIM: 14, IMOCA: 11, OCEAN_FIFTY: 15, CLASS40: 17 },
    zones: (rect) => [
      ...zonesNord(rect),
      // Décision du 10/11/2026 : dans le Pot-au-noir, vent imprévisible (pétole ou grain violent).
      { type: 'pot_au_noir', nom: 'Pot-au-noir', rect: rect(-40, 2, -10, 8), texte: 'POT-AU-NOIR · pétole ou grains violents, au hasard' },
      // Décision du 10/11/2026 : sous l'équateur, les alizés soufflent du SUD-EST (alizés australs). Comme ceux de
      // nord-est, ils ont leur propre vent régulier, soumis aux dés : d'Est à Sud-Sud-Est, force 3 à 6.
      { type: 'alize', nom: 'Alizés de sud-est', rect: rect(-36, -11, -8, 2), favorables: [12, 14, 0], defavorables: [], texte: 'ALIZÉS DE SUD-EST · vent de S à E, F3 à 6 · favorables vers W, NW, N',
        // Décision du 11/11/2026 (porteur de projet) : dans l'hémisphère sud, il oscille au plus de 90°, du Sud à l'Est.
        vent_regulier: { directions: [4, 8], forces: [3, 6], depart: { direction: 6, force: 4 } } },
    ],
    lieux: [['Le Havre', 0.1, 49.49, 'depart'], ['Fort-de-France', -61.07, 14.6, 'arrivee'], ...LIEUX_ATLANTIQUE,
      ['Ascension', -14.37, -7.95, 'repere'], ['Fernando de Noronha', -32.42, -3.85, 'repere'], ['Cap São Roque', -35.25, -5.48, 'repere'], ['Sal', -22.9, 16.75, 'repere']],
  },
  {
    // Demande du porteur de projet (10/11/2026) : carte limitée à la Bretagne, à l'Irlande et à l'Angleterre, systèmes
    // météo propres à la zone, course d'environ 3 jours, 15 tours en moyenne QUELLE QUE SOIT LA CLASSE (vitesse unique).
    // Parcours de l'édition 2025 (rolexfastnetrace.com ; Figaro Nautisme) : Cowes, sortie du Solent par les Needles,
    // Manche vers l'ouest, Land's End, mer Celtique, tour du Fastnet Rock, retour par le sud des Scilly (Bishop Rock),
    // arrivée à Cherbourg ; 695 milles.
    id: 'rolex-fastnet',
    nom: 'Rolex Fastnet Race',
    sous_titre: 'Cowes → Fastnet Rock → Cherbourg',
    note: "Rolex Fastnet Race, parcours 2025 (695 milles). Carte réaliste générée par outils/generer-carte-rhum.ts (côtes Natural Earth 1:50 m, domaine public), cases d'environ 2,5 milles. Marques : passage au nord de Bishop Rock à l'aller, tour du Fastnet Rock (ligne entre le rocher et la côte irlandaise), passage au sud de Bishop Rock au retour (parcours officiel, 12/11/2026). Courants de marée alternés, brume et rails de navigation STYLISÉS. Même vitesse et même durée de tour pour toutes les classes (15 tours en moyenne, environ 3 jours).",
    classes: ['IMOCA', 'ULTIM', 'OCEAN_FIFTY', 'CLASS40', 'VINTAGE'],
    hauteur: 104,                                   // jusqu'au nord de la Bretagne (47,7° N)
    // Cadre élargi vers l'ouest le 10/11/2026 (-10,8° → -13,2°, même taille de case) : le bord de la carte, à 46 milles du
    // Fastnet Rock, coupait les bords de près vers le sud-ouest (signalé par le porteur de projet).
    cadre: { lonMin: -13.2, lonMax: -0.8, latMax: 52.2, largeur: 186 },
    ile_min: 0.003,                                 // les Scilly, Guernesey, Aurigny…
    // Îles Scilly (Sainte-Marie, Tresco, Sainte-Agnès, Bryher), absentes des côtes au 1:50 m
    iles: [[-6.30, 49.92], [-6.33, 49.95], [-6.35, 49.89], [-6.27, 49.95], [-6.37, 49.94], [-9.603, 51.389]], // … et le Fastnet Rock (case de terre : on ne passe pas dessus, 11/11/2026)
    // Les Scilly : leurs cases de terre sont dessinées sur la carte (demande du porteur de projet, 12/11/2026).
    traces_detail: [-6.6, 49.8, -6.1, 50.05],
    milles_par_case: 2.55,
    echelle: 6.8,                                   // réglée par simulation : 15 tours en moyenne
    heures_par_tour: 4.8,
    duree_cible_tours: [13, 17],
    vitesse_unique: true,
    echelle_classe: { IMOCA: 1.35, ULTIM: 1.2, OCEAN_FIFTY: 1.35, CLASS40: 1.45, VINTAGE: 1.3 },   // calé par simulation (15 tours) ; IMOCA recalé le 10/11/2026 (18 tours avec 1,15 sur la carte élargie)
    vent_initial: { direction: 10, force: 4 },      // vent dominant de sud-ouest
    rayon_cotier: 4,
    rayon_arrivee: 2.6,
    depart: { nom: 'Cowes', lon: -1.3, lat: 50.77, zone: [-1.45, 50.7] },
    arrivee: { nom: 'Cherbourg', lon: -1.62, lat: 49.65 },
    // Route directe affichée (ligne blanche) : le parcours, et non plus une ligne droite de Cowes à Cherbourg (signalé par
    // le porteur de projet, 13/11/2026). Sortie du Solent par les Needles, sud du Lizard, NORD de Bishop Rock (entre Land's End et les
    // Scilly), tour du Fastnet Rock laissé à bâbord (nord, ouest, sud), SUD de Bishop Rock, nord du cap de la Hague, Cherbourg.
    vias: [[-1.37, 50.775], [-1.5, 50.735], [-1.56, 50.7], [-1.65, 50.645], [-5.2, 49.85], [-6.4, 50.1], [-9.62, 51.455], [-9.76, 51.389], [-9.62, 51.33], [-6.446, 49.75], [-1.95, 49.78], [-1.65, 49.72]],
    // Pas de port d'escale au Fastnet (13/11/2026, porteur de projet) : un démâtage est une fin de course.
    ports: {},
    marques: {
      '*': [
        // Aller (12/11/2026, parcours officiel fourni par le porteur de projet) : passage obligatoire au NORD de Bishop Rock
        // (ligne invisible du rocher vers le nord, entre les Scilly et Land's End) ; au retour, au sud (bouée ci-dessous).
        { id: 'scilly_aller', nom: "Bishop Rock (Scilly), à laisser au sud à l'aller", de: [-6.446, 49.92], a: [-6.446, 51.3], cachee: true },
        // Tour du Fastnet Rock, laissé à BÂBORD (règle du porteur de projet, 11/11/2026) : on arrive par l'est, on passe au
        // nord du rocher (entre le rocher et la côte), puis à l'ouest, puis au sud ; trois lignes à toucher dans cet ordre,
        // le rocher étant une case de terre : impossible de valider la marque sans en faire le tour complet.
        { id: 'fastnet_nord', nom: 'Fastnet Rock, à laisser à bâbord (passage au nord)', de: [-9.603, 51.433], a: [-9.603, 51.47], cachee: true },
        { id: 'fastnet', nom: 'Fastnet Rock, à laisser à bâbord', de: [-9.65, 51.389], a: [-11.2, 51.389], bouee: true },
        { id: 'fastnet_sud', nom: 'Fastnet Rock, à laisser à bâbord (retour au sud)', de: [-9.603, 51.345], a: [-9.603, 50.9], cachee: true },
        // Retour par le sud des Scilly : ligne au sud de Bishop Rock.
        { id: 'scilly', nom: "Bishop Rock : au nord à l'aller, au sud au retour", de: [-6.446, 49.872], a: [-6.446, 49.25], bouee: true },
      ],
    },
    distances: { IMOCA: 695, ULTIM: 695, OCEAN_FIFTY: 695, CLASS40: 695, VINTAGE: 695 },
    tours_estimes: { IMOCA: 15, ULTIM: 15, OCEAN_FIFTY: 15, CLASS40: 15, VINTAGE: 15 },
    zones: (rect) => [
      // Courants de marée : ils s'inversent à chaque tour (flot, puis jusant). Directions stylisées.
      { type: 'courant', maree: true, nom: 'Marée des Needles', rect: rect(-1.75, 50.6, -1.3, 50.75), direction: 12, texte: 'Marée des Needles' },
      { type: 'courant', maree: true, nom: 'Raz de Portland', rect: rect(-2.65, 50.42, -2.25, 50.56), direction: 12, texte: 'Raz de Portland Bill' },
      { type: 'courant', maree: true, nom: 'Marée de Start Point', rect: rect(-3.8, 50.12, -3.45, 50.24), direction: 12, texte: 'Marée de Start Point' },
      { type: 'courant', maree: true, nom: 'Marée du Lizard', rect: rect(-5.4, 49.86, -5.0, 49.98), direction: 12, texte: 'Marée du Lizard' },
      { type: 'courant', maree: true, nom: "Marée de Land's End", rect: rect(-5.9, 49.95, -5.62, 50.15), direction: 0, texte: "Marée de Land's End" },
      { type: 'courant', maree: true, nom: 'Raz Blanchard', rect: rect(-2.1, 49.62, -1.8, 49.78), direction: 6, texte: 'Raz Blanchard (marée très forte)' },
      { type: 'brume', nom: 'Brume des Scilly', rect: rect(-7.1, 49.6, -5.9, 50.35), texte: 'Brume des Scilly' },
      // Demande du porteur de projet (13/11/2026) : vaste zone de brume au sud-ouest de l'Irlande, du bord ouest de la carte
      // au méridien du Fastnet Rock, juste au sud du rocher (sa ligne de passage, au nord, reste hors de la brume).
      { type: 'brume', nom: "Brume du sud-ouest de l'Irlande", rect: rect(-13.2, 49.5, -9.7, 51.35), texte: "Brume du sud-ouest de l'Irlande" },
      // DST des Scilly (11/11/2026, d'après la carte réelle fournie par le porteur de projet) : trois rails, à l'ouest, au sud
      // et à l'est des îles (entre les Scilly et Land's End). Positions approchées, à affiner sur une carte marine.
      { type: 'zone_interdite', nom: 'DST des Scilly (ouest)', rect: rect(-6.88, 49.86, -6.55, 50.06), texte: 'DST Scilly' },
      { type: 'zone_interdite', nom: 'DST des Scilly (sud)', rect: rect(-6.55, 49.58, -6.28, 49.76), texte: 'DST Scilly' },
      { type: 'zone_interdite', nom: "DST de Land's End", rect: rect(-6.08, 49.9, -5.85, 50.3), texte: "DST Land's End" },
      { type: 'zone_interdite', nom: 'DST Ouessant', rect: rect(-5.95, 48.52, -5.3, 48.98), texte: 'DST Ouessant' },
      { type: 'zone_interdite', nom: 'Rail des Casquets', rect: rect(-2.75, 49.75, -2.4, 49.85), texte: 'Rail des Casquets' },
    ],
    lieux: [['Cowes', -1.3, 50.77, 'depart'], ['Cherbourg', -1.62, 49.65, 'arrivee'], ['Needles', -1.59, 50.66, 'repere'], ['Portland Bill', -2.46, 50.51, 'repere'],
      ['Start Point', -3.64, 50.22, 'repere'], ['Lizard', -5.2, 49.96, 'repere'], ["Land's End", -5.71, 50.07, 'repere'], ['Fastnet Rock', -9.6, 51.39, 'repere'],
      ['Scilly', -6.3, 49.93, 'repere'], ['Raz Blanchard', -1.95, 49.7, 'repere'], ['Irlande', -8.6, 52.0, 'repere'], ['Angleterre', -2.3, 51.0, 'repere'], ['Bretagne', -3.6, 48.95, 'repere']],
  },
];
