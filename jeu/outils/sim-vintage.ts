// Équilibrage de la classe Vintage (10/11/2026) : monocoques et multicoques de légende courent ensemble.
// Flotte de 8 bateaux, 4 monocoques et 4 multicoques tirés à chaque partie, en IA contre IA.
// Mesure : tours du vainqueur (cible : 12 au Rhum, 15 au Fastnet) et part des victoires par famille.
// Usage : npx tsx outils/sim-vintage.ts [parties]        (COURSE=rolex-fastnet pour le Fastnet)
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 40);
const course = process.env.COURSE ?? 'route-du-rhum';
const vintage = d.skippers.filter((s) => s.classe === 'VINTAGE');
const famille = (id: string) => d.bateaux.find((b) => b.id === d.skippers.find((s) => s.id === id)!.bateau_id)!.famille;
const monos = vintage.filter((s) => famille(s.id) === 'vintage_monocoque');
const multis = vintage.filter((s) => famille(s.id) === 'vintage_multicoque');
const med = (t: number[]) => [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)];

const tours: number[] = [];
const victoires: Record<string, number> = {};
const parSkipper: Record<string, { courses: number; victoires: number }> = {};
let chavirages = 0, demates = 0;
for (let g = 1; g <= n; g++) {
  let graine = g * 104729;
  const r = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648); // tirage reproductible
  const tirer = <T,>(l: T[], k: number) => [...l].sort(() => r() - 0.5).slice(0, k);
  const flotte = [...tirer(monos, 4), ...tirer(multis, 4)];
  let e = creerPartie(d, {
    courseId: course, classe: 'VINTAGE', graine: g * 7907,
    participants: flotte.map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  let garde = 0, premier = 0, tour = e.tour;
  while (e.phase !== 'fin' && garde++ < 4000) {
    const b = bateauxAttendus(e)[0];
    if (!b) break;
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    if (e.tour !== tour) {
      tour = e.tour;
      if (!premier && e.bateaux.some((x) => x.arrive)) premier = e.tour - 1;
    }
  }
  tours.push(premier || e.tour);
  const gagnant = e.bateaux.find((b) => b.id === e.classementFinal?.[0]);
  if (gagnant) {
    victoires[gagnant.famille] = (victoires[gagnant.famille] ?? 0) + 1;
    (parSkipper[gagnant.skipperId] ??= { courses: 0, victoires: 0 }).victoires++;
  }
  for (const b of e.bateaux) (parSkipper[b.skipperId] ??= { courses: 0, victoires: 0 }).courses++;
  chavirages += e.evenements.filter((x) => /chavire|chaviré/.test(x.texte)).length;
  demates += e.evenements.filter((x) => x.type === 'demate').length;
}
console.log(`${course}, classe Vintage, ${n} parties : tours du vainqueur médiane ${med(tours)} (min ${Math.min(...tours)}, max ${Math.max(...tours)})`);
console.log('Victoires par famille :', Object.entries(victoires).map(([f, v]) => `${f} ${Math.round((v / n) * 100)} %`).join(' · '));
console.log(`Chavirages ${(chavirages / n).toFixed(2)} et démâtages ${(demates / n).toFixed(2)} par course`);
console.log('Taux de victoire par skipper :', Object.entries(parSkipper).sort((a, b) => b[1].victoires / b[1].courses - a[1].victoires / a[1].courses).map(([s, v]) => `${s} ${Math.round((v.victoires / v.courses) * 100)} %`).join(', '));
