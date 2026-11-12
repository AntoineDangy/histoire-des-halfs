// Vérifie l'effet des alizés : même bateau, même vent, même cap, dans la zone et juste à côté.
// Puis, sur des parties simulées, compare la distance parcourue par tour dans et hors de la zone.
// Usage : npx tsx outils/verifier-alizes.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, calculerDistance, choisirIA, compilerCarte, creerPartie, NOMS_DIR } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const carte = compilerCarte(d.courses[0]);
const mpc = carte.course.milles_par_case ?? 1;
const z = carte.course.zones_meteo.find((x) => x.type === 'alize')!;
const [x0, y0, x1, y1] = z.rect;
console.log(`Zone des alizés : cases x ${x0}–${x1}, y ${y0}–${y1}`);

// 1. Calcul pur : une case dans la zone, une case juste au nord, hors zone.
const e0 = creerPartie(d, { courseId: 'route-du-rhum', classe: 'IMOCA', graine: 1, participants: [{ nom: 'A', type: 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: d.skippers[0].id }], options: { quiz: false, bulletinMeteo: true, nomsReels: true, courseComplete: false } });
const b = e0.bateaux[0];
const dedans = { ...b, x: Math.round((x0 + x1) / 2), y: y0 + 2 };
const dehors = { ...b, x: dedans.x, y: y0 - 2 };
const vent = { direction: 2, force: 4 }; // alizé de NE force 4
for (const cap of [8, 10, 12, 4])
  for (const v of ['gennaker', 'spi', 'solent']) {
    const a = calculerDistance(d, carte, dedans, v, cap, vent);
    const h = calculerDistance(d, carte, dehors, v, cap, vent);
    if (a.distance === null || h.distance === null) continue;
    console.log(`cap ${NOMS_DIR[cap].padEnd(3)} ${v.padEnd(8)} dans les alizés ${Math.round(a.distance * mpc)} mn · hors zone ${Math.round(h.distance * mpc)} mn`);
  }

// 2. Parties simulées : distance parcourue par tour, dans et hors de la zone (même partie de la course).
const n = Number(process.argv[2] ?? 40);
const s = { dedans: { d: 0, n: 0 }, dehors: { d: 0, n: 0 } };
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.map((k) => k.id);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 9973,
    participants: ids.map((id) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 3000) {
    const x = bateauxAttendus(e)[0];
    if (!x) break;
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: x.id, choix: choisirIA(d, e, x.id) });
  }
  for (const l of e.journal ?? []) {
    if (l.budget === null || l.issue !== 'déplacement') continue;
    // Comparaison sur la même bande de longitude (traversée de l'Atlantique), pour ne pas mélanger avec le golfe de Gascogne.
    if (l.de[0] < x0 || l.de[0] > x1) continue;
    const k = carte.alize[l.de[1] * carte.L + l.de[0]] >= 0 ? s.dedans : s.dehors;
    k.d += l.parcourue;
    k.n++;
  }
}
for (const [k, v] of Object.entries(s)) console.log(`${k} : ${v.n} tours · ${Math.round((v.d / v.n) * mpc)} mn parcourus en moyenne`);

// 3. Le détour paie-t-il au classement ? Rang final moyen selon le nombre de tours passés dans les alizés.
const parGroupe: Record<string, { rang: number; n: number; victoires: number }> = {};
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.map((k) => k.id);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 9973,
    participants: ids.map((id) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 3000) {
    const x = bateauxAttendus(e)[0];
    if (!x) break;
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: x.id, choix: choisirIA(d, e, x.id) });
  }
  for (const bt of e.bateaux) {
    const tours = (e.journal ?? []).filter((l) => l.bateauId === bt.id && carte.alize[l.de[1] * carte.L + l.de[0]] >= 0).length;
    const k = tours === 0 ? 'aucun tour' : tours <= 2 ? '1 à 2 tours' : '3 tours et plus';
    const rang = e.classementFinal!.indexOf(bt.id) + 1;
    const p = (parGroupe[k] ??= { rang: 0, n: 0, victoires: 0 });
    p.rang += rang;
    p.n++;
    if (rang === 1) p.victoires++;
  }
}
for (const [k, v] of Object.entries(parGroupe))
  console.log(`${k} dans les alizés : ${v.n} bateaux · rang moyen ${(v.rang / v.n).toFixed(1)} sur 10 · victoires ${Math.round((v.victoires / v.n) * 100)} %`);
