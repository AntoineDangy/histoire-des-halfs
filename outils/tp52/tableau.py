"""Tableau des points TP52 par marin, à partir du calcul général (outils/classement/calculer.py).

Usage (depuis la racine du dépôt, après `node site/tools/build.mjs` et `python outils/classement/calculer.py`) :
    python outils/tp52/tableau.py
Produit controles/<date>/tp52-points-par-marin.csv (une ligne par marin) et tp52-points.md (lecture rapide).
Les règles (niveaux des courses TP52, rôles à bord) sont dans docs/decisions.md.
"""
import csv, datetime
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]


def main():
    with open(RACINE / "sorties" / "classement" / "points.csv", encoding="utf-8", newline="") as f:
        lignes = [r for r in csv.DictReader(f) if r["classe"] == "TP52"]
    m = defaultdict(lambda: {"points": 0.0, "courses": 0, "skipper": 0, "equipier": 0, "victoires": 0,
                             "n2": 0.0, "n3": 0.0, "n4": 0.0, "annees": set(), "bateaux": set(), "meilleur": None})
    for r in lignes:
        x = m[(r["marin_id"], r["marin"])]
        p = float(r["points"])
        x["points"] += p
        x["courses"] += 1
        x["skipper" if r["role"] == "skipper" else "equipier"] += 1
        x["victoires"] += r["place"] == "1"
        x[f"n{r['niveau']}"] += p
        x["annees"].add(int(r["annee"]))
        if r["bateau"]:
            x["bateaux"].add(r["bateau"])
        if x["meilleur"] is None or p > float(x["meilleur"]["points"]):
            x["meilleur"] = r
    rangs = sorted(m.items(), key=lambda kv: -kv[1]["points"])
    jour = datetime.date.today().isoformat()
    ctl = RACINE / "controles" / jour
    ctl.mkdir(parents=True, exist_ok=True)
    champs = ["rang", "marin", "marin_id", "points", "courses", "comme_skipper", "comme_equipier", "victoires",
              "points_mondial_n2", "points_regates_historiques_n3", "points_circuit_n4", "annees", "bateaux", "meilleur_resultat"]
    with open(ctl / "tp52-points-par-marin.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(champs)
        for i, ((mid, nom), x) in enumerate(rangs, 1):
            b = x["meilleur"]
            w.writerow([i, nom, mid, round(x["points"], 2), x["courses"], x["skipper"], x["equipier"], x["victoires"],
                        round(x["n2"], 2), round(x["n3"], 2), round(x["n4"], 2),
                        f"{min(x['annees'])}-{max(x['annees'])}", " / ".join(sorted(x["bateaux"])),
                        f"{b['annee']} {b['libelle']} : {b['place']}/{b['partants'] or '?'} ({b['role']}, {b['points']} pts)"])
    md = [f"# TP52 : points par marin ({jour})", "",
          "> Version de travail, non publiée. Barème de `docs/decisions.md` ; niveaux TP52 validés le 11/11/2026 "
          "(Mondial TP52 = niveau 2, épreuves du circuit MedCup puis 52 Super Series = niveau 4, régates historiques = niveau 3 "
          "dont Transpac et Newport-Bermuda). Rôles : règles TP52 du 09/11/2026 (skipper « à vérifier » quand l'auteur ne l'écrit pas).", "",
          f"{len(lignes)} résultats comptés, {len(rangs)} marins. Tableau complet : `tp52-points-par-marin.csv`.", "",
          "| Rang | Marin | Points | Courses (skipper / équipier) | Victoires | Mondial | Régates hist. | Circuit | Années |",
          "|---|---|---|---|---|---|---|---|---|"]
    for i, ((mid, nom), x) in enumerate(rangs[:40], 1):
        md.append(f"| {i} | {nom} | {x['points']:.1f} | {x['courses']} ({x['skipper']} / {x['equipier']}) | {x['victoires']} | "
                  f"{x['n2']:.1f} | {x['n3']:.1f} | {x['n4']:.1f} | {min(x['annees'])}-{max(x['annees'])} |")
    (ctl / "tp52-points.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{len(rangs)} marins, {len(lignes)} résultats ; controles/{jour}/tp52-points.md")


if __name__ == "__main__":
    main()
