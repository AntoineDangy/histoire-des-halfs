"""Trait de caractère valorisant des 20 meilleurs marins et bateaux de chaque classe actuelle (demande du propriétaire, 11/11/2026).

Les traits ne s'affichent pas sur le site : ils restent dans la base (donnees/traits_marins.csv, donnees/traits_bateaux.csv)
pour servir plus tard (jeu « Course au large »). Chaque trait est tiré du parcours visible sur le site et donne sa preuve.

Méthode : pour chaque marin (ou bateau), on mesure plusieurs qualités sur toute sa carrière (victoires dans les monuments,
victoires, régularité, nombre de classes, longévité, tours du monde bouclés, rebonds après abandon, rôle d'équipier…) ;
chaque mesure est rangée par rapport aux autres retenus, et le trait est la qualité où il se distingue le plus.

Entrées : sorties/classement/points.csv (python outils/classement/calculer.py) et donnees/site/palmares.csv.
Usage : python outils/classement/traits.py [--de 2021] [--a 2026] [--top 20]
"""
import argparse, csv, re
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
CLASSES = ['IMOCA', 'Ultim', 'Ocean Fifty', 'Class40', 'Figaro', 'Mini 6.50']
SITE_CLASSES = {'IMOCA 60': 'IMOCA', 'Class 40': 'Class40', 'Figaro Bénéteau': 'Figaro', 'Ultim': 'Ultim', 'Ocean Fifty': 'Ocean Fifty', 'Mini 6.50': 'Mini 6.50'}
ABANDON = re.compile(r'^\s*(dnf|abd|abandon|dsq|dns|ret)', re.I)

# Qualités mesurées : clé -> (trait, phrase de preuve). L'ordre départage les égalités.
TRAITS_MARINS = {
    'legende': ("L'étoffe des légendes", lambda f: f"a gagné {f['monuments_gagnes']}"),
    'grandes': ("L'instinct des grands rendez-vous", lambda f: f"{f['v2']} victoires dans de grandes courses ({f['v2_liste']})"),
    'gagneur': ('Un tempérament de gagneur', lambda f: f"{f['victoires']} victoires en {f['courses']} courses"),
    'regularite': ('Une régularité de métronome', lambda f: f"dans les cinq premiers {f['top5']} fois sur {f['courses']} courses"),
    'endurance': ("L'endurance des océans", lambda f: f"{f['n1']} courses de niveau monument terminées ({f['n1_liste']})"),
    'polyvalence': ('La polyvalence', lambda f: f"classé dans {len(f['classes'])} classes ({', '.join(sorted(f['classes']))})"),
    'longevite': ('La longévité', lambda f: f"des résultats de {f['debut']} à {f['fin']}"),
    'resilience': ('La résilience', lambda f: f"{f['abandons']} abandons, et pourtant {f['podiums']} podiums"),
    'equipage': ("L'esprit d'équipage", lambda f: f"{f['co']} courses comme co-skipper ou équipier sur {f['courses']}"),
    'ascension': ('Une ascension fulgurante', lambda f: f"premier résultat en {f['debut']}, déjà {f['victoires']} victoires"),
    'combativite': ('La combativité', lambda f: f"{f['courses']} course{'s' if f['courses'] > 1 else ''} disputée{'s' if f['courses'] > 1 else ''}"),
}
TRAITS_BATEAUX = {
    'legende': ('Un bateau de légende', lambda f: f"a gagné {f['monuments_gagnes']}"),
    'machine': ('Une machine à gagner', lambda f: f"{f['victoires']} victoires en {f['courses']} courses"),
    'globe': ('Un grand voyageur', lambda f: f"{f['n1']} courses de niveau monument terminées ({f['n1_liste']})"),
    'regularite': ('Toujours aux avant-postes', lambda f: f"dans les cinq premiers {f['top5']} fois sur {f['courses']} courses"),
    'fiabilite': ('Une fiabilité à toute épreuve', lambda f: f"{f['courses']} courses terminées" + (f" pour {f['abandons']} abandon{'s' if f['abandons'] > 1 else ''}" if f['abandons'] else ' sans un seul abandon')),
    'ecole': ('Une école de skippers', lambda f: f"mené par {len(f['skippers'])} skippers ({', '.join(sorted(f['skippers'])[:6])}{'…' if len(f['skippers']) > 6 else ''})"),
    'longevite': ('Increvable', lambda f: f"des résultats de {f['debut']} à {f['fin']}"),
    'combativite': ('Infatigable', lambda f: f"{f['courses']} courses disputées"),
}


