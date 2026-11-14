import { describe, expect, it } from 'vitest';
import { donneesBrutes } from '../../data/index';
import {
  angleAllure, appliquer, bateauxAttendus, calculerDistance, calculerRisque, choisirIA, classement, compilerCarte,
  classesDeCourse, controlerJournal, coursesReseau, creerPartie, dansAlize, distanceAttendue, distanceRestanteCase, facesForce, frontSur, humainsAttendus, maxBateauxSalon, navigable, NIVEAU_QUIZ_DEFAUT, niveauQuizValide, nomBeaufort, perteCarte, plafondCases, reglagesSalonValides, rejouer, terreFine, tracerChemin, ventCourant,
} from '../src/index';
import type { Action, CourseDef, Donnees, EtatPartie, ParamsPartie, ReglagesSalon } from '../src/index';

const d = donneesBrutes as unknown as Donnees;
const rhum = d.courses[0];
/** Données à la vitesse 1 (table des voiles brute) : pour les tests unitaires de distance, indépendants du réglage des classes. */
const dUnite: Donnees = { ...d, classes: d.classes.map((c) => ({ ...c, vitesse: 1 })), regles: { ...d.regles, coefficient_force: undefined } };

function params(graine = 42, humains = 0, opts: Partial<ParamsPartie['options']> = {}): ParamsPartie {
  const ids = d.skippers.slice(0, 4).map((s) => s.id);
  return {
    courseId: 'route-du-rhum',
    classe: 'IMOCA',
    graine,
    participants: ids.map((id, i) => ({
      nom: i < humains ? `Joueur ${i + 1}` : `IA ${i + 1}`,
      type: i < humains ? 'humain' : 'ia',
      niveauIA: 'moyen',
      niveauQuiz: 2,
      skipperId: id,
    })),
    options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false, ...opts },
  };
}

/** Petite course de test : mer ouverte 12 x 5, départ à gauche, arrivée à droite. */
function courseTest(lignes: string[], zones: CourseDef['zones_meteo'] = []): CourseDef {
  const arrivee: number[][] = [];
  lignes.forEach((l, y) => [...l].forEach((c, x) => c === 'A' && arrivee.push([x, y])));
  return {
    ...rhum,
    id: 'test',
    carte: { largeur: lignes[0].length, hauteur: lignes.length, bouclage_horizontal: false, lignes },
    portes: [{ id: 'arrivee', nom: 'Arrivée', type: 'arrivee', cases: arrivee }],
    zones_meteo: zones,
    zones_cotieres: undefined,
    echelle: 1,
    milles_par_case: 1,
  };
}

const profil = (competence = 'aucune', famille = 'imoca_derives', x = 1, y = 1) => ({ competence, famille, x, y });

describe('allure (§3.3)', () => {
  it('calcule l\'angle entre le cap et le vent', () => {
    expect(angleAllure(0, 0)).toBe(0);
    expect(angleAllure(12, 2)).toBe(135); // exemple de la règle de 1987 : vent NE, cap W = grand largue
    expect(angleAllure(12, 4)).toBe(180);
    expect(angleAllure(4, 0)).toBe(90);
    expect(angleAllure(14, 0)).toBe(45);
    expect(angleAllure(1, 0)).toBe(22.5);
    expect(angleAllure(3, 0)).toBe(67.5);
  });
});

describe('distance et risque (§3.4)', () => {
  const d = dUnite;
  const carte = compilerCarte(courseTest(['............', '............', '............']));
  it('reprend la table des voiles', () => {
    // Vent de l'est (4), cap ouest (12) : vent arrière ; force 4.
    expect(calculerDistance(d, carte, profil(), 'spi', 12, { direction: 4, force: 4 }).distance).toBe(6);
    expect(calculerDistance(d, carte, profil(), 'spi', 0, { direction: 4, force: 4 }).distance).toBe(null); // travers : spi inutilisable
    // Face au vent : louvoyage à la moitié de la distance au près (solent : 3 × 0,5 = 1,5 → 2).
    expect(calculerDistance(d, carte, profil(), 'solent', 4, { direction: 4, force: 4 }).distance).toBe(2);
    expect(calculerDistance(d, carte, profil(), 'solent', 3, { direction: 4, force: 4 }).louvoyage).toBe(true);
    // Une voile de portant ne permet pas de louvoyer.
    expect(calculerDistance(d, carte, profil(), 'spi', 4, { direction: 4, force: 4 }).distance).toBe(null);
    expect(calculerDistance(d, carte, profil(), 'gennaker', 3, { direction: 4, force: 4 }).distance).toBe(null);
  });
  it('interpole les allures intermédiaires', () => {
    // Vent du nord (0). Cap 3 (ENE) = 67,5° ; cap 5 (ESE) = 112,5° ; cap 7 (SSE) = 157,5°.
    expect(calculerDistance(d, carte, profil(), 'solent', 3, { direction: 0, force: 4 }).distance).toBe(3); // (3 + 3) / 2
    expect(calculerDistance(d, carte, profil(), 'code0', 3, { direction: 0, force: 4 }).distance).toBeNull(); // code 0 à partir du travers (12/11/2026)
    expect(calculerDistance(d, carte, profil(), 'spi', 5, { direction: 0, force: 3 }).distance).toBeNull(); // spi à partir de 135° (12/11/2026)
    expect(calculerDistance(d, carte, profil(), 'gennaker', 5, { direction: 0, force: 3 }).distance).toBe(4); // (3 + 5) / 2, gennaker dès 112,5°
    expect(calculerDistance(d, carte, profil(), 'gennaker', 7, { direction: 0, force: 3 }).distance).toBe(4); // (5 + 4) / 2
    // L'allure intermédiaire répond aux effets des allures voisines : dérives droites −1 au largue (F4+).
    expect(calculerDistance(d, carte, profil(), 'gennaker', 5, { direction: 0, force: 4 }).distance).toBe(3);
  });
  it('convertit en cases selon l\'échelle de la carte', () => {
    const fine = compilerCarte({ ...courseTest(['............', '............', '...........A']), id: 'fine', echelle: 2.5 });
    expect(calculerDistance(d, fine, profil(), 'spi', 8, { direction: 0, force: 4 }).distance).toBe(15);
  });
  it("avarie durable : chaque tour suivant perd sa part de l'avance, pas le tour de la carte (déjà compté)", () => {
    const fine = compilerCarte({ ...courseTest(['............', '............', '...........A']), id: 'fine', echelle: 2.5 });
    const avec = (...m: object[]) => ({ ...profil(), modificateurs: m as never });
    const foil = { id: 'foil', titre: 'Foil', distance: 0, perte: 0.25, risque: 0, toursRestants: 2, nouveau: false };
    const vent = { direction: 0, force: 4 };
    expect(calculerDistance(d, fine, avec(), 'spi', 8, vent).distance).toBe(15);
    expect(calculerDistance(d, fine, avec(foil), 'spi', 8, vent).distance).toBe(11); // 15 × 0,75
    expect(calculerDistance(d, fine, avec({ ...foil, nouveau: true }), 'spi', 8, vent).distance).toBe(15);
    // Deux avaries en même temps se multiplient : 15 × 0,75 = 11, puis 11 × 0,5 = 6.
    expect(calculerDistance(d, fine, avec(foil, { ...foil, id: 'empannage', perte: 0.5 }), 'spi', 8, vent).distance).toBe(6);
    // Le risque d'un modificateur ne compte pas non plus le tour de la carte.
    const quille = { ...foil, id: 'quille', risque: 1 };
    const r0 = calculerRisque(d, fine, avec(), 'spi', vent).risque;
    expect(calculerRisque(d, fine, avec(quille), 'spi', vent).risque).toBe(r0 + 1);
    expect(calculerRisque(d, fine, avec({ ...quille, nouveau: true }), 'spi', vent).risque).toBe(r0);
  });
  it('applique les modificateurs de force', () => {
    expect(calculerDistance(d, carte, profil(), 'solent', 2, { direction: 0, force: 2 }).distance).toBe(2); // près 3 × 0,8 = 2,4 → 2 (bonus et malus en %, 12/11/2026)
    expect(calculerDistance(d, carte, profil(), 'gennaker', 8, { direction: 0, force: 1 }).distance).toBe(4); // pas de malus
    expect(calculerDistance(d, carte, profil(), 'j3', 8, { direction: 0, force: 8 }).distance).toBe(2); // arrière 2 × 1,2 = 2,4 → 2
    expect(calculerDistance(d, carte, profil(), 'reduite', 2, { direction: 0, force: 1 }).distance).toBe(1); // minimum 1
  });
  it('applique famille, profil d\'allure et compétence', () => {
    // Foiler au largue F4 : 5 × 1,2 = 6 ; au vent arrière : 6 × 0,8 = 4,8 → 5 (profil d'allure, bonus et malus en %).
    expect(calculerDistance(d, carte, profil('aucune', 'imoca_foiler'), 'gennaker', 6, { direction: 0, force: 4 }).distance).toBe(6);
    expect(calculerDistance(d, carte, profil('aucune', 'imoca_foiler'), 'spi', 8, { direction: 0, force: 4 }).distance).toBe(5);
    const mult = (c: string) => calculerDistance(d, carte, profil(c), 'j3', 4, { direction: 0, force: 7 }).details.find((x) => x.libelle.startsWith('Bonus et malus'))?.valeur ?? 1;
    expect(mult('dur_au_mal')).toBeCloseTo(mult('aucune') * 1.2, 2); // Coriace : un cran de bonus à F7 et plus = +20 %
  });
  it('calcule le niveau de risque borné de 0 à 5', () => {
    expect(calculerRisque(d, carte, profil(), 'spi', { direction: 0, force: 4 }).risque).toBe(2);
    expect(calculerRisque(d, carte, profil('dur_au_mal', 'imoca_foiler'), 'spi', { direction: 0, force: 7 }).risque).toBe(5);
    expect(calculerRisque(d, carte, profil('aucune', 'imoca_derives'), 'reduite', { direction: 0, force: 6 }).risque).toBe(0);
    expect(calculerRisque(d, carte, profil(), null, { direction: 0, force: 8 }).risque).toBe(0);
  });
});

