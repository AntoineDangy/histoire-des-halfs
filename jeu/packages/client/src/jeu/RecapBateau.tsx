import { bateau, classement, distanceRestante, peutRecoudre } from '@cal/engine';
import type { EtatPartie } from '@cal/engine';
import { bateauDef, competenceDef, courseDef, D, familleDef, skipper } from '../commun';

/** Récapitulatif visuel de l'état du bateau : voiles, réparations, avaries en cours, position. */
export default function RecapBateau({ etat, bateauId, nom }: { etat: EtatPartie; bateauId: string; nom: string }) {
  const b = bateau(etat, bateauId);
  const s = skipper(b.skipperId);
  const bt = bateauDef(b.bateauId);
  const c = competenceDef(b.competence);
  const rang = classement(D, etat).findIndex((x) => x.id === b.id) + 1;
  const course = courseDef(etat.params.courseId);
  const mpc = course.milles_par_case ?? 1;
  const noms = etat.params.options.nomsReels;
  return (
    <div className="panneau recap">
      <div className="recap-tete">
        <span className="pastille-couleur" style={{ background: s.couleurs.pion, width: 14, height: 14 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="recap-nom">{nom}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {noms ? bt.nom : bt.nom_generique} · {familleDef(b.famille).nom}
          </div>
        </div>
        <div className="recap-rang" title="Position au classement">
          {b.arrive ? '🏁' : `${rang}${rang === 1 ? 'er' : 'e'}`}
          <small>{b.arrive ? 'arrivé' : `${Math.round(distanceRestante(D, etat, b) * mpc)} mn`}</small>
        </div>
      </div>

      <div className="recap-ligne" title={`${c.nom} : ${c.bonus} ; ${c.malus}`}>
        <span className="icone-comp">{c.icone}</span>
        <span><b>{c.nom}</b>{b.relancesRestantes > 0 ? ` · ${b.relancesRestantes} relance${b.relancesRestantes > 1 ? 's' : ''}` : ''}{peutRecoudre(D, etat, b) ? ' · peut recoudre' : ''}</span>
      </div>

      <div className="recap-ligne">
        <span className="lbl" style={{ minWidth: 76 }}>Voiles</span>
        <div className="puces-voiles">
          {D.regles.voiles_depart.map((v) => {
            const def = D.voiles.find((x) => x.id === v)!;
            const etatV = b.voiles.includes(v) ? 'ok' : b.voilesPerdues.includes(v) ? 'perdue' : 'quai';
            return (
              <span key={v} className={`puce-voile ${etatV}`} title={`${def.nom} : ${etatV === 'ok' ? 'à bord' : etatV === 'perdue' ? 'hors service (réparable au port)' : 'laissée à quai'}`}>
                {etatV === 'perdue' ? '✕ ' : ''}{def.nom_court}
              </span>
            );
          })}
        </div>
      </div>

      <div className="recap-ligne">
        <span className="lbl" style={{ minWidth: 76 }}>Réparations</span>
        <div className="jetons">
          {Array.from({ length: Math.max(b.reparations, b.reparationsDepart) }, (_, i) => (
            <span key={i} className={`jeton ${i < b.reparations ? '' : 'vide'}`} title="Carte réparation" />
          ))}
        </div>
        <b style={{ marginLeft: 6 }}>{b.reparations}</b>
      </div>

      {(b.modificateurs.length > 0 || b.passeTours > 0) && (
        <div className="recap-effets">
          {b.passeTours > 0 && <span className="effet dommage">Immobilisé {b.passeTours} tour{b.passeTours > 1 ? 's' : ''}</span>}
          {b.modificateurs.map((m) => {
            const bon = !m.perte && (m.distance > 0 || m.risque < 0);
            const t = [
              m.perte ? `avance −${Math.round(m.perte * 100)} %` : '',
              m.distance ? `${m.distance > 0 ? '+' : '−'}${Math.round(Math.abs(m.distance) * (course.echelle ?? 1) * mpc)} mn` : '',
              m.risque ? `risque ${m.risque > 0 ? '+' : '−'}${Math.abs(m.risque)}` : '',
            ]
              .filter(Boolean)
              .join(', ');
            // Tours encore à subir : le prochain compris entre deux tours, ceux d'après pendant le tour de la carte (nouveau).
            const tours = m.toursRestants;
            return (
              <span key={m.id} className={`effet ${bon ? 'heureux' : 'dommage'}`} title={m.titre}>
                {m.titre} · {t} · encore {tours} tour{tours > 1 ? 's' : ''}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
