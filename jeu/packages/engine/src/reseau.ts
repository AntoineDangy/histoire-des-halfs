// Protocole du jeu en réseau (partagé par le serveur de salons et le client).
// Le serveur est l'arbitre : il applique les actions avec le moteur et renvoie à chaque joueur
// un état « masqué » (les choix secrets des autres ne sont pas révélés avant le jet des dés).
import type { Action, EtatPartie, NiveauIA, OptionsPartie } from './types';

export interface ReglagesSalon {
  nbBateaux: number;
  /** Classe de la course (IMOCA par défaut). */
  classe?: string;
  /** Course jouée (route-du-rhum par défaut). */
  courseId?: string;
  niveauIA: NiveauIA;
  options: OptionsPartie;
  delaiQuiz: number;
}

/** Niveau des questions de culture marine : 1 Moussaillon, 2 Skipper, 3 Vieux loup de mer. */
export type NiveauQuiz = 1 | 2 | 3;

export interface JoueurSalon {
  nom: string;
  skipperId: string | null;
  connecte: boolean;
  hote: boolean;
  /** Bateau attribué une fois la course lancée. */
  bateauId: string | null;
  /** Niveau de ses questions, choisi par chaque joueur avant le départ (12/11/2026). Absent (anciens salons) : 2. */
  niveauQuiz?: NiveauQuiz;
}

/** Niveau des questions si le joueur n'en a pas choisi : Skipper, comme avant le 12/11/2026. */
export const NIVEAU_QUIZ_DEFAUT: NiveauQuiz = 2;

/** Niveau reçu d'un joueur (message réseau), ramené à un niveau connu. */
export function niveauQuizValide(n: unknown): NiveauQuiz | null {
  return n === 1 || n === 2 || n === 3 ? n : null;
}

export interface VueSalon {
  code: string;
  statut: 'salon' | 'course';
  reglages: ReglagesSalon;
  joueurs: JoueurSalon[];
  maxHumains: number;
  /**
   * Temps restant (ms) avant que le serveur ne joue pour les joueurs attendus : le routeur choisit leur cap et leur voile,
   * ou la réponse par défaut est jouée (13/11/2026, audit C2). Absent : personne n'est attendu.
   */
  echeanceDans?: number | null;
}

/**
 * Délais du serveur (13/11/2026, audit C2, PROVISOIRES, à valider par le porteur de projet) : au-delà, le routeur choisit
 * le cap et la voile du joueur pour ce tour ; pour une décision, la réponse par défaut est jouée (question : temps écoulé ;
 * relance : on garde le vent ; carte réparation : choix de l'IA). Le délai du choix compte aussi l'animation du tour.
 */
export const DELAI_CHOIX_S = 150;
export const DELAI_DECISION_S = 90;

export type MessageClient =
  /** niveauQuiz : niveau mémorisé par l'appareil, pris seulement à la première arrivée dans le salon. */
  | { t: 'rejoindre'; jeton: string; nom: string; niveauQuiz?: NiveauQuiz; ping?: boolean }
  | { t: 'skipper'; skipperId: string }
  | { t: 'niveauQuiz'; niveau: NiveauQuiz }
  | { t: 'reglages'; reglages: ReglagesSalon }
  | { t: 'lancer' }
  | { t: 'action'; action: Action }
  | { t: 'confierIA'; bateauId: string };

export type MessageServeur =
  | { t: 'salon'; salon: VueSalon; moi: number }
  | { t: 'etat'; etat: EtatPartie; moi: string | null; ontChoisi: string[] }
  | { t: 'erreur'; message: string };

export const MAX_HUMAINS = 4;

/** État envoyé à un joueur : les choix des autres bateaux et les dés à venir sont cachés. */
export function masquerEtat(
  etat: EtatPartie,
  moi: string | null,
  voitForce: boolean,
  prevoit: { force: boolean; direction: boolean } = { force: false, direction: false },
): { etat: EtatPartie; ontChoisi: string[] } {
  const e: EtatPartie = structuredClone(etat);
  const ontChoisi = e.phase === 'choix' ? e.bateaux.filter((b) => b.choix !== null).map((b) => b.id) : [];
  if (e.phase === 'choix') for (const b of e.bateaux) if (b.id !== moi) b.choix = null;
  if (e.desProchains) e.desProchains = voitForce ? { force: e.desProchains.force, direction: 0 } : null;
  // Prévisions (Navigateur : force, Météorologue : direction, 12/11/2026) : envoyées au seul skipper qui les fait.
  if (e.previsions) e.previsions = prevoit.force || prevoit.direction ? { force: prevoit.force ? e.previsions.force : 0, direction: prevoit.direction ? e.previsions.direction : 0 } : null;
  return { etat: e, ontChoisi };
}
