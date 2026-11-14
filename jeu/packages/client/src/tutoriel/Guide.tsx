// Guide du tutoriel « Ma première course » (décision du propriétaire, 14/11/2026), à la place des bulles du coach.
// Premier tour geste par geste : l'écran s'assombrit sauf la zone à toucher (halo jaune), une main montre le geste,
// quelques mots à côté. Deuxième tour : le joueur refait seul. Puis « Bravo », et de petits conseils d'une ligne.
// Pendant l'animation des deux premiers tours, la frise des cinq temps du tour. Le guide passe sous les fenêtres du jeu.
// Ce qu'il montre est décidé par guide.ts (testé) ; scénario : jeu/conception/tutoriel-anime.md.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { astuceDuMoment, ETAPES_FRISE, pasEffectif, TEXTES_ASTUCES, vueDuGuide } from './guideLogique';
import type { Astuce, CibleGuide, ContexteGuide, EtatGuide } from './guideLogique';

/** Où trouver chaque zone éclairée dans l'écran de jeu. */
const SELECTEURS: Record<CibleGuide, string> = {
  vent: '.meteo-sur-carte',
  mer: '.repere-guide',
  voiles: '.boutons-voiles',
  valider: '.bouton-valider',
};

interface Cadre { x: number; y: number; w: number; h: number }

/** Position à l'écran d'un élément (null s'il est absent ou caché), suivie quand la carte bouge ou que la fenêtre change. */
function useCadre(selecteur: string | null): Cadre | null {
  const [cadre, setCadre] = useState<Cadre | null>(null);
  useEffect(() => {
    if (!selecteur) { setCadre(null); return; }
    let id = 0;
    const mesurer = () => {
      const el = document.querySelector<HTMLElement>(selecteur);
      const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
      setCadre((p) => {
        if (!r) return null;
        if (p && Math.abs(p.x - r.left) < 0.5 && Math.abs(p.y - r.top) < 0.5 && Math.abs(p.w - r.width) < 0.5 && Math.abs(p.h - r.height) < 0.5) return p;
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      id = window.setTimeout(mesurer, 200);
    };
    mesurer();
    return () => clearTimeout(id);
  }, [selecteur]);
  return cadre;
}

const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function Guide({ contexte, onQuitter }: { contexte: ContexteGuide; onQuitter: () => void }) {
  const [g, setG] = useState<EtatGuide>({ pas: 0, termine: false });
  const vue = vueDuGuide(contexte, g);

  // Petits conseils : un à la fois, cinq secondes, une seule fois chacun.
  const vues = useRef(new Set<Astuce>());
  const minuteur = useRef(0);
  const [astuce, setAstuce] = useState<Astuce | null>(null);
  const prochaine = astuceDuMoment(contexte, g, vues.current);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  useEffect(() => {
    if (!prochaine || astuce) return;
    vues.current.add(prochaine);
    setAstuce(prochaine);
    clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setAstuce(null), 5000);
  }, [prochaine, astuce]);

  const cible = vue?.type === 'projecteur' ? vue.cible : null;
  const cadreCible = useCadre(cible ? SELECTEURS[cible] : null);
  const cadreCarte = useCadre('.zone-carte');
  // La frise et les petites bulles se posent en haut de la carte, sous le classement (sans le cacher).
  const cadreClassement = useCadre('.zone-carte .classement');

  // Taille de la bulle, mesurée après affichage, pour la poser à côté de la zone sans sortir de l'écran.
  const bulle = useRef<HTMLDivElement>(null);
  const [tailleBulle, setTailleBulle] = useState({ w: 220, h: 46 });
  const texteBulle = vue?.type === 'projecteur' ? vue.texte : '';
  useLayoutEffect(() => {
    const el = bulle.current;
    if (el && (Math.abs(el.offsetWidth - tailleBulle.w) > 1 || Math.abs(el.offsetHeight - tailleBulle.h) > 1)) setTailleBulle({ w: el.offsetWidth, h: el.offsetHeight });
  });

  const W = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  const hautCarte = cadreCarte
    ? { left: cadreCarte.x + cadreCarte.w / 2, top: cadreClassement ? cadreClassement.y + cadreClassement.h + 8 : cadreCarte.y + 10 }
    : { left: W / 2, top: 60 };

  let projecteur: JSX.Element | null = null;
  if (vue?.type === 'projecteur' && cadreCible) {
    const spot: Cadre = cible === 'mer'
      ? { x: cadreCible.x - 34, y: cadreCible.y - 34, w: 68, h: 68 }
      : { x: cadreCible.x - 6, y: cadreCible.y - 6, w: cadreCible.w + 12, h: cadreCible.h + 12 };
    const cx = spot.x + spot.w / 2, cy = spot.y + spot.h / 2;
    const dessus = spot.y - tailleBulle.h - 14;
    const top = cible !== 'vent' && dessus >= 8 ? dessus : borne(spot.y + spot.h + 14, 8, H - tailleBulle.h - 8);
    const left = borne(cx - tailleBulle.w / 2, 12, W - tailleBulle.w - 12);
    projecteur = (
      <>
        <div className="guide-projecteur" style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: cible === 'mer' ? '50%' : 14 }} />
        {vue.main && <div className="guide-main" style={{ left: cx - 15, top: cy - 4 }} aria-hidden>👆</div>}
        <div className="guide-bulle" ref={bulle} style={{ left, top }} role="status">
          <span>{texteBulle}</span>
          {vue.ok && (
            <button className="btn btn-petit" onClick={() => setG((s) => ({ ...s, pas: pasEffectif(s.pas, contexte.destination) + 1 }))}>OK</button>
          )}
          <button className="guide-passer" onClick={() => setG((s) => ({ ...s, termine: true }))}>Passer</button>
        </div>
      </>
    );
  }

  return (
    <div className="guide" aria-live="polite">
      {projecteur}
      {vue?.type === 'frise' && (
        <div className="guide-haut guide-frise" style={hautCarte} aria-label="Les cinq temps du tour">
          {ETAPES_FRISE.map((e) => <span key={e.id} className={e.id === vue.etape ? 'on' : ''}>{e.icone}<b> {e.nom}</b></span>)}
        </div>
      )}
      {vue?.type === 'bulle' && <div className="guide-haut guide-bulle" style={hautCarte} role="status">{vue.texte}</div>}
      {vue?.type === 'bravo' && (
        <div className="guide-bravo" role="dialog" aria-label="Fin du tutoriel">
          <h2>Bravo, tu sais jouer !</h2>
          <div>
            <button className="btn btn-principal" onClick={() => setG((s) => ({ ...s, termine: true }))} autoFocus>Continuer la course</button>
            <button className="btn" onClick={onQuitter}>Accueil</button>
          </div>
        </div>
      )}
      {astuce && contexte.choix && !vue && (
        <div className="guide-haut guide-bulle" style={hautCarte} role="status" onClick={() => setAstuce(null)}>{TEXTES_ASTUCES[astuce]}</div>
      )}
    </div>
  );
}
