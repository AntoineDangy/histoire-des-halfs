// Contrôle : où chaque bateau franchit-il les marques d'une course ? (11/11/2026)
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, carteDe, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';
const d = donneesBrutes as unknown as Donnees;
const [courseId, classe, g] = [process.argv[2] ?? 'rolex-fastnet', process.argv[3] ?? 'IMOCA', Number(process.argv[4] ?? 11)];
const sk = d.skippers.filter((s) => s.classe === classe);
let e = creerPartie(d, { courseId, classe, graine: g, participants: sk.slice(0, 6).map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })), options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false } });
const carte = carteDe(d, e);
console.log('marques', carte.course.portes.map((p) => `${p.id}: ${JSON.stringify(p.cases[0])}..${JSON.stringify(p.cases[p.cases.length - 1])}`).join(' | '));
const avant: Record<string, number> = {}; const prev: Record<string, [number, number]> = {};
let garde = 0;
while (e.phase !== 'fin' && garde++ < 6000) {
  const b = bateauxAttendus(e)[0]; if (!b) break;
  e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  for (const x of e.bateaux) {
    if (avant[x.id] !== undefined && x.porte !== avant[x.id]) console.log(`tour ${e.tour} ${x.id} passe ${carte.course.portes[avant[x.id]]?.id} : de ${prev[x.id]} à ${[x.x, x.y]}`);
    avant[x.id] = x.porte; prev[x.id] = [x.x, x.y];
  }
}
// Contrôle des traces : aucun segment ne doit passer sur la terre (11/11/2026).
import { navigable } from '../packages/engine/src/carte';
let terre = 0, segs = 0;
for (const b of e.bateaux) for (let i = 1; i < b.trace.length; i++) {
  const [ax, ay] = b.trace[i - 1], [bx, by] = b.trace[i];
  segs++;
  for (let k = 1; k < 10; k++) {
    const x = Math.floor(ax + 0.5 + ((bx - ax) * k) / 10), y = Math.floor(ay + 0.5 + ((by - ay) * k) / 10);
    if (!navigable(carte, x, y)) { terre++; if (terre <= 3) console.log('trace sur la terre', b.id, [ax, ay], [bx, by]); break; }
  }
}
console.log(`traces : ${segs} segments, ${terre} sur la terre`);
