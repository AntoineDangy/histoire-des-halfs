// Moteur de jeu : état sérialisable, actions, résolution d'un tour.
// appliquer(donnees, etat, action) renvoie un NOUVEL état ; l'état reçu n'est jamais modifié.
import { CarteCompilee, compilerCarte, distanceRestanteCase, idx, navigable, passageLibre, zonesCase } from './carte';
import { angleAllure, auAllure, capValide, coteVent, NB_DIR, nomAllure, NOMS_DIR_LONGS, norm, vecteur } from './geo';
import { choisirIA, decisionRelanceIA, decisionReparationIA } from './ia';
import { alizeApres, creerAnticyclonesPermanents, creerMolle, dansAlize, indiceAlize, evoluerFronts, frontSur, ventCourant, ventSysteme } from './meteo';
import { calculerDistance, calculerRisque, classeBateau, competence, dansBrume, echelleBateau, estMulticoque, echelleCarte, facesForce, nomBeaufort, plafondCases, tracerChemin, voile } from './regles';
import { alea, d6, entier, face, pas, tiragePondere } from './rng';
import type {
  Action, Case, Choix, ContexteResolution, CourseDef, Donnees, EtatBateau, EtatPartie, Evenement,
  ParamsPartie, PenaliteDef, QuestionDef, TypeEvenement, Vent,
} from './types';

// ---------------------------------------------------------------- Accès

const parcoursClasse = new WeakMap<CourseDef, Map<string, CourseDef>>();

/**
 * La course jouée, avec le parcours de la classe de la partie (décision du 10/11/2026 : à la Transat Café L'Or,
 * chaque classe a sa marque obligatoire). L'objet renvoyé est toujours le même pour une course et une classe,
 * pour que la carte compilée reste en cache.
 */
export function course(d: Donnees, etat: Pick<EtatPartie, 'params'>): CourseDef {
  const c = d.courses.find((x) => x.id === etat.params.courseId);
  if (!c) throw new Error(`Course inconnue : ${etat.params.courseId}`);
  const classe = etat.params.classe;
  const portes = c.portes_par_classe?.[classe];
  if (!portes) return c;
  let m = parcoursClasse.get(c);
  if (!m) parcoursClasse.set(c, (m = new Map()));
  let cc = m.get(classe);
  if (!cc) m.set(classe, (cc = { ...c, portes }));
  return cc;
}

export function carteDe(d: Donnees, etat: Pick<EtatPartie, 'params'>): CarteCompilee {
  return compilerCarte(course(d, etat));
}

export function bateau(etat: EtatPartie, id: string): EtatBateau {
  const b = etat.bateaux.find((x) => x.id === id);
  if (!b) throw new Error(`Bateau inconnu : ${id}`);
  return b;
}

export function enCourse(b: EtatBateau): boolean {
  return !b.arrive && !b.horsClassement;
}

export function nomSkipper(d: Donnees, etat: EtatPartie, b: EtatBateau): string {
  const s = d.skippers.find((x) => x.id === b.skipperId);
  if (!s) return b.nom;
  const nom = (k: typeof s) => (etat.params.options.nomsReels ? k.nom_affiche : k.nom_generique);
  const co = b.coSkipperId ? d.skippers.find((x) => x.id === b.coSkipperId) : undefined;
  return co ? `${nom(s)} & ${nom(co)}` : nom(s);
}

/**
 * Demi-caps (32 caps) permis : à moins de `demi_caps.milles_arrivee` milles de l'arrivée (essai du porteur de projet,
 * 11/11/2026 ; 500 milles, comme le contournement de la côte).
 */
export function demiCapsPermis(d: Donnees, etat: EtatPartie, b: EtatBateau): boolean {
  const seuil = d.regles.demi_caps?.milles_arrivee;
  if (!seuil || b.arrive) return false;
  // Courses à 32 caps sur tout le parcours (Fastnet, décision du porteur de projet du 12/11/2026).
  if (d.regles.demi_caps?.courses?.includes(carteDe(d, etat).course.id)) return true;
  return distanceRestante(d, etat, b) * (carteDe(d, etat).course.milles_par_case ?? 1) <= seuil;
}

export function distanceRestante(d: Donnees, etat: EtatPartie, b: EtatBateau): number {
  if (b.arrive) return 0;
  return distanceRestanteCase(carteDe(d, etat), b.x, b.y, b.porte);
}

