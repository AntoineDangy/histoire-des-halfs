// Audit des événements détectés dans les fiches bateau : pour chaque type, les mots déclencheurs trouvés,
// leur fréquence et des exemples de lignes, afin de repérer les faux positifs avant publication.
// Usage : node tools/audit-events.mjs [type ...]   -> écrit _audit/evenements.md et affiche le résumé
import fs from 'node:fs';
import path from 'node:path';
import { readSource, toBlocks } from './lib/source.mjs';
import { parseDossier, EVENT_TYPES, fold } from './lib/parse.mjs';

const only = process.argv.slice(2);
const types = EVENT_TYPES.filter((t) => !only.length || only.includes(t.type));
const SRC = path.resolve('_source/html');
const files = [];
const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.html?$/i.test(f.name)) files.push(path.relative(SRC, p).split(path.sep).join('/')); } };
walk(SRC);

const hits = new Map(types.map((t) => [t.type, new Map()]));
for (const rel of files) {
  if (/liste|sommaire|index|r r r|r40|r50|no voile|n n n|archi/i.test(rel)) continue;
  const src = readSource(rel);
  const dos = parseDossier(toBlocks(src.body, rel));
  for (const e of dos.entries) for (const b of e.blocks) {
    if (b.type !== 'p') continue;
    for (const t of types) {
      const re = new RegExp(t.re.source, t.re.flags.includes('g') ? t.re.flags : t.re.flags + 'g');
      for (const m of b.text.matchAll(re)) {
        const tok = fold(m[0]);
        const map = hits.get(t.type);
        if (!map.has(tok)) map.set(tok, []);
        map.get(tok).push({ rel, year: e.year, text: b.text.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90) });
      }
    }
  }
}
let md = `# Audit des événements détectés\n\n${files.length} pages lues.\n`;
for (const t of types) {
  const map = hits.get(t.type);
  const total = [...map.values()].reduce((n, l) => n + l.length, 0);
  console.log(`${t.type.padEnd(8)} ${String(total).padStart(5)} : ${[...map].sort((a, b) => b[1].length - a[1].length).slice(0, 14).map(([k, l]) => `${k} (${l.length})`).join(', ')}`);
  md += `\n## ${t.label} (${t.type}) : ${total}\n`;
  for (const [tok, list] of [...map].sort((a, b) => b[1].length - a[1].length)) {
    md += `\n### « ${tok} » : ${list.length}\n`;
    for (const h of list.slice(0, 12)) md += `- ${h.year || '—'} · ${h.rel} · …${h.text.replace(/\s+/g, ' ')}…\n`;
  }
}
fs.mkdirSync('_audit', { recursive: true });
fs.writeFileSync('_audit/evenements.md', md);
console.log('Rapport complet : _audit/evenements.md');
