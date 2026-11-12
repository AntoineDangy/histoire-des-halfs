// Rapatrie les photos utilisées par le site dans site/photos/, dans l'ordre de _source/images-needed.json
// (écrit par build.mjs : séries actuelles d'abord). Relancer build.mjs ensuite pour que les pages les utilisent.
// Usage :
//   node tools/photos.mjs [délai ms]           -> depuis la Wayback Machine (dernière capture de chaque image)
//   node tools/photos.mjs origin [délai ms]    -> les photos absentes de l'archive, depuis le site d'origine (très lent)
//   … [délai ms] [nombre max]                  -> s'arrête après les N premières (les photos de une sont en tête)
// Une requête à la fois ; le délai s'allonge si le serveur demande de ralentir. Reprend là où il s'est arrêté.
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://www.histoiredeshalfs.com/';
const OUT = path.resolve('site/photos');
const NEEDED = path.resolve('_source/images-needed.json');
const MISSING = path.resolve('_source/photos-missing.json');
const UA = { 'User-Agent': 'histoire-des-halfs-redesign/1.0 (archive reader, one request at a time)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const originUrl = (rel) => ORIGIN + rel.split('/').map(encodeURIComponent).join('/');

const args = process.argv.slice(2);
const fromOrigin = args[0] === 'origin';
let delay = Number((fromOrigin ? args[1] : args[0]) || (fromOrigin ? 30000 : 2500));
const MIN = fromOrigin ? 20000 : 1500;

const needed = readJson(NEEDED, []);
const missing = readJson(MISSING, {});
const local = (rel) => path.join(OUT, ...rel.split('/'));
const max = Number((fromOrigin ? args[2] : args[1]) || Infinity);
const todo = needed.filter((rel) => !fs.existsSync(local(rel)) && (fromOrigin ? missing[rel] : !missing[rel])).slice(0, max);
console.log(`${todo.length} photos à rapatrier ${fromOrigin ? 'depuis le site d’origine' : 'depuis la Wayback Machine'} (${needed.length} utilisées par le site)`);

let ok = 0, n = 0;
for (const rel of todo) {
  const url = fromOrigin ? originUrl(rel) : `https://web.archive.org/web/2026id_/${originUrl(rel)}`;
  let res, wait = fromOrigin ? 60000 : 20000;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      res = await fetch(url, { headers: UA });
      if (res.status !== 429 && res.status < 500) break;
      console.log(`${res.status} sur ${rel}, pause ${wait / 1000}s`);
    } catch (e) { console.log(`Erreur réseau (${e.message}), pause ${wait / 1000}s`); res = null; }
    delay = Math.min(delay * 1.5, fromOrigin ? 120000 : 30000);
    await sleep(wait);
    wait = Math.min(wait * 2, 600000);
  }
  const type = res?.headers.get('content-type') || '';
  if (res?.ok && /^image\//i.test(type)) {
    const file = local(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    if (missing[rel]) delete missing[rel];
    ok++;
    delay = Math.max(MIN, delay * 0.95);
  } else if (!fromOrigin) {
    missing[rel] = res ? res.status : 'erreur';
  }
  n++;
  if (n % 20 === 0) {
    fs.writeFileSync(MISSING, JSON.stringify(missing));
    console.log(`${n}/${todo.length} traitées, ${ok} rapatriées, ${Object.keys(missing).length} absentes de l'archive (délai ${Math.round(delay / 100) / 10}s)`);
  }
  await sleep(delay);
}
fs.writeFileSync(MISSING, JSON.stringify(missing));
console.log(`Terminé : ${ok} photos rapatriées, ${Object.keys(missing).length} absentes de l'archive.`);
