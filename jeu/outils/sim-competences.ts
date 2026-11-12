// Équilibrage des compétences (cahier des charges §9) : chaque compétence affronte 3 skippers SANS
// compétence, tous sur le même bateau. Avec 4 bateaux, l'équilibre parfait est 25 % de victoires
// et une place moyenne de 2,5. Usage : npx tsx outils/sim-competences.ts [parties] [famille] [fichier de variantes]
// Le fichier de variantes (facultatif) remplace des compétences : { "id": { "effets": [...], "speciaux": {...} } }.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie } from '../packages/engine/src/index';
import type { CompetenceDef, Donnees, SkipperDef } from '../packages/engine/src/index';

const n = Number(process.argv[2] ?? 300);
const famille = process.argv[3] ?? 'imoca_foiler';
const variantes = process.argv[4] ? (JSON.parse(readFileSync(process.argv[4], 'utf-8')) as Record<string, Partial<CompetenceDef>>) : {};

const base = structuredClone(donneesBrutes) as unknown as Donnees;
for (const [id, v] of Object.entries(variantes)) {
  const c = base.competences.find((x) => x.id === id);
  if (c) Object.assign(c, v);
}
const bateau = base.bateaux.find((b) => b.famille === famille)!;
const modele = base.skippers[0];

const lignes: string[] = [];
const filtre = process.env.FILTRE ?? '';
for (const comp of base.competences.filter((c) => c.id !== 'aucune' && c.id.startsWith(filtre))) {
  const d = structuredClone(base);
  // 4 skippers identiques sur le même bateau : le premier a la compétence, les autres non.
  d.skippers = [0, 1, 2, 3].map(
    (i): SkipperDef => ({ ...modele, id: `s${i}`, nom_affiche: `S${i}`, nom_generique: `S${i}`, competence: i === 0 ? comp.id : 'aucune', bateau_id: bateau.id }),
  );
  let victoires = 0, places = 0;
  for (let g = 1; g <= n; g++) {
    const ids = ['s0', 's1', 's2', 's3'];
    const rot = ids.map((_, i) => ids[(i + g) % 4]);
    let e = creerPartie(d, {
      courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 104729,
      participants: rot.map((id) => ({ nom: id, type: 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: id })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    while (e.phase !== 'fin') {
      const b = bateauxAttendus(e)[0];
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
    }
    const place = e.classementFinal!.findIndex((id) => e.bateaux.find((b) => b.id === id)!.skipperId === 's0') + 1;
    places += place / n;
    if (place === 1) victoires++;
  }
  const pct = (victoires / n) * 100;
  const verdict = pct > 31 ? 'trop forte' : pct < 19 ? 'trop faible' : 'équilibrée';
  const l = `| ${comp.nom} | ${pct.toFixed(1)} % | ${places.toFixed(2)} | ${verdict} |`;
  lignes.push(l);
  console.log(l);
}
mkdirSync('reports', { recursive: true });
writeFileSync(
  `reports/competences-${famille}${process.argv[4] ? '-variantes' : ''}.md`,
  [`# Compétences contre 3 skippers sans compétence (${famille}, ${n} parties chacune)`, '', '25 % = équilibre parfait ; zone acceptable retenue : 19 à 31 %.', '', '| Compétence | Victoires | Place moyenne | Verdict |', '|---|---|---|---|', ...lignes, ''].join('\n'),
  'utf-8',
);
