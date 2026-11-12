// Longueur du parcours de chaque classe sur la carte (plus court chemin en mer, marques comprises), comparée à la
// distance officielle. Usage : npx tsx outils/mesure-parcours.ts [course]
import { donneesBrutes } from '../packages/data/index';
import { carteDe, distanceRestanteCase } from '../packages/engine/src/index';
import type { Donnees, EtatPartie } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const id = process.argv[2] ?? 'transat-cafe-lor';
const c = d.courses.find((x) => x.id === id)!;
for (const classe of c.classes_autorisees) {
  const etat = { params: { courseId: id, classe } } as unknown as EtatPartie;
  const carte = carteDe(d, etat);
  const dist = Math.min(...carte.departs.map(([x, y]) => distanceRestanteCase(carte, x, y, 0)));
  console.log(`${classe.padEnd(12)} parcours sur la carte ${Math.round(dist * (c.milles_par_case ?? 1))} milles · officiel ${c.distances_officielles?.[classe] ?? '?'} · marques ${carte.portes.length - 1}`);
}