/** Classement courant : arrivés (ordre d'arrivée), puis distance restante. Hors classement en dernier. */
export function classement(d: Donnees, etat: EtatPartie): EtatBateau[] {
  const restants = new Map(etat.bateaux.map((b) => [b.id, distanceRestante(d, etat, b)]));
  return [...etat.bateaux].sort((a, b) => {
    if (a.horsClassement !== b.horsClassement) return a.horsClassement ? 1 : -1;
    if (a.arrive !== b.arrive) return a.arrive ? -1 : 1;
    if (a.arrive && b.arrive) {
      if (a.tourArrivee !== b.tourArrivee) return (a.tourArrivee ?? 0) - (b.tourArrivee ?? 0);
      // Arrivés au même tour (décision du porteur de projet, 11/11/2026) : taux de bonnes réponses au quiz, puis nombre
      // de bonnes réponses, puis le moins de milles parcourus sur toute la course.
      const taux = (x: EtatBateau) => (x.stats.quizJustes + x.stats.quizFaux ? x.stats.quizJustes / (x.stats.quizJustes + x.stats.quizFaux) : 0);
      if (taux(a) !== taux(b)) return taux(b) - taux(a);
      if (a.stats.quizJustes !== b.stats.quizJustes) return b.stats.quizJustes - a.stats.quizJustes;
      const ma = a.stats.milles ?? 0, mb = b.stats.milles ?? 0;
      if (Math.abs(ma - mb) > 1e-6) return ma - mb;
      if (a.depassement !== b.depassement) return b.depassement - a.depassement;
      return b.voiles.length + b.reparations - (a.voiles.length + a.reparations);
    }
    const da = restants.get(a.id)!;
    const db = restants.get(b.id)!;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Deux classements quand la flotte mêle monocoques et multicoques (classe Vintage ; décision du porteur de projet du
 * 10/11/2026 : « ils ne sont pas dans les mêmes catégories »), comme les classements Rhum Mono et Rhum Multi.
 */
export type Categorie = 'multicoque' | 'monocoque';
export const NOM_CATEGORIE: Record<Categorie, string> = { multicoque: 'multicoques', monocoque: 'monocoques' };

export function categorie(d: Donnees, b: Pick<EtatBateau, 'famille'>): Categorie {
  return estMulticoque(d, b) ? 'multicoque' : 'monocoque';
}

/** Catégories de la partie (multicoques d'abord), ou null quand toute la flotte est de la même catégorie. */
export function categoriesPartie(d: Donnees, etat: Pick<EtatPartie, 'bateaux'>): Categorie[] | null {
  const presentes = new Set(etat.bateaux.map((b) => categorie(d, b)));
  return presentes.size > 1 ? (['multicoque', 'monocoque'] as Categorie[]).filter((c) => presentes.has(c)) : null;
}

/** Classement d'une catégorie (dans l'ordre du classement général). */
export function classementCategorie(d: Donnees, etat: EtatPartie, cat: Categorie): EtatBateau[] {
  return classement(d, etat).filter((b) => categorie(d, b) === cat);
}

/** Temps de course fictif en heures (pédagogique, §3.7). null si le bateau n'est pas arrivé. */
export function tempsCourseHeures(d: Donnees, etat: EtatPartie, b: EtatBateau): number | null {
  if (!b.arrive || b.tourArrivee === null) return null;
  const parcourue = Math.max(1, b.distanceDernierTour);
  const fraction = Math.max(0, Math.min(1, 1 - b.depassement / parcourue));
  return (b.tourArrivee - 1 + fraction) * heuresParTour(d, etat);
}

/** Durée d'un tour en heures : celle de la classe de la partie, sinon celle de la course. */
export function heuresParTour(d: Donnees, etat: EtatPartie): number {
  const c = course(d, etat);
  // Tours du monde (12/11/2026) : la durée du tour est celle de la course (4 jours), pas celle de la classe.
  if (c.vitesse_unique || c.distance_reelle) return c.heures_par_tour;
  return d.classes.find((x) => x.id === etat.params.classe)?.heures_par_tour ?? c.heures_par_tour;
}

export function formaterTemps(heures: number): string {
  const j = Math.floor(heures / 24);
  const h = Math.floor(heures % 24);
  const m = Math.round((heures * 60) % 60);
  return `${j} j ${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min`;
}

// ---------------------------------------------------------------- Création

export function creerPartie(d: Donnees, params: ParamsPartie): EtatPartie {
  const c = course(d, { params });
  const carte = compilerCarte(c);
  if (carte.departs.length === 0) throw new Error('Aucune case de départ sur la carte');
  // Tous les bateaux partent de la même case : celle de la ligne de départ la plus proche du port de départ.
  const port = c.lieux?.find((l) => l.type === 'depart');
  const caseDepart = port
    ? carte.departs.reduce((m, p) => (Math.hypot(p[0] + 0.5 - port.x, p[1] + 0.5 - port.y) < Math.hypot(m[0] + 0.5 - port.x, m[1] + 0.5 - port.y) ? p : m))
    : carte.departs[0];
  const r = d.regles;
  const bateaux: EtatBateau[] = params.participants.map((p, i) => {
    const s = d.skippers.find((x) => x.id === p.skipperId);
    if (!s) throw new Error(`Skipper inconnu : ${p.skipperId}`);
    const bt = d.bateaux.find((x) => x.id === s.bateau_id);
    if (!bt) throw new Error(`Bateau inconnu : ${s.bateau_id}`);
    const co = p.coSkipperId ? d.skippers.find((x) => x.id === p.coSkipperId) : undefined;
    if (p.coSkipperId && !co) throw new Error(`Co-skipper inconnu : ${p.coSkipperId}`);
    const comp = competence(d, co && co.competence !== s.competence ? `${s.competence}+${co.competence}` : s.competence);
    // Le spi de gros temps est réservé aux monocoques (11/11/2026).
    const multi = estMulticoque(d, { famille: bt.famille });
    let voiles = r.voiles_depart.filter((v) => !(multi && d.voiles.find((x) => x.id === v)?.monocoque));
    if (comp.speciaux.voile_en_moins) {
      const laissee = p.voileLaissee && voiles.includes(p.voileLaissee) ? p.voileLaissee : 'code0';
      voiles = voiles.filter((v) => v !== laissee);
    }
    const reparations = Math.max(0, r.reparations_depart + (comp.speciaux.reparations_depart ?? 0));
    const [x, y] = caseDepart;
    return {
      id: `b${i + 1}`,
      nom: p.nom,
      type: p.type,
      niveauIA: p.niveauIA ?? 'moyen',
      niveauQuiz: p.niveauQuiz,
      skipperId: s.id,
      ...(co ? { coSkipperId: co.id } : {}),
      bateauId: bt.id,
      competence: comp.id,
      famille: bt.famille,
      x, y,
      voiles,
      voilesPerdues: [],
      voilesDepart: [...voiles],
      usure: {},
      reparations,
      reparationsDepart: reparations,
      passeTours: 0,
      relancesRestantes: comp.speciaux.relances_direction ?? 0,
      dernierRecousu: -100,
      porte: 0,
      arrive: false,
      horsClassement: false,
      tourArrivee: null,
      depassement: 0,
      distanceDernierTour: 0,
      sillage: [],
      trace: [[x, y, 0]],
      dernierCap: null,
      modificateurs: [],
      carteTour: null,
      derniereVoile: null,
      choix: null,
      stats: { quizJustes: 0, quizFaux: 0, avaries: 0, reparationsJouees: 0, escales: 0 },
    };
  });
  const etat: EtatPartie = {
    version: 1,
    params: structuredClone(params),
    rng: params.graine | 0,
    tour: 1,
    phase: 'choix',
    vent: { ...c.vent_initial },
    tendance: 0,
    bateaux,
    attente: null,
    resolution: null,
    quizUtilises: [],
    evenements: [],
    tourFinMax: null,
    classementFinal: null,
    desProchains: null,
    fronts: [],
  };
  // Chaque zone d'alizés a son vent régulier (alizés de nord-est ; de sud-est sous l'équateur, décision du 10/11/2026).
  const alizes = c.zones_meteo
    .filter((z) => z.type === 'alize' && z.vent_regulier)
    .map((z) => ({ ...z.vent_regulier!.depart, nom: z.nom, rect: z.rect, directions: z.vent_regulier!.directions, forces: z.vent_regulier!.forces }));
  if (alizes.length) etat.alizes = alizes;
  // Vent de départ aléatoire (décision du 11/11/2026) : direction au hasard parmi les huit, force de 2 à 5.
  etat.vent = { direction: entier(etat, 8) * 2, force: 2 + entier(etat, 4) };
  etat.tendance = tirerTendance(etat);
  etat.desProchains = tirerDesVent(d, etat);
  etat.previsions = prevoirDes(d, etat);
  if (c.meteo_mondiale) creerAnticyclonesPermanents(etat, c.meteo_mondiale);
  const molle = creerMolle(d, etat, c.lieux?.find((l) => l.type === 'arrivee'), c.molle);
  evt(etat, 'info', `Départ de la ${c.nom} : vent ${NOMS_DIR_LONGS[etat.vent.direction]}, force ${etat.vent.force}.`);
  if (molle) evt(etat, 'meteo', molle);
  return etat;
}

function tirerTendance(etat: EtatPartie): number {
  return entier(etat, 3) - 1;
}

/** Dés du vent du tour, tirés au début du tour selon la tendance du bulletin. */
function tirerDesVent(d: Donnees, etat: EtatPartie) {
  const r = d.regles;
  const facesDir = r.de_direction_tendance[String(etat.tendance)] ?? r.de_direction;
  return { force: face(etat, facesForce(d, etat.vent.force)), direction: face(etat, facesDir) };
}

/**
 * Prévisions des dés à venir (12/11/2026) : la vraie face avec la fiabilité de la compétence (Navigateur pour la force,
 * Météorologue pour la direction), sinon une autre face au hasard. Tirées par un générateur dérivé de l'état, sans faire
 * avancer celui de la partie : ajouter une compétence ne change pas le reste du hasard.
 */
function prevoirDes(d: Donnees, etat: EtatPartie): { force: number; direction: number } | null {
  if (!etat.desProchains) return null;
  let s = (etat.rng ^ 0x5bd1e995) | 0;
  const tirer = () => { const [v, n] = pas(s); s = n; return v; };
  const fiab = (cle: 'prevoit_force' | 'prevoit_direction') => Math.max(0, ...d.competences.map((c) => c.speciaux?.[cle] ?? 0));
  const prevoir = (vrai: number, faces: number[], p: number) => {
    if (tirer() < p) return vrai;
    const autres = [...new Set(faces)].filter((f) => f !== vrai);
    return autres.length ? autres[Math.floor(tirer() * autres.length)] : vrai;
  };
  const r = d.regles;
  return {
    force: prevoir(etat.desProchains.force, facesForce(d, etat.vent.force), fiab('prevoit_force')),
    direction: prevoir(etat.desProchains.direction, r.de_direction_tendance[String(etat.tendance)] ?? r.de_direction, fiab('prevoit_direction')),
  };
}

function evt(etat: EtatPartie, type: TypeEvenement, texte: string, bateauId?: string, donnees?: Record<string, unknown>) {
  etat.evenements.push({ tour: etat.tour, type, texte, bateauId, donnees });
}

// ---------------------------------------------------------------- Choix

/** Bateaux qui doivent encore choisir un cap et une voile ce tour-ci. */
export function bateauxAttendus(etat: EtatPartie): EtatBateau[] {
  if (etat.phase !== 'choix') return [];
  return etat.bateaux.filter((b) => enCourse(b) && b.passeTours === 0 && b.choix === null);
}

export function humainsAttendus(etat: EtatPartie): EtatBateau[] {
  return bateauxAttendus(etat).filter((b) => b.type === 'humain');
}

export function peutRecoudre(d: Donnees, etat: EtatPartie, b: EtatBateau): boolean {
  const p = competence(d, b.competence).speciaux.recoudre_periode;
  return !!p && b.voilesPerdues.length > 0 && etat.tour - b.dernierRecousu >= p;
}

export function surCaseAbri(d: Donnees, etat: EtatPartie, b: EtatBateau): boolean {
  const carte = carteDe(d, etat);
  return carte.cote[idx(carte, b.x, b.y)];
}

export function validerChoix(d: Donnees, etat: EtatPartie, b: EtatBateau, choix: Choix): void {
  if (choix.cap === null) {
    if (!surCaseAbri(d, etat, b)) throw new Error('Abri impossible : le bateau n\'est pas sur une case côtière');
    return;
  }
  if (!capValide(choix.cap, demiCapsPermis(d, etat, b))) throw new Error('Cap invalide');
  if (choix.voile !== null && !b.voiles.includes(choix.voile)) throw new Error('Voile non disponible');
  // Règle commune aux humains et à l'IA : on choisit avec le vent ACTUEL, avant le jet des dés.
  // Un cap trop près du vent actuel, ou une voile inutilisable à cette allure, est refusé.
  if (calculerDistance(d, carteDe(d, etat), b, choix.voile, choix.cap, ventCourant(etat, b.x, b.y)).distance === null)
    throw new Error('Cap ou voile impossible avec le vent actuel');
  if (choix.distanceMax !== null && (!Number.isInteger(choix.distanceMax) || choix.distanceMax < 1)) throw new Error('Distance maximale invalide');
  if (choix.recoudre !== undefined && (!peutRecoudre(d, etat, b) || !b.voilesPerdues.includes(choix.recoudre)))
    throw new Error('Impossible de recoudre cette voile');
}

// ---------------------------------------------------------------- Actions

export function appliquer(d: Donnees, etatEntree: EtatPartie, action: Action): EtatPartie {
  const etat: EtatPartie = structuredClone(etatEntree);
  const b = bateau(etat, action.bateauId);
  switch (action.type) {
    case 'ChoisirCapEtVoile': {
      if (etat.phase !== 'choix') throw new Error('Ce n\'est pas la phase de choix');
      if (!enCourse(b) || b.passeTours > 0) throw new Error('Ce bateau ne joue pas ce tour');
      validerChoix(d, etat, b, action.choix);
      b.choix = { ...action.choix };
      if (humainsAttendus(etat).length === 0) demarrerResolution(d, etat);
      break;
    }
    case 'RepondreRelance': {
      verifierAttente(etat, 'relance', b.id);
      const ctx = etat.resolution!.courant!;
      etat.attente = null;
      if (action.relancer) faireRelance(d, etat, b, ctx);
      ctx.etape = 'risque';
      calculerTour(d, etat, b, ctx);
      avancer(d, etat);
      break;
    }
    case 'RepondreQuiz': {
      const att = verifierAttente(etat, 'quiz', b.id);
      if (att.type !== 'quiz') throw new Error('Attente incohérente');
      const q = d.questions.find((x) => x.id === att.questionId)!;
      etat.attente = null;
      if (att.source === 'large') traiterQuestionLarge(d, etat, b, q, action.reponse === q.reponse, action.reponse);
      else traiterReponseQuiz(d, etat, b, q, action.reponse === q.reponse, action.reponse);
      avancer(d, etat);
      break;
    }
    case 'JouerReparation': {
      const att = verifierAttente(etat, 'reparation', b.id);
      etat.attente = null;
      if (att.type === 'reparation' && att.motif === 'evenement') traiterReparationEvenement(d, etat, b, action.jouer);
      else traiterReparation(d, etat, b, action.jouer);
      avancer(d, etat);
      break;
    }
  }
  return etat;
}

function verifierAttente(etat: EtatPartie, type: string, bateauId: string) {
  const a = etat.attente;
  if (!a || a.type !== type || a.bateauId !== bateauId) throw new Error(`Aucune décision « ${type} » attendue pour ce bateau`);
  return a;
}

// ---------------------------------------------------------------- Résolution

function demarrerResolution(d: Donnees, etat: EtatPartie) {
  for (const b of bateauxAttendus(etat)) b.choix = choisirIA(d, etat, b.id);
  const r = d.regles;
  const ventAvant = { ...etat.vent };
  // Vent de chaque bateau dans sa zone (vent général, alizés, front, molle, anticyclone), avant les dés : c'est lui que
  // l'écran des dés montre au joueur (11/11/2026, demande du porteur de projet : ne pas afficher le vent d'une zone où
  // il n'est pas).
  const locauxAvant: Record<string, Vent> = {};
  for (const b of etat.bateaux) if (enCourse(b)) locauxAvant[b.id] = ventCourant(etat, b.x, b.y);
  const previsions: Record<string, { vent: Vent; distance: number | null }> = {};
  for (const b of etat.bateaux) {
    if (!b.choix || b.choix.cap === null) continue;
    const v = ventCourant(etat, b.x, b.y);
    previsions[b.id] = { vent: v, distance: calculerDistance(d, carteDe(d, etat), b, b.choix.voile, b.choix.cap, v).distance };
  }
  // Les dés ont été tirés au début du tour (la tendance biaise le dé de direction ; le Navigateur voit le dé de force).
  const des = etat.desProchains ?? tirerDesVent(d, etat);
  etat.desProchains = null;
  etat.previsions = null;
  const alizesAvant = etat.alizes?.map((a) => ({ direction: a.direction, force: a.force }));
  if (etat.alizes) etat.alizes = etat.alizes.map((a) => ({ ...a, ...alizeApres(a, des.direction, des.force) }));
  // Décision du 11/11/2026 : un front ou un anticyclone commence comme prévu, puis son vent évolue avec les mêmes dés
  // que le reste de la carte (direction à plus ou moins 90° de l'origine, force à plus ou moins 2).
  for (const f of etat.fronts ?? []) {
    if (f.type === 'molle') continue;
    f.origine ??= { direction: f.direction, force: f.force };
    const ecart = ((f.direction + des.direction - f.origine.direction + 24) % 16) - 8;
    if (Math.abs(ecart) <= 4) f.direction = norm(f.direction + des.direction);
    f.force = Math.max(Math.max(1, f.origine.force - 2), Math.min(Math.min(r.force_max, f.origine.force + 2), f.force + des.force));
  }
  etat.vent = {
    direction: norm(ventAvant.direction + des.direction),
    force: Math.max(r.force_min, Math.min(r.force_max, ventAvant.force + des.force)),
  };
  const sens = des.direction === 0 ? 'ne tourne pas' : des.direction > 0 ? 'tourne de 45° (sens horaire)' : 'tourne de 45° (sens antihoraire)';
  const locaux: Record<string, { avant: Vent; apres: Vent; zone: string }> = {};
  for (const b of etat.bateaux) {
    if (!locauxAvant[b.id]) continue;
    const fr = frontSur(etat, b.x, b.y);
    const zone = fr
      ? fr.front.type === 'anticyclone' ? 'anticyclone' : fr.front.type === 'molle' ? 'molle' : fr.zone === 'front' ? 'front' : 'traine'
      : dansAlize(etat, b.x, b.y) ? 'alizes' : 'general';
    locaux[b.id] = { avant: locauxAvant[b.id], apres: ventCourant(etat, b.x, b.y), zone };
  }
  evt(etat, 'vent', `Le vent ${sens} : ${NOMS_DIR_LONGS[etat.vent.direction]}, force ${etat.vent.force} (${nomBeaufort(d, etat.vent.force)}).`, undefined, {
    avant: ventAvant, des, apres: { ...etat.vent }, locaux,
  });
  // Ordre inverse du classement : le dernier bouge en premier (§3.8).
  const ordre = classement(d, etat).filter(enCourse).reverse().map((b) => b.id);
  etat.phase = 'resolution';
  etat.resolution = { ventAvant, des, ordre, rangAvant: classement(d, etat).map((x) => x.id), tirage: 0, index: 0, courant: null, previsions, alizesAvant };
  avancer(d, etat);
}

function nouveauContexte(bateauId: string, delta: number): ContexteResolution {
  return {
    bateauId, etape: 'debut', delta, relance: false, ventLocal: null, angle: 0, distance: 0, risque: 0, noir: false,
    penalite: null, bloqueSurPlace: false,
  };
}

/** Avance la résolution jusqu'à la prochaine décision humaine ou jusqu'à la fin du tour. */
function avancer(d: Donnees, etat: EtatPartie) {
  const res = etat.resolution;
  if (!res) return;
  // 1. Dé événement de chaque bateau, juste après le jet du vent.
  while (!etat.attente && res.tirage < res.ordre.length) {
    const b = bateau(etat, res.ordre[res.tirage]);
    res.tirage++;
    tirerEvenement(d, etat, b);
  }
  // 2. Résolution bateau par bateau.
  while (!etat.attente) {
    if (!res.courant) {
      if (res.index >= res.ordre.length) {
        finirTour(d, etat);
        return;
      }
      res.courant = nouveauContexte(res.ordre[res.index], res.des.direction);
      const b0 = bateau(etat, res.courant.bateauId);
      res.courant.de = [b0.x, b0.y];
    }
    const ctx = res.courant;
    const b = bateau(etat, ctx.bateauId);
    etapeBateau(d, etat, b, ctx);
    if (ctx.etape === 'fin') {
      escaleTechnique(d, etat, b);
      journaliser(d, etat, b, ctx);
      res.courant = null;
      res.index++;
    }
  }
}

function ventLocalDe(d: Donnees, etat: EtatPartie, b: EtatBateau, delta: number): Vent {
  const res = etat.resolution!;
  let v: Vent = { direction: norm(res.ventAvant.direction + delta), force: etat.vent.force };
  // Dans un front ou sa traîne, c'est le vent du front qui souffle, modifié par les mêmes dés.
  const fr = frontSur(etat, b.x, b.y);
  if (fr) {
    const vf = ventSysteme(fr.front, fr.zone, b.x, b.y);
    v = { direction: norm(vf.direction + delta - res.des.direction), force: Math.max(d.regles.force_min, Math.min(Number(d.regles.tempete?.force_max_fronts ?? d.regles.force_max), vf.force)) };
  }
  // Dans les alizés (hors front) : le vent régulier de la zone, modifié par les mêmes dés mais borné.
  const ia = indiceAlize(etat, b.x, b.y);
  if (!fr && ia >= 0 && etat.alizes && res.alizesAvant) v = alizeApres({ ...etat.alizes[ia], ...res.alizesAvant[ia] }, delta, res.des.force);
  const zones = zonesCase(carteDe(d, etat), b.x, b.y);
  // Dans la molle, le vent reste faible quels que soient les dés.
  if (fr?.front.type === 'molle') v = { ...v, force: Math.min(v.force, 2) };
  if (zones.includes('mers_du_sud')) v = { ...v, force: Math.min(d.regles.force_max, v.force + 2) };
  return v;
}

function etapeBateau(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const nom = nomSkipper(d, etat, b);
  switch (ctx.etape) {
    case 'debut': {
      if (b.passeTours > 0) {
        b.passeTours--;
        b.distanceDernierTour = 0;
        evt(etat, 'passe', `${nom} passe son tour.`, b.id);
        ctx.issue = 'passe son tour';
        ctx.etape = 'fin';
        return;
      }
      const choix = b.choix!;
      if (choix.cap === null) {
        evt(etat, 'abri', `${nom} reste à l'abri de la côte.`, b.id);
        ctx.issue = "à l'abri";
        b.distanceDernierTour = 0;
        ctx.etape = 'fin';
        return;
      }
      // Pot-au-noir (décision du 11/11/2026) : un bateau arrêté au milieu lance le dé ; pair, il repart ; impair, il passe son tour.
      if (b.potAuNoir) {
        const de = d6(etat);
        if (de % 2 === 1) {
          b.distanceDernierTour = 0;
          evt(etat, 'meteo', `Pot-au-noir : dé ${de}, impair. ${nom} reste encalminé et passe son tour.`, b.id, { de, pot: true });
          ctx.issue = 'encalminé dans le pot-au-noir';
          ctx.etape = 'fin';
          return;
        }
        b.potAuNoir = false;
        evt(etat, 'meteo', `Pot-au-noir : dé ${de}, pair ! ${nom} attrape un souffle et repart.`, b.id, { de, pot: true });
      }
      ctx.ventLocal = ventLocalDe(d, etat, b, ctx.delta);
      const comp = competence(d, b.competence);
      const pot = false;
      if (comp.speciaux.relances_direction && b.relancesRestantes > 0 && !pot) {
        ctx.etape = 'relance';
        ctx.angle = angleAllure(choix.cap, ctx.ventLocal.direction);
        if (b.type === 'humain') {
          etat.attente = { type: 'relance', bateauId: b.id, ventLocal: ctx.ventLocal, angle: ctx.angle };
          return;
        }
        if (decisionRelanceIA(d, etat, b, ctx)) faireRelance(d, etat, b, ctx);
      }
      ctx.etape = 'risque';
      calculerTour(d, etat, b, ctx);
      return;
    }
    case 'evenement':
      resoudreEvenement(d, etat, b, ctx);
      return;
    case 'risque':
      resoudreRisque(d, etat, b, ctx);
      return;
    case 'deplacement':
      deplacer(d, etat, b, ctx);
      return;
    default:
      ctx.etape = 'fin';
  }
}

function faireRelance(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const ancien = ctx.delta;
  ctx.delta = face(etat, d.regles.de_direction);
  ctx.relance = true;
  b.relancesRestantes--;
  ctx.ventLocal = ventLocalDe(d, etat, b, ctx.delta);
  evt(etat, 'relance', `${nomSkipper(d, etat, b)} relance le dé de direction : vent ${NOMS_DIR_LONGS[ctx.ventLocal.direction]} pour son bateau.`, b.id, {
    ancien, nouveau: ctx.delta, vent: ctx.ventLocal,
  });
}

/** Calcule l'allure, la distance et le risque avec le nouveau vent. */
function calculerTour(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const choix = b.choix!;
  const carte = carteDe(d, etat);
  const vent = ctx.ventLocal!;
  const nom = nomSkipper(d, etat, b);
  ctx.angle = angleAllure(choix.cap!, vent.direction);
  const { distance, louvoyage } = calculerDistance(d, carte, b, choix.voile, choix.cap!, vent);
  const nomVoile = choix.voile ? voile(d, choix.voile).nom_court : 'à sec de toile';
  if (distance === null) {
    ctx.bloqueSurPlace = true;
    ctx.issue = 'voile inutilisable avec le vent tourné';
    const raison = ctx.angle < 45 ? `le vent refuse et le ${nomVoile} est une voile de portant : impossible de louvoyer` : `${nomVoile} inutilisable ${auAllure(ctx.angle)}`;
    evt(etat, 'bloque', `${nom} ne peut pas avancer : ${raison}.`, b.id, { vent, angle: ctx.angle, voile: choix.voile, cap: choix.cap });
    b.distanceDernierTour = 0;
    ctx.etape = 'fin';
    return;
  }
  let dist = distance;
  if (ctx.relance) dist = Math.max(1, dist + (competence(d, b.competence).speciaux.malus_relance ?? 0));
  if (choix.recoudre) dist = Math.max(1, Math.floor(dist / 2));
  ctx.distance = dist;
  ctx.distanceDes = dist;
  ctx.louvoyage = louvoyage;
  ctx.risque = calculerRisque(d, carte, b, choix.voile, vent).risque;
  b.derniereVoile = choix.voile;
  evt(etat, 'debut', louvoyage ? `${nom} louvoie face au vent sous ${nomVoile} (bords à ±${d.regles.louvoyage?.angle_bords ?? 40}°),` : `${nom} : ${nomAllure(ctx.angle).toLowerCase()} sous ${nomVoile}, ${Math.round(dist * (carte.course.milles_par_case ?? 1))} milles possibles.`, b.id, {
    vent, angle: ctx.angle, distance: dist, risque: ctx.risque, voile: choix.voile, cap: choix.cap, louvoyage,
  });
  ctx.etape = 'evenement';
  deTempete(d, etat, b, ctx);
}

/**
 * Dé tempête (décision du 10/11/2026) : au-delà de F8, on lance un dé. F9 : 6 ; F10 : 4 à 6 ; F11 : 2 à 6 →
 * démâtage (monocoque) ou chavirage (multicoque). Le bateau est immobilisé ; escale technique si un port est proche.
 */
function deTempete(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const t = d.regles.tempete;
  const vent = ctx.ventLocal;
  if (!t || !vent || vent.force < 9 || !b.choix) return;
  const faces = t[String(Math.min(11, vent.force))];
  if (!Array.isArray(faces)) return;
  const de = d6(etat);
  const nom = nomSkipper(d, etat, b);
  const multi = estMulticoque(d, b);
  const touche = faces.includes(de);
  evt(etat, 'tempete', touche
    ? `Dé tempête (F${vent.force}) : ${de}. ${multi ? `${nom} chavire !` : `${nom} démâte !`}`
    : `Dé tempête (F${vent.force}) : ${de}. ${nom} tient bon dans la tempête.`, b.id, { de, faces, touche, force: vent.force });
  if (!touche) return;
  b.distanceDernierTour = 0;
  b.stats.avaries++;
  b.avarieGrave = true;
  ctx.etape = 'fin';
  ctx.issue = multi ? 'chavirage (tempête)' : 'démâtage (tempête)';
  if (multi) {
    b.passeTours = 2;
    evt(etat, 'naufrage', `${nom} a chaviré : immobilisé 2 tours, sauf escale technique.`, b.id);
  } else {
    // Démâté : il ne reste qu'un gréement de fortune jusqu'à l'escale.
    const perdues = b.voiles.filter((v) => v !== 'reduite');
    b.voilesPerdues.push(...perdues);
    b.voiles = b.voiles.filter((v) => v === 'reduite');
    b.passeTours = 1;
    evt(etat, 'demate', `${nom} a démâté : gréement de fortune, immobilisé 1 tour, sauf escale technique.`, b.id);
  }
}

/** Question du large : la bonne réponse écarte le risque ; la mauvaise use la voile hissée (mauvaise manœuvre). */
function traiterQuestionLarge(d: Donnees, etat: EtatPartie, b: EtatBateau, q: QuestionDef, juste: boolean, reponse: number) {
  const nom = nomSkipper(d, etat, b);
  if (juste) b.stats.quizJustes++;
  else b.stats.quizFaux++;
  evt(etat, 'quiz', juste ? `${nom} répond juste : bonne manœuvre, rien à signaler.` : `${nom} se trompe : mauvaise manœuvre, la voile souffre.`, b.id, {
    questionId: q.id, question: q.question, reponse, bonne: q.reponse, juste,
  });
  const v = b.choix?.voile;
  if (!juste && v) userVoile(d, etat, b, v, d.regles.usure?.mauvaise_reponse ?? 20, 'mauvaise manœuvre');
}

/** Usure d'un tour d'utilisation d'une voile d'avant, selon la voile, la force du vent, la classe et la course. */
export function usureParTour(d: Donnees, etat: Pick<EtatPartie, 'params'>, voileId: string | null, force: number, famille?: string): number {
  const u = d.regles.usure;
  if (!u || !voileId) return 0;
  const table = u.par_tour[voileId];
  if (!table) return 0;
  const bande = force <= u.bandes_force[0] ? 0 : force <= u.bandes_force[1] ? 1 : force <= u.bandes_force[2] ? 2 : 3;
  const c = famille ? d.classes.find((x) => x.id === (d.familles.find((f) => f.id === famille)?.classe ?? '')) : d.classes.find((x) => x.id === etat.params.classe);
  const k = (c?.usure_facteur ?? 1) * ((u.tours_reference ?? 10) / (c?.tours_moyens ?? 10));
  return table[bande] * k;
}

/** Ajoute de l'usure à une voile d'avant ; au seuil, la voile est perdue. */
function userVoile(d: Donnees, etat: EtatPartie, b: EtatBateau, v: string, quantite: number, raison: string) {
  const u = d.regles.usure;
  if (!u || quantite <= 0 || !b.voiles.includes(v)) return;
  quantite *= competence(d, b.competence).speciaux.usure_facteur ?? 1; // compétence Économe ou Attaquant (12/11/2026)
  b.usure ??= {};
  const avant = b.usure[v] ?? 0;
  const apres = avant + quantite;
  b.usure[v] = apres;
  const nom = nomSkipper(d, etat, b);
  if (apres >= u.seuil) {
    delete b.usure[v];
    evt(etat, 'usure', `Usée jusqu'à la corde (${raison}), la voile ${voile(d, v).nom_court} de ${nom} explose !`, b.id, { voile: v, usure: apres });
    perdreVoile(d, etat, b, v);
  } else if (Math.floor(avant / 25) !== Math.floor(apres / 25) && apres >= 50) {
    evt(etat, 'usure', `${voile(d, v).nom_court} de ${nom} : usure ${Math.round(apres)} % (${raison}).`, b.id, { voile: v, usure: apres });
  }
}

function resoudreRisque(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const nom = nomSkipper(d, etat, b);
  if (ctx.risque >= 5) {
    ctx.noir = true;
    ctx.issue = 'case noire';
    const multi = estMulticoque(d, b);
    evt(etat, 'jet_risque', multi ? `Case noire : ${nom} chavire !` : `Case noire : la voile de ${nom} va exploser !`, b.id, { niveau: 5, noir: true });
    b.distanceDernierTour = 0;
    if (b.reparations > 0) {
      ctx.etape = 'reparation';
      if (b.type === 'humain') {
        etat.attente = { type: 'reparation', bateauId: b.id, motif: 'voile_noire' };
        return;
      }
      traiterReparation(d, etat, b, decisionReparationIA(b, 'voile_noire', null));
      return;
    }
    traiterReparation(d, etat, b, false);
    return;
  }
  // Décision du 10/11/2026 : plus de dé de risque ni de pénalité tirée au hasard. Le risque pris se paie en
  // usure des voiles ; la malchance passe par les cartes du large ; la tempête par le dé tempête.
  if (d.regles.usure) {
    ctx.etape = 'deplacement';
    return;
  }
  if (ctx.risque === 0) {
    ctx.etape = 'deplacement';
    return;
  }
  const de = d6(etat);
  const seuil = d.regles.seuil_risque[ctx.risque];
  const declenche = de <= seuil;
  evt(etat, 'jet_risque', declenche ? `Dé de risque : ${de}. Un risque se déclenche pour ${nom} !` : `Dé de risque : ${de}. ${nom} passe sans encombre.`, b.id, {
    de, seuil, niveau: ctx.risque, declenche,
  });
  if (!declenche) {
    ctx.etape = 'deplacement';
    return;
  }
  if (etat.params.options.quiz) {
    const q = tirerQuestion(d, etat, b.niveauQuiz);
    if (q) {
      ctx.etape = 'quiz';
      if (b.type === 'humain') {
        etat.attente = { type: 'quiz', bateauId: b.id, questionId: q.id, niveau: q.niveau };
        return;
      }
      const p = d.regles.ia_quiz_reussite[b.niveauIA]?.[String(q.niveau)] ?? 0.5;
      const juste = alea(etat) < p;
      traiterReponseQuiz(d, etat, b, q, juste, juste ? q.reponse : -1);
      return;
    }
  }
  tirerPenalite(d, etat, b, ctx);
}

// ---------------------------------------------------------------- Dé événement et cartes du large

export function carteEvenement(d: Donnees, id: string) {
  return d.evenements?.cartes.find((c) => c.id === id) ?? null;
}

/** Une carte est « dommageable » si elle a un effet négatif (annulable par une carte réparation). */
export function estDommage(effet: import('./types').EffetEvenement): boolean {
  return (effet.distance ?? 0) < 0 || (effet.risque ?? 0) > 0 || !!effet.demi || !!effet.immobile || !!effet.perte_voile;
}

/** Lance le dé événement d'un bateau ; sur un 6, tire une carte du large. */
function tirerEvenement(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  const ev = d.evenements;
  if (!ev || etat.params.options.evenements === false || ev.cartes.length === 0) return;
  const nom = nomSkipper(d, etat, b);
  const sp = competence(d, b.competence).speciaux;
  // Dé du large (décision du 10/11/2026) : 5-6 carte du large, 3-4 question de culture marine, 1-2 rien.
  const regle = d.regles.de_du_large ?? { carte: [ev.de_evenement.declencheur], question: [] };
  const de = entier(etat, 6) + 1;
  const declenche = regle.carte.includes(de) || !!sp.declencheurs_evenement?.includes(de);
  const question = !declenche && regle.question.includes(de) && !!etat.params.options.quiz && !!b.choix?.voile;
  if (b.type === 'humain' || declenche || question)
    evt(
      etat, 'de_evenement',
      declenche ? `Dé du large : ${de} ! ${nom} tire une carte du large.` : question ? `Dé du large : ${de}. Question de culture marine pour ${nom}.` : `Dé du large : ${de}. Rien à signaler à bord de ${nom}.`,
      b.id, { de, declenche, question },
    );
  if (question) {
    const q = tirerQuestion(d, etat, b.niveauQuiz);
    if (!q) return;
    if (b.type === 'humain') {
      etat.attente = { type: 'quiz', bateauId: b.id, questionId: q.id, niveau: q.niveau, source: 'large' };
      return;
    }
    const pr = d.regles.ia_quiz_reussite[b.niveauIA]?.[String(q.niveau)] ?? 0.5;
    const juste = alea(etat) < pr;
    traiterQuestionLarge(d, etat, b, q, juste, juste ? q.reponse : -1);
    return;
  }
  if (!declenche) return;
  const possibles = ev.cartes.filter(
    (c) => (!c.familles || c.familles.includes(b.famille)) && (!c.effet.perte_voile || c.effet.perte_voile.some((v) => b.voiles.includes(v))),
  );
  let carte = tiragePondere(etat, possibles);
  if (sp.relance_avarie && estDommage(carte.effet)) {
    evt(etat, 'info', `${nom} a de la chance : la carte « ${carte.titre} » retourne dans le paquet, il en tire une autre.`, b.id);
    carte = tiragePondere(etat, possibles);
  }
  b.carteTour = { id: carte.id, reparee: false, voilePerdue: null };
  evt(etat, 'carte_evenement', `${carte.icone} ${carte.titre} (${nom}).`, b.id, { carteId: carte.id });
  if (estDommage(carte.effet) && b.reparations > 0) {
    if (b.type === 'humain') {
      etat.attente = { type: 'reparation', bateauId: b.id, motif: 'evenement', carteId: carte.id };
      return;
    }
    const e = carte.effet;
    const grave = !!e.immobile || !!e.perte_voile || (e.tours ?? 1) >= 2 || (e.distance ?? 0) <= -2;
    traiterReparationEvenement(d, etat, b, grave || b.reparations >= 2);
    return;
  }
  appliquerTirage(d, etat, b);
}

function traiterReparationEvenement(d: Donnees, etat: EtatPartie, b: EtatBateau, jouer: boolean) {
  if (!b.carteTour) return;
  if (jouer && b.reparations > 0) {
    b.reparations--;
    b.stats.reparationsJouees++;
    b.reparationCeTour = true;
    b.carteTour.reparee = true;
    const carte = carteEvenement(d, b.carteTour.id);
    const quoi = carte ? texteReparation(effetModule(d, b, carte)) : "l'avarie ne compte que pour moitié";
    evt(etat, 'reparation', `${nomSkipper(d, etat, b)} joue une carte réparation : ${quoi}.`, b.id);
  }
  appliquerTirage(d, etat, b);
}

/** Effets immédiats d'une carte : réparation gagnée, avarie durable, voile perdue. */
/** Effet d'une carte, modulé par le moral du skipper (cartes heureuses, durée des avaries). */
export function effetModule(d: Donnees, b: Pick<EtatBateau, 'competence'>, carte: import('./types').CarteEvenementDef): import('./types').EffetEvenement {
  const sp = competence(d, b.competence).speciaux;
  const e = { ...carte.effet };
  if (!estDommage(e)) {
    const f = sp.cartes_heureuses_facteur ?? 1;
    if (e.distance && e.distance > 0) e.distance = Math.round(e.distance * f);
    if (e.reparation) e.reparation = Math.round(e.reparation * f);
    if (e.risque && e.risque < 0) e.risque = Math.round(e.risque * f);
  } else if (e.tours && sp.avarie_tours) {
    e.tours = Math.max(1, e.tours + sp.avarie_tours);
  }
  return e;
}

/*
 * Avaries et cartes réparation (règle du porteur de projet, 12/11/2026). Référence complète, avec exemples :
 * jeu/docs/avaries-et-reparations.md. En bref, une avarie coûte une part de l'avance prévue du tour (barème), et non
 * une distance fixe, pour peser autant par petit temps que par vent fort :
 *   - barème p : légère (−1) 25 %, moyenne (−2) et chute à l'eau 50 %, lourde (−3) 75 %, tour perdu 100 % ;
 *   - non réparée : p sur le tour de la carte, puis p sur chacun des tours suivants d'une avarie durable ;
 *   - réparée, avarie d'un seul tour : p / 2 ;
 *   - réparée, avarie durable : p × REPARATION_DURABLE sur le tour de la carte (au plus 100 %), plus rien ensuite ;
 *   - voile menacée : endurer = voile perdue et 50 % ; réparer = voile sauvée et tour perdu ;
 *   - risque en plus : compté ce tour ; non réparée, aussi à chacun des tours suivants.
 */

/** Réparer une avarie durable : le tour de la carte coûte p × 1,5, les tours suivants ne coûtent plus rien (validé le 12/11/2026). */
export const REPARATION_DURABLE = 1.5;

/** Une carte dont l'effet dure plusieurs tours (durée déjà modulée par le moral du skipper, effetModule). */
export function estDurable(e: import('./types').EffetEvenement): boolean {
  return (e.tours ?? 1) > 1;
}

/**
 * Part de l'avance prévue perdue sur le tour où la carte tombe (0 à 1). Pour une avarie durable non réparée, c'est aussi
 * la part perdue à chacun des tours suivants (modificateur `perte`, appliqué par calculerDistance).
 */
export function perteCarte(e: import('./types').EffetEvenement, reparee: boolean): number {
  if (e.perte_voile) return reparee ? 1 : 0.5;
  let p = 0;
  if (e.immobile) p = 1;
  else if (e.demi) p = 0.5;
  else if (e.distance && e.distance < 0) p = Math.min(1, 0.25 * -e.distance);
  if (!reparee) return p;
  return estDurable(e) ? Math.min(1, p * REPARATION_DURABLE) : p / 2;
}

/** Ce que fait la carte réparation sur cette avarie, en une phrase (journal). */
function texteReparation(e: import('./types').EffetEvenement): string {
  if (e.perte_voile) return 'la voile est sauvée, mais le bateau ne fait pas de route ce tour';
  if (estDurable(e)) return "l'avarie est réparée tout de suite : ce tour coûte plus cher, les suivants ne coûtent plus rien";
  return "l'avarie ne compte que pour moitié";
}

function appliquerTirage(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  const carte = b.carteTour ? carteEvenement(d, b.carteTour.id) : null;
  if (!carte) return;
  const e = effetModule(d, b, carte);
  const reparee = !!b.carteTour!.reparee;
  if (estDommage(e)) b.stats.avaries++;
  if (e.reparation) b.reparations += e.reparation;
  // Effet durable : les tours suivants passent par un modificateur. Une avarie réparée s'arrête au tour de la carte.
  if (estDurable(e) && !reparee) {
    const dommage = estDommage(e);
    b.modificateurs.push({
      id: carte.id, titre: carte.titre, distance: dommage ? 0 : e.distance ?? 0, perte: dommage ? perteCarte(e, false) : 0,
      risque: e.risque ?? 0, toursRestants: e.tours! - 1, nouveau: true,
    });
  }
  if (e.perte_voile && !reparee) {
    const v = e.perte_voile.find((x) => b.voiles.includes(x));
    if (v) {
      perdreVoile(d, etat, b, v);
      b.carteTour!.voilePerdue = v;
    }
  }
}

/** Effets de la carte sur le tour en cours, au moment où le bateau se déplace. */
function resoudreEvenement(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  ctx.etape = 'risque';
  const t = b.carteTour;
  const carte = t ? carteEvenement(d, t.id) : null;
  if (!carte) return;
  const e = effetModule(d, b, carte);
  // Bonne nouvelle : des milles en plus. Avarie : une part de l'avance prévue du tour (perteCarte, réparée ou non).
  if (e.distance && e.distance > 0) ctx.distance += Math.round(e.distance * echelleBateau(d, carteDe(d, etat), b));
  const perte = perteCarte(e, !!t!.reparee);
  if (perte > 0) ctx.distance = Math.max(0, Math.round(ctx.distance * (1 - perte)));
  // Le risque de la carte compte sur ce tour, réparée ou non ; les tours suivants passent par le modificateur.
  if (e.risque) ctx.risque = Math.max(0, Math.min(5, ctx.risque + e.risque));
  if (perte >= 1 || ctx.distance <= 0) {
    b.distanceDernierTour = 0;
    evt(etat, 'bloque', `${nomSkipper(d, etat, b)} reste sur place ce tour (${carte.titre.toLowerCase()}).`, b.id);
    ctx.issue = `carte du large : ${carte.titre}`;
    ctx.etape = 'fin';
  }
}

function tirerQuestion(d: Donnees, etat: EtatPartie, niveau: number): QuestionDef | null {
  let pool = d.questions.filter((q) => q.niveau === niveau && !etat.quizUtilises.includes(q.id));
  if (pool.length === 0) {
    etat.quizUtilises = etat.quizUtilises.filter((id) => d.questions.find((q) => q.id === id)?.niveau !== niveau);
    pool = d.questions.filter((q) => q.niveau === niveau);
  }
  if (pool.length === 0) return null;
  const q = pool[entier(etat, pool.length)];
  etat.quizUtilises.push(q.id);
  return q;
}

function traiterReponseQuiz(d: Donnees, etat: EtatPartie, b: EtatBateau, q: QuestionDef, juste: boolean, reponse: number) {
  const ctx = etat.resolution!.courant!;
  const nom = nomSkipper(d, etat, b);
  if (juste) b.stats.quizJustes++;
  else b.stats.quizFaux++;
  evt(etat, 'quiz', juste ? `${nom} répond juste : le risque est écarté.` : `${nom} se trompe : avarie !`, b.id, {
    questionId: q.id, question: q.question, reponse, bonne: q.reponse, juste,
  });
  if (juste) {
    ctx.etape = 'deplacement';
    return;
  }
  tirerPenalite(d, etat, b, ctx);
}

function tirerPenalite(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  let p: PenaliteDef = tiragePondere(etat, d.regles.penalites);
  if (p.id === 'passe' && competence(d, b.competence).speciaux.passe_devient_demi) {
    p = d.regles.penalites.find((x) => x.id === 'demi') ?? p;
    evt(etat, 'info', `Mental d'acier : « passe ton tour » devient « déplacement divisé par 2 ».`, b.id);
  }
  ctx.penalite = p.id;
  b.stats.avaries++;
  evt(etat, 'penalite', `Avarie pour ${nomSkipper(d, etat, b)} : ${p.texte.toLowerCase()}.`, b.id, { penalite: p.id });
  if (b.reparations > 0) {
    ctx.etape = 'reparation';
    if (b.type === 'humain') {
      etat.attente = { type: 'reparation', bateauId: b.id, motif: 'penalite', penalite: p.id };
      return;
    }
    traiterReparation(d, etat, b, decisionReparationIA(b, 'penalite', p.id));
    return;
  }
  ctx.etape = 'deplacement';
}

function traiterReparation(d: Donnees, etat: EtatPartie, b: EtatBateau, jouer: boolean) {
  const ctx = etat.resolution!.courant!;
  const nom = nomSkipper(d, etat, b);
  const multi = estMulticoque(d, b);
  if (jouer && b.reparations > 0) {
    b.reparations--;
    b.stats.reparationsJouees++;
    b.reparationCeTour = true;
    if (ctx.noir) {
      evt(etat, 'reparation', multi ? `${nom} joue une réparation et redresse le bateau, sans avancer.` : `${nom} joue une réparation : la voile est sauvée, mais le bateau n'avance pas.`, b.id);
      ctx.etape = 'fin';
    } else {
      evt(etat, 'reparation', `${nom} joue une carte réparation : la pénalité est annulée.`, b.id);
      ctx.penalite = null;
      ctx.etape = 'deplacement';
    }
    return;
  }
  if (ctx.noir) {
    if (multi) {
      b.passeTours = 2;
      b.avarieGrave = true;
      evt(etat, 'naufrage', `${nom} a chaviré : immobilisé 2 tours, sauf escale technique.`, b.id);
      ctx.etape = 'fin';
      return;
    }
    // Règle du porteur de projet (12/11/2026) : qui endure la perte de sa voile la perd, mais avance de la moitié de la
    // distance prévue ; qui joue une réparation garde sa voile, mais n'avance pas (plus haut).
    perdreVoile(d, etat, b, b.choix!.voile);
    evt(etat, 'info', `${nom} endure : la voile est perdue, mais le bateau avance de la moitié de la distance prévue.`, b.id);
    ctx.penalite = 'demi';
    ctx.etape = 'deplacement';
    return;
  }
  ctx.etape = 'deplacement';
}

function perdreVoile(d: Donnees, etat: EtatPartie, b: EtatBateau, v: string | null) {
  if (!v || !b.voiles.includes(v)) return;
  b.voiles = b.voiles.filter((x) => x !== v);
  b.voilesPerdues.push(v);
  evt(etat, 'voile_perdue', `${nomSkipper(d, etat, b)} perd son ${voile(d, v).nom_court}.`, b.id, { voile: v });
  if (b.voilesPerdues.length >= 2) b.avarieGrave = true;
}

/**
 * Escale technique (décision du 09/11/2026) : après une avarie grave (chavirage, deuxième voile perdue), si un port
 * est assez proche, le bateau s'y arrête, répare tout et perd un tour, au lieu de rester immobilisé ou d'abandonner.
 */
function escaleTechnique(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  if (!b.avarieGrave) return;
  b.avarieGrave = false;
  const r = d.regles.escale_technique;
  const carte = carteDe(d, etat);
  if (!r || !carte.ports.length || b.arrive) return;
  const mpc = carte.course.milles_par_case ?? 1;
  const [px, py] = carte.ports.reduce((m, p) => (Math.hypot(p[0] - b.x, p[1] - b.y) < Math.hypot(m[0] - b.x, m[1] - b.y) ? p : m));
  if (Math.hypot(px - b.x, py - b.y) * mpc * (carte.facteur[b.y] ?? 1) > r.distance_max_milles) return;
  const depart: Case = [b.x, b.y];
  b.x = px;
  b.y = py;
  // Course sans escale (Vendée Globe, 12/11/2026, demande du porteur de projet) : s'arrêter au port, c'est abandonner.
  if (course(d, etat).regle_escale.type === 'interdite') {
    marquerIssue(etat, b, 'abandon au port');
    b.stats.escales++;
    b.horsClassement = true;
    evt(etat, 'port', `${nomSkipper(d, etat, b)}, gravement endommagé, rejoint le port le plus proche et abandonne : la course est sans escale ni assistance.`, b.id, { de: depart, vers: [px, py] });
    return;
  }
  marquerIssue(etat, b, 'escale technique au port');
  evt(etat, 'port', `${nomSkipper(d, etat, b)}, gravement endommagé, fait une escale technique au port le plus proche : réparation complète, ${r.tours} tour perdu.`, b.id, { de: depart, vers: [px, py] });
  b.voiles = [...b.voilesDepart];
  b.voilesPerdues = [];
  b.usure = {};
  b.reparations = Math.max(b.reparations, b.reparationsDepart);
  b.stats.escales++;
  b.passeTours = r.tours;
}

function occupees(d: Donnees, etat: EtatPartie, sauf: string): Set<number> {
  const carte = carteDe(d, etat);
  const s = new Set<number>();
  for (const o of etat.bateaux) if (o.id !== sauf && enCourse(o)) s.add(idx(carte, o.x, o.y));
  return s;
}

/**
 * Cases qui provoquent une collision dans la brume pour ce bateau : celles des concurrents, sauf ceux
 * qui n'entrent jamais en collision (Régatier). Un Régatier, lui, ne percute personne.
 */
function casesCollision(d: Donnees, etat: EtatPartie, b: EtatBateau): Set<number> {
  if (competence(d, b.competence).speciaux.sans_collision) return new Set();
  const carte = carteDe(d, etat);
  const s = new Set<number>();
  for (const o of etat.bateaux)
    if (o.id !== b.id && enCourse(o) && !competence(d, o.competence).speciaux.sans_collision) s.add(idx(carte, o.x, o.y));
  return s;
}

/** Ligne du journal des mouvements pour le bateau qui vient de finir son tour. */
function journaliser(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const de = ctx.de ?? [b.x, b.y];
  const p = etat.resolution?.previsions?.[b.id];
  const carte = b.carteTour ? carteEvenement(d, b.carteTour.id) : null;
  (etat.journal ??= []).push({
    tour: etat.tour,
    bateauId: b.id,
    skipper: nomSkipper(d, etat, b),
    type: b.type,
    de,
    vers: [b.x, b.y],
    cap: b.choix?.cap ?? null,
    voile: b.choix?.voile ?? null,
    ventChoix: p?.vent ?? null,
    distancePrevue: p?.distance ?? null,
    ventApres: ctx.ventLocal,
    zoneVent: (() => {
      const f = frontSur(etat, de[0], de[1]);
      return f ? (f.front.type === 'molle' ? 'molle' : f.zone) : dansAlize(etat, de[0], de[1]) ? 'alizé' : 'général';
    })(),
    relance: ctx.relance,
    louvoyage: !!ctx.louvoyage,
    distanceDes: ctx.distanceDes ?? null,
    carte: carte ? `${carte.titre}${b.carteTour!.reparee ? ' (réparée)' : ''}` : null,
    risque: ctx.distanceDes != null ? ctx.risque : null,
    penalite: ctx.penalite,
    distanceMax: b.choix?.distanceMax ?? null,
    budget: ctx.budget ?? null,
    chemin: ctx.chemin ?? [],
    parcourue: Math.hypot(b.x - de[0], b.y - de[1]) * (carteDe(d, etat).facteur[de[1]] ?? 1),
    bloque: ctx.bloque ?? null,
    courant: !!ctx.courant,
    arrive: !!ctx.arrive,
    issue: ctx.issue ?? (ctx.penalite ? `avarie : ${ctx.penalite}` : 'sans déplacement'),
  });
}

function deplacer(d: Donnees, etat: EtatPartie, b: EtatBateau, ctx: ContexteResolution) {
  const carte = carteDe(d, etat);
  const choix = b.choix!;
  const nom = nomSkipper(d, etat, b);
  const comp = competence(d, b.competence);
  const depart: Case = [b.x, b.y];
  const occ = casesCollision(d, etat, b);
  ctx.etape = 'fin';

  if (ctx.penalite === 'recul') {
    const r = tracerChemin(carte, occ, depart, b.porte, norm(choix.cap! + NB_DIR / 2), Math.max(1, Math.round(echelleBateau(d, carte, b))), {
      traverse: false, coutBrume: 1, ignoreCourantDefavorable: true,
    });
    const chemin = r.chemin;
    [b.x, b.y] = r.fin;
    ctx.issue = 'recul';
    ctx.budget = Math.max(1, Math.round(echelleBateau(d, carte, b)));
    ctx.chemin = chemin;
    b.distanceDernierTour = 0;
    evt(etat, 'deplacement', `${nom} recule de ${milles(carte, depart, r.fin)} milles.`, b.id, { de: depart, chemin, recul: true });
    majSillage(b, depart, chemin);
    return;
  }

  const autres = etat.bateaux.filter((o) => o.id !== b.id && enCourse(o));
  const restantAvant = distanceRestante(d, etat, b);
  const proches = new Set(autres.filter((o) => Math.hypot(o.x - b.x, o.y - b.y) <= A_VUE).map((o) => o.id));
  let distance = ctx.distance;
  if (ctx.penalite === 'demi') distance = Math.max(1, Math.floor(distance / 2));
  const mr = comp.speciaux.malus_reparation;
  if (mr && b.reparationCeTour) {
    distance = Math.max(1, distance + Math.round(mr * echelleBateau(d, carte, b)));
    evt(etat, 'info', `${nom} a passé du temps à bricoler : il avance un peu moins vite ce tour.`, b.id);
  }
  // Jauge (11/11/2026, Ultim le 13/11/2026) : les bonus (cartes, compétences) ne font jamais dépasser le record de la
  // classe en 24 h (640 milles en IMOCA et Ocean Fifty ; Ultim 851 en solitaire, 908 en équipage).
  const plafond = plafondCases(d, carte, b);
  if (plafond !== null && distance > plafond) distance = plafond;
  const obligatoire = choix.voile === null;
  const budget = obligatoire ? distance : Math.min(distance, choix.distanceMax ?? distance);
  void occ; // les traces qui se croisent ne se touchent pas : seule compte la case d'arrivée (règle du 10/11/2026)
  const r = tracerChemin(carte, new Set<number>(), depart, b.porte, choix.cap!, budget, {
    traverse: !!comp.speciaux.traverse_bateaux,
    coutBrume: comp.speciaux.cout_brume ?? 2,
    ignoreCourantDefavorable: !!comp.speciaux.ignore_courant_defavorable,
    tour: etat.tour,
    louvoyage: !!ctx.ventLocal && angleAllure(choix.cap!, ctx.ventLocal.direction) < 45,
    origine: b.pos,
  });
  // Pot-au-noir : un bateau qui y entre s'arrête au milieu de sa traversée, c'est la fin de son tour (11/11/2026).
  const zonesPot = carte.course.zones_meteo.filter((z) => z.type === 'pot_au_noir');
  const dansPot = (x: number, y: number) => zonesPot.some((z) => x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3]);
  if (zonesPot.length && !dansPot(depart[0], depart[1]) && !r.arrive) {
    const i = r.chemin.findIndex(([x, y]) => dansPot(x, y));
    if (i >= 0) {
      const z = zonesPot.find((zz) => { const [x, y] = r.chemin[i]; return x >= zz.rect[0] && x <= zz.rect[2] && y >= zz.rect[1] && y <= zz.rect[3]; })!;
      const prof = Math.max(1, Math.floor(Math.min(z.rect[2] - z.rect[0], z.rect[3] - z.rect[1]) / 2));
      const j = Math.min(r.chemin.length - 1, i + prof);
      r.chemin = r.chemin.slice(0, j + 1);
      r.fin = r.chemin[j] as Case;
      r.finExacte = [r.fin[0] + 0.5, r.fin[1] + 0.5];
      r.sommets = [r.sommets[0], r.finExacte];
      r.bloque = null;
      b.potAuNoir = true;
      evt(etat, 'meteo', `${nom} entre dans le pot-au-noir et s'arrête au milieu : fin de son tour. Au prochain tour, il lui faudra un dé pair pour repartir.`, b.id, { pot: true });
    }
  }
  // Priorité (11/11/2026, porteur de projet) : plus de déroutement après coup. Hors de la brume, le bateau qui arrive sur une
  // case déjà occupée s'arrête sur la dernière case libre de son trajet ; c'est compté dans son déplacement.
  const occupe = (x: number, y: number) => etat.bateaux.some((o) => o.id !== b.id && enCourse(o) && o.x === x && o.y === y);
  if (!r.arrive && r.chemin.length && occupe(r.fin[0], r.fin[1]) && !dansBrume(carte, r.fin[0], r.fin[1])) {
    const gene = etat.bateaux.find((o) => o.id !== b.id && enCourse(o) && o.x === r.fin[0] && o.y === r.fin[1])!;
    let j = r.chemin.length - 1;
    while (j >= 0 && occupe(r.chemin[j][0], r.chemin[j][1])) j--;
    const garde = r.chemin.slice(0, j + 1);
    const cles = new Set(garde.map(([x, y]) => `${x},${y}`));
    const somm: [number, number][] = [r.sommets[0]];
    for (const s of r.sommets.slice(1, -1)) {
      if (!cles.has(`${Math.floor(s[0])},${Math.floor(s[1])}`)) break;
      somm.push(s);
    }
    r.chemin = garde;
    r.fin = (j >= 0 ? garde[j] : depart) as Case;
    r.finExacte = [r.fin[0] + 0.5, r.fin[1] + 0.5];
    somm.push(r.finExacte);
    r.sommets = somm;
    r.bloque = 'bateau';
    evt(etat, 'info', `Priorité : ${nom} trouve ${nomSkipper(d, etat, gene)} déjà en place et s'arrête juste avant.`, b.id);
  }
  b.x = r.fin[0];
  b.y = r.fin[1];
  b.pos = [Math.round(r.finExacte[0] * 100) / 100, Math.round(r.finExacte[1] * 100) / 100];
  b.porte = r.porte;
  const priorite = r.arrive ? null : reglerPriorite(d, etat, b, r.chemin, ctx.ventLocal?.direction ?? etat.vent.direction);
  ctx.budget = budget;
  ctx.chemin = r.chemin;
  ctx.bloque = r.bloque;
  ctx.courant = r.courant;
  ctx.arrive = r.arrive;
  ctx.issue = ctx.issue ?? 'déplacement';
  b.distanceDernierTour = Math.hypot(b.x - depart[0], b.y - depart[1]);
  // Milles réellement parcourus (bords de louvoyage compris), pour le départage à l'arrivée (11/11/2026).
  b.stats.milles = (b.stats.milles ?? 0) + r.sommets.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r.sommets[i][0], p[1] - r.sommets[i][1]), 0) * (carte.course.milles_par_case ?? 1) * (carte.facteur[depart[1]] ?? 1);
  if (r.chemin.length) b.dernierCap = choix.cap;
  // La trace passe par le point exact où s'arrête la ligne droite, puis rejoint la case : elle ne coupe plus un cap ou
  // une presqu'île en reliant directement les centres des cases (correction du 10/11/2026).
  const [fx, fy] = r.finExacte;
  // Trace : le trajet réellement suivi (bords de louvoyage, dérive du courant), comme un traceur de course (11/11/2026).
  const nTrace = b.trace.length;
  const dd = Math.round(b.distanceDernierTour * 10) / 10;
  for (const [sx, sy] of r.sommets.slice(1, -1)) b.trace.push([Math.round((sx - 0.5) * 100) / 100, Math.round((sy - 0.5) * 100) / 100, dd]);
  if (r.chemin.length && Math.hypot(fx - (b.x + 0.5), fy - (b.y + 0.5)) > 0.05)
    b.trace.push([Math.round((fx - 0.5) * 100) / 100, Math.round((fy - 0.5) * 100) / 100, Math.round(b.distanceDernierTour * 10) / 10]);
  majSillage(b, depart, r.chemin);
  const n = r.chemin.length;
  let texte = n === 0 ? `${nom} reste sur place.` : `${nom} avance de ${milles(carte, depart, r.fin)} milles.`;

  if (r.bloque === 'terre' && !obligatoire && n < budget) texte += ' La côte l\'arrête.';
  if (r.bloque === 'brume') texte += ' La brume le ralentit.';
  if (r.courant) texte += ' Le courant le fait dériver.';
  evt(etat, 'deplacement', texte, b.id, { de: depart, chemin: r.chemin, bloque: r.bloque, caseBloquante: r.caseBloquante, finExacte: [fx - 0.5, fy - 0.5], nTrace, sommets: r.sommets.map(([sx, sy]) => [sx - 0.5, sy - 0.5]) });
  if (priorite) priorite();

  // Moment à raconter (et à montrer en 3D) : une flotte qui navigue à vue. Les dépassements sont
  // comptés en fin de tour, sur le classement (sinon les bateaux proches se doublent sans cesse).
  void restantAvant;
  const aVue = dansBrume(carte, b.x, b.y) ? [] : autres.filter((o) => !proches.has(o.id) && !dansBrume(carte, o.x, o.y) && Math.hypot(o.x - b.x, o.y - b.y) <= A_VUE);
  if (aVue.length && !r.arrive)
    evt(etat, 'a_vue', `${nom} navigue à vue de ${aVue.map((o) => nomSkipper(d, etat, o)).join(' et ')}.`, b.id, { autres: aVue.map((o) => o.id) });

  if (ctx.penalite === 'perte_voile') perdreVoile(d, etat, b, choix.voile);
  if (choix.voile && ctx.ventLocal) userVoile(d, etat, b, choix.voile, usureParTour(d, etat, choix.voile, ctx.ventLocal.force, b.famille), 'usure du tour');
  if (ctx.penalite === 'passe') b.passeTours = 1;

  if (obligatoire && r.bloque === 'terre' && n < budget) naufrage(d, etat, b);

  if (r.arrive) {
    b.arrive = true;
    b.tourArrivee = etat.tour;
    b.depassement = r.depassement;
    evt(etat, 'arrivee', `${nom} franchit la ligne d'arrivée !`, b.id, { depassement: r.depassement });
    return;
  }

  if (choix.recoudre && b.voilesPerdues.includes(choix.recoudre)) {
    b.voilesPerdues = b.voilesPerdues.filter((v) => v !== choix.recoudre);
    b.voiles.push(choix.recoudre);
    b.dernierRecousu = etat.tour;
    (b.usure ??= {})[choix.recoudre] = 50; // une voile recousue reste fatiguée
    evt(etat, 'recousu', `${nom} a recousu son ${voile(d, choix.recoudre).nom_court}.`, b.id);
  }

  if (carte.type[idx(carte, b.x, b.y)] === 'P' && etat.tour > 1) escale(d, etat, b);
}

