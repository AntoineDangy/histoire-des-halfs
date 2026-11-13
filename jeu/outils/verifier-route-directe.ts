// Vérifie que la route directe affichée (ligne blanche) d'une course ne coupe pas la terre de la carte du jeu.
// Usage : npx tsx outils/verifier-route-directe.ts rolex-fastnet
// Ajouté le 13/11/2026 avec les points de passage de la route du Fastnet.
import { readFileSync } from 'node:fs';
import { donneesBrutes } from '../packages/data/index';
import { compilerCarte, terreFine } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const id = process.argv[2] ?? 'rolex-fastnet';
const d = donneesBrutes as unknown as Donnees;
const course = d.courses.find((c) => c.id === id);
if (!course) throw new Error(`Course inconnue : ${id}`);
const carte = compilerCarte(course);
const trace = JSON.parse(readFileSync(new URL(`../packages/data/courses/${id}-trace.json`, import.meta.url), 'utf-8')) as { orthodromie: number[] };
const pts = trace.orthodromie;

// Passages à terre regroupés en tronçons (le départ et l'arrivée, au port, en font normalement partie).
const troncons: { de: string; a: string; n: number }[] = [];
let dansTerre = false;
for (let i = 0; i + 3 < pts.length; i += 2) {
  // Échantillonne chaque morceau tous les dixièmes de case.
  const [x1, y1, x2, y2] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 10));
  for (let k = 0; k <= n; k++) {
    const x = x1 + ((x2 - x1) * k) / n, y = y1 + ((y2 - y1) * k) / n;
    const ici = `[${x.toFixed(1)}, ${y.toFixed(1)}]`;
    if (terreFine(carte, x, y)) {
      if (!dansTerre) troncons.push({ de: ici, a: ici, n: 0 });
      const tr = troncons[troncons.length - 1];
      tr.a = ici;
      tr.n++;
      dansTerre = true;
    } else dansTerre = false;
  }
}
console.log(`${id} : ${pts.length / 2} points ; ${troncons.length} passage(s) à terre`);
for (const tr of troncons) console.log(`  de ${tr.de} à ${tr.a} (${tr.n} échantillons d'un dixième de case)`);
