// Calculs purs des règles : distance, risque et trajectoire d'un bateau.
import { CarteCompilee, dansCarte, diagonaleLibre, distanceRestanteCase, idx, navigable, passageLibre, terreFine, zonesCase } from './carte';
import { ANGLE_MIN, angleAllure, bandeForce, ecartDir, NB_DIR, norm, vecteur } from './geo';
import type {
  ClasseDef, Case, CompetenceDef, Condition, Direction, Donnees, Effet, EtatBateau, FamilleDef, Modificateur, Vent, VoileDef } from './types';

export interface Detail {
  libelle: string;
  valeur: number;
}

export interface ContexteCalcul {
  force: number;
  angle: number;
  zones: string[];
}

export function voile(d: Donnees, id: string): VoileDef {
  const v = d.voiles.find((x) => x.id === id);
  if (!v) throw new Error(`Voile inconnue : ${id}`);
  return v;
}

const equipages = new Map<string, CompetenceDef>();

/**
 * Compétence d'un bateau. En double (décision du 10/11/2026), l'identifiant « a+b » réunit les compétences du
 * skipper et du co-skipper : leurs effets s'ajoutent (bonus comme compromis) et leurs règles particulières se
 * cumulent (nombres additionnés, options réunies).
 */
export function competence(d: Donnees, id: string): CompetenceDef {
  if (id.includes('+')) {
    const cle = `${d.competences.length}:${id}`;
    const deja = equipages.get(cle);
    if (deja) return deja;
    const parts = id.split('+').map((x) => competence(d, x));
    const speciaux: Record<string, unknown> = {};
    for (const c of parts)
      for (const [k, v] of Object.entries(c.speciaux ?? {})) {
        const a = speciaux[k];
        // Les facteurs (usure, cartes heureuses) se multiplient ; les autres nombres s'additionnent.
        if (typeof v === 'number') speciaux[k] = k.endsWith('_facteur') ? (typeof a === 'number' ? a : 1) * v : (typeof a === 'number' ? a : 0) + v;
        else if (Array.isArray(v)) speciaux[k] = [...new Set([...(Array.isArray(a) ? a : []), ...v])];
        else speciaux[k] = a || v;
      }
    const c: CompetenceDef = {
      id, nom: parts.map((p) => p.nom).join(' + '), icone: parts.map((p) => p.icone).join(''),
      bonus: parts.map((p) => p.bonus).join(' ; '), malus: parts.map((p) => p.malus).join(' ; '),
      effets: parts.flatMap((p) => p.effets), speciaux: speciaux as CompetenceDef['speciaux'],
    };
    equipages.set(cle, c);
    return c;
  }
  return d.competences.find((x) => x.id === id) ?? d.competences.find((x) => x.id === 'aucune')!;
}

export function famille(d: Donnees, id: string): FamilleDef {
  const f = d.familles.find((x) => x.id === id);
  if (!f) throw new Error(`Famille inconnue : ${id}`);
  return f;
}

/** Une allure intermédiaire (67,5°, 112,5°, 157,5°) répond aux conditions des deux allures voisines. */
function allureCorrespond(allures: number[], angle: number): boolean {
  return allures.some((a) => Math.abs(a - angle) <= 22.5 + 1e-9);
}

export function conditionVraie(si: Condition | undefined, ctx: ContexteCalcul): boolean {
  if (!si) return true;
  if (si.force_min !== undefined && ctx.force < si.force_min) return false;
  if (si.force_max !== undefined && ctx.force > si.force_max) return false;
  if (si.allures && !allureCorrespond(si.allures, ctx.angle)) return false;
  if (si.zone && !ctx.zones.includes(si.zone)) return false;
  return true;
}

function appliquerEffets(effets: Effet[], type: Effet['type'], ctx: ContexteCalcul, libelle: string, details: Detail[]): number {
  let total = 0;
  for (const e of effets) {
    if (e.type === type && conditionVraie(e.si, ctx)) {
      total += e.valeur;
      details.push({ libelle, valeur: e.valeur });
    }
  }
  return total;
}

/**
 * Distance de base d'une voile pour un angle donné. La table de 1987 donne 45, 90, 135 et 180° ;
 * entre deux, on prend la moyenne arrondie à l'inférieur, ou la valeur voisine moins 1 si l'une est inutilisable.
 */
