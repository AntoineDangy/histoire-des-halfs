// Équilibrage des classes : durée d'une Route du Rhum (tour d'arrivée du vainqueur) et suspense,
// classe par classe, en IA contre IA. Usage : npx tsx outils/sim-classes.ts [parties] [CLASSE…]
// Cibles (décision du 09/11/2026) : 7 tours en Ultim, 10 en IMOCA et Ocean Fifty, 15 en Class40.
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, classement, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 40);
const classes = process.argv.slice(3).length ? process.argv.slice(3) : d.classes.map((c) => c.id);
const med = (t: number[]) => [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)];

for (const classe of classes) {
  const skippers = d.skippers.filter((s) => s.classe === classe).slice(0, 8);
  if (skippers.length < 2) continue;
  const tours: number[] = [];
  let pot = 0, arrives = 0, collisions = 0, priorites = 0, changements = 0, leaderMiCourseGagne = 0, escales = 0, avaries = 0, chavirages = 0, cartes = 0, bateauxTours = 0;
  for (let g = 1; g <= n; g++) {
    let e = creerPartie(d, {
      courseId: process.env.COURSE ?? 'route-du-rhum', classe, graine: g * 7907,
      participants: skippers.slice(0, process.env.COURSE ? 4 : 8).map((s, i) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id, ...(d.courses.find((c) => c.id === process.env.COURSE)?.double ? { coSkipperId: skippers[i + 4]?.id } : {}) })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    const leaders: string[] = [];
    let tour = e.tour, garde = 0, premierArrive = 0;
    while (e.phase !== 'fin' && garde++ < 4000) {
      const b = bateauxAttendus(e)[0];
      if (!b) break;
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      if (e.tour !== tour) {
        leaders.push(classement(d, e)[0].id);
        tour = e.tour;
        if (!premierArrive && e.bateaux.some((x) => x.arrive)) premierArrive = e.tour - 1;
      }
    }
    tours.push(premierArrive || e.tour);
    changements += leaders.filter((l, i) => i > 0 && l !== leaders[i - 1]).length;
    if (leaders[Math.floor(leaders.length / 2)] === e.classementFinal?.[0]) leaderMiCourseGagne++;
    escales += e.evenements.filter((x) => x.type === 'port' && /escale technique/.test(x.texte)).length;
    chavirages += e.evenements.filter((x) => x.type === 'naufrage' && /chavir/.test(x.texte)).length;
    avaries += e.bateaux.reduce((s, b) => s + b.stats.avaries, 0);
    cartes += e.evenements.filter((x) => x.type === 'carte_evenement').length;
    collisions += e.evenements.filter((x) => x.type === 'collision').length;
    priorites += e.evenements.filter((x) => x.type === 'info' && /^Priorité/.test(x.texte)).length;
    bateauxTours += e.bateaux.length * e.tour;
    pot += e.evenements.filter((x) => /^Pot-au-noir/.test(x.texte)).length;
    arrives += e.bateaux.filter((b) => b.arrive).length / e.bateaux.length;
  }
  console.log(
    `${classe.padEnd(12)} tours du vainqueur : médiane ${med(tours)} (min ${Math.min(...tours)}, max ${Math.max(...tours)}) · ` +
      `changements de leader ${(changements / n).toFixed(1)} · leader à mi-course vainqueur ${Math.round((leaderMiCourseGagne / n) * 100)} % · ` +
      `avaries ${(avaries / bateauxTours).toFixed(2)}/bateau/tour · chavirages ${(chavirages / n).toFixed(1)} · escales techniques ${(escales / n).toFixed(1)} · cartes ${(cartes / n).toFixed(1)} · collisions ${(collisions / n).toFixed(2)} · priorités ${(priorites / n).toFixed(1)} par course · Pot-au-noir ${(pot / n).toFixed(1)} · arrivés ${Math.round((arrives / n) * 100)} %`,
  );
}
