"""Vérifie les relevés de l'agent relecteur et en fait un rapport.

Garde-fou contre l'invention : chaque affirmation du relevé doit citer mot pour mot la ligne de la fiche
d'origine qu'elle indique (à la ligne près, tolérance d'une ligne autour, accents et espaces ignorés).
Une affirmation dont la citation est introuvable est marquée « rejetée » : elle ne doit jamais servir à corriger.

Usage (depuis la racine du dépôt) :
  python outils/relecture/verifier.py imoca
Écrit controles/relecture-bateaux/<classe>/rapport.md et ecarts.csv.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SORTIE = RACINE / "sorties" / "relecture"
RESULTATS = RACINE / "controles" / "relecture-bateaux"


def plier(s):
    s = str(s or "")
    for a, b in (("œ", "oe"), ("Œ", "OE"), ("æ", "ae"), ("Æ", "AE"), ("ß", "ss")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def citation_ok(item, lignes):
    n, cit = item.get("ligne"), plier(item.get("citation"))
    if not isinstance(n, int) or len(cit) < 3:
        return False
    autour = "".join(plier(l) for l in lignes[max(0, n - 2): n + 1])  # ligne n-1, n, n+1
    return cit in autour


def verifier(classe):
    dossier = RESULTATS / classe
    fichiers = sorted(f for f in dossier.glob("*.json"))
    lignes_ecarts, rejets, illisibles, stats = [], [], [], {"bateaux": 0, "affirmations": 0, "rejetees": 0}
    par_bateau = []
    for f in fichiers:
        src = SORTIE / classe / f"{f.stem}.lignes.json"
        try:
            r = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            illisibles.append(f"{f.name} : {e}")
            continue
        if not src.exists():
            illisibles.append(f"{f.name} : dossier de relecture absent (relancer preparer.py {classe})")
            continue
        lignes = json.loads(src.read_text(encoding="utf-8"))
        stats["bateaux"] += 1
        fiche = r.get("fiche", f.stem)
        bilan = {"fiche": fiche, "erreurs": 0, "doutes": 0, "chrono": 0, "rejets": 0,
                 "bapteme": (r.get("bapteme") or {}).get("nom"), "certitude": (r.get("bapteme") or {}).get("certitude")}
        groupes = [("bapteme", [r["bapteme"]] if isinstance(r.get("bapteme"), dict) and r["bapteme"].get("nom") else []),
                   ("noms", r.get("noms") or []), ("skippers", r.get("skippers") or []),
                   ("ecarts_site", r.get("ecarts_site") or []), ("chronologie", r.get("chronologie") or [])]
        for groupe, items in groupes:
            for it in items:
                stats["affirmations"] += 1
                ok = citation_ok(it, lignes)
                it["_verifie"] = ok
                if not ok:
                    stats["rejetees"] += 1
                    bilan["rejets"] += 1
                    rejets.append((fiche, groupe, it.get("ligne"), it.get("citation"), json.dumps(it, ensure_ascii=False)[:160]))
                    continue
                if groupe == "ecarts_site":
                    bilan["erreurs" if it.get("gravite") == "erreur" else "doutes"] += 1
                    lignes_ecarts.append([fiche, "site", it.get("champ"), it.get("gravite"), it.get("site"), it.get("fiche"), it.get("ligne"), it.get("citation")])
                elif groupe == "chronologie":
                    bilan["chrono"] += 1
                    lignes_ecarts.append([fiche, "chronologie", "", it.get("gravite", "doute"), "", it.get("probleme"), it.get("ligne"), it.get("citation")])
        # Le relevé vérifié est réécrit avec la marque _verifie sur chaque affirmation.
        f.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        par_bateau.append(bilan)

    with open(dossier / "ecarts.csv", "w", encoding="utf-8", newline="") as out:
        w = csv.writer(out)
        w.writerow(["fiche", "type", "champ", "gravite", "site", "fiche_origine", "ligne", "citation"])
        w.writerows(lignes_ecarts)

    md = [f"# Relecture des fiches {classe}", "",
          f"- Bateaux relus : {stats['bateaux']}",
          f"- Affirmations vérifiées : {stats['affirmations']}, dont **{stats['rejetees']} rejetées** (citation introuvable dans la fiche d'origine)",
          f"- Écarts avec le site et incohérences retenus : {len(lignes_ecarts)} (détail dans `ecarts.csv`)", ""]
    if illisibles:
        md += ["## Relevés illisibles (à refaire)", *[f"- {x}" for x in illisibles], ""]
    md += ["## Par bateau", "", "| Fiche | Baptême relevé | Certitude | Erreurs site | Doutes | Chronologie | Rejets |", "|---|---|---|---|---|---|---|"]
    for b in sorted(par_bateau, key=lambda b: -(b["erreurs"] * 3 + b["doutes"] + b["chrono"])):
        md.append(f"| {b['fiche']} | {b['bapteme'] or '—'} | {b['certitude'] or '—'} | {b['erreurs']} | {b['doutes']} | {b['chrono']} | {b['rejets']} |")
    if rejets:
        md += ["", "## Affirmations rejetées (ne pas utiliser)", ""]
        md += [f"- {f} · {g} · L{l} « {c} »" for f, g, l, c, _ in rejets]
    (dossier / "rapport.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{classe} : {stats['bateaux']} bateaux, {stats['affirmations']} affirmations, {stats['rejetees']} rejetées, "
          f"{len(lignes_ecarts)} écarts retenus, {len(illisibles)} relevés illisibles -> {(dossier / 'rapport.md').relative_to(RACINE)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    verifier(sys.argv[1] if len(sys.argv) > 1 else "imoca")