export function distanceBase(v: VoileDef, angle: number): number | null {
  if (angle < ANGLE_MIN) return null;
  // Angle minimal propre à la voile (11/11/2026) : un gennaker ne se porte pas au près ni au bon plein, seulement à partir
  // du travers ; avant, l'angle intermédiaire de 67,5° reprenait la valeur du travers moins 1.
  if (v.angle_min !== undefined && angle < v.angle_min) return null;
  const exact = v.distances[String(angle)];
  if (exact !== undefined) return exact;
  // Demi-cap (11,25° de plus ou de moins) : moyenne exacte des deux allures voisines ; inutilisable si l'une l'est.
  if (!Number.isInteger(angle / 22.5)) {
    const g = distanceBase(v, angle - 11.25), h = distanceBase(v, angle + 11.25);
    return g === null || h === null ? null : (g + h) / 2;
  }
  const a = v.distances[String(angle - 22.5)] ?? null;
  const b = v.distances[String(angle + 22.5)] ?? null;
  // Bon plein (67,5°) : un bateau y va plus vite qu'au près (12/11/2026, porteur de projet). Moyenne exacte du près et du
  // travers, et toujours au moins 10 % de plus qu'au près (avant : moyenne arrondie par défaut, souvent égale au près).
  if (a !== null && b !== null && angle === 67.5) return Math.round(Math.max((a + b) / 2, a * 1.1) * 100) / 100;
  if (a !== null && b !== null) return Math.floor((a + b) / 2);
  if (a === null && b === null) return null;
  return Math.max(1, (a ?? b)! - 1);
}

function profilAllure(f: FamilleDef, angle: number): number {
  const exact = f.profil_allure[String(angle)];
  if (exact !== undefined) return exact;
  if (!Number.isInteger(angle / 22.5)) return (profilAllure(f, angle - 11.25) + profilAllure(f, angle + 11.25)) / 2;
  const a = f.profil_allure[String(angle - 22.5)] ?? 0;
  const b = f.profil_allure[String(angle + 22.5)] ?? 0;
  return Math.trunc((a + b) / 2);
}

export function echelleCarte(carte: CarteCompilee): number {
  return carte.course.echelle ?? 1;
}

/** Classe d'un bateau (par sa famille d'architecture). */
export function classeBateau(d: Donnees, b: Pick<EtatBateau, 'famille'>): ClasseDef | undefined {
  const c = famille(d, b.famille).classe;
  return d.classes.find((x) => x.id === c);
}

/**
 * Le bateau est-il un multicoque (case noire et tempête : chavirage) ? Sa famille le dit quand la classe mélange
 * monocoques et multicoques (Vintage) ; sinon c'est celui de la classe.
 */
export function estMulticoque(d: Donnees, b: Pick<EtatBateau, 'famille'>): boolean {
  const f = famille(d, b.famille);
  return f.multicoque ?? !!d.classes.find((x) => x.id === f.classe)?.multicoque;
}

/**
 * Nom d'une force du vent sur l'échelle de Beaufort (« Coup de vent », « Tempête »…). Toujours un texte : une force hors
 * de la table prend le nom de la force la plus proche (13/11/2026 : l'affichage plantait en F9 à F11, absents de la table).
 */
export function nomBeaufort(d: Pick<Donnees, 'regles'>, force: number): string {
  const t = d.regles.beaufort;
  if (!t?.length) return `Force ${force}`;
  return t[Math.max(0, Math.min(t.length - 1, Math.round(force) || 0))] ?? `Force ${force}`;
}

/** Faces du dé de force selon la force actuelle : à F1, pas de baisse (règle du porteur de projet, 11/11/2026). */
/**
 * Variation de force réellement appliquée à un vent par la face tirée du dé de force (porteur de projet, 14/11/2026) : à partir
 * de F8, la face +2 compte −1 (le dé devient −2, −1, −1, 0, 0, +1) ; une tempête finit par retomber. Vent général et fronts.
 */
export function hausseVent(d: Donnees, force: number, df: number): number {
  const v = d.regles.vent_fort;
  if (!v || force < v.a_partir_de) return df;
  return v.faces[String(df)] ?? df;
}

export function facesForce(d: Donnees, force: number): number[] {
  return force <= d.regles.force_min && d.regles.de_force_min ? d.regles.de_force_min : d.regles.de_force;
}

