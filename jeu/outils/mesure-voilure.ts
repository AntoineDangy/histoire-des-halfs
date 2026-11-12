// Vérifie les plans de voilure : surface réellement dessinée de chaque voile (en vraie grandeur) contre la surface visée.
// Usage : npx tsx outils/mesure-voilure.ts
import * as T from 'three';
import { grandVoile, PLANS, voileAvant } from '../packages/client/src/jeu/voilure';
import type { Forme } from '../packages/client/src/jeu/voilure';

const geo: Record<string, { mastH: number; P: number; E: number; deckY: number; mastZ: number; bowZ: number; sprZ: number; bowY: number; L: number }> = {
  imoca: { mastH: 27, P: 25, E: 7.4, deckY: 1.81, mastZ: -1, bowZ: -9.14, sprZ: -11.44, bowY: 2.2, L: 18.28 },
  ultim: { mastH: 35, P: 33.55, E: 11.9, deckY: 2.77, mastZ: -3.2, bowZ: -16, sprZ: -15.7, bowY: 3.0, L: 32 },
};
const triangle = (a: T.Vector3, b: T.Vector3, c: T.Vector3) => new T.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length() / 2;
for (const [nom, plan] of Object.entries(PLANS)) {
  const g = nom.startsWith('ultim') || nom === 'ocean_fifty' ? geo.ultim : geo.imoca;
  const mastH = nom === 'ocean_fifty' ? 45.4 : nom === 'ultim_ancien' ? 33.5 : g.mastH;
  const P = mastH - (g.mastH - g.P);
  const gv = grandVoile(plan.gv * plan.echelleAire, P, g.E);
  const aireGV = (gv.P * (gv.E + gv.tete)) / 2 + (2 / 3) * gv.P * gv.rond;
  const lignes = [`GV ${Math.round(aireGV / plan.echelleAire)}/${plan.gv} (tête ${(gv.tete / Math.sqrt(plan.echelleAire)).toFixed(1)} m)`];
  for (const f of ['tourmentin', 'j3', 'j2', 'fro', 'a3', 'a2'] as Forme[]) {
    const v = voileAvant(f, plan.voiles[f] * plan.echelleAire, { deckY: g.deckY, mastH, mastZ: g.mastZ, bowZ: g.bowZ, sprZ: g.sprZ, bowY: g.bowY, longueur: g.L, lee: 1 });
    const rond = { tourmentin: 1, j3: 1, j2: 1, fro: 1.05, a3: 1.2, a2: 1.3 }[f];
    lignes.push(`${f} ${Math.round((triangle(v.tack, v.head, v.clew) * rond) / plan.echelleAire)}/${plan.voiles[f]}`);
  }
  console.log(nom.padEnd(14), lignes.join(' · '));
}