/** Distance (en cases) en dessous de laquelle deux bateaux « naviguent à vue ». */
const A_VUE = 2.5;

/** Distance en milles nautiques entre deux cases (affichage pédagogique). */
export function milles(carte: CarteCompilee, a: Case, b: Case): number {
  return Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * (carte.course.milles_par_case ?? 1) * (carte.facteur[a[1]] ?? 1));
}

/**
 * Collision dans la brume (règle du 10/11/2026, qui remplace celle du 09/11) : les deux bateaux perdent une carte
 * réparation (s'il leur en reste) et sont immobilisés 1 tour. Elle n'a lieu que si un bateau termine son déplacement
 * sur la case d'un concurrent invisible dans la brume : c'est rare.
 */
function collision(d: Donnees, etat: EtatPartie, b: EtatBateau, autre: EtatBateau) {
  const r = d.regles.collision ?? { reparations: 1, tours: 1 };
  evt(etat, 'collision', `Collision dans la brume ! ${nomSkipper(d, etat, b)} percute ${nomSkipper(d, etat, autre)}.`, b.id, { autre: autre.id });
  for (const x of [b, autre]) {
    x.stats.avaries++;
    const perdue = Math.min(x.reparations, r.reparations);
    x.reparations -= perdue;
    x.passeTours = Math.max(x.passeTours, r.tours);
    marquerIssue(etat, x, 'collision dans la brume');
    evt(etat, 'info', `${nomSkipper(d, etat, x)} répare les dégâts${perdue ? ' : une carte réparation en moins' : ''}, immobilisé ${r.tours} tour.`, x.id);
  }
}

