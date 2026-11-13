// Fronts météo (dépressions) : annoncés à l'avance, ils traversent la carte d'ouest en est.
// Dans le front : gros vent d'une direction donnée. Derrière, dans la traîne : le vent a basculé et faibli.
// Le vent « courant » d'un bateau dépend donc de sa position : tout le monde choisit avec le vent
// qui souffle là où il est.
import { norm } from './geo';
import { alea, entier, face } from './rng';
import type { CourseDef, Donnees, EtatPartie, Front, MeteoMondiale, Vent } from './types';

export interface ReglesFronts {
  probabilite: number;
  tour_min: number;
  annonce_tours: number;
  duree: number;
  rayons: [number, number];
  vitesse: [number, number];
  forces: number[];
  directions: number[];
  bascule: number;
  baisse_traine: number;
  max_par_course?: number;
}

export interface ReglesMolle {
  probabilite: number;
  rayon: number;
  decalage: [number, number];
  forces: number[];
}

/**
 * Réglages des fronts, mis à l'échelle de la classe de la partie (décision du 09/11/2026) : les valeurs de
 * regles.json sont calées pour une course de 15 tours à la vitesse 1 ; une classe plus rapide a des fronts
 * plus grands et plus rapides (en cases), et des échéances plus courtes (en tours).
 */
export function reglesFronts(d: Donnees, etat?: Pick<EtatPartie, 'params'>): ReglesFronts | null {
  const r = (d.regles as unknown as { fronts?: ReglesFronts }).fronts ?? null;
  if (!r || !etat) return r;
  const c = d.classes.find((x) => x.id === etat.params.classe);
  const uniforme = !!d.courses.find((x) => x.id === etat.params.courseId)?.vitesse_unique;
  const v = uniforme ? 1 : c?.vitesse ?? 1;               // Fastnet : même vitesse et 15 tours pour toutes les classes
  const k = uniforme ? 1 : (c?.tours_moyens ?? 15) / 15;
  return {
    ...r,
    tour_min: Math.max(2, Math.round(r.tour_min * k)),
    annonce_tours: Math.max(1, Math.round(r.annonce_tours * k)),
    duree: Math.max(2, Math.round(r.duree * k)),
    rayons: [r.rayons[0] * v, r.rayons[1] * v],
    vitesse: [r.vitesse[0] * v, r.vitesse[1] * v],
  };
}

