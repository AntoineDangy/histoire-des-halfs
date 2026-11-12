// Lecture et nettoyage des pages d'origine (HTML FrontPage, windows-1252).
import fs from 'node:fs';
import path from 'node:path';

export const ORIGIN = 'https://www.histoiredeshalfs.com/';
export const SRC = path.resolve('_source/html');

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', auml: 'ä', aring: 'å', ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', oslash: 'ø', ucirc: 'û', ugrave: 'ù', uuml: 'ü', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', Ouml: 'Ö', Uuml: 'Ü', Auml: 'Ä', Aring: 'Å', Oslash: 'Ø', szlig: 'ß', ntilde: 'ñ', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', deg: '°', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', euro: '€', copy: '©', reg: '®', times: '×', frac12: '½', frac14: '¼', frac34: '¾', middot: '·', oelig: 'œ', OElig: 'Œ', aelig: 'æ', AElig: 'Æ', pound: '£', yen: '¥', cent: '¢', sect: '§', plusmn: '±', sup2: '²', ordm: 'º', ordf: 'ª', shy: '', bull: '•', trade: '™', atilde: 'ã', otilde: 'õ', Oacute: 'Ó', Aacute: 'Á', Iacute: 'Í', Uacute: 'Ú', Ntilde: 'Ñ', Ecirc: 'Ê', Ocirc: 'Ô', yacute: 'ý', thorn: 'þ', eth: 'ð', Iuml: 'Ï', Euml: 'Ë', Acirc: 'Â', Icirc: 'Î', Ucirc: 'Û', Ugrave: 'Ù', Atilde: 'Ã', Otilde: 'Õ', igrave: 'ì', ograve: 'ò', Igrave: 'Ì', Ograve: 'Ò' };
export const decodeEntities = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) === 146 ? 8217 : Number(d)))
  .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITIES[n] ?? m);

// Retire les balises fermantes orphelines et referme celles restées ouvertes (strong, em) :
// le découpage en blocs coupe souvent au milieu d'un <strong> FrontPage.
export function balance(html) {
  const stack = [];
  const out = html.replace(/<(\/?)(strong|em)>/g, (m, close, tag) => {
    if (!close) { stack.push(tag); return m; }
    const i = stack.lastIndexOf(tag);
    if (i < 0) return '';
    stack.splice(i, 1);
    return m;
  });
  return out + stack.reverse().map((t) => `</${t}>`).join('');
}

export const esc =(s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Écran anti-robots du serveur d'origine (parfois archivé tel quel par la Wayback Machine) : ce n'est pas la page.
export const isChallenge = (text) => /request is being verified|checking your browser|just a moment\.\.\./i.test(text.slice(0, 20000));

export function readSource(rel) {
  const file = path.join(SRC, ...rel.split('/'));
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  if (isChallenge(buf.toString('latin1'))) return null;
  const head = buf.subarray(0, 2048).toString('latin1');
  const cs = ((head.match(/charset=["']?([\w-]+)/i) || [])[1] || 'windows-1252').toLowerCase();
  let html;
  try { html = new TextDecoder(cs === 'iso-8859-1' ? 'windows-1252' : cs).decode(buf); }
  catch { html = new TextDecoder('windows-1252').decode(buf); }
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  return { rel, html, body };
}

// Résout un href relatif d'une page d'origine en chemin relatif à la racine du site d'origine.
export function resolveRel(href, fromRel) {
  try {
    const u = new URL(href.trim(), ORIGIN + fromRel.split('/').map(encodeURIComponent).join('/'));
    if (!/histoiredeshalfs\.com$/i.test(u.hostname)) return null;
    return decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch { return null; }
}
export const originUrl = (rel) => ORIGIN + rel.split('/').map(encodeURIComponent).join('/');

// Découpe le corps d'une page en blocs : { type: 'p', html, text, links[] } ou { type: 'img', src, w, h }.
// linkFor(rel) renvoie l'URL du nouveau site pour une page d'origine, ou null (lien vers l'archive d'origine).
export function toBlocks(body, fromRel, linkFor = () => null) {
  const s = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => `\u0001${tag}\u0001`)
    .replace(/<\/?(p|div|br|tr|table|li|ul|ol|h[1-6]|center|blockquote|hr)\b[^>]*>/gi, '\u0001');
  const blocks = [];
  for (const raw of s.split('\u0001')) {
    if (/^<img\b/i.test(raw)) {
      const src = (raw.match(/src\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
      const rel = src && resolveRel(src, fromRel);
      if (rel) blocks.push({ type: 'img', src: rel, w: Number((raw.match(/width\s*=\s*["']?(\d+)/i) || [])[1]) || null, h: Number((raw.match(/height\s*=\s*["']?(\d+)/i) || [])[1]) || null });
      continue;
    }
    const links = [];
    let html = raw
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const text = inner.replace(/<[^>]+>/g, '');
        if (!text.trim()) return '';
        if (/^mailto:/i.test(href)) return `<a href="${esc(href)}">${text}</a>`;
        const rel = resolveRel(href, fromRel);
        if (rel === null) return /^https?:/i.test(href) ? `<a href="${esc(href)}" rel="noopener" target="_blank">${text}</a>` : text;
        links.push({ rel, text: decodeEntities(text).replace(/\s+/g, ' ').trim() });
        const target = linkFor(rel);
        return target ? `<a href="${esc(target)}">${text}</a>` : `<a href="${esc(originUrl(rel))}" class="ext" rel="noopener" target="_blank">${text}</a>`;
      })
      .replace(/<(strong|b)\b[^>]*>/gi, '<strong>').replace(/<\/(strong|b)>/gi, '</strong>')
      .replace(/<(em|i)\b[^>]*>/gi, '<em>').replace(/<\/(em|i)>/gi, '</em>')
      .replace(/<(?!\/?(a|strong|em)\b)[^>]+>/gi, '');
    html = decodeEntities(html.replace(/&(lt|gt|amp|quot);/gi, '\u0002$1;')).replace(/\u0002/g, '&').replace(/&(?![a-z]+;|#)/g, '&amp;').replace(/\s+/g, ' ').trim();
    html = balance(html).replace(/<(strong|em)>\s*<\/\1>/g, '').trim();
    // Texte brut décodé (« B&Q », pas « B&amp;Q ») : il est ré-échappé à l'affichage.
    const text = decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text || /^[\s\-–,.?]*$/.test(text) && !text.includes('?')) continue;
    // « Loader » : texte résiduel d'un module (diaporama) de la page d'origine.
    if (/^loader$/i.test(text)) continue;
    blocks.push({ type: 'p', html, text, links });
  }
  return blocks;
}
