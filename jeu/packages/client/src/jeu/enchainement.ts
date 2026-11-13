// Enchaînement d'un tour à l'écran (audit du 13/11/2026, jeu/conception/audit-enchainement.md, validé par le porteur de
// projet) : l'écran raconte le tour dans l'ordre du calcul, une étape annoncée après l'autre, chaque décision à son
// moment et une seule fois, en solo comme en même écran et en réseau.
import { ventCourant } from '@cal/engine';
import type { Attente, EtatPartie, Evenement, Vent } from '@cal/engine';

/**
 * Vent du joueur à l'instant que montre l'écran (girouette sur la carte et légende du bateau 3D : toujours les mêmes, bug
 * signalé par le porteur de projet le 13/11/2026 ; règle du 12/11/2026 : le vent de la zone où se trouve le joueur).
 * Pendant la lecture d'un tour : le vent de sa zone avant les dés, puis après les dés, puis celui de son départ (relance
 * comprise). Animation finie : le vent à sa position actuelle. `curseur` : nombre d'événements déjà montrés.
 */
export function ventDuJoueur(etat: EtatPartie, curseur: number, id: string | null | undefined): Vent {
  const b = id ? etat.bateaux.find((x) => x.id === id) : undefined;
  const evs = etat.evenements;
  if (!b) return etat.vent;
  if (curseur >= evs.length) return ventCourant(etat, b.x, b.y);
  const tour = evs[curseur].tour;
  for (let i = curseur - 1; i >= 0 && evs[i].tour === tour; i--) {
    const e = evs[i];
    if ((e.type === 'debut' || e.type === 'relance') && e.bateauId === id) {
      const v = (e.donnees as { vent?: Vent } | undefined)?.vent;
      if (v) return v;
    }
    if (e.type === 'vent') {
      const d = e.donnees as { apres?: Vent; locaux?: Record<string, { apres: Vent }> } | undefined;
      const v = d?.locaux?.[id!]?.apres ?? d?.apres;
      if (v) return v;
    }
  }
  // Rien de ce tour n'est encore montré : le vent de sa zone avant les dés.
  for (let i = curseur; i < evs.length && evs[i].tour === tour; i++) {
    if (evs[i].type !== 'vent') continue;
    const d = evs[i].donnees as { avant?: Vent; locaux?: Record<string, { avant: Vent }> } | undefined;
    const v = d?.locaux?.[id!]?.avant ?? d?.avant;
    if (v) return v;
  }
  return ventCourant(etat, b.x, b.y);
}

export type EtapeTour = 'vent' | 'voiles' | 'large' | 'course' | 'fin';

export const NOM_ETAPE: Record<EtapeTour, string> = {
  vent: 'Le vent',
  voiles: 'Les voiles',
  large: 'Le large',
  course: 'La course',
  fin: 'Fin du tour',
};

const RANG: EtapeTour[] = ['vent', 'voiles', 'large', 'course', 'fin'];

/** Étape que marque un événement (null : il ne change pas d'étape, il suit celui d'avant). */
function etapeDe(e: Evenement): EtapeTour | null {
  switch (e.type) {
    case 'vent':
    case 'relance':
      return 'vent';
    case 'bloque':
    case 'voile_perdue':
    case 'jet_risque':
    case 'tempete':
    case 'demate':
      return 'voiles';
    case 'de_evenement':
    case 'carte_evenement':
    case 'quiz':
      return 'large';
    case 'debut':
    case 'passe':
    case 'abri':
    case 'deplacement':
    case 'port':
    case 'collision':
    case 'naufrage':
    case 'a_vue':
      return 'course';
    case 'arrivee':
      return (e.donnees as { ligne?: string[] } | undefined)?.ligne ? 'fin' : 'course';
    case 'depassement':
    case 'fin':
      return 'fin';
    default:
      return null;
  }
}

/**
 * Étape du tour où en est la lecture de l'événement `i` : la plus avancée rencontrée depuis le début de son tour (une
 * voile perdue pendant la course reste « La course »). Null avant le jet du vent (événements du choix).
 */
export function etapeDuTour(evs: Evenement[], i: number): EtapeTour | null {
  const tour = evs[i]?.tour;
  if (tour === undefined) return null;
  let debut = i;
  while (debut > 0 && evs[debut - 1].tour === tour) debut--;
  let rang = -1;
  for (let j = debut; j <= i; j++) {
    const e = etapeDe(evs[j]);
    if (e) rang = Math.max(rang, RANG.indexOf(e));
  }
  return rang < 0 ? null : RANG[rang];
}

/** Identité d'une décision attendue : une réponse envoyée ne fait pas réapparaître la même fenêtre en attendant le serveur. */
export function cleAttente(etat: EtatPartie): string | null {
  const a = etat.attente;
  return a ? `${etat.evenements.length}:${a.type}:${a.bateauId}` : null;
}

/**
 * Décision à montrer maintenant : seulement quand l'animation est arrivée au moment de la décision (fin des événements
 * connus), pour le joueur de cet écran en réseau, et une seule fois (pas celle à laquelle on vient de répondre).
 * Avant le 13/11/2026, en réseau, elle s'affichait d'avance (audit C1) : la carte du large apparaissait alors deux fois.
 */
export function attenteAMontrer(etat: EtatPartie, curseur: number, reseau: { moi: string | null } | null, envoyee: string | null): Attente | null {
  const a = etat.attente;
  if (!a || curseur < etat.evenements.length) return null;
  if (reseau && a.bateauId !== reseau.moi) return null;
  if (cleAttente(etat) === envoyee) return null;
  return a;
}

/** Ce que les IA ont fait au large pendant ce tour (cartes et questions), en une phrase ; null si rien. */
export function recapIA(etat: EtatPartie, tour: number): string | null {
  const ia = new Set(etat.bateaux.filter((b) => b.type === 'ia').map((b) => b.id));
  const evs = etat.evenements.filter((e) => e.tour === tour && e.bateauId && ia.has(e.bateauId));
  const cartes = evs.filter((e) => e.type === 'carte_evenement').map((e) => e.texte.replace(/\.$/, ''));
  const questions = evs.filter((e) => e.type === 'quiz');
  const justes = questions.filter((e) => e.texte.includes('répond juste')).length;
  const parts: string[] = [];
  if (cartes.length) parts.push(cartes.join(', '));
  if (questions.length) parts.push(`${questions.length} question${questions.length > 1 ? 's' : ''} (${justes} juste${justes > 1 ? 's' : ''})`);
  return parts.length ? `Les IA au large : ${parts.join(' ; ')}.` : null;
}
