// Génère les cartes RÉALISTES des courses atlantiques à partir des côtes Natural Earth 1:50 m (domaine public,
// paquet npm « world-atlas »). Projection de Mercator, comme les cartographies des grandes courses.
// Usage : npx tsx outils/generer-carte-rhum.ts [route-du-rhum|transat-cafe-lor]   (sans argument : toutes)
// Écrit packages/data/courses/<id>.json (règles et quadrillage de jeu)
// et packages/data/courses/<id>-trace.json (tracé des côtes pour l'affichage).
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import type { MultiPolygon, Polygon } from 'geojson';
import { COURSES, type ConfigCourse } from './courses-atlantique';
import { COURSES_MONDE, type ConfigMonde } from './courses-monde';

// Sans argument : les courses atlantiques seulement (les tours du monde se demandent par leur nom).
const voulues: ConfigMonde[] = process.argv[2] ? [...COURSES, ...COURSES_MONDE].filter((c) => c.id === process.argv[2]) : COURSES;
for (const cfg of voulues) generer(cfg);

function generer(cfg: ConfigMonde) {
const L = cfg.cadre?.largeur ?? 120; // largeur du quadrillage, en cases
const LON_MIN = cfg.cadre?.lonMin ?? -66;
const LON_MAX = cfg.cadre?.lonMax ?? 4;
const LAT_MAX = cfg.cadre?.latMax ?? 55;
const RAD = Math.PI / 180;
const cellRad = ((LON_MAX - LON_MIN) * RAD) / L;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const H = cfg.hauteur;
const yMax = mercY(LAT_MAX);
const LAT_MIN = (2 * Math.atan(Math.exp(yMax - H * cellRad)) - Math.PI / 2) / RAD;

/** Projection (lon, lat) → coordonnées en cases (x vers l'est, y vers le sud). */
const proj = (lon: number, lat: number): [number, number] => [(lon - LON_MIN) * RAD / cellRad, (yMax - mercY(lat)) / cellRad];

// ---------- Côtes
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-50m.json', 'utf-8'));
const land = feature(topo, topo.objects.land) as unknown as { features?: { geometry: MultiPolygon | Polygon }[]; geometry?: MultiPolygon };
const geoms = land.features ? land.features.map((f) => f.geometry) : [land.geometry!];
const polygones: [number, number][][][] = [];
for (const g of geoms) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  // Tours du monde (12/11/2026) : côtes recopiées à +360° pour une carte de plus d'un tour ; latitude bornée (le contour
  // de l'Antarctique descend au pôle, à l'infini en Mercator).
  for (const dl of cfg.decalages ?? [0])
    for (const p of polys) polygones.push(p.map((ring) => ring.map(([lon, lat]) => proj(lon + dl, Math.max(-85, lat)))));
}
// On ne garde que les polygones qui touchent la carte (avec une marge).
const dansZone = (poly: [number, number][][]) => poly[0].some(([x, y]) => x > -6 && x < L + 6 && y > -6 && y < H + 6);
const visibles = polygones.filter(dansZone).map((poly) => {
  const xs = poly[0].map((p) => p[0]), ys = poly[0].map((p) => p[1]);
  return { poly, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});

function dansAnneau(x: number, y: number, r: [number, number][]) {
  let dedans = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
// Terre ou mer (accéléré le 12/11/2026 pour la carte du monde, même résultat) : pour chaque ordonnée testée, on relève
// une fois les abscisses où les contours (extérieurs et lacs) coupent la ligne ; un point est à terre si un nombre impair
// de ces coupures est à sa gauche.
const coupures = new Map<number, Float64Array>();
function coupuresA(y: number): Float64Array {
  let c = coupures.get(y);
  if (c) return c;
  const xs: number[] = [];
  for (const { poly, bbox } of visibles) {
    if (y < bbox[1] || y > bbox[3]) continue;
    for (const r of poly)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
  }
  c = Float64Array.from(xs).sort();
  coupures.set(y, c);
  return c;
}
function surTerre(x: number, y: number) {
  const c = coupuresA(y);
  let n = 0;
  while (n < c.length && c[n] < x) n++;
  return n % 2 === 1;
}
void dansAnneau;
function aire(r: [number, number][]) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

// ---------- Quadrillage : une case est terre si la majorité de ses 9 points de contrôle est sur terre.
const g: string[][] = Array.from({ length: H }, () => Array(L).fill('.'));
for (let y = 0; y < H; y++)
  for (let x = 0; x < L; x++) {
    let n = 0;
    for (const dy of [0.17, 0.5, 0.83]) for (const dx of [0.17, 0.5, 0.83]) if (surTerre(x + dx, y + dy)) n++;
    if (n >= 5) g[y][x] = '#';
  }
// Petites îles (Açores, Madère, Canaries, Antilles…) : on garde au moins leur case centrale.
for (const { poly, bbox } of visibles) {
  const a = aire(poly[0]);
  if (a < (cfg.ile_min ?? 0.08)) continue; // petites îles gardées (Scilly sur la carte du Fastnet)
  const cx = Math.floor((bbox[0] + bbox[2]) / 2), cy = Math.floor((bbox[1] + bbox[3]) / 2);
  if (cx < 0 || cy < 0 || cx >= L || cy >= H) continue;
  let deja = false;
  for (let y = Math.floor(bbox[1]); y <= Math.floor(bbox[3]); y++)
    for (let x = Math.floor(bbox[0]); x <= Math.floor(bbox[2]); x++) if (g[y]?.[x] === '#') deja = true;
  if (!deja) g[cy][cx] = '#';
}

// Terre fine (correction du 10/11/2026 : une presqu'île plus étroite qu'une case, comme le Cotentin, était traversée) :
// pour chaque case de mer, 16 sous-cases (4 × 4) relevées sur le vrai tracé des côtes. Les 4 sous-cases du centre restent
// en mer : un bateau posé au centre d'une case de mer (départ, port, arrivée) n'est jamais coincé.
const TERRE_FINE: string[] = [];
function releverTerreFine() {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < L; x++) {
      if (g[y][x] === '#') continue;
      let m = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          if ((sx === 1 || sx === 2) && (sy === 1 || sy === 2)) continue;
          if (surTerre(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) m |= 1 << (sy * 4 + sx);
        }
      if (m) TERRE_FINE.push(`${x},${y},${m}`);
    }
}

// Îles absentes des côtes Natural Earth au 1:50 m (Scilly) : cases de terre ajoutées d'après leurs coordonnées.
for (const [lon, lat] of cfg.iles ?? []) {
  const [x, y] = proj(lon, lat);
  if (g[Math.floor(y)]?.[Math.floor(x)] === '.') g[Math.floor(y)][Math.floor(x)] = '#';
}
const caseDe = (lon: number, lat: number): [number, number] => {
  const [x, y] = proj(lon, lat);
  return [Math.floor(x), Math.floor(y)];
};
const mer = (x: number, y: number) => g[y]?.[x] === '.';
function casesMerProches(lon: number, lat: number, n: number): [number, number][] {
  const [px, py] = proj(lon, lat);
  const c: [number, number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) if (mer(x, y)) c.push([x, y, Math.hypot(x + 0.5 - px, y + 0.5 - py)]);
  return c.sort((a, b) => a[2] - b[2]).slice(0, n).map(([x, y]) => [x, y]);
}

// ---------- Départ, arrivée, ports
const DEPART = casesMerProches(cfg.depart.zone[0], cfg.depart.zone[1], 8);
for (const [x, y] of DEPART) g[y][x] = 'S';
const [pax, pay] = cfg.centre_arrivee ? proj(cfg.centre_arrivee[0], cfg.centre_arrivee[1]) : proj(cfg.arrivee.lon, cfg.arrivee.lat);
const ARRIVEE: [number, number][] = [];
for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) if (mer(x, y) && Math.hypot(x + 0.5 - pax, y + 0.5 - pay) <= (cfg.rayon_arrivee ?? 1.6)) ARRIVEE.push([x, y]);
for (const [x, y] of ARRIVEE) g[y][x] = 'A';
const PORTS: Record<string, [number, number]> = cfg.ports;
const portsCases: Record<string, [number, number]> = {};
for (const [nom, [lon, lat]] of Object.entries(PORTS)) {
  const [x, y] = casesMerProches(lon, lat, 1)[0];
  g[y][x] = 'P';
  portsCases[nom] = [x, y];
}

