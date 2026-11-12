import { useState } from 'react';
import type { EtatPartie } from '@cal/engine';
import { ecrireStockage, Lancement, lireStockage, REGLAGES_DEFAUT, Reglages } from './commun';
import Accueil from './ecrans/Accueil';
import Configuration from './ecrans/Configuration';
import ChoixSkippers from './ecrans/ChoixSkippers';
import Jeu from './ecrans/Jeu';
import Fin from './ecrans/Fin';
import Regles from './ecrans/Regles';
import Reseau from './ecrans/Reseau';
import Hangar from './ecrans/Hangar';

type Ecran = 'accueil' | 'config' | 'choix' | 'jeu' | 'fin' | 'regles' | 'reseau' | 'hangar';

export default function App() {
  const codeSalon = new URLSearchParams(window.location.search).get('salon');
  const [ecran, setEcran] = useState<Ecran>(codeSalon ? 'reseau' : 'accueil');
  const [reglages, setReglages] = useState<Reglages>(() => lireStockage('cal-reglages', REGLAGES_DEFAUT));
  const [lancement, setLancement] = useState<Lancement | null>(null);
  const [etatFinal, setEtatFinal] = useState<EtatPartie | null>(null);
  const [partieId, setPartieId] = useState(0);

  const majReglages = (r: Reglages) => {
    setReglages(r);
    ecrireStockage('cal-reglages', r);
  };

  switch (ecran) {
    case 'accueil':
      return (
        <Accueil
          onJouer={() => setEcran('config')}
          onRegles={() => setEcran('regles')}
          onReseau={() => setEcran('reseau')}
          onHangar={() => setEcran('hangar')}
          onTutoriel={() => {
            // Course d'initiation : Jérémie Beyou contre une IA facile, questions Moussaillon sans chrono.
            const tuto: Reglages = { ...REGLAGES_DEFAUT, mode: 'solo', humains: [{ nom: 'Vous', niveauQuiz: 1 }], niveauIA: 'facile', delaiQuiz: 0, vue3d: true };
            setLancement({
              reglages: tuto,
              graine: 2026,
              tutoriel: true,
              participants: [
                { nom: 'Vous', type: 'humain', niveauQuiz: 1, skipperId: 'jeremie-beyou' },
                { nom: 'IA', type: 'ia', niveauIA: 'facile', niveauQuiz: 1, skipperId: 'jean-le-cam' },
              ],
            });
            setPartieId((n) => n + 1);
            setEcran('jeu');
          }}
        />
      );
    case 'reseau':
      return (
        <Reseau
          codeInitial={codeSalon}
          onRetour={() => {
            window.history.replaceState(null, '', window.location.pathname);
            setEcran('accueil');
          }}
          onFin={(e) => {
            setEtatFinal(e);
            setEcran('fin');
          }}
        />
      );
    case 'hangar':
      return <Hangar onRetour={() => setEcran('accueil')} />;
    case 'regles':
      return <Regles onRetour={() => setEcran('accueil')} />;
    case 'config':
      return <Configuration reglages={reglages} onChange={majReglages} onRetour={() => setEcran('accueil')} onSuite={() => setEcran('choix')} />;
    case 'choix':
      return (
        <ChoixSkippers
          reglages={reglages}
          onRetour={() => setEcran('config')}
          onLancer={(l) => {
            setLancement(l);
            setPartieId((n) => n + 1);
            setEcran('jeu');
          }}
        />
      );
    case 'jeu':
      return (
        <Jeu
          key={partieId}
          lancement={lancement!}
          onQuitter={() => setEcran('accueil')}
          onFin={(e) => {
            setEtatFinal(e);
            setEcran('fin');
          }}
        />
      );
    case 'fin':
      return (
        <Fin
          etat={etatFinal!}
          onRejouer={() => {
            if (!lancement) {
              setEcran('accueil');
              return;
            }
            setLancement({ ...lancement!, graine: Math.floor(Math.random() * 1e9) });
            setPartieId((n) => n + 1);
            setEcran('jeu');
          }}
          onChanger={() => setEcran('config')}
          onAccueil={() => setEcran('accueil')}
        />
      );
  }
}
