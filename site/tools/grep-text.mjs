// Recherche dans le texte (décodé, sans balises) des pages aspirées : node tools/grep-text.mjs "<regex>" ["<dossier>"] [max]
// Affiche chaque paragraphe correspondant avec sa page. Utile pour vérifier ce que dit la source.
import fs from 'node:fs';
import path from 'node:path';
import { readSource, toBlocks } from './lib/source.mjs';

const [pattern, dir = '', max = '60'] = process.argv.slice(2);
const re = new RegExp(pattern, 'i');
const SRC = path.resolve('../donnees/site/html');
let n = 0;
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { walk(p); continue; }
    if (!/\.html?$/i.test(f.name)) continue;
    const rel = path.relative(SRC, p).split(path.sep).join('/');
    const src = readSource(rel);
    if (!src) continue;
    for (const b of toBlocks(src.body, rel)) {
      if (b.type === 'p' && re.test(b.text) && n++ < Number(max)) console.log(`${rel} : ${b.text.slice(0, 220)}`);
    }
  }
};
const start = path.join(SRC, dir);
if (fs.existsSync(start) && fs.statSync(start).isFile()) {
  // Une seule page : on la lit directement.
  const rel = path.relative(SRC, start).split(path.sep).join('/');
  const src = readSource(rel);
  for (const b of src ? toBlocks(src.body, rel) : []) if (b.type === 'p' && re.test(b.text) && n++ < Number(max)) console.log(`${rel} : ${b.text.slice(0, 220)}`);
} else walk(start);
console.log(`${n} paragraphe(s)`);
