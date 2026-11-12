# Modèle de données

Format commun des CSV : UTF-8 sans BOM, séparateur virgule, point décimal, première ligne = noms de colonnes.
Les identifiants (`id`) sont en minuscules, sans accents, avec des tirets, et **ne changent jamais** une fois publiés.

## Vue d'ensemble : deux couches (validé le 09/11/2026)

```
Sources (on corrige ici)                         Base (régénérée, jamais corrigée à la main)
------------------------                         -------------------------------------------
donnees/site/html/       pages de l'auteur  ──┐
donnees/site/*.json      inventaires         ├─► site/tools/build.mjs ──► site/public/ (le site)
site/content/*.json      compléments sourcés ─┘                       └─► donnees/site/ (exports, à venir)
                                                                              │
donnees/*.csv            barème, ancien classement, registre ─────────────────┴─► classements (Python)
```

## Données du site (`donnees/site/`, produites par `outils/scraping/`)

| Fichier ou dossier | Contenu |
|---|---|
| `html/` | Pages de histoiredeshalfs.com telles qu'aspirées (windows-1252), à la même place que sur le site d'origine. Matière première du site. |
| `inventory.json` | Chaque page aspirée en direct : adresse, statut, date |
| `wayback-index.json`, `wayback.json` | Dernière capture connue de chaque page dans la Wayback Machine ; pages prises dans l'archive et date de capture (affichée « archive du … » sur le site) |
| `missing-dossiers.json`, `images-needed.json` | Écrits par la construction : dossiers de bateaux encore manquants, photos citées par les pages |
| `commons/index.json`, `commons/files/` | Photos libres de Wikimedia Commons, par fiche bateau : fichier, page source, licence, auteur, date |
| *(à venir)* `bateaux.csv`, `noms_bateaux.csv`, `marins.csv`, `palmares.csv` | Exports de la base du site, pour le classement |

Aujourd'hui, la construction produit `site/public/data/bateaux.json` (un enregistrement par bateau : classe, fiche, numéro, nom de baptême, nom actuel, tous les noms, année, architecte, modèle, chantier, et si l'architecte ou le chantier sont déduits) et `site/public/data/search.json` (index de recherche des bateaux et des marins).

## Compléments sourcés du site (`site/content/`)

