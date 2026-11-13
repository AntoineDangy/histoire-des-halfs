// Vue rapprochée 3D (cahier des charges §10b.3 bis), adaptée du « Prototype 3D – Course au large »
// (conception/prototype-3d-imoca.html). Modèle procédural d'IMOCA, sans logo ni marquage de sponsor :
// point de départ, pas modèle définitif (à relire par un connaisseur, §10b.4 bis).
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { anneeVintage, grandVoile, toileEpoque, MONOS_VINTAGE, MULTIS_VINTAGE, planDe, voileAvant } from './voilure';
import type { Forme } from './voilure';
export type { Forme } from './voilure';

// ---------------------------------------------------------------- Modèles glTF (Blender)
// Coques modélisées dans Blender par script (jeu/outils/blender/*.py) et exportées en glTF. Le gréement et les
// voiles restent générés par le code. Tant qu'un modèle n'est pas chargé, le modèle procédural le remplace.
// Les six types modernes sont chargés d'office ; les bateaux de légende (classe Vintage, un modèle par bateau) seulement
// quand on en a besoin (hangar ou flotte de la course), pour ne pas tout télécharger à l'ouverture.
type NomModele = string;
const modelesGltf: Partial<Record<NomModele, T.Group>> = {};
const chargements = new Map<NomModele, Promise<void>>();
const MODELES_DE_BASE = ['class40', 'ultim', 'ultim_ancien', 'imoca', 'imoca_derives', 'ocean_fifty'];
function chargerUn(nom: NomModele): Promise<void> {
  let p = chargements.get(nom);
  if (!p) {
    p = new Promise<void>((fin) => {
      const url = new URL(`modeles/${nom}.glb`, document.baseURI).href;
      new GLTFLoader().load(url, (g) => { modelesGltf[nom] = g.scene; fin(); }, undefined, () => fin());
    });
    chargements.set(nom, p);
  }
  return p;
}
export function chargerModeles(autres: string[] = []): Promise<void> {
  return Promise.all([...MODELES_DE_BASE, ...autres].map(chargerUn)).then(() => undefined);
}

/** Copie d'un modèle glTF repeinte aux couleurs du skipper (matériaux nommés dans Blender). */
function coqueGltf(nom: NomModele, coque: string, bandes: string): T.Group | null {
  const m = modelesGltf[nom];
  if (!m) return null;
  const c = m.clone(true);
  c.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as T.MeshStandardMaterial).clone();
    if (mat.name === 'coque' || mat.name === 'rouf' || mat.name === 'bras') mat.color.set(coque);
    if (mat.name === 'bande') mat.color.set(bandes);
    mat.side = T.DoubleSide;
    mesh.material = mat;
  });
  return c;
}

const L = 18.28; // longueur de coque (60 pieds)
const B = 5.6;
const MAST_H = 27; // tirant d'air 29 m au plus (jauge IMOCA) : 27 m au-dessus du pont
const MAST_Z = -1.0;

export type AllureKey = 'pres' | 'travers' | 'largue' | 'arriere';

const ALLURES: Record<AllureKey, { heel: number; boom: number; speed: number }> = {
  pres: { heel: 20, boom: 6, speed: 9 },
  travers: { heel: 16, boom: 22, speed: 15 },
  largue: { heel: 11, boom: 40, speed: 17 },
  arriere: { heel: 6, boom: 55, speed: 13 },
};

export interface BateauScene {
  nom: string;
  moi: boolean;
  coque: string;
  bandes: string;
  spi: string;
  numero: string;
  allure: AllureKey;
  forme: Forme;
  /** +1 : vent venant de tribord, -1 : de bâbord. */
  cote: number;
  /** Position relative au bateau du joueur, en mètres (x : travers, z : avant négatif). */
  off: [number, number];
  /** Sans voile hissée (à sec de toile ou voile perdue). */
  sansVoileAvant?: boolean;
  /** La voile d'avant lâche pendant la scène et tombe à l'eau. */
  perteVoile?: boolean;
  /**
   * Voile inutilisable (le vent a tourné) : elle faseye, l'équipage l'affale sur le pont, la range, puis
   * hisse à la place cette voile d'avant plus petite. Animation distincte de la perte de voile (rien ne casse, rien à l'eau).
   */
  affalage?: Forme;
  /** Vitesse du bateau en nœuds (sillage et vague d'étrave). */
  vitesse?: number;
  /** Modèle 3D selon le type de bateau (famille d'architecture). IMOCA à foils par défaut. */
  modele?: Modele3D;
  /** Ris pris dans la grand-voile (0 à 3 ; 4 : grand-voile affalée). */
  ris?: number;
  /** Avarie montrée (échelle de Beaufort) : démâté, en train de couler (monocoque) ou chaviré (multicoque). */
  etat?: 'demate' | 'coule' | 'chavire';
  /** Classe du bateau : la grand-voile des Ocean Fifty porte le logo de la classe en tête. */
  classe?: string;
}

/**
 * Modèles 3D : IMOCA (foils ou dérives droites), Class40, trimarans Ultim (volant ou ancienne génération) et Ocean Fifty ;
 * classe Vintage : un modèle par bateau de légende (pen_duick_3…), nommé comme son fichier dans public/modeles/.
 */
export type Modele3D = string;

/** Modèle 3D d'une famille d'architecture du jeu (en attendant le modèle propre de chaque bateau Vintage). */
export function modeleDeFamille(famille: string): Modele3D {
  switch (famille) {
    case 'imoca_derives': return 'imoca_derives';
    case 'class40': return 'class40';
    case 'ultim': return 'ultim';
    case 'ultim_ancien': return 'ultim_ancien';
    case 'ocean_fifty': return 'ocean_fifty';
    case 'vintage_monocoque': return 'imoca_derives';
    case 'vintage_multicoque': return 'ocean_fifty';
    default: return 'imoca';
  }
}

/** Modèle 3D d'un bateau : le sien s'il a été modélisé (champ modele_3d de bateaux.json), sinon celui de sa famille. */
export function modeleDuBateau(famille: string, modele3d?: string | null): Modele3D {
  return modele3d || modeleDeFamille(famille);
}

/** Modèles qui ne font pas partie des six types de base : à charger avant d'afficher ces bateaux. */
export function modelesAcharger(modeles: Modele3D[]): string[] {
  return [...new Set(modeles.filter((m) => !MODELES_DE_BASE.includes(m)))];
}

/**
 * État de la mer selon l'échelle de Beaufort (forces 0 à 12) : hauteur significative des vagues (m),
 * longueur d'onde (m), part d'écume (moutons à partir de force 4), ciel et visibilité.
 * Hauteurs d'après les ordres de grandeur de l'échelle de Beaufort (Organisation météorologique mondiale).
 */
const HAUTEURS = [0, 0.1, 0.2, 0.6, 1, 2, 3, 4, 5.5, 7, 9, 11.5, 14];
export function etatMer(force: number) {
  const f = Math.max(0, Math.min(12, Math.round(force)));
  const haut = HAUTEURS[f];
  return {
    force: f,
    haut,
    long: 18 + f * 10,
    ecume: Math.max(0, Math.min(1, (f - 3) / 6)),
    ciel: f <= 5 ? ['#5f97c9', '#a9cbe6', '#dbe9f3'] : f <= 8 ? ['#5d7489', '#8fa2b3', '#b8c4ce'] : ['#2f3b46', '#4d5b67', '#6e7a84'],
    brume: f <= 5 ? 900 : f <= 8 ? 620 : 380,
    mer: f <= 4 ? '#0b4a72' : f <= 7 ? '#0d3f5f' : '#203a48',
    gite: 0.6 + Math.min(f, 9) / 10,
  };
}

function hullStation(t: number) {
  const half = B / 2;
  let hb: number;
  if (t < 0.45) hb = half * (0.84 + 0.16 * Math.sin(((t / 0.45) * Math.PI) / 2));
  else {
    const u = (t - 0.45) / 0.55;
    hb = half * Math.max(0, Math.pow(Math.max(0, 1 - Math.pow(u, 2.6)), 0.5)) * (1 - 0.35 * u);
  }
  const top = 1.45 + 0.75 * Math.pow(t, 1.8);
  const dep = t < 0.55 ? 0.5 + 0.05 * Math.sin((t / 0.55) * Math.PI) : 0.5 - 1.15 * Math.pow((t - 0.55) / 0.45, 1.6);
  return { hb, top, dep: Math.max(dep, -0.6) };
}

function buildHull(coque: string, bandes: string) {
  const S = 64, K = 28, n = 3.8;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const cHull = new T.Color(coque), cStripe = new T.Color(bandes), cBottom = new T.Color('#2b3138');
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const st = hullStation(t);
    const z = L / 2 - t * L;
    for (let k = 0; k <= K; k++) {
      const th = (Math.PI * k) / K;
      const c = Math.cos(th), s = Math.sin(th);
      const x = st.hb * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = st.top - (st.top + st.dep) * Math.pow(Math.abs(s), 2 / n);
      pos.push(x, y, z);
      const cc = y > st.top - 0.32 ? cStripe : y < 0.08 ? cBottom : cHull;
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < S; i++)
    for (let k = 0; k < K; k++) {
      const a = i * (K + 1) + k, b = a + K + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const hull = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05, side: T.DoubleSide }));

  const dp: number[] = [], di: number[] = [];
  const J = 12;
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const st = hullStation(t);
    const z = L / 2 - t * L;
    for (let j = 0; j <= J; j++) {
      const u = -1 + (2 * j) / J;
      dp.push(u * st.hb, st.top + 0.12 * (1 - u * u) - 0.005, z);
    }
  }
  for (let i = 0; i < S; i++)
    for (let j = 0; j < J; j++) {
      const a = i * (J + 1) + j, b = a + J + 1;
      di.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const dg = new T.BufferGeometry();
  dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3));
  dg.setIndex(di);
  dg.computeVertexNormals();
  const deck = new T.Mesh(dg, new T.MeshStandardMaterial({ color: 0xd9dee3, roughness: 0.8, side: T.DoubleSide }));

  const st0 = hullStation(0);
  const tr: number[] = [0, st0.top * 0.4, L / 2], ti: number[] = [];
  for (let k = 0; k <= K; k++) tr.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  for (let k = 1; k <= K; k++) ti.push(0, k, k + 1);
  const tg = new T.BufferGeometry();
  tg.setAttribute('position', new T.Float32BufferAttribute(tr, 3));
  tg.setIndex(ti);
  tg.computeVertexNormals();
  const transom = new T.Mesh(tg, new T.MeshStandardMaterial({ color: coque, roughness: 0.4, side: T.DoubleSide }));
  const grp = new T.Group();
  grp.add(hull, deck, transom);
  return grp;
}