describe('déplacement (§3.1)', () => {
  const opts = { traverse: false, coutBrume: 2, ignoreCourantDefavorable: false };
  it('s\'arrête devant la terre, mais pas devant un bateau hors de la brume (décision du 09/11/2026)', () => {
    const carte = compilerCarte(courseTest(['......#.....', '............', '...........A']));
    const r = tracerChemin(carte, new Set(), [1, 0], 0, 4, 8, { ...opts, enrouler: false });
    expect(r.fin).toEqual([5, 0]);
    expect(r.bloque).toBe('terre');
    // Contournement automatique retiré (12/11/2026) : même près de l'arrivée, la côte arrête le bateau, sauf sur demande.
    expect(tracerChemin(carte, new Set(), [1, 0], 0, 4, 8, opts).bloque).toBe('terre');
    const rc = tracerChemin(carte, new Set(), [1, 0], 0, 4, 8, { ...opts, enrouler: true });
    expect(rc.bloque).toBe(null);
    expect(rc.chemin.length).toBeGreaterThan(4);
    // Un concurrent sur la route ne gêne pas : on passe, et on peut finir sur sa case.
    const r2 = tracerChemin(carte, new Set([1 * 12 + 4]), [1, 1], 0, 4, 8, opts);
    expect(r2.fin).toEqual([9, 1]);
    expect(r2.bloque).toBe(null);
    const r3 = tracerChemin(carte, new Set([1 * 12 + 3]), [1, 1], 0, 4, 2, opts);
    expect(r3.fin).toEqual([3, 1]);
  });
  it('compte la brume double et applique le courant', () => {
    const carte = compilerCarte(courseTest(['............', '............', '...........A'], [
      { type: 'brume', nom: 'Brume', rect: [3, 0, 4, 0] },
      { type: 'courant', nom: 'Courant', rect: [3, 2, 3, 2], direction: 0 },
    ]));
    expect(tracerChemin(carte, new Set(), [1, 0], 0, 4, 5, opts).fin).toEqual([4, 0]); // 1 + 2 + 2
    expect(tracerChemin(carte, new Set(), [1, 0], 0, 4, 5, { ...opts, coutBrume: 1 }).fin).toEqual([6, 0]);
    const c = tracerChemin(carte, new Set(), [1, 2], 0, 4, 3, opts);
    expect(c.fin).toEqual([4, 2]); // dérive intégrée au trajet (11/11/2026) : un tiers de case environ, plus de case entière après coup
    expect(c.courant).toBe(true);
  });
  it('détecte l\'arrivée et la distance dépassée', () => {
    const carte = compilerCarte(courseTest(['..........A.', '..........A.', '..........A.']));
    const r = tracerChemin(carte, new Set(), [7, 1], 0, 4, 6, opts);
    expect(r.arrive).toBe(true);
    expect(r.depassement).toBe(3.5); // la ligne d'arrivée est franchie après 2,5 cases (du centre de la case 7 au bord de la case 10)
  });
  it('avance en distance réelle sur les diagonales et ne coupe pas les coins de terre', () => {
    const carte = compilerCarte(courseTest(['............', '............', '............', '............', '............', '...........A']));
    const r = tracerChemin(carte, new Set(), [0, 0], 0, 6, 7, opts); // SE : 7 pas d'une case ≈ 5 cases en diagonale
    expect(r.fin).toEqual([5, 5]);
    const coin = compilerCarte({ ...courseTest(['.#..........', '#...........', '...........A']), id: 'coin' });
    expect(tracerChemin(coin, new Set(), [0, 0], 0, 6, 3, opts).fin).toEqual([0, 0]);
  });
});

describe('carte de la Route du Rhum', () => {
  const carte = compilerCarte(rhum);
  it('a 8 cases de départ et une arrivée atteignable', () => {
    expect(carte.departs.length).toBe(8);
    for (const [x, y] of carte.departs) expect(distanceRestanteCase(carte, x, y, 0)).toBeLessThan(1000);
  });
});

function jouerPartieIA(graine: number, dd: Donnees = d): EtatPartie {
  const d = dd;
  let e = creerPartie(d, params(graine));
  // Aucun humain : on déclenche la résolution en faisant « choisir » un bateau IA par l'action standard.
  let garde = 0;
  while (e.phase !== 'fin' && garde++ < 200) {
    const b = bateauxAttendus(e)[0];
    if (!b) throw new Error('Aucun bateau à faire jouer');
    e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
  }
  return e;
}

describe('records de distance en 24 h (Ultim, 13/11/2026)', () => {
  const carteDeCourse = (id: string) => compilerCarte(d.courses.find((c) => c.id === id)!);
  const ultim = { famille: 'ultim' };
  it('jauge de l\'Ultim : 851 milles en solitaire, 908 en équipage, au prorata du tour au Fastnet', () => {
    expect(plafondCases(d, carteDeCourse('route-du-rhum'), ultim)).toBe(Math.floor((851 * 23) / 24 / 30)); // 27 cases
    expect(plafondCases(d, carteDeCourse('transat-cafe-lor'), ultim)).toBe(Math.floor((908 * 23) / 24 / 30)); // 29 cases
    expect(plafondCases(d, carteDeCourse('rolex-fastnet'), ultim)).toBe(Math.floor((908 * 4.8) / 24 / 2.55)); // 71 cases
    // Les autres classes gardent leur jauge (640 milles en IMOCA), et rien au Fastnet.
    expect(plafondCases(d, carteDeCourse('route-du-rhum'), { famille: 'imoca_foiler' })).toBe(21);
    expect(plafondCases(d, carteDeCourse('rolex-fastnet'), { famille: 'imoca_foiler' })).toBe(null);
  });
  it('dans les meilleures conditions, l\'Ultim atteint son record sans le dépasser', () => {
    for (const id of ['route-du-rhum', 'transat-cafe-lor', 'rolex-fastnet']) {
      const carte = carteDeCourse(id);
      const p = { ...ultim, competence: 'kiffeur', x: 0, y: 0 };
      // Une case de pleine mer, hors de toute zone.
      outer: for (let y = 0; y < carte.H; y++) for (let x = 0; x < carte.L; x++) if (navigable(carte, x, y) && !carte.zones[y * carte.L + x].length && carte.alize[y * carte.L + x] < 0) { p.x = x; p.y = y; break outer; }
      let meilleur = 0;
      for (const v of ['gennaker', 'spi', 'code0', 'solent'])
        for (let force = 3; force <= 9; force++)
          for (let cap = 0; cap < 16; cap++)
            meilleur = Math.max(meilleur, calculerDistance(d, carte, p, v, cap as never, { direction: 0, force }).distance ?? 0);
      expect(meilleur).toBe(plafondCases(d, carte, ultim));
    }
  });
});

describe('force du vent (09/11/2026)', () => {
  it('la même voile avance nettement moins par petit temps que par bonne brise', () => {
    const carte = compilerCarte(rhum);
    const e = creerPartie(d, params(3));
    const b = { ...e.bateaux[0], x: 60, y: 40 };
    const f2 = calculerDistance(d, carte, b, 'spi', 8, { direction: 0, force: 2 }).distance!;
    const f5 = calculerDistance(d, carte, b, 'spi', 8, { direction: 0, force: 5 }).distance!;
    expect(f2).toBeLessThanOrEqual(Math.ceil(f5 * 0.5));
  });
});

