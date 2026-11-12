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

export interface JoueurSalon {
  nom: string;
  skipperId: string | null;
  connecte: boolean;
  hote: boolean;
  /** Bateau attribué une fois la course lancée. */
  bateauId: string | null;
}

export interface VueSalon {
  code: string;
  statut: 'salon' | 'course';
  reglages: ReglagesSalon;
  joueurs: JoueurSalon[];
  maxHumains: number;
}

export type MessageClient =
  | { t: 'rejoindre'; jeton: string; nom: string }
  | { t: 'skipper'; skipperId: string }
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
