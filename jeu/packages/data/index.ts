// Point d'entrée des données du jeu. Le moteur ne lit jamais ces fichiers directement :
// il reçoit un objet Donnees (voir packages/engine/src/types.ts).
import voiles from './config/voiles.json';
import regles from './config/regles.json';
import competences from './config/competences.json';
import familles from './config/familles.json';
import skippers from './skippers.json';
import bateaux from './bateaux.json';
import routeDuRhum from './courses/route-du-rhum.json';
import transatCafeLor from './courses/transat-cafe-lor.json';
import rolexFastnet from './courses/rolex-fastnet.json';
import vendeeGlobe from './courses/vendee-globe.json';
import arkeaUltimChallenge from './courses/arkea-ultim-challenge.json';
import quiz from './quiz/questions.json';
import evenements from './config/evenements.json';

export const donneesBrutes = {
  voiles: voiles.voiles,
  regles,
  competences: competences.competences,
  classes: familles.classes,
  familles: familles.familles,
  skippers: skippers.skippers,
  bateaux: bateaux.bateaux,
  courses: [routeDuRhum, transatCafeLor, rolexFastnet, vendeeGlobe, arkeaUltimChallenge],
  questions: quiz.questions,
  evenements,
};
