// Images libres de droit des bateaux, depuis Wikimedia Commons, dans donnees/site/commons/ (hors du site publié).
// Un bateau n'est retenu que par une catégorie Commons à son nom et datée de son année de construction
// (« Category:Charal (ship, 2018) ») : un même nom porté par deux bateaux ne mélange pas leurs photos.
// Seules les licences libres sont gardées (CC0, domaine public, CC BY, CC BY-SA ; jamais NC ni ND), avec
// l'auteur, la licence et la page source, à citer sous chaque photo.
// Usage : node tools/commons.mjs [délai ms] [photos max par bateau]
// Séries actuelles d'abord ; une requête à la fois ; reprend là où il s'est arrêté (donnees/site/commons/index.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Racine du dépôt : les chemins ne dépendent pas du dossier d'où l'on lance le script.
const REPO = fileURLToPath(new URL('../../', import.meta.url));
import { fold } from '../../site/tools/lib/parse.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const OUT = path.join(REPO, 'donnees/site/commons');
const FILES = path.join(OUT, 'files');
const INDEX = path.join(OUT, 'index.json');
const UA = { 'User-Agent': 'MemoireDuLarge/1.0 (https://histoire-des-halfs.pages.dev; boat history reference) node-fetch' };
const ORDER = ['IMOCA 60', 'Ultim', 'Ocean Fifty', 'MOD 70', 'ORMA 60′', 'Maxis et G Class', 'Class 40', 'Figaro Bénéteau', 'Mini 6.50', 'Half Tonners', 'Trois-quarts Tonners', 'Quarter Tonners'];
const UNIQUE_NAMES = new Set(['IMOCA 60', 'Ultim', 'Ocean Fifty', 'MOD 70', 'ORMA 60′', 'Maxis et G Class']);
const FREE =/^(cc0|public domain|pd\b|cc[ -]by(?:-sa)?[ -]\d)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const key = (s) => fold(String(s || '').replace(/\s*\(\d\)\s*$/, '')).replace(/^maxi\s+/, '').replace(/[^a-z0-9]/g, '');

let delay = Number(process.argv[2] || 1500);
const perBoat = Number(process.argv[3] || 4);
fs.mkdirSync(FILES, { recursive: true });
const index = readJson(INDEX, {});
// ONLY=imoca/charal/,ultim/… : essai sur quelques fiches, sans rien enregistrer.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const boats = readJson(path.join(REPO, 'site/public/data/bateaux.json'), []).filter((b) => b.fiche && (ONLY ? ONLY.includes(b.fiche) : !index[b.fiche]))
  .sort((a, b) => (ORDER.indexOf(a.classe) + 1 || 99) - (ORDER.indexOf(b.classe) + 1 || 99));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0, wait = 15000; attempt < 6; attempt++, wait *= 2) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (res.status === 429 || res.status >= 500) { console.log(`${res.status}, pause ${wait / 1000}s`); delay = Math.min(delay * 1.5, 10000); await sleep(wait); continue; }
      await sleep(delay);
      return await res.json();
    } catch (e) { console.log(`Erreur réseau (${e.message}), pause ${wait / 1000}s`); await sleep(wait); }
  }
  return null;
}

// Catégorie Commons du bateau : « Nom (ship, année) », l'année à un an près de celle de la base. Une catégorie peut
// réunir deux noms (« Gitana 17-Maxi Edmond de Rothschild (ship, 2017) ») ; « Charal (2) » s'y écrit « Charal 2 ».
// Sans année (« Sodebo Ultim 3 »), seulement pour un nom numéroté, qu'un seul bateau a porté.
async function categoryOf(b) {
  const names = [...new Set([b.actuel, b.bapteme, ...(b.noms || [])].filter(Boolean).flatMap((n) => [n, n.replace(/\s*\((\d)\)\s*$/, ' $1')]))];
  const keys = new Set(names.map(key));
  const year = Number(b.annee) || 0;
  for (const n of names) {
    const r = await api({ action: 'query', list: 'search', srnamespace: '14', srlimit: '10', srsearch: `intitle:"${n.replace(/\s*\(\d\)\s*$/, '').replace(/"/g, '')}"` });
    for (const hit of r?.query?.search || []) {
      const dated = hit.title.match(/^Category:(.+?) \((?:ship|boat|yacht|sailboat), (\d{4})\)$/);
      const bare = hit.title.match(/^Category:([^()]+)$/);
      const base = dated?.[1] || bare?.[1];
      if (!base || ![base, ...base.split(/\s*[-–\/]\s*/)].some((p) => keys.has(key(p)))) continue;
      if (dated && year && Math.abs(Number(dated[2]) - year) <= 1) return hit.title;
      // Pas pour les séries de petits bateaux, où un nom numéroté est souvent un modèle (« Pogo 2 »).
      if (bare && UNIQUE_NAMES.has(b.classe) && /\d|\b[IVX]{1,4}$/.test(base) && keys.has(key(base))) return hit.title;
    }
  }
  return null;
}

let done = 0, found = 0, photos = 0;
console.log(`${boats.length} fiches à examiner (${Object.keys(index).length} déjà faites)`);
for (const b of boats) {
  const cat = await categoryOf(b);
  const entry = { classe: b.classe, nom: b.actuel || b.bapteme, categorie: cat, photos: [] };
  if (cat) {
    found++;
    const r = await api({ action: 'query', generator: 'categorymembers', gcmtitle: cat, gcmtype: 'file', gcmlimit: '30', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1280' });
    const pages = (r?.query?.pages || []).filter((p) => /^image\/(jpeg|png)$/.test(p.imageinfo?.[0]?.mime || ''));
    for (const p of pages) {
      if (entry.photos.length >= perBoat) break;
      const ii = p.imageinfo[0], md = ii.extmetadata || {};
      const licence = strip(md.LicenseShortName?.value);
      if (!FREE.test(licence) || /\b(nc|nd)\b/i.test(licence)) continue;
      const file = `${b.fiche.replace(/\/$/, '').replace(/\//g, '__')}__${p.pageid}${ii.mime === 'image/png' ? '.png' : '.jpg'}`;
      const res = await fetch(ii.thumburl || ii.url, { headers: UA, signal: AbortSignal.timeout(120000) }).catch(() => null);
      await sleep(delay);
      if (!res?.ok) continue;
      fs.writeFileSync(path.join(FILES, file), Buffer.from(await res.arrayBuffer()));
      entry.photos.push({ fichier: file, titre: p.title, page: ii.descriptionurl, licence, licenceUrl: strip(md.LicenseUrl?.value) || null, auteur: strip(md.Artist?.value) || null, date: strip(md.DateTimeOriginal?.value) || null, description: strip(md.ImageDescription?.value).slice(0, 300) || null });
      photos++;
    }
  }
  if (ONLY) { console.log(JSON.stringify({ fiche: b.fiche, ...entry, photos: entry.photos.map((p) => `${p.titre} | ${p.licence} | ${p.auteur}`) })); continue; }
  index[b.fiche] = entry;
  done++;
  if (done % 10 === 0 || cat) fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  if (cat) console.log(`${b.classe} · ${entry.nom} → ${cat} : ${entry.photos.length} photo(s)`);
  if (done % 50 === 0) console.log(`${done}/${boats.length} fiches, ${found} catégories, ${photos} photos`);
}
fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
console.log(`Terminé : ${done} fiches examinées, ${found} catégories Commons, ${photos} photos libres.`);
