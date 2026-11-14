// Le petit film « Comment ça marche », en tête de l'écran des règles (décision du propriétaire, 14/11/2026 : « dans
// l'onglet des regels, le petit film »). Neuf scènes animées, une phrase courte chacune, des mots d'enfant ; la scène 2 se
// touche. Scénario : jeu/conception/tutoriel-anime.md. Les chiffres (plages des voiles, faces des dés et de la boussole du
// large) sont lus dans les réglages du jeu.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { NB_DIR, nomBeaufort } from '@cal/engine';
import { D } from '../commun';
import { ETAPES_FRISE } from './guideLogique';
import { niveauxVoiles, VOILES_FILM } from './filmDonnees';

const rad = (a: number) => (a * Math.PI) / 180;
const hasard = <T,>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)];
const VIOLET = '#a78bfa', JAUNE = '#ffd166', ORANGE = '#ff9f43', CYAN = '#3dd6f5', GRIS = '#5c6f80';

/** Minuteurs d'une scène, tous arrêtés quand la scène s'en va. */
function minuteurs() {
  const ids: number[] = [];
  return {
    plus: (f: () => void, ms: number) => { ids.push(window.setTimeout(f, ms)); },
    chaque: (f: () => void, ms: number) => { ids.push(window.setInterval(f, ms)); },
    arreter: () => ids.forEach((i) => { clearTimeout(i); clearInterval(i); }),
  };
}

