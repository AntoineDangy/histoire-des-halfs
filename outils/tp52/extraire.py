"""Extraction des fiches TP52 de l'auteur (histoiredeshalfs.com, copies Wayback déjà dans le dépôt).

Lecture *déterministe* fondée sur la mise en forme de l'auteur, sans rien inventer :
  - nom du bateau : police Geneva taille 5 (taille 6 = titre de la fiche), numéro de voile en jaune ;
  - année : nombre de 4 chiffres en taille 5, en tête de paragraphe ;
  - place : texte rouge « 3e/9 », « 1er/5 », « ?e/10 »… ;
  - marin : texte brun (#660000), éventuellement précédé d'une étiquette (Skipper:, Tactician:, avec…).

Règles de rôle validées par le propriétaire le 09/11/2026 (docs/decisions.md) :
  1. étiquette Skipper / Helm / barreur → skipper (écrit) ;
     étiquette Tactician / Navigator / Strategist / Crew / with / avec → équipier (écrit) ;
     étiquette Owner → propriétaire (jamais à bord) ; Coach → cité.
  2. nom seul en capitales sur un résultat sans « Skipper: » → skipper « à vérifier » (convention de l'auteur) ;
     nom seul sur un résultat qui a un « Skipper: » écrit → propriétaire, sans point.
  3. un résultat sans nom reçoit le skipper uniquement si le résultat nommé précédent et le suivant,
     dans la même saison et sous le même nom de bateau, portent le même skipper → « déduit ».
  Un marin qui n'est rattaché à aucun résultat (annonce de vente, article, vente du bateau) est « cité ».

Usage (depuis la racine du dépôt) :  python outils/tp52/extraire.py
Produit donnees/tp52/*.csv et controles/AAAA-MM-JJ/tp52.md. Relancer refait tout à l'identique (rapide, sans réseau).
"""
import csv, datetime, html, re, sys, urllib.parse
from html.parser import HTMLParser
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DOSSIER = RACINE / "donnees" / "site" / "html" / "50' monos"
SORTIE = RACINE / "donnees" / "tp52"
SOURCE_URL = "https://www.histoiredeshalfs.com/50'%20monos/"

PLACE_RE = re.compile(r"(\d{1,3}|\?{1,3})\s*(?:e|er|ère|ème|st|nd|rd|th|°)?\s*/\s*(\d{1,3}|\?{1,3})", re.I)
ANNEE_RE = re.compile(r"^\s*((?:19|20)\d\d|20\d\?)\b")
STATUT_RE = re.compile(r"\b(retired|abandon\w*|dnf|dns|dsq|dnc|ocs|ret|np)\b\s*(?:/\s*(\d{1,3}|\?{1,3}))?", re.I)
ORGANISATION_RE =re.compile(r"\b(club|academy|académie|school|école|ecole|team|syndicate|navy|marine nationale|yacht ?club|association|foundation|fondation|university|université|racing|sailing|squadron|group|groupe|ocean crusaders|swd)\b", re.I)
VENTE_RE = re.compile(r"a vendre|for sale|à vendre|sold to|vendu", re.I)

ETIQUETTES = [  # (expression, rôle, ordre de priorité : la plus proche du nom gagne)
    (r"owner\s*/\s*skipper|owner\s*-\s*skipper|skipper\s*(?:and|&|et)\s*helm|skipper|helm(?:sman)?|barreur|barreuse|driver|à la barre|at the helm", "skipper"),
    (r"co-?skipper|tactician|tacticien|(?:à|a) la tactique|(?:à|a) la navigation|à la stratégie|tactique|navigator|navigateur|strat[eè]g\w*|crew|équipage|equipage|other notables|boat captain|mainsheet|with|avec", "equipier"),
    (r"new owners?|owners?|propriétaire|armateur", "proprietaire"),
    (r"coach", "cite"),
]


