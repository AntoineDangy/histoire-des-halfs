// Aspire les fiches bateaux du site officiel de la classe IMOCA (https://www.imoca.org/fr/bateaux), une requête à la fois,
// et en extrait les faits (nom, numéro de voile, skipper, nom de baptême, architecte, construction, mise à l'eau, foils)
// et le palmarès (année, course, rang, skipper, temps). Reprise : une page déjà enregistrée n'est jamais retéléchargée.
// Usage : node outils/scraping/imoca.mjs   (une à deux minutes)
// Sorties : donnees/site/imoca.org/html/<fiche>.html (pages telles quelles) et donnees/site/imoca.org/bateaux.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const OUT = path.join(REPO, 'donnees/site/imoca.org');
const ROOT = 'https://www.imoca.org';
const UA = { 'User-Agent': 'MemoireDuLarge/1.0 (https://histoire-des-halfs.pages.dev; boat history reference) node-fetch' };
const PAUSE = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
    if (res.ok) return await res.text();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    const wait = 30000 * 2 ** attempt;
    console.log(`${res.status}, nouvel essai dans ${wait / 1000} s`);
    await sleep(wait);
  }
  throw new Error(`abandon ${url}`);
}

const txt = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

function lire(html, slug, voile) {
  const f = { fiche: `${ROOT}/fr/bateaux/${slug}`, nom: txt((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]), numero: voile || null };
  const sk = html.match(/PageHeroBoat-skipper[^>]*>([\s\S]*?)<\/p>/);
  f.skipper = sk ? txt(sk[1]) : null;
  const LIB = { 'nom de baptème': 'bapteme', 'nom de baptême': 'bapteme', 'architecte': 'architecte', 'construction': 'construction', "date de mise à l'eau": 'mise_a_l_eau', 'foils': 'foils' };
  for (const m of html.matchAll(/<tr><th>([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)) {
    const k = LIB[txt(m[1]).toLowerCase()];
    if (k) f[k] = txt(m[2]);
  }
  const c = (f.construction || '').match(/^(\d{4})\s*,\s*(.*)$/);
  if (c) { f.annee = +c[1]; f.chantier = c[2]; }
  const pal = html.match(/Palmar[eè]s<\/h2>([\s\S]*?)<\/table>/i);
  f.palmares = pal ? [...pal[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => txt(x[1])))
    .filter((r) => r.length >= 4).map(([annee, course, rang, skipper, temps]) => ({ annee, course, rang, skipper, temps: temps || '' })) : [];
  return f;
}

fs.mkdirSync(path.join(OUT, 'html'), { recursive: true });
const liste = await get(`${ROOT}/fr/bateaux`);
fs.writeFileSync(path.join(OUT, 'bateaux.html'), liste);
// Liste : chaque carte mène à une fiche ; le numéro de voile suit le nom dans la carte.
const cartes = new Map();
const parts = liste.split(/(?=<a[^>]+href="\/fr\/bateaux\/[^"]+")/);
for (const p of parts) {
  const m = p.match(/^<a[^>]+href="\/fr\/bateaux\/([^"/?#]+)"/);
  if (!m) continue;
  const t = txt(p.slice(0, 3000).split(/<a[^>]+href="\/fr\/(?!bateaux\/)/)[0]);
  const v = t.match(/\b([A-Z]{3}\s?\d{1,4}|\d{3,4})\b(?!.*\b[A-Z]{3}\s?\d)/);
  if (!cartes.has(m[1]) || (!cartes.get(m[1]) && v)) cartes.set(m[1], v ? v[1] : cartes.get(m[1]) || null);
}
console.log(`${cartes.size} fiches dans la liste`);
const res = [];
let nouvelles = 0;
for (const [slug, voile] of cartes) {
  const file = path.join(OUT, 'html', `${slug}.html`);
  if (!fs.existsSync(file)) {
    await sleep(PAUSE);
    try { fs.writeFileSync(file, await get(`${ROOT}/fr/bateaux/${slug}`)); nouvelles++; } catch (e) { console.log(`Échec : ${e.message}`); continue; }
  }
  res.push(lire(fs.readFileSync(file, 'utf8'), slug, voile));
}
res.sort((a, b) => a.nom.localeCompare(b.nom));
fs.writeFileSync(path.join(OUT, 'bateaux.json'), JSON.stringify({ source: `${ROOT}/fr/bateaux`, date: new Date().toISOString().slice(0, 10), bateaux: res }, null, 1));
console.log(`${res.length} fiches lues (${nouvelles} nouvelles) → donnees/site/imoca.org/bateaux.json`);