// ---------- Petits dessins ----------
function Mer() {
  return (
    <>
      <defs>
        <linearGradient id="film-mer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f4d78" />
          <stop offset="1" stopColor="#06243b" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#film-mer)" />
    </>
  );
}
function Coque({ couleur }: { couleur: string }) {
  return <path d="M0 -13 C6 -5 6 6 4 11 L-4 11 C-6 6 -6 -5 0 -13 Z" fill={couleur} stroke="#fff" strokeWidth={1.5} />;
}
function Souffle({ n = 14, x0 = 20, x1 = 380 }: { n?: number; x0?: number; x1?: number }) {
  return (
    <g className="film-souffle">
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / n + (i % 2 ? 6 : -6);
        const y = 30 + ((i * 53) % 150);
        return <line key={i} x1={x} y1={y} x2={x} y2={y + 16} style={{ animationDelay: `${((i * 0.37) % 1.8).toFixed(2)}s` }} />;
      })}
    </g>
  );
}
function FlecheVent({ x, y, l = 30 }: { x: number; y: number; l?: number }) {
  return <path d={`M${x} ${y} L${x} ${y + l} M${x - 8} ${y + l - 10} L${x} ${y + l} L${x + 8} ${y + l - 10}`} stroke={ORANGE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}
/** Bateau vu de dessus qui suit un chemin en boucle. */
function Suivre({ chemin, dur, couleur, arret }: { chemin: string; dur: string; couleur: string; arret?: boolean }) {
  return (
    <g>
      <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" {...(arret ? { keyTimes: '0;0.7;1', keyPoints: '0;1;1', calcMode: 'linear' } : {})}>
        <mpath href={`#${chemin}`} />
      </animateMotion>
      <g transform="rotate(90)"><Coque couleur={couleur} /></g>
    </g>
  );
}
function Phrase({ grand, petit }: { grand: string; petit?: string }) {
  return (
    <>
      <p className="film-phrase">{grand}</p>
      <p className="film-petit">{petit || ' '}</p>
    </>
  );
}
function Ecran({ label, children, vite }: { label: string; children: ReactNode; vite?: boolean }) {
  return <svg viewBox="0 0 400 240" className={`film-svg ${vite ? 'film-vite' : ''}`} role="img" aria-label={label}>{children}</svg>;
}

// ---------- 1 · Le but ----------
function SceneBut() {
  return (
    <>
      <Ecran label="Deux voiliers font la course de Saint-Malo à la Guadeloupe">
        <Mer />
        <path d="M400 0 L400 120 Q372 112 352 92 Q334 74 306 70 Q296 44 306 18 Q312 6 306 0 Z" fill="#efe3c8" />
        <text x="318" y="52" fill="#04121f" fontSize="12" fontWeight="700">Saint-Malo</text>
        <g fill="#efe3c8"><circle cx="46" cy="200" r="8" /><circle cx="60" cy="206" r="5" /><circle cx="30" cy="186" r="4" /></g>
        <text x="72" y="222" fill="#efe3c8" fontSize="12" fontWeight="700">Guadeloupe</text>
        <path id="film-route1" d="M306 76 C 250 96, 150 150, 52 192" fill="none" stroke="#fff" strokeWidth={2} className="film-trace" opacity={0.7} />
        <g transform="translate(52 192)">
          <line x1="0" y1="0" x2="0" y2="-24" stroke="#fff" strokeWidth={2} />
          <path className="film-drapeau" d="M0 -24 L16 -19 L0 -14 Z" fill="#ff5d5d" />
        </g>
        <Suivre chemin="film-route1" dur="7s" couleur={JAUNE} />
        <Suivre chemin="film-route1" dur="6.3s" couleur={VIOLET} />
      </Ecran>
      <Phrase grand="Traverse l'océan à la voile." petit="Le premier arrivé gagne !" />
    </>
  );
}

// ---------- 2 · Le vent et le cap (scène à toucher) ----------
const ALLURES_FILM: Record<number, [string, string]> = {
  0: ['Face au vent : on zigzague.', "C'est le louvoyage : on avance moins."],
  45: ['Près du vent : ça remonte.', 'Ça avance, un peu moins vite.'],
  90: ['Vent de côté : ça file !', 'Essaie un autre rond bleu !'],
  135: ['Vent de biais, dans le dos : ça file !', 'Essaie un autre rond bleu !'],
  180: ['Vent dans le dos : sors le spi !', 'Essaie un autre rond bleu !'],
};
const VITESSE_FILM: Record<number, number> = { 0: 0.6, 45: 0.8, 90: 1, 135: 1.1, 180: 0.95 };

function SceneCap() {
  const [cap, setCap] = useState<number | null>(null);
  const auto = useRef(true);
  useEffect(() => {
    const m = minuteurs();
    const demo = [0, 90, 180, 45, 135, 270];
    let i = 0;
    m.plus(() => { if (auto.current) setCap(demo[i++ % demo.length]); }, 1800);
    m.chaque(() => { if (auto.current) setCap(demo[i++ % demo.length]); }, 3000);
    return m.arreter;
  }, []);
  const choisir = (h: number) => { auto.current = false; setCap(h); };
  const c = { x: 200, y: 140 }, r = 66;
  const secteur = (a0: number, a1: number, coul: string) => {
    const p = (a: number) => `${c.x + r * Math.sin(rad(a))} ${c.y - r * Math.cos(rad(a))}`;
    return <path key={`${a0}`} d={`M${c.x} ${c.y} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`} fill={coul} opacity={0.42} />;
  };
  const k = cap === null ? null : cap > 180 ? 360 - cap : cap;
  let trace: { d: string; fin: [number, number] } | null = null;
  if (cap !== null && k !== null) {
    if (k === 0) {
      // Bords à droite et à gauche du vent : on monte moins vite qu'en ligne droite.
      const pts: [number, number][] = [[c.x, c.y]];
      let x = c.x, y = c.y;
      for (let i = 0; i < 5; i++) { const s = i % 2 ? -1 : 1; x += (i === 0 ? 1 : 2) * s * 14; y -= 56 / 5; pts.push([x, y]); }
      trace = { d: 'M' + pts.map((p) => p.join(' ')).join(' L'), fin: pts[pts.length - 1] };
    } else {
      const L = 80 * VITESSE_FILM[k];
      const fin: [number, number] = [c.x + L * Math.sin(rad(cap)), c.y - L * Math.cos(rad(cap))];
      trace = { d: `M${c.x} ${c.y} L${fin[0]} ${fin[1]}`, fin };
    }
  }
  return (
    <>
      <Ecran label="Le bateau et le vent : touche une direction">
        <Mer />
        <Souffle n={12} />
        {secteur(-45, 45, GRIS)}{secteur(45, 80, CYAN)}{secteur(-80, -45, CYAN)}{secteur(80, 120, '#4cc38a')}{secteur(-120, -80, '#4cc38a')}
        {secteur(120, 160, JAUNE)}{secteur(-160, -120, JAUNE)}{secteur(160, 200, ORANGE)}
        <FlecheVent x={200} y={6} l={32} />
        <text x="214" y="24" fill={ORANGE} fontSize="12" fontWeight="700">le vent</text>
        {trace && (
          <g key={cap ?? -1} className="film-apparait">
            <path d={trace.d} fill="none" stroke="#fff" strokeWidth={2.5} className="film-trace" />
            <circle cx={trace.fin[0]} cy={trace.fin[1]} r={6} fill="none" stroke={k === 0 ? '#9fb3c8' : CYAN} strokeWidth={3} />
          </g>
        )}
        <g transform={`translate(${c.x} ${c.y})`}>
          <g className="film-cap" style={{ transform: `rotate(${cap ?? 0}deg)` }}><g transform="scale(1.5)"><Coque couleur={VIOLET} /></g></g>
        </g>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((h) => (
          <g key={h} className={`film-cible ${cap === h ? 'on' : ''}`} role="button" tabIndex={0} aria-label={`Aller dans cette direction (${h}° du vent)`}
            onClick={() => choisir(h)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') choisir(h); }}>
            <circle cx={c.x + 84 * Math.sin(rad(h))} cy={c.y - 84 * Math.cos(rad(h))} r={20} fill="transparent" className="film-zone" />
            <circle cx={c.x + 84 * Math.sin(rad(h))} cy={c.y - 84 * Math.cos(rad(h))} r={11} fill={CYAN} stroke="#04121f" strokeWidth={2} />
          </g>
        ))}
      </Ecran>
      <Phrase grand={k === null ? 'Le vent vient de la flèche orange.' : ALLURES_FILM[k][0]} petit={k === null ? 'Touche un rond bleu pour choisir où aller !' : ALLURES_FILM[k][1]} />
    </>
  );
}

// ---------- 3 · Les voiles ----------
const DESSIN_VOILE: Record<string, ReactNode> = {
  spi: <path d="M14 -90 Q60 -66 46 -4 L14 -4 Z" fill={ORANGE} />,
  solent: <path d="M14 -88 L40 -4 L14 -4 Z" fill="#f4f7fb" />,
  j3: <path d="M14 -64 L34 -4 L14 -4 Z" fill="#f4f7fb" />,
  reduite: <><path d="M14 -40 L28 -4 L14 -4 Z" fill="#f4f7fb" /><path d="M10 -44 L10 -4 L-4 -4 Z" fill="#cfd8e3" /></>,
};
const COULEURS_JAUGE = ['#4cc38a', JAUNE, ORANGE, '#ff5d5d'];

function SceneVoiles() {
  const niveaux = useMemo(() => niveauxVoiles(D), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    const m = minuteurs();
    m.chaque(() => setI((x) => (x + 1) % niveaux.length), 2600);
    return m.arreter;
  }, [niveaux.length]);
  const n = niveaux[i];
  const h = 36 + (106 * i) / Math.max(1, niveaux.length - 1);
  return (
    <>
      <Ecran label="Plus le vent est fort, plus la voile doit être petite" vite={i >= 2}>
        <Mer />
        <Souffle n={10} x0={20} x1={110} />
        <g transform="translate(26 40)">
          <rect x="0" y="0" width="34" height="150" rx="8" fill="#11283d" stroke="#1f3d5a" />
          <rect className="film-jauge" x="4" y={146 - h} width="26" height={h} rx="5" fill={COULEURS_JAUGE[i % COULEURS_JAUGE.length]} />
        </g>
        <text x="43" y="210" textAnchor="middle" fill="#e6eef5" fontSize="13" fontWeight="700">F{n.force}</text>
        <text x="43" y="226" textAnchor="middle" fill="#9fb3c8" fontSize="10">{nomBeaufort(D, n.force).toLowerCase()}</text>
        {VOILES_FILM.map((id, k) => {
          const ok = n.voiles.includes(id);
          return (
            <g key={id} className={`film-voile ${ok ? 'ok' : 'non'}`} transform={`translate(${96 + k * 74} 40)`}>
              <rect x="0" y="0" width="64" height="150" rx="10" fill="#11283d" stroke="#1f3d5a" />
              <g transform="translate(14 118)">
                <path d="M-6 0 L46 0 L40 8 L-2 8 Z" fill={VIOLET} />
                <line x1="12" y1="0" x2="12" y2="-92" stroke="#e6eef5" strokeWidth={2} />
                {DESSIN_VOILE[id]}
              </g>
              <text x="32" y="140" textAnchor="middle" fill="#e6eef5" fontSize="12" fontWeight="700">{D.voiles.find((v) => v.id === id)?.nom_court ?? id}</text>
              <g className="film-coche"><circle cx="54" cy="12" r="9" fill="#4cc38a" /><path d="M49 12 L53 16 L59 8" stroke="#04121f" strokeWidth={2.5} fill="none" /></g>
            </g>
          );
        })}
        {n.voiles.length === 0 && <text x="250" y="222" textAnchor="middle" fill="#ff5d5d" fontSize="14" fontWeight="800">À la cape : on range tout !</text>}
      </Ecran>
      <Phrase grand="Plus il y a de vent, plus la voile est petite." petit="Le jeu te propose la bonne voile." />
    </>
  );
}