/** Bord d'un bateau : tribord amures si le vent vient de tribord (ou de l'axe), sinon bâbord amures. */
function bord(cap: number, ventDir: number): 'tribord' | 'bâbord' {
  return coteVent(cap, ventDir) >= 0 ? 'tribord' : 'bâbord';
}

/**
 * Case de déroutement autour d'une case disputée : de préférence « une case sous le vent, derrière »
 * par rapport au cap du bateau qui s'écarte, sinon derrière, sous le vent, puis n'importe quelle case libre voisine.
 */
function caseDeroutement(carte: CarteCompilee, dispute: Case, cap: number, ventDir: number, libre: (x: number, y: number) => boolean): Case | null {
  const [cx, cy] = vecteur(cap);
  const [lx, ly] = vecteur(norm(ventDir + NB_DIR / 2)); // sous le vent : là où va le vent
  const sens = (vx: number, vy: number): Case => {
    const m = Math.max(Math.abs(vx), Math.abs(vy)) || 1;
    return [Math.round(vx / m), Math.round(vy / m)];
  };
  const essais: Case[] = [sens(lx - cx, ly - cy), sens(-cx, -cy), sens(lx, ly), sens(-cx - lx, -cy - ly), sens(-lx, -ly)];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) essais.push([dx, dy]);
  for (const [dx, dy] of essais) {
    if (!dx && !dy) continue;
    const x = dispute[0] + dx, y = dispute[1] + dy;
    if (navigable(carte, x, y) && passageLibre(carte, dispute[0], dispute[1], x, y) && libre(x, y)) return [x, y];
  }
  return null;
}

