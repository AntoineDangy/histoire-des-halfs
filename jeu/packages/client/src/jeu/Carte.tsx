import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { centreTraine, compilerCarte, course as courseJouee, navigable, NOMS_DIR, norm, terreFine, vecteur } from '@cal/engine';
import type { Case, EtatPartie, Front } from '@cal/engine';
import traceRhum from '@cal/data/courses/route-du-rhum-trace.json';
import traceCafeLor from '@cal/data/courses/transat-cafe-lor-trace.json';
import traceFastnet from '@cal/data/courses/rolex-fastnet-trace.json';
import traceVendee from '@cal/data/courses/vendee-globe-trace.json';
import traceArkea from '@cal/data/courses/arkea-ultim-challenge-trace.json';
import { D, skipper, posExacte } from '../commun';

// Vue globe des tours du monde (12/11/2026) : chargée seulement quand on l'ouvre.
const Globe = lazy(() => import('./Globe'));

export interface PropsCarte {
  etat: EtatPartie;
  /** Positions affichées (éventuellement en cours d'animation), en cases. */
  positions: Record<string, [number, number]>;
  trajectoire: { chemin: Case[]; caseBloquante: Case | null; louvoyage?: boolean; sommets?: [number, number][] } | null;
  /** Traces coupées pendant la lecture d'un tour : n premiers points, puis les points déjà parcourus (11/11/2026). */
  coupes?: Record<string, { n: number; pts: [number, number][] }>;
  moiId: string | null;
  centrer: number;
  noms: Record<string, string>;
  /** Lecture d'un tour en cours (les bateaux se déplacent) : sur les tours du monde, le globe s'affiche seul. */
  lecture?: boolean;
  /** Fronts et anticyclones affichés pendant la lecture d'un tour : ils glissent en même temps que les bateaux (14/11/2026). */
  fronts?: Front[];
  /** Décision en cours (rose des caps autour du bateau) : la carte ramène le bateau à l'écran s'il en est sorti. */
  enChoix?: boolean;
  /**
   * Réglage de la distance sur la carte (essai d'interface du 12/11/2026) : trajet complet de la voile choisie (coordonnées
   * de carte, centres des cases), repères à chaque case, poignée à faire glisser.
   */
  reglageDistance?: { trajet: [number, number][]; reperes: [number, number][]; max: number; valeur: number; choisir: (d: number) => void } | null;
  /** Boussole : caps possibles ; une touche sur la couronne choisit le cap le plus proche. */
  roseCaps?: RoseCarte | null;
}

/** Caps de la boussole, choisis d'une touche sur la couronne (chaque cap a toute sa part du cercle, même avec 32 caps). */
export interface RoseCarte {
  caps: number[];
  choisir: (c: number) => void;
  survoler: (c: number | null) => void;
  nom: (c: number) => string;
  /**
   * Destination visée d'une touche sur la mer (13/11/2026, demande du porteur de projet) : coordonnées de carte en cases
   * (le centre d'une case est à +0,5). La carte trace la ligne de visée et montre si la route est libre ou bloquée.
   */
  destination?: [number, number] | null;
  viser?: (pt: [number, number]) => void;
  /** Cap choisi en ce moment (la poignée de distance tourne autour du bateau à partir de lui, 13/11/2026). */
  cap?: number | null;
}

// Esprit « cartographie des grandes courses » : océan bleu profond, terres claires, traces colorées par la vitesse.
const C = {
  ocean1: '#173a5c', ocean2: '#1f4a70', graticule: 'rgba(255,255,255,0.07)', terre: '#efe7d1', terreBord: '#c9b78c',
  texteMer: 'rgba(225,238,250,0.85)', texteTerre: '#6b5d3f', accent: '#3dd6f5', orange: '#ff9f43', jaune: '#ffd400', danger: '#ff5a5f',
};
const VITESSES = [
  [0, [77, 163, 255]], [5, [61, 214, 245]], [8, [60, 203, 127]], [11, [245, 200, 66]], [14, [255, 159, 67]], [18, [255, 90, 95]],
] as const;

