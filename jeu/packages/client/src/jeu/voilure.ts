// Plans de voilure des bateaux du jeu (10/11/2026, demande du porteur de projet : « réalisme maximal »).
// Chaque voile est dessinée pour avoir sa VRAIE surface : grand-voile à tête carrée et rond de chute sur la vraie
// longueur de bôme, voiles d'avant dont le point d'écoute est calculé pour retrouver leur surface.
// Surfaces (m², vraie grandeur) :
// - IMOCA (MACIF Santé Prévoyance) : grand-voile 160-180, J2 100-110, code 0 ≈ 200, spi asymétrique ≈ 400
//   (Figaro Nautisme, « Comprendre les voiles à bord des IMOCA du Vendée Globe », 2024 ; vvanat.fr) ; J3, tourmentin et
//   gennaker estimés.
// - IMOCA à dérives (Macif 2011) : 300 m² au près, 550 au portant (fiche VPLP) → grand-voile 170, J1 130, spi 380.
// - Ultim (Banque Populaire XI, fiche officielle) : grand-voile 310, J0 450, J1 250, J2 180, J3 60 (pas de spi : J0).
// - Ultim ancienne génération (IDEC Sport, Wikipédia) : après réduction du mât, 411 au près, 678 au portant.
// - Ocean Fifty : ≈ 200 au près, 250 à 265 au portant, grand-voile ≈ 100 (VPLP, bateaux.com).
// - Class40 : 115 au plus au près (jauge, globe40.com) ; voiles de portant estimées.
// - Pen Duick III (goélette de 1967) : 152 au près (Wikipédia) ; misaine lattée de 36 au louvoyage et grande misaine à
//   bordure libre de 93,60 au largue et au vent arrière (bateaux.com). Grand-voile (50) et génois (66) estimés pour
//   retrouver les 152 m² au près (50 + 36 + 66) ; foc, tourmentin, génois léger et spis estimés.
// Les valeurs « estimées » sont signalées dans jeu/docs/decisions-jeu.md.
import * as T from 'three';
import modelesVintage from '@cal/data/config/modeles-vintage.json';

/** Cotes des monocoques de légende (une seule source pour Blender, la 3D et le plan de voilure). */
export interface CotesMonoVintage {
  nom: string; annee: number; longueur: number; largeur: number; tirant_eau: number; hauteur_mat: number; pied_mat: number;
  bome: number; bout_dehors: number; franc_bord: number; tonture: number; tableau: number; pied_etrave: number;
  rouf: number[]; cockpit: number[]; safrans: number; quille: string; bulbe: boolean; mat_aile: boolean; barres: number;
  ecarteurs: number; mat_carbone: boolean; voilure: Record<'gv' | Forme, number>; sources: string; estimees: string[];
}
export const MONOS_VINTAGE = (modelesVintage as unknown as { monocoques: Record<string, CotesMonoVintage> }).monocoques;

/** Cotes des multicoques de légende (générateur jeu/outils/blender/vintage_multi.py, 3D et plan de voilure). */
export interface CotesMultiVintage {
  nom: string; annee: number; type: 'trimaran' | 'catamaran'; longueur: number; longueur_flotteurs: number; largeur: number;
  hauteur_mat: number; pied_mat: number; bras: number[]; bras_profil: 'aile' | 'tube'; bras_arche: number; mat_aile: boolean;
  barres: number; derive_centrale: boolean; derives_flotteurs: boolean; bout_dehors: number;
  voilure: Record<'gv' | Forme, number>; sources: string; estimees: string[];
}
export const MULTIS_VINTAGE = (modelesVintage as unknown as { multicoques: Record<string, CotesMultiVintage> }).multicoques;

/** Formes 3D des voiles d'avant ; « sgt » : spi de gros temps, petit spi plat des monocoques (11/11/2026). */
export type Forme = 'tourmentin' | 'j3' | 'j2' | 'fro' | 'a3' | 'a2' | 'sgt';

export interface PlanVoilure {
  /** Facteur d'aire entre la vraie grandeur et le repère 3D du modèle (le repère est agrandi ou réduit). */
  echelleAire: number;
  gv: number;
  voiles: Record<Forme, number>;
  /** Goélette : misaine (mât avant), au près et au portant. */
  misaine?: { pres: number; portant: number };
}

