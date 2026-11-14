// Aperçu pour le tableau de bord (§10b.3) : distance, risque et trajectoire d'un choix avec le vent
// ACTUEL, plus l'indicateur « si le vent tourne » (−45°, 0°, +45°). Aucun hasard, aucun effet de bord.
import { idx } from './carte';
import { angleAllure, norm } from './geo';
import { alizeApres, alizeEn, ventCourant } from './meteo';
import { bateau, carteDe, enCourse } from './moteur';
import { calculerDistance, calculerRisque, competence, dansBrume, Detail, facesForce, tracerChemin } from './regles';
import type { Case, Donnees, EtatBateau, EtatPartie } from './types';

/**
 * La tendance du bulletin (rotation probable du vent) n'est connue que d'un skipper qui a une
 * compétence météo (le Météorologue, ou toute compétence marquée « voit_tendance »).
 */
export function voitTendance(d: Donnees, b: EtatBateau | undefined): boolean {
  if (!b) return false;
  const c = competence(d, b.competence);
  return c.id === 'meteorologue' || !!(c.speciaux as Record<string, unknown>).voit_tendance;
}

/** Faces du dé de direction telles que ce skipper peut les estimer : biaisées par la tendance seulement s'il la connaît. */
export function facesDirectionConnues(d: Donnees, etat: EtatPartie, b: EtatBateau | undefined): number[] {
  const r = d.regles;
  return voitTendance(d, b) ? (r.de_direction_tendance[String(etat.tendance)] ?? r.de_direction) : r.de_direction;
}

/** Répartition d'une liste de faces de dé : valeur → probabilité. */
function repartition(faces: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const f of faces) m.set(f, (m.get(f) ?? 0) + 1 / faces.length);
  return m;
}

/** Une prévision juste avec la probabilité p : la valeur prévue garde p, les autres se partagent le reste. */
function selonPrevision(m: Map<number, number>, prevue: number, p: number): { v: number; p: number }[] {
  const reste = 1 - (m.get(prevue) ?? 0);
  return [...m.entries()].map(([v, q]) => ({ v, p: v === prevue ? p : reste > 0 ? ((1 - p) * q) / reste : 0 })).filter((x) => x.p > 0);
}

/**
 * Dés de vent à venir tels que les voit un skipper : la force exacte (ancien Navigateur), une prévision qui peut se
 * tromper (Navigateur pour la force, Météorologue pour la direction, 12/11/2026), ou seulement les faces des dés.
 */
export function desVus(d: Donnees, etat: EtatPartie, b: EtatBateau | undefined): { forces: { v: number; p: number }[]; directions: { v: number; p: number }[] } {
  const sp = b ? competence(d, b.competence).speciaux : {};
  const mf = repartition(facesForce(d, etat.vent.force));
  const md = repartition(facesDirectionConnues(d, etat, b as EtatBateau | undefined));
  const forces = sp.voit_de_force && etat.desProchains ? [{ v: etat.desProchains.force, p: 1 }]
    : sp.prevoit_force && etat.previsions ? selonPrevision(mf, etat.previsions.force, sp.prevoit_force)
    : [...mf.entries()].map(([v, p]) => ({ v, p }));
  const directions = sp.prevoit_direction && etat.previsions ? selonPrevision(md, etat.previsions.direction, sp.prevoit_direction)
    : [...md.entries()].map(([v, p]) => ({ v, p }));
  return { forces, directions };
}

export interface ApercuVoile {
  voile: string | null;
  distance: number | null;
  risque: number;
  details: Detail[];
  detailsRisque: Detail[];
  /** Pour −45°, 0°, +45° : distance (null = inutilisable) et risque. */
  siLeVentTourne: { delta: number; distance: number | null; risque: number; angle: number }[];
  /** Risque si le vent forcit au maximum du dé de force (le risque dépend de la force, pas de la direction). */
  risqueSiForcit: number;
  /** Distance moyenne attendue (en cases) une fois lancés les dés de vent et le dé de risque. */
  attendu: number;
  /** Probabilité que les dés de vent mènent à la case noire (voile qui explose). */
  pNoir: number;
}

/**
 * Espérance de distance d'un choix sur toutes les combinaisons des dés de vent (direction, avec la
 * tendance du bulletin, et force ; la force est connue d'un Navigateur), puis du dé de risque
 * (incident sans compter le quiz). C'est le calcul que fait l'IA : l'afficher rend le joueur égal à elle.
 */
