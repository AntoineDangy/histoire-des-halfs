// Résumé des fiches générées d'une série, pour la relecture : node tools/review.mjs <slug de série> [nombre de jalons]
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join('site', process.argv[2] || 'imoca');
const max = Number(process.argv[3] || 12);
const text = (h, re) => ((h.match(re) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
for (const s of fs.readdirSync(dir)) {
  const f = path.join(dir, s, 'index.html');
  if (!fs.existsSync(f)) continue;
  const h = fs.readFileSync(f, 'utf8');
  if (!h.includes('boat-head')) continue;
  const frise = [...h.matchAll(/<li class="ev-(\w+)"><a[^>]*><i><\/i>([^<]*)<\/a>/g)].map((m) => `${m[1]}:${m[2]}`);
  console.log(`## ${s} | ${text(h, /<h1>([\s\S]*?)<\/h1>/)} | now: ${text(h, /class="now">([\s\S]*?)<\/p>/)} | plan: ${text(h, /<dt>Plan<\/dt><dd>([\s\S]*?)<\/dd>/)} | voiles: ${text(h, /<dt>N° de voile<\/dt><dd>([\s\S]*?)<\/dd>/)} | jalons: ${frise.length}`);
  console.log('   ' + frise.slice(0, max).join(' ; '));
  const skippers = [...h.matchAll(/<span class="sk" title="([^"]*)"/g)].map((m) => m[1]);
  if (skippers.length) console.log('   skippers : ' + skippers.join(' → '));
}
