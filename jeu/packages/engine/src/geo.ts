import type { Direction } from './types';

/** Nombre de caps : 16 (pas de 22,5°). 0 = N, 4 = E, 8 = S, 12 = W. Le vent ne prend que les valeurs paires (pas de 45°). */
export const NB_DIR = 16;
export const PAS_DEG = 360 / NB_DIR;

/** Voisins d'une case pour les parcours de carte (8 directions de grille). */
export const DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

export const NOMS_DIR = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const NOMS_DIR_LONGS = [
  'Nord', 'Nord-Nord-Est', 'Nord-Est', 'Est-Nord-Est', 'Est', 'Est-Sud-Est', 'Sud-Est', 'Sud-Sud-Est',
  'Sud', 'Sud-Sud-Ouest', 'Sud-Ouest', 'Ouest-Sud-Ouest', 'Ouest', 'Ouest-Nord-Ouest', 'Nord-Ouest', 'Nord-Nord-Ouest',
];

export const NOMS_ALLURES: Record<number, string> = {
  0: 'Bout au vent',
  22.5: 'Trop près du vent',
  45: 'Près',
  67.5: 'Bon plein',
  90: 'Travers',
  112.5: 'Petit largue',
  135: 'Largue',
  157.5: 'Grand largue',
  180: 'Vent arrière',
};

/** Angle minimal pour avancer : en dessous, le bateau est trop près du vent. */
export const ANGLE_MIN = 45;

export function norm(d: number): Direction {
  return ((d % NB_DIR) + NB_DIR) % NB_DIR;
}

/** Vecteur unitaire d'un cap (x vers l'est, y vers le sud). */
export function vecteur(cap: Direction): [number, number] {
  const a = (cap * PAS_DEG * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/** Écart (en pas de 22,5°) entre deux directions, de 0 à 8. */
export function ecartDir(a: Direction, b: Direction): number {
  const d = norm(a - b);
  return Math.min(d, NB_DIR - d);
}

/** Angle entre le cap et la direction d'où vient le vent (cahier des charges §3.3), en degrés. */
export function angleAllure(cap: Direction, ventDir: Direction): number {
  return ecartDir(cap, ventDir) * PAS_DEG;
}

/** Côté d'où vient le vent par rapport au bateau : +1 tribord, -1 bâbord, 0 dans l'axe. */
export function coteVent(cap: Direction, ventDir: Direction): number {
  const d = norm(ventDir - cap);
  if (d === 0 || d === NB_DIR / 2) return 0;
  return d < NB_DIR / 2 ? 1 : -1;
}

export function bandeForce(force: number): number {
  if (force <= 2) return 0;
  if (force <= 4) return 1;
  if (force <= 6) return 2;
  return 3;
}

/**
 * Demi-caps (essai décidé par le porteur de projet le 11/11/2026) : à moins de 500 milles de l'arrivée, on peut viser
 * entre deux des 16 caps (32 caps, pas de 11,25°). Un demi-cap s'écrit k + 0,5 (0,5 = Nord quart Nord-Est).
 */
export function capValide(cap: number, demiCaps: boolean): boolean {
  return Number.isInteger(cap * 2) && cap >= 0 && cap < NB_DIR && (demiCaps || Number.isInteger(cap));
}

const NOMS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const NOMS_8_LONGS = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];

/** Nom d'un cap ; un demi-cap prend le nom marin des 32 aires de vent (N¼NE = Nord quart Nord-Est). */
export function nomCap(cap: number, long = false): string {
  if (Number.isInteger(cap)) return (long ? NOMS_DIR_LONGS : NOMS_DIR)[norm(cap)];
  const a = norm(Math.floor(cap));
  const base = a % 2 === 0 ? a : norm(a + 1); // l'aire principale (N, NE, E…) la plus proche
  const sens = norm(cap - base) < NB_DIR / 2 ? 1 : -1;
  const vers = norm(base + 2 * sens);
  return long ? `${NOMS_8_LONGS[base / 2]} quart ${NOMS_8_LONGS[vers / 2]}` : `${NOMS_8[base / 2]}¼${NOMS_8[vers / 2]}`;
}

/** Nom d'une allure ; entre deux allures du tableau (demi-cap), « Entre près et bon plein ». */
export function nomAllure(angle: number): string {
  const exact = NOMS_ALLURES[angle];
  if (exact) return exact;
  const lo = Math.floor(angle / 22.5) * 22.5;
  return `Entre ${NOMS_ALLURES[lo].toLowerCase()} et ${NOMS_ALLURES[lo + 22.5].toLowerCase()}`;
}

/** L'allure dans une phrase : « au près », « entre le près et le bon plein ». */
export function auAllure(angle: number): string {
  const exact = NOMS_ALLURES[angle];
  if (exact) return `au ${exact.toLowerCase()}`;
  const lo = Math.floor(angle / 22.5) * 22.5;
  return `entre le ${NOMS_ALLURES[lo].toLowerCase()} et le ${NOMS_ALLURES[lo + 22.5].toLowerCase()}`;
}
