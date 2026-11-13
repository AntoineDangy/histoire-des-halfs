// Types du moteur de jeu « Course au large ».
// L'état de jeu est un objet JSON pur (sérialisable) ; les données (règles, carte, quiz)
// sont passées à part et ne sont jamais modifiées.

/** Direction sur 16 caps : 0 = N, 4 = E, 8 = S, 12 = W (pas de 22,5°). */
export type Direction = number;
export type Allure = number;
export type Case = [number, number];

// ---------------------------------------------------------------- Données

export interface Condition {
  force_min?: number;
  force_max?: number;
  allures?: number[];
  zone?: string;
}
export interface Effet {
  type: 'distance' | 'risque';
  valeur: number;
  si?: Condition;
}

export interface VoileDef {
  id: string;
  nom: string;
  nom_court: string;
  detail: string;
  distances: Record<string, number | null>;
  risque: number[];
  moins_petit_temps: boolean;
  plus_brise: boolean;
  forme_3d: string;
  /** Angle minimal au vent (en degrés) sous lequel la voile est inutilisable (11/11/2026). */
  angle_min?: number;
  /** Voile réservée aux monocoques (spi de gros temps, 11/11/2026). */
  monocoque?: boolean;
}

export interface Speciaux {
  reparations_depart?: number;
  voile_en_moins?: boolean;
  /** Distance (en unités) perdue au tour où le skipper joue une carte réparation. */
  malus_reparation?: number;
  recoudre_periode?: number;
  /** Usure des voiles d'avant multipliée (0,6 = il ménage ses voiles ; 1,5 = il les use vite) (12/11/2026). */
  usure_facteur?: number;
  relances_direction?: number;
  malus_relance?: number;
  traverse_bateaux?: boolean;
  /** Régatier (09/11/2026) : n'entre jamais en collision dans la brume, ni comme abordeur, ni comme abordé. */
  sans_collision?: boolean;
  ignore_courant_defavorable?: boolean;
  cout_brume?: number;
  sans_bonus_alize?: boolean;
  passe_devient_demi?: boolean;
  /** Information : voit le résultat du dé de force du tour avant de choisir. */
  voit_de_force?: boolean;
  /** Navigateur (12/11/2026) : voit une PRÉVISION du dé de force, juste avec cette probabilité (sinon une autre face). */
  prevoit_force?: number;
  /** Météorologue (12/11/2026) : voit une PRÉVISION du dé de direction, juste avec cette probabilité. */
  prevoit_direction?: number;
  /** Distance (en unités) perdue au tour où le skipper change de cap. */
  malus_changement_cap?: number;
  /** Distance (en unités) perdue au tour où le skipper change de voile. */
  malus_changement_voile?: number;
  /** Hasard : faces supplémentaires du dé événement qui déclenchent une carte. */
  declencheurs_evenement?: number[];
  /** Hasard : une carte d'avarie est remise dans le paquet et une autre est tirée (une fois). */
  relance_avarie?: boolean;
  /** Moral : durée des avaries des cartes (en tours) modifiée. */
  avarie_tours?: number;
  /** Moral : effet des cartes heureuses multiplié (0 = aucun effet, 2 = double). */
  cartes_heureuses_facteur?: number;
}

export interface CompetenceDef {
  id: string;
  nom: string;
  icone: string;
  bonus: string;
  malus: string;
  effets: Effet[];
  speciaux: Speciaux;
}

export interface ClasseDef {
  id: string;
  nom: string;
  multicoque: boolean;
  bulletin_meteo: boolean;
  longueur?: string;
  /** Nombre moyen de tours d'une Route du Rhum dans cette classe (décision du 09/11/2026). */
  tours_moyens?: number;
  /** Multiplicateur des distances (calé par simulation pour obtenir tours_moyens). */
  vitesse?: number;
  /** Durée d'un tour en heures, pour le temps de course affiché. */
  heures_par_tour?: number;
  /** Jauge (11/11/2026, porteur de projet) : distance maximale en 24 h, bonus compris (record IMOCA : 640 milles). */
  distance_max_24h?: number;
  /** Robustesse des voiles : multiplie l'usure (Ultim plus, Class40 moins). */
  usure_facteur?: number;
}