/**
 * Deux bateaux ne finissent jamais sur la même case (règle du 10/11/2026). Celui qui arrive sur une case occupée :
 * - dans la brume, il ne voit pas le concurrent : collision (sauf Régatier) ;
 * - sinon, règle de priorité : sur le même bord, celui qui arrive se déroute d'une case sous le vent, derrière ;
 *   sur des bords opposés, le bateau bâbord amures passe derrière (règle 10 des Règles de course à la voile).
 * Renvoie l'action à exécuter après l'événement de déplacement (pour garder l'ordre du récit), ou null.
 */
function reglerPriorite(d: Donnees, etat: EtatPartie, b: EtatBateau, chemin: Case[], ventDir: number): (() => void) | null {
  const autre = etat.bateaux.find((o) => o.id !== b.id && enCourse(o) && o.x === b.x && o.y === b.y);
  if (!autre) return null;
  const carte = carteDe(d, etat);
  const dispute: Case = [b.x, b.y];
  const libre = (x: number, y: number) => !etat.bateaux.some((o) => enCourse(o) && o.x === x && o.y === y);
  const capB = b.choix?.cap ?? b.dernierCap ?? 0;
  const capA = autre.dernierCap ?? autre.choix?.cap ?? capB;
  const sansCollision = (x: EtatBateau) => !!competence(d, x.competence).speciaux.sans_collision;
  const deplacerVers = (x: EtatBateau, cap: number) => {
    const c = caseDeroutement(carte, dispute, cap, ventDir, libre);
    if (!c) return false;
    x.x = c[0];
    x.y = c[1];
    return true;
  };
  if (dansBrume(carte, dispute[0], dispute[1]) && !sansCollision(b) && !sansCollision(autre)) {
    return () => {
      collision(d, etat, b, autre);
      if (deplacerVers(b, capB)) chemin.push([b.x, b.y]); // les deux bateaux ne restent pas l'un sur l'autre
    };
  }
  const bordB = bord(capB, ventDir), bordA = bord(capA, ventDir);
  const cede = b; // le bateau déjà en place est prioritaire : seul celui qui arrive se déroute (11/11/2026)
  const nomC = nomSkipper(d, etat, cede), nomP = nomSkipper(d, etat, cede === b ? autre : b);
  return () => {
    if (!deplacerVers(cede, cede === b ? capB : capA)) return;
    if (cede === b) {
      chemin.push([b.x, b.y]);
      marquerIssue(etat, b, 'déplacement (priorité : déroutement)');
    }
    else {
      const l = [...(etat.journal ?? [])].reverse().find((x) => x.bateauId === autre.id && x.tour === etat.tour);
      if (l) {
        l.chemin.push([autre.x, autre.y]);
        l.vers = [autre.x, autre.y];
      }
      majSillage(autre, dispute, [[autre.x, autre.y]]);
    }
    evt(etat, 'info', `Priorité : ${nomC} trouve ${nomP} déjà en place et se déroute d'une case sous le vent, derrière.`, cede.id, { de: dispute, vers: [cede.x, cede.y] });
  };
}

