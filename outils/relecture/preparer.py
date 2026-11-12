"""Prépare la relecture des fiches bateaux par un agent léger (Haiku).

Pour chaque bateau d'une classe, écrit un « dossier de relecture » qui met côte à côte :
  A. le texte de la fiche d'origine (histoiredeshalfs.com), lignes numérotées, avec les noms des photos ;
  B. ce que le site affiche aujourd'hui (nom de baptême, noms successifs, frise des années et des skippers).

Prérequis : le site construit (node site/tools/build.mjs --publish), pour site/public/data/bateaux.json.

Usage (depuis la racine du dépôt) :
  python outils/relecture/preparer.py imoca            # prépare les dossiers de la classe
  python outils/relecture/preparer.py imoca --a-faire  # liste les fiches pas encore relues
  python outils/relecture/preparer.py --classes        # liste les classes et leur nombre de bateaux

Reprise : un bateau dont le résultat existe déjà dans controles/relecture-bateaux/<classe>/ n'est jamais refait.
"""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

RACINE = Path(__file__).resolve().parents[2]
SITE = RACINE / "site" / "public"
SOURCES = RACINE / "donnees" / "site" / "html"
SORTIE = RACINE / "sorties" / "relecture"
RESULTATS = RACINE / "controles" / "relecture-bateaux"

# Ordre de passage : les classes principales d'abord.
ORDRE = ["imoca", "ultim", "ocean-fifty", "class40", "figaro", "mod70", "orma", "maxis", "mini"]


def charger_bateaux():
    f = SITE / "data" / "bateaux.json"
    if not f.exists():
        sys.exit("Le site n'est pas construit : lancer d'abord  node site/tools/build.mjs --publish")
    return [b for b in json.loads(f.read_text(encoding="utf-8")) if b.get("fiche")]


def classe_de(b):
    return b["fiche"].split("/")[0]


def nom_fichier(b):
    return b["fiche"].strip("/").split("/", 1)[1].replace("/", "__")


def lire_html(path):
    brut = path.read_bytes()
    m = re.search(rb'charset=["\']?([\w-]+)', brut[:2048], re.I)
    cs = (m.group(1).decode() if m else "windows-1252").lower()
    if cs in ("iso-8859-1", "latin-1"):
        cs = "windows-1252"
    try:
        return brut.decode(cs)
    except (LookupError, UnicodeDecodeError):
        return brut.decode("windows-1252", errors="replace")


def nettoyer(t):
    t = html.unescape(t)
    t = t.replace("\xa0", " ")
    t = re.sub(r"[ \t\r\f\v]+", " ", t)
    return t


def texte_source(path):
    """Texte de la fiche d'origine, une ligne par paragraphe, photos signalées par leur nom de fichier."""
    h = lire_html(path)
    h = (re.search(r"(?is)<body[^>]*>(.*)</body>", h) or [None, h])[1]
    h = re.sub(r"(?is)<(script|style)\b.*?</\1>", "", h)
    h = re.sub(r"(?is)<!--.*?-->", "", h)
    h = re.sub(r'(?is)<img[^>]*?src=["\']?([^"\'\s>]+)[^>]*>',
               lambda m: f"\n[photo : {unquote(m.group(1)).split('/')[-1]}]\n", h)
    h = re.sub(r"(?i)<br\s*/?>|</?p\b[^>]*>|</tr>|</?div\b[^>]*>|</h\d>|</li>|</td>", "\n", h)
    h = re.sub(r"<[^>]+>", " ", h)
    lignes = []
    for l in nettoyer(h).split("\n"):
        l = l.strip()
        if l:
            lignes.append(l)
    return lignes