function sailGeometry(tack: T.Vector3, head: T.Vector3 | { luff: T.Vector3; leech: T.Vector3 }, clew: T.Vector3, camber: number, leeSign: number, segU = 14, segV = 18, rond = 0, rondGuindant = 0) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const luffTop = 'luff' in head ? head.luff : head;
  const leechTop = 'leech' in head ? head.leech : head;
  for (let v = 0; v <= segV; v++) {
    const fv = v / segV;
    const lu = new T.Vector3().lerpVectors(tack, luffTop, fv);
    const le = new T.Vector3().lerpVectors(clew, leechTop, fv);
    // rond de chute : la chute bombe vers l'arrière (grand-voile moderne)
    if (rond) le.addScaledVector(new T.Vector3().subVectors(le, lu).normalize(), rond * Math.sin(Math.PI * fv));
    // guindant bombé vers l'avant (spi, gennaker), largeur maximale vers 40 % de la hauteur
    if (rondGuindant) lu.addScaledVector(new T.Vector3().subVectors(lu, le).normalize(), rondGuindant * Math.sin(Math.PI * Math.pow(fv, 0.85)));
    const chord = new T.Vector3().subVectors(le, lu);
    const nrm = new T.Vector3(chord.z, 0, -chord.x).normalize().multiplyScalar(leeSign);
    for (let u = 0; u <= segU; u++) {
      const fu = u / segU;
      const p = new T.Vector3().lerpVectors(lu, le, fu);
      const depth = camber * chord.length() * Math.sin(Math.PI * Math.pow(fu, 0.8)) * (1 - 0.35 * fv);
      p.addScaledVector(nrm, depth);
      pos.push(p.x, p.y, p.z);
      uv.push(fu, fv);
    }
  }
  for (let v = 0; v < segV; v++)
    for (let u = 0; u < segU; u++) {
      const a = v * (segU + 1) + u, b = a + segU + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Logo de la classe Ocean Fifty en tête de grand-voile (demande du porteur de projet, 10/11/2026), redessiné d'après le
 * logo fourni : « OCEAN » en bleu marine, le A remplacé par une voile vert anis soulignée, « FIFTY » en lettres fines,
 * sur un panneau blanc pour rester lisible sur la toile sombre.
 */
function logoOceanFifty(g: CanvasRenderingContext2D, y: number) {
  const marine = '#16213e', anis = '#cfe83a';
  const k = 0.6, W = 400, H = 190; // dessiné sur 400 × 190, réduit à 60 % et centré sur la voile
  g.save();
  g.translate(256 - (W * k) / 2, y);
  g.scale(k, k);
  g.fillStyle = '#f4f6f8';
  g.beginPath();
  g.roundRect(0, 0, W, H, 18);
  g.fill();
  g.fillStyle = marine;
  g.font = 'bold 86px Arial, sans-serif';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText('OCE', 30, 100);
  const xA = 30 + g.measureText('OCE').width + 4;
  g.fillText('N', xA + 66, 100);
  // la voile qui remplace le A, et le trait vert qui la prolonge sous « OCE »
  g.fillStyle = anis;
  g.beginPath();
  g.moveTo(xA + 8, 104);
  g.lineTo(xA + 30, 22);
  g.lineTo(xA + 42, 22);
  g.lineTo(xA + 62, 104);
  g.closePath();
  g.fill();
  g.fillRect(30, 106, xA + 32, 8);
  g.fillStyle = marine;
  g.fillRect(xA + 34, 30, 3, 70);
  g.font = '300 56px Arial, sans-serif';
  g.textAlign = 'center';
  'FIFTY'.split('').forEach((l, i) => g.fillText(l, W / 2 - 120 + i * 60, 172));
  g.restore();
}

/**
 * Texture de grand-voile : toile sombre (voiles modernes en carbone) ou claire (tergal des bateaux de légende).
 * Les matériaux l'utilisent retournée sur la face avant de la voile (côté tribord, où la toile se lit de l'arrière vers
 * l'avant) et droite sur la face arrière (bâbord) : numéro et logo se lisent à l'endroit des deux côtés (corrigé le
 * 10/11/2026 : ils étaient en miroir).
 */
function mainTexture(number: string, stripe: string, claire = false, logo?: 'ocean_fifty') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = claire ? '#eeebe2' : '#25292f';
  g.fillRect(0, 0, 512, 1024);
  g.strokeStyle = claire ? 'rgba(60,60,60,0.10)' : 'rgba(255,255,255,0.10)';
  g.lineWidth = 4;
  for (let i = 1; i < 9; i++) {
    g.beginPath();
    g.moveTo(0, i * 110);
    g.lineTo(512, i * 110 - 20);
    g.stroke();
  }
  g.fillStyle = stripe;
  g.fillRect(0, 0, 512, 60);
  if (logo === 'ocean_fifty') logoOceanFifty(g, 84);
  g.fillStyle = claire ? '#1d2228' : '#ffffff';
  g.font = 'bold 120px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(number, 256, 560);
  const tx = new T.CanvasTexture(c);
  tx.colorSpace = T.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

interface Ud {
  /** Quête du mât (radians) : la têtière des voiles d'avant suit le mât incliné. */
  quete?: number;
  /** Mât (pour le démâtage) et enfoncement (naufrage). */
  mat?: T.Object3D;
  etais?: T.Object3D;
  coule?: boolean;
  body: T.Group;
  keel: T.Group;
  foilPort: T.Group;
  foilStar: T.Group;
  boomPivot: T.Group;
  mainMat: T.Material;
  mainMatB: T.Material;
  headMat: T.Material;
  spiMat: T.Material;
  deckY: number;
  bowTop: number;
  phase: number;
  heel: number;
  lift: number;
  trim: number;
  speed: number;
  def: BateauScene;
  label?: HTMLDivElement;
  voileAvant?: { tack: T.Vector3; head: T.Vector3; clew: T.Vector3; camber: number; lee: number; mesh: T.Mesh; couleur: T.Color };
  chute?: { t0: number; heel0: number; speed0: number; gerbe: number };
  affale?: {
    t0: number; heel0: number; speed0: number;
    nouvelle: { tack: T.Vector3; head: T.Vector3; clew: T.Vector3; camber: number; lee: number; mesh: T.Mesh } | null;
  };
  /** Goélette : bôme de misaine (mât avant), qui pivote avec la misaine. */
  boomPivot2?: T.Group;
  /** Multicoque chaviré (échelle de Beaufort, F11 et F12) : il flotte à l'envers. */
  chavire?: boolean;
}

function buildBoat(def: BateauScene) {
  if (def.modele === 'ultim' || def.modele === 'ultim_ancien' || def.modele === 'ocean_fifty' || (def.modele && MULTIS_VINTAGE[def.modele])) return buildTrimaran(def);
  if (def.modele === 'pen_duick_3') return buildGoelette(def);
  if (def.modele && MONOS_VINTAGE[def.modele]) return buildMonoVintage(def);
  const boat = new T.Group();
  const body = new T.Group();
  boat.add(body);
  const carbon = new T.MeshStandardMaterial({ color: 0x15181c, roughness: 0.45, metalness: 0.2 });
  const dark = new T.MeshStandardMaterial({ color: 0x23272d, roughness: 0.6 });
  // Class40 : coque modélisée dans Blender (à l'échelle de la coque IMOCA du code, le bateau est réduit ensuite).
  // IMOCA : modèles Blender complets (coque, rouf, quille, foils ou dérives, safrans, mât, bôme) : à foils sur le design
  // de MACIF Santé Prévoyance, à dérives sur celui de Macif 2011 (François Gabart).
  const gltf = def.modele === 'class40' || def.modele === 'imoca' || def.modele === 'imoca_derives' ? coqueGltf(def.modele, def.coque, def.bandes) : null;
  const imocaBlender = (def.modele === 'imoca' || def.modele === 'imoca_derives') && !!gltf;
  // Class40 Blender (design de Crédit Mutuel, 10/11/2026) : quille FIXE, pas de dérives (jauge), mât non tournant sans
  // outriggers, long bout-dehors ; ses pièces sont en vraie grandeur : on les agrandit comme la coque.
  const c40 = def.modele === 'class40' && !!gltf;
  const kc40 = L / 12.19;
  /** Pièce du modèle Blender, détachée pour être accrochée à un élément animé. */
  const piece = (nom: string): T.Object3D | null => {
    const o = gltf?.getObjectByName(nom);
    if (!o) return null;
    o.parent?.remove(o);
    return o;
  };
  if (gltf) {
    if (def.modele === 'class40') gltf.scale.setScalar(L / 12.19);
    body.add(gltf);
  } else body.add(buildHull(def.coque, def.bandes));

  const roofGeo = new T.CylinderGeometry(1, 1, 8.2, 24, 1, false, -Math.PI / 2, Math.PI);
  roofGeo.rotateX(Math.PI / 2);
  roofGeo.scale(1.75, 0.55, 1);
  const roof = new T.Mesh(roofGeo, new T.MeshStandardMaterial({ color: def.coque, roughness: 0.4 }));
  roof.position.set(0, hullStation(0.35).top + 0.12, 3.6);
  if (!gltf) body.add(roof);

  const railMat = new T.LineBasicMaterial({ color: 0xc9d2da });
  const rail: T.Vector3[] = [];
  for (const sx of [-1, 1]) {
    let prev: T.Vector3 | null = null;
    for (let i = 0; i <= 12; i++) {
      const t = 0.08 + (0.8 * i) / 12;
      const st = hullStation(t);
      const p = new T.Vector3(sx * st.hb * 0.93, st.top + 0.65, L / 2 - t * L);
      rail.push(new T.Vector3(p.x, st.top, p.z), p);
      if (prev) rail.push(prev, p);
      prev = p;
    }
  }
  // Pas de filières sur les IMOCA (demande du porteur de projet, 10/11/2026 : trop visibles).
  if (!(def.modele ?? 'imoca').startsWith('imoca')) body.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(rail), railMat));

  const deckY = hullStation(0.55).top + 0.1;
  const mastGeo = new T.CylinderGeometry(0.11, 0.17, MAST_H, 12);
  mastGeo.scale(1, 1, 2.6);
  const mast = new T.Mesh(mastGeo, carbon);
  mast.position.set(0, deckY + MAST_H / 2, MAST_Z);
  // Quête du mât (jauge IMOCA : 2 à 6°) : 4° vers l'arrière sur les modèles Blender. Le mât-aile, la bôme et la
  // grand-voile tournent ensemble autour de cet axe incliné (correction du 10/11/2026 : les voiles ne collaient pas au mât).
  const quete = imocaBlender ? T.MathUtils.degToRad(4) : 0;
  /** Point du mât à la hauteur h au-dessus du pied (axe incliné). */
  const surMat = (h: number) => new T.Vector3(0, deckY + h * Math.cos(quete), MAST_Z + h * Math.sin(quete));
  const mastGltf = piece('pivot_mat');
  if (!mastGltf) body.add(mast);
  const matMono: T.Object3D = mastGltf ?? mast;

  const bowTop = c40 ? 1.7 * kc40 : hullStation(1).top; // Class40 : amure au bout du bout-dehors
  const sprit = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 2.6, 8), carbon);
  sprit.rotation.x = Math.PI / 2;
  sprit.position.set(0, bowTop - 0.1, -L / 2 - 1.1);
  if (!imocaBlender && !c40) body.add(sprit);

  const rig: T.Vector3[] = [];
  const mastTop = surMat(MAST_H - 0.4);
  const shroudBase = hullStation(0.5);
  // Outriggers des IMOCA (photos de MACIF et de Charal envoyées par le porteur de projet, 10/11/2026) : un long tube noir unique de chaque
  // côté, qui part du pont au droit du mât, s'écarte d'environ 2,7 m au-delà du bordé en remontant légèrement ; les
  // haubans sont frappés à son extrémité. Les bras en V restent sur le modèle du code (Class40 en attendant).
  const fin = imocaBlender;
  const OZ = MAST_Z + (fin ? 0.8 : 1.4), OUT = shroudBase.hb + (fin ? 2.7 : c40 ? -0.05 : 1.3);
  for (const sx of [-1, 1]) {
    const a = fin ? new T.Vector3(sx * 0.9, shroudBase.top + 0.25, OZ) : new T.Vector3(sx * 0.6, shroudBase.top + 0.15, OZ - 0.6);
    const bb = new T.Vector3(sx * OUT, shroudBase.top + (fin ? 0.75 : c40 ? 0.05 : 0.45), OZ + (fin ? 0.4 : 0));
    const a2 = fin ? new T.Vector3(sx * (shroudBase.hb + 0.02), shroudBase.top - 0.55, OZ) : new T.Vector3(sx * 0.6, shroudBase.top + 0.15, OZ + 0.8);
    for (const st of fin ? [a] : c40 ? [] : [a, a2]) {
      const len = st.distanceTo(bb);
      const r = fin ? 0.065 : 0.09;
      const tube = new T.Mesh(new T.CylinderGeometry(r * 0.8, r, len, 8), carbon);
      tube.position.copy(st).add(bb).multiplyScalar(0.5);
      tube.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), bb.clone().sub(st).normalize());
      body.add(tube);
    }
    rig.push(mastTop, bb, surMat(MAST_H * 0.62), bb);
    // câble qui retient l'outrigger vers le bas, de son extrémité au flanc de la coque (photo de Charal)
    if (fin) rig.push(bb, new T.Vector3(sx * (shroudBase.hb + 0.02), shroudBase.top - 0.35, OZ + 1.6));
    rig.push(mastTop, new T.Vector3(sx * hullStation(0.08).hb * 0.9, hullStation(0.08).top, L / 2 - 1.5));
  }
  rig.push(surMat(MAST_H * 0.85), new T.Vector3(0, bowTop, -L / 2 + 0.3));
  const etais = new T.LineSegments(new T.BufferGeometry().setFromPoints(rig), new T.LineBasicMaterial({ color: 0x1a1d22 }));
  body.add(etais);

  const keel = new T.Group();
  keel.position.set(0, -0.45, -0.3);
  body.add(keel);
  const KEEL = 4.2;
  const quilleGltf = piece('pivot_quille');
  if (quilleGltf) {
    quilleGltf.position.set(0, 0, 0); // aileron et bulbe du modèle Blender : basculent avec la quille
    keel.add(quilleGltf);
  } else if (!c40) { // Class40 : quille fixe du modèle Blender, déjà dans la coque
    const fin = new T.Mesh(new T.BoxGeometry(0.14, KEEL, 0.9), carbon);
    fin.position.y = -KEEL / 2;
    keel.add(fin);
    const bulbGeo = new T.SphereGeometry(0.42, 16, 12);
    bulbGeo.scale(1, 0.85, 4.2);
    const bulb = new T.Mesh(bulbGeo, dark);
    bulb.position.set(0, -KEEL - 0.1, 0.4);
    keel.add(bulb);
  }

  const derives = def.modele === 'imoca_derives' || def.modele === 'class40';
  const derive = (side: number) => {
    // Dérive droite, légèrement inclinée, qui sort du bordé (IMOCA « à dérives droites »).
    const st = hullStation(0.56);
    const pivot = new T.Group();
    if (def.modele === 'class40') {
      body.add(pivot); // Class40 : dérives interdites par la jauge
      return pivot;
    }
    const dg = piece(side < 0 ? 'app_foil_babord' : 'app_foil_tribord');
    if (dg) {
      pivot.add(dg); // dérive du modèle Blender : la dérive au vent est relevée
      body.add(pivot);
      return pivot;
    }
    const lame = new T.Mesh(new T.BoxGeometry(0.1, 3.4, 0.55), carbon);
    lame.position.set(side * (st.hb - 0.35), -1.2, MAST_Z + 0.5);
    lame.rotation.z = side * 0.1;
    pivot.add(lame);
    body.add(pivot);
    return pivot;
  };
  const foil = (side: number) => {
    if (derives) return derive(side);
    const fg = piece(side < 0 ? 'app_foil_babord' : 'app_foil_tribord');
    if (fg) {
      const pivot = new T.Group();
      pivot.add(fg); // foil en C du modèle Blender (le foil au vent coulisse dans son puits)
      body.add(pivot);
      return pivot;
    }
    const st = hullStation(0.56);
    const pts = [
      new T.Vector3(side * (st.hb - 0.4), 0.45, MAST_Z + 0.4),
      new T.Vector3(side * (st.hb + 0.5), -0.35, MAST_Z + 0.45),
      new T.Vector3(side * (st.hb + 1.4), -1.25, MAST_Z + 0.5),
      new T.Vector3(side * (st.hb + 2.1), -1.55, MAST_Z + 0.55),
      new T.Vector3(side * (st.hb + 2.9), -1.1, MAST_Z + 0.6),
      new T.Vector3(side * (st.hb + 3.6), -0.35, MAST_Z + 0.65),
    ];
    const shape = new T.Shape();
    shape.absellipse(0, 0, 0.06, 0.32, 0, Math.PI * 2, false, 0);
    const g = new T.ExtrudeGeometry(shape, { steps: 40, bevelEnabled: false, extrudePath: new T.CatmullRomCurve3(pts) });
    const pivot = new T.Group();
    pivot.add(new T.Mesh(g, carbon));
    body.add(pivot);
    return pivot;
  };
  const foilPort = foil(-1);
  const foilStar = foil(1);

  for (const sx of [-1, 1]) {
    if (imocaBlender || c40) break; // safrans du modèle Blender, suspendus au tableau arrière
    const r = new T.Mesh(new T.BoxGeometry(0.08, 2.4, 0.55), carbon);
    r.position.set(sx * 1.9, -0.9, L / 2 - 0.6);
    body.add(r);
  }

  const axeMat = new T.Group(); // pied du mât, incliné de la quête
  axeMat.position.set(0, deckY, MAST_Z);
  axeMat.rotation.x = quete;
  body.add(axeMat);
  const boomPivot = new T.Group();
  axeMat.add(boomPivot);
  if (mastGltf && c40) {
    mastGltf.position.set(0, deckY, MAST_Z); // Class40 : mât non tournant, à l'échelle de la coque
    mastGltf.scale.multiplyScalar(kc40);
    body.add(mastGltf);
  } else if (mastGltf) {
    mastGltf.position.set(0, 0, 0);
    mastGltf.rotation.set(0, 0, 0);
    boomPivot.add(mastGltf); // mât-aile tournant : suit la bôme
  }
  const BOOM = 7.8;
  const boom = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, BOOM, 8), carbon);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 1.25, BOOM / 2);
  const bomeGltf = piece('pivot_bome');
  if (bomeGltf) {
    bomeGltf.position.set(0, 0, 0);
    if (c40) bomeGltf.scale.multiplyScalar(kc40);
    boomPivot.add(bomeGltf);
  } else boomPivot.add(boom);
  const mtx = mainTexture(def.numero, def.bandes);
  const mtxB = mtx.clone();
  mtxB.repeat.x = -1;
  mtxB.offset.x = 1;
  mtxB.needsUpdate = true;
  const ud: Ud = {
    body, keel, foilPort, foilStar, boomPivot,
    mainMat: new T.MeshStandardMaterial({ map: mtxB, roughness: 0.85, side: T.FrontSide }),
    mainMatB: new T.MeshStandardMaterial({ map: mtx, roughness: 0.85, side: T.BackSide }),
    headMat: new T.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.75, side: T.DoubleSide }),
    spiMat: new T.MeshStandardMaterial({ color: def.spi, roughness: 0.7, side: T.DoubleSide }),
    deckY, bowTop, phase: Math.random() * 10, heel: 0, lift: 0, trim: 0, speed: 10, def, quete, mat: matMono, etais,
  };
  boat.userData = ud as unknown as Record<string, unknown>;
  rigFor(boat, def);
  if (def.modele === 'class40') boat.scale.setScalar(12.19 / 18.28); // 40 pieds au lieu de 60 (modèle provisoire)
  return boat;
}

