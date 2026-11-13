// L'échelle de Beaufort dans « Ton hangar à bateaux » : chaque bateau a la sienne (demande du porteur de projet,
// 10/11/2026), dans sa vue 3D. Table d'origine : conception/risque-un-de-et-beaufort.md.
// Sources : Met Office (vitesses, hauteurs de vague probables, état de la mer) ; Environnement et Changement climatique
// Canada et Wikipédia, fr.wikipedia.org/wiki/Échelle_de_Beaufort (termes français) ; seuils des avis de Météo-France relevés dans la presse nautique. Voilure : indicative.
import type { AllureKey, Forme } from './scene3d';

export interface ForceBeaufort {
  terme: string;
  noeuds: [number, number | null];
  vague: string;
  mer: string;
  avis?: string;
  /** Le ciel (nuages de la vue 3D). */
  ciel: string;
}

export const BEAUFORT: ForceBeaufort[] = [
  { terme: 'Calme', noeuds: [0, 1], vague: '0', mer: 'La mer est comme un miroir.', ciel: 'Ciel clair, quelques petits cumulus de beau temps.' },
  { terme: 'Très légère brise', noeuds: [1, 3], vague: '0,1', mer: 'Quelques rides, sans écume.', ciel: 'Petits cumulus épars.' },
  { terme: 'Légère brise', noeuds: [4, 6], vague: '0,2', mer: 'Vaguelettes courtes, crêtes lisses.', ciel: 'Cumulus de beau temps.' },
  { terme: 'Petite brise', noeuds: [7, 10], vague: '0,6', mer: 'Très petites vagues, quelques moutons.', ciel: 'Cumulus plus nombreux.' },
  { terme: 'Jolie brise', noeuds: [11, 16], vague: '1', mer: 'Petites vagues, nombreux moutons.', ciel: 'Beaux cumulus, base parfois grise.' },
  { terme: 'Bonne brise', noeuds: [17, 21], vague: '2', mer: 'Vagues modérées et allongées, moutons, quelques embruns.', ciel: 'Le ciel se charge : cumulus et premiers stratocumulus.' },
  { terme: 'Vent frais', noeuds: [22, 27], vague: '3', mer: 'Grosses vagues, crêtes d\'écume blanche étendues.', ciel: 'Ciel chargé de stratocumulus gris.' },
  { terme: 'Grand frais', noeuds: [28, 33], vague: '4', mer: 'La mer grossit ; l\'écume s\'étire en traînées dans le lit du vent.', avis: 'Avis de grand frais', ciel: 'Couvert, nuages gris et bas qui défilent.' },
  { terme: 'Coup de vent', noeuds: [34, 40], vague: '5,5', mer: 'Lames assez hautes, tourbillons d\'embruns arrachés aux crêtes.', avis: 'Avis de coup de vent', ciel: 'Ciel sombre et bas, grains.' },
  { terme: 'Fort coup de vent', noeuds: [41, 47], vague: '7', mer: 'Grosses lames, les crêtes déferlent en rouleaux.', avis: 'Avis de fort coup de vent', ciel: 'Nuages très bas et sombres, visibilité réduite.' },
  { terme: 'Tempête', noeuds: [48, 55], vague: '9', mer: 'Très grosses lames déferlantes, la mer paraît blanche.', avis: 'Avis de tempête', ciel: 'Plafond très bas, presque noir.' },
  { terme: 'Violente tempête', noeuds: [56, 63], vague: '11,5', mer: 'Lames exceptionnellement hautes, la mer est couverte d\'écume.', avis: 'Avis de violente tempête', ciel: 'Ciel noir, l\'horizon disparaît dans les embruns.' },
  { terme: "Vent d'ouragan", noeuds: [64, null], vague: '14 et plus', mer: 'L\'air est plein d\'écume et d\'embruns, la mer est entièrement blanche.', avis: 'Avis d\'ouragan', ciel: 'Ciel et mer se confondent.' },
];

export interface VoilureBeaufort {
  texte: string;
  forme: Forme;
  ris: number;
  allure: AllureKey;
  /** Vitesse indicative en nœuds. */
  vitesse: number;
  sansVoile?: boolean;
  etat?: 'demate' | 'coule' | 'chavire';
}

type L = [string, Forme, number, AllureKey, number, boolean?, ('demate' | 'coule' | 'chavire')?];
const v = ([texte, forme, ris, allure, vitesse, sansVoile, etat]: L): VoilureBeaufort => ({ texte, forme, ris, allure, vitesse, sansVoile, etat });