/** Échelle « unités de la table des voiles → cases » pour un bateau : celle de la carte, multipliée par la vitesse de sa classe. */
export function echelleBateau(d: Donnees, carte: CarteCompilee, b: Pick<EtatBateau, 'famille'>): number {
  // Fastnet : même durée de course pour toutes les classes (15 tours) ; un réglage par classe compense leurs effets propres.
  if (carte.course.vitesse_unique) return echelleCarte(carte) * (carte.course.echelle_classe?.[classeBateau(d, b)?.id ?? ''] ?? 1);
  const c = classeBateau(d, b);
  return echelleCarte(carte) * (c?.vitesse ?? 1) * (carte.course.vitesse_classe?.[c?.id ?? ''] ?? 1);
}

type ProfilBateau = Pick<EtatBateau, 'competence' | 'famille' | 'x' | 'y'> & { modificateurs?: Modificateur[]; derniereVoile?: string | null; dernierCap?: number | null };

/** Record de distance en 24 h qui sert de jauge à ce bateau sur cette course (milles), ou null. */
export function jauge24h(d: Donnees, carte: CarteCompilee, b: Pick<EtatBateau, 'famille'>): number | null {
  const c = classeBateau(d, b);
  if (!c) return null;
  return carte.course.distance_max_24h_classe?.[c.id] ?? (carte.course.vitesse_unique ? null : c.distance_max_24h ?? null);
}

/**
 * Jauge de distance : jamais plus que le record de distance en 24 h de la classe, bonus compris (cartes du large
 * comprises, voir resoudreEvenement), au prorata de la durée du tour. Renvoie le plafond en cases pour un tour, ou null.
 * - 11/11/2026 : IMOCA et Ocean Fifty, 640 milles en 24 h sur les transatlantiques (distance_max_24h de la classe) ;
 * - 13/11/2026 : Ultim, record de la course selon le mode de navigation (distance_max_24h_classe de la course) :
 *   851 milles en solitaire (Route du Rhum), 908 en équipage (Transat Café L'Or, Rolex Fastnet Race au prorata).
 * Sur le Fastnet (vitesse unique), seule la jauge propre à la course s'applique.
 */
export function plafondCases(d: Donnees, carte: CarteCompilee, b: Pick<EtatBateau, 'famille'>): number | null {
  const c = classeBateau(d, b);
  const max = jauge24h(d, carte, b);
  if (!c || !max) return null;
  // Durée du tour : celle de la course pour les tours du monde et le Fastnet, sinon celle de la classe (heuresParTour).
  const heures = carte.course.distance_reelle || carte.course.vitesse_unique ? carte.course.heures_par_tour : c.heures_par_tour ?? carte.course.heures_par_tour;
  return Math.max(1, Math.floor((max * heures) / 24 / (carte.course.milles_par_case ?? 1)));
}

/** Les alizés sont favorables si le cap est à 22,5° au plus d'une direction listée. */
function capDans(cap: Direction, liste: number[] | undefined): boolean {
  return !!liste?.some((dir) => ecartDir(cap, dir) <= 1);
}

/**
 * Distance d'un tour, en cases, pour un cap, une voile (null = à sec de toile) et un vent donnés.
 * Les points de la table des voiles et les bonus/malus sont en « unités » ; la carte les convertit
 * en cases par son échelle. Retourne null si le déplacement est impossible.
 */