describe('collisions (10/11/2026)', () => {
  it("un bateau rapatrié après une collision n'est pas renvoyé dans la brume ni sur un bateau : pas de collisions en chaîne", () => {
    for (const g of [1, 2, 3, 4, 5, 6]) {
      const e = jouerPartieIA(g);
      const carte = compilerCarte(rhum);
      for (const ev of e.evenements.filter((x) => x.type === 'port' && /rapatrié/.test(x.texte))) {
        const [x, y] = (ev.donnees as { vers: [number, number] }).vers;
        expect(carte.zones[y * carte.L + x].includes('brume')).toBe(false);
      }
      const parBateau = new Map<string, number[]>();
      for (const l of e.journal!) if (/collision/.test(l.issue)) parBateau.set(l.bateauId, [...(parBateau.get(l.bateauId) ?? []), l.tour]);
      for (const tours of parBateau.values()) expect(tours.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('alizés (09/11/2026)', () => {
  it('dans la zone, hors front, le vent reste dans ses bornes : Nord à Est (11/11/2026), force 3 à 7', () => {
    let vus = 0;
    for (const g of [1, 2, 3, 4]) {
      const e = jouerPartieIA(g);
      for (const l of e.journal!) {
        if (!l.ventApres || l.zoneVent !== 'alizé') continue;
        const v = l.ventApres;
        vus++;
        expect(v.direction).toBeGreaterThanOrEqual(0);
        expect(v.direction).toBeLessThanOrEqual(4);
        expect(v.force).toBeGreaterThanOrEqual(3);
        expect(v.force).toBeLessThanOrEqual(7);
      }
    }
    expect(vus).toBeGreaterThan(0);
  });
});

describe('Régatier', () => {
  it("n'entre jamais en collision dans la brume, ni comme abordeur ni comme abordé", () => {
    let collisions = 0;
    // Le deuxième skipper (Richomme) est Régatier ; on le force pour que le test ne dépende pas des données.
    const dg = structuredClone(d);
    dg.skippers[1].competence = 'regatier';
    for (const g of [1, 2, 3, 4, 5, 6]) {
      const e = jouerPartieIA(g, dg);
      const regatiers = new Set(e.bateaux.filter((b) => b.competence === 'regatier').map((b) => b.id));
      expect(regatiers.size).toBeGreaterThan(0);
      for (const ev of e.evenements.filter((x) => x.type === 'collision')) {
        collisions++;
        expect(regatiers.has(ev.bateauId!)).toBe(false);
        expect(regatiers.has((ev.donnees as { autre: string }).autre)).toBe(false);
      }
    }
    void collisions; // depuis le 10/11/2026 les collisions sont rares : le test vérifie seulement qu'aucune n'implique un Régatier
  });
});

describe('journal des mouvements', () => {
  it('une ligne par bateau et par tour, sans aucune anomalie de calcul', () => {
    for (const g of [1, 2, 3]) {
      const e = jouerPartieIA(g);
      expect(e.journal!.length).toBeGreaterThan(e.bateaux.length * 5);
      for (const l of e.journal!) {
        expect(controlerJournal(d, e, l)).toEqual([]);
        // La distance parcourue suit la distance autorisée, à l'arrondi de la grille près.
        if (l.budget !== null && !l.bloque && !l.arrive && l.issue === 'déplacement') expect(Math.abs(l.parcourue - l.budget)).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

describe('noms des forces du vent (bug d\'affichage du 13/11/2026)', () => {
  it('chaque force possible, jusqu\'à la tempête (F11), a son nom sur l\'échelle de Beaufort', () => {
    const plusForte = Math.max(d.regles.force_max, Number(d.regles.tempete?.force_max_fronts ?? 0), ...Object.keys(d.regles.tempete ?? {}).map(Number).filter(Number.isFinite));
    expect(plusForte).toBeGreaterThanOrEqual(11);
    for (let f = 0; f <= plusForte; f++) {
      expect(d.regles.beaufort[f], `F${f}`).toBeTruthy();
      expect(nomBeaufort(d, f)).toBe(d.regles.beaufort[f]);
    }
    expect(nomBeaufort(d, 9)).toBe('Fort coup de vent');
    expect(nomBeaufort(d, 11)).toBe('Violente tempête');
    // Hors de la table : le nom le plus proche, jamais « undefined » (l'affichage planterait).
    expect(nomBeaufort(d, 15)).toBe("Vent d'ouragan");
    expect(nomBeaufort(d, -1)).toBe('Calme');
  });

  it('en course, un bateau pris dans un vent de F9 et plus a un nom de vent, et le journal aussi', () => {
    let tempetes = 0;
    for (const g of [1, 2, 3, 4, 5, 6]) {
      let e = creerPartie(d, params(g));
      let garde = 0;
      while (e.phase !== 'fin' && garde++ < 200) {
        for (const b of e.bateaux) {
          const v = ventCourant(e, b.x, b.y);
          if (v.force >= 9) tempetes++;
          expect(d.regles.beaufort[v.force], `graine ${g}, tour ${e.tour}, F${v.force}`).toBeTruthy();
        }
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
      expect(e.evenements.filter((ev) => ev.texte.includes('undefined')).map((ev) => ev.texte)).toEqual([]);
    }
    expect(tempetes).toBeGreaterThan(0); // le cas qui plantait est bien rencontré
  });
});

describe('partie complète', () => {
  it('se termine, avec un vainqueur arrivé, en un nombre de tours raisonnable', () => {
    // Durée : une partie isolée peut traîner (34 à 38 tours mesurés le 13/11/2026, avec ou sans la zone de dévent), on
    // borne donc chaque partie largement et la médiane de près.
    const tours: number[] = [];
    for (const g of [1, 2, 3, 4, 5]) {
      const e = jouerPartieIA(g);
      expect(e.phase).toBe('fin');
      const premier = e.bateaux.find((b) => b.id === e.classementFinal![0])!;
      expect(premier.arrive).toBe(true);
      expect(e.tour).toBeGreaterThanOrEqual(8);
      expect(e.tour).toBeLessThanOrEqual(45);
      tours.push(e.tour);
    }
    expect(tours.sort((a, b) => a - b)[2]).toBeLessThanOrEqual(25);
  });

  it('Vintage : monocoques et multicoques ont chacun leur vainqueur (deux classements)', () => {
    const fam = (id: string) => d.bateaux.find((b) => b.id === d.skippers.find((s) => s.id === id)!.bateau_id)!.famille;
    const vintage = d.skippers.filter((s) => s.classe === 'VINTAGE').map((s) => s.id);
    const flotte = [...vintage.filter((id) => fam(id) === 'vintage_monocoque').slice(0, 2), ...vintage.filter((id) => fam(id) === 'vintage_multicoque').slice(0, 2)];
    let deux = 0;
    for (const g of [1, 2, 3, 4]) {
      let e = creerPartie(d, {
        courseId: 'route-du-rhum', classe: 'VINTAGE', graine: g,
        participants: flotte.map((id) => ({ nom: 'IA', type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id })),
        options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
      });
      let garde = 0;
      while (e.phase !== 'fin' && garde++ < 2000) {
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
      expect(e.phase).toBe('fin');
      // Une catégorie dont tous les bateaux ont abandonné (chavirage ou démâtage en tempête) n'a pas de vainqueur.
      const tousHors = (f: string) => e.bateaux.filter((b) => fam(b.skipperId) === f).every((b) => b.horsClassement);
      if (!tousHors('vintage_multicoque')) expect(e.vainqueurs?.multicoque).toBeTruthy();
      if (!tousHors('vintage_monocoque')) expect(e.vainqueurs?.monocoque).toBeTruthy();
      if (e.vainqueurs?.monocoque) {
        expect(fam(e.bateaux.find((b) => b.id === e.vainqueurs!.monocoque)!.skipperId)).toBe('vintage_monocoque');
        expect(e.bateaux.find((b) => b.id === e.vainqueurs!.monocoque)!.arrive).toBe(true);
      }
      if (e.vainqueurs?.multicoque && e.vainqueurs?.monocoque) {
        deux++;
        expect(e.evenements.find((x) => x.type === 'fin')!.texte).toMatch(/en multicoques et de .* en monocoques/);
      }
    }
    expect(deux).toBeGreaterThan(0);
  });

  it('est rejouable à l\'identique à partir de la graine et des actions', () => {
    const actions: Action[] = [];
    let e = creerPartie(d, params(7, 1, { quiz: false }));
    let garde = 0;
    while (e.phase !== 'fin' && garde++ < 300) {
      let a: Action;
      if (e.attente) {
        a = e.attente.type === 'relance'
          ? { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false }
          : e.attente.type === 'quiz'
            ? { type: 'RepondreQuiz', bateauId: e.attente.bateauId, reponse: 0 }
            : { type: 'JouerReparation', bateauId: e.attente.bateauId, jouer: true };
      } else {
        const b = humainsAttendus(e)[0];
        a = { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) };
      }
      actions.push(a);
      e = appliquer(d, e, a);
    }
    const rejoue = rejouer(d, params(7, 1, { quiz: false }), actions);
    expect(rejoue).toEqual(e);
    expect(e.phase).toBe('fin');
  });

  it('n\'altère pas l\'état reçu', () => {
    const e = creerPartie(d, params(3, 1));
    const copie = structuredClone(e);
    appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 12, voile: 'solent', distanceMax: null } });
    expect(e).toEqual(copie);
  });

  it('refuse un choix invalide', () => {
    const e = creerPartie(d, params(3, 1));
    expect(() => appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 16, voile: 'solent', distanceMax: null } })).toThrow();
    expect(() => appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b4', choix: { cap: 12, voile: 'code0', distanceMax: null } })).toThrow(); // code 0 inutilisable au près : code 0 laissé à quai
  });

  it('applique les compétences de départ', () => {
    const e = creerPartie(d, params(3));
    const leCam = e.bateaux.find((b) => b.skipperId === 'jean-le-cam')!;
    expect(leCam.reparations).toBe(4); // Bricoleur : +2 cartes réparation (12/11/2026)
    expect(leCam.voiles.length).toBe(7); // le Bricoleur garde toutes ses voiles (09/11/2026), spi de gros temps compris (11/11/2026)
    expect(e.bateaux.find((b) => b.skipperId === 'charlie-dalin')!.relancesRestantes).toBe(1); // Stratège : 1 relance (12/11/2026)
    expect(classement(d, e).length).toBe(4);
  });
});

describe('dé événement et cartes du large', () => {
  const avecCarte = (id: string): Donnees => {
    const dd = structuredClone(d);
    dd.evenements = { de_evenement: { faces: 1, declencheur: 1 }, cartes: dd.evenements!.cartes.filter((c) => c.id === id) };
    dd.regles = { ...dd.regles, de_du_large: { carte: [1, 2, 3, 4, 5, 6], question: [] } };
    return dd;
  };
  const unTour = (dd: Donnees, humains = 0) => {
    let e = creerPartie(dd, params(11, humains, { quiz: false }));
    const b = bateauxAttendus(e)[0];
    e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(dd, e, b.id) });
    return e;
  };
  it('une carte heureuse donne une réparation de plus', () => {
    const e = unTour(avecCarte('boite_outils'));
    const leCam = e.bateaux.find((b) => b.skipperId === 'jean-le-cam')!;
    expect(leCam.reparations).toBe(5);
    expect(e.evenements.some((x) => x.type === 'carte_evenement')).toBe(true);
  });
  it('une avarie durable crée un effet temporaire qui s\'éteint', () => {
    const dd = avecCarte('pilote');
    for (const b of dd.skippers) void b;
    let e = creerPartie(dd, params(11, 0, { quiz: false }));
    // Sans carte réparation, l'avarie s'applique forcément.
    e.bateaux.forEach((b) => (b.reparations = 0));
    const jouerTour = () => {
      const b = bateauxAttendus(e)[0];
      e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(dd, e, b.id) });
    };
    jouerTour();
    expect(e.bateaux.every((b) => b.arrive || b.modificateurs.some((m) => m.id === 'pilote'))).toBe(true);
  });
  it("trop de toile : la voile lâche, un tiers de route ; une carte réparation la repêche avec 40 % d'usure (règle du 13/11/2026, 40 % depuis le 14/11)", () => {
    let essais = 0;
    for (let graine = 1; graine <= 30 && essais < 3; graine++) {
      let e = creerPartie(d, params(graine, 1, { quiz: false }));
      const b1 = e.bateaux.find((b) => b.id === 'b1')!;
      if (b1.famille !== 'imoca_foiler' && b1.famille !== 'imoca_derives') continue;
      e = { ...e, vent: { direction: 4, force: 5 }, desProchains: { force: 2, direction: 0 } }; // vent d'est, F5 → F7 : le spi casse
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 12, voile: 'spi', distanceMax: null } }); // cap à l'ouest, vers le large
      while (e.attente?.type === 'relance') e = appliquer(d, e, { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false });
      if (e.attente?.type !== 'reparation' || e.attente.motif !== 'voile_noire') continue;
      essais++;
      const avant = e.bateaux.find((b) => b.id === 'b1')!;
      const finir = (x: EtatPartie) => {
        while (x.attente) {
          const a = x.attente;
          x = a.type === 'quiz' ? appliquer(d, x, { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: 0 })
            : a.type === 'relance' ? appliquer(d, x, { type: 'RepondreRelance', bateauId: a.bateauId, relancer: false })
            : appliquer(d, x, { type: 'JouerReparation', bateauId: a.bateauId, jouer: false });
        }
        return x;
      };
      const eEndure = finir(appliquer(d, e, { type: 'JouerReparation', bateauId: 'b1', jouer: false }));
      const endure = eEndure.bateaux.find((b) => b.id === 'b1')!;
      expect(endure.voiles).not.toContain('spi');
      // Un tiers de la route (le bateau peut rester sur place si un concurrent occupe la case suivante).
      expect(eEndure.evenements.some((x) => x.tour === 1 && x.bateauId === 'b1' && /un tiers de sa route/.test(x.texte))).toBe(true);
      // Pas de dé du large pour ce bateau ce tour.
      expect(eEndure.evenements.some((x) => x.tour === 1 && x.type === 'de_evenement' && x.bateauId === 'b1')).toBe(false);
      const eRepare = finir(appliquer(d, e, { type: 'JouerReparation', bateauId: 'b1', jouer: true }));
      const repare = eRepare.bateaux.find((b) => b.id === 'b1')!;
      expect(repare.reparations).toBe(avant.reparations - 1);
      // Le spi est repêché avec 40 % d'usure (il peut ensuite exploser en naviguant par F7 : 85 % d'usure par tour).
      expect(eRepare.evenements.some((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'reparation' && /repêché/.test(x.texte))).toBe(true);
    }
    expect(essais).toBeGreaterThan(0);
  });
  it('barème des avaries en part du tour, réparation divisée par deux (barème du 12/11/2026)', () => {
    const p = (effet: object, rep: boolean) => perteCarte(effet as never, rep);
    expect([p({ distance: -1 }, false), p({ distance: -2 }, false), p({ distance: -3 }, false), p({ demi: true }, false), p({ immobile: true }, false)]).toEqual([0.25, 0.5, 0.75, 0.5, 1]);
    expect([p({ distance: -1 }, true), p({ distance: -2 }, true), p({ distance: -3 }, true), p({ demi: true }, true), p({ immobile: true }, true)]).toEqual([0.125, 0.25, 0.375, 0.25, 0.5]);
    expect([p({ perte_voile: ['spi'] }, false), p({ perte_voile: ['spi'] }, true)]).toEqual([0.5, 1]);
    expect(p({ distance: 2 }, false)).toBe(0); // bonne nouvelle : pas de perte
    // Avarie durable : même part à chaque tour ; réparée, 1,5 fois plus ce tour (au plus 100 %), rien ensuite.
    expect([p({ distance: -1, tours: 3 }, false), p({ distance: -2, tours: 2 }, false)]).toEqual([0.25, 0.5]);
    expect([p({ distance: -1, tours: 3 }, true), p({ distance: -2, tours: 2 }, true), p({ distance: -3, tours: 2 }, true)]).toEqual([0.375, 0.75, 1]);
    expect(p({ risque: 1, tours: 2 }, true)).toBe(0); // risque seul : pas de perte d'avance
  });
  it('avarie durable réparée : plus de modificateur ; encaissée : la même part de l\'avance au tour suivant', () => {
    const dd = avecCarte('empannage');
    let e = creerPartie(dd, params(11, 1, { quiz: false }));
    e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: choisirIA(dd, e, 'b1') });
    while (e.attente?.type === 'relance') e = appliquer(dd, e, { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false });
    expect(e.attente).toMatchObject({ type: 'reparation', bateauId: 'b1', motif: 'evenement' });
    const encaisse = appliquer(dd, e, { type: 'JouerReparation', bateauId: 'b1', jouer: false }).bateaux.find((b) => b.id === 'b1')!;
    expect(encaisse.modificateurs.find((m) => m.id === 'empannage')).toMatchObject({ distance: 0, perte: 0.5, toursRestants: 1 });
    const repare = appliquer(dd, e, { type: 'JouerReparation', bateauId: 'b1', jouer: true });
    expect(repare.bateaux.find((b) => b.id === 'b1')!.modificateurs.some((m) => m.id === 'empannage')).toBe(false);
    expect(repare.evenements.some((x) => x.type === 'reparation' && x.bateauId === 'b1' && /les suivants ne coûtent plus rien/.test(x.texte))).toBe(true);
  });
  it("une avarie réparée ne coûte jamais plus de la moitié de l'avance, même par petit temps (water-ballast à F2)", () => {
    const dd = avecCarte('ballast');
    let teste = 0;
    for (let graine = 1; graine <= 80 && teste < 3; graine++) {
      const seul = params(graine, 1, { quiz: false });
      // Un seul bateau : par F2 l'avance n'est que d'une case, un voisin de la ligne de départ l'arrêterait (priorité).
      let e = creerPartie(dd, { ...seul, participants: seul.participants.slice(0, 1) });
      e = { ...e, vent: { direction: 4, force: 2 }, desProchains: { force: 0, direction: 0 } };
      e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 12, voile: 'solent', distanceMax: null } });
      while (e.attente?.type === 'relance') e = appliquer(dd, e, { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false });
      if (e.attente?.type !== 'reparation' || e.attente.motif !== 'evenement') continue;
      teste++;
      const n0 = e.evenements.length;
      e = appliquer(dd, e, { type: 'JouerReparation', bateauId: 'b1', jouer: true });
      for (let g2 = 0; e.attente && g2 < 10; g2++) {
        const a = e.attente;
        e = appliquer(dd, e, a.type === 'relance' ? { type: 'RepondreRelance', bateauId: a.bateauId, relancer: false }
          : a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: -1 } : { type: 'JouerReparation', bateauId: a.bateauId, jouer: false });
      }
      const apres = e.evenements.slice(n0).filter((x) => x.bateauId === 'b1');
      expect(apres.some((x) => x.type === 'bloque' && /water-ballast/i.test(x.texte))).toBe(false);
      expect(apres.some((x) => x.type === 'deplacement' && !/reste sur place/.test(x.texte))).toBe(true);
    }
    expect(teste).toBeGreaterThan(0);
  });
  it('un humain peut annuler une avarie avec une carte réparation', () => {
    const dd = avecCarte('ballast');
    let e = creerPartie(dd, params(5, 1, { quiz: false }));
    e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: choisirIA(dd, e, 'b1') });
    let garde = 0;
    while (e.attente && garde++ < 10) {
      if (e.attente.type === 'reparation' && e.attente.motif === 'evenement') {
        const avant = e.bateaux[0].reparations;
        e = appliquer(dd, e, { type: 'JouerReparation', bateauId: 'b1', jouer: true });
        expect(e.bateaux[0].reparations).toBe(avant - 1);
        return;
      }
      e = e.attente.type === 'relance'
        ? appliquer(dd, e, { type: 'RepondreRelance', bateauId: 'b1', relancer: false })
        : appliquer(dd, e, { type: 'JouerReparation', bateauId: 'b1', jouer: false });
    }
    throw new Error('La décision de réparation n\'a pas été demandée');
  });
});