/** Monocoque moderne (IMOCA, Class40) et monocoque de légende ; le texte de F4 dépend des foils. */
function monocoque(foils: boolean): VoilureBeaufort[] {
  return ([
    ['Grand-voile haute et code 0 : les voiles pendent.', 'fro', 0, 'travers', 0.5],
    ['Grand-voile haute et code 0.', 'fro', 0, 'travers', 3],
    ['Grand-voile haute et code 0.', 'fro', 0, 'travers', 6],
    ['Grand-voile haute et gennaker.', 'a3', 0, 'largue', 10],
    [foils ? 'Grand-voile haute et gennaker : le bateau vole sur son foil.' : 'Grand-voile haute et gennaker : le bateau accélère au largue.', 'a3', 0, 'largue', 16],
    ['Grand-voile haute et solent.', 'j2', 0, 'travers', 18],
    ['Un ris dans la grand-voile, solent.', 'j2', 1, 'travers', 18],
    ['Deux ris et J3.', 'j3', 2, 'travers', 16],
    ['Trois ris et J3.', 'j3', 3, 'largue', 14],
    ['Grand-voile affalée, tourmentin seul.', 'tourmentin', 4, 'largue', 11],
    ['À sec de toile, en fuite devant le temps.', 'j2', 4, 'arriere', 9, true],
    ['Démâté : le mât s\'est rompu et traîne dans l\'eau.', 'j2', 4, 'arriere', 5, true, 'demate'],
    ['Le bateau sombre.', 'j2', 4, 'arriere', 1, true, 'coule'],
  ] as L[]).map(v);
}

/** Goélette (Pen Duick III) : grand-voile et misaine, voiles d'avant de l'époque. */
const GOELETTE: VoilureBeaufort[] = ([
  ['Grand-voile, misaine et génois léger : les voiles pendent.', 'fro', 0, 'travers', 0.5],
  ['Grand-voile, misaine et génois léger.', 'fro', 0, 'travers', 2],
  ['Grand-voile, misaine et génois léger.', 'fro', 0, 'travers', 4],
  ['Au largue : spi de brise, misaine et grand-voile.', 'a3', 0, 'largue', 7],
  ['Au largue : spi, misaine et grand-voile.', 'a2', 0, 'largue', 9],
  ['Grand-voile, misaine et génois.', 'j2', 0, 'travers', 10],
  ['Un ris dans la grand-voile et la misaine, foc.', 'j3', 1, 'travers', 10],
  ['Deux ris et foc.', 'j3', 2, 'travers', 9],
  ['Trois ris et tourmentin.', 'tourmentin', 3, 'largue', 8],
  ['Grand-voile et misaine affalées, tourmentin seul.', 'tourmentin', 4, 'largue', 7],
  ['À sec de toile, en fuite devant le temps.', 'j2', 4, 'arriere', 6, true],
  ['Démâté : les deux mâts se sont rompus et traînent dans l\'eau.', 'j2', 4, 'arriere', 3, true, 'demate'],
  ['Le bateau sombre.', 'j2', 4, 'arriere', 1, true, 'coule'],
] as L[]).map(v);

/** Multicoque (Ultim, Ocean Fifty, trimarans de légende) : il réduit plus tôt, et chavire au lieu de démâter. */
function multicoque(volant: boolean): VoilureBeaufort[] {
  return ([
    ['Grand-voile haute et code 0 : les voiles pendent.', 'fro', 0, 'travers', 1],
    ['Grand-voile haute et code 0.', 'fro', 0, 'travers', 6],
    ['Grand-voile haute et code 0.', 'fro', 0, 'travers', 11],
    ['Grand-voile haute et gennaker : le flotteur sous le vent porte le bateau.', 'a3', 0, 'largue', 18],
    [volant ? 'Grand-voile haute et gennaker : le trimaran vole sur ses foils.' : 'Grand-voile haute et gennaker : la coque centrale se soulève.', 'a3', 0, 'largue', 24],
    ['Grand-voile haute et solent.', 'j2', 0, 'travers', 26],
    ['Un ris et solent : on réduit tôt sur un multicoque.', 'j2', 1, 'travers', 24],
    ['Deux ris et J3.', 'j3', 2, 'travers', 20],
    ['Trois ris et J3 : le risque de chavirage grandit.', 'j3', 3, 'largue', 16],
    ['Grand-voile affalée, tourmentin seul.', 'tourmentin', 4, 'largue', 12],
    ['À sec de toile, en fuite devant le temps.', 'j2', 4, 'arriere', 8, true],
    ['Chavirage : le trimaran s\'est retourné ; l\'équipage se réfugie dans la coque et déclenche sa balise.', 'j2', 4, 'arriere', 1, true, 'chavire'],
    ['Retourné, le trimaran dérive dans l\'ouragan : un multicoque chaviré flotte, mais ne se redresse pas.', 'j2', 4, 'arriere', 1, true, 'chavire'],
  ] as L[]).map(v);
}

/** Voilure et état du bateau à chaque force, selon son modèle 3D. */
export function voilureBeaufort(modele: string): VoilureBeaufort[] {
  if (modele === 'pen_duick_3') return GOELETTE;
  if (modele === 'ultim' || modele === 'ultim_ancien' || modele === 'ocean_fifty') return multicoque(modele === 'ultim');
  return monocoque(modele === 'imoca');
}

export const kmh = (n: number) => Math.round(n * 1.852);
export function texteVent(f: ForceBeaufort) {
  return f.noeuds[1] === null ? `${f.noeuds[0]} nœuds et plus (${kmh(f.noeuds[0])} km/h et plus)` : `${f.noeuds[0]} à ${f.noeuds[1]} nœuds (${kmh(f.noeuds[0])} à ${kmh(f.noeuds[1])} km/h)`;
}