def lire(p):
    with open(p, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def mesures(rows, abandons, entite):
    """Faits de carrière d'un marin ou d'un bateau, à partir de ses lignes retenues au classement."""
    courses = [r for r in rows if int(r['niveau']) > 0]
    gagnes = [r for r in courses if r['place'] == '1']
    m1 = [r for r in gagnes if r['niveau'] == '1']
    v2 = [r for r in gagnes if r['niveau'] == '2']
    n1 = [r for r in courses if r['niveau'] == '1']
    annees = [int(r['annee']) for r in courses] or [0]
    lib = lambda rs: ', '.join(f"{r['course']} {r['annee']}" for r in sorted(rs, key=lambda r: r['annee'])[:4]) + ('…' if len(rs) > 4 else '')
    f = dict(courses=len(courses), victoires=len(gagnes), podiums=sum(int(r['place']) <= 3 for r in courses),
             top5=sum(int(r['place']) <= 5 for r in courses), monuments_gagnes=lib(m1), m1=len(m1), v2=len(v2), v2_liste=lib(v2),
             n1=len(n1), n1_liste=lib(n1), classes={r['classe'] for r in courses}, debut=min(annees), fin=max(annees),
             co=sum(r['role'] != 'skipper' for r in courses), abandons=abandons, skippers={r['marin'] for r in courses if r['role'] == 'skipper'})
    n = max(f['courses'], 1)
    q = dict(legende=f['m1'], grandes=f['v2'] if f['v2'] >= 2 else 0, machine=f['victoires'],
             gagneur=f['victoires'] / n if f['courses'] >= 5 and f['victoires'] >= 3 else 0,
             regularite=f['top5'] / n if f['courses'] >= 8 else 0, endurance=f['n1'] if f['n1'] >= 2 else 0, globe=f['n1'] if f['n1'] >= 2 else 0,
             polyvalence=len(f['classes']) if len(f['classes']) >= 3 else 0, longevite=f['fin'] - f['debut'] if f['fin'] - f['debut'] >= 10 else 0,
             resilience=min(f['abandons'], f['podiums']) if f['abandons'] >= 3 else 0, equipage=f['co'] / n if f['co'] >= 5 and f['co'] / n >= .5 else 0,
             ascension=f['victoires'] / max(f['fin'] - f['debut'] + 1, 1) if f['debut'] >= 2018 and f['victoires'] >= 2 else 0,
             fiabilite=f['courses'] / (f['courses'] + f['abandons']) if f['courses'] >= 10 else 0,
             ecole=len(f['skippers']) if len(f['skippers']) >= 4 else 0, combativite=f['courses'])
    return f, q


def choisir(entites, traits):
    """Pour chacun, la qualité où il se distingue le plus des autres retenus (rang centile), à valeur non nulle."""
    cles = list(traits)
    for k in cles:
        vals = sorted(e['q'][k] for e in entites.values() if e['q'][k] > 0)
        for e in entites.values():
            v = e['q'][k]
            e.setdefault('pc', {})[k] = (sum(x <= v for x in vals) / len(vals)) if v > 0 and vals else 0
    for e in entites.values():
        # La combativité ne sert qu'en dernier recours : elle mesure surtout le nombre de lignes.
        # Gagner un monument (Vendée Globe, Route du Rhum, The Ocean Race…) prime sur tout le reste.
        best = 'legende' if e['q']['legende'] > 0 else max(cles, key=lambda k: (e['pc'][k] * (0.5 if k == 'combativite' else 1), -cles.index(k)))
        e['trait'], e['preuve'] = traits[best][0], traits[best][1](e['f'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--de', type=int, default=2021)
    ap.add_argument('--a', type=int, default=2026)
    ap.add_argument('--top', type=int, default=20)
    args = ap.parse_args()
    # Résultats douteux connus (docs/etat-du-projet.md) : écartés tant qu'ils ne sont pas corrigés dans le site.
    # « The Ocean Race » 2026 : pas de tour du monde cette année-là (sans doute l'Ocean Race Europe 2025 mal datée).
    # 2008 : pas d'IMOCA dans la Volvo Ocean Race de cette année-là (bateaux VO70).
    DOUTES = {('The Ocean Race (Whitbread)', '2026'), ('The Ocean Race (Whitbread)', '2008')}
    points = [p for p in lire(RACINE / 'sorties/classement/points.csv') if (p['course'], p['annee']) not in DOUTES]
    palm = lire(RACINE / 'donnees/site/palmares.csv')

    # Abandons (absents du classement, qui ne garde que les places) : une fois par course et par année.
    ab_marin, ab_bateau = defaultdict(set), defaultdict(set)
    for l in palm:
        if ABANDON.match(l['classement'] or ''):
            ab_marin[l['marin_id']].add((l['annee'], l['course']))
            if l['bateau_fiche']: ab_bateau[l['bateau_fiche']].add((l['annee'], l['course']))

    # Une ligne par résultat de bateau : la meilleure (celle du skipper), comme sur la page Classement.
    best = {}
    for i, p in enumerate(points):
        if not re.match(r'^[a-z0-9-]+/[^/]+/$', p['source'] or ''): continue
        niv = int(p['niveau'])
        cle = (p['source'], p['annee'], p['course'] if 0 < niv < 4 else p['libelle'], niv == 0)
        if cle not in best or float(p['points']) > float(points[best[cle]]['points']): best[cle] = i
    bateau_rows = defaultdict(list)
    for i in best.values(): bateau_rows[points[i]['source']].append(points[i])
    marin_rows = defaultdict(list)
    for p in points: marin_rows[p['marin_id']].append(p)

    sorties = {}
    for genre, rows_par, cle_nom in (('marins', marin_rows, 'marin'), ('bateaux', bateau_rows, 'bateau')):
        palmares = []
        for cl in CLASSES:
            tot = defaultdict(float)
            for k, rs in rows_par.items():
                for r in rs:
                    if r['classe'] == cl and args.de <= int(r['annee']) <= args.a: tot[k] += float(r['points'])
            for rang, (k, v) in enumerate(sorted(tot.items(), key=lambda x: -x[1])[:args.top], 1):
                palmares.append((cl, rang, k, v))
        entites = {}
        for _, _, k, _ in palmares:
            if k in entites: continue
            ab = len((ab_marin if genre == 'marins' else ab_bateau).get(k, ()))
            f, q = mesures(rows_par[k], ab, k)
            entites[k] = dict(f=f, q=q, nom=rows_par[k][0][cle_nom])
        choisir(entites, TRAITS_MARINS if genre == 'marins' else TRAITS_BATEAUX)
        sorties[genre] = (palmares, entites)

    # Nom d'un bateau : celui de sa fiche sur le site (page Classement), sinon le nom porté lors de son premier résultat.
    import json
    cj = RACINE / 'site/public/data/classement.json'
    noms_bateaux = dict(map(tuple, json.loads(cj.read_text(encoding='utf-8'))['bateaux'])) if cj.exists() else {}
    for genre, (palmares, entites) in sorties.items():
        dest = RACINE / 'donnees' / f'traits_{genre}.csv'
        with open(dest, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['classe', 'rang', 'identifiant', 'nom', f'points_{args.de}_{args.a}', 'trait', 'preuve', 'statut'])
            for cl, rang, k, v in palmares:
                e = entites[k]
                w.writerow([cl, rang, k, e['nom'] if genre == 'marins' else noms_bateaux.get(k, e['nom']), round(v, 1), e['trait'], e['preuve'], 'proposé'])
        compte = defaultdict(int)
        for e in entites.values(): compte[e['trait']] += 1
        print(f'{dest.relative_to(RACINE)} : {len(palmares)} lignes, {len(entites)} {genre} ;', dict(sorted(compte.items(), key=lambda x: -x[1])))


if __name__ == '__main__':
    main()
