// Test d'observation : mesure le suspense, le stress et les surprises d'une course (IA contre IA).
// Usage : npx tsx outils/observation.ts [parties]   → reports/observation.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, classement, creerPartie, distanceRestante } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 200);
const mpc = d.courses[0].milles_par_case ?? 1;
const m = {
  tours: [] as number[], leaders: [] as number[], ecartArrivee: [] as number[], gagneParLeaderMiCourse: 0, gagneParLeaderTour3: 0,
  remontees: 0, toursMorts: 0, toursBateau: 0, avaries: 0, cartes: 0, cartesHeureuses: 0, quiz: 0, louvoyages: 0, noirs: 0,
  risqueEleve: 0, deplacements: 0, toursSansSurprise: 0, toursObserves: 0, depassements: 0, pertesVoile: 0, chavireEcart: [] as number[],
};
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.map((s) => s.id);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 6151,
    participants: ids.map((_, i) => ({ nom: 'IA', type: 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: ids[(i + g) % 4] })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  const leaders: string[] = [];
  let tourPrec = e.tour;
  while (e.phase !== 'fin') {
    const b = bateauxAttendus(e)[0];
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    if (e.tour !== tourPrec || e.phase === 'fin') {
      leaders.push(classement(d, e)[0].id);
      tourPrec = e.tour;
    }
  }
  const vainqueur = e.classementFinal![0];
  m.tours.push(e.tour);
  m.leaders.push(leaders.filter((l, i) => i > 0 && l !== leaders[i - 1]).length);
  const mi = leaders[Math.floor(leaders.length / 2)];
  if (mi === vainqueur) m.gagneParLeaderMiCourse++;
  if (leaders[2] === vainqueur) m.gagneParLeaderTour3++;
  const second = e.bateaux.find((x) => x.id === e.classementFinal![1])!;
  m.ecartArrivee.push(second.arrive ? 0 : distanceRestante(d, e, second) * mpc);
  // Événements vécus par un bateau « témoin » (le premier), tour par tour : y a-t-il eu une surprise ?
  const temoin = e.bateaux[0].id;
  const parTour = new Map<number, number>();
  for (const ev of e.evenements) {
    if (ev.type === 'debut') {
      m.deplacements++;
      const dd = ev.donnees as { risque: number; louvoyage?: boolean };
      if (dd.risque >= 3) m.risqueEleve++;
      if (dd.louvoyage) m.louvoyages++;
    }
    if (ev.type === 'bloque' || ev.type === 'passe') m.toursMorts++;
    if (ev.type === 'penalite' || ev.type === 'naufrage') m.avaries++;
    if (ev.type === 'carte_evenement') m.cartes++;
    if (ev.type === 'quiz') m.quiz++;
    if (ev.type === 'voile_perdue') m.pertesVoile++;
    if (ev.type === 'depassement') m.depassements++;
    if (ev.type === 'jet_risque' && (ev.donnees as { noir?: boolean })?.noir) m.noirs++;
    if (ev.bateauId === temoin && ['penalite', 'carte_evenement', 'quiz', 'voile_perdue', 'depassement', 'relance', 'naufrage', 'bloque'].includes(ev.type))
      parTour.set(ev.tour, (parTour.get(ev.tour) ?? 0) + 1);
  }
  m.toursObserves += e.tour;
  m.toursSansSurprise += e.tour - parTour.size;
  m.toursBateau += e.tour * 4;
}
const moy = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (x: number, t: number) => `${((100 * x) / t).toFixed(0)} %`;
const serrees = m.ecartArrivee.filter((x) => x < 150).length;
const lignes = [
  `# Test d'observation : suspense, stress et surprises (${n} parties IA moyenne, Route du Rhum)`,
  '',
  '| Indicateur | Valeur |',
  '|---|---|',
  `| Durée médiane | ${med(m.tours)} tours |`,
  `| Changements de leader par course (moyenne) | ${moy(m.leaders).toFixed(1)} |`,
  `| Le leader de mi-course gagne | ${pct(m.gagneParLeaderMiCourse, n)} |`,
  `| Le leader du tour 3 gagne | ${pct(m.gagneParLeaderTour3, n)} |`,
  `| Arrivées serrées (2e à moins de 150 milles) | ${pct(serrees, n)} |`,
  `| Écart médian du 2e à l'arrivée | ${Math.round(med(m.ecartArrivee))} milles |`,
  `| Tours « morts » (bateau immobile) | ${pct(m.toursMorts, m.toursBateau)} des tours-bateau |`,
  `| Déplacements sous risque élevé (jaune ou rouge) | ${pct(m.risqueEleve, m.deplacements)} |`,
  `| Déplacements en louvoyage | ${pct(m.louvoyages, m.deplacements)} |`,
  `| Par bateau et par course : avaries (quiz raté, naufrage) | ${(m.avaries / (n * 4)).toFixed(1)} |`,
  `| Par bateau et par course : cartes du large | ${(m.cartes / (n * 4)).toFixed(1)} |`,
  `| Par bateau et par course : questions de quiz | ${(m.quiz / (n * 4)).toFixed(1)} |`,
  `| Par bateau et par course : voiles perdues | ${(m.pertesVoile / (n * 4)).toFixed(2)} |`,
  `| Par bateau et par course : cases noires | ${(m.noirs / (n * 4)).toFixed(2)} |`,
  `| Dépassements par course | ${(m.depassements / n).toFixed(1)} |`,
  `| Tours sans aucune surprise pour un bateau donné | ${pct(m.toursSansSurprise, m.toursObserves)} |`,
  '',
];
mkdirSync('reports', { recursive: true });
writeFileSync('reports/observation.md', lignes.join('\n'), 'utf-8');
console.log(lignes.join('\n'));