// ---------- 4 · Ton tour ----------
function SceneTour() {
  const [pas, setPas] = useState(0);
  useEffect(() => {
    const m = minuteurs();
    const boucle = () => {
      setPas(0);
      [600, 1500, 2100, 2900, 3800].forEach((t, k) => m.plus(() => setPas(k + 1), t));
    };
    boucle();
    m.chaque(boucle, 5600);
    return m.arreter;
  }, []);
  const [mx, my] = pas === 0 ? [360, 250] : pas <= 3 ? [170, 104] : [331, 204];
  return (
    <>
      <Ecran label="Une main touche la mer, puis le bouton Valider">
        <Mer />
        <path d="M400 0 L400 130 Q370 122 352 100 Q334 82 306 78 Q296 50 306 22 L304 0 Z" fill="#efe3c8" />
        <rect x="272" y="10" width="112" height="24" rx="12" fill="#0b2236" stroke="#1f3d5a" />
        <text x="328" y="27" textAnchor="middle" fill="#e6eef5" fontSize="12" fontWeight="700"><tspan fill={ORANGE}>↖</tspan> vent F3</text>
        {pas >= 2 && (
          <g className="film-apparait">
            <line x1="290" y1="92" x2="170" y2="104" stroke="#fff" strokeWidth={2.5} className="film-trace" />
            <circle cx="170" cy="104" r="7" fill="none" stroke={CYAN} strokeWidth={3} />
          </g>
        )}
        <g transform="translate(290 92) rotate(-95)"><Coque couleur={VIOLET} /></g>
        <rect x="10" y="176" width="380" height="56" rx="12" fill="#0b2236" stroke="#1f3d5a" />
        {['J3', 'Solent', 'Code 0', 'Genn.'].map((nom, k) => (
          <g key={nom}>
            <rect x={20 + k * 62} y="184" width="56" height="40" rx="8" fill="#11283d" stroke={k === 3 && pas >= 3 ? CYAN : '#1f3d5a'} strokeWidth={2} />
            <text x={48 + k * 62} y="208" textAnchor="middle" fill="#e6eef5" fontSize="12" fontWeight="700">{nom}</text>
          </g>
        ))}
        <rect x="282" y="186" width="98" height="36" rx="10" fill={CYAN} style={{ filter: pas === 5 ? 'brightness(1.35)' : undefined }} />
        <text x="331" y="209" textAnchor="middle" fill="#04121f" fontSize="14" fontWeight="800">Valider</text>
        {(pas === 2 || pas === 5) && <circle key={pas} className="film-onde" cx={pas === 2 ? 170 : 331} cy={pas === 2 ? 104 : 204} r={22} fill="none" stroke="#fff" strokeWidth={2} />}
        <g className="film-main" style={{ transform: `translate(${mx - 12}px, ${my}px)` }}><text x="0" y="0" fontSize="28" dominantBaseline="hanging">👆</text></g>
      </Ecran>
      <Phrase grand="Touche la mer où tu veux aller." petit="Puis « Valider ». Tout le monde choisit en même temps." />
    </>
  );
}