function couleurVitesse(v: number) {
  for (let i = 1; i < VITESSES.length; i++) {
    const [v1, c1] = VITESSES[i];
    const [v0, c0] = VITESSES[i - 1];
    if (v <= v1) {
      const t = Math.max(0, (v - v0) / (v1 - v0));
      return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(255,90,95)';
}

type Trace = { cotes: number[][]; orthodromie: number[] };
const TRACES: Record<string, Trace> = { 'route-du-rhum': traceRhum as Trace, 'transat-cafe-lor': traceCafeLor as Trace, 'rolex-fastnet': traceFastnet as Trace, 'vendee-globe': traceVendee as Trace, 'arkea-ultim-challenge': traceArkea as Trace };

export default function Carte({ etat, positions, trajectoire, moiId, centrer, noms, coupes, lecture, enChoix, reglageDistance, roseCaps, fronts }: PropsCarte) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Calque posé sur le bateau du joueur : la rose des caps y est affichée (TableauBord.tsx, par createPortal).
  const calqueRef = useRef<HTMLDivElement>(null);
  /** Poignée de distance, en pixels d'écran : trajet complet et nombre de cases (pour la saisie au doigt ou à la souris). */
  /** Centre de la boussole à l'écran (pixels du canevas), pour la faire ressortir au survol de la souris. */
  const roseEcran = useRef<{ x: number; y: number } | null>(null);
  const poigneeRef = useRef<{ pts: [number, number][]; reperes: [number, number][]; choisir: (d: number) => void } | null>(null);
  const [globe, setGlobe] = useState(false);
  // Zoom du globe (12/11/2026) : les boutons + et − agissent sur le globe quand il est ouvert.
  const zoomGlobe = useRef<((f: number) => void) | null>(null);
  const vue = useRef({ s: 8, ox: 0, oy: 0, init: false, min: 3 });
  const propsRef = useRef<PropsCarte>({ etat, positions, trajectoire, moiId, centrer, noms });
  propsRef.current = { etat, positions, trajectoire, moiId, centrer, noms, coupes, reglageDistance, roseCaps, fronts };
  const globeVisible = useRef(false);
  // Parcours de la classe jouée (marques obligatoires propres à chaque classe).
  const course = courseJouee(D, etat);
  const carte = compilerCarte(course);
  const { cotes, orthodromie: ortho } = TRACES[course.id] ?? TRACES['route-du-rhum'];
  const pr = course.projection!;
  globeVisible.current = globe || (!!lecture && !!course.distance_reelle);
  const RAD = Math.PI / 180;
  const cellRad = ((pr.lon_max - pr.lon_min) * RAD) / carte.L;
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  const projX = (lon: number) => ((lon - pr.lon_min) * RAD) / cellRad;
  const projY = (lat: number) => (merc(pr.lat_max) - merc(lat)) / cellRad;

  const dessiner = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const v = vue.current;
    if (!v.init && w > 0) {
      // Zoom minimum : 3 px par case, ou moins si la carte entière ne tient pas (carte du monde, 410 cases de large).
      v.min = Math.min(3, w / carte.L, h / carte.H);
      v.s = Math.max(v.min, Math.min(w / carte.L, h / carte.H));
      v.ox = (w - carte.L * v.s) / 2;
      v.oy = (h - carte.H * v.s) / 2;
      v.init = true;
    }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fond = g.createLinearGradient(0, 0, w, h);
    fond.addColorStop(0, C.ocean2);
    fond.addColorStop(1, C.ocean1);
    g.fillStyle = fond;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(v.ox, v.oy);
    const s = v.s;
    const P = propsRef.current;
    const X = (x: number) => x * s;
    const Y = (y: number) => y * s;

    // Graticule (tous les 5°)
    g.strokeStyle = C.graticule;
    g.lineWidth = 1;
    g.beginPath();
    for (let lon = Math.ceil(pr.lon_min / 5) * 5; lon <= pr.lon_max; lon += 5) {
      g.moveTo(X(projX(lon)), 0);
      g.lineTo(X(projX(lon)), Y(carte.H));
    }
    for (let lat = Math.ceil(pr.lat_min / 5) * 5; lat <= pr.lat_max; lat += 5) {
      g.moveTo(0, Y(projY(lat)));
      g.lineTo(X(carte.L), Y(projY(lat)));
    }
    g.stroke();

    // Zones météo et zones interdites
    for (const z of course.zones_meteo) {
      const [x0, y0, x1, y1] = z.rect;
      const RX = X(x0), RY = Y(y0), RW = (x1 - x0 + 1) * s, RH = (y1 - y0 + 1) * s;
      if (z.type === 'alize') {
        g.fillStyle = 'rgba(61,214,245,0.07)';
        g.strokeStyle = 'rgba(61,214,245,0.5)';
        g.setLineDash([7, 6]);
        arrondi(g, RX, RY, RW, RH, 10);
        g.fill();
        g.stroke();
        g.setLineDash([]);
        g.strokeStyle = 'rgba(160,230,250,0.45)';
        g.lineWidth = 1.4;
        const pas = Math.max(5, Math.round(48 / s));
        for (let y = y0 + 2; y < y1; y += pas)
          // Flèche dans le sens où souffle le vent de la zone (nord-est → vers le sud-ouest ; sud-est → vers le nord-ouest).
          for (let x = x0 + 3 + ((y / pas) % 2) * (pas / 2); x < x1; x += pas) fleche(g, X(x), Y(y), norm((z.vent_regulier?.depart.direction ?? 2) + 8), Math.max(10, s * 2.2));
        g.lineWidth = 1;
        texte(g, z.texte ?? z.nom, RX + 10, RY + 18, C.accent, 12, 700);
      } else if (z.type === 'pot_au_noir') {
        // Pot-au-noir : bande sombre et orageuse, grains dessinés au hasard (toujours les mêmes), éclairs.
        g.save();
        g.fillStyle = 'rgba(20,24,40,0.45)';
        g.strokeStyle = 'rgba(255,211,77,0.55)';
        g.setLineDash([3, 5]);
        arrondi(g, RX, RY, RW, RH, 14);
        g.fill();
        g.stroke();
        g.setLineDash([]);
        let graine = 7;
        const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
        const n = Math.max(6, Math.round((RW * RH) / 9000));
        for (let k = 0; k < n; k++) {
          const cx = RX + RW * (0.05 + 0.9 * hasard()), cy = RY + RH * (0.15 + 0.7 * hasard()), r = Math.max(5, s * (0.8 + 1.4 * hasard()));
          const grad = g.createRadialGradient(cx, cy, 1, cx, cy, r * 1.6);
          grad.addColorStop(0, 'rgba(90,100,125,0.75)');
          grad.addColorStop(1, 'rgba(90,100,125,0)');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
          g.fill();
          if (k % 3 === 0) texte(g, '⚡', cx - 5, cy + 4, '#ffd34d', Math.max(10, Math.min(16, s * 1.4)), 700);
        }
        texte(g, z.texte ?? 'POT-AU-NOIR', RX + 10, RY + 18, '#ffd34d', 12, 700);
        g.restore();
      } else if (z.type === 'brume') {
        const grad = g.createRadialGradient(RX + RW / 2, RY + RH / 2, 2, RX + RW / 2, RY + RH / 2, Math.max(RW, RH) / 1.4);
        grad.addColorStop(0, 'rgba(220,230,240,0.35)');
        grad.addColorStop(1, 'rgba(220,230,240,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(RX + RW / 2, RY + RH / 2, RW / 1.3, RH / 1.3, 0, 0, Math.PI * 2);
        g.fill();
        texte(g, 'Brume', RX + RW / 2 - 15, RY + RH / 2 + 4, '#e9f0f6', 11, 600);
      } else if (z.type === 'courant') {
        g.strokeStyle = 'rgba(170,225,255,0.55)';
        g.lineWidth = 1.3;
        const pas = Math.max(3, Math.round(30 / s));
        for (let y = y0 + 1; y <= y1; y += pas) for (let x = x0; x <= x1; x += pas) fleche(g, X(x + 0.5), Y(y + 0.5), z.direction ?? 0, Math.max(8, s * 1.6));
        g.lineWidth = 1;
        texte(g, z.texte ?? z.nom, RX, RY - 5, '#bfe6ff', 11, 600);
      } else if (z.type === 'zone_interdite') {
        g.save();
        g.beginPath();
        g.rect(RX, RY, RW, RH);
        g.clip();
        g.strokeStyle = 'rgba(255,90,95,0.7)';
        for (let k = -RH; k < RW; k += 5) {
          g.beginPath();
          g.moveTo(RX + k, RY + RH);
          g.lineTo(RX + k + RH, RY);
          g.stroke();
        }
        g.restore();
        g.strokeStyle = C.danger;
        g.strokeRect(RX, RY, RW, RH);
        if (s > 5) texte(g, z.nom, RX + RW + 4, RY + RH / 2 + 4, '#ffb3b5', 10, 600);
      }
    }

    // Fronts météo : zone de gros vent, traîne derrière, et trajectoire annoncée en pointillés.
    for (const f of P.fronts ?? P.etat.fronts ?? []) {
      const ellipse = (cx: number, cy: number) => {
        g.beginPath();
        // Molle dessinée d'une course (13/11/2026) : contour lissé (courbes passant par le milieu de chaque côté).
        if (f.contour) {
          const p = f.contour, n = p.length, mil = (i: number) => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
          g.moveTo(X(mil(0)[0]), Y(mil(0)[1]));
          for (let i = 1; i <= n; i++) g.quadraticCurveTo(X(p[i % n][0]), Y(p[i % n][1]), X(mil(i)[0]), Y(mil(i)[1]));
          g.closePath();
        } else g.ellipse(X(cx), Y(cy), f.rx * s, f.ry * s, 0, 0, Math.PI * 2);
      };
      if (f.type === 'anticyclone') {
        ellipse(f.x, f.y);
        g.fillStyle = f.annonce > 0 ? 'rgba(120,170,255,0.06)' : 'rgba(120,170,255,0.14)';
        g.fill();
        g.setLineDash(f.annonce > 0 ? [8, 7] : [2, 4]);
        g.strokeStyle = 'rgba(150,190,255,0.8)';
        g.stroke();
        g.setLineDash([]);
        texte(g, 'A', X(f.x) - 6, Y(f.y) + 7, '#cfe0ff', 22, 800, true);
        texte(g, f.annonce > 0 ? `Anticyclone annoncé : dans ${f.annonce} tour${f.annonce > 1 ? 's' : ''}` : f.nom ? `${f.nom} : calme au centre` : 'Anticyclone : calme au centre', X(f.x - f.rx), Y(f.y - f.ry - 0.3), '#cfe0ff', 12, 700, true);
        continue;
      }
      if (f.type === 'molle') {
        ellipse(f.x, f.y);
        g.fillStyle = 'rgba(255,226,166,0.16)';
        g.fill();
        g.setLineDash([3, 5]);
        g.strokeStyle = 'rgba(255,226,166,0.7)';
        g.stroke();
        g.setLineDash([]);
        texte(g, `Molle : F${f.force}, vent instable`, X(f.x - f.rx), Y(f.y - f.ry - 0.3), '#ffe2a6', 12, 700, true);
        continue;
      }
      if (f.annonce > 0) {
        g.setLineDash([8, 7]);
        g.lineWidth = 2;
        for (let k = 0; k <= f.annonce; k++) {
          g.strokeStyle = k === f.annonce ? 'rgba(255,110,110,0.9)' : 'rgba(255,110,110,0.35)';
          ellipse(f.x + f.vx * k, f.y + f.vy * k);
          g.stroke();
        }
        g.setLineDash([]);
        g.lineWidth = 1;
        texte(g, `Front annoncé : dans ${f.annonce} tour${f.annonce > 1 ? 's' : ''} ici`, X(f.x + f.vx * f.annonce - f.rx * 0.8), Y(f.y + f.vy * f.annonce), '#ffb3b5', 12, 700, true);
        continue;
      }
      const [tx, ty] = centreTraine(f);
      ellipse(tx, ty);
      g.fillStyle = 'rgba(160,200,255,0.10)';
      g.fill();
      g.setLineDash([4, 6]);
      g.strokeStyle = 'rgba(160,200,255,0.5)';
      g.stroke();
      g.setLineDash([]);
      texte(g, `Traîne : ${NOMS_DIR[norm(f.direction + f.bascule)]} F${Math.max(1, f.force - f.baisse)}`, X(tx - f.rx * 0.6), Y(ty), '#cfe3ff', 12, 700, true);
      const grad = g.createRadialGradient(X(f.x), Y(f.y), 2, X(f.x), Y(f.y), Math.max(f.rx, f.ry) * s);
      grad.addColorStop(0, 'rgba(40,30,70,0.55)');
      grad.addColorStop(1, 'rgba(40,30,70,0.15)');
      ellipse(f.x, f.y);
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(255,110,110,0.85)';
      g.lineWidth = 2;
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      for (let k = -1; k <= 1; k++) fleche(g, X(f.x + k * f.rx * 0.4), Y(f.y + k * f.ry * 0.3), norm(f.direction + 8), 22);
      texte(g, `⛈ Front : ${NOMS_DIR[f.direction]} F${f.force}`, X(f.x - f.rx * 0.5), Y(f.y - f.ry * 0.55), '#ffd0d0', 13, 700, true);
    }

    // Plus de parcours obligatoire en pointillés jaunes (12/11/2026, demande du porteur de projet) : route directe blanche partout.
    {
      // Orthodromie (route directe)
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < ortho.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, X(ortho[i]), Y(ortho[i + 1]));
      g.stroke();
    }

    // Côtes. Carte du monde : dessinées seulement dans le cadre du jeu (sinon l'Arctique et les copies du monde débordent).
    if (course.distance_reelle) {
      g.save();
      g.beginPath();
      g.rect(0, 0, carte.L * s, carte.H * s);
      g.clip();
    }
    g.fillStyle = C.terre;
    g.strokeStyle = C.terreBord;
    g.lineWidth = 1;
    g.beginPath();
    for (const morceau of cotesDecoupees(cotes)) {
      g.moveTo(X(morceau[0]), Y(morceau[1]));
      for (let i = 2; i < morceau.length; i += 2) g.lineTo(X(morceau[i]), Y(morceau[i + 1]));
      g.closePath();
    }
    g.fill('evenodd');
    g.stroke();
    if (course.distance_reelle) g.restore();

    // Arrivée (12/11/2026, porteur de projet) : un seul point jaune à damier, fondu sur les bords, qui couvre la zone d'arrivée.
    {
      const cases = course.portes[course.portes.length - 1].cases;
      const but = course.lieux?.find((l) => l.type === 'arrivee');
      const [cx, cy] = course.centre_arrivee ? course.centre_arrivee : but ? [but.x, but.y] : [cases.reduce((a, p) => a + p[0] + 0.5, 0) / cases.length, cases.reduce((a, p) => a + p[1] + 0.5, 0) / cases.length];
      // Rayon : jusqu'au centre de la case d'arrivée la plus éloignée (12/11/2026 : plus de cercle plus grand que l'île).
      const rc = Math.max(0.6, ...cases.map(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy)));
      const px = X(cx), py = Y(cy), r = rc * s;
      const t = Math.max(4, r / 3);
      g.save();
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.clip();
      for (let i = -5; i < 5; i++)
        for (let j = -5; j < 5; j++) {
          g.fillStyle = (i + j) % 2 ? 'rgba(255,211,77,0.4)' : 'rgba(20,20,20,0.22)';
          g.fillRect(px + i * t, py + j * t, t, t);
        }
      // Fondu : le damier s'efface vers le bord.
      g.globalCompositeOperation = 'destination-out';
      const fondu = g.createRadialGradient(px, py, r * 0.15, px, py, r);
      fondu.addColorStop(0, 'rgba(0,0,0,0)');
      fondu.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = fondu;
      g.fillRect(px - r, py - r, 2 * r, 2 * r);
      g.restore();
    }

    // Marques obligatoires du parcours : une ligne à franchir, en pointillés (estompée une fois passée par le joueur).
    const moiMarque = P.etat.bateaux.find((b) => b.id === P.moiId) ?? P.etat.bateaux.find((b) => b.type === 'humain');
    course.portes.forEach((p, k) => {
      if (p.type !== 'marque' || !p.cases.length || p.cachee) return;
      // Une marque suivie de contrôles invisibles (tour du Fastnet) n'est cochée qu'une fois le tour complet.
      let fin = k;
      while (course.portes[fin + 1]?.cachee) fin++;
      const passee = !!moiMarque && moiMarque.porte > fin;
      const pts = p.cases.map(([x, y]) => [X(x + 0.5), Y(y + 0.5)]);
      g.save();
      g.globalAlpha = passee ? 0.35 : 1;
      if (p.cardinale === 'nord') {
        // Bouée cardinale nord (12/11/2026) : noire en haut, jaune en bas, deux cônes noirs pointe en haut ; on passe au nord.
        const [bx, by] = p.position ? [X(p.position[0]), Y(p.position[1])] : pts[0];
        const h = Math.max(16, Math.min(30, s * 2.2));
        g.lineWidth = 1.2;
        g.strokeStyle = '#1a1a1a';
        g.fillStyle = '#ffd34d';
        g.fillRect(bx - h * 0.18, by - h * 0.45, h * 0.36, h * 0.45);
        g.strokeRect(bx - h * 0.18, by - h * 0.45, h * 0.36, h * 0.45);
        g.fillStyle = '#1a1a1a';
        g.fillRect(bx - h * 0.18, by - h * 0.85, h * 0.36, h * 0.4);
        g.beginPath();
        g.moveTo(bx - h * 0.16, by - h * 1.02); g.lineTo(bx, by - h * 1.2); g.lineTo(bx + h * 0.16, by - h * 1.02);
        g.moveTo(bx - h * 0.16, by - h * 1.24); g.lineTo(bx, by - h * 1.42); g.lineTo(bx + h * 0.16, by - h * 1.24);
        g.fill();
        g.fillRect(bx - 1, by - h * 1.25, 2, h * 0.42);
        texte(g, `${passee ? '✓ ' : ''}${p.nom}`, bx + h * 0.4, by - h * 0.5, '#ffd34d', Math.max(11, Math.min(15, s * 1.3)), 600, true);
        g.restore();
        return;
      }
      if (p.bouee) {
        // Bouée : flotteur jaune à bande rouge, voyant, nom à côté.
        const [bx, by] = pts[0];
        const h = Math.max(14, Math.min(26, s * 2));
        g.fillStyle = '#ffd34d';
        g.strokeStyle = '#1a1a1a';
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(bx, by, h * 0.42, h * 0.16, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(bx - h * 0.3, by);
        g.lineTo(bx - h * 0.18, by - h * 0.8);
        g.lineTo(bx + h * 0.18, by - h * 0.8);
        g.lineTo(bx + h * 0.3, by);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = '#e8413c';
        g.fillRect(bx - h * 0.24, by - h * 0.5, h * 0.48, h * 0.18);
        g.fillStyle = '#1a1a1a';
        g.beginPath();
        g.moveTo(bx - h * 0.14, by - h * 0.8);
        g.lineTo(bx, by - h * 1.05);
        g.lineTo(bx + h * 0.14, by - h * 0.8);
        g.fill();
        g.fillStyle = '#ffd34d';
        g.font = `600 ${Math.max(11, Math.min(15, s * 1.3))}px system-ui, sans-serif`;
        g.fillText(`${passee ? '✓ ' : ''}${p.nom}`, bx + h * 0.6, by - h * 0.3);
        g.restore();
        return;
      }
      // Ligne de passage : plus de pointillés jaunes (12/11/2026, demande du porteur de projet), seulement le nom de la marque.
      g.fillStyle = '#ffd34d';
      g.font = `600 ${Math.max(11, Math.min(15, s * 1.3))}px system-ui, sans-serif`;
      g.fillText(`${passee ? '✓ ' : '⚑ '}${p.nom}`, pts[0][0] + 8, pts[0][1] + 4);
      g.restore();
    });

    // Lieux
    for (const l of course.lieux ?? []) {
      const lx = X(l.x), ly = Y(l.y);
      if (l.type === 'arrivee') {
        g.fillStyle = C.orange;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx, ly - 16);
        g.lineTo(lx + 11, ly - 12);
        g.lineTo(lx, ly - 8);
        g.fill();
        g.strokeStyle = C.orange;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx, ly - 16);
        g.stroke();
        texte(g, l.nom, lx + 14, ly - 4, '#ffffff', 13, 700, true);
      } else if (l.type === 'depart') {
        g.fillStyle = C.jaune;
        g.beginPath();
        g.arc(lx, ly, 4.5, 0, Math.PI * 2);
        g.fill();
        texte(g, l.nom, lx + 8, ly + 4, '#ffffff', 13, 700, true);
      } else if (l.type === 'port') {
        if (s < 5) continue;
        texte(g, '⚓', lx - 6, ly + 5, '#ffffff', 12, 400);
      } else {
        texte(g, l.nom, lx, ly, C.texteMer, 12, 600);
      }
    }

    // Traces des bateaux (couleur = vitesse pour le joueur, couleur du bateau pour les autres)
    const sensMarche = new Map<string, number>();
    for (const b of P.etat.bateaux) {
      const cp = P.coupes?.[b.id];
      const pts = cp
        ? [...b.trace.slice(0, cp.n).map(([x, y, d]) => [x, y, d]), ...cp.pts.map(([x, y]) => [x, y, b.distanceDernierTour])]
        : [...b.trace.map(([x, y, d]) => [x, y, d])];
      const p = P.positions[b.id];
      const pc = p ?? posExacte(b);
      if (b.id !== P.moiId && P.moiId && carte.zones[Math.floor(pc[1] + 0.5) * carte.L + Math.floor(pc[0] + 0.5)]?.includes('brume')) continue; // trace cachée dans la brume
      if (p && (p[0] !== b.x || p[1] !== b.y || pts.length === 0)) pts.push([p[0], p[1], b.distanceDernierTour]);
      // Le bateau est dessiné dans le sens réel de sa marche : direction du dernier tronçon de sa trace (11/11/2026).
      for (let i = pts.length - 1; i > 0; i--) {
        const dx = (pts[i][0] as number) - (pts[i - 1][0] as number), dy = (pts[i][1] as number) - (pts[i - 1][1] as number);
        if (Math.hypot(dx, dy) > 0.05) { sensMarche.set(b.id, Math.atan2(dy, dx)); break; }
      }
      if (pts.length < 2) continue;
      const moi = b.id === P.moiId || b.type === 'humain';
      g.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        g.strokeStyle = moi ? couleurVitesse(pts[i][2] as number) : skipper(b.skipperId).couleurs.pion;
        g.globalAlpha = moi ? 1 : 0.55;
        g.lineWidth = moi ? 3 : 2;
        g.beginPath();
        g.moveTo(X(pts[i - 1][0] + 0.5), Y(pts[i - 1][1] + 0.5));
        g.lineTo(X(pts[i][0] + 0.5), Y(pts[i][1] + 0.5));
        g.stroke();
      }
      g.globalAlpha = 1;
      g.lineCap = 'butt';
    }

    // Trajectoire prévisionnelle
    const moi = P.moiId ? P.etat.bateaux.find((b) => b.id === P.moiId) : null;
    // Distance réglable sur la carte : seule la jauge (poignée) est montrée, pas la case d'arrivée calculée, pour ne pas
    // donner deux informations qui se contredisent (demande du porteur de projet, 12/11/2026).
    const jauge = !!(P.reglageDistance && P.reglageDistance.trajet.length > 1 && P.reglageDistance.max > 1);
    if (P.trajectoire && moi && !jauge) {
      const p0 = P.positions[moi.id] ?? [moi.x, moi.y];
      g.strokeStyle = '#ffffff';
      g.setLineDash([4, 5]);
      g.lineWidth = 2;
      g.beginPath();
      // Ligne droite du bateau au point d'arrivée prévu (le quadrillage reste invisible).
      const finT = P.trajectoire.chemin[P.trajectoire.chemin.length - 1];
      const ax = X(p0[0] + 0.5), ay = Y(p0[1] + 0.5);
      g.moveTo(ax, ay);
      if (finT && P.trajectoire.sommets && P.trajectoire.sommets.length > 1) {
        // Le trajet que le bateau suivra vraiment (bords de louvoyage par la mer, dérive du courant), calculé par le moteur.
        for (const [sx, sy] of P.trajectoire.sommets.slice(1)) g.lineTo(X(sx), Y(sy));
      } else if (finT) g.lineTo(X(finT[0] + 0.5), Y(finT[1] + 0.5));
      g.stroke();
      g.setLineDash([]);
      const fin = P.trajectoire.chemin[P.trajectoire.chemin.length - 1];
      if (fin) {
        g.beginPath();
        g.arc(X(fin[0] + 0.5), Y(fin[1] + 0.5), 6, 0, Math.PI * 2);
        g.stroke();
      }
      if (P.trajectoire.caseBloquante) {
        const [x, y] = P.trajectoire.caseBloquante;
        const cx = X(x + 0.5), cy = Y(y + 0.5), r = Math.max(5, s * 0.5);
        g.strokeStyle = C.danger;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r);
        g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r);
        g.stroke();
      }
      g.lineWidth = 1;
    }

    // Réglage de la distance : trajet complet de la voile en pointillés pâles, un repère par case, poignée au bout du trajet retenu.
    poigneeRef.current = null;
    const R = P.reglageDistance;
    if (R && moi && jauge) {
      const pts = R.trajet.map(([x, y]) => [X(x), Y(y)] as [number, number]);
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.5;
      g.setLineDash([2, 5]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.setLineDash([]);
      // Repères : le point d'arrivée de chaque distance possible (une case de plus à chaque repère).
      const rep = R.reperes.map(([x, y]) => [X(x), Y(y)] as [number, number]);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      rep.forEach(([x, y], k) => {
        if (k > 0 && Math.hypot(x - rep[k - 1][0], y - rep[k - 1][1]) < 6) return;
        g.beginPath();
        g.arc(x, y, 2.6, 0, Math.PI * 2);
        g.fill();
      });
      const [hx, hy] = rep[Math.max(0, Math.min(R.max, R.valeur) - 1)] ?? pts[pts.length - 1];
      // Trajet retenu : pointillés blancs du bateau jusqu'à la poignée, le long du trajet de la voile.
      let iProche = 0;
      pts.forEach(([x, y], i) => { if (Math.hypot(x - hx, y - hy) < Math.hypot(pts[iProche][0] - hx, pts[iProche][1] - hy)) iProche = i; });
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.setLineDash([4, 5]);
      g.beginPath();
      pts.slice(0, iProche + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.lineTo(hx, hy);
      g.stroke();
      g.setLineDash([]);
      if (P.trajectoire?.caseBloquante) {
        const [x, y] = P.trajectoire.caseBloquante;
        const cx = X(x + 0.5), cy = Y(y + 0.5), r = Math.max(5, s * 0.5);
        g.strokeStyle = C.danger;
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r);
        g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r);
        g.stroke();
      }
      g.fillStyle = C.accent;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(hx, hy, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#04121f';
      g.beginPath();
      g.arc(hx, hy, 3, 0, Math.PI * 2);
      g.fill();
      const mpcP = course.milles_par_case ?? 1;
      texte(g, R.valeur >= R.max ? `max ${Math.round(R.max * mpcP)} mn` : `${Math.round(R.valeur * mpcP)} mn`, hx + 13, hy - 10, '#ffffff', 12, 700, true);
      g.restore();
      poigneeRef.current = { pts: pts.map(([x, y]) => [x + v.ox, y + v.oy] as [number, number]), reperes: rep.map(([x, y]) => [x + v.ox, y + v.oy] as [number, number]), choisir: R.choisir };
    }

    // Destination visée d'une touche sur la mer (13/11/2026, demande du porteur de projet) : ligne droite du bateau à la
    // destination, bleue tant que la mer est libre, rouge à partir du premier obstacle (terre, zone interdite), marqué d'une croix.
    const dest = P.roseCaps?.destination;
    if (dest && moi) {
      const p0 = P.positions[moi.id] ?? [moi.x, moi.y];
      const ax = p0[0] + 0.5, ay = p0[1] + 0.5;
      const lg = Math.hypot(dest[0] - ax, dest[1] - ay);
      const n = Math.max(1, Math.ceil(lg * 8));
      let obstacle: { t: number; nom: string } | null = null;
      for (let k = 1; k <= n && !obstacle; k++) {
        const t = k / n;
        if (t * lg < 0.6) continue; // case du bateau (le port de départ peut toucher la côte)
        const px = ax + (dest[0] - ax) * t, py = ay + (dest[1] - ay) * t;
        const cx = Math.floor(px), cy = Math.floor(py);
        const dedans = cx >= 0 && cy >= 0 && cx < carte.L && cy < carte.H;
        const typeCase = dedans ? carte.type[cy * carte.L + cx] : '#';
        if (!dedans) obstacle = { t, nom: 'Bord de la carte' };
        else if (terreFine(carte, px, py) || typeCase === '#' || typeCase === '~') obstacle = { t, nom: 'Terre' };
        else if (!navigable(carte, cx, cy)) obstacle = { t, nom: 'Zone interdite' };
      }
      const sx = X(ax), sy = Y(ay), ex = X(dest[0]), ey = Y(dest[1]);
      const tO = obstacle?.t ?? 1;
      const bx = X(ax + (dest[0] - ax) * tO), by = Y(ay + (dest[1] - ay) * tO);
      g.save();
      g.lineCap = 'round';
      g.lineWidth = 2.5;
      g.setLineDash([8, 6]);
      g.strokeStyle = C.accent;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(bx, by);
      g.stroke();
      if (obstacle) {
        g.strokeStyle = C.danger;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(ex, ey);
        g.stroke();
        g.setLineDash([]);
        const r = 7;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(bx - r, by - r); g.lineTo(bx + r, by + r);
        g.moveTo(bx + r, by - r); g.lineTo(bx - r, by + r);
        g.stroke();
      }
      g.setLineDash([]);
      // Cible : deux cercles et un point, de la couleur de la route.
      const coul = obstacle ? C.danger : C.accent;
      g.strokeStyle = coul;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(ex, ey, 11, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = coul;
      g.beginPath();
      g.arc(ex, ey, 4, 0, Math.PI * 2);
      g.fill();
      const mn = Math.round(lg * (course.milles_par_case ?? 1));
      texte(g, `${mn} mn · ${obstacle ? `${obstacle.nom.toLowerCase()} sur la route` : 'route libre'}`, ex + 15, ey - 13, obstacle ? '#ffd0d0' : '#e6f9fe', 12, 700, true);
      g.restore();
    }

    // Bateaux : coque orientée selon le cap. Plusieurs bateaux sur la même case : étiquettes décalées.
    const memeCase = new Map<string, number>();
    for (const b of P.etat.bateaux) {
      const p = P.positions[b.id] ?? posExacte(b);
      // Dans la brume, les concurrents sont invisibles (on ne voit que son propre bateau).
      if (b.id !== P.moiId && P.moiId && carte.zones[Math.floor(p[1] + 0.5) * carte.L + Math.floor(p[0] + 0.5)]?.includes('brume')) continue;
      const cx = X(p[0] + 0.5), cy = Y(p[1] + 0.5);
      const coul = skipper(b.skipperId).couleurs.pion;
      const cap = b.dernierCap ?? b.choix?.cap ?? 12;
      const [vx, vy] = vecteur(cap);
      const Lb = Math.max(12, Math.min(29, s * 2.1)); // ×1,3 (12/11/2026, porteur de projet)
      const lb = Lb * 0.38;
      g.save();
      g.translate(cx, cy);
      g.rotate((sensMarche.get(b.id) ?? Math.atan2(vy, vx)) + Math.PI / 2);
      if (b.id === P.moiId) {
        g.strokeStyle = coul;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, Lb * 0.95, 0, Math.PI * 2);
        g.stroke();
      }
      dessinerCoque(g, b.famille, Lb, lb, coul, skipper(b.skipperId).couleurs.spi);
      g.restore();
      const nom = P.noms[b.id] ?? b.nom;
      const cle = `${Math.round(p[0] * 2)}:${Math.round(p[1] * 2)}`;
      const rang = memeCase.get(cle) ?? 0;
      memeCase.set(cle, rang + 1);
      texte(g, nom, cx + Lb * 0.7 + 4, cy - Lb * 0.4 + rang * 14, b.id === P.moiId ? '#ffffff' : '#e6eef5', 12, 700, true);
    }
    g.restore();

    // Le calque de la rose suit le bateau du joueur (déplacement et zoom de la carte).
    const calque = calqueRef.current;
    if (calque) {
      const bm = P.moiId ? P.etat.bateaux.find((b) => b.id === P.moiId) : null;
      const pm = bm ? P.positions[bm.id] ?? posExacte(bm) : null;
      if (pm && !globeVisible.current) {
        calque.style.display = '';
        calque.style.transform = `translate(${v.ox + X(pm[0] + 0.5)}px, ${v.oy + Y(pm[1] + 0.5)}px)`;
        roseEcran.current = { x: v.ox + X(pm[0] + 0.5), y: v.oy + Y(pm[1] + 0.5) };
      } else calque.style.display = 'none';
    }

    // Échelle des distances (1 case = milles_par_case milles) : 30, 100 ou 500 milles selon le zoom.
    const mpc = course.milles_par_case ?? 1;
    const pxParMille = s / mpc;
    // Longueur maximale (en pixels) de chaque barre : au-delà, on passe à la mesure plus courte.
    const longueurs: [number, number][] = [[500, 200], [100, 90], [30, Infinity]];
    const milles = longueurs.find(([m, max]) => m * pxParMille <= max)![0];
    const lpx = milles * pxParMille;
    const ex = 12;
    // Sur téléphone, au-dessus du bouton « Commandes » et de l'échelle des vitesses (12/11/2026).
    // Au-dessus de la barre des voiles pendant la décision (essai d'interface du 12/11/2026).
    const commandes = !!cv.parentElement?.classList.contains('avec-commandes');
    const ey = commandes ? h - (w <= 860 ? 236 : 196) : w <= 860 ? h - 100 : h - 50;
    g.fillStyle = 'rgba(6,24,40,0.7)';
    arrondi(g, ex, ey - 22, lpx + 24, 34, 8);
    g.fill();
    g.strokeStyle = '#e6eef5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(ex + 12, ey - 4);
    g.lineTo(ex + 12, ey + 2);
    g.lineTo(ex + 12 + lpx, ey + 2);
    g.lineTo(ex + 12 + lpx, ey - 4);
    g.stroke();
    texte(g, `${milles} milles`, ex + 12, ey - 8, '#e6eef5', 11, 700);
  };

  useEffect(() => {
    dessiner();
  });

  useEffect(() => {
    const cv = canvasRef.current!;
    const ro = new ResizeObserver(() => dessiner());
    ro.observe(cv);
    let glisse: { x: number; y: number } | null = null;
    const pointeurs = new Map<number, { x: number; y: number }>();
    let distPince = 0;
    // Poignée de distance : saisie près de la poignée ou du trajet, puis glissée le long du trajet.
    let reglage = false;
    // Boussole : cap visé sous le doigt ou la souris (couronne seulement), sinon null.
    const capSous = (mx: number, my: number): number | null => {
      const rc = propsRef.current.roseCaps, r = roseEcran.current;
      if (!rc || !r || globeVisible.current || calqueRef.current?.style.display === 'none') return null;
      const R = cv.clientWidth <= 860 ? 60 : 78;
      const d = Math.hypot(mx - r.x, my - r.y);
      if (d < R - 26 || d > R + 26) return null;
      const ang = ((Math.atan2(mx - r.x, r.y - my) * 180) / Math.PI + 360) % 360;
      let best: number | null = null, ecart = Infinity;
      for (const c of rc.caps) {
        const e = Math.abs(((c * 22.5 - ang + 540) % 360) - 180);
        if (e < ecart) { ecart = e; best = c; }
      }
      return ecart <= 12 ? best : null;
    };
    let tape: { x: number; y: number; cap: number } | null = null;
    // Touche brève ailleurs sur la mer pendant le choix du cap : destination visée (13/11/2026).
    let touche: { x: number; y: number } | null = null;
    const viserSous = (mx: number, my: number): [number, number] | null => {
      const rc = propsRef.current.roseCaps, r = roseEcran.current;
      if (!rc?.viser || globeVisible.current) return null;
      // Sur la boussole (couronne et centre), la touche est pour la boussole.
      if (r && Math.hypot(mx - r.x, my - r.y) <= (cv.clientWidth <= 860 ? 60 : 78) + 26) return null;
      const v = vue.current;
      return [(mx - v.ox) / v.s, (my - v.oy) / v.s];
    };
    let capSurvole: number | null = null;
    const survoler = (c: number | null) => {
      if (c === capSurvole) return;
      capSurvole = c;
      propsRef.current.roseCaps?.survoler(c);
      cv.title = c === null ? '' : propsRef.current.roseCaps?.nom(c) ?? '';
    };
    const regler = (e: PointerEvent, saisie: boolean): boolean => {
      const pg = poigneeRef.current;
      if (!pg) return false;
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      // Le repère le plus proche du doigt ou de la souris donne la distance (le plus court en cas d'égalité).
      let k = 0, dk = Infinity;
      pg.reperes.forEach(([x, y], i) => { const d = Math.hypot(x - mx, y - my); if (d < dk - 0.5) { dk = d; k = i; } });
      const tol = e.pointerType === 'touch' ? 26 : 16;
      if (saisie && dk > tol && projeter(pg.pts, mx, my).d > tol) return false;
      pg.choisir(k + 1);
      return true;
    };
    // Poignée de distance glissée AUTOUR du bateau (13/11/2026, demande du porteur de projet, surtout au doigt) : le cap suit
    // la direction du doigt (cap proposé le plus proche, comme sur la rose), la distance suit le doigt le long du trajet.
    // Un écart de quelques degrés évite de sautiller d'un cap à l'autre à la limite de deux secteurs.
    let capVise: number | null = null;
    const tourner = (e: PointerEvent): boolean => {
      const rc = propsRef.current.roseCaps, r = roseEcran.current;
      if (!rc || !r || capVise === null || globeVisible.current) return false;
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      // Trop près du bateau, la direction du doigt ne veut rien dire.
      if (Math.hypot(mx - r.x, my - r.y) < (e.pointerType === 'touch' ? 40 : 28)) return false;
      const ang = ((Math.atan2(mx - r.x, r.y - my) * 180) / Math.PI + 360) % 360;
      const ecart = (c: number) => Math.abs(((c * 22.5 - ang + 540) % 360) - 180);
      let meilleur = capVise, em = ecart(capVise);
      for (const c of rc.caps) if (ecart(c) < em) { em = ecart(c); meilleur = c; }
      if (meilleur === capVise || ecart(capVise) - em < 4) return false;
      capVise = meilleur;
      rc.choisir(meilleur);
      return true;
    };
    const down = (e: PointerEvent) => {
      // Premier doigt (ou souris) : aucun autre pointeur n'est posé, on oublie ceux dont le lâcher s'est perdu (13/11/2026 :
      // sinon une touche brève passait pour le second doigt d'un pincement et ne faisait rien).
      if (e.isPrimary) pointeurs.clear();
      cv.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 1 && regler(e, true)) {
        reglage = true;
        capVise = propsRef.current.roseCaps?.cap ?? null;
        glisse = null;
        return;
      }
      reglage = false;
      glisse = { x: e.clientX, y: e.clientY };
      const rect = cv.getBoundingClientRect();
      const c = pointeurs.size === 1 ? capSous(e.clientX - rect.left, e.clientY - rect.top) : null;
      tape = c === null ? null : { x: e.clientX, y: e.clientY, cap: c };
      touche = pointeurs.size === 1 && c === null && (e.pointerType !== 'mouse' || e.button === 0) ? { x: e.clientX, y: e.clientY } : null;
    };
    const move = (e: PointerEvent) => {
      if (!pointeurs.has(e.pointerId)) {
        // Survol : main sur la poignée de distance.
        const pg = poigneeRef.current;
        if (e.pointerType === 'mouse') {
          const rect = cv.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          const c = capSous(mx, my);
          survoler(c);
          cv.style.cursor = pg && projeter(pg.pts, mx, my).d <= 16 ? 'grab' : c !== null ? 'pointer' : viserSous(mx, my) ? 'crosshair' : '';
          // Boussole : elle ressort quand la souris passe dessus (rayon de la couronne + la flèche du vent).
          const r = roseEcran.current, rayon = cv.clientWidth <= 860 ? 60 : 78;
          calqueRef.current?.classList.toggle('survol', !!r && Math.hypot(mx - r.x, my - r.y) <= rayon + 40);
        }
        return;
      }
      if (reglage && pointeurs.size === 1) {
        if (!tourner(e)) regler(e, false);
        return;
      }
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 2) {
        const [a, b] = [...pointeurs.values()];
        const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (distPince) zoomer(dd / distPince, (a.x + b.x) / 2, (a.y + b.y) / 2);
        distPince = dd;
        return;
      }
      if (!glisse) return;
      vue.current.ox += e.clientX - glisse.x;
      vue.current.oy += e.clientY - glisse.y;
      glisse = { x: e.clientX, y: e.clientY };
      dessiner();
    };
    const sortie = () => {
      calqueRef.current?.classList.remove('survol');
      survoler(null);
    };
    const up = (e: PointerEvent) => {
      // Touche brève sur la couronne de la boussole (sans glisser la carte) : choix du cap.
      if (tape && pointeurs.size === 1 && Math.hypot(e.clientX - tape.x, e.clientY - tape.y) < 8) propsRef.current.roseCaps?.choisir(tape.cap);
      // Touche brève sur la mer (sans glisser la carte, un seul doigt) : destination visée.
      else if (touche && pointeurs.size === 1 && !reglage && Math.hypot(e.clientX - touche.x, e.clientY - touche.y) < (e.pointerType === 'touch' ? 10 : 6)) {
        const rect = cv.getBoundingClientRect();
        const pt = viserSous(e.clientX - rect.left, e.clientY - rect.top);
        if (pt) propsRef.current.roseCaps?.viser?.(pt);
      }
      tape = null;
      touche = null;
      pointeurs.delete(e.pointerId);
      reglage = false;
      distPince = 0;
      glisse = null;
    };
    const zoomer = (f: number, clientX: number, clientY: number) => {
      const rect = cv.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const v = vue.current;
      const ns = Math.max(v.min, Math.min(160, v.s * f));
      v.ox = mx - ((mx - v.ox) * ns) / v.s;
      v.oy = my - ((my - v.oy) * ns) / v.s;
      v.s = ns;
      dessiner();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomer(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', sortie);
    cv.addEventListener('wheel', wheel, { passive: false });
    (cv as unknown as { zoomer: typeof zoomer }).zoomer = zoomer;
    return () => {
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('pointerleave', sortie);
      cv.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!centrer) return;
    const cv = canvasRef.current!;
    const P = propsRef.current;
    const b = P.etat.bateaux.find((x) => x.id === P.moiId) ?? P.etat.bateaux[0];
    const v = vue.current;
    v.s = Math.max(v.s, 14);
    v.ox = cv.clientWidth / 2 - (b.x + 0.5) * v.s;
    v.oy = cv.clientHeight / 2 - (b.y + 0.5) * v.s;
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrer]);

  // Début d'une décision : si le bateau du joueur est hors de l'écran (ou sous la barre des voiles), la carte le recentre,
  // sans changer le zoom.
  useEffect(() => {
    if (!enChoix) return;
    const cv = canvasRef.current!;
    const P = propsRef.current;
    const b = P.etat.bateaux.find((x) => x.id === P.moiId);
    if (!b) return;
    const v = vue.current;
    const p = P.positions[b.id] ?? posExacte(b);
    const sx = v.ox + (p[0] + 0.5) * v.s, sy = v.oy + (p[1] + 0.5) * v.s;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (sx < 140 || sx > w - 140 || sy < 150 || sy > h - 260) {
      v.ox = w / 2 - (p[0] + 0.5) * v.s;
      v.oy = (h - 120) / 2 - (p[1] + 0.5) * v.s;
      dessiner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enChoix, etat.tour]);

  const zoomBouton = (f: number) => {
    const cv = canvasRef.current as unknown as { zoomer?: (f: number, x: number, y: number) => void; getBoundingClientRect: () => DOMRect };
    const r = cv.getBoundingClientRect();
    cv.zoomer?.(f, r.left + r.width / 2, r.top + r.height / 2);
  };
  const toutVoir = () => {
    vue.current.init = false;
    dessiner();
  };

  return (
    <>
      <canvas ref={canvasRef} aria-label="Carte de la course" role="img" />
      <div className="calque-bateau" ref={calqueRef}><div id="rose-carte" /></div>
      <div className="outils-carte">
        <button className="btn btn-petit" onClick={() => ((globe || (lecture && course.distance_reelle)) && zoomGlobe.current ? zoomGlobe.current(1.3) : zoomBouton(1.3))} aria-label="Zoomer">+</button>
        <button className="btn btn-petit" onClick={() => ((globe || (lecture && course.distance_reelle)) && zoomGlobe.current ? zoomGlobe.current(1 / 1.3) : zoomBouton(1 / 1.3))} aria-label="Dézoomer">−</button>
        {!(globe || (lecture && course.distance_reelle)) && <button className="btn btn-petit" onClick={toutVoir}>Toute la carte</button>}
        {course.distance_reelle && (
          <button className="btn btn-petit" onClick={() => setGlobe((v) => !v)} aria-pressed={globe}>{globe ? '🗺 Carte plate' : '🌍 Vue globe'}</button>
        )}
      </div>
      {/* Tours du monde (12/11/2026, principe du porteur de projet) : on décide sur la carte plate, comme sur une table à
          cartes ; pendant le déplacement des bateaux, le globe s'affiche seul et suit le bateau du joueur. Le bouton
          « Vue globe » permet aussi de le regarder à tout moment, sans y prendre de décision. */}
      {course.distance_reelle && (
        <Suspense fallback={null}>
          <Globe etat={etat} positions={positions} moiId={moiId} noms={noms} course={course} carte={carte} cotes={cotes} ortho={ortho} centrer={centrer} zoom={zoomGlobe}
            visible={globe || !!lecture} suivre={!!lecture && !globe} />
        </Suspense>
      )}
      <div className="echelle-vitesse" aria-hidden>
        <span>Vitesse</span>
        <i style={{ background: `linear-gradient(90deg, ${VITESSES.map(([, c]) => `rgb(${c.join(',')})`).join(',')})` }} />
      </div>
    </>
  );
}

