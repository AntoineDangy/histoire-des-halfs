// Télécharge à la demande une ou plusieurs pages du site d'origine (une requête à la fois), sans attendre l'aspirateur.
// Usage : node tools/fetch-one.mjs "<URL ou chemin>" ...   puis : node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Racine du dépôt : les chemins ne dépendent pas du dossier d'où l'on lance le script.
const REPO = fileURLToPath(new URL('../../', import.meta.url));

const ROOT = 'https://www.histoiredeshalfs.com/';
const OUT = path.join(REPO, 'donnees/site');
const invPath = path.join(OUT, 'inventory.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (archive redesign prototype)' };

for (const arg of process.argv.slice(2)) {
  const url = new URL(arg, ROOT);
  const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const live = ROOT + rel;
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(ROOT + rel.split('/').map(encodeURIComponent).join('/'), { headers: UA, signal: AbortSignal.timeout(90000) });
    if (res.status !== 429 && res.status < 500) break;
    const wait = 15000 * 2 ** attempt;
    console.log(`${res.status}, nouvel essai dans ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (!res.ok) { console.log(`Échec ${res.status} : ${rel}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (/request is being verified|checking your browser/i.test(buf.toString('latin1').slice(0, 20000))) { console.log(`Écran anti-robots reçu, page non enregistrée : ${rel}`); continue; }
  const file = path.join(OUT, 'html', ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  // L'inventaire est relu juste avant l'écriture : l'aspirateur l'enregistre aussi en parallèle.
  const inv = fs.existsSync(invPath) ? JSON.parse(fs.readFileSync(invPath, 'utf8')) : {};
  inv[live] = { ...(inv[live] || {}), status: 200, bytes: buf.length };
  fs.writeFileSync(invPath, JSON.stringify(inv));
  console.log(`OK : ${rel} (${buf.length} octets)`);
}