export interface FamilleDef {
  id: string;
  classe: string;
  nom: string;
  bonus: string;
  malus: string;
  effets: Effet[];
  profil_allure: Record<string, number>;
  profil_note: string;
  polaire: Record<string, number>;
  /** Multicoque ou monocoque, quand la classe mélange les deux (Vintage) ; sinon, celui de la classe. */
  multicoque?: boolean;
}

export interface SkipperDef {
  id: string;
  nom_affiche: string;
  nom_generique: string;
  classe: string;
  rang_saison: number | null;
  competence: string;
  justification: string;
  source: string;
  url_fiche_site: string;
  bateau_id: string;
  couleurs: { coque: string; bandes: string; spi: string; pion: string };
  numero_voile: string;
  statut_validation?: string;
  fictif: boolean;
}

export interface BateauDef {
  id: string;
  nom: string;
  nom_generique: string;
  classe: string;
  famille: string;
  architecte: string;
  annee: number;
  justification_famille: string;
  source: string;
  url_fiche_site: string;
  statut_validation?: string;
  fictif: boolean;
  /** Modèle 3D propre au bateau (fichier public/modeles/<nom>.glb) ; sinon celui de sa famille. */
  modele_3d?: string;
}

export interface ZoneMeteo {
  type: 'alize' | 'brume' | 'courant' | 'pot_au_noir' | 'mers_du_sud' | 'zone_exclusion_glaces' | 'zone_interdite';
  nom: string;
  rect: [number, number, number, number];
  favorables?: number[];
  defavorables?: number[];
  direction?: number;
  texte?: string;
  /** Alizés : vent propre à la zone, régulier (directions et forces bornées). */
  vent_regulier?: { directions: [number, number]; forces: [number, number]; depart: Vent };
  /** Courant de marée : sa direction s'inverse à chaque tour (flot, puis jusant). */
  maree?: boolean;
}

export interface PorteDef {
  id: string;
  nom: string;
  type: 'arrivee' | 'marque';
  /** Marque matérialisée par une bouée (dessinée à la première case ; la ligne reste invisible). */
  bouee?: boolean;
  /** Contrôle invisible (tour d'un rocher) : exigé par le moteur, ni dessiné ni annoncé (11/11/2026). */
  cachee?: boolean;
  /** Bouée cardinale nord : on passe au nord (dessin ; 12/11/2026). */
  cardinale?: 'nord';
  /** Position exacte de la bouée, en cases (sinon : centre de la première case). */
  position?: number[];
  cases: number[][];
}