class Lecteur(HTMLParser):
    """Transforme la page en suite de morceaux (style, texte) ; 'BR' marque une coupure de ligne."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pile, self.morceaux = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("br", "p", "tr", "td", "div", "table"):
            self.morceaux.append(("BR", ""))
        if tag == "font":
            self.pile.append((a.get("color", "").upper(), a.get("size", ""), a.get("face", "")))
        if tag in ("script", "style"):
            self.pile.append(("IGNORE", "", ""))

    def handle_endtag(self, tag):
        if tag in ("font", "script", "style") and self.pile:
            self.pile.pop()
        if tag in ("p", "tr", "td", "div"):
            self.morceaux.append(("BR", ""))

    def style(self):
        couleur = taille = ""
        geneva = False
        for c, s, f in self.pile:
            if c == "IGNORE":
                return "IGNORE"
            if c:
                couleur = c
            if s:
                taille = s
            if "geneva" in f.lower():
                geneva = True
        if couleur == "#660000":
            return "marin"
        if couleur == "#FF0000":
            return "place"
        if couleur == "#FFFF00" and geneva:
            return "voile"
        if geneva and taille == "6":
            return "titre"
        if geneva and taille == "5":
            return "bateau"
        if taille == "5":
            return "gros"
        return "texte"

    def handle_data(self, data):
        st = self.style()
        if st != "IGNORE" and data.strip():
            self.morceaux.append((st, re.sub(r"\s+", " ", data)))


def fusionner(morceaux):
    """Regroupe les morceaux consécutifs de même style (un nom coupé en deux balises reste un nom)."""
    out = []
    for st, tx in morceaux:
        if out and out[-1][0] == st and st != "BR":
            out[-1] = (st, out[-1][1] + tx)
        else:
            out.append((st, tx))
    return out


NOM_RE = re.compile(r"[A-ZÀ-Ý][\w'’.\-]*(?:\s+[\w'’.\-]+){0,4}")


def decouper_noms(texte):
    """« Peter AHERN, Scott BAILEY & Fergus WILMER » → 3 noms. Écarte la ponctuation et le bruit."""
    parties = re.split(r"\s*(?:,|&|/|;|\bet\b|\band\b)\s*", texte)
    noms = []
    for p in parties:
        p = p.strip(" .:-–()\"'")
        if not p or len(p) < 3 or not re.search(r"[A-Za-zÀ-ÿ]{2}", p):
            continue
        if re.search(r"\d", p) or not NOM_RE.fullmatch(p):
            noms.append((p, False))  # gardé mais signalé comme douteux
        else:
            noms.append((p, True))
    return noms


def etiquette(avant):
    """Rôle annoncé par le texte qui précède immédiatement le nom (« Tactician: », « avec »…)."""
    queue = avant[-40:].lower()
    meilleur = None
    for expr, role in ETIQUETTES:
        for m in re.finditer(r"(?:^|[\s,.;(])(" + expr + r")\s*:?\s*$", queue):
            if meilleur is None or m.start(1) > meilleur[0]:
                meilleur = (m.start(1), role, m.group(1))
    return (meilleur[1], meilleur[2]) if meilleur else (None, None)


def liste_des_fiches():
    page = (DOSSIER / "TP Liste.htm").read_bytes().decode("cp1252")
    vus = []
    for h in re.findall(r'href\s*=\s*"([^"#]+)"', page, re.I):
        try:
            nom = urllib.parse.unquote(h, encoding="cp1252")
        except Exception:
            nom = h
        if re.match(r"^(https?:|mailto:|\.\./)", nom) or "/" in nom:
            continue
        if (DOSSIER / nom).exists() and nom not in vus and re.match(r"TP\d", nom):
            vus.append(nom)
    return vus


def lire_liste():
    """Ligne de la liste de l'auteur : « <a href=fiche>TP29</a> 2006 Botin / Carkeek Cookson USA 52698 <strong>Warpath</strong>,
    2007 Winquest… » → numéro TP, année, architecte et chantier (bruts), numéro de voile à la mise à l'eau, nom de baptême."""
    page = (DOSSIER / "TP Liste.htm").read_bytes().decode("cp1252")
    page = re.sub(r"\s+", " ", page)
    page = re.sub(r"<(?!/?(?:a|strong|br)\b)[^>]*>", "", page, flags=re.I)  # mise en forme glissée dans les lignes
    page = re.sub(r"</strong>\s*<strong>", "", page, flags=re.I)
    out = {}
    motif = r'<a href="([^"]+)">\s*(TP[^<]{1,8})</a>\s*((?:19|20)\d\d\??)?([^<]*?)(?:<font[^>]*>\s*)?<strong>([^<]+)</strong>'
    for m in re.finditer(motif, page, re.I):
        fichier = urllib.parse.unquote(m.group(1), encoding="cp1252")
        if fichier in out:
            continue
        reste = html.unescape(m.group(4)).strip()
        # « IRL 5200(2) » : le « (2) » de l'auteur distingue un homonyme, il ne fait pas partie du numéro
        v = re.search(r"((?:[A-Z]{1,3}\s?)?[\w\-]*\d[\w\-]*?)(?:\(\d\))?\s*$|(\?{2,}[\s?]*)\s*$", reste)
        out[fichier] = {"tp": m.group(2).strip(), "annee_liste": (m.group(3) or "").strip("?"),
                        "architecte_chantier": (reste[: v.start()] if v else reste).strip(),
                        "voile_lancement": v.group(1).strip() if v and v.group(1) and re.search(r"\d", v.group(1)) else "",
                        "bapteme_liste": html.unescape(m.group(5)).strip(" ,")}
    return out


