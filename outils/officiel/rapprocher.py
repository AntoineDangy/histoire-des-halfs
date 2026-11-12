"""Rapproche les fiches des sites officiels de classe (imoca.org, class40.com) des fiches bateaux du site.

Entrées : donnees/site/imoca.org/bateaux.json, donnees/site/class40.com/bateaux.json (outils/scraping/imoca.mjs, class40.mjs)
          site/public/data/bateaux.json (construction du site : node site/tools/build.mjs)
          site/content/officiel-rapprochements.json : rapprochements fixés à la main (prioritaires), facultatif
Sortie :  site/content/officiel.json, lu par la construction du site (encadré « Selon la classe » et fiches ajoutées)
          controles/<date>/officiel-<classe>.md : rapprochements, bateaux nouveaux, désaccords avec l'auteur à vérifier
Règle : on rapproche par numéro de coque (Class40) ou par nom (baptême, nom actuel, noms successifs) + année ;
        en cas de doute (plusieurs candidats, années incompatibles), pas de rapprochement : le cas est listé dans le rapport.
"""
import datetime, json, re, unicodedata
from pathlib import Path

R = Path(__file__).resolve().parents[2]


def plier(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\(\d\)', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


VIDES = {'design', 'yacht', 'yachts', 'technologies', 'marine', 'boats', 'chantier', 'shipyard', 'and', 'et', 'des', 'les'}


def mots(s):
    return {m for m in plier(s).split() if len(m) >= 3 and m not in VIDES}


def annee(v):
    m = re.search(r'(19|20)\d\d', str(v or ''))
    return int(m.group(0)) if m else None


def main():
    site = json.load(open(R / 'site/public/data/bateaux.json', encoding='utf-8'))
    fixes_path = R / 'site/content/officiel-rapprochements.json'
    fixes = json.load(open(fixes_path, encoding='utf-8')) if fixes_path.exists() else {}
    sortie = {'_lisez-moi': "Données des sites officiels de classe, rapprochées des fiches du site par outils/officiel/rapprocher.py "
                            "(régénéré, ne pas corriger à la main : fixer un rapprochement dans officiel-rapprochements.json). "
                            "Affichées « selon la classe », sans remplacer les données de l'auteur."}
    date = datetime.date.today().isoformat()
    rap_dir = R / 'controles' / date
    rap_dir.mkdir(parents=True, exist_ok=True)
    for cle, dossier, classe, serie in [('imoca', 'imoca.org', 'IMOCA 60', 'imoca'), ('class40', 'class40.com', 'Class 40', 'class-40')]:
        src = R / 'donnees/site' / dossier / 'bateaux.json'
        if not src.exists():
            continue
        off = json.load(open(src, encoding='utf-8'))
        nos = [b for b in site if b['classe'] == classe and b['fiche']]
        par_nom = {}
        for b in nos:
            for n in set(b['noms'] + [b['bapteme'], b['actuel'] or '']):
                k = plier(n)
                if len(k) >= 3 and not k.isdigit():
                    par_nom.setdefault(k, set()).add(b['fiche'])
        par_num = {}
        if cle == 'class40':
            for b in nos:
                m = re.search(r'\d+', b['numero'] or '')
                if m:
                    par_num.setdefault(int(m.group(0)), set()).add(b['fiche'])
        fiche_de = {b['fiche']: b for b in nos}
        lignes, nouveaux, doutes, ecarts = [], [], [], []
        for o in off['bateaux']:
            ident = o['fiche']
            nom = o.get('nom') or o.get('bapteme') or f"n° {o.get('numero')}"
            a_off = o.get('annee') or (o.get('lancement') if isinstance(o.get('lancement'), int) else annee(o.get('lancement')))
            cands = set()
            for n in (o.get('bapteme'), o.get('nom')):
                cands |= par_nom.get(plier(n), set())
            if cle == 'class40' and o.get('numero') in par_num:
                pn = par_num[o['numero']]
                cands = (cands & pn) or pn if cands else pn
            # Année incompatible (plus de 1 an d'écart avec la construction connue) : on écarte le candidat.
            ok = {c for c in cands if not (a_off and annee(fiche_de[c]['annee']) and abs(annee(fiche_de[c]['annee']) - a_off) > 1)}
            if ident in fixes:
                ok = {fixes[ident]} if fixes[ident] else set()
                cands = ok or {'(aucun : fixé à la main)'}
                if not ok:
                    doutes.append((nom, [], a_off)); o['fiche_site'] = None; continue
            if len(ok) == 1:
                f = ok.pop()
                o['fiche_site'] = f
                b = fiche_de.get(f, {})
                # Écritures différentes d'un même nom (« VPLP et Guillaume Verdier » / « VPLP - Verdier ») : pas un désaccord.
                for champ, nous in (('architecte', b.get('architecte')), ('chantier', b.get('chantier'))):
                    if o.get(champ) and nous and not (mots(nous) & mots(o[champ])):
                        ecarts.append((nom, f, champ, nous, o[champ]))
                if a_off and annee(b.get('annee')) and abs(annee(b.get('annee')) - a_off) > 1:
                    ecarts.append((nom, f, 'année', b.get('annee'), a_off))
                lignes.append((nom, f))
            elif len(ok) > 1 or cands:
                o['fiche_site'] = None
                doutes.append((nom, sorted(cands), a_off))
            else:
                o['fiche_site'] = None
                nouveaux.append(o)
        sortie[serie] = {'source': off['source'], 'date': off['date'], 'bateaux': off['bateaux']}
        md = [f'# Site officiel {dossier} : rapprochement avec nos fiches ({date})', '',
              f'- Fiches officielles : {len(off["bateaux"])} ; rapprochées : {len(lignes)} ; absentes de notre site (fiche ajoutée) : {len(nouveaux)} ; '
              f'doutes (pas de rapprochement) : {len(doutes)} ; désaccords à vérifier : {len(ecarts)}.', '',
              '## Désaccords avec l\'auteur (rien n\'est corrigé : à vérifier)', '', '| Bateau | Notre fiche | Champ | Notre site | Site de la classe |', '|---|---|---|---|---|']
        md += [f'| {a} | {b} | {c} | {d} | {e} |' for a, b, c, d, e in ecarts]
        md += ['', '## Doutes (rapprochement à fixer à la main dans site/content/officiel-rapprochements.json)', '', '| Bateau | Candidats | Année officielle |', '|---|---|---|']
        md += [f'| {a} | {", ".join(b) or "—"} | {c or ""} |' for a, b, c in doutes]
        md += ['', '## Absents de notre site', '', '| Bateau | Numéro | Année | Skipper |', '|---|---|---|---|']
        md += [f'| {o.get("nom") or o.get("bapteme") or o.get("numero")} | {o.get("numero") or ""} | {o.get("annee") or o.get("lancement") or ""} | {o.get("skipper") or ""} |' for o in nouveaux]
        md += ['', '## Rapprochés', '', '| Bateau | Notre fiche |', '|---|---|'] + [f'| {a} | {b} |' for a, b in lignes]
        (rap_dir / f'officiel-{cle}.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
        print(f'{dossier} : {len(lignes)} rapprochés, {len(nouveaux)} absents, {len(doutes)} doutes, {len(ecarts)} désaccords')
    json.dump(sortie, open(R / 'site/content/officiel.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
