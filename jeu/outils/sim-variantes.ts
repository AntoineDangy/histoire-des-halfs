// Compare des variantes d'une compétence par simulation (aide à la décision, n'écrit aucune donnée).
// Usage : npx tsx outils/sim-variantes.ts <id_competence> <fichier_variantes.json> [nombre de parties]
// Le fichier de variantes est une liste { "nom": "...", "effets": [...], "speciaux": {...} }.
import { readFileSync } from 'node:fs';
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { CompetenceDef, Donnees } from '../packages/engine/src/index';

const [idComp, fichier, nArg] = process.argv.slice(2);
const n = Number(nArg ?? 300);
const variantes = JSON.parse(readFileSync(fichier, 'utf-8')) as (Partial<CompetenceDef> & { nom: string })[];

for (const v of variantes) {
  const d = structuredClone(donneesBrutes) as unknown as Donnees;
  const c = d.competences.find((x) => x.id === idComp)!;
  if (v.effets) c.effets = v.effets;
  if (v.speciaux) c.speciaux = v.speciaux;
  const vict = new Map<string, number>();
  const tours: number[] = [];
  for (let g = 1; g <= n; g++) {
    const ids = d.skippers.map((s) => s.id);
    const rot = ids.map((_, i) => ids[(i + g) % ids.length]);
    let e = creerPartie(d, {
      courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 7919,
      participants: rot.map((id) => ({ nom: id, type: 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: id })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    while (e.phase !== 'fin') {
      const b = bateauxAttendus(e)[0];
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    }
    tours.push(e.tour);
    const gagnant = e.bateaux.find((b) => b.id === e.classementFinal![0])!.skipperId;
    vict.set(gagnant, (vict.get(gagnant) ?? 0) + 1);
  }
  tours.sort((a, b) => a - b);
  const pct = d.skippers.map((s) => `${s.nom_affiche.split(' ').pop()} ${(((vict.get(s.id) ?? 0) / n) * 100).toFixed(0)} %`).join(' · ');
  console.log(`${v.nom.padEnd(48)} ${pct} · médiane ${tours[Math.floor(n / 2)]} tours`);
}