export function calculerDistance(
  d: Donnees,
  carte: CarteCompilee,
  b: ProfilBateau,
  voileId: string | null,
  cap: Direction,
  vent: Vent,
): { distance: number | null; details: Detail[]; louvoyage: boolean } {
  const details: Detail[] = [];
  // Louvoyage : cap à moins de 45° du vent. Le bateau tire des bords au près et progresse dans l'axe visé,
  // à une fraction (coefficient) de sa distance au près. Seules les voiles de près le permettent.
  const angleReel = angleAllure(cap, vent.direction);
  const louvoyage = angleReel < ANGLE_MIN;
  const angle = louvoyage ? ANGLE_MIN : angleReel;
  const v = voile(d, voileId ?? 'reduite');
  const base = distanceBase(v, angle);
  if (base === null)
    return { distance: null, details: [{ libelle: louvoyage ? 'Voile inutilisable pour louvoyer (voile de portant)' : 'Voile inutilisable à cette allure', valeur: 0 }], louvoyage };
  // Bonus et malus en pourcentage (12/11/2026, décision du porteur de projet) : chaque +1 = +20 %, chaque −1 = −20 %,
  // cumulés en multipliant. Avant, un cran de la table s'ajoutait puis était multiplié par l'échelle de la course
  // (un malus divisait la distance par deux, plusieurs ramenaient toutes les voiles au minimum).
  let dist = 0;
  details.push({ libelle: louvoyage ? `${voileId ? v.nom_court : 'À sec de toile'} au près, pour louvoyer` : voileId ? `${v.nom_court} à ${String(angle).replace('.', ',')}°` : `À sec de toile à ${String(angle).replace('.', ',')}°`, valeur: base });
  if (vent.force <= 2 && v.moins_petit_temps) {
    dist -= 1;
    details.push({ libelle: 'Petit temps (F1–2)', valeur: -1 });
  }
  if (vent.force >= 7 && v.plus_brise) {
    dist += 1;
    details.push({ libelle: 'Brise forte (F7–8)', valeur: 1 });
  }
  const zones = zonesCase(carte, b.x, b.y);
  const ctx: ContexteCalcul = { force: vent.force, angle, zones };
  if (voileId) {
    const f = famille(d, b.famille);
    dist += appliquerEffets(f.effets, 'distance', ctx, `Famille ${f.nom}`, details);
    const pa = profilAllure(f, angle);
    if (pa) {
      dist += pa;
      details.push({ libelle: `Profil d'allure ${f.nom}`, valeur: pa });
    }
    const c = competence(d, b.competence);
    dist += appliquerEffets(c.effets, 'distance', ctx, c.nom, details);
    const mcc = c.speciaux.malus_changement_cap;
    // Seulement un grand changement de cap (90° et plus), décision du porteur de projet du 12/11/2026.
    if (mcc && b.dernierCap !== undefined && b.dernierCap !== null && ecartDir(cap, b.dernierCap) >= NB_DIR / 4) {
      dist += mcc;
      details.push({ libelle: `${c.nom} : grand changement de cap`, valeur: mcc });
    }
    const mcv = c.speciaux.malus_changement_voile;
    // Seulement un grand changement de voile : d'une voile de près à une voile de portant ou l'inverse (12/11/2026).
    const dePres = (id: string) => voile(d, id).distances['45'] !== null;
    if (mcv && b.derniereVoile && voileId !== b.derniereVoile && dePres(voileId) !== dePres(b.derniereVoile)) {
      dist += mcv;
      details.push({ libelle: `${c.nom} : passage près ↔ portant`, valeur: mcv });
    }
    // Bonne nouvelle durable, en unités de la table. Le tour où la carte tombe (nouveau) est compté par resoudreEvenement.
    for (const m of b.modificateurs ?? []) {
      if (!m.distance || m.nouveau) continue;
      dist += m.distance;
      details.push({ libelle: `${m.titre} (encore ${m.toursRestants} tour${m.toursRestants > 1 ? 's' : ''})`, valeur: m.distance });
    }
  }
  const ia = carte.alize[idx(carte, b.x, b.y)];
  if (ia >= 0) {
    const z = carte.course.zones_meteo[ia];
    const c = competence(d, b.competence);
    if (capDans(cap, z.favorables) && !c.speciaux.sans_bonus_alize) {
      dist += 1;
      details.push({ libelle: 'Alizés favorables', valeur: 1 });
    } else if (capDans(cap, z.defavorables)) {
      dist -= 1;
      details.push({ libelle: 'Alizés contraires', valeur: -1 });
    }
  }
  const pas = d.regles.pourcentage_bonus ?? 0.2;
  const mult = dist >= 0 ? Math.pow(1 + pas, dist) : Math.pow(1 - pas, -dist);
  const unites = Math.round(base * mult * 100) / 100;
  if (dist !== 0) details.push({ libelle: `Bonus et malus : ${dist > 0 ? '+' : '−'}${Math.abs(dist)} soit × ${String(Math.round(mult * 100) / 100).replace('.', ',')} (${pas * 100} % par cran)`, valeur: Math.round(mult * 100) / 100 });
  const e = echelleBateau(d, carte, b);
  const coef = louvoyage ? d.regles.louvoyage?.coefficient ?? 0.6 : 1;
  const cf = d.regles.coefficient_force?.[Math.max(0, Math.min(12, vent.force))] ?? 1;
  if (cf !== 1) details.push({ libelle: `Force du vent F${vent.force} : vitesse × ${String(cf).replace('.', ',')}`, valeur: cf });
  // Louvoyage : 60 % de la distance au près telle qu'elle est affichée (déjà arrondie à la case), pour que les deux
  // chiffres montrés au joueur respectent la règle (correction du 10/11/2026 : 27 cases pour 44 au près, au lieu de 26).
  const casesPres = Math.max(1, Math.round(unites * e * cf));
  const cases = louvoyage ? Math.max(1, Math.round(casesPres * coef)) : casesPres;
  if (louvoyage) details.push({ libelle: `Louvoyage : ${Math.round(coef * 100)} % de la distance au près (bords et virements)`, valeur: coef });
  if (e !== 1) details.push({ libelle: `Total ${String(unites).replace('.', ',')}${louvoyage ? ` × ${String(coef).replace('.', ',')}` : ''}${cf !== 1 ? ` × ${String(cf).replace('.', ',')}` : ''} × échelle ${String(Math.round(e * 100) / 100).replace('.', ',')} = cases`, valeur: cases });
  const plafond = plafondCases(d, carte, b);
  let total = cases;
  if (plafond !== null && cases > plafond) {
    details.push({ libelle: `Jauge : ${jauge24h(d, carte, b)} milles en 24 h au plus (record de la classe)`, valeur: plafond });
    total = plafond;
  }
  // Avarie durable, tours suivant celui de la carte : une part de l'avance du tour (docs/avaries-et-reparations.md).
  // Deux avaries en même temps se multiplient (25 % puis 50 % : il reste 0,75 × 0,5 = 37,5 % de l'avance).
  for (const m of b.modificateurs ?? []) {
    if (!m.perte || m.nouveau) continue;
    const apres = Math.max(1, Math.round(total * (1 - m.perte)));
    details.push({
      libelle: `${m.titre} : avance −${Math.round(m.perte * 100)} % (encore ${m.toursRestants} tour${m.toursRestants > 1 ? 's' : ''})`,
      valeur: apres - total,
    });
    total = apres;
  }
  return { distance: total, details, louvoyage };
}

