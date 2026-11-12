"""Premier jet du classement des marins, par classe et toutes classes.

Entrées (aucun réseau, quelques secondes) :
  donnees/site/palmares.csv   palmarès exporté par la construction du site (node site/tools/build.mjs)
  donnees/niveaux_courses.csv niveau de chaque course, par motifs de noms (proposition à valider)
  donnees/bareme_*.csv, donnees/parametres.csv
Sorties :
  sorties/classement/points.csv        une ligne par résultat retenu, avec le détail du calcul
  sorties/classement/classement.csv    total par marin, classe et période
  controles/<date>/classement-premier-jet.md  rapport lisible (meilleurs marins, courses non reconnues)

Usage : python outils/classement/calculer.py [--annee 2026]
"""
import argparse, csv, datetime, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
D = RACINE / 'donnees'

# Écriture officielle des classes (docs/decisions.md) à partir des intitulés du site.
CLASSES = {'IMOCA 60': 'IMOCA', 'Class 40': 'Class40', 'Figaro Bénéteau': 'Figaro', 'MOD 70': 'MOD70', 'ORMA 60′': 'ORMA 60',
           'Ultim': 'Ultim', 'Ocean Fifty': 'Ocean Fifty', 'Mini 6.50': 'Mini 6.50', 'Half Tonners': 'Half Tonner',
           'Quarter Tonners': 'Quarter Tonner', 'Trois-quarts Tonners': 'Trois-quarts Tonner', 'Maxis et G Class': 'Maxis', 'TP52': 'TP52'}
ORDRE_CLASSES = ['IMOCA', 'Ultim', 'Ocean Fifty', 'MOD70', 'Class40', 'Figaro', 'Mini 6.50', 'ORMA 60', 'Maxis', 'TP52',
                 'Half Tonner', 'Quarter Tonner', 'Trois-quarts Tonner']