// ---------- 5 · Le vent change ----------
function SceneDes() {
  const R = D.regles;
  const vent = useRef({ dir: 135, force: 3 });
  const [a, setA] = useState({ dir: 135, force: 3, roule: false, resD: '', resF: '' });
  useEffect(() => {
    const m = minuteurs();
    const lancer = () => {
      setA((x) => ({ ...x, roule: true, resD: '', resF: '' }));
      m.plus(() => {
        const d = hasard(R.de_direction);
        const v = vent.current;
        const nf = Math.max(2, Math.min(7, v.force + hasard(R.de_force)));
        const df = nf - v.force;
        setA((x) => ({ ...x, roule: false, resD: d === 0 ? 'ne tourne pas' : d > 0 ? 'tourne ↻' : 'tourne ↺', resF: df === 0 ? 'force : pareil' : `force ${df > 0 ? '+' : ''}${df}` }));
        m.plus(() => {
          vent.current = { dir: v.dir + (d * 360) / NB_DIR, force: nf };
          setA((x) => ({ ...x, dir: vent.current.dir, force: nf }));
        }, 500);
      }, 1300);
    };
    m.plus(lancer, 400);
    m.chaque(lancer, 4400);
    return m.arreter;
  }, [R]);
  return (
    <>
      <Ecran label="Les dés du vent : direction et force">
        <Mer />
        <g className={a.roule ? 'film-roule' : ''}>
          <circle cx="130" cy="78" r="38" fill={CYAN} />
          <path d="M110 78 A20 20 0 1 1 130 98" stroke="#04121f" strokeWidth={5} fill="none" />
          <path d="M122 92 L130 99 L122 106" stroke="#04121f" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
        <g className={a.roule ? 'film-roule' : ''}>
          <rect x="232" y="40" width="76" height="76" rx="14" fill={ORANGE} />
          {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={246 + k * 10} y={96 - k * 9} width="7" height={10 + k * 9} rx="2" fill="#04121f" opacity={k < 3 ? 1 : 0.3} />)}
        </g>
        <text x="130" y="138" textAnchor="middle" fill="#e6eef5" fontSize="15" fontWeight="800">{a.resD}</text>
        <text x="270" y="138" textAnchor="middle" fill="#e6eef5" fontSize="15" fontWeight="800">{a.resF}</text>
        <circle cx="200" cy="196" r="34" fill="#0b2236" stroke="#1f3d5a" />
        <text x="200" y="170" textAnchor="middle" fill="#9fb3c8" fontSize="9">N</text>
        <g transform="translate(200 196)">
          <g className="film-fleche" style={{ transform: `rotate(${a.dir}deg)` }}>
            <path d="M0 -26 L0 10 M-8 2 L0 12 L8 2" stroke={ORANGE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
        <text x="252" y="200" fill="#e6eef5" fontSize="14" fontWeight="800">F{a.force}</text>
      </Ecran>
      <Phrase grand="Puis les dés font tourner le vent." petit="Ton bateau avance avec ce vent-là. Bien deviné ?" />
    </>
  );
}

