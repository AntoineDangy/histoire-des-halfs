// Complète donnees/site/html avec les dernières captures de la Wayback Machine (web.archive.org),
// en attendant que l'aspiration du site d'origine (crawl.mjs) les remplace par la version à jour.
// Usage :
//   node outils/scraping/wayback.mjs index                      -> donnees/site/wayback-index.json (dernière capture HTML de chaque page)
//   node outils/scraping/wayback.mjs fetch [délai ms] [dossiers prioritaires séparés par des virgules]
// Ne remplace jamais une page déjà récupérée en direct (statut 200 dans donnees/site/inventory.json).
// Les pages issues de l'archive sont notées dans donnees/site/wayback.json, avec la date de capture.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Racine du dépôt : les chemins ne dépendent pas du dossier d'où l'on lance le script.
const REPO = fileURLToPath(new URL('../../', import.meta.url));
import { isChallenge } from '../../site/tools/lib/source.mjs';

const OUT = path.join(REPO, 'donnees/site');
const INDEX = path.join(OUT, 'wayback-index.json');
const DONE = path.join(OUT, 'wayback.json');
const INVENTORY = path.join(OUT, 'inventory.json');
const UA = { 'User-Agent': 'histoire-des-halfs-redesign/1.0 (archive reader, one request at a time)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// Chemin relatif à la racine du site, décodé comme le fait crawl.mjs ; les anciens liens en latin-1 (%E9) sont gérés.
function relOf(original) {
  let p;
  try { p = new URL(original).pathname; } catch { return null; }
  let rel;
  try { rel = decodeURIComponent(p); }
  catch { rel = new TextDecoder('windows-1252').decode(Uint8Array.from(unescape(p), (c) => c.charCodeAt(0))); }
  rel = rel.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.htm';
  return /\.html?$/i.test(rel) ? rel : null;
}

async function get(url, tries = 8) {
  let wait = 20000;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) });
      if (res.status !== 429 && res.status < 500) return res;
      console.log(`${res.status} sur ${url}, pause ${wait / 1000}s`);
    } catch (e) { console.log(`Erreur réseau (${e.message}), pause ${wait / 1000}s`); }
    await sleep(wait);
    wait = Math.min(wait * 2, 600000);
  }
  throw new Error(`Abandon après ${tries} essais : ${url}`);
}

async function buildIndex() {
  const base = 'https://web.archive.org/cdx/search/cdx?url=histoiredeshalfs.com/*&output=json&fl=original,timestamp,statuscode,mimetype&filter=statuscode:200';
  const pages = Number(await (await get(`https://web.archive.org/cdx/search/cdx?url=histoiredeshalfs.com/*&showNumPages=true`)).text());
  const latest = readJson(INDEX, {});
  for (let p = 0; p < pages; p++) {
    const rows = await (await get(`${base}&page=${p}`)).json().catch(() => []);
    let n = 0;
    for (const [original, timestamp, , mimetype] of rows.slice(1)) {
      if (mimetype && !/html/i.test(mimetype)) continue;
      const rel = relOf(original);
      if (!rel) continue;
      if (!latest[rel] || latest[rel].timestamp < timestamp) { latest[rel] = { original, timestamp }; n++; }
    }
    fs.writeFileSync(INDEX, JSON.stringify(latest));
    console.log(`Index page ${p + 1}/${pages} : ${rows.length - 1} captures, ${Object.keys(latest).length} pages HTML distinctes`);
    await sleep(3000);
  }
}

