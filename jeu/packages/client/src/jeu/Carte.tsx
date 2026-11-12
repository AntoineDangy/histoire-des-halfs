import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { centreTraine, compilerCarte, routeObligatoire, course as courseJouee, NOMS_DIR, norm, vecteur } from '@cal/engine';
import type { Case, EtatPartie } from '@cal/engine';
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

export default function Carte({ etat, positions, trajectoire, moiId, centrer, noms, coupes, lecture }: PropsCarte) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [globe, setGlobe] = useState(false);
  // Zoom du globe (12/11/2026) : les boutons + et − agissent sur le globe quand il est ouvert.
  const zoomGlobe = useRef<((f: number) => void) | null>(null);
  const vue = useRef({ s: 8, ox: 0, oy: 0, init: false, min: 3 });
  const propsRef = useRef<PropsCarte>({ etat, positions, trajectoire, moiId, centrer, noms });
  propsRef.current = { etat, positions, trajectoire, moiId, centrer, noms, coupes };
  // Parcours de la classe jouée (marques obligatoires propres à chaque classe).
  const course = courseJouee(D, etat);
  const carte = compilerCarte(course);
  const { cotes, orthodromie: ortho } = TRACES[course.id] ?? TRACES['route-du-rhum'];
  const pr = course.projection!;
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
    for (const f of P.etat.fronts ?? []) {
      const ellipse = (cx: number, cy: number) => {
        g.beginPath();
        g.ellipse(X(cx), Y(cy), f.rx * s, f.ry * s, 0, 0, Math.PI * 2);
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

    // Rhum (12/11/2026, porteur de projet) : la route directe blanche passe par la bouée, plus lisible que le parcours en pointillés.
    if (!course.route_directe && course.portes.some((p) => p.type === 'marque')) {
      // Parcours obligatoire : du port de départ à l'arrivée par les marques, en pointillés (route la plus courte en mer, lissée).
      const r = routeObligatoire(carte);
      const pts = r.filter((_, i) => i % 3 === 0 || i === r.length - 1).map(([x, y]) => [X(x + 0.5), Y(y + 0.5)]);
      const port = course.lieux?.find((l) => l.type === 'depart'), but = course.lieux?.find((l) => l.type === 'arrivee');
      if (port) pts.unshift([X(port.x), Y(port.y)]);
      if (but) pts.push([X(but.x), Y(but.y)]);
      g.save();
      g.strokeStyle = 'rgba(255,211,77,0.75)';
      g.lineWidth = 1.6;
      g.setLineDash([7, 6]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.restore();
    } else {
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
    for (const r of cotes) {
      g.moveTo(X(r[0]), Y(r[1]));
      for (let i = 2; i < r.length; i += 2) g.lineTo(X(r[i]), Y(r[i + 1]));
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
      g.strokeStyle = '#ffd34d';
      g.lineWidth = Math.max(2, s * 0.25);
      g.setLineDash([s * 0.6, s * 0.4]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.setLineDash([]);
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
    if (P.trajectoire && moi) {
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
      const Lb = Math.max(9, Math.min(22, s * 1.6));
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

    // Échelle des distances (1 case = milles_par_case milles) : 30, 100 ou 500 milles selon le zoom.
    const mpc = course.milles_par_case ?? 1;
    const pxParMille = s / mpc;
    // Longueur maximale (en pixels) de chaque barre : au-delà, on passe à la mesure plus courte.
    const longueurs: [number, number][] = [[500, 200], [100, 90], [30, Infinity]];
    const milles = longueurs.find(([m, max]) => m * pxParMille <= max)![0];
    const lpx = milles * pxParMille;
    const ex = 12;
    // Sur téléphone, au-dessus du bouton « Commandes » et de l'échelle des vitesses (12/11/2026).
    const ey = w <= 860 ? h - 100 : h - 50;
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
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      glisse = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!pointeurs.has(e.pointerId)) return;
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
    const up = (e: PointerEvent) => {
      pointeurs.delete(e.pointerId);
      distPince = 0;
      glisse = null;
    };
    const zoomer = (f: number, clientX: number, clientY: number) => {
      const rect = cv.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const v = vue.current;
      const ns = Math.max(v.min, Math.min(40, v.s * f));
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
    cv.addEventListener('wheel', wheel, { passive: false });
    (cv as unknown as { zoomer: typeof zoomer }).zoomer = zoomer;
    return () => {
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
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
