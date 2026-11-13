import { useEffect, useMemo, useRef, useState } from 'react';
import { angleAllure, auAllure, estMulticoque, NOMS_DIR_LONGS } from '@cal/engine';
import type { Attente, EtatBateau, EtatPartie } from '@cal/engine';
import { competenceDef, D, NIVEAUX_QUIZ } from '../commun';

export function ModaleQuiz({ attente, delai, nom, onRepondre, envoiAuto }: { attente: Extract<Attente, { type: 'quiz' }>; delai: number; nom: string; onRepondre: (r: number) => void; envoiAuto?: boolean }) {
  const q = D.questions.find((x) => x.id === attente.questionId)!;
  const [choisi, setChoisi] = useState<number | null>(null);
  // Ordre des réponses tiré au hasard à chaque question : la bonne réponse n'est pas toujours au même rang.
  // `ordre[k]` = indice d'origine de la réponse affichée en position k (la réponse envoyée garde l'indice d'origine).
  const ordre = useMemo(() => {
    const o = q.choix.map((_, i) => i);
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
  }, [q.id]);
  const [reste, setReste] = useState(delai);
  useEffect(() => {
    if (!delai || choisi !== null) return;
    if (reste <= 0) {
      setChoisi(-1);
      return;
    }
    const t = setTimeout(() => setReste((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [reste, delai, choisi]);
  // Une seule réponse envoyée, qu'elle parte au clic sur « Continuer » ou toute seule (réseau).
  const envoye = useRef(false);
  const continuer = (r: number) => {
    if (envoye.current) return;
    envoye.current = true;
    onRepondre(r);
  };
  // En réseau, la réponse part toute seule sans attendre « Continuer » : 3 s après le temps écoulé (13/11/2026, audit C2),
  // et 20 s après une réponse donnée, le temps de lire l'explication ; sinon le serveur jouait la réponse par défaut
  // (comptée fausse) à la fin de son délai (13/11/2026).
  useEffect(() => {
    if (!envoiAuto || choisi === null) return;
    const t = setTimeout(() => continuer(choisi), choisi === -1 ? 3000 : 20000);
    return () => clearTimeout(t);
  }, [envoiAuto, choisi]);
  const juste = choisi === q.reponse;
  return (
    <div className="voile-fond" role="dialog" aria-modal="true" aria-labelledby="titre-quiz">
      <div className="modale">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="puce">{q.categorie} · {NIVEAUX_QUIZ[q.niveau]}</span>
          {delai > 0 && choisi === null && <b>{reste} s</b>}
        </div>
        {delai > 0 && choisi === null && (
          <div className="chrono"><div style={{ width: `${(reste / delai) * 100}%` }} /></div>
        )}
        <div className="lbl">{attente.source === 'large' ? `Question du large pour ${nom} : une mauvaise réponse use la voile (mauvaise manœuvre)` : `Risque déclenché pour ${nom} : répondez pour l'écarter`}</div>
        <h2 id="titre-quiz">{q.question}</h2>
        <div className="reponses">
          {ordre.map((i, k) => (
            <button
              key={i}
              disabled={choisi !== null}
              className={choisi === null ? '' : i === q.reponse ? 'juste' : i === choisi ? 'faux' : ''}
              onClick={() => setChoisi(i)}
              autoFocus={k === 0}
            >
              <span className="l">{'ABCD'[k]}</span> {q.choix[i]}
            </button>
          ))}
        </div>
        {choisi !== null && (
          <>
            <div className="panneau" style={{ borderColor: juste ? 'var(--succes)' : 'var(--danger)' }}>
              <b>{juste ? 'Bonne réponse ! Bonne manœuvre.' : choisi === -1 ? 'Temps écoulé… la voile souffre.' : attente.source === 'large' ? 'Mauvaise réponse : mauvaise manœuvre, la voile s\'use de 20 %.' : 'Mauvaise réponse : avarie !'}</b>
              <div className="muted" style={{ marginTop: 6 }}>{q.explication}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Source : {q.source}</div>
            </div>
            <button className="btn btn-principal" onClick={() => continuer(choisi)} autoFocus>Continuer</button>
          </>
        )}
      </div>
    </div>
  );
}

const TEXTE_PENALITE: Record<string, string> = {
  demi: 'votre déplacement sera divisé par deux',
  perte_voile: 'vous allez perdre la voile hissée',
  passe: 'vous passerez le tour suivant',
  recul: 'vous allez reculer d\'une case au lieu d\'avancer',
};

export function ModaleReparation({ attente, b, nom, onRepondre }: { attente: Extract<Attente, { type: 'reparation' }>; b: EtatBateau; nom: string; onRepondre: (jouer: boolean) => void }) {
  const voile = b.choix?.voile ? D.voiles.find((v) => v.id === b.choix!.voile)?.nom_court : '';
  // Case noire d'un monocoque : endurer (voile perdue, demi-distance) ou réparer (voile sauvée, pas d'avance) ; règle du 12/11/2026.
  const multi = estMulticoque(D, b);
  const noireMono = attente.motif === 'voile_noire' && !multi;
  return (
    <div className="voile-fond" role="dialog" aria-modal="true">
      <div className="modale">
        <div className="lbl">{nom} · carte réparation</div>
        <h2>{attente.motif === 'voile_noire' ? (multi ? 'Vous allez chavirer !' : `Votre ${voile} va exploser !`) : attente.motif === 'evenement' ? D.evenements?.cartes.find((c) => c.id === attente.carteId)?.titre ?? 'Avarie !' : 'Avarie !'}</h2>
        <p className="muted">
          {attente.motif === 'voile_noire'
            ? multi
              ? 'Trop de toile pour ce vent. Avec une carte réparation, vous redressez le bateau sans avancer ; sans elle, vous restez immobilisé 2 tours (sauf escale technique).'
              : 'Le vent est trop fort pour cette voile. Endurer : la voile est perdue, mais vous avancez de la moitié de la distance prévue. Réparer : la voile est sauvée, mais vous n\'avancez pas ce tour.'
            : attente.motif === 'evenement'
              ? 'Une carte réparation permet de réparer aussitôt cette avarie.'
              : `Sans réparation, ${TEXTE_PENALITE[attente.penalite ?? 'demi']}.`}
        </p>
        <p>Il vous reste <b>{b.reparations}</b> carte{b.reparations > 1 ? 's' : ''} réparation.</p>
        <div className="barre-actions">
          <button className="btn" onClick={() => onRepondre(false)}>{noireMono ? 'Endurer : perdre la voile, avancer de moitié' : 'Non, garder ma carte'}</button>
          <button className="btn btn-orange" onClick={() => onRepondre(true)} autoFocus>{noireMono ? '🔧 Réparer : garder la voile, sans avancer' : '🔧 Jouer une réparation'}</button>
        </div>
      </div>
    </div>
  );
}

export function ModaleRelance({ attente, b, etat, nom, onRepondre }: { attente: Extract<Attente, { type: 'relance' }>; b: EtatBateau; etat: EtatPartie; nom: string; onRepondre: (r: boolean) => void }) {
  const a = angleAllure(b.choix!.cap!, attente.ventLocal.direction);
  void etat;
  return (
    <div className="voile-fond" role="dialog" aria-modal="true">
      <div className="modale">
        <div className="lbl">{nom} · {competenceDef(b.competence).nom}</div>
        <h2>Le vent passe au {NOMS_DIR_LONGS[attente.ventLocal.direction]}, force {attente.ventLocal.force}</h2>
        <p className="muted">
          Avec votre cap, vous serez {a < 45 ? 'face au vent : vous louvoierez (avec une voile de près)' : `${auAllure(a)} (${String(a).replace('.', ',')}°)`}. Vous pouvez relancer le dé de
          direction pour votre bateau ({b.relancesRestantes} relance{b.relancesRestantes > 1 ? 's' : ''} restante{b.relancesRestantes > 1 ? 's' : ''}), au prix d'une case ce tour.
        </p>
        <div className="barre-actions">
          <button className="btn" onClick={() => onRepondre(false)} autoFocus>Garder ce vent</button>
          <button className="btn btn-principal" onClick={() => onRepondre(true)}>♟ Relancer le dé</button>
        </div>
      </div>
    </div>
  );
}

export function EcranPassation({ nom, onPret }: { nom: string; onPret: () => void }) {
  return (
    <div className="voile-fond" role="dialog" aria-modal="true" style={{ background: 'rgba(2,10,18,0.97)' }}>
      <div className="modale" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="lbl">Même écran</div>
        <h2>Passez l'appareil à {nom}</h2>
        <p className="muted">Les autres joueurs détournent les yeux : les choix restent secrets jusqu'au jet du vent.</p>
        <button className="btn btn-principal" onClick={onPret} autoFocus>Je suis {nom} : afficher mes choix</button>
      </div>
    </div>
  );
}