export interface CourseDef {
  id: string;
  nom: string;
  sous_titre?: string;
  classes_autorisees: string[];
  regle_escale: { type: 'libre' | 'penalite' | 'interdite'; tours: number; statut_validation?: string };
  heures_par_tour: number;
  duree_cible_tours: number[];
  url_fiche_site: string;
  vent_initial: { direction: number; force: number };
  /** Cases parcourues par « unité » de la table des voiles (finesse de la carte). */
  echelle?: number;
  milles_par_case?: number;
  orthodromie_milles?: number;
  /** La carte trace la route directe (trait blanc) même avec des marques : elle passe par la bouée (12/11/2026). */
  route_directe?: boolean;
  /** Centre de la zone d'arrivée, en cases, s'il diffère du port d'arrivée (12/11/2026). */
  centre_arrivee?: number[];
  projection?: { type: string; lon_min: number; lon_max: number; lat_max: number; lat_min: number };
  /** Vraie distance (tours du monde, 12/11/2026) : une case vaut milles_par_case × cos(latitude). */
  distance_reelle?: boolean;
  /** Nombre de tours au-delà duquel la course s'arrête (tours du monde ; sinon regles.tours_max). */
  tours_max?: number;
  /** Météo mondiale (tours du monde, 12/11/2026) : anticyclones permanents et dépressions qui circulent d'ouest en est. */
  meteo_mondiale?: MeteoMondiale;
  carte: {
    largeur: number; hauteur: number; bouclage_horizontal: boolean; lignes: string[];
    /**
     * Terre fine (correction du 10/11/2026 : les bateaux coupaient le Cotentin) : pour les cases de mer qui touchent une
     * côte, « x,y,masque » séparés par des points-virgules ; chaque bit du masque (16 sous-cases de 4 × 4, ligne par ligne)
     * dit si la sous-case est à terre.
     */
    terre_fine?: string;
  };
  portes: PorteDef[];
  /** Parcours propre à chaque classe (marques obligatoires puis arrivée) ; sinon `portes`. */
  portes_par_classe?: Record<string, PorteDef[]>;
  /** Course en double : skipper et co-skipper. */
  double?: boolean;
  /** Toutes les classes vont à la même vitesse et ont la même durée de tour (Rolex Fastnet Race : 15 tours pour tous). */
  vitesse_unique?: boolean;
  /** Avec vitesse_unique : réglage par classe, calé par simulation pour une même durée de course. */
  echelle_classe?: Record<string, number>;
  /**
   * Record de distance en 24 h d'une classe sur cette course, selon le mode de navigation (13/11/2026, porteur de projet) :
   * Ultim en solitaire 851 milles (Route du Rhum), en équipage 908 milles (Transat Café L'Or en double, Fastnet).
   * C'est la distance la plus longue possible, bonus compris ; elle remplace la jauge de la classe (distance_max_24h).
   */
  distance_max_24h_classe?: Record<string, number>;
  /** Multiplicateur de vitesse d'une classe sur cette course (Ultim à la Transat Café L'Or : record en équipage / record en solitaire). */
  vitesse_classe?: Record<string, number>;
  /** Distances officielles du parcours, en milles, par classe. */
  distances_officielles?: Record<string, number>;
  /** Nombre de tours du vainqueur mesuré en simulation, par classe. */
  tours_estimes?: Record<string, number>;
  zones_meteo: ZoneMeteo[];
  /**
   * Zone de molle propre à la course (13/11/2026, dessinée par le porteur de projet) : contour en cases (x, y), à la
   * place du cercle autour de l'arrivée de regles.json ; même probabilité et même vent faible, quelle que soit la classe.
   */
  molle?: { contour: [number, number][]; _note?: string };
  zones_cotieres?: { rayon: number; autour: string[] };
  lieux?: { nom: string; x: number; y: number; type: string }[];
}

export interface QuestionDef {
  id: string;
  niveau: number;
  categorie: string;
  question: string;
  choix: string[];
  reponse: number;
  explication: string;
  source: string;
  url_fiche_site: string;
}

export interface PenaliteDef {
  id: 'demi' | 'perte_voile' | 'passe' | 'recul';
  poids: number;
  texte: string;
}

export interface ReglesDef {
  force_min: number;
  force_max: number;
  de_force: number[];
  /** Dé de force quand le vent est au minimum (F1) : sans face négative (règle du porteur de projet). */
  de_force_min?: number[];
  de_direction: number[];
  de_direction_tendance: Record<string, number[]>;
  seuil_risque: number[];
  /** Effet d'un cran de bonus ou de malus sur la distance (0,2 = 20 %). */
  pourcentage_bonus?: number;
  /** Coefficient de vitesse selon la force du vent (indice = force), validé le 09/11/2026. */
  coefficient_force?: number[];
  pot_au_noir?: { grain: number; forces_grain: number[]; forces_calme: number[] };
  collision?: { reparations: number; tours: number };
  escale_technique?: { distance_max_milles: number; tours: number };
  de_du_large?: { carte: number[]; question: number[] };
  usure?: { seuil: number; bandes_force: number[]; par_tour: Record<string, number[]>; mauvaise_reponse: number; tours_reference: number };
  tempete?: Record<string, number[] | number>;
  anticyclone?: { rapport_fronts: number; rayons: [number, number]; vitesse: [number, number]; forces: number[]; duree: number; max_par_course: number };
  reparations_depart: number;
  voiles_depart: string[];
  penalites: PenaliteDef[];
  tours_supplementaires_course_complete: number;
  tours_max: number;
  ia_quiz_reussite: Record<string, Record<string, number>>;
  beaufort: string[];
  /** Louvoyage face au vent : fraction de la distance au près, angle des bords affichés. */
  louvoyage?: { coefficient: number; angle_bords: number };
  /** Demi-caps (32 caps) à moins de tant de milles de l'arrivée (essai du 11/11/2026). */
  demi_caps?: { milles_arrivee: number; courses?: string[] };
}

