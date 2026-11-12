// Met à jour le dépôt public open source (https://github.com/AntoineDangy/histoire-des-halfs) à partir de ce dépôt privé.
// Usage : node outils/open-source/publier.mjs <chemin du clone du dépôt public>
//
// Décisions du propriétaire du 12/11/2026 : projet collaboratif open source, sans clé ni rien de compromettant ; le jeu et
// le site à jour y sont publiés.
// - Source : la version enregistrée (HEAD) de ce dépôt, jamais les fichiers en cours de modification.
// - Publié : le site (code, compléments, CSS/JS), les données (CSV, pages aspirées de histoiredeshalfs.com), les outils,
//   le jeu et les documents de règles. Laissé de côté : notes internes (CLAUDE.md, état du projet, invites, document de
//   travail), rapports de relecture (controles/), ancien classeur (sources/), pages aspirées des sites des classes (seules
//   les données extraites, dans site/content/, sont publiées), livret de règles MB 1987, photos, images, PDF, tableurs.
// - Adresses mail : toutes remplacées par « [adresse retirée] », sauf le contact public de l'auteur (à sa demande).
//   Téléphones des données : remplacés par « [téléphone retiré] ».
// - Contrôle : aucune clé ni aucun jeton ; sinon rien n'est écrit.
// - Les fichiers propres au dépôt public (README, LICENSE, CONTRIBUTING, .gitignore, .claude/launch.json) ne sont pas
//   touchés ; tout autre fichier du dépôt public absent d'ici est supprimé (ancienne organisation du site comprise).
// - Le script n'enregistre et n'envoie rien : relire `git status`, puis enregistrer et pousser.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prive = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cible = process.argv[2] && path.resolve(process.argv[2]);
if (!cible || !fs.existsSync(path.join(cible, '.git'))) {
  console.error('Indiquer le chemin du clone du dépôt public (un dossier git).');
  process.exit(1);
}
const git = (cwd, args, encoding = 'utf8') => {
  const r = spawnSync('git', args, { cwd, encoding, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout;
};
if (git(cible, ['status', '--porcelain']).trim()) {
  console.error('Le dépôt public a des modifications en cours : les enregistrer ou les annuler avant la mise à jour.');
  process.exit(1);
}

const INCLUS = [/^site\//, /^donnees\//, /^outils\//, /^jeu\//, /^docs\/(decisions|modele-donnees|anomalies-site)\.md$/, /^\.gitattributes$/];
const EXCLUS = [
  /^jeu\/conception\/references\//, // livret de règles MB 1987 et photos de référence (droits)
  /^donnees\/site\/(class40\.com|imoca\.org)\/.*\.html?$/, // pages aspirées des sites des classes (droits)
  /\.(png|jpe?g|gif|webp|bmp|tiff?|pdf|xlsx?)$/i, // photos, images, PDF, tableurs
];
const PROPRES_AU_PUBLIC = new Set(['README.md', 'LICENSE', 'CONTRIBUTING.md', '.gitignore', '.claude/launch.json']);
const CONTACT_PUBLIC = new Set(['histoiredeshalfs@orange.fr']);
const SECRETS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_/, /AKIA[0-9A-Z]{12,}/, /xox[abprs]-[0-9A-Za-z-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY/,
  /sk-[A-Za-z0-9]{32,}/, /account_id\s*=\s*"?[0-9a-f]{32}/, /CLOUDFLARE_API_TOKEN\s*=/,
];
const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Téléphones (annonces de vente des pages aspirées) : français (séparateur constant, pour ne pas prendre des dates) et
// internationaux avec indicatif. Contrôle du 12/11/2026 : 42 numéros, tous dans donnees/site/html/.
const TELEPHONES = [
  /(?<![\d+])(?:\+33[ .]?(?:\(0\))?[ .]?|0)[1-9]([ .-]?)\d{2}(?:\1\d{2}){3}(?!\d)/g,
  /\+(?:44|32|41|49|34|39|31|1|61|64|47|45|46|351|353|385|262|590|596|687|689)[ .]?(?:\(0\))?[ .]?\d{1,4}(?:[ .-]\d{2,4}){2,4}(?!\d)/g,
];
const BINAIRE = /\.(glb|png|jpe?g|gif|webp|ico|woff2?|ttf|xlsx?)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

// -z : noms de fichiers tels quels (sans -z, git met entre guillemets les noms accentués, « Identifiés.htm »).
const lister = (cwd) => git(cwd, ['ls-files', '-z']).split('\0').filter(Boolean);
const tous = lister(prive);
const fichiers = tous.filter((f) => INCLUS.some((re) => re.test(f)) && !EXCLUS.some((re) => re.test(f)));
const contenus = new Map();
const alertes = [];
let masquees = 0;
let telephones = 0;
const fichiersMasques = new Set();
for (const f of fichiers) {
  let buf = git(prive, ['show', `HEAD:${f}`], 'buffer');
  if (!BINAIRE.test(f)) {
    // Lecture octet par octet (latin1) : les pages windows-1252 et les fichiers UTF-8 restent intacts hors adresses.
    let texte = buf.toString('latin1');
    const html = /\.html?$/i.test(f);
    const remplacement = html ? '[adresse retir&#233;e]' : Buffer.from('[adresse retirée]', 'utf8').toString('latin1');
    texte = texte.replace(MAIL, (m) => {
      if (CONTACT_PUBLIC.has(m.toLowerCase()) || IMAGE.test(m) || /package-lock\.json$/.test(f)) return m;
      masquees++;
      fichiersMasques.add(f);
      return remplacement;
    });
    // Le code du jeu et des outils n'a pas de numéros de téléphone, mais des nombres qui pourraient leur ressembler.
    if (/^(donnees|site\/content)\//.test(f)) {
      const tel = html ? '[t&#233;l&#233;phone retir&#233;]' : Buffer.from('[téléphone retiré]', 'utf8').toString('latin1');
      for (const re of TELEPHONES) texte = texte.replace(re, () => { telephones++; fichiersMasques.add(f); return tel; });
    }
    // Ce script contient lui-même les motifs recherchés : il n'est pas contrôlé.
    for (const re of f === 'outils/open-source/publier.mjs' ? [] : SECRETS) {
      const m = texte.match(re);
      if (m) alertes.push(`${f} : ${m[0].slice(0, 40)}`);
    }
    buf = Buffer.from(texte, 'latin1');
  }
  contenus.set(f, buf);
}
if (alertes.length) {
  console.error('Contrôle refusé, rien n\'est écrit :\n' + alertes.map((a) => '  ' + a).join('\n'));
  process.exit(1);
}

let supprimes = 0;
for (const f of lister(cible)) {
  if (PROPRES_AU_PUBLIC.has(f) || contenus.has(f)) continue;
  fs.rmSync(path.join(cible, f), { force: true });
  supprimes++;
}
for (const [f, buf] of contenus) {
  const dest = path.join(cible, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}
// Dossiers vidés par les suppressions.
const nettoyer = (d) => {
  if (!fs.existsSync(d) || !fs.statSync(d).isDirectory() || path.basename(d) === '.git') return;
  for (const e of fs.readdirSync(d)) nettoyer(path.join(d, e));
  if (d !== cible && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
};
nettoyer(cible);

const version = git(prive, ['rev-parse', '--short', 'HEAD']).trim();
console.log(`Depuis l'enregistrement ${version} : ${contenus.size} fichiers écrits, ${tous.length - fichiers.length} laissés de côté, ` +
  `${supprimes} fichiers du dépôt public supprimés, ${masquees} adresses mail et ${telephones} téléphones masqués dans ${fichiersMasques.size} fichiers.`);
console.log(`Ensuite, dans ${cible} : git status, puis git add -A && git commit -m "Mise à jour depuis ${version}" && git push`);
