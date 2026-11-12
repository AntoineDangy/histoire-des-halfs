// Vue globe des tours du monde (12/11/2026, demande du porteur de projet : « met un globe »).
// Le jeu calcule toujours sur la carte plate (cases, distances, vents) ; cette vue reporte la même carte sur une sphère :
// un seul Atlantique, les vraies proportions du Grand Sud. La carte est peinte sur une texture (projection
// équirectangulaire) enroulée autour d'une sphère ; on fait tourner le globe à la main, il suit le bateau du joueur.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { centreTraine, vecteur } from '@cal/engine';
import type { CarteCompilee, CourseDef, EtatPartie } from '@cal/engine';
import { posExacte, skipper } from '../commun';
import { dessinerCoque } from './Carte';

export interface PropsGlobe {
  etat: EtatPartie;
  positions: Record<string, [number, number]>;
  moiId: string | null;
  noms: Record<string, string>;
  course: CourseDef;
  carte: CarteCompilee;
  cotes: number[][];
  ortho: number[];
  centrer: number;
  /** Rempli par le globe : zoom des boutons + et − de la carte. */
  zoom?: { current: ((f: number) => void) | null };
  /** Globe affiché (sinon caché, sans calcul d'image). */
  visible?: boolean;
  /** Caméra automatique : suit le bateau du joueur pendant la lecture du tour. */
  suivre?: boolean;
}

const W = 4096, H = 2048;
const RAD = Math.PI / 180;

