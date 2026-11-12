"""Mesure les skippers de la frise du site, année par année, contre les relevés vérifiés de la relecture.

  python outils/relecture/skippers.py imoca ultim ocean-fifty [-v]

- « faux » : nom affiché en début de bande une année où la fiche ne le met pas à bord (ni skipper, ni co-skipper, ni équipier).
- « équipier affiché » : nom affiché comme skipper une année où la fiche ne le donne qu'équipier.
- « manquant » : année où la fiche nomme un skipper et où la frise n'affiche personne (ou un autre nom).
Les relevés ne sont pas exhaustifs : un « faux » peut venir d'un oubli du relecteur ; les exemples se vérifient à la main.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SITE = RACINE / "site" / "public"
RESULTATS = RACINE / "controles" / "relecture-bateaux"
sys.path.insert(0, str(Path(__file__).parent))
from preparer import frise_site  # noqa: E402


def nom(n):
    mots = [m for m in re.sub(r"[^a-z ]+", " ", unicodedata.normalize("NFKD", str(n or "")).encode("ascii", "ignore").decode().lower()).split()
            if len(m) > 2 and m not in ("suite", "les", "van", "den", "der")]
    return mots[-1] if mots else ""


def mesurer(classes, verbeux):
    tot = {"bandes": 0, "faux": 0, "equipier": 0, "annees_skipper": 0, "manquant": 0}
    ex = {"faux": [], "equipier": [], "manquant": []}
    for classe in classes:
        for f in sorted((RESULTATS / classe).glob("*.json")):
            r = json.loads(f.read_text(encoding="utf-8"))
            page = SITE / r.get("fiche", "") / "index.html"
            if not page.exists():
                continue
            frise = {l.split(" | ", 2)[0][:4]: l.split(" | ", 2) for l in frise_site(page.read_text(encoding="utf-8"))}
            bord, skip, eq = {}, {}, {}
            for s in r.get("skippers") or []:
                if not s.get("_verifie"):
                    continue
                an, n, role = str(s.get("annee", ""))[:4], nom(s.get("nom")), s.get("role")
                if role in ("skipper", "co-skipper", "equipier"):
                    bord.setdefault(an, set()).add(n)
                if role == "skipper":
                    skip.setdefault(an, set()).add(n)
                if role == "equipier":
                    eq.setdefault(an, set()).add(n)
            tous = set().union(*bord.values()) if bord else set()
            for an, (_, sk, _evs) in frise.items():
                if sk == "—" or sk.endswith("(suite)"):
                    continue
                for n in sk.split(" & ")[:1]:  # le skipper principal
                    tot["bandes"] += 1
                    k = nom(n)
                    if k not in tous:
                        tot["faux"] += 1
                        ex["faux"].append(f"{r['fiche']} {an} {n}")
                    elif k in eq.get(an, set()) and k not in skip.get(an, set()):
                        tot["equipier"] += 1
                        ex["equipier"].append(f"{r['fiche']} {an} {n}")
            for an, noms in skip.items():
                if not re.match(r"^(19|20)\d\d$", an):
                    continue
                tot["annees_skipper"] += 1
                aff = frise.get(an)
                montre = {nom(x) for x in aff[1].replace(" (suite)", "").split(" & ")} if aff and aff[1] != "—" else set()
                if not (montre & noms):
                    tot["manquant"] += 1
                    ex["manquant"].append(f"{r['fiche']} {an} fiche={'/'.join(sorted(noms))} site={aff[1] if aff else 'année absente'}")
    print(f"Skippers {', '.join(classes)} : {tot['bandes']} bandes affichées, {tot['faux']} noms jamais à bord, "
          f"{tot['equipier']} équipiers affichés skipper ; {tot['annees_skipper']} années avec skipper dans la fiche, "
          f"{tot['manquant']} sans ce skipper sur la frise")
    if verbeux:
        for k, l in ex.items():
            for x in (l if "-tout" in sys.argv else l[:25]):
                print(f"  {k}: {x}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    mesurer([a for a in sys.argv[1:] if not a.startswith("-")] or ["imoca"], "-v" in sys.argv)