/**
 * Coque vue du dessus, étrave vers le haut, selon le type de bateau : IMOCA (étrave fine, foils ou dérives),
 * Class40 (étrave ronde de scow), trimarans Ultim (grand) et Ocean Fifty (plus petit) ; Vintage : monocoque à étrave fine
 * ou trimaran de la taille de l'Ocean Fifty.
 */
/**
 * Contours coupés par la ligne de changement de date (Eurasie au détroit de Béring) : le tracé saute d'un bord à l'autre
 * du planisphère, et ces deux sauts dessinaient une bande de couleur inversée tout le long de la carte au nord
 * (12/11/2026). On sépare alors le contour en deux morceaux fermés, un de chaque côté.
 */
const decoupes = new WeakMap<number[][], number[][]>();
function cotesDecoupees(cotes: number[][]): number[][] {
  const deja = decoupes.get(cotes);
  if (deja) return deja;
  const out: number[][] = [];
  for (const r of cotes) {
    const n = r.length / 2;
    const sauts: number[] = [];
    for (let i = 0; i < n; i++) if (Math.abs(r[2 * ((i + 1) % n)] - r[2 * i]) > 100) sauts.push(i);
    if (sauts.length !== 2) {
      out.push(r);
      continue;
    }
    const [i, j] = sauts;
    const morceau = (de: number, a: number) => {
      const m: number[] = [];
      for (let k = de; k !== a; k = (k + 1) % n) m.push(r[2 * k], r[2 * k + 1]);
      m.push(r[2 * a], r[2 * a + 1]);
      return m;
    };
    out.push(morceau((i + 1) % n, j), morceau((j + 1) % n, i));
  }
  decoupes.set(cotes, out);
  return out;
}

