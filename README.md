# Mémoire du large

Bateaux, courses et marins : site statique né de la refonte de [histoiredeshalfs.com](https://www.histoiredeshalfs.com/).
Le contenu des bateaux (textes, listes, photos) reste celui du site d'origine : on le récupère, on le structure, on le réaffiche.
Il est complété par d'autres sources ouvertes, citées sur chaque page : Wikipédia (`content/apercus.json`,
`content/courses-histoire.json`), sites officiels des courses (`content/calendrier/`), palmarès de la Solitaire
(`content/solitaire.json`). Le nom du site et la ligne des sources sont définis en tête de `tools/build.mjs` (`SITE`, `SOURCES_LINE`).

**Projet collaboratif open source** : les contributions sont les bienvenues, voir [CONTRIBUTING.md](CONTRIBUTING.md).
Le code est sous licence MIT ([LICENSE](LICENSE)) ; les textes repris de histoiredeshalfs.com restent la propriété de leur auteur.

> **Ce que le dépôt ne contient pas** : les photos (droits non vérifiés, à rapatrier avec `tools/photos.mjs` et `tools/commons.mjs`)
> et les adresses mail de particuliers présentes sur les pages d'origine (remplacées par `[adresse retirée]`).

## Chaîne de fabrication

```
histoiredeshalfs.com ──crawl.mjs──▶ _source/html/ ──build.mjs──▶ site/ (HTML statique)
```

