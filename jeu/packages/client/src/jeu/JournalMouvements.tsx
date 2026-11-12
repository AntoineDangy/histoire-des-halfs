import { useMemo, useState } from 'react';
import { controlerJournal, nomCap, NOMS_DIR } from '@cal/engine';
import type { EtatPartie, LigneJournal, Vent } from '@cal/engine';
import { D, millesParCase } from '../commun';

const mn = (cases: number | null) => (cases === null ? '—' : `${Math.round(cases * millesParCase())}`);
const vent = (v: Vent | null) => (v ? `${NOMS_DIR[v.direction]} F${v.force}` : '—');
const voile = (id: string | null) => (id ? D.voiles.find((v) => v.id === id)?.nom_court ?? id : 'à sec');

/** Journal des mouvements (bêta) : chaque déplacement, les éléments du calcul et les contrôles automatiques. */
export default function JournalMouvements({ etat, onFermer }: { etat: EtatPartie; onFermer: () => void }) {
  const [anomaliesSeules, setAnomaliesSeules] = useState(false);
  const [bateau, setBateau] = useState<string>('tous');
  const lignes = useMemo(
    () => (etat.journal ?? []).map((l) => ({ l, anomalies: controlerJournal(D, etat, l) })).reverse(),
    [etat],
  );
  const nbAnomalies = lignes.filter((x) => x.anomalies.length).length;
  const visibles = lignes.filter((x) => (!anomaliesSeules || x.anomalies.length) && (bateau === 'tous' || x.l.bateauId === bateau));

  const exporter = () => {
    const entetes = ['tour', 'skipper', 'type', 'de_x', 'de_y', 'vers_x', 'vers_y', 'cap', 'voile', 'vent_au_choix', 'distance_prevue_mn', 'vent_apres_des', 'relance', 'louvoyage',
      'distance_apres_des_mn', 'carte', 'risque', 'penalite', 'distance_max_mn', 'distance_autorisee_mn', 'parcourue_mn', 'bloque', 'courant', 'arrive', 'issue', 'chemin', 'anomalies'];
    const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = (etat.journal ?? []).map((l: LigneJournal) => [
      l.tour, l.skipper, l.type, l.de[0], l.de[1], l.vers[0], l.vers[1], l.cap === null ? 'abri' : nomCap(l.cap), voile(l.voile), vent(l.ventChoix), mn(l.distancePrevue),
      vent(l.ventApres), l.relance ? 'oui' : '', l.louvoyage ? 'oui' : '', mn(l.distanceDes), l.carte ?? '', l.risque ?? '', l.penalite ?? '', mn(l.distanceMax), mn(l.budget),
      mn(l.parcourue), l.bloque ?? '', l.courant ? 'oui' : '', l.arrive ? 'oui' : '', l.issue, l.chemin.map((k) => k.join(':')).join(' '),
      controlerJournal(D, etat, l).map((a) => a.texte).join(' ; '),
    ].map(cel).join(';'));
    const blob = new Blob(['﻿' + [entetes.join(';'), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal-mouvements-tour${etat.tour}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="voile-fond" role="dialog" aria-modal="true" aria-labelledby="titre-journal">
      <div className="modale journal-mvt">
        <div className="lbl">Bêta · contrôle des calculs</div>
        <h2 id="titre-journal">Journal des mouvements</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Chaque ligne : le vent et la distance annoncés au moment du choix, le vent après les dés, la distance autorisée après cartes, risque et
          pénalités, puis la distance réellement parcourue. Le jeu vérifie chaque déplacement (distance, terre traversée, saut de case).{' '}
          {nbAnomalies ? <b className="anomalie">{nbAnomalies} anomalie{nbAnomalies > 1 ? 's' : ''} détectée{nbAnomalies > 1 ? 's' : ''}.</b> : <b className="ok">Aucune anomalie détectée.</b>}
        </p>
        <div className="barre-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <select value={bateau} onChange={(e) => setBateau(e.target.value)}>
            <option value="tous">Tous les bateaux</option>
            {etat.bateaux.map((b) => <option key={b.id} value={b.id}>{(etat.journal ?? []).find((l) => l.bateauId === b.id)?.skipper ?? b.nom}</option>)}
          </select>
          <label className="case-cocher"><input type="checkbox" checked={anomaliesSeules} onChange={(e) => setAnomaliesSeules(e.target.checked)} /> Anomalies seulement</label>
          <button className="btn btn-petit" onClick={exporter} disabled={!etat.journal?.length}>⬇ Télécharger (tableur)</button>
        </div>
        <div className="journal-defile">
          <table className="tableau tableau-mvt">
            <thead>
              <tr>
                <th>Tour</th><th>Skipper</th><th>Cap · voile</th><th>Vent au choix</th><th>Annoncé</th><th>Vent après dés</th><th>Après dés</th>
                <th>Carte · risque · avarie</th><th>Autorisé</th><th>Parcouru</th><th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ l, anomalies }, i) => (
                <tr key={i} className={anomalies.length ? 'ligne-anomalie' : ''}>
                  <td>{l.tour}</td>
                  <td>{l.skipper}{l.type === 'ia' ? ' · IA' : ''}</td>
                  <td>{l.cap === null ? 'abri' : nomCap(l.cap)} · {voile(l.voile)}</td>
                  <td>{vent(l.ventChoix)}</td>
                  <td>{mn(l.distancePrevue)} mn</td>
                  <td>{vent(l.ventApres)}{l.relance ? ' (relance)' : ''}{l.louvoyage ? ' · louvoie' : ''}</td>
                  <td>{mn(l.distanceDes)} mn</td>
                  <td>{[l.carte, l.risque ? `risque ${l.risque}` : '', l.penalite ? `avarie ${l.penalite}` : ''].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{mn(l.budget)} mn</td>
                  <td><b>{mn(l.parcourue)} mn</b></td>
                  <td>
                    {l.issue}{l.bloque ? ` (${l.bloque})` : ''}{l.courant ? ' · courant' : ''}{l.arrive ? ' · arrivé' : ''}
                    {anomalies.map((a, k) => <div key={k} className="anomalie">⚠ {a.texte}</div>)}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={11} className="muted">Aucun mouvement pour l'instant.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="barre-actions">
          <button className="btn btn-principal" onClick={onFermer}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
