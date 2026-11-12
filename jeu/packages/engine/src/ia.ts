// Intelligence artificielle (cahier des charges §7). Elle utilise exactement les mêmes règles et les
// mêmes informations qu'un humain : le vent actuel, la tendance affichée, jamais les tirages futurs.
import { distanceRestanteCase, idx } from './carte';
import { ANGLE_MIN, angleAllure, NB_DIR, norm } from './geo';
import { carteDe, demiCapsPermis, enCourse, peutRecoudre, usureParTour } from './moteur';
import { alizeApres, alizeEn, frontSur, ventCourant } from './meteo';
import { calculerDistance, calculerRisque, competence, dansBrume, facesForce, tracerChemin } from './regles';
import { alea } from './rng';
import { desVus } from './apercu';
import type { Choix, ContexteResolution, Donnees, EtatBateau, EtatPartie, PenaliteDef, Vent } from './types';

interface Option {
  cap: number;
  voile: string | null;
}

function occupeesSauf(d: Donnees, etat: EtatPartie, id: string): Set<number> {
  const carte = carteDe(d, etat);
  const s = new Set<number>();
  for (const o of etat.bateaux) if (o.id !== id && enCourse(o) && !dansBrume(carte, o.x, o.y)) s.add(idx(carte, o.x, o.y));
  return s;
}

/** Trajet d'une option (cap et budget en cases), avec les compétences du bateau. */
function cheminOption(d: Donnees, etat: EtatPartie, b: EtatBateau, cap: number, budget: number, occ: Set<number>) {
  const comp = competence(d, b.competence);
  return tracerChemin(carteDe(d, etat), occ, [b.x, b.y], b.porte, cap, budget, {
    traverse: !!comp.speciaux.traverse_bateaux,
    coutBrume: comp.speciaux.cout_brume ?? 2,
    ignoreCourantDefavorable: !!comp.speciaux.ignore_courant_defavorable,
    tour: etat.tour,
    louvoyage: angleAllure(cap, ventCourant(etat, b.x, b.y).direction) < 45,
    ...(b.pos ? { origine: b.pos } : {}),
  });
}

/** Gain de distance (en cases) pour une option et un vent donnés, sans hasard. */
export function gainOption(d: Donnees, etat: EtatPartie, b: EtatBateau, opt: Option, vent: Vent, occ: Set<number>): { gain: number; risque: number; distance: number | null } {
  const carte = carteDe(d, etat);
  const { distance } = calculerDistance(d, carte, b, opt.voile, opt.cap, vent);
  if (distance === null) return { gain: 0, risque: 0, distance: null };
  const { risque } = calculerRisque(d, carte, b, opt.voile, vent);
  const r = cheminOption(d, etat, b, opt.cap, distance, occ);
  const avant = distanceRestanteCase(carte, b.x, b.y, b.porte);
  let apres = r.arrive ? -r.depassement : distanceRestanteCase(carte, r.fin[0], r.fin[1], r.porte);
  // Distance réduite (12/11/2026, idée du porteur de projet) : comme un joueur qui réduit sa distance maximale, l'IA peut
  // s'arrêter au meilleur point de son trajet (avant la côte, au bon endroit pour virer) et repartir au tour suivant.
  if (!r.arrive) {
    let p = b.porte;
    for (const [x, y] of r.chemin) {
      const i = y * carte.L + x;
      while (p < carte.portes.length && carte.portes[p].has(i)) p++;
      if (p < carte.portes.length) apres = Math.min(apres, distanceRestanteCase(carte, x, y, p));
    }
  }
  let gain = avant - apres;
  if (opt.voile === null && r.bloque === 'terre' && r.chemin.length < distance) gain -= 4; // naufrage
  return { gain, risque, distance };
}

function scenariosVent(d: Donnees, etat: EtatPartie, b?: EtatBateau): { vent: Vent; p: number }[] {
  const r = d.regles;
  const vus = desVus(d, etat, b);
  const out: { vent: Vent; p: number }[] = [];
  const base = b ? ventCourant(etat, b.x, b.y) : etat.vent;
  // Dans les alizés (hors front), le vent reste borné : mêmes dés, mais vent régulier.
  const alize = b && !frontSur(etat, b.x, b.y) ? alizeEn(etat, b.x, b.y) : null;
  for (const { v: f, p: pf } of vus.forces)
    for (const { v: dd, p: pd } of vus.directions)
      out.push({
        vent: alize ? alizeApres(alize, dd, f) : { direction: norm(base.direction + dd), force: Math.max(r.force_min, Math.min(r.force_max, base.force + f)) },
        p: pf * pd,
      });
  return out;
}

/** Coût (en cases) de l'usure d'un tour : une voile qui s'use, c'est de la vitesse perdue plus tard. */
function coutUsure(d: Donnees, etat: EtatPartie, b: EtatBateau, v: string | null, force: number): number {
  if (!v) return 0;
  const inc = usureParTour(d, etat, v, force, b.famille);
  const u = b.usure?.[v] ?? 0;
  const seuil = d.regles.usure?.seuil ?? 100;
  const valeur = v === 'spi' || v === 'gennaker' || v === 'code0' ? 6 : 3;
  return (inc / seuil) * valeur * (1 + u / seuil) + (u + inc >= seuil ? valeur : 0);
}

/** Coût probable du dé tempête (immobilisation d'un ou deux tours). */
function coutTempete(d: Donnees, force: number, gain: number): number {
  const faces = d.regles.tempete?.[String(Math.min(11, force))];
  if (force < 9 || !Array.isArray(faces)) return 0;
  return (faces.length / 6) * (Math.max(gain, 4) * 1.5);
}

