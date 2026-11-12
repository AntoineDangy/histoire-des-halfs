"""Mesure, famille par famille, les erreurs du site encore présentes, d'après les relevés vérifiés de la relecture.

À lancer après chaque correction des règles de lecture et reconstruction du site :
  node site/tools/build.mjs --publish
  python outils/relecture/mesurer.py imoca

Ne compte que les affirmations dont la citation a été vérifiée (_verifie = true).
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


def plier(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]+", " ", s).split()


def nom_de_famille(n):
    mots = [m for m in plier(n) if len(m) > 2 and m not in ("suite", "les", "van", "den", "der")]
    return mots[-1] if mots else ""


def mesurer(classe):
    bateaux = {b["fiche"]: b for b in json.loads((SITE / "data" / "bateaux.json").read_text(encoding="utf-8")) if b.get("fiche")}
    c = {k: [0, 0] for k in ("skipper_inconnu", "suite_sans_source", "classement_aberrant", "fastnet_2019",
                              "architecte_absent", "chantier_absent", "titre_pour_bapteme")}
    exemples = {k: [] for k in c}
    for f in sorted((RESULTATS / classe).glob("*.json")):
        r = json.loads(f.read_text(encoding="utf-8"))
        fiche = r.get("fiche", "")
        page = SITE / fiche / "index.html"
        if not page.exists():
            continue
        frise = [l.split(" | ", 2) for l in frise_site(page.read_text(encoding="utf-8"))]
        sk_ok = {}
        for s in r.get("skippers") or []:
            if s.get("_verifie") and s.get("role") in ("skipper", "co-skipper", "equipier"):
                sk_ok.setdefault(str(s.get("annee", ""))[:4], set()).add(nom_de_famille(s.get("nom")))
        tous = set().union(*sk_ok.values()) if sk_ok else set()
        for an, sk, evs in frise:
            an = an[:4]
            # Skipper affiché (début de bande) que la fiche ne nomme nulle part à bord du bateau.
            if sk not in ("—",) and not sk.endswith("(suite)"):
                for n in sk.split(" & "):
                    c["skipper_inconnu"][1] += 1
                    if nom_de_famille(n) not in tous:
                        c["skipper_inconnu"][0] += 1
                        exemples["skipper_inconnu"].append(f"{fiche} {an} {n}")
            # Bande prolongée une année où la fiche nomme d'autres personnes à bord.
            if sk.endswith("(suite)"):
                c["suite_sans_source"][1] += 1
                noms = {nom_de_famille(n) for n in sk.replace(" (suite)", "").split(" & ")}
                if an in sk_ok and not (noms & sk_ok[an]):
                    c["suite_sans_source"][0] += 1
                    exemples["suite_sans_source"].append(f"{fiche} {an} {sk}")
            for m in re.finditer(r"·\s*(\d+)e/(\d+)", evs):
                c["classement_aberrant"][1] += 1
                if int(m.group(1)) > int(m.group(2)) or int(m.group(2)) > 300:
                    c["classement_aberrant"][0] += 1
                    exemples["classement_aberrant"].append(f"{fiche} {an} {m.group(0)}")
            if an == "2019" and "Fastnet" in evs:
                c["fastnet_2019"][1] += 1
        for e in r.get("ecarts_site") or []:
            if not e.get("_verifie") or e.get("gravite") != "erreur":
                continue
            champ = e.get("champ")
            b = bateaux.get(fiche, {})
            if champ in ("architecte", "chantier") and re.search(r"absent|null|vide|aucun", str(e.get("site")), re.I):
                c[f"{champ}_absent"][1] += 1
                if not b.get(champ):
                    c[f"{champ}_absent"][0] += 1
                    exemples[f"{champ}_absent"].append(f"{fiche} ({str(e.get('fiche'))[:50]})")
            if champ == "bapteme" and re.search(r"titre|en-t[êe]te", str(e.get("fiche")), re.I):
                c["titre_pour_bapteme"][1] += 1
                if fold_eq(b.get("bapteme"), e.get("site")):
                    c["titre_pour_bapteme"][0] += 1
                    exemples["titre_pour_bapteme"].append(f"{fiche} {b.get('bapteme')}")
        for e in r.get("ecarts_site") or []:
            if e.get("_verifie") and re.search(r"bermudes", str(e.get("fiche")), re.I):
                p = SITE / fiche / "index.html"
                if any(l[0][:4] == "2019" and "Fastnet" in l[2] for l in frise):
                    c["fastnet_2019"][0] += 1
                    exemples["fastnet_2019"].append(fiche)
                break
    print(f"Mesure {classe} (erreurs restantes / cas examinés)")
    for k, (n, tot) in c.items():
        print(f"  {k:22s} {n:4d} / {tot}")
    if "-v" in sys.argv:
        for k, ex in exemples.items():
            for x in ex[:12]:
                print(f"    {k}: {x}")


def fold_eq(a, b):
    return plier(a) == plier(b)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    mesurer(next((a for a in sys.argv[1:] if not a.startswith("-")), "imoca"))
