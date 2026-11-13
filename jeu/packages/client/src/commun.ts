import { donneesBrutes } from '@cal/data';
import { competence } from '@cal/engine';
import type { Donnees, NiveauIA, OptionsPartie, ParticipantParams } from '@cal/engine';

export const D = donneesBrutes as unknown as Donnees;

/** Faces du dé du large, selon la configuration (regles.json : 4-5-6 carte, 2-3 question, 1 rien depuis le 11/11/2026). */
export const DE_LARGE = (() => {
  const r = D.regles.de_du_large ?? { carte: [4, 5, 6], question: [2, 3] };
  return { carte: r.carte, question: r.question, rien: [1, 2, 3, 4, 5, 6].filter((n) => !r.carte.includes(n) && !r.question.includes(n)) };
})();
/** « 4, 5 ou 6 ». */
export const faces = (l: number[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} ou ${l[l.length - 1]}` : String(l[0] ?? '—'));

/** Textes d'interface partagés (préparation à l'internationalisation, §0.5). */
export const RISQUES = [
  { couleur: 'var(--r0)', texte: '#04121f', icone: '○', libelle: 'Aucun risque', court: 'Nul' },
  { couleur: 'var(--r1)', texte: '#04121f', icone: '◔', libelle: 'Risque faible (dé 1–2)', court: 'Faible' },
  { couleur: 'var(--r2)', texte: '#04121f', icone: '◑', libelle: 'Risque modéré (dé 1–3)', court: 'Modéré' },
  { couleur: 'var(--r3)', texte: '#04121f', icone: '◕', libelle: 'Risque élevé (dé 1–4)', court: 'Élevé' },
  { couleur: 'var(--r4)', texte: '#04121f', icone: '●', libelle: 'Risque très élevé (dé 1–5)', court: 'Très élevé' },
  { couleur: 'var(--r5)', texte: '#ffffff', icone: '✖', libelle: 'Casse assurée', court: 'Casse' },
];

export const NIVEAUX_QUIZ = ['', 'Moussaillon', 'Skipper', 'Vieux loup de mer'];
export const NIVEAUX_IA: Record<NiveauIA, string> = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

export interface Humain {
  nom: string;
  niveauQuiz: 1 | 2 | 3;
}

export interface Reglages {
  mode: 'solo' | 'meme_ecran';
  humains: Humain[];
  niveauIA: NiveauIA;
  options: OptionsPartie;
  delaiQuiz: number;
  vue3d: boolean;
  /** Nombre total de bateaux en course (humains + IA), de 2 à 10. */
  nbBateaux?: number;
  /** Classe de la course (IMOCA, ULTIM, OCEAN_FIFTY, CLASS40). */
  classe?: string;
  /** Course jouée (route-du-rhum par défaut). */
  courseId?: string;
}

export const REGLAGES_DEFAUT: Reglages = {
  mode: 'solo',
  humains: [{ nom: 'Joueur 1', niveauQuiz: 1 }],
  niveauIA: 'moyen',
  options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  delaiQuiz: 20,
  vue3d: true,
  classe: 'IMOCA',
};

/** Skippers d'une classe (chaque partie se court dans une seule classe). */
export function skippersDe(classe: string | undefined) {
  return D.skippers.filter((s) => s.classe === (classe ?? 'IMOCA'));
}

/** Course de la partie en cours : les écrans qui convertissent des cases en milles la consultent. */
let courseActive = 'route-du-rhum';
export function definirCourseActive(id: string) {
  courseActive = id;
}
/** Milles par case et par unité de vitesse de la course en cours (Fastnet : 2,55 milles par case ; Atlantique : 30). */
export function millesParCase(): number {
  return courseDef(courseActive).milles_par_case ?? 1;
}
export function millesParUnite(): number {
  const c = courseDef(courseActive);
  return (c.echelle ?? 1) * (c.milles_par_case ?? 1);
}

/** Course choisie dans les réglages. */
export function courseDef(id: string | undefined) {
  return D.courses.find((c) => c.id === (id ?? 'route-du-rhum')) ?? D.courses[0];
}

/** Classes jouables sur une course (la Route du Rhum est ouverte à toutes les classes du jeu). */
export function classesDe(courseId: string | undefined) {
  const c = courseDef(courseId);
  return c.id === 'route-du-rhum' ? D.classes : D.classes.filter((k) => c.classes_autorisees.includes(k.id));
}

/**
 * Nombre de tours estimé : celui d'une Route du Rhum dans la classe (décision du 09/11/2026), au prorata de la
 * distance officielle du parcours de la classe (Route du Rhum : 3 542 milles).
 */
export function toursEstimes(courseId: string | undefined, classe: string | undefined): number {
  const mesure = courseDef(courseId).tours_estimes?.[classe ?? 'IMOCA'];
  if (mesure) return mesure;
  const base = D.classes.find((c) => c.id === (classe ?? 'IMOCA'))?.tours_moyens ?? 10;
  const dist = courseDef(courseId).distances_officielles?.[classe ?? 'IMOCA'];
  return dist ? Math.round((base * dist) / 3542) : base;
}

export function nomClasse(classe: string | undefined): string {
  return D.classes.find((c) => c.id === (classe ?? 'IMOCA'))?.nom ?? 'IMOCA';
}

export interface Lancement {
  reglages: Reglages;
  participants: ParticipantParams[];
  graine: number;
  /** Course d'initiation guidée (écran E9). */
  tutoriel?: boolean;
}

export function lireStockage<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v ? { ...defaut, ...JSON.parse(v) } : defaut;
  } catch {
    return defaut;
  }
}

export function ecrireStockage(cle: string, v: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

export function skipper(id: string) {
  return D.skippers.find((s) => s.id === id)!;
}
export function bateauDef(id: string) {
  return D.bateaux.find((b) => b.id === id)!;
}
export function familleDef(id: string) {
  return D.familles.find((f) => f.id === id)!;
}
/** Compétence d'un marin, ou d'un équipage en double (« a+b » : les deux compétences additionnées). */
export function competenceDef(id: string) {
  return competence(D, id);
}

/** Position affichée d'un bateau : le point exact où il s'est arrêté (11/11/2026), sinon sa case. */
export function posExacte(b: { x: number; y: number; pos?: [number, number] }): [number, number] {
  return b.pos && Math.floor(b.pos[0]) === b.x && Math.floor(b.pos[1]) === b.y ? [b.pos[0] - 0.5, b.pos[1] - 0.5] : [b.x, b.y];
}

/**
 * Courses proposées au joueur. Les tours du monde (Vendée Globe, Arkéa Ultim Challenge) restent en essai : jouables
 * en local seulement, retirés de la version en ligne (12/11/2026, demande du porteur de projet).
 */
export const COURSES_PROPOSEES = D.courses.filter((c) => import.meta.env.DEV || !c.distance_reelle);
