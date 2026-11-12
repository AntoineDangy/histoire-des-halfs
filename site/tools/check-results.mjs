// Contrôle rapide du découpage des pages de palmarès : node tools/check-results.mjs [--loose] "<page>" ...
import { readSource, toBlocks } from './lib/source.mjs';
import { parseResults } from './lib/parse.mjs';

const loose = process.argv.includes('--loose');
for (const f of process.argv.slice(2).filter((a) => a !== '--loose')) {
  const src = readSource(f);
  if (!src) { console.log('ABSENT', f); continue; }
  const r = parseResults(toBlocks(src.body, f), { loose });
  console.log(`${f} : ${r.editions.length} éditions, ${r.editions.reduce((n, e) => n + e.results.length, 0)} lignes classées, ${r.intro.length} blocs d'introduction`);
  for (const e of r.editions.slice(0, 5)) console.log(`   ${e.year} (${e.results.length}) ${e.titleHtml.replace(/<[^>]+>/g, '').slice(0, 80)}`);
}
