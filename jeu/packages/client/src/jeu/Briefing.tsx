import { useState } from 'react';
import { categoriesPartie, course as courseJouee, heuresParTour } from '@cal/engine';
import type { EtatPartie } from '@cal/engine';
import { D, ecrireStockage, nomClasse } from '../commun';

export const CLE_BRIEFING = 'cal-briefing-masque';

/**
 * Briefing avant le départ : des schémas, très peu de texte (demandes du porteur de projet, 10/11/2026 : « personne ne
 * lit ça avant d'aller sur l'eau », « plus de schéma, moins de texte »). Le détail est dans les règles et le hangar.
 * Faits cités : Route du Rhum créée en 1978 et gagnée avec 98 secondes d'avance ; Rolex Fastnet Race courue depuis 1925 ;
 * Transat Café L'Or sur la route du café.
 */
const ACCROCHES: Record<string, string> = {
  'route-du-rhum': 'Seul à bord. La première, en 1978, s\'est jouée à 98 secondes.',
  'transat-cafe-lor': 'À deux, sur la route du café.',
  'rolex-fastnet': 'La classique depuis 1925.',
  'vendee-globe': 'Seul autour du monde, sans escale ni assistance.',
  'arkea-ultim-challenge': 'Seul autour du monde sur un trimaran géant.',
};

/** Durée de course représentée par un tour (décision du 12/11/2026 : utile, contrairement au nombre de tours). */
function dureeTour(h: number): string {
  // Arrondi demandé par le porteur de projet (12/11/2026) : 4,8 h → 5 heures, 22 h → 1 jour, 48 h → 2 jours.
  if (h < 12) return `${Math.round(h)} heures`;
  const j = Math.max(1, Math.round(h / 24));
  return j === 1 ? '1 jour' : `${j} jours`;
}

const MONTURES: Record<string, string> = {
  IMOCA: 'IMOCA, la bête du Vendée Globe',
  ULTIM: 'Ultim, trimaran géant : ça vole… et ça chavire',
  OCEAN_FIFTY: 'Ocean Fifty, trimaran vif et nerveux',
  CLASS40: 'Class40, solide : ça va jouer des coudes',
  VINTAGE: 'Bateau de légende : respect aux anciens',
};

/** Nom court d'une marque pour le schéma (« Fastnet Rock, à contourner » → « Fastnet Rock »). */
const court = (nom: string) => nom.split(',')[0].replace(/ à (tribord|bâbord).*$/, '').replace(/^Arrivée · /, '');

/** Le parcours en schéma : départ, passages obligés, arrivée. */
function Parcours({ etapes }: { etapes: { nom: string; type: 'depart' | 'marque' | 'arrivee' }[] }) {
  const W = 520, H = 96, x0 = 50, x1 = W - 50;
  const xs = etapes.map((_, i) => x0 + ((x1 - x0) * i) / Math.max(1, etapes.length - 1));
  const chemin = xs.map((x, i) => `${i ? 'L' : 'M'} ${x} ${i % 2 ? 30 : 42}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", width: "100%", height: H, flexShrink: 0, margin: "0 auto" }} role="img" aria-label={`Parcours : ${etapes.map((e) => e.nom).join(', puis ')}`}>
      <path d={chemin} fill="none" stroke="#ffd166" strokeWidth="2.5" strokeDasharray="6 6" />
      {etapes.map((e, i) => {
        const x = xs[i], y = i % 2 ? 30 : 42;
        return (
          <g key={i}>
            {e.type === 'depart' && <circle cx={x} cy={y} r="9" fill="#4cc38a" />}
            {e.type === 'marque' && <g><line x1={x} y1={y + 9} x2={x} y2={y - 13} stroke="#e6eef5" strokeWidth="2" /><path d={`M ${x} ${y - 13} L ${x + 14} ${y - 8} L ${x} ${y - 3} Z`} fill="#ffd166" /></g>}
            {e.type === 'arrivee' && (
              <g>
                {[0, 1, 2, 3].map((k) => <rect key={k} x={x - 8 + (k % 2) * 8} y={y - 8 + Math.floor(k / 2) * 8} width="8" height="8" fill={(k === 0 || k === 3) ? '#e6eef5' : '#04121f'} stroke="#e6eef5" strokeWidth="0.6" />)}
              </g>
            )}
            <text x={x} y={y + 30} textAnchor="middle" fontSize="12.5" fill="#e6eef5" fontWeight="600">{e.nom}</text>
          </g>
        );
      })}
      <text x={xs[0] + 22} y={20} fontSize="20">⛵</text>
    </svg>
  );
}

/** Explications de début de partie, masquables définitivement (« Ne plus afficher »). */
export default function Briefing({ onFermer, etat }: { onFermer: () => void; etat: EtatPartie }) {
  const [masquer, setMasquer] = useState(false);
  const course = courseJouee(D, etat);
  const classe = etat.params.classe;
  const depart = course.lieux?.find((l) => l.type === 'depart')?.nom ?? 'Départ';
  const arrivee = course.lieux?.find((l) => l.type === 'arrivee')?.nom ?? 'Arrivée';
  const marques = course.portes.filter((p) => p.type === 'marque' && !p.cachee);
  const etapes = [
    { nom: depart, type: 'depart' as const },
    ...marques.map((m) => ({ nom: court(m.nom), type: 'marque' as const })),
    { nom: arrivee, type: 'arrivee' as const },
  ];
  const fermer = () => {
    if (masquer) ecrireStockage(CLE_BRIEFING, { masque: true });
    onFermer();
  };
  return (
    <div className="voile-fond" role="dialog" aria-modal="true" aria-labelledby="titre-briefing">
      <div className="modale briefing briefing-court">
        <div className="lbl">Briefing · {nomClasse(classe)}{MONTURES[classe] ? ` · ${MONTURES[classe]}` : ''}</div>
        <h2 id="titre-briefing">{course.nom}</h2>
        <p className="regles-accroche">{ACCROCHES[course.id] ?? course.sous_titre}</p>
        <p className="muted briefing-duree">⏱ Un tour représente environ {dureeTour(heuresParTour(D, etat))} de course.</p>

        <Parcours etapes={etapes} />

        <div className="briefing-tour" aria-label="Un tour de jeu">
          <div><span>🧭</span>Cap + voile</div>
          <i>›</i>
          <div><span>🎲</span>Le vent tourne</div>
          <i>›</i>
          <div><span>🃏</span>Dé du large : carte, question ou rien</div>
          <i>›</i>
          <div><span>⛵</span>On avance</div>
        </div>

        <div className="briefing-vignettes">
          <div><span>⛵ + 🌬️</span><b>F3</b><small>ça file 🚀</small></div>
          <div><span>⛵ + 🌪️</span><b>F9 et plus</b><small>dé tempête 💥</small></div>
          <div><span>🧭 ↑ 🌬️</span><b>Face au vent</b><small>on tire des bords</small></div>
          <div><span>🏁 🏁</span><b>Même tour</b><small>départage au quiz</small></div>
        </div>

        {(course.double || categoriesPartie(D, etat)) && (
          <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
            {[course.double ? '👥 En double' : '', categoriesPartie(D, etat) ? '🏆 Deux classements : monos et multis' : ''].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="barre-actions" style={{ alignItems: 'center' }}>
          <label className="case-cocher">
            <input type="checkbox" checked={masquer} onChange={(e) => setMasquer(e.target.checked)} /> Ne plus afficher
          </label>
          <button className="btn btn-principal" onClick={fermer} autoFocus>Larguez les amarres ! ⛵</button>
        </div>
      </div>
    </div>
  );
}