// ---------- 6 · Trop de vent ? ----------
function SceneTropDeVent() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const m = minuteurs();
    const boucle = () => {
      setPh(0);
      [1400, 2900, 4300, 5300].forEach((t, k) => m.plus(() => setPh(k + 1), t));
    };
    boucle();
    m.chaque(boucle, 7600);
    return m.arreter;
  }, []);
  const banniere = ph === 2 || ph === 3 ? { texte: 'Trop de toile : la voile lâche !', fond: '#ff5d5d' } : ph === 4 ? { texte: 'Voile repêchée !', fond: '#4cc38a' } : null;
  return (
    <>
      <Ecran label="Le vent forcit, le spi lâche, une carte réparation le sauve" vite={ph >= 1 && ph <= 3}>
        <Mer />
        <Souffle n={16} />
        <g transform="translate(190 176)">
          <g className="film-tangage">
            <path d="M-58 0 L60 0 L48 14 L-50 14 Z" fill={VIOLET} stroke="#fff" strokeWidth={1.5} />
            <line x1="0" y1="0" x2="0" y2="-104" stroke="#e6eef5" strokeWidth={3} />
            <path d="M-3 -100 L-3 -6 L-48 -6 Z" fill="#f4f7fb" />
            <g className={`film-spi ${ph === 1 ? 'tremble' : ''} ${ph === 2 || ph === 3 ? 'envol' : ''}`}>
              <path d="M4 -98 Q78 -70 62 -8 L6 -8 Z" fill={ORANGE} stroke="#ffd2a8" strokeWidth={1.5} />
            </g>
          </g>
        </g>
        <g className="film-vague"><path d="M0 186 Q25 180 50 186 T100 186 T150 186 T200 186 T250 186 T300 186 T350 186 T400 186 L400 240 L0 240 Z" fill="#2b6f9c" /></g>
        <rect x="290" y="12" width="98" height="26" rx="13" fill="#0b2236" stroke="#1f3d5a" />
        <text x="339" y="30" textAnchor="middle" fill="#e6eef5" fontSize="13" fontWeight="800"><tspan fill={ORANGE}>↓</tspan> {ph === 0 ? 'F4' : 'F6 !'}</text>
        {banniere && (
          <g className="film-apparait">
            <rect x="22" y="14" width="250" height="30" rx="10" fill={banniere.fond} />
            <text x="147" y="34" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{banniere.texte}</text>
          </g>
        )}
        <g className="film-carte-rep" style={{ transform: `translateX(${ph >= 3 ? 0 : 260}px)` }}>
          <rect x="296" y="70" width="88" height="110" rx="10" fill="#fff7e0" stroke="#ffb800" strokeWidth={2} />
          <text x="340" y="112" textAnchor="middle" fontSize="28">🔧</text>
          <text x="340" y="140" textAnchor="middle" fill="#2a1d00" fontSize="11" fontWeight="800">Carte</text>
          <text x="340" y="154" textAnchor="middle" fill="#2a1d00" fontSize="11" fontWeight="800">réparation</text>
        </g>
      </Ecran>
      <Phrase grand="Trop de vent pour ta voile ? Elle lâche !" petit="Tu avances moins. Une carte réparation peut la sauver." />
    </>
  );
}