/** Note dans le journal des mouvements ce qui est arrivé au bateau en cours de résolution. */
function marquerIssue(etat: EtatPartie, b: EtatBateau, issue: string) {
  const ctx = etat.resolution?.courant;
  if (ctx && ctx.bateauId === b.id) ctx.issue = issue;
}

function majSillage(b: EtatBateau, depart: Case, chemin: Case[]) {
  b.sillage = [...b.sillage, depart, ...chemin].slice(-24);
}

function naufrage(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  const nom = nomSkipper(d, etat, b);
  let texte: string;
  if (b.reparations > 0 && b.voiles.length > 0) {
    const v = b.voiles[b.voiles.length - 1];
    b.voiles = b.voiles.filter((x) => x !== v);
    b.voilesPerdues.push(v);
    b.reparations--;
    texte = `${nom} s'échoue à sec de toile : une voile et une réparation perdues.`;
  } else {
    const perdues = b.voiles.slice(-2);
    b.voiles = b.voiles.filter((x) => !perdues.includes(x));
    b.voilesPerdues.push(...perdues);
    texte = `${nom} s'échoue à sec de toile : ${perdues.length ? 'deux voiles perdues' : 'plus rien à perdre'}.`;
  }
  b.stats.avaries++;
  evt(etat, 'naufrage', texte, b.id);
  if (b.voiles.length === 0) retourPort(d, etat, b);
}