export function dessinerCoque(g: CanvasRenderingContext2D, famille: string, Lb: number, lb: number, coul: string, pont = '#f0a030') {
  g.fillStyle = coul;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  const tri = famille === 'ultim' || famille === 'ultim_ancien' || famille === 'ocean_fifty' || famille === 'vintage_multicoque';
  if (tri) {
    const k = famille === 'ocean_fifty' || famille === 'vintage_multicoque' ? 0.85 : 1.15; // l'Ultim est plus grand que l'Ocean Fifty
    const L = Lb * k, fx = L * 0.36;
    // bras de liaison
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-fx, -L * 0.08);
    g.lineTo(fx, -L * 0.08);
    g.moveTo(-fx, L * 0.2);
    g.lineTo(fx, L * 0.2);
    g.stroke();
    // flotteurs
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(sx * fx, L * 0.05, L * 0.07, L * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 1;
      g.stroke();
    }
    // coque centrale
    g.beginPath();
    g.moveTo(0, -L * 0.62);
    g.quadraticCurveTo(L * 0.11, -L * 0.1, L * 0.08, L * 0.45);
    g.lineTo(-L * 0.08, L * 0.45);
    g.quadraticCurveTo(-L * 0.11, -L * 0.1, 0, -L * 0.62);
    g.fill();
    g.lineWidth = 1.5;
    g.stroke();
    return;
  }
  // Monocoques (demande du porteur de projet, 11/11/2026, d'après ses croquis) : coques fines, pont clair et cockpit
  // de la couleur du spi ; IMOCA à foils (foils rouges qui débordent), IMOCA à dérives, Class40 (étrave pointue, arrière
  // large et carré), Vintage (très long et effilé).
  const forme: Record<string, [number, number, number]> = { class40: [0.84, 0.6, 1], imoca_derives: [1, 0.5, 0.8], vintage_monocoque: [1.06, 0.4, 0.55] };
  const [kL, kw, ka] = forme[famille] ?? [1, 0.52, 0.85];
  const L = Lb * kL, w = lb * kw;
  const coque = (sx: number, sy: number, dy: number) => {
    g.beginPath();
    g.moveTo(0, -0.62 * L * sy + dy);
    g.quadraticCurveTo(w * 1.02 * sx, -0.3 * L * sy + dy, w * sx, 0.08 * L * sy + dy);
    g.lineTo(w * ka * sx, 0.45 * L * sy + dy);
    g.lineTo(-w * ka * sx, 0.45 * L * sy + dy);
    g.lineTo(-w * sx, 0.08 * L * sy + dy);
    g.quadraticCurveTo(-w * 1.02 * sx, -0.3 * L * sy + dy, 0, -0.62 * L * sy + dy);
    g.closePath();
  };
  if (famille === 'imoca_foiler') {
    g.strokeStyle = '#e0392b';
    g.lineWidth = Math.max(2, lb * 0.22);
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(-w * 2.1, -L * 0.02);
    g.lineTo(w * 2.1, -L * 0.06);
    g.stroke();
  }
  coque(1, 1, 0);
  g.fillStyle = coul;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 1;
  g.stroke();
  coque(0.62, 0.78, L * 0.05);
  g.fillStyle = '#f4f4f2';
  g.fill();
  g.fillStyle = pont;
  g.beginPath();
  g.moveTo(-w * 0.34 * ka, L * 0.4);
  g.lineTo(w * 0.34 * ka, L * 0.4);
  g.lineTo(w * 0.3, L * 0.02);
  g.quadraticCurveTo(0, -L * 0.2, -w * 0.3, L * 0.02);
  g.closePath();
  g.fill();
}

