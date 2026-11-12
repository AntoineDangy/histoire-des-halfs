# Aspiration (scraping) du site d'origine

Scripts Node.js (version 18 ou plus, sans dépendance à installer). Ils écrivent dans `donnees/site/`, quel que soit le dossier d'où on les lance. Chacun **reprend là où il s'est arrêté** après une coupure : on peut l'arrêter (Ctrl-C) et le relancer sans rien perdre.

Après une aspiration, reconstruire le site pour prendre en compte les nouvelles pages (voir `site/README.md`), le vérifier en local, puis envoyer sur GitHub. **Ne rien mettre en ligne sans l'accord du propriétaire.**

| Script | Rôle | Produit | Durée |
|---|---|---|---|
| `crawl.mjs` | Aspire les pages HTML de histoiredeshalfs.com (sans les images), en suivant les liens. Les pages prioritaires et celles qu'elles citent passent en tête. | `donnees/site/html/`, `donnees/site/inventory.json` | Le serveur limite à ~1 page toutes les 30 à 40 s : environ **3 jours** pour tout le site. Le délai s'allonge tout seul si le serveur demande de ralentir. |
| `wayback.mjs` | Complète avec les dernières copies de la Wayback Machine les pages pas encore aspirées en direct. Ne remplace **jamais** une page aspirée en direct. | `wayback-index.json`, `wayback.json`, pages dans `html/` | Index : quelques minutes ; pages : ~2 s chacune |
| `fetch-one.mjs` | Récupère une page précise du site d'origine. | une page dans `html/` | quelques secondes |
| `commons.mjs` | Cherche les photos **libres de droit** des bateaux sur Wikimedia Commons (catégorie « Nom (ship, année) » obligatoire), garde auteur et licence. Classes actuelles d'abord. | `donnees/site/commons/index.json`, `commons/files/` | ~1,5 s par requête : plusieurs heures pour toutes les fiches |
| `photos.mjs` | Rapatrie les photos du **site de l'auteur**. **Ne pas utiliser sur le site** : ces photos ne sont pas libres de droit (décision du 09/11/2026). Conservé pour mémoire. | `site/public/photos/` | — |

## Lancer (depuis la racine du dépôt)

```
node outils/scraping/crawl.mjs donnees/site 50000 3000 "Histoire des Minis/Liste des minis.htm"
node outils/scraping/wayback.mjs index
node outils/scraping/wayback.mjs fetch
node outils/scraping/commons.mjs 1500 4
```

- `crawl.mjs [sortie] [nombre max de pages] [délai en ms] [pages prioritaires, séparées par des virgules]`
- `wayback.mjs fetch [délai en ms] [dossiers prioritaires]`
- `commons.mjs [délai en ms] [photos max par bateau]`. Pour un essai sans rien enregistrer : variable `ONLY=imoca/charal/,ultim/sodebo-ultim-3/`.
- `commons.mjs` lit la liste des bateaux produite par la construction du site (`site/public/data/bateaux.json`) : construire le site d'abord.

## Règles

- **Rester poli** : une requête à la fois, respecter le rythme du serveur. Ne jamais contourner une limite de débit ni une protection anti-robot.
- Les pages de l'auteur sont en windows-1252 : ne pas les réenregistrer avec un éditeur (Git les garde octet pour octet, règle `-text` dans `.gitattributes`).
- Les scripts partagent la bibliothèque du site (`site/tools/lib/`).