async function fetchPages(delayArg, prioArg) {
  let delay = Number(delayArg || 2000);
  const MIN = 1500;
  const index = readJson(INDEX, null);
  if (!index) throw new Error('Lancer d’abord : node outils/scraping/wayback.mjs index');
  const done = readJson(DONE, {});
  const prio = (prioArg || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Les fiches citées par les listes du nouveau site mais pas encore récupérées passent avant tout (notées par build.mjs).
  const wanted = new Set(Object.values(readJson(path.join(OUT, 'missing-dossiers.json'), {})).flat());
  // Le Figaro d'abord (Solitaire et fiches) : la plupart des skippers du large y ont fait leurs classes.
  const rank = (rel) => { if (/figaro|solitaire/i.test(rel)) return -2; if (wanted.has(rel)) return -1; const i = prio.findIndex((p) => rel.startsWith(p)); return i < 0 ? prio.length : i; };
  // Dans une série, les fiches bateau (« M13.htm », « A52 Hugo Boss.htm », « CQ37.htm », « 626.htm ») passent avant les articles.
  const isFiche = (rel) => (/^(?:[A-Za-z]{0,4}\s?\d{1,4}[a-z]?)(?:\s[^/]*)?\.html?$/i.test(path.basename(rel)) ? 0 : 1);
  const todo = Object.keys(index).filter((rel) => !done[rel]).sort((a, b) => rank(a) - rank(b) || isFiche(a) - isFiche(b));
  console.log(`${todo.length} pages à récupérer depuis l'archive`);
  let n = 0;
  for (const rel of todo) {
    // Relu régulièrement : l'aspiration en direct avance en parallèle.
    if (n % 20 === 0) var live = readJson(INVENTORY, {});
    const liveUrl = 'https://www.histoiredeshalfs.com/' + rel;
    if (live[liveUrl]?.status === 200) continue;
    const { original, timestamp } = index[rel];
    const res = await get(`https://web.archive.org/web/${timestamp}id_/${original}`);
    const okBuf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    if (okBuf && isChallenge(okBuf.toString('latin1'))) {
      // Capture de l'écran anti-robots : à remplacer par une capture plus ancienne (mode « repair »).
      done[rel] = { timestamp, challenge: true };
    } else if (res.ok) {
      const buf = okBuf;
      const file = path.join(OUT, 'html', ...rel.split('/'));
      // Une version récupérée en direct entre-temps a priorité.
      if (!(readJson(INVENTORY, {})[liveUrl]?.status === 200)) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buf);
        done[rel] = { timestamp, bytes: buf.length };
      }
      delay = Math.max(MIN, delay * 0.95);
    } else {
      done[rel] = { timestamp, status: res.status };
      delay = Math.min(delay * 1.5, 30000);
    }
    n++;
    if (n % 10 === 0) {
      fs.writeFileSync(DONE, JSON.stringify(done));
      console.log(`${n}/${todo.length} pages archivées traitées (délai ${Math.round(delay / 100) / 10}s)`);
    }
    await sleep(delay);
  }
  fs.writeFileSync(DONE, JSON.stringify(done));
  console.log(`Terminé : ${Object.values(done).filter((d) => d.bytes).length} pages issues de l'archive`);
}

// Pages dont la dernière capture est l'écran anti-robots : on remonte les captures précédentes jusqu'à une page valide.
async function repair() {
  const done = readJson(DONE, {});
  const live = readJson(INVENTORY, {});
  // Pages déjà enregistrées qui sont en réalité l'écran anti-robots (avant la détection) : à réparer aussi.
  for (const [rel, v] of Object.entries(done)) {
    const file = path.join(OUT, 'html', ...rel.split('/'));
    if (v.bytes && fs.existsSync(file) && isChallenge(fs.readFileSync(file).toString('latin1'))) { done[rel] = { ...v, challenge: true }; fs.rmSync(file); }
  }
  const todo = Object.entries(done).filter(([rel, v]) => v.challenge && live[`https://www.histoiredeshalfs.com/${rel}`]?.status !== 200);
  console.log(`${todo.length} pages à réparer`);
  for (const [rel, v] of todo) {
    const original = readJson(INDEX, {})[rel]?.original || `http://www.histoiredeshalfs.com/${rel.split('/').map(encodeURIComponent).join('/')}`;
    const rows = await (await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(original)}&output=json&fl=timestamp,statuscode&filter=statuscode:200`)).json().catch(() => []);
    const stamps = rows.slice(1).map((r) => r[0]).filter((t) => t < v.timestamp).sort().reverse();
    let fixed = false;
    for (const ts of stamps.slice(0, 6)) {
      await sleep(2500);
      const res = await get(`https://web.archive.org/web/${ts}id_/${original}`);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (isChallenge(buf.toString('latin1'))) continue;
      const file = path.join(OUT, 'html', ...rel.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      done[rel] = { timestamp: ts, bytes: buf.length };
      console.log(`Réparée : ${rel} (capture du ${ts.slice(6, 8)}/${ts.slice(4, 6)}/${ts.slice(0, 4)})`);
      fixed = true;
      break;
    }
    if (!fixed) console.log(`Pas de capture valide : ${rel} (en attente de l'aspiration directe)`);
    fs.writeFileSync(DONE, JSON.stringify(done));
    await sleep(2500);
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'index') await buildIndex();
else if (cmd === 'fetch') await fetchPages(a, b);
else if (cmd === 'repair') await repair();
else console.log('Usage : node outils/scraping/wayback.mjs index | fetch [délai ms] [dossiers prioritaires] | repair');