| Fichier | Contenu |
|---|---|
| `normalisation.json` | Écritures unifiées des architectes, modèles, chantiers et marins ; chantier de chaque modèle de série ; fusions de marins |
| `ajouts.json` | Faits ajoutés par la rédaction (ou bateaux absents du site d'origine), avec leurs sources ; signalés sur le site |
| `courses-histoire.json` | Histoire et palmarès des courses d'après Wikipédia |
| `palmares.json` | Palmarès sourcés complets (Vendée Globe, Route du Rhum, Transat Jacques-Vabre, The Ocean Race, Mini Transat, Fastnet) |
| `solitaire.json` | Vainqueurs de la Course de l'Aurore et de la Solitaire du Figaro, 1970 à aujourd'hui |
| `resultats.json` | Podiums par édition (sites officiels, Wikipédia) |
| `apercus.json` | Histoire de chaque classe |
| `calendrier/*.json` | Courses de la saison, vérifiées sur les sites officiels |

## Ce que la construction déduit des pages de l'auteur
- **Bateau** : nom de baptême, nom actuel, noms successifs avec l'année du changement, numéro de voile à la mise à l'eau, nom porté une année donnée, année de construction (ou « mise à l'eau prévue en … » pour un bateau commandé), événements (construction, vente, chavirage, démâtage, victoire, record…).
- **Marins** : repérés dans le texte (« Prénom NOM ») ; pour chaque mention, un rôle : `skipper`, `co` (co-skipper ou équipier), `owner` (propriétaire), `tiers` (cité, pas à bord). Correspondance avec le barème : `skipper` → skipper ; `co` → equipier ; `owner` et `tiers` → aucun résultat.

## Registre des identifiants (à créer : `donnees/identifiants.csv`)
`type` (marin, bateau, course, edition), `id` (figé), `adresse` (page du site), `nom` (nom affiché), `anciennes_adresses` (redirigées). La construction du site lit ce registre : un identifiant existant n'est jamais recalculé à partir du nom.

# Base du classement (`donnees/`)

## Référentiels

### `skippers.csv` : les marins
| Colonne | Contenu |
|---|---|
| `id` | identifiant actuel, au format « nom-prenom » (ex. `le-cleach-armel`), repris de l'ancien fichier |
| `nom` | nom affiché, au format « Nom Prénom » de l'ancien fichier |
| `nationalite` | à compléter |
| `id_site` | identifiant de la fiche marin sur le site (ex. `armel-le-cleach`), à remplir par rapprochement |
| `remarque` | ex. fusion de doublons à vérifier |

> Décidé le 09/11/2026 : l'identifiant du site (`prénom-nom`) devient l'`id` principal, une fois les `id_site` rapprochés et vérifiés.

### `bateaux.csv` : les bateaux (vide pour l'instant, à remplir depuis le site)
`id`, `nom` (nom de baptême), `classe`, `annee_lancement`, `architecte`, `chantier`, `anciens_noms`, `id_site` (ex. `imoca/gitana-eighty`), `remarque`

> Prévu : une table `noms_bateaux.csv` (bateau, nom, à partir de l'année, numéro de voile, source) pour la chronologie des noms. Un exemple est généré dans `controles/2026-11-05/noms_bateaux.csv`.

### `courses_historiques.csv` : les 152 courses de l'ancien classement des solitaires
| Colonne | Contenu |
|---|---|
| `id` | ex. `vendee-globe-2024` |
| `ordre` | ordre chronologique d'origine |
| `nom`, `annee` | ex. « Vendée Globe 2024 », 2024 |
| `type_bareme_historique` | type dans l'ancien barème (Transat, Tour du monde, Tour du monde à étapes, Figaro, Mini Transat) |
| `classe` | classe par défaut déduite du nom (« Non renseignée » pour les courses multi-classes) |
| `nom_origine` | intitulé exact de la colonne dans `classement_solo.xls` |
| `niveau`, `course_canonique` | **à remplir** avec le nouveau barème (niveaux 1 à 4) |
| `remarque` | ex. « Course en double : à confirmer », « barème déduit : à confirmer » |

> Prévu : un référentiel complet des courses (toutes classes), en deux tables.
> - `courses.csv` contient une ligne par course réelle : `id`, `nom_canonique`, `classe`, `periodicite`, `format` (une manche ou par étapes), `equipage` (solo, double, équipage), `niveau`.
> - `variantes_courses.csv` contient tous les noms rencontrés : `nom_brut`, `classe`, `annee_debut`, `annee_fin`, `course_id`.

### `classes.csv`
Liste des classes, en écriture officielle (validé le 09/11/2026) : IMOCA, Ultim, Ocean Fifty, MOD70, Class40, Figaro, Mini 6.50 ; anciennes : ORMA 60, Maxis, Half Tonner, Quarter Tonner, Trois-quarts Tonner (d'autres à venir : One et Two Tonners, IOR, Muscadet, 50 pieds, TP 52, maxis monocoques). « Toutes » sert seulement de filtre. Une course (Whitbread, Golden Globe) n'est pas une classe. Les 60 pieds d'avant l'IMOCA restent dans la liste des 60 pieds Open.
> À mettre à jour : le fichier actuel contient encore « Golden Globe (rétro) » et ne contient pas les classes anciennes du site.

## Faits

### `resultats.csv` : une ligne = un marin sur une course
| Colonne | Contenu |
|---|---|
| `course_id`, `skipper_id`, `bateau_id` | renvoient aux référentiels (`bateau_id` vide pour l'historique) |
| `role` | `skipper` ou `equipier` |
| `categorie` | catégorie de l'ancien barème (Scratch, Classe…), vide pour l'historique |
| `place`, `partants`, `statut` | ex. 3, 49, `classé` ; ou vide, 30, `DNF` |
| `victoires_etape` | nombre d'étapes gagnées |
| `points_historiques` | points de l'ancien fichier (quand on n'a pas la place) |
| `source` | ex. `classement_solo.xls`, `site:skippers/armel-le-cleach` |
| `remarque` | |

### `records.csv` et `types_records.csv`
- `records.csv` : `type_record`, `skipper_id`, `bateau_id`, `date` (AAAA-MM-JJ), `performance`, `remarque`. On garde aussi les records battus.
- `types_records.csv` : `type_record`, `bonus`, `description`.

## Règles de calcul

| Fichier | Contenu |
|---|---|
| `bareme_niveaux.csv` | niveau, nom, base, coefficient de flotte oui/non, définition |
| `bareme_places.csv` | place, puis coefficient (8+ et abandon compris) |
| `bareme_flotte.csv` | tranches de partants, puis coefficient |
| `bareme_roles.csv` | skipper 1, équipier 0,67 |
| `bareme_historique.csv` | ancien barème par type de course, conservé pour mémoire |
| `parametres.csv` | année de démarrage, année de référence, fenêtres glissantes, réduction des anciens records, bonus d'étape |

Les règles elles-mêmes sont expliquées dans `docs/decisions.md`.