// ---------- 7 · La roue du large ----------
const QUESTIONS_FILM = ['❓ De quelle couleur est le feu de tribord ?', '❓ Quel côté appelle-t-on « bâbord » ?'];
const CARTES_FILM = ['🐬 Banc de dauphins : bonne nouvelle !', '🌙 Une vraie nuit de sommeil : bonne nouvelle !', '💥 Choc contre un OFNI : avarie !'];

function SceneRoue() {
  const large = D.regles.de_du_large;
  const faceCarte = (v: number) => (large?.carte ?? [4, 5, 6]).includes(v);
  const faceQuestion = (v: number) => (large?.question ?? [2, 3]).includes(v);
  const [s, setS] = useState({ angle: 0, texte: '' });
  useEffect(() => {
    const m = minuteurs();
    let tours = 0;
    const lancer = () => {
      const v = 1 + Math.floor(Math.random() * 6);
      tours += 3;
      setS({ angle: tours * 360 + (v - 1) * 60 + 30, texte: '' });
      const texte = faceCarte(v) ? hasard(CARTES_FILM) : faceQuestion(v) ? hasard(QUESTIONS_FILM) : '😌 Rien : la mer te laisse tranquille.';
      m.plus(() => setS((x) => ({ ...x, texte })), 2300);
    };
    m.plus(lancer, 300);
    m.chaque(lancer, 5000);
    return m.arreter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const c = { x: 200, y: 116 }, r = 78;
  return (
    <>
      <Ecran label="La boussole du large : rien, une question ou une carte">
        <Mer />
        {[1, 2, 3, 4, 5, 6].map((v, k) => {
          const a0 = k * 60, a1 = a0 + 60, m = a0 + 30;
          const p = (a: number) => `${c.x + r * Math.sin(rad(a))} ${c.y - r * Math.cos(rad(a))}`;
          const coul = faceCarte(v) ? ORANGE : faceQuestion(v) ? CYAN : GRIS;
          return (
            <g key={v}>
              <path d={`M${c.x} ${c.y} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`} fill={coul} stroke="#04121f" strokeWidth={2} />
              <text x={c.x + 52 * Math.sin(rad(m))} y={c.y - 52 * Math.cos(rad(m)) + 6} textAnchor="middle" fill="#04121f" fontSize="17" fontWeight="800">{v}</text>
            </g>
          );
        })}
        <g className="film-aiguille" style={{ transform: `rotate(${s.angle}deg)` }}>
          <path d="M200 50 L208 116 L192 116 Z" fill="#fff" stroke="#04121f" strokeWidth={2} />
          <circle cx="200" cy="116" r="11" fill="#04121f" stroke="#fff" strokeWidth={2} />
        </g>
        {s.texte && (
          <g className="film-apparait">
            <rect x="30" y="200" width="340" height="32" rx="10" fill="#fff7e0" stroke="#ffb800" strokeWidth={2} />
            <text x="200" y="221" textAnchor="middle" fill="#2a1d00" fontSize="13.5" fontWeight="800">{s.texte}</text>
          </g>
        )}
      </Ecran>
      <Phrase grand="La roue du large : rien, une question… ou une carte !" petit="Mauvaise réponse ? Ta voile s'use un peu." />
    </>
  );
}

// ---------- 8 · Ça avance… gare aux fronts ! ----------
function SceneFronts() {
  return (
    <>
      <Ecran label="Les bateaux avancent, un front de gros vent traverse la carte">
        <Mer />
        <path d="M400 0 L400 90 Q380 86 366 70 Q352 58 336 56 Q330 34 338 0 Z" fill="#efe3c8" />
        <path d="M-10 70 Q120 40 260 70 T420 66" fill="none" stroke="#ff5d5d" strokeWidth={2.5} strokeDasharray="3 7" opacity={0.9} />
        <g>
          <animateMotion dur="9s" repeatCount="indefinite" path="M-40 70 Q120 40 260 70 T460 66" />
          <ellipse cx="0" cy="0" rx="56" ry="34" fill="#ff6e6e" opacity={0.35} />
          <ellipse cx="-10" cy="-4" rx="36" ry="22" fill="#ff6e6e" opacity={0.45} />
          <path d="M-4 -16 L-12 2 L-2 2 L-8 18 L8 -4 L-2 -4 L4 -16 Z" fill={JAUNE} />
          <text x="0" y="50" textAnchor="middle" fill="#ffb3b3" fontSize="12" fontWeight="800">front : gros vent</text>
        </g>
        <path id="film-r8a" d="M330 90 C 280 120, 220 150, 150 170" fill="none" stroke="#fff" strokeWidth={2} className="film-trace" opacity={0.6} />
        <path id="film-r8b" d="M322 110 C 270 140, 210 170, 140 196" fill="none" stroke="#fff" strokeWidth={2} className="film-trace" opacity={0.6} />
        <Suivre chemin="film-r8a" dur="4.5s" couleur={VIOLET} arret />
        <Suivre chemin="film-r8b" dur="4.5s" couleur={JAUNE} arret />
      </Ecran>
      <Phrase grand="Les bateaux avancent. Gare aux fronts !" petit="Un front, c'est du gros vent qui se déplace. Dans la tempête, le mât peut casser." />
    </>
  );
}

// ---------- 9 · L'arrivée ----------
function SceneArrivee() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const m = minuteurs();
    m.chaque(() => setCycle((x) => x + 1), 5200);
    return m.arreter;
  }, []);
  const confettis = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), coul: [JAUNE, CYAN, '#ff5d5d', '#4cc38a', VIOLET, ORANGE][i % 6], delai: 1.9 + Math.random() * 0.2 };
  }), [cycle]);
  return (
    <>
      <Ecran label="Le bateau coupe la ligne d'arrivée : confettis">
        <Mer />
        <line x1="118" y1="92" x2="292" y2="92" stroke="#fff" strokeWidth={2} strokeDasharray="6 6" />
        <circle cx="110" cy="92" r="11" fill={JAUNE} stroke="#fff" strokeWidth={2} />
        <g transform="translate(306 92)">
          <path d="M-14 -6 L16 -6 L12 6 L-12 6 Z" fill="#e6eef5" />
          <line x1="0" y1="-6" x2="0" y2="-30" stroke="#e6eef5" strokeWidth={2} />
          <path className="film-drapeau" d="M0 -30 L14 -26 L0 -22 Z" fill={CYAN} />
        </g>
        <g key={cycle}>
          <g className="film-arrive"><g transform="translate(205 0)"><Coque couleur={VIOLET} /></g></g>
          <g>
            {confettis.map((k, i) => (
              <rect key={i} className="film-confetti" x="203" y="88" width="6" height="9" fill={k.coul}
                style={{ '--dx': `${k.dx}px`, '--dy': `${k.dy}px`, animationDelay: `${k.delai.toFixed(2)}s` } as CSSProperties} />
            ))}
          </g>
          <text className="film-premier" x="205" y="60" textAnchor="middle" fill={JAUNE} fontSize="26" fontWeight="900">1er !</text>
        </g>
      </Ecran>
      <Phrase grand="Coupe la ligne le premier : gagné !" petit="La ligne est entre la bouée jaune et le bateau du comité." />
    </>
  );
}