/**
 * Force la plus forte que tient une voile à un angle au vent (plages du porteur de projet, 14/11/2026, toutes classes).
 * Sans angle : la plage la plus large de la voile. Entre deux allures de la table, la plus basse des deux.
 */
export function forceMaxVoile(v: VoileDef, angle?: number | null): number {
  const m = v.force_max;
  if (m === undefined) return Infinity;
  if (typeof m === 'number') return m;
  const cles = Object.keys(m).map(Number).filter((k) => !Number.isNaN(k)).sort((a, b) => a - b);
  if (!cles.length) return Infinity;
  if (angle === undefined || angle === null) return Math.max(...cles.map((k) => m[String(k)]));
  const sous = cles.filter((k) => k <= angle + 1e-9).pop();
  const sur = cles.find((k) => k >= angle - 1e-9);
  const vals = [sous, sur].filter((k): k is number => k !== undefined).map((k) => m[String(k)]);
  return Math.min(...vals);
}

/** La plage de la voile dépend-elle de l'allure ? */
export function plageParAllure(v: VoileDef): boolean {
  return typeof v.force_max === 'object' && v.force_max !== null;
}

/** Plage d'une voile en clair : « jusqu'à F5 » ou « F4 au travers, F5 au largue, F6 au vent arrière ». */
export function textePlage(v: VoileDef): string {
  const m = v.force_max;
  if (m === undefined) return '';
  if (typeof m === 'number') return `jusqu'à F${m}`;
  const noms: Record<string, string> = { '90': 'au travers', '135': 'au largue', '180': 'au vent arrière' };
  return `jusqu'à ${Object.keys(m).filter((k) => !k.startsWith('_')).sort((a, b) => Number(a) - Number(b)).map((k) => `F${m[k]} ${noms[k] ?? `à ${k}°`}`).join(', ')}`;
}

