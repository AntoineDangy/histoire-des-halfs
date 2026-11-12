// Contrôle automatique des déplacements sur de nombreuses parties IA contre IA (et un « humain »
// qui joue comme l'IA). Usage : npx tsx outils/controle-mouvements.ts [parties]
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, controlerJournal, creerPartie, decisionRelanceIA, decisionReparationIA, humainsAttendus } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const n = Number(process.argv[2] ?? 50);
const comptes: Record<string, number> = {};
const exemples: string[] = [];
let lignes = 0;
for (let g = 1; g <= n; g++) {
  const ids = d.skippers.map((s) => s.id);
  let e = creerPartie(d, {
    courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 104729,
    participants: ids.map((id, i) => (i === g % ids.length
      ? { nom: 'Moi', type: 'humain' as const, niveauQuiz: 2 as const, skipperId: id }
      : { nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  });
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 5000) {
    if (e.attente) {
      const a = e.attente;
      const b = e.bateaux.find((x) => x.id === a.bateauId)!;
      e = appliquer(d, e, a.type === 'relance' ? { type: 'RepondreRelance', bateauId: b.id, relancer: decisionRelanceIA(d, e, b, e.resolution!.courant!) }
        : a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId: b.id, reponse: 0 }
        : { type: 'JouerReparation', bateauId: b.id, jouer: decisionReparationIA(b, a.motif === 'evenement' ? 'penalite' : a.motif, a.penalite ?? null) });
      continue;
    }
    const b = humainsAttendus(e)[0] ?? bateauxAttendus(e)[0];
    if (!b) break;
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  }
  lignes += e.journal?.length ?? 0;
  for (const l of e.journal ?? [])
    for (const a of controlerJournal(d, e, l)) {
      comptes[a.code] = (comptes[a.code] ?? 0) + 1;
      if (exemples.length < 15) exemples.push(`partie ${g} tour ${l.tour} ${l.skipper} (${l.type}) : ${a.texte}`);
    }
}
console.log(`${lignes} déplacements contrôlés sur ${n} parties.`);
console.log(Object.keys(comptes).length ? comptes : 'Aucune anomalie.');
console.log(exemples.join('\n'));