const rect = (lonA: number, latA: number, lonB: number, latB: number): [number, number, number, number] => {
  const [x0, y0] = caseDe(lonA, latB), [x1, y1] = caseDe(lonB, latA);
  return [x0, y0, x1, y1];
};

/** Cases de mer traversées par un segment (lon, lat) → (lon, lat) : une « ligne » à franchir. */
function ligne(a: [number, number], b: [number, number]): number[][] {
  const [x0, y0] = proj(a[0], a[1]), [x1, y1] = proj(b[0], b[1]);
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4) + 1;
  const vu = new Set<string>();
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(x0 + ((x1 - x0) * i) / n), y = Math.floor(y0 + ((y1 - y0) * i) / n);
    if (!mer(x, y) && g[y]?.[x] !== 'P') continue;
    const k = `${x},${y}`;
    if (!vu.has(k)) { vu.add(k); out.push([x, y]); }
  }
  return out;
}
const marques = (cle: string) => (cfg.marques[cle] ?? []).map((m) => ({ id: m.id, nom: m.nom, type: 'marque' as const, ...(m.bouee ? { bouee: true } : {}), ...(m.cachee ? { cachee: true } : {}), ...(m.cardinale ? { cardinale: m.cardinale } : {}), ...(m.bouee ? { position: proj(m.de[0], m.de[1]).map((v) => Math.round(v * 100) / 100) } : {}), cases: ligne(m.de, m.a) }));
const porteArrivee = { id: 'arrivee', nom: `Arrivée · ${cfg.arrivee.nom}`, type: 'arrivee' as const, cases: ARRIVEE };
// « * » : mêmes marques pour toutes les classes (Fastnet) ; sinon un parcours par classe (Transat Café L'Or).
const communes = cfg.marques['*'] ? [...marques('*'), porteArrivee] : null;
const portesParClasse = !communes && Object.keys(cfg.marques).length
  ? Object.fromEntries(Object.keys(cfg.marques).map((k) => [k, [...marques(k), porteArrivee]]))
  : undefined;