/**
 * Démâtage (échelle de Beaufort, F11) : le mât est cassé au-dessus du pont ; le tronçon tombe sous le vent, dans l'eau,
 * retenu par le gréement. Le pied reste debout.
 */
function demater(ud: Ud, lee: number, mastH: number, mastZ: number) {
  if (ud.mat) ud.mat.visible = false;
  if (ud.etais) ud.etais.visible = false; // haubans et étais tombent avec le mât
  const alu = new T.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5 });
  const pied = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 3.2, 10), alu);
  pied.position.set(0, ud.deckY + 1.6, mastZ);
  pied.rotation.z = lee * 0.08;
  ud.body.add(pied);
  const haut = mastH * 0.82;
  const tronc = new T.Mesh(new T.CylinderGeometry(0.09, 0.13, haut, 10), alu);
  const a = new T.Vector3(0, ud.deckY + 3.1, mastZ), b = new T.Vector3(lee * (haut * 0.93), -1.2, mastZ + 2.5);
  tronc.position.copy(a).add(b).multiplyScalar(0.5);
  tronc.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  tronc.scale.y = a.distanceTo(b) / haut;
  ud.body.add(tronc);
}

function rigFor(boat: T.Group, def: BateauScene) {
  const ud = boat.userData as unknown as Ud;
  const A = ALLURES[def.allure];
  const windSide = def.cote || 1;
  const lee = -windSide;
  const BOOM = 7.8, BOOM_Y = 1.25;
  const plan = planDe(def.modele);
  const demate = def.etat === 'demate' || def.etat === 'coule';
  // Grand-voile à sa vraie surface (plan de voilure), avec ris ; affalée à 4 ris ou après un démâtage.
  if ((def.ris ?? 0) < 4 && !demate) {
    const gv = grandVoile(plan.gv * plan.echelleAire, MAST_H - 2.0, BOOM - 0.4, def.ris ?? 0);
    const y0 = BOOM_Y + 0.15;
    const mg = sailGeometry(
      new T.Vector3(0, y0, 0.2),
      { luff: new T.Vector3(0, y0 + gv.P, 0.2), leech: new T.Vector3(0, y0 + gv.P - 0.3, 0.2 + gv.tete) },
      new T.Vector3(0, y0, 0.2 + gv.E),
      def.allure === 'pres' ? 0.06 : 0.1,
      lee, 14, 18, gv.rond,
    );
    ud.boomPivot.add(new T.Mesh(mg, ud.mainMat), new T.Mesh(mg, ud.mainMatB));
  }
  ud.boomPivot.rotation.y = lee * T.MathUtils.degToRad(A.boom);
  if (demate) demater(ud, lee, MAST_H, MAST_Z);

  if (!def.sansVoileAvant && !demate) {
    const deckY = ud.deckY, bowZ = -L / 2, sprZ = -L / 2 - 2.3, bowY = ud.bowTop;
    const va = voileAvant(def.forme, plan.voiles[def.forme] * plan.echelleAire, { deckY, mastH: MAST_H, mastZ: MAST_Z, bowZ, sprZ, bowY, longueur: L, lee, bome: A.boom });
    const { tack, head, clew } = va;
    const mat: T.Material = va.spi ? ud.spiMat : ud.headMat;
    const camber = va.creux;
    head.z += (head.y - deckY) * Math.tan(ud.quete ?? 0); // têtière contre le mât incliné
    const matVoile = (mat as T.MeshStandardMaterial).clone();
    const mesh = new T.Mesh(sailGeometry(tack, head, clew, camber, lee, 16, 20, va.rond, va.rondG), matVoile);
    ud.voileAvant = { tack, head, clew, camber, lee, mesh, couleur: matVoile.color.clone() };
    ud.body.add(mesh);
  }

  // Quille basculée au vent, foil sous le vent sorti, foil au vent relevé (grille §10b.4 bis).
  if (def.etat === 'coule') ud.coule = true; // F12 : le bateau s'enfonce (boucle d'animation)
  // Quille pendulaire basculée au vent ; pas sur le Class40 (quille fixe, jauge).
  if (def.modele !== 'class40') ud.keel.rotation.z = windSide * T.MathUtils.degToRad(def.allure === 'arriere' ? 20 : 38);
  const up = lee > 0 ? ud.foilPort : ud.foilStar;
  if (def.modele === 'imoca_derives' || def.modele === 'class40') up.position.set(0, 2.2, 0); // dérive au vent relevée
  else up.position.set(lee * 1.5, 0.9, 0);
  ud.heel = windSide * T.MathUtils.degToRad(A.heel);
  ud.lift = def.allure === 'pres' ? 0.15 : 0.55;
  ud.trim = def.allure === 'pres' ? 0.01 : 0.035;
  ud.speed = A.speed;
}

// ---------------------------------------------------------------- Goélette (classe Vintage)
// Pen Duick III (Éric Tabarly, 1967), modèle Blender (jeu/outils/blender/penduick3.py) : coque, rouf, quille, safran,
// deux mâts de même hauteur avec leurs barres de flèche, et deux bômes séparées (origine au vit-de-mulet) que le jeu
// fait pivoter avec les voiles. Sources : Wikipédia (17,45 m ; 152 m² au près) ; bateaux.com, « Pen Duick III, la
// goélette de Tabarly conçue pour la Transat anglaise de 1968 » (tirant d'air 18,80 m ; deux mâts de hauteur identique ;
// misaine lattée de 36 m² au louvoyage, grande misaine à bordure libre de 93,60 m² tenue par un wishbone au largue et au
// vent arrière). Position des mâts relevée sur photos. La grande misaine n'est pas dessinée : sa forme n'est pas connue
// (pas de plan trouvé) ; la misaine lattée reste à poste à toutes les allures (décision du 10/11/2026, après avis du
// porteur de projet sur une première forme jugée incohérente).
const PD3 = { L: 17.45, B: 4.21, Z_MISAINE: -2.725, Z_GRAND: 2.175, MAT_H: 17.65, BOME_Y: 0.9, BOME_MISAINE: 4.3, BOME_GRAND: 5.6 };
/** Hauteur du pont au-dessus de l'eau à l'abscisse z du jeu (même formule que le script Blender). */
function pontPD3(z: number) {
  const t = (-z + PD3.L / 2) / PD3.L;
  return 1.05 + (t - 0.45) ** 2 + 0.06;
}
/** Demi-largeur du pont à l'abscisse z (même formule que le script Blender). */
function demiPD3(z: number) {
  const t = Math.max(0, Math.min(1, (-z + PD3.L / 2) / PD3.L));
  if (t < 0.12) return (PD3.B / 2) * (0.55 + 0.45 * Math.sin(((Math.PI / 2) * t) / 0.12) ** 1.2) * 0.88 + 0.08;
  const u = (t - 0.12) / 0.88;
  return (PD3.B / 2) * Math.sin(Math.PI * Math.min(1, 0.5 + 0.5 * u)) ** 0.75 * (0.9 + 0.1 * Math.sin(Math.PI * u)) + 0.02;
}

/**
 * Spi symétrique (bateaux de légende ; vues de référence envoyées par le porteur de projet, 10/11/2026) : têtière en
 * pointe en tête de mât, deux points d'écoute symétriques au bas (amure au bout du tangon, écoute sous le vent),
 * guindant et chute bombés vers l'extérieur (largeur maximale vers 45 % de la hauteur), bordure courbe, et une toile
 * très creuse qui gonfle vers l'avant (vue de dessus en quart de sphère). La largeur est ajustée pour la vraie surface.
 */
function spiSymetrique(aire: number, o: { mat: T.Vector3; hauteur: number; tangon: number; allure: AllureKey; lee: number }) {
  const ventAuVent = -o.lee;
  const angleTangon = T.MathUtils.degToRad({ pres: 10, travers: 22, largue: 45, arriere: 75 }[o.allure]);
  const angleBordure = T.MathUtils.degToRad({ pres: 70, travers: 50, largue: 30, arriere: 8 }[o.allure]);
  const yT = o.mat.y + 2.0;
  const pied = new T.Vector3(0, yT - 0.3, o.mat.z);
  const tack = new T.Vector3(ventAuVent * o.tangon * Math.sin(angleTangon), yT, o.mat.z - o.tangon * Math.cos(angleTangon));
  // têtière en tête du mât (drisse de spi frappée au capelage), juste devant le mât (demande du porteur de projet)
  const head = new T.Vector3(0, o.mat.y + o.hauteur - 0.2, o.mat.z - 0.2);
  const dirBordure = new T.Vector3(o.lee * Math.cos(angleBordure), 0, Math.sin(angleBordure));
  const SU = 18, SV = 22;
  const construire = (W: number) => {
    const clew = tack.clone().addScaledVector(dirBordure, W);
    clew.y = yT + 1.0;
    const dehors = new T.Vector3().subVectors(tack, clew).setY(0).normalize(); // vers l'extérieur, côté amure
    let n = new T.Vector3().crossVectors(new T.Vector3().subVectors(clew, tack), new T.Vector3().subVectors(head, tack)).normalize();
    if (n.z > 0) n = n.negate(); // la toile gonfle vers l'avant
    const pos: number[] = [], idxs: number[] = [];
    for (let j = 0; j <= SV; j++) {
      const v = j / SV;
      const e = W * 0.17 * Math.sin(Math.PI * Math.pow(v, 0.85)); // guindant et chute bombés
      const lu = new T.Vector3().lerpVectors(tack, head, v).addScaledVector(dehors, e);
      const le = new T.Vector3().lerpVectors(clew, head, v).addScaledVector(dehors, -e);
      for (let i = 0; i <= SU; i++) {
        const u = i / SU;
        const p = new T.Vector3().lerpVectors(lu, le, u);
        // toile très creuse jusque haut dans la voile (vues de référence) ; nulle seulement à la têtière
        const creux = W * 0.46 * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(Math.PI * Math.pow(v, 0.6))) * (1 - Math.pow(v, 7));
        p.addScaledVector(n, creux);
        p.y -= W * 0.06 * Math.sin(Math.PI * u) * Math.pow(1 - v, 3); // bordure courbe
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let j = 0; j < SV; j++)
      for (let i = 0; i < SU; i++) {
        const a = j * (SU + 1) + i, b = a + SU + 1;
        idxs.push(a, b, a + 1, b, b + 1, a + 1);
      }
    let surface = 0;
    const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
    for (let k = 0; k < idxs.length; k += 3) {
      A.fromArray(pos, idxs[k] * 3); B.fromArray(pos, idxs[k + 1] * 3); C.fromArray(pos, idxs[k + 2] * 3);
      surface += new T.Vector3().crossVectors(B.sub(A), C.sub(A)).length() / 2;
    }
    return { pos, idxs, clew, surface };
  };
  let W = 1.8 * o.tangon;
  let r = construire(W);
  for (let k = 0; k < 3; k++) {
    W *= aire / r.surface; // la surface croît à peu près comme la largeur
    r = construire(W);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(r.pos, 3));
  g.setIndex(r.idxs);
  g.computeVertexNormals();
  return { geo: g, tack, head, clew: r.clew, pied };
}

/**
 * Monocoque de légende (classe Vintage) : modèle Blender propre au bateau (jeu/outils/blender/vintage_mono.py), réglé
 * par ses cotes (modeles-vintage.json) ; le jeu y accroche la bôme (pièce « pivot_bome »), regroupe le mât et ses barres
 * (pièces « mat* ») pour le démâtage, et monte le gréement dormant et les voiles aux mêmes cotes. Spi symétrique sur
 * tangon quand le bateau n'a pas de bout-dehors (années 1980 et début des années 1990), gennaker sur le bout-dehors sinon.
 */
