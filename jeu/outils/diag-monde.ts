// Diagnostic des tours du monde (12/11/2026) : position du premier bateau à chaque tour.
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';
const d = donneesBrutes as unknown as Donnees;
const courseId = process.argv[2] ?? 'vendee-globe', classe = process.argv[3] ?? 'IMOCA';
const sk = d.skippers.filter((s) => s.classe === classe).slice(0, 4);
let e = creerPartie(d, { courseId, classe, graine: 7907, participants: sk.map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })), options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false } });
const c = d.courses.find((x) => x.id === courseId)!;
const lon = (x: number) => Math.round(c.projection!.lon_min + x * (c.projection!.lon_max - c.projection!.lon_min) / c.carte.largeur);
let tour = e.tour, garde = 0;
while (e.phase !== 'fin' && garde++ < 6000) {
  const b = bateauxAttendus(e)[0];
  if (!b) break;
  e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  if (e.tour !== tour) {
    tour = e.tour;
    if (process.env.VENT && tour >= 15 && tour <= 21) console.log('vent', JSON.stringify((e as any).vent), JSON.stringify((e as any).fronts?.map((f: any) => [f.type, Math.round(f.x), Math.round(f.y), f.rx, f.ry, f.direction, f.force, f.age])));
    console.log(`tour ${tour - 1} : ` + e.bateaux.map((x) => `(${x.x},${x.y}) lon ${lon(x.x)} porte ${x.porte}${x.arrive ? ' ARRIVÉ' : ''}`).join(' | '));
  }
}

if (process.env.EVT) { const [i, a, b] = process.env.EVT.split(',').map(Number); for (const x of e.evenements.filter((v) => v.bateauId === e.bateaux[i].id && (v.tour ?? 0) >= a && (v.tour ?? 0) <= b)) console.log(x.tour, x.type, x.texte); }
console.log('fin', e.phase, e.tour, e.evenements.slice(-5).map((x) => x.texte));