/** Niveau de risque de 0 (blanc) à 5 (noir), après bonus et malus. `cap` : pour les voiles dont la plage dépend de l'allure. */
export function calculerRisque(
  d: Donnees,
  carte: CarteCompilee,
  b: ProfilBateau,
  voileId: string | null,
  vent: Vent,
  cap?: Direction | null,
): { risque: number; details: Detail[] } {
  if (!voileId) return { risque: 0, details: [{ libelle: 'À sec de toile', valeur: 0 }] };
  const v = voile(d, voileId);
  const details: Detail[] = [];
  // Plage de la voile (14/11/2026, toutes classes) : au-delà, trop de toile, quels que soient les bonus.
  const angle = cap === undefined || cap === null ? null : Math.max(ANGLE_MIN, angleAllure(cap, vent.direction));
  const max = forceMaxVoile(v, angle);
  if (vent.force > max) {
    details.push({ libelle: `${v.nom_court} : jusqu'à F${max}${plageParAllure(v) ? ' à cette allure' : ''}, trop de toile en F${vent.force}`, valeur: 5 });
    return { risque: 5, details };
  }
  let r = v.risque[bandeForce(vent.force)];
  details.push({ libelle: `${v.nom_court} en F${vent.force}`, valeur: r });
  const ctx: ContexteCalcul = { force: vent.force, angle: -1, zones: zonesCase(carte, b.x, b.y) };
  const f = famille(d, b.famille);
  r += appliquerEffets(f.effets, 'risque', ctx, `Famille ${f.nom}`, details);
  const c = competence(d, b.competence);
  r += appliquerEffets(c.effets, 'risque', ctx, c.nom, details);
  for (const m of b.modificateurs ?? []) {
    if (!m.risque || m.nouveau) continue;
    r += m.risque;
    details.push({ libelle: m.titre, valeur: m.risque });
  }
  // Dans sa plage, la voile tient, pour toutes les classes (14/11/2026) : les malus colorent le risque sans la rendre noire.
  if (r >= 5) {
    details.push({ libelle: `Dans sa plage (jusqu'à F${max}) : la voile tient`, valeur: 4 - r });
    r = 4;
  }
  return { risque: Math.max(0, Math.min(4, r)), details };
}

/** Un bateau dans la brume est invisible des autres (prévisions, IA, carte). */
export function dansBrume(carte: CarteCompilee, x: number, y: number): boolean {
  return dansCarte(carte, x, y) && carte.zones[idx(carte, x, y)].includes('brume');
}

export interface ResultatChemin {
  chemin: Case[];
  fin: Case;
  bloque: 'terre' | 'bateau' | 'collision' | 'brume' | null;
  /** Case qui a arrêté le bateau (obstacle ou bateau), pour l'affichage. */
  caseBloquante: Case | null;
  /** Point exact (en cases, coordonnées continues) où s'arrête la ligne droite : la trace et l'animation y passent. */
  finExacte: [number, number];
  /** Points du trajet réellement suivi (bords de louvoyage, dérive du courant), départ et arrivée compris. */
  sommets: [number, number][];
  porte: number;
  arrive: boolean;
  depassement: number;
  courant: boolean;
}

export interface OptionsChemin {
  /** Plus utilisé depuis le 09/11/2026 : les bateaux ne se bloquent plus entre eux. */
  traverse: boolean;
  coutBrume: number;
  ignoreCourantDefavorable: boolean;
  /** Tour en cours : les courants de marée s'inversent d'un tour à l'autre. */
  tour?: number;
  /** Louvoyage : le bateau tire des bords en zigzag de part et d'autre de l'axe visé (11/11/2026). */
  louvoyage?: boolean;
  /**
   * Contournement automatique des marques et de la côte (11/11/2026). Retiré le 12/11/2026 à la demande du porteur de
   * projet (« finir en plusieurs tours redonne du suspense ») : il n'est plus appliqué que si on le demande ici.
   */
  enrouler?: boolean;
  /** Position exacte de départ (dans la case de départ) ; sinon le centre de la case. */
  origine?: [number, number];
}

/**
 * Trajectoire en ligne droite selon le cap, par pas d'une case de longueur (distance réelle :
 * une diagonale n'est plus « gratuite »). Les cases de brume coûtent plus ; un courant traversé
 * dévie le bateau d'une case en fin de déplacement ; on ne coupe pas un coin de terre.
 */