// ---------- Tracé des côtes pour l'affichage (simplifié, coordonnées en cases)
const traces: number[][] = [];
for (const { poly } of visibles)
  for (const ring of poly) {
    const out: number[] = [];
    let px = Infinity, py = Infinity;
    for (const [x, y] of ring) {
      if (Math.hypot(x - px, y - py) < 0.12) continue;
      out.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100);
      px = x;
      py = y;
    }
    if (out.length >= 6) traces.push(out);
  }
// Petites îles absentes du 1:50 m (Scilly) : les cases de terre ajoutées sont dessinées (octogones), pour qu'on voie
// l'obstacle qui bloque vraiment le passage (demande du porteur de projet, 12/11/2026).
if (cfg.traces_detail) {
  const [o, s, e, n] = cfg.traces_detail;
  const vues = new Set<string>();
  for (const [lon, lat] of cfg.iles ?? []) {
    if (lon < o || lon > e || lat < s || lat > n) continue;
    const [x, y] = proj(lon, lat).map(Math.floor);
    if (g[y]?.[x] !== '#' || vues.has(`${x},${y}`)) continue;
    vues.add(`${x},${y}`);
    const c = 0.25; // coins coupés
    traces.push([x + c, y, x + 1 - c, y, x + 1, y + c, x + 1, y + 1 - c, x + 1 - c, y + 1, x + c, y + 1, x, y + 1 - c, x, y + c]);
  }
}
// Orthodromie Saint-Malo → Pointe-à-Pitre (la « route directe » des trackers)
function orthodromie(lon1: number, lat1: number, lon2: number, lat2: number, n = 60) {
  const [φ1, λ1, φ2, λ2] = [lat1 * RAD, lon1 * RAD, lat2 * RAD, lon2 * RAD];
  const d = Math.acos(Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1));
  const pts: number[] = [];
  let lonPrec = lon1;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lon = Math.atan2(y, x) / RAD;
    while (lon - lonPrec > 180) lon -= 360;
    while (lon - lonPrec < -180) lon += 360;
    lonPrec = lon;
    const [px, py] = proj(lon, Math.atan2(z, Math.hypot(x, y)) / RAD);
    pts.push(Math.round(px * 100) / 100, Math.round(py * 100) / 100);
  }
  return { pts, milles: Math.round((d / RAD) * 60) };
}
// Loxodromie (route à cap constant, droite sur la carte) : tours du monde, où l'orthodromie entre deux caps plongerait
// vers l'Antarctique, bien au sud de la zone d'exclusion des glaces.
function loxodromie(lon1: number, lat1: number, lon2: number, lat2: number, n = 30) {
  const pts: number[] = [];
  let milles = 0;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const [px, py] = proj(lon1 + (lon2 - lon1) * f, lat1 + (lat2 - lat1) * f);
    pts.push(Math.round(px * 100) / 100, Math.round(py * 100) / 100);
  }
  for (let i = 0; i < n; i++) {
    const la = lat1 + ((lat2 - lat1) * (i + 0.5)) / n;
    milles += 60 * Math.hypot(((lon2 - lon1) / n) * Math.cos(la * RAD), (lat2 - lat1) / n);
  }
  return { pts, milles: Math.round(milles) };
}
// Route directe : en deux morceaux par le point de passage s'il y en a un (Rhum : bouée au nord de la Guadeloupe, 12/11/2026).
const etapes = cfg.vias ? [[cfg.depart.lon, cfg.depart.lat], ...cfg.vias, [cfg.arrivee.lon, cfg.arrivee.lat]] : null;
const ortho = etapes
  ? etapes.slice(1).reduce((acc, p, i) => {
    const o = (cfg.distance_reelle ? loxodromie : orthodromie)(etapes[i][0], etapes[i][1], p[0], p[1]);
    return { pts: [...acc.pts, ...o.pts], milles: acc.milles + o.milles };
  }, { pts: [] as number[], milles: 0 })
  : cfg.via
  ? (() => {
    const a = orthodromie(cfg.depart.lon, cfg.depart.lat, cfg.via![0], cfg.via![1]), b = orthodromie(cfg.via![0], cfg.via![1], cfg.arrivee.lon, cfg.arrivee.lat);
    return { pts: [...a.pts, ...b.pts], milles: a.milles + b.milles };
  })()
  : orthodromie(cfg.depart.lon, cfg.depart.lat, cfg.arrivee.lon, cfg.arrivee.lat);