def lire_fiche(fichier):
    lec = Lecteur()
    lec.feed((DOSSIER / fichier).read_bytes().decode("cp1252"))
    morceaux = fusionner(lec.morceaux)

    fiche = {"fichier": fichier, "titre": "", "voile_titre": "", "maj": ""}
    noms_portes, resultats, personnes = [], [], []
    annee, bateau, voile = "", "", ""
    ligne = ""          # texte de la ligne en cours (pour le libellé de la course)
    contexte = ""        # texte brut cumulé depuis le dernier résultat (étiquettes, ventes)
    dernier = None       # dernier résultat de la ligne/paragraphe, pour y rattacher un marin
    vente = False

    for i, (st, tx) in enumerate(morceaux):
        if st == "BR":
            ligne = ""
            contexte += " "
            continue
        if st == "titre":
            if not fiche["titre"]:
                t = tx.strip()
                m = re.search(r"(Last update|à jour au|a jour au)\s*:?\s*(\S+)", t, re.I)
                if m:
                    fiche["maj"] = m.group(2)
                    t = t[: m.start()].strip()
                fiche["titre"] = t.strip(" ,")
            continue
        if st in ("bateau", "voile"):
            if st == "bateau":
                t = tx.strip(" ,")
                m = re.match(r"(.*?),\s*([A-Z]{3}\s*[\w\-]+.*)$", t)
                if m:
                    t, v = m.group(1).strip(), m.group(2).strip()
                    voile = v
                if t and not re.fullmatch(r"[\d\s?,.\-]*", t):
                    bateau = t
                    noms_portes.append({"fichier": fichier, "annee": annee, "nom": bateau, "voile": voile})
            else:
                voile = tx.strip(" ,")
                if noms_portes and noms_portes[-1]["nom"] == bateau:
                    noms_portes[-1]["voile"] = voile
            dernier = None
            vente = False
            contexte = ""
            continue
        m_an = ANNEE_RE.match(tx) if st in ("gros", "texte") else None
        if m_an and (st == "gros" or ligne.strip() == ""):
            annee = m_an.group(1)
            dernier = None
            vente = False
            contexte = ""
            tx = tx[m_an.end():]
            if not tx.strip():
                continue
        if st == "place" and (PLACE_RE.search(tx) or STATUT_RE.search(tx)):
            m = PLACE_RE.search(tx) or STATUT_RE.search(tx)
            libelle = (ligne + " " + tx[: m.start()]).strip()
            if dernier is not None and not libelle.strip(" ,.;-") or (
                dernier is not None and re.fullmatch(r"[\s,.;\-]*(?:en|et|and|&)?[\s\w\-]{0,25}", libelle) and dernier["ligne_id"] == id(ligne)
            ):
                # deuxième classement d'une même course (« 9e/82 en réel, 4e IRC B ») : on le joint au précédent
                dernier["autres_classements"] += (" | " if dernier["autres_classements"] else "") + tx.strip()
            else:
                course = re.sub(r":.*$", "", libelle)
                course = re.sub(r"[\d\s()\-.=]+(pts?)?\s*$", "", course).strip(" ,.:=-")
                dernier = {
                    "fichier": fichier, "n": len(resultats) + 1, "annee": annee, "bateau": bateau, "voile": voile,
                    "libelle": libelle[-160:].strip(), "course": course[-100:].strip(),
                    "place": m.group(1), "partants": m.group(2), "classement": tx[m.end():].strip(" ,.")[:60],
                    "autres_classements": "", "vente": vente, "ligne_id": id(ligne),
                }
                resultats.append(dernier)
            vente = False  # une mention de vente ne vaut que jusqu'au résultat suivant
            contexte = ""
            ligne += " " + tx
            continue
        if st == "marin":
            role_lu, mot = etiquette(contexte + " " + ligne)
            for nom, propre in decouper_noms(tx):
                personnes.append({
                    "fichier": fichier, "annee": annee, "bateau": bateau,
                    "resultat": dernier["n"] if dernier else "", "marin": nom, "nom_douteux": not propre,
                    "etiquette": mot or "", "role_lu": role_lu or "",
                    "vente": vente or bool(VENTE_RE.search(contexte)),
                    "avant_courses": not any(r["annee"] == annee and r["bateau"] == bateau for r in resultats),
                    "citation": (contexte[-60:] + tx).strip()[-140:],
                })
            contexte += " " + tx
            ligne += " " + tx
            continue
        # texte ordinaire
        if VENTE_RE.search(tx):
            vente = True
            dernier = None
        ligne += " " + tx
        contexte += " " + tx
        # une nouvelle course commence : « 10 September, Rolex Big Boat Series… : » coupe le rattachement
        # (sauf les étiquettes et cotes : « Coeff IRC: 1.350 », « Navigator: », « elapsed time: »…)
        if dernier is not None:
            for mc in re.finditer(r":", tx):
                avant = tx[: mc.start()][-30:].lower()
                if len(avant.strip()) > 6 and not re.search(r"(coef+|rating|irc|tcf|tcc|orr|orc|phrf|skipper|helm|tactici\w*|navigat\w*|owners?|notables|crew|elapsed|corrected|time|temps|pts|points|strat\w*|coach)\s*$", avant):
                    dernier = None
                    break
    return fiche, noms_portes, resultats, personnes