export function tracerChemin(
  carte: CarteCompilee,
  occupees: Set<number>,
  depart: Case,
  porteDepart: number,
  cap: Direction,
  budget: number,
  opts: OptionsChemin,
): ResultatChemin {
  const [vx, vy] = vecteur(cap);
  const [x0, y0] = depart;
  // Point de départ exact (11/11/2026) : le bateau repart de là où il s'est arrêté, pas du centre de sa case.
  const ox = opts.origine && Math.floor(opts.origine[0]) === x0 && Math.floor(opts.origine[1]) === y0 ? opts.origine[0] : x0 + 0.5;
  const oy = opts.origine && Math.floor(opts.origine[0]) === x0 && Math.floor(opts.origine[1]) === y0 ? opts.origine[1] : y0 + 0.5;
  let [x, y] = depart;
  // Le bateau avance par petits pas le long de l'axe visé ; la longueur comptée est la progression sur l'axe (le budget).
  // Dans la brume, chaque pas coûte plus cher (coutBrume) : le bateau y avance moins loin.
  // Corrections du 11/11/2026 (porteur de projet) :
  // - louvoyage : le bateau suit réellement des bords en zigzag à ±40° de l'axe, comme l'aperçu, et ne passe que par la mer
  //   (si un bord touche la terre, il tire le bord de l'autre côté, sinon il reste sur l'axe) ;
  // - courant : la dérive s'ajoute pas à pas au déplacement, au lieu de décaler le bateau d'une case après coup.
  const PAS = 0.25;
  const EPS = 1e-9;
  let consomme = 0;
  let porte = porteDepart;
  const chemin: Case[] = [];
  let bloque: ResultatChemin['bloque'] = null;
  let caseBloquante: Case | null = null;
  let arrive = false;
  let brume = false;
  let courant = false;
  // Vraie distance (12/11/2026) : un pas coûte la taille réelle de la case (plus petite vers les pôles sur la carte du monde).
  const coutCase = (cx: number, cy: number) => (dansCarte(carte, cx, cy) && carte.zones[idx(carte, cx, cy)].includes('brume') ? opts.coutBrume : 1) * (carte.facteur[cy] ?? 1);
  const nb = opts.louvoyage ? Math.max(2, Math.round(budget / 2)) : 0;
  const longBord = nb ? budget / nb : 0;
  const amplitude = (longBord / 2) * Math.tan((40 * Math.PI) / 180);
  let cote = 1;
  const decalage = (t: number) => {
    if (!nb) return 0;
    const k = Math.min(nb - 1, Math.floor(t / longBord));
    const u = t / longBord - k;
    return amplitude * (u < 0.5 ? 2 * u : 2 - 2 * u) * (k % 2 ? -1 : 1) * cote;
  };
  let derX = 0, derY = 0; // dérive du courant accumulée
  let px = ox, py = oy; // position exacte
  const sommets: [number, number][] = [[px, py]];
  let dernierBord = -1;
  let enroule = false;
  const navigue = (qx: number, qy: number) => navigable(carte, Math.floor(qx), Math.floor(qy)) && !terreFine(carte, qx, qy);
  for (let t = PAS; budget > 0; t += PAS) {
    // Position visée à ce pas : axe + bord de louvoyage + dérive ; si le bord touche la terre, bord opposé, puis l'axe.
    let off = decalage(t);
    let qx = ox + t * vx - vy * off + derX, qy = oy + t * vy + vx * off + derY;
    if (off !== 0 && !navigue(qx, qy)) {
      cote = -cote;
      off = decalage(t);
      qx = ox + t * vx - vy * off + derX;
      qy = oy + t * vy + vx * off + derY;
      if (!navigue(qx, qy)) {
        off = 0;
        qx = ox + t * vx + derX;
        qy = oy + t * vy + derY;
      }
    }
    let nx = Math.floor(qx);
    let ny = Math.floor(qy);
    // Changement de bord près d'une côte : la position visée peut sauter deux cases d'un coup. Le bateau avance quand même
    // case par case (correction du 12/11/2026, anomalie « saut » du journal des mouvements).
    if (Math.max(Math.abs(nx - x), Math.abs(ny - y)) > 1) {
      nx = x + Math.sign(nx - x);
      ny = y + Math.sign(ny - y);
      qx = nx + 0.5;
      qy = ny + 0.5;
    }
    // Terre fine : le bateau s'arrête au bord d'une presqu'île ou d'un cap plus étroits qu'une case (contrôle au pas et
    // à mi-pas, pour ne pas rogner le coin d'une sous-case de terre).
    if (navigable(carte, nx, ny) && (terreFine(carte, qx, qy) || terreFine(carte, (qx + px) / 2, (qy + py) / 2))) {
      bloque = 'terre';
      caseBloquante = [nx, ny];
      break;
    }
    if (nx === x && ny === y) {
      const c = PAS * coutCase(x, y);
      if (consomme + c > budget + EPS) {
        if (brume) bloque = 'brume';
        break;
      }
      consomme += c;
      if (c > PAS) brume = true;
    } else {
      if (!navigable(carte, nx, ny) || !diagonaleLibre(carte, x, y, nx, ny)) {
        bloque = 'terre';
        caseBloquante = dansCarte(carte, nx, ny) ? [nx, ny] : null;
        break;
      }
      const i = idx(carte, nx, ny);
      const cout = PAS * coutCase(nx, ny);
      if (consomme + cout > budget + EPS) {
        if (brume || cout > PAS) bloque = 'brume';
        break;
      }
      if (cout > PAS) brume = true;
      // Dans la brume, on ne voit pas le concurrent : on le percute.
      if (occupees.has(i) && carte.zones[i].includes('brume')) {
        bloque = 'collision';
        caseBloquante = [nx, ny];
        break;
      }
      x = nx;
      y = ny;
      consomme += cout;
      chemin.push([x, y]);
      const porteAvant = porte;
      while (porte < carte.portes.length && carte.portes[porte].has(i)) porte++;
      if (porte >= carte.portes.length) {
        arrive = true;
        px = qx;
        py = qy;
        break;
      }
      if (porte > porteAvant && opts.enrouler === true) {
        // Marque franchie : le skipper enroule et file vers la suivante (voir plus bas).
        enroule = true;
        px = qx;
        py = qy;
        break;
      }
    }
    // Sommets des bords (pour la trace) : au milieu de chaque bord, là où le bateau vire.
    if (nb) {
      const k = Math.floor((t - PAS / 2) / longBord * 2);
      if (k !== dernierBord && k % 2 === 1) sommets.push([qx, qy]);
      dernierBord = k;
    }
    px = qx;
    py = qy;
    // Courant : dérive d'un peu moins d'un tiers de case par case parcourue, dans le sens du courant (au plus 1,5 case).
    const ic = carte.courant[idx(carte, x, y)];
    if (ic >= 0) {
      const z = carte.course.zones_meteo[ic];
      let dir = z.direction ?? -1;
      if (z.maree && dir >= 0 && (opts.tour ?? 0) % 2 === 1) dir = norm(dir + 8); // renverse de la marée
      const defavorable = dir >= 0 && ecartDir(dir, cap) >= 6;
      if (dir >= 0 && !(defavorable && opts.ignoreCourantDefavorable) && Math.hypot(derX, derY) < 1.5) {
        const [cx, cy] = vecteur(dir);
        derX += cx * PAS * 0.3;
        derY += cy * PAS * 0.3;
        courant = true;
      }
    }
  }
  // Contournement des marques (11/11/2026, choix du porteur de projet) : une marque franchie, le bateau ne garde pas son
  // cap. Comme un skipper qui enroule la bouée, il file vers la marque suivante (ou l'arrivée) avec la distance qui lui
  // reste, au plus court par la mer. Sinon, chaque changement de cap autour d'une île coûtait un tour entier.
  // Près de l'arrivée (500 milles, idée du porteur de projet du 11/11/2026, en attendant une grille plus fine) : un
  // bateau arrêté par la côte la contourne avec la distance qui lui reste, au lieu de perdre son tour contre la terre.
  if (!enroule && !arrive && bloque === 'terre' && opts.enrouler === true && consomme < budget - 1
    && distanceRestanteCase(carte, x0, y0, porteDepart) * (carte.course.milles_par_case ?? 1) <= 500) {
    enroule = true;
    bloque = null;
    caseBloquante = null;
  }
  if (enroule) {
    sommets.push([px, py]);
    const DX8 = [0, 1, 1, 1, 0, -1, -1, -1], DY8 = [-1, -1, 0, 1, 1, 1, 0, -1];
    for (let garde = 0; consomme < budget - EPS && garde < 400; garde++) {
      let mieux: Case | null = null;
      let dMieux = distanceRestanteCase(carte, x, y, porte);
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (!navigable(carte, nx, ny) || !diagonaleLibre(carte, x, y, nx, ny)) continue;
        const dd = distanceRestanteCase(carte, nx, ny, porte);
        if (dd < dMieux - 1e-9) {
          dMieux = dd;
          mieux = [nx, ny];
        }
      }
      if (!mieux) break;
      const cout = Math.hypot(mieux[0] - x, mieux[1] - y) * coutCase(mieux[0], mieux[1]);
      if (consomme + cout > budget + EPS) break;
      consomme += cout;
      [x, y] = mieux;
      chemin.push([x, y]);
      px = x + 0.5;
      py = y + 0.5;
      sommets.push([px, py]);
      const i = idx(carte, x, y);
      while (porte < carte.portes.length && carte.portes[porte].has(i)) porte++;
      if (porte >= carte.portes.length) {
        arrive = true;
        break;
      }
    }
    sommets.pop(); // le dernier point est ajouté juste après
  }
  const reste = Math.max(0, budget - consomme);
  sommets.push([px, py]);
  return { chemin, fin: [x, y], bloque, caseBloquante, porte, arrive, depassement: arrive ? reste : 0, courant, finExacte: [px, py], sommets };
}
