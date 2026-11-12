import { COMMIT, dateVersion, VERSION } from '../version';

export default function Accueil({ onJouer, onRegles, onTutoriel, onReseau, onHangar }: { onJouer: () => void; onRegles: () => void; onTutoriel: () => void; onReseau: () => void; onHangar: () => void }) {
  return (
    <div className="ecran">
      <div className="contenu" style={{ marginTop: '6vh' }}>
        <div className="lbl">Mémoire du large</div>
        <h1 className="titre-jeu">
          COURSE AU LARGE <span className="beta">BÊTA</span>
        </h1>
        <div className="version-jeu" title={COMMIT ? `Enregistrement ${COMMIT}` : undefined}>
          Version {VERSION} · mise à jour le {dateVersion()}
        </div>
        <p className="sous-titre">
          Choisissez un cap et une voile, puis affrontez le vent qui tourne. Route du Rhum, Transat Café L'Or et Rolex Fastnet Race, en IMOCA, Ultim, Ocean Fifty, Class40 ou Vintage (bateaux de légende), avec 70 skippers réels.
        </p>
        <div className="menu">
          <button className="btn btn-principal" onClick={onJouer}>▶ Jouer</button>
          <button className="btn btn-principal" onClick={onReseau}>🌐 Jouer en réseau (2 à 4 joueurs)</button>
          <button className="btn" onClick={onRegles}>📖 Règles du jeu</button>
          <button className="btn" onClick={onTutoriel}>🎓 Tutoriel : ma première course</button>
          <button className="btn" onClick={onHangar}>⚓ Ton hangar à bateaux</button>
        </div>
        <div className="panneau muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Inspiré du jeu de société <i>Course au Large</i> (MB, 1987). Les skippers et les bateaux sont réels ; leur pouvoir de jeu est une
          compétence liée à leur carrière (palmarès du site Mémoire du large). Aucun logo de sponsor n'est reproduit.
        </div>
      </div>
    </div>
  );
}
