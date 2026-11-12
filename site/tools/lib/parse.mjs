// Extraction structurée : listes alphabétiques et dossiers de bateaux.
import { decodeEntities, resolveRel, balance } from './source.mjs';

// Préfixes de numéros de voile rencontrés (codes pays anciens et ISO).
const COUNTRIES = 'F|FRA|FIN|L|SA|AUS|KA|NOR|N|G|GER|D|DEN|KD|Sw|SWE|S|BEL|B|US|USA|ITA|I|IR|IRL|Irlande|GBR|K|UK|E|ESP|NED|H|HOL|KC|CAN|KH|HKG|SUI|Z|AUT|OE|POR|P|JPN|J|BRA|BL|ARG|A|KZ|NZL|ISR|IS|GRE|GR|TUR|TU|MON|M|POL|PZ|RUS|URS|CRO|SLO|EST|LAT|LTU|CZE|HUN|MLT|KB|RSA|MEX|MX|CHI|PUR|PR|ISV|BER|KW|DK|SUE|ZA|LUX|LX|YUG|Y|AHO|IVB'.split('|');
const SAIL_RE = new RegExp(`(^|\\s)((?:${COUNTRIES.join('|')})\\??)(?:\\s*(\\d[\\d\\s]{0,7}[A-Z]?\\b|\\?+))?(?=[\\s,]|$)`);
const YEAR_RE = /(^|[\s,(])((?:19|20)\d{2}|19\d\?|19\?\?)(?=[\s,)]|$)/;

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
// Lettres sans décomposition Unicode (« Sørensen », « Ærø », « Łukasz ») ramenées à leur équivalent latin.
const LATIN = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', þ: 'th' };
export const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[øæœßłđþ]/g, (c) => LATIN[c]);
export const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

// Analyse le texte qui suit le nom dans une ligne de liste.
// Code des Minis : « RM25-20 1005 » = plan RM n°25, construit en 2020, numéro de coque 1005.
// Variantes de l'auteur : « R9S-99 191 », « F6US-13 829 », « S11-2008 156 », « Arc D32-05 346 » ;
// avec opts.mini (liste des Minis seulement) : « F15 00 248 », « M13S 00 280 » (espace au lieu du tiret), « E22 565 » (sans année).
const MINI_CODE = /^(?:[A-Z][a-z]+\s)?([A-Z][A-Za-z]{0,3}\??\d{0,3}[A-Za-z]{0,3}\??)-(\d{2}|\d{4}|\?\?)\s+(\d{1,4})\b\s*(.*)$/;
const MINI_CODE_SPACED = /^(?:[A-Z][a-z]+\s)?([A-Z][A-Za-z]{0,3}\d{1,3}[A-Za-z]{0,3})\s(\d{2}|\?\?)\s+(\d{1,4})\b\s*(.*)$/;
const MINI_CODE_NOYEAR = /^([A-Z][A-Za-z]{0,3}\d{1,3}[A-Za-z]{0,3})\s+(\d{2,4})\s*$/;
export function parseEntryRest(rest, opts = {}) {
  const out = { sail: '', series: '', designer: '', year: '', yearName: '', note: '' };
  let s = rest.replace(/\s+/g, ' ').trim().replace(/^[,;:\s]+/, '');
  const mini = s.match(MINI_CODE) || (opts.mini && s.match(MINI_CODE_SPACED));
  if (mini) {
    out.designer = mini[1];
    if (/^\d{2}$/.test(mini[2])) out.year = (Number(mini[2]) >= 70 ? '19' : '20') + mini[2];
    else if (/^\d{4}$/.test(mini[2])) out.year = mini[2];
    out.sail = mini[3];
    out.note = mini[4].replace(/^[,;\s]+/, '');
    return out;
  }
  const noYear = opts.mini && s.match(MINI_CODE_NOYEAR);
  if (noYear) { out.designer = noYear[1]; out.sail = noYear[2]; return out; }
  const series = [...s.matchAll(/\u0003([^\u0004]*)\u0004/g)].map((m) => m[1].trim()).filter(Boolean);
  out.series = series.join(' ').replace(/\s+/g, ' ').trim();
  // « en 82 » / « en 2000 » : année où le bateau portait ce nom (pas sa date de construction).
  const yn = s.match(/(^|[\s,])en (\d{2}|\d{4})\b(\s*et\b)?/);
  if (yn) {
    out.yearName = yn[2].length === 2 ? '19' + yn[2] : yn[2];
    s = (s.slice(0, yn.index) + ' ' + s.slice(yn.index + yn[0].length)).trim();
  }
  const plain = s.replace(/\u0003[^\u0004]*\u0004/g, ' \u0005 ').replace(/\s+/g, ' ').trim();
  const sm = plain.match(SAIL_RE);
  let after = plain;
  if (sm && sm.index < 40) {
    out.sail = (sm[2] + (sm[3] ? ' ' + sm[3].replace(/\s+/g, '') : '')).trim();
    after = plain.slice(sm.index + sm[0].length).replace(/^[\s,;]+/, '');
  }
  const ym = after.match(YEAR_RE);
  let designerPart = after;
  if (ym) {
    out.year = ym[2];
    designerPart = after.slice(0, ym.index);
    out.note = after.slice(ym.index + ym[0].length).replace(/^[\s,]+/, '').replace(/\u0005/g, '').trim();
  }
  const d = designerPart.split(',')[0].replace(/\u0005/g, '').replace(/[?]+$/, (m) => m).trim();
  out.designer = d.replace(/^[,\s]+|[,\s]+$/g, '');
  if (!ym) {
    const parts = designerPart.split(',');
    out.note = parts.slice(1).join(',').replace(/\u0005/g, '').trim();
  }
  if (out.designer === '?' ) out.designer = '';
  return out;
}

// Liste alphabétique (ex. « Half Liste.htm ») -> [{ name, href, sail, series, designer, year, note, raw }]
export function parseAlphaList(body, fromRel, opts = {}, startMarker = /LISTE ALPHABETIQUE/i) {
  // Le marqueur sert à sauter l'en-tête de navigation ; mais sur certaines listes il n'apparaît qu'en bas de page
  // (calques positionnés de Dreamweaver). On garde alors la lecture de la page entière.
  const start = body.search(startMarker);
  const whole = parseAlphaSegment(body, fromRel, opts);
  if (start < 0) return whole;
  const fromMarker = parseAlphaSegment(body.slice(start), fromRel, opts);
  return fromMarker.length >= whole.length * 0.6 ? fromMarker : whole;
}