function buildMonoVintage(def: BateauScene) {
  const v = MONOS_VINTAGE[def.modele!];
  const boat = new T.Group(), body = new T.Group();
  boat.add(body);
  const Lv = v.longueur, Bv = v.largeur, H = v.hauteur_mat;
  const haut = (t: number) => v.franc_bord + v.tonture * t * t;       // même formule que le script Blender
  const zDe = (t: number) => Lv / 2 - t * Lv;                         // abscisse du jeu (étrave vers -z)
  const zMat = zDe(v.pied_mat), pied = haut(v.pied_mat) + 0.08;
  const matiere = new T.MeshStandardMaterial({ color: v.mat_carbone ? 0x15181c : 0xc7ccd1, roughness: 0.35, metalness: v.mat_carbone ? 0.2 : 0.8 });
  const gltf = coqueGltf(def.modele!, def.coque, def.bandes);
  const mats = new T.Group();
  body.add(mats);
  let bomeGltf: T.Object3D | null = null;
  if (gltf) {
    const pieces: T.Object3D[] = [];
    gltf.traverse((o) => { if (o.name.startsWith('mat')) pieces.push(o); });
    for (const o of pieces) { o.parent?.remove(o); mats.add(o); }
    bomeGltf = gltf.getObjectByName('pivot_bome') ?? null;
    bomeGltf?.parent?.remove(bomeGltf);
    body.add(gltf);
  } else {
    const h = buildHull(def.coque, def.bandes);
    h.scale.set(Bv / B, 0.75, Lv / L);
    body.add(h);
    const m = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, H, 10), matiere);
    m.position.set(0, pied + H / 2, zMat);
    mats.add(m);
  }
  // Gréement dormant : haubans par les barres de flèche (ou par les écarteurs de pont), étai, pataras.
  const rig: T.Vector3[] = [];
  const tete = new T.Vector3(0, pied + H - 0.3, zMat);
  const bowZ = -Lv / 2 + 0.2, bowY = haut(1) + 0.05, sternZ = Lv / 2 - 0.4;
  for (const sx of [-1, 1]) {
    if (v.ecarteurs) {
      const bout = new T.Vector3(sx * (Bv / 2 + v.ecarteurs), pied + 0.5, zMat - 0.6);
      rig.push(tete, bout, new T.Vector3(0, pied + H * 0.6, zMat), bout);
    } else {
      let prec = tete;
      for (let i = v.barres; i >= 1; i--) {
        const hh = i / (v.barres + 1);
        const f = new T.Vector3(sx * (1.5 - 0.5 * hh), pied + H * hh, zMat + 0.05);
        rig.push(prec, f);
        prec = f;
      }
      rig.push(prec, new T.Vector3(sx * (Bv / 2 - 0.1), haut(v.pied_mat - 0.03), zMat + 0.5));
    }
    rig.push(tete, new T.Vector3(sx * (Bv * 0.38), haut(0.02), sternZ));
  }
  const pointeAvant = v.bout_dehors ? new T.Vector3(0, bowY, -Lv / 2 - v.bout_dehors + 0.1) : new T.Vector3(0, bowY, bowZ);
  rig.push(new T.Vector3(0, pied + H * 0.95, zMat), new T.Vector3(0, bowY, bowZ));
  if (v.bout_dehors) rig.push(tete, pointeAvant);
  const etais = new T.LineSegments(new T.BufferGeometry().setFromPoints(rig), new T.LineBasicMaterial({ color: 0x1a1d22 }));
  body.add(etais);
  // Bôme : pièce du modèle, origine au vit-de-mulet.
  const pivot = new T.Group();
  if (bomeGltf) {
    pivot.position.copy(bomeGltf.position);
    bomeGltf.position.set(0, 0, 0);
    pivot.add(bomeGltf);
  } else {
    pivot.position.set(0, pied + 0.95, zMat + 0.2);
    const b = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, v.bome, 8), matiere);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0, v.bome / 2);
    pivot.add(b);
  }
  body.add(pivot);
  const mtx = mainTexture(def.numero, def.bandes, true);
  const mtxB = mtx.clone();
  mtxB.repeat.x = -1;
  mtxB.offset.x = 1;
  mtxB.needsUpdate = true;
  const keel = new T.Group(), foilPort = new T.Group(), foilStar = new T.Group(); // appendices fixes, dans le modèle
  body.add(keel, foilPort, foilStar);
  const ud: Ud = {
    body, keel, foilPort, foilStar, boomPivot: pivot,
    mainMat: new T.MeshStandardMaterial({ map: mtxB, roughness: 0.85, side: T.FrontSide }),
    mainMatB: new T.MeshStandardMaterial({ map: mtx, roughness: 0.85, side: T.BackSide }),
    headMat: new T.MeshStandardMaterial({ color: toileEpoque(v.annee), roughness: 0.85, side: T.DoubleSide }), // tergal, Kevlar ou Mylar
    spiMat: new T.MeshStandardMaterial({ color: def.spi, roughness: 0.7, side: T.DoubleSide }),
    deckY: pied, bowTop: bowY, phase: Math.random() * 10, heel: 0, lift: 0, trim: 0, speed: 9, def, etais, mat: mats,
  };
  boat.userData = ud as unknown as Record<string, unknown>;
  const A = ALLURES[def.allure];
  const windSide = def.cote || 1, lee = -windSide;
  const plan = planDe(def.modele);
  const demate = def.etat === 'demate' || def.etat === 'coule';
  const ris = def.ris ?? 0;
  if (!demate && ris < 4) {
    const gv = grandVoile(plan.gv, H - 1.6, v.bome - 0.3, ris, v.annee);
    const y0 = 0.12, z0 = 0.15;
    const g = sailGeometry(new T.Vector3(0, y0, z0), { luff: new T.Vector3(0, y0 + gv.P, z0), leech: new T.Vector3(0, y0 + gv.P - 0.25, z0 + gv.tete) }, new T.Vector3(0, y0, z0 + gv.E), def.allure === 'pres' ? 0.06 : 0.1, lee, 14, 18, gv.rond);
    pivot.add(new T.Mesh(g, ud.mainMat), new T.Mesh(g, ud.mainMatB));
  }
  pivot.rotation.y = lee * T.MathUtils.degToRad(A.boom);
  if (!def.sansVoileAvant && !demate) {
    const spi = def.forme === 'a3' || def.forme === 'a2' || def.forme === 'sgt';
    if (spi && !v.bout_dehors) {
      const s = spiSymetrique(plan.voiles[def.forme], { mat: new T.Vector3(0, pied, zMat), hauteur: H, tangon: 0.34 * Lv, allure: def.allure, lee });
      const matVoile = (ud.spiMat as T.MeshStandardMaterial).clone();
      const mesh = new T.Mesh(s.geo, matVoile);
      ud.voileAvant = { tack: s.tack, head: s.head, clew: s.clew, camber: 0.2, lee, mesh, couleur: matVoile.color.clone() };
      const tangon = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, s.pied.distanceTo(s.tack), 8), matiere);
      tangon.position.copy(s.pied).add(s.tack).multiplyScalar(0.5);
      tangon.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3().subVectors(s.tack, s.pied).normalize());
      body.add(mesh, tangon);
    } else {
      const va = voileAvant(def.forme, plan.voiles[def.forme], { deckY: pied, mastH: H, mastZ: zMat, bowZ, sprZ: v.bout_dehors ? -Lv / 2 - v.bout_dehors + 0.1 : bowZ - 0.3, bowY, longueur: Lv, lee, ancien: true });
      const matVoile = ((va.spi ? ud.spiMat : ud.headMat) as T.MeshStandardMaterial).clone();
      const mesh = new T.Mesh(sailGeometry(va.tack, va.head, va.clew, va.creux, lee, 16, 20, va.rond, va.rondG), matVoile);
      ud.voileAvant = { tack: va.tack, head: va.head, clew: va.clew, camber: va.creux, lee, mesh, couleur: matVoile.color.clone() };
      body.add(mesh);
    }
  }
  if (demate) {
    demater(ud, lee, H, zMat);
    pivot.rotation.y = 0;
  }
  if (def.etat === 'coule') ud.coule = true;
  ud.heel = windSide * T.MathUtils.degToRad(A.heel);
  ud.lift = 0.05;
  ud.trim = 0.01;
  ud.speed = Math.round(A.speed * 0.75);
  return boat;
}

function buildGoelette(def: BateauScene) {
  const boat = new T.Group(), body = new T.Group();
  boat.add(body);
  const alu = new T.MeshStandardMaterial({ color: 0xc7ccd1, roughness: 0.3, metalness: 0.8 });
  const gltf = coqueGltf('pen_duick_3', def.coque, def.bandes);
  const piece = (nom: string): T.Object3D | null => {
    const o = gltf?.getObjectByName(nom);
    if (!o) return null;
    o.parent?.remove(o);
    return o;
  };
  const H = PD3.MAT_H, zF = PD3.Z_MISAINE, zG = PD3.Z_GRAND;
  const pF = pontPD3(zF), pG = pontPD3(zG);
  // Les deux mâts et leurs barres de flèche, regroupés pour le démâtage (échelle de Beaufort).
  const mats = new T.Group();
  body.add(mats);
  if (gltf) {
    const noms: T.Object3D[] = [];
    gltf.traverse((o) => { if (o.name.startsWith('mat_')) noms.push(o); });
    for (const o of noms) {
      o.parent?.remove(o);
      mats.add(o);
    }
  }
  if (gltf) body.add(gltf);
  else {
    // Tant que le modèle n'est pas chargé : coque procédurale réduite et deux mâts simples.
    const h = buildHull(def.coque, def.bandes);
    h.scale.set(0.75, 0.7, PD3.L / L);
    body.add(h);
    for (const [z, p] of [[zF, pF], [zG, pG]] as [number, number][]) {
      const m = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, H, 10), alu);
      m.position.set(0, p + H / 2, z);
      mats.add(m);
    }
  }

  // Gréement dormant : haubans par les deux étages de barres de flèche, étai de misaine à l'étrave, étai entre les
  // têtes de mât, bastaques du grand mât vers l'arrière.
  const rig: T.Vector3[] = [];
  for (const [z, p] of [[zF, pF], [zG, pG]] as [number, number][]) {
    const top = new T.Vector3(0, p + H - 0.3, z);
    for (const sx of [-1, 1]) {
      const f2 = new T.Vector3(sx * 0.9, p + H * 0.75, z), f1 = new T.Vector3(sx * 1.3, p + H * 0.45, z);
      const cadene = new T.Vector3(sx * (demiPD3(z + 0.4) - 0.05), pontPD3(z + 0.4), z + 0.4);
      rig.push(top, f2, f2, f1, f1, cadene, new T.Vector3(0, p + H * 0.45, z), cadene);
    }
  }
  const bowZ = -PD3.L / 2 + 0.25, bowY = pontPD3(bowZ) + 0.05;
  rig.push(new T.Vector3(0, pF + H - 0.4, zF), new T.Vector3(0, bowY, bowZ));
  rig.push(new T.Vector3(0, pG + H - 0.4, zG), new T.Vector3(0, pF + H - 0.4, zF));
  for (const sx of [-1, 1]) rig.push(new T.Vector3(0, pG + H - 0.4, zG), new T.Vector3(sx * 0.8, pontPD3(PD3.L / 2 - 1.2), PD3.L / 2 - 1.2));
  const etais = new T.LineSegments(new T.BufferGeometry().setFromPoints(rig), new T.LineBasicMaterial({ color: 0x1a1d22 }));
  body.add(etais);

  // Bômes : pièces du modèle Blender (origine au vit-de-mulet), accrochées à un pivot animé.
  const pivotF = new T.Group(), pivotG = new T.Group();
  pivotF.position.set(0, pontPD3(zF + 0.15) + PD3.BOME_Y, zF + 0.15);
  pivotG.position.set(0, pontPD3(zG + 0.15) + PD3.BOME_Y, zG + 0.15);
  body.add(pivotF, pivotG);
  const bome = (nom: string, long: number, pivot: T.Group) => {
    const b = piece(nom);
    if (b) {
      b.position.set(0, 0, 0);
      pivot.add(b);
      return b;
    }
    const m = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, long, 8), alu);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, 0, long / 2);
    pivot.add(m);
    return m;
  };
  bome('pivot_bome_misaine', PD3.BOME_MISAINE, pivotF);
  bome('pivot_bome_grand', PD3.BOME_GRAND, pivotG);

  const mtx = mainTexture(def.numero, def.bandes, true);
  const mtxB = mtx.clone();
  mtxB.repeat.x = -1;
  mtxB.offset.x = 1;
  mtxB.needsUpdate = true;
  const keel = new T.Group(), foilPort = new T.Group(), foilStar = new T.Group(); // quille et safran : fixes, dans le modèle
  body.add(keel, foilPort, foilStar);
  const ud: Ud = {
    body, keel, foilPort, foilStar, boomPivot: pivotG, boomPivot2: pivotF,
    mainMat: new T.MeshStandardMaterial({ map: mtxB, roughness: 0.9, side: T.FrontSide }),
    mainMatB: new T.MeshStandardMaterial({ map: mtx, roughness: 0.9, side: T.BackSide }),
    headMat: new T.MeshStandardMaterial({ color: 0xf0ede4, roughness: 0.9, side: T.DoubleSide }), // tergal blanc
    spiMat: new T.MeshStandardMaterial({ color: def.spi, roughness: 0.7, side: T.DoubleSide }),
    deckY: pF, bowTop: bowY, phase: Math.random() * 10, heel: 0, lift: 0, trim: 0, speed: 8, def, etais, mat: mats,
  };
  boat.userData = ud as unknown as Record<string, unknown>;

  const A = ALLURES[def.allure];
  const windSide = def.cote || 1, lee = -windSide;
  const plan = planDe('pen_duick_3');
  const demate = def.etat === 'demate' || def.etat === 'coule';
  const ris = def.ris ?? 0;
  const P = H - PD3.BOME_Y - 0.7;
  const creux = def.allure === 'pres' ? 0.07 : 0.11;
  /** Voile bermudienne sur sa bôme (grand-voile, misaine lattée). */
  const bermudienne = (pivot: T.Group, aire: number, E: number) => {
    const gv = grandVoile(aire, P, E, ris, 1967);
    const y0 = 0.12, z0 = 0.15;
    const g = sailGeometry(new T.Vector3(0, y0, z0), { luff: new T.Vector3(0, y0 + gv.P, z0), leech: new T.Vector3(0, y0 + gv.P - 0.25, z0 + gv.tete) }, new T.Vector3(0, y0, z0 + gv.E), creux, lee, 14, 18, gv.rond);
    pivot.add(new T.Mesh(g, ud.mainMat), new T.Mesh(g, ud.mainMatB));
  };
  if (!demate && ris < 4) {
    bermudienne(pivotG, plan.gv * plan.echelleAire, PD3.BOME_GRAND - 0.3);
    if (plan.misaine) bermudienne(pivotF, plan.misaine.pres * plan.echelleAire, PD3.BOME_MISAINE - 0.3);
  }
  pivotG.rotation.y = lee * T.MathUtils.degToRad(A.boom);
  pivotF.rotation.y = lee * T.MathUtils.degToRad(A.boom * 0.9);
  if (demate) {
    // F11 : les deux mâts se rompent au-dessus du pont et tombent sous le vent ; bômes à poste sur le pont.
    demater(ud, lee, H, zF);
    demater(ud, lee, H, zG);
    pivotF.rotation.y = pivotG.rotation.y = 0;
  }
  if (def.etat === 'coule') ud.coule = true;

  // Voile d'avant (foc, génois), amurée à l'étrave et frappée en tête du mât de misaine ; ou spi symétrique, amuré au
  // bout du tangon (5,8 m, la distance du mât de misaine à l'étrave), avec son bras et son écoute.
  const spiSym = def.forme === 'a3' || def.forme === 'a2';
  if (!def.sansVoileAvant && !demate && spiSym) {
    const s = spiSymetrique(plan.voiles[def.forme] * plan.echelleAire, { mat: new T.Vector3(0, pF, zF), hauteur: H, tangon: 5.8, allure: def.allure, lee });
    const matVoile = (ud.spiMat as T.MeshStandardMaterial).clone();
    const mesh = new T.Mesh(s.geo, matVoile);
    ud.voileAvant = { tack: s.tack, head: s.head, clew: s.clew, camber: 0.2, lee, mesh, couleur: matVoile.color.clone() };
    const tangon = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, s.pied.distanceTo(s.tack), 8), alu);
    tangon.position.copy(s.pied).add(s.tack).multiplyScalar(0.5);
    tangon.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3().subVectors(s.tack, s.pied).normalize());
    const arriere = PD3.L / 2 - 1.5;
    const manoeuvres = new T.LineSegments(new T.BufferGeometry().setFromPoints([
      s.tack, new T.Vector3(-lee * (demiPD3(arriere) - 0.1), pontPD3(arriere), arriere), // bras, au vent
      s.clew, new T.Vector3(lee * (demiPD3(arriere) - 0.1), pontPD3(arriere), arriere),  // écoute, sous le vent
    ]), new T.LineBasicMaterial({ color: 0x1a1d22 }));
    body.add(mesh, tangon, manoeuvres);
  } else if (!def.sansVoileAvant && !demate) {
    const va = voileAvant(def.forme, plan.voiles[def.forme] * plan.echelleAire, { deckY: pF, mastH: H, mastZ: zF, bowZ, sprZ: bowZ - 1.2, bowY, longueur: PD3.L, lee });
    const { tack, head, clew } = va;
    const matVoile = ((va.spi ? ud.spiMat : ud.headMat) as T.MeshStandardMaterial).clone();
    const mesh = new T.Mesh(sailGeometry(tack, head, clew, va.creux, lee, 16, 20, va.rond, va.rondG), matVoile);
    ud.voileAvant = { tack, head, clew, camber: va.creux, lee, mesh, couleur: matVoile.color.clone() };
    body.add(mesh);
  }
  ud.heel = windSide * T.MathUtils.degToRad(A.heel);
  ud.lift = 0;
  ud.trim = 0.01;
  ud.speed = Math.round(A.speed * 0.6);
  return boat;
}

