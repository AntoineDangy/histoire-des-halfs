/* Page « Classement » : totaux calculés dans le navigateur à partir de data/classement.json
   (un résultat par ligne : marin, année, classe, points, bateau, victoire, course comptée, ligne retenue pour le bateau).
   Données produites par outils/classement/calculer.py lors de la construction du site. */
(function () {
  const bar = document.querySelector('[data-classement]');
  if (!bar) return;
  const root = document.documentElement.dataset.root || '../';
  const $ = (id) => document.getElementById(id);
  const corps = $('cl-corps'), plus = $('cl-plus'), titre = $('cl-titre');
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plier = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let D = null, mode = 'marins', montres = 100, liste = [];

  // Choix du lecteur gardés dans l'adresse (#marins/IMOCA/10/2026) pour pouvoir partager un classement.
  function lireAdresse() {
    const p = decodeURIComponent(location.hash.slice(1)).split('/');
    if (p[0] === 'bateaux' || p[0] === 'marins') mode = p[0];
    if (p[1] !== undefined && [...$('cl-classe').options].some((o) => o.value === p[1])) $('cl-classe').value = p[1];
    if (p[2] && [...$('cl-periode').options].some((o) => o.value === p[2])) $('cl-periode').value = p[2];
    if (p[3] && [...$('cl-ref').options].some((o) => o.value === p[3])) $('cl-ref').value = p[3];
    if (p[2] === 'libre' && p[4] && p[5]) { $('cl-de').value = p[4]; $('cl-a').value = p[5]; }
  }
  function ecrireAdresse(per) {
    const parts = [mode, $('cl-classe').value, per, $('cl-ref').value];
    if (per === 'libre') parts.push($('cl-de').value, $('cl-a').value);
    history.replaceState(null, '', '#' + parts.map(encodeURIComponent).join('/'));
  }

  function bornes() {
    const per = $('cl-periode').value, ref = +$('cl-ref').value;
    $('cl-libre-wrap').hidden = per !== 'libre';
    $('cl-ref-wrap').hidden = per === 'libre';
    if (per === 'libre') { const a = +$('cl-de').value, b = +$('cl-a').value; return [Math.min(a, b), Math.max(a, b), per]; }
    if (per === 'all') return [D.debut, ref, per];
    return [ref - (+per) + 1, ref, per];
  }

  function calculer() {
    const [de, a, per] = bornes();
    const classe = $('cl-classe').value;
    const ci = classe ? D.classes.indexOf(classe) : -1;
    const tot = new Map();
    for (const [m, y, c, pts, b, v, n, pb] of D.r) {
      if (y < de || y > a || (classe && c !== ci)) continue;
      const k = mode === 'marins' ? m : b;
      // Un bateau ne compte un résultat qu'une fois, quel que soit le nombre de marins à bord.
      if (k < 0 || (mode === 'bateaux' && !pb)) continue;
      let t = tot.get(k);
      if (!t) tot.set(k, (t = { k, p: 0, n: 0, v: 0, cl: new Map() }));
      t.p += pts; t.n += n; t.v += v; t.cl.set(c, (t.cl.get(c) || 0) + pts);
    }
    liste = [...tot.values()].sort((x, y) => y.p - x.p || y.v - x.v);
    // Rang partagé à points égaux (arrondis au dixième).
    let rang = 0, prec = null;
    liste.forEach((t, i) => { const r = Math.round(t.p * 10); if (r !== prec) { rang = i + 1; prec = r; } t.rang = rang; });
    const quoi = mode === 'marins' ? 'marins' : 'bateaux';
    titre.textContent = `${liste.length.toLocaleString('fr-FR')} ${quoi} classés · ${classe || 'toutes classes'} · ${de === a ? a : `${de}-${a}`}`;
    $('cl-col-nom').textContent = mode === 'marins' ? 'Marin' : 'Bateau';
    $('cl-col-classe').textContent = classe ? 'Classe' : 'Classes';
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === mode)));
    ecrireAdresse(per);
    montres = 100;
    afficher();
  }

  function ligne(t) {
    const [id, nom] = mode === 'marins' ? D.marins[t.k] : D.bateaux[t.k];
    const href = mode === 'marins' ? `${root}skippers/${id}/` : `${root}${id}`;
    const cls = [...t.cl.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => D.classes[c]);
    return `<tr><td data-v="${t.rang}">${t.rang}</td><td><a href="${esc(href)}">${esc(nom || id)}</a></td>`
      + `<td>${cls.slice(0, 3).map((c) => `<span class="pill">${esc(c)}</span>`).join(' ')}${cls.length > 3 ? ` <span class="meta">+${cls.length - 3}</span>` : ''}</td>`
      + `<td class="num">${fmt.format(t.p)}</td><td class="num">${t.n || ''}</td><td class="num">${t.v || ''}</td></tr>`;
  }

  function afficher() {
    const q = plier($('cl-filtre').value.trim());
    const nomDe = (t) => (mode === 'marins' ? D.marins[t.k][1] : D.bateaux[t.k][1]) || '';
    const vus = q ? liste.filter((t) => plier(nomDe(t)).includes(q)) : liste;
    corps.innerHTML = vus.length ? vus.slice(0, montres).map(ligne).join('') : '<tr><td colspan="6">Aucun résultat pour ce choix.</td></tr>';
    plus.hidden = vus.length <= montres;
  }

  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; calculer(); } });
  ['cl-classe', 'cl-periode', 'cl-ref', 'cl-de', 'cl-a'].forEach((id) => $(id).addEventListener('change', calculer));
  $('cl-filtre').addEventListener('input', () => { montres = 100; afficher(); });
  plus.addEventListener('click', () => { montres += 100; afficher(); });

  fetch(bar.dataset.classement).then((r) => r.json()).then((d) => { D = d; lireAdresse(); calculer(); })
    .catch(() => { corps.innerHTML = '<tr><td colspan="6">Le classement n’a pas pu être chargé.</td></tr>'; });
})();