describe('enchaînement des tours', () => {
  it('ne se bloque jamais, même quand le seul humain est immobilisé', () => {
    for (const graine of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let e = creerPartie(d, params(graine, 1, { quiz: false }));
      let garde = 0;
      while (e.phase !== 'fin') {
        if (++garde > 400) throw new Error(`Partie bloquée (graine ${graine})`);
        if (e.attente) {
          e = e.attente.type === 'relance'
            ? appliquer(d, e, { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false })
            : e.attente.type === 'quiz'
              ? appliquer(d, e, { type: 'RepondreQuiz', bateauId: e.attente.bateauId, reponse: -1 })
              : appliquer(d, e, { type: 'JouerReparation', bateauId: e.attente.bateauId, jouer: false });
          continue;
        }
        const h = humainsAttendus(e)[0];
        if (!h) throw new Error(`Aucun choix possible et aucune décision attendue (graine ${graine}, tour ${e.tour})`);
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: h.id, choix: choisirIA(d, e, h.id, { utilisableMaintenant: true }) });
      }
    }
  });
});

describe('jeu en réseau : niveau des questions de chaque joueur (12/11/2026)', () => {
  it("chaque joueur humain reçoit les questions du niveau qu'il a choisi", () => {
    // Dé du large réglé pour donner une question à chaque tour, sans carte.
    const dd: Donnees = { ...d, regles: { ...d.regles, de_du_large: { carte: [], question: [1, 2, 3, 4, 5, 6] } } };
    const p = params(5, 2, { quiz: true }); // l'option evenements: false couperait tout le dé du large, questions comprises
    p.participants[0].niveauQuiz = 1;
    p.participants[1].niveauQuiz = 3;
    let e = creerPartie(dd, p);
    const vus: Record<string, number[]> = {};
    for (let garde = 0; garde < 80 && e.phase !== 'fin' && Object.values(vus).flat().length < 8; garde++) {
      if (e.attente) {
        const a = e.attente;
        if (a.type === 'quiz') (vus[a.bateauId] ??= []).push(a.niveau);
        e = a.type === 'relance' ? appliquer(dd, e, { type: 'RepondreRelance', bateauId: a.bateauId, relancer: false })
          : a.type === 'quiz' ? appliquer(dd, e, { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: -1 })
          : appliquer(dd, e, { type: 'JouerReparation', bateauId: a.bateauId, jouer: false });
        continue;
      }
      const h = humainsAttendus(e)[0];
      e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: h.id, choix: choisirIA(dd, e, h.id, { utilisableMaintenant: true }) });
    }
    expect(vus.b1?.length).toBeGreaterThan(0);
    expect(vus.b2?.length).toBeGreaterThan(0);
    expect([...new Set(vus.b1)]).toEqual([1]);
    expect([...new Set(vus.b2)]).toEqual([3]);
  });
  it('un niveau reçu par le réseau est ramené à un niveau connu, 2 par défaut', () => {
    expect([1, 2, 3, 0, 4, '2', null, undefined].map(niveauQuizValide)).toEqual([1, 2, 3, null, null, null, null, null]);
    expect(NIVEAU_QUIZ_DEFAUT).toBe(2);
  });
});

