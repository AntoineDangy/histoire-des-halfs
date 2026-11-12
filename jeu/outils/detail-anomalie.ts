// Rejoue une partie de controle-mouvements et affiche le détail d'un bateau à un tour.
// Usage : npx tsx outils/detail-anomalie.ts <partie> <tour> <nom du skipper>
import { donneesBrutes } from '../packages/data/index';
import { appliquer, bateauxAttendus, choisirIA, creerPartie, decisionRelanceIA, decisionReparationIA, humainsAttendus } from '../packages/engine/src/index';
import type { Donnees } from '../packages/engine/src/index';
const d = donneesBrutes as unknown as Donnees;
const [g, tour, nom] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const ids = d.skippers.map((s) => s.id);
let e = creerPartie(d, {
  courseId: 'route-du-rhum', classe: 'IMOCA', graine: g * 104729,
  participants: ids.map((id, i) => (i === g % ids.length
    ? { nom: 'Moi', type: 'humain' as const, niveauQuiz: 2 as const, skipperId: id }
    : { nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
  options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
});
let garde = 0;
while (e.phase !== 'fin' && garde++ < 5000 && e.tour <= tour) {
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
const l = e.journal!.find((x) => x.tour === tour && x.skipper === nom)!;
console.log(JSON.stringify({ ...l, chemin: l.chemin.map((k) => k.join(',')).join(' ') }, null, 1));
for (const ev of e.evenements) if (ev.tour === tour && (ev.bateauId === l.bateauId || !ev.bateauId)) console.log('-', ev.type, ev.texte);