1. **Aspiration** : `node tools/crawl.mjs _source 50000 3000 "<pages prioritaires>"`
   - une requête à la fois, avec un délai qui s'adapte aux limites du serveur (HTTP 429) ; reprend là où elle s'est arrêtée ;
   - les pages prioritaires, et les pages qu'elles référencent, passent en tête de file.
   **Copies d'archive** : `node tools/wayback.mjs index` puis `node tools/wayback.mjs fetch 2000 "<dossiers prioritaires>"`
   récupèrent les dernières captures de la Wayback Machine (web.archive.org), une requête à la fois. Elles ne remplacent jamais
   une page déjà aspirée en direct, et `crawl.mjs` les écrase par la version à jour dès qu'il les obtient.
   Les pages issues de l'archive sont listées dans `_source/wayback.json`, et leur fiche affiche la date de capture.
   **Photos** : `node tools/photos.mjs` rapatrie dans `site/photos/` les images utilisées par les pages (liste écrite par
   `build.mjs` dans `_source/images-needed.json`, séries actuelles d'abord) depuis la Wayback Machine ; `node tools/photos.mjs origin`
   tente ensuite, très lentement, celles absentes de l'archive. Relancer `build.mjs` pour que les pages utilisent les copies locales.
   **Ajouts de la rédaction** : `content/ajouts.json` complète une fiche de l'auteur avec des faits récents (`complete`)
   ou crée la fiche d'un bateau absent du site d'origine (`name`), toujours avec ses sources ; le site les signale comme tels.
2. **Génération** : `node tools/build.mjs` reconstruit entièrement `site/`, sauf `site/assets/`, qui est écrit à la main.
   À relancer chaque fois que de nouvelles pages ont été aspirées. Une fiche pas encore aspirée pointe vers l'archive d'origine (↗).
3. **Prévisualisation** : `node tools/serve.mjs 4321`, puis ouvrir http://localhost:4321/

## Mise en ligne (Cloudflare Pages, plan gratuit)

Le site reprend le travail de l'auteur de histoiredeshalfs.com : il se montre sur invitation et n'est pas indexé
(balise `noindex`, `robots.txt`, en-tête `X-Robots-Tag` dans `_headers`). Sans l'accord de l'auteur, mieux vaut en restreindre l'accès.

1. Générer la version de publication (photos non rapatriées servies par la Wayback Machine, pas par le serveur de l'auteur) :
   `node tools/build.mjs --publish`
2. Se connecter à Cloudflare (une fois, dans le navigateur) : `npx wrangler login`
3. Publier : `npx wrangler pages deploy site --project-name histoire-des-halfs`
   L'adresse sera `https://histoire-des-halfs.pages.dev`.
4. Pour réserver l'accès aux invités : tableau de bord Cloudflare, Zero Trust > Access > Applications > Self-hosted,
   domaine `histoire-des-halfs.pages.dev`, règle « Emails » avec les adresses des invités (gratuit jusqu'à 50 utilisateurs).
   Chaque invité reçoit alors un code par mail pour entrer.

Limites du plan gratuit : 20 000 fichiers par déploiement, 25 Mo par fichier, 500 déploiements par mois.

## Fiches skipper

`build.mjs` compile les skippers à partir de toutes les fiches bateau importées :
1. il repère les noms dans les lignes de résultats et d'équipage, où l'auteur écrit « Prénom NOM » ;
2. il retrouve ensuite toutes les autres lignes qui citent ces skippers, quelle que soit la casse ;
3. il fusionne les variantes d'écriture d'une même personne (« J. Dejeanty », « Frank » / « Franck Cammas »).

Chaque fiche (`skippers/<nom>/`) présente les bateaux, le palmarès, les faits marquants (victoires, records, démâtages,
chavirages, naufrages, blessures, disparitions, sauvetages, décès), une frise de carrière et toutes les mentions brutes.
Dans les fiches bateau, les noms des skippers sont cliquables. Les fiches skipper s'enrichissent à chaque import de fiches bateau.

## Organisation

| Dossier | Rôle |
|---|---|
| `tools/lib/source.mjs` | Lecture des pages d'origine (windows-1252) et nettoyage du HTML FrontPage en blocs (paragraphes et images) |
| `tools/lib/parse.mjs` | Extraction structurée : lignes des listes alphabétiques (nom, n° de voile, plan ou série, année, notes) et dossiers (noms successifs, chronologie, photos) |
| `tools/lib/races.mjs` | Reconnaissance des grandes courses et des lignes de résultat (course, classement) |
| `tools/series.mjs` | Configuration des séries refondues (pages d'origine, textes d'introduction, repères) et catalogue complet |
| `tools/build.mjs` | Gabarits et génération des pages |
| `tools/inspect.mjs` | Aide au repérage : affiche les paragraphes et liens d'une page aspirée |
| `tools/review.mjs` | Relecture : résumé des fiches générées d'une série (titre, nom actuel, plan, jalons, skippers) |
| `tools/check-results.mjs` | Relecture : découpage des pages de palmarès en éditions et classements |
| `tools/wayback.mjs` | Copies de la Wayback Machine en attendant l'aspiration directe |
| `tools/photos.mjs` | Rapatriement des photos dans `site/photos/` |
| `content/ajouts.json` | Ajouts de la rédaction (faits récents, bateaux absents du site d'origine), avec sources |
| `site/assets/` | CSS (système de design) et JS (recherche, filtres, visionneuse photo, thème) |

## État des itérations

- **Itération 1** : socle, design, accueil, catalogue des séries, rubrique Half Tonners (liste filtrable, architectes, pages thématiques, fiches), actualités, recherche globale.
- **Itération 2** :
  - moteur de séries générique (`tools/series.mjs`) ;
  - priorité aux séries actuelles (IMOCA, multicoques 60′/Ultim, Multi 50, Class 40, Mini 6.50) dans le menu et sur l'accueil ;
  - palmarès structurés par édition (Half Ton Cup, Aurore/Figaro, et pages de résultats des autres séries), avec liens vers les fiches ;
  - fiches bateau avec une frise des événements marquants (changements de nom, ventes, grandes courses, victoires, démâtages, chavirages, naufrages…) ;
  - Quarter et Trois-quarts Tonners ajoutés.
- **À suivre** : contrôler les fiches IMOCA, multicoques, Class 40 et Mini dès qu'elles sont aspirées, rapatrier les photos, ajouter les autres séries (One Ton, Figaro, Volvo…), puis une version anglaise.
