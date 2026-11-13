// Tours du monde (12/11/2026, demande du porteur de projet) : Vendée Globe, Arkéa Ultim Challenge – Brest.
// Cartes générées par outils/generer-carte-rhum.ts. Plan et sources : conception/nouvelles-courses.md.
//
// Carte « déroulée » : de 45° W à 5° E du tour suivant (410° de longitude, une case par degré). L'Atlantique est dessiné
// deux fois : à gauche pour la descente, à droite pour la remontée. Les longitudes au-delà de 180° E continuent
// (le cap Horn, 67,27° W, est à 292,73°) ; l'arrivée est au port de départ décalé de 360°.
// Décisions du porteur de projet (12/11/2026) : un tour = 3 jours (2 jours d'abord, trop long ; puis 4 jours, distances par tour peu crédibles) ; vraie distance (une case fait 60 milles à
// l'équateur, 60 × cos(latitude) ailleurs ; le moteur compte les vrais milles).
// Zones météo et zone d'exclusion des glaces STYLISÉES (à vérifier sur les cartes officielles).
import type { ConfigCourse } from './courses-atlantique';

export interface ConfigMonde extends ConfigCourse {
  /** Décalages de longitude appliqués aux côtes (copies du monde), pour une carte de plus de 360°. */
  decalages?: number[];
  /** Points de passage de la route affichée (lon, lat), dans l'ordre. */
  vias?: [number, number][];
  /** Vraie distance : une case vaut milles_par_case × cos(latitude). */
  distance_reelle?: boolean;
  regle_escale?: { type: 'libre' | 'penalite' | 'interdite'; tours: number; statut_validation?: string };
  tours_max?: number;
  meteo?: MeteoMonde;
}

/** Météo mondiale (12/11/2026, demande du porteur de projet) : positions en degrés, tailles en milles, vitesses en nœuds. */
export interface MeteoMonde {
  anticyclones: { nom: string; lon: number; lat: number; rayon_milles: number; forces: [number, number]; hemisphere: 'N' | 'S' }[];
  depressions: {
    nom: string; lonA: number; latA: number; lonB: number; latB: number; hemisphere: 'N' | 'S';
    rayon_milles: [number, number]; noeuds: number; forces: number[]; directions: number[]; bascule: number; baisse: number;
    probabilite: number; max: number; duree: number; annonce: number;
  }[];
}

type Rect = (lonA: number, latA: number, lonB: number, latB: number) => [number, number, number, number];

const CADRE = { lonMin: -45, lonMax: 365, latMax: 52, largeur: 410 };
const HAUTEUR = 141; // jusqu'à 62° S
const SUD = -62;

/** Les trois caps, à laisser à bâbord : une ligne du cap vers le sud, à franchir. */
const CAPS = [
  { id: 'bonne_esperance', nom: 'Cap de Bonne-Espérance', de: [18.47, -34.36] as [number, number], a: [18.47, SUD] as [number, number] },
  { id: 'leeuwin', nom: 'Cap Leeuwin', de: [115.14, -34.37] as [number, number], a: [115.14, SUD] as [number, number] },
  { id: 'horn', nom: 'Cap Horn', de: [292.73, -55.98] as [number, number], a: [292.73, SUD] as [number, number] },
];

/**
 * Vents réguliers (12/11/2026) : sur un tour du monde de 60 tours, le vent général unique du jeu dérivait jusqu'à la
 * force 11 pour toute la flotte. La route est donc couverte de zones de vent régulier (comme les alizés : vent propre à la
 * zone, que les dés font varier sans le sortir de sa plage). Plages STYLISÉES, d'après la climatologie générale.
 * Atlantique dessiné deux fois : à la descente (décalage 0) et à la remontée (décalage 360).
 */
