import { describe, expect, it } from 'vitest';
import { donneesBrutes } from '../../data/index';
import { appliquer, ATTENTE_ANIMATION_MAX_S, choisirIA, chronoPeutPartir, creerPartie, humainsAttendus, ventCourant } from '../../engine/src/index';
import type { Donnees, EtatPartie } from '../../engine/src/index';
import { attenteAMontrer, cleAttente, etapeDuTour, recapIA, ventDuJoueur } from '../src/jeu/enchainement';

const d = donneesBrutes as unknown as Donnees;

/** Partie Route du Rhum en Ocean Fifty : `humains` joueurs humains et des IA, jouée jusqu'à ce que `cherche` soit vrai. */
function jusquA(humains: number, cherche: (e: EtatPartie) => boolean): EtatPartie {
  const ids = d.skippers.filter((s) => s.classe === 'OCEAN_FIFTY').slice(0, 4).map((s) => s.id);
  for (let graine = 1; graine <= 40; graine++) {
    let e = creerPartie(d, {
      courseId: 'route-du-rhum', classe: 'OCEAN_FIFTY', graine,
      participants: ids.map((id, i) => ({ nom: `J${i + 1}`, type: i < humains ? 'humain' as const : 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    for (let garde = 0; garde < 120 && e.phase !== 'fin'; garde++) {
      if (cherche(e)) return e;
      const a = e.attente;
      if (a) {
        e = appliquer(d, e, a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: 0 }
          : a.type === 'reparation' ? { type: 'JouerReparation', bateauId: a.bateauId, jouer: false }
            : { type: 'RepondreRelance', bateauId: a.bateauId, relancer: false });
      } else {
        const b = humainsAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
    }
  }
  throw new Error('situation introuvable');
}

describe('enchaînement d\'un tour à l\'écran (audit du 13/11/2026)', () => {
  it('les étapes se suivent dans l\'ordre : vent, large, course, fin du tour, sans jamais revenir en arrière', () => {
    const e = jusquA(1, (x) => x.tour >= 6 && x.phase === 'choix');
    const ordre = ['vent', 'voiles', 'large', 'course', 'fin'];
    const tour = e.tour - 1;
    const idx = e.evenements.map((x, i) => (x.tour === tour ? i : -1)).filter((i) => i >= 0);
    const etapes = idx.map((i) => etapeDuTour(e.evenements, i)).filter((x) => x !== null);
    for (let k = 1; k < etapes.length; k++) expect(ordre.indexOf(etapes[k]!)).toBeGreaterThanOrEqual(ordre.indexOf(etapes[k - 1]!));
    expect(etapes[0]).toBe('vent');
    expect(etapes).toContain('course');
    // Le départ du bateau du joueur est bien dans « La course ».
    const iDebut = idx.find((i) => e.evenements[i].type === 'debut')!;
    expect(etapeDuTour(e.evenements, iDebut)).toBe('course');
  });

  it('une décision ne se montre qu\'au moment où l\'animation y arrive, et une seule fois', () => {
    const e = jusquA(2, (x) => x.attente?.type === 'reparation' && x.attente.motif === 'evenement');
    const a = e.attente!;
    const autre = e.bateaux.find((b) => b.type === 'humain' && b.id !== a.bateauId)!.id;
    // Animation en retard (la carte n'est pas encore montrée) : rien.
    expect(attenteAMontrer(e, e.evenements.length - 1, { moi: a.bateauId }, null)).toBeNull();
    // Animation arrivée : la décision, pour ce joueur seulement.
    expect(attenteAMontrer(e, e.evenements.length, { moi: a.bateauId }, null)).toEqual(a);
    expect(attenteAMontrer(e, e.evenements.length, { moi: autre }, null)).toBeNull();
    // Réponse envoyée : la fenêtre ne revient pas en attendant le serveur.
    expect(attenteAMontrer(e, e.evenements.length, { moi: a.bateauId }, cleAttente(e))).toBeNull();
    // Solo / même écran : la décision du joueur humain concerné, une fois l'animation arrivée.
    expect(attenteAMontrer(e, e.evenements.length, null, null)).toEqual(a);
  });

  it('récapitulatif des IA au large : leurs cartes, en une phrase', () => {
    const e = jusquA(1, (x) => x.phase === 'choix' && x.evenements.some((v) => v.tour === x.tour - 1 && v.type === 'carte_evenement' && x.bateaux.find((b) => b.id === v.bateauId)?.type === 'ia'));
    const r = recapIA(e, e.tour - 1)!;
    expect(r.startsWith('Les IA au large : ')).toBe(true);
    const carteIA = e.evenements.find((v) => v.tour === e.tour - 1 && v.type === 'carte_evenement' && e.bateaux.find((b) => b.id === v.bateauId)?.type === 'ia')!;
    expect(r).toContain(carteIA.texte.replace(/\.$/, ''));
  });

  it('le départ du bateau garde la distance et le vent prévus au choix, pour expliquer l\'écart', () => {
    const e = jusquA(1, (x) => x.tour >= 4 && x.phase === 'choix');
    const humain = e.bateaux.find((b) => b.type === 'humain')!.id;
    const departs = e.evenements.filter((v) => v.type === 'debut' && v.bateauId === humain);
    expect(departs.length).toBeGreaterThan(0);
    for (const v of departs) {
      const dd = v.donnees as { prevu?: number; ventPrevu?: { force: number } };
      expect(typeof dd.prevu).toBe('number');
      expect(typeof dd.ventPrevu?.force).toBe('number');
    }
  });

  it('girouette et bateau 3D : le vent du joueur à l\'instant montré, jamais celui d\'un autre bateau (bug du 13/11/2026)', () => {
    const e = jusquA(1, (x) => x.tour >= 5 && x.phase === 'choix');
    const moi = e.bateaux.find((b) => b.type === 'humain')!;
    const evs = e.evenements;
    const tour = e.tour - 1;
    const iVent = evs.findIndex((v) => v.tour === tour && v.type === 'vent');
    const iDebut = evs.findIndex((v) => v.tour === tour && v.type === 'debut' && v.bateauId === moi.id);
    const iPremier = evs.findIndex((v) => v.tour === tour);
    const dv = evs[iVent].donnees as { locaux: Record<string, { avant: unknown; apres: unknown }> };
    expect(iDebut).toBeGreaterThan(iVent);
    // Avant les dés du tour : le vent de sa zone avant les dés.
    expect(ventDuJoueur(e, iPremier, moi.id)).toEqual(dv.locaux[moi.id].avant);
    // Dés montrés : le vent de sa zone après les dés, même pendant le départ des autres bateaux.
    expect(ventDuJoueur(e, iVent + 1, moi.id)).toEqual(dv.locaux[moi.id].apres);
    expect(ventDuJoueur(e, iDebut, moi.id)).toEqual(dv.locaux[moi.id].apres);
    // Son départ montré : le vent de son départ.
    expect(ventDuJoueur(e, iDebut + 1, moi.id)).toEqual((evs[iDebut].donnees as { vent: unknown }).vent);
    // Animation finie : le vent à sa position.
    expect(ventDuJoueur(e, evs.length, moi.id)).toEqual(ventCourant(e, moi.x, moi.y));
  });

  it('chrono réseau : il part quand les écrans des joueurs attendus ont fini le tour, ou au bout de 2 minutes', () => {
    const t0 = 1_000_000;
    expect(chronoPeutPartir(t0, 50, [50, 49], t0 + 1000)).toBe(false); // un écran encore en animation
    expect(chronoPeutPartir(t0, 50, [50, undefined], t0 + 1000)).toBe(false); // un écran n'a encore rien dit
    expect(chronoPeutPartir(t0, 50, [50, 52], t0 + 1000)).toBe(true);
    expect(chronoPeutPartir(t0, 50, [], t0)).toBe(true); // personne d'attendu (connecté)
    expect(chronoPeutPartir(t0, 50, [undefined], t0 + ATTENTE_ANIMATION_MAX_S * 1000)).toBe(true);
  });
});