describe('jeu en réseau : Route du Rhum, Transat Café L\'Or et Rolex Fastnet Race (13/11/2026)', () => {
  const base: ReglagesSalon = { nbBateaux: 6, niveauIA: 'moyen', options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false }, delaiQuiz: 30 };
  it('les trois courses sont jouables en réseau, pas les tours du monde', () => {
    expect(coursesReseau(d).map((c) => c.id).sort()).toEqual(['rolex-fastnet', 'route-du-rhum', 'transat-cafe-lor']);
    expect(reglagesSalonValides(d, { ...base, courseId: 'vendee-globe' }).courseId).toBe('route-du-rhum');
    expect(reglagesSalonValides(d, { ...base, courseId: 'course-inconnue' }).courseId).toBe('route-du-rhum');
  });
  it('la classe doit être admise sur la course (pas de Vintage à la Transat Café L\'Or)', () => {
    expect(classesDeCourse(d, 'route-du-rhum')).toContain('VINTAGE');
    expect(classesDeCourse(d, 'rolex-fastnet')).toContain('VINTAGE');
    expect(classesDeCourse(d, 'transat-cafe-lor')).not.toContain('VINTAGE');
    expect(reglagesSalonValides(d, { ...base, courseId: 'transat-cafe-lor', classe: 'VINTAGE' }).classe).toBe('IMOCA');
    expect(reglagesSalonValides(d, { ...base, courseId: 'rolex-fastnet', classe: 'VINTAGE' }).classe).toBe('VINTAGE');
  });
  it('course en double : deux skippers par bateau, donc moins de bateaux au plus', () => {
    const n = d.skippers.filter((k) => k.classe === 'IMOCA').length;
    expect(maxBateauxSalon(d, 'transat-cafe-lor', 'IMOCA')).toBe(Math.min(10, Math.floor(n / 2)));
    expect(reglagesSalonValides(d, { ...base, courseId: 'transat-cafe-lor', classe: 'IMOCA', nbBateaux: 10 }).nbBateaux).toBe(Math.min(10, Math.floor(n / 2)));
    expect(reglagesSalonValides(d, { ...base, courseId: 'rolex-fastnet', classe: 'IMOCA', nbBateaux: 1 }).nbBateaux).toBe(2);
  });
  it('une partie de chaque course se crée avec les réglages du salon', () => {
    for (const courseId of ['transat-cafe-lor', 'rolex-fastnet']) {
      const r = reglagesSalonValides(d, { ...base, courseId, classe: 'CLASS40', nbBateaux: 4 });
      const ids = d.skippers.filter((k) => k.classe === r.classe).map((k) => k.id);
      const double = courseId === 'transat-cafe-lor';
      const e = creerPartie(d, {
        courseId: r.courseId!, classe: r.classe!, graine: 3, options: r.options,
        participants: ids.slice(0, r.nbBateaux).map((id, i) => ({ nom: `J${i}`, type: i < 2 ? 'humain' : 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: id, ...(double ? { coSkipperId: ids[ids.length - 1 - i] } : {}) })),
      });
      expect(e.params.courseId).toBe(courseId);
      expect(e.bateaux).toHaveLength(4);
    }
  });
});

