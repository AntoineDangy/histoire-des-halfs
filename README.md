# Mémoire du large

L'histoire des bateaux de course au large, des courses et des marins. Le projet rassemble trois choses :

- **le site**, né de la refonte de [histoiredeshalfs.com](https://www.histoiredeshalfs.com/) : la vie de chaque bateau,
  l'histoire des grandes courses, le palmarès des marins ;
- **le classement** des marins et des bateaux, calculé à partir des résultats ;
- **le jeu « Course au large »**, où ces marins s'affrontent de nouveau sur les grandes courses :
  https://course-au-large.pages.dev.

**Projet collaboratif open source** : les contributions sont les bienvenues, voir [CONTRIBUTING.md](CONTRIBUTING.md).
Le code est sous licence MIT ([LICENSE](LICENSE)). Les textes repris de histoiredeshalfs.com restent la propriété de leur
auteur ; les extraits de Wikipédia sont sous licence CC BY-SA 4.0, avec leurs sources.

> **Ce que le dépôt ne contient pas** : les photos (droits des auteurs), les adresses mail et les numéros de téléphone de
> particuliers présents sur les pages d'origine (remplacés par `[adresse retirée]` et `[téléphone retiré]`), les pages
> aspirées des sites des classes (seules les données qui en sont extraites sont publiées), aucune clé ni aucun identifiant
> de compte.

## Organisation

| Dossier | Contenu |
|---|---|
| `site/` | Le site : générateur (`site/tools/`), compléments sourcés (`site/content/`), styles et scripts (`site/public/assets/`). Voir [`site/README.md`](site/README.md). |
| `donnees/` | Les données : pages de histoiredeshalfs.com telles qu'aspirées (`donnees/site/html/`, windows-1252), base du classement en CSV (résultats, barème, registre des identifiants). Voir [`docs/modele-donnees.md`](docs/modele-donnees.md). |
| `outils/` | Aspiration des pages (`outils/scraping/`), calcul du classement (`outils/classement/`), rapprochement avec les sites des classes, relecture des fiches. |
| `jeu/` | Le jeu « Course au large » : moteur de règles, données, interface, serveur de salons. Voir [`jeu/README.md`](jeu/README.md). |
| `docs/` | Les règles validées ([`docs/decisions.md`](docs/decisions.md)), le modèle de données, les anomalies connues du site d'origine. |

## Le site

Node.js 18 ou plus, aucune dépendance à installer. Depuis la racine du dépôt :

```bash
node site/tools/build.mjs      # génère site/public/ (environ deux minutes)
node site/tools/serve.mjs 4321 # puis ouvrir http://localhost:4321/
```

La page « Classement » est calculée pendant la construction par `outils/classement/calculer.py` (Python 3, sans
dépendance) ; sans Python, la construction le signale et continue sans cette page.

Les pages d'origine sont déjà dans `donnees/site/html/`. Pour les mettre à jour ou récupérer les photos libres de
Wikimedia Commons : [`outils/scraping/README.md`](outils/scraping/README.md).

## Le jeu

```bash
cd jeu
npm install
npm run dev     # http://localhost:5173
```

Tests, construction et déploiement de sa propre version : [`jeu/README.md`](jeu/README.md).

## Mettre en ligne sa propre version

Le site et le jeu sont des sites statiques : n'importe quel hébergeur convient. La version officielle utilise Cloudflare
Pages (plan gratuit) :

```bash
npx wrangler login     # une fois : connexion au compte Cloudflare dans le navigateur
node site/tools/build.mjs --publish
npx wrangler pages deploy site/public --project-name <nom-de-votre-projet>
```

Le site reprend le travail de l'auteur de histoiredeshalfs.com : il n'est pas indexé (balise `noindex`, en-tête
`X-Robots-Tag`). Sans l'accord de l'auteur, mieux vaut en restreindre l'accès (Cloudflare Zero Trust > Access, gratuit
jusqu'à 50 utilisateurs). Limites du plan gratuit : 20 000 fichiers par déploiement, 25 Mo par fichier.

Pour le jeu et son serveur de salons (jeu en réseau) : [`jeu/README.md`](jeu/README.md).
