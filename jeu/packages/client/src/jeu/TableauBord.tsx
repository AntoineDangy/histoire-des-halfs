import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { alizeApres, alizeEn, dansAlize, frontSur, nomBeaufort, ventCourant } from '@cal/engine';
import { ANGLE_MIN, angleAllure, apercuCap, bateau, usureParTour, choisirIA, demiCapsPermis, NB_DIR, nomAllure, nomCap, NOMS_ALLURES, NOMS_DIR, NOMS_DIR_LONGS, norm, peutRecoudre, surCaseAbri, trajectoirePrevue } from '@cal/engine';
import type { Choix, EtatPartie } from '@cal/engine';
import { bateauDef, competenceDef, D, DE_LARGE, faces, RISQUES, skipper } from '../commun';
import { modeleDuBateau } from './scene3d';
import IconeVoile from './IconeVoile';
import type { RoseCarte } from './Carte';
import { voitTendance } from '@cal/engine';

export function Girouette({ direction, taille = 40, force }: { direction: number; taille?: number; force?: number }) {
  // La flèche pointe dans le sens où souffle le vent (elle vient de « direction »). L'angle est cumulé
  // pour que la girouette tourne toujours par le plus court chemin (pas de tour complet de N à NNO).
  const angle = useRef(direction * 22.5);
  const cible = direction * 22.5;
  const delta = ((cible - angle.current) % 360 + 540) % 360 - 180;
  angle.current += delta;
  // Filets de vent qui défilent : d'autant plus vite que le vent est fort.
  const duree = force === undefined ? 0 : Math.max(0.5, 2.6 - force * 0.22);
  return (
    <svg className="girouette-svg" width={taille} height={taille} viewBox="-20 -20 40 40" style={{ transform: `rotate(${angle.current}deg)` }} aria-hidden>
      {force !== undefined && force > 0 && (
        <g className="filets" style={{ animationDuration: `${duree}s` }}>
          {[-11, -5.5, 5.5, 11].map((x, i) => (
            <line key={x} x1={x} y1={-17 + (i % 2) * 4} x2={x} y2={15 - (i % 2) * 4} stroke="#7fd3ff" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="4 7" opacity={0.65} />
          ))}
        </g>
      )}
      <path d="M0 -15 L0 12" stroke="#ff9f43" strokeWidth="3" strokeLinecap="round" />
      <path d="M-6 6 L0 14 L6 6" fill="none" stroke="#ff9f43" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M-4 -15 L0 -10 L4 -15" fill="none" stroke="#ff9f43" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

/** Probabilité d'incident d'un niveau de risque (dé de risque à 6 faces), en %. */
export function pctRisque(niveau: number): number {
  return niveau >= 5 ? 100 : Math.round(((D.regles.seuil_risque[niveau] ?? 0) / 6) * 100);
}

export function PastilleRisque({ niveau, court = false, pct = false }: { niveau: number; court?: boolean; pct?: boolean }) {
  const r = RISQUES[niveau];
  return (
    <span className="risque" style={{ background: r.couleur, color: r.texte, border: niveau === 5 ? '1px solid #555' : undefined }} title={r.libelle}>
      {r.icone} {court ? '' : r.court}{pct && niveau > 0 && niveau < 5 ? ` · ${pctRisque(niveau)} %` : ''}
    </span>
  );
}

/** Jauge d'état d'une voile, sous son dessin (essai d'interface du 12/11/2026) : usure actuelle, puis ce que le tour va coûter. */
function JaugeVoile({ usure, ajout, perdue = false }: { usure: number; ajout: number; perdue?: boolean }) {
  const seuil = D.regles.usure?.seuil ?? 100;
  const u = perdue ? 100 : Math.min(100, (usure / seuil) * 100), a = perdue ? 0 : Math.min(100 - u, (ajout / seuil) * 100);
  const couleur = perdue || u + a >= 100 ? '#ff5d5d' : u + a >= 60 ? '#ffb347' : '#4cc38a';
  return (
    <span className="jauge-voile" title={perdue ? 'Voile perdue (réparable au port, ou à recoudre)' : `Usure ${Math.round(u)} % · après ce tour : ${Math.round(u + a)} % (à 100 %, la voile explose)`}>
      <span className="jauge-fond">
        <span style={{ width: `${u}%`, background: couleur }} />
        <span className="jauge-ajout" style={{ width: `${a}%`, background: couleur }} />
      </span>
      <span className="jauge-txt" style={{ color: couleur }}>{perdue ? 'perdue' : a >= 1 ? `${Math.round(u)} → ${Math.round(u + a)} %` : `${Math.round(u)} %`}</span>
    </span>
  );
}

/** Explication en clair pour la voile choisie : usure, dé du large, tempête. */
function ExplicationVoile({ nomVoile, usure, ajout, noir, quiz, reparations, force }: {
  nomVoile: string; usure: number; ajout: number; noir: boolean; quiz: boolean; reparations: number; force: number;
}) {
  const seuil = D.regles.usure?.seuil ?? 100;
  const perdue = usure + ajout >= seuil;
  const tours = ajout > 0 ? Math.max(1, Math.ceil((seuil - usure) / ajout)) : null;
  const tempete = D.regles.tempete?.[String(Math.min(11, force))];
  return (
    <div className="explication-risque" style={{ borderColor: noir || perdue ? '#ff5d5d' : 'var(--bord)' }}>
      <div className="titre-risque">
        <b>{nomVoile}</b>
        {noir ? <span className="effet dommage">Case noire</span> : <span className="muted">usure {Math.round((usure / seuil) * 100)} % · ce tour +{Math.round((ajout / seuil) * 100)} %</span>}
      </div>
      {noir ? (
        <p>Beaucoup trop de toile pour ce vent : la voile explose. En l'endurant, vous la perdez mais avancez de moitié ; avec une carte réparation, vous la gardez mais n'avancez pas. Réduisez la toile.</p>
      ) : perdue ? (
        <p><b>Cette voile est à bout : elle explosera à la fin de ce tour.</b> Changez de voile, ou acceptez de la perdre.</p>
      ) : ajout > 0 ? (
        <p>Chaque tour use la voile, d'autant plus vite que le vent est fort (spi et gennaker vite, solent moins, J3 très peu). Avec ce vent, elle tient encore environ <b>{tours} tour{tours! > 1 ? 's' : ''}</b>. À 100 %, elle explose.</p>
      ) : (
        <p>Cette voile ne s'use pas avec ce vent.</p>
      )}
      <div className="si-change">
        <b>Le dé du large, à chaque tour</b>
        <ul>
          {/* Faces lues dans la configuration (4-5-6 carte, 2-3 question, 1 rien depuis le 11/11/2026). */}
          <li>{faces(DE_LARGE.carte)} : une carte du large (bonne nouvelle ou avarie{reparations > 0 ? ` ; une carte réparation peut en limiter l'impact, il vous en reste ${reparations}` : ''}).</li>
          <li>{faces(DE_LARGE.question)} : {quiz ? `une question de culture marine ; mauvaise réponse = mauvaise manœuvre, la voile s'use de ${D.regles.usure?.mauvaise_reponse ?? 20} %.` : 'rien (questions désactivées).'}</li>
          <li>{faces(DE_LARGE.rien)} : rien.</li>
          {Array.isArray(tempete) && <li><b>Tempête (F{force})</b> : dé tempête en plus ; {tempete.join(', ')} = démâtage (ou chavirage d'un multicoque).</li>}
        </ul>
      </div>
    </div>
  );
}

/** Ce que le tableau de bord transmet à la carte : cap visé, distance retenue et poignée de réglage de la distance. */
export interface ApercuChoix {
  cap: number | null;
  distance: number;
  /** Distance maximale de la voile choisie (en cases), quand la distance se règle sur la carte. */
  max: number;
  /** Réglage de la distance depuis la carte (poignée sur la trajectoire) ; null si rien à régler. */
  choisir: ((d: number) => void) | null;
  /** Voile choisie (undefined : pas encore choisie) : montrée sur l'aperçu 3D du volet de droite. */
  voile?: string | null;
  /** Boussole : caps choisis d'une touche sur la couronne de la carte. */
  rose?: RoseCarte;
}

interface Props {
  etat: EtatPartie;
  bateauId: string;
  onApercu: (a: ApercuChoix) => void;
  onValider: (c: Choix) => void;
  /** Jeu à plusieurs sur le même écran : « À vous, … ». */
  entete?: string;
}

type LigneVoile = ReturnType<typeof apercuCap>['voiles'][number];

/** État d'une voile pour ce cap : utilisable ou non, et pourquoi. */
function etatVoile(b: ReturnType<typeof bateau>, v: LigneVoile, force: number) {
  const def = v.voile ? D.voiles.find((x) => x.id === v.voile)! : null;
  const perdue = v.voile !== null && b.voilesPerdues.includes(v.voile);
  const absente = v.voile !== null && !b.voiles.includes(v.voile) && !perdue;
  const tropFort = !absente && !perdue && v.distance !== null && v.risque >= 5;
  const raison = absente ? 'Laissée à quai' : perdue ? 'Voile perdue' : tropFort ? `Vent trop fort (force ${force}) : elle ne tiendrait pas` : v.distance === null ? v.details[0]?.libelle ?? 'Inutilisable à cette allure' : def?.detail ?? 'Obligé d\'aller au bout';
  const desactive = absente || perdue || v.distance === null || tropFort; // plus de « case noire » : voile interdite (11/11/2026)
  return { def, raison, desactive };
}

/** Abréviation française d'un des 16 caps (O pour Ouest) : N, NNE… OSO, O, ONO, NO, NNO. */
const capFr = (c: number) => NOMS_DIR[c].replace(/W/g, 'O');

/** Étoile de la boussole : 4 grandes branches (N, E, S, O) et 4 petites (NE, SE, SO, NO), une moitié claire, une sombre. */
function EtoileBoussole() {
  const branches: JSX.Element[] = [];
  const pt = (deg: number, r: number) => `${(Math.sin((deg * Math.PI) / 180) * r).toFixed(2)},${(-Math.cos((deg * Math.PI) / 180) * r).toFixed(2)}`;
  for (const [deg, long, large] of [[45, 60, 9], [135, 60, 9], [225, 60, 9], [315, 60, 9], [0, 96, 13], [90, 96, 13], [180, 96, 13], [270, 96, 13]] as const) {
    branches.push(
      <g key={deg}>
        <polygon points={`0,0 ${pt(deg, long)} ${pt(deg - 45, large)}`} fill="rgba(240,245,250,0.92)" stroke="rgba(10,25,40,0.9)" strokeWidth="0.8" />
        <polygon points={`0,0 ${pt(deg, long)} ${pt(deg + 45, large)}`} fill="rgba(10,25,40,0.92)" stroke="rgba(240,245,250,0.9)" strokeWidth="0.8" />
      </g>,
    );
  }
  return <>{branches}</>;
}

/**
 * Rose des caps posée sur la carte, centrée sur le bateau, dessinée comme une boussole (essai d'interface du 12/11/2026,
 * demande du porteur de projet) : seuls les caps possibles (au moins une voile utilisable) sont proposés à la touche.
 * Flèche orange : d'où vient le vent. Taille fixe ; presque invisible, elle ressort quand la souris passe dessus.
 */
function RoseCaps({ caps, cap, survol, vent, pret, onChoisir }: {
  caps: { cap: number; louvoyage: boolean; allure: string }[];
  cap: number | null;
  /** Cap sous la souris (aiguille pâle). */
  survol: number | null;
  vent: { direction: number };
  pret: boolean;
  onChoisir: (c: number) => void;
}) {
  const graduations = Array.from({ length: 64 }, (_, i) => i);
  return (
    <div className={`rose-carte ${cap !== null ? 'choisi' : ''} ${pret ? 'pret' : ''}`} role="group" aria-label="Rose des caps possibles">
      <svg className="boussole" viewBox="-100 -100 200 200" aria-hidden>
        <defs>
          <mask id="boussole-trou">
            <rect x="-100" y="-100" width="200" height="200" fill="#fff" />
            <circle r="13" fill="#000" />
          </mask>
        </defs>
        <g mask="url(#boussole-trou)">
          <circle r="98" fill="rgba(8,24,39,0.35)" stroke="rgba(240,245,250,0.85)" strokeWidth="1.2" />
          <circle r="88" fill="none" stroke="rgba(240,245,250,0.85)" strokeWidth="1.2" />
          <circle r="79" fill="none" stroke="rgba(240,245,250,0.6)" strokeWidth="0.8" strokeDasharray="1 2" />
          {graduations.map((i) => {
            const grand = i % 4 === 0;
            return <line key={i} x1="0" y1={-88} x2="0" y2={grand ? -82 : -85} stroke="rgba(240,245,250,0.85)" strokeWidth={grand ? 1.6 : 0.8} transform={`rotate(${i * 5.625})`} />;
          })}
          {Array.from({ length: 16 }, (_, i) => (
            <polygon key={i} points="0,-97 -3,-91 3,-91" fill="rgba(240,245,250,0.9)" transform={`rotate(${i * 22.5 + 11.25})`} />
          ))}
          <circle r="30" fill="none" stroke="rgba(240,245,250,0.6)" strokeWidth="0.8" strokeDasharray="2 3" />
          <g opacity="0.88"><EtoileBoussole /></g>
          {/* Caps possibles : un simple trait sur la couronne (boussole épurée, demande du 12/11/2026). */}
          {caps.map(({ cap: c }) => (
            <line key={`t${c}`} x1="0" y1={-89} x2="0" y2={Number.isInteger(c) ? -98 : -95} stroke="#f0f5fa"
              strokeWidth={Number.isInteger(c) ? 2.4 : 1.6} strokeLinecap="round" transform={`rotate(${c * 22.5})`} />
          ))}
          {survol !== null && survol !== cap && <line x1="0" y1="-14" x2="0" y2="-96" stroke="#3dd6f5" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" transform={`rotate(${survol * 22.5})`} />}
          {cap !== null && <line x1="0" y1="-14" x2="0" y2="-96" stroke="#3dd6f5" strokeWidth="4" strokeLinecap="round" transform={`rotate(${cap * 22.5})`} />}
        </g>
      </svg>
      <div className="rose-vent" style={{ transform: `rotate(${vent.direction * 22.5}deg)` }}>
        <svg width="20" height="28" viewBox="-10 0 20 28" aria-hidden>
          <path d="M0 2 L0 24" stroke="#ff9f43" strokeWidth="4" strokeLinecap="round" />
          <path d="M-7 15 L0 25 L7 15" fill="none" stroke="#ff9f43" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      {caps.map(({ cap: c, louvoyage, allure }) => {
        const rad = (c * 22.5 * Math.PI) / 180;
        const demi = !Number.isInteger(c);
        const sin = Math.sin(rad).toFixed(4), cos = (-Math.cos(rad)).toFixed(4);
        // Ni libellé ni pastille (demande du porteur de projet, 12/11/2026) : le cap se choisit d'une touche sur la couronne
        // (Carte.tsx, cap le plus proche). Ces boutons invisibles servent au clavier et aux lecteurs d'écran.
        return (
          <button
            key={c}
            className={`cap-carte ${demi ? 'demi' : c % 4 === 0 ? 'cardinal' : c % 2 ? 'secondaire' : ''} ${louvoyage ? 'louvoyage' : ''}`}
            style={{ left: `calc(${sin} * var(--r-rose))`, top: `calc(${cos} * var(--r-rose))` }}
            aria-pressed={cap === c}
            aria-label={demi ? `${nomCap(c, true)} (demi-cap)` : NOMS_DIR_LONGS[c]}
            title={`${demi ? nomCap(c, true) : NOMS_DIR_LONGS[c]} · ${louvoyage ? 'louvoyage face au vent' : allure}`}
            onClick={() => onChoisir(c)}
          >
          </button>
        );
      })}
    </div>
  );
}

export default function TableauBord({ etat, bateauId, onApercu, onValider, entete }: Props) {
  const b = bateau(etat, bateauId);
  // Vent qui souffle là où est le bateau (vent général, ou vent du front).
  const vent = ventCourant(etat, b.x, b.y);
  const front = frontSur(etat, b.x, b.y);
  const annonce = etat.fronts?.find((f) => f.annonce > 0);
  const dansLesAlizes = !front && dansAlize(etat, b.x, b.y);
  const [cap, setCap] = useState<number | null>(null);
  const [voileId, setVoileId] = useState<string | null | undefined>(undefined);
  // Voile choisie à la main par le joueur (sinon : voile conseillée par le routeur pour le cap, 13/11/2026).
  const [voileManuelle, setVoileManuelle] = useState(false);
  const [distanceMax, setDistanceMax] = useState<number | null>(null);
  // Destination visée d'une touche sur la carte (13/11/2026), en coordonnées de carte (centre d'une case à +0,5).
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [recoudre, setRecoudre] = useState<string | null>(null);
  const [infos, setInfos] = useState(false);
  const comp = competenceDef(b.competence);
  const classe = D.classes.find((c) => c.id === etat.params.classe);
  const bulletin = etat.params.options.bulletinMeteo && classe?.bulletin_meteo;
  const sansVoile = b.voiles.length === 0;

  useEffect(() => {
    setCap(null);
    setVoileId(undefined);
    setVoileManuelle(false);
    setDistanceMax(null);
    setDestination(null);
    setRecoudre(null);
  }, [bateauId, etat.tour]);

  const demiCaps = demiCapsPermis(D, etat, b);
  // Caps proposés sur la rose : ceux où au moins une voile est utilisable.
  const caps = useMemo(() => {
    const liste: number[] = Array.from({ length: NB_DIR }, (_, c) => c);
    if (demiCaps) for (let c = 0; c < NB_DIR; c++) liste.push(c + 0.5);
    return liste
      .filter((c) => apercuCap(D, etat, bateauId, c).voiles.some((v) => (v.voile !== null || sansVoile) && !etatVoile(b, v, vent.force).desactive))
      .map((c) => {
        const a = angleAllure(c, vent.direction);
        return { cap: c, louvoyage: a < ANGLE_MIN, allure: Number.isInteger(c) ? NOMS_ALLURES[a] : nomAllure(a) };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, bateauId, demiCaps]);

  const apercu = useMemo(() => (cap === null ? null : apercuCap(D, etat, bateauId, cap)), [etat, bateauId, cap]);
  const ligne = apercu && voileId !== undefined ? apercu.voiles.find((v) => v.voile === voileId) ?? null : null;
  let distance = ligne?.distance ?? 0;
  if (recoudre && distance) distance = Math.max(1, Math.floor(distance / 2));
  const distEffective = ligne && ligne.voile !== null && distanceMax ? Math.min(distanceMax, distance) : distance;
  const pret = cap !== null && voileId !== undefined && ligne !== null && ligne.distance !== null;
  const reglable = pret && ligne!.voile !== null && distance > 1;

  // Poignée de distance sur la carte : la valeur maximale de la voile revient à « Max ».
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  const choisirDistance = useCallback((d: number) => setDistanceMax(d >= distanceRef.current ? null : Math.max(1, Math.round(d))), []);


  const choisirCap = (c: number) => {
    setCap(c);
    setDistanceMax(null);
    const a = apercuCap(D, etat, bateauId, c);
    const utilisable = (v: string | null | undefined) =>
      v !== undefined && a.voiles.some((x) => x.voile === v && x.distance !== null && !etatVoile(b, x, vent.force).desactive);
    // Voile choisie à la main et encore utilisable : on la garde. Sinon, la voile que le routeur conseille pour ce cap
    // (13/11/2026, demande du porteur de projet) : la trajectoire et la distance apparaissent tout de suite, et le joueur
    // peut toujours changer de voile.
    if (voileManuelle && utilisable(voileId)) return;
    const conseil = choisirIA(D, structuredClone(etat), bateauId, { cap: c }).voile;
    setVoileManuelle(false);
    setVoileId(utilisable(conseil) ? conseil : undefined);
  };

  // Cap choisi sur la rose : la destination visée sur la carte est oubliée.
  const choisirCapRose = (c: number) => {
    setDestination(null);
    choisirCap(c);
  };

  // Destination visée d'une touche sur la carte (13/11/2026, demande du porteur de projet) : le cap proposé le plus proche
  // de la direction de la destination, puis (effet ci-dessous) la distance qui amène le plus près de la destination.
  const viser = (pt: [number, number]) => {
    const dx = pt[0] - (b.x + 0.5), dy = pt[1] - (b.y + 0.5);
    if (Math.hypot(dx, dy) < 0.5 || !caps.length) return;
    const ang = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    let meilleur = caps[0].cap, ecart = Infinity;
    for (const { cap: c } of caps) {
      const e = Math.abs(((c * (360 / NB_DIR) - ang + 540) % 360) - 180);
      if (e < ecart) { ecart = e; meilleur = c; }
    }
    setDestination(pt);
    choisirCap(meilleur);
  };
  useEffect(() => {
    if (!destination || !reglable || cap === null) return;
    let k = distance, dk = Infinity;
    for (let i = 1; i <= distance; i++) {
      const t = trajectoirePrevue(D, etat, bateauId, cap, i);
      const der = t.chemin[t.chemin.length - 1];
      const fin = t.sommets && t.sommets.length > 1 ? t.sommets[t.sommets.length - 1] : der ? [der[0] + 0.5, der[1] + 0.5] : null;
      if (!fin) continue;
      const dd = Math.hypot(fin[0] - destination[0], fin[1] - destination[1]);
      if (dd < dk - 0.01) { dk = dd; k = i; }
    }
    setDistanceMax(k >= distance ? null : k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, cap, voileId, distance, reglable]);

  // Boussole : la carte choisit le cap d'une touche sur la couronne (le plus proche) et montre le cap survolé.
  const [survolCap, setSurvolCap] = useState<number | null>(null);
  const choisirCapRef = useRef(choisirCapRose);
  choisirCapRef.current = choisirCapRose;
  const viserRef = useRef(viser);
  viserRef.current = viser;
  const roseCarte = useMemo<RoseCarte>(() => ({
    caps: caps.map((c) => c.cap),
    choisir: (c) => choisirCapRef.current(c),
    survoler: setSurvolCap,
    nom: (c) => {
      const x = caps.find((k) => k.cap === c);
      return `${Number.isInteger(c) ? NOMS_DIR_LONGS[c] : nomCap(c, true)}${x ? ` · ${x.louvoyage ? 'louvoyage face au vent' : x.allure}` : ''}`;
    },
    destination,
    viser: (pt) => viserRef.current(pt),
  }), [caps, destination]);

  useEffect(() => {
    onApercu({ cap, distance: distEffective, max: reglable ? distance : 0, choisir: reglable ? choisirDistance : null, voile: voileId, rose: roseCarte });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, distEffective, distance, reglable, voileId, roseCarte]);

  // La rose est posée sur la carte, autour du bateau (cible créée par Carte.tsx).
  const [cibleRose, setCibleRose] = useState<HTMLElement | null>(null);
  useEffect(() => setCibleRose(document.getElementById('rose-carte')), []);
  const [cibleMeteo, setCibleMeteo] = useState<HTMLElement | null>(null);
  useEffect(() => setCibleMeteo(document.getElementById('meteo-carte')), []);
  // La tendance n'est connue que d'un skipper météo, et elle reste une probabilité, pas une certitude.
  const tendanceTexte = !bulletin || !voitTendance(D, b) ? null : etat.tendance === 0 ? 'vent attendu stable' : `rotation attendue vers ${NOMS_DIR[norm(vent.direction + 2 * etat.tendance)]} (non certaine)`;
  const mpc = D.courses.find((c) => c.id === etat.params.courseId)?.milles_par_case ?? 1;
  const mn = (cases: number) => `${Math.round(cases * mpc)} mn`;
  const couleurSpi = skipper(b.skipperId).couleurs.spi;
  const modele = modeleDuBateau(b.famille, bateauDef(b.bateauId)?.modele_3d);
  const jauge = (v: string) => (b.voiles.includes(v) || b.voilesPerdues.includes(v)
    ? <JaugeVoile usure={b.usure?.[v] ?? 0} ajout={usureParTour(D, etat, v, vent.force, b.famille)} perdue={b.voilesPerdues.includes(v)} />
    : <span className="jauge-txt muted">à quai</span>);

  const meteo = (
        <div className="meteo-sur-carte" title={nomBeaufort(D, vent.force)}>
          <div className="girouette"><Girouette direction={vent.direction} force={vent.force} /></div>
          <div className="meteo-texte">
            <div className="meteo-vent">{NOMS_DIR[vent.direction]} · F{vent.force} <span className="muted">{nomBeaufort(D, vent.force).toLowerCase()}</span></div>
            {tendanceTexte && <div className="meteo-ligne">☁ {tendanceTexte}</div>}
            {comp.speciaux.voit_de_force && etat.desProchains && (() => {
              const az = dansLesAlizes ? alizeEn(etat, b.x, b.y) : null;
              const f = az
                ? alizeApres(az, 0, etat.desProchains.force).force
                : Math.max(D.regles.force_min, Math.min(D.regles.force_max, vent.force + etat.desProchains.force));
              return <div className="meteo-ligne heureux">🧭 vent attendu : F{f}</div>;
            })()}
            {etat.previsions && comp.speciaux.prevoit_force && (() => {
              const az = dansLesAlizes ? alizeEn(etat, b.x, b.y) : null;
              const pf = etat.previsions!.force;
              const f = az ? alizeApres(az, 0, pf).force : Math.max(D.regles.force_min, Math.min(D.regles.force_max, vent.force + pf));
              return <div className="meteo-ligne heureux">🧭 vent attendu : F{f} <span className="muted">(juste {Math.round(comp.speciaux.prevoit_force! * 100)} % du temps)</span></div>;
            })()}
            {etat.previsions && comp.speciaux.prevoit_direction && (() => {
              const az = dansLesAlizes ? alizeEn(etat, b.x, b.y) : null;
              const pd = etat.previsions!.direction;
              const dir = az ? alizeApres(az, pd, 0).direction : norm(vent.direction + pd);
              return <div className="meteo-ligne heureux">☁ vent attendu : {NOMS_DIR[dir]} <span className="muted">(juste {Math.round(comp.speciaux.prevoit_direction! * 100)} % du temps)</span></div>;
            })()}
          </div>
        </div>
  );

  // Alertes météo (front, alizés, bulletin) : une ligne courte sous la météo, le texte complet en la touchant.
  const alertes = (
    <>
      {front && (
        <details className={`alerte-carte ${front.zone}`}>
          <summary>{front.front.type === 'anticyclone' ? '🔵 Dans l\'anticyclone' : front.front.type === 'molle' ? '🌫 Dans la molle' : front.zone === 'front' ? '⛈ Dans le front' : '🌤 Dans la traîne'}</summary>
          {front.front.type === 'anticyclone'
            ? `Vous êtes dans ${front.front.nom ? `l'${front.front.nom.charAt(0).toLowerCase()}${front.front.nom.slice(1)}` : "l'anticyclone"} : vent faible au centre, qui tourne autour dans le sens ${front.front.hemisphere === 'S' ? "inverse des aiguilles d'une montre (hémisphère sud)" : "des aiguilles d'une montre"} (ici ${NOMS_DIR_LONGS[vent.direction]} F${vent.force}). Contournez-le !`
            : front.front.type === 'molle'
            ? `Vous êtes dans la molle : vent faible (F${vent.force}) et instable. Patience… ou cherchez à en sortir !`
            : front.zone === 'front'
            ? `Vous êtes dans le front : vent de secteur ${NOMS_DIR_LONGS[front.front.direction]} force ${front.front.force}. Réduisez la toile… ou attaquez !`
            : `Vous êtes dans la traîne du front : le vent a basculé au ${NOMS_DIR_LONGS[vent.direction]}, force ${vent.force}.`}
        </details>
      )}
      {dansLesAlizes && (() => {
        // Zones de vent régulier (12/11/2026) : alizés, et sur les tours du monde vents d'ouest, anticyclone…
        const az = alizeEn(etat, b.x, b.y);
        const alizes = !az?.nom || /^Alizés/.test(az.nom);
        return (
          <details className="alerte-carte alize">
            <summary>🌬 {alizes ? 'Dans les alizés' : az!.nom}</summary>
            {alizes ? 'Vous êtes dans les alizés' : `Vous êtes dans la zone « ${az!.nom} »`} : ici {NOMS_DIR_LONGS[vent.direction]} F{vent.force}. Les dés le font tourner, sans sortir de sa plage ({az ? `${NOMS_DIR_LONGS[az.directions[0]]} à ${NOMS_DIR_LONGS[az.directions[1]]}, force ${az.forces[0]} à ${az.forces[1]}` : ''}). {!alizes ? '' : (az?.directions[1] ?? 0) >= 8 ? 'Caps Ouest, Nord-Ouest et Nord favorisés' : 'Caps Sud, Sud-Ouest et Ouest favorisés'}
            {' '}(+1 point, environ +75 milles par tour).
          </details>
        );
      })()}
      {!front && annonce && (
        <details className="alerte-carte annonce">
          <summary>📡 Front dans {annonce.annonce} tour{annonce.annonce > 1 ? 's' : ''}</summary>
          Bulletin : un front arrive dans {annonce.annonce} tour{annonce.annonce > 1 ? 's' : ''} (vent de secteur {NOMS_DIR_LONGS[annonce.direction]} F{annonce.force}, puis bascule au {NOMS_DIR_LONGS[norm(annonce.direction + annonce.bascule)]}). Sa trajectoire est en pointillés sur la carte : l'éviter, l'attaquer, vous abriter ou jouer la bascule ?
        </details>
      )}
    </>
  );

  const capTexte = cap === null
    ? 'Choisissez un cap sur la rose, ou touchez la mer pour viser une destination'
    : angleAllure(cap, vent.direction) < ANGLE_MIN
    ? `Cap ${Number.isInteger(cap) ? capFr(cap) : nomCap(cap).replace(/W/g, 'O')} · louvoyage face au vent (${Math.round((D.regles.louvoyage?.coefficient ?? 0.6) * 100)} % de la distance au près)`
    : `Cap ${Number.isInteger(cap) ? capFr(cap) : nomCap(cap).replace(/W/g, 'O')} · ${nomAllure(angleAllure(cap, vent.direction))} ${String(angleAllure(cap, vent.direction)).replace('.', ',')}°`;

  const routeur = () => {
    const c = choisirIA(D, structuredClone(etat), bateauId, { utilisableMaintenant: true });
    if (c.cap !== null) {
      setCap(c.cap);
      setVoileId(c.voile);
      setVoileManuelle(false);
      setDistanceMax(null);
      setDestination(null);
    }
  };

  const barre = (
    <div className="barre-commandes" role="group" aria-label="Commandes du bateau">
      {infos && apercu && (
        <div className="panneau details-voile">
          <div className="muted legende-risque">
            La barre sous chaque voile donne son usure : en clair, ce que le tour va lui coûter avec le vent actuel. À 100 %, la voile explose.
          </div>
          {ligne && ligne.distance !== null ? (
            <ExplicationVoile
              nomVoile={ligne.voile ? D.voiles.find((x) => x.id === ligne.voile)?.nom_court ?? '' : 'À sec de toile'}
              usure={ligne.voile ? b.usure?.[ligne.voile] ?? 0 : 0}
              ajout={usureParTour(D, etat, ligne.voile, vent.force, b.famille)}
              noir={ligne.risque >= 5}
              quiz={!!etat.params.options.quiz}
              reparations={b.reparations}
              force={vent.force}
            />
          ) : <div className="muted">Choisissez une voile pour voir son explication.</div>}
          {ligne && (
            <details className="details">
              <summary>Détails du calcul</summary>
              <ul>
                {ligne.details.map((d, i) => (
                  <li key={i}>{d.libelle} : {d.valeur > 0 && i > 0 && !d.libelle.startsWith('Total') ? '+' : ''}{d.valeur}</li>
                ))}
                {ligne.detailsRisque.map((d, i) => (
                  <li key={`r${i}`}>Risque · {d.libelle} : {d.valeur > 0 && i > 0 ? '+' : ''}{d.valeur}</li>
                ))}
                {ligne.risque > 0 && ligne.risque < 5 && (
                  <li>Probabilité d'un incident avec ce vent : {Math.round((D.regles.seuil_risque[ligne.risque] / 6) * 100)} %</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
      <div className="barre-tete">
        {entete && <span className="lbl">{entete}</span>}
        <span className="cap-texte">{capTexte}</span>
        {pret && <b className="gros">{mn(distEffective)}</b>}
        <button className="lien-discret" title="Propose le cap et la voile que choisirait un routeur (l'IA de niveau moyen)" onClick={routeur}>
          💡 routeur
        </button>
        {apercu && (
          <button className="btn btn-petit" aria-expanded={infos} onClick={() => setInfos((x) => !x)} title="Usure, dé du large, détails du calcul">
            ⓘ {infos ? 'Masquer' : 'Détails'}
          </button>
        )}
      </div>
      <div className="barre-ligne">
        <div className="boutons-voiles">
          {!apercu && D.regles.voiles_depart.filter((v) => b.voiles.includes(v)).map((v) => {
            const def = D.voiles.find((x) => x.id === v)!;
            return (
              <button key={v} className="bouton-voile" disabled title="Choisissez d'abord un cap">
                <IconeVoile forme={def.forme_3d ?? null} modele={modele} ris={v === 'reduite'} spi={couleurSpi} />
                {jauge(v)}
                <span className="n">{def.nom_court}</span>
                <span className="d">—</span>
              </button>
            );
          })}
          {apercu && apercu.voiles.map((v) => {
            if (v.voile === null && !sansVoile) return null;
            const { def, raison, desactive } = etatVoile(b, v, vent.force);
            return (
              <button key={v.voile ?? 'sec'} className="bouton-voile" aria-pressed={voileId === v.voile} disabled={desactive} onClick={() => { setVoileId(v.voile); setVoileManuelle(true); }}
                title={`${def ? def.nom : 'À sec de toile'} : ${raison}${!desactive && v.risque > 0 && v.risque < 5 ? ` · risque d'incident ${pctRisque(v.risque)} %` : ''}`}>
                <IconeVoile forme={def ? def.forme_3d ?? 'j2' : null} modele={modele} ris={v.voile === 'reduite'} spi={couleurSpi} />
                {v.voile && jauge(v.voile)}
                <span className="n">{def ? def.nom_court : 'À sec'}</span>
                <span className="d">{desactive ? '—' : mn(v.distance!)}{!desactive && v.risque > 0 && v.risque < 5 && <> <PastilleRisque niveau={v.risque} court /></>}</span>
                {desactive && <span className="s">{raison.length > 22 ? `${raison.slice(0, 20)}…` : raison}</span>}
              </button>
            );
          })}
        </div>
        {reglable && (
          <div className="stepper reglage-distance" title="Distance maximale : réglable aussi en faisant glisser la poignée au bout de la trajectoire, sur la carte">
            <button className="btn" aria-label="Moins" onClick={() => setDistanceMax(Math.max(1, (distanceMax ?? distance) - 1))}>−</button>
            <b>{distanceMax && distanceMax < distance ? mn(distanceMax) : `Max ${mn(distance)}`}</b>
            <button className="btn" aria-label="Plus" onClick={() => setDistanceMax(distanceMax && distanceMax + 1 < distance ? distanceMax + 1 : null)}>+</button>
          </div>
        )}
        {peutRecoudre(D, etat, b) && (
          <button className="btn btn-petit" aria-pressed={!!recoudre} onClick={() => setRecoudre(recoudre ? null : b.voilesPerdues[0])} title="Recoudre la voile perdue : le bateau n'avance que de la moitié de la distance">
            ✂ {recoudre ? '✓ ' : ''}Recoudre {D.voiles.find((v) => v.id === b.voilesPerdues[0])?.nom_court} (mi-distance)
          </button>
        )}
        {surCaseAbri(D, etat, b) && vent.force >= 6 && (
          <button className="btn btn-petit" onClick={() => onValider({ cap: null, voile: null, distanceMax: null })}>
            ⛱ Rester à l'abri
          </button>
        )}
        <button
          className="btn btn-principal bouton-valider"
          disabled={!pret}
          onClick={() => onValider({ cap, voile: voileId ?? null, distanceMax: ligne?.voile !== null ? distanceMax : null, ...(recoudre ? { recoudre } : {}) })}
        >
          Valider
        </button>
      </div>
    </div>
  );

  const rose = <RoseCaps caps={caps} cap={cap} survol={survolCap} vent={vent} pret={pret} onChoisir={choisirCapRose} />;

  return (
    <>
      {/* Météo actuelle posée sur la carte (12/11/2026, demande du porteur de projet : plus facile à voir et à comprendre). */}
      {cibleMeteo ? createPortal(<>{meteo}{alertes}</>, cibleMeteo) : <>{meteo}{alertes}</>}
      {cibleRose && createPortal(rose, cibleRose)}
      {barre}
    </>
  );
}