function retourPort(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  const carte = carteDe(d, etat);
  const occ = occupees(d, etat, b.id);
  const libres = carte.ports.filter(([x, y]) => !occ.has(idx(carte, x, y)));
  if (libres.length === 0) return;
  const [x, y] = libres.reduce((m, p) => (Math.max(Math.abs(p[0] - b.x), Math.abs(p[1] - b.y)) < Math.max(Math.abs(m[0] - b.x), Math.abs(m[1] - b.y)) ? p : m));
  const depart: Case = [b.x, b.y];
  b.x = x;
  b.y = y;
  marquerIssue(etat, b, 'remorqué au port');
  evt(etat, 'port', `${nomSkipper(d, etat, b)} n'a plus de voile : il est remorqué au port le plus proche.`, b.id, { de: depart, vers: [x, y] });
  escale(d, etat, b);
}

function escale(d: Donnees, etat: EtatPartie, b: EtatBateau) {
  const regle = course(d, etat).regle_escale;
  const abime = b.voilesPerdues.length > 0 || b.reparations < b.reparationsDepart;
  if (!abime) return;
  const nom = nomSkipper(d, etat, b);
  b.stats.escales++;
  if (regle.type === 'interdite') {
    b.horsClassement = true;
    evt(etat, 'port', `${nom} fait escale : la course est sans assistance, il est mis hors classement.`, b.id);
    return;
  }
  b.voiles = [...b.voilesDepart];
  b.voilesPerdues = [];
  b.usure = {};
  b.reparations = b.reparationsDepart;
  if (regle.type === 'penalite' && regle.tours > 0) {
    b.passeTours += regle.tours;
    evt(etat, 'port', `${nom} fait escale et répare tout, mais perd ${regle.tours} tour(s).`, b.id);
  } else {
    evt(etat, 'port', `${nom} fait escale et répare tout son bateau.`, b.id);
  }
}