def texte_site(path):
    """Ce que la fiche du site affiche : en-tête, noms, faits, frise « En un coup d'œil »."""
    h = path.read_text(encoding="utf-8")
    src = re.search(r'Source : <a href="([^"]+)"[^>]*>dossier d\'origine', h)
    frise = frise_site(h)
    # On coupe la page avant la frise : elle est rendue à part, une ligne par année, pour qu'aucun nom
    # de skipper ne soit rattaché à la mauvaise année.
    i = h.find('<ol class="frise"')
    if i > 0:
        h = h[:i]
    h = re.sub(r"(?is)<(script|style|nav|header|footer)\b.*?</\1>", "", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</tr>|</li>|</div>|</h\d>|</dt>|</dd>|</span>", "\n", h)
    h = re.sub(r"<[^>]+>", " ", h)
    t = nettoyer(h)
    t = "\n".join(l.strip() for l in t.split("\n") if l.strip())
    t = t.split("Chronologie détaillée")[0].replace("En un coup d'œil", "").strip()
    if frise:
        t += "\nFRISE DU SITE, une ligne par année (année | skipper(s) affiché(s) | événements) :\n" + "\n".join(frise)
    return t, (src.group(1) if src else None)


def frise_site(h):
    """Frise « En un coup d'œil » : une ligne par année, avec le skipper affiché et les événements."""
    m = re.search(r'(?s)<ol class="frise">(.*?)</ol>', h)
    if not m:
        return []
    out = []
    for li in re.split(r'<li class="yr">', m.group(1))[1:]:
        an = re.search(r'<span class="fy">([^<]*)</span>', li)
        sk = re.search(r'<span class="sk( cont)?" title="([^"]*)"', li)
        skipper = (html.unescape(sk.group(2)) + (" (suite)" if sk.group(1) else "")) if sk else "—"
        evs = [nettoyer(re.sub(r"<[^>]+>", "", e)).strip() for e in re.findall(r'(?s)<li class="ev-[^"]*">(.*?)</li>', li)]
        out.append(f"{an.group(1) if an else '?'} | {skipper} | {' ; '.join(e for e in evs if e)}")
    return out


def source_rel(url):
    m = re.search(r"histoiredeshalfs\.com/(.+)$", url or "")
    return unquote(m.group(1)) if m else None


def preparer(classe):
    bateaux = [b for b in charger_bateaux() if classe_de(b) == classe]
    dossier = SORTIE / classe
    dossier.mkdir(parents=True, exist_ok=True)
    index, sans_source = [], []
    for b in bateaux:
        page = SITE / b["fiche"] / "index.html"
        if not page.exists():
            sans_source.append(b["fiche"])
            continue
        resume, url = texte_site(page)
        rel = source_rel(url)
        if not rel or not (SOURCES / rel).exists():
            sans_source.append(b["fiche"])
            continue
        lignes = texte_source(SOURCES / rel)
        nom = nom_fichier(b)
        fiche_site = {k: b.get(k) for k in ("fiche", "classe", "numero", "bapteme", "actuel", "noms", "annee", "architecte", "chantier")}
        txt = [
            f"FICHE : {b['fiche']}",
            f"DOSSIER D'ORIGINE : {rel}",
            "",
            "=== A. FICHE D'ORIGINE (la vérité ; lignes numérotées) ===",
            *[f"L{i}: {l}" for i, l in enumerate(lignes, 1)],
            "",
            "=== B. CE QUE LE SITE AFFICHE (à contrôler) ===",
            json.dumps(fiche_site, ensure_ascii=False),
            resume,
        ]
        (dossier / f"{nom}.txt").write_text("\n".join(txt), encoding="utf-8")
        (dossier / f"{nom}.lignes.json").write_text(json.dumps(lignes, ensure_ascii=False), encoding="utf-8")
        index.append({"fiche": b["fiche"], "nom": nom, "source": rel, "lignes": len(lignes)})
    (dossier / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{classe} : {len(index)} dossiers préparés dans {dossier.relative_to(RACINE)}"
          + (f", {len(sans_source)} fiches sans dossier d'origine lisible" if sans_source else ""))
    return index


def a_faire(classe):
    idx = SORTIE / classe / "index.json"
    if not idx.exists():
        preparer(classe)
    index = json.loads(idx.read_text(encoding="utf-8"))
    reste = [e for e in index if not (RESULTATS / classe / f"{e['nom']}.json").exists()]
    print(f"{classe} : {len(index) - len(reste)} relues, {len(reste)} à faire")
    for e in reste:
        print(f"{e['nom']}\t{e['lignes']}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args or args[0] == "--classes":
        from collections import Counter
        c = Counter(classe_de(b) for b in charger_bateaux())
        for k in ORDRE + sorted(set(c) - set(ORDRE)):
            if k in c:
                print(f"{k}\t{c[k]}")
    elif "--a-faire" in args:
        a_faire(args[0])
    else:
        preparer(args[0])