function coutPenalite(gain: number, b: EtatBateau): number {
  const brut = 0.4 * (gain / 2) + 0.2 * 2.5 + 0.2 * 3.5 + 0.2 * (gain + 1);
  return b.reparations > 0 ? brut * 0.55 : brut;
}

/**
 * Choix de l'IA, avec les mêmes contraintes qu'un humain : uniquement des caps et des voiles utilisables
 * avec le vent ACTUEL (l'IA ne peut pas « parier » sur un cap face au vent en attendant la rotation).
 * L'option `utilisableMaintenant` est conservée pour compatibilité ; la contrainte s'applique toujours.
 */
export function choisirIA(d: Donnees, etat: EtatPartie, bateauId: string, opts: { utilisableMaintenant?: boolean } = {}): Choix {
  const b = etat.bateaux.find((x) => x.id === bateauId)!;
  const occ = occupeesSauf(d, etat, b.id);
  let options: Option[] = [];
  // Demi-caps à l'approche de l'arrivée (11/11/2026) : l'IA les essaie comme un joueur.
  const pas = demiCapsPermis(d, etat, b) ? 0.5 : 1;
  for (let cap = 0; cap < NB_DIR; cap += pas) {
    for (const v of b.voiles) options.push({ cap, voile: v });
    if (b.voiles.length === 0) options.push({ cap, voile: null });
  }
  void opts;
  {
    const carte = carteDe(d, etat);
    options = options.filter((o) => calculerDistance(d, carte, b, o.voile, o.cap, ventCourant(etat, b.x, b.y)).distance !== null);
    if (options.length === 0)
      for (let cap = 0; cap < NB_DIR; cap += pas)
        if (calculerDistance(d, carte, b, null, cap, ventCourant(etat, b.x, b.y)).distance !== null) options.push({ cap, voile: null });
  }
  const niveau = b.niveauIA;
  const pQuiz = etat.params.options.quiz ? (d.regles.ia_quiz_reussite[niveau]?.[String(b.niveauQuiz)] ?? 0.6) : 0;
  let meilleur: Option = options[0];
  let meilleureValeur = -Infinity;

  if (niveau === 'facile') {
    for (const o of options) {
      const { gain } = gainOption(d, etat, b, o, ventCourant(etat, b.x, b.y), occ);
      const v = gain + alea(etat) * 1.5;
      if (v > meilleureValeur) {
        meilleureValeur = v;
        meilleur = o;
      }
    }
  } else {
    const scen = scenariosVent(d, etat, b);
    for (const o of options) {
      let esperance = 0;
      for (const s of scen) {
        const { gain, risque, distance } = gainOption(d, etat, b, o, s.vent, occ);
        if (distance === null) continue;
        let v: number;
        if (risque >= 5) v = -(b.reparations > 0 ? 1.2 : 2.5);
        else if (d.regles.usure) {
          // Règles du 10/11/2026 : le risque pris se paie en usure de la voile (perdue au seuil), et la tempête
          // (F9 et plus) peut démâter ou faire chavirer.
          v = gain - coutUsure(d, etat, b, o.voile, s.vent.force) - coutTempete(d, s.vent.force, gain);
        } else {
          const pEvt = risque > 0 ? d.regles.seuil_risque[risque] / 6 : 0;
          v = gain - pEvt * (1 - pQuiz) * coutPenalite(gain, b);
        }
        esperance += s.p * v;
      }
      if (esperance > meilleureValeur + 1e-9) {
        meilleureValeur = esperance;
        meilleur = o;
      }
    }
  }
  const choix: Choix = { cap: meilleur.cap, voile: meilleur.voile, distanceMax: null };
  // Distance maximale : avec le vent actuel, s'arrêter là où il reste le moins à parcourir (sinon : le maximum).
  {
    const carte = carteDe(d, etat);
    const dist = calculerDistance(d, carte, b, meilleur.voile, meilleur.cap, ventCourant(etat, b.x, b.y)).distance;
    if (dist && dist > 1) {
      const reste = (k: number) => {
        const r = cheminOption(d, etat, b, meilleur.cap, k, occ);
        return r.arrive ? -r.depassement : distanceRestanteCase(carte, r.fin[0], r.fin[1], r.porte);
      };
      const plein = reste(dist);
      let kMieux = dist, vMieux = plein;
      for (let k = 1; k < dist; k++) {
        const v = reste(k);
        if (v < vMieux - 1e-9) { vMieux = v; kMieux = k; }
      }
      if (kMieux < dist && vMieux < plein - 0.5) choix.distanceMax = kMieux;
    }
  }
  if (peutRecoudre(d, etat, b)) choix.recoudre = b.voilesPerdues[0];
  return choix;
}

export function decisionRelanceIA(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution): boolean {
  const choix = b.choix!;
  const vent = ctx.ventLocal!;
  if (angleAllure(choix.cap!, vent.direction) < ANGLE_MIN) return true;
  const carte = carteDe(d, etat);
  if (calculerDistance(d, carte, b, choix.voile, choix.cap!, vent).distance === null) return true;
  return calculerRisque(d, carte, b, choix.voile, vent).risque >= 4;
}

export function decisionReparationIA(b: EtatBateau, motif: 'voile_noire' | 'penalite', p: PenaliteDef['id'] | null): boolean {
  if (b.reparations <= 0) return false;
  if (motif === 'voile_noire') return true;
  if (p === 'passe' || p === 'perte_voile') return true;
  return b.reparations >= 2;
}