function finirTour(d: Donnees, etat: EtatPartie) {
  // Dépassements : un bateau qui passe devant un autre au classement entre le début et la fin du tour.
  const avant = etat.resolution?.rangAvant;
  if (avant) {
    const apres = classement(d, etat).map((x) => x.id);
    for (const a of apres)
      for (const o of apres) {
        if (a === o) continue;
        if (avant.indexOf(a) > avant.indexOf(o) && apres.indexOf(a) < apres.indexOf(o) && !bateau(etat, o).arrive)
          evt(etat, 'depassement', `${nomSkipper(d, etat, bateau(etat, a))} double ${nomSkipper(d, etat, bateau(etat, o))} au classement !`, a, { autre: o });
      }
  }
  etat.resolution = null;
  for (const b of etat.bateaux) {
    b.carteTour = null;
    b.reparationCeTour = false;
    for (const m of b.modificateurs) {
      if (m.nouveau) m.nouveau = false;
      else m.toursRestants--;
    }
    b.modificateurs = b.modificateurs.filter((m) => m.toursRestants > 0);
  }
  for (const b of etat.bateaux) {
    if (b.horsClassement) continue;
    const der = b.trace[b.trace.length - 1];
    if (der && der[0] === b.x && der[1] === b.y) continue;
    if (b.arrive && b.tourArrivee !== etat.tour) continue;
    const [tx, ty] = b.pos && Math.floor(b.pos[0]) === b.x && Math.floor(b.pos[1]) === b.y ? [b.pos[0] - 0.5, b.pos[1] - 0.5] : [b.x, b.y];
    const dernierPt = b.trace[b.trace.length - 1];
    if (!dernierPt || Math.hypot(dernierPt[0] - tx, dernierPt[1] - ty) > 0.02) b.trace.push([Math.round(tx * 100) / 100, Math.round(ty * 100) / 100, Math.round(b.distanceDernierTour * 10) / 10]);
  }
  // Passage de la ligne (11/11/2026, porteur de projet) : les bateaux arrivés ce tour, dans l'ordre du départage, pour
  // l'animation (bouée jaune, bateau comité, le premier désigné passe la ligne en tête).
  const ligne = classement(d, etat).filter((b) => b.arrive && b.tourArrivee === etat.tour && !b.horsClassement);
  if (ligne.length) {
    const noms = ligne.map((b) => nomSkipper(d, etat, b));
    evt(etat, 'arrivee', ligne.length > 1
      ? `Ligne d'arrivée : ${noms.join(', puis ')}. Arrivés au même tour, départagés au quiz (taux, puis nombre de bonnes réponses), puis au moins de milles parcourus.`
      : `Ligne d'arrivée : ${noms[0]} coupe la ligne.`, undefined, { ligne: ligne.map((b) => b.id), autres: ligne.map((b) => b.id) });
  }
  const cats = categoriesPartie(d, etat);
  if (cats) {
    // Vainqueur de chaque catégorie, annoncé au tour de sa première arrivée (départage par le classement).
    for (const c of cats) {
      if (etat.vainqueurs?.[c] || !etat.bateaux.some((b) => b.arrive && categorie(d, b) === c)) continue;
      const v = classementCategorie(d, etat, c)[0];
      etat.vainqueurs = { ...etat.vainqueurs, [c]: v.id };
      evt(etat, 'arrivee', `Victoire en ${NOM_CATEGORIE[c]} : ${nomSkipper(d, etat, v)} !`, undefined, { categorie: c, vainqueur: v.id });
    }
  }
  // Fin de course : à la première arrivée ; avec deux classements, quand chaque catégorie a son vainqueur (ou n'a
  // plus aucun bateau en course).
  const finie = (c: Categorie) => etat.bateaux.some((b) => categorie(d, b) === c && b.arrive) || !etat.bateaux.some((b) => categorie(d, b) === c && enCourse(b));
  const premiereArrivee = etat.bateaux.some((b) => b.arrive) && (!cats || cats.every(finie));
  if (premiereArrivee && etat.tourFinMax === null) {
    etat.tourFinMax = etat.params.options.courseComplete ? etat.tour + d.regles.tours_supplementaires_course_complete : etat.tour;
  }
  const tousFinis = etat.bateaux.every((b) => !enCourse(b));
  if (tousFinis || (etat.tourFinMax !== null && etat.tour >= etat.tourFinMax) || etat.tour >= (course(d, etat).tours_max ?? d.regles.tours_max)) {
    etat.phase = 'fin';
    etat.classementFinal = classement(d, etat).map((b) => b.id);
    const premier = bateau(etat, etat.classementFinal[0]);
    const gagnants = cats?.map((c) => [c, classementCategorie(d, etat, c)[0]] as const).filter(([, b]) => b && !b.horsClassement);
    evt(etat, 'fin', gagnants && gagnants.length > 1
      ? `Fin de course : victoire de ${gagnants.map(([c, b]) => `${nomSkipper(d, etat, b)} en ${NOM_CATEGORIE[c]}`).join(' et de ')} !`
      : `Fin de course : victoire de ${nomSkipper(d, etat, premier)} !`, premier.id);
    return;
  }
  etat.tour++;
  etat.phase = 'choix';
  for (const b of etat.bateaux) b.choix = null;
  etat.tendance = tirerTendance(etat);
  for (const t of evoluerFronts(d, etat)) evt(etat, 'meteo', t);
  etat.desProchains = tirerDesVent(d, etat);
  etat.previsions = prevoirDes(d, etat);
  // Si aucun joueur humain n'a de choix à faire (immobilisé, déjà arrivé), ou si plus aucun bateau ne peut
  // choisir (tous immobilisés après des collisions), le tour se joue tout seul.
  if (humainsAttendus(etat).length === 0 && (etat.bateaux.some((b) => b.type === 'humain') || bateauxAttendus(etat).length === 0))
    demarrerResolution(d, etat);
}

/** Toutes les actions d'une partie rejouées depuis la graine (§10 : partie rejouable). */
export function rejouer(d: Donnees, params: ParamsPartie, actions: Action[]): EtatPartie {
  return actions.reduce((e, a) => appliquer(d, e, a), creerPartie(d, params));
}

export type { Evenement };