// ---------------------------------------------------------------- Trimarans
// Repris du prototype validé (conception/prototype-3d-ultim.html) : Ultim 32/23 inspiré de SVR-Lazartigue.
// Ultim volant : foils dans les flotteurs. Ultim ancienne génération : dérives droites, sans foils.
// Ocean Fifty : même architecture à l'échelle 50 pieds (provisoire, à valider sur photos).
const TRI = { LC: 32, BEAM: 23, LF: 28.5, FHB: 0.95, MAST_H: 35, MAST_Z: -3.2, BEAM_F: -2.4, BEAM_A: 7.2 };
const TRI_FX = TRI.BEAM / 2 - TRI.FHB;
const TRI_ALLURES: Record<AllureKey, { heel: number; lift: number; boom: number }> = {
  pres: { heel: 5, lift: 0.5, boom: 4 },
  travers: { heel: 6, lift: 1.2, boom: 12 },
  largue: { heel: 5, lift: 1.4, boom: 22 },
  arriere: { heel: 4, lift: 1.1, boom: 32 },
};

interface Loft {
  L: number; n: number; camber: number;
  half: (t: number) => number; top: (t: number) => number; dep: (t: number) => number;
}

function loftTri(o: Loft, colors: { hull: string; stripe: string; bottom: string }, deckColor: number) {
  const S = 56, K = 28, n = o.n;
  const pos: number[] = [], col: number[] = [], ind: number[] = [];
  const cH = new T.Color(colors.hull), cS = new T.Color(colors.stripe), cB = new T.Color(colors.bottom);
  for (let i = 0; i <= S; i++) {
    const t = i / S, hb = o.half(t), top = o.top(t), dep = o.dep(t), z = o.L / 2 - t * o.L;
    for (let k = 0; k <= K; k++) {
      const th = (Math.PI * k) / K, c = Math.cos(th), sn = Math.sin(th);
      const x = hb * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = top - (top + dep) * Math.pow(Math.abs(sn), 2 / n);
      pos.push(x, y, z);
      const cc = y > top - 0.25 ? cS : y < -dep + (top + dep) * 0.28 ? cB : cH;
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < S; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + K + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(ind);
  g.computeVertexNormals();
  const grp = new T.Group();
  grp.add(new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05, side: T.DoubleSide })));
  const dp: number[] = [], di: number[] = [], J = 10;
  for (let i = 0; i <= S; i++) {
    const t = i / S, hb = o.half(t), top = o.top(t), z = o.L / 2 - t * o.L;
    for (let j = 0; j <= J; j++) { const u = -1 + (2 * j) / J; dp.push(u * hb, top + o.camber * (1 - u * u) - 0.005, z); }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < J; j++) { const a = i * (J + 1) + j, b = a + J + 1; di.push(a, a + 1, b, b, a + 1, b + 1); }
  const dg = new T.BufferGeometry();
  dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3));
  dg.setIndex(di);
  dg.computeVertexNormals();
  grp.add(new T.Mesh(dg, new T.MeshStandardMaterial({ color: deckColor, roughness: 0.75, side: T.DoubleSide })));
  return grp;
}

const TRI_CENTRAL: Loft = {
  L: TRI.LC, n: 2.3, camber: 0.18,
  half: (t) => (t < 0.5 ? 1.6 * (0.78 + 0.22 * Math.sin(((t / 0.5) * Math.PI) / 2)) : 1.6 * Math.max(0.004, Math.pow(Math.cos((((t - 0.5) / 0.5) * Math.PI) / 2), 0.8))),
  top: (t) => 2.4 + 0.6 * t * t,
  dep: (t) => 1.0 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.12)) + 0.05,
};
const TRI_FLOTTEUR: Loft = {
  L: TRI.LF, n: 2.4, camber: 0.1,
  half: (t) => (t < 0.45 ? TRI.FHB * (0.7 + 0.3 * Math.sin(((t / 0.45) * Math.PI) / 2)) : TRI.FHB * Math.max(0.004, Math.pow(Math.cos((((t - 0.45) / 0.55) * Math.PI) / 2), 0.85))),
  top: (t) => 1.95 + 0.5 * t * t,
  dep: (t) => 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.0 + 0.15)) + 0.05,
};

/**
 * Cotes du trimaran dans le repère du modèle (celui d'un Ultim de 32 m ; l'Ocean Fifty est ensuite réduit de 15,24/32).
 * Ocean Fifty modélisé dans Blender (10/11/2026) : ses vraies proportions (jauge : 15,24 m de long, 15,24 m de large,
 * tirant d'air 23,77 m), exprimées dans ce repère (× 32/15,24).
 */
function geometrieTri(oc50: boolean, ancien = false, vintage?: string): { LC: number; LF: number; FX: number; MAST_H: number; MAST_Z: number; BEAM_F: number; BEAM_A: number; top: (t: number) => number; piedY?: number; amureZ?: number; amureY?: number } {
  const mv = vintage ? MULTIS_VINTAGE[vintage] : undefined;
  if (mv) {
    // Multicoque de légende (jeu/outils/blender/vintage_multi.py) : mêmes formules que le script, dans le repère de 32 m.
    const k = 32 / mv.longueur, s = mv.longueur / 18.28, Lr = mv.longueur;
    const cata = mv.type === 'catamaran';
    const yDe = (t: number) => t * Lr - Lr / 2; // abscisse Blender (étrave vers +y)
    const hautC = (t: number) => (cata ? 1.55 + 0.45 * t * t : (1.35 + 0.4 * t * t) * s);
    const hautBras = 1.55 + 0.45 * 0.55 * 0.55 + 0.25;
    const yMat = yDe(cata ? mv.bras[1] : mv.pied_mat);
    const piedR = cata ? hautBras + 0.25 : hautC(mv.pied_mat) + 0.1 * s;
    const FX = cata ? mv.largeur / 2 - 0.85 : mv.largeur / 2 - 0.55 * s;
    const yAv = yDe(mv.bras[0]);
    return {
      LC: Lr * k, LF: mv.longueur_flotteurs * k, FX: FX * k, MAST_H: mv.hauteur_mat * k, MAST_Z: -yMat * k,
      BEAM_F: -yAv * k, BEAM_A: -yDe(mv.bras[mv.bras.length - 1]) * k,
      top: (t: number) => (cata ? hautBras : hautC(t)) * k,
      piedY: piedR * k,
      // amure des voiles d'avant : bout-dehors (trimaran), ou poutre sous le bras avant (catamaran)
      amureZ: cata ? -(yAv + 1.1) * k : -(Lr / 2 + mv.bout_dehors - 0.1) * k,
      amureY: cata ? (hautBras - 0.15) * k : (hautC(1) - 0.05) * k,
    };
  }
  if (!oc50)
    return { LC: TRI.LC, LF: TRI.LF, FX: TRI_FX, MAST_H: ancien ? 33.5 : TRI.MAST_H, MAST_Z: TRI.MAST_Z, BEAM_F: TRI.BEAM_F, BEAM_A: TRI.BEAM_A, top: TRI_CENTRAL.top };
  const k = 32 / 15.24;
  return {
    LC: 15.24 * k, LF: 14.6 * k, FX: 7.1 * k, MAST_H: 21.6 * k, MAST_Z: -1.2 * k, BEAM_F: -1.6 * k, BEAM_A: 4.0 * k,
    top: (t: number) => (1.5 + 0.4 * t * t) * k,
  };
}

/** Plateforme du trimaran construite par le code (Ultim ancienne génération, ou en attendant le modèle Blender). */
function buildPlateformeTri(body: T.Group, def: BateauScene, colors: { hull: string; stripe: string; bottom: string }) {
  body.add(loftTri(TRI_CENTRAL, colors, 0x2b3036));
  for (const side of [-1, 1]) {
    const f = loftTri(TRI_FLOTTEUR, colors, 0x2b3036);
    f.position.set(side * TRI_FX, 0.15, 1.2);
    body.add(f);
  }
  const beamMat = new T.MeshStandardMaterial({ color: def.coque, roughness: 0.4 });
  for (const [z, chord, thick, y] of [[TRI.BEAM_F, 1.7, 0.55, 2.45], [TRI.BEAM_A, 1.4, 0.5, 2.35]]) {
    const geo = new T.CylinderGeometry(1, 1, 2 * TRI_FX, 20, 1);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, thick / 2, chord / 2);
    const m = new T.Mesh(geo, beamMat);
    m.position.set(0, y, z);
    body.add(m);
  }
  const trampMat = new T.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.95, side: T.DoubleSide });
  for (const side of [-1, 1]) {
    const g = new T.PlaneGeometry(TRI_FX - 2.3, TRI.BEAM_A - TRI.BEAM_F - 1.4);
    g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, trampMat);
    m.position.set(side * (1.4 + (TRI_FX - 2.3) / 2 + 0.2), 2.3, (TRI.BEAM_F + TRI.BEAM_A) / 2);
    body.add(m);
  }
  const deckY = TRI_CENTRAL.top(0.6) + 0.15;
  const glass = new T.MeshStandardMaterial({ color: 0x0b1724, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.85 });
  for (const side of [-1, 1]) {
    const g = new T.SphereGeometry(0.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.75, 1.5);
    const m = new T.Mesh(g, glass);
    m.position.set(side * 0.75, deckY - 0.05, TRI.MAST_Z + 2.2);
    body.add(m);
  }
}

