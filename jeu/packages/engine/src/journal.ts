// Journal des mouvements (bêta) : une ligne par bateau et par tour, avec tout ce qui a servi au calcul,
// et des contrôles automatiques qui signalent les incohérences (distance, terre traversée, saut de case…).
import { CarteCompilee, diagonaleLibre, navigable } from './carte';
import { carteDe } from './moteur';
import type { Case, Donnees, EtatPartie, Vent } from './types';

export interface LigneJournal {
  tour: number;
  bateauId: string;
  skipper: string;
  type: 'humain' | 'ia';
  /** Position au début du tour et à la fin du tour (cases). */
  de: Case;
  vers: Case;
  cap: number | null;
  voile: string | null;
  /** Vent au moment du choix, à la position du bateau, et distance annoncée par le tableau de bord. */
  ventChoix: Vent | null;
  distancePrevue: number | null;
  /** Vent après les dés (et relance éventuelle), là où est le bateau. */
  ventApres: Vent | null;
  /** D'où vient le vent du bateau : vent général, alizé, front, traîne ou molle. */
  zoneVent?: 'général' | 'alizé' | 'front' | 'traine' | 'molle';
  relance: boolean;
  louvoyage: boolean;
  /** Distance calculée avec le vent après les dés (cases), avant cartes, risque et pénalités. */
  distanceDes: number | null;
  carte: string | null;
  risque: number | null;
  penalite: string | null;
  distanceMax: number | null;
  /** Distance réellement autorisée au moment de bouger (cases), après tous les effets. */
  budget: number | null;
  chemin: Case[];
  /** Distance parcourue à vol d'oiseau (cases). */
  parcourue: number;
  bloque: string | null;
  courant: boolean;
  arrive: boolean;
  /** Ce qui s'est passé : déplacement, passe son tour, case noire… */
  issue: string;
}

export interface Anomalie {
  code: 'depasse_budget' | 'terre' | 'saut' | 'coin' | 'non_parcouru' | 'immobile_sans_raison';
  texte: string;
}

const TOLERANCE = 1; // arrondis de la ligne droite sur la grille

/** Contrôle une ligne du journal : retourne les incohérences trouvées (vide si tout va bien). */
export function controlerJournal(d: Donnees, etat: EtatPartie, l: LigneJournal, carte?: CarteCompilee): Anomalie[] {
  const c = carte ?? carteDe(d, etat);
  const out: Anomalie[] = [];
  const mpc = c.course.milles_par_case ?? 1;
  const mn = (x: number) => `${Math.round(x * mpc)} mn`;
  if (l.budget !== null && l.issue !== 'recul' && !/port|priorité|collision/.test(l.issue)) {
    // + 1 case : le bateau part et s'arrête à sa position exacte dans la case, pas au centre (11/11/2026).
    const marge = TOLERANCE + 1 + (l.courant ? Math.SQRT2 : 0);
    if (l.parcourue > l.budget + marge)
      out.push({ code: 'depasse_budget', texte: `a parcouru ${mn(l.parcourue)} pour ${mn(l.budget)} autorisés` });
    if (!l.bloque && !l.arrive && l.parcourue + marge + 0.5 < l.budget && !l.chemin.some((k) => c.zones[k[1] * c.L + k[0]].includes('brume')))
      out.push({ code: 'non_parcouru', texte: `n'a parcouru que ${mn(l.parcourue)} sur ${mn(l.budget)} sans obstacle` });
  }
  let prec = l.de;
  for (const k of l.chemin) {
    if (!navigable(c, k[0], k[1])) out.push({ code: 'terre', texte: `traverse une case de terre ou interdite (${k[0]}, ${k[1]})` });
    if (Math.max(Math.abs(k[0] - prec[0]), Math.abs(k[1] - prec[1])) > 1) out.push({ code: 'saut', texte: `saute de (${prec[0]}, ${prec[1]}) à (${k[0]}, ${k[1]})` });
    else if (!diagonaleLibre(c, prec[0], prec[1], k[0], k[1])) out.push({ code: 'coin', texte: `coupe un coin de terre en (${k[0]}, ${k[1]})` });
    prec = k;
  }
  const fin = l.chemin.length ? l.chemin[l.chemin.length - 1] : l.de;
  const auPort = /port/.test(l.issue);
  if (!auPort && (fin[0] !== l.vers[0] || fin[1] !== l.vers[1]))
    out.push({ code: 'saut', texte: `position finale (${l.vers[0]}, ${l.vers[1]}) différente de la fin du trajet (${fin[0]}, ${fin[1]})` });
  // Avec une seule case d'avance, le bateau peut avancer à l'intérieur de sa case sans en sortir : il repart de sa position
  // exacte (11/11/2026). Ce n'est une anomalie qu'à partir de 2 cases (cas rencontré le 12/11/2026 : avarie réparée, 3 → 1).
  if (l.issue === 'déplacement' && l.parcourue === 0 && !l.bloque && (l.budget ?? 0) >= 2)
    out.push({ code: 'immobile_sans_raison', texte: 'reste sur place sans raison' });
  return out;
}