const K_C40 = (18.28 / 12.19) ** 2; // le Class40 est dessiné dans le repère de l'IMOCA
const K_OC50 = (32 / 15.24) ** 2;   // l'Ocean Fifty est dessiné dans le repère de l'Ultim

export const PLANS: Record<string, PlanVoilure> = {
  imoca: { echelleAire: 1, gv: 170, voiles: { tourmentin: 20, j3: 50, j2: 105, fro: 200, a3: 280, a2: 400, sgt: 220 } },
  imoca_derives: { echelleAire: 1, gv: 170, voiles: { tourmentin: 20, j3: 50, j2: 130, fro: 190, a3: 270, a2: 380, sgt: 210 } },
  // Class40 : code 0 de 118 m² (inventaire d'un Pogo 40 S4, North Sails / Quantum) ; grand-voile + solent ≤ 115 m² (jauge) ; gennaker et spi ESTIMÉS (aucun chiffre sourcé trouvé), plus grands que le code 0.
  class40: { echelleAire: K_C40, gv: 70, voiles: { tourmentin: 12, j3: 25, j2: 45, fro: 118, a3: 150, a2: 190, sgt: 105 } },
  ultim: { echelleAire: 1, gv: 310, voiles: { tourmentin: 30, j3: 60, j2: 180, fro: 250, a3: 450, a2: 450, sgt: 0 } },
  ultim_ancien: { echelleAire: 1, gv: 260, voiles: { tourmentin: 30, j3: 60, j2: 150, fro: 250, a3: 418, a2: 418, sgt: 0 } },
  ocean_fifty: { echelleAire: K_OC50, gv: 100, voiles: { tourmentin: 15, j3: 35, j2: 70, fro: 100, a3: 150, a2: 165, sgt: 0 } },
  pen_duick_3: { echelleAire: 1, gv: 50, misaine: { pres: 36, portant: 93.6 }, voiles: { tourmentin: 10, j3: 32, j2: 66, fro: 85, a3: 110, a2: 140, sgt: 0 } },
};

export function planDe(modele: string | undefined): PlanVoilure {
  const v = modele ? MONOS_VINTAGE[modele] : undefined;
  if (v) {
    const { gv, ...voiles } = v.voilure;
    // spi de gros temps : estimé à 55 % du grand spi (aucun chiffre publié pour ces bateaux)
    return { echelleAire: 1, gv, voiles: { ...voiles, sgt: Math.round(0.55 * v.voilure.a2) } as Record<Forme, number> };
  }
  const mv = modele ? MULTIS_VINTAGE[modele] : undefined;
  if (mv) {
    // dessiné dans le repère de l'Ultim de 32 m, puis réduit à sa longueur
    const { gv, ...voiles } = mv.voilure;
    return { echelleAire: (32 / mv.longueur) ** 2, gv, voiles: { ...voiles, sgt: 0 } as Record<Forme, number> };
  }
  return PLANS[modele ?? 'imoca'] ?? PLANS.imoca;
}

/** Noms des voiles d'avant : ceux des bateaux modernes, ou ceux de l'époque pour les bateaux de légende. */
const NOMS_MODERNES: Record<Forme, string> = { tourmentin: 'Tourmentin', j3: 'J3', j2: 'Solent (J2)', fro: 'Code 0', a3: 'Gennaker', a2: 'Spi', sgt: 'Spi gros temps' };
const NOMS_ANCIENS: Record<Forme, string> = { tourmentin: 'Tourmentin', j3: 'Foc', j2: 'Génois', fro: 'Génois léger', a3: 'Spi de brise', a2: 'Spi', sgt: 'Spi gros temps' };
export function nomsVoiles(modele: string | undefined): Record<Forme, string> {
  return modele === 'pen_duick_3' || (modele && (MONOS_VINTAGE[modele] || MULTIS_VINTAGE[modele])) ? NOMS_ANCIENS : NOMS_MODERNES;
}

/**
 * Grand-voile : guindant P et bordure E (longueur de bôme) donnés par le modèle ; on calcule la tête carrée et le rond
 * de chute pour retrouver la surface. Avec des ris, le guindant raccourcit (environ 14 % par ris) et la tête s'affine.
 */