const atlantique = (rect: Rect, dx: number, descente: boolean) => {
  const [o, e] = descente ? [-45, 20] : [-80, 5]; // la remontée commence au cap Horn (292,73° = 360 - 67,27°)
  const reg = (nom: string, latA: number, latB: number, directions: [number, number], forces: [number, number], texte: string) => ({
    type: 'alize', nom, rect: rect(o + dx, latA, e + dx, latB), favorables: [], defavorables: [], texte,
    vent_regulier: { directions, forces, depart: { direction: Math.round((directions[0] + directions[1]) / 2), force: Math.round((forces[0] + forces[1]) / 2) } },
  });
  return [
    reg("Vents d'ouest de l'Atlantique nord", 30, 52, [10, 14], [3, 7], "VENTS D'OUEST · vent de SW à NW, F3 à 7"),
    reg('Alizés', 7, 30, [0, 4], [3, 7], 'ALIZÉS · vent de N à E, F3 à 7'),
    // Bande étroite (3° de latitude) : on la traverse en un tour de 2 jours, comme en course.
    { type: 'pot_au_noir', nom: 'Pot-au-noir', rect: rect(o + dx, 3, e + dx, 6), texte: 'POT-AU-NOIR · pétole ou grains violents, au hasard' },
    reg('Alizés de sud-est', -25, 3, [4, 8], [3, 6], 'ALIZÉS DE SUD-EST · vent de S à E, F3 à 6'),
    // Anticyclone de Sainte-Hélène : on le contourne par l'ouest à la descente (vent de nord-ouest), par l'est du Brésil à
    // la remontée (vent de nord-est à est).
    descente
      ? reg('Marge de Sainte-Hélène', -40, -25, [12, 14], [2, 5], 'VENTS VARIABLES · vent faible de W à NW')
      : reg('Marge de Sainte-Hélène', -40, -25, [2, 4], [2, 5], 'VENTS VARIABLES · vent faible de NE à E'),
    { type: 'zone_interdite', nom: 'DST Finisterre', rect: rect(-10.3 + dx, 42.8, -9.7 + dx, 43.5), texte: 'DST Finisterre' },
  ];
};

const zonesMonde = (rect: Rect) => [
  ...atlantique(rect, 0, true),
  ...atlantique(rect, 360, false),
  // Quarantièmes rugissants et cinquantièmes hurlants : vent d'ouest soutenu tout autour du monde. Pas de zone « mers du
  // Sud » à +2 forces : essayée le 12/11/2026, elle faisait démâter tous les bateaux (tempêtes F11 à répétition).
  { type: 'alize', nom: "Vents d'ouest des mers du Sud", rect: rect(-45, SUD, 365, -40), favorables: [], defavorables: [], texte: "MERS DU SUD · vent d'ouest de SW à NW, F5 à 8",
    vent_regulier: { directions: [10, 14], forces: [5, 8], depart: { direction: 12, force: 6 } } },
  // Zone d'exclusion des glaces (stylisée, d'après l'allure de celles du Vendée Globe : plus haute dans l'Atlantique et
  // l'océan Indien, plus basse dans le Pacifique pour laisser passer le cap Horn).
  { type: 'zone_exclusion_glaces', nom: "Zone d'exclusion des glaces", rect: rect(-45, SUD, 150, -47), texte: "Zone d'exclusion des glaces" },
  { type: 'zone_exclusion_glaces', nom: "Zone d'exclusion des glaces", rect: rect(150, SUD, 280, -55), texte: "Zone d'exclusion des glaces" },
  { type: 'zone_exclusion_glaces', nom: "Zone d'exclusion des glaces", rect: rect(280, SUD, 315, -57.5), texte: "Zone d'exclusion des glaces" },
];

/**
 * Grands systèmes météo (12/11/2026, demande du porteur de projet : « les grandes tendances de la météo mondiale »).
 * D'après la climatologie générale (centres d'action moyens de novembre à février) ; STYLISÉ.
 * - Anticyclones permanents : Açores, Sainte-Hélène, Mascareignes (océan Indien sud), île de Pâques (Pacifique sud).
 *   Rayon d'environ 900 à 1 000 milles ; ils bougent un peu autour de leur position moyenne. Le vent tourne autour dans
 *   le sens des aiguilles d'une montre au nord, dans le sens inverse au sud.
 * - Dépressions : elles naissent dans la bande des vents d'ouest et filent vers l'est à environ 20 nœuds, avec un
 *   rayon de 500 à 700 milles. Front : vent de SW puis bascule au NW dans la traîne au nord ; vent de NW puis bascule au
 *   SW au sud (rotation inverse).
 */
const ATL = [0, 360];
const METEO: MeteoMonde = {
  anticyclones: [
    ...ATL.map((dx) => ({ nom: 'Anticyclone des Açores', lon: -30 + dx, lat: 33, rayon_milles: 900, forces: [3, 5] as [number, number], hemisphere: 'N' as const })),
    ...ATL.map((dx) => ({ nom: 'Anticyclone de Sainte-Hélène', lon: -10 + dx, lat: -28, rayon_milles: 900, forces: [3, 5] as [number, number], hemisphere: 'S' as const })),
    { nom: 'Anticyclone des Mascareignes', lon: 75, lat: -30, rayon_milles: 900, forces: [3, 5], hemisphere: 'S' },
    { nom: "Anticyclone de l'île de Pâques", lon: 255, lat: -32, rayon_milles: 1000, forces: [3, 5], hemisphere: 'S' },
  ],
  depressions: [
    ...ATL.map((dx) => ({
      nom: "Dépression de l'Atlantique nord", lonA: -45 + dx, latA: 40, lonB: 5 + dx, latB: 52, hemisphere: 'N' as const,
      rayon_milles: [450, 650] as [number, number], noeuds: 20, forces: [6, 7, 8], directions: [9, 10, 11], bascule: 4, baisse: 2,
      probabilite: 0.4, max: 1, duree: 3, annonce: 1,
    })),
    {
      nom: 'Dépression des mers du Sud', lonA: -45, latA: -62, lonB: 365, latB: -40, hemisphere: 'S',
      rayon_milles: [500, 700], noeuds: 20, forces: [6, 7, 8], directions: [13, 14, 15], bascule: -4, baisse: 2,
      probabilite: 0.5, max: 2, duree: 4, annonce: 1,
    },
  ],
};

