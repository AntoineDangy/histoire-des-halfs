// Mesure des forces de vent au fil des courses : répartition des forces et durée des séquences de petit temps.
// Usage : npx tsx outils/mesure-vent.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 60);
const forces: number[] = [];
const series: number[] = [];
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.filter((s) => s.classe === 'IMOCA').slice(0, 4).map((s) => s.id);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 3301,
    participants: ids.map((id) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
    options: { quiz: false, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 3000) {
    const b = bateauxAttendus(e)[0];
    if (!b) break;
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  }
  let serie = 0;
  for (const ev of e.evenements) {
    if (ev.type !== 'vent') continue;
    const f = (ev.donnees as { apres: { force: number } }).apres.force;
    forces.push(f);
    if (f <= 2) serie++;
    else if (serie) { series.push(serie); serie = 0; }
  }
  if (serie) series.push(serie);
}
const rep: Record<number, number> = {};
for (const f of forces) rep[f] = (rep[f] ?? 0) + 1;
console.log('Vent général (hors alizés, fronts et molle), après les dés :');
console.log(Object.entries(rep).map(([f, k]) => `F${f} ${Math.round((k / forces.length) * 100)} %`).join(' · '));
console.log(`Séquences de petit temps (F1-F2) : ${series.length}, durée moyenne ${(series.reduce((a, b) => a + b, 0) / (series.length || 1)).toFixed(1)} tours, plus longue ${Math.max(0, ...series)} tours`);
console.log(`Réglages : force_min ${d.regles.force_min}, force_max ${d.regles.force_max}, dé de force ${JSON.stringify(d.regles.de_force)}`);