/** Point dans un polygone (règle pair-impair). */
export function dansContour(x: number, y: number, contour: [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [xi, yi] = contour[i], [xj, yj] = contour[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

function dansEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Centre de la traîne : derrière le front, à l'opposé de son déplacement. */
export function centreTraine(f: Front): [number, number] {
  // Météo mondiale : la dépression file vite (près de 40 cases par tour), la traîne la suit juste derrière.
  if (f.hemisphere) return [f.x - Math.sign(f.vx || 1) * f.rx * 1.6, f.y];
  return [f.x - f.vx * 2.2, f.y - f.vy * 2.2];
}

/** Zone du front qui concerne une case : 'front', 'traine' ou null. */
export function zoneFront(f: Front, x: number, y: number): 'front' | 'traine' | null {
  if (f.annonce > 0) return null;
  // Molle dessinée d'une course (13/11/2026) : le centre de la case est-il dans le contour ?
  if (f.contour) return dansContour(x + 0.5, y + 0.5, f.contour) ? 'front' : null;
  if (dansEllipse(x + 0.5, y + 0.5, f.x, f.y, f.rx, f.ry)) return 'front';
  if (f.type === 'molle' || f.type === 'anticyclone') return null;
  const [tx, ty] = centreTraine(f);
  if (dansEllipse(x + 0.5, y + 0.5, tx, ty, f.rx, f.ry)) return 'traine';
  return null;
}

/**
 * Vent dans un anticyclone (hautes pressions, hémisphère nord) : calme au centre, vent qui tourne autour dans le
 * sens des aiguilles d'une montre, plus établi sur les bords.
 */
export function ventAnticyclone(f: Front, x: number, y: number): Vent {
  const dx = (x + 0.5 - f.x) / f.rx, dy = (y + 0.5 - f.y) / f.ry;
  const r = Math.hypot(dx, dy);
  if (r < 0.35) return { direction: f.direction, force: 1 };
  // Le vent souffle le long du cercle, dans le sens horaire : il « vient » de la direction (dy, -dx).
  // Hémisphère sud (12/11/2026) : rotation inverse.
  const sud = f.hemisphere === 'S';
  const fx = sud ? -dy : dy, fy = sud ? dx : -dx;
  const deg = (Math.atan2(fx, -fy) * 180) / Math.PI;
  const dir = norm(Math.round(deg / 45) * 2);
  return { direction: dir, force: r < 0.7 ? Math.max(1, f.force - 1) : f.force };
}

/** Vent d'un système météo (front, traîne, molle, anticyclone) à une position. */
export function ventSysteme(f: Front, zone: 'front' | 'traine', x: number, y: number): Vent {
  return f.type === 'anticyclone' ? ventAnticyclone(f, x, y) : ventFront(f, zone);
}

/** Vent du front pour une zone donnée. */
export function ventFront(f: Front, zone: 'front' | 'traine'): Vent {
  return zone === 'front' ? { direction: f.direction, force: f.force } : { direction: norm(f.direction + f.bascule), force: Math.max(1, f.force - f.baisse) };
}

/**
 * Alizés (décision du 09/11/2026) : dans leur zone souffle un vent propre, régulier, borné en direction
 * (de Nord-Est à Est) et en force (4 à 6). Les dés du tour le font varier, mais il reste dans ses bornes
 * et sa force ne change que d'un cran par tour. C'est ce qui fait payer le détour pour aller les chercher.
 */
export interface Alize extends Vent {
  /** Nom de la zone (« Alizés », « Vents d'ouest des mers du Sud »…). */
  nom?: string;
  rect: [number, number, number, number];
  directions: [number, number];
  forces: [number, number];
}

/** Toutes les zones d'alizés à vent régulier de la course (alizés de nord-est, alizés de sud-est…). */
export function listeAlizes(etat: { alize?: Alize; alizes?: Alize[] }): Alize[] {
  return etat.alizes ?? (etat.alize ? [etat.alize] : []);
}

/** Indice de la zone d'alizés qui couvre une case, ou -1. */
export function indiceAlize(etat: { alize?: Alize; alizes?: Alize[] }, x: number, y: number): number {
  return listeAlizes(etat).findIndex((a) => x >= a.rect[0] && x <= a.rect[2] && y >= a.rect[1] && y <= a.rect[3]);
}

/** Zone d'alizés qui couvre une case (avec son vent du moment), ou null. */
export function alizeEn(etat: { alize?: Alize; alizes?: Alize[] }, x: number, y: number): Alize | null {
  const i = indiceAlize(etat, x, y);
  return i >= 0 ? listeAlizes(etat)[i] : null;
}

export function dansAlize(etat: { alize?: Alize; alizes?: Alize[] }, x: number, y: number): boolean {
  return indiceAlize(etat, x, y) >= 0;
}

/** Vent des alizés après les dés : direction et force bornées, la force ne bouge que d'un cran. */
export function alizeApres(a: Alize | Vent & { directions: [number, number]; forces: [number, number] }, dd: number, df: number): Vent {
  return {
    direction: Math.max(a.directions[0], Math.min(a.directions[1], a.direction + dd)),
    force: Math.max(a.forces[0], Math.min(a.forces[1], a.force + df)), // les dés jouent pleinement (10/11/2026)
  };
}

/** Vent qui souffle actuellement sur une case : vent du front s'il y en a un, sinon alizé dans sa zone, sinon vent général. */
export function ventCourant(etat: Pick<EtatPartie, 'vent' | 'fronts'> & { alize?: Alize; alizes?: Alize[] }, x: number, y: number): Vent {
  for (const f of etat.fronts ?? []) {
    const z = zoneFront(f, x, y);
    if (z) return ventSysteme(f, z, x, y);
  }
  const a = alizeEn(etat, x, y);
  if (a) return { direction: a.direction, force: a.force };
  return etat.vent;
}

/** Front qui concerne une case, avec sa zone. */
export function frontSur(etat: Pick<EtatPartie, 'fronts'>, x: number, y: number): { front: Front; zone: 'front' | 'traine' } | null {
  for (const f of etat.fronts ?? []) {
    const z = zoneFront(f, x, y);
    if (z) return { front: f, zone: z };
  }
  return null;
}

/**
 * Fait évoluer les fronts en fin de tour : déplacement, compte à rebours de l'annonce, dissipation,
 * et peut-être naissance d'un nouveau front, placé en amont de la flotte pour l'atteindre à l'échéance.
 * Renvoie les textes à publier dans le journal.
 */
export function evoluerFronts(d: Donnees, etat: EtatPartie): string[] {
  const mm = d.courses.find((c) => c.id === etat.params.courseId)?.meteo_mondiale;
  if (mm) return evoluerMeteoMondiale(d, etat, mm);
  const r = reglesFronts(d, etat);
  if (!r) return [];
  const textes: string[] = [];
  etat.fronts = (etat.fronts ?? [])
    .map((f) => {
      if (f.type === 'molle') return { ...f, direction: entier(etat, 8) * 2, force: face(etat, (reglesMolle(d)?.forces ?? [1, 2])) };
      if (f.type === 'anticyclone') {
        const g = { ...f, x: f.x + f.vx, y: f.y + f.vy, direction: entier(etat, 8) * 2 };
        if (f.annonce > 0) {
          g.annonce = f.annonce - 1;
          if (g.annonce === 0) textes.push('L\'anticyclone s\'installe : calme au centre, vent qui tourne autour dans le sens des aiguilles d\'une montre. À contourner !');
        } else g.age = f.age + 1;
        return g;
      }
      const g = { ...f, x: f.x + f.vx, y: f.y + f.vy };
      if (f.annonce > 0) {
        g.annonce = f.annonce - 1;
        if (g.annonce === 0) textes.push(`Le front arrive : vent de secteur ${NOMS[g.direction]} force ${g.force}, puis bascule au secteur ${NOMS[norm(g.direction + g.bascule)]} dans la traîne.`);
      } else g.age = f.age + 1;
      return g;
    })
    .filter((f) => f.type === 'molle' || (f.type === 'anticyclone' ? f.age < (d.regles.anticyclone?.duree ?? 6) : f.age < r.duree));
  const actifs = etat.bateaux.filter((b) => !b.arrive && !b.horsClassement);
  creerAnticyclone(d, etat, r, textes);
  const enCours = etat.fronts.filter((f) => f.type !== 'molle' && f.type !== 'anticyclone').length;
  if (enCours === 0 && (etat.frontsCrees ?? 0) < (r.max_par_course ?? 2) && etat.tour >= r.tour_min && actifs.length && alea(etat) < r.probabilite) {
    const cx = actifs.reduce((s, b) => s + b.x, 0) / actifs.length;
    const cy = actifs.reduce((s, b) => s + b.y, 0) / actifs.length;
    const [vx, vy] = r.vitesse;
    const n = r.annonce_tours;
    const direction = face(etat, r.directions);
    const force = face(etat, r.forces);
    const decalage = (entier(etat, 7) - 3) * 2; // le front ne vise pas exactement le centre de la flotte
    const f: Front = {
      id: `front-${etat.tour}`, x: cx - vx * n, y: cy - vy * n + decalage, vx, vy, rx: r.rayons[0], ry: r.rayons[1],
      direction, force, bascule: r.bascule, baisse: r.baisse_traine, annonce: n, age: 0,
    };
    etat.fronts.push(f);
    etat.frontsCrees = (etat.frontsCrees ?? 0) + 1;
    textes.push(`Bulletin : une dépression arrive dans ${n} tours ! Vent de ${NOMS[direction]} force ${force} dans le front, puis bascule au secteur ${NOMS[norm(direction + r.bascule)]} force ${force - r.baisse_traine} dans la traîne.`);
  }
  return textes;
}

export function reglesMolle(d: Donnees): ReglesMolle | null {
  return (d.regles as unknown as { molle?: ReglesMolle }).molle ?? null;
}

/** Au départ : peut-être une molle à l'approche de l'arrivée (vent faible et instable). */
export function creerMolle(d: Donnees, etat: EtatPartie, arrivee: { x: number; y: number } | undefined, zone?: CourseDef['molle']): string | null {
  const r = reglesMolle(d);
  // Le tirage a toujours lieu (même suite de hasard) ; une molle propre à la course peut avoir sa propre probabilité.
  if (!r || !arrivee || alea(etat) >= (zone?.probabilite ?? r.probabilite)) return null;
  if (zone) {
    // Zone propre à la course (13/11/2026) : contour fixe dessiné par le porteur de projet, quelle que soit la classe.
    // x, y, rx, ry : rectangle englobant, pour placer l'étiquette sur la carte.
    const xs = zone.contour.map((p) => p[0]), ys = zone.contour.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    etat.fronts.push({
      id: 'molle', type: 'molle', x: (x0 + x1) / 2, y: (y0 + y1) / 2, vx: 0, vy: 0, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2,
      contour: zone.contour.map((p) => [p[0], p[1]]),
      direction: entier(etat, 8) * 2, force: face(etat, r.forces), bascule: 0, baisse: 0, annonce: 0, age: 0,
    });
    return 'Bulletin : une zone de molle s\'installe à l\'approche de l\'arrivée. Vent faible et instable : la course peut se jouer à la fin !';
  }
  // Plus grande pour les classes rapides, pour qu'un bateau ne la traverse pas en un seul tour (bornée près des Antilles).
  const v = Math.min(1.6, d.classes.find((c) => c.id === etat.params.classe)?.vitesse ?? 1);
  etat.fronts.push({
    id: 'molle', type: 'molle', x: arrivee.x + r.decalage[0], y: arrivee.y + r.decalage[1], vx: 0, vy: 0, rx: r.rayon * v, ry: r.rayon * v,
    direction: entier(etat, 8) * 2, force: face(etat, r.forces), bascule: 0, baisse: 0, annonce: 0, age: 0,
  });
  return 'Bulletin : une zone de molle s\'installe à l\'approche de l\'arrivée. Vent faible et instable : la course peut se jouer à la fin !';
}

const NOMS = ['Nord', 'Nord-Nord-Est', 'Nord-Est', 'Est-Nord-Est', 'Est', 'Est-Sud-Est', 'Sud-Est', 'Sud-Sud-Est', 'Sud', 'Sud-Sud-Ouest', 'Sud-Ouest', 'Ouest-Sud-Ouest', 'Ouest', 'Ouest-Nord-Ouest', 'Nord-Ouest', 'Nord-Nord-Ouest'];

/**
 * Anticyclone (décision du 10/11/2026) : il peut apparaître pendant la traversée, deux fois moins souvent qu'un
 * front, une fois par course au plus. Annoncé à l'avance, il s'installe un peu en avant de la flotte, sur la route.
 */
function creerAnticyclone(d: Donnees, etat: EtatPartie, r: ReglesFronts, textes: string[]) {
  const a = d.regles.anticyclone;
  if (!a) return;
  const existe = etat.fronts.some((f) => f.type === 'anticyclone');
  const crees = etat.anticyclonesCrees ?? 0;
  const actifs = etat.bateaux.filter((b) => !b.arrive && !b.horsClassement);
  if (existe || crees >= a.max_par_course || etat.tour < r.tour_min || !actifs.length || alea(etat) >= r.probabilite * a.rapport_fronts) return;
  const c = d.classes.find((x) => x.id === etat.params.classe);
  const v = c?.vitesse ?? 1;
  const cx = actifs.reduce((s, b) => s + b.x, 0) / actifs.length;
  const cy = actifs.reduce((s, b) => s + b.y, 0) / actifs.length;
  // En avant de la flotte, vers le sud-ouest (la route des Antilles), à environ un rayon.
  const rx = a.rayons[0] * Math.min(v, 1.8), ry = a.rayons[1] * Math.min(v, 1.8);
  etat.fronts.push({
    id: `anticyclone-${etat.tour}`, type: 'anticyclone', x: cx - rx * 0.9, y: cy + ry * 0.7, vx: a.vitesse[0], vy: a.vitesse[1], rx, ry,
    direction: entier(etat, 8) * 2, force: face(etat, a.forces), bascule: 0, baisse: 0, annonce: Math.max(1, r.annonce_tours), age: 0,
  });
  etat.anticyclonesCrees = crees + 1;
  textes.push(`Bulletin : un anticyclone se forme sur la route, il s'installe dans ${Math.max(1, r.annonce_tours)} tour(s). Calme au centre : mieux vaut le contourner.`);
}

/** Anticyclones permanents de la météo mondiale, posés au départ (12/11/2026). */
export function creerAnticyclonesPermanents(etat: EtatPartie, m: MeteoMondiale) {
  for (const a of m.anticyclones) {
    const force = a.forces[0] + entier(etat, a.forces[1] - a.forces[0] + 1);
    etat.fronts.push({
      id: `anticyclone-${a.nom}-${Math.round(a.x)}`, type: 'anticyclone', nom: a.nom, hemisphere: a.hemisphere, permanent: true, maison: [a.x, a.y],
      x: a.x, y: a.y, vx: 0, vy: 0, rx: a.rx, ry: a.ry, direction: entier(etat, 8) * 2, force, origine: { direction: 0, force },
      bascule: 0, baisse: 0, annonce: 0, age: 0,
    });
  }
}

/**
 * Météo mondiale (12/11/2026, demande du porteur de projet) : les anticyclones permanents bougent un peu autour de leur
 * position moyenne ; les dépressions filent vers l'est et se dissipent ; il en naît de nouvelles en amont des bateaux
 * qui naviguent dans leur bande (vents d'ouest de l'Atlantique nord, mers du Sud), annoncées au bulletin.
 */
function evoluerMeteoMondiale(d: Donnees, etat: EtatPartie, m: MeteoMondiale): string[] {
  const textes: string[] = [];
  etat.fronts = (etat.fronts ?? [])
    .map((f) => {
      if (f.type === 'molle') return { ...f, direction: entier(etat, 8) * 2, force: face(etat, (reglesMolle(d)?.forces ?? [1, 2])) };
      if (f.permanent && f.maison) return { ...f, x: f.maison[0] + entier(etat, 5) - 2, y: f.maison[1] + entier(etat, 3) - 1 };
      const g = { ...f, x: f.x + f.vx, y: f.y + f.vy };
      if (f.annonce > 0) {
        g.annonce = f.annonce - 1;
        if (g.annonce === 0) textes.push(`${f.nom ?? 'Le front'} arrive : vent de secteur ${NOMS[g.direction]} force ${g.force}, puis bascule au secteur ${NOMS[norm(g.direction + g.bascule)]} dans la traîne.`);
      } else g.age = f.age + 1;
      return g;
    })
    .filter((f) => f.type === 'molle' || f.permanent || f.age < (f.duree ?? 4));
  const actifs = etat.bateaux.filter((b) => !b.arrive && !b.horsClassement);
  m.depressions.forEach((p, i) => {
    const [x0, y0, x1, y1] = p.rect;
    const dedans = actifs.filter((b) => b.x >= x0 && b.x <= x1 && b.y >= y0 && b.y <= y1);
    if (!dedans.length || etat.fronts.filter((f) => f.zone === i).length >= p.max || alea(etat) >= p.probabilite) return;
    const t = alea(etat);
    const rayon = p.rayons[0] + (p.rayons[1] - p.rayons[0]) * t;
    const cx = dedans.reduce((s, b) => s + b.x, 0) / dedans.length;
    const cy = dedans.reduce((s, b) => s + b.y, 0) / dedans.length;
    // Elle ne vise pas exactement les bateaux : plus au nord ou plus au sud, d'au plus un rayon.
    const y = Math.max(y0, Math.min(y1, cy + (alea(etat) * 2 - 1) * rayon));
    const direction = face(etat, p.directions), force = face(etat, p.forces);
    etat.fronts.push({
      id: `depression-${etat.tour}-${i}`, type: 'front', nom: p.nom, hemisphere: p.hemisphere, zone: i, duree: p.duree,
      x: cx - p.vx * p.annonce, y, vx: p.vx, vy: 0, rx: rayon, ry: rayon, direction, force, bascule: p.bascule, baisse: p.baisse, annonce: p.annonce, age: 0,
    });
    textes.push(`Bulletin : ${p.nom.toLowerCase()} arrive dans ${p.annonce} tour${p.annonce > 1 ? 's' : ''} ! Vent de ${NOMS[direction]} force ${force} dans le front, puis bascule au secteur ${NOMS[norm(direction + p.bascule)]} force ${Math.max(1, force - p.baisse)} dans la traîne.`);
  });
  return textes;
}