/**
 * Grands courants océaniques (12/11/2026, demande du porteur de projet). Direction = vers où porte le courant.
 * Tracés STYLISÉS d'après les cartes générales de circulation océanique ; le moteur fait dériver le bateau qui les
 * traverse (au plus 1,5 case par tour).
 */
const courants = (rect: Rect) => {
  const c = (nom: string, lonA: number, latA: number, lonB: number, latB: number, direction: number) =>
    ({ type: 'courant', nom, rect: rect(lonA, latA, lonB, latB), direction, texte: nom });
  return [
    ...ATL.flatMap((dx) => [
      c('Gulf Stream', -45 + dx, 38, -30 + dx, 44, 4),
      c('Dérive nord-atlantique', -30 + dx, 44, -15 + dx, 50, 3),
      c('Courant des Canaries', -22 + dx, 18, -13 + dx, 30, 10),
      c('Courant nord-équatorial', -45 + dx, 9, -22 + dx, 18, 12),
      c('Courant sud-équatorial', -40 + dx, -5, 0 + dx, 2, 12),
      c('Courant du Brésil', -45 + dx, -30, -36 + dx, -12, 9),
      c('Courant de Benguela', 3 + dx, -30, 13 + dx, -16, 15),
    ]),
    c('Courant des Aiguilles', 24, -38, 34, -30, 10),
    c('Courant de Leeuwin', 108, -34, 114, -24, 8),
    c('Courant est-australien', 151, -36, 157, -24, 8),
    c('Kuroshio', 128, 28, 145, 36, 3),
    c('Courant de Humboldt', 280, -42, 287, -15, 0),
    c('Courant des Malouines', 298, -54, 305, -38, 1),
    c('Courant circumpolaire antarctique', -45, -62, 365, -48, 4),
  ];
};

const LIEUX: [string, number, number, string][] = [
  ['Cap de Bonne-Espérance', 18.47, -34.36, 'repere'], ['Cap Leeuwin', 115.14, -34.37, 'repere'], ['Cap Horn', 292.73, -55.98, 'repere'],
  ['Kerguelen', 69.5, -49.3, 'repere'], ['Nouvelle-Zélande', 172, -42, 'repere'], ['Équateur', -25, 0.6, 'repere'], ['Équateur', 335, 0.6, 'repere'],
  ['Afrique', 20, 5, 'repere'], ['Amérique du Sud', 296, -15, 'repere'], ['Australie', 134, -25, 'repere'], ['Antarctique', 140, -61, 'repere'],
];

// Route affichée (loxodromies) : au large de l'Afrique, puis le long de la zone des glaces, puis au large du Brésil.
const VIAS: [number, number][] = [
  [-20, 30], [-25, 0], [-12, -30], [18.47, -41], [60, -46], [115.14, -45], [150, -47], [200, -53], [260, -54], [292.73, -57],
  [313, -45], [325, -25], [330, 0], [335, 25], [345, 42],
];

// Ports d'escale technique (ceux de l'Arkéa Ultim Challenge 2024 et les grands ports sur la route).
const PORTS_REPLI: Record<string, [number, number]> = {
  'Le Cap': [18.42, -33.92], 'Hobart (Tasmanie)': [147.33, -42.88], 'Rio de Janeiro': [316.83, -22.91], 'Recife': [325.12, -8.05],
  'Las Palmas (Canaries)': [-15.43, 28.14], 'Las Palmas (Canaries) ': [344.57, 28.14],
};