def lire(nom):
    with open(D / nom, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def plier(texte):
    t = unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', t.replace('’', "'")).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--annee', type=int, default=datetime.date.today().year, help='année de référence')
    ap.add_argument('--sans-rapport', action='store_true', help="n'écrit pas le rapport de contrôle (appel par la construction du site)")
    args = ap.parse_args()
    ref = args.annee

    params = {p['parametre']: p['valeur'] for p in lire('parametres.csv')}
    debut = int(params['annee_demarrage'])
    fen_longue, fen_courte = int(params['fenetre_longue']), int(params['fenetre_courte'])
    niveaux = {int(n['niveau']): n for n in lire('bareme_niveaux.csv')}
    places = {p['place']: float(p['coefficient']) for p in lire('bareme_places.csv')}
    flotte = [(int(f['partants_min']), int(f['partants_max'] or 10**9), float(f['coefficient'])) for f in lire('bareme_flotte.csv')]
    roles = {r['role']: float(r['coefficient']) for r in lire('bareme_roles.csv')}
    regles = [dict(r, re=re.compile(r['motif']), classes=None if r['classes'] == '*' else set(r['classes'].split('|')))
              for r in lire('niveaux_courses.csv')]
    # Partants inconnus : coefficient provisoire, à faire valider par le propriétaire.
    COEF_FLOTTE_INCONNUE = 0.8

    def regle_de(classe, course, annee):
        c = plier(course)
        for r in regles:
            if r['annee_min'] and annee < int(r['annee_min']): continue
            if r['annee_max'] and annee > int(r['annee_max']): continue
            if (r['classes'] is None or classe in r['classes']) and r['re'].search(c):
                return r
        return None

    BONUS_ETAPE = float(params['bonus_victoire_etape'])
    n_etapes = 0
    retenus, ecartes, inconnues = {}, Counter(), Counter()
    with open(D / 'site' / 'palmares.csv', encoding='utf-8', newline='') as f:
        lignes = list(csv.DictReader(f))
    for l in lignes:
        classe = CLASSES.get(l['classe'], l['classe'] or 'Inconnue')
        if not l['annee'] or not l['place']:
            ecartes['sans année ou sans place'] += 1; continue
        annee, place = int(l['annee']), int(l['place'])
        if annee < debut or annee > ref:
            ecartes['hors période'] += 1; continue
        partants = int(l['partants']) if l['partants'] else None
        if partants is not None and place > partants:
            ecartes['place supérieure au nombre de partants'] += 1; continue
        # Victoire d'étape (validé le 11/11/2026) : bonus fixe, quel que soit le niveau de la course, selon le rôle à bord.
        # Les prologues et les manches (régates courtes) ne sont pas des étapes.
        lib = plier(l['course'])
        if place == 1 and re.search(r'\b(etape|leg)\b', lib) and not re.search(r'\b(prologue|manche)\b', lib):
            c_role = roles[l['role']]
            cle = (l['marin_id'], annee, 'étape : ' + l['course'], classe)
            if cle not in retenus:
                retenus[cle] = dict(marin_id=l['marin_id'], marin=l['marin'], annee=annee, classe=classe, course="Victoire d'étape",
                                    niveau=0, libelle=l['course'], place=place, partants=partants or '', role=l['role'], base=BONUS_ETAPE,
                                    c_place=1, c_flotte=1, c_role=c_role, points=round(BONUS_ETAPE * c_role, 2), bateau=l['bateau'], source=l['source'])
                n_etapes += 1
            continue
        r = regle_de(classe, l['course'], annee)
        if r is None:
            inconnues[(classe, l['course'])] += 1; continue
        niv = int(r['niveau'])
        if niv == 0:
            ecartes['étape ou course non retenue'] += 1; continue
        base = float(niveaux[niv]['base'])
        c_place = places.get(str(place), places['8+']) if place <= 7 else places['8+']
        if niveaux[niv]['coefficient_flotte'] == 'non':
            c_flotte = 1.0
        elif partants is None:
            c_flotte = COEF_FLOTTE_INCONNUE
        else:
            c_flotte = next(c for a, b, c in flotte if a <= partants <= b)
        c_role = roles[l['role']]
        pts = round(base * c_place * c_flotte * c_role, 2)
        # Une même course n'est comptée qu'une fois par marin et par année (la meilleure ligne).
        # Niveau 4 : la règle regroupe toutes les épreuves d'un championnat sous un même nom ; chaque épreuve compte.
        cle = (l['marin_id'], annee, r['course'] if niv < 4 else plier(l['course']), classe)
        res = dict(marin_id=l['marin_id'], marin=l['marin'], annee=annee, classe=classe, course=r['course'], niveau=niv,
                   libelle=l['course'], place=place, partants=partants or '', role=l['role'], base=base, c_place=c_place,
                   c_flotte=c_flotte, c_role=c_role, points=pts, bateau=l['bateau'], source=l['source'])
        if cle in retenus:
            ecartes['doublon (même course, même année)'] += 1
            if pts <= retenus[cle]['points']:
                continue
        retenus[cle] = res

    points = sorted(retenus.values(), key=lambda x: (x['marin_id'], x['annee']))
    sortie = RACINE / 'sorties' / 'classement'
    sortie.mkdir(parents=True, exist_ok=True)
    with open(sortie / 'points.csv', 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(points[0].keys())); w.writeheader(); w.writerows(points)

    periodes = {'Depuis 1960': debut, f'{fen_longue} ans': ref - fen_longue + 1, f'{fen_courte} ans': ref - fen_courte + 1, str(ref): ref}
    totaux = defaultdict(lambda: defaultdict(float))   # (periode, classe) -> marin -> points
    detail = defaultdict(lambda: defaultdict(Counter))  # (periode, classe) -> marin -> victoires...
    noms = {}
    for p in points:
        noms[p['marin_id']] = p['marin']
        for per, a0 in periodes.items():
            if p['annee'] >= a0:
                for cl in (p['classe'], 'Toutes'):
                    totaux[(per, cl)][p['marin_id']] += p['points']
                    detail[(per, cl)][p['marin_id']]['courses'] += 1
                    if p['place'] == 1 and p['niveau']: detail[(per, cl)][p['marin_id']]['victoires'] += 1
    with open(sortie / 'classement.csv', 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(['periode', 'classe', 'rang', 'marin_id', 'marin', 'points', 'courses', 'victoires'])
        for (per, cl), t in sorted(totaux.items()):
            for i, (m, v) in enumerate(sorted(t.items(), key=lambda x: -x[1]), 1):
                w.writerow([per, cl, i, m, noms[m], round(v, 1), detail[(per, cl)][m]['courses'], detail[(per, cl)][m]['victoires']])

    # Données de la page « Classement » du site (lues par site/tools/build.mjs) : une ligne par résultat retenu, sous
    # forme compacte ; la page calcule les totaux pour n'importe quelle classe, année de référence et période.
    marins, bateaux, classes_vues = {}, {}, []
    lignes_site = []
    # Un bateau marque une seule fois par résultat, même avec plusieurs marins à bord : la meilleure ligne (le skipper).
    meilleure = {}
    for i, p in enumerate(points):
        if not re.match(r'^[a-z0-9-]+/[^/]+/$', p['source'] or ''): continue
        cle = (p['source'], p['annee'], p['course'] if 0 < p['niveau'] < 4 else p['libelle'], p['niveau'] == 0)
        if cle not in meilleure or p['points'] > points[meilleure[cle]]['points']: meilleure[cle] = i
    pour_bateau = set(meilleure.values())
    for i, p in enumerate(points):
        mi = marins.setdefault(p['marin_id'], len(marins))
        url = p['source'] if re.match(r'^[a-z0-9-]+/[^/]+/$', p['source'] or '') else ''
        bi = bateaux.setdefault(url, len(bateaux)) if url else -1
        if p['classe'] not in classes_vues: classes_vues.append(p['classe'])
        lignes_site.append([mi, p['annee'], classes_vues.index(p['classe']), round(p['points'], 2), bi,
                            1 if p['place'] == 1 and p['niveau'] else 0, 1 if p['niveau'] else 0, 1 if i in pour_bateau else 0])
    noms_bateaux = {}
    for p in points:
        if p['source'] in bateaux and p['source'] not in noms_bateaux: noms_bateaux[p['source']] = p['bateau']
    ordre = [c for c in ORDRE_CLASSES if c in classes_vues] + sorted(c for c in classes_vues if c not in ORDRE_CLASSES)
    site = dict(reference=ref, debut=debut, ordre_classes=ordre, classes=classes_vues,
                marins=[[m, noms[m]] for m in marins], bateaux=[[u, noms_bateaux.get(u, '')] for u in bateaux], r=lignes_site)
    import json
    (sortie / 'site.json').write_text(json.dumps(site, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    if args.sans_rapport:
        return

    # Rapport lisible.
    date = datetime.date.today().isoformat()
    rap = RACINE / 'controles' / date
    rap.mkdir(parents=True, exist_ok=True)
    n_niv = Counter(p['niveau'] for p in points)
    inc_flotte = sum(1 for p in points if p['partants'] == '' and p['niveau'] > 1)
    out = [f'# Classement des marins : premier jet ({date})', '',
           '> **Version de travail, non publiée.** Les niveaux des courses (`donnees/niveaux_courses.csv`) sont validés par le '
           'propriétaire (09 et 11/11/2026), sauf le circuit TP52. Les palmarès viennent du site, dont la relecture n\'est pas terminée : des erreurs connues '
           '(rôles, années, courses mal nommées) faussent encore certains totaux.', '',
           f'Année de référence : {ref}. Barème : `docs/decisions.md`. Relancer : `python outils/classement/calculer.py`.', '',
           '## Chiffres', '',
           f'- Lignes de palmarès lues : {len(lignes)} ; résultats retenus : {len(points)} '
           f'(niveau 1 : {n_niv[1]}, niveau 2 : {n_niv[2]}, niveau 3 : {n_niv[3]}, niveau 4 : {n_niv[4]}).',
           f"- Victoires d'étape (bonus de {BONUS_ETAPE:g} points selon le rôle) : {n_etapes}.",
           f'- Lignes sur une course non reconnue (niveau inconnu, 0 point) : {sum(inconnues.values())}.',
           f'- Résultats retenus sans nombre de partants (coefficient provisoire {COEF_FLOTTE_INCONNUE}) : {inc_flotte}.']
    out += [f'- Écartés : {k} : {v}.' for k, v in ecartes.most_common()]
    for cl in ['Toutes'] + ORDRE_CLASSES:
        if (f'Depuis 1960', cl) not in totaux: continue
        out += ['', f'## {cl}', '']
        top = {per: sorted(totaux[(per, cl)].items(), key=lambda x: -x[1])[:15] for per in periodes}
        out += ['| Rang | ' + ' | '.join(periodes) + ' |', '|---' * (len(periodes) + 1) + '|']
        for i in range(15):
            cells = []
            for per in periodes:
                t = top[per]
                cells.append(f'{noms[t[i][0]]} ({t[i][1]:.0f})' if i < len(t) else '')
            if any(cells): out.append(f'| {i + 1} | ' + ' | '.join(cells) + ' |')
    out += ['', '## Courses non reconnues les plus fréquentes (à classer)', '', '| Classe | Libellé | Lignes |', '|---|---|---|']
    out += [f'| {c} | {n} | {v} |' for (c, n), v in inconnues.most_common(60)]
    (rap / 'classement-premier-jet.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(f'{len(points)} résultats retenus, {sum(inconnues.values())} lignes non reconnues ; rapport : {rap / "classement-premier-jet.md"}')


if __name__ == '__main__':
    main()