const lieu = (nom: string, lon: number, lat: number, type: string) => {
  const [x, y] = proj(lon, lat);
  return { nom, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, type };
};

// Météo mondiale (tours du monde) : positions en cases, rayons et vitesses convertis à la latitude (Mercator : une case
// fait 60 × cos(latitude) milles dans les deux sens, une dépression reste ronde).
function meteoMondiale(m: NonNullable<ConfigMonde['meteo']>, heures: number) {
  const degCase = (LON_MAX - LON_MIN) / L;
  const cases = (milles: number, lat: number) => Math.round((milles / (60 * Math.cos(lat * RAD)) / degCase) * 10) / 10;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    anticyclones: m.anticyclones.map((a) => {
      const [x, y] = proj(a.lon, a.lat);
      const r = cases(a.rayon_milles, a.lat);
      return { nom: a.nom, x: r2(x), y: r2(y), rx: r, ry: r, forces: a.forces, hemisphere: a.hemisphere };
    }),
    depressions: m.depressions.map((p) => {
      const [x0, y0] = proj(p.lonA, Math.max(p.latA, p.latB)), [x1, y1] = proj(p.lonB, Math.min(p.latA, p.latB));
      const lat = (p.latA + p.latB) / 2;
      return {
        nom: p.nom, rect: [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(L - 1, Math.floor(x1)), Math.min(H - 1, Math.floor(y1))],
        hemisphere: p.hemisphere, rayons: [cases(p.rayon_milles[0], lat), cases(p.rayon_milles[1], lat)],
        vx: cases(p.noeuds * heures, lat), forces: p.forces, directions: p.directions, bascule: p.bascule, baisse: p.baisse,
        probabilite: p.probabilite, max: p.max, duree: p.duree, annonce: p.annonce,
      };
    }),
  };
}