describe('étape des voiles : changement de voile, tempête, rapatriement (13/11/2026)', () => {
  const jouerJusqua = (dd: Donnees, e: EtatPartie, fin: (x: EtatPartie) => boolean, max = 40) => {
    for (let i = 0; i < max && !fin(e) && e.phase !== 'fin'; i++) {
      if (e.attente) {
        const a = e.attente;
        e = a.type === 'quiz' ? appliquer(dd, e, { type: 'RepondreQuiz', bateauId: a.bateauId, reponse: 0 })
          : a.type === 'relance' ? appliquer(dd, e, { type: 'RepondreRelance', bateauId: a.bateauId, relancer: false })
          : appliquer(dd, e, { type: 'JouerReparation', bateauId: a.bateauId, jouer: false });
        continue;
      }
      const b = bateauxAttendus(e)[0];
      if (!b) break;
      e = appliquer(dd, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(dd, e, b.id) });
    }
    return e;
  };
  it('le vent tourne : la voile change d\'office, la moitié de la route, pas de carte du large', () => {
    let vu = 0;
    for (let g = 1; g <= 40 && vu < 2; g++) {
      let e = creerPartie(d, params(g, 0));
      // Vent du nord F3, cap au sud sous spi, puis le vent passe au sud : le spi ne porte plus face au vent.
      // Sans relance du dé de direction (b1 peut être Stratège) : le vent tourne pour de bon.
      e = { ...e, vent: { direction: 0, force: 3 }, desProchains: { force: 0, direction: 8 }, bateaux: e.bateaux.map((b) => (b.id === 'b1' ? { ...b, relancesRestantes: 0 } : b)) };
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 8, voile: 'spi', distanceMax: null } });
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const ev = e.evenements.find((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'bloque');
      if (!ev || !(ev.donnees as { nouvelle?: string }).nouvelle) continue;
      vu++;
      expect(ev.texte).toMatch(/la moitié de sa route/);
      expect(e.evenements.some((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'carte_evenement')).toBe(false);
    }
    expect(vu).toBeGreaterThan(0);
  });
  it('le vent tourne et la voile sort de sa plage à la nouvelle allure : changement de voile, pas trop de toile (14/11/2026)', () => {
    let vu = 0;
    for (let g = 1; g <= 40 && vu < 2; g++) {
      let e = creerPartie(d, params(g, 0));
      // Vent du nord F6, cap au sud sous code 0 (vent arrière : jusqu'à F6) ; le vent passe au nord-est : grand largue, où le
      // code 0 ne tient que jusqu'à F5. La force ne change pas : c'est la rotation qui condamne la voile.
      e = { ...e, vent: { direction: 0, force: 6 }, desProchains: { force: 0, direction: 2 }, bateaux: e.bateaux.map((b) => (b.id === 'b1' ? { ...b, relancesRestantes: 0 } : b)) };
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 8, voile: 'code0', distanceMax: null } });
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const ev = e.evenements.find((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'bloque');
      if (!ev || !(ev.donnees as { nouvelle?: string }).nouvelle) continue;
      vu++;
      expect(ev.texte).toMatch(/la moitié de sa route/);
      expect(e.evenements.some((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'jet_risque')).toBe(false);
      expect(e.bateaux.find((b) => b.id === 'b1')!.voiles).toContain('code0');
    }
    expect(vu).toBeGreaterThan(0);
  });
  it('à la cape (14/11/2026) : au-delà de F9, la voilure réduite est affalée et le bateau dérive d\'une case sous le vent, sans dé du large', () => {
    let vu = 0;
    for (let g = 1; g <= 40 && vu < 2; g++) {
      let e = creerPartie(d, params(g, 0));
      e = { ...e, vent: { direction: 4, force: 9 }, desProchains: { force: 1, direction: 0 }, bateaux: e.bateaux.map((b) => (b.id === 'b1' ? { ...b, relancesRestantes: 0 } : b)) };
      const [x0, y0] = [e.bateaux.find((b) => b.id === 'b1')!.x, e.bateaux.find((b) => b.id === 'b1')!.y];
      e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: 12, voile: 'reduite', distanceMax: null } });
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const ev = e.evenements.find((x) => x.tour === 1 && x.bateauId === 'b1' && x.type === 'deplacement');
      if (!ev || !(ev.donnees as { cape?: boolean }).cape) continue; // démâté par le dé de tempête
      vu++;
      expect(ev.texte).toMatch(/à la cape, à sec de toile/);
      const b = e.bateaux.find((x) => x.id === 'b1')!;
      expect(b.voiles).toContain('reduite'); // affalée, pas perdue
      expect(e.evenements.some((x) => x.tour === 1 && x.bateauId === 'b1' && (x.type === 'de_evenement' || x.type === 'jet_risque'))).toBe(false);
      // Une case au plus, sous le vent (le vent vient de l'est : vers l'ouest), jamais au vent.
      expect(Math.abs(b.x - x0)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y - y0)).toBeLessThanOrEqual(1);
      expect(b.x).toBeLessThanOrEqual(x0);
    }
    expect(vu).toBeGreaterThan(0);
  });
  it('démâtage : rapatriement par la mer, 250 milles par tour au plus, puis 1 tour de réparation et des voiles neuves', () => {
    let vu = 0;
    for (let g = 1; g <= 30 && vu < 1; g++) {
      let e = creerPartie(d, params(g, 0));
      e = { ...e, vent: { direction: 10, force: 11 }, desProchains: { force: 0, direction: 0 } };
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const demate = e.evenements.find((x) => x.tour === 1 && x.type === 'demate' && (x.donnees as { port?: string })?.port);
      if (!demate) continue;
      vu++;
      const id = demate.bateauId!;
      const carte = compilerCarte(rhum);
      // Chaque déplacement de rapatriement : 250 milles au plus, par des cases de mer.
      e = jouerJusqua(d, e, (x) => x.evenements.some((v) => v.type === 'port' && v.bateauId === id), 60);
      const routes = e.evenements.filter((x) => x.bateauId === id && x.type === 'deplacement' && /gréement de fortune/.test(x.texte));
      expect(routes.length).toBeGreaterThan(0);
      for (const r of routes) {
        expect(Number(/(\d+) milles/.exec(r.texte)![1])).toBeLessThanOrEqual(250);
        for (const [x, y] of (r.donnees as { chemin: [number, number][] }).chemin) expect(carte.type[y * carte.L + x] === 'P' || navigable(carte, x, y)).toBe(true);
      }
      const b = e.bateaux.find((x) => x.id === id)!;
      expect(e.evenements.some((v) => v.type === 'port' && v.bateauId === id)).toBe(true);
      expect(b.voiles.length).toBe(b.voilesDepart.length);
      expect(b.horsClassement).toBe(false);
    }
    expect(vu).toBeGreaterThan(0);
  });
  it('Coriace (Jérémie Beyou) : chances de démâtage réduites en tempête (F9 aucune, F11 un 4, 5 ou 6)', () => {
    const coriace = d.competences.find((c) => c.id === 'dur_au_mal')!;
    expect(coriace.speciaux.tempete).toMatchObject({ '9': [], '10': [6], '11': [4, 5, 6] });
    expect(coriace.bonus).toMatch(/démâtage réduites/);
    // À F9, Jérémie Beyou ne démâte jamais.
    const ids = [...d.skippers.filter((s) => s.classe === 'IMOCA').map((s) => s.id).filter((id) => id !== 'jeremie-beyou').slice(0, 3), 'jeremie-beyou'];
    for (let g = 1; g <= 20; g++) {
      let e = creerPartie(d, { courseId: 'route-du-rhum', classe: 'IMOCA', graine: g, options: { quiz: false, bulletinMeteo: true, nomsReels: true, courseComplete: false },
        participants: ids.map((id) => ({ nom: 'IA', type: 'ia', niveauIA: 'moyen', niveauQuiz: 2, skipperId: id })) });
      e = { ...e, vent: { direction: 10, force: 9 }, desProchains: { force: 0, direction: 0 } };
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const beyou = e.bateaux.find((b) => b.skipperId === 'jeremie-beyou')!;
      expect(e.evenements.some((x) => x.tour === 1 && x.type === 'demate' && x.bateauId === beyou.id)).toBe(false);
    }
  });
  it('Rolex Fastnet Race : pas de port d\'escale, un démâtage est une fin de course', () => {
    const fastnet = d.courses.find((c) => c.id === 'rolex-fastnet')!;
    expect(compilerCarte(fastnet).ports.length).toBe(0);
    let vu = 0;
    for (let g = 1; g <= 30 && vu < 1; g++) {
      let e = creerPartie(d, { ...params(g, 0), courseId: 'rolex-fastnet' });
      e = { ...e, vent: { direction: 10, force: 11 }, desProchains: { force: 0, direction: 0 } };
      e = jouerJusqua(d, e, (x) => x.tour > 1);
      const demate = e.evenements.find((x) => x.tour === 1 && x.type === 'demate');
      if (!demate) continue;
      vu++;
      expect(demate.texte).toMatch(/fin de course/);
      expect(e.bateaux.find((x) => x.id === demate.bateauId)!.horsClassement).toBe(true);
    }
    expect(vu).toBeGreaterThan(0);
  });
});