function buildTrimaran(def: BateauScene) {
  const boat = new T.Group(), body = new T.Group();
  boat.add(body);
  const volant = def.modele === 'ultim';
  const carbon = new T.MeshStandardMaterial({ color: 0x14171b, roughness: 0.45, metalness: 0.2 });
  const colors = { hull: def.coque, stripe: def.bandes, bottom: '#1a1d22' };
  // Plateformes modélisées dans Blender : Ultim volant (design de Banque Populaire XI) et Ultim ancienne génération
  // (design d'IDEC Sport), avec leurs appendices, mât et bôme.
  const vintage = def.modele && MULTIS_VINTAGE[def.modele] ? def.modele : undefined;
  const gltf = def.modele === 'ultim' || def.modele === 'ultim_ancien' || def.modele === 'ocean_fifty' || vintage ? coqueGltf(def.modele!, def.coque, def.bandes) : null;
  const G = geometrieTri(def.modele === 'ocean_fifty' && !!gltf, def.modele === 'ultim_ancien' && !!gltf, gltf ? vintage : undefined); // IDEC Sport : mât de 33,5 m
  if (gltf) body.add(gltf);
  else buildPlateformeTri(body, def, colors);
  /** Pièce du modèle Blender (appendice, mât, bôme), détachée pour être accrochée à un élément animé. */
  const piece = (nom: string): T.Object3D | null => {
    const o = gltf?.getObjectByName(nom);
    if (!o) return null;
    o.parent?.remove(o);
    return o;
  };
  const deckY = G.piedY ?? G.top(0.6) + 0.15;
  const mastPivot = new T.Group();
  mastPivot.position.set(0, deckY, G.MAST_Z);
  body.add(mastPivot);
  const mastGltf = piece('pivot_mat');
  if (mastGltf) {
    mastGltf.position.set(0, 0, 0); // le pied du mât est l'origine de la pièce : il pivote avec le mât
    mastPivot.add(mastGltf);
  } else {
    const mastGeo = new T.CylinderGeometry(0.16, 0.26, G.MAST_H, 14);
    mastGeo.scale(1, 1, 3.2);
    const mast = new T.Mesh(mastGeo, carbon);
    mast.position.y = G.MAST_H / 2;
    mastPivot.add(mast);
  }
  const bowY = G.amureY ?? G.top(1);
  // Pas de bout-dehors sur l'Ultim volant modélisé (design de Banque Populaire XI) : voiles d'avant amurées à l'étrave.
  if (!gltf) {
    const sprit = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 4.2, 8), carbon);
    sprit.rotation.x = Math.PI / 2;
    sprit.position.set(0, bowY - 0.15, -G.LC / 2 - 1.8);
    body.add(sprit);
  }
  const top = new T.Vector3(0, deckY + G.MAST_H - 0.5, G.MAST_Z);
  const rig: T.Vector3[] = [];
  for (const sd of [-1, 1]) {
    rig.push(top, new T.Vector3(sd * (G.FX - 0.6), 2.7, G.BEAM_F + 0.3));
    rig.push(new T.Vector3(0, deckY + G.MAST_H * 0.6, G.MAST_Z), new T.Vector3(sd * (G.FX - 0.6), 2.7, G.BEAM_F + 0.3));
    rig.push(top, new T.Vector3(sd * (G.FX - 0.4), 2.5, G.BEAM_A + 0.2));
  }
  rig.push(new T.Vector3(0, deckY + G.MAST_H * 0.9, G.MAST_Z), new T.Vector3(0, bowY, G.amureZ ?? -G.LC / 2 + 0.3));
  body.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(rig), new T.LineBasicMaterial({ color: 0x1a1d22 })));
  // Appendices : dérive centrale, safrans en T ; foils (Ultim volant) ou dérives droites dans les flotteurs.
  // Avec le modèle Blender, dérive, safrans et bout-dehors sont déjà dans la plateforme (pièces fixes).
  const appendicesBlender = !!(gltf?.getObjectByName('app_safran_centre') || gltf?.getObjectByName('app_safran_babord'));
  const dag = new T.Mesh(new T.BoxGeometry(0.16, 4.6, 1.2), carbon);
  dag.position.set(0, -2.6, G.MAST_Z + 1.5);
  if (!appendicesBlender) body.add(dag);
  const safran = (x: number, z: number, yTop: number, depth: number) => {
    if (appendicesBlender) return;
    const blade = new T.Mesh(new T.BoxGeometry(0.1, depth, 0.75), carbon);
    blade.position.set(x, yTop - depth / 2, z);
    body.add(blade);
    if (volant) {
      const elev = new T.Mesh(new T.BoxGeometry(1.8, 0.07, 0.55), carbon);
      elev.position.set(x, yTop - depth + 0.05, z - 0.05);
      body.add(elev);
    }
  };
  safran(0, G.LC / 2 - 0.9, -0.6, 3.2);
  for (const sd of [-1, 1]) safran(sd * G.FX, 1.2 + G.LF / 2 - 0.9, -0.3, 2.8);
  const appendice = (side: number) => {
    const x0 = side * G.FX, z0 = G.BEAM_F + 0.6;
    const p = new T.Group();
    const foilGltf = piece(side < 0 ? 'app_foil_babord' : 'app_foil_tribord');
    if (foilGltf) {
      p.add(foilGltf); // foil en L du modèle Blender (monte et descend avec le groupe)
    } else if (volant) {
      const pts = [new T.Vector3(x0, 0.6, z0), new T.Vector3(x0, -1.6, z0), new T.Vector3(x0 - side * 0.7, -3.0, z0 + 0.1), new T.Vector3(x0 - side * 2.6, -3.4, z0 + 0.2), new T.Vector3(x0 - side * 3.6, -3.25, z0 + 0.2)];
      const shape = new T.Shape();
      shape.absellipse(0, 0, 0.08, 0.5, 0, Math.PI * 2, false, 0);
      p.add(new T.Mesh(new T.ExtrudeGeometry(shape, { steps: 40, bevelEnabled: false, extrudePath: new T.CatmullRomCurve3(pts) }), carbon));
    } else {
      const lame = new T.Mesh(new T.BoxGeometry(0.12, 3.6, 0.9), carbon);
      lame.position.set(x0, -1.6, z0);
      p.add(lame);
    }
    body.add(p);
    return p;
  };
  const foilPort = appendice(-1), foilStar = appendice(1);
  const keel = new T.Group();
  body.add(keel);
  const boomPivot = new T.Group();
  boomPivot.position.set(0, deckY, G.MAST_Z);
  body.add(boomPivot);
  const BOOM = 12.5, BOOM_Y = 0.75;
  const boom = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, BOOM, 8), carbon);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, BOOM_Y, BOOM / 2);
  const bomeGltf = piece('pivot_bome');
  if (bomeGltf) {
    bomeGltf.position.set(0, 0, 0); // origine au vit-de-mulet : la bôme pivote avec la grand-voile
    boomPivot.add(bomeGltf);
  } else boomPivot.add(boom);
  const mtx = mainTexture(def.numero, def.bandes, !!vintage, def.classe === 'OCEAN_FIFTY' ? 'ocean_fifty' : undefined); // voiles claires des bateaux de légende
  const mtxB = mtx.clone();
  mtxB.repeat.x = -1;
  mtxB.offset.x = 1;
  mtxB.needsUpdate = true;
  const chavire = def.etat === 'chavire';
  const ud: Ud = {
    body, keel, foilPort, foilStar, boomPivot,
    mainMat: new T.MeshStandardMaterial({ map: mtxB, roughness: 0.8, side: T.FrontSide }),
    mainMatB: new T.MeshStandardMaterial({ map: mtx, roughness: 0.8, side: T.BackSide }),
    headMat: new T.MeshStandardMaterial({ color: vintage ? toileEpoque(anneeVintage(vintage)) : 0x30353c, roughness: 0.8, side: T.DoubleSide }), // carbone, ou tergal et Mylar clairs des bateaux de légende
    spiMat: new T.MeshStandardMaterial({ color: def.spi, roughness: 0.7, side: T.DoubleSide }),
    deckY, bowTop: bowY, phase: Math.random() * 10, heel: 0, lift: 0, trim: 0, speed: 20, def,
  };
  boat.userData = ud as unknown as Record<string, unknown>;

  // Gréement selon l'allure (mât-aile rotatif) et voile d'avant.
  const A = TRI_ALLURES[def.allure];
  const windSide = def.cote || 1, lee = -windSide;
  const plan = planDe(def.modele);
  const y0 = BOOM_Y + 0.1;
  if ((def.ris ?? 0) < 4 && !chavire) {
    const gv = grandVoile(plan.gv * plan.echelleAire, G.MAST_H - 0.6 - y0, BOOM - 0.6, def.ris ?? 0, anneeVintage(vintage));
    const mg = sailGeometry(
      new T.Vector3(0, y0, 0.3),
      { luff: new T.Vector3(0, y0 + gv.P, 0.3), leech: new T.Vector3(0, y0 + gv.P - 0.4, 0.3 + gv.tete) },
      new T.Vector3(0, y0, 0.3 + gv.E),
      def.allure === 'pres' ? 0.06 : 0.09,
      lee, 14, 18, gv.rond,
    );
    boomPivot.add(new T.Mesh(mg, ud.mainMat), new T.Mesh(mg, ud.mainMatB));
  }
  boomPivot.rotation.y = lee * T.MathUtils.degToRad(A.boom);
  mastPivot.rotation.y = lee * T.MathUtils.degToRad(A.boom * 0.8 + 6);
  if (!def.sansVoileAvant && !chavire) {
    const dY = deckY, bowZ = -G.LC / 2, sprZ = G.amureZ ?? (gltf ? -G.LC / 2 + 0.3 : -G.LC / 2 - 3.8), bY = bowY;
    const va = voileAvant(def.forme, plan.voiles[def.forme] * plan.echelleAire, {
      deckY: dY, mastH: G.MAST_H, mastZ: G.MAST_Z, bowZ, sprZ, bowY: bY, lee, bome: A.boom, ancien: !!vintage,
      // Proportions des voiles calées sur le mât, comme sur l'IMOCA (27 m de mât pour 18,28 m) : la coque d'un Ultim est très
      // longue pour son mât, et un gennaker réglé sur la longueur de coque partait jusqu'au tableau arrière (11/11/2026).
      longueur: Math.min(G.LC, G.MAST_H / (27 / 18.28)),
    });
    const { tack, head, clew } = va;
    const mat: T.Material = va.spi ? ud.spiMat : ud.headMat;
    const camber = va.creux;
    const matVoile = (mat as T.MeshStandardMaterial).clone();
    const mesh = new T.Mesh(sailGeometry(tack, head, clew, camber, lee, 16, 20, va.rond, va.rondG), matVoile);
    ud.voileAvant = { tack, head, clew, camber, lee, mesh, couleur: matVoile.color.clone() };
    body.add(mesh);
  }
  // Foil (ou dérive) sous le vent descendu, celui au vent relevé dans son puits.
  (lee > 0 ? foilPort : foilStar).position.set(0, 2.6, 0);
  ud.heel = windSide * T.MathUtils.degToRad(A.heel);
  ud.lift = volant ? A.lift : 0.3; // seul l'Ultim volant décolle de l'eau
  ud.trim = 0.02;
  ud.speed = volant ? 26 : 20;
  if (chavire) {
    // Chaviré : le trimaran flotte à l'envers, flotteurs et dérive vers le ciel (la boucle d'animation le retourne) ;
    // le mât et le gréement sont sous l'eau, on ne les montre pas.
    ud.chavire = true;
    mastPivot.visible = false;
    boomPivot.visible = false;
    for (const o of body.children) if ((o as T.LineSegments).isLineSegments) o.visible = false;
    ud.heel = 0;
    ud.lift = 0.1;
  }
  if (def.modele === 'ocean_fifty') boat.scale.setScalar(15.24 / 32); // 50 pieds (provisoire)
  if (vintage) boat.scale.setScalar(MULTIS_VINTAGE[vintage].longueur / 32);
  return boat;
}

const NB_ECUME = 5000;
const NB_NUAGES = 56;

/**
 * Texture d'un nuage (cumulus) : bourgeonnements blancs arrondis sur une base plate et grisée. Trois variantes.
 */
