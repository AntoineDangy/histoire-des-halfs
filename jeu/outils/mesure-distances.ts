// Diagnostic : compare, pour chaque bateau et chaque tour, la distance PRÉVUE au moment du choix
// (celle qu'affiche le tableau de bord) et la distance réellement parcourue.
// Le « joueur humain » est simulé : il prend le cap et la voile qui avancent le plus vers l'arrivée
// avec le vent affiché, comme le ferait un joueur qui suit l'aperçu.
// Usage : npx tsx outils/mesure-distances.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import {
  appliquer, bateauxAttendus, distanceAttendue, decisionRelanceIA, decisionReparationIA, calculerDistance, carteDe, choisirIA, creerPartie, gainOption, humainsAttendus, ventCourant,
} from '../packages/engine/src/index';
import type { Choix, Donnees, EtatPartie } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 30);
const mpc = d.courses[0].milles_par_case ?? 1;

function choixHumain(e: EtatPartie, id: string): Choix {
  const b = e.bateaux.find((x) => x.id === id)!;
  const vent = ventCourant(e, b.x, b.y);
  let best: Choix = { cap: 0, voile: b.voiles[0] ?? null, distanceMax: null };
  let bv = -Infinity;
  for (let cap = 0; cap < 16; cap++)
    for (const v of b.voiles.length ? b.voiles : [null]) {
      const g = gainOption(d, e, b, { cap, voile: v }, vent, new Set());
      if (g.distance === null) continue;
      if (g.gain > bv) {
        bv = g.gain;
        best = { cap, voile: v, distanceMax: null };
      }
    }
  return best;
}

const causes: Record<string, number> = {};
const stats: Record<string, { prevu: number; apresDes: number; attendu: number; reel: number; n: number }> = { humain: { prevu: 0, apresDes: 0, attendu: 0, reel: 0, n: 0 }, ia: { prevu: 0, apresDes: 0, attendu: 0, reel: 0, n: 0 } };
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.map((s) => s.id).slice(0, 6);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 7919,
    participants: ids.map((id, i) => (i === g % 6
      ? { nom: 'Moi', type: 'humain' as const, niveauQuiz: 2 as const, skipperId: id }
      : { nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
    options: { quiz: false, bulletinMeteo: true, nomsReels: true, courseComplete: false, evenements: false },
  });
  const prevu = new Map<string, number>();
  const att = new Map<string, number>();
  let avant = new Map(e.bateaux.map((x) => [x.id, [x.x, x.y] as const]));
  let tour = e.tour;
  let nbEvts = e.evenements.length;
  const prevoirIA = () => {
    for (const x of e.bateaux) {
      if (x.type !== 'ia' || x.arrive || x.passeTours > 0) continue;
      const c = choisirIA(d, e, x.id);
      att.set(x.id, distanceAttendue(d, e, x.id, c.voile, c.cap!).attendu);
      prevu.set(x.id, calculerDistance(d, carteDe(d, e), x, c.voile, c.cap!, ventCourant(e, x.x, x.y)).distance ?? 0);
    }
  };
  prevoirIA();
  const bilan = () => {
    if (e.tour === tour && e.phase !== 'fin') return;
    const debut = new Map<string, number>();
    for (const ev of e.evenements.slice(nbEvts)) if (ev.type === 'debut' && ev.bateauId) debut.set(ev.bateauId, (ev.donnees as { distance?: number })?.distance ?? 0);
    for (const ev of e.evenements.slice(nbEvts)) {
      if (!ev.bateauId) continue;
      const t = e.bateaux.find((x) => x.id === ev.bateauId)!.type;
      const k = `${t} ${ev.type}${ev.type === 'deplacement' ? ' ' + String((ev.donnees as { bloque?: string })?.bloque) : ''}${ev.type === 'penalite' ? ' ' + String((ev.donnees as { penalite?: string })?.penalite) : ''}`;
      causes[k] = (causes[k] ?? 0) + 1;
    }
    nbEvts = e.evenements.length;
    for (const x of e.bateaux) {
      const p = prevu.get(x.id);
      const a = avant.get(x.id)!;
      if (p === undefined) continue;
      const s = stats[x.type === 'humain' ? 'humain' : 'ia'];
      s.prevu += p;
      s.apresDes += debut.get(x.id) ?? 0;
      s.attendu += att.get(x.id) ?? 0;
      s.reel += Math.hypot(x.x - a[0], x.y - a[1]);
      s.n++;
    }
    prevu.clear();
    avant = new Map(e.bateaux.map((x) => [x.id, [x.x, x.y] as const]));
    tour = e.tour;
    prevoirIA();
  };
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 5000) {
    if (e.attente) {
      const a = e.attente;
      e = appliquer(d, e, a.type === 'relance' ? { type: 'RepondreRelance', bateauId: a.bateauId, relancer: decisionRelanceIA(d, e, e.bateaux.find((x) => x.id === a.bateauId)!, e.resolution!.courant!) }
        : a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: 0 }
        : { type: 'JouerReparation', bateauId: a.bateauId, jouer: a.motif === "evenement" ? true : decisionReparationIA(e.bateaux.find((x) => x.id === a.bateauId)!, a.motif, a.penalite ?? null) });
      bilan();
      continue;
    }
    const h = humainsAttendus(e)[0];
    const b = h ?? bateauxAttendus(e)[0];
    if (!b) break;
    const choix = h && process.env.NAIF ? choixHumain(e, b.id) : choisirIA(d, e, b.id);
    const bb = e.bateaux.find((x) => x.id === b.id)!;
    att.set(b.id, distanceAttendue(d, e, b.id, choix.voile, choix.cap!).attendu);
    prevu.set(b.id, calculerDistance(d, carteDe(d, e), bb, choix.voile, choix.cap!, ventCourant(e, bb.x, bb.y)).distance ?? 0);
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix });
    bilan();
  }
}
for (const [k, s] of Object.entries(stats))
  console.log(`${k}: ${s.n} tours · prévu ${Math.round((s.prevu / s.n) * mpc)} mn · après les dés ${Math.round((s.apresDes / s.n) * mpc)} mn · attendu ${Math.round((s.attendu / s.n) * mpc)} mn · parcouru ${Math.round((s.reel / s.n) * mpc)} mn · ratio ${(s.reel / s.prevu).toFixed(2)}`);

console.log(Object.entries(causes).sort().map(([k, v]) => `${k}: ${v}`).join('\n'));
