// Comportements du site : thème, menu mobile, recherche globale, filtres de liste, visionneuse photo.
const ROOT = document.documentElement.dataset.root || './';

const fold = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Recherche par début de mot, dans l'ordre : « desj » trouve Desjoyeaux, « michel desj » Michel Desjoyeaux,
// mais « joyeaux » ne trouve rien. La saisie doit commencer un mot ; les mots suivants de la saisie aussi.
const startsWords = (text, query) => {
  const q = fold(query).trim().replace(/\s+/g, ' ');
  if (!q) return true;
  const re = new RegExp(`(?:^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[^a-z0-9]+')}`);
  return re.test(text);
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Thème
const savedTheme = (() => { try { return localStorage.getItem('theme'); } catch { return null; } })();
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const current = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});

// Design (Moderne / Rétro dans l'en-tête, tous les essais en bas de page) : le choix est mémorisé d'une page à l'autre.
const markDesign = () => {
  const cur = document.documentElement.dataset.design || 'moderne';
  document.querySelectorAll('.design-picker button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.design === cur)));
};
document.querySelectorAll('.design-picker button').forEach((b) => b.addEventListener('click', () => {
  const d = b.dataset.design;
  if (d === 'moderne') delete document.documentElement.dataset.design; else document.documentElement.dataset.design = d;
  try { localStorage.setItem('design', d); } catch {}
  markDesign();
}));
markDesign();

// Menu mobile
document.querySelector('.menu-btn')?.addEventListener('click', () => document.querySelector('.nav')?.classList.toggle('open'));
// Familles du menu : au toucher (menu mobile), la famille se déplie au lieu d'ouvrir la page Séries.
document.querySelectorAll('.nav-top').forEach((a) => a.addEventListener('click', (ev) => {
  if (getComputedStyle(document.querySelector('.menu-btn')).display === 'none') return;
  ev.preventDefault();
  a.parentElement.classList.toggle('open');
}));

// Recherche globale
const searchInput = document.querySelector('#q');
const searchOut = document.querySelector('.search-results');
let index = null;
async function loadIndex() {
  if (!index) index = (await (await fetch(ROOT + 'data/search.json')).json()).map((e) => ({ ...e, k: fold(e.n + ' ' + (e.s || '') + ' ' + (e.a || '')) }));
  return index;
}
let active = -1;
searchInput?.addEventListener('focus', loadIndex);
searchInput?.addEventListener('input', async () => {
  const q = fold(searchInput.value.trim());
  if (q.length < 2) { searchOut.classList.remove('open'); return; }
  // Un numéro exact passe en premier, puis le nom qui commence par la saisie, puis le nom qui la contient en début de mot.
  const compact = q.replace(/\s+/g, '');
  const exactNumber = (e) => fold(e.s).split(' · ').some((s) => s.replace(/\s+/g, '') === compact || (s.match(/\d+/g) || []).includes(compact));
  const rank = (e) => (exactNumber(e) ? 0 : fold(e.n).startsWith(q) ? 1 : startsWords(fold(e.n), q) ? 2 : 3);
  const hits = (await loadIndex()).filter((e) => startsWords(e.k, q))
    .sort((a, b) => rank(a) - rank(b) || a.n.localeCompare(b.n, 'fr')).slice(0, 30);
  active = -1;
  searchOut.innerHTML = hits.length
    ? hits.map((e) => `<a href="${ROOT}${e.u}"><span>${esc(e.n)}${e.cur ? ` <span class="cur">auj. ${esc(e.cur)}</span>` : ''}</span> <span class="sail">${esc(e.s || '')}</span><span class="cat">${esc(e.c)}</span></a>`).join('')
    : '<a><span>Aucun résultat</span></a>';
  searchOut.classList.add('open');
});
searchInput?.addEventListener('keydown', (ev) => {
  const items = [...searchOut.querySelectorAll('a[href]')];
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((a, i) => a.classList.toggle('active', i === active));
  } else if (ev.key === 'Enter' && items[Math.max(active, 0)]) location.href = items[Math.max(active, 0)].href;
  else if (ev.key === 'Escape') searchOut.classList.remove('open');
});
document.addEventListener('click', (ev) => { if (!ev.target.closest('.search-box')) searchOut?.classList.remove('open'); });

