// Mesure de la mécanique du risque, par classe : jets de risque, incidents, questions, avaries, voiles perdues,
// cartes réparation. IA contre IA. Usage : npx tsx outils/mesure-risques.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 30);
for (const classe of d.classes.map((c) => c.id)) {
  const skippers = d.skippers.filter((s) => s.classe === classe).slice(0, 8);
  const c: Record<string, number> = {};
  const plus = (k: string, v = 1) => (c[k] = (c[k] ?? 0) + v);
  let bateauxTours = 0;
  for (let g = 1; g <= n; g++) {
    let e = creerPartie(d, {
      courseId: 'route-du-rhum', classe, graine: g * 4241,
      participants: skippers.map((s) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: s.id })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    let garde = 0;
    while (e.phase !== 'fin' && garde++ < 4000) {
      const b = bateauxAttendus(e)[0];
      if (!b) break;
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    }
    bateauxTours += e.journal?.filter((l) => l.issue !== 'passe son tour').length ?? 0;
    for (const ev of e.evenements) {
      const dd = (ev.donnees ?? {}) as { niveau?: number; declenche?: boolean; noir?: boolean; juste?: boolean; penalite?: string };
      if (ev.type === 'debut') plus(`risque choisi ${(dd as { risque?: number }).risque ?? 0}`);
      if (ev.type === 'jet_risque' && dd.noir) plus('case noire');
      else if (ev.type === 'jet_risque') { plus('jets de risque'); if (dd.declenche) plus('incidents'); }
      if (ev.type === 'quiz') plus(dd.juste ? 'quiz justes' : 'quiz faux');
      if (ev.type === 'penalite') plus(`avarie ${dd.penalite}`);
      if (ev.type === 'voile_perdue') plus('voiles perdues');
      if (ev.type === 'reparation') plus('réparations jouées');
    }
  }
  const t = (k: string) => ((c[k] ?? 0) / bateauxTours * 100).toFixed(1) + ' %';
  console.log(`${classe} (${bateauxTours} tours-bateau)`);
  console.log(`  risque choisi : 0 ${t('risque choisi 0')} · 1 ${t('risque choisi 1')} · 2 ${t('risque choisi 2')} · 3 ${t('risque choisi 3')} · 4 ${t('risque choisi 4')}`);
  console.log(`  jets de risque ${t('jets de risque')} · incidents ${t('incidents')} · cases noires ${t('case noire')} · questions ${(((c['quiz justes'] ?? 0) + (c['quiz faux'] ?? 0)) / bateauxTours * 100).toFixed(1)} % (justes ${c['quiz justes'] ?? 0}, fausses ${c['quiz faux'] ?? 0})`);
  console.log(`  avaries : demi ${t('avarie demi')} · voile ${t('avarie perte_voile')} · passe ${t('avarie passe')} · recul ${t('avarie recul')} · voiles perdues ${t('voiles perdues')} · réparations jouées ${t('réparations jouées')}`);
}
