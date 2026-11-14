// Nouveau tutoriel (14/11/2026) : guide du premier tour et données du petit film « Comment ça marche ».
import { describe, expect, it } from 'vitest';
import { donneesBrutes } from '../../data/index';
import { choisirIA, creerPartie, trajectoirePrevue } from '../../engine/src/index';
import type { Donnees } from '../../engine/src/index';
import { astuceDuMoment, forceTempete, repereDuGuide, vueDuGuide, voileUsee } from '../src/tutoriel/guideLogique';
import type { ContexteGuide } from '../src/tutoriel/guideLogique';
import { niveauxVoiles } from '../src/tutoriel/filmDonnees';

const d = donneesBrutes as unknown as Donnees;

const ctx = (c: Partial<ContexteGuide> = {}): ContexteGuide => ({
  tour: 1, choix: true, destination: false, etape: null, fini: false, frontAnnonce: false, tempete: false, voileUsee: false, ...c,
});

describe('guide du tutoriel', () => {
  it('premier tour geste par geste : le vent, la mer, la voile, Valider', () => {
    const g = (pas: number) => ({ pas, termine: false });
    expect(vueDuGuide(ctx(), g(0))).toMatchObject({ type: 'projecteur', cible: 'vent', ok: true });
    expect(vueDuGuide(ctx(), g(1))).toMatchObject({ type: 'projecteur', cible: 'mer', main: true, ok: false });
    expect(vueDuGuide(ctx({ destination: true }), g(1))).toMatchObject({ cible: 'voiles', ok: true });
    expect(vueDuGuide(ctx({ destination: true }), g(3))).toMatchObject({ cible: 'valider', main: true });
    // Cap choisi avant d'y être invité : on passe directement aux voiles ; cap effacé : retour à la mer.
    expect(vueDuGuide(ctx({ destination: true }), g(0))).toMatchObject({ cible: 'voiles' });
    expect(vueDuGuide(ctx({ destination: false }), g(3))).toMatchObject({ cible: 'mer' });
  });

  it('frise pendant les deux premiers tours, « à toi » au deuxième, « Bravo » au troisième', () => {
    const g = { pas: 4, termine: false };
    expect(vueDuGuide(ctx({ choix: false, etape: 'vent' }), g)).toEqual({ type: 'frise', etape: 'vent' });
    expect(vueDuGuide(ctx({ tour: 2, choix: false, etape: 'large' }), g)).toEqual({ type: 'frise', etape: 'large' });
    expect(vueDuGuide(ctx({ tour: 2 }), g)).toMatchObject({ type: 'bulle' });
    expect(vueDuGuide(ctx({ tour: 2, destination: true }), g)).toBeNull();
    expect(vueDuGuide(ctx({ tour: 3 }), g)).toEqual({ type: 'bravo' });
    expect(vueDuGuide(ctx({ tour: 3, choix: false, etape: 'vent' }), g)).toBeNull();
    expect(vueDuGuide(ctx({ tour: 3 }), { pas: 4, termine: true })).toBeNull();
    expect(vueDuGuide(ctx({ fini: true }), g)).toBeNull();
  });

  it('petits conseils : seulement après le guide, une fois chacun, la tempête d\'abord', () => {
    const c = ctx({ tour: 5, tempete: true, frontAnnonce: true });
    expect(astuceDuMoment(c, { pas: 0, termine: false }, new Set())).toBeNull();
    expect(astuceDuMoment({ ...c, tour: 2, destination: true }, { pas: 0, termine: false }, new Set())).toBeNull();
    expect(astuceDuMoment(c, { pas: 0, termine: true }, new Set())).toBe('tempete');
    expect(astuceDuMoment(c, { pas: 0, termine: true }, new Set(['tempete']))).toBe('front');
    expect(astuceDuMoment({ ...c, choix: false }, { pas: 0, termine: true }, new Set())).toBeNull();
    expect(forceTempete(d)).toBe(9);
    expect(voileUsee(d, { voiles: ['spi', 'j3'], usure: { spi: 80 } })).toBe(true);
    expect(voileUsee(d, { voiles: ['j3'], usure: { spi: 80, j3: 10 } })).toBe(false);
  });

  it('« Touche la mer ici » : au départ du tutoriel, un point de mer au bout d\'une route libre', () => {
    const e = creerPartie(d, {
      courseId: 'route-du-rhum', classe: 'IMOCA', graine: 2026,
      participants: [
        { nom: 'Vous', type: 'humain', niveauQuiz: 1, skipperId: 'jeremie-beyou' },
        { nom: 'IA', type: 'ia', niveauIA: 'facile', niveauQuiz: 1, skipperId: 'jean-le-cam' },
      ],
      options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
    });
    const moi = e.bateaux[0];
    const r = repereDuGuide(d, e, moi.id);
    expect(r).not.toBeNull();
    expect(Math.hypot(r!.pt[0] - moi.x - 0.5, r!.pt[1] - moi.y - 0.5)).toBeGreaterThan(1);
    const c = choisirIA(d, structuredClone(e), moi.id, { utilisableMaintenant: true });
    expect(r!.cap).toBe(c.cap);
    expect(trajectoirePrevue(d, e, moi.id, c.cap!, 3).caseBloquante).toBeNull();
  });
});

describe('petit film « Comment ça marche »', () => {
  it('scène des voiles : les voiles qui tiennent à F3, F6, F8 et F10 suivent les plages du jeu', () => {
    expect(niveauxVoiles(d)).toEqual([
      { force: 3, voiles: ['spi', 'solent', 'j3', 'reduite'] },
      { force: 6, voiles: ['j3', 'reduite'] },
      { force: 8, voiles: ['reduite'] },
      { force: 10, voiles: [] },
    ]);
  });
});