// Liste filtrable
const list = document.querySelector('[data-boat-list]');
if (list) {
  // data-k : noms passés et numéros d'un bateau, cherchables sans être affichés.
  const rows = [...list.querySelectorAll('tbody tr')].map((tr) => ({ tr, k: fold(`${tr.textContent} ${tr.dataset.k || ''}`), l: tr.dataset.letter, f: tr.dataset.file === '1', y: Number(tr.dataset.year) || 0, c: tr.dataset.cat || '' }));
  const text = document.querySelector('#filter');
  const onlyFiles = document.querySelector('#only-files');
  const decade = document.querySelector('#decade');
  const cat = document.querySelector('#cat');
  const count = document.querySelector('.result-count');
  let letter = '';
  const apply = () => {
    const query = text.value;
    const d = Number(decade?.value) || 0;
    let n = 0;
    for (const r of rows) {
      const ok = (!letter || r.l === letter) && (!onlyFiles?.checked || r.f) && (!cat?.value || r.c === cat.value) && (!d || (r.y >= d && r.y < d + 10)) && startsWords(r.k, query);
      r.tr.hidden = !ok;
      if (ok) n++;
    }
    const unit = count.dataset.unit;
    count.textContent = unit ? `${n} ${unit}${n > 1 ? 's' : ''}` : `${n} bateau${n > 1 ? 'x' : ''}`;
  };
  document.querySelectorAll('.alpha button').forEach((b) => b.addEventListener('click', () => {
    letter = b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.l;
    document.querySelectorAll('.alpha button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.l === letter)));
    apply();
  }));
  [text, onlyFiles, decade, cat].forEach((el) => el?.addEventListener('input', apply));
  // Tri : clic sur un en-tête (bascule A→Z / Z→A) ou menu « Trier par ». Les cases vides vont toujours en fin de liste.
  const tbody = list.querySelector('tbody');
  const original = [...tbody.rows];
  const heads = [...list.querySelectorAll('th[data-sort]')];
  const sortSelect = document.querySelector('#sort');
  const sortBy = (col, dir) => {
    heads.forEach((h, i) => h.setAttribute('aria-sort', i === col ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'));
    if (sortSelect) sortSelect.value = col < 0 ? '' : `${col}:${dir}`;
    if (col < 0) { original.forEach((tr) => tbody.append(tr)); return; }
    const num = heads[col].dataset.sort === 'num';
    // « #VisitNovaScotia » se range à V : la ponctuation de tête est ignorée.
    const key = (tr) => { const td = tr.children[col]; return num ? Number(td.dataset.v) || null : fold(td.textContent.trim()).replace(/^[^a-z0-9]+/, '') || null; };
    const sign = dir === 'asc' ? 1 : -1;
    [...tbody.rows].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (ka === null || kb === null) return (ka === null) - (kb === null);
      return (num ? ka - kb : ka.localeCompare(kb, 'fr')) * sign;
    }).forEach((tr) => tbody.append(tr));
  };
  heads.forEach((th, col) => th.addEventListener('click', () => sortBy(col, th.getAttribute('aria-sort') === 'ascending' ? 'desc' : 'asc')));
  sortSelect?.addEventListener('input', () => { const [c, d] = sortSelect.value.split(':'); sortBy(sortSelect.value ? Number(c) : -1, d); });
  const params = new URLSearchParams(location.search);
  if (params.get('q')) text.value = params.get('q');
  if (cat && params.get('cat')) cat.value = params.get('cat');
  apply();
}

// Calendrier : filtre par classe (barres du planning, lignes des mois), mois vides masqués.
document.querySelectorAll('.cal-filter button').forEach((b) => b.addEventListener('click', () => {
  const c = b.dataset.c;
  document.querySelectorAll('.cal-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.querySelectorAll('.cal-views [data-classes], .cal-tbd [data-classes]').forEach((r) => { r.hidden = !!c && !r.dataset.classes.split('|').includes(c); });
  document.querySelectorAll('.ag-month').forEach((m) => { m.hidden = ![...m.querySelectorAll('li')].some((li) => !li.hidden); });
}));
// Calendrier : vue « Année » (planning) ou « Mois » ; par défaut, selon la largeur de l'écran.
const views = document.querySelector('.cal-views');
const viewBtns = document.querySelectorAll('.view-toggle button');
if (views && viewBtns.length) {
  const mark = () => {
    const v = views.dataset.view || (matchMedia('(max-width: 860px)').matches ? 'mois' : 'annee');
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  };
  viewBtns.forEach((b) => b.addEventListener('click', () => { views.dataset.view = b.dataset.view; mark(); }));
  mark();
}

// Visionneuse
const gallery = [...document.querySelectorAll('.gallery a')];
if (gallery.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<button class="close" aria-label="Fermer">×</button><button class="prev" aria-label="Précédente">‹</button><img alt=""><button class="next" aria-label="Suivante">›</button>';
  document.body.append(box);
  const img = box.querySelector('img');
  let i = 0;
  const show = (n) => { i = (n + gallery.length) % gallery.length; img.src = gallery[i].href; img.alt = gallery[i].querySelector('img')?.alt || ''; box.classList.add('open'); };
  gallery.forEach((a, n) => a.addEventListener('click', (ev) => { ev.preventDefault(); show(n); }));
  box.querySelector('.close').onclick = () => box.classList.remove('open');
  box.querySelector('.prev').onclick = () => show(i - 1);
  box.querySelector('.next').onclick = () => show(i + 1);
  box.addEventListener('click', (ev) => { if (ev.target === box) box.classList.remove('open'); });
  document.addEventListener('keydown', (ev) => {
    if (!box.classList.contains('open')) return;
    if (ev.key === 'Escape') box.classList.remove('open');
    if (ev.key === 'ArrowLeft') show(i - 1);
    if (ev.key === 'ArrowRight') show(i + 1);
  });
}