/** Effet d'une carte du large (evenements.json). Avaries : voir perteCarte et docs/avaries-et-reparations.md. */
export interface EffetEvenement {
  /** Positif : milles en plus (unités de la table). Négatif : gravité de l'avarie (−1 légère, −2 moyenne, −3 lourde). */
  distance?: number;
  risque?: number;
  /** Durée en tours, celui de la carte compris (absent ou 1 : ce tour seulement). */
  tours?: number;
  demi?: boolean;
  immobile?: boolean;
  reparation?: number;
  perte_voile?: string[];
}

export interface CarteEvenementDef {
  id: string;
  ton: 'heureux' | 'neutre' | 'dommage';
  icone: string;
  illustration: string;
  poids: number;
  familles?: string[];
  titre: string;
  texte: string;
  effet: EffetEvenement;
}

/**
 * Effet d'une carte du large qui dure plusieurs tours (voir docs/avaries-et-reparations.md). Le tour où la carte tombe
 * est compté par resoudreEvenement ; le modificateur ne compte qu'à partir du tour suivant.
 */
export interface Modificateur {
  id: string;
  titre: string;
  /** Milles en plus ou en moins, en unités de la table des voiles (bonne nouvelle durable ; 0 pour une avarie). */
  distance: number;
  /** Avarie durable : part de l'avance du tour perdue à chaque tour suivant (0,25 = 25 %), barème de perteCarte. */
  perte?: number;
  risque: number;
  /** Tours encore concernés, celui en cours compris. */
  toursRestants: number;
  /** Vrai pendant le tour où la carte est tombée : le modificateur ne compte pas encore. */
  nouveau: boolean;
}

export interface Donnees {
  voiles: VoileDef[];
  regles: ReglesDef;
  competences: CompetenceDef[];
  classes: ClasseDef[];
  familles: FamilleDef[];
  skippers: SkipperDef[];
  bateaux: BateauDef[];
  courses: CourseDef[];
  questions: QuestionDef[];
  evenements?: { de_evenement: { faces: number; declencheur: number }; cartes: CarteEvenementDef[] };
}

// ---------------------------------------------------------------- État

export type NiveauIA = 'facile' | 'moyen' | 'difficile';

export interface ParticipantParams {
  nom: string;
  type: 'humain' | 'ia';
  niveauIA?: NiveauIA;
  niveauQuiz: 1 | 2 | 3;
  skipperId: string;
  /** Course en double : le co-skipper (sa compétence s'ajoute à celle du skipper ; le bateau est celui du skipper). */
  coSkipperId?: string;
  /** Compétence Bricoleur : voile laissée à quai. */
  voileLaissee?: string;
}

export interface OptionsPartie {
  quiz: boolean;
  bulletinMeteo: boolean;
  nomsReels: boolean;
  courseComplete: boolean;
  /** Dé événement et cartes du large (activé si absent). */
  evenements?: boolean;
}

export interface ParamsPartie {
  courseId: string;
  classe: string;
  graine: number;
  participants: ParticipantParams[];
  options: OptionsPartie;
}

export interface Vent {
  direction: Direction;
  force: number;
}

export interface Choix {
  /** null : rester à l'abri sur une case côtière. */
  cap: Direction | null;
  /** null : à sec de toile. */
  voile: string | null;
  /** Distance maximale souhaitée (null = le maximum). */
  distanceMax: number | null;
  /** Compétence Voilier : voile perdue à recoudre pendant ce tour. */
  recoudre?: string;
}