def attribuer_roles(resultats, personnes):
    par_res = {}
    for p in personnes:
        if p["resultat"] != "":
            par_res.setdefault(p["resultat"], []).append(p)
    for p in personnes:
        if ORGANISATION_RE.search(p["marin"]):
            p["role"], p["mode"] = "organisation", "club, école ou équipe : pas un marin"
            continue
        if p["resultat"] == "" or p["vente"]:
            p["role"], p["mode"] = ("proprietaire" if p["role_lu"] == "proprietaire" else "cite"), "écrit" if p["role_lu"] else "hors résultat"
            continue
        role_dans_groupe(p, par_res[p["resultat"]])
    return par_res


BARREUR_RE = re.compile(r"^(helm|helmsman|barreur|barreuse|driver|à la barre|at the helm)$", re.I)


def role_dans_groupe(p, groupe):
    """Rôle d'un marin parmi les noms d'une même course (ou d'un même équipage de saison)."""
    if True:
        skipper_ecrit = any(q["role_lu"] == "skipper" for q in groupe)
        mot_skipper = any(q["role_lu"] == "skipper" and "skipper" in q["etiquette"].lower() for q in groupe)
        if p["role_lu"] == "skipper" and BARREUR_RE.match(p["etiquette"].strip()) and mot_skipper and not any(
                q["marin"] == p["marin"] and "skipper" in q["etiquette"].lower() for q in groupe):
            # Skipper et barreur différents : celui écrit « Skipper » marque 100 % (décision du 09/11/2026)
            p["role"], p["mode"] = "equipier", "barreur, un autre est écrit Skipper"
        elif p["role_lu"] == "proprietaire":
            # TP52 : le propriétaire est pesé avec l'équipage, donc à bord (décision du 09/11/2026)
            p["role"], p["mode"] = "equipier", "propriétaire à bord (écrit « owner »)"
        elif p["role_lu"]:
            p["role"], p["mode"] = p["role_lu"], "écrit"
        elif skipper_ecrit:
            p["role"], p["mode"] = "equipier", "règle 2 (propriétaire à bord, un Skipper: est écrit)"
        else:
            sans_etiquette = [q for q in groupe if not q["role_lu"]]
            if len(sans_etiquette) > 1:
                p["role"], p["mode"] = "inconnu", "plusieurs noms sans étiquette"
            elif not re.search(r"\b[A-ZÀ-Ý][A-ZÀ-Ý'\-]{2,}\b", p["marin"]) or re.fullmatch(r".*\bI{2,3}V?\b", p["marin"]) and not re.search(r"\b(?!I{2,3}\b)[A-ZÀ-Ý][A-ZÀ-Ý'\-]{2,}\b", p["marin"]):
                # la règle 1 ne vaut que pour un nom écrit en capitales
                p["role"], p["mode"] = "inconnu", "nom sans capitales, rôle non écrit"
            else:
                p["role"], p["mode"] = "skipper", "à vérifier (convention de l'auteur)"
        if p["nom_douteux"]:
            p["mode"] += " ; nom douteux"