function parseAlphaSegment(s, fromRel, opts) {
  s = s.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\b[^>]*>(?:\s|&nbsp;|<[^>]*>)*<\/a>/gi, '')
    .replace(/<font\b[^>]*color\s*=\s*["']?#0000FF["']?[^>]*>([\s\S]*?)<\/font>/gi, (_, inner) => `\u0003${stripTags(inner)}\u0004`);
  const segments = s.split(/<br\b[^>]*>|<\/?p\b[^>]*>|<\/?td\b[^>]*>|<\/?tr\b[^>]*>|<\/?table\b[^>]*>/i);
  const entries = [];
  // Intertitre courant (« MOD 70: ») : il classe les bateaux qui le suivent.
  let section = '';
  for (const seg of segments) {
    // Plusieurs bateaux sur une même ligne (balise <br> oubliée) : on recoupe avant chaque lien suivant.
    const pieces = [];
    let last = 0;
    // Sauf quand le texte précédent se termine par une virgule : c'est alors le nom du bateau,
    // et le lien porte son numéro de voile (« 40 DEGREES, <a>GBR 37</a>, Jaz 40 » des Class 40).
    for (const m of seg.matchAll(/<a\b[^>]*href/gi)) {
      const prev = seg.slice(last, m.index);
      const before = stripTags(prev).replace(/[\u0003\u0004]/g, '');
      const prevIsLinkLine = /^\s*(?:<(?!a\b)[^>]*>\s*)*<a\b/i.test(prev);
      if (m.index > last && before.length > 3 && /<a\b/i.test(prev) && (prevIsLinkLine || !/,\s*$/.test(before))) { pieces.push(prev); last = m.index; }
    }
    pieces.push(seg.slice(last));
    for (const p of pieces) {
      const text = stripTags(p);
      if (!text || text.length < 2) continue;
      if (/^[A-Z](\s*-\s*[A-Z])*\s*:$/.test(text.replace(/[\u0003\u0004]/g, ''))) continue;
      let name = '', href = null, rest = '';
      const a = p.match(/^\s*(?:<[^a][^>]*>\s*)*<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const st = p.match(/^\s*(?:<(?!strong|b\b)[^>]*>\s*)*<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i);
      const inner = p.match(/^([\s\S]*?),\s*(?:<[^a][^>]*>\s*)*<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (a && stripTags(a[2])) { href = resolveRel(a[1], fromRel); name = stripTags(a[2]).replace(/[\s,;:]+$/, ''); rest = p.slice(a.index + a[0].length); }
      else if (inner && stripTags(inner[1]).replace(/[\u0003\u0004]/g, '').length >= 2 && !/<a\b/i.test(inner[1])) {
        // « NOM, <a>numéro de voile</a>, plan » : le texte du lien rejoint la suite pour l'analyse du numéro.
        href = resolveRel(inner[2], fromRel); name = stripTags(inner[1]).replace(/[\u0003\u0004]/g, '').replace(/[\s,;:]+$/, '');
        rest = stripTags(inner[3]) + ' ' + p.slice(inner.index + inner[0].length);
      }
      else if (st && stripTags(st[2]).replace(/[\u0003\u0004]/g, '')) { name = stripTags(st[2]).replace(/[\u0003\u0004]/g, ''); rest = p.slice(st.index + st[0].length); }
      else continue;
      const restText = decodeEntities(rest.replace(/<[^>]+>/g, ' '));
      const e = { name, href, ...parseEntryRest(restText, opts), raw: (name + ' ' + restText.replace(/[\u0003\u0004]/g, '')).replace(/\s+/g, ' ').trim() };
      if (/^(introduction|architectes|half ton cup|solitaire|num[eé]ros voile|no voile|histoire des)/i.test(name) && !e.sail) continue;
      if (/^(19|20)\d\d$/.test(name) && !href) continue; // légendes de photos d'archives en bas de liste
      // Index des numéros en bas de liste (« ; 157 ; 158 ; 159 », Class 40 et Figaro) : un numéro seul, sans rien après,
      // n'est pas un nom de bateau (relecture du 11/11/2026 : « 158 » affiché parmi les noms de Crédit Mutuel).
      if (/^\d{1,4}$/.test(name) && !restText.replace(/[\s;,.\u0003\u0004]/g, '')) continue;
      if (/^(liste\s|multihulls?\s+list|monohulls?\s+list)/i.test(name)) continue; // liens vers d'autres listes
      // Liens de navigation ou d'articles mêlés à la liste (« RESULTATS », « History of multihulls », « 1988 Mai … »).
      if (/^(r[ée]sultats?|results?|history of|histoire des|photos?|architectes?)\b/i.test(name)) continue;
      if (/^(19|20)\d\d\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\b/i.test(name)) continue;
      if (!href && (/:\s*$/.test(e.raw) || /^liste\b/i.test(name))) { // intertitres (« Liste des Maxis, G Class ou Ultims: », « MOD 70: »)
        if (!/^liste\b/i.test(name) && e.raw.length < 30) section = e.raw.replace(/\s*:\s*$/, '');
        continue;
      }
      e.section = section;
      entries.push(e);
    }
  }
  return entries;
}

// Pages de palmarès (Half Ton Cup, Aurore/Figaro…) : éditions annuelles et lignes de classement.
// Une édition commence par un bloc dont le HTML s'ouvre sur l'année en gras.
const EDITION_RE = /^(?:<strong>\s*)+((?:19|20)\d{2})\b/;
const RANK_RE = /^(\d{1,3}|\?{1,3}|DNF|DNS|DSQ|ABD|Abd)(?:e|er|ème|st|nd|rd|th)?(?:\s*[.)-]\s*|\s+)(\D.*)$/;
// « 1988 Février "Régate" » : légende de coupure de presse, pas une nouvelle édition.
const CAPTION_RE = /^(?:<[^>]+>|\s)*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|january|february|march|april|may|june|july|august|september|october|november|december|revue)\b/i;
// loose : accepte aussi un en-tête sans gras (« 1977, Mini Transat: 23 partants… »), court et terminé par la description.
const LOOSE_EDITION_RE = /^((?:19|20)\d{2})\s*[,:]?\s+(?=[A-ZÀ-Ý])/;
const NAMED_EDITION_RE = /^[A-Za-z][A-Za-z' ]{2,40}?\s((?:19|20)\d{2})\b\s*[,:]/;
export function parseResults(blocks, { loose = false } = {}) {
  const out = { intro: [], editions: [] };
  let ed = null;
  for (const b of blocks) {
    // « Quarter Ton Cup 1967, La Rochelle, 9 bateaux » : l'année suit le nom de la course.
    const em = b.type === 'p' && (b.html.match(EDITION_RE) || (loose && b.text.length < 300 && /partants|inscrits|bateaux|milles|classés|entrants/i.test(b.text) && (b.text.match(LOOSE_EDITION_RE) || b.text.match(NAMED_EDITION_RE))));
    if (em && !(ed && CAPTION_RE.test(b.html.replace(EDITION_RE, '').replace(/^\s*(<\/strong>\s*)*/, '')))) {
      // L'année peut être le texte d'un lien (vers le reportage) : on garde le lien sous le libellé « reportage ».
      const titleHtml = b.html.replace(EDITION_RE, '')
        .replace(new RegExp(`^(<a\\b[^>]*>)\\s*${em[1]}\\s*</a>\\s*[,:]?\\s*(.*)$`), '$2 $1reportage</a>')
        .replace(LOOSE_EDITION_RE, '').replace(/^\s*(<\/strong>\s*)*/, '').replace(/^[\s:,]+/, '');
      ed = { year: em[1], titleHtml: balance(titleHtml), results: [], notes: [] };
      out.editions.push(ed);
      continue;
    }
    if (!ed) { out.intro.push(b); continue; }
    const rm = b.type === 'p' && b.text.match(RANK_RE);
    if (rm && b.text.length < 400 && !/^\d+\s+(bateaux|partants|inscrits|boats|yachts|nations|class)/i.test(b.text)) {
      // Retire le rang en conservant les balises ouvrantes qui le précèdent (« <strong>1 Joan de Kat</strong> »).
      const rank = rm[1].replace(/\?/g, '\\?');
      const html = b.html.replace(new RegExp(`^((?:<[^>]+>\\s*)*)${rank}(?:e|er|ème|st|nd|rd|th)?(?:\\s*[.)-]\\s*|\\s+)`), '$1');
      // heading : dernier texte (non classement) vu dans l'édition, souvent le nom de la course quand une année en réunit plusieurs.
      ed.results.push({ rank: rm[1], html, heading: ed.heading || '' });
    } else {
      ed.notes.push(b);
      if (b.type === 'p') ed.heading = b.text;
    }
  }
  return out;
}

// Événements marquants détectés dans le texte d'une entrée de chronologie (français et anglais).
// L'ordre compte : le premier type trouvé donne la couleur principale de l'entrée.
// Règles relues sur l'ensemble des fiches (tools/audit-events.mjs) : pour les événements graves, mieux vaut en manquer un
// que d'en inventer un. Exemples écartés : « corps mort » (mouillage), « photo disparue », « flotteur disparu »,
// « radeau de sauvetage », « racheté à l'état d'épave », « brûlé par le soleil », « il retourne à sa base »,
// « quille pendulaire » (description), « tentative de record », la course « Record SNSM ».
export const EVENT_TYPES = [
  { type: 'death', label: 'Décès', re: /\bd[ée]c[ée]d[ée]e?s?(?![a-zà-ÿ])|d[ée]c[èée]de(?![a-zà-ÿ])|perd(?:u|ent|ra)? la vie|\bmort en mer\b|trouv[ée]e? la mort|\best mort\b|\bsont morts\b|disparu corps et biens/i },
  { type: 'missing', label: 'Disparition en mer', re: /port[ée]e?s? disparue?s?|disparue?s? en mer|(?:skipper|[ée]quipier|marin|navigateur|homme|bateau)s?\s+disparue?s?\b|tomb[ée]e?s? [àa] la mer et disparue?|\bun disparu\b|disparu corps et biens|lost at sea|missing at sea/i },
  // « rescued » en minuscules seulement : avec une majuscule, c'est un nom propre (« Project Rescue Ocean »).
  { type: 'rescue', label: 'Sauvetage', re: /secouru|h[ée]litreuill|(?-i:\brescued\b)|(?:op[ée]ration|tribulations?) de sauvetage|\b(?:son|leur|du) sauvetage\b|sauvetage d[eu'] ?[A-ZÀ-Ýa-z]|par (?:le |un )?(?:bateau|canot|cargo|navire|vedette) de sauvetage|rep[êe]ch[ée]|recueilli par|abandonn[ée] (?:le bateau|son bateau)|abandon du navire|[ée]vacu[ée]e?s? par (?:un |le |l')?(?:cargo|navire|h[ée]lico)/i },
  { type: 'injury', label: 'Blessure', re: /\bbless[ée]e?s?(?![a-zà-ÿ])|blessure|\binjur(?:ed|y|ies)\b|hospitalis[ée]|fractur[ée]|[ée]vacu[ée]e? (?:sanitaire|m[ée]dical)|\bse br[uû]le\b/i },
  { type: 'sink', label: 'Naufrage, perte', re: /naufrag|\ba coul[ée](?![a-zà-ÿ])|(?<![a-zà-ÿ])coul[ée]e?(?![a-zà-ÿ])(?!\s+(?:en|dans|de|des)\b)|\bsombr[ée]e?(?![a-zà-ÿ])|\bsombre au large|\bsank\b|\bsunk\b|\bsinking\b|perdu en mer|(?<![ée]tat d')[ée]pave (?:d[eu]|a [ée]t[ée]|g[îi]t|du trimaran|du bateau|rep[ée]r)|l'[ée]pave\b(?! d'un)|(?:^|bateau |trimaran |catamaran |monocoque |coque )d[ée]truit|d[ée]truit (?:lors|par|dans|au cours)|bateau incendi[ée]|destroyed by fire|\b(?:a|avait|aurait|ont) br[uû]l[ée]|\bwreck(?:ed)?\b/i },
  { type: 'capsize', label: 'Chavirage', re: /chavir|capsiz|s'est retourn|\bse retourne\b|(?:bateau|trimaran|catamaran|[ée]pave|coque|multicoque)[^.,;]{0,25}\bretourn[ée]e?(?![a-zà-ÿ])/i },
  { type: 'dismast', label: 'Démâtage', re: /d[ée]m[âa]t|dismast/i },
  { type: 'damage', label: 'Avarie', re: /avarie|collision|\bcass[ée]e?s?(?![a-zà-ÿ])|\bcasse\b|endommag|d[ée]g[âa]ts?\b|s'[ée]chou|[ée]chou[ée]e?s? (?:sur|[àa] la c[ôo]te|au large|dans|par|en douceur)|aground|\bdamaged?\b|\bbroken?\b|perte (?:de la |du |d'un |de |d')(?:safran|quille|m[âa]t|bulbe|flotteur|gouvernail)|(?:safran|quille|keel|rudder|bulbe|gouvernail)s? (?:cass|arrach|endommag|perdu|broken|damaged)|\bheurt[ée](?![a-zà-ÿ])|\bpercut[ée](?![a-zà-ÿ])/i },
  // Abandon de course (DNF), à ne pas confondre avec un bateau abandonné en mer (« abandon du navire » : Sauvetage).
  { type: 'retired', label: 'Abandon de course', re: /\babandon(?:ne|nent|s)?\b(?!\s*(?::|du navire|du bateau))|contraint à l'abandon|\bDNF\b|\bretired\b|\bABD\b/i },
  { type: 'win', label: 'Victoire', re: /(?:^|[\s(:])(?:1(?:er|e|st)\s*\/\s*\d+|vainqueur|victoire|remporte|gagne(?!\s+la\s+\d)|\bwins?\b|\bwinner\b)/i },
  { type: 'record', label: 'Record', re: /(?:\bbat\b|\bbattu\b|\bbats\b|\bnouveau\b|(?<![a-zà-ÿ])[ée]tablit?(?![a-zà-ÿ])|d[ée]tient|homologu\w*|am[ée]liore|pulv[ée]ris\w*|signe)\s+(?:\w+\s+){0,3}record|\brecord\s+(?:\w+\s+){0,5}(?:(?<!(?:non|pas) )battu|homologu\w*|[ée]tabli|pulv[ée]ris\w*)|record du parcours|record de l'(?:[ée]preuve|atlantique)|\bnew record\b|record[- ]breaking|record holder|\bet record\b/i },
  // Une vente conclue (nouveau propriétaire) n'est pas une annonce (« à vendre ou louer ») : deux événements distincts.
  { type: 'sale', label: 'Vendu, nouveau propriétaire', re: /nouveau propri[ée]taire|new owner|(?<![àa] )\bvendu(?![a-zà-ÿ])|\bsold\b(?!\s+out)|rachet[ée]|\bbought\b|achet[ée]|owner\s*:|propri[ée]taire\s*:/i },
  { type: 'forsale', label: 'Mise en vente', re: /\bfor sale\b|[àa] vendre|mis(?:e)? en vente|en vente\b/i },
  { type: 'sponsor', label: 'Sponsor', re: /sponsor|partenaire|parrain/i },
  { type: 'refit', label: 'Refit, modification', re: /\brefit|chantier d'hiver|r[ée]nov|restaur|optimis[ée]|modifi(?:[ée]e?s?|cations?)\b|nouveau m[âa]t|new mast|rallong|re-?measured/i },
  // Une commande ou un projet annonce une mise à l'eau future : ce n'est pas une construction.
  // Une mise à l'eau « prévue » n'est une commande que pour un bateau neuf (pas une remise à l'eau après réparation).
  { type: 'order', label: 'Commande, projet', re: { test: (t) => /\bordered\b|(?<![a-zà-ÿ])command[ée]e?s?\b|passe commande|(?<![a-zà-ÿ])commande (?:d'un|d'une|du|de)\b|estimated time of launch/i.test(t)
    || (/(?<![a-zà-ÿ])mise [àa] l'eau (?:pr[ée]vue|annonc[ée]e|programm[ée]e|envisag[ée]e)|launch(?:ing)? (?:is )?(?:planned|scheduled|expected)/i.test(t) && /nouve(?:au|l|lle)\b|\bnew\b|constru|projet/i.test(t)) } },
  { type: 'launch', label: 'Construction, mise à l’eau', re:/mise [àa] l'eau|lancement|\blaunch|construit|\bbuilt\b|chantier|\bplan\s+[A-Z]/i },
];
// names : noms du bateau, retirés du texte avant la détection (un bateau « Record » ou « Project Rescue Ocean »
// n'est pas un record ni un sauvetage).
// Décès et disparition ne sont jamais lus dans une parenthèse, souvent un aparté sur une autre personne
// (« Marc Linski (disparu en mer en 1996 à bord de son bateau) l'utilise… »).
const GRAVE = new Set(['death', 'missing']);
export function classifyEvents(text, names = []) {
  let t = text;
  for (const n of names) if (n && n.length >= 4) t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  const noParen = t.replace(/\([^)]*\)/g, ' ');
  const types = EVENT_TYPES.filter((e) => e.re.test(GRAVE.has(e.type) ? noParen : t)).map((e) => e.type);
  return types.includes('order') ? types.filter((x) => x !== 'launch') : types;
}

// Skippers : l'auteur écrit le prénom puis le nom en capitales (« Mike BIRCH », « Jean-Pierre DICK », « Yves LE BLEVEC »).
// On ne les cherche que dans les lignes de résultats ou d'équipage, pour éviter les sigles (IMOCA, ORMA…).
// Particule en minuscules acceptée (« Olivier de KERSAUZON », relecture du 09/11/2026).
const PERSON_RE = /(?:^|[\s,(:;&\/])((?:[A-ZÀ-Ý][a-zà-ÿ]+|[A-Z]\.)(?:[- ][A-ZÀ-Ý][a-zà-ÿ]+)?)\s+((?:(?:LE|LA|DE|DU|DES|VAN|VON|DI|DA|DEN|MAC|MC|D'|de la|de|du|des|le|la|van|von|d')\s?)?[A-ZÀ-Ý][A-ZÀ-Ý'’]{2,}(?:[- ][A-ZÀ-Ý][A-ZÀ-Ý'’]{1,})*)(?=$|[\s,.;:)&\/])/g;
// Mots qui ne sont pas des prénoms, même suivis d'un mot en capitales : courses, sponsors, lieux
// (« Crédit MUTUEL », « Groupe PARTOUCHE », « Atlantic CHALLENGE »…). « Marine » reste un prénom (Marine Legendre).
// Moteur, Voiles… : matériel cité comme une personne (« Moteur YANMAR » sur Solidaires, relecture du 09/11/2026).
const NOT_A_FIRST_NAME = /^(Challenge|Moteur|Moteurs|Voiles|Voile|Chantier|Chantiers|Mât|Pilote|Cup|Race|Globe|Transat|Route|Rhum|Classe?|Monocoques?|Multicoques?|Trophée|Grand|Prix|Tour|Coupe|Open|Solitaire|Double|Equipage|Équipage|Skipper|Barreur|Avec|Pour|Puis|Sur|Par|Le|La|Les|Des|Une|The|And|Team|Photo|Photos|Picture|Pictures|Revue|Course|Régate|Championnat|Crédit|Credit|Banque|Groupe|Group|Club|Cap|Pôle|Pole|Région|Region|Ville|Port|Société|Fondation|Association|Atlantic|Atlantique|Europe|France|Radio|Kingfisher|Fleury|Gitana|Sodebo|Macif|Foncia|Virbac|Safran|Paprec|Orange|Spirit|Défi|Defi|Golden|Royal|Hôtel|Hotel|Café|Cafe|Agence|Mairie|Conseil|Pays|Caisse|Mutuelle|Assurances?|Ecole|École|Lycée|Saint|Sainte|Air|Vendée|Bretagne|Normandie|Ocean|Océan|Ligue|Bateau|Yacht|Voile|Voilier|For|Pauger)\b/;
const NOT_A_PERSON = /^(TTC|IMOCA|ORMA|IRC|IOR|HTC|NM|DNF|DNS|DSQ|ABD|TJV|RORC|ISAF|UNCL|FFV|MOD|ULTIM|CLASS|CLASSE|OPEN|MULTI|PRO|SAS|SA|SNSM|GP|USA|GBR|FRA|ITA|ESP|GER|SUI|BEL|NED|NOR|SWE|FIN|AUS|NZL|JPN|IRL|CAN|LYS|IMS|CHS|MOCRA|HALF|TON|CUP|RACE|VENDEE|GLOBE|RHUM|TRANSAT|FASTNET|BOC|OSTAR|RECORD|TOUR|EUROPE|SPI|DUO|SOLO|PHRF|SNIM|ORC|SRS|SALE|LTD|SARL|GMBH|INC|LPG|QUARTER|THREE|TWO|ONE|MINI|TONNER|TONNERS)$/;
// Codes de nationalité des listes de résultats. Pas COL, PER, BAR, LUX, MON : aussi des noms de famille (Sébastien COL).
const NATIONS = 'NOR|FRA|GBR|USA|GER|ITA|ESP|SUI|BEL|NED|HOL|SWE|DEN|DAN|FIN|AUS|NZL|JPN|IRL|CAN|POL|RSA|BRA|ARG|POR|AUT|CHI|HKG|RUS|UKR|CZE|HUN|SLO|CRO|GRE|TUR|ISR|MEX|CHN|KOR|SGP|URU|EST|LAT|LTU|ISL|MLT|CYP|ROU|BUL|SRB|SVK|EGY|MAR|TUN|ALG|SEN|IND|THA|VEN|ECU|BER|ISV|IVB|BAH|TTO|PUR|AND';
// Le sigle d'un yacht-club (« Tom FLORIZOONE KYCN ») suit parfois le nom de la même façon.
const COUNTRY_TAIL = new RegExp(`[\\s-]+(?:${NATIONS}|[A-Z]{0,2}YC[A-Z]{0,2})$`);
const COUNTRY_ONLY = new RegExp(`^(?:${NATIONS})$`);
const CLUB_ONLY = /^[A-Z]{0,2}YC[A-Z]{0,2}$/;
export const RACE_NAMED_AFTER = /(?:troph[ée]e|m[ée]morial|memorial|coupe|prix|challenge|cup|souvenir)\s*$/i;
// Classement sans nombre de partants (« 2e en 60', Loik PEYRON ») : aussi une ligne de résultat.
const SKIPPER_CONTEXT =/\d{1,3}(?:e|er|st|nd|rd|th|ème)?\s*\/\s*\d{1,3}|\b\d{1,3}(?:e|er|ème)\s+(?:en|mono|multi|ttc|scratch)\b|DNF|DNS|ABD|skipper|barr[ée]|[ée]quip(?:age|ier|i[eè]re)|[ée]q\s*:|co-?skipper|crew|helm|à la barre|navigateur|solitaire/i;
// Ligne de classement écrite en minuscules (« Joan de Kat, 126h », « Daniel Gilard (Petit Dauphin) Serpentaire »,
// « Guillaume Pirouelle Jules Ducelier 197 Sogestran ») : le ou les noms en tête de ligne.
// knownFirst : prénoms déjà connus, seule garantie que la tête de ligne est bien une personne.
const PARTICLE = '(?:de la|de|du|des|le|la|van|von|di|da|den|d\')';
const LEAD_NAME = new RegExp(`^((?:[A-ZÀ-Ý][a-zà-ÿ'’-]+)(?:\\s+(?:${PARTICLE}\\s+)?[A-ZÀ-Ý][a-zà-ÿ'’-]+){1,3})(?=\\s*[,(]|\\s+\\d|\\s+à\\s|\\s*$|\\s+[A-ZÀ-Ý][a-zà-ÿ]+\\s*[,(])`);
export function leadingPersons(text, knownFirst) {
  const m = text.trim().match(LEAD_NAME);
  if (!m) return [];
  const words = m[1].split(/\s+/);
  const toPerson = (ws) => ({ first: ws[0], last: ws.slice(1).join(' ') });
  // Quatre mots sans particule : un duo (« Guillaume Pirouelle Jules Ducelier »).
  const people = words.length === 4 && !new RegExp(`\\b${PARTICLE}\\b`, 'i').test(m[1]) ? [toPerson(words.slice(0, 2)), toPerson(words.slice(2))] : [toPerson(words)];
  return people.filter((p) => p.last && knownFirst.has(fold(p.first)))
    .map((p) => ({ ...p, name: `${p.first} ${p.last}`, raw: `${p.first} ${p.last}` }));
}

// Renvoie les noms normalisés (« Mike Birch ») ; skipperMentions() renvoie aussi la forme écrite (« Mike BIRCH »).
export function skippersOf(text) {
  return skipperMentions(text).map((m) => m.name);
}
// anyLine : la ligne est déjà une ligne de classement (page de résultats), inutile d'y chercher un contexte.
export function skipperMentions(text, { anyLine = false } = {}) {
  const out = [];
  for (const line of text.split(/\n/)) {
    if (!anyLine && !SKIPPER_CONTEXT.test(line)) continue;
    for (const m of line.matchAll(PERSON_RE)) {
      // Course qui porte le nom d'une personne (« Trophée Marie Agnés PERON », « Memorial Simone BIANCHETTI ») : pas un concurrent.
      if (RACE_NAMED_AFTER.test(line.slice(0, m.index + m[0].indexOf(m[1])))) continue;
      // Nationalité écrite après le nom (« Lars Aage GADE-SORENSEN NOR ») : retirée ; un « nom » qui n'est qu'une
      // nationalité est un bateau d'une liste de résultats (« Exocet DEN », « Xanadu DEN »).
      let last = m[2].trim().replace(COUNTRY_TAIL, '').trim();
      let lead = m[1];
      // Seul le sigle du club est en capitales (« Tom Florizoone KYCN ») : le nom est le dernier mot écrit en minuscules.
      if (CLUB_ONLY.test(last)) {
        const ws = lead.trim().split(/\s+/);
        if (ws.length < 2) continue;
        last = ws.pop().toUpperCase();
        lead = ws.join(' ');
      }
      if (!last || COUNTRY_ONLY.test(last)) continue;
      if (NOT_A_PERSON.test(last) || last.split(/[\s-]/).every((w) => NOT_A_PERSON.test(w))) continue;
      // « Cup Simone BIANCHETTI » : on retire le mot de course capturé devant le prénom.
      const first = lead.trim().replace(new RegExp(`^${NOT_A_FIRST_NAME.source.slice(1, -2)}\\s+`), '');
      if (NOT_A_FIRST_NAME.test(first)) continue;
      const name = `${first} ${last.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (s, p, c) => p + c.toUpperCase())}`;
      out.push({ name, first, last, raw: `${first} ${last}` });
    }
  }
  return out;
}

// Dossier de bateau : sépare l'en-tête de navigation, détecte la date de mise à jour,
// les changements de nom et regroupe le reste en entrées chronologiques avec leurs photos.
const NAV_RE = /^(histoire des halfs|hystory of|history of|introduction|half tonner list|liste des half tonners|sommaire)/i;
const UPDATED_RE = /(?:[àa] jour(?: au)?|last update|mise [àa] jour)\s*:?\s*([^,;]{0,30})/i;
// Année en tête d'entrée, y compris approximative (« 198? », « 19?? ») ; (?!\w) plutôt que \b, qui échoue après un « ? ».
// (?!\d) et non (?!\w) : « 2009plan Lombard » (année collée au texte) est bien une entrée 2009.
const ENTRY_YEAR_RE = /^((?:19|20)\d{2}|(?:19|20)\d\?|19\?\?|\?{2,4})(?:\s*[-–\/]\s*(?:19|20)?\d{2})?(?!\d)/;
const RENAME_RE = /^([^,]{1,40}),\s*((?:[A-Z]{1,3}|Irlande)\??(?:\s*[\dA-Z?][\d\s]*[A-Z]?)?)\s*$/;

// Codes de classement que l'auteur place devant le nom en tête de fiche :
// « M13 », « F19 », « CQ37 », « M4bis », « O5 », « Max 11 », « Max CA », « Max Oman », « OD 4 ».
const CODE_TOKEN = /^(?:[A-Z]{1,4}\d{1,4}(?:bis|[a-z])?|O\d{1,2}|Max\d{1,3})$/;
export function stripCode(name) {
  const t = name.split(/\s+/);
  if (t[0] === 'Max' && t.length > 2) { t.shift(); if (/^(\d{1,3}|[A-Z][A-Za-z]{1,4})$/.test(t[0]) && t.length > 1) t.shift(); }
  else if (/^[A-Z]{1,3}$/.test(t[0]) && /^\d{1,4}$/.test(t[1] || '') && t.length > 2) t.splice(0, 2);
  while (t.length > 1 && CODE_TOKEN.test(t[0])) t.shift();
  return t.join(' ');
}
const TYPE_WORD = /\s*,?\s*\b(?:tri(?:maran)?|cata(?:maran)?|mono(?:coque)?)\b(?:\s*[A-Z]{0,3}\s*[\d?]+)?\s*$/i;
const SAIL_PART = /^(?:[A-Z]{1,3}\??\s*[\d?][\d\s?]*[A-Z!]?|\d{1,6}|\?+)(?:\s+ou\s+\d{1,6})?$/;
// Première ligne d'une fiche : « NOM, FRA 53, Tri », « Max 11 SODEBO 2, Tri », « O8, Jet Services V, 77 », « A52 ??, FRA 79 ».
// Renvoie { name, sail } (name vide si l'auteur ne connaît pas encore le nom), ou null si la ligne n'est pas un en-tête.
function parseHeader(text) {
  // « BOXX, SLO 40, No coque: 58 » : le numéro de coque en complément n'empêche pas de lire l'en-tête.
  const t = text.trim().replace(/,?\s*No\.? coque\s*:?\s*\d+\s*$/i, '');
  if (t.length > 70 || /:/.test(t) || ENTRY_YEAR_RE.test(t) || UPDATED_RE.test(t)) return null;
  // Ligne de menu de la page (« Histoiredeshalfs Sommaire ») : pas un en-tête (relecture du 09/11/2026).
  if (NAV_RE.test(t) || /sommaire|liste alphab|histoiredeshalfs/i.test(t)) return null;
  // Minis, sans virgule : « FRA 483 CALIMERO F9s », « 197 ZIGOMAR F11 » : numéro (nationalité facultative), nom, code de plan.
  const miniHead = !/,/.test(t) && t.match(/^((?:[A-Z]{2,3}\s?)?\d{1,4})\s+(.{2,45}?)\s+([A-Z]{1,3}\d{1,3}[A-Za-z]{0,2}\??)$/);
  if (miniHead && /[A-Za-z]{2}/.test(miniHead[2])) return { name: miniHead[2].trim(), sail: miniHead[1], numberFirst: true };
  // « AZAWAKH III FRA 11 » : nom et numéro de voile sans virgule.
  const noComma = !/,/.test(t) && t.match(/^(.{2,45}?)\s+([A-Z]{2,3}\s?\d{1,5})$/);
  if (noComma && /[A-Za-z]{2}/.test(noComma[1])) return { name: stripCode(noComma[1].trim()), sail: noComma[2] };
  const hasCode = CODE_TOKEN.test(t.split(/\s+/)[0]) || /^Max\s/.test(t);
  if (!/,/.test(t) && !hasCode) return null;
  // « Bambina, I 9295 (or 9255) » : la variante entre parenthèses ne fait pas partie du numéro.
  let parts = t.split(',').map((p) => p.replace(/\s*\((?:or|ou)\b[^)]*\)\s*$/i, '').trim()).filter(Boolean);
  if (parts.length > 4) return null;
  while (parts.length > 1 && CODE_TOKEN.test(parts[0])) parts.shift();
  // En-tête des Minis : le numéro de voile d'abord (« FRA 1075, Krekre, ou Petit Cheval, TM04 »).
  let leadSail = '';
  // « A52 ??, FRA 79 », « ZED 3, BEL 44 » : quand la partie suivante est elle-même un numéro, la première n'en est pas un.
  const isSail = (p) => p && SAIL_PART.test(p) && /\d/.test(p);
  if (parts.length > 1 && isSail(parts[0]) && !isSail(parts[1])) leadSail = parts.shift();
  // « ou Petit Cheval » : un surnom, pas le nom.
  parts = parts.filter((p) => !/^ou\s/i.test(p));
  const typeless = parts.filter((p) => !/^(?:tri(?:maran)?|cata(?:maran)?|mono(?:coque)?)\b/i.test(p));
  let name = stripCode((typeless[0] || '').replace(TYPE_WORD, '').trim());
  // Minis : le code de plan suit le nom (« FRA 533, KIRIKOU NS7 » : plan Nivelt NS7) ; il n'appartient pas au nom.
  // Le code peut être suivi de la série (« LUNA D78 Lombard 7 », « LEAR JET R5S »).
  if (leadSail) name = name.replace(/\s+(?:[A-Z]{1,3}|[A-Z]\s|[a-z]{2})\d{1,3}[a-zA-Z]{0,2}(?:\s+[A-Za-z][a-z]+){0,3}(?:\s+\d+)?$/, '').trim();
  // Un « nom » qui n'est qu'un numéro de voile (« POL 961 ») n'est pas un nom.
  if (/^[A-Z]{2,3}\s?\d{1,5}$/.test(name)) name = '';
  const sail = leadSail || typeless.slice(1).find((p) => SAIL_PART.test(p)) || '';
  if (!name || (name.match(/\?/g) || []).length > name.length / 4 || !/[A-Za-z]{2}/.test(name)) name = '';
  // Sans virgule ni code, ou avec une suite qui n'est ni un numéro ni un type, ce n'est pas un en-tête.
  // Numéro encore inconnu de l'auteur (« ?, ??? ??? », « Abelone II, ? ???? ») : c'est bien un en-tête.
  const unknownSail = typeless.length > 1 && typeless.slice(1).every((p) => /^[A-Z]{0,3}\s?\?[\s?]*$/.test(p));
  if (typeless.length > 1 && !sail && !hasCode && !leadSail && !unknownSail) return null;
  // Numéro en tête (Minis) : l'auteur y tient à jour le nom actuel du bateau.
  return { name, sail: sail.replace(/!$/, ''), numberFirst: !!leadSail };
}

const NOT_A_BOAT_NAME = /\b(TRANSAT|GLOBE|RHUM|FASTNET|CUP|RACE|COURSE|TROPH[EÉ]E|CHAMPIONNAT|CHAMPION|R[EÉ]GATES?|SOLITAIRE|TOUR|PHOTOS?|PICTURES?|R[EÉ]SULTATS?|PALMAR[EÈ]S|HISTOIRE|SOMMAIRE|INTRODUCTION|VENDRE|VENDU|SALE|SOLD|ARCHIVES?|REVUE|ARTICLES?|NOTES?|SOURCES?|INCONNUS?|UNKNOWN|IDEM|NB|PS|FIN|END|ABANDONN[EÉ]E?S?|COUL[EÉ]E?|D[EÉ]TRUITE?|NAUFRAG[EÉ]E?|[EÉ]PAVE|DISPARUE?|TRANSFORM[EÉ]E?|LOOKING)\b/;
// Nationalités des numéros de voile (sans LUX : « ARMOR LUX 77 » est un nom).
const NAT = '(?:FRA|GBR|ITA|ESP|GER|SUI|BEL|NED|NDL|NOR|SWE|FIN|DEN|AUS|NZL|USA|CAN|IRL|POR|CRO|CZE|AUT|BRA|JPN|RSA|POL|SLO|HUN|ARG|MON)';
const isCapsName = (s) => s.length >= 3 && s.length <= 40 && !/[a-zà-ÿ]/.test(s) && (s.match(/[A-ZÀ-Ý]/g) || []).length >= 3
  && s.split(/\s+/).length <= 6 && !/[:;!?]|^\d|\d{4}/.test(s) && !/^(?:[A-ZÀ-Ý] ){2,}[A-ZÀ-Ý]$/.test(s) && !NOT_A_BOAT_NAME.test(s);

// knownNames : noms du bateau relevés dans la liste de la série ; ils permettent de reconnaître un changement
// de nom écrit sans numéro de voile (« Vulnérable, »).
export function parseDossier(blocks, knownNames = []) {
  const known = new Set(knownNames.map(fold));
  const out = { updated: '', intro: [], entries: [], names: [] };
  let i = 0;
  while (i < blocks.length && i < 6 && blocks[i].type === 'p' && (NAV_RE.test(blocks[i].text) || blocks[i].links.length >= 3 && blocks[i].text.length < 160)) i++;
  let current = null;
  const push = (b) => (current ? current.blocks : out.intro).push(b);
  for (; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'img') { push(b); continue; }
    if (b.text.length < 60) {
      const up = b.text.match(UPDATED_RE);
      if (up && !out.updated) { out.updated = up[1].trim(); continue; }
    }
    // En-tête de fiche (toute première ligne, avant toute entrée datée) : il donne le titre du dossier et n'est pas affiché.
    // Une photo peut précéder l'en-tête (trimaran Macif, « M13 Macif, ») : elle n'empêche pas de le lire.
    if (!out.entries.length && !out.title && !out.intro.some((x) => x.type !== 'img')) {
      const h = parseHeader(b.text);
      if (h) {
        if (h.name) { out.title = h; out.names.push(h); }
        continue;
      }
    }
    let rn = b.text.match(RENAME_RE);
    const bare = !rn && b.text.match(/^["“«]?([^,"“”«»]{2,40}?)["”»]?\s*,?\s*$/);
    if (bare && known.has(fold(bare[1].trim()))) rn = [b.text, bare[1], ''];
    // Nom absent de la liste, mais écrit comme l'auteur écrit les noms : seul sur sa ligne, en capitales (« CULTISOL »),
    // une fois la chronologie commencée. Les intertitres de course ou de rubrique ne sont pas des noms.
    else if (bare && out.entries.length && isCapsName(bare[1].trim())) {
      // Numéro de voile collé au nom (« AUS 196 MINI MINX », « HUGO BOSS GBR 88 ») ; un numéro seul n'est pas un nom.
      const s = bare[1].trim().replace(/[.…]+$/, '');
      const lead = s.match(new RegExp(`^(${NAT}\\s?\\d{1,4})(?:\\s+(.+))?$`)), trail = s.match(new RegExp(`^(.+?)\\s+(${NAT}\\s?\\d{1,4})$`));
      if (!lead || lead[2]) rn = lead ? [b.text, lead[2], lead[1]] : trail ? [b.text, trail[1], trail[2]] : [b.text, s, ''];
      if (rn && process.env.AUDIT_NOMS) console.error(`NOM\t${rn[1]}\t${rn[2]}`);
    }
    // Nom encore inconnu de l'auteur (« R???? ??a ») : ce n'est pas un nom exploitable.
    if (rn && (rn[1].match(/\?/g) || []).length > rn[1].length / 4) rn = null;
    if (rn && !ENTRY_YEAR_RE.test(b.text) && b.text.length <= 48) {
      // Retire le code de fichier de l'auteur en tête du nom (« F19 NAT'CHE » -> « NAT'CHE »).
      const n = { name: stripCode(rn[1].trim()), sail: rn[2].trim() };
      out.names.push(n);
      // Nom placé en tête de fiche, avant toute entrée datée : c'est le titre que l'auteur donne au dossier.
      if (!out.entries.length && !out.title) { out.title = n; continue; }
      // atLaunch : le nom suit directement la ligne de construction (« 2003 plan Finot, Pogo 2 No15 », puis « CULTISOL »).
      const built = out.entries.length === 1 && out.entries[0].fromYearLine ? out.entries[0].blocks.filter((x) => x.type === 'p') : null;
      current = { year: current?.year || '', rename: n, blocks: [], atLaunch: !!built && built.length <= 2 };
      out.entries.push(current);
      continue;
    }
    const ym = b.text.match(ENTRY_YEAR_RE);
    if (ym) {
      current = { year: ym[1], blocks: [b], fromYearLine: true };
      out.entries.push(current);
      continue;
    }
    push(b);
  }
  // Fusionne les entrées « renommage » vides avec l'entrée suivante.
  for (let k = 0; k < out.entries.length - 1; k++) {
    const e = out.entries[k], nx = out.entries[k + 1];
    if (e.rename && !e.blocks.some((b) => b.type === 'p') && !nx.rename) {
      // renameYear : l'année où le nom est écrit (« 2003 plan Finot » puis « CULTISOL » : nom de la mise à l'eau),
      // même s'il s'affiche avec l'entrée suivante (2004).
      nx.rename = e.rename; nx.blocks = [...e.blocks, ...nx.blocks];
      if (e.atLaunch) nx.renameYear = e.year;
      out.entries.splice(k, 1); k--;
    }
  }
  // Année mal saisie par l'auteur : une même année répétée, puis un saut de deux ans
  // (« 2019 … 2019 12 février, The Transat annulée (Covid) … 2021 ») : l'entrée répétée est l'année intermédiaire.
  // La correction est signalée (yearFixed garde l'année écrite dans la source).
  const yearLines = out.entries.filter((e) => e.fromYearLine && /^(19|20)\d{2}$/.test(e.year));
  for (let k = 1; k < yearLines.length - 1; k++) {
    const prev = Number(yearLines[k - 1].year), cur = Number(yearLines[k].year), next = Number(yearLines[k + 1].year);
    if (cur !== prev || next !== cur + 2) continue;
    const from = out.entries.indexOf(yearLines[k]), to = out.entries.indexOf(yearLines[k + 1]);
    for (const e of out.entries.slice(from, to)) if (e.year === String(cur)) { e.yearFixed = e.year; e.year = String(cur + 1); }
  }
  // Fiche technique en tête, datée de la mise à l'eau (« 2017 Plan VPLP… Chantier CDK », puis l'historique depuis
  // l'annonce du projet en 2015) : elle passe en introduction au lieu d'ouvrir la chronologie à rebours.
  const y0 = Number(out.entries[0]?.year), y1 = Number(out.entries[1]?.year);
  if (out.entries[0]?.fromYearLine && !out.entries[0].rename && y0 && y1 && y0 > y1) {
    out.specYear = String(y0);
    out.intro.push(...out.entries.shift().blocks);
  }
  const first = (out.specYear ? out.intro.find((b) => b.type === 'p')?.text : '') || out.entries.find((e) => e.blocks[0]?.type === 'p')?.blocks[0]?.text || '';
  // La ligne de construction peut suivre une ligne parasite (« Plus de photos - More pictures ») : on lit les premières lignes.
  const firstLines = [first, ...[...out.intro, ...(out.entries[0]?.blocks || [])].filter((b) => b.type === 'p').map((b) => b.text).slice(0, 4)];
  out.designer = firstLines.map(designerOf).find(Boolean) || '';
  return out;
}

// Chantier d'un bateau, tel que la fiche l'écrit en tête (« construit chez Pichavant », « Chantier : CDK Technologie »).
export const BUILDER_RE = /(?:construit|construction|built|fabriqu[ée])\s+(?:chez|par|by|at|au chantier)\s+(?:le chantier\s+|les chantiers\s+)?([A-ZÀ-Ý][\w'’&.\- ]{1,28}?)(?=\s*[,.;:(/]|\s+(?:en|in|à|au|pour|sur|et|and|avec|sous|de|du)\b|$)|\bchantiers?\s*:\s*([A-ZÀ-Ý][\w'’&.\- ]{1,28}?)(?=\s*[,.;:(/]|\s+(?:en|in|à|au|pour|sur|et|and|avec)\b|$)/;

// Architecte et chantier lus dans la ligne de construction (relecture du 09/11/2026 : l'ancienne règle ne lisait pas
// les lettres accentuées, « plan Harlé », « Lauriot-Prévost », « chez CDK à Port La Forêt », et manquait 50 IMOCA sur 142).
// Fin du nom : ponctuation, ou mot qui ouvre la suite de la phrase (« en aluminium », « à Vannes », « de 3m »…).
const NAME_END = /[,;:(!#"=]|\s(?:[Cc]onstruit|[Cc]onstruction|[Bb]uilt|chez|by|en|in|à|a|au|aux|dans|sister|même|meme|avec|pour|sur|from|using|lf|Lf|LOA|loa|[lL]\s*:|No|no|n°|NZ|France|Italy|Italie|UK|GB|inspiré|modifié|prototype|largeur)(?=\s|$|[,.:;])|\s(?:de|du|des|d'|le|la|les|et)\s*(?=[a-zà-ÿ\d])|\s\d|(?<=\p{L})-\s/u;
const cutName = (s) => {
  const i = s.search(NAME_END);
  let n = (i >= 0 ? s.slice(0, i) : s);
  // Un point après un mot complet termine la phrase ; « G. Verdier » (initiale) n'est pas une fin.
  n = n.split(/(?<=\p{L}{2})\.(?:\s|$)/u)[0];
  return n.replace(/[\s.\-–\/]+$/, '').replace(/\s+(?:de|du|des|d'|le|la|les|et|and)$/i, '').trim();
};
export function designerOf(text) {
  const m = String(text || '').match(/(?:^|[\s\d])plans?\s+([A-ZÀ-Ý].*)$/iu);
  if (!m) return '';
  const n = cutName(m[1]);
  return n.length >= 2 && n.length <= 40 && /^\p{Lu}/u.test(n) ? n : '';
}
const NOT_A_BUILDER = /^(?:son|sa|ses|un|une|le|la|les|lui|elle|il|lui même|lui-même|eux|moi)$/i;
const BUILDER_PATTERNS = [
  // « construit chez Mag », « construit par le chantier italien Persico », « construit en aluminium au chantier Pouvreau »,
  // « construit dans le moule de PRB 08 par CDK technologie-Mer Agitée »
  /(?:[Cc]onstruit|[Cc]onstruite|[Bb]uilt|[Ff]abriqu[ée]e?)[^.;]{0,50}?\s(?:chez|par|by|at|au chantier|au chantie|aux chantiers)\s+(?:(?:le|les) chantiers?\s+(?:(?!de\s|du\s|d')\p{Ll}+\s+)?|chantier\s+)?(?:de\s+|du\s+|d')?([\p{Lu}\d].*)$/u,
  // « construction Janneau », « construction JJ Provoyeur »
  /\bconstruction\s+([\p{Lu}].*)$/u,
  // « chantier Hervé et Pinta », « Chantier : CDK Technologie », « Builders: Bergstrom & Ridder »
  /(?:^|[\s,.])(?:[Cc]hantiers?|[Bb]uilders?|[Ss]hipyard)\s*:?\s+(?:de\s+|du\s+|d')?([\p{Lu}].*)$/u,
];
export function builderFrom(text) {
  for (const re of BUILDER_PATTERNS) {
    const m = String(text || '').match(re);
    if (!m) continue;
    const n = cutName(m[1]).replace(/\s+(?:shipyard|boat ?builders?)$/i, '');
    if (n.length >= 2 && n.length <= 40 && /\p{L}{2}/u.test(n) && !NOT_A_BUILDER.test(n)) return n;
  }
  return '';
}
