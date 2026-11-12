// Génère le site statique dans site/public/ à partir des pages aspirées dans donnees/site/html.
// Usage (depuis n'importe quel dossier) : node site/tools/build.mjs [--publish]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readSource, toBlocks, originUrl, esc, decodeEntities, SOURCE_DIR } from './lib/source.mjs';
import { parseAlphaList, parseDossier, parseResults, classifyEvents, skippersOf, skipperMentions, leadingPersons, EVENT_TYPES, RACE_NAMED_AFTER, slugify, fold , BUILDER_RE, builderFrom, designerOf } from './lib/parse.mjs';
import { BIG_RACE, racesOf, resultOf } from './lib/races.mjs';
import { SERIES_DEFS, CATALOG } from './series.mjs';
import { fileURLToPath } from 'node:url';

// Registre des identifiants (donnees/identifiants.csv, décision du 09/11/2026) : l'adresse d'une fiche publiée ne change
// plus quand on corrige la lecture de son nom. Clé : rubrique du site + dossier d'origine. Une fiche absente du registre
// (nouveau dossier) reçoit une adresse tirée de son nom, à ajouter au registre.
const ID_REGISTRY = new Map();
{
  const f = path.join(SOURCE_DIR, '..', 'identifiants.csv');
  if (fs.existsSync(f)) {
    const parse = (line) => { const out = []; let cur = '', q = false; for (const c of line) { if (c === '"') q = !q; else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
    const [head, ...lines] = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
    const cols = parse(head);
    for (const l of lines) {
      const r = Object.fromEntries(parse(l).map((v, i) => [cols[i], v]));
      if (r.type === 'bateau') ID_REGISTRY.set(`${r.id_site.split('/')[0]}|${r.source}`, r.id_site);
    }
  }
}

// Les chemins relatifs (content/, public/, ../donnees/site/) partent du dossier site/ du dépôt.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const OUT = path.resolve('public');
// Repart d'une sortie propre ; assets/ est écrit à la main et photos/ est rempli par tools/photos.mjs.
for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (f !== 'assets' && f !== 'photos') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const write = (rel, html) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const prefixFor = (rel) => '../'.repeat(rel.split('/').length - 1) || './';
const num = (n) => n.toLocaleString('fr-FR');

// ---------------------------------------------------------------- Gabarit
const BRAND = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 3 L17 27 L5 27 Z" fill="#f5f1e8"/><path d="M19 7 L19 27 L29 27 C28 18 25 11 19 7Z" fill="#c8372d"/><path d="M3 30 Q8.5 27 14 30 T25 30 T31 30" stroke="#b4873a" stroke-width="2" fill="none"/></svg>`;
const ICON_SEARCH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const WAVES = `<svg class="waves" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 50 C 240 10 480 80 720 45 S 1200 20 1440 50 L1440 80 L0 80Z"/></svg>`;

// Menu principal : Accueil, une entrée par grande famille (menu déroulant de ses séries), Actualités.
const NAV_FAMILIES = CATALOG.filter((f) => f.nav);
// Rubrique du menu à surligner pour une série : sa famille, ou la famille parente (Half Tonners -> Monocoques).
const navFor = (S) => {
  const f = CATALOG.find((x) => x.items.some(([, , local]) => local === S.slug));
  return `famille:${f?.parent || f?.id || ''}`;
};
// Les séries refondues sont connues après le chargement ; le menu les lit au moment de générer chaque page.
let publishedSlugs = new Set();
const navHtml = (root, nav) => {
  const link = (href, label, current) => `<a href="${root}${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  const families = NAV_FAMILIES.map((f) => `<div class="nav-group${nav === `famille:${f.id}` ? ' current' : ''}">
        <a href="${root}series/#${f.id}" class="nav-top"${nav === `famille:${f.id}` ? ' aria-current="page"' : ''}>${esc(f.short)}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></a>
        <div class="dropdown">${f.items.map(([label, src, local]) => (local && publishedSlugs.has(local)
          ? `<a href="${root}${local}/">${esc(label)}</a>`
          : `<a href="${esc(originUrl(src))}" class="ext" target="_blank" rel="noopener">${esc(label)}</a>`)).join('')}
          ${f.more ? `<a href="${root}${f.more.href}" class="all">${esc(f.more.label)} →</a>` : `<a href="${root}series/#${f.id}" class="all">Toute la famille →</a>`}</div>
      </div>`).join('\n      ');
  return `${link('', 'Accueil', nav === '')}
      ${families}
      ${link('skippers/', 'Skippers', nav === 'skippers/')}
      ${link('calendrier/', 'Calendrier', nav === 'calendrier/')}`;
};

// Designs proposés : les deux premiers sont dans l'en-tête, tous dans le pied de page (designs.css).
const DESIGNS = [['moderne', 'Moderne'], ['retro', 'Rétro'], ['revue', 'Revue 1980'], ['regate', 'Régate']];
const designButtons = (list) => list.map(([k, l]) => `<button type="button" data-design="${k}" aria-pressed="false">${l}</button>`).join('');

// Nom du site (en-tête, titre des pages, à propos) et ligne des sources ouvertes (pied de page).
const SITE = { name: 'Mémoire du large', tagline: 'Bateaux, courses et marins', titleSuffix: 'Mémoire du large' };
// Version montrée en bas de l'accueil (demande du porteur de projet, 12/11/2026). « Majeur.mineur » : VERSION_BASE, à
// changer à la main pour une étape importante ; le dernier nombre est le nombre d'enregistrements git du dépôt hors jeu/
// (il monte tout seul). La date est celle de la construction, donc de la mise en ligne. Seul l'accueil la montre : les
// autres pages restent identiques d'une construction à l'autre, et l'envoi sur Cloudflare reste court.
const VERSION_BASE = '1.0';
const VERSION = (() => {
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: path.resolve('..'), encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : '';
  };
  const n = git('rev-list', '--count', 'HEAD', '--', '.', ':(exclude)jeu');
  const d = new Date();
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ');
  const [h, m] = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).split(':');
  return { numero: n ? `${VERSION_BASE}.${n}` : VERSION_BASE, commit: git('rev-parse', '--short', 'HEAD'), date: `${jour} à ${Number(h)} h ${m}` };
})();
const VERSION_LINE = () => `<div class="site-version"${VERSION.commit ? ` title="Enregistrement ${esc(VERSION.commit)}"` : ''}>Version ${esc(VERSION.numero)} · mise à jour le ${esc(VERSION.date)}</div>`;
const SOURCES_LINE = (root) => `Sources ouvertes : <a href="${originUrl('')}" rel="noopener">histoiredeshalfs.com</a> et les archives de son auteur, <a href="https://fr.wikipedia.org/" rel="noopener">Wikipédia</a>, les sites officiels des courses et des classes. <a href="${root}a-propos/#sources">Détail des sources</a>`;

function layout({ rel, title, description = '', body, nav = '', version = false }) {
  const root = prefixFor(rel);
  body = body.replaceAll('{{ROOT}}', root);
  return `<!doctype html>
<html lang="fr" data-root="${root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(SITE.titleSuffix)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${root}assets/style.css">
<link rel="stylesheet" href="${root}assets/designs.css">
<script>/* Design choisi : ?design=… ou choix mémorisé, appliqué avant l'affichage. */try{var d=new URLSearchParams(location.search).get('design')||localStorage.getItem('design');if(d&&d!=='moderne'&&d!=='archive'){document.documentElement.dataset.design=d;}if(new URLSearchParams(location.search).get('design'))localStorage.setItem('design',d);}catch(e){}</script>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(BRAND.replace('aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"'))}">
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${root}">${BRAND}<span><b>${esc(SITE.name)}</b><small>${esc(SITE.tagline)}</small></span></a>
    <nav class="nav" aria-label="Navigation principale">
      ${navHtml(root, nav)}
      <div class="design-switch design-picker in-menu" role="group" aria-label="Design du site">${designButtons(DESIGNS.slice(0, 2))}</div>
    </nav>
    <div class="search-box">${ICON_SEARCH}<input id="q" type="search" placeholder="Bateau, n° de voile, architecte…" autocomplete="off" aria-label="Rechercher"><div class="search-results"></div></div>
    <div class="design-switch design-picker" role="group" aria-label="Design du site">${designButtons(DESIGNS.slice(0, 2))}</div>
    <button class="menu-btn" aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div>${SOURCES_LINE(root)}<br>Informations, corrections sur les bateaux : <a href="mailto:histoiredeshalfs@orange.fr">histoiredeshalfs@orange.fr</a></div>
    <div><a href="${root}actualites/">Les infos de histoiredeshalfs.com</a> · <a href="${root}a-propos/">À propos</a> · <button class="theme-toggle" type="button">Clair / sombre</button></div>
    <div class="design-picker" role="group" aria-label="Essayer un design"><span>Design :</span>${designButtons(DESIGNS)}</div>
    ${version ? VERSION_LINE() : ''}
  </div>
</footer>
<script src="${root}assets/app.js" defer></script>
</body>
</html>
`;
}
// photo : une photo de fond (série), ou une liste de photos en mosaïque (accueil).
const hero = (eyebrow, title, lead, extra = '', compact = false, photo = null) => `<section class="hero${compact ? ' compact' : ''}${Array.isArray(photo) ? ' has-mosaic' : photo ? ' has-photo' : ''}">${Array.isArray(photo) ? `<div class="hero-mosaic" aria-hidden="true">${photo.map((b) => coverImg(b)).join('')}</div>` : photo ? coverImg(photo, '', 'hero-bg') : ''}<div class="wrap">
  <div class="eyebrow">${esc(eyebrow)}</div>
  <h1>${esc(title)}</h1>
  ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${extra}
</div>${WAVES}</section>`;
// Pages provenant d'une capture de la Wayback Machine, tant que l'aspiration directe ne les a pas remplacées.
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const LIVE = readJson(path.resolve('../donnees/site/inventory.json'));
const ARCHIVED = Object.fromEntries(Object.entries(readJson(path.resolve('../donnees/site/wayback.json')))
  .filter(([rel, v]) => v.bytes && LIVE[`https://www.histoiredeshalfs.com/${rel}`]?.status !== 200));
const captureDate = (ts) => `${ts.slice(6, 8)}/${ts.slice(4, 6)}/${ts.slice(0, 4)}`;
const sourceNote = (rel, label = "page d'origine") => `<p class="source-note">Source : <a href="${esc(originUrl(rel))}" target="_blank" rel="noopener">${label} sur histoiredeshalfs.com</a>${ARCHIVED[rel] ? `, d'après une <a href="https://web.archive.org/web/${ARCHIVED[rel].timestamp}/${esc(originUrl(rel))}" target="_blank" rel="noopener">copie archivée le ${captureDate(ARCHIVED[rel].timestamp)}</a> (mise à jour en cours)` : ''}. Il y a forcément des oublis et des erreurs : toute information est la bienvenue à <a href="mailto:histoiredeshalfs@orange.fr">histoiredeshalfs@orange.fr</a>.</p>`;

// « CANTIPPA » -> « Cantippa » ; les noms déjà en casse mixte sont laissés tels quels.
// Dans un nom mixte (« Le BISTROT FRANCAIS »), seuls les mots en capitales de 4 lettres ou plus sont adoucis :
// les sigles courts (CGA, HMI…) restent intacts.
// Numéros romains de I à XXXIX (Gitana XVII, Banque Populaire XI…), écrits en capitales.
const ROMAN = /^(?=[ivx])x{0,3}(?:ix|iv|v?i{0,3})$/i;
const prettyCase = (s) => (s === s.toUpperCase() && /[A-Z]{3}/.test(s)
  ? s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()).replace(/\b([ivx]{1,6})\b/gi, (r) => (ROMAN.test(r) ? r.toUpperCase() : r))
  : s.replace(/\b(\p{Lu}{4,})\b/gu, (w) => (ROMAN.test(w) ? w : w[0] + w.slice(1).toLowerCase())));
// Photos : copie locale dans site/photos/ si tools/photos.mjs l'a rapatriée, sinon l'image du site d'origine.
// {{ROOT}} est remplacé par le chemin relatif de la page dans layout(). Chaque photo utilisée est notée,
// avec la priorité de sa série, pour que photos.mjs sache quoi rapatrier en premier.
const PHOTOS = path.join(OUT, 'photos');
const IMAGES = new Map();
let imgPrio = 999;
// --publish : version mise en ligne. Les photos pas encore rapatriées pointent vers leur copie de la Wayback Machine,
// pour que les visiteurs ne sollicitent pas le serveur de l'auteur.
const PUBLISH = process.argv.includes('--publish');
const photoUrl = (rel) => (fs.existsSync(path.join(PHOTOS, ...rel.split('/')))
  ? `{{ROOT}}photos/${rel.split('/').map(encodeURIComponent).join('/')}`
  : PUBLISH ? `https://web.archive.org/web/2026im_/${originUrl(rel)}` : originUrl(rel));
const img = (b, alt = '') => {
  IMAGES.set(b.src, Math.min(IMAGES.get(b.src) ?? 999, imgPrio));
  const u = esc(photoUrl(b.src));
  return `<a href="${u}"><img src="${u}" alt="${esc(alt)}" loading="lazy"${b.w && b.h ? ` width="${b.w}" height="${b.h}"` : ''}></a>`;
};
// Photos de une (accueil, séries, fiches) : les vraies photos d'un dossier, sans les boutons ni les vignettes.
// Une photo déjà rapatriée passe avant une copie d'archive ; une image introuvable s'efface sans laisser de cadre vide.
const isPhoto = (b) => b.type === 'img' && /\.jpe?g$/i.test(b.src) && (!b.w || b.w >= 200) && (!b.w || !b.h || (b.h >= 120 && b.w / b.h <= 2.6 && b.w / b.h >= .6));
const hasLocal = (src) => fs.existsSync(path.join(PHOTOS, ...src.split('/')));
const coverOf = (d) => d?.photos?.find((b) => hasLocal(b.src)) || d?.photos?.[0] || null;
const coverImg = (b, alt = '', cls = '', prio = -1) => {
  IMAGES.set(b.src, Math.min(IMAGES.get(b.src) ?? 999, prio));
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(photoUrl(b.src))}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.remove()">`;
};
// Les bateaux d'une série à montrer en images, les plus récents d'abord. La Wayback Machine n'a presque pas les photos
// récentes : la vitrine ne montre que des photos rapatriées, et met les autres en tête de la liste de tools/photos.mjs.
// Vitrine photo (titres, cartes, fiches) : prête mais désactivée tant que le design n'est pas arrêté.
const VITRINE = process.argv.includes('--photos');
const withPhotos = (S, n) => {
  if (!VITRINE) return [];
  const cands = S.built.filter((d) => d.single && d.photos?.length).sort((a, b) => (Number(b.facts?.built) || 0) - (Number(a.facts?.built) || 0));
  for (const d of cands.slice(0, n)) IMAGES.set(d.photos[0].src, -1);
  return cands.filter((d) => hasLocal(coverOf(d).src)).slice(0, n);
};
const photoCard = (S, d, root, withSeries = false) => {
  const f = d.facts || {};
  const name = f.title || d.names[0];
  const meta = [withSeries ? S.short : '', f.designers?.[0], f.built].filter(Boolean).join(' · ');
  return `<a class="pcard" href="${root}${d.url}"><span class="ph">${coverImg(coverOf(d), name)}</span><span class="pc-body"><b>${esc(name)}</b>${f.current && fold(f.current) !== fold(name) ? `<span class="meta">aujourd'hui ${esc(f.current)}</span>` : ''}${f.sails?.[0] ? `<span class="sail">${esc(f.sails[0])}</span>` : ''}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</span></a>`;
};
// Une courte ligne « Picture from… » juste avant des photos en devient la légende.
const CAPTION_RE = /^(pictures?|photos?|from|seen|source|archives?|vu|capture)\b/i;
// nest (chronologie) : une ligne non datée qui suit une ligne datée en est un détail (« 4 novembre, Route du Rhum… »
// puis « Trophée du Cap Fréhel : 3e », « Soirée, arrêt à Roscoff ») ; elle est décalée sous elle.
const DATED = /^(?:(?:\d{1,2}(?:er)?|d[ée]but|mi|fin|courant)\s*(?:[-–]\s*\d{1,2}\s*)?(?:et\s+\d{1,2}\s+)?)?(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const renderBlocks = (blocks, alt, { nest = false } = {}) => {
  let html = '', gal = [], caption = null, underDate = false;
  const flush = () => {
    if (gal.length) {
      const g = `<div class="gallery">${gal.map((b) => img(b, caption ? caption.text : alt)).join('')}</div>`;
      html += caption ? `<figure>${g}<figcaption>${caption.html}</figcaption></figure>` : g;
    } else if (caption) html += `<p>${caption.html}</p>`;
    gal = []; caption = null;
  };
  blocks.forEach((b, i) => {
    if (b.type === 'img') { gal.push(b); return; }
    flush();
    if (b.text.length < 140 && CAPTION_RE.test(b.text) && blocks[i + 1]?.type === 'img') { caption = b; return; }
    const dated = DATED.test(b.text.replace(/^\s*(?:(?:19|20)\d{2}\s*,?\s*)/, ''));
    const sub = nest && !dated && underDate;
    if (dated) underDate = true;
    const cls = [b.editorial ? 'ajout' : '', sub ? 'sub' : ''].filter(Boolean).join(' ');
    html += `<p${cls ? ` class="${cls}"` : ''}>${b.editorial ? '<span class="archived">ajout de la rédaction</span> ' : ''}${b.html}</p>`;
  });
  flush();
  return html;
};
// Retire les barres de navigation d'origine en tête de page (blocs courts truffés de liens, titres répétés).
const dropNav = (blocks, title = '') => blocks.filter((b, i) => !(i < 12 && b.type === 'p' && (
  b.links.length >= 3 && b.text.length < 220 || /^(histoire des halfs|histoire des \.\.\.|sommaire)/i.test(b.text) || (title && fold(b.text) === fold(title)) || /^contact\s*:/i.test(b.text))));

// Faits d'un dossier : titre, nom actuel, numéros de voile, plan, année de construction, noms successifs.
// Calculés au chargement (pour enrichir les listes) puis de nouveau à la génération de la fiche (liens à jour).
// Dossiers sans chiffre qui sont pourtant ceux d'un seul bateau (content/dossiers-un-bateau.json, décision du 09/11/2026).
const UN_BATEAU = readJson(path.resolve('content/dossiers-un-bateau.json')).dossiers || {};
// Noms de baptême établis à la main (décision du propriétaire du 09/11/2026), clé : dossier d'origine.
const BAPTEMES = readJson(path.resolve('content/baptemes.json'));
// Numéros « à la mise à l'eau » fixés par décision du propriétaire (09/11/2026), clé : dossier d'origine.
const NUMEROS = readJson(path.resolve('content/numeros.json'));
// Architecte, chantier ou année de construction vérifiés à la main, avec preuve et sources (content/fiches-corrections.json).
const CORRECTIONS = readJson(path.resolve('content/fiches-corrections.json'));
const designerKey = (x) => fold(x).split(/[^a-z]+/).filter(Boolean).sort().join(' ');
function dossierFacts(d, blocks) {
  const dos = parseDossier(blocks, d.names);
  // Nom de baptême et nom actuel. L'en-tête de l'auteur peut porter l'un ou l'autre (« Patricia » sur un Half : le
  // baptême ; « Ordago » sur un Class 40 : le nom actuel ; « Velvia de Fujichrome » : un nom intermédiaire). On s'appuie
  // sur la chronologie : le premier nom est le baptême s'il apparaît dès la construction, sinon c'est l'en-tête ;
  // le nom actuel est le dernier nom, ou l'en-tête si le bateau n'a été rebaptisé qu'une fois sous un autre nom.
  const usable = (n) => n && n.name && (n.name.match(/\?/g) || []).length <= n.name.length / 4;
  const yearOf = (y) => Number(String(y || '').slice(0, 4)) || 0;
  // Un nom écrit entre l'entrée de construction et la saison suivante (« 2003 plan Finot », « CULTISOL », « 2004 … ») est
  // celui de la mise à l'eau ; après des années de silence (« 1977 … », « INDIGO », « 2004 … »), c'est un nouveau nom.
  const renameYear = (e) => (e.renameYear && yearOf(e.year) - yearOf(e.renameYear) <= 1 ? yearOf(e.renameYear) : yearOf(e.year));
  const renames = dos.entries.filter((e) => usable(e.rename)).map((e) => ({ ...e.rename, y: yearOf(e.year), ry: renameYear(e) }));
  const header = usable(dos.title) ? dos.title : null;
  const builtYear = Number(dos.specYear) || Number(String(dos.entries.find((e) => /^(19|20)\d{2}/.test(e.year))?.year || '').slice(0, 4)) || 0;
  const headerInTimeline = header && renames.some((r) => fold(r.name) === fold(header.name));
  const firstAtBuild = renames[0] && (!builtYear || !renames[0].ry || renames[0].ry <= builtYear);
  // En-tête à numéro (Minis : « FRA 483 CALIMERO F9s ») absent de la chronologie : l'auteur y a noté le nom actuel ;
  // le baptême est alors le premier nom de la chronologie. S'il y figure, c'est un nom parmi d'autres (règle générale).
  const numberHead = header?.numberFirst && !headerInTimeline;
  const baptism0 = numberHead ? renames[0] || header : renames[0] && (firstAtBuild || !header) ? renames[0] : header || renames[0];
  // Nom de baptême établi à la main d'après la fiche, avec sa source (content/baptemes.json), quand la règle se trompe.
  // TP52 : le baptême est le nom en gras de la liste de l'auteur, sans son numéro d'homonyme (« Platoon (5) » → Platoon).
  const tpLaunch = /^tp52\//.test(d.url || '') ? d.entries.find((e) => e.launch) : null;
  const fixedName = BAPTEMES[d.rel]?.bapteme || tpLaunch?.name.replace(/\s*\(\d+\)\s*$/, '');
  const baptism = fixedName ? renames.find((r) => fold(r.name) === fold(fixedName)) || { name: fixedName, sail: '' } : baptism0;
  const latest = numberHead ? header : header && !headerInTimeline && renames.length === 1 && firstAtBuild ? header : renames.at(-1) || header;
  const original = d.single && baptism ? prettyCase(baptism.name) : null;
  const sansHomonyme = (n) => fold(n).replace(/\s*\(\d+\)\s*$/, '');
  const current = d.single && latest && baptism && sansHomonyme(latest.name) !== sansHomonyme(baptism.name) ? prettyCase(latest.name) : null;
  // Le premier nom de la chronologie est un baptême (« Baptisé ») quand il apparaît dès la construction.
  const firstRename = firstAtBuild ? dos.entries.find((e) => usable(e.rename))?.rename : dos.entries[0]?.rename;
  const title = d.single ? original || d.names[0] : `Dossier ${path.basename(d.rel).replace(/\.html?$/i, '')}`;
  const sails = [...new Set([...d.entries.map((e) => e.sail), ...dos.names.map((n) => n.sail)].filter((s) => s && /\d/.test(s)))];
  const prod = [...new Set(d.entries.map((e) => e.series).filter(Boolean))];
  // Un nom d'architecte reste court ; les remarques recopiées dans la colonne de la liste sont écartées.
  // Un même cabinet écrit de plusieurs façons (« Ollier-Gahinet », « Gahinet -Ollier ») n'est gardé qu'une fois.
  const designers = [...new Map([dos.designer, ...d.entries.map((e) => e.designer)]
    .map((x) => (x || '').replace(/,?\s*(transform|modifi|ex\b|en \d{2}\b).*$/i, '').trim())
    .filter((x) => x && x.length <= 32 && !/[!]|\?\?|^\(|^#|^ex\b|^ou\b/i.test(x) && /[a-z]{2}/i.test(x)).map((x) => [designerKey(x), x])).values()];
  const years = [...new Set(d.entries.map((e) => e.year).filter(Boolean))];
  // Année de construction : la première entrée datée du dossier.
  // Année de construction : celle de la fiche technique en tête (« 2015 Plan VPLP, construit chez… ») quand l'auteur
  // la place avant l'historique du projet (« 2013 24 septembre, annonce la construction ») ; sinon la première entrée datée.
  // Relecture du 09/11/2026 : 55 IMOCA sur 142 prenaient l'année de l'annonce du projet.
  const built = dos.specYear || dos.entries.map((e) => e.year).find((y) => /^(19|20)\d{2}$/.test(y)) || years[0] || '';
  const allNames = [...new Map([...dos.names, ...d.entries.map((e) => ({ name: e.name, sail: e.sail }))].map((n) => [fold(n.name), { ...n, name: prettyCase(n.name) }])).values()];
  // Numéro à la mise à l'eau : celui du premier nom de la chronologie, sinon celui de l'en-tête, sinon le premier connu.
  const isNum = (s) => s && /\d/.test(s) && !/^\?+$/.test(s);
  // Décision du propriétaire (09/11/2026) : le numéro écrit avec le nom de baptême fait foi quand la fiche montre que le
  // bateau a changé de numéro ensuite (trimaran « M13 Macif, FRA 301 », devenu « Actual Leader 2, FRA 53 ») ; sans
  // changement de numéro dans la chronologie, c'est le numéro de la liste de l'auteur, celui de l'en-tête restant parmi
  // les numéros portés (Lion : K 828 dans la liste, F 9231 dans l'en-tête).
  const numbered = renames.filter((r) => isNum(r.sail));
  // Seul un numéro complet (« FRA 301 ») écrit avec le baptême compte ; un nombre nu de l'en-tête (« 101 », « 85 ») peut
  // être autre chose qu'un numéro de voile.
  // Classes modernes seulement : dans les classes anciennes, l'en-tête porte souvent le numéro actuel.
  const modern = /^(?:imoca|ultim|ocean-fifty|mod-70|orma-60|maxis-g-class|class-40|figaro)\//.test(d.url || '');
  const baptismSail = modern && /^[A-Z]{1,3}\s?\d/.test(baptism?.sail || '') && numbered.some((r) => fold(r.sail) !== fold(baptism.sail)) ? baptism.sail : '';
  const launchSail = NUMEROS[d.rel]?.numero || tpLaunch?.sail || baptismSail || (numbered[0] || (isNum(header?.sail) ? header : null) || {}).sail || sails[0] || '';
  // Nom porté une année donnée : le dernier changement de nom survenu au plus tard cette année-là.
  const nameAt = (y) => {
    let n = original;
    for (const r of renames) if (r.y && r.y <= y) n = prettyCase(r.name);
    return n || title;
  };
  const fix = CORRECTIONS[d.rel];
  if (fix?.annee) years.splice(0, years.length, fix.annee);
  // L'entrée de construction de la chronologie prend aussi l'année corrigée (une seule version sur la fiche).
  if (fix?.annee && built && built !== fix.annee) {
    // L'ancienne année, répétée en tête du texte de l'auteur, est retirée à l'affichage (yearOrig).
    for (const e of dos.entries) if (e.year === built) { e.yearOrig = e.year; e.year = fix.annee; }
    if (dos.specYear) dos.specYear = fix.annee;
  }
  if (fix?.architecte) designers.splice(0, designers.length, fix.architecte);
  return { dos, current, firstRename, title, sails, prod, designers, years, built: fix?.annee || built, allNames, nameAt, launchSail, renames, original };
}

// Bateau commandé, pas encore à l'eau : la fiche technique annonce une année à venir (« 2029? Plan VPLP… »).
function plannedLaunch(d) {
  const dos = d.facts?.dos;
  if (!dos) return null;
  const intro = dos.intro.filter((b) => b.type === 'p').map((b) => b.text).join(' ');
  const y = Number((intro.match(/^\s*((?:19|20)\d{2})\s*\?/) || [])[1]) || Number(dos.specYear) || 0;
  return y > new Date().getFullYear() ? y : null;
}
const AJOUTS = readJson(path.resolve('content/ajouts.json'));
// TP52 (courus en équipage) : noms portés, résultats et rôles à bord viennent de l'extraction outils/tp52/extraire.py
// (donnees/tp52/), faite selon les règles validées par le propriétaire (docs/decisions.md, § TP52), et non du moteur de
// rôles des solitaires ci-dessous.
const TP52 = (() => {
  const dir = path.join(SOURCE_DIR, '..', 'tp52');
  const read = (n) => {
    const f = path.join(dir, n);
    if (!fs.existsSync(f)) return [];
    const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
    const [head, ...lines] = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean);
    const cols = parse(head);
    return lines.map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v])));
  };
  const resultats = new Map(read('resultats.csv').map((r) => [`${r.fichier}|${r.n}`, r]));
  return { fiches: read('fiches.csv'), noms: read('noms_portes.csv'), resultats, equipages: read('equipages.csv'), rel: (f) => `50' monos/${f}` };
})();
// « Ashley WOLFE », « Charles BURNETT III » → prénom + nom (le nom de famille est la fin écrite en capitales).
const tp52Person = (raw) => {
  const w = raw.trim().split(/\s+/);
  let i = w.length;
  while (i > 1 && /^[A-ZÀ-Ý][A-ZÀ-Ý'’.\-]+$/.test(w[i - 1])) i--;
  if (i === w.length) i = w.length - 1;
  const first = w.slice(0, i).join(' '), last = w.slice(i).join(' ');
  const pretty = last.toLowerCase().replace(/(^|[\s'’\-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bIi(i?)\b/g, (m) => m.toUpperCase());
  return { first, last, name: `${first} ${pretty}`, raw };
};
const APERCUS = readJson(path.resolve('content/apercus.json'));
// Palmarès de la Solitaire (Aurore puis Figaro), sourcé : l'archive de l'auteur est incomplète pour les éditions récentes.
const SOLITAIRE = readJson(path.resolve('content/solitaire.json'));
const editorialNote = (a, complement = false) => `<p class="source-note"><span class="archived">Ajout de la rédaction</span> ${complement ? 'Les faits les plus récents, marqués comme tels, ne figurent pas encore sur histoiredeshalfs.com.' : "Ce bateau n'est pas encore documenté sur histoiredeshalfs.com."} Sources : ${a.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(' · ')}.</p>`;

// Les listes d'origine sont des index de noms : un bateau y figure sous chacun des noms qu'il a portés.
// On regroupe ces noms en un bateau : par numéro (coque ou classe) pour les séries où il est permanent (Mini, Class 40),
// sinon par fiche — sauf les fiches qui réunissent plusieurs bateaux (pages d'architectes), dont chaque nom reste à part.
function groupBoats(S) {
  const groups = new Map();
  // Numéro du bateau : celui du nom de sa fiche (« CQ37.htm ») si la série le permet, sinon celui de la liste.
  const numberOf = (e) => {
    if (S.idBy !== 'number') return null;
    const fromFile = e.href && S.numberFromFile && path.basename(e.href).match(S.numberFromFile);
    const n = fromFile ? fromFile[1] : (e.sail.match(/\d+/) || [])[0];
    return n ? String(Number(n)) : null;
  };
  // Clé d'identité par numéro. Chez les Mini, un numéro a pu être réattribué (n° 1 : La Potagère en 1990, Ambalaba en 1992) :
  // on le complète par le plan (« D4 », « R9 »), qui distingue deux bateaux de même numéro.
  const numberKey = (e) => {
    const n = numberOf(e);
    if (!n) return null;
    return S.numberWithPlan ? `n:${n}|${fold((e.designer || '').replace(/[-\s?].*$/, ''))}` : `n:${n}`;
  };
  // 1. Les noms qui renvoient à la même fiche (d'un seul bateau) forment un bateau.
  const byNumber = new Map();
  S.entries.forEach((e, i) => {
    const d = e.href && S.docs.get(e.href);
    if (!d?.single) return;
    const key = `d:${e.href}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
    if (numberKey(e) && !byNumber.has(numberKey(e))) byNumber.set(numberKey(e), key);
  });
  // 2. Les autres noms rejoignent le bateau de même numéro (et même plan), sinon forment un bateau à part.
  S.entries.forEach((e, i) => {
    const d = e.href && S.docs.get(e.href);
    if (d?.single) return;
    const nk = numberKey(e);
    const key = (nk && byNumber.get(nk)) || nk || `e:${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return [...groups.values()].map((entries) => {
    const docs = entries.map((e) => e.href && S.docs.get(e.href)).filter(Boolean);
    const doc = docs.find((d) => d.src && d.single) || docs.find((d) => d.single) || docs[0] || null;
    const f = doc?.src && doc.single ? doc.facts : null;
    const names = [...new Map(entries.map((e) => [fold(e.name), prettyCase(e.name)])).values()];
    const name = f?.title || names[0];
    const first = (k) => entries.map((e) => e[k]).find(Boolean) || '';
    return {
      doc, entries, name,
      aliases: names.filter((n) => fold(n) !== fold(name)),
      sail: [...new Set(entries.map((e) => e.sail).filter(Boolean))].slice(0, 3).join(' · '),
      designer: first('designer'), series: first('series'),
      year: f?.built || first('year'), yearName: first('yearName'),
      current: f?.current && fold(f.current) !== fold(name) ? f.current : '',
      note: first('note'), cat: first('cat'), editorial: entries.some((e) => e.editorial),
    };
  });
}

// ---------------------------------------------------------------- Séries : chargement
const PAGE_MAP = new Map([['index A.htm', ''], ['index.html', ''], ['index.htm', ''], ['', ''], ['index anglais.htm', '']]);
const linkerFor = (rel) => (target) => (PAGE_MAP.has(target) ? prefixFor(rel) + PAGE_MAP.get(target) : null);

const series = [];
for (const def of SERIES_DEFS) {
  const sommaire = readSource(def.sommaire);
  if (!sommaire) continue;
  const lists = (Array.isArray(def.list) ? def.list : [{ rel: def.list, label: '' }]).map((l) => ({ ...l, src: readSource(l.rel) }));
  const S = { ...def, sommaireSrc: sommaire, lists, listSrc: lists.some((l) => l.src), entries: [], docs: new Map() };
  const special = new Set([def.sommaire, def.archi, ...lists.map((l) => l.rel), ...(def.aliases || []), ...def.pages.map((p) => p.rel)]);
  // TP52 : un bateau par dossier de la liste, avec ses noms successifs ; le nom de baptême est le titre de la fiche.
  if (def.tp52) for (const f of TP52.fiches) {
    const noms = TP52.noms.filter((n) => n.fichier === f.fichier);
    // Nom de baptême et numéro à la mise à l'eau : ceux de la liste de l'auteur (« TP29 2006 … USA 52698 Warpath »),
    // avec son numéro d'homonyme (« Platoon (5) » → adresse tp52/platoon-5) ; à défaut, le titre de la fiche.
    const all = [{ nom: f.bapteme_liste || f.titre || noms[0]?.nom, voile: f.voile_lancement || '', annee: f.annee_liste || '', launch: true }, ...noms].filter((n) => n.nom);
    // Un nom écrit deux fois (« Derucci, HKG 2382 » puis « Derucci, ? ???? ») garde le numéro connu. Pas d'année par nom :
    // l'année d'une entrée de liste est lue comme l'année de construction.
    const parNom = new Map();
    for (const n of all) {
      const k = fold(n.nom), sail = /\d/.test(n.voile) ? n.voile : '';
      if (!parNom.has(k)) parNom.set(k, { ...n, sail });
      else if (!parNom.get(k).sail && sail) parNom.get(k).sail = sail;
    }
    for (const n of parNom.values()) S.entries.push({ name: n.nom, href: TP52.rel(f.fichier), sail: n.sail, series: '', designer: '', year: n.launch ? n.annee : '', yearName: n.annee || '', note: '', raw: n.nom, cat: '', launch: !!n.launch });
  }
  for (const l of lists.filter((x) => x.src && !def.tp52)) {
    S.entries.push(...parseAlphaList(l.src.body, l.rel, def.listOptions)
      .filter((e) => !(e.href && special.has(e.href)) && !(e.href && /Sommaire|(^|\/)index|Mode d|A M L/i.test(e.href)))
      .map((e) => ({ ...e, cat: l.sections?.[e.section] || l.label, refine: l.sections?.[e.section] ? null : l.refine })));
  }
  // Ajouts de la rédaction (content/ajouts.json) : bateaux récents absents du site d'origine, insérés à leur place alphabétique.
  for (const a of (AJOUTS[def.slug] || []).filter((x) => x.name)) {
    const e = { name: a.name, href: `ajout:${def.slug}/${slugify(a.name)}`, sail: a.sail || '', series: '', designer: a.designer || '', year: '', yearName: '', note: '', raw: a.name, cat: a.cat || '', editorial: a };
    const at = S.entries.findIndex((x) => (x.cat || '') === e.cat && fold(x.name) > fold(e.name));
    S.entries.splice(at < 0 ? S.entries.length : at, 0, e);
  }
  // Dossiers : une page d'origine peut regrouper plusieurs bateaux (pages d'architectes).
  for (const e of S.entries) {
    if (!e.href) continue;
    if (!S.docs.has(e.href)) S.docs.set(e.href, { rel: e.href, entries: [] });
    S.docs.get(e.href).entries.push(e);
  }
  const usedSlugs = new Set(['architectes', ...def.pages.map((p) => p.slug)]);
  // Adresses déjà publiées (registre donnees/identifiants.csv) : réservées d'avance, pour qu'aucun autre bateau ne les prenne.
  for (const [k, id] of ID_REGISTRY) if (k.startsWith(`${def.slug}|`)) usedSlugs.add(id.split('/').at(-1));
  for (const d of S.docs.values()) {
    d.names = [...new Map(d.entries.map((e) => [fold(e.name), e.name])).values()];
    const file = path.basename(d.rel).replace(/\.html?$/i, '');
    // Les fichiers codés (E55, H65…) sont le dossier d'un seul bateau, quels que soient ses noms successifs ;
    // les autres (Peterson.htm, Joubert.htm…) regroupent plusieurs bateaux.
    d.single = /\d/.test(file) || d.names.length <= 2 || !!UN_BATEAU[d.rel];
    // TP52 : l'adresse suit le baptême de la liste et son numéro d'homonyme (« Platoon (5) » → tp52/platoon-5).
    const base = def.tp52 && d.entries.find((e) => e.launch) ? d.entries.find((e) => e.launch).name
      : d.single && /[a-z0-9]/i.test(d.names[0]) ? d.names[0] : file;
    // Fiche déjà publiée : elle garde son adresse, même si la lecture de son nom a été corrigée depuis.
    const fixed = ID_REGISTRY.get(`${def.slug}|${d.rel}`);
    if (fixed) { d.url = `${fixed}/`; d.fixedUrl = true; }
    else {
      let slug = slugify(base);
      if (usedSlugs.has(slug)) slug = slugify(base + ' ' + (d.entries[0].sail || file));
      while (usedSlugs.has(slug)) slug += '-2';
      usedSlugs.add(slug);
      d.url = `${def.slug}/${slug}/`;
    }
    d.editorial = d.entries.find((e) => e.editorial)?.editorial;
    // Une fiche ajoutée est écrite comme une page de l'auteur (nom, puis une ligne par fait) pour passer par le même analyseur.
    d.src = d.editorial
      ? { rel: d.rel, body: `<p>${esc(d.editorial.name)}, </p>${d.editorial.chronologie.map((l) => `<p>${esc(l)}</p>`).join('')}` }
      : readSource(d.rel);
    // Faits récents ajoutés par la rédaction à la suite d'une fiche de l'auteur.
    d.complement = (AJOUTS[def.slug] || []).find((x) => x.complete === d.rel);
    d.extraBlocks = (d.complement?.chronologie || []).map((l) => ({ type: 'p', html: esc(l), text: l, links: [], editorial: true }));
  }
  S.built = [...S.docs.values()].filter((d) => d.src);
  // Les listes sans détails (IMOCA…) sont complétées par ce que disent les fiches importées.
  for (const d of S.built) {
    const blocks = [...toBlocks(d.src.body, d.rel), ...d.extraBlocks];
    d.facts = dossierFacts(d, blocks);
    d.photos = blocks.filter(isPhoto);
    // Adresse de la fiche : le nom de baptême établi par la fiche, plutôt que le premier nom de la liste alphabétique.
    // (sauf TP52 : l'adresse garde le numéro d'homonyme de la liste de l'auteur, « Sled (4) » → tp52/sled-4)
    if (d.single && d.facts.title && !d.fixedUrl && !def.tp52) {
      const wanted = slugify(d.facts.title);
      const currentSlug = d.url.split('/').at(-2);
      if (wanted !== currentSlug && !usedSlugs.has(wanted)) {
        usedSlugs.delete(currentSlug);
        usedSlugs.add(wanted);
        d.url = `${def.slug}/${wanted}/`;
      }
    }
    // Catégorie affinée d'après la fiche (« Ultim » pour un maxi qui a couru dans cette classe).
    const text = blocks.map((b) => b.text || '').join(' ');
    for (const e of d.entries) {
      const rule = e.refine?.find((r) => r.re.test(text));
      if (rule) e.cat = rule.label;
    }
    for (const e of d.entries) {
      if (!e.sail && d.facts.sails[0]) e.sail = d.facts.sails[0];
      // (suite de l'enrichissement des lignes de liste)
      if (!e.designer && !e.series && d.facts.designers[0]) e.designer = d.facts.designers[0];
      if (!e.year && !e.yearName && d.facts.built) e.year = d.facts.built;
      if (CORRECTIONS[d.rel]?.annee) e.year = CORRECTIONS[d.rel].annee;
      if (d.facts.current && fold(d.facts.current) !== fold(e.name)) e.current = d.facts.current;
    }
  }
  // Rubrique tirée d'une liste partagée (Ultim, MOD 70, Maxis) : on ne garde que les bateaux de sa catégorie.
  // Les bateaux sans fiche ne peuvent pas être classés Ultim ; ils restent dans la catégorie par défaut de la liste.
  if (def.keep) {
    S.entries = S.entries.filter((e) => e.cat === def.keep || e.editorial);
    for (const [k, d] of S.docs) {
      d.entries = d.entries.filter((e) => S.entries.includes(e));
      if (!d.entries.length) S.docs.delete(k);
    }
    S.built = S.built.filter((d) => S.docs.has(d.rel));
  }
  // Pages partagées (sommaire, listes) : la première rubrique qui les déclare les reçoit.
  for (const r of [def.sommaire, ...lists.map((l) => l.rel), ...(def.aliases || [])]) if (!PAGE_MAP.has(r)) PAGE_MAP.set(r, `${def.slug}/`);
  if (def.archi) PAGE_MAP.set(def.archi, `${def.slug}/architectes/`);
  for (const p of def.pages) PAGE_MAP.set(p.rel, `${def.slug}/${p.slug}/`);
  for (const d of S.built) if (!PAGE_MAP.has(d.rel)) PAGE_MAP.set(d.rel, d.url);
  S.boats = groupBoats(S);
  // Nom de bateau (normalisé) -> URL : la fiche si elle est importée, sinon la liste filtrée sur ce nom.
  S.boatUrl = new Map();
  for (const e of S.entries) {
    const k = fold(e.name);
    const d = e.href && S.docs.get(e.href);
    if (d?.src) S.boatUrl.set(k, d.url);
    else if (!S.boatUrl.has(k)) S.boatUrl.set(k, `${def.slug}/bateaux/?q=${encodeURIComponent(e.name)}`);
  }
  series.push(S);
}
const bySlug = new Map(series.map((S) => [S.slug, S]));
publishedSlugs = new Set(bySlug.keys());

// ---------------------------------------------------------------- Skippers : compilation
// Les skippers sont tirés de toutes les fiches bateau importées. 1er passage : les lignes de résultats et d'équipage,
// où l'auteur écrit « Prénom NOM ». 2e passage : toutes les autres lignes qui citent un skipper déjà connu
// (vente, blessure, sauvetage…), quelle que soit la casse. Chaque mention garde son bateau, son année et son texte.
// Année inconnue (« ?? ») : 0, la mention reprend l'année qui la précède dans la fiche (pas d'année « 55 » inventée).
const yearOf = (y) => (/^(?:19|20)\d/.test(String(y || '')) ? Number(String(y).replace(/\?/g, '5').slice(0, 4)) || 0 : 0);
// Tous les noms portés par le bateau d'une fiche (pour ne pas les prendre pour des événements).
const boatNames = (d) => [...new Set([...(d.names || []), ...(d.facts?.allNames || []).map((n) => n.name), d.facts?.title].filter(Boolean))];
// Faits marquants d'une fiche skipper : seulement ceux qui concernent le bateau qu'il menait. Décès, disparition,
// blessure et sauvetage ne lui sont pas attribués automatiquement : le skipper cité sur la ligne n'est souvent pas
// la personne concernée (témoin, concurrent qui porte secours). Ces lignes restent dans « Toutes les mentions ».
const NOTABLE = ['sink', 'capsize', 'dismast', 'record', 'damage'];
const SKIPPERS = new Map();
const MERGED = new Map();
const firstFold = (f) => fold(f).replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim();
const lastWordOf = (last) => fold(last).split(/[\s-]+/).at(-1);
// Clé : le nom complet normalisé (« Jean LE CAM » et « Jean Le CAM » donnent « jean le cam »).
// Une initiale (« J. Dejeanty ») rejoint le prénom complet s'il est unique pour ce nom.
const fullKeys = new Map();
const fullKey = (first, last) => fold(`${first} ${last}`).replace(/[-.]/g, ' ').replace(/\s+/g, ' ').trim();
const keyOf = (first, last) => {
  const f = firstFold(first);
  if (f.length <= 2) {
    const cands = fullKeys.get(`${f[0]}|${lastWordOf(last)}`);
    if (cands?.size === 1) return [...cands][0];
  }
  return fullKey(first, last);
};
const allMentionBlocks = [];
for (const S of series) for (const d of S.built) {
  if (!d.single) continue;
  let carry = 0;
  for (const e of d.facts.dos.entries) {
    const y = yearOf(e.year) || carry;
    carry = y;
    for (const b of e.blocks) if (b.type === 'p') allMentionBlocks.push({ S, d, y, b });
  }
}
// Prénoms complets connus, pour rattacher les initiales.
for (const { b } of allMentionBlocks) for (const m of skipperMentions(b.text)) {
  const f = firstFold(m.first);
  if (f.length > 2) {
    const k = `${f[0]}|${lastWordOf(m.last)}`;
    if (!fullKeys.has(k)) fullKeys.set(k, new Set());
    fullKeys.get(k).add(fullKey(m.first, m.last));
  }
}
const addMention = (key, info, ctx) => {
  if (!SKIPPERS.has(key)) SKIPPERS.set(key, { key, forms: new Map(), raws: new Set(), lastFull: fold(info.last), lasts: new Set(), firsts: new Set(), mentions: [] });
  const sk = SKIPPERS.get(key);
  sk.lasts.add(fold(info.last));
  if (info.raw) sk.raws.add(info.raw);
  if (info.name) sk.forms.set(info.name, (sk.forms.get(info.name) || 0) + 1);
  sk.firsts.add(firstFold(info.first));
  if (!sk.mentions.some((m) => m.b === ctx.b)) sk.mentions.push(ctx);
};
for (const ctx of allMentionBlocks) for (const m of skipperMentions(ctx.b.text)) addMention(keyOf(m.first, m.last), m, ctx);
// Fautes de frappe de l'auteur (« Frank » / « Franck Cammas », « Loic » / « Loick Peyron ») : même nom de famille et
// prénoms qui ne diffèrent que d'une lettre → une seule personne (la forme la plus citée l'emporte).
const oneEdit = (a, b) => {
  if (a === b || Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return a === b;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + (a.length >= b.length ? 1 : 0)) === b.slice(i + (b.length >= a.length ? 1 : 0));
};
{
  const groups = new Map();
  for (const sk of SKIPPERS.values()) {
    const k = sk.lastFull;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(sk);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.mentions.length - a.mentions.length);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!a || !b || !SKIPPERS.has(b.key)) continue;
      const fa = [...a.firsts][0], fb = [...b.firsts][0];
      if (!fa || !fb || !oneEdit(fa, fb)) continue;
      mergeSkipper(a, b);
    }
  }
  // Même prénom, noms de famille à une lettre près (« Ian Lipinsky » / « Ian Lipinski »).
  const byFirst = new Map();
  for (const sk of SKIPPERS.values()) {
    const f = [...sk.firsts][0];
    if (!f) continue;
    if (!byFirst.has(f)) byFirst.set(f, []);
    byFirst.get(f).push(sk);
  }
  for (const list of byFirst.values()) {
    list.sort((a, b) => b.mentions.length - a.mentions.length);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!SKIPPERS.has(a.key) || !SKIPPERS.has(b.key)) continue;
      if (Math.min(a.lastFull.length, b.lastFull.length) >= 5 && a.lastFull !== b.lastFull && oneEdit(a.lastFull, b.lastFull)) mergeSkipper(a, b);
    }
  }
}
function mergeSkipper(a, b) {
  for (const [n, c] of b.forms) a.forms.set(n, (a.forms.get(n) || 0) + c);
  b.raws.forEach((r) => a.raws.add(r)); b.firsts.forEach((f) => a.firsts.add(f)); (b.lasts || []).forEach((l) => a.lasts.add(l));
  for (const m of b.mentions) if (!a.mentions.some((x) => x.b === m.b)) a.mentions.push(m);
  // Classements des pages de résultats et de l'extraction TP52 : ils suivent la fusion (sinon ils seraient perdus).
  if (b.pageResults?.length) (a.pageResults ||= []).push(...b.pageResults);
  if (b.implicitResults?.length) (a.implicitResults ||= []).push(...b.implicitResults);
  SKIPPERS.delete(b.key);
  // Les autres formes de la clé fusionnée mènent désormais à la même fiche.
  b.mergedInto = a;
  MERGED.set(b.key, a);
}
// 2e passage : par nom de famille, puis vérification du prénom (ou de l'initiale) qui le précède.
const byLastWord = new Map();
for (const sk of SKIPPERS.values()) {
  const w = sk.lastFull.split(/[\s-]+/).at(-1);
  if (!byLastWord.has(w)) byLastWord.set(w, []);
  byLastWord.get(w).push(sk);
}
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const ctx of allMentionBlocks) {
  const t = fold(ctx.b.text);
  for (const w of new Set(t.split(/[^a-z0-9']+/))) for (const sk of byLastWord.get(w) || []) {
    if (sk.mentions.some((m) => m.b === ctx.b)) continue;
    const firsts = [...sk.firsts].map((f) => (f.length <= 2 ? `${reEsc(f[0])}\\.?` : reEsc(f).replace(/ /g, '[\\s-]+')));
    const re = new RegExp(`(?:^|[^a-z])(?:${firsts.join('|')})\\s+${reEsc(sk.lastFull).replace(/ /g, '[\\s-]+')}(?![a-z])`);
    if (re.test(t)) sk.mentions.push(ctx);
  }
}
// Classements des pages de résultats (Mini Transat, Aurore/Figaro, Half Ton Cup, Class 40…) : ajoutés au palmarès.
// Un skipper qui n'apparaît que dans ces pages reçoit aussi sa fiche.
const knownFirst = new Set([...SKIPPERS.values()].flatMap((sk) => [...sk.firsts].map((f) => f.split(' ')[0])).filter((f) => f.length > 2));
const knownLast = new Set([...SKIPPERS.values()].map((sk) => sk.lastFull));
const ensureSkipper = (p) => {
  const key = keyOf(p.first, p.last);
  const sk = SKIPPERS.get(key) || MERGED.get(key) || { key, forms: new Map(), raws: new Set(), lastFull: fold(p.last), lasts: new Set(), firsts: new Set([firstFold(p.first)]), mentions: [] };
  if (!SKIPPERS.has(sk.key)) SKIPPERS.set(sk.key, sk);
  sk.lasts.add(fold(p.last));
  sk.raws.add(p.raw);
  sk.forms.set(p.name, (sk.forms.get(p.name) || 0) + 1);
  return sk;
};
const DATE_LEAD = /^\s*(?:\d{1,2}(?:er)?\s*(?:[-–]\s*\d{1,2})?\s*)?(?:(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|may|june|july|august|september|october|november|december)(?![a-zà-ÿ]))?\s*,?\s*/i;
const raceLabel = (text) => {
  const big = text.match(BIG_RACE);
  const t = text.replace(DATE_LEAD, '').split(/[:,(]/)[0].trim();
  return t.length >= 3 && t.length <= 60 && !/^(photo|picture|\d)/i.test(t) ? t : big ? big[0] : '';
};
for (const S of series) for (const p of S.pages.filter((x) => x.results)) {
  const src = readSource(p.rel);
  if (!src) continue;
  const parsed = parseResults(dropNav(toBlocks(src.body, p.rel), p.title), { loose: !!p.looseEditions });
  parsed.editions.forEach((ed, i) => {
    const titleText = decodeEntities(ed.titleHtml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const total = (titleText.match(/(\d+)\s*(?:\(\w+\s*\d+\)\s*)?(?:bateaux|partants|inscrits|classés|entrants|boats)/i) || [])[1];
    const anchor = `${S.slug}/${p.slug}/#y${ed.year}-${i}`;
    for (const row of ed.results) {
      const text = decodeEntities(row.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      // « 1 Gautier Concorde Andrieu » (skipper, bateau, architecte) : un nom de famille connu en tête n'est pas un prénom,
      // sauf si la personne est déjà connue sous ce nom complet.
      const people = [...skipperMentions(text, { anyLine: true }),
        ...leadingPersons(text, knownFirst).filter((p) => !knownLast.has(fold(p.first)) || SKIPPERS.has(keyOf(p.first, p.last)))];
      if (!people.length) continue;
      const race = p.race || (p.raceFrom === 'heading' && raceLabel(row.heading)) || (p.raceFrom === 'title' && raceLabel(titleText)) || `Classement ${S.short}`;
      // Bateau de la ligne : un nom en gras ou entre parenthèses qui correspond à un bateau connu de la série.
      const candidates = [...row.html.matchAll(/<strong>([^<]{2,40})<\/strong>/g)].map((m) => decodeEntities(m[1]).trim())
        .concat((text.match(/\(([^)]{2,40})\)/) || []).slice(1));
      const boatName = candidates.find((c) => S.boatUrl.has(fold(c))) || '';
      const n = /^\d+$/.test(row.rank) ? String(Number(row.rank)) : row.rank;
      const rank = `${n}${/^\d+$/.test(n) ? (n === '1' ? 'er' : 'e') : ''}${total ? `/${total}` : ''}`;
      const seenKeys = new Set();
      for (const person of people) {
        const sk = ensureSkipper(person);
        if (seenKeys.has(sk.key)) continue;
        seenKeys.add(sk.key);
        (sk.pageResults ||= []).push({ y: Number(ed.year), race, rank, first: n === '1', big: BIG_RACE.test(race) || !!p.race,
          boatName: boatName ? prettyCase(boatName) : '', boatHref: boatName ? S.boatUrl.get(fold(boatName)) : '', href: anchor, S });
      }
    }
  });
}

// TP52 : chaque ligne d'équipage (skipper ou équipier) de l'extraction devient une ligne du palmarès du marin.
{
  const S = series.find((x) => x.tp52);
  for (const e of S ? TP52.equipages : []) {
    if (e.role !== 'skipper' && e.role !== 'equipier') continue;
    const r = TP52.resultats.get(`${e.fichier}|${e.resultat}`);
    const d = S.docs.get(TP52.rel(e.fichier));
    if (!r || !d) continue;
    const race = (r.course || '').replace(/^\s*(?:fin|d[ée]but|mi|early|late|mid)[\s-]+/i, '').replace(DATE_LEAD, '').replace(/^[\s,.;:–-]+/, '').trim() || 'Course TP52';
    const n = r.place;
    const rank = `${n}${/^\d+$/.test(n) ? (n === '1' ? 'er' : 'e') : ''}${r.partants ? `/${r.partants}` : ''}`;
    const sk = ensureSkipper(tp52Person(e.marin));
    (sk.pageResults ||= []).push({ y: Number(r.annee) || 0, race, rank, first: n === '1', big: BIG_RACE.test(race), co: e.role === 'equipier',
      boatName: prettyCase(r.bateau || d.names?.[0] || ''), boatHref: d.url, href: d.url, S, d, tp52: e.mode });
  }
}

// Un classement n'est crédité au skipper que s'il est cité comme concurrent, pas comme repère
// (« à 21j de Desjoyaux », « devant Michel Desjoyeaux », « ex-Foncia de Michel Desjoyeaux »).
const creditedIn = (sk, text) => {
  const t = fold(text);
  if (!sk.creditRe) {
    const firsts = [...sk.firsts].map((f) => (f.length <= 2 ? `${reEsc(f[0])}\\.?` : reEsc(f).replace(/ /g, '[\\s-]+')));
    const lasts = [...(sk.lasts?.size ? sk.lasts : [sk.lastFull])].map((l) => reEsc(l).replace(/ /g, '[\\s-]+'));
    sk.creditRe = new RegExp(`(?:(?:${firsts.join('|')})\\s+)?(?:${lasts.join('|')})(?![a-z])`, 'g');
  }
  for (const m of t.matchAll(sk.creditRe)) {
    const before = t.slice(Math.max(0, m.index - 14), m.index);
    if (!/(?:\bde|\bd'|devant|derriere|\bex[- ]?|\ba|\bsur|face a|\bpar)\s*$/.test(before)) return true;
  }
  return false;
};
// Lignes où un skipper est cité sans être à bord : annonce de vente qui recopie le palmarès du bateau (« Vendée Globe
// 2020 : 2e place - Charlie Dalin (Apivia) » en 2025), hommage ou décès (« Concarneau hommage à Charlie Dalin »).
// Elles restent dans « Toutes les mentions », mais ne donnent ni bateau, ni classement, ni place dans la frise.
const NOT_ABOARD = /[àa] vendre|for sale|mise? en vente|annonce de vente|hommage|obs[eè]ques|fun[ée]railles|d[ée]c[ée]d[ée]e?s?|\bd[ée]c[eè]s\b|in memoriam|minute de silence/i;
const CREW_WORDS = /skipp|barr[ée]|[ée]quip|[ée]q\s*:|à bord|navigat|propri|achet|owner|helm|crew/i;

// Rôle d'une personne citée dans l'historique d'un bateau, d'après la façon dont l'auteur écrit ses lignes :
//  skipper — elle mène le bateau : « 4e/31 en 14j…, Mike BIRCH », « skippé par… », le premier nommé d'un duo ;
//  co      — co-skipper ou équipier : « Éq: Maud ROUSSEL », « Aurélien DUCROZ & Romain ATTANASIO » (le second),
//            « Jean-François COSTE, avec Titouan Lamazou » ;
//  owner   — propriétaire : « acheté par… », « New owner, Stuart ALEXANDER » ;
//  tiers   — citée sans rapport avec le bord : concurrent (« devant…, skippé par Steve White », « à 3h de… », « vainqueur… »),
//            skipper d'un autre bateau (« Jérémie Beyou (Maître Coq) »), liste de skippers sans classement (« Boris Herrmann,
//            Jérémie Beyou, Sam Goodchild… 7 IMOCA s'entraînent »), annonce de vente, hommage.
// « Équipier: Frédéric Zimmermann, Sigrid LONGEAU » : le nom qui suit l'équipier, après une virgule, est souvent le skipper ;
// il est tranché ensuite : skipper s'il mène le bateau la même année sur d'autres lignes, équipier sinon (« Éq: A, B, C »).
const CO_ONE = /(?:\beq\s*:|\bequipier(?:e)?\s*:?|\bco[- ]?skipper\s*:?)/;
const CO_ALL = /(?:\bequipier(?:e)?s\s*:?|\bcrew\s*:|\bco[- ]?skippers\s*:?|\bequipage\s*[:,]|dans l'equipage|parmi l'equipage|\bequip\s*:)/;
// « dans l'équipage » ajouté après la relecture du 09/11/2026 (Neil Pryde 6 : Hellen MacArthur, équipière en 1996).
// Duo « A & B » : l'auteur nomme d'ordinaire le skipper en premier, mais pas toujours (« Frank CAMMAS & Jérémie BEYOU » sur
// Charal) ; le partenaire est noté pour trancher ensuite d'après le titulaire du bateau.
const DUO_PARTNER = new Map();
const OWNER_MARK = /(?:\bachete|\brachete|\bachat\b|\bacquis|\bvendu a\b|propriet|\bowner\b)/;
// Parenthèse après un nom qui n'est pas un autre bateau : nationalité, poste à bord, âge (« Patrick Tabarly (FRA) »,
// « Fred Le Maistre (régleur) »).
const PAREN_NOT_BOAT = /^\d|^ex\b|^eq|^skip|^co\b|^co-|^[a-z]{2,3}$|regleu|navigat|barreu|tacticien|bowman|^n\s?°|^no\s?\d|piano|chef|responsable|medecin|cuisin|ans\b|mat\b|avant\b|winch|stratege|reporter|onboard|helm|trim/;
const RIVAL_MARK = /(?:\bdevant\b|\bderriere\b|\bvainqueu|\bgagne(?:e)? par|\bremporte(?:e)? par|\bbattu|\bdevance|\brecord de\b|\bcontre\b|\bface a\b|\bapres\b|\bavant\b|\bhommage\b)/;
const LED_BY = /(?:skippe|barre|mene|achete|rachete|engage|confie|conduit|pilote)e?s?\s+par\s*$/;
const skippersOfBlock = new Map();
const ROLES = new Map();
const ROLE_RANK = { skipper: 3, co: 2, 'co?': 2, owner: 1, tiers: 0 };
function baseRole(sk, m) {
  const text = m.b.text;
  if (NOT_ABOARD.test(text)) return 'tiers';
  const t = fold(text);
  creditedIn(sk, text);
  const others = [...(skippersOfBlock.get(m.b) || [])].filter((o) => o !== sk);
  const otherSpans = others.flatMap((o) => { creditedIn(o, text); return [...t.matchAll(o.creditRe)].map((x) => [x.index, x.index + x[0].length]); });
  const otherStarts = otherSpans.map(([s]) => s);
  let best = null;
  for (const x of t.matchAll(sk.creditRe)) {
    const p = x.index;
    const before = t.slice(Math.max(0, p - 18), p);
    const sentence = Math.max(t.lastIndexOf('; ', p), t.lastIndexOf('. ', p), t.lastIndexOf('! ', p)) + 1;
    const clause = t.slice(sentence, p);
    const segment = t.slice(Math.max(t.lastIndexOf(',', p - 1), t.lastIndexOf('(', p - 1), sentence - 1) + 1, p);
    const after = t.slice(p + x[0].length);
    const paren = after.match(/^\s*\(([^)]{2,40})\)/);
    // Liste de noms sans classement (« Boris Herrmann, Jérémie Beyou, Sam Goodchild… ») : au moins trois noms qui se
    // suivent, séparés par une virgule ou « et ».
    const spans = [...otherSpans, [p, p + x[0].length]].sort((a, b) => a[0] - b[0]);
    const group = [0];
    for (let k = 1; k < spans.length; k++) group[k] = /^\s*(?:,|et|&)\s*$/.test(t.slice(spans[k - 1][1], spans[k][0])) ? group[k - 1] : group[k - 1] + 1;
    const mine = group[spans.findIndex((s) => s[0] === p)];
    const inRun = group.filter((g) => g === mine).length;
    // « Le VM Matériaux de Jean Le Cam » dans la fiche de VM Matériaux : c'est son bateau.
    const ownBoatOf = (m.d.facts.allNames || []).some((n) => n.name.length >= 3 && t.slice(Math.max(0, p - n.name.length - 6), p).endsWith(`${fold(n.name)} de `));
    let role;
    if (OWNER_MARK.test(segment) || /^\W{0,3}(?:qui (?:vient d'|a )?)?(?:achete|rachete|acquiert)/.test(after)) role = 'owner';
    // « reçu de Louis Claudepierre : "… je suis le nouveau propriétaire" » : le propriétaire qui écrit à l'auteur.
    else if (/(?:\bde|\bd')\s*$/.test(before) && /proprietaire|\bowner\b/.test(after.slice(0, 160))) role = 'owner';
    // Photographe, courtier, concurrent aidé (« Photo B. Stichelbaut », « Nicolas Raynaud, archives revue Bateaux »,
    // « courtier Bernard Gallay », « Loik va aider Philippe Poupon ») : cités, pas à bord (relecture du 09/11/2026).
    else if (/(?:photos?|photographie|cliches?|photographe|recue? de|envoyee? par|courtier|broker|aider|aide)\s*:?\s*$/.test(before)
      || /^\s*[,(]?\s*(?:archives|photos?\b|courtier|broker|yacht broker)/.test(after)
      // « jusqu'à ce que Loic Peyron arrive et l'aide à redresser » : le concurrent qui porte secours.
      || /^[^.;]{0,30}?(?:l'aide|l'aider|\baider|vient en aide|porter? secours|redresser)/.test(after)) role = 'tiers';
    else if (ownBoatOf || /(?:aux mains|entre les mains|confiee?) (?:de|d'|a)\s*$/.test(before)) role = 'skipper';
    else if (CO_ALL.test(clause)) role = 'co';
    else if (/(?:\bde|\bd'|\bex[- ]?\S*|\ba|\bsur|\bpar)\s*$/.test(before) && !LED_BY.test(before)) role = 'tiers';
    else if (RACE_NAMED_AFTER.test(before)) role = 'tiers';
    // Sauveteur (« skipper récupéré par une concurrente, Marie Agnes Peron »).
    else if (/\b(?:recupere|secouru|sauve|repeche|remorque)e?s? par\b/.test(clause)) role = 'tiers';
    else if (RIVAL_MARK.test(segment)) role = 'tiers';
    else if (paren && !PAREN_NOT_BOAT.test(paren[1].trim()) && !(m.d.facts.allNames || []).some((n) => fold(n.name) === paren[1].trim())) role = 'tiers';
    else if (CO_ONE.test(clause)) role = CO_ONE.test(segment) ? 'co' : 'co?';
    else if (OWNER_MARK.test(clause)) role = 'owner';
    else if (inRun >= 3 && !resultOf(text) && !CREW_WORDS.test(text)) role = 'tiers';
    // Équipage écrit à la suite (« Patrick Tabarly, Philippe POUPON », « A & B ») : les noms après le premier sont l'équipage.
    else if ((/(?:&|\bet|\band|\/|\+)\s*$/.test(before) && otherStarts.some((q) => q < p))
      || otherSpans.some(([, e]) => e <= p && /^\s*,\s*$/.test(t.slice(e, p)))) {
      role = 'co';
      // Partenaire : la personne nommée juste avant.
      const prev = others.map((o) => [o, [...t.matchAll(o.creditRe)].map((y) => y.index).filter((q) => q < p).at(-1)]).filter(([, q]) => q !== undefined).sort((a, b) => b[1] - a[1])[0];
      if (prev) { if (!DUO_PARTNER.has(m)) DUO_PARTNER.set(m, new Map()); DUO_PARTNER.get(m).set(sk, prev[0]); }
    }
    else if (/\b(?:avec|with)\s*$/.test(before) && (otherStarts.some((q) => q < p) || !/inscri|engag|confi|skipp|mene|pour\b/.test(clause))) role = 'co';
    else role = 'skipper';
    if (!best || ROLE_RANK[role] > ROLE_RANK[best]) best = role;
  }
  return best || 'tiers';
}
const roleOf = (sk, m) => ROLES.get(sk)?.get(m) || 'tiers';
const aboardAs = (sk, m) => roleOf(sk, m) !== 'tiers';
// L'auteur n'écrit pas toujours le skipper sur chaque ligne de résultat (« VENDEE GLOBE: … 1er/24 en 93j03h57' » sur PRB,
// année 2000, Michel Desjoyeaux étant cité sur les autres lignes de l'année). Un classement sans nom revient au skipper
// du bateau cette année-là, s'il est seul cité dans les résultats de l'année.
{
  const blockSk = skippersOfBlock;
  for (const sk of SKIPPERS.values()) for (const m of sk.mentions) {
    if (!blockSk.has(m.b)) blockSk.set(m.b, new Set());
    blockSk.get(m.b).add(sk);
  }
  for (const sk of SKIPPERS.values()) ROLES.set(sk, new Map(sk.mentions.map((m) => [m, baseRole(sk, m)])));
  // TP52 : le rôle tenu sur le bateau est celui de l'extraction validée (skipper, équipier → co, propriétaire cité → owner).
  {
    const tpRole = new Map();
    const map = { skipper: 'skipper', equipier: 'co', proprietaire: 'owner' };
    for (const e of TP52.equipages) {
      const r = map[e.role]; if (!r) continue;
      const p = tp52Person(e.marin);
      const k = `${TP52.rel(e.fichier)}|${keyOf(p.first, p.last)}`;
      if (!tpRole.has(k) || ROLE_RANK[r] > ROLE_RANK[tpRole.get(k)]) tpRole.set(k, r);
    }
    for (const [sk, roles] of ROLES) for (const m of roles.keys()) if (m.S.tp52) roles.set(m, tpRole.get(`${m.d.rel}|${sk.key}`) || 'tiers');
  }
  // « co? » : skipper s'il mène le bateau sur une autre ligne (la même année, ou à défaut une autre année de la fiche),
  // équipier sinon.
  for (const roles of ROLES.values()) for (const [m, r] of roles) {
    if (r !== 'co?') continue;
    const leads = [...roles].filter(([m2, r2]) => r2 === 'skipper' && m2.d === m.d);
    roles.set(m, leads.some(([m2]) => m2.y === m.y) || leads.length >= 2 ? 'skipper' : 'co');
  }
  // Duo nommé dans le désordre : si le second mène bien plus souvent le bateau que le premier, les rôles s'inversent.
  const leadCount = (sk, d) => [...(ROLES.get(sk) || [])].filter(([m2, r2]) => r2 === 'skipper' && m2.d === d).length;
  for (const [m, pairs] of DUO_PARTNER) for (const [b, a] of pairs) {
    if (m.S.tp52) continue;
    const rb = ROLES.get(b), ra = ROLES.get(a);
    if (rb?.get(m) !== 'co' || ra?.get(m) !== 'skipper') continue;
    const nb = leadCount(b, m.d), na = leadCount(a, m.d);
    if (nb >= 3 && nb > 2 * na) { rb.set(m, 'skipper'); ra.set(m, 'co'); }
  }
  if (process.env.AUDIT_ROLES) {
    fs.mkdirSync('_audit', { recursive: true });
    fs.writeFileSync('_audit/roles.tsv', [...ROLES].flatMap(([sk, roles]) => [...roles].map(([m, r]) => [r, [...sk.forms.keys()][0], m.d.facts.title, m.y, m.b.text.replace(/\s+/g, ' ').slice(0, 220)].join('\t'))).join('\n'));
  }
  const yearSk = new Map();
  for (const sk of SKIPPERS.values()) for (const m of sk.mentions) {
    if (!m.y || roleOf(sk, m) !== 'skipper' || !resultOf(m.b.text)) continue;
    const k = `${m.d.rel}|${m.y}`;
    if (!yearSk.has(k)) yearSk.set(k, new Set());
    yearSk.get(k).add(sk);
  }
  for (const ctx of allMentionBlocks) {
    if (!ctx.y || ctx.S.tp52 || blockSk.has(ctx.b) || NOT_ABOARD.test(ctx.b.text)) continue;
    const r = resultOf(ctx.b.text);
    const who = yearSk.get(`${ctx.d.rel}|${ctx.y}`);
    if (!r || !who || who.size !== 1) continue;
    const sk = [...who][0];
    (sk.implicitResults ||= []).push({ ...r, y: ctx.y, d: ctx.d, S: ctx.S, big: BIG_RACE.test(r.race), implicit: true, text: ctx.b.text });
  }
}

// Vainqueurs de la Solitaire (content/solitaire.json) : la victoire rejoint le palmarès du skipper si l'archive ne la donne
// pas (Alexis Loison, 2025). Le nom est rapproché des formes de l'archive (« J. Marie Vidal », « Dominique Vittet »,
// « Malinovski ») : même nom de famille à une lettre près, puis même prénom ou même initiale.
const findSkipper = (p) => {
  const last = fold(p.last).replace(/[^a-z]/g, ''), first = firstFold(p.first).replace(/[^a-z]/g, '');
  const cands = [...SKIPPERS.values()].filter((sk) => [...sk.lasts, sk.lastFull].some((l) => { const x = l.replace(/[^a-z]/g, ''); return x === last || (last.length >= 6 && oneEdit(x, last)); }))
    .sort((a, b) => b.mentions.length - a.mentions.length);
  const fs2 = (sk) => [...sk.firsts].map((f) => f.replace(/[^a-z]/g, ''));
  return cands.find((sk) => fs2(sk).includes(first)) || cands.find((sk) => fs2(sk).some((f) => f[0] === first[0])) || null;
};
const FIGARO_S = series.find((S) => S.slug === 'figaro');
for (const [y, v] of Object.entries(SOLITAIRE.vainqueurs || {})) {
  const words = v.skipper.split(' ');
  const person = { first: words[0], last: words.slice(1).join(' '), name: v.skipper, raw: v.skipper };
  const sk = findSkipper(person) || ensureSkipper(person);
  v.sk = sk;
  (sk.pageResults ||= []).push({ y: Number(y), race: Number(y) < 1980 ? 'Course de l’Aurore' : 'Solitaire du Figaro', rank: '1er', first: true, big: true,
    boatName: v.bateau || '', boatHref: '', href: `figaro/la-solitaire/#y${y}`, S: FIGARO_S, editorial: true });
}

// Fiche de chaque skipper : nom affiché, bateaux, palmarès, faits marquants.
const usedSkSlugs = new Set();
// Orthographe exacte d'un skipper que l'archive écrit souvent autrement (content/normalisation.json, « skippers »).
const SK_SPELLING = new Map(Object.entries(readJson(path.resolve('content/normalisation.json')).skippers || {}).filter(([, vs]) => Array.isArray(vs)).flatMap(([k, vs]) => [[fold(k), k], ...vs.map((v) => [fold(v), k])]));
// Même skipper sous plusieurs écritures déclarées (« Lars Aage Sorensen », « Lars Aage Gade-Sørensen ») : une seule fiche.
const skCanon = (sk) => [...sk.forms.keys()].map((f) => SK_SPELLING.get(fold(f))).find(Boolean);
const byCanon = new Map();
for (const sk of [...SKIPPERS.values()]) {
  const c = skCanon(sk);
  if (!c) continue;
  const target = byCanon.get(c);
  if (!target || !SKIPPERS.has(target.key)) { byCanon.set(c, sk); continue; }
  mergeSkipper(target, sk);
  // Les rôles (skipper, co-skipper…) sont déjà établis : ceux des mentions reprises suivent.
  if (!ROLES.has(target)) ROLES.set(target, new Map());
  for (const [m, r] of ROLES.get(sk) || []) ROLES.get(target).set(m, r);
}
for (const sk of SKIPPERS.values()) {
  const forms = [...sk.forms].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const name = (forms.find(([n]) => !/^[A-Z]\.?\s/.test(n)) || forms[0])[0];
  sk.name = SK_SPELLING.get(fold(name)) || name;
  let slug = slugify(sk.name);
  while (usedSkSlugs.has(slug)) slug += '-2';
  usedSkSlugs.add(slug);
  sk.slug = slug;
  sk.url = `skippers/${slug}/`;
  sk.lastSort = fold(sk.name.split(' ').slice(1).join(' ') || sk.name);
  sk.mentions.sort((a, b) => a.y - b.y);
  const boats = new Map();
  // Bateaux : rôle le plus fort tenu à bord (skipper, puis co-skipper ou équipier, puis propriétaire).
  for (const m of sk.mentions) {
    const role = roleOf(sk, m);
    if (role === 'tiers') continue;
    if (!boats.has(m.d)) boats.set(m.d, { d: m.d, S: m.S, years: new Set(), n: 0, role });
    const bt = boats.get(m.d); bt.n++; if (m.y) bt.years.add(m.y);
    if (ROLE_RANK[role] > ROLE_RANK[bt.role]) bt.role = role;
  }
  // TP52 : le bateau de chaque ligne du palmarès tirée de l'extraction (le marin n'est pas toujours repéré dans le texte).
  for (const r of sk.pageResults || []) {
    if (!r.tp52 || !r.d) continue;
    const role = r.co ? 'co' : 'skipper';
    if (!boats.has(r.d)) boats.set(r.d, { d: r.d, S: r.S, years: new Set(), n: 0, role });
    const bt = boats.get(r.d); bt.n++; if (r.y) bt.years.add(r.y);
    if (ROLE_RANK[role] > ROLE_RANK[bt.role]) bt.role = role;
  }
  sk.boats = [...boats.values()].sort((a, b) => Math.min(...a.years, 9999) - Math.min(...b.years, 9999));
  const seen = new Set();
  sk.results = [];
  for (const m of sk.mentions) {
    if (m.S.tp52) continue; // TP52 : palmarès tiré de l'extraction (pageResults)
    const r = resultOf(m.b.text);
    const role = roleOf(sk, m);
    if (!r || (role !== 'skipper' && role !== 'co')) continue;
    // Deux fiches de l'auteur peuvent relater la même course : année + course + place suffisent.
    const k = `${m.y}|${fold(r.race)}|${r.rank.split('/')[0]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    sk.results.push({ ...r, y: m.y, d: m.d, S: m.S, big: BIG_RACE.test(r.race), co: role === 'co', text: m.b.text });
  }
  // Classements sans nom de skipper, attribués au skipper du bateau cette année-là (voir plus haut).
  // Une grande course n'a qu'un classement par année : un classement signé l'emporte sur un classement déduit.
  const bigDone = new Set(sk.results.filter((r) => r.big).map((r) => `${r.y}|${fold(r.race)}`));
  for (const r of sk.implicitResults || []) {
    const k = `${r.y}|${fold(r.race)}|${r.rank.split('/')[0]}`;
    if (seen.has(k) || (r.big && bigDone.has(`${r.y}|${fold(r.race)}`))) continue;
    if (r.big) bigDone.add(`${r.y}|${fold(r.race)}`);
    seen.add(k);
    sk.results.push(r);
  }
  // Classements des pages de résultats, s'ils ne sont pas déjà connus par une fiche bateau.
  for (const r of sk.pageResults || []) {
    const k = `${r.y}|${fold(r.race)}|${r.rank.split('/')[0]}`;
    if (seen.has(k)) continue;
    // Victoire du palmarès déjà connue de l'archive (sous un autre libellé : « Figaro », « Solitaire de l'Aurore / du Figaro »).
    if (r.editorial && sk.results.some((x) => x.y === r.y && x.first && /solitaire|aurore|^figaro$/.test(fold(x.race)))) continue;
    seen.add(k);
    sk.results.push(r);
  }
  sk.results.sort((a, b) => (a.y || 0) - (b.y || 0));
  const seenText = new Set();
  sk.events = sk.mentions.map((m) => ({ ...m, types: classifyEvents(m.b.text, boatNames(m.d)).filter((t) => NOTABLE.includes(t)) }))
    .filter((m) => m.types.length && !seenText.has(`${m.y}|${fold(m.b.text)}`) && seenText.add(`${m.y}|${fold(m.b.text)}`));
  sk.years = [...sk.mentions.map((m) => m.y), ...sk.results.map((r) => r.y)].filter(Boolean);
  sk.wins = sk.results.filter((r) => r.first);
}
const skipperByName = (name) => {
  const p = name.split(' ');
  const k = keyOf(p[0], p.slice(1).join(' '));
  return SKIPPERS.get(k) || MERGED.get(k);
};
// Skippers cités dans chaque fiche bateau, pour rendre leurs noms cliquables.
const docSkippers = new Map();
for (const sk of SKIPPERS.values()) for (const m of sk.mentions) {
  if (!docSkippers.has(m.d)) docSkippers.set(m.d, new Set());
  docSkippers.get(m.d).add(sk);
}
// Rend cliquables, dans le HTML d'une fiche, les noms des skippers qu'elle cite (hors liens existants).
function linkSkippers(html, root, d) {
  const forms = new Map();
  for (const sk of docSkippers.get(d) || []) for (const r of [...sk.raws, sk.name]) forms.set(r.toLowerCase(), sk);
  if (!forms.size) return html;
  const re = new RegExp(`(?<!\\p{L})(${[...forms.keys()].sort((a, b) => b.length - a.length).map(reEsc).join('|')})(?!\\p{L})`, 'giu');
  let depth = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) { if (/^<a\b/i.test(part)) depth++; else if (/^<\/a>/i.test(part)) depth--; return part; }
    return depth > 0 ? part : part.replace(re, (m) => { const sk = forms.get(m.toLowerCase()); return sk ? `<a class="skipper" href="${root}${sk.url}">${m}</a>` : m; });
  }).join('');
}

const subnav = (S, root, current) => {
  // Navigation de la classe : quatre onglets. Les résultats sont reliés depuis « La classe » (courses passées) ; les autres
  // pages de l'auteur sont en bas de « La classe » (« Archives »).
  const items = [[`${S.slug}/`, 'La classe'], [`${S.slug}/bateaux/`, 'Les bateaux'],
    ...(upcomingFor(S).length ? [[`${S.slug}/calendrier/`, 'Calendrier']] : []), [`${S.slug}/architectes/`, 'Architectes']];
  return `<nav class="subnav wrap" aria-label="Rubrique ${esc(S.title)}">${items.map(([href, label]) => `<a href="${root}${href}"${href === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>`;
};

// Relie les noms en gras (convention du site d'origine pour les bateaux) à leur fiche.
const linkBoats = (S, html, root) => html.replace(/<strong>([^<]{2,40})<\/strong>/g, (m, name) => {
  const u = S.boatUrl.get(fold(name.replace(/^["“«\s]+|["”»\s,]+$/g, '')));
  return u ? `<strong><a href="${root}${u}">${name}</a></strong>` : m;
});

// ---------------------------------------------------------------- Séries : page d'accueil de série + liste
const decades = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const letterOf = (n) => { const c = fold(n).replace(/[^a-z0-9]/g, '')[0] || '#'; return /[a-z]/.test(c) ? c.toUpperCase() : '#'; };
const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

// Onglets d'une classe : « La classe » (histoire, courses passées, marins), « Les bateaux » (liste), « Calendrier » (courses
// à venir), « Architectes » (architectes, plans et chantiers).
function seriesHome(S) {
  const rel = `${S.slug}/index.html`;
  const root = prefixFor(rel);
  const relB = `${S.slug}/bateaux/index.html`;
  const rootB = prefixFor(relB);
  const order = (c) => { const i = (S.catOrder || []).indexOf(c); return i < 0 ? 99 : i; };
  const cats = [...new Set(S.entries.map((e) => e.cat).filter(Boolean))].sort((a, b) => order(a) - order(b));
  // Une ligne par bateau (S.boats) : son nom de baptême. Les autres noms portés ne s'affichent pas : ils sont cherchables
  // (attribut data-k de la ligne) et figurent sur la fiche du bateau.
  const nameCell = (b, link) => `<td>${link}${cats.length > 1 ? ` <span class="pill">${esc(b.cat)}</span>` : ''}</td>`;
  // Numéro : de coque (Mini, permanent), sinon celui de la mise à l'eau ; tri sur sa partie numérique.
  const launchNo = (b) => (S.numberFirst ? b.sail : b.doc?.facts?.launchSail || b.sail) || '';
  const numberCol = { key: 'sail', head: S.numberFirst ? S.numberLabel : 'N° à la mise à l’eau', sort: 'num',
    cell: (e) => `<td data-v="${esc((launchNo(e).match(/\d+/) || [''])[0])}"><span class="sail${S.numberFirst ? ' big-num' : ''}">${esc(launchNo(e))}</span></td>`, has: (e) => launchNo(e) };
  buildBase(S);
  const searchKeys = (b) => {
    const f = b.doc?.facts;
    return [...new Set([b.current, ...b.aliases, ...(f?.allNames || []).map((n) => n.name), ...(f?.sails || []), ...b.entries.map((e) => e.sail), b.series, b.designer].filter(Boolean))].join(' ');
  };
  const COLS = [
    numberCol,
    // Nom de baptême : établi par la fiche quand elle est importée ; sinon, c'est un nom relevé dans la liste d'origine.
    { key: 'name', head: 'Nom de baptême', sort: 'txt', cell: nameCell, has: () => true },
    // Architecte, modèle, chantier : les noms retenus par la base, chacun vers sa page (tous les bateaux concernés).
    ...KINDS.map(([kind, field, label]) => ({ key: field, head: label, sort: 'txt', has: (e) => recordOf(S, e)[field],
      cell: (e) => { const v = recordOf(S, e)[field]; return `<td>${v ? `<a href="${rootB}${entityUrl(S, kind, v)}">${esc(v)}</a>` : ''}</td>`; } })),
    { key: 'current', head: 'Nom actuel', sort: 'txt', cell: (e) => `<td>${esc(e.current || '')}</td>`, has: (e) => e.current },
    { key: 'year', head: 'Année', sort: 'num', cell: (e, _l, y) => `<td data-v="${esc(y)}">${esc(e.year || e.yearName)}</td>`, has: (e) => e.year || e.yearName },
    { key: 'note', head: 'Notes', sort: 'txt', cell: (e) => `<td class="note">${esc(e.note)}</td>`, has: (e) => e.note },
  ].filter((c) => S.boats.filter(c.has).length >= Math.max(1, S.boats.length * 0.03))
    // Monotype : architecte, modèle et chantier sont les mêmes pour tous ; la colonne « Notes » ne reprend que des remarques.
    .filter((c) => S.archis !== false || !['architecte', 'modele', 'chantier', 'note'].includes(c.key))
    .filter((c) => c.key !== 'note');
  const rows = S.boats.map((b) => {
    const d = b.doc;
    const unsure = d?.src && d.single ? '' : ' title="Nom relevé dans la liste d’origine ; nom de baptême à confirmer par la fiche"';
    // « ?? » : l'auteur ne connaît pas encore le nom du bateau.
    const label = /^[?\s]+$/.test(b.name) ? '<span class="meta">nom inconnu</span>' : esc(b.name);
    const link = d?.src ? `<a href="${rootB}${d.url}"${unsure}>${label}</a>` : d ? `<a href="${esc(originUrl(d.rel))}" class="ext" target="_blank" rel="noopener" title="Dossier pas encore importé : ouvre l'archive d'origine">${label}</a>` : `<span${unsure}>${label}</span>`;
    const y = String(b.year || b.yearName).replace(/\?/g, '0');
    return `<tr data-letter="${letterOf(b.name)}" data-file="${d ? 1 : 0}" data-year="${esc(y)}" data-cat="${esc(b.cat)}" data-k="${esc(searchKeys(b))}">${COLS.map((c) => c.cell(b, link, y)).join('')}</tr>`;
  }).join('\n');
  const stats = S.entries.length ? `<div class="stats">
    <div><b>${num(S.boats.length)}</b><span>bateaux</span></div>
    <div><b>${num(S.entries.length)}</b><span>noms portés</span></div>
    <div><b>${num(S.docs.size)}</b><span>dossiers historiques</span></div>
    ${S.idBy === 'number' || S.archis === false ? '' : `<div><b>${new Set(S.entries.map((e) => fold(e.series || e.designer)).filter(Boolean)).size}</b><span>plans et séries</span></div>`}
  </div>` : '';
  // 1. Histoire : la course dont la classe est née, l'aperçu (content/apercus.json, d'après Wikipédia, CC BY-SA 4.0),
  // les étapes marquantes.
  const ap = APERCUS[S.slug];
  const apSources = ap ? `<p class="source-note">D'après Wikipédia : ${ap.sources.filter((s) => s.url).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}${s.langue && s.langue !== 'fr' ? ` (${esc(s.langue)})` : ''}</a>`).join(', ')}${ap.sources.some((s) => s.page) ? ` ; corrigé d'après le ${ap.sources.filter((s) => s.page).map((s) => `<a href="${PAGE_MAP.has(s.page) ? root + PAGE_MAP.get(s.page) : esc(originUrl(s.page))}">${esc(s.titre)}</a>`).join(', ')} de ce site` : ''}, et histoiredeshalfs.com. Texte sous licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</p>` : '';
  const histoire = ap?.paragraphes?.length || S.etapes?.length ? `<section class="class-history"><div class="wrap class-grid">
    <div class="prose">
      <h2>Histoire</h2>
      ${S.origine ? `<p class="class-origin"><span class="eyebrow">Née d’une course</span>${esc(S.origine.texte)}${S.origine.href ? ` <a href="${root}${S.origine.href}">${esc(S.origine.lien)} →</a>` : ''}</p>` : ''}
      ${(ap?.paragraphes || []).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${apSources}
    </div>
    ${S.etapes?.length ? `<aside class="class-steps"><h2>Étapes marquantes</h2><ol>${S.etapes.map(([y, t]) => `<li><b>${esc(y)}</b><span>${esc(t)}</span></li>`).join('')}</ol></aside>` : ''}
  </div></section>` : '';
  // 2. Ils ont marqué la classe : vainqueurs des courses phares, disparus en mer.
  const phares = (S.phare || []).map((ph) => phareBlock(S, ph, root)).filter(Boolean);
  const lost = lostAtSea(S, root);
  const marins = phares.length || lost ? `<section class="class-people"><div class="wrap">
    <div class="section-head"><h2>Ils ont marqué la classe</h2><p>Les vainqueurs des courses phares de la classe${lost ? ', et les marins disparus en mer' : ''}.</p></div>
    <div class="people-grid">${phares.join('')}${lost}</div>
  </div></section>` : '';
  // 3. Courses passées : les éditions des pages de résultats, avec un lien vers chaque classement.
  const courses = pastRaces(S, root);
  // 4. Pages d'archives de l'auteur (numéros, sommaires, saisons…) : conservées, mais hors de la navigation principale.
  const extraPages = S.pages.filter((p) => !p.results);
  const archives = `<section class="class-archives"><div class="wrap"><h2>Archives de la série</h2>
    <p>Les pages de travail de histoiredeshalfs.com, telles que l'auteur les a publiées :</p>
    <ul class="archive-links">${extraPages.map((p) => `<li><a href="${root}${S.slug}/${p.slug}/">${esc(p.title)}</a></li>`).join('')}<li><a href="${esc(originUrl(S.sommaire))}" target="_blank" rel="noopener">Sommaire d'origine ↗</a></li></ul>
  </div></section>`;
  const list = S.entries.length ? `<section id="liste"><div class="wrap">
  <div class="section-head"><h2>Les ${num(S.boats.length)} ${esc(S.title)}</h2><p>${esc(S.listIntro || '')} Les noms portés ensuite se cherchent aussi : ils figurent sur la fiche de chaque bateau.</p></div>
  <div class="toolbar">
    <input id="filter" type="search" placeholder="Filtrer par nom, n° de voile, plan, année, course…" aria-label="Filtrer la liste">
    ${cats.length > 1 ? `<select id="cat" aria-label="Catégorie"><option value="">Toutes catégories</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
    <select id="decade" aria-label="Décennie"><option value="">Toutes les années</option>${decades.map((d) => `<option value="${d}">Années ${String(d).slice(2)}</option>`).join('')}</select>
    <select id="sort" aria-label="Trier par"><option value="">Ordre de la liste d’origine</option>${COLS.filter((c) => c.key !== 'note').map((c) => {
      const i = COLS.indexOf(c);
      const [up, down] = c.sort === 'num' ? ['croissante', 'décroissante'] : ['A → Z', 'Z → A'];
      return `<option value="${i}:asc">${c.head} : ${up}</option><option value="${i}:desc">${c.head} : ${down}</option>`;
    }).join('')}</select>
    <label><input id="only-files" type="checkbox"> Avec dossier</label>
    <span class="result-count"></span>
  </div>
  <div class="alpha" role="group" aria-label="Initiale">${letters.map((l) => `<button type="button" data-l="${l}" aria-pressed="false">${l}</button>`).join('')}</div>
  <div class="table-wrap" data-boat-list>
    <table class="boats">
      <thead><tr>${COLS.map((c) => `<th data-sort="${c.sort}" aria-sort="none" title="Trier">${c.head}<span class="arrow" aria-hidden="true"></span></th>`).join('')}</tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
</div></section>` : `<section id="liste"><div class="wrap"><div class="notice">La liste des ${esc(S.title)} est en cours d'import. En attendant : ${S.lists.map((l) => `<a href="${esc(originUrl(l.rel))}" target="_blank" rel="noopener">${esc(l.label || "liste d'origine")} ↗</a>`).join(' · ')}</div></div></section>`;
  // En images : les bateaux de la série qui ont une photo ; la première sert de fond au titre.
  const shots = withPhotos(S, 9);
  const strip = shots.length > 2 ? `<section class="en-images"><div class="wrap"><div class="section-head"><h2>En images</h2><a href="${root}${S.slug}/bateaux/">Tous les bateaux →</a></div>
  <div class="photo-cards">${shots.slice(1).map((d) => photoCard(S, d, root)).join('')}</div></div></section>` : '';
  const body = `${hero(S.eyebrow, S.title, S.lead, stats, false, coverOf(shots[0]))}
${subnav(S, root, `${S.slug}/`)}
${strip}${histoire}${courses}${marins}${archives}`;
  write(rel, layout({ rel, title: S.title, description: `Histoire des ${S.title} : courses, marins et bateaux.`, body, nav: navFor(S) }));
  const bodyB = `${hero(S.title, `Les ${S.title}`, `Tous les bateaux de la classe, par numéro à la mise à l’eau et par nom de baptême.`, stats, true)}
${subnav(S, rootB, `${S.slug}/bateaux/`)}
${list}`;
  write(relB, layout({ rel: relB, title: `Les bateaux — ${S.title}`, description: `Liste des ${S.title}.`, body: bodyB, nav: navFor(S) }));
}

// ---------------------------------------------------------------- Page de classe : les courses passées
// Une carte par page de résultats (Half Ton Cup, Mini Transat, saisons Class 40…) avec une puce par édition qui mène à
// son classement ; puis les courses de la saison déjà courues, vers leur fiche.
function pastRaces(S, root) {
  const cards = [];
  // Courses au palmarès (Wikipédia, palmarès officiels) : vainqueurs de la classe, édition par édition.
  for (const { c, ph } of coursesFor(S)) {
    const rows = courseRows(c, (v, y) => (!ph.classe || ph.classe.test(v.classe) || ph.classe.test(v.brut || '')) && (!ph.de || y >= ph.de) && (!ph.a || y <= ph.a), root);
    if (!rows.length) continue;
    const years = [...new Set(rows.map((r) => r.y))].sort((a, b) => a - b);
    const last = rows[0];
    cards.push(`<div class="people-card race-past"><h3><a href="${root}${c.url}">${esc(c.titre)}</a> <span class="meta">${years.length} édition${years.length > 1 ? 's' : ''}</span></h3>
      <p class="meta">Dernier vainqueur (${last.y}) : ${skipperLinks(last.v.qui, root)}${last.v.bateau ? `, ${podiumBoatLink({ bateau: last.v.bateau, skipper: last.v.qui }, [S.slug, ...seriesOfClass(c, last.v.classe)], last.y, root, c.slug)}` : ''}</p>
      <nav class="years" aria-label="Éditions">${years.map((y) => `<a href="${root}${c.url}${c.podiums?.[String(y)] ? `${y}/` : ''}">${y}</a>`).join('')}</nav>
    </div>`);
  }
  // Coupes dont l'auteur publie les classements édition par édition (Half Ton Cup…).
  for (const p of S.pages.filter((x) => x.results && x.race && !/solitaire|figaro/i.test(x.race))) {
    const src = readSource(p.rel);
    if (!src) continue;
    const eds = parseResults(dropNav(toBlocks(src.body, p.rel), p.title), { loose: !!p.looseEditions }).editions;
    const href = `${root}${S.slug}/${p.slug}/`;
    // Page que l'analyse ne découpe pas en éditions (IMOCA, ORMA…) : un simple lien vers la page.
    const yearsAll = [...new Map(eds.map((ed, i) => [ed.year, `#y${ed.year}-${i}`])).entries()].sort((a, b) => a[0] - b[0]);
    const years = yearsAll.length >= 3 ? yearsAll : [];
    cards.push(`<div class="people-card race-past"><h3><a href="${href}">${esc(p.race || p.title)}</a>${years.length ? ` <span class="meta">${years.length} éditions, ${years[0][0]} – ${years.at(-1)[0]}</span>` : ''}</h3>
      ${p.lead ? `<p class="meta">${esc(p.lead)}</p>` : ''}
      ${years.length > 1 ? `<nav class="years" aria-label="Éditions">${years.map(([y, a]) => `<a href="${href}${a}">${y}</a>`).join('')}</nav>` : `<p><a href="${href}">Voir les résultats →</a></p>`}
    </div>`);
  }
  const done = racesFor(S).filter((r) => r.statut === 'terminée');
  if (done.length) cards.push(`<div class="people-card"><h3>Cette saison <span class="meta">${done.length} course${done.length > 1 ? 's' : ''} courue${done.length > 1 ? 's' : ''}</span></h3><ul class="ag-list one">${done.slice().reverse().map((r) => agendaItem(r, root).replace('<span class="ag-date">', `<span class="ag-date"><b>${MONTHS_SHORT[Number(r.debut.slice(5, 7)) - 1]}</b> `)).join('')}</ul></div>`);
  return cards.length ? `<section class="class-races"><div class="wrap"><div class="section-head"><h2>Les courses</h2><p>Course par course : les éditions passées et leur palmarès${done.length ? ', et les courses déjà courues cette saison' : ''}. <a href="${root}courses/">Toutes les courses →</a></p></div>
    <div class="people-grid">${cards.join('')}</div></div></section>` : '';
}

// ---------------------------------------------------------------- Courses : une page par course, une par édition
// Les palmarès viennent de Wikipédia (content/courses-histoire.json, content/palmares.json), du palmarès sourcé de la
// Solitaire (content/solitaire.json) ; les podiums par édition, de content/resultats.json (articles Wikipédia des
// éditions, sites officiels). Skippers et bateaux mènent à leurs fiches.
const PALMARES = readJson(path.resolve('content/palmares.json'));
const RESULTATS = readJson(path.resolve('content/resultats.json'));
// Même course, autres noms : la Transat Jacques Vabre est devenue Transat Café L'Or.
const COURSE_ALIASES = { "Transat Café L'Or": 'Transat Jacques-Vabre', 'La Solitaire du Figaro Paprec': 'Solitaire du Figaro', 'Mini Transat Legallais': 'Mini Transat', 'Rolex Fastnet Race': 'Fastnet Race' };
let COURSES = null;
function courses() {
  if (COURSES) return COURSES;
  COURSES = new Map();
  const get = (titre) => {
    const t = COURSE_ALIASES[titre] || titre;
    const slug = slugify(t);
    if (!COURSES.has(slug)) COURSES.set(slug, { titre: t, slug, url: `courses/${slug}/`, resume: '', creation: null, sources: [], editions: new Map(), keys: [] });
    return COURSES.get(slug);
  };
  // Même classe sous deux noms dans les palmarès : Multi50 devenue Ocean Fifty en 2021, « Class40 » écrit « Class 40 ».
  const CLASS_NAMES = { multi50: 'Ocean Fifty (Multi50)', 'ocean fifty': 'Ocean Fifty (Multi50)', class40: 'Class 40', 'class 40': 'Class 40', mod70: 'MOD 70' };
  const add = (c, year, v) => {
    v.brut = v.classe;
    v.classe = CLASS_NAMES[normKey(v.classe).replace(/(\D) (\d)/, '$1$2')] || CLASS_NAMES[normKey(v.classe)] || v.classe;
    // Fastnet : le classement IRC d'aujourd'hui continue le classement général en temps compensé (Fastnet Challenge Cup).
    if (/fastnet challenge cup/i.test(v.classe)) v.classe = 'Fastnet Challenge Cup (temps compensé)';
    const y = Number(year);
    if (!c.editions.has(y)) c.editions.set(y, []);
    const list = c.editions.get(y);
    if (!list.some((x) => x.classe === v.classe && fold(x.qui) === fold(v.qui))) list.push(v);
  };
  for (const [key, h] of Object.entries(HISTOIRE)) {
    const c = get(COURSE_ALIASES[key] || h.titre || shortRace(key));
    c.keys.push(key);
    if (!c.resume && h.resume) { c.resume = h.resume; c.creation = h.creation || null; }
    for (const s of h.sources || []) if (!c.sources.some((x) => x.url === s.url)) c.sources.push(s);
    for (const e of h.editions || []) for (const v of e.vainqueurs || []) add(c, e.annee, { classe: v.classe || 'Classement général', qui: v.skipper || v.equipe || '', bateau: v.bateau || '' });
  }
  for (const p of Object.values(PALMARES)) {
    if (!p?.editions) continue;
    const c = get(p.titre);
    for (const s of p.sources || []) if (!c.sources.some((x) => x.url === s.url)) c.sources.push(s);
    for (const e of p.editions) for (const v of e.vainqueurs) add(c, e.annee, { classe: v.classe || 'Classement général', qui: v.skipper, bateau: v.bateau || '', numero: v.numero });
  }
  const sol = get('Solitaire du Figaro');
  for (const [y, v] of Object.entries(SOLITAIRE.vainqueurs || {})) add(sol, y, { classe: Number(y) < 1980 ? 'Course de l’Aurore' : 'Classement général', qui: v.skipper, bateau: v.bateau || '' });
  for (const s of Object.values(SOLITAIRE.sources || {})) if (!sol.sources.some((x) => x.url === s.url)) sol.sources.push(s);
  // Podiums détaillés : la course doit déjà exister (même titre ou alias).
  for (const [titre, r] of Object.entries(RESULTATS)) {
    if (!r?.editions) continue;
    const c = get(titre);
    c.podiums = r.editions;
    for (const s of r.sources_generales || []) if (!c.sources.some((x) => x.url === s.url)) c.sources.push(s);
  }
  return COURSES;
}
// Courses où une classe a couru : celles de ses courses phares, et celles dont le palmarès nomme sa classe.
function coursesFor(S) {
  const out = new Map();
  for (const ph of S.phare || []) {
    const t = ph.histoire ? (COURSE_ALIASES[ph.histoire] || HISTOIRE[ph.histoire]?.titre || shortRace(ph.histoire)) : ph.palmares ? PALMARES[ph.palmares]?.titre : ph.solitaire ? 'Solitaire du Figaro' : null;
    const c = t && courses().get(slugify(COURSE_ALIASES[t] || t));
    if (c) out.set(c.slug, { c, ph });
  }
  if (S.classeRe) for (const c of courses().values()) if (![...c.editions.values()].flat().some((v) => S.classeRe.test(v.classe) || S.classeRe.test(v.brut || ''))) continue; else if (!out.has(c.slug)) out.set(c.slug, { c, ph: { classe: S.classeRe } });
  return [...out.values()];
}
// Classes des podiums écrites comme sur le reste du site ; Multi50 garde son nom d'époque (Ocean Fifty depuis 2021).
const PODIUM_CLASS = { Class40: 'Class 40', MOD70: 'MOD 70' };
const courseRows = (c, filter, root) => [...c.editions].sort((a, b) => b[0] - a[0]).flatMap(([y, vs]) => vs.filter((v) => !filter || filter(v, y)).map((v) => ({ y, v })));
function coursePages() {
  for (const c of courses().values()) {
    const rel = `${c.url}index.html`;
    const root = prefixFor(rel);
    const classes = [...new Set([...c.editions.values()].flat().map((v) => v.classe))];
    const byClass = classes.map((k) => ({ k, rows: courseRows(c, (v) => v.classe === k, root) })).filter((g) => g.rows.length);
    const editionLink = (y) => (c.podiums?.[String(y)] ? `<a href="${root}${c.url}${y}/">podium</a>` : '');
    const upcoming = RACES.filter((r) => c.keys.includes(r.course));
    const years = [...c.editions.keys()].sort((a, b) => a - b);
    const tables = byClass.map((g) => `<div class="people-card" id="${slugify(g.k)}"><h3>${esc(g.k)}</h3><div class="people-scroll"><table class="boats compact"><thead><tr><th>Édition</th><th>Vainqueur</th><th>Bateau</th><th></th></tr></thead><tbody>
      ${g.rows.map(({ y, v }) => `<tr><td>${y}</td><td>${skipperLinks(v.qui, root)}</td><td>${podiumBoatLink({ bateau: v.bateau, skipper: v.qui, numero: v.numero }, seriesOfClass(c, v.classe), y, root, c.slug)}</td><td>${editionLink(y)}</td></tr>`).join('')}</tbody></table></div></div>`).join('');
    const body = `${hero('Course', c.titre, c.resume || '', `<div class="stats"><div><b>${years.length}</b><span>éditions au palmarès</span></div>${c.creation ? `<div><b>${c.creation}</b><span>création</span></div>` : ''}${years.length ? `<div><b>${years.at(-1)}</b><span>dernière édition connue</span></div>` : ''}</div>`, true)}
<div class="wrap"><nav class="crumbs"><a href="${root}">Accueil</a> › <a href="${root}courses/">Courses</a> › ${esc(c.titre)}</nav>
${upcoming.length ? `<p class="race-note">Au calendrier : ${upcoming.map((r) => `<a href="${root}${r.page}">${esc(shortRace(r.course))} ${r.debut ? r.debut.slice(0, 4) : ''}</a> <span class="meta">(${esc(r.statut)})</span>`).join(' · ')}</p>` : ''}
${c.slug === 'solitaire-du-figaro' ? `<p class="race-note"><a href="${root}figaro/la-solitaire/">La Solitaire de 1970 à aujourd’hui : époques, bateaux et skippers →</a></p>` : ''}
</div>
<section><div class="wrap"><div class="section-head"><h2>Palmarès</h2><p>Vainqueurs par édition${byClass.length > 1 ? ', classe par classe' : ''}${c.podiums ? ' ; podiums détaillés quand ils sont connus' : ''}.</p></div>
<div class="people-grid palmares-grid">${tables}</div>
<p class="source-note">Sources : ${c.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(', ')}.</p></div></section>`;
    write(rel, layout({ rel, title: c.titre, description: `${c.titre} : palmarès édition par édition.`, body, nav: 'calendrier/' }));
    // Page d'une édition : le podium de chaque classe. Temps du vainqueur, écart des suivants (Solitaire), ou points
    // (The Ocean Race) ; équipage et numéro de voile sous le nom, remarque de la source sous le temps.
    for (const [y, ed] of Object.entries(c.podiums || {})) {
      const relE = `${c.url}${y}/index.html`;
      const rootE = prefixFor(relE);
      const blocks = Object.entries(ed.classes || {}).map(([k, rows]) => {
        const points = rows.some((r) => r.points != null);
        const score = (r) => (points ? esc(String(r.points ?? '')) : esc(r.temps || r.ecart || ''));
        return `<div class="people-card"><h3>${esc(PODIUM_CLASS[k] || k)}</h3><table class="boats compact"><thead><tr><th>Rang</th><th>Skipper</th><th>Bateau</th><th>${points ? 'Points' : rows.some((r) => r.ecart) ? 'Temps / écart' : 'Temps'}</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.rang <= 3 ? `podium p${r.rang}` : ''}"><td>${r.rang}</td><td>${skipperLinks(r.skipper, rootE)}${r.equipage ? `<br><span class="meta">avec ${esc(r.equipage)}</span>` : ''}</td><td>${podiumBoatLink(r, seriesOfClass(c, k), Number(y), rootE, c.slug)}${r.numero ? ` <span class="meta">n° ${esc(r.numero)}</span>` : ''}</td><td>${score(r)}${r.note ? `<br><span class="meta">${esc(r.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      }).join('');
      const others = Object.keys(c.podiums).sort();
      const srcs = [ed.source, ...(ed.sources_complementaires || [])].filter(Boolean);
      const bodyE = `${hero(c.titre, `${c.titre} ${y}`, '', '', true)}
<div class="wrap"><nav class="crumbs"><a href="${rootE}">Accueil</a> › <a href="${rootE}courses/">Courses</a> › <a href="${rootE}${c.url}">${esc(c.titre)}</a> › ${y}</nav>
<nav class="years" aria-label="Éditions">${others.map((o) => `<a href="${rootE}${c.url}${o}/"${o === y ? ' aria-current="page"' : ''}>${o}</a>`).join('')}</nav>
${ed.note ? `<p class="race-note">${esc(ed.note)}</p>` : ''}</div>
<section><div class="wrap"><div class="people-grid podium-grid">${blocks}</div>
${srcs.length ? `<p class="source-note">Source${srcs.length > 1 ? 's' : ''} : ${srcs.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(', ')}.</p>` : ''}</div></section>`;
      write(relE, layout({ rel: relE, title: `${c.titre} ${y}`, description: `${c.titre} ${y} : classements.`, body: bodyE, nav: 'calendrier/' }));
    }
  }
  // Index des courses.
  const rel = 'courses/index.html';
  const root = prefixFor(rel);
  const list = [...courses().values()].filter((c) => c.editions.size).sort((a, b) => fold(a.titre).localeCompare(fold(b.titre)));
  const body = `${hero('Courses', 'Les courses', 'Les grandes courses au large et leur palmarès, édition par édition.', '', true)}
<section><div class="wrap"><div class="grid">${list.map((c) => { const ys = [...c.editions.keys()]; return `<a class="card" href="${root}${c.url}"><b>${esc(c.titre)}</b><span class="meta">${ys.length} éditions au palmarès · ${Math.min(...ys)} – ${Math.max(...ys)}</span></a>`; }).join('')}</div></div></section>`;
  write(rel, layout({ rel, title: 'Les courses', body, nav: 'calendrier/' }));
}
// Contrôle (AUDIT_PODIUM=1) : vainqueur du podium différent de celui du palmarès, noms sans fiche.
function auditPodiums() {
  const cls = (k) => { const f = fold(k).replace(/[^a-z0-9]/g, ''); return /multi50|oceanfifty/.test(f) ? 'of' : f; };
  const last = (n) => fold(String(n).split(/\s+et\s+|,/)[0]).split(/\s+/).slice(1).join(' ');
  const out = [];
  for (const c of courses().values()) for (const [y, ed] of Object.entries(c.podiums || {})) {
    const pal = c.editions.get(Number(y)) || [];
    for (const [k, rows] of Object.entries(ed.classes || {})) {
      const w = rows.find((r) => r.rang === 1);
      const p = pal.find((v) => cls(v.classe) === cls(k) || (pal.length === 1 && /general/.test(cls(k))));
      if (w && p && last(w.skipper) && !fold(p.qui).includes(last(w.skipper))) out.push(`VAINQUEUR\t${c.titre} ${y} ${k}\tpodium: ${w.skipper}\tpalmarès: ${p.qui}`);
      // Classe nommée autrement au palmarès (ORMA / Multicoques 60 pieds, VO65 / général) : même vainqueur ailleurs.
      if (w && !p && pal.length && !pal.some((v) => last(w.skipper) && fold(v.qui).includes(last(w.skipper)))) out.push(`ABSENT\t${c.titre} ${y} ${k}\t${w.skipper}\tpalmarès: ${pal.map((v) => v.classe).join(', ')}`);
      for (const r of rows) {
        for (const n of String(r.skipper).split(/\s+et\s+|,\s*/)) { const t = n.trim().split(/\s+/); if (t.length > 1 && !findSkipper({ first: t[0], last: t.slice(1).join(' ') })?.url) out.push(`SKIPPER\t${n.trim()}\t${c.titre} ${y}`); }
        const link = podiumBoatLink(r, seriesOfClass(c, k), Number(y), '', c.slug);
        // Bateau sans lien : candidats par le nom, et fiches où le skipper est à bord cette année-là ou la suivante.
        const onBoard = String(r.skipper).split(/\s+et\s+|,\s*/).flatMap((p) => { const w = p.trim().split(/\s+/); const sk = findSkipper({ first: w[0], last: w.slice(1).join(' ') }); return (sk?.mentions || []).filter((m) => m.y >= Number(y) && m.y <= Number(y) + 1 && ['skipper', 'co'].includes(roleOf(sk, m))).map((m) => `${m.d.url}${m.y}`); });
        if (r.bateau && !link.startsWith('<a')) out.push(`BATEAU\t${r.bateau}\t${c.titre} ${y} ${k}\t${(BOAT_NAMES.get(nameKey(r.bateau)) || []).map((x) => x.d.url).join(' ')}\t${r.skipper} @ ${[...new Set(onBoard)].join(' ')}`);
        else if (r.bateau) out.push(`LIEN\t${r.bateau}\t${c.titre} ${y} ${k}\t${link.match(/href="([^"]*)"/)[1]}`);
      }
    }
  }
  // AUDIT_SK="Alex Thomson:2012" : mentions d'un skipper cette année-là (fiche, rôle, texte).
  if (process.env.AUDIT_SK) {
    const [n, y] = process.env.AUDIT_SK.split(':');
    const w = n.split(' ');
    const sk = findSkipper({ first: w[0], last: w.slice(1).join(' ') });
    for (const m of sk?.mentions || []) if (Math.abs(m.y - Number(y)) <= 1) console.log(m.y, m.d.url, roleOf(sk, m), '|', m.b.text.replace(/\s+/g, ' ').slice(0, 160));
  }
  for (const u of (process.env.AUDIT_PODIUM.split(',').filter((x) => x.includes('/')))) {
    const d = series.flatMap((S) => S.built).find((x) => x.url === u);
    if (d?.facts) console.log(u, '|', d.facts.original, '|', d.names.join('/'), '|', d.facts.built, '|', d.facts.renames.map((r) => `${r.y}/${r.ry} ${r.name}`).join(' ; '));
  }
  fs.writeFileSync('_audit/podiums.tsv', out.join('\n'));
  console.log(`audit podiums : ${out.filter((l) => /^VAINQUEUR|^ABSENT/.test(l)).length} écarts, ${out.filter((l) => l.startsWith('SKIPPER')).length} skippers et ${out.filter((l) => l.startsWith('BATEAU')).length} bateaux sans fiche`);
}
// Bateau d'un podium : la fiche du bateau qui portait ce nom (ou ce numéro de voile, pour les Minis) cette année-là,
// dans la classe de la course ; un nom porté par plusieurs bateaux sans indice de l'année reste sans lien.
const classKey = (k) => { const f = fold(k).replace(/[^a-z0-9]/g, ''); return /multi50|oceanfifty/.test(f) ? 'of' : f; };
// Les MOD 70 ont couru en classe Ultim (Route du Rhum 2014).
const CLASS_SERIES_OF = { imoca: ['imoca'], ultim: ['ultim', 'maxis-g-class', 'mod-70'], orma: ['orma-60'], multicoques60pieds: ['orma-60'], of: ['ocean-fifty'], class40: ['class-40'], monocoques40pieds: ['class-40'], mod70: ['mod-70'], proto: ['minis'], serie: ['minis'] };
const COURSE_SERIES_OF = { 'vendee-globe': ['imoca'], 'solitaire-du-figaro': ['figaro'], 'mini-transat': ['minis'] };
const seriesOfClass = (c, k) => CLASS_SERIES_OF[classKey(k)] || COURSE_SERIES_OF[c.slug] || [];
// « Charal (2) » : l'auteur numérote entre parenthèses deux bateaux du même nom ; la course écrit « Charal » ou « Charal 2 ».
const nameKey = (s) => fold(String(s || '').replace(/\s*\(\d\)\s*$/, '')).replace(/^maxi (solo )?/, '').replace(/[^a-z0-9]/g, '');
const sameName = (a, b) => a === b || (a.length > 3 && b.length > 3 && (/^\d\d?$/.test(b.slice(a.length)) && b.startsWith(a) || /^\d\d?$/.test(a.slice(b.length)) && a.startsWith(b)));
// Noms portés une année donnée, du plus sûr au moins sûr : le nom en fin d'année, puis les noms reçus dans l'année
// (les grandes courses ont lieu en fin de saison). Aucun avant la construction.
const namesIn = (f, y) => {
  const built = Number(String(f.built || '').slice(0, 4));
  if (built && y < built) return [[], []];
  return [[nameKey(f.nameAt(y))], f.renames.filter((r) => r.y === y).map((r) => nameKey(r.name))];
};
// La course telle que l'auteur l'écrit dans les chronologies (texte sans accents ni majuscules).
const RACE_WORDS = { 'vendee-globe': /vendee globe/, 'route-du-rhum': /route du rhum/, 'transat-jacques-vabre': /jacques vabre|j\. ?vabre|\btjv\b|cafe l.or/, 'mini-transat': /mini.?transat|transat 6[.,]?50/, 'solitaire-du-figaro': /solitaire (du |urgo|le figaro)|la solitaire/, 'fastnet-race': /fastnet/, 'the-ocean-race': /ocean race|volvo/ };
let BOAT_NAMES = null;
function podiumBoatLink(r, slugs, year, root, course) {
  if (!r.bateau) return '';
  if (!BOAT_NAMES) {
    BOAT_NAMES = new Map();
    for (const S of series) for (const d of S.built) {
      if (!d.single || !d.src || !d.facts) continue;
      for (const n of [...d.facts.allNames.map((x) => x.name), ...d.names, d.facts.title]) {
        const k = nameKey(n);
        if (!k) continue;
        if (!BOAT_NAMES.has(k)) BOAT_NAMES.set(k, []);
        if (!BOAT_NAMES.get(k).some((x) => x.d === d)) BOAT_NAMES.get(k).push({ S, d });
      }
    }
  }
  const key = nameKey(r.bateau);
  const cands = [...new Set([key, key.replace(/\d$/, ''), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key + n)])].flatMap((k) => BOAT_NAMES.get(k) || []).filter((x, i, a) => a.findIndex((y) => y.d === x.d) === i);
  const inSeries = cands.filter((x) => slugs.includes(x.S.slug));
  let pick = null;
  const num = String(r.numero || '').replace(/\D/g, '');
  if (num) {
    const bySail = series.filter((S) => slugs.includes(S.slug)).flatMap((S) => S.built.filter((d) => d.single && d.src && d.facts?.sails.some((s) => s.replace(/\D/g, '') === num)).map((d) => ({ S, d })));
    const both = bySail.filter((x) => inSeries.some((y) => y.d === x.d));
    pick = both.length === 1 ? both[0] : bySail.length === 1 ? bySail[0] : null;
  }
  // Sinon, nom par nom du plus sûr au moins sûr : le bateau de la classe sur lequel la fiche met ce skipper à bord cette
  // année-là, ou le seul bateau de la classe qui portait ce nom ; deux bateaux possibles, pas de lien.
  if (!pick) {
    const aboard = new Set();
    for (const p of String(r.skipper || '').split(/\s+et\s+|,\s*/)) {
      const w = p.trim().split(/\s+/);
      const sk = w.length > 1 ? findSkipper({ first: w[0], last: w.slice(1).join(' ') }) : null;
      for (const m of sk?.mentions || []) if (m.y === year && ['skipper', 'co'].includes(roleOf(sk, m))) aboard.add(m.d);
    }
    const pool = slugs.length ? inSeries : cands;
    const everNamed = (d) => [...d.facts.allNames.map((x) => x.name), ...d.names].some((n) => sameName(nameKey(n), key));
    const withSkipper = pool.filter((x) => aboard.has(x.d) && everNamed(x.d));
    const named = [0, 1].map((tier) => pool.filter((x) => namesIn(x.d.facts, year)[tier].some((n) => sameName(n, key))));
    const words0 = RACE_WORDS[course];
    // La course est le sujet de la ligne (nommée avant les deux-points), pas une course citée en passant (« qualifié pour… »).
    const words = words0 && { test: (t) => words0.test(t.split(':')[0]) };
    // 0. La chronologie d'un bateau de la classe donne, cette année-là, le même classement final sur cette course
    // (« Solitaire du Figaro: … = 1er/34 », « Vendée Globe: 2e/13 … ») ; plusieurs bateaux : celui qui a porté ce nom.
    if (words && slugs.length && r.rang) {
      const years = /vendee|ocean-race/.test(course) ? [year, year + 1] : [year];
      const rankOf = (t) => { const ms = [...t.matchAll(/(?:=|:)\s*(1er|\d+)e?\s*\/\s*\d+/g)]; const m = t.includes('=') ? ms.filter((x) => t.lastIndexOf('=') <= x.index).at(-1) : ms[0]; return m ? (m[1] === '1er' ? 1 : Number(m[1])) : null; };
      const same = series.filter((S) => slugs.includes(S.slug)).flatMap((S) => S.built).filter((d) => d.single && d.facts && d.facts.dos.entries.some((e) => years.includes(Number(String(e.year || '').slice(0, 4))) && e.blocks.some((b) => b.type === 'p' && words.test(fold(b.text)) && rankOf(fold(b.text)) === r.rang)));
      const loose = (d) => [...d.facts.allNames.map((x) => x.name), ...d.names].some((n) => { const a = nameKey(n), b = key; return sameName(a, b) || (a.length >= 6 && (b.startsWith(a) || a.startsWith(b))); });
      const ds = same.length > 1 ? same.filter(loose) : same;
      if (ds.length === 1 && (same.length > 1 || loose(ds[0]) || !inSeries.length)) pick = { d: ds[0] };
    }
    // 0 bis. La chronologie d'un bateau de la classe donne ce skipper sur cette course cette année-là (ligne de résultat).
    if (!pick && words && slugs.length) {
      const raced = new Set();
      for (const p of String(r.skipper || '').split(/\s+et\s+|,\s*/)) {
        const w = p.trim().split(/\s+/);
        const sk = w.length > 1 ? findSkipper({ first: w[0], last: w.slice(1).join(' ') }) : null;
        for (const m of sk?.mentions || []) if ((m.y === year || (m.y === year + 1 && /vendee|ocean-race/.test(course))) && slugs.includes(m.S.slug) && m.d.single && m.d.facts && ['skipper', 'co'].includes(roleOf(sk, m)) && words.test(fold(m.b.text))) raced.add(m.d);
      }
      let ds = [...raced];
      if (ds.length > 1) ds = ds.filter(everNamed);
      if (ds.length === 1) pick = { d: ds[0] };
    }
    // 1. Le skipper à bord cette année-là, d'après les fiches, du bateau qui portait ce nom.
    if (!pick) for (const list of named) {
      const sure = list.filter((x) => aboard.has(x.d));
      if (sure.length === 1) { pick = sure[0]; break; }
    }
    // 2. Sinon, le seul bateau de la classe qui portait ce nom, si le skipper n'est pas cité sur un autre bateau de ce nom.
    if (!pick) {
      const list = named.find((l) => l.length);
      if (list?.length === 1 && !withSkipper.some((x) => x.d !== list[0].d)) pick = list[0];
      // 3. Nom écrit autrement dans la chronologie (« Paprec - Arkéa 24 ») : le bateau qui l'a porté et où le skipper était.
      else if (!list && withSkipper.length === 1) pick = withSkipper[0];
    }
    // Bateaux de la classe sur lesquels la fiche met le skipper à bord cette année-là, quel que soit leur nom.
    const onBoard = slugs.length ? [...aboard].filter((d) => d.single && d.facts && slugs.includes(series.find((S) => S.built.includes(d))?.slug)) : [];
    const exists = (d) => { const b = Number(String(d.facts?.built || '').slice(0, 4)); return !b || b <= year; };
    if (!pick && !named.some((l) => l.length)) {
      // 4. Le skipper n'était cette année-là que sur un bateau de la classe, et aucun autre bateau de la classe n'a porté ce nom.
      if (onBoard.length === 1 && inSeries.every((x) => x.d === onBoard[0])) pick = { d: onBoard[0] };
      // 5. Un seul bateau de la classe a porté ce nom, il existait déjà, et le skipper n'est pas cité sur un autre bateau.
      else if (inSeries.length === 1 && exists(inSeries[0].d) && !onBoard.some((d) => d !== inSeries[0].d)) pick = inSeries[0];
    }
    // 6. L'index des listes de l'auteur renvoie ce nom, dans la classe, à une seule fiche (fiches à plusieurs noms comprises).
    if (!pick && slugs.length && !inSeries.length && !onBoard.length) {
      const urls = new Set(series.filter((S) => slugs.includes(S.slug)).flatMap((S) => S.entries.filter((e) => e.href && nameKey(e.name) === key).map((e) => S.docs.get(e.href)).filter((d) => d?.src).map((d) => d.url)));
      if (urls.size === 1) return `<a href="${root}${[...urls][0]}">${esc(r.bateau)}</a>`;
    }
  }
  return pick ? `<a href="${root}${pick.d.url}">${esc(r.bateau)}</a>` : esc(r.bateau);
}
// Bateau nommé dans un palmarès : sa fiche dans n'importe quelle classe, sinon le nom seul.
const boatLinkAny = (name, root) => {
  const u = series.map((x) => x.boatUrl.get(fold(name))).find((x) => x && !x.includes('?q='));
  return u ? `<a href="${root}${u}">${esc(name)}</a>` : esc(name);
};

// ---------------------------------------------------------------- Page de classe : ceux qui l'ont marquée
// Lien vers la fiche d'un skipper (« A et B » : chacun) ou d'un bateau, quand le site les connaît.
const skipperLinks = (names, root) => String(names || '').split(/(\s+et\s+|\s*&\s*|,\s*)/).map((p, i) => {
  if (i % 2) return p.includes(',') ? ', ' : ' et ';
  if (!p.trim()) return '';
  const w = p.trim().split(/\s+/);
  const sk = w.length > 1 ? findSkipper({ first: w[0], last: w.slice(1).join(' ') }) : null;
  return sk?.url ? `<a href="${root}${sk.url}">${esc(p.trim())}</a>` : esc(p.trim());
}).join('');
const boatLinkByName = (S, name, root) => {
  if (!name) return '';
  const u = S.boatUrl.get(fold(name)) || series.map((x) => x.boatUrl.get(fold(name))).find(Boolean);
  return u ? `<a href="${root}${u}">${esc(name)}</a>` : esc(name);
};
// Vainqueurs d'une course phare de la classe, de la plus récente édition à la plus ancienne.
function phareBlock(S, ph, root) {
  const rows = [];
  let source = '';
  if (ph.histoire && HISTOIRE[ph.histoire]) {
    const h = HISTOIRE[ph.histoire];
    // Palmarès complet de la course (Wikipédia, palmarès sourcés), pas seulement les dernières éditions de l'article.
    const c = courses().get(slugify(COURSE_ALIASES[ph.histoire] || h.titre || shortRace(ph.histoire)));
    const editions = c ? [...c.editions].sort((a, b) => b[0] - a[0]).map(([annee, vs]) => ({ annee, vainqueurs: vs.map((v) => ({ classe: v.classe, skipper: v.qui, bateau: v.bateau, numero: v.numero })) })) : h.editions || [];
    for (const e of editions) {
      const vs = (e.vainqueurs || []).filter((v) => ph.classe.test(v.classe || ''));
      // Plusieurs vainqueurs la même année (Mini Transat : Proto et Série) : la catégorie est précisée.
      for (const v of vs) rows.push({ y: e.annee, who: skipperLinks(v.skipper || v.equipe, root) + (vs.length > 1 ? ` <span class="meta">${esc(v.classe)}</span>` : ''), boat: c && v.bateau ? podiumBoatLink({ bateau: v.bateau, skipper: v.skipper, numero: v.numero }, [S.slug], Number(e.annee), root, c.slug) : boatLinkByName(S, v.bateau, root) });
    }
    source = `D'après ${((c || h).sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(', ')}.`;
    const race = RACES.find((r) => r.course === ph.histoire);
    if (race) source += ` <a href="${root}${race.page}">La course →</a>`;
  }
  if (ph.palmares && PALMARES[ph.palmares]) {
    const p = PALMARES[ph.palmares];
    for (const e of p.editions) for (const v of e.vainqueurs) rows.push({ y: e.annee, who: skipperLinks(v.skipper, root), boat: boatLinkByName(S, v.bateau, root) });
    source = `D'après ${p.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(', ')}.`;
  }
  if (ph.solitaire) {
    for (const [y, v] of Object.entries(SOLITAIRE.vainqueurs || {})) {
      // Bateau : celui du palmarès, sinon celui du skipper dans l'archive cette année-là.
      const r = v.sk?.results?.find((x) => x.y === Number(y) && x.first && isSolitaire(x) && (x.d || x.boatName));
      rows.push({ y: Number(y), who: v.sk?.url ? `<a href="${root}${v.sk.url}">${esc(v.skipper)}</a>` : esc(v.skipper), boat: v.bateau ? esc(v.bateau) : r ? (r.d ? boatLink(root, r.d, r.y) : esc(r.boatName)) : '' });
    }
    source = `Palmarès officiel (<a href="${root}figaro/la-solitaire/">La Solitaire, de 1970 à aujourd’hui</a>).`;
  }
  if (ph.page) {
    const p = S.pages.find((x) => x.rel === ph.page);
    const src = p && readSource(p.rel);
    if (src) parseResults(dropNav(toBlocks(src.body, p.rel), p.title), { loose: !!p.looseEditions }).editions.forEach((ed, i) => {
      // Vainqueur : celui que l'auteur écrit dans l'en-tête de l'édition (« Bayona, Espagne: ATALANTI II, Gréce »), sinon
      // le nom en tête de la 1re ligne du classement, coupé avant le numéro de voile.
      const plain = (h) => decodeEntities(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      // Nom seul : sans rang en tête (« 1 Jonathan VI »), ni nationalité ou numéro de voile à la suite (« Ave ESP Gonzalez »).
      const COUNTRY = /\s(?:FRA|ESP|ITA|GER|GBR|SWE|NOR|FIN|DEN|NED|BEL|IRL|GRE|USA|AUS|NZL|JPN|CAN|SUI|AUT|POR|POL|RSA|SA|Danemark|France|Italie|Espagne|Allemagne|Su[eè]de|Norv[eè]ge|Finlande|Belgique|Pays[- ]Bas|Irlande|Gr[eè]ce|UK)\b.*$/i;
      const clean = (s) => (s || '').replace(/^\d+\s+/, '').replace(/\s+[A-Z]{1,3}\s?\d{2,6}\b.*$/, '').replace(COUNTRY, '').trim();
      // « 3 neufs: 1 Fauroux, 1 Vrolick » : un décompte de l'en-tête, pas le vainqueur.
      const titleWinner = (plain(ed.titleHtml).match(/:\s*([^,:.]{2,40}?)\s*[,.]/) || [])[1];
      const fromTitle = titleWinner && !/^\d/.test(titleWinner) ? clean(titleWinner) : '';
      const r1 = ed.results.find((r) => r.rank === '1');
      const fromRow = r1 && clean(plain(r1.html).split(',')[0]);
      const boat = (fromTitle && /[A-Za-zÀ-ÿ]{3}/.test(fromTitle) && !/bateaux|reportage|inscrits|partants/i.test(fromTitle) ? prettyCase(fromTitle) : fromRow) || '';
      if (boat && /[A-Za-zÀ-ÿ]{3}/.test(boat) && !/^\?+$/.test(boat) && !rows.some((x) => x.y === Number(ed.year))) rows.push({ y: Number(ed.year), who: '', boat: `${boatLinkByName(S, boat, root)} <a class="meta" href="${root}${S.slug}/${p.slug}/#y${ed.year}-${i}">classement</a>` });
    });
    source = `D'après la page « ${esc(p?.title || ph.titre)} » de histoiredeshalfs.com.`;
  }
  const shown = rows.filter((r) => (!ph.de || r.y >= ph.de) && (!ph.a || r.y <= ph.a)).sort((a, b) => b.y - a.y);
  if (!shown.length) return '';
  const withWho = shown.some((r) => r.who);
  return `<div class="people-card"><h3>${esc(ph.titre)}${ph.href ? ` <a class="meta" href="${root}${ph.href}">tout le palmarès →</a>` : ''}</h3>
    <div class="people-scroll"><table class="boats compact"><thead><tr><th>Année</th>${withWho ? '<th>Vainqueur</th>' : ''}<th>Bateau</th></tr></thead><tbody>
    ${shown.map((r) => `<tr><td>${r.y}</td>${withWho ? `<td>${r.who}</td>` : ''}<td>${r.boat}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="source-note">${source}</p></div>`;
}
const PERSON_LOST = /(?:skipper|[ée]quipier|marin|navigat\w*|homme)s?\s+(?:est\s+|a\s+)?(?:port[ée]e?\s+)?disparue?s?|port[ée]e?s?\s+disparue?s?|disparue?s?\s+en\s+mer|\bdisparai[st]|lost at sea|missing at sea|bateau(?:,\s*puis)?\s+et\s+skipper\s+disparus|disparu corps et biens/i;
// Disparus en mer : les lignes « disparu en mer » des fiches de la classe, avec le marin concerné et son bateau.
function lostAtSea(S, root) {
  const out = [];
  for (const d of S.built) {
    if (!d.single || !d.facts) continue;
    let carry = 0;
    for (const e of d.facts.dos.entries) {
      const y = yearOf(e.year) || carry;
      carry = y;
      for (const b of e.blocks) {
        if (b.type !== 'p' || !classifyEvents(b.text, boatNames(d)).includes('missing')) continue;
        // Un marin disparu, pas un bateau perdu (« Bateau disparu. ») ni un autre navire (chalutier, cargo…).
        if (!PERSON_LOST.test(b.text) || /chalutier|p[êe]cheurs?\b|cargo|ferry/i.test(b.text)) continue;
        // Le disparu : la personne citée au plus près du mot « disparu » (« Éq: Jean MAUREL, Paul VATINE, disparu en mer »).
        const t = fold(b.text);
        const at = [...t.matchAll(/dispar/g)].map((x) => x.index);
        // Distance entre la fin du nom et le « disparu » qui le suit (le nom précède le mot dans l'écriture de l'auteur).
        // À défaut, le nom écrit juste après (« porté disparu. Mike PLANT, USA »).
        const near = [...(skippersOfBlock.get(b) || [])].map((sk) => {
          creditedIn(sk, b.text);
          const hits = [...t.matchAll(sk.creditRe)];
          const before = hits.flatMap((x) => at.filter((a) => a >= x.index + x[0].length).map((a) => a - (x.index + x[0].length)));
          const after = hits.flatMap((x) => at.filter((a) => a < x.index).map((a) => x.index - a + 100));
          return [sk, Math.min(...before, ...after.filter((g) => g <= 130), Infinity)];
        }).filter(([, dist]) => dist <= 130).sort((x, z) => x[1] - z[1]);
        out.push({ y, d, who: near.length ? [near[0][0]] : [], text: b.text });
      }
    }
  }
  // Disparitions connues par le palmarès sourcé de la course phare, absentes des fiches importées (Gerry Roufs, 1997).
  const extra = (S.phare || []).filter((ph) => ph.palmares).flatMap((ph) => (PALMARES[ph.palmares]?.disparus || []).map((x) => ({ ...x, src: PALMARES[ph.palmares].sources })))
    .filter((x) => !out.some((o) => o.who.some((sk) => fold(sk.name) === fold(x.skipper))));
  if (!out.length && !extra.length) return '';
  out.sort((a, b) => b.y - a.y);
  const excerpt = (t) => (t.length > 170 ? `${t.slice(0, 168).replace(/\s+\S*$/, '')}…` : t);
  const items = [
    ...out.map((o) => ({ y: o.y, html: `<li><b>${o.y || ''}</b> ${o.who.length ? o.who.map((sk) => `<a href="${root}${sk.url}">${esc(sk.name)}</a>`).join(', ') + ' · ' : ''}${boatLink(root, o.d, o.y)}<span class="meta">${esc(excerpt(o.text))}</span></li>` })),
    ...extra.map((x) => ({ y: x.annee, html: `<li><b>${x.annee}</b> ${skipperLinks(x.skipper, root)}<span class="meta">${esc(x.note || '')} (<a href="${esc(x.src[0].url)}" target="_blank" rel="noopener">${esc(x.src[0].titre)}</a>)</span></li>` })),
  ].sort((a, b) => b.y - a.y);
  return `<div class="people-card lost"><h3>Disparus en mer</h3><ul class="lost-list">${items.map((i) => i.html).join('')}</ul>
    <p class="source-note">D'après les fiches bateau de histoiredeshalfs.com${extra.length ? ' et le palmarès cité' : ''}.</p></div>`;
}

// ---------------------------------------------------------------- Séries : pages thématiques et palmarès
function renderResults(S, parsed, root, alt) {
  const eds = parsed.editions;
  const chips = `<nav class="years" aria-label="Éditions">${eds.map((e, i) => `<a href="#y${e.year}-${i}">${e.year}</a>`).join('')}</nav>`;
  const row = (r) => `<tr class="${/^[123]$/.test(r.rank) ? 'podium p' + r.rank : ''}"><td class="rank">${esc(r.rank)}</td><td>${linkBoats(S, r.html, root)}</td></tr>`;
  const editions = eds.map((e, i) => {
    const shown = e.results.length > 12 ? e.results.slice(0, 10) : e.results;
    const more = e.results.length > 12 ? e.results.slice(10) : [];
    return `<article class="edition" id="y${e.year}-${i}">
  <header><span class="ed-year">${e.year}</span><div class="ed-title">${linkBoats(S, e.titleHtml, root)}</div></header>
  ${e.results.length ? `<table class="results"><tbody>${shown.map(row).join('')}</tbody></table>` : ''}
  ${more.length ? `<details><summary>Classement complet (${e.results.length} lignes)</summary><table class="results"><tbody>${more.map(row).join('')}</tbody></table></details>` : ''}
  ${e.notes.length ? `<div class="ed-notes">${linkBoats(S, renderBlocks(e.notes, `${alt} ${e.year}`), root)}</div>` : ''}
</article>`;
  }).join('\n');
  return `${parsed.intro.length ? `<div class="prose">${renderBlocks(parsed.intro, alt)}</div>` : ''}${eds.length ? chips : ''}<div class="editions">${editions}</div>`;
}

function themePages(S) {
  for (const p of S.pages) {
    const src = readSource(p.rel);
    const rel = `${S.slug}/${p.slug}/index.html`;
    const root = prefixFor(rel);
    const blocks = src ? dropNav(toBlocks(src.body, p.rel, linkerFor(rel)), p.title) : [];
    const parsed = src && p.results ? parseResults(blocks, { loose: !!p.looseEditions }) : null;
    const content = !src ? `<div class="notice">Cette page est en cours d'import. <a href="${esc(originUrl(p.rel))}" target="_blank" rel="noopener">Voir la page d'origine ↗</a></div>`
      : parsed?.editions.length ? renderResults(S, parsed, root, p.title) : `<div class="prose wide">${linkBoats(S, renderBlocks(blocks, p.title), root)}</div>`;
    const body = `${hero(S.title, p.title, p.lead, '', true)}
${subnav(S, root, `${S.slug}/${p.slug}/`)}
<section><div class="wrap">${content}
${sourceNote(p.rel)}</div></section>`;
    write(rel, layout({ rel, title: `${p.title} — ${S.title}`, body, nav: navFor(S) }));
  }
}

// Regroupe les jalons triés par année : une colonne de frise par année.
const groupByYear = (ms) => {
  const groups = [];
  for (const m of ms) {
    const last = groups.at(-1);
    if (last && last.y === m.y) last.items.push(m);
    else groups.push({ y: m.y, label: m.y ? String(m.y) : (m.year || '—'), items: [m] });
  }
  return groups;
};

// ---------------------------------------------------------------- Séries : dossiers
// Fiches des sites officiels de classe (imoca.org, class40.com), rapprochées par outils/officiel/rapprocher.py :
// affichées « selon la classe », en ajout de la rédaction, sans remplacer le dossier de l'auteur.
const OFFICIEL = (() => {
  const o = readJson(path.resolve('content/officiel.json')), m = new Map();
  for (const [serie, v] of Object.entries(o)) if (v && v.bateaux) for (const b of v.bateaux) if (b.fiche_site) m.set(b.fiche_site, { ...b, _src: v.source, _date: v.date, _serie: serie });
  return m;
})();
// Nom actuel selon la classe (registre à jour) : il devient le « Aujourd'hui » de la fiche.
const officielNom = (d) => {
  const n = OFFICIEL.get(d.url)?.nom;
  return n ? prettyCase(n) : null;
};
// Une seule version par fiche (décision du 10/11/2026) : l'encadré ne reprend que ce qui complète la fiche (skipper
// actuel, date de mise à l'eau de la même année, foils, palmarès récent ; architecte et plan seulement s'ils manquent).
// Les écarts avec la fiche se vérifient puis se corrigent (content/fiches-corrections.json), ils ne s'affichent pas.
function officielSection(d, f) {
  const o = OFFICIEL.get(d.url);
  if (!o) return '';
  const site = new URL(o._src).hostname.replace(/^www\./, '');
  const date = o._date.split('-').reverse().join('/');
  const ourYear = String(f.years[0] || '').slice(0, 4);
  const launch = o.mise_a_l_eau && ourYear && o.mise_a_l_eau.endsWith(ourYear) ? o.mise_a_l_eau : '';
  const rows = [['Skipper', o.skipper], ['Mise à l’eau', launch], ['Foils', o.foils],
    ['Architecte', f.designers.length ? '' : o.architecte], ['Plan', f.designers.length || f.prod.length ? '' : o.plan]].filter(([, v]) => v);
  if (!rows.length && !(o.palmares || []).length) return '';
  const pal = (o.palmares || []).length ? `<div class="table-wrap"><table class="boats palmares"><thead><tr><th>Année</th><th>Course</th><th>Rang</th><th>Skipper</th></tr></thead><tbody>${o.palmares.map((r) => `<tr><td>${esc(r.annee)}</td><td>${esc(r.course)}</td><td>${esc(r.rang)}</td><td>${esc(r.skipper)}</td></tr>`).join('')}</tbody></table></div>` : '';
  return `<section class="officiel"><h2>Selon la classe</h2>
    <p class="meta">Ajout de la rédaction. Source : fiche officielle de la classe, <a href="${esc(o.fiche)}" rel="noopener">${esc(site)}</a>, consultée le ${esc(date)}.</p>
    <div class="facts"><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl></div>${pal ? `<h3>Palmarès récent (site de la classe)</h3>${pal}` : ''}</section>`;
}
function dossierPage(S, d) {
  const rel = d.url + 'index.html';
  const root = prefixFor(rel);
  const { dos, current, firstRename, title, sails, prod, designers, years, allNames } = dossierFacts(d, [...toBlocks(d.src.body, d.rel, linkerFor(rel)), ...d.extraBlocks]);
  const alt = title;
  // Événements marquants de chaque entrée, pour la frise et les pastilles de la chronologie.
  const EV_LABEL = { ...Object.fromEntries(EVENT_TYPES.map((t) => [t.type, t.label])), race: 'Grande course', rename: 'Changement de nom' };
  const evs = dos.entries.map((e, i) => {
    const text = e.blocks.filter((b) => b.type === 'p').map((b) => b.text).join(' \n ');
    let types = classifyEvents(text, boatNames(d)).filter((t) => t !== 'launch' || i < 2 || i <= 3 && /(?<!re)mise [àa] l'eau|\blaunch/i.test(text));
    // Le baptême n'est pas un changement de nom.
    if (e.rename && e.rename !== firstRename) types = ['rename', ...types];
    if (i === 0 && !types.includes('launch') && /\b(plan|design|built|construit)/i.test(text)) types.push('launch');
    return types;
  });
  const milestones = [];
  dos.entries.forEach((e, i) => {
    const text = e.blocks.filter((b) => b.type === 'p').map((b) => b.text).join(' ');
    // Grande course de l'année (la première citée), avec son classement s'il est donné.
    const races = racesOf(e.blocks);
    for (const race of races) {
      const t = race.first ? 'win' : 'race';
      milestones.push({ i, t, year: e.year, label: `${race.first ? 'Victoire · ' : ''}${race.name}${race.first ? '' : ` · ${race.rank}`}`, hint: race.name });
      if (!evs[i].includes(t)) evs[i].push(t);
    }
    for (const t of evs[i]) {
      // Une victoire ne va sur la frise qu'avec le nom de sa course (traitée ci-dessus).
      if (t === 'race' || t === 'win') continue;
      // Une seule construction sur la frise : de préférence l'entrée qui parle de mise à l'eau.
      if (t === 'launch' && milestones.some((m) => m.t === 'launch')) {
        // Une « remise à l'eau » après réparation n'est pas la mise à l'eau d'origine (Groupe Bel, 2008).
        if (i > 3 || !/(?<!re)mise [àa] l'eau|\blaunch/i.test(text)) continue;
        // La première entrée qui parle de mise à l'eau l'emporte (Paprec-Virbac : février 2007, pas 2008), et la ligne de
        // construction n'est remplacée que par une mise à l'eau de l'année suivante au plus (PRB 3 : 2006, pas 2008).
        const prevLaunch = milestones.find((m) => m.t === 'launch');
        if (/(?<!re)mise [àa] l'eau|\blaunch/i.test(prevLaunch.text || '')) continue;
        if (Number(String(e.year).slice(0, 4)) - Number(String(prevLaunch.year).slice(0, 4)) > 1) continue;
        milestones.splice(milestones.indexOf(prevLaunch), 1);
      }
      if (t === 'refit' && !/refit|restaur|r[ée]nov/i.test(text)) continue;
      // L'abandon de course figure déjà sur la frise avec la course (« · DNF/6 ») : pastille dans la chronologie seulement.
      if (t === 'retired') continue;
      // Décès, disparition : pas sur la frise si la ligne renvoie à une autre année (« décédé en avril 2014 » écrit en 2003).
      if ((t === 'death' || t === 'missing') && e.year) {
        const line = e.blocks.find((b) => b.type === 'p' && EVENT_TYPES.find((x) => x.type === t).re.test(b.text))?.text || '';
        const other = [...line.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => m[0]).filter((y) => y !== e.year.slice(0, 4));
        if (other.length) continue;
      }
      const label = t === 'rename' ? `Devient ${prettyCase(e.rename.name)}` : t === 'launch' && i === 0 && e.rename ? `${EV_LABEL[t]} : ${prettyCase(e.rename.name)}` : EV_LABEL[t];
      const hint = t === 'rename' ? e.rename.sail : (e.blocks.find((b) => b.type === 'p' && EVENT_TYPES.find((x) => x.type === t)?.re.test(b.text))?.text || '').slice(0, 160);
      if (!milestones.some((m) => m.i === i && m.t === t)) milestones.push({ i, t, year: e.year, label, hint, text });
    }
  });
  // Fiche technique datée en tête (dos.specYear) : la construction se place à cette année-là, pas à celle de
  // l'annonce du projet ou du début du chantier (relecture du 09/11/2026).
  if (dos.specYear) {
    const sy = Number(dos.specYear);
    for (let k = milestones.length - 1; k >= 0; k--) if (milestones[k].t === 'launch' && Number(String(milestones[k].year).slice(0, 4)) !== sy) milestones.splice(k, 1);
    if (!milestones.some((m) => m.t === 'launch')) {
      const at = Math.max(0, dos.entries.findIndex((e) => Number(String(e.year).slice(0, 4)) >= sy));
      milestones.push({ i: at, t: 'launch', year: dos.specYear, label: EV_LABEL.launch, hint: (dos.intro.find((b) => b.type === 'p')?.text || '').slice(0, 160) });
    }
  }
  // Dans une même année : construction et changement de nom d'abord, puis les faits de course.
  const ORDER = ['launch', 'rename', 'sale', 'forsale', 'sponsor', 'refit', 'race', 'win', 'record', 'retired', 'damage', 'dismast', 'capsize', 'sink', 'rescue', 'injury', 'missing', 'death'];
  // La frise suit les années ; à année égale, l'ordre du dossier puis l'ordre des types.
  // Année inconnue de l'auteur (« ?? ») : l'événement se range avec l'année qui le précède dans la chronologie, au lieu
  // d'une année inventée (« ?? » devenait « 55 », relecture du 09/11/2026). Une décennie connue (« 198? ») reste approchée.
  const yearKey = (y) => (/^(?:19|20)\d/.test(String(y || '')) ? Number(String(y).replace(/\?/g, '5').slice(0, 4)) || 0 : 0);
  // Année de chaque entrée dans l'ordre de la fiche : une entrée « ?? juin » prend l'année de l'entrée qui la précède.
  const entryY = [];
  dos.entries.forEach((e, k) => { entryY[k] = yearKey(e.year) || (k ? entryY[k - 1] : 0); });
  for (const m of milestones) m.y = yearKey(m.year) || entryY[m.i] || 0;
  milestones.sort((a, b) => a.y - b.y || a.i - b.i || ORDER.indexOf(a.t) - ORDER.indexOf(b.t));
  // Règles du propriétaire (09/11/2026) pour la frise ; la chronologie détaillée, elle, reste complète :
  // 1. la frise commence à la mise à l'eau : l'annonce, la commande et le chantier n'y figurent pas (sauf bateau encore en
  //    projet, sans mise à l'eau) ;
  // 2. une seule perte : l'épave retrouvée plus tard (« Naufrage, perte » une seconde fois) n'y figure pas.
  const launchM = milestones.find((m) => m.t === 'launch');
  if (launchM?.y) {
    for (let k = milestones.length - 1; k >= 0; k--) {
      const m = milestones[k];
      if (m.t === 'order' || (m.y && m.y < launchM.y)) milestones.splice(k, 1);
    }
  }
  const firstLoss = milestones.findIndex((m) => m.t === 'sink' || m.t === 'missing');
  if (firstLoss >= 0) for (let k = milestones.length - 1; k > firstLoss; k--) if (milestones[k].t === 'sink' || milestones[k].t === 'missing') milestones.splice(k, 1);
  // Skippers de chaque année, d'après la compilation globale (variantes d'écriture déjà fusionnées, mentions en
  // minuscules comprises) : les plus cités dans la fiche cette année-là.
  // Seules comptent les personnes à bord : skipper (lead) et co-skipper ou équipier (co) ; les tiers cités sont écartés.
  const skByYear = new Map();
  const totalBy = new Map();
  for (const sk of docSkippers.get(d) || []) for (const m of sk.mentions) {
    const role = roleOf(sk, m);
    if (m.d !== d || !m.y || (role !== 'skipper' && role !== 'co')) continue;
    if (!skByYear.has(m.y)) skByYear.set(m.y, new Map());
    const c = skByYear.get(m.y).get(sk) || { lead: 0, co: 0, big: false };
    if (role === 'skipper') { c.lead++; totalBy.set(sk, (totalBy.get(sk) || 0) + 1); } else { c.co++; if (BIG_RACE.test(m.b.text)) c.big = true; }
    skByYear.get(m.y).set(sk, c);
  }
  // TP52 : les personnes à bord chaque année sont celles de l'extraction validée (années lues sur la fiche, pas de report).
  const isTp52 = /^tp52\//.test(d.url || '');
  if (isTp52) {
    skByYear.clear(); totalBy.clear();
    const file = path.basename(d.rel);
    for (const e of TP52.equipages) {
      if (e.fichier !== file || (e.role !== 'skipper' && e.role !== 'equipier') || !Number(e.annee)) continue;
      const p = tp52Person(e.marin);
      const k = keyOf(p.first, p.last);
      const sk = SKIPPERS.get(k) || MERGED.get(k);
      if (!sk) continue;
      const y = Number(e.annee);
      if (!skByYear.has(y)) skByYear.set(y, new Map());
      const c = skByYear.get(y).get(sk) || { lead: 0, co: 0, big: false };
      if (e.role === 'skipper') { c.lead++; totalBy.set(sk, (totalBy.get(sk) || 0) + 1); } else c.co++;
      skByYear.get(y).set(sk, c);
    }
  }
  // Skipper titulaire : celui qui mène le plus souvent le bateau dans la fiche.
  const mainSk = [...totalBy].sort((a, b) => b[1] - a[1])[0]?.[0];
  // Bande de l'année : le skipper qui mène le bateau, puis son co-skipper (régulier ou d'une grande course en double),
  // ou un second skipper s'il l'a mené presque autant. Une année sans skipper nommé prolonge la bande précédente
  // (« éq: Adrien HARDY » seul : le titulaire reste affiché).
  const skippersFor = (y) => {
    const counts = [...(skByYear.get(y) || new Map())];
    const leads = counts.filter(([, c]) => c.lead).sort((a, b) => b[1].lead - a[1].lead || (b[0] === mainSk) - (a[0] === mainSk));
    if (!leads.length) return [];
    const first = leads[0][0];
    const co = counts.filter(([sk, c]) => sk !== first && c.co && (c.co >= 2 || c.big)).sort((a, b) => b[1].co - a[1].co)[0]?.[0];
    const second = co || leads.slice(1).find(([, c]) => c.lead >= Math.max(2, leads[0][1].lead / 2))?.[0];
    return second ? [first, second] : [first];
  };
  let bandKey = '', bandSks = [], bandY = 0;
  const frise = milestones.length >= 2 ? `<section class="frise-wrap" aria-label="Événements marquants">
    <h2>En un coup d'œil</h2>
    <ol class="frise">${groupByYear(milestones).map((g, k) => {
      // Bande « skipper » : le nom s'affiche au début d'une période, la bande continue tant que le skipper reste le même
      // (une année sans résultat ne l'interrompt pas).
      const prev = bandKey;
      const sks = skippersFor(g.y);
      // Une année sans skipper nommé ne prolonge la bande ni après une vente, ni plus de deux ans après la dernière
      // mention (relecture du 09/11/2026 : Mike Plant affiché sur Duracell jusqu'en 2021, vendu en 1992).
      const sold = g.items.some((m) => m.t === 'sale');
      const key = sks.map((sk) => sk.name).join(' & ') || (isTp52 || sold || (g.y && bandY && g.y - bandY > 2) ? '' : prev);
      if (sks.length) { bandSks = sks; bandY = g.y; }
      bandKey = key;
      // Les noms du bandeau mènent à la fiche du skipper.
      // Duo : noms de famille seulement (« Lipinski & Hardy »), pour tenir dans la colonne ; le nom complet est au survol.
      const duo = bandSks.length > 1;
      const bandLabel = bandSks.map((sk) => `<a href="${root}${sk.url}" title="${esc(sk.name)}">${esc(duo ? sk.name.split(' ').slice(1).join(' ') || sk.name : sk.name)}</a>`).join(' & ');
      const band = key ? `<span class="sk${key === prev ? ' cont' : ''}" title="${esc(key)}">${key === prev ? '' : bandLabel}</span>` : '<span class="sk none"></span>';
      return `<li class="yr">${band}<span class="fy">${esc(g.label)}</span><span class="dots">${g.items.map((m) => `<i class="ev-${m.t}"></i>`).join('')}</span>
      <ul>${g.items.map((m) => `<li class="ev-${m.t}"><a href="#e${m.i}" title="${esc(m.hint)}"><i></i>${esc(m.label)}</a></li>`).join('')}</ul></li>`;
    }).join('')}</ol>
    <div class="legend">${[...new Set(milestones.map((m) => m.t))].map((t) => `<span class="ev-${t}"><i></i>${esc(EV_LABEL[t])}</span>`).join('')}</div>
  </section>` : '';
  const timeline = dos.entries.map((e, idx) => {
    // L'année est déjà affichée en tête d'entrée : on la retire du premier paragraphe.
    const eb = e.year && e.blocks[0]?.type === 'p'
      ? [{ ...e.blocks[0], html: e.blocks[0].html.replace(new RegExp(`^((?:<[^>]+>\\s*)*)${(e.yearFixed || e.yearOrig || e.year).replace(/\?/g, '\\?')}\\s*[,:]?\\s*`), '$1') }, ...e.blocks.slice(1)]
      : e.blocks;
    const label = e.rename === firstRename ? 'Baptisé' : 'Devient';
    const types = evs[idx];
    const badges = types.filter((t) => t !== 'rename').map((t) => `<span class="badge ev-${t}">${esc(EV_LABEL[t])}</span>`).join('');
    return `<li id="e${idx}" class="${types[0] ? 'ev-' + types[0] : ''}${e.rename ? ' rename' : ''}">
      ${e.year || badges ? `<div class="year">${esc(e.year)}${e.yearFixed ? ` <span class="fixed" title="L'auteur a écrit ${esc(e.yearFixed)} ; la suite de la chronologie indique ${esc(e.year)}.">(écrit ${esc(e.yearFixed)} dans la source)</span>` : ''}${badges ? ` <span class="badges">${badges}</span>` : ''}</div>` : ''}
      ${e.rename ? `<div class="rename-tag">${label} <b>${esc(prettyCase(e.rename.name))}</b> <span class="sail">${esc(e.rename.sail)}</span></div>` : ''}
      ${renderBlocks(eb.filter((b) => b.type === 'img' || b.text.replace(/<[^>]+>/g, '').trim()), alt, { nest: true })}
    </li>`;
  }).join('\n');
  const planned = plannedLaunch(d);
  // « Argo (2) » : l'auteur numérote les homonymes dans ses listes ; sur la fiche, le nom suffit.
  const shownNames = [...new Map(allNames.map((n) => [nameKey(n.name), { ...n, name: n.name.replace(/\s*\(\d\)\s*$/, '') }])).values()];
  const body = `
${subnav(S, root, '')}
<div class="wrap">
  <nav class="crumbs"><a href="${root}">Accueil</a> › <a href="${root}${S.slug}/">${esc(S.title)}</a> › ${esc(title)}</nav>
  <div class="boat-head">
    <div>
      <div class="eyebrow">${esc(S.short)}${planned ? ' · en projet' : years[0] ? ' · ' + esc(years[0]) : ''}${ARCHIVED[d.rel] ? ` · <span class="archived" title="Copie de la Wayback Machine, en attente de la version à jour">archive du ${captureDate(ARCHIVED[d.rel].timestamp)}</span>` : ''}${d.editorial ? ' · <span class="archived">ajout de la rédaction</span>' : ''}</div>
      <h1>${S.numberFirst && sails[0] ? `<span class="hull-no">n° ${esc((sails[0].match(/\d+/) || [sails[0]])[0])}</span> ` : ''}${esc(title)}</h1>
      ${(() => { const now = officielNom(d) || current; return now && fold(now) !== fold(title) ? `<p class="now">Aujourd'hui : <b>${esc(now)}</b></p>` : ''; })()}
      ${sails[0] ? `<div class="sail big">${esc(sails.join(' · '))}</div>` : ''}
      ${shownNames.length > 1 ? `<ul class="names" aria-label="Noms successifs">${shownNames.map((n) => `<li>${esc(n.name)}${n.sail ? `<span class="sail">${esc(n.sail)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    </div>
    <aside class="facts">${VITRINE && d.single && coverOf(d) ? `<a class="boat-cover" href="${esc(photoUrl(coverOf(d).src))}">${coverImg(coverOf(d), title, '', imgPrio)}</a>` : ''}<dl>
      ${designers.length ? `<dt>Plan</dt><dd>${esc(designers.join(', '))}</dd>` : ''}
      ${prod.length ? `<dt>Série</dt><dd>${esc(prod.join(', '))}</dd>` : ''}
      ${planned ? `<dt>Mise à l’eau</dt><dd>prévue en ${planned}</dd>` : years.length ? `<dt>Construction</dt><dd>${esc(years.join(', '))}</dd>` : ''}
      ${sails.length ? `<dt>N° de voile</dt><dd>${sails.map((s) => `<span class="sail">${esc(s)}</span>`).join(' ')}</dd>` : ''}
      ${dos.updated ? `<dt>Dossier à jour</dt><dd>${esc(dos.updated)}</dd>` : ''}
    </dl></aside>
  </div>
  ${frise}
  ${officielSection(d, { years, designers, prod })}
  ${dos.intro.length ? `<div class="prose">${linkSkippers(renderBlocks(dos.intro, alt), root, d)}</div>` : ''}
  ${dos.entries.length ? `<section><h2>Chronologie détaillée</h2>
    <ol class="timeline">
${linkSkippers(timeline, root, d)}
    </ol>
  </section>` : ''}
  ${d.editorial ? editorialNote(d.editorial) : sourceNote(d.rel, "dossier d'origine")}
  ${d.complement ? editorialNote(d.complement, true) : ''}
</div>`;
  write(rel, layout({ rel, title, description: `Histoire du ${S.short} ${title}.`, body, nav: navFor(S) }));
}

// ---------------------------------------------------------------- Séries : architectes (dérivé de la liste)
// Plan ou série d'un bateau, nettoyé (les Mini prennent le plan écrit dans la fiche : la liste n'a que des codes).
const planOf = (S, b) => {
  let k = prettyCase(((S.numberWithPlan ? b.doc?.facts?.dos?.designer : '') || b.series || b.designer || '').replace(/\?/g, '').replace(/\s*\(.*$/, '').replace(/[\s.,;:]+$/, '').trim());
  // « DB2 1985; », « Nicholson 33 197; » : l'année recopiée après le plan n'en fait pas partie.
  if (k.includes(';')) k = k.split(';')[0].replace(/\s+(?:19|20)\d{0,2}\s*$/, '').trim();
  return !k || k.length > 32 || /^ex\b|["“”]/i.test(k) || !/[a-z]{2}/i.test(k) ? '' : k;
};
// Chantier d'un bateau, tel que la fiche l'écrit en tête (« construit chez Pichavant », « Chantier : CDK Technologie »).
// BUILDER_RE : voir lib/parse.mjs.
const builderOf = (b) => {
  const d = b.doc;
  if (!d?.single || !d.facts) return '';
  // La fiche technique et l'entrée de construction seulement ; une ligne de refit, de réparation ou de transformation
  // ne donne pas le chantier de construction.
  const texts = [...d.facts.dos.intro, ...(d.facts.dos.entries[0]?.blocks || [])].filter((x) => x.type === 'p').map((x) => x.text)
    .filter((t) => !/refit|r[ée]nov|r[ée]par|transform|modifi|chantier d.hiver|hivernage|remis en (?:état|forme)/i.test(t));
  for (const t of texts) {
    // Lecture commune avec les contrôles (lib/parse.mjs, builderFrom).
    const name = builderFrom(t);
    // Les sigles restent en capitales (« CDK », « CMI », « IDB »).
    if (name && /[a-z]{2}/i.test(name) && !/^(?:son|sa|ses|un|une|le|la|les|lui|elle|il)$/i.test(name)) return /^[A-Z0-9&]{2,4}$/.test(name) ? name : prettyCase(name);
  }
  return '';
};
// Chantier : « CDK », « CDK Technologies », « CDK Lorient » sont un même chantier ; « Stuctures » est « Structures ».
const BUILDER_NOISE = /\b(?:technologies?|composites?|lorient|shipyard|production|productions|yard|boatyard|chantier|chantiers|sa|sarl|sas|ltd|inc|gmbh)\b/g;
const builderKey = (k) => fold(k).replace(BUILDER_NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// ---------------------------------------------------------------- Base des bateaux : architecte, modèle, chantier
// Chaque bateau reçoit un enregistrement : son architecte (la fiche, sinon la liste quand elle le donne), son modèle (la
// liste), le chantier qui l'a construit (la ligne de construction de la fiche, jamais un chantier de refit). Les
// appellations sont ramenées au nom retenu par content/normalisation.json.
const NORM = readJson(path.resolve('content/normalisation.json'));
const normKey = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
const aliasMap = (group) => {
  const m = new Map();
  for (const [canonical, alts] of Object.entries(NORM[group] || {})) for (const a of [canonical, ...alts]) m.set(normKey(a), canonical);
  return m;
};
const ALIAS = { architectes: aliasMap('architectes'), modeles: aliasMap('modeles'), chantiers: aliasMap('chantiers') };
const EXCLUDED_BUILDERS = new Set((NORM.exclure?.chantiers || []).map(normKey));
const MODEL_BUILDER = new Map(Object.entries(NORM.modeles_chantiers || {}).filter(([k]) => k !== 'note').map(([m, c]) => [normKey(m), c]));
const canonical = (group, s) => {
  if (!s) return '';
  const k = normKey(s);
  if (group === 'chantiers' && EXCLUDED_BUILDERS.has(k)) return '';
  return ALIAS[group].get(k) || s;
};
const cleanLabel = (s) => {
  const t = prettyCase(String(s || '').replace(/\?/g, '').replace(/\s*\(.*$/, '').replace(/[\s.,;:]+$/, '').trim());
  return !/[a-z]{2}/i.test(t) || t.length > 40 || /^ex\b|["“”]|construit|built|bateau/i.test(t) ? '' : t;
};
// Mini : le modèle est écrit dans la ligne de construction de la fiche (« Plan Raison, Maxi 6.50 #17 », « plan Finot,
// Pogo 2 No15 », « Plan Bertrand, Vector 6.50 »).
const MINI_MODEL = /\b(Pogo\s?[123]|Pogo|Maxi\s?6[.,]50|Vector\s?6[.,]50|Nacira(?:\s?6[.,]50)?|Z[ée]ro|Ofcet(?:\s?6[.,]50)?|Tip\s?Top|Dingo|Argo|Mistral|Ocean\s?650|Sergas|Ginto)\b/i;
function recordOf(S, b) {
  if (b.rec) return b.rec;
  const d = b.doc;
  const listModel = S.listColonne === 'modele';
  let model = cleanLabel(b.series || (listModel ? b.designer : ''));
  // Mini : la liste n'a que des codes de plan ; l'architecte vient de la fiche.
  let archi = cleanLabel(d?.facts?.dos?.designer || (!listModel && !S.numberWithPlan ? b.designer : ''));
  // La colonne « modèle » de la liste donne parfois l'architecte (« Raison ») : il rejoint l'architecte.
  if (model && ALIAS.architectes.has(normKey(model))) { if (!archi) archi = model; model = ''; }
  if (!model && S.numberWithPlan && d?.facts) {
    const first = [...d.facts.dos.intro, ...(d.facts.dos.entries[0]?.blocks || [])].filter((x) => x.type === 'p').map((x) => x.text).join(' ');
    const m = first.match(MINI_MODEL);
    if (m) model = m[1].replace(/\s+/g, ' ').replace(/(\d),(\d)/, '$1.$2').replace(/^(\w)/, (c) => c.toUpperCase());
  }
  const fix = CORRECTIONS[d?.rel] || {};
  b.rec = { architecte: canonical('architectes', fix.architecte || archi), modele: canonical('modeles', model), chantier: canonical('chantiers', fix.chantier || builderOf(b)), deduit: false };
  return b.rec;
}
// Architecte déduit du modèle quand les fiches de l'auteur sont unanimes (Pogo 40 -> Finot-Conq, Mach 40 -> Sam Manuard).
const baseReady = new Set();
function buildBase(S) {
  if (baseReady.has(S)) return;
  baseReady.add(S);
  const recs = S.boats.map((b) => recordOf(S, b));
  const byModel = new Map();
  for (const r of recs) if (r.modele && r.architecte) {
    if (!byModel.has(r.modele)) byModel.set(r.modele, new Map());
    byModel.get(r.modele).set(r.architecte, (byModel.get(r.modele).get(r.architecte) || 0) + 1);
  }
  for (const r of recs) if (r.modele && !r.architecte && byModel.has(r.modele)) {
    const counts = [...byModel.get(r.modele)].sort((a, b) => b[1] - a[1]);
    const total = counts.reduce((n, [, c]) => n + c, 0);
    if (counts.length === 1 && total >= 2) { r.architecte = counts[0][0]; r.deduit = true; }
  }
  // Chantier d'un modèle de série : celui qui le produit (content/normalisation.json, « modeles_chantiers » : les Pogo
  // chez Structures), sinon celui que donnent toutes les fiches du modèle qui le nomment (au moins trois). La fiche
  // d'un bateau qui nomme un autre chantier garde le sien.
  const byModelB = new Map();
  for (const r of recs) if (r.modele && r.chantier) {
    if (!byModelB.has(r.modele)) byModelB.set(r.modele, new Map());
    byModelB.get(r.modele).set(r.chantier, (byModelB.get(r.modele).get(r.chantier) || 0) + 1);
  }
  for (const r of recs) if (r.modele && !r.chantier) {
    const declared = MODEL_BUILDER.get(normKey(r.modele));
    const counts = [...(byModelB.get(r.modele) || [])];
    const total = counts.reduce((n, [, c]) => n + c, 0);
    const unanimous = counts.length === 1 && total >= 3 ? counts[0][0] : '';
    if (declared || unanimous) { r.chantier = declared || unanimous; r.chantierDeduit = true; }
  }
  // Noms retenus (variantes de casse regroupées) : fixés avant toute page, liste comme pages d'architectes.
  for (const [, field] of KINDS) entityGroups(S, field);
}
const entityUrl = (S, kind, name) => `${S.slug}/${kind}/${slugify(name)}/`;
const KINDS = [['architectes', 'architecte', 'Architecte'], ['modeles', 'modele', 'Modèle'], ['chantiers', 'chantier', 'Chantier']];

// Barres : nombre de bateaux par clé (plan, série ou chantier), regroupée malgré les variantes d'écriture ; la forme la
// plus fréquente donne le libellé.
function countBars(S, keyOf, root, limit = 10, norm = designerKey) {
  const m = new Map();
  for (const b of S.boats) {
    const k = keyOf(b);
    if (!k) continue;
    let key = norm(k);
    // Faute de frappe (une lettre près) : rattachée à une clé déjà vue.
    const near = [...m.keys()].find((x) => x !== key && x.length >= 6 && oneEdit(x, key));
    if (near) key = near;
    if (!m.has(key)) m.set(key, { forms: new Map(), n: 0 });
    const g = m.get(key);
    g.n++;
    g.forms.set(k, (g.forms.get(k) || 0) + 1);
  }
  const all = [...m.values()].map((g) => ({ name: [...g.forms].sort((a, b) => b[1] - a[1])[0][0], n: g.n })).sort((a, b) => b.n - a.n);
  const top = all.slice(0, limit);
  const max = top[0]?.n || 1;
  return { all, html: top.length >= 3 ? `<ol class="bars">${top.map((g) => `<li><a href="${root}${S.slug}/bateaux/?q=${encodeURIComponent(g.name)}">${esc(g.name)}</a><span class="bar-track"><i style="width:${(g.n / max * 100).toFixed(1)}%"></i></span><b>${g.n}</b></li>`).join('')}</ol>` : '' };
}
// Bateaux d'une classe regroupés par architecte, modèle ou chantier (nom retenu par la base).
function entityGroups(S, field) {
  buildBase(S);
  if (S.groupsCache?.[field]) return S.groupsCache[field];
  // Regroupement sans tenir compte de la casse ni de la ponctuation (« AMCO » et « Amco ») ; la forme la plus fréquente
  // devient le nom retenu, et chaque bateau prend ce nom.
  const m = new Map();
  for (const b of S.boats) {
    const v = b.rec?.[field];
    if (!v) continue;
    const k = normKey(v);
    if (!m.has(k)) m.set(k, { forms: new Map(), boats: [] });
    const g = m.get(k);
    g.boats.push(b);
    g.forms.set(v, (g.forms.get(v) || 0) + 1);
  }
  const groups = [...m.values()].map((g) => ({ name: [...g.forms].sort((a, b) => b[1] - a[1])[0][0], boats: g.boats }))
    .sort((a, b) => b.boats.length - a.boats.length || fold(a.name).localeCompare(fold(b.name)));
  for (const g of groups) for (const b of g.boats) b.rec[field] = g.name;
  (S.groupsCache ||= {})[field] = groups;
  return groups;
}
// Page d'un architecte, d'un modèle ou d'un chantier : tous les bateaux de la classe concernés, avec leur fiche.
function entityPage(S, kind, field, label, g) {
  const rel = `${entityUrl(S, kind, g.name)}index.html`;
  const root = prefixFor(rel);
  const others = KINDS.filter(([, f]) => f !== field && g.boats.some((b) => b.rec[f]));
  const launchNo = (b) => (S.numberFirst ? b.sail : b.doc?.facts?.launchSail || b.sail) || '';
  const rows = [...g.boats].sort((a, b) => String(a.year || a.yearName).localeCompare(String(b.year || b.yearName)) || fold(a.name).localeCompare(fold(b.name))).map((b) => {
    const d = b.doc;
    const name = /^[?\s]+$/.test(b.name) ? '<span class="meta">nom inconnu</span>' : esc(b.name);
    const link = d?.src ? `<a href="${root}${d.url}">${name}</a>` : name;
    return `<tr><td><span class="sail">${esc(launchNo(b))}</span></td><td>${link}</td><td>${esc(b.year || b.yearName || '')}</td>${others.map(([k, f]) => `<td>${b.rec[f] ? `<a href="${root}${entityUrl(S, k, b.rec[f])}">${esc(b.rec[f])}</a>${(f === 'architecte' && b.rec.deduit) || (f === 'chantier' && b.rec.chantierDeduit) ? ` <span class="meta" title="Déduit du modèle : la fiche du bateau ne le nomme pas">(d’après le modèle)</span>` : ''}` : ''}</td>`).join('')}<td>${esc(b.current || '')}</td></tr>`;
  }).join('');
  const years = g.boats.map((b) => Number(b.year)).filter((y) => y > 1900);
  const body = `${hero(`${S.title} · ${label}`, g.name, `${num(g.boats.length)} bateau${g.boats.length > 1 ? 'x' : ''} de la classe${years.length ? `, de ${Math.min(...years)} à ${Math.max(...years)}` : ''}.`, '', true)}
${subnav(S, root, `${S.slug}/architectes/`)}
<section><div class="wrap">
  <nav class="crumbs"><a href="${root}${S.slug}/architectes/">Architectes et chantiers</a> › ${esc(g.name)}</nav>
  <div class="table-wrap"><table class="boats"><thead><tr><th>N°</th><th>Nom de baptême</th><th>Année</th>${others.map(([, , l]) => `<th>${l}</th>`).join('')}<th>Nom actuel</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="source-note">D’après les fiches et la liste de histoiredeshalfs.com ; les différentes écritures d’un même nom sont regroupées (content/normalisation.json).</p>
</div></section>`;
  write(rel, layout({ rel, title: `${g.name} — ${S.title}`, description: `Les ${S.title} : ${label.toLowerCase()} ${g.name}.`, body, nav: navFor(S) }));
}
function architectsPage(S) {
  const rel = `${S.slug}/architectes/index.html`;
  const root = prefixFor(rel);
  const archiSrc = S.archi && readSource(S.archi);
  let main = '';
  if (S.modeles?.length) {
    // Monotype : les modèles successifs, leur architecte, leur chantier et leur nombre d'exemplaires.
    main = `<section><div class="wrap"><h2>Les modèles</h2><div class="grid">${S.modeles.map((m) => `<${m.cat ? `a href="${root}${S.slug}/bateaux/?cat=${encodeURIComponent(m.cat)}"` : 'div'} class="card"><span class="count">${esc(String(m.annee))}</span><b>${esc(m.nom)}</b>
      <span class="meta">Architecte : ${esc(m.architecte)}</span>${m.chantier ? `<span class="meta">Chantier : ${esc(m.chantier)}</span>` : ''}${m.exemplaires ? `<span class="meta">${num(m.exemplaires)} exemplaires</span>` : ''}${m.cat ? `<span class="meta">${num(S.boats.filter((b) => b.cat === m.cat).length)} bateaux dans la liste →</span>` : ''}</${m.cat ? 'a' : 'div'}>`).join('')}</div>
      ${S.modelesSource ? `<p class="source-note">D'après <a href="${esc(S.modelesSource.url)}" target="_blank" rel="noopener">${esc(S.modelesSource.titre)}</a>.</p>` : ''}</div></section>`;
  } else {
    // Architectes, modèles, chantiers : barres des plus représentés, puis tous les noms ; chacun mène à sa page, qui
    // liste tous les bateaux de la classe concernés.
    buildBase(S);
    const blocks = KINDS.map(([kind, field, label]) => {
      const groups = entityGroups(S, field);
      if (!groups.length) return '';
      const covered = groups.reduce((n, g) => n + g.boats.length, 0);
      const max = groups[0].boats.length;
      const titles = { architectes: 'Architectes', modeles: 'Modèles et séries', chantiers: 'Chantiers de construction' };
      const notes = { architectes: 'D’après le plan indiqué sur chaque fiche, ou le modèle', modeles: 'D’après la liste de l’auteur et les fiches', chantiers: 'D’après la ligne de construction des fiches (jamais un chantier de refit), ou le chantier qui produit le modèle' };
      return `<section class="entity-block"><div class="wrap"><div class="section-head"><h2>${titles[kind]}</h2><p>${notes[kind]} : ${num(covered)} bateaux sur ${num(S.boats.length)}.</p></div>
        <ol class="bars">${groups.slice(0, 12).map((g) => `<li><a href="${root}${entityUrl(S, kind, g.name)}">${esc(g.name)}</a><span class="bar-track"><i style="width:${(g.boats.length / max * 100).toFixed(1)}%"></i></span><b>${g.boats.length}</b></li>`).join('')}</ol>
        ${groups.length > 12 ? `<p class="entity-more">${groups.slice(12).sort((a, b) => fold(a.name).localeCompare(fold(b.name))).map((g) => `<a href="${root}${entityUrl(S, kind, g.name)}">${esc(g.name)}</a> <span class="meta">(${g.boats.length})</span>`).join(' · ')}</p>` : ''}
      </div></section>`;
    });
    main = blocks.join('');
    for (const [kind, field, label] of KINDS) for (const g of entityGroups(S, field)) entityPage(S, kind, field, label, g);
  }
  const body = `${hero(S.title, 'Architectes et chantiers', `Qui a dessiné et construit les ${S.title} ?`, '', true)}
${subnav(S, root, `${S.slug}/architectes/`)}
${main}
${archiSrc ? `<section><div class="wrap"><details class="raw"><summary>Notes de l'auteur sur les architectes</summary><div class="prose wide">${linkBoats(S, renderBlocks(dropNav(toBlocks(archiSrc.body, S.archi, linkerFor(rel))), 'Architectes'), root)}</div></details>${sourceNote(S.archi)}</div></section>` : ''}`;
  write(rel, layout({ rel, title: `Architectes — ${S.title}`, body, nav: navFor(S) }));
}

// ---------------------------------------------------------------- Skippers : pages
const EV_LABELS = { ...Object.fromEntries(EVENT_TYPES.map((t) => [t.type, t.label])), race: 'Grande course', rename: 'Changement de nom', win: 'Victoire' };
// Le bateau porte, sur un résultat ou un fait, le nom qu'il avait cette année-là (Foncia en 2010, pas Banque Populaire).
const boatLink = (root, d, y) => {
  const at = y ? d.facts.nameAt(y) : d.facts.title;
  return `<a href="${root}${d.url}"${at !== d.facts.title ? ` title="Baptisé ${esc(d.facts.title)}"` : ''}>${esc(at)}</a>`;
};
// Bateau d'un classement : sa fiche, sinon le bateau nommé dans la page de résultats.
const resultBoat = (root, r) => (r.d ? boatLink(root, r.d, r.y) + (r.implicit ? ' <span class="meta" title="Le nom du skipper n’est pas écrit sur cette ligne de la fiche : il est déduit des autres lignes de l’année.">· skipper d’après la fiche</span>' : '') : r.boatName ? (r.boatHref ? `<a href="${root}${r.boatHref}">${esc(r.boatName)}</a>` : esc(r.boatName)) : '');
const resultHref = (r) => (r.d ? r.d.url : r.href);
const ROLE_LABEL = { skipper: 'skipper', co: 'co-skipper ou équipier', owner: 'propriétaire', tiers: 'cité, pas à bord' };
const yearsRange = (ys) => (ys.length ? (Math.min(...ys) === Math.max(...ys) ? `${Math.min(...ys)}` : `${Math.min(...ys)} – ${Math.max(...ys)}`) : '');

function skipperPage(sk) {
  const rel = `${sk.url}index.html`;
  const root = prefixFor(rel);
  // Frise : grandes courses et victoires, faits marquants ; le bateau de l'année en bandeau.
  const ms = [];
  for (const r of sk.results) if (r.first || r.big) ms.push({ y: r.y, t: r.first ? 'win' : 'race', label: `${r.first ? 'Victoire · ' : ''}${r.race}${r.first ? '' : ` · ${r.rank}`}`, href: resultHref(r) });
  for (const e of sk.events) for (const t of e.types.filter((x) => x !== 'damage' && x !== 'retired')) ms.push({ y: e.y, t, label: `${EV_LABELS[t]} · ${e.d.facts.title}`, href: e.d.url });
  ms.sort((a, b) => a.y - b.y);
  let band = '';
  const frise = ms.length >= 2 ? `<section class="frise-wrap" aria-label="Carrière en un coup d'œil"><h2>En un coup d'œil</h2>
    <ol class="frise">${groupByYear(ms.filter((m) => m.y)).map((g) => {
      // Bateaux de l'année, avec un lien vers leur fiche : nom porté cette année-là ; à défaut, le bateau des classements.
      const yb = new Map();
      for (const b of sk.boats) if (b.years.has(g.y)) yb.set(b.d.facts.nameAt(g.y), `${root}${b.d.url}`);
      for (const r of sk.results) if (r.y === g.y && !r.d && r.boatName && !yb.has(r.boatName)) yb.set(r.boatName, r.boatHref ? `${root}${r.boatHref}` : '');
      const pair = [...yb].slice(0, 2);
      const boats = pair.map(([n]) => n).join(' / ');
      const prev = band; band = boats || prev;
      const label = pair.map(([n, u]) => (u ? `<a href="${u}">${esc(n)}</a>` : esc(n))).join(' / ');
      const bandHtml = band ? `<span class="sk${band === prev ? ' cont' : ''}" title="${esc(band)}">${band === prev ? '' : label}</span>` : '<span class="sk none"></span>';
      return `<li class="yr">${bandHtml}<span class="fy">${g.label}</span><span class="dots">${g.items.map((m) => `<i class="ev-${m.t}"></i>`).join('')}</span>
      <ul>${g.items.map((m) => `<li class="ev-${m.t}"><a href="${root}${m.href}"><i></i>${esc(m.label)}</a></li>`).join('')}</ul></li>`;
    }).join('')}</ol>
    <div class="legend">${[...new Set(ms.map((m) => m.t))].map((t) => `<span class="ev-${t}"><i></i>${esc(EV_LABELS[t])}</span>`).join('')}</div></section>` : '';
  const boats = `<section><h2>Bateaux</h2><div class="grid">${sk.boats.map((b) => `<a class="card" href="${root}${b.d.url}"><span class="meta">${esc(b.S.short)} · ${ROLE_LABEL[b.role]}</span><b>${esc(b.d.facts.title)}</b><span class="meta">${yearsRange([...b.years])}${b.d.facts.current ? ` · aujourd’hui ${esc(b.d.facts.current)}` : ''}</span></a>`).join('')}</div></section>`;
  // Classe du bateau : la série de la fiche bateau ou de la page de résultats d'où vient le classement.
  const palmares = sk.results.length ? `<section><h2>Palmarès</h2><div class="table-wrap"><table class="boats palmares"><thead><tr><th>Année</th><th>Course</th><th>Classement</th><th>Bateau</th><th>Classe</th></tr></thead><tbody>
    ${sk.results.map((r) => `<tr class="${r.first ? 'podium p1' : ''}"><td>${r.y || ''}</td><td>${r.d ? esc(r.race) : `<a href="${root}${r.href}" title="Voir l'édition">${esc(r.race)}</a>`}</td><td class="rank-cell">${esc(r.rank)}</td><td>${resultBoat(root, r)}${r.co ? ' <span class="meta">· co-skipper ou équipier</span>' : ''}</td><td>${r.S ? `<a class="pill" href="${root}${r.S.slug}/">${esc(r.S.short)}</a>` : ''}</td></tr>`).join('')}
    </tbody></table></div></section>` : '';
  const faits = sk.events.length ? `<section><h2>Faits marquants</h2><ol class="timeline">${sk.events.map((e) => `<li class="ev-${e.types[0]}"><div class="year">${e.y || ''} <span class="badges">${e.types.map((t) => `<span class="badge ev-${t}">${esc(EV_LABELS[t])}</span>`).join('')}</span></div><p>${esc(e.b.text)} <span class="meta">— ${boatLink(root, e.d, e.y)}</span></p></li>`).join('')}</ol></section>` : '';
  const mentions = `<section><details class="raw"><summary>Toutes les mentions (${sk.mentions.length})</summary><ol class="mentions">${sk.mentions.map((m) => `<li><span class="year">${m.y || '—'}</span> ${esc(m.b.text)} <span class="meta">— ${boatLink(root, m.d, m.y)} · ${ROLE_LABEL[roleOf(sk, m)]}</span></li>`).join('')}</ol></details></section>`;
  const series = [...new Set(sk.boats.map((b) => b.S.short))];
  const body = `${hero(`Skipper${series.length ? ' · ' + series.join(', ') : ''}`, sk.name, '', `
  <div class="stats">
    <div><b>${sk.boats.length}</b><span>bateau${sk.boats.length > 1 ? 'x' : ''}</span></div>
    <div><b>${sk.results.length}</b><span>classement${sk.results.length > 1 ? 's' : ''}</span></div>
    <div><b>${sk.wins.length}</b><span>victoire${sk.wins.length > 1 ? 's' : ''}</span></div>
    ${sk.years.length ? `<div><b>${yearsRange(sk.years)}</b><span>années citées</span></div>` : ''}
  </div>`, true)}
<div class="wrap">
  <nav class="crumbs"><a href="${root}">Accueil</a> › <a href="${root}skippers/">Skippers</a> › ${esc(sk.name)}</nav>
  ${frise}${boats}${palmares}${faits}${mentions}
  <p class="source-note">Fiche compilée à partir des fiches bateau de histoiredeshalfs.com importées à ce jour : elle s'enrichit à chaque import. Les mentions sont reprises telles quelles, avec leur bateau et leur année.</p>
</div>`;
  write(rel, layout({ rel, title: sk.name, description: `Carrière de ${sk.name} : bateaux, palmarès, faits marquants.`, body, nav: 'skippers/' }));
}

// ---------------------------------------------------------------- La Solitaire : de l'Aurore au Figaro 3
// Course de l'Aurore en 1970, Course du Figaro en 1980, monotype Bénéteau en 1990 : les éditions, les bateaux de chaque
// époque et tous les skippers qui l'ont courue. Classements 1970-1989 : page « Figaro.htm » de l'auteur ; depuis 1990 :
// les lignes « Solitaire du Figaro » des fiches bateau.
const SOLO_ERAS = [
  { from: 1970, to: 1979, title: 'Course de l’Aurore', boats: 'Voiliers de série, puis Half Tonners', S: 'half-tonners',
    text: 'Première édition en 1970, de Brest à Pornic par Laredo, avec 12 partants. On y court sur les voiliers de série de l’époque (Arpège, Scampi, Centurion, Super Arlequin…), souvent construits à la jauge Half Ton.' },
  { from: 1980, to: 1989, title: 'Course, puis Solitaire du Figaro', boats: 'Half Tonners', S: 'half-tonners',
    text: 'En 1980, la course prend le nom du Figaro (51 partants). Elle se court en Half Tonners jusqu’à l’arrivée du monotype.' },
  { from: 1990, to: 2002, title: 'Figaro Solo', boats: 'Figaro Bénéteau, dit « Solo »', S: 'figaro', cat: 'Figaro Solo',
    text: '1990 : première année du monotype Bénéteau Figaro, dessiné par le Groupe Finot ; des Half Tonners courent encore avec lui.' },
  { from: 2003, to: 2018, title: 'Figaro 2', boats: 'Figaro Bénéteau 2', S: 'figaro', cat: 'Figaro 2',
    text: 'Le Figaro 2 de Marc Lombard, à ballasts et double safran.' },
  { from: 2019, to: 9999, title: 'Figaro 3', boats: 'Figaro Bénéteau 3', S: 'figaro', cat: 'Figaro 3',
    text: 'Le Figaro 3 de VPLP, lancé en 2017, premier monotype équipé de foils.' },
];
const eraOf = (y) => SOLO_ERAS.find((e) => y >= e.from && y <= e.to);
// « Régate de Ligue La Solitaire », « La Solitaire du Der », « Solo Figaro Massif Marine », « Figaro Golfe », les épreuves
// qualificatives sont d'autres courses. « La Solitaire » seule : la vraie compte au moins quinze partants.
const isSolitaire = (r) => {
  const f = fold(r.race);
  if (/transat|championnat|duo|double|bretagne|\btour\b|grand prix|trophee|ag2r|course au large|mini|\bsolo\b|regate|ligue|\bder\b|golfe|qualif/.test(f) || /qualif|osiris/i.test(r.text || '')) return false;
  if (/aurore|solitaire.*figaro|course du figaro|^figaro$/.test(f)) return true;
  return /^(la )?solitaire$/.test(f) && (Number(String(r.rank).split('/')[1]) || 0) >= 15;
};
// Classement d'un prologue ou d'une étape (« Figaro: Prologue: 49e/52 ») : ce n'est pas le classement de la course.
const STAGE_RANK = /(?:prologue|postlogue|[ée]tape\s*\d*|\bleg\s*\d*)\s*:?\s*(?:\d{1,3}|dnf)(?:e|er)?\s*\//i;
function solitairePage() {
  const F = series.find((S) => S.slug === 'figaro');
  const H = series.find((S) => S.slug === 'half-tonners');
  if (!F) return;
  const rel = 'figaro/la-solitaire/index.html';
  const root = prefixFor(rel);
  // Éditions 1970-1989 de la page de l'auteur : parcours, partants, vainqueur, ancre du classement complet.
  const eds = new Map();
  const hp = H?.pages.find((p) => p.rel === 'Figaro.htm');
  const hsrc = hp && readSource(hp.rel);
  if (hsrc) parseResults(dropNav(toBlocks(hsrc.body, hp.rel), hp.title)).editions.forEach((ed, i) => {
    const y = Number(ed.year);
    if (y <= 1990 && !eds.has(y)) eds.set(y, { ed, anchor: `${H.slug}/${hp.slug}/#y${ed.year}-${i}` });
  });
  // Participations : un classement par skipper et par année (le meilleur, de préférence avec son bateau).
  const parts = new Map();
  for (const sk of SKIPPERS.values()) for (const r of sk.results) {
    if (!r.y || !isSolitaire(r) || STAGE_RANK.test(r.text || '')) continue;
    const n = parseInt(r.rank, 10) || 999;
    if (!parts.has(r.y)) parts.set(r.y, new Map());
    const cur = parts.get(r.y).get(sk);
    const e = { sk, y: r.y, rank: r.rank, n, d: r.d, boatName: r.boatName, boatHref: r.boatHref, co: r.co, r };
    if (!cur || n < cur.n || (n === cur.n && !cur.d && r.d)) parts.get(r.y).set(sk, e);
  }
  const years = [...new Set([...eds.keys(), ...parts.keys()])].filter((y) => y >= 1970).sort((a, b) => a - b);
  const boatCell = (e) => (e.d ? boatLink(root, e.d, e.y) : e.boatName ? (e.boatHref ? `<a href="${root}${e.boatHref}">${esc(e.boatName)}</a>` : esc(e.boatName)) : '');
  const plain = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const rows = years.map((y) => {
    const era = eraOf(y);
    const src = eds.get(y);
    const ps = [...(parts.get(y)?.values() || [])];
    // Vainqueur : le palmarès sourcé (content/solitaire.json), avec le bateau de l'archive ou de la source ; à défaut,
    // le 1er relevé dans l'archive, ou la 1re ligne du classement de l'auteur.
    const pal = SOLITAIRE.vainqueurs?.[y];
    const winners = ps.filter((e) => e.n === 1 && !e.co && (!pal || e.sk === pal.sk));
    if (process.env.AUDIT_SOLO) for (const e of ps.filter((x) => x.n === 1)) console.error(`VAINQUEUR\t${y}\t${e.sk.name}\t${pal?.skipper || ''}\t${e.r.race}\t${(e.r.text || e.r.href || '').slice(0, 160)}`);
    const first = src?.ed.results.find((x) => x.rank === '1');
    const palBoat = pal && (winners.map(boatCell).find(Boolean) || (pal.bateau ? esc(pal.bateau) : ''));
    const win = pal ? `<a href="${root}${pal.sk.url}">${esc(pal.sk.name)}</a>${palBoat ? ` <span class="meta">· ${palBoat}</span>` : ''}`
      : winners.length ? winners.map((e) => `<a href="${root}${e.sk.url}">${esc(e.sk.name)}</a>${boatCell(e) ? ` <span class="meta">· ${boatCell(e)}</span>` : ''}`).join('<br>')
      : first ? esc(plain(first.html).slice(0, 90)) : '';
    const info = src ? plain(src.ed.titleHtml).replace(/,?\s*reportages?.*$/i, '').slice(0, 110) : '';
    return `<tr id="y${y}" data-letter="${String(y).slice(0, 3)}" data-file="1" data-year="${y}"><td data-v="${y}">${y}</td><td>${esc(era?.title || '')}</td><td>${esc(info)}</td><td>${win}</td><td data-v="${ps.length}">${ps.length || ''}</td><td>${src ? `<a href="${root}${src.anchor}">classement</a>` : ''}</td></tr>`;
  }).join('\n');
  // Skippers : participations, meilleur classement, bateaux.
  const bySk = new Map();
  for (const m of parts.values()) for (const e of m.values()) {
    if (!bySk.has(e.sk)) bySk.set(e.sk, []);
    bySk.get(e.sk).push(e);
  }
  const skRows = [...bySk].sort((a, b) => b[1].length - a[1].length || Math.min(...a[1].map((e) => e.n)) - Math.min(...b[1].map((e) => e.n))).map(([sk, es]) => {
    es.sort((a, b) => a.y - b.y);
    const best = es.reduce((a, b) => (b.n < a.n ? b : a));
    const boats = [...new Map(es.filter((e) => e.d || e.boatName).map((e) => [e.d ? e.d.url : e.boatName, e])).values()];
    const letter = (sk.lastSort.replace(/^(le|la|de|du|des|van|von|di|da|den)\s+/, '')[0] || '#').toUpperCase();
    return `<tr data-letter="${/[A-Z]/.test(letter) ? letter : '#'}" data-file="1" data-year="${es[0].y}"><td><a href="${root}${sk.url}">${esc(sk.name)}</a></td><td data-v="${es.length}">${es.length}</td><td data-v="${es[0].y}">${yearsRange(es.map((e) => e.y))}</td><td data-v="${best.n}">${esc(best.rank)} <span class="meta">(${best.y})</span></td><td>${boats.slice(0, 4).map(boatCell).join(', ')}${boats.length > 4 ? ` <span class="meta">+${boats.length - 4}</span>` : ''}</td></tr>`;
  }).join('\n');
  // Époques : nombre d'éditions et de skippers suivis, bateaux avec fiche.
  const eras = SOLO_ERAS.map((era) => {
    const ys = years.filter((y) => y >= era.from && y <= era.to);
    const es = ys.flatMap((y) => [...(parts.get(y)?.values() || [])]);
    const boats = new Map();
    for (const e of es) if (e.d) { if (!boats.has(e.d)) boats.set(e.d, new Set()); boats.get(e.d).add(e.y); }
    const list = [...boats].sort((a, b) => b[1].size - a[1].size || fold(a[0].facts.title).localeCompare(fold(b[0].facts.title)));
    const S = series.find((x) => x.slug === era.S);
    const href = S ? `${root}${S.slug}/bateaux/${era.cat ? `?cat=${encodeURIComponent(era.cat)}` : ''}` : '';
    return `<div class="card"><span class="count">${era.from}${era.to < 9999 ? ` – ${era.to}` : ' →'}</span><b>${esc(era.title)}</b><span class="meta">${esc(era.boats)}</span><p>${esc(era.text)}</p>
      <span class="meta">${ys.length} édition${ys.length > 1 ? 's' : ''} · ${new Set(es.map((e) => e.sk)).size} skippers suivis${href ? ` · <a href="${href}">les bateaux</a>` : ''}</span>
      ${list.length ? `<details><summary>${list.length} bateau${list.length > 1 ? 'x' : ''} avec fiche</summary><p>${list.map(([d, ys2]) => `<a href="${root}${d.url}">${esc(d.facts.title)}</a> <span class="meta">(${yearsRange([...ys2])})</span>`).join(', ')}</p></details>` : ''}</div>`;
  }).join('');
  const body = `${hero('Course au large en solitaire', 'La Solitaire, de l’Aurore au Figaro 3', 'Depuis 1970, la course en solitaire et par étapes où ont appris la plupart des grands skippers : la Course de l’Aurore, devenue Solitaire du Figaro, courue sur des voiliers de série, puis en Half Tonners, puis sur les trois générations de Figaro Bénéteau.', `
  <div class="stats"><div><b>${years.length}</b><span>éditions</span></div><div><b>${num(bySk.size)}</b><span>skippers suivis</span></div><div><b>1970</b><span>Course de l’Aurore</span></div><div><b>1990</b><span>premier Figaro Bénéteau</span></div></div>`)}
${subnav(F, root, 'figaro/la-solitaire/')}
<section><div class="wrap"><div class="section-head"><h2>Cinq époques, cinq générations de bateaux</h2></div><div class="grid">${eras}</div></div></section>
<section><div class="wrap"><div class="section-head"><h2>Les éditions</h2><p>Classements complets de 1970 à 1989 d’après la page de l’auteur ; depuis 1990, d’après les fiches bateau. Vainqueurs : palmarès officiel (sources en bas de page).</p></div>
  <div class="table-wrap"><table class="boats"><thead><tr><th data-sort="num" aria-sort="none">Année<span class="arrow" aria-hidden="true"></span></th><th>Époque</th><th>Parcours et partants</th><th>Vainqueur</th><th data-sort="num" aria-sort="none">Skippers suivis<span class="arrow" aria-hidden="true"></span></th><th></th></tr></thead><tbody>
${rows}
  </tbody></table></div></div></section>
<section id="liste"><div class="wrap"><div class="section-head"><h2>Les skippers de la Solitaire</h2><p>Tous les skippers dont une participation est connue de l’archive, du plus fidèle au plus discret.</p></div>
  <div class="toolbar"><input id="filter" type="search" placeholder="Filtrer par skipper, bateau…" aria-label="Filtrer la liste"><span class="result-count"></span></div>
  <div class="table-wrap" data-boat-list><table class="boats"><thead><tr><th data-sort="txt" aria-sort="none">Skipper<span class="arrow" aria-hidden="true"></span></th><th data-sort="num" aria-sort="none">Participations<span class="arrow" aria-hidden="true"></span></th><th data-sort="num" aria-sort="none">Années<span class="arrow" aria-hidden="true"></span></th><th data-sort="num" aria-sort="none">Meilleur classement<span class="arrow" aria-hidden="true"></span></th><th>Bateaux</th></tr></thead><tbody>
${skRows}
  </tbody></table></div>
  <p class="source-note">Les classements viennent de l’archive histoiredeshalfs.com : la page « Courses en solitaire de l’Aurore, puis Figaro » pour 1970-1989, les fiches bateau ensuite. Les participations sont celles que l’archive relève : elles sont incomplètes pour les éditions récentes, dont toutes les fiches ne sont pas encore importées. Palmarès des vainqueurs : ${Object.values(SOLITAIRE.sources || {}).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(', ')}.</p>
</div></section>`;
  write(rel, layout({ rel, title: 'La Solitaire, de l’Aurore au Figaro 3', description: 'Course de l’Aurore puis Solitaire du Figaro : éditions, bateaux et skippers depuis 1970.', body, nav: navFor(F) }));
}

// ---------------------------------------------------------------- Classement des marins et des bateaux
// Barème et niveaux des courses validés par le propriétaire (docs/decisions.md). Le calcul est fait par
// outils/classement/calculer.py ; la page reçoit un résultat par ligne et fait les totaux selon les choix du lecteur.
function classementPage() {
  const repo = path.resolve('..');
  const run = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['outils/classement/calculer.py', '--sans-rapport'],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const src = path.join(repo, 'sorties/classement/site.json');
  if (run.status !== 0 || !fs.existsSync(src)) {
    console.warn(`Classement non calculé (page non écrite) : ${(run.stderr || run.error || '').toString().slice(0, 300)}`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  // Nom d'un bateau : le titre de sa fiche (nom de baptême), sinon le nom porté lors du premier résultat.
  const titles = new Map(series.flatMap((S) => S.boats.filter((b) => b.doc?.url && b.doc.facts).map((b) => [b.doc.url, b.doc.facts.title])));
  // Homonymes (deux « Foncia ») : l'année de construction les distingue.
  const built = new Map(series.flatMap((S) => S.boats.filter((b) => b.doc?.url).map((b) => [b.doc.url, b.doc.facts?.built || b.year || ''])));
  data.bateaux = data.bateaux.map(([u, n]) => [u, titles.get(u) || n]);
  const count = new Map();
  for (const [, n] of data.bateaux) count.set(fold(n), (count.get(fold(n)) || 0) + 1);
  data.bateaux = data.bateaux.map(([u, n]) => [u, count.get(fold(n)) > 1 && built.get(u) ? `${n} (${String(built.get(u)).slice(0, 4)})` : n]);
  write('data/classement.json', JSON.stringify(data));
  const rel = 'classement/index.html';
  const root = prefixFor(rel);
  const ref = data.reference;
  const years = Array.from({ length: ref - data.debut + 1 }, (_, i) => ref - i);
  const body = `${hero('Classement', 'Classement des marins et des bateaux', `Tous les résultats des fiches du site, notés selon le niveau de la course, la place, le nombre de partants et le rôle à bord. Choisissez une classe, une année de référence et une période.`, '', true)}
<section id="classement"><div class="wrap">
  <div class="toolbar classement-toolbar" data-classement="${root}data/classement.json">
    <div class="seg" role="group" aria-label="Classement des"><button type="button" data-mode="marins" aria-pressed="true">Marins</button><button type="button" data-mode="bateaux" aria-pressed="false">Bateaux</button></div>
    <select id="cl-classe" aria-label="Classe"><option value="">Toutes classes</option>${data.ordre_classes.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
    <select id="cl-periode" aria-label="Période"><option value="all">Depuis ${data.debut}</option><option value="20">20 ans</option><option value="10" selected>10 ans</option><option value="1">Année</option><option value="libre">Période libre</option></select>
    <label id="cl-ref-wrap">Année de référence <select id="cl-ref">${years.map((y) => `<option${y === ref ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <span id="cl-libre-wrap" hidden><label>De <select id="cl-de">${years.map((y) => `<option${y === data.debut ? ' selected' : ''}>${y}</option>`).join('')}</select></label> <label>à <select id="cl-a">${years.map((y) => `<option${y === ref ? ' selected' : ''}>${y}</option>`).join('')}</select></label></span>
    <input id="cl-filtre" type="search" placeholder="Chercher un nom…" aria-label="Chercher un nom dans le classement">
  </div>
  <p class="meta" id="cl-titre" aria-live="polite"></p>
  <div class="table-wrap"><table class="boats classement-list"><thead><tr><th>Rang</th><th id="cl-col-nom">Marin</th><th id="cl-col-classe">Classes</th><th>Points</th><th>Courses</th><th>Victoires</th></tr></thead>
  <tbody id="cl-corps"><tr><td colspan="6">Chargement du classement…</td></tr></tbody></table></div>
  <p><button type="button" id="cl-plus" class="more" hidden>Afficher les 100 suivants</button></p>
  <section class="cl-bareme"><h2>Comment les points sont calculés</h2>
    <ul>
      <li><b>Niveau de la course</b> : 1, les monuments (Vendée Globe, Route du Rhum, The Ocean Race…), 300 points au vainqueur ; 2, les grandes courses (Transat Jacques Vabre, Solitaire du Figaro, Mini Transat…), 150 points ; 3, les régates historiques (Fastnet, Sydney-Hobart…), 50 points ; 4, les courses de championnat de chaque classe, 25 points.</li>
      <li><b>Place</b> : le vainqueur prend tous les points de la course, les suivants une part qui décroît avec le rang.</li>
      <li><b>Nombre de partants</b> (sauf niveau 1) : de 100 % à partir de 20 bateaux à 40 % sous 5 bateaux.</li>
      <li><b>Rôle à bord</b> : skipper 100 %, co-skipper ou équipier 67 %. Une victoire d'étape rapporte 10 points.</li>
      <li>Une même course n’est comptée qu’une fois par marin et par an ; chaque épreuve d’un championnat compte. Les courses sans niveau ne rapportent pas de points.</li>
    </ul>
    <p class="source-note">Ajout de la rédaction : classement calculé à partir des palmarès des fiches du site (sources : histoiredeshalfs.com et les sites officiels des courses et des classes). Il évolue à chaque enrichissement des fiches.</p>
  </section>
</div></section>
<script src="${root}assets/classement.js" defer></script>`;
  write(rel, layout({ rel, title: 'Classement', description: 'Classement des marins et des bateaux de la course au large, par classe et par période.', body, nav: 'classement/' }));
}

function skippersIndex() {
  const rel = 'skippers/index.html';
  const root = prefixFor(rel);
  const list = [...SKIPPERS.values()].sort((a, b) => a.lastSort.localeCompare(b.lastSort, 'fr'));
  const rows = list.map((sk) => {
    const letter = (sk.lastSort.replace(/^(le|la|de|du|des|van|von|di|da|den)\s+/, '')[0] || '#').toUpperCase();
    const y = sk.years.length ? Math.min(...sk.years) : '';
    return `<tr data-letter="${/[A-Z]/.test(letter) ? letter : '#'}" data-file="1" data-year="${y}"><td><a href="${root}${sk.url}">${esc(sk.name)}</a></td>
      <td>${esc(sk.boats.slice(0, 3).map((b) => b.d.facts.title).join(', '))}${sk.boats.length > 3 ? ` <span class="meta">+${sk.boats.length - 3}</span>` : ''}</td>
      <td>${[...new Set(sk.boats.map((b) => b.S.short))].map((s) => `<span class="pill">${esc(s)}</span>`).join(' ')}</td>
      <td data-v="${sk.wins.length}">${sk.wins.length || ''}</td><td data-v="${y}">${yearsRange(sk.years)}</td></tr>`;
  }).join('\n');
  const body = `${hero('Index', 'Skippers', 'Les skippers cités dans les fiches bateau : leurs bateaux, leur palmarès et les faits marquants de leur carrière.', `
  <div class="stats"><div><b>${num(list.length)}</b><span>skippers</span></div></div>`, true)}
<section id="liste"><div class="wrap">
  <div class="toolbar">
    <input id="filter" type="search" placeholder="Filtrer par skipper, bateau, série…" aria-label="Filtrer la liste">
    <select id="sort" aria-label="Trier par"><option value="">Ordre alphabétique (nom)</option><option value="3:desc">Victoires : décroissant</option><option value="4:asc">Années : croissant</option><option value="4:desc">Années : décroissant</option></select>
    <span class="result-count" data-unit="skipper"></span>
  </div>
  <div class="alpha" role="group" aria-label="Initiale du nom">${letters.map((l) => `<button type="button" data-l="${l}" aria-pressed="false">${l}</button>`).join('')}</div>
  <div class="table-wrap" data-boat-list><table class="boats skippers-list"><thead><tr><th data-sort="txt" aria-sort="none">Skipper<span class="arrow"></span></th><th data-sort="txt" aria-sort="none">Bateaux<span class="arrow"></span></th><th data-sort="txt" aria-sort="none">Séries<span class="arrow"></span></th><th data-sort="num" aria-sort="none">Victoires<span class="arrow"></span></th><th data-sort="num" aria-sort="none">Années<span class="arrow"></span></th></tr></thead>
  <tbody>
${rows}
  </tbody></table></div>
  <p class="source-note">Index compilé à partir des fiches bateau importées à ce jour (${series.reduce((n, S) => n + S.built.length, 0)} fiches) : il s'enrichit à chaque import.</p>
</div></section>`;
  write(rel, layout({ rel, title: 'Skippers', description: 'Index des skippers de la course au large.', body, nav: 'skippers/' }));
}

// ---------------------------------------------------------------- Calendrier des courses
// content/calendrier/*.json : courses de la saison, vérifiées sur leurs sites officiels (voir les sources de chaque course).
// Le statut est recalculé d'après les dates au moment de la génération ; « annulée » et « reportée » sont conservés.
const TODAY = new Date().toISOString().slice(0, 10);
const CAL_DIR = path.resolve('content/calendrier');
const RACES_RAW = (fs.existsSync(CAL_DIR) ? fs.readdirSync(CAL_DIR).filter((f) => f.endsWith('.json')) : [])
  .flatMap((f) => { try { return JSON.parse(fs.readFileSync(path.join(CAL_DIR, f), 'utf8')); } catch (e) { console.warn(`Calendrier illisible : ${f} (${e.message})`); return []; } })
  .map((r) => {
    let statut = r.statut;
    if (!/annul|report/i.test(statut || '') && r.debut) {
      if (TODAY < r.debut) statut = 'à venir';
      else if (r.fin) statut = TODAY > r.fin ? 'terminée' : 'en cours';
      // Sans date d'arrivée connue (course au large en cours, ou épreuve d'un jour), on garde le statut vérifié par la
      // recherche ; « à venir » devenu faux une fois la date passée devient « en cours ».
      else statut = statut === 'terminée' ? 'terminée' : 'en cours';
    }
    return { ...r, statut: statut || 'à venir' };
  });
// Une même course peut figurer dans plusieurs fichiers (Route du Rhum : IMOCA, Ultim, Class 40…) : on la fusionne
// (même nom, même mois de départ ou même édition), en réunissant classes et sources.
const raceKey = (r) => `${fold(r.course).replace(/^(la|le|the)\s+/, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/[^a-z0-9]/g, '')}|${r.debut ? r.debut.slice(0, 7) : r.edition}`;
const RACES = [];
for (const r of RACES_RAW) {
  const twin = RACES.find((x) => raceKey(x) === raceKey(r));
  if (!twin) { RACES.push({ ...r, classes: [...(r.classes || [])], sources: [...(r.sources || [])] }); continue; }
  twin.classes = [...new Set([...twin.classes, ...(r.classes || [])])];
  twin.sources = [...new Set([...twin.sources, ...(r.sources || [])])];
  for (const k of ['fin', 'depart', 'arrivee', 'format', 'url', 'vainqueurs']) if (!twin[k] && r[k]) twin[k] = r[k];
  if (r.vainqueurs && twin.vainqueurs && r.vainqueurs !== twin.vainqueurs && !twin.vainqueurs.includes(r.vainqueurs)) twin.vainqueurs += ` ; ${r.vainqueurs}`;
  if (r.note && r.note !== twin.note) twin.note = [twin.note, r.note].filter(Boolean).join(' ');
}
RACES.sort((a, b) => (a.debut || '9999').localeCompare(b.debut || '9999'));
// Classe du calendrier -> rubrique du site.
const CLASS_SERIES = { IMOCA: 'imoca', Ultim: 'ultim', 'Ocean Fifty': 'ocean-fifty', 'Class 40': 'class-40', 'Mini 6.50': 'minis', 'Half Tonners': 'half-tonners', 'MOD 70': 'mod-70', Figaro: 'figaro' };
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmtDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d === 1 ? '1er' : d} ${MONTHS_SHORT[m - 1]} ${y}`; };
const fmtDates = (r) => (r.debut ? (r.fin && r.fin !== r.debut ? `${fmtDay(r.debut)} → ${fmtDay(r.fin)}` : fmtDay(r.debut)) : 'date à confirmer');
const STATUS_CLASS = { 'en cours': 'live', 'à venir': 'next', terminée: 'done', annulée: 'off', reportée: 'off' };
// Un calendrier, pas un roman : les vues ne montrent que les dates, le nom court et la classe (couleur) ; le reste
// (parcours, format, vainqueurs, historique) est sur la fiche de chaque course.
const HISTOIRE = readJson(path.resolve('content/courses-histoire.json'));
const CLASS_COLOR = { IMOCA: 'imoca', Ultim: 'ultim', 'Ocean Fifty': 'o50', 'MOD 70': 'mod', 'Class 40': 'c40', 'Mini 6.50': 'mini', Figaro: 'figaro', 'Half Tonners': 'half' };
const colorOf = (r) => CLASS_COLOR[(r.classes || []).find((c) => CLASS_COLOR[c])] || 'other';
// Nom court : sans le partenaire ni le sous-titre (« Route du Rhum – Destination Guadeloupe » -> « Route du Rhum »).
const shortRace = (name) => name.replace(/\s+[–—]\s+.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
for (const r of RACES) {
  let s = `${slugify(r.course).slice(0, 60).replace(/-+$/, '')}${r.debut ? `-${r.debut.slice(0, 4)}` : ''}`;
  while (RACES.some((x) => x !== r && x.slug === s)) s += '-2';
  r.slug = s;
  r.page = `calendrier/${s}/`;
}
const classAttr = (r) => `data-classes="${esc((r.classes || []).join('|'))}"`;
// « 12–19 », « 28 → 3 déc. », « 12 » (date de départ seule).
const dayRange = (r) => {
  const [, m1, d1] = r.debut.split('-').map(Number);
  if (!r.fin || r.fin === r.debut) return `${d1 === 1 ? '1er' : d1}`;
  const [y2, m2, d2] = r.fin.split('-').map(Number);
  return m2 === m1 && y2 === Number(r.debut.slice(0, 4)) ? `${d1}–${d2}` : `${d1} → ${d2} ${MONTHS_SHORT[m2 - 1]}${y2 !== Number(r.debut.slice(0, 4)) ? ` ${y2}` : ''}`;
};
// Planning annuel : une colonne par mois, une barre par course, rangées en lignes sans chevauchement (nom compris).
const PLANNER_PX = 1180;
function planner(list, Y, root) {
  const start = Date.UTC(Y, 0, 1), days = (Date.UTC(Y + 1, 0, 1) - start) / 864e5;
  const dayOf = (iso) => (Date.parse(`${iso}T00:00:00Z`) - start) / 864e5;
  const pxPerDay = PLANNER_PX / days;
  // Étiquette : nom court, coupé à 24 caractères ; largeur estimée large (Inter 600 à 0,78 rem) pour ne jamais chevaucher.
  const labelPx = (t) => t.length * 7.4 + 16;
  const cut = (t) => (t.length > 24 ? `${t.slice(0, 23).trim()}…` : t);
  const items = list.filter((r) => r.debut && r.debut < `${Y + 1}-01-01` && (r.fin || r.debut) >= `${Y}-01-01`).map((r) => {
    const s = Math.max(0, dayOf(r.debut));
    // Arrivée inconnue (course au large en cours de programme) : une barre ouverte d'une semaine.
    const e = Math.min(days, r.fin ? dayOf(r.fin) + 1 : dayOf(r.debut) + 7);
    const label = cut(shortRace(r.course));
    const narrow = (e - s) * pxPerDay < labelPx(label);
    return { r, s, e, label, narrow, extent: narrow ? e + labelPx(label) / pxPerDay : e };
  }).sort((a, b) => a.s - b.s || b.e - a.e);
  if (!items.length) return '';
  const lanes = [];
  for (const it of items) {
    let k = lanes.findIndex((end) => end <= it.s);
    if (k < 0) { k = lanes.length; lanes.push(0); }
    lanes[k] = it.extent + 1.5;
    it.lane = k;
  }
  const pct = (d) => `${(d / days * 100).toFixed(3)}%`;
  const months = Array.from({ length: 12 }, (_, m) => dayOf(`${Y}-${String(m + 1).padStart(2, '0')}-01`));
  const today = TODAY.startsWith(String(Y)) ? dayOf(TODAY) : null;
  return `<div class="planner" style="--lanes:${lanes.length}">
  <div class="planner-head">${months.map((d, m) => `<span style="left:${pct(d)};width:${pct((months[m + 1] ?? days) - d)}">${MONTHS_SHORT[m]}</span>`).join('')}</div>
  <div class="planner-body">${months.slice(1).map((d) => `<i class="planner-sep" style="left:${pct(d)}"></i>`).join('')}${today !== null ? `<i class="planner-today" style="left:${pct(today)}" title="Aujourd’hui, ${esc(fmtDay(TODAY))}"></i>` : ''}
${items.map((it) => `<a class="bar c-${colorOf(it.r)} ${STATUS_CLASS[it.r.statut] || ''}${it.r.fin ? '' : ' open'}${it.narrow ? ' narrow' : ''}" href="${root}${it.r.page}" style="left:${pct(it.s)};width:${pct(it.e - it.s)};--lane:${it.lane}" ${classAttr(it.r)} title="${esc(`${it.r.course} · ${fmtDates(it.r)}`)}"><span>${esc(it.label)}</span></a>`).join('\n')}
  </div>
</div>`;
}
// Mois par mois : une carte par mois, une ligne par course (dates, nom court, pastilles de classe).
const agendaItem = (r, root) => `<li ${classAttr(r)}><a class="ag-item ${STATUS_CLASS[r.statut] || ''}" href="${root}${r.page}"><span class="ag-date">${r.debut ? dayRange(r) : '?'}</span><span class="ag-name">${esc(shortRace(r.course))}</span><span class="ag-dots">${(r.classes || []).map((c) => `<i class="dot c-${CLASS_COLOR[c] || 'other'}" title="${esc(c)}"></i>`).join('')}</span></a></li>`;
// Légende des pastilles : une couleur par classe, pour les classes présentes dans la liste.
const classLegend = (list) => {
  // Les classes sans couleur propre partagent la pastille grise : une seule entrée « Autres ».
  const all = [...new Set(list.flatMap((r) => r.classes || []))];
  const cs = all.filter((c) => CLASS_COLOR[c]);
  const others = all.filter((c) => !CLASS_COLOR[c]);
  return all.length ? `<p class="cal-legend" aria-label="Légende des classes">${cs.map((c) => `<span><i class="dot c-${CLASS_COLOR[c]}"></i>${esc(c)}</span>`).join('')}${others.length ? `<span title="${esc(others.join(', '))}"><i class="dot c-other"></i>Autres</span>` : ''}</p>` : '';
};
function agenda(list, root) {
  const byMonth = new Map();
  for (const r of list.filter((x) => x.debut)) {
    const k = r.debut.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(r);
  }
  return `<div class="agenda">${[...byMonth].sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => {
    const [y, m] = k.split('-').map(Number);
    return `<div class="ag-month${k === TODAY.slice(0, 7) ? ' now' : ''}"><h3>${cap(MONTHS[m - 1])} <span>${y}</span></h3><ul>${rs.map((r) => agendaItem(r, root)).join('')}</ul></div>`;
  }).join('')}</div>`;
}
// Vues « Année » (planning) et « Mois » ; légende des couleurs ; filtre par classe.
function calendarViews(list, root, { filter = true } = {}) {
  const years = [...new Set(list.filter((r) => r.debut).flatMap((r) => [Number(r.debut.slice(0, 4)), Number((r.fin || r.debut).slice(0, 4))]))]
    .filter((y) => y >= Number(TODAY.slice(0, 4)) - 0).sort();
  const classes = [...new Set(list.flatMap((r) => r.classes || []))];
  const tbd = list.filter((r) => !r.debut);
  return `<div class="wrap">
  <div class="cal-tools">
    <div class="view-toggle" role="group" aria-label="Affichage"><button type="button" data-view="annee">Année</button><button type="button" data-view="mois">Mois</button></div>
    ${filter && classes.length > 1 ? `<div class="cal-filter" role="group" aria-label="Classe"><button type="button" data-c="" aria-pressed="true">Toutes</button>${classes.map((c) => `<button type="button" data-c="${esc(c)}" aria-pressed="false"><i class="dot c-${CLASS_COLOR[c] || 'other'}"></i>${esc(c)}</button>`).join('')}</div>` : ''}
  </div>
  <div class="cal-views">
    <div class="planner-view">${years.map((y) => `<h2 class="cal-year">${y}</h2>${planner(list, y, root)}`).join('')}</div>
    <div class="agenda-view">${agenda(list.filter((r) => !r.fin || r.fin >= `${years[0] || TODAY.slice(0, 4)}-01-01`), root)}</div>
  </div>
  ${tbd.length ? `<p class="cal-tbd"><b>Dates à confirmer :</b> ${tbd.map((r) => `<a href="${root}${r.page}" ${classAttr(r)}>${esc(shortRace(r.course))}</a>`).join(' · ')}</p>` : ''}
</div>`;
}
function calendarPage() {
  const rel = 'calendrier/index.html';
  const root = prefixFor(rel);
  const body = `${hero('Saison ' + TODAY.slice(0, 4), 'Calendrier des courses', 'Les courses au large dans le monde entier. Une course, une fiche : cliquez sur son nom.', '', true)}
${RACES.length ? calendarViews(RACES, root) : '<section><div class="wrap"><div class="notice">Le calendrier est en cours de préparation.</div></div></section>'}
<div class="wrap"><p class="source-note">D'après les sites officiels des courses et des classes, vérifié le ${esc(fmtDay(TODAY))}. Une date peut changer : le site officiel de chaque course fait foi.</p></div>`;
  write(rel, layout({ rel, title: 'Calendrier des courses', description: 'Calendrier mondial des courses au large, par classe.', body, nav: 'calendrier/' }));
  for (const r of RACES) racePage(r);
}
// Fiche d'une course : l'essentiel en tête, puis l'historique et le palmarès des éditions précédentes (Wikipédia).
function racePage(r) {
  const rel = `${r.page}index.html`;
  const root = prefixFor(rel);
  const h = HISTOIRE[r.course];
  const pills = (r.classes || []).map((c) => {
    const s = CLASS_SERIES[c];
    const inner = `<i class="dot c-${CLASS_COLOR[c] || 'other'}"></i>${esc(c)}`;
    return s && publishedSlugs.has(s) ? `<a class="pill" href="${root}${s}/calendrier/">${inner}</a>` : `<span class="pill">${inner}</span>`;
  }).join(' ');
  const solitaire = /figaro/i.test(r.course) && /solitaire/i.test(r.course);
  // Un vainqueur est un skipper (ou un duo), parfois une équipe (Admiral's Cup).
  const editions = (h?.editions || []).flatMap((e) => (e.vainqueurs || []).map((v, i) => `<tr${i ? '' : ' class="ed-first"'}><td>${i ? '' : e.annee}</td><td>${esc(v.classe || '')}</td><td>${esc(v.skipper || v.equipe || '')}</td><td>${esc(v.bateau || '')}</td></tr>`)).join('');
  const body = `<div class="wrap race-page">
  <nav class="crumbs"><a href="${root}">Accueil</a> › <a href="${root}calendrier/">Calendrier</a> › ${esc(shortRace(r.course))}</nav>
  <header class="race-head c-${colorOf(r)}">
    <span class="race-status ${STATUS_CLASS[r.statut] || ''}">${esc(r.statut)}</span>
    <h1>${esc(r.course)}</h1>
    <p class="race-dates">${esc(fmtDates(r))}${r.depart || r.arrivee ? ` · ${esc([r.depart, r.arrivee].filter(Boolean).join(' → '))}` : ''}</p>
    <div class="race-pills">${pills}</div>
  </header>
  <dl class="race-facts">
    ${r.format ? `<dt>Format</dt><dd>${esc(r.format)}</dd>` : ''}
    ${r.edition && !/^\d{4}/.test(String(r.edition)) ? `<dt>Édition</dt><dd>${esc(String(r.edition))}</dd>` : ''}
    ${r.vainqueurs ? `<dt>Vainqueurs</dt><dd>${esc(r.vainqueurs)}</dd>` : ''}
    ${r.url ? `<dt>Site officiel</dt><dd><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd>` : ''}
  </dl>
  ${/annul|report/.test(r.statut) && r.note ? `<p class="race-note">${esc(r.note.split(/(?<=\.)\s/)[0])}</p>` : ''}
  ${solitaire ? `<p class="race-note"><a href="${root}figaro/la-solitaire/">La Solitaire de 1970 à aujourd’hui : éditions, bateaux et skippers →</a></p>` : ''}
  ${h ? `<section class="race-history"><h2>Histoire${h.creation ? ` <span class="meta">depuis ${esc(String(h.creation))}</span>` : ''}</h2>
    ${h.resume ? `<p>${esc(h.resume)}</p>` : ''}
    ${editions ? `<div class="table-wrap"><table class="boats"><thead><tr><th>Édition</th><th>Classe</th><th>Vainqueur</th><th>Bateau</th></tr></thead><tbody>${editions}</tbody></table></div>` : ''}
    <p class="source-note">D'après Wikipédia : ${(h.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}${s.langue && s.langue !== 'fr' ? ` (${esc(s.langue)})` : ''}</a>`).join(', ')} — licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</p>
  </section>` : ''}
  ${r.sources?.length ? `<p class="source-note">Dates et parcours : ${r.sources.slice(0, 4).map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">source ${i + 1}</a>`).join(' · ')}, vérifiés le ${esc(fmtDay(TODAY))}.</p>` : ''}
</div>`;
  write(rel, layout({ rel, title: shortRace(r.course), description: `${r.course} : dates, parcours, classes et historique.`, body, nav: 'calendrier/' }));
}
// Courses d'une rubrique (rubrique « Calendrier » des catégories).
const racesFor = (S) => RACES.filter((r) => (r.classes || []).some((c) => CLASS_SERIES[c] === S.slug));
// Onglet « Calendrier » d'une classe : toute la saison (courues, en cours, à venir), comme le calendrier général.
const upcomingFor = (S) => racesFor(S);
function seriesCalendarPage(S) {
  const list = racesFor(S);
  if (!list.length) return;
  const rel = `${S.slug}/calendrier/index.html`;
  const root = prefixFor(rel);
  const body = `${hero(S.title, `Calendrier ${S.title}`, `La saison des ${S.title}, dans le monde entier.`, '', true)}
${subnav(S, root, `${S.slug}/calendrier/`)}
${calendarViews(list, root, { filter: false })}
<div class="wrap"><p class="source-note">D'après les sites officiels des courses et des classes, vérifié le ${esc(fmtDay(TODAY))}. <a href="${root}calendrier/">Calendrier de toutes les classes →</a></p></div>`;
  write(rel, layout({ rel, title: `Calendrier — ${S.title}`, body, nav: navFor(S) }));
}

// ---------------------------------------------------------------- Catalogue des séries
const familyGrid = (f, root) => `<div class="family" id="${f.id}"><h3>${esc(f.family)}</h3><div class="grid">${f.items.map(([label, src, local]) => {
  const S = local && bySlug.get(local);
  return S
    ? `<a class="card live" href="${root}${S.slug}/"><b>${esc(label)}</b><span class="meta">${S.boats.length ? `${num(S.boats.length)} bateaux` : 'Liste en cours d’import'}</span></a>`
    : `<a class="card pending" href="${esc(originUrl(src))}" target="_blank" rel="noopener"><b>${esc(label)}</b><span class="meta">Archive d'origine ↗ · refonte à venir</span></a>`;
}).join('')}</div></div>`;
function seriesGrid(root) {
  return CATALOG.map((f) => familyGrid(f, root)).join('');
}
// Monocoques historiques : les classes qui ne figurent pas dans le menu (Half Tonners, IOR, Muscadet, TP 52…).
function historicMonohullsPage() {
  const rel = 'monocoques-historiques/index.html';
  const root = prefixFor(rel);
  const f = CATALOG.find((x) => x.id === 'monocoques-historiques');
  if (!f) return;
  const body = `${hero('Monocoques', 'Monocoques historiques', 'Les jauges et les séries qui ont écrit l’histoire de la course au large : Half, Quarter et Three Quarter Tonners de la jauge IOR, Muscadet, 50 pieds, TP 52, maxis…', '', true)}
<section><div class="wrap">${familyGrid({ ...f, family: 'Classes' }, root)}</div></section>`;
  write(rel, layout({ rel, title: 'Monocoques historiques', body, nav: 'famille:monocoques' }));
}
function seriesPage() {
  const rel = 'series/index.html';
  const body = `${hero('Catalogue', 'Toutes les séries', 'Des Mini 6.50 aux maxis multicoques : chaque série a son histoire, ses listes et ses dossiers bateau par bateau.')}
<section><div class="wrap">${seriesGrid(prefixFor(rel))}</div></section>`;
  write(rel, layout({ rel, title: 'Séries', body, nav: 'series' }));
}

// ---------------------------------------------------------------- Actualités
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const news = [];
for (let y = 26; y >= 20; y--) for (let m = 12; m >= 1; m--) {
  const relSrc = `PI ${y} ${String(m).padStart(2, '0')}.htm`;
  const src = readSource(relSrc);
  if (src) news.push({ relSrc, src, label: `${MONTHS[m - 1]} 20${y}`, slug: `20${y}-${String(m).padStart(2, '0')}` });
}
for (const n of news) PAGE_MAP.set(n.relSrc, `actualites/${n.slug}/`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function newsPages() {
  for (const n of news) {
    const rel = `actualites/${n.slug}/index.html`;
    const root = prefixFor(rel);
    const blocks = dropNav(toBlocks(n.src.body, n.relSrc, linkerFor(rel)));
    n.cover = blocks.find((b) => b.type === 'img');
    n.summary = blocks.find((b) => b.type === 'p' && b.text.length > 40)?.text || '';
    const body = `<div class="wrap"><nav class="crumbs"><a href="${root}">Accueil</a> › <a href="${root}actualites/">Actualités</a> › ${esc(n.label)}</nav>
<div class="eyebrow" style="margin-top:24px">Dernières infos</div><h1>${esc(cap(n.label))}</h1>
<div class="prose">${renderBlocks(blocks, '')}</div>
${sourceNote(n.relSrc)}</div>`;
    write(rel, layout({ rel, title: `Actualités — ${n.label}`, body, nav: 'actualites/' }));
  }
  const rel = 'actualites/index.html';
  const root = prefixFor(rel);
  const body = `${hero('Mises à jour mensuelles', 'Actualités', 'Chaque mois, de nouvelles photos, de nouveaux propriétaires et des bateaux retrouvés.')}
<section><div class="wrap"><div class="grid">${news.map((n) => newsCard(n, root)).join('')}</div></div></section>`;
  write(rel, layout({ rel, title: 'Actualités', body, nav: 'actualites/' }));
}
const newsCard = (n, root) => `<a class="card" href="${root}actualites/${n.slug}/">${n.cover ? `<img src="${esc(photoUrl(n.cover.src))}" alt="" loading="lazy" class="card-img">` : ''}<b>${esc(cap(n.label))}</b><span class="meta">${esc(n.summary.slice(0, 140))}${n.summary.length > 140 ? '…' : ''}</span></a>`;

// ---------------------------------------------------------------- Accueil et À propos
// Les courses mythiques de l'accueil : page de la course, repère, résumé d'une ligne.
const MYTHIQUES = [
  ['vendee-globe', 'Depuis 1989 · tous les 4 ans', 'Le tour du monde en solitaire, sans escale ni assistance.'],
  ['route-du-rhum', 'Depuis 1978 · tous les 4 ans', 'Saint-Malo – Pointe-à-Pitre en solitaire.'],
  ['transat-jacques-vabre', 'Depuis 1993 · tous les 2 ans', 'La transat en double, sur la route du café.'],
  ['the-ocean-race', 'Depuis 1973 · ex-Whitbread', 'Le tour du monde en équipage et par étapes.'],
  ['solitaire-du-figaro', 'Depuis 1970 · chaque été', 'La course par étapes en solitaire, école des marins du large.'],
  ['mini-transat', 'Depuis 1977 · tous les 2 ans', 'La transatlantique en solitaire sur 6,50 m.'],
  ['fastnet-race', 'Depuis 1925 · tous les 2 ans', 'Autour du rocher du Fastnet, au large de l’Irlande.'],
  ['trophee-jules-verne', 'Créé en 1992 · record', 'Le record du tour du monde à la voile, en équipage.'],
];
function homePage() {
  const rel = 'index.html';
  const root = prefixFor(rel);
  const totalBoats = series.reduce((n, S) => n + S.boats.length, 0);
  // Mosaïque du titre : la photo de une de chaque série actuelle.
  const mosaic = series.filter((S) => S.current).map((S) => coverOf(withPhotos(S, 1)[0])).filter(Boolean).slice(0, 5);
  const body = `${hero(SITE.name, 'Des bateaux, des courses, et ceux qui leur donnent vie : les marins', 'L’histoire de chaque bateau de course, de sa mise à l’eau à sa vie d’après ; les courses qui ont fait naître des légendes ; la carrière des marins qui les ont menés.', `
  <div class="stats">
    <div><b>${num(totalBoats)}</b><span>bateaux</span></div>
    <div><b>${num(SKIPPERS.size)}</b><span>marins</span></div>
    <div><b>${series.length}</b><span>classes</span></div>
    <div><b>1966</b><span>premier bateau suivi</span></div>
  </div>`, false, mosaic.length >= 3 ? mosaic : null)}

<section><div class="wrap"><div class="section-head"><h2>La course au large aujourd'hui</h2><p>Les séries qui courent le Vendée Globe, la Route du Rhum, la Jacques Vabre et la Mini Transat.</p></div>
<div class="features">${series.filter((S) => S.current).map((S) => {
    const ph = coverOf(withPhotos(S, 1)[0]);
    return `<a class="feature${ph ? ' with-photo' : ''}" href="${root}${S.slug}/">${ph ? coverImg(ph, '', 'feature-bg') : ''}<span class="eyebrow">${esc(S.eyebrow)}</span><b>${esc(S.title)}</b><span class="meta">${esc(S.lead)}</span><span class="feature-count">${S.boats.length ? `${num(S.boats.length)} bateaux` : 'Liste en cours d’import'}</span></a>`;
  }).join('')}</div>
</div></section>

${(() => {
    // Calendrier : les courses en cours, les prochaines, puis les dernières terminées.
    // Calendrier : les courses en cours, puis les prochaines, en une liste courte.
    const live = RACES.filter((r) => r.statut === 'en cours');
    const next = RACES.filter((r) => r.statut === 'à venir' && r.debut).slice(0, 8 - Math.min(live.length, 4));
    const shown = [...live.slice(0, 4), ...next];
    return shown.length ? `<section><div class="wrap"><div class="section-head"><h2>Calendrier des courses</h2><a href="${root}calendrier/">Tout le calendrier →</a></div>
${classLegend(shown)}
<ul class="ag-list">${shown.map((r) => agendaItem(r, root).replace('<span class="ag-date">', `<span class="ag-date">${r.debut ? `<b>${MONTHS_SHORT[Number(r.debut.slice(5, 7)) - 1]}</b> ` : ''}`)).join('')}</ul></div></section>` : '';
  })()}

<section><div class="wrap"><div class="section-head"><h2>L'histoire des grandes courses</h2><a href="${root}courses/">Toutes les courses →</a></div>
<div class="features">${MYTHIQUES.map(([slug, eyebrow, lead]) => {
    const c = courses().get(slug);
    if (!c) return '';
    const n = c.editions.size;
    return `<a class="feature" href="${root}${c.url}"><span class="eyebrow">${esc(eyebrow)}</span><b>${esc(c.titre)}</b><span class="meta">${esc(lead)}</span><span class="feature-count">${slug === 'trophee-jules-verne' ? `${n} records successifs` : `${n} éditions au palmarès`}</span></a>`;
  }).join('')}</div>
</div></section>

<section class="home-classement"><div class="wrap"><div class="section-head"><h2>Le classement des marins et des bateaux</h2></div>
<div class="prose">
  <p>Pour s'amuser à comparer les skippers et leurs palmarès, nous avons essayé, de façon tout à fait arbitraire et imparfaite, de bâtir une grille de notation des marins et des bateaux. Elle fait ressortir des parcours mythiques et des bateaux légendaires, classe par classe ou toutes classes confondues, sur la période de votre choix.</p>
  <p>Dans la continuité de ce classement, nous nous sommes amusés à faire en sorte que ces marins puissent s'affronter de nouveau, sur les courses autour du monde qui nous font vibrer.</p>
</div>
<p class="home-actions"><a class="action" href="${root}classement/">Voir le classement</a> <a class="action alt" href="https://course-au-large.pages.dev" target="_blank" rel="noopener">Les faire s'affronter : Course au large</a></p>
</div></section>

<section><div class="wrap"><div class="section-head"><h2>L'histoire des séries</h2><p>Les séries refondues sont marquées en rouge ; les autres renvoient à l'archive d'origine en attendant leur tour.</p></div>${seriesGrid(root)}</div></section>

<section><div class="wrap prose">
  <h2>D'où viennent les informations</h2>
  <p>Ce site rassemble des sources ouvertes, et chaque page cite la sienne :</p>
  <ul>
    <li><a href="${originUrl('')}">histoiredeshalfs.com</a> pour l'histoire des bateaux, leurs noms successifs, leurs résultats et leurs photos. Son auteur s'appuie sur les revues nautiques (<em>Bateaux</em>, <em>Neptune Nautisme</em>, <em>Les Cahiers du Yachting</em>, <em>Course au Large</em>, <em>Voiles et Voiliers</em>), sur <em>Le Télégramme</em> de Brest et sur un maximum de sites internet ;</li>
    <li>Wikipédia pour l'histoire des classes et le palmarès des courses ;</li>
    <li>les sites officiels des courses et des classes pour le calendrier.</li>
  </ul>
  <p>Les résultats ne sont pas toujours complets, d'où quelques points d'interrogation dans les classements. Une information, une photo, une correction sur un bateau ? Écrivez à <a href="mailto:histoiredeshalfs@orange.fr">histoiredeshalfs@orange.fr</a>. <a href="${root}a-propos/#sources">Toutes les sources →</a></p>
</div></section>`;
  write(rel, layout({ rel, title: 'Accueil', description: 'Histoire et devenir des bateaux de course : Half Tonners, Minis, Figaro, IMOCA, multicoques…', body, nav: '', version: true }));

  const relA = 'a-propos/index.html';
  write(relA, layout({ rel: relA, title: 'À propos', nav: 'a-propos/', body: `<div class="wrap prose" style="padding-top:32px">
  <h1>À propos</h1>
  <p>${esc(SITE.name)} raconte l'histoire de la course au large à travers ses bateaux, ses courses et ses marins. Le site est né de <a href="${originUrl('')}">histoiredeshalfs.com</a> : il réorganise l'immense travail de recherche de son auteur pour le rendre plus simple à parcourir, sans rien retirer au contenu, et le complète par d'autres sources ouvertes.</p>
  <h2 id="sources">Sources</h2>
  <p>Toutes les informations viennent de sources ouvertes, citées sur chaque page. En cas de doute, la source fait foi.</p>
  <ul>
    <li><b><a href="${originUrl('')}">histoiredeshalfs.com</a></b> : fiches et historiques des bateaux, listes des séries, classements, photos et archives de presse réunies par son auteur, depuis les Half Tonners jusqu'aux IMOCA et aux Ultim. Les pages pas encore récupérées en direct viennent de leurs copies dans la <a href="https://web.archive.org/">Wayback Machine</a> d'Internet Archive, avec leur date de capture.</li>
    <li><b><a href="https://fr.wikipedia.org/">Wikipédia</a></b>, en français et en anglais : aperçus historiques des classes, histoire et palmarès des courses. Les articles utilisés sont cités sur chaque page ; leurs textes sont sous licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr">CC BY-SA 4.0</a>.</li>
    <li><b>Les sites officiels des courses et des classes</b> : dates, parcours et classes du calendrier, vérifiés à la date indiquée sur chaque fiche de course.</li>
    <li><b>La presse nautique en ligne</b> (Figaro Nautisme) pour le palmarès récent de la Solitaire du Figaro.</li>
  </ul>
  <p>Les textes et les photos appartiennent à leurs auteurs respectifs, crédités dans chaque dossier. Informations et corrections sur les bateaux : <a href="mailto:histoiredeshalfs@orange.fr">histoiredeshalfs@orange.fr</a>.</p>
  <p><a href="${originUrl('A M L.htm')}">Mentions légales de histoiredeshalfs.com</a></p>
</div>` }));
}

// ---------------------------------------------------------------- Index de recherche
// Une entrée par bateau : nom de baptême, nom actuel, tous les noms portés et tous les numéros de voile ou de coque
// (avec et sans espace : « FRA 158 », « FRA158 », « 158 »), pour qu'on le retrouve par n'importe lequel.
function searchIndex() {
  const idx = series.flatMap((S) => S.boats.map((b) => {
    const d = b.doc;
    const sails = [...new Set([...b.entries.map((e) => e.sail), ...(d?.facts?.sails || [])].filter(Boolean))];
    const names = [...new Set([b.name, ...b.aliases, b.current, ...(d?.facts?.allNames || []).map((n) => n.name)].filter(Boolean).map((n) => prettyCase(n)))];
    const numbers = sails.flatMap((s) => [s, s.replace(/\s+/g, ''), ...(s.match(/\d+/g) || [])]);
    return {
      n: b.name, cur: b.current || '', s: sails.slice(0, 3).join(' · '), c: S.short,
      a: [...names.filter((n) => n !== b.name), ...new Set(numbers), b.designer, b.series, b.year].filter(Boolean).join(' '),
      u: d?.src ? d.url : `${S.slug}/bateaux/?q=${encodeURIComponent(b.name)}`,
    };
  }));
  for (const sk of SKIPPERS.values()) idx.push({ n: sk.name, s: '', a: sk.boats.map((b) => b.d.facts.title).join(' '), c: 'Skipper', u: sk.url });
  write('data/search.json', JSON.stringify(idx));
}

series.forEach((S, i) => {
  // Photos des séries actuelles d'abord, puis les autres, dans l'ordre de la configuration.
  imgPrio = (S.current ? 0 : 100) + i;
  seriesHome(S);
  seriesCalendarPage(S);
  themePages(S);
  architectsPage(S);
  for (const d of S.built) dossierPage(S, d);
});
seriesPage();
historicMonohullsPage();
coursePages();
if (process.env.AUDIT_PODIUM) { fs.mkdirSync('_audit', { recursive: true }); auditPodiums(); }
calendarPage();
for (const sk of SKIPPERS.values()) skipperPage(sk);
skippersIndex();
solitairePage();
imgPrio = 50;
newsPages();
homePage();
searchIndex();
// Base des bateaux, exportée telle que le site l'utilise : un enregistrement par bateau.
write('data/bateaux.json', JSON.stringify(series.flatMap((S) => { buildBase(S); return S.boats.map((b) => {
  const d = b.doc, f = d?.facts;
  return { classe: S.title, fiche: d?.src ? d.url : null, numero: (S.numberFirst ? b.sail : f?.launchSail || b.sail) || null, bapteme: b.name, actuel: b.current || null,
    noms: [...new Set([b.name, ...b.aliases, ...(f?.allNames || []).map((n) => n.name)])], annee: b.year || b.yearName || null,
    architecte: b.rec.architecte || null, architecte_deduit: b.rec.deduit || undefined, modele: b.rec.modele || null, chantier: b.rec.chantier || null, chantier_deduit: b.rec.chantierDeduit || undefined };
}); })));
// Palmarès de tous les marins, tels qu'affichés sur leurs fiches : source du classement (outils/classement/).
// Régénéré à chaque construction, jamais corrigé à la main.
{
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [['marin_id', 'marin', 'annee', 'course', 'classement', 'place', 'partants', 'role', 'classe', 'bateau', 'bateau_fiche', 'source']];
  for (const sk of SKIPPERS.values()) for (const r of sk.results) {
    const m = String(r.rank || '').match(/(\d+)\D*?(?:\/\s*(\d+))?\s*$/);
    rows.push([sk.url.replace(/^skippers\/|\/$/g, ''), sk.name, r.y || '', r.race, r.rank, m ? m[1] : '', m && m[2] ? m[2] : '', r.co ? 'equipier' : 'skipper',
      r.S ? r.S.title : '', r.boatName || (r.d ? r.d.facts.nameAt(r.y) : ''), r.d ? r.d.url : (r.boatHref || ''), r.d ? r.d.url : (r.href || '')]);
  }
  fs.writeFileSync(path.resolve('../donnees/site/palmares.csv'), rows.map((l) => l.map(q).join(',')).join('\n') + '\n');
}
// Classement des marins et des bateaux : calculé par outils/classement/calculer.py (barème de docs/decisions.md) à partir
// du palmarès ci-dessus ; la page fait les totaux dans le navigateur (classe, année de référence, période).
classementPage();
// Relecture : architecte, plan et chantier relevés pour chaque bateau (AUDIT_BASE=1 node tools/build.mjs).
if (process.env.AUDIT_BASE) {
  const lines = series.flatMap((S) => S.boats.map((b) => {
    const d = b.doc;
    const first = d?.facts ? [...d.facts.dos.intro, ...(d.facts.dos.entries[0]?.blocks || [])].filter((x) => x.type === 'p').map((x) => x.text).join(' / ').slice(0, 200) : '';
    return [S.slug, b.name, b.series || '', b.designer || '', d?.facts?.dos?.designer || '', builderOf(b), first].join('\t');
  }));
  fs.mkdirSync('_audit', { recursive: true });
  fs.writeFileSync('_audit/base.tsv', lines.join('\n'));
}
// Fichiers d'hébergement (Cloudflare Pages) : page introuvable, et pas d'indexation par les moteurs de recherche :
// le site reprend le travail d'un auteur, il se montre sur invitation, il ne se publie pas.
write('404.html', layout({ rel: '404.html', title: 'Page introuvable', body: `${hero('Erreur 404', 'Page introuvable', 'Cette page n’existe pas, ou pas encore : le site s’enrichit au fil des imports.', `<p><a href="./" style="color:#fff">Retour à l’accueil</a></p>`, true)}` }));
write('_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
write('robots.txt', 'User-agent: *\nDisallow: /\n');

// Photos utilisées par les pages générées, dans l'ordre où tools/photos.mjs doit les rapatrier.
fs.writeFileSync(path.resolve('../donnees/site/images-needed.json'), JSON.stringify([...IMAGES].sort((a, b) => a[1] - b[1]).map(([rel]) => rel)));
// Dossiers cités par les listes mais pas encore récupérés : à donner en priorité à crawl.mjs et wayback.mjs.
fs.writeFileSync(path.resolve('../donnees/site/missing-dossiers.json'), JSON.stringify(Object.fromEntries(series.map((S) => [S.slug, [...S.docs.values()].filter((d) => !d.src).map((d) => d.rel)]))));
for (const S of series) console.log(`${S.title.padEnd(22)} ${String(S.boats.length).padStart(5)} bateaux (${String(S.entries.length).padStart(5)} noms), ${S.built.length}/${S.docs.size} dossiers, liste ${S.listSrc ? 'ok' : 'à importer'}`);
console.log(`${news.length} mois d'actualités, ${SKIPPERS.size} skippers.`);
if (process.argv.includes('--skippers')) {
  for (const sk of [...SKIPPERS.values()].sort((a, b) => b.mentions.length - a.mentions.length).slice(0, 12)) {
    console.log(`  ${sk.name.padEnd(26)} ${String(sk.mentions.length).padStart(4)} mentions, ${sk.boats.length} bateaux, ${sk.results.length} résultats, ${sk.wins.length} victoires, ${sk.events.length} faits — ${sk.boats.slice(0, 4).map((b) => b.d.facts.title).join(', ')}`);
  }
}
