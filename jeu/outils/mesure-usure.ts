// Mesure des nouvelles règles (10/11/2026) : dé du large, usure des voiles, dé tempête, anticyclone.
// Usage : npx tsx outils/mesure-usure.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 30);
for (const classe of d.classes.map((c) => c.id)) {
  const skippers = d.skippers.filter((s) => s.classe === classe).slice(0, 8);
  const c: Record<string, number> = {};
  const plus = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  let bt = 0;
  for (let g = 1; g <= n; g++) {
    let e = creerPartie(d, {
      courseId: 'route-du-rhum', classe, graine: g * 5003,
      participants: skippers.map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    let garde = 0;
    while (e.phase !== 'fin' && garde++ < 4000) {
      const b = bateauxAttendus(e)[0];
      if (!b) break;
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    }
    bt += e.journal?.length ?? 0;
    if ((e.anticyclonesCrees ?? 0) > 0) plus('courses avec anticyclone');
    for (const ev of e.evenements) {
      if (ev.type === 'quiz') plus('questions');
      if (ev.type === 'carte_evenement') plus('cartes');
      if (ev.type === 'usure' && /explose/.test(ev.texte)) plus('voiles usées perdues');
      if (ev.type === 'voile_perdue') plus('voiles perdues (toutes causes)');
      if (ev.type === 'tempete') plus('dés tempête');
      if (ev.type === 'demate') plus('démâtages');
      if (ev.type === 'naufrage' && /chavir/.test(ev.texte)) plus('chavirages');
    }
  }
  const t = (k: string) => `${k} ${((c[k] ?? 0) / n).toFixed(1)}/course`;
  console.log(`${classe} : ${['questions', 'cartes', 'voiles usées perdues', 'voiles perdues (toutes causes)', 'dés tempête', 'démâtages', 'chavirages'].map(t).join(' · ')} · questions ${(((c.questions ?? 0) / bt) * 100).toFixed(0)} % des tours · anticyclone dans ${Math.round(((c['courses avec anticyclone'] ?? 0) / n) * 100)} % des courses`);
}
