// Suit une partie IA tour par tour : position, marque, distance restante du meilleur bateau.
// Usage : npx tsx outils/suivi-partie.ts <course> <classe> [graine]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, carteDe, choisirIA, creerPartie, distanceRestanteCase } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const [courseId, classe, g] = [process.argv[2] ?? 'transat-cafe-lor', process.argv[3] ?? 'CLASS40', Number(process.argv[4] ?? 7907)];
const sk = d.skippers.filter((s) => s.classe === classe);
let e = creerPartie(d, {
  courseId, classe, graine: g,
  participants: sk.slice(0, 4).map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })),
  options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
});
const carte = carteDe(d, e);
let tour = e.tour, garde = 0;
const ligne = () => {
  const b = [...e.bateaux].sort((a, c) => distanceRestanteCase(carte, a.x, a.y, a.porte) - distanceRestanteCase(carte, c.x, c.y, c.porte))[0];
  const v = e.vent;
  console.log(`tour ${e.tour} · ${b.id} (${b.x},${b.y}) marque ${b.porte} · reste ${Math.round(distanceRestanteCase(carte, b.x, b.y, b.porte) * (carte.course.milles_par_case ?? 30))} mn · vent ${v.direction}/${v.force}`);
};
ligne();
while (e.phase !== 'fin' && garde++ < 4000) {
  const b = bateauxAttendus(e)[0];
  if (!b) break;
  e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  if (e.tour !== tour) { tour = e.tour; ligne(); }
}
