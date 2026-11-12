# Contribuer à Mémoire du large

Merci de votre intérêt ! Toutes les contributions sont les bienvenues : corrections de fiches, nouvelles sources,
améliorations du générateur, du design, du classement ou du jeu.

## Démarrer

Site : Node.js 18 ou plus récent, aucune dépendance npm. Classement : Python 3, sans dépendance.

```bash
node site/tools/build.mjs        # régénère site/public/ à partir de donnees/ et site/content/
node site/tools/serve.mjs 4321   # puis ouvrir http://localhost:4321/
```

Jeu : Node.js 20 ou plus récent.

```bash
cd jeu
npm install
npm run dev          # http://localhost:5173
npm test             # tests du moteur de règles
npm run typecheck    # vérification TypeScript
```

## Proposer une modification

1. Forkez le dépôt et créez une branche (`git checkout -b correction-fiche-xyz`).
2. Modifiez le code ou les données :
   - site : générateur `site/tools/`, compléments `site/content/`, styles et scripts `site/public/assets/` ;
     `site/public/` est généré, n'éditez pas ses pages à la main (sauf `site/public/assets/`) ;
   - classement : `donnees/*.csv` et `outils/classement/` ;
   - jeu : `jeu/` (voir `jeu/README.md`).
3. Vérifiez : `node site/tools/build.mjs` et le rendu pour le site, `npm test` et `npm run typecheck` pour le jeu.
4. Ouvrez une pull request en expliquant le changement.

## Règles pour les données

- **Toujours citer une source** (URL) pour un fait ajouté dans `site/content/` : Wikipédia, site officiel d'une course
  ou d'une classe, presse.
- Suivez les conventions de l'auteur dans `site/content/ajouts.json` : une ligne par fait, l'année en tête de ligne,
  le nom de famille des skippers en capitales.
- Les pages de `donnees/site/html/` sont celles de l'auteur, telles qu'aspirées : on ne les corrige pas, on complète
  ou on corrige dans `site/content/` (par exemple `fiches-corrections.json`).
- Les règles du classement (barème, niveaux des courses) sont dans `docs/decisions.md` ; une règle nouvelle se discute
  d'abord dans une issue.
- **Pas de données personnelles** : ni adresse mail, ni téléphone, ni adresse postale de particuliers.
- **Pas de photos** dans le dépôt : référencez-les par leur URL et leur licence.
- Aucune clé d'API ni identifiant de compte (Cloudflare, etc.) dans les commits.

## Le jeu

- Les valeurs des règles sont dans `jeu/packages/data/config/*.json`, pas dans le code.
- Une nouvelle règle va avec un test dans `jeu/packages/engine/test/` et une ligne dans `jeu/docs/decisions-jeu.md`.
  Les règles de jeu se discutent d'abord dans une issue : décrivez la situation de jeu et ce qui devrait se passer.
- Skippers et bateaux réels : citez la source de chaque donnée ajoutée. Pas de logo de sponsor.

## Signaler un problème

Ouvrez une issue avec la page concernée, ce qui est faux et, si possible, la source qui le corrige.
