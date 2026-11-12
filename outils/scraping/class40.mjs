// Aspire les fiches bateaux du site officiel de la Class40 (https://www.class40.com/bateaux), une requête à la fois,
// et en extrait les faits (numéro, nom actuel, nom de baptême, architecte, plan, chantier, lancement, skipper).
// robots.txt du site : tout est autorisé. Reprise : une page déjà enregistrée n'est jamais retéléchargée.
// Usage : node outils/scraping/class40.mjs   (environ 12 minutes la première fois, quelques secondes ensuite)
// Sorties : donnees/site/class40.com/html/<fiche>.html (pages telles quelles) et donnees/site/class40.com/bateaux.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const OUT = path.join(REPO, 'donnees/site/class40.com');
const ROOT = 'https://www.class40.com';
const UA = { 'User-Agent': 'MemoireDuLarge/1.0 (https://histoire-des-halfs.pages.dev; boat history reference) node-fetch' };
const PAUSE = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
    if (res.ok) return await res.text();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    const wait = 30000 * 2 ** attempt;
    console.log(`${res.status}, nouvel essai dans ${wait / 1000} s`);
    await sleep(wait);
  }
  throw new Error(`abandon ${url}`);
}

const ACC = { agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', icirc: 'î', iuml: 'ï', iacute: 'í', ocirc: 'ô', ouml: 'ö', oacute: 'ó',
  ucirc: 'û', ugrave: 'ù', uuml: 'ü', uacute: 'ú', ccedil: 'ç', ntilde: 'ñ', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', oelig: 'œ', laquo: '«', raquo: '»' };
const decode = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&([a-zA-Z]+);/g, (m, k) => ACC[k] || m).replace(/&amp;/g, '&').replace(/\x92/g, "'").replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

// Faits de la fiche : paires « LIBELLÉ » / valeur, lues dans le texte de la page.
function faits(html, slug) {
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [html])[0];
  const lignes = main.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').split(/<\/?(?:div|span|p|h\d|li|dt|dd|a|strong|br)[^>]*>/).map(decode).filter(Boolean);
  const LIB = { 'ARCHITECTE': 'architecte', 'PLAN / SÉRIE': 'plan', 'CHANTIER': 'chantier', 'LANCEMENT': 'lancement', 'SKIPPER': 'skipper', 'NOM DE BAPTÊME': 'bapteme' };
  const f = { fiche: `${ROOT}/bateaux/${slug}`, numero: +slug.split('-')[0] };
  for (let i = 0; i < lignes.length - 1; i++) {
    const k = LIB[lignes[i].toUpperCase()];
    if (k && !LIB[lignes[i + 1].toUpperCase()] && !(k in f)) f[k] = lignes[i + 1];
  }
  const titre = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
  f.nom = titre.replace(/\s*:\s*voilier Class40.*$/i, '');
  if (f.lancement && /^\d{4}$/.test(f.lancement)) f.lancement = +f.lancement;
  // « à venir », « non communiqué » : pas un nom.
  for (const k of ['nom', 'bapteme', 'skipper']) if (f[k] && /^(?:à venir|non communiqu[ée]|nc|-)$/i.test(f[k].trim())) delete f[k];
  return f;
}

fs.mkdirSync(path.join(OUT, 'html'), { recursive: true });
const liste = await get(`${ROOT}/bateaux`);
fs.writeFileSync(path.join(OUT, 'bateaux.html'), liste);
const slugs = [...new Set([...liste.matchAll(/href="(?:https?:\/\/(?:www\.)?class40\.com)?\/bateaux\/(\d+-[^"/?#]+)"/g)].map((m) => m[1]))];
console.log(`${slugs.length} fiches dans la liste`);
const res = [];
let nouvelles = 0;
for (const slug of slugs) {
  const file = path.join(OUT, 'html', `${slug}.html`);
  if (!fs.existsSync(file)) {
    await sleep(PAUSE);
    try { fs.writeFileSync(file, await get(`${ROOT}/bateaux/${slug}`)); nouvelles++; } catch (e) { console.log(`Échec : ${e.message}`); continue; }
    if (nouvelles % 20 === 0) console.log(`${nouvelles} pages téléchargées`);
  }
  res.push(faits(fs.readFileSync(file, 'utf8'), slug));
}
res.sort((a, b) => a.numero - b.numero || a.nom.localeCompare(b.nom));
fs.writeFileSync(path.join(OUT, 'bateaux.json'), JSON.stringify({ source: `${ROOT}/bateaux`, date: new Date().toISOString().slice(0, 10), bateaux: res }, null, 1));
console.log(`${res.length} fiches lues (${nouvelles} nouvelles) → donnees/site/class40.com/bateaux.json`);