export function grandVoile(aire: number, P: number, E: number, ris = 0, annee?: number) {
  const k0 = Math.max(0, 1 - 0.14 * ris);
  if (annee !== undefined) {
    // Bateaux de légende (11/11/2026, photos du porteur de projet : Écureuil d'Aquitaine II, Aquitaine Innovations, Groupama,
    // Foncia) : tête pointue jusqu'en 1997, petite tête carrée ensuite (Groupama 1998, PRB 1999) ; la surface vient du rond
    // de chute, modéré avant 1985, marqué ensuite (grand-voiles entièrement lattées).
    const tete = annee >= 1998 ? 0.22 * E : Math.min(0.5, 0.04 * E);
    const r = Math.max(0.05 * E, Math.min((annee < 1985 ? 0.1 : 0.22) * E, (aire - (P * (E + tete)) / 2) / ((2 / 3) * P)));
    return { P: P * k0, E, tete, rond: r * (1 - 0.15 * ris) };
  }
  const rond = 0.12 * E;                                   // rond de chute (flèche maximale de la chute)
  let tete = (2 * (aire - (2 / 3) * P * rond)) / P - E;    // aire ≈ P (E + tête) / 2 + 2/3 P rond
  tete = Math.max(0.25, Math.min(0.6 * E, tete));   // tête carrée : au plus 60 % de la bordure
  const k = Math.max(0, 1 - 0.14 * ris);
  return { P: P * k, E, tete: tete * Math.max(0.3, 1 - 0.3 * ris), rond: rond * (1 - 0.15 * ris) };
}

/** Couleur des voiles d'avant d'époque : tergal blanc, puis génois en Kevlar doré (1985-1994), puis Mylar crème. */
export function toileEpoque(annee: number | undefined): number {
  if (annee === undefined || annee < 1985) return 0xf0ede4;
  return annee < 1995 ? 0xd9c49a : 0xe9e5d8;
}

/** Année de construction d'un bateau de légende (sinon undefined : bateau moderne). */
export function anneeVintage(modele: string | undefined): number | undefined {
  if (!modele) return undefined;
  if (modele === 'pen_duick_3') return 1967;
  return MONOS_VINTAGE[modele]?.annee ?? MULTIS_VINTAGE[modele]?.annee;
}

export interface ContexteAvant {
  deckY: number; mastH: number; mastZ: number; bowZ: number; sprZ: number; bowY: number; longueur: number; lee: number;
  /** Ouverture de la bôme (degrés). Fournie, le point d'écoute reste devant la grand-voile quand le bateau abat. */
  bome?: number;
  /** Bateau de légende : génois recouvrants d'époque au lieu du solent et du code 0 modernes. */
  ancien?: boolean;
}

/**
 * Voile d'avant (reprise du 11/11/2026, images de référence du porteur de projet : présentation des voiles d'un IMOCA et
 * photo d'un spi en course). La forme ne se déduit plus de la surface (un triangle étiré donnait un code 0 plus grand que
 * le spi) : chaque voile a ses proportions, rapportées à la longueur du bateau et à la hauteur du mât, dans l'ordre réel
 * tourmentin < J3 < solent < code 0 < gennaker < spi.
 * - pied : longueur de bordure (de l'amure vers l'arrière), en fraction de la longueur du bateau ;
 * - ecart : écoute choquée sous le vent, en fraction de la longueur ;
 * - rondG / rondC : guindant bombé vers l'avant, chute bombée vers l'arrière (voiles de portant), en fraction de la longueur ;
 * - creux : profondeur de la voile, en fraction de la corde.
 * Les Class40, Ocean Fifty et Ultim suivent la même logique (même ordre de taille des voiles).
 */
