import { useEffect, useState } from 'react';
import { estDurable, perteCarte } from '@cal/engine';
import type { CarteEvenementDef, EffetEvenement } from '@cal/engine';
import { D, millesParUnite } from '../commun';


const pct = (p: number) => `${Math.round(p * 100)} %`;

/** Traduction lisible de l'effet d'une carte (avaries : part de l'avance de chaque tour, docs/avaries-et-reparations.md). */
export function texteEffet(e: EffetEvenement): string[] {
  const t: string[] = [];
  const tours = estDurable(e) ? ` pendant ${e.tours} tours` : ' ce tour';
  const perte = perteCarte(e, false);
  if (e.distance && e.distance > 0) t.push(`+${Math.round(e.distance * millesParUnite())} milles environ${tours}`);
  if (perte >= 1 && !e.perte_voile) t.push('Tour perdu : vous n\'avancez pas ce tour');
  else if (perte > 0 && !e.perte_voile) t.push(estDurable(e) ? `Avance réduite de ${pct(perte)} à chaque tour, pendant ${e.tours} tours` : `Avance réduite de ${pct(perte)} ce tour`);
  if (e.risque) t.push(`Risque ${e.risque > 0 ? '+' : '−'}${Math.abs(e.risque)} cran${tours}`);
  if (e.reparation) t.push(`+${e.reparation} carte réparation`);
  if (e.perte_voile) t.push('Voile de portant perdue jusqu\'à la prochaine escale, et avance réduite de 50 % ce tour');
  if (t.length === 0) t.push('Aucun effet sur la course : juste un beau souvenir');
  return t;
}

/** Ce que changerait une carte réparation sur cette avarie (proposée au joueur avant qu'il choisisse). */
function texteReparer(e: EffetEvenement): string {
  if (e.perte_voile) return 'Réparer sauve la voile, mais vous n\'avancez pas ce tour.';
  const avant = perteCarte(e, false);
  const apres = perteCarte(e, true);
  if (estDurable(e))
    return avant > 0
      ? `Réparer tout de suite coûte plus cher ce tour (avance réduite de ${pct(apres)} au lieu de ${pct(avant)}), mais l'avarie s'arrête là : rien sur les tours suivants.`
      : 'Réparer tout de suite : l\'avarie s\'arrête à ce tour, rien sur les tours suivants.';
  return `Réparer divise la perte par deux${avant > 0 ? ` (avance réduite de ${pct(apres)} au lieu de ${pct(avant)})` : ''}.`;
}

const CIELS: Record<CarteEvenementDef['ton'], [string, string, string]> = {
  heureux: ['#ffb36b', '#ff7e7e', '#2b6a99'],
  neutre: ['#7ec8ff', '#9fd8ff', '#1f5d8c'],
  dommage: ['#5b6675', '#2e3742', '#1b2a38'],
};

/** Illustration dessinée (en attendant de vraies photos libres de droits) : ciel, mer et bateau sous voile. */
function Scene({ carte, couleur }: { carte: CarteEvenementDef; couleur: string }) {
  const [c1, c2, mer] = CIELS[carte.ton];
  const nuit = carte.illustration === 'nuit';
  return (
    <svg viewBox="0 0 400 190" className="scene-carte" aria-hidden>
      <defs>
        <linearGradient id={`ciel-${carte.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={nuit ? '#0b1530' : c1} />
          <stop offset="1" stopColor={nuit ? '#24365e' : c2} />
        </linearGradient>
      </defs>
      <rect width="400" height="190" fill={`url(#ciel-${carte.id})`} />
      {nuit ? (
        <>
          <circle cx="320" cy="45" r="18" fill="#f3efd6" />
          {[[60, 30], [120, 55], [200, 25], [260, 60], [90, 80], [350, 95]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" />
          ))}
        </>
      ) : carte.ton !== 'dommage' ? (
        <circle cx="300" cy="118" r="34" fill="#ffe2a6" opacity="0.9" />
      ) : (
        <path d="M0 40 Q80 10 160 40 T320 35 T400 45 V0 H0 Z" fill="#1e252e" opacity="0.6" />
      )}
      <rect y="120" width="400" height="70" fill={mer} />
      <path d="M0 128 Q25 120 50 128 T100 128 T150 128 T200 128 T250 128 T300 128 T350 128 T400 128 V190 H0 Z" fill="rgba(255,255,255,0.12)" />
      {/* Bateau sous voile, aux couleurs du skipper */}
      <g transform="translate(120 70)">
        <path d="M30 -45 L30 52 L-8 50 Z" fill="#2a2f36" />
        <path d="M33 -38 Q70 0 66 46 L33 48 Z" fill={couleur} opacity="0.95" />
        <path d="M-18 52 L82 52 L70 64 L-8 64 Z" fill="#f4f6f8" />
        <rect x="-18" y="52" width="100" height="3" fill={couleur} />
      </g>
      <text x="300" y="80" fontSize="54" textAnchor="middle">{carte.icone}</text>
    </svg>
  );
}

interface Props {
  carte: CarteEvenementDef;
  nom: string;
  couleur: string;
  /** Si présent : le joueur peut annuler l'avarie avec une carte réparation. */
  reparations?: number;
  onReparer?: (jouer: boolean) => void;
  onContinuer?: () => void;
}

export default function ModaleCarteEvenement({ carte, nom, couleur, reparations, onReparer, onContinuer }: Props) {
  const [tiree, setTiree] = useState(false);
  useEffect(() => {
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setTiree(true), reduit ? 0 : 1700);
    return () => clearTimeout(t);
  }, [carte.id]);
  if (!tiree)
    return (
      <div className="voile-fond" role="dialog" aria-modal="true" aria-label="Tirage d'une carte du large">
        <div className="paquet" onClick={() => setTiree(true)}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dos-carte" style={{ transform: `translate(${i * 3}px, ${-i * 3}px)` }} />
          ))}
          <div className="dos-carte tiree" />
          <div className="paquet-legende">{nom} tire une carte du large…</div>
        </div>
      </div>
    );
  const libelleTon = carte.ton === 'heureux' ? 'Bonne nouvelle' : carte.ton === 'dommage' ? 'Avarie' : 'Instant du large';
  return (
    <div className="voile-fond" role="dialog" aria-modal="true" aria-labelledby="titre-carte">
      <div className={`modale carte-evenement retournee ton-${carte.ton}`}>
        <Scene carte={carte} couleur={couleur} />
        <div className="lbl">Carte du large · {libelleTon} · {nom}</div>
        <h2 id="titre-carte">{carte.titre}</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{carte.texte}</p>
        <div className="effets">
          {texteEffet(carte.effet).map((t) => (
            <span key={t} className={`effet ${carte.ton}`}>{t}</span>
          ))}
        </div>
        {onReparer ? (
          <>
            <p style={{ margin: 0 }}>
              {texteReparer(carte.effet)} Il vous reste <b>{reparations}</b> carte{reparations === 1 ? '' : 's'} réparation.
            </p>
            <div className="barre-actions">
              <button className="btn" onClick={() => onReparer(false)}>{carte.effet.perte_voile ? 'Endurer : perdre la voile, avancer de moitié' : "Non, j'encaisse"}</button>
              <button className="btn btn-orange" onClick={() => onReparer(true)} autoFocus>{carte.effet.perte_voile ? '🔧 Réparer : garder la voile, sans avancer' : '🔧 Jouer une réparation'}</button>
            </div>
          </>
        ) : (
          <button className="btn btn-principal" onClick={onContinuer} autoFocus>Continuer</button>
        )}
      </div>
    </div>
  );
}
