# Le site « Mémoire du large »

Site statique généré par Node.js (version 18 ou plus, **aucune dépendance à installer**), publié sur Cloudflare Pages.
Règles validées : `docs/decisions.md` ; données : `docs/modele-donnees.md`.

```
donnees/site/html/  (pages de histoiredeshalfs.com)  ─┐
site/content/       (compléments sourcés)            ─┼─ site/tools/build.mjs ──▶ site/public/ (le site)
site/public/assets/ (CSS et JS écrits à la main)     ─┘
```

## Construire et prévisualiser

Les commandes marchent depuis n'importe quel dossier (ici, depuis la racine du dépôt) :

```
node site/tools/build.mjs --publish
node site/tools/serve.mjs 4321
```

Puis ouvrir http://localhost:4321/. La construction dure environ une minute et recrée tout `site/public/`, sauf `assets/` (et `photos/`, inutilisé).

- `--publish` : version de mise en ligne (les photos non rapatriées ne sont jamais chargées depuis le serveur de l'auteur).
- `--photos` : affiche les photos en vitrine (désactivé en attendant la reprise du design).
- Contrôles : `AUDIT_PODIUM=1` (liens bateaux des podiums → `site/_audit/podiums.tsv`), `AUDIT_ROLES=1` (rôles des marins), `AUDIT_BASE=1` (architectes et chantiers).

## Mettre en ligne (seulement avec l'accord explicite du propriétaire)

```
npx wrangler pages deploy site/public --project-name histoire-des-halfs --branch main --commit-dirty=true
```

La première fois sur un PC : `npx wrangler login` (connexion au compte Cloudflare dans le navigateur ; la clé est enregistrée dans le profil Windows, **jamais dans le dépôt**). Limites du plan gratuit : 20 000 fichiers par site (le site en compte ~15 300), 25 Mo par fichier.

## Où corriger quoi

| Fichier | Rôle |
|---|---|
| `content/normalisation.json` | Écritures unifiées (architectes, modèles, chantiers, marins), chantier des modèles de série, fusions de marins |
| `content/ajouts.json` | Ajouts de la rédaction, avec sources (signalés sur le site) |
| `content/palmares.json`, `courses-histoire.json`, `solitaire.json`, `resultats.json` | Palmarès et podiums sourcés |
| `content/apercus.json` | Histoire des classes |
| `content/calendrier/*.json` | Calendrier de la saison |
| `tools/series.mjs` | Classes refondues : listes d'origine, textes, courses phares, menu |
| `tools/build.mjs` | Gabarits et règles de lecture des pages (nom du site en tête : `SITE`) |
| `tools/lib/` | Lecture des pages de l'auteur (`source.mjs`), analyse des dossiers et des marins (`parse.mjs`), courses (`races.mjs`) |
| `public/assets/` | Styles (`style.css`, `designs.css`) et interactions (`app.js`) |
