// Distance la plus longue possible en un tour, ramenée à 24 h, par classe et par course (13/11/2026) : toutes les voiles,
// forces, allures, familles et compétences de la classe, en pleine mer avec et sans alizés favorables. Sert à caler une
// classe sur son record de distance en 24 h (bonus compris). Les cartes « bonne nouvelle » sont comptées à part.
// Usage : npx tsx outils/mesure-max-24h.ts [CLASSE…]        (ULTIM par défaut)
import { donneesBrutes } from '../packages/data/index';
import { calculerDistance, carteDe, echelleBateau, navigable } from '../packages/engine/src/index';
import type { Direction, Donnees, EtatPartie } from '../packages/engine/src/index';

const d = donneesBrutes as unknown as Donnees;
const classes = process.argv.slice(2).length ? process.argv.slice(2) : ['ULTIM'];
const NB = 16;

for (const classe of classes) {
  const familles = d.familles.filter((f) => (f as { classe?: string }).classe === classe).map((f) => f.id);
  const competences = [...new Set(d.skippers.filter((k) => k.classe === classe).map((k) => k.competence))];
  const classeDef = d.classes.find((c) => c.id === classe)!;
  // La Route du Rhum est ouverte à toutes les classes, les autres courses à leur liste.
  for (const course of d.courses.filter((c) => c.id === 'route-du-rhum' || c.classes_autorisees.includes(classe))) {
    const carte = carteDe(d, { params: { courseId: course.id, classe } } as unknown as Pick<EtatPartie, 'params'>);
    // Une case de pleine mer sans zone, puis une case par zone d'alizés.
    const cases: [number, number][] = [];
    const vues = new Set<number>();
    for (let y = 0; y < carte.H; y++)
      for (let x = 0; x < carte.L; x++) {
        const i = y * carte.L + x;
        if (!navigable(carte, x, y) || carte.zones[i].length) continue;
        const a = carte.alize[i];
        if (!vues.has(a)) {
          vues.add(a);
          cases.push([x, y]);
        }
      }
    let meilleur = { cases: 0, texte: '' };
    for (const famille of familles)
      for (const competence of competences)
        for (const [x, y] of cases)
          for (const v of d.voiles)
            for (let force = 0; force <= 12; force++)
              for (let cap = 0; cap < NB; cap++)
                for (let dir = 0; dir < NB; dir++) {
                  const r = calculerDistance(d, carte, { competence, famille, x, y }, v.id, cap as Direction, { direction: dir as Direction, force });
                  if (r.distance !== null && r.distance > meilleur.cases)
                    meilleur = { cases: r.distance, texte: `${famille}, ${competence}, ${v.id}, F${force}, alizé ${carte.alize[y * carte.L + x] >= 0 ? 'oui' : 'non'}` };
                }
    const mpc = course.milles_par_case ?? 1;
    const heures = course.vitesse_unique || course.distance_reelle ? course.heures_par_tour : classeDef.heures_par_tour ?? course.heures_par_tour;
    const carteBonus = Math.max(0, ...(d.evenements?.cartes ?? []).map((c) => c.effet.distance ?? 0));
    const bonus = Math.round(carteBonus * echelleBateau(d, carte, { famille: familles[0] }));
    const m = meilleur.cases * mpc;
    console.log(`${classe} · ${course.id} : ${meilleur.cases} cases = ${Math.round(m)} milles en ${heures} h, soit ${Math.round((m * 24) / heures)} milles en 24 h (${meilleur.texte}) ; carte « bonne nouvelle » : +${bonus} cases`);
  }
}
