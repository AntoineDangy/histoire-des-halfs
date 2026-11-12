// Compilation d'une carte de course : types de cases, zones, abris côtiers et champ de distance
// jusqu'à l'arrivée (parcours en largeur qui respecte les obstacles et l'ordre des portes).
import { DX, DY } from './geo';
import type { Case, CourseDef } from './types';

export const INFINI = 1_000_000;

export interface CarteCompilee {
  course: CourseDef;
  L: number;
  H: number;
  /** Caractère de chaque case : '.', '#', '~', 'P', 'S', 'A'. */
  type: string[];
  /** Types de zones présents sur chaque case (alize, brume, courant, zone_cotiere…). */
  zones: string[][];
  /** Index de la zone météo d'alizé ou de courant couvrant la case (-1 sinon). */
  alize: number[];
  courant: number[];
  /** Case de mer adjacente à une terre : abri possible contre la tempête. */
  cote: boolean[];
  departs: Case[];
  ports: Case[];
  /** Cases de chaque porte, sous forme d'index. */
  portes: Set<number>[];
  /** Champ de distance vers chaque porte. */
  champs: Float64Array[];
  /** Distance restante après le franchissement de chaque porte. */
  reste: number[];
  /** Terre fine des cases de mer côtières (masque de 4 × 4 sous-cases, 0 sinon). */
  fin: Uint16Array;
  /**
   * Vraie distance (décision du porteur de projet, 12/11/2026, tours du monde) : taille réelle d'une case de chaque ligne,
   * en fraction de milles_par_case (cos de la latitude en Mercator ; 1 partout sur les autres cartes). Les distances du
   * moteur (budget d'un tour, distance restante) sont comptées en « cases de l'équateur ».
   */
  facteur: Float64Array;
}

const cache = new WeakMap<CourseDef, CarteCompilee>();
const routes = new WeakMap<CarteCompilee, Case[]>();

/**
 * Parcours obligatoire (demande du porteur de projet, 10/11/2026) : la route la plus courte en mer, du départ à
 * l'arrivée, en franchissant les marques dans l'ordre. On descend le champ de distances case par case.
 */
export function routeObligatoire(c: CarteCompilee): Case[] {
  const deja = routes.get(c);
  if (deja) return deja;
  const valeur = (j: number, k: number) => (c.portes[k].has(j) ? (k + 1 < c.portes.length ? c.champs[k + 1][j] : 0) : c.champs[k][j]);
  let [x, y] = c.departs.reduce((m, p) => (c.champs[0][idx(c, p[0], p[1])] < c.champs[0][idx(c, m[0], m[1])] ? p : m), c.departs[0]);
  let k = 0;
  const out: Case[] = [[x, y]];
  for (let n = 0; n < c.L * c.H && k < c.portes.length; n++) {
    let best = -1, bv = valeur(idx(c, x, y), k);
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!navigable(c, nx, ny) || !passageLibre(c, x, y, nx, ny)) continue;
      const v = valeur(ny * c.L + nx, k);
      if (v < bv - 1e-9) { bv = v; best = ny * c.L + nx; }
    }
    if (best < 0) break;
    x = best % c.L; y = Math.floor(best / c.L);
    out.push([x, y]);
    while (k < c.portes.length && c.portes[k].has(best)) k++;
  }
  routes.set(c, out);
  return out;
}

export function idx(c: CarteCompilee, x: number, y: number): number {
  return y * c.L + x;
}

export function dansCarte(c: CarteCompilee, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < c.L && y < c.H;
}

export function navigable(c: CarteCompilee, x: number, y: number): boolean {
  if (!dansCarte(c, x, y)) return false;
  const i = idx(c, x, y);
  const t = c.type[i];
  if (t === '#' || t === '~') return false;
  const z = c.zones[i];
  return !z.includes('zone_exclusion_glaces') && !z.includes('zone_interdite');
}