describe('dé du large lancé par tous ensemble (13/11/2026)', () => {
  it('après le vent, les dés de tous les joueurs se suivent, avant toute question ou carte', () => {
    for (const g of [3, 8, 21]) {
      let e = creerPartie(d, params(g, 3));
      while (e.phase === 'choix') {
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
      // Relance du Stratège : elle se joue juste après les dés du vent, avant le large (13/11/2026).
      while (e.attente?.type === 'relance') e = appliquer(d, e, { type: 'RepondreRelance', bateauId: e.attente.bateauId, relancer: false });
      const tour = e.evenements.filter((x) => x.tour === 1);
      const i = tour.findIndex((x) => x.type === 'de_evenement') - 1;
      const des = tour.slice(i + 1).findIndex((x) => x.type !== 'de_evenement');
      const bloc = des < 0 ? tour.slice(i + 1) : tour.slice(i + 1, i + 1 + des);
      // Les trois joueurs humains ont leur dé dans ce premier bloc, même si l'un d'eux doit ensuite répondre à une question.
      expect(new Set(bloc.filter((x) => e.bateaux.find((b) => b.id === x.bateauId)?.type === 'humain').map((x) => x.bateauId)).size).toBe(3);
      expect(e.resolution?.desLarge ?? {}).toBeTypeOf('object');
    }
  });
});

describe('routeur : voile conseillée pour le cap choisi par le joueur (13/11/2026)', () => {
  it('garde le cap imposé et conseille une voile du bateau, utilisable à ce cap', () => {
    const e = creerPartie(d, params(5));
    const b = e.bateaux[0];
    for (let cap = 0; cap < 16; cap++) {
      const c = choisirIA(d, structuredClone(e), b.id, { cap });
      expect(c.cap).toBe(cap);
      if (c.voile !== null) {
        expect(b.voiles).toContain(c.voile);
        expect(calculerDistance(d, compilerCarte(rhum), b, c.voile, cap, ventCourant(e, b.x, b.y)).distance).not.toBeNull();
      }
    }
  });
});

describe('départ', () => {
  it('tous les bateaux partent de la même case', () => {
    const e = creerPartie(d, params(9));
    const cases = new Set(e.bateaux.map((b) => `${b.x},${b.y}`));
    expect(cases.size).toBe(1);
  });
});

describe('équité humain / IA', () => {
  it('la distance attendue affichée tient compte des dés : jamais plus que le meilleur jet possible', () => {
    const e = creerPartie(d, params(5));
    const b = e.bateaux[0];
    for (let cap = 0; cap < 16; cap++)
      for (const v of b.voiles) {
        const { attendu, pNoir } = distanceAttendue(d, e, b.id, v, cap);
        expect(attendu).toBeGreaterThanOrEqual(0);
        expect(pNoir).toBeGreaterThanOrEqual(0);
        expect(pNoir).toBeLessThanOrEqual(1);
        const max = Math.max(0, ...[-2, 0, 2].flatMap((dd) => [-2, 0, 2].map((df) => calculerDistance(d, compilerCarte(rhum), b, v, cap, {
          direction: (ventCourant(e, b.x, b.y).direction + dd + 16) % 16, force: Math.max(1, Math.min(12, ventCourant(e, b.x, b.y).force + df)),
        }).distance ?? 0)));
        expect(attendu).toBeLessThanOrEqual(max + 1e-9);
      }
  });

  it("l'IA ne peut choisir qu'un cap et une voile utilisables avec le vent actuel, comme un humain", () => {
    for (const graine of [1, 2, 3]) {
      let e = creerPartie(d, params(graine));
      let garde = 0;
      while (e.phase !== 'fin' && garde++ < 60) {
        for (const b of bateauxAttendus(e)) {
          const c = choisirIA(d, e, b.id);
          expect(calculerDistance(d, compilerCarte(rhum), b, c.voile, c.cap!, ventCourant(e, b.x, b.y)).distance).not.toBeNull();
        }
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
    }
  });
  it('face au vent : louvoyage accepté avec une voile de près, refusé avec une voile de portant', () => {
    const e = creerPartie(d, params(4, 1));
    const capFace = e.vent.direction; // pile dans le vent
    expect(() => appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: capFace, voile: 'spi', distanceMax: null } })).toThrow();
    expect(() => appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: 'b1', choix: { cap: capFace, voile: 'solent', distanceMax: null } })).not.toThrow();
  });
  it('louvoyer reste moins efficace que naviguer au près à 45° (vers un même objectif)', () => {
    const carte = compilerCarte(courseTest(['............', '............', '...........A']));
    for (const v of ['reduite', 'j3', 'solent']) {
      const louvoyage = calculerDistance(d, carte, profil(), v, 0, { direction: 0, force: 4 }).distance!;
      const pres = calculerDistance(d, carte, profil(), v, 2, { direction: 0, force: 4 }).distance! * Math.SQRT1_2;
      expect(louvoyage).toBeLessThanOrEqual(Math.ceil(pres) + 0.01);
    }
  });
  it("ne traverse jamais la terre, même une presqu'île plus étroite qu'une case (Le Havre et le Cotentin, signalé le 10/11/2026)", () => {
    for (const id of ['transat-cafe-lor', 'route-du-rhum']) {
      const carte = compilerCarte(d.courses.find((c) => c.id === id)!);
      for (const [x, y] of carte.departs)
        for (let cap = 0; cap < 16; cap++) {
          const r = tracerChemin(carte, new Set(), [x, y], 0, cap, 14, { traverse: false, coutBrume: 2 });
          const [fx, fy] = r.finExacte;
          const n = Math.ceil(Math.hypot(fx - x - 0.5, fy - y - 0.5) * 8); // précision du moteur : un contrôle tous les huitièmes de case
          for (let k = 1; k <= n; k++) expect(terreFine(carte, x + 0.5 + ((fx - x - 0.5) * k) / n, y + 0.5 + ((fy - y - 0.5) * k) / n)).toBe(false);
        }
    }
  });
  it("à F1, le dé de force n'indique jamais une baisse (règle du porteur de projet)", () => {
    expect(facesForce(d, 1).every((f) => f >= 0)).toBe(true);
    expect(facesForce(d, 1).filter((f) => f > 0).length).toBeGreaterThanOrEqual(4);
    expect(facesForce(d, 4)).toEqual(d.regles.de_force);
  });
  it('plages de force des voiles, les mêmes pour toutes les classes et toutes les compétences (porteur de projet, 14/11/2026)', () => {
    const carte = compilerCarte(courseTest(['............', '............', '............']));
    // [voile, cap avec un vent du nord, force la plus forte tenue] : cap 4 = travers, 6 = largue, 7 = entre largue et vent
    // arrière (la plus basse des deux plages), 8 = vent arrière.
    const plages: [string, number, number][] = [
      ['reduite', 8, 9], ['j3', 4, 7], ['j3', 8, 7], ['solent', 4, 5], ['solent', 8, 5],
      ['code0', 4, 4], ['code0', 6, 5], ['code0', 7, 5], ['code0', 8, 6],
      ['gennaker', 6, 5], ['gennaker', 8, 6], ['spi', 6, 4], ['spi', 8, 5], ['spi_gros_temps', 6, 6], ['spi_gros_temps', 8, 7],
    ];
    for (const famille of ['imoca_foiler', 'imoca_derives', 'ultim', 'ocean_fifty', 'class40', 'ultim_ancien', 'vintage_monocoque', 'vintage_multicoque'])
      for (const competence of ['aucune', 'prudent', 'dur_au_mal']) {
        const p = profil(competence, famille);
        for (const [v, cap, max] of plages) {
          expect(calculerRisque(d, carte, p, v, { direction: 0, force: max }, cap).risque, `${famille} ${competence} ${v} cap ${cap} F${max}`).toBeLessThan(5);
          expect(calculerRisque(d, carte, p, v, { direction: 0, force: max + 1 }, cap).risque, `${famille} ${competence} ${v} cap ${cap} F${max + 1}`).toBe(5);
        }
      }
  });
  it('louvoyage : 60 % de la distance au près affichée, à la case près (contrôle du 10/11/2026)', () => {
    const carte = compilerCarte(courseTest(['............', '............', '...........A']));
    const coef = d.regles.louvoyage!.coefficient;
    for (const vitesse of [1, 3.7, 10, 17.3]) {
      const dv = { ...d, classes: d.classes.map((c) => ({ ...c, vitesse })) };
      for (const force of [3, 4, 6]) {
        for (const v of ['reduite', 'j3', 'solent']) {
          const louvoyage = calculerDistance(dv, carte, profil(), v, 0, { direction: 0, force }).distance!;
          const pres = calculerDistance(dv, carte, profil(), v, 2, { direction: 0, force }).distance!;
          expect(Math.abs(louvoyage - pres * coef)).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });
});

describe('fronts météo', () => {
  it('le vent courant est celui du front dans la zone, basculé dans la traîne', () => {
    const e = creerPartie(d, params(3));
    const b = e.bateaux[0];
    e.fronts = [{ id: 'f', x: b.x + 0.5, y: b.y + 0.5, vx: 4, vy: 1, rx: 5, ry: 5, direction: 10, force: 8, bascule: 4, baisse: 2, annonce: 0, age: 0 }];
    expect(ventCourant(e, b.x, b.y)).toEqual({ direction: 10, force: 8 });
    e.fronts[0].x = b.x + 0.5 + 4 * 2.2; // le front est passé : le bateau est dans la traîne
    e.fronts[0].y = b.y + 0.5 + 2.2;
    expect(ventCourant(e, b.x, b.y)).toEqual({ direction: 14, force: 6 });
    e.fronts[0].annonce = 2; // annoncé seulement : aucun effet
    expect(ventCourant(e, b.x, b.y)).toEqual(e.vent);
  });
  it('des fronts apparaissent au fil des parties, annoncés à l\'avance', () => {
    let vus = 0;
    for (const g of [1, 2, 3, 4, 5, 6]) {
      let e = creerPartie(d, params(g));
      while (e.phase !== 'fin') {
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
      if (e.evenements.some((x) => x.type === 'meteo' && x.texte.startsWith('Bulletin'))) vus++;
    }
    expect(vus).toBeGreaterThanOrEqual(3);
  });
});

describe('brume, fronts et Bricoleur', () => {
  const opts = { traverse: false, coutBrume: 2, ignoreCourantDefavorable: false };
  it('dans la brume, on percute un concurrent invisible ; hors brume, on le dépasse sans gêne', () => {
    const carte = compilerCarte({ ...courseTest(['............', '............', '...........A'], [{ type: 'brume', nom: 'Brume', rect: [0, 1, 11, 1] }]), id: 'brume' });
    const r = tracerChemin(carte, new Set([1 * 12 + 4]), [1, 1], 0, 4, 8, opts);
    expect(r.bloque).toBe('collision');
    const r2 = tracerChemin(carte, new Set([0 * 12 + 4]), [1, 0], 0, 4, 8, opts);
    expect(r2.bloque).toBe(null);
    expect(r2.fin).toEqual([9, 0]);
  });
  it('jamais plus de 2 fronts par course', () => {
    for (const g of [1, 2, 3, 4, 5]) {
      let e = creerPartie(d, params(g));
      while (e.phase !== 'fin') {
        const b = bateauxAttendus(e)[0];
        e = appliquer(d, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(d, e, b.id) });
      }
      expect(e.evenements.filter((x) => x.type === 'meteo' && x.texte.startsWith('Bulletin : une dépression')).length).toBeLessThanOrEqual(2);
    }
  });
});

describe('molle des Antilles et brume irlandaise (13/11/2026)', () => {
  it('Route du Rhum : la zone de dévent des Antilles est là dans toutes les parties, ailleurs la molle reste possible', () => {
    for (let g = 1; g <= 60; g++) expect(creerPartie(d, params(g)).fronts.some((f) => f.type === 'molle' && !!f.contour)).toBe(true);
    // Transat Café L'Or : molle tirée au hasard (60 %), donc absente d'au moins une partie sur 60.
    const transat = d.courses.find((c) => c.id === 'transat-cafe-lor')!;
    const ids = d.skippers.filter((k) => k.classe === 'IMOCA').map((k) => k.id);
    const sans = Array.from({ length: 60 }, (_, g) => creerPartie(d, {
      courseId: transat.id, classe: 'IMOCA', graine: g + 1, options: params().options,
      participants: ids.slice(0, 2).map((id, i) => ({ nom: `J${i}`, type: 'ia' as const, niveauIA: 'moyen' as const, niveauQuiz: 2 as const, skipperId: id, coSkipperId: ids[ids.length - 1 - i] })),
    })).filter((e) => !e.fronts.some((f) => f.type === 'molle')).length;
    expect(sans).toBeGreaterThan(0);
  });
  it('Route du Rhum : la molle dessinée épouse l\'arc antillais à l\'est et s\'étale à l\'ouest', () => {
    let e: EtatPartie | null = null;
    for (let g = 1; g < 50 && !e; g++) {
      const p = creerPartie(d, params(g));
      if (p.fronts.some((f) => f.type === 'molle')) e = p;
    }
    expect(e).not.toBeNull();
    const molle = e!.fronts.find((f) => f.type === 'molle')!;
    expect(molle.contour?.length).toBeGreaterThan(10);
    const dans = (x: number, y: number) => frontSur({ fronts: [molle] }, x, y) !== null;
    // Guadeloupe et ses cases d'arrivée, l'arc au nord-ouest, l'ouest de la carte, la Martinique.
    for (const [x, y] of [[7, 84], [7, 85], [8, 85], [8, 86], [6, 84], [5, 83], [4, 82], [1, 85], [2, 89], [8, 88]]) expect(dans(x, y), `${x},${y}`).toBe(true);
    // Rien à l'est de l'arc (Atlantique), ni au nord d'Anguilla, ni au sud de Saint-Vincent.
    for (const [x, y] of [[9, 84], [9, 85], [9, 88], [10, 83], [8, 83], [3, 79], [7, 93]]) expect(dans(x, y), `${x},${y}`).toBe(false);
  });
  it('brume au sud-ouest de l\'Irlande sur les cartes du Fastnet, du Rhum et de la Transat', () => {
    for (const id of ['rolex-fastnet', 'route-du-rhum', 'transat-cafe-lor']) {
      const c = d.courses.find((x) => x.id === id)!;
      expect(c.zones_meteo.some((z) => z.type === 'brume' && z.nom.includes('Irlande')), id).toBe(true);
    }
    // Fastnet : la ligne de passage à l'ouest du rocher (rangée 19) reste hors de la brume.
    const fastnet = compilerCarte(d.courses.find((x) => x.id === 'rolex-fastnet')!);
    expect(fastnet.zones[19 * fastnet.L + 40].includes('brume')).toBe(false);
    expect(fastnet.zones[30 * fastnet.L + 40].includes('brume')).toBe(true);
  });
});

describe('départage des arrivées au même tour (11/11/2026)', () => {
  it('taux de bonnes réponses, puis nombre de bonnes réponses, puis le moins de milles', () => {
    const e = creerPartie(d, params());
    const [a, b, c, x] = e.bateaux;
    for (const o of [a, b, c]) Object.assign(o, { arrive: true, tourArrivee: 12, depassement: 0 });
    a.stats = { ...a.stats, quizJustes: 2, quizFaux: 1, milles: 3000 }; // 67 %
    b.stats = { ...b.stats, quizJustes: 2, quizFaux: 4, milles: 2900 }; // 33 %
    c.stats = { ...c.stats, quizJustes: 4, quizFaux: 2, milles: 3100 }; // 67 %, plus de bonnes réponses
    expect(classement(d, e).map((o) => o.id)).toEqual([c.id, a.id, b.id, x.id]);
    c.stats = { ...c.stats, quizJustes: 2, quizFaux: 1 }; // à égalité avec a : le moins de milles l'emporte
    expect(classement(d, e).slice(0, 2).map((o) => o.id)).toEqual([a.id, c.id]);
  });
});

describe('demi-caps à l\'approche de l\'arrivée (essai du 11/11/2026)', () => {
  it('noms des 32 aires de vent', async () => {
    const { nomCap } = await import('../src/index');
    expect(nomCap(0.5)).toBe('N¼NE');
    expect(nomCap(1.5, true)).toBe('Nord-Est quart Nord');
    expect(nomCap(15.5)).toBe('N¼NW');
    expect(nomCap(4)).toBe('E');
  });
  it('distance d\'une voile entre deux allures : moyenne exacte, inutilisable si une allure l\'est', async () => {
    const { distanceBase, voile } = await import('../src/index');
    expect(distanceBase(voile(d, 'spi'), 168.75)).toBe(5.5);
    expect(distanceBase(voile(d, 'code0'), 56.25)).toBeNull();
    expect(distanceBase(voile(d, 'solent'), 33.75)).toBeNull();
  });
  it('permis seulement à moins de 500 milles de l\'arrivée, pour les humains comme pour l\'IA', async () => {
    const { demiCapsPermis, carteDe, distanceRestante, navigable, validerChoix } = await import('../src/index');
    const e = creerPartie(d, params(7));
    const b = e.bateaux[0];
    expect(demiCapsPermis(d, e, b)).toBe(false);
    const choix = { cap: 9.5, voile: 'reduite', distanceMax: null };
    expect(() => validerChoix(d, e, b, choix)).toThrow('Cap invalide');
    const carte = carteDe(d, e);
    let place = false;
    for (let y = 0; y < carte.H && !place; y++)
      for (let x = 0; x < carte.L && !place; x++) {
        if (!navigable(carte, x, y)) continue;
        b.x = x; b.y = y; b.pos = undefined;
        const m = distanceRestante(d, e, b) * (carte.course.milles_par_case ?? 1);
        if (m > 200 && m < 450) place = true;
      }
    expect(place).toBe(true);
    expect(demiCapsPermis(d, e, b)).toBe(true);
    e.vent = { direction: 0, force: 4 };
    for (const o of e.bateaux) (o as { vent?: unknown }).vent = undefined;
    const ok = [8.5, 9.5, 7.5].map((cap) => { try { validerChoix(d, e, b, { cap, voile: 'reduite', distanceMax: null }); return true; } catch { return false; } });
    expect(ok.some(Boolean)).toBe(true);
    expect(() => validerChoix(d, e, b, { cap: 9.25, voile: 'reduite', distanceMax: null })).toThrow('Cap invalide');
    const c = choisirIA(d, structuredClone(e), b.id);
    expect(c.cap === null || Number.isInteger(c.cap * 2)).toBe(true);
  });
});