export interface EtatBateau {
  id: string;
  nom: string;
  type: 'humain' | 'ia';
  niveauIA: NiveauIA;
  niveauQuiz: 1 | 2 | 3;
  skipperId: string;
  bateauId: string;
  competence: string;
  famille: string;
  x: number;
  y: number;
  voiles: string[];
  voilesPerdues: string[];
  voilesDepart: string[];
  reparations: number;
  reparationsDepart: number;
  /** Course en double : le co-skipper. */
  coSkipperId?: string;
  /** Usure des voiles d'avant (0 à 100 : perdue). La grand-voile ne s'use pas. */
  usure?: Record<string, number>;
  /** Avarie grave ce tour (chavirage, deuxième voile perdue) : peut déclencher une escale technique. */
  avarieGrave?: boolean;
  passeTours: number;
  relancesRestantes: number;
  dernierRecousu: number;
  porte: number;
  arrive: boolean;
  horsClassement: boolean;
  tourArrivee: number | null;
  depassement: number;
  distanceDernierTour: number;
  sillage: Case[];
  /** Trace complète : position en fin de chaque tour et distance parcourue (pour la carte façon tracker). */
  trace: [number, number, number][];
  dernierCap: number | null;
  /** Voile hissée au tour précédent (compétence Navigateur). */
  derniereVoile: string | null;
  /** Effets temporaires d'une carte événement (avarie en cours, bonne nuit de sommeil…). */
  modificateurs: Modificateur[];
  /** Carte du large tirée ce tour (après le jet du vent), et si elle a été annulée par une réparation. */
  carteTour: { id: string; reparee: boolean; voilePerdue: string | null } | null;
  /** Une carte réparation a été jouée ce tour (compétence Bricoleur). */
  reparationCeTour?: boolean;
  /** Arrêté au milieu du pot-au-noir : au prochain tour, un dé pair pour repartir (11/11/2026). */
  potAuNoir?: boolean;
  /** Position exacte dans sa case (centre de case = x + 0,5), là où le bateau s'est arrêté (11/11/2026). */
  pos?: [number, number];
  choix: Choix | null;
  /** milles : distance réellement parcourue sur la course (départage des arrivées au même tour, 11/11/2026). */
  stats: { quizJustes: number; quizFaux: number; avaries: number; reparationsJouees: number; escales: number; milles?: number };
}

export type Attente =
  | { type: 'relance'; bateauId: string; ventLocal: Vent; angle: number }
  | { type: 'quiz'; bateauId: string; questionId: string; niveau: number; source?: 'large' }
  | { type: 'reparation'; bateauId: string; motif: 'voile_noire' | 'penalite' | 'evenement'; penalite?: PenaliteDef['id']; carteId?: string };

export interface ContexteResolution {
  bateauId: string;
  etape: 'debut' | 'relance' | 'evenement' | 'risque' | 'quiz' | 'reparation' | 'deplacement' | 'fin';
  delta: number;
  relance: boolean;
  ventLocal: Vent | null;
  angle: number;
  distance: number;
  risque: number;
  noir: boolean;
  penalite: PenaliteDef['id'] | null;
  bloqueSurPlace: boolean;
  /** Pour le journal des mouvements. */
  de?: Case;
  distanceDes?: number | null;
  louvoyage?: boolean;
  budget?: number | null;
  chemin?: Case[];
  bloque?: string | null;
  courant?: boolean;
  arrive?: boolean;
  issue?: string;
}

export interface Resolution {
  ventAvant: Vent;
  des: { force: number; direction: number };
  ordre: string[];
  /** Classement au début du tour (pour détecter les dépassements en fin de tour). */
  rangAvant?: string[];
  /** Avancement des tirages du dé événement (tous les bateaux, juste après le jet du vent). */
  tirage: number;
  index: number;
  courant: ContexteResolution | null;
  /** Vent et distance annoncés au moment du choix, par bateau (journal des mouvements). */
  previsions?: Record<string, { vent: Vent; distance: number | null }>;
  /** Vent des alizés avant les dés (le vent local d'un bateau dans la zone en dépend). */
  alizesAvant?: Vent[];
}