export function compilerCarte(course: CourseDef): CarteCompilee {
  const deja = cache.get(course);
  if (deja) return deja;
  const L = course.carte.largeur;
  const H = course.carte.hauteur;
  const type: string[] = [];
  for (let y = 0; y < H; y++) {
    const ligne = course.carte.lignes[y] ?? '';
    for (let x = 0; x < L; x++) type.push(ligne[x] ?? '.');
  }
  const zones: string[][] = type.map(() => []);
  const alize = new Array<number>(L * H).fill(-1);
  const courant = new Array<number>(L * H).fill(-1);
  course.zones_meteo.forEach((z, zi) => {
    const [x0, y0, x1, y1] = z.rect;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= L || y >= H) continue;
        const i = y * L + x;
        zones[i].push(z.type);
        if (z.type === 'alize') alize[i] = zi;
        if (z.type === 'courant') courant[i] = zi;
      }
  });

  const departs: Case[] = [];
  const ports: Case[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < L; x++) {
      const t = type[y * L + x];
      if (t === 'S') departs.push([x, y]);
      if (t === 'P') ports.push([x, y]);
    }

  const portes = course.portes.map((p) => new Set(p.cases.map(([x, y]) => y * L + x)));
  const fin = new Uint16Array(L * H);
  for (const t of (course.carte.terre_fine ?? '').split(';')) {
    const [x, y, m] = t.split(',').map(Number);
    if (t && x >= 0 && y >= 0 && x < L && y < H) fin[y * L + x] = m;
  }

  const facteur = new Float64Array(H).fill(1);
  const pj = course.projection;
  if (course.distance_reelle && pj) {
    const RAD = Math.PI / 180;
    const cellRad = ((pj.lon_max - pj.lon_min) * RAD) / L;
    const yMax = Math.log(Math.tan(Math.PI / 4 + (pj.lat_max * RAD) / 2));
    for (let y = 0; y < H; y++) facteur[y] = Math.cos(2 * Math.atan(Math.exp(yMax - (y + 0.5) * cellRad)) - Math.PI / 2);
  }
  const c: CarteCompilee = {
    course, L, H, type, zones, alize, courant, cote: [], departs, ports, portes, champs: [], reste: [], fin, facteur,
  };

  c.cote = type.map((_, i) => {
    const x = i % L;
    const y = Math.floor(i / L);
    if (!navigable(c, x, y)) return false;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (dansCarte(c, nx, ny) && type[ny * L + nx] === '#') return true;
    }
    return false;
  });

  // Zones côtières (compétence Régatier) autour du départ et de l'arrivée.
  const zc = course.zones_cotieres;
  if (zc) {
    const centres: Case[] = [];
    if (zc.autour.includes('depart')) centres.push(...departs);
    if (zc.autour.includes('arrivee')) {
      const derniere = course.portes[course.portes.length - 1];
      if (derniere) centres.push(...(derniere.cases as Case[]));
    }
    for (const [cx, cy] of centres)
      for (let y = cy - zc.rayon; y <= cy + zc.rayon; y++)
        for (let x = cx - zc.rayon; x <= cx + zc.rayon; x++) {
          if (!dansCarte(c, x, y)) continue;
          const z = zones[y * L + x];
          if (!z.includes('zone_cotiere')) z.push('zone_cotiere');
        }
  }

  // Du dernier tronçon au premier : chaque champ donne la distance jusqu'à l'arrivée, marques comprises.
  c.champs = new Array(portes.length);
  for (let k = portes.length - 1; k >= 0; k--) c.champs[k] = champDistance(c, portes[k], k < portes.length - 1 ? c.champs[k + 1] : undefined);
  c.reste = new Array(portes.length).fill(0);
  cache.set(course, c);
  return c;
}

/** Passage en diagonale interdit entre deux cases non navigables (on ne coupe pas un coin de terre). */
export function diagonaleLibre(c: CarteCompilee, x: number, y: number, nx: number, ny: number): boolean {
  if (nx === x || ny === y) return true;
  return navigable(c, nx, y) || navigable(c, x, ny);
}

/**
 * Le point (px, py), en cases (coordonnées continues), est-il à terre ? Case de terre, ou sous-case de terre d'une case
 * de mer côtière (relevé fin des côtes : une presqu'île plus étroite qu'une case n'est plus traversée).
 */
