// Guide du tutoriel « Ma première course » (décision du propriétaire, 14/11/2026 : « dans le tutoriel, le guide, dans
// l'onglet des règles, le petit film »). Logique pure, testée (client/test/tutoriel.test.ts) : ce que le guide montre
// selon le moment de la partie. Scénario : jeu/conception/tutoriel-anime.md. Règle du 14/11/2026 : à l'écran, le strict
// minimum, quelques mots ; le détail reste dans les règles.
import { apercuCap, choisirIA, trajectoirePrevue } from '@cal/engine';
import type { Donnees, EtatBateau, EtatPartie } from '@cal/engine';

/** Zone de l'écran éclairée par le guide. */
export type CibleGuide = 'vent' | 'mer' | 'voiles' | 'valider';
/** Les cinq temps d'un tour, dans la frise. */
export type EtapeFrise = 'choix' | 'vent' | 'voiles' | 'large' | 'course';

export interface ContexteGuide {
  /** Tour montré à l'écran (pendant l'animation, celui de l'événement lu). */
  tour: number;
  /** Le joueur choisit son cap et sa voile. */
  choix: boolean;
  /** Un cap ou une destination est choisi. */
  destination: boolean;
  /** Étape du tour pendant l'animation (null pendant le choix). */
  etape: EtapeFrise | null;
  /** Course finie. */
  fini: boolean;
  /** Pour les petits conseils, après le guide. */
  frontAnnonce: boolean;
  tempete: boolean;
  voileUsee: boolean;
}

export interface EtatGuide {
  /** Pas du premier tour (0 : vent, 1 : mer, 2 : voiles, 3 : valider). */
  pas: number;
  /** Guide fini (« Continuer la course » ou « Passer ») : il ne reste que les petits conseils. */
  termine: boolean;
}

export type VueGuide =
  | { type: 'projecteur'; cible: CibleGuide; texte: string; main: boolean; ok: boolean }
  | { type: 'bulle'; texte: string }
  | { type: 'frise'; etape: EtapeFrise }
  | { type: 'bravo' }
  | null;

/** Tours guidés : le premier geste par geste, le deuxième seul ; au troisième, « Bravo ». */
export const TOURS_GUIDES = 2;

export const ETAPES_FRISE: { id: EtapeFrise; icone: string; nom: string }[] = [
  { id: 'choix', icone: '👆', nom: 'Choisis' },
  { id: 'vent', icone: '🎲', nom: 'Le vent' },
  { id: 'voiles', icone: '⛵', nom: 'Les voiles' },
  { id: 'large', icone: '🎡', nom: 'Le large' },
  { id: 'course', icone: '➜', nom: 'Ça avance' },
];

export const PAS_GUIDE: { cible: CibleGuide; texte: string; main: boolean; ok: boolean }[] = [
  { cible: 'vent', texte: 'Le vent : sa direction et sa force.', main: false, ok: true },
  { cible: 'mer', texte: 'Touche la mer ici.', main: true, ok: false },
  { cible: 'voiles', texte: 'Ta voile est déjà choisie.', main: false, ok: true },
  { cible: 'valider', texte: 'Valider !', main: true, ok: false },
];

/**
 * Pas montré au premier tour : sans cap choisi, on en reste au vent ou à la mer ; dès qu'un cap est choisi (même avant
 * d'y être invité), on passe aux voiles.
 */
export function pasEffectif(pas: number, destination: boolean): number {
  return destination ? Math.max(pas, 2) : Math.min(pas, 1);
}

export function vueDuGuide(c: ContexteGuide, g: EtatGuide): VueGuide {
  if (g.termine || c.fini) return null;
  if (c.choix) {
    if (c.tour <= 1) return { type: 'projecteur', ...PAS_GUIDE[pasEffectif(g.pas, c.destination)] };
    if (c.tour <= TOURS_GUIDES) return c.destination ? null : { type: 'bulle', texte: 'À toi : même geste !' };
    return { type: 'bravo' };
  }
  if (c.tour <= TOURS_GUIDES && c.etape) return { type: 'frise', etape: c.etape };
  return null;
}

/** Petits conseils d'une ligne, une seule fois chacun, après le guide et seulement pendant le choix. */
export type Astuce = 'tempete' | 'front' | 'usure';
export const TEXTES_ASTUCES: Record<Astuce, string> = {
  tempete: 'Tempête : ton mât peut casser !',
  front: 'Un front arrive : gros vent !',
  usure: 'Ta voile est usée : regarde la jauge.',
};

export function astuceDuMoment(c: ContexteGuide, g: EtatGuide, vues: ReadonlySet<Astuce>): Astuce | null {
  if (!g.termine || !c.choix || c.fini) return null;
  const candidates: [Astuce, boolean][] = [['tempete', c.tempete], ['front', c.frontAnnonce], ['usure', c.voileUsee]];
  return candidates.find(([a, oui]) => oui && !vues.has(a))?.[0] ?? null;
}

/** Force à partir de laquelle c'est la tempête (dé de tempête, regles.json). */
export function forceTempete(d: Pick<Donnees, 'regles'>): number {
  const forces = Object.keys(d.regles.tempete ?? {}).map(Number).filter((n) => Number.isFinite(n));
  return forces.length ? Math.min(...forces) : 9;
}

/** Une voile du bateau usée aux trois quarts ou plus. */
export function voileUsee(d: Pick<Donnees, 'regles'>, b: Pick<EtatBateau, 'voiles' | 'usure'>): boolean {
  const seuil = d.regles.usure?.seuil ?? 100;
  return b.voiles.some((v) => (b.usure?.[v] ?? 0) >= 0.75 * seuil);
}

/** Point montré par le guide sur la carte : coordonnées de carte et cap qui y mène. */
export interface RepereGuide { pt: [number, number]; cap: number }

/**
 * Point de mer montré au premier tour (« Touche la mer ici ») : le bout de la route que choisirait le routeur, route
 * libre, en coordonnées de carte (cases, centre d'une case à +0,5), avec son cap (la carte pose le repère sur la
 * couronne de la boussole quand ce point est trop près du bateau pour être touché).
 */
export function repereDuGuide(d: Donnees, etat: EtatPartie, bateauId: string): RepereGuide | null {
  const c = choisirIA(d, structuredClone(etat), bateauId, { utilisableMaintenant: true });
  if (c.cap === null || c.voile === null) return null;
  const v = apercuCap(d, etat, bateauId, c.cap).voiles.find((x) => x.voile === c.voile);
  const dist = Math.min(v?.distance ?? 0, c.distanceMax ?? Infinity);
  if (!dist) return null;
  const t = trajectoirePrevue(d, etat, bateauId, c.cap, dist);
  const der = t.chemin[t.chemin.length - 1];
  const pt: [number, number] | null = t.sommets && t.sommets.length > 1 ? t.sommets[t.sommets.length - 1] : der ? [der[0] + 0.5, der[1] + 0.5] : null;
  return pt ? { pt, cap: c.cap } : null;
}