export type TypeEvenement =
  | 'vent' | 'debut' | 'relance' | 'jet_risque' | 'quiz' | 'penalite' | 'reparation' | 'voile_perdue'
  | 'deplacement' | 'arrivee' | 'port' | 'naufrage' | 'passe' | 'abri' | 'bloque' | 'recousu' | 'info' | 'fin'
  | 'de_evenement' | 'carte_evenement' | 'depassement' | 'a_vue' | 'meteo' | 'collision' | 'usure' | 'tempete' | 'demate';

export interface Evenement {
  tour: number;
  type: TypeEvenement;
  bateauId?: string;
  texte: string;
  donnees?: Record<string, unknown>;
}

/** Front météo (dépression) qui traverse la carte. Positions et rayons en cases. */
export interface MeteoMondiale {
  anticyclones: { nom: string; x: number; y: number; rx: number; ry: number; forces: [number, number]; hemisphere: 'N' | 'S' }[];
  depressions: {
    nom: string; rect: [number, number, number, number]; hemisphere: 'N' | 'S'; rayons: [number, number]; vx: number;
    forces: number[]; directions: number[]; bascule: number; baisse: number; probabilite: number; max: number; duree: number; annonce: number;
  }[];
}

export interface Front {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  direction: number;
  force: number;
  bascule: number;
  baisse: number;
  /** Vent prévu au départ du système : son évolution aux dés reste bornée autour (11/11/2026). */
  origine?: { direction: number; force: number };
  /** 'molle' : zone de petit temps instable près de l'arrivée (immobile, sans traîne). */
  type?: 'front' | 'molle' | 'anticyclone';
  /** Contour (en cases) d'une molle propre à une course (13/11/2026) : la zone est ce polygone, pas l'ellipse. */
  contour?: [number, number][];
  /** Tours restants avant l'arrivée du front (0 = actif). */
  annonce: number;
  age: number;
  /** Météo mondiale : nom du système, hémisphère (sens de rotation), anticyclone permanent et sa position moyenne. */
  nom?: string;
  hemisphere?: 'N' | 'S';
  permanent?: boolean;
  maison?: [number, number];
  /** Durée de vie (tours) d'une dépression de la météo mondiale, et indice de sa zone de naissance. */
  duree?: number;
  zone?: number;
}

export interface EtatPartie {
  version: 1;
  params: ParamsPartie;
  rng: number;
  tour: number;
  phase: 'choix' | 'resolution' | 'fin';
  vent: Vent;
  tendance: number;
  bateaux: EtatBateau[];
  attente: Attente | null;
  resolution: Resolution | null;
  quizUtilises: string[];
  evenements: Evenement[];
  tourFinMax: number | null;
  /** Dés du vent du tour, tirés dès le début du tour (le Navigateur voit le dé de force). */
  desProchains: { force: number; direction: number } | null;
  /** Prévisions (avec erreur possible) des dés à venir, pour le Navigateur (force) et le Météorologue (direction) (12/11/2026). */
  previsions?: { force: number; direction: number } | null;
  fronts: Front[];
  /** Nombre de fronts déjà créés dans la course. */
  frontsCrees?: number;
  /** Nombre d'anticyclones déjà créés dans la course. */
  anticyclonesCrees?: number;
  classementFinal: string[] | null;
  /** Flotte mêlant monocoques et multicoques (Vintage) : vainqueur de chaque catégorie, dès qu'il est connu. */
  vainqueurs?: Partial<Record<'multicoque' | 'monocoque', string>>;
  /** Vent régulier de la zone des alizés (absent si la course n'en a pas). */
  alize?: import('./meteo').Alize;
  /** Vents réguliers des zones d'alizés (nord-est, sud-est…), dans l'ordre des zones de la course. */
  alizes?: import('./meteo').Alize[];
  /** Journal des mouvements (bêta) : une ligne par bateau et par tour. */
  journal?: import('./journal').LigneJournal[];
}

export type Action =
  | { type: 'ChoisirCapEtVoile'; bateauId: string; choix: Choix }
  | { type: 'RepondreRelance'; bateauId: string; relancer: boolean }
  | { type: 'RepondreQuiz'; bateauId: string; reponse: number }
  | { type: 'JouerReparation'; bateauId: string; jouer: boolean };