function texte(g: CanvasRenderingContext2D, t: string, x: number, y: number, coul: string, taille: number, graisse = 600, ombre = false) {
  g.font = `${graisse} ${taille}px Inter, system-ui, sans-serif`;
  if (ombre) {
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(8,24,40,0.85)';
    g.strokeText(t, x, y);
    g.lineWidth = 1;
  }
  g.fillStyle = coul;
  g.fillText(t, x, y);
}

function arrondi(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fleche(g: CanvasRenderingContext2D, cx: number, cy: number, dir: number, long: number) {
  const [dx, dy] = vecteur(dir);
  const x0 = cx - (dx * long) / 2, y0 = cy - (dy * long) / 2, x1 = cx + (dx * long) / 2, y1 = cy + (dy * long) / 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.moveTo(x1, y1);
  g.lineTo(x1 - dx * 5 - dy * 3.5, y1 - dy * 5 + dx * 3.5);
  g.moveTo(x1, y1);
  g.lineTo(x1 - dx * 5 + dy * 3.5, y1 - dy * 5 - dx * 3.5);
  g.stroke();
}

/** Projection d'un point sur le trajet : longueur parcourue jusqu'au point le plus proche, et distance à ce point (pixels). */
function projeter(pts: [number, number][], px: number, py: number): { s: number; d: number } {
  let meilleur = { s: 0, d: Infinity };
  let cumul = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const seg2 = dx * dx + dy * dy;
    const t = seg2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / seg2)) : 0;
    const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    if (d < meilleur.d) meilleur = { s: cumul + t * Math.sqrt(seg2), d };
    cumul += Math.sqrt(seg2);
  }
  return meilleur;
}
