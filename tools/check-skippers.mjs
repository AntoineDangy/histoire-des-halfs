// Relecture : skippers dont le « prénom » est en fait un mot de sponsor ou de lieu (« Crédit MUTUEL », « Banque POPULAIRE »).
// Usage : node tools/check-skippers.mjs   (après node tools/build.mjs)
import fs from 'node:fs';

const idx = JSON.parse(fs.readFileSync('site/data/search.json', 'utf8')).filter((e) => e.c === 'Skipper');
const firstCount = new Map();
for (const e of idx) { const f = e.n.split(' ')[0]; firstCount.set(f, (firstCount.get(f) || 0) + 1); }
const SUSPECT = /^(Crédit|Credit|Banque|Groupe|Team|Région|Region|Ville|Port|Cap|Club|Société|Societe|Fondation|Association|Mer|Océan|Ocean|Les|Le|La|Saint|Sainte|St|Air|Pays|Conseil|Bretagne|Normandie|Vendée|Charente|Mutuelle|Assurances?|Caisse|Ecole|École|Lycée|Café|Cafe|Brest|Lorient|Paris|France|Marine|Yacht|Sailing|Racing|Spirit|Défi|Defi|Fleury|Hôtel|Hotel|Radio|Golden|Royal|Le|Bateau|Trimaran|Monocoque|Maxi|Ultim|Imoca|Prix|Grand|Trophée|Tour|Course|Transat|Route|Vendee|Coupe|Cup|Classe|Class|Rhum|Navire|Armor|Atlantic|Atlantique|Europe|Orange|Kingfisher|Gitana|Sodebo|Macif|Foncia|Virbac|Safran|Paprec|Bureau|Agence|Mairie|Département|Departement|Station|Office|Comité|Comite|Fédération|Federation|Ligue|Bnp|Pole|Pôle|Université|Universite|Institut|Centre|Musée|Musee)$/;
const hits = idx.filter((e) => SUSPECT.test(e.n.split(' ')[0]));
console.log(`${idx.length} skippers, ${hits.length} prénoms suspects :`);
for (const e of hits) console.log(`  ${e.n} — ${e.a.slice(0, 60)}`);