export function distanceAttendue(d: Donnees, etat: EtatPartie, bateauId: string, voile: string | null, cap: number): { attendu: number; pNoir: number } {
  const b = bateau(etat, bateauId);
  const carte = carteDe(d, etat);
  const r = d.regles;
  const base = ventCourant(etat, b.x, b.y);
  const { forces, directions } = desVus(d, etat, b);
  const perte: Record<string, number> = { demi: 0.5, perte_voile: 0, passe: 1, recul: 1 };
  const poids = r.penalites.reduce((s, p) => s + p.poids, 0);
  const fracPerdue = r.penalites.reduce((s, p) => s + p.poids * (perte[p.id] ?? 0.5), 0) / (poids || 1);
  let somme = 0;
  let noir = 0;
  let n = 0;
  for (const { v: df, p: pf } of forces)
    for (const { v: dd, p: pd } of directions) {
      const w = pf * pd;
      n += w;
      const vent = { direction: norm(base.direction + dd), force: Math.max(r.force_min, Math.min(r.force_max, base.force + df)) };
      const dist = calculerDistance(d, carte, b, voile, cap, vent).distance;
      if (dist === null) continue;
      const risque = voile ? calculerRisque(d, carte, b, voile, vent, cap).risque : 0;
      if (risque >= 5) {
        noir += w;
        continue;
      }
      const p = risque > 0 ? r.seuil_risque[risque] / 6 : 0;
      somme += w * dist * (1 - p * fracPerdue);
    }
  return { attendu: n ? somme / n : 0, pNoir: n ? noir / n : 0 };
}

export interface ApercuCap {
  cap: number;
  angle: number;
  voiles: ApercuVoile[];
}

export function apercuCap(d: Donnees, etat: EtatPartie, bateauId: string, cap: number): ApercuCap {
  const b = bateau(etat, bateauId);
  const carte = carteDe(d, etat);
  const vent = ventCourant(etat, b.x, b.y);
  const angle = angleAllure(cap, vent.direction);
  const ids: (string | null)[] = d.regles.voiles_depart.filter((v) => b.voiles.includes(v) || b.voilesPerdues.includes(v) || b.voilesDepart.includes(v));
  // Vent le plus fort possible après le dé de force (dans les alizés, la force ne monte que d'un cran, jusqu'à 6).
  const fMax = Math.max(...d.regles.de_force);
  const az = alizeEn(etat, b.x, b.y);
  const ventForcit = az && vent.direction === az.direction && vent.force === az.force
    ? alizeApres(az, 0, fMax)
    : { direction: vent.direction, force: Math.min(d.regles.force_max, vent.force + fMax) };
  const voiles = ids.map((v) => {
    const dist = calculerDistance(d, carte, b, v, cap, vent);
    const risque = calculerRisque(d, carte, b, v, vent, cap);
    const siLeVentTourne = [-2, 0, 2].map((delta) => {
      const vt = { direction: norm(vent.direction + delta), force: vent.force };
      return {
        delta,
        distance: calculerDistance(d, carte, b, v, cap, vt).distance,
        risque: calculerRisque(d, carte, b, v, vt, cap).risque,
        angle: angleAllure(cap, vt.direction),
      };
    });
    const att = dist.distance === null ? { attendu: 0, pNoir: 0 } : distanceAttendue(d, etat, bateauId, v, cap);
    return { voile: v, distance: dist.distance, risque: risque.risque, details: dist.details, detailsRisque: risque.details, siLeVentTourne, risqueSiForcit: calculerRisque(d, carte, b, v, ventForcit, cap).risque, ...att };
  });
  const sec = calculerDistance(d, carte, b, null, cap, vent);
  voiles.push({ voile: null, distance: sec.distance, risque: 0, details: sec.details, detailsRisque: [], siLeVentTourne: [], risqueSiForcit: 0, ...(sec.distance === null ? { attendu: 0, pNoir: 0 } : distanceAttendue(d, etat, bateauId, null, cap)) });
  return { cap, angle, voiles };
}

/** Trajectoire prévisionnelle (pointillés sur la carte) avec le vent actuel. */
export function trajectoirePrevue(d: Donnees, etat: EtatPartie, bateauId: string, cap: number, distance: number): { chemin: Case[]; caseBloquante: Case | null; sommets: [number, number][] } {
  const b = bateau(etat, bateauId);
  const carte = carteDe(d, etat);
  const occ = new Set<number>();
  for (const o of etat.bateaux) if (o.id !== b.id && enCourse(o) && !dansBrume(carte, o.x, o.y)) occ.add(idx(carte, o.x, o.y));
  const comp = competence(d, b.competence);
  const r = tracerChemin(carte, occ, [b.x, b.y], b.porte, cap, distance, {
    traverse: !!comp.speciaux.traverse_bateaux,
    coutBrume: comp.speciaux.cout_brume ?? 2,
    ignoreCourantDefavorable: !!comp.speciaux.ignore_courant_defavorable,
    tour: etat.tour,
    louvoyage: angleAllure(cap, ventCourant(etat, b.x, b.y).direction) < 45,
    origine: b.pos,
  });
  return { chemin: r.chemin, caseBloquante: r.caseBloquante, sommets: r.sommets };
}