def equipage_de_saison(resultats, personnes, par_res):
    """Équipage donné en tête d'année, avant la première course (ex. MedCup 2006) : il vaut pour les courses
    de la saison sous le même nom de bateau qui ne nomment personne (décision du 09/11/2026)."""
    saisons = {}
    for p in personnes:
        if (p["resultat"] == "" and not p["vente"] and p["avant_courses"] and p["role_lu"] in ("skipper", "equipier", "proprietaire")
                and not re.search(r"new|nouv", p["etiquette"], re.I) and p.get("role") != "organisation"):
            saisons.setdefault((p["annee"], p["bateau"]), []).append(p)
    ajouts = []
    for (annee, bateau), groupe in saisons.items():
        vus = {}
        for p in groupe:  # un même marin écrit deux fois (« Skipper » et « Tactician ») : on garde le premier rôle
            vus.setdefault(p["marin"], p)
        groupe = list(vus.values())
        for p in groupe:
            p["mode"] = "équipage de saison (déclaré en tête d'année)"
        for r in resultats:
            if r["annee"] != annee or r["bateau"] != bateau or r["vente"] or par_res.get(r["n"]):
                continue
            for p in groupe:
                q = dict(p, resultat=r["n"], citation="équipage de saison : " + p["citation"][-100:])
                role_dans_groupe(q, groupe)
                q["mode"] = "équipage de saison ; " + q["mode"]
                ajouts.append(q)
                par_res.setdefault(r["n"], []).append(q)
    return ajouts


def report_saison(resultats, par_res):
    """Règle 3 : même skipper avant et après, même saison, même nom de bateau → « déduit »."""
    deduits = []
    def skippers(r):
        return tuple(sorted(p["marin"] for p in par_res.get(r["n"], []) if p["role"] == "skipper"))
    for i, r in enumerate(resultats):
        if r["vente"] or par_res.get(r["n"]):
            continue
        av = next((x for x in reversed(resultats[:i]) if skippers(x)), None)
        ap = next((x for x in resultats[i + 1:] if skippers(x)), None)
        if not av or not ap:
            continue
        if {av["annee"], ap["annee"]} == {r["annee"]} and av["bateau"] == r["bateau"] == ap["bateau"] and skippers(av) == skippers(ap):
            for nom in skippers(av):
                deduits.append({"fichier": r["fichier"], "annee": r["annee"], "bateau": r["bateau"], "resultat": r["n"],
                                "marin": nom, "nom_douteux": False, "etiquette": "", "role_lu": "", "vente": False,
                                "citation": f"encadré par les résultats {av['n']} et {ap['n']}",
                                "role": "skipper", "mode": "déduit (même skipper avant et après)"})
    return deduits