export function terreFine(c: CarteCompilee, px: number, py: number): boolean {
  const x = Math.floor(px), y = Math.floor(py);
  if (!dansCarte(c, x, y)) return true;
  const i = idx(c, x, y);
  if (c.type[i] === '#') return true;
  const m = c.fin[i];
  if (!m) return false;
  const sx = Math.min(3, Math.floor((px - x) * 4)), sy = Math.min(3, Math.floor((py - y) * 4));
  return ((m >> (sy * 4 + sx)) & 1) === 1;
}

/** Passage d'une case à une case voisine : pas de coin de terre, et pas de terre fine sur le segment entre leurs centres. */
export function passageLibre(c: CarteCompilee, x: number, y: number, nx: number, ny: number): boolean {
  if (!diagonaleLibre(c, x, y, nx, ny)) return false;
  for (const t of [0.25, 0.5, 0.75]) if (terreFine(c, x + 0.5 + (nx - x) * t, y + 0.5 + (ny - y) * t)) return false;
  return true;
}

/** Champ de distance euclidienne approchée (Dijkstra, pas de 1 et de √2) vers un ensemble de cases. */
/**
 * Plus court chemin en mer vers des cases cibles. `suite` donne, pour chaque cible, la distance qui reste
 * APRÈS elle (marque franchie à cet endroit, puis la suite du parcours) : c'est ce qui fait choisir le bon
 * endroit où franchir une marque (correction du 10/11/2026).
 */
function champDistance(c: CarteCompilee, cibles: Set<number>, suite?: Float64Array): Float64Array {
  const dist = new Float64Array(c.L * c.H).fill(INFINI);
  const tas: [number, number][] = [];
  const pousser = (d: number, i: number) => {
    tas.push([d, i]);
    let k = tas.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (tas[p][0] <= tas[k][0]) break;
      [tas[p], tas[k]] = [tas[k], tas[p]];
      k = p;
    }
  };
  const extraire = (): [number, number] => {
    const haut = tas[0];
    const fin = tas.pop()!;
    if (tas.length) {
      tas[0] = fin;
      let k = 0;
      for (;;) {
        const a = 2 * k + 1, b = a + 1;
        let m = k;
        if (a < tas.length && tas[a][0] < tas[m][0]) m = a;
        if (b < tas.length && tas[b][0] < tas[m][0]) m = b;
        if (m === k) break;
        [tas[m], tas[k]] = [tas[k], tas[m]];
        k = m;
      }
    }
    return haut;
  };
  for (const i of cibles) {
    const d0 = suite ? suite[i] : 0;
    if (d0 >= INFINI) continue;
    dist[i] = d0;
    pousser(d0, i);
  }
  while (tas.length) {
    const [d, i] = extraire();
    if (d > dist[i]) continue;
    const x = i % c.L;
    const y = Math.floor(i / c.L);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!navigable(c, nx, ny) || !passageLibre(c, x, y, nx, ny)) continue;
      const j = ny * c.L + nx;
      const nd = d + (k % 2 ? Math.SQRT2 : 1) * (c.facteur[y] + c.facteur[ny]) / 2;
      if (nd < dist[j]) {
        dist[j] = nd;
        pousser(nd, j);
      }
    }
  }
  return dist;
}

/** Distance restante (en cases) depuis une case, sachant la prochaine porte à franchir. */
export function distanceRestanteCase(c: CarteCompilee, x: number, y: number, porte: number): number {
  if (porte >= c.portes.length) return 0;
  return c.champs[porte][idx(c, x, y)] + c.reste[porte];
}

export function zonesCase(c: CarteCompilee, x: number, y: number): string[] {
  return dansCarte(c, x, y) ? c.zones[idx(c, x, y)] : [];
}

const terres = new WeakMap<CarteCompilee, [number, number][]>();
/** Distance (en cases, à vol d'oiseau) de la case à la terre la plus proche. */
export function distanceCote(c: CarteCompilee, x: number, y: number): number {
  let t = terres.get(c);
  if (!t) {
    t = [];
    for (let j = 0; j < c.H; j++) for (let i = 0; i < c.L; i++) if (c.type[j * c.L + i] === '#') t.push([i, j]);
    terres.set(c, t);
  }
  let m = Infinity;
  for (const [i, j] of t) m = Math.min(m, Math.hypot(i - x, j - y));
  return m;
}
