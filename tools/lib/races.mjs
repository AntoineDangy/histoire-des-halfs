// Courses et classements : reconnaissance des grandes courses et des lignes de résultat dans le texte de l'auteur.
import { fold } from './parse.mjs';

// Les noms précis passent avant les génériques (« Transat Jacques Vabre » avant « Transat »).
export const BIG_RACE = /mini[- ]fastnet|krys ocean race|vend[ée]e globe|route du rhum|transat j(?:acques|\.|) ?vabre|jacques vabre|mini[- ]transat|transat anglaise|transat qu[ée]bec[- ]saint[- ]malo|transat bak|transat cic|transat caf[ée](?: l'or)?|transat ag2r|transat b ?to ?b|transat new[- ]york|transat st[.]? barth|fastnet|(?:half|quarter|one|two|three quarter|3\/4) ton cup|solitaire du figaro|solitaire de l'aurore|sydney[- ]hobart|whitbread|volvo ocean race|the ocean race(?: europe)?|ocean race(?: europe)?|barcelona world race|jules verne|ostar|around alone|boc challenge|vend[ée]e arctique|retour [àa] la base|new york vend[ée]e|the race|brest atlantiques|globe 40|transat/i;
const RACE_NAMES = { 'mini fastnet': 'Mini Fastnet', 'mini-fastnet': 'Mini Fastnet', 'krys ocean race': 'Krys Ocean Race', 'vendee globe': 'Vendée Globe', 'route du rhum': 'Route du Rhum', 'jacques vabre': 'Transat Jacques Vabre', 'transat jacques vabre': 'Transat Jacques Vabre', 'transat j. vabre': 'Transat Jacques Vabre', 'transat j vabre': 'Transat Jacques Vabre', 'transat j.vabre': 'Transat Jacques Vabre', 'transat jvabre': 'Transat Jacques Vabre', 'transat cafe': 'Transat Café L’Or', "transat cafe l'or": 'Transat Café L’Or', 'transat b to b': 'Transat B to B', 'transat btob': 'Transat B to B', 'transat new york': 'Transat New York', 'transat new-york': 'Transat New York', 'mini transat': 'Mini Transat', 'mini-transat': 'Mini Transat', 'vendee arctique': 'Vendée Arctique', 'new york vendee': 'New York Vendée', 'retour a la base': 'Retour à la Base', 'transat cic': 'Transat CIC', 'transat bak': 'Transat BAK', 'transat ag2r': 'Transat AG2R', 'boc challenge': 'BOC Challenge', 'ostar': 'OSTAR' };
// Bornes numériques : « 2025/2026 » (un millésime) n'est pas un classement « 25/202 ».
export const RANK = /(?<!\d)(\d{1,3}|DNF|ABD|DSQ)(?:e|er|st|nd|rd|th|ème)?\s*\/\s*(\d{1,3})(?!\d)/;
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'’/-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()).replace(/ (Du|De|La|L'|À|Des) /g, (m) => m.toLowerCase());
const raceName = (s) => RACE_NAMES[fold(s)] || titleCase(s);
const fmtRank = (r, of) => { const n = /^\d+$/.test(r) ? String(Number(r)) : r; return { rank: `${n}${/^\d+$/.test(n) ? (n === '1' ? 'er' : 'e') : ''}/${Number(of)}`, first: n === '1' }; };

// Plusieurs classements sur une ligne (« 27e/59 ttc en 17j16h, 1er/27 Class 40 ») : le classement de la classe du bateau
// l'emporte sur le classement toutes classes confondues (ttc, scratch, overall).
const CLASS_TAG = /^[^,;]{0,12}?(?:class\s?40|imoca|ultims?\b|multi\s?50|ocean fifty|mini|proto|s[ée]rie|figaro|orma|mod\s?70|rhum (?:multi|mono)|monocoques?|multicoques?|half|quarter|irc|classe?\b)/i;
const OVERALL_TAG = /^\s*(?:ttc|scratch|toutes classes|overall|g[ée]n[ée]ral)/i;
export const bestRank = (segment) => {
  const all = [...segment.matchAll(new RegExp(RANK.source, 'g'))];
  if (!all.length) return null;
  const score = (m) => { const after = segment.slice(m.index + m[0].length, m.index + m[0].length + 30); return CLASS_TAG.test(after) ? 2 : OVERALL_TAG.test(after) ? -1 : 0; };
  return all.reduce((best, m) => (score(m) > score(best) ? m : best), all[0]);
};

// Grandes courses de l'entrée dont le classement figure dans le même paragraphe (trois au plus).
export const racesOf = (blocks) => {
  const out = [];
  for (const b of blocks) {
    if (b.type !== 'p') continue;
    const m = b.text.match(BIG_RACE);
    if (!m) continue;
    const after = bestRank(b.text.slice(m.index, m.index + 200));
    // « Route du Rhum : en course » ; pas « 1500' en course sur ce bateau » (milles parcourus en course).
    const running = !after && /^[^:]{0,40}:\s*en course\b/i.test(b.text.slice(m.index, m.index + 80));
    if (!after && !running) continue;
    const name = raceName(m[0]);
    if (out.some((r) => r.name === name)) continue;
    // Course en cours : pas encore de classement.
    if (running) { out.push({ name, rank: 'en course', first: false }); continue; }
    out.push({ name, ...fmtRank(after[1], after[2]) });
    if (out.length === 3) break;
  }
  return out;
};

// Une ligne de résultat quelconque (« 8 mai, GP de Brest: 3e/3 », « Route du RHUM: 4e/31 en 14j…, Mike BIRCH ») :
// la course est le texte qui précède le classement, débarrassé de la date ; les grandes courses gardent leur nom canonique.
export const resultOf = (text) => {
  const first = text.match(RANK);
  if (!first) return null;
  // La course est nommée avant le premier classement ; le classement retenu est celui de la classe s'il y en a plusieurs.
  const best = bestRank(text.slice(first.index));
  const r = { ...best, index: first.index, 1: best[1], 2: best[2] };
  const big = text.slice(0, r.index + 1).match(BIG_RACE);
  let race = big ? raceName(big[0]) : text.slice(0, r.index)
    // Mois suivi d'une fin de mot : « Marseille City race » n'est pas « mars » + « eille ».
    .replace(/^\s*(?:(?:19|20)\d{2}\s*)?(?:\d{1,2}(?:er)?(?:\s*[-–]\s*\d{1,2})?\s+)?(?:(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|may|june|july|august|september|october|november|december)(?![a-zà-ÿ]))?\s*,?\s*/i, '')
    .replace(/[,:;\s]+$/, '').replace(/\s*,\s*[\d\s.,]+\s*(?:NM|milles|miles)\b.*$/i, '').trim()
    // « Open UAP: 3 - 1 - 2 - 2 = 2e/6 » : les scores de manches ne font pas partie du nom de la course.
    .replace(/\s*:.*$/, '').replace(/(?:\s*[-=]\s*[\d?]+)+\s*(?:pts?)?$/i, '').trim();
  if (race.length > 70) race = race.slice(0, 70) + '…';
  return race ? { race, big: !!big, ...fmtRank(r[1], r[2]) } : null;
};