def ecrire(nom, lignes, champs):
    with open(SORTIE / nom, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=champs, extrasaction="ignore")
        w.writeheader()
        w.writerows(lignes)


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    fiches, noms, resultats, equipages = [], [], [], []
    liste = lire_liste()
    for fichier in liste_des_fiches():
        fiche, np_, rs, ps = lire_fiche(fichier)
        par_res = attribuer_roles(rs, ps)
        ps += equipage_de_saison(rs, ps, par_res)
        ps += report_saison(rs, par_res)
        fiche["source"] = SOURCE_URL + urllib.parse.quote(fichier, encoding="cp1252")
        fiche["resultats"], fiche["noms_portes"] = len(rs), len(np_)
        fiche.update(liste.get(fichier, {}))
        fiches.append(fiche); noms += np_; resultats += rs; equipages += ps
    ecrire("fiches.csv", fiches, ["fichier", "tp", "titre", "bapteme_liste", "annee_liste", "voile_lancement", "architecte_chantier", "maj", "noms_portes", "resultats", "source"])
    ecrire("noms_portes.csv", noms, ["fichier", "annee", "nom", "voile"])
    ecrire("resultats.csv", resultats, ["fichier", "n", "annee", "bateau", "voile", "course", "place", "partants",
                                         "classement", "autres_classements", "libelle"])
    equipages.sort(key=lambda p: (p["fichier"], p["resultat"] if p["resultat"] != "" else 10**6))
    ecrire("equipages.csv", equipages, ["fichier", "annee", "bateau", "resultat", "marin", "role", "mode", "etiquette", "citation"])

    # Rapport de contrôle
    from collections import Counter
    roles = Counter((p["role"], p["mode"].split(" ;")[0]) for p in equipages)
    sans_nom = sum(1 for r in resultats if not any(p["resultat"] == r["n"] and p["fichier"] == r["fichier"] for p in equipages))
    jour = datetime.date.today().isoformat()
    ctl = RACINE / "controles" / jour
    ctl.mkdir(parents=True, exist_ok=True)
    lignes = [f"# Extraction des TP52 ({jour})", "",
              f"- Fiches lues : {len(fiches)} (liens de `TP Liste.htm` présents dans `donnees/site/html/50' monos/`)",
              f"- Noms portés : {len(noms)}", f"- Résultats : {len(resultats)}, dont {sans_nom} sans aucun marin",
              f"- Marins relevés : {len(equipages)}", "", "| Rôle | Mode | Nombre |", "|---|---|---|"]
    lignes += [f"| {r} | {m} | {n} |" for (r, m), n in sorted(roles.items(), key=lambda x: -x[1])]
    douteux = [p for p in equipages if "douteux" in p["mode"] or p["role"] == "inconnu"]
    lignes += ["", f"## Cas à vérifier à la main ({len(douteux)})", ""]
    lignes += [f"- {p['fichier']} {p['annee']} rés. {p['resultat']} : « {p['marin']} » ({p['mode']}) — {p['citation']}" for p in douteux[:300]]
    (ctl / "tp52.md").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print(f"{len(fiches)} fiches, {len(noms)} noms, {len(resultats)} résultats, {len(equipages)} marins ; rapport : controles/{jour}/tp52.md")
    for (r, m), n in sorted(roles.items(), key=lambda x: -x[1]):
        print(f"  {n:5}  {r:13} {m}")


if __name__ == "__main__":
    main()
