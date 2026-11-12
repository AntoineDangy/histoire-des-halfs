// Simulation d'équilibrage (cahier des charges §9), version bêta : parties IA contre IA sur la
// Route du Rhum avec les 4 skippers. Usage : npm run sim -- [nombre de parties] [niveau IA]
// Produit reports/equilibrage-beta.md. N'applique jamais d'ajustement automatiquement.
import { mkdirSync, writeFileSync } from 'node:fs';
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie, nomSkipper } from '../packages/engine/src/index';
import type { Donnees, NiveauIA } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 400);
const niveau = (process.argv[3] ?? 'moyen') as NiveauIA;

const victoires = new Map<string, number>();
const placesMoy = new Map<string, number>();
const tours: number[] = [];
const avaries = new Map<string, number>();

for (let g = 1; g <= n; g++) {
  // On fait tourner les positions de départ pour ne pas avantager un skipper.
  const ids = d.skippers.map((s) => s.id);
  const rot = ids.map((_, i) => ids[(i + g) % ids.length]);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 7919,
    participants: rot.map((id) => ({ nom: id, type: 'ia', niveauIA: niveau, niveauQuiz: 2, skipperId: id })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  while (e.phase !== 'fin') {
    const b = bateauxAttendus(e)[0];
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  }
  tours.push(e.tour);
  e.classementFinal!.forEach((id, place) => {
    const b = e.bateaux.find((x) => x.id === id)!;
    const nom = nomSkipper(d, e, b);
    placesMoy.set(nom, (placesMoy.get(nom) ?? 0) + (place + 1) / n);
    avaries.set(nom, (avaries.get(nom) ?? 0) + b.stats.avaries / n);
    if (place === 0) victoires.set(nom, (victoires.get(nom) ?? 0) + 1);
  });
}

tours.sort((a, b) => a - b);
const med = tours[Math.floor(tours.length / 2)];
const lignes = [
  `# Équilibrage bêta — Route du Rhum, IMOCA`,
  ``,
  `${n} parties, IA « ${niveau} » contre IA « ${niveau} », positions de départ tournantes.`,
  ``,
  `Durée : médiane **${med} tours** (min ${tours[0]}, max ${tours[tours.length - 1]}). Cible : ${d.courses[0].duree_cible_tours.join(' à ')} tours.`,
  ``,
  `| Skipper | Victoires | Place moyenne | Avaries par course |`,
  `|---|---|---|---|`,
  ...[...placesMoy.keys()].sort().map((k) =>
    `| ${k} | ${(((victoires.get(k) ?? 0) / n) * 100).toFixed(1)} % | ${placesMoy.get(k)!.toFixed(2)} | ${avaries.get(k)!.toFixed(2)} |`),
  ``,
  `Avec 4 bateaux, l'équilibre parfait donne 25 % de victoires et une place moyenne de 2,5.`,
];
mkdirSync('reports', { recursive: true });
writeFileSync('reports/equilibrage-beta.md', lignes.join('\n') + '\n', 'utf-8');
console.log(lignes.join('\n'));