export default function Globe(p: PropsGlobe) {
  const boite = useRef<HTMLDivElement>(null);
  const moteur = useRef<{ peindre: () => void; viser: () => void } | null>(null);
  const props = useRef(p);
  props.current = p;

  useEffect(() => {
    const el = boite.current!;
    const { course, carte, cotes, ortho } = props.current;
    const pr = course.projection!;
    const cellRad = ((pr.lon_max - pr.lon_min) * RAD) / carte.L;
    const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
    const mMax = merc(pr.lat_max);
    // Case (x, y) de la carte plate → longitude, latitude.
    const lonLat = (x: number, y: number): [number, number] => [
      pr.lon_min + (x * (pr.lon_max - pr.lon_min)) / carte.L,
      (2 * Math.atan(Math.exp(mMax - y * cellRad)) - Math.PI / 2) / RAD,
    ];
    const tx = (lon: number) => ((lon + 180) / 360) * W;
    const ty = (lat: number) => ((90 - lat) / 180) * H;
    // Les longitudes vont de -45 à 365 (carte déroulée) : chaque tracé est peint deux fois, décalé d'un tour.
    const DECALAGES = [W, 0, -W];
    // Longitudes déroulées le long du tracé : un contour coupé à 180° (l'Eurasie au détroit de Béring) ne saute plus
    // d'un bord à l'autre de la texture (bande parasite autour du pôle Nord).
    const chemin = (g: CanvasRenderingContext2D, pts: [number, number][], dx: number, ferme = false) => {
      let prec = NaN;
      pts.forEach(([x, y], i) => {
        let [lon, lat] = lonLat(x, y);
        if (i) { while (lon - prec > 180) lon -= 360; while (lon - prec < -180) lon += 360; }
        prec = lon;
        (i ? g.lineTo : g.moveTo).call(g, tx(lon) + dx, ty(lat));
      });
      if (ferme) g.closePath();
    };
    const paires = (r: number[]) => {
      const o: [number, number][] = [];
      for (let i = 0; i < r.length; i += 2) o.push([r[i], r[i + 1]]);
      return o;
    };

    // Point de la sphère pour une longitude et une latitude (mêmes formules que la sphère de three.js).
    function point(lon: number, lat: number, r = 1) {
      const phi = (lon + 180) * RAD, theta = (90 - lat) * RAD;
      return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
    }

    // Fond fixe : océan, graticule, terres, zone des glaces, courants, route.
    const fond = document.createElement('canvas');
    fond.width = W;
    fond.height = H;
    {
      const g = fond.getContext('2d')!;
      g.fillStyle = '#1b4468';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      for (let lon = -180; lon <= 180; lon += 15) { g.beginPath(); g.moveTo(tx(lon), 0); g.lineTo(tx(lon), H); g.stroke(); }
      for (let lat = -75; lat <= 75; lat += 15) { g.beginPath(); g.moveTo(0, ty(lat)); g.lineTo(W, ty(lat)); g.stroke(); }
      const dejaVus = new Set<string>();
      for (const z of course.zones_meteo) {
        // Les zones de l'Atlantique existent en deux exemplaires (descente et remontée) : un seul sur le globe.
        if (z.type === 'courant') { if (dejaVus.has(z.nom)) continue; dejaVus.add(z.nom); }
        const [x0, y0, x1, y1] = z.rect;
        // Côtés découpés tous les 10 cases : sans cela, un rectangle de plus de 180° de large serait « déroulé » à l'envers.
        const bord = (ax: number, ay: number, bx: number, by: number): [number, number][] => {
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
          return Array.from({ length: n }, (_, k) => [ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n] as [number, number]);
        };
        const rect: [number, number][] = [...bord(x0, y0, x1 + 1, y0), ...bord(x1 + 1, y0, x1 + 1, y1 + 1), ...bord(x1 + 1, y1 + 1, x0, y1 + 1), ...bord(x0, y1 + 1, x0, y0)];
        if (z.type === 'zone_exclusion_glaces') {
          for (const dx of DECALAGES) { g.beginPath(); chemin(g, rect, dx, true); g.fillStyle = 'rgba(255,90,95,0.22)'; g.fill(); g.strokeStyle = 'rgba(255,120,120,0.8)'; g.lineWidth = 2; g.stroke(); }
        } else if (z.type === 'courant' && z.direction !== undefined) {
          const [vx, vy] = vecteur(z.direction);
          g.strokeStyle = 'rgba(150,220,255,0.75)';
          g.fillStyle = 'rgba(150,220,255,0.75)';
          g.lineWidth = 2;
          const pas = (x1 - x0) * (y1 - y0) > 1500 ? 10 : 4; // grands courants : flèches plus espacées
          for (let y = y0 + 1; y <= y1; y += pas)
            for (let x = x0 + 1; x <= x1; x += pas)
              for (const dx of DECALAGES) {
                const [la, pa] = lonLat(x, y), [lb, pb] = lonLat(x + vx * 2, y + vy * 2);
                const ax = tx(la) + dx, ay = ty(pa), bx = tx(lb) + dx, by = ty(pb);
                g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
                const ang = Math.atan2(by - ay, bx - ax);
                g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 7 * Math.cos(ang - 0.5), by - 7 * Math.sin(ang - 0.5)); g.lineTo(bx - 7 * Math.cos(ang + 0.5), by - 7 * Math.sin(ang + 0.5)); g.fill();
              }
          const [ln, lt] = lonLat(x0, y0);
          for (const dx of DECALAGES) { g.font = '600 36px system-ui, sans-serif'; g.fillText(z.nom, tx(ln) + dx + 8, ty(lt) + 38); }
        }
      }
      g.fillStyle = '#efe7d1';
      g.strokeStyle = '#c9b78c';
      g.lineWidth = 1.2;
      for (const dx of DECALAGES) {
        g.beginPath();
        for (const r of cotes) chemin(g, paires(r), dx, true);
        // Règle « nonzero » : les lacs (contours en sens inverse) restent des trous, et les contours qui se chevauchent
        // près des pôles ne se creusent plus l'un l'autre (anneau parasite autour de l'Arctique avec « evenodd »).
        g.fill('nonzero');
        g.stroke();
      }
      // Calotte antarctique au-delà de 84° S (les côtes s'arrêtent à 85° S).
      g.fillRect(0, ty(-84), W, H - ty(-84));
      g.setLineDash([10, 8]);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 2;
      for (const dx of DECALAGES) { g.beginPath(); chemin(g, paires(ortho), dx); g.stroke(); }
      g.setLineDash([]);
      for (const l of course.lieux ?? []) {
        if (l.type !== 'repere') continue;
        const [ln, lt] = lonLat(l.x, l.y);
        for (const dx of DECALAGES) { g.font = '600 43px system-ui, sans-serif'; g.fillStyle = 'rgba(225,238,250,0.85)'; g.fillText(l.nom, tx(ln) + dx, ty(lt)); }
      }
    }

    // Texture peinte : fond + systèmes météo + bateaux (repeinte à chaque changement).
    const peinte = document.createElement('canvas');
    peinte.width = W;
    peinte.height = H;
    const texture = new THREE.CanvasTexture(peinte);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const ellipse = (cx: number, cy: number, rx: number, ry: number): [number, number][] =>
      Array.from({ length: 49 }, (_, k) => [cx + rx * Math.cos((k / 48) * 2 * Math.PI), cy + ry * Math.sin((k / 48) * 2 * Math.PI)]);
    const peindre = () => {
      const { etat } = props.current;
      const g = peinte.getContext('2d')!;
      g.drawImage(fond, 0, 0);
      const vus = new Set<string>();
      for (const f of etat.fronts ?? []) {
        // Un anticyclone permanent existe en deux exemplaires (Atlantique de la descente et de la remontée) : un seul sur le globe.
        if (f.permanent && f.nom) { if (vus.has(f.nom)) continue; vus.add(f.nom); }
        const annonce = f.annonce > 0;
        for (const dx of DECALAGES) {
          if (f.type === 'anticyclone') {
            g.beginPath(); chemin(g, ellipse(f.x, f.y, f.rx, f.ry), dx, true);
            g.fillStyle = 'rgba(120,170,255,0.16)'; g.fill(); g.strokeStyle = 'rgba(160,200,255,0.9)'; g.lineWidth = 2; g.stroke();
            const [ln, lt] = lonLat(f.x, f.y);
            g.fillStyle = '#d6e4ff'; g.font = '800 96px system-ui, sans-serif'; g.fillText('A', tx(ln) + dx - 31, ty(lt) + 34);
            g.font = '700 41px system-ui, sans-serif'; g.fillText(f.nom ?? 'Anticyclone', tx(ln) + dx - 170, ty(lt) + 96);
          } else if (f.type === 'molle') {
            g.beginPath(); chemin(g, ellipse(f.x, f.y, f.rx, f.ry), dx, true); g.fillStyle = 'rgba(255,226,166,0.2)'; g.fill();
          } else {
            g.setLineDash(annonce ? [10, 8] : []);
            g.beginPath(); chemin(g, ellipse(f.x, f.y, f.rx, f.ry), dx, true);
            g.fillStyle = annonce ? 'rgba(255,110,110,0.06)' : 'rgba(255,90,95,0.22)'; g.fill(); g.strokeStyle = 'rgba(255,120,120,0.95)'; g.lineWidth = 2.5; g.stroke();
            if (!annonce) {
              const [cx, cy] = centreTraine(f);
              g.beginPath(); chemin(g, ellipse(cx, cy, f.rx, f.ry), dx, true); g.fillStyle = 'rgba(255,200,120,0.12)'; g.fill();
            }
            g.setLineDash([]);
            const [ln, lt] = lonLat(f.x, f.y);
            g.fillStyle = '#ffd0d0'; g.font = '800 82px system-ui, sans-serif'; g.fillText('D', tx(ln) + dx - 26, ty(lt) + 29);
            g.font = '700 38px system-ui, sans-serif'; g.fillText(annonce ? `${f.nom ?? 'Front'} (annoncé)` : `${f.nom ?? 'Front'} · F${f.force}`, tx(ln) + dx - 190, ty(lt) + 86);
          }
        }
      }
      flotte();
      texture.needsUpdate = true;
    };

    const rendu = new THREE.WebGLRenderer({ antialias: true });
    rendu.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(rendu.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071624');
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 0, 3.6);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshBasicMaterial({ map: texture }));
    scene.add(globe);
    // Halo d'atmosphère.
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 48), new THREE.MeshBasicMaterial({ color: '#5fb4ff', transparent: true, opacity: 0.12, side: THREE.BackSide }));
    scene.add(halo);

    // Côtes en lignes 3D (12/11/2026) : nettes à tous les zooms, la texture seule devenait floue de près.
    {
      const sommets: number[] = [];
      for (const r of cotes) {
        const pts = paires(r).map(([x, y]) => lonLat(x, y));
        if (pts.every(([lon]) => lon >= 180)) continue; // copie du monde décalée de 360° : déjà tracée
        for (let i = 0; i < pts.length; i++) {
          const a = point(pts[i][0], pts[i][1], 1.0008), b = point(pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], 1.0008);
          sommets.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
      scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#9c8a5e' })));
    }

    // Bateaux en 3D (12/11/2026) : pastille et nom de taille fixe à l'écran, trace en ligne sur la sphère.
    const groupe = new THREE.Group();
    scene.add(groupe);
    const etiquettes = new Map<string, { pastille: THREE.Sprite; nom: THREE.Sprite; trace: THREE.Line; avant: THREE.Vector3 | null }>();
    const sprite = (dessin: (g: CanvasRenderingContext2D) => void, w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      dessin(c.getContext('2d')!);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: true, transparent: true }));
    };
    function flotte() {
      const { etat, positions, moiId, noms } = props.current;
      for (const b of etat.bateaux) {
        const moi = b.id === moiId;
        let e = etiquettes.get(b.id);
        if (!e) {
          const coul = skipper(b.skipperId).couleurs.pion;
          // Coque dessinée comme sur la carte plate (étrave vers le haut), tournée chaque image dans le sens de la marche.
          const pastille = sprite((g) => {
            g.translate(48, 48);
            g.scale(3, 3);
            if (moi) { g.beginPath(); g.arc(0, 0, 13, 0, 2 * Math.PI); g.strokeStyle = coul; g.lineWidth = 1.6; g.stroke(); }
            dessinerCoque(g, b.famille, 18, 18 * 0.38, coul, skipper(b.skipperId).couleurs.spi);
          }, 96, 96);
          pastille.scale.set(moi ? 0.06 : 0.05, moi ? 0.06 : 0.05, 1);
          const nom = sprite((g) => {
            g.font = `${moi ? 800 : 600} 44px system-ui, sans-serif`;
            g.lineWidth = 8; g.strokeStyle = 'rgba(6,20,34,0.85)'; g.strokeText(noms[b.id] ?? '', 6, 46);
            g.fillStyle = '#fff'; g.fillText(noms[b.id] ?? '', 6, 46);
          }, 512, 64);
          nom.scale.set(0.2, 0.025, 1);
          nom.center.set(-0.1, 0.5);
          const trace = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: coul, transparent: true, opacity: moi ? 1 : 0.6 }));
          groupe.add(trace, pastille, nom);
          e = { pastille, nom, trace, avant: null };
          etiquettes.set(b.id, e);
        }
        const p0 = positions[b.id] ?? posExacte(b);
        const pts = [...b.trace.map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]), [p0[0] + 0.5, p0[1] + 0.5] as [number, number]];
        e.trace.geometry.dispose();
        const pts3 = pts.map(([x, y]) => point(...lonLat(x, y), 1.002));
        e.trace.geometry = new THREE.BufferGeometry().setFromPoints(pts3);
        // Point précédent de la trace, pour tourner la coque dans le sens de la marche.
        const fin = pts3[pts3.length - 1];
        e.avant = [...pts3].reverse().find((q) => q.distanceTo(fin) > 1e-4) ?? null;
        const [lon, lat] = lonLat(p0[0] + 0.5, p0[1] + 0.5);
        e.pastille.position.copy(point(lon, lat, 1.004));
        e.nom.position.copy(point(lon, lat, 1.004));
        e.pastille.visible = e.nom.visible = e.trace.visible = !b.horsClassement || moi;
      }
    }
    const controles = new OrbitControls(camera, rendu.domElement);
    controles.enablePan = false;
    controles.enableDamping = true;
    controles.minDistance = 1.08;
    controles.maxDistance = 6;
    controles.rotateSpeed = 0.5;

    // Point de la sphère pour une longitude et une latitude (mêmes formules que la sphère de three.js).
    const viser = () => {
      const { etat, moiId, positions } = props.current;
      const b = etat.bateaux.find((x) => x.id === moiId) ?? etat.bateaux[0];
      if (!b) return;
      const p0 = positions[b.id] ?? posExacte(b);
      const [lon, lat] = lonLat(p0[0] + 0.5, p0[1] + 0.5);
      camera.position.copy(point(lon, lat).multiplyScalar(camera.position.length()));
      controles.update();
    };

    // Chaque image : coques tournées dans le sens de la marche (vu de la caméra) ; noms empilés quand des bateaux sont
    // proches à l'écran, au lieu de se chevaucher.
    const ecran = (v: THREE.Vector3) => { const q = v.clone().project(camera); return [q.x * el.clientWidth / 2, q.y * el.clientHeight / 2]; };
    function orienter() {
      const vus: { x: number; y: number; n: number; pos: THREE.Vector3 }[] = [];
      const cam = camera.position.clone().normalize();
      const { etat } = props.current;
      for (const b of etat.bateaux) {
        const e = etiquettes.get(b.id);
        if (!e || !e.pastille.visible) continue;
        const [sx, sy] = ecran(e.pastille.position);
        if (e.avant) {
          const [ax, ay] = ecran(e.avant);
          if (Math.hypot(sx - ax, sy - ay) > 0.5) (e.pastille.material as THREE.SpriteMaterial).rotation = Math.atan2(sy - ay, sx - ax) - Math.PI / 2;
        }
        if (e.pastille.position.clone().normalize().dot(cam) < 0.05) continue; // de l'autre côté du globe
        const proche = vus.find((v) => Math.hypot(v.x - sx, v.y - sy) < 24);
        const rang = proche ? ++proche.n : 0;
        if (!proche) vus.push({ x: sx, y: sy, n: 0, pos: e.pastille.position });
        // Nom posé à côté du premier bateau du groupe, une ligne plus bas par bateau.
        e.nom.position.copy(proche ? proche.pos : e.pastille.position);
        e.nom.center.set(-0.1, 0.5 + rang * 1.1);
      }
    }

    // Caméra automatique : glisse doucement vers le bateau du joueur, à une distance qui montre la région.
    function suivreBateau() {
      const { etat, moiId, positions } = props.current;
      const b = etat.bateaux.find((x) => x.id === moiId) ?? etat.bateaux.find((x) => x.type === 'humain') ?? etat.bateaux[0];
      if (!b) return;
      const p0 = positions[b.id] ?? posExacte(b);
      const cible = point(...lonLat(p0[0] + 0.5, p0[1] + 0.5));
      const d = camera.position.length();
      const dir = camera.position.clone().normalize().lerp(cible, 0.06).normalize();
      camera.position.copy(dir.multiplyScalar(d + (2.3 - d) * 0.04));
    }

    const taille = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      rendu.setSize(w, h, false);
      rendu.domElement.style.width = '100%';
      rendu.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(taille);
    ro.observe(el);
    taille();
    peindre();
    viser();
    let anim = 0;
    const boucle = () => {
      anim = requestAnimationFrame(boucle);
      if (props.current.visible === false) return;
      if (props.current.suivre) suivreBateau();
      // De près, le globe tourne moins vite sous le doigt.
      controles.rotateSpeed = Math.max(0.03, Math.min(0.5, (camera.position.length() - 1) * 0.2));
      controles.update();
      orienter();
      rendu.render(scene, camera);
    };
    boucle();
    moteur.current = { peindre, viser };
    if (props.current.zoom) props.current.zoom.current = (f: number) => {
      const d = camera.position.length();
      camera.position.setLength(Math.max(controles.minDistance, Math.min(controles.maxDistance, 1 + (d - 1) / f)));
      controles.update();
    };
    return () => {
      cancelAnimationFrame(anim);
      ro.disconnect();
      controles.dispose();
      texture.dispose();
      groupe.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material & { map?: THREE.Texture }; mat?.map?.dispose(); mat?.dispose?.(); });
      rendu.dispose();
      rendu.domElement.remove();
      moteur.current = null;
      if (props.current.zoom) props.current.zoom.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repeint quand la partie avance (au plus dix fois par seconde pendant l'animation d'un tour).
  const dernier = useRef(0);
  useEffect(() => {
    if (p.visible === false) return; // caché : repeint quand il réapparaît
    const maintenant = performance.now();
    if (maintenant - dernier.current < 100) {
      const t = setTimeout(() => moteur.current?.peindre(), 110);
      return () => clearTimeout(t);
    }
    dernier.current = maintenant;
    moteur.current?.peindre();
  }, [p.etat, p.positions, p.visible]);

  // Suit le bateau du joueur : au bouton « Centrer » et à chaque nouveau tour.
  useEffect(() => {
    moteur.current?.viser();
  }, [p.centrer, p.etat.tour]);

  return <div ref={boite} className="globe" style={{ display: p.visible === false ? 'none' : undefined }} aria-label="Globe de la course" role="img" />;
}
