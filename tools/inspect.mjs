// Affiche les paragraphes et liens d'une ou plusieurs pages aspirées : node tools/inspect.mjs "<chemin>" [--all]
import { readSource, toBlocks } from './lib/source.mjs';

const all = process.argv.includes('--all');
for (const f of process.argv.slice(2).filter((a) => a !== '--all')) {
  const s = readSource(f);
  if (!s) { console.log('ABSENT', f); continue; }
  console.log('==', f);
  for (const b of toBlocks(s.body, f)) {
    if (b.type !== 'p' || (!all && !b.links.length)) continue;
    console.log(' ', b.text.slice(0, 100), b.links.length ? '| ' + b.links.map((l) => `${l.text}>${l.rel}`).join(' ; ').slice(0, 500) : '');
  }
}
