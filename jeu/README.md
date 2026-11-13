# Course au large

Jeu de course au large au tour par tour, compagnon du site **Mémoire du large**. On choisit un cap et une voile, puis on
affronte le vent qui tourne, sur de vraies courses et avec de vrais skippers. Le jeu est inspiré de *Course au Large*
(jeu de société MB, 1987) ; ni le livret de règles ni les illustrations de ce jeu ne sont dans le dépôt.

- **Version officielle** : https://course-au-large.pages.dev (bêta).
- **Courses** : Route du Rhum, Transat Café L'Or, Rolex Fastnet Race, Vendée Globe, Arkéa Ultim Challenge.
- **Classes** : IMOCA, Ultim, Ocean Fifty, Class40 et Vintage (bateaux de légende), 70 skippers réels.
- **Modes** : solo contre l'IA, plusieurs joueurs sur le même écran, ou en réseau (2 à 4 joueurs, chacun sur son appareil).

Projet open source : le code est sous licence MIT (voir le fichier `LICENSE` à la racine du dépôt), les contributions sont
les bienvenues.

## Démarrer en local

Prérequis : [Node.js](https://nodejs.org/) 20 ou plus récent.

```bash
cd jeu
npm install
npm run dev          # le jeu s'ouvre sur http://localhost:5173
```

Sous Windows, on peut aussi double-cliquer sur `LANCER_LE_JEU.bat`.

Avant de proposer une modification :

```bash
npm test             # tests du moteur de règles (Vitest)
npm run typecheck    # vérification TypeScript du moteur et de l'interface
npm run build        # version statique dans packages/client/dist/
```

## Déployer sa propre version

Le jeu est un site statique : `packages/client/dist/` peut être servi par n'importe quel hébergeur de fichiers statiques
(Cloudflare Pages, GitHub Pages, Netlify…). Les chemins sont relatifs : le jeu fonctionne aussi dans un sous-dossier.
Seul le **jeu en réseau** a besoin d'un serveur, `packages/server`, qui tourne sur Cloudflare Workers (plan gratuit).

### 1. Le serveur de salons (jeu en réseau)

Un compte Cloudflare gratuit suffit.

```bash
cd jeu/packages/server
npx wrangler login       # une fois : connexion au compte Cloudflare dans le navigateur
npx wrangler deploy      # publie le Worker et ses Durable Objects (salons)
```

Wrangler affiche l'adresse du serveur, du type `https://course-au-large-serveur.<votre-compte>.workers.dev`.
Pour l'essayer en local : `npx wrangler dev` (adresse `http://localhost:8787`).

Sans votre propre serveur, le jeu utilise celui de la version officielle : il accepte les parties venues de n'importe
quelle adresse.

### 2. Le jeu

Indiquer l'adresse de votre serveur au moment de la construction, puis publier `packages/client/dist/` :

```bash
cd jeu
VITE_SERVEUR=https://course-au-large-serveur.<votre-compte>.workers.dev npm run build
npx wrangler pages deploy packages/client/dist --project-name <nom-de-votre-projet>
```

Sous Windows (PowerShell) : `$env:VITE_SERVEUR = "https://…"; npm run build`.

L'accueil affiche le numéro de version et la date de construction. « 0.4 » vient de `version` dans `jeu/package.json` ;
le dernier nombre est le nombre d'enregistrements git du dossier `jeu/` (voir `packages/client/vite.config.ts`).

### Ce qui n'est pas dans le dépôt

- Aucune clé ni identifiant de compte : chacun se connecte avec `npx wrangler login`. Ne jamais versionner `.env`,
  `.dev.vars` ni le dossier `.wrangler/`.
- Les photos de référence des bateaux (droits des auteurs) et le livret de règles de 1987 : les sources sont citées dans
  `conception/vintage-references.md`. Les modèles 3D (`packages/client/public/modeles/*.glb`) sont générés par les
  scripts Blender de `outils/blender/`, à partir de cotes publiques.

## Organisation

```
jeu/
  packages/engine/     moteur de règles : TypeScript pur, déterministe (générateur à graine), testé, sans interface
  packages/data/       données JSON : règles chiffrées (config/), skippers, bateaux, courses, quiz
  packages/client/     application web (Vite + React), carte 2D en canvas, vues 3D en Three.js
  packages/server/     serveur de salons du jeu en réseau (Cloudflare Worker + Durable Objects)
  outils/              simulations d'équilibrage, générateurs de cartes, scripts Blender des modèles 3D
  reports/             rapports de simulation
  conception/          cahier des charges, études, références des bateaux de légende
  docs/                décisions de jeu et règles détaillées pour les développeurs
```

Principes :
- **Les valeurs des règles sont dans `packages/data/config/*.json`**, pas dans le code : les équilibrages se font là.
- Le moteur expose `creerPartie`, `appliquer(donnees, etat, action)` et `rejouer` : une partie se rejoue à l'identique
  à partir de la graine et des actions. Le serveur de salons utilise le même moteur que le navigateur.
- L'IA applique exactement les mêmes règles, avec les mêmes informations qu'un joueur humain.

Documents utiles :
- [`docs/decisions-jeu.md`](docs/decisions-jeu.md) : les règles décidées, leur date et leurs raisons ;
- [`docs/avaries-et-reparations.md`](docs/avaries-et-reparations.md) : cartes du large, avaries et réparations, en détail ;
- [`CHANGELOG.md`](CHANGELOG.md) : le journal des versions ;
- [`conception/cahier-des-charges.md`](conception/cahier-des-charges.md) : le cahier des charges d'origine.

## Outils

| Commande | Rôle |
|---|---|
| `npx tsx outils/sim-classes.ts 20 IMOCA` | Durée d'une Route du Rhum et suspense, IA contre IA, par classe |
| `npm run sim -- 400 moyen` | Simulation d'équilibrage générale → `reports/` |
| `npx tsx outils/sim-vintage.ts 20` | Équilibre de la classe Vintage (`COURSE=rolex-fastnet` pour le Fastnet) |
| `npx tsx outils/mesure-max-24h.ts ULTIM IMOCA` | Distance la plus longue possible d'un tour, ramenée à 24 h, par classe et par course (calage sur les records) |
| `npx tsx outils/generer-carte-rhum.ts` | Régénère la carte de la Route du Rhum (côtes Natural Earth) |

Les modèles 3D se régénèrent avec [Blender](https://www.blender.org/) (scripts écrits avec Blender 5), depuis la racine
du dépôt : `blender -b --python jeu/outils/blender/<script>.py` (options en tête de chaque script).

## Contribuer

- Une règle de jeu se discute avant d'être codée : ouvrez une issue qui décrit la situation de jeu et ce qui devrait
  se passer.
- Toute nouvelle règle va avec un test dans `packages/engine/test/` et une ligne dans `docs/decisions-jeu.md`.
- Les skippers et les bateaux sont réels : toute donnée ajoutée cite sa source (palmarès, site de la classe, presse).
- Pas de logo de sponsor, pas de photo dans le dépôt, aucune donnée personnelle.