const commun = {
  cadre: CADRE,
  hauteur: HAUTEUR,
  decalages: [0, 360],
  ile_min: 0.3,
  milles_par_case: 60,
  distance_reelle: true,
  // 4 jours par tour (porteur de projet, 12/11/2026 : « on peut faire des tours de 4 jours si ça accélère le jeu ») ;
  // avec 2 jours, un Vendée Globe durait 43 tours.
  // 3 jours par tour (porteur de projet, 12/11/2026 : 4 jours donnaient des distances par tour peu crédibles ;
  // objectif Vendée Globe en 60 à 70 jours, soit 20 à 25 tours ; Arkéa en 15 à 20 tours).
  heures_par_tour: 72,
  vent_initial: { direction: 14, force: 4 },
  rayon_cotier: 2,
  rayon_arrivee: 1.6,
  marques: { '*': CAPS.map((c) => ({ ...c, nom: `${c.nom}, à laisser à bâbord` })) },
  zones: (rect: Rect) => [...zonesMonde(rect), ...courants(rect)],
  meteo: METEO,
};

export const COURSES_MONDE: ConfigMonde[] = [
  {
    ...commun,
    id: 'vendee-globe',
    nom: 'Vendée Globe',
    sous_titre: "Les Sables-d'Olonne → trois caps → Les Sables-d'Olonne · en solitaire, sans escale",
    note: "Vendée Globe : tour du monde en solitaire, sans escale ni assistance, par les caps de Bonne-Espérance, Leeuwin et Horn laissés à bâbord (vendeeglobe.org). Carte du monde déroulée (l'Atlantique dessiné au départ et à l'arrivée), côtes Natural Earth 1:50 m (domaine public). Un tour = 3 jours ; vraie distance (case de 60 milles à l'équateur). Zones météo et zone d'exclusion des glaces STYLISÉES. Un bateau gravement endommagé qui rejoint un port abandonne (course sans escale ni assistance).",
    classes: ['IMOCA'],
    depart: { nom: "Les Sables-d'Olonne", lon: -1.79, lat: 46.5, zone: [-2.6, 46.3] },
    arrivee: { nom: "Les Sables-d'Olonne", lon: 358.21, lat: 46.5 },
    // Ports de repli (12/11/2026) : un bateau gravement endommagé qui s'y arrête abandonne (escale interdite).
    ports: PORTS_REPLI,
    regle_escale: { type: 'interdite', tours: 0, statut_validation: 'règlement du Vendée Globe' },
    echelle: 7.1, // 5,5 × 1,75 / 1,35 : vitesse IMOCA réduite le 12/11/2026 (jauge 640 mn en 24 h)
    // Mesuré le 12/11/2026 (outils/sim-classes.ts, 16 parties, médiane du vainqueur) : 23 tours de 3 jours, environ 69 jours
    // (objectif du porteur de projet : 60 à 70 jours, 20 à 25 tours). Échelle basse : avec 16, chaque tour atteignait le
    // plafond (record de 640 milles en 24 h tenu 3 jours de suite), peu crédible.
    tours_estimes: { IMOCA: 23 },
    tours_max: 40,
    duree_cible_tours: [20, 25],
    vias: VIAS,
    lieux: [["Les Sables-d'Olonne", -1.79, 46.5, 'depart'], ["Les Sables-d'Olonne", 358.21, 46.5, 'arrivee'], ...LIEUX],
  },
  {
    ...commun,
    id: 'arkea-ultim-challenge',
    nom: 'Arkéa Ultim Challenge',
    sous_titre: 'Brest → trois caps → Brest · en solitaire, escales techniques permises',
    note: "Arkéa Ultim Challenge – Brest : tour du monde en solitaire sur Ultim, par les trois caps ; escales techniques autorisées, sans limite de nombre, d'au moins 24 heures (instructions de course, Figaro Nautisme 22/12/2023). Carte du monde déroulée, côtes Natural Earth 1:50 m (domaine public). Un tour = 3 jours ; vraie distance. Zones météo et zone d'exclusion des glaces STYLISÉES.",
    classes: ['ULTIM'],
    depart: { nom: 'Brest', lon: -4.49, lat: 48.38, zone: [-5.3, 48.2] },
    arrivee: { nom: 'Brest', lon: 355.51, lat: 48.38 },
    ports: PORTS_REPLI,
    regle_escale: { type: 'libre', tours: 1, statut_validation: 'provisoire : escale de 24 h = 1 tour' },
    echelle: 5,
    // Mesuré le 12/11/2026 : 17 tours de 3 jours, environ 51 jours (objectif du porteur de projet : 15 à 20 tours ;
    // vainqueur 2024 : Charles Caudrelier, environ 50 jours).
    tours_estimes: { ULTIM: 17 },
    tours_max: 30,
    duree_cible_tours: [15, 20],
    vias: VIAS,
    lieux: [['Brest', -4.49, 48.38, 'depart'], ['Brest', 355.51, 48.38, 'arrivee'], ...LIEUX],
  },
];