releverTerreFine();
const course = {
  _note: cfg.note,
  id: cfg.id,
  nom: cfg.nom,
  sous_titre: cfg.sous_titre,
  classes_autorisees: cfg.classes,
  ...(cfg.double ? { double: true } : {}),
  regle_escale: cfg.regle_escale ?? { type: 'libre', tours: 0, statut_validation: 'provisoire' },
  ...(cfg.distance_reelle ? { distance_reelle: true } : {}),
  ...(cfg.tours_max ? { tours_max: cfg.tours_max } : {}),
  ...(cfg.meteo ? { meteo_mondiale: meteoMondiale(cfg.meteo, cfg.heures_par_tour ?? 22) } : {}),
  heures_par_tour: cfg.heures_par_tour ?? 22,
  duree_cible_tours: cfg.duree_cible_tours ?? [12, 18],
  ...(cfg.vitesse_unique ? { vitesse_unique: true } : {}),
  ...(cfg.echelle_classe ? { echelle_classe: cfg.echelle_classe } : {}),
  url_fiche_site: '',
  vent_initial: cfg.vent_initial ?? { direction: 14, force: 4 },
  echelle: cfg.echelle ?? 2.5,
  milles_par_case: cfg.milles_par_case ?? 30,
  orthodromie_milles: ortho.milles,
  ...(cfg.via || cfg.vias ? { route_directe: true } : {}),
  ...(cfg.centre_arrivee ? { centre_arrivee: [Math.round(pax * 100) / 100, Math.round(pay * 100) / 100] } : {}),
  ...(cfg.distances ? { distances_officielles: cfg.distances } : {}),
  ...(cfg.tours_estimes ? { tours_estimes: cfg.tours_estimes } : {}),
  projection: { type: 'mercator', lon_min: LON_MIN, lon_max: LON_MAX, lat_max: LAT_MAX, lat_min: Math.round(LAT_MIN * 1000) / 1000 },
  carte: {
    largeur: L,
    hauteur: H,
    bouclage_horizontal: false,
    legende: { '.': 'mer', '#': 'terre', '~': 'haut_fond', P: 'port', S: 'depart', A: 'arrivee' },
    lignes: g.map((r) => r.join('')),
    terre_fine: TERRE_FINE.join(';'),
  },
  portes: communes ?? (portesParClasse ? portesParClasse[cfg.classes[0]] : [porteArrivee]),
  ...(portesParClasse ? { portes_par_classe: portesParClasse } : {}),
  zones_meteo: cfg.zones(rect),
  zones_cotieres: { rayon: cfg.rayon_cotier ?? 3, autour: ['depart', 'arrivee'] },
  lieux: [
    ...cfg.lieux.map(([nom, lon, lat, type]) => lieu(nom, lon, lat, type)),
    ...Object.entries(portsCases).map(([nom, [x, y]]) => ({ nom, x: x + 0.5, y: y + 0.5, type: 'port' })),
  ],
  record_reference: null,
};

writeFileSync(`packages/data/courses/${cfg.id}.json`, JSON.stringify(course, null, 1), 'utf-8');
writeFileSync(`packages/data/courses/${cfg.id}-trace.json`, JSON.stringify({ cotes: traces, orthodromie: ortho.pts }), 'utf-8');
if (process.env.VOIR) console.log(g.map((r) => r.join('')).join('\n'));
console.log(`Carte ${L} × ${H}, latitudes ${LAT_MIN.toFixed(1)} à ${LAT_MAX} ; ${traces.length} tracés ; orthodromie ${ortho.milles} milles`);
console.log('Départ', DEPART, 'Arrivée', ARRIVEE.length, 'cases', 'Ports', portsCases);
}