function textureNuage(k: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  let graine = 17 + k * 101;
  const r = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const n = 9 + k * 2;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = 34 + u * 188 + (r() - 0.5) * 14;
    const rayon = (20 + 26 * Math.sin(Math.PI * u) + r() * 10) * (k === 2 ? 0.85 : 1);
    const y = 92 - rayon * 0.55 - r() * 10;
    const gr = g.createRadialGradient(x, y, rayon * 0.15, x, y, rayon);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rayon, 0, Math.PI * 2);
    g.fill();
  }
  // base plate et ombrée (le dessous du nuage est à l'ombre)
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,1)';
  g.fillRect(0, 104, 256, 24);
  g.globalCompositeOperation = 'source-atop';
  const ombre = g.createLinearGradient(0, 30, 0, 104);
  ombre.addColorStop(0, 'rgba(120,130,140,0)');
  ombre.addColorStop(1, 'rgba(110,120,132,0.55)');
  g.fillStyle = ombre;
  g.fillRect(0, 0, 256, 128);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export class Scene3D {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(45, 1, 0.5, 3000);
  private sun: T.DirectionalLight;
  private hemi: T.HemisphereLight;
  private sea: T.Mesh;
  private seaGeo: T.PlaneGeometry;
  private seaBase: Float32Array;
  private seaCol: Float32Array;
  private fleet: T.Group[] = [];
  /** Ligne d'arrivée (bouée, bateau comité, ligne), le cas échéant. */
  private decor: T.Group | null = null;
  private clock = new T.Clock();
  private raf = 0;
  private orbit = { yaw: -1.15, pitch: 0.16, dist: 62 };
  private reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private mer = etatMer(4);
  private vagues: { a: number; k: number; dx: number; dz: number; w: number }[] = [];
  // Écume : sillage et vague d'étrave (particules posées sur la mer)
  private ecumeGeo = new T.BufferGeometry();
  private ecumePos = new Float32Array(NB_ECUME * 3);
  private ecumeCol = new Float32Array(NB_ECUME * 3);
  private ecumeAge = new Float32Array(NB_ECUME).fill(99);
  private ecumeVie = new Float32Array(NB_ECUME).fill(1);
  private ecumeVit = new Float32Array(NB_ECUME * 2);
  private ecumeI = 0;
  // Nuages : sprites autour du bateau, plus nombreux, bas et sombres quand le vent forcit (échelle de Beaufort).
  private nuages = new T.Group();
  private ventNuages = 2;

  /** Appelé si le navigateur retire le contexte graphique (la vue 3D ne peut plus s'afficher). */
  surPerte?: () => void;

  constructor(private wrap: HTMLElement, private labels: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    wrap.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.arreter();
      if (!this.detruite) this.surPerte?.(); // pas quand c'est nous qui libérons le contexte
    });
    this.scene.fog = new T.Fog(0xc4dbec, 160, 900);
    this.hemi = new T.HemisphereLight(0xdcecff, 0x1d4b6e, 1.6);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xfff3e0, 2.6);
    this.scene.add(this.sun, this.sun.target);
    this.seaGeo = new T.PlaneGeometry(1100, 1100, 150, 150);
    this.seaGeo.rotateX(-Math.PI / 2);
    this.seaCol = new Float32Array(this.seaGeo.attributes.position.count * 3);
    this.seaGeo.setAttribute('color', new T.BufferAttribute(this.seaCol, 3));
    this.sea = new T.Mesh(this.seaGeo, new T.MeshPhongMaterial({ vertexColors: true, specular: 0x4a7894, shininess: 45, transparent: true, opacity: 0.9 }));
    this.scene.add(this.sea);
    this.seaBase = (this.seaGeo.attributes.position.array as Float32Array).slice();

    const point = document.createElement('canvas');
    point.width = point.height = 64;
    const pg = point.getContext('2d')!;
    const gr = pg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = gr;
    pg.fillRect(0, 0, 64, 64);
    this.ecumeGeo.setAttribute('position', new T.BufferAttribute(this.ecumePos, 3));
    this.ecumeGeo.setAttribute('color', new T.BufferAttribute(this.ecumeCol, 3));
    this.scene.add(new T.Points(this.ecumeGeo, new T.PointsMaterial({ size: 1.5, map: new T.CanvasTexture(point), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));

    const texNuages = [0, 1, 2].map(textureNuage);
    for (let i = 0; i < NB_NUAGES; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: texNuages[i % 3], transparent: true, depthWrite: false, fog: false }));
      // angle d'or : quel que soit le nombre de nuages montrés, ils se répartissent sur tout le tour de l'horizon
      sp.userData = { a: i * 2.39996 + Math.random() * 0.3, r: Math.random(), h: Math.random(), s: 0.7 + Math.random() * 0.6, y: 150, rayon: 400 };
      this.nuages.add(sp);
    }
    this.scene.add(this.nuages);

    this.regler(4);

    let drag = false, lx = 0, ly = 0;
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => { drag = false; });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.orbit.yaw -= (e.clientX - lx) * 0.006;
      this.orbit.pitch = Math.min(1.3, Math.max(0.04, this.orbit.pitch + (e.clientY - ly) * 0.004));
      lx = e.clientX;
      ly = e.clientY;
    });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.orbit.dist = Math.min(160, Math.max(22, this.orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  }

  static disponible(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  /** Règle la mer, le ciel et la lumière selon la force du vent (Beaufort). */
  regler(force: number) {
    const m = (this.mer = etatMer(force));
    const k0 = (2 * Math.PI) / m.long;
    const comp = [
      { part: 0.55, k: k0, dx: 0.8, dz: 0.6 },
      { part: 0.28, k: k0 * 1.9, dx: -0.3, dz: 1.0 },
      { part: 0.12, k: k0 * 4, dx: 1.0, dz: -0.2 },
      { part: 0.05, k: k0 * 9, dx: 0.4, dz: 0.9 },
    ];
    // Amplitude = moitié de la hauteur ; pulsation des vagues de houle en eau profonde : ω = √(g·k).
    this.vagues = comp.map((c) => ({ a: (m.haut / 2) * c.part + (c.k > k0 * 3 ? 0.04 : 0), k: c.k, dx: c.dx, dz: c.dz, w: Math.sqrt(9.81 * c.k) }));
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, m.ciel[0]);
    gr.addColorStop(0.55, m.ciel[1]);
    gr.addColorStop(1, m.ciel[2]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 2, 256);
    const sky = new T.CanvasTexture(c);
    sky.colorSpace = T.SRGBColorSpace;
    (this.scene.background as T.Texture | null)?.dispose?.();
    this.scene.background = sky;
    this.scene.fog = new T.Fog(new T.Color(m.ciel[2]), m.brume * 0.18, m.brume);
    this.sun.intensity = m.force <= 5 ? 2.6 : m.force <= 8 ? 1.5 : 0.9;
    this.hemi.intensity = m.force <= 5 ? 1.6 : 1.3;
    // Nuages : beau temps (quelques cumulus blancs, hauts) → coup de vent (ciel chargé, gris) → tempête (plafond bas, noir).
    const f = m.force;
    const nb = [5, 7, 10, 14, 18, 24, 32, 40, 46, 50, 54, 56, 56][f];
    const gris = Math.min(1, Math.max(0, (f - 4) / 7));
    const couleur = new T.Color(1, 1, 1).lerp(new T.Color(0.26, 0.29, 0.32), gris);
    // hauteur apparente au-dessus de l'horizon (degrés) : nuages hauts par beau temps, plafond bas dans la tempête
    const [eMin, eMax] = f <= 4 ? [2.5, 12] : f <= 7 ? [1.5, 9] : f <= 9 ? [0.8, 6] : [0.4, 4];
    const taille = f <= 3 ? 90 : f <= 6 ? 140 : f <= 9 ? 200 : 260;
    const loin = Math.min(760, m.brume * 1.1);
    this.nuages.children.forEach((o, i) => {
      const sp = o as T.Sprite, u = sp.userData;
      sp.visible = i < nb;
      sp.material.color.copy(couleur).multiplyScalar(0.88 + 0.12 * u.h);
      sp.material.opacity = f <= 5 ? 0.92 : 0.96;
      sp.scale.set(taille * u.s * 2, taille * u.s, 1);
      u.rayon = 320 + u.r * (loin - 320);
      u.y = 20 + u.rayon * Math.tan(T.MathUtils.degToRad(eMin + u.h * (eMax - eMin)));
    });
    this.ventNuages = 1 + f * 1.6;
  }

  afficher(bateaux: BateauScene[], force = 4) {
    this.regler(force);
    if (this.decor) {
      this.scene.remove(this.decor);
      this.decor.traverse((o) => (o as T.Mesh).geometry?.dispose?.());
      this.decor = null;
    }
    for (const b of this.fleet) {
      this.scene.remove(b);
      b.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose?.();
      });
    }
    this.ecumeAge.fill(99);
    this.labels.innerHTML = '';
    this.fleet = bateaux.map((def) => {
      const b = buildBoat(def);
      const ud = b.userData as unknown as Ud;
      ud.heel *= this.mer.gite;
      // Demande du 11/11/2026 : l'Ultim volant vole dès force 3, ses trois coques au-dessus de l'eau. L'Ocean Fifty, l'Ultim
      // non volant et les multicoques de légende gîtent de 15° (force 3) à 30° (force 7), 30° au plus, flotteur au vent hors de l'eau.
      if (!ud.chavire && !ud.coule && def.etat === undefined) {
        if (def.modele === 'ultim' && force >= 3) ud.lift = 3.2 + 0.08 * Math.min(force, 7);
        const mv = def.modele ? MULTIS_VINTAGE[def.modele] : undefined;
        const demiBau = def.modele === 'ocean_fifty' ? 7.4 : def.modele === 'ultim_ancien' ? 10.5 : mv ? 0.65 * (mv.largeur / 2) * (32 / mv.longueur) : 0;
        if (demiBau && force >= 3) {
          const g = T.MathUtils.degToRad(15 + (Math.min(force, 7) - 3) * 3.75);
          ud.heel = (Math.sign(ud.heel) || 1) * g;
          ud.lift = demiBau * Math.sin(g) * 0.85;
        }
      }
      if (def.vitesse !== undefined) ud.speed = Math.max(2, def.vitesse);
      b.position.set(def.off[0], 0, def.off[1]);
      this.scene.add(b);
      const lab = document.createElement('div');
      lab.className = 'tag' + (def.moi ? ' moi' : '');
      lab.textContent = def.vitesse !== undefined ? `${def.nom} · ${Math.round(def.vitesse)} nds` : def.nom;
      this.labels.appendChild(lab);
      ud.label = lab;
      if (def.perteVoile && ud.voileAvant && !this.reduceMotion) ud.chute = { t0: NaN, heel0: ud.heel, speed0: ud.speed, gerbe: 0 };
      if (def.affalage && ud.voileAvant && !def.perteVoile) ud.affale = this.preparerAffalage(def, ud);
      return b;
    });
    const moi = bateaux.find((b) => b.moi);
    this.orbit.yaw = (moi?.cote ?? 1) > 0 ? -1.15 : 1.15;
    // Recul de la caméra selon la taille du bateau (Ultim de 32 m, Class40 de 12 m).
    const m = moi?.modele;
    const mv = m ? MONOS_VINTAGE[m] ?? MULTIS_VINTAGE[m] : undefined;
    this.orbit.dist = m === 'ultim' || m === 'ultim_ancien' ? 92 : m === 'ocean_fifty' ? 56 : m === 'class40' ? 48 : m === 'pen_duick_3' ? 54 : mv ? 26 + 1.9 * mv.longueur : 62;
  }

  /**
   * Ligne d'arrivée (demande du porteur de projet, 11/11/2026) : une bouée jaune à bâbord, un bateau comité à moteur à
   * tribord, la ligne tendue entre les deux, à `distance` mètres devant le premier bateau. Les bateaux arrivés au même
   * tour se suivent à `espacement` mètres : tous coupent la ligne pendant la scène, le premier désigné en tête.
   */
  ligneArrivee(n: number, distance: number, espacement: number) {
    const g = new T.Group();
    const demi = 30 + 14 * Math.ceil((n - 1) / 2);
    const z = -Math.max(25, distance);
    // Bouée jaune (flotteur, fût conique, voyant)
    const jaune = new T.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.5 });
    const bouee = new T.Group();
    const flotteur = new T.Mesh(new T.CylinderGeometry(1.3, 1.5, 1.2, 20), jaune);
    const fut = new T.Mesh(new T.ConeGeometry(0.9, 3.4, 16), jaune);
    fut.position.y = 2.2;
    const bande = new T.Mesh(new T.CylinderGeometry(1.32, 1.32, 0.35, 20), new T.MeshStandardMaterial({ color: '#e8413c' }));
    bande.position.y = 0.2;
    bouee.add(flotteur, fut, bande);
    bouee.position.set(-demi, 0, z);
    // Bateau comité à moteur : coque blanche, cabine, mât de pavillons, pavillon bleu de fin de course.
    const comite = new T.Group();
    const blanc = new T.MeshStandardMaterial({ color: '#f2f4f6', roughness: 0.6 });
    const coque = new T.Mesh(new T.BoxGeometry(4.2, 1.6, 12), blanc);
    coque.position.y = 0.5;
    const etrave = new T.Mesh(new T.ConeGeometry(2.1, 3.2, 4, 1), blanc);
    etrave.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
    etrave.scale.set(1, 1, 0.55);
    etrave.position.set(0, 0.6, -7.5);
    const cabine = new T.Mesh(new T.BoxGeometry(3.4, 2.2, 4.5), new T.MeshStandardMaterial({ color: '#23476b', roughness: 0.4 }));
    cabine.position.set(0, 2.4, 0.5);
    const mat = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6, 8), new T.MeshStandardMaterial({ color: '#cfd5da' }));
    mat.position.set(0, 5.5, 0.5);
    const pavillon = new T.Mesh(new T.PlaneGeometry(1.8, 1.2), new T.MeshStandardMaterial({ color: '#1f5fbf', side: T.DoubleSide }));
    pavillon.position.set(0, 7.6, 1.4);
    pavillon.rotation.y = Math.PI / 2;
    comite.add(coque, etrave, cabine, mat, pavillon);
    comite.position.set(demi + 2, 0, z);
    // La ligne : un cordon de petits flotteurs orange entre la bouée et le bateau comité.
    const flot = new T.MeshStandardMaterial({ color: '#ff8a1f', roughness: 0.5 });
    const geo = new T.SphereGeometry(0.35, 10, 8);
    const nb = Math.round((2 * demi) / 3);
    for (let i = 1; i < nb; i++) {
      const m = new T.Mesh(geo, flot);
      m.position.set(-demi + (2 * demi * i) / nb, 0, z);
      m.userData.flotteur = true;
      g.add(m);
    }
    g.add(bouee, comite);
    bouee.userData.flotteur = true;
    comite.userData.flotteur = true;
    this.decor = g;
    this.scene.add(g);
    // La caméra recule pour voir toute la file des bateaux qui arrivent.
    // Caméra devant la ligne, un peu sur tribord : on voit les bateaux arriver vers la ligne, bouée et comité de part et
    // d'autre, puis passer entre les deux. Elle recule pour voir toute la file.
    this.orbit.yaw = -2.6;
    this.orbit.pitch = 0.32;
    this.orbit.dist += Math.min(60, espacement * (n - 1) * 0.6);
  }

  demarrer() {
    if (this.raf) return;
    this.clock.getDelta();
    const frame = () => {
      this.raf = requestAnimationFrame(frame);
      this.image();
    };
    this.raf = requestAnimationFrame(frame);
  }

  arreter() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private detruite = false;

  detruire() {
    this.detruite = true;
    this.arreter();
    this.renderer.dispose();
    // Libère vraiment le contexte WebGL : le navigateur n'en accepte qu'une quinzaine à la fois, et un
    // contexte perdu donne une vue 3D vide.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private waveH(x: number, z: number, t: number) {
    let h = 0;
    for (const w of this.vagues) h += w.a * Math.sin((x * w.dx + z * w.dz) * w.k + t * w.w);
    return h;
  }

  /**
   * Perte de la voile d'avant : la voile faseye violemment, la drisse lâche, la têtière tombe,
   * la voile s'affale sous le vent et finit à l'eau, retenue par son point d'amure. Le bateau se redresse
   * et ralentit. Gerbes d'écume à la rupture et quand la voile touche l'eau.
   */
  private animerChute(b: T.Group, ud: Ud, t: number) {
    const c = ud.chute!, va = ud.voileAvant!;
    if (Number.isNaN(c.t0)) c.t0 = t + 1.4; // le bateau navigue d'abord normalement sous voile
    const p = (t - c.t0) / 2.6;
    if (p < 0 || p > 1.8) return;
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    const ease = (x: number) => x * x * (3 - 2 * x);
    const faseyement = p < 0.18 ? p / 0.18 : clamp(1 - (p - 0.18) / 0.55);
    const chute = ease(clamp((p - 0.12) / 0.55));
    const derive = ease(clamp((p - 0.05) / 0.7));
    const eau = 0.15 - ud.lift;
    const headT = new T.Vector3(va.head.x + va.lee * 5, eau, va.head.z + 9);
    const clewT = new T.Vector3(va.clew.x + va.lee * 7.5, eau, va.clew.z + 12);
    const head = va.head.clone().lerp(headT, chute);
    const clew = va.clew.clone().lerp(clewT, derive);
    const g = sailGeometry(va.tack, head, clew, va.camber * (1 - chute) + 0.02, va.lee, 16, 20);
    const pos = g.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length / 3; i++) {
      const u = (i % 17) / 16, v = Math.floor(i / 17) / 20;
      const amp = faseyement * 0.7 * u * (0.4 + v);
      pos[i * 3] += amp * Math.sin(t * 26 + u * 7 + v * 5);
      pos[i * 3 + 1] += amp * 0.4 * Math.sin(t * 19 + u * 5);
      if (chute > 0.9) pos[i * 3 + 1] += 0.08 * Math.sin(t * 2 + u * 4 + v * 3); // la voile ondule sur l'eau
    }
    g.computeVertexNormals();
    va.mesh.geometry.dispose();
    va.mesh.geometry = g;
    (va.mesh.material as T.MeshStandardMaterial).color.copy(va.couleur).multiplyScalar(1 - 0.4 * chute); // toile mouillée
    ud.heel = c.heel0 * (1 - 0.65 * chute);
    ud.speed = c.speed0 * (1 - 0.5 * chute);
    // Gerbes : à la rupture, puis quand la voile frappe l'eau.
    const gerbe = (o: T.Vector3, nb: number) => {
      const w = ud.body.localToWorld(o.clone());
      for (let k = 0; k < nb; k++) this.emettre(w.x + (Math.random() - 0.5) * 3, w.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 1.2 + Math.random());
    };
    if (c.gerbe === 0 && p > 0.15) { gerbe(va.clew, 40); c.gerbe = 1; }
    if (c.gerbe === 1 && chute > 0.85) { gerbe(head, 120); gerbe(clew, 80); c.gerbe = 2; }
    void b;
  }

  /**
   * Prépare l'affalage : la voile plus petite (construite sur un second bateau identique, dont on reprend la voile d'avant,
   * même repère), cachée au départ. Sans animation (mouvement réduit) : le bateau est montré directement
   * sous la petite voile, la grande rangée.
   */
  private preparerAffalage(def: BateauScene, ud: Ud): NonNullable<Ud['affale']> {
    const va = ud.voileAvant!;
    const parent = va.mesh.parent!;
    let nouvelle: NonNullable<Ud['affale']>['nouvelle'] = null;
    try {
      const autre = buildBoat({ ...def, forme: def.affalage!, affalage: undefined, perteVoile: false });
      const v2 = (autre.userData as unknown as Ud).voileAvant;
      if (v2) {
        v2.mesh.removeFromParent();
        v2.mesh.visible = false;
        parent.add(v2.mesh);
        nouvelle = { tack: v2.tack, head: v2.head, clew: v2.clew, camber: v2.camber, lee: v2.lee, mesh: v2.mesh };
      }
      autre.traverse((o) => {
        const m = o as T.Mesh;
        if (m !== v2?.mesh && m.geometry) m.geometry.dispose();
      });
    } catch {
      nouvelle = null;
    }
    // Plus de chaussette sur le pont (porteur de projet, 12/11/2026 : « moche et pas réaliste ») : la toile affalée est
    // ramenée vers l'amure et disparaît.
    const a = { t0: NaN, heel0: ud.heel, speed0: ud.speed, nouvelle };
    ud.affale = a;
    if (this.reduceMotion) this.animerAffalage(ud, 0, 99);
    return a;
  }

  /**
   * Voile inutilisable (demande du porteur de projet, 12/11/2026) : 1) la voile faseye, le bateau ralentit ; 2) la têtière
   * descend le long de l'étai, la toile s'entasse sur l'avant ; 3) elle est rangée (ramenée vers l'amure) ;
   * 4) la voile d'avant plus petite monte le long de l'étai et se gonfle. Le bateau reste presque arrêté (il n'avance pas
   * ce tour-ci).
   */
  private animerAffalage(ud: Ud, t: number, force?: number) {
    const a = ud.affale!, va = ud.voileAvant!;
    if (Number.isNaN(a.t0)) a.t0 = t + 1.2; // le bateau navigue d'abord sous la voile choisie
    const s = force ?? t - a.t0;
    if (s < 0 || (s > 9 && force === undefined)) return;
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    const ease = (x: number) => x * x * (3 - 2 * x);
    const faseye = s < 1.2 ? clamp(s / 0.3) : clamp(1 - (s - 1.2) / 1.6);
    const descente = ease(clamp((s - 1.0) / 2.2));
    const range = ease(clamp((s - 3.4) / 1.0));
    const hisse = ease(clamp((s - 4.8) / 2.4));
    // 1-2) La grande voile faseye puis descend ; elle s'entasse sur l'avant (ni à l'eau ni mouillée).
    if (range < 0.6) {
      const tas = va.tack.clone().add(new T.Vector3(0.3 * va.lee, 0.6, 1.2));
      // La toile affalée est rangée : le tas se resserre vers l'amure.
      const head = va.head.clone().lerp(tas, descente).lerp(va.tack, range);
      const clew = va.clew.clone().lerp(tas.clone().add(new T.Vector3(0.4 * va.lee, 0.2, 2.2)), descente).lerp(tas, range);
      const g = sailGeometry(va.tack, head, clew, va.camber * (1 - descente) + 0.03, va.lee, 16, 20);
      const pos = g.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        const u = (i % 17) / 16, v = Math.floor(i / 17) / 20;
        const amp = faseye * 0.55 * u * (0.4 + v) + descente * 0.25 * Math.sin(u * 9 + v * 7); // plis de la toile affalée
        pos[i * 3] += amp * Math.sin(t * 24 + u * 7 + v * 5);
        pos[i * 3 + 1] += amp * 0.3 * Math.sin(t * 17 + u * 5);
      }
      g.computeVertexNormals();
      va.mesh.geometry.dispose();
      va.mesh.geometry = g;
      va.mesh.visible = true;
    } else va.mesh.visible = false;
    // 4) La voile plus petite monte le long de l'étai.
    const n = a.nouvelle;
    if (n) {
      n.mesh.visible = hisse > 0.01;
      if (n.mesh.visible) {
        const head = n.tack.clone().lerp(n.head, hisse);
        const clew = n.tack.clone().lerp(n.clew, Math.min(1, hisse * 1.15));
        const g = sailGeometry(n.tack, head, clew, n.camber * (0.3 + 0.7 * hisse), n.lee, 14, 18);
        const pos = g.attributes.position.array as Float32Array;
        const f = (1 - hisse) * 0.4;
        for (let i = 0; i < pos.length / 3; i++) pos[i * 3] += f * Math.sin(t * 22 + i * 0.7);
        g.computeVertexNormals();
        n.mesh.geometry.dispose();
        n.mesh.geometry = g;
      }
    }
    // Le bateau se redresse et ralentit presque à l'arrêt ; il reprend un peu d'erre sous la petite voile.
    const arret = clamp(s / 1.5);
    ud.heel = a.heel0 * (1 - 0.7 * arret + 0.35 * hisse);
    ud.speed = Math.max(1.5, a.speed0 * (1 - 0.85 * arret + 0.25 * hisse));
  }

  /** Émet une particule d'écume. vx : vitesse latérale (m/s), vz : vitesse longitudinale. */
  private emettre(x: number, z: number, vx: number, vz: number, vie: number) {
    const i = (this.ecumeI = (this.ecumeI + 1) % NB_ECUME);
    this.ecumePos[i * 3] = x;
    this.ecumePos[i * 3 + 2] = z;
    this.ecumeVit[i * 2] = vx;
    this.ecumeVit[i * 2 + 1] = vz;
    this.ecumeAge[i] = 0;
    this.ecumeVie[i] = vie;
  }

  private image() {
    const w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (!w || !h) return;
    const canvas = this.renderer.domElement;
    if (canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.reduceMotion ? 0 : this.clock.elapsedTime;
    const lead = this.fleet.find((b) => (b.userData as unknown as Ud).def.moi) ?? this.fleet[0];
    if (!lead) return;
    const lud = lead.userData as unknown as Ud;
    const ms = (n: number) => n * 0.514; // nœuds → m/s
    if (!this.reduceMotion) lead.position.z -= ms(lud.speed) * dt;
    const amp = Math.max(0.3, this.mer.haut);
    if (this.decor) for (const o of this.decor.children) if (o.userData.flotteur) o.position.y = this.waveH(o.position.x, o.position.z, t) * 0.8;
    for (const b of this.fleet) {
      const ud = b.userData as unknown as Ud;
      if (b !== lead) {
        // Les concurrents gardent leur écart, à leur propre vitesse relative.
        ud.def.off[1] += (ms(lud.speed) - ms(ud.speed)) * dt * 0.15;
        b.position.x = ud.def.off[0] + lead.position.x;
        b.position.z = lead.position.z + ud.def.off[1];
      }
      const hh = this.waveH(b.position.x, b.position.z, t);
      const hf = this.waveH(b.position.x, b.position.z - 7, t), ha = this.waveH(b.position.x, b.position.z + 7, t);
      const hl = this.waveH(b.position.x - 2.5, b.position.z, t), hr = this.waveH(b.position.x + 2.5, b.position.z, t);
      b.position.y = hh * 0.8 + ud.lift - (ud.coule ? Math.min(3.4, 1.2 + 0.18 * ((t * 0.6) % 14)) : 0);
      // Tangage et roulis suivent la pente des vagues : plus la mer est forte, plus le bateau bouge.
      ud.body.rotation.set(ud.trim + Math.atan2(hf - ha, 14) * 0.9 + (ud.coule ? -0.38 : 0), 0, ud.heel + Math.atan2(hr - hl, 5) * 0.25 + 0.02 * Math.sin(t * 1.3 + ud.phase) + (ud.coule ? 1.05 : 0) + (ud.chavire ? Math.PI : 0), 'YXZ');
      if (ud.chute) this.animerChute(b, ud, this.clock.elapsedTime);
      if (ud.affale && !this.reduceMotion) this.animerAffalage(ud, this.clock.elapsedTime);
      if (!this.reduceMotion) {
        const v = ms(ud.speed);
        // Sillage : écume qui reste en place derrière le tableau arrière.
        const nSillage = Math.round(2 + v * 0.6);
        for (let n = 0; n < nSillage; n++)
          this.emettre(b.position.x + (Math.random() - 0.5) * 3.2, b.position.z + L / 2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8, 0, 5 + v * 0.35);
        // Vague d'étrave (« moustache ») : écume projetée de part et d'autre de l'étrave.
        const nEtrave = Math.round(2 + v * 0.9);
        for (let n = 0; n < nEtrave; n++) {
          const cote = n % 2 ? 1 : -1;
          this.emettre(b.position.x + cote * (0.8 + Math.random() * 1.2), b.position.z - L / 2 + 3 + Math.random() * 5, cote * (1.5 + v * 0.45), v * 0.25, 1.8 + v * 0.08);
        }
      }
    }
    // Particules d'écume
    const blanc = new T.Color(1, 1, 1), merC = new T.Color(this.mer.mer);
    for (let i = 0; i < NB_ECUME; i++) {
      if (this.ecumeAge[i] > this.ecumeVie[i]) {
        this.ecumePos[i * 3 + 1] = -50;
        continue;
      }
      this.ecumeAge[i] += dt;
      this.ecumePos[i * 3] += this.ecumeVit[i * 2] * dt;
      this.ecumePos[i * 3 + 2] += this.ecumeVit[i * 2 + 1] * dt;
      this.ecumeVit[i * 2] *= 0.985;
      const k = Math.min(1, this.ecumeAge[i] / this.ecumeVie[i]);
      this.ecumeCol[i * 3] = blanc.r + (merC.r - blanc.r) * k;
      this.ecumeCol[i * 3 + 1] = blanc.g + (merC.g - blanc.g) * k;
      this.ecumeCol[i * 3 + 2] = blanc.b + (merC.b - blanc.b) * k;
      this.ecumePos[i * 3 + 1] = this.waveH(this.ecumePos[i * 3], this.ecumePos[i * 3 + 2], t) + 0.45;
    }
    this.ecumeGeo.attributes.position.needsUpdate = true;
    this.ecumeGeo.attributes.color.needsUpdate = true;

    // Mer : vagues et moutons d'écume sur les crêtes (à partir de force 4)
    const p = lead.position;
    this.sea.position.set(Math.round(p.x / 5) * 5, 0, Math.round(p.z / 5) * 5);
    const arr = this.seaGeo.attributes.position.array as Float32Array;
    const base = new T.Color(this.mer.mer);
    for (let i = 0, j = 0; i < arr.length; i += 3, j++) {
      const wx = this.seaBase[i] + this.sea.position.x, wz = this.seaBase[i + 2] + this.sea.position.z;
      const hv = this.waveH(wx, wz, t);
      arr[i + 1] = hv;
      // Moutons : seulement sur le haut des crêtes, en traînées irrégulières.
      const crete = Math.max(0, (hv / amp - 0.42) / 0.18);
      const motif = Math.max(0, Math.sin(wx * 0.37 + wz * 0.21) * Math.sin(wx * 0.11 - wz * 0.43) * Math.sin(wx * 0.9 + wz * 0.05));
      const e = Math.min(0.85, crete * this.mer.ecume * motif * 1.6);
      this.seaCol[j * 3] = base.r + (0.92 - base.r) * e;
      this.seaCol[j * 3 + 1] = base.g + (0.95 - base.g) * e;
      this.seaCol[j * 3 + 2] = base.b + (0.97 - base.b) * e;
    }
    this.seaGeo.attributes.position.needsUpdate = true;
    this.seaGeo.attributes.color.needsUpdate = true;
    this.seaGeo.computeVertexNormals();
    const o = this.orbit;
    const focus = new T.Vector3(p.x, 10, p.z);
    this.camera.position.set(focus.x + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw), focus.y + Math.max(o.dist * Math.sin(o.pitch), amp + 4), focus.z + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw));
    this.camera.lookAt(focus);
    for (const o of this.nuages.children) {
      if (!o.visible) continue;
      const u = o.userData;
      if (!this.reduceMotion) u.a += (dt * this.ventNuages) / u.rayon; // les nuages défilent avec le vent
      o.position.set(p.x + Math.cos(u.a) * u.rayon, u.y, p.z + Math.sin(u.a) * u.rayon);
    }
    this.sun.position.set(p.x - 80, 120, p.z + 60);
    this.sun.target.position.copy(p);
    for (const b of this.fleet) {
      const ud = b.userData as unknown as Ud;
      const v = new T.Vector3(b.position.x, ud.deckY + MAST_H + 3, b.position.z).project(this.camera);
      const lab = ud.label!;
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
        lab.style.display = 'none';
        continue;
      }
      lab.style.display = 'block';
      lab.style.transform = `translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px) translate(-50%,-100%)`;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
