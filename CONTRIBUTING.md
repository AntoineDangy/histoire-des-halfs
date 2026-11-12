# Contribuer à Mémoire du large

Merci de votre intérêt ! Toutes les contributions sont les bienvenues : corrections de fiches, nouvelles sources,
améliorations du générateur, du design ou de la recherche.

## Démarrer

Prérequis : Node.js 18 ou plus récent (aucune dépendance npm).

```bash
node tools/build.mjs        # régénère site/ à partir de _source/ et content/
node tools/serve.mjs 4321   # puis ouvrir http://localhost:4321/
```

Les photos ne sont pas versionnées (droits non vérifiés). Pour les obtenir localement :
`node tools/photos.mjs` (Wayback Machine) et `node tools/commons.mjs` (Wikimedia Commons), puis relancer `build.mjs`.

## Proposer une modification

1. Forkez le dépôt et créez une branche (`git checkout -b correction-fiche-xyz`).
2. Modifiez le code (`tools/`, `site/assets/`) ou les données (`content/`).
   `site/` est généré : n'éditez pas ses pages à la main, sauf `site/assets/`.
3. Relancez `node tools/build.mjs` et vérifiez le rendu.
4. Ouvrez une pull request en expliquant le changement.

## Règles pour les données

- **Toujours citer une source** (URL) pour un fait ajouté dans `content/` : Wikipédia, site officiel d'une course, presse.
- Suivez les conventions de l'auteur dans `content/ajouts.json` : une ligne par fait, l'année en tête de ligne,
  le nom de famille des skippers en capitales.
- **Pas de données personnelles** : n'ajoutez ni adresse mail, ni téléphone, ni adresse postale de particuliers.
- **Pas de photos** dans le dépôt : référencez-les par leur URL et leur licence.
- Aucune clé d'API ni identifiant de compte (Cloudflare, etc.) dans les commits.

## Contribuer au jeu (`jeu/`)

Prérequis : Node.js 20 ou plus récent.

```bash
cd jeu
npm install
npm run dev          # http://localhost:5173
npm test             # tests du moteur de règles
npm run typecheck    # vérification TypeScript
```

- Les valeurs des règles sont dans `jeu/packages/data/config/*.json`, pas dans le code.
- Une nouvelle règle va avec un test dans `jeu/packages/engine/test/` et une ligne dans `jeu/docs/decisions-jeu.md`.
  Les règles de jeu se discutent d'abord dans une issue : décrivez la situation de jeu et ce qui devrait se passer.
- Skippers et bateaux réels : citez la source de chaque donnée ajoutée. Pas de logo de sponsor, pas de photo.
- Déployer sa propre version : voir `jeu/README.md`.

## Signaler un problème

Ouvrez une issue avec la page concernée, ce qui est faux et, si possible, la source qui le corrige.
