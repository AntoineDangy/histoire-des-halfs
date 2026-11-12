import { bateau, categorie, categoriesPartie, distanceRestante, formaterTemps, NOM_CATEGORIE, nomSkipper, tempsCourseHeures, heuresParTour } from '@cal/engine';
import type { EtatBateau, EtatPartie } from '@cal/engine';
import { bateauDef, competenceDef, courseDef, D, familleDef, nomClasse, skipper } from '../commun';

interface Props {
  etat: EtatPartie;
  onRejouer: () => void;
  onChanger: () => void;
  onAccueil: () => void;
}

export default function Fin({ etat, onRejouer, onChanger, onAccueil }: Props) {
  const general = (etat.classementFinal ?? []).map((id) => bateau(etat, id));
  const noms = etat.params.options.nomsReels;
  const hauteurs = [150, 110, 80];
  // Flotte mêlant monocoques et multicoques (Vintage) : un podium et un classement par catégorie (décision du 10/11/2026).
  const cats = categoriesPartie(D, etat);
  const groupes: { titre: string; ordre: EtatBateau[] }[] = cats
    ? cats.map((c) => ({ titre: `Classement des ${NOM_CATEGORIE[c]}`, ordre: general.filter((b) => categorie(D, b) === c) }))
    : [{ titre: '', ordre: general }];
  const humains = new Set(etat.bateaux.filter((b) => b.type === 'humain').map((b) => b.id));
  const importants = new Set(['vent', 'jet_risque', 'quiz', 'penalite', 'reparation', 'voile_perdue', 'arrivee', 'port', 'naufrage', 'relance', 'recousu', 'fin']);
  const carnet = etat.evenements.filter((e) => importants.has(e.type) && (e.type === 'fin' || !e.bateauId || humains.has(e.bateauId)) && e.type !== 'vent');

  return (
    <div className="ecran">
      <div className="contenu">
        <div className="lbl">{courseDef(etat.params.courseId).nom} · {nomClasse(etat.params.classe)} · {etat.tour} tours</div>
        <h1>Résultats de la course</h1>
        {groupes.map(({ titre, ordre }) => {
          const podium = [ordre[1], ordre[0], ordre[2]].filter(Boolean);
          return (
        <div key={titre} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {titre && <h2 style={{ margin: '8px 0 0' }}>{titre}</h2>}
        <div className="podium">
          {podium.map((b) => {
            const place = ordre.indexOf(b) + 1;
            return (
              <div key={b.id} className="marche" style={{ height: hauteurs[place - 1] + 60 }}>
                <span className="rang">{place === 1 ? '🏆' : place}</span>
                <b>{nomSkipper(D, etat, b)}</b>
                <span className="muted" style={{ fontSize: 12 }}>{b.type === 'humain' ? b.nom : 'IA'}</span>
              </div>
            );
          })}
        </div>

        <div className="panneau" style={{ overflowX: 'auto' }}>
          <table className="tableau">
            <thead>
              <tr><th>Place</th><th>Skipper</th><th>Bateau</th><th>Temps de course fictif</th><th>Quiz</th><th>Avaries</th><th>Escales</th></tr>
            </thead>
            <tbody>
              {ordre.map((b, i) => {
                const s = skipper(b.skipperId);
                const bt = bateauDef(b.bateauId);
                const h = tempsCourseHeures(D, etat, b);
                return (
                  <tr key={b.id}>
                    <td>{b.horsClassement ? 'HC' : i + 1}</td>
                    <td>
                      <span className="pastille-couleur" style={{ background: s.couleurs.pion }} />
                      {nomSkipper(D, etat, b)} <span className="muted">({b.type === 'humain' ? b.nom : 'IA'})</span>
                      <div className="muted" style={{ fontSize: 12 }}>{competenceDef(b.competence).nom}</div>
                    </td>
                    <td>{noms ? bt.nom : bt.nom_generique}<div className="muted" style={{ fontSize: 12 }}>{familleDef(b.famille).nom}</div></td>
                    <td>{h !== null ? formaterTemps(h) : `à ${Math.round(distanceRestante(D, etat, b) * (courseDef(etat.params.courseId).milles_par_case ?? 1))} milles de l'arrivée`}</td>
                    <td>{b.stats.quizJustes} / {b.stats.quizJustes + b.stats.quizFaux}</td>
                    <td>{b.stats.avaries}</td>
                    <td>{b.stats.escales}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ordre.some((b, i) => i > 0 && b.arrive && ordre[i - 1].arrive && b.tourArrivee === ordre[i - 1].tourArrivee) && (
            <p className="muted" style={{ fontSize: 12 }}>Arrivées au même tour : départage au taux de bonnes réponses au quiz, puis au nombre de bonnes réponses, puis au moins de milles parcourus.</p>
          )}
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Temps de course fictif : 1 tour = {heuresParTour(D, etat)} h, à titre pédagogique.</p>
        </div>
        </div>
          );
        })}

        <div className="panneau">
          <div className="lbl" style={{ marginBottom: 8 }}>Carnet de bord</div>
          <div className="carnet">
            {carnet.map((e, i) => (
              <div key={i}><span className="muted">Tour {e.tour} · </span>{e.texte}</div>
            ))}
          </div>
        </div>

        <div className="barre-actions">
          <button className="btn" onClick={onAccueil}>Accueil</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={onChanger}>Changer de configuration</button>
            <button className="btn btn-principal" onClick={onRejouer}>Rejouer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