export function voileAvant(forme: Forme, aire: number, c: ContexteAvant) {
  void aire;
  const DEFS: Record<Forme, { amure: 'interieur' | 'etrave' | 'boutDehors'; tete: number; pied: number; ecart: number; hautPoint: number; rondG: number; rondC: number; creux: number; spi: boolean }> = {
    tourmentin: { amure: 'interieur', tete: 0.42, pied: 0.2, ecart: 0.03, hautPoint: 1.2, rondG: 0, rondC: 0, creux: 0.06, spi: false },
    j3: { amure: 'interieur', tete: 0.62, pied: 0.32, ecart: 0.04, hautPoint: 0.8, rondG: 0, rondC: 0, creux: 0.07, spi: false },
    j2: { amure: 'etrave', tete: 0.84, pied: 0.47, ecart: 0.05, hautPoint: 0.6, rondG: 0, rondC: 0, creux: 0.08, spi: false },
    fro: { amure: 'boutDehors', tete: 0.94, pied: 0.72, ecart: 0.1, hautPoint: 1.2, rondG: 0.05, rondC: 0.03, creux: 0.09, spi: false },
    a3: { amure: 'boutDehors', tete: 0.96, pied: 0.8, ecart: 0.2, hautPoint: 1.0, rondG: 0.15, rondC: 0.09, creux: 0.14, spi: true },
    a2: { amure: 'boutDehors', tete: 0.985, pied: 0.86, ecart: 0.3, hautPoint: 0.9, rondG: 0.27, rondC: 0.16, creux: 0.18, spi: true },
    // spi de gros temps : hissé plus bas (fractionné), bordure courte, peu de rond et peu de creux (voile plate et solide)
    sgt: { amure: 'boutDehors', tete: 0.8, pied: 0.62, ecart: 0.22, hautPoint: 1.3, rondG: 0.12, rondC: 0.07, creux: 0.13, spi: true },
  };
  // Bateaux de légende (11/11/2026, photos du porteur de projet) : génois amuré à l'étrave, têtière presque en tête de mât,
  // point d'écoute bas, à peu près à l'aplomb du mât (« recouvre » : distance derrière le mât, en fraction de la longueur) ;
  // génois léger un peu plus grand. Pas de code 0 à point d'écoute haut à l'époque.
  const ANCIENS: Partial<Record<Forme, (typeof DEFS)[Forme] & { recouvre: number }>> = {
    j2: { amure: 'etrave', tete: 0.93, pied: 0, recouvre: 0.02, ecart: 0.06, hautPoint: 0.6, rondG: 0, rondC: 0, creux: 0.09, spi: false },
    fro: { amure: 'etrave', tete: 0.96, pied: 0, recouvre: 0.08, ecart: 0.1, hautPoint: 0.4, rondG: 0, rondC: 0.01, creux: 0.11, spi: false },
  };
  const ancien = c.ancien ? ANCIENS[forme] : undefined;
  const def = ancien || DEFS[forme];
  const zAmure = def.amure === 'interieur' ? c.bowZ + 0.13 * c.longueur : def.amure === 'etrave' ? c.bowZ + 0.03 * c.longueur : c.sprZ;
  const tack = new T.Vector3(0, c.bowY + (def.amure === 'interieur' ? 0.15 : 0.05), zAmure);
  const head = new T.Vector3(0, c.deckY + c.mastH * def.tete, c.mastZ - 0.35);
  const clew = new T.Vector3(c.lee * def.ecart * c.longueur, c.deckY + def.hautPoint, ancien ? c.mastZ + ancien.recouvre * c.longueur : zAmure + def.pied * c.longueur);
  // Les voiles suivent la grand-voile (11/11/2026, remarque du porteur de projet) : quand le bateau abat, la bôme s'ouvre ;
  // le point d'écoute de la voile d'avant tourne autour du mât pour rester devant la grand-voile, avec une marge (creux de
  // la grand-voile, rond de chute de la voile d'avant), au lieu de venir la toucher au largue et au vent arrière.
  if (c.bome !== undefined) {
    const dz = clew.z - c.mastZ, dx = Math.abs(clew.x);
    const r = Math.hypot(dx, dz), phi = Math.atan2(dx, dz);
    const marge = def.spi ? 30 : 19; // écart d'au moins 10° entre la chute et la grand-voile
    const mini = T.MathUtils.degToRad(Math.min(c.bome + marge, 100));
    if (phi < mini) {
      clew.x = c.lee * r * Math.sin(mini);
      clew.z = c.mastZ + r * Math.cos(mini);
    }
  }
  return { tack, head, clew, creux: def.creux, spi: def.spi, rondG: def.rondG * c.longueur, rond: def.rondC * c.longueur };
}
