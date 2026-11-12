// Relecture : repère les fiches dont le texte d'introduction (avant la chronologie) commence par une ligne courte
// qui ressemble à un en-tête de l'auteur (« Max 11 SODEBO 2, Tri ») et n'a donc pas été reconnue comme titre.
// Usage : node tools/check-intros.mjs
import fs from 'node:fs';
import path from 'node:path';

const hits = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'photos' && f.name !== 'assets') walk(p); continue; }
    if (f.name !== 'index.html') continue;
    const h = fs.readFileSync(p, 'utf8');
    if (!h.includes('boat-head')) continue;
    // Introduction : le bloc .prose placé entre la frise (ou l'en-tête) et la chronologie détaillée.
    const m = h.match(/<\/aside>\s*<\/div>[\s\S]*?<div class="prose"><p>([\s\S]*?)<\/p>/);
    if (!m) continue;
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length < 70) hits.push(`${path.relative('site', path.dirname(p))} : « ${text} »`);
  }
};
walk(path.resolve('site'));
console.log(hits.length ? hits.join('\n') : 'Aucune introduction suspecte.');