const SCENES: { titre: string; frise?: number; Scene: () => JSX.Element }[] = [
  { titre: 'Le but', Scene: SceneBut },
  { titre: 'Le vent et le cap', Scene: SceneCap },
  { titre: 'Les voiles', Scene: SceneVoiles },
  { titre: 'Ton tour', frise: 0, Scene: SceneTour },
  { titre: 'Le vent change', frise: 1, Scene: SceneDes },
  { titre: 'Trop de vent ?', frise: 2, Scene: SceneTropDeVent },
  { titre: 'La roue du large', frise: 3, Scene: SceneRoue },
  { titre: 'Ça avance… gare aux fronts !', frise: 4, Scene: SceneFronts },
  { titre: "L'arrivée", Scene: SceneArrivee },
];

export default function Film() {
  const [n, setN] = useState(0);
  const { titre, frise, Scene } = SCENES[n];
  return (
    <div className="film">
      <div className={`film-frise ${frise === undefined ? 'vide' : ''}`} aria-hidden={frise === undefined}>
        {ETAPES_FRISE.map((e, i) => <span key={e.id} className={i === frise ? 'on' : ''}>{e.icone} {e.nom}</span>)}
      </div>
      <div className="lbl film-titre">{n + 1} · {titre}</div>
      <Scene key={n} />
      <div className="film-nav">
        <button className="btn btn-petit" onClick={() => setN(n - 1)} disabled={n === 0} aria-label="Scène précédente">◀</button>
        <div className="film-points">
          {SCENES.map((s, i) => <button key={s.titre} className={i === n ? 'on' : ''} onClick={() => setN(i)} aria-label={`Scène ${i + 1} : ${s.titre}`} />)}
        </div>
        {n < SCENES.length - 1
          ? <button className="btn btn-principal btn-petit" onClick={() => setN(n + 1)}>Suivant ▶</button>
          : <button className="btn btn-petit" onClick={() => setN(0)}>↺ Revoir</button>}
      </div>
    </div>
  );
}
