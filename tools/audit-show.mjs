// Affiche les lignes d'un type d'événement (et, si donné, d'un mot déclencheur) relevées par audit-events.mjs.
// Usage : node tools/audit-show.mjs <type> [mot] [nombre]
import fs from 'node:fs';

const [type, token, max = '40'] = process.argv.slice(2);
const md = fs.readFileSync('_audit/evenements.md', 'utf8');
const section = md.split(/\n## /).find((s) => s.includes(`(${type})`)) || '';
const parts = section.split(/\n### /).slice(1).filter((p) => !token || p.startsWith(`« ${token}`));
for (const p of parts) {
  const [head, ...lines] = p.split('\n');
  console.log(`== ${head}`);
  for (const l of lines.filter(Boolean).slice(0, Number(max))) console.log('  ' + l.slice(0, 260));
}
