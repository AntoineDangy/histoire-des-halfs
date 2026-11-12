// Aspire les pages HTML de histoiredeshalfs.com (sans les images) dans donnees/site/html
// et produit donnees/site/inventory.json. Reprend là où il s'est arrêté.
// Usage : node tools/crawl.mjs [sortie] [max] [délai ms] [pages prioritaires séparées par des virgules]
// Les pages prioritaires et les pages qu'elles référencent directement passent en tête de file.
// Le délai s'adapte : il augmente à chaque 429 et redescend doucement ensuite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Racine du dépôt : les chemins ne dépendent pas du dossier d'où l'on lance le script.
const REPO = fileURLToPath(new URL('../../', import.meta.url));

const ROOT = 'https://www.histoiredeshalfs.com/';
const OUT = path.resolve(process.argv[2] || path.join(REPO, 'donnees/site'));
const MAX = Number(process.argv[3] || 50000);
let delay = Number(process.argv[4] || 3000);
const MIN_DELAY = 1500;

fs.mkdirSync(OUT, { recursive: true });
const invPath = path.join(OUT, 'inventory.json');
const inventory = fs.existsSync(invPath) ? JSON.parse(fs.readFileSync(invPath, 'utf8')) : {};

const norm = (u) => {
  const x = new URL(u);
  x.hash = ''; x.search = '';
  x.hostname = 'www.histoiredeshalfs.com'; x.protocol = 'https:';
  return decodeURI(x.href);
};
const isPage = (u) => /\.html?$/i.test(new URL(u).pathname) || new URL(u).pathname.endsWith('/');
const localFile = (u) => {
  let p = decodeURI(new URL(u).pathname);
  if (p.endsWith('/')) p += 'index.htm';
  return path.join(OUT, 'html', ...p.split('/').filter(Boolean));
};

const priority = new Set((process.argv[5] || '').split(',').filter(Boolean).map((p) => norm(new URL(p, ROOT).href)));
const hi = [...priority];
const lo = [norm(ROOT)];
const seen = new Set([...hi, ...lo]);
const enqueue = (u, fromPriority) => {
  if (inventory[u]?.status === 200 || inventory[u]?.status === 404) return;
  if (fromPriority) {
    const i = lo.indexOf(u);
    if (i >= 0) lo.splice(i, 1);
    if (!hi.includes(u)) hi.push(u);
  } else if (!seen.has(u)) lo.push(u);
  seen.add(u);
};
// Pages prioritaires déjà aspirées : leurs liens passent en tête, dans l'ordre où les pages ont été données.
for (const s of priority) for (const l of inventory[s]?.links || []) enqueue(l, true);
for (const u of Object.keys(inventory)) {
  if (inventory[u].status !== 200 && inventory[u].status !== 404 && !seen.has(u)) { seen.add(u); lo.push(u); }
  for (const l of inventory[u].links || []) enqueue(l, false);
}

function decode(buf) {
  const head = buf.subarray(0, 2048).toString('latin1');
  const m = head.match(/charset=["']?([\w-]+)/i);
  const cs = (m ? m[1] : 'windows-1252').toLowerCase();
  try { return new TextDecoder(cs === 'iso-8859-1' ? 'windows-1252' : cs).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(u) {
  if (inventory[u]?.status === 200) return;
  const rec = { status: 0 };
  try {
    let res;
    for (let attempt = 0; attempt < 8; attempt++) {
      // Délai d'expiration : une coupure réseau ne doit pas figer l'aspiration sur une requête sans réponse.
      res = await fetch(encodeURI(u), { headers: { 'User-Agent': 'Mozilla/5.0 (archive redesign prototype)' }, signal: AbortSignal.timeout(90000) });
      if (res.status !== 429 && res.status < 500) break;
      delay = Math.min(delay * 1.5, 60000);
      const wait = (Number(res.headers.get('retry-after')) * 1000) || Math.min(15000 * 2 ** attempt, 300000);
      console.log(`${res.status} sur ${u}, pause ${wait / 1000}s (délai de base ${Math.round(delay / 1000)}s)`);
      await sleep(wait);
    }
    rec.status = res.status;
    const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    // Écran anti-robots renvoyé avec un statut 200 : ce n'est pas la page, elle sera retentée plus tard.
    if (buf && /request is being verified|checking your browser/i.test(buf.toString('latin1').slice(0, 20000))) {
      rec.status = 'challenge';
      delay = Math.min(delay * 1.5, 60000);
    } else if (res.ok) {
      delay = Math.max(MIN_DELAY, delay * 0.97);
      const file = localFile(u);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      const html = decode(buf);
      rec.bytes = buf.length;
      rec.title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
      rec.imgs = (html.match(/<img\b/gi) || []).length;
      const links = new Set();
      for (const m of html.matchAll(/href\s*=\s*["']([^"'#][^"']*)["']/gi)) {
        try {
          const abs = new URL(m[1].trim(), encodeURI(u));
          if (!/histoiredeshalfs\.com$/i.test(abs.hostname)) continue;
          const n = norm(abs.href);
          if (isPage(n)) links.add(n);
        } catch {}
      }
      rec.links = [...links];
    }
  } catch (e) { rec.error = String(e.message || e); }
  inventory[u] = rec;
  for (const l of rec.links || []) enqueue(l, priority.has(u));
}

let done = 0;
while ((hi.length || lo.length) && done < MAX) {
  const u = hi.length ? hi.shift() : lo.shift();
  await fetchPage(u);
  done++;
  if (done % 10 === 0) {
    fs.writeFileSync(invPath, JSON.stringify(inventory));
    console.log(`${done} traitées (${Object.values(inventory).filter((v) => v.status === 200).length} ok au total), prioritaires: ${hi.length}, autres: ${lo.length}`);
  }
  await sleep(delay);
}
fs.writeFileSync(invPath, JSON.stringify(inventory));
const vals = Object.values(inventory);
console.log(`Terminé: ${vals.length} pages, ok=${vals.filter((v) => v.status === 200).length}, file restante=${hi.length + lo.length}`);
