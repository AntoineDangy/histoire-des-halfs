import { useEffect, useMemo, useRef, useState } from 'react';
import { calculerDistance, calculerRisque, compilerCarte, navigable, nomBeaufort, zonesCase } from '@cal/engine';
import { bateauDef, D, familleDef, nomClasse, RISQUES } from '../commun';
import { AllureKey, chargerModeles, Forme, modelesAcharger, modeleDuBateau, Scene3D } from '../jeu/scene3d';
import { nomsVoiles, planDe } from '../jeu/voilure';
import { BEAUFORT, texteVent, voilureBeaufort } from '../jeu/beaufort';
import PlanVoilure from '../jeu/PlanVoilure';

/**
 * Le hangar : l'endroit où se prépare la tactique. Pour chaque classe, la flotte en 2D, les choix d'architecture
 * de chaque bateau, sa vitesse et son risque selon l'allure et la force du vent (calculés par le moteur du jeu),
 * la comparaison avec un autre bateau et des conseils tactiques.
 */

const ALLURES: { angle: number; cap: number; nom: string }[] = [
  { angle: 45, cap: 2, nom: 'Près (45°)' },
  { angle: 90, cap: 4, nom: 'Travers (90°)' },
  { angle: 135, cap: 6, nom: 'Largue (135°)' },
  { angle: 180, cap: 8, nom: 'Vent arrière (180°)' },
];
const FORCES = [2, 4, 6, 8];

const carte = compilerCarte(D.courses[0]);
const MPC = D.courses[0].milles_par_case ?? 1;
/** Une case de pleine mer, sans zone particulière (alizés, courant…), pour des calculs « toutes choses égales ». */
const PLEINE_MER = (() => {
  for (let y = 10; y < carte.H; y++) for (let x = 10; x < carte.L; x++) if (navigable(carte, x, y) && zonesCase(carte, x, y).length === 0) return { x, y };
  return { x: 40, y: 30 };
})();

type Profil = { competence: string; famille: string; x: number; y: number; modificateurs: []; derniereVoile: null };
function profil(famille: string): Profil {
  return { competence: 'aucune', famille, x: PLEINE_MER.x, y: PLEINE_MER.y, modificateurs: [], derniereVoile: null };
}

/** Meilleure voile (la plus rapide, puis la moins risquée) pour une allure et une force, et sa distance en milles. */
function meilleure(famille: string, voiles: string[], cap: number, force: number) {
  let best: { voile: string; mn: number; risque: number } | null = null;
  for (const v of voiles) {
    const vent = { direction: 0, force };
    const dist = calculerDistance(D, carte, profil(famille), v, cap, vent).distance;
    if (dist === null) continue;
    const risque = calculerRisque(D, carte, profil(famille), v, vent).risque;
    const mn = Math.round(dist * MPC);
    if (risque >= 5) continue;
    if (!best || mn > best.mn || (mn === best.mn && risque < best.risque)) best = { voile: v, mn, risque };
  }
  return best;
}

function nomVoile(id: string) {
  return D.voiles.find((v) => v.id === id)?.nom_court ?? id;
}

/** Dessin du bateau vu du dessus, étrave vers le haut, selon sa famille d'architecture. */
export function Silhouette({ famille, coque, bandes, numero, taille = 120, goelette = false }: { famille: string; coque: string; bandes: string; numero?: string; taille?: number; goelette?: boolean }) {
  const f = familleDef(famille);
  const tri = f.multicoque ?? (f.classe === 'ULTIM' || f.classe === 'OCEAN_FIFTY');
  const foils = famille === 'imoca_foiler' || famille === 'ultim';
  const class40 = f.classe === 'CLASS40';
  const pont = coque === '#1f2a36' ? '#2b3a4a' : '#e9edf2';
  return (
    <svg viewBox="-60 -100 120 200" width={taille * 0.6} height={taille} aria-label={`Silhouette : ${f.nom}`}>
      {tri ? (
        <>
          {/* bras de liaison */}
          <rect x="-52" y={f.classe === 'ULTIM' ? -18 : -12} width="104" height="7" rx="3" fill={bandes} opacity="0.85" />
          <rect x="-52" y={f.classe === 'ULTIM' ? 22 : 18} width="104" height="6" rx="3" fill={bandes} opacity="0.85" />
          {/* flotteurs */}
          {[-46, 46].map((x) => (
            <path key={x} d={`M${x} -62 Q${x + 6} -40 ${x + 5} 40 L${x - 5} 40 Q${x - 6} -40 ${x} -62 Z`} fill={coque} stroke="#9fb3c8" strokeWidth="1" />
          ))}
          {/* coque centrale */}
          <path d="M0 -92 Q12 -50 10 70 L-10 70 Q-12 -50 0 -92 Z" fill={coque} stroke="#9fb3c8" strokeWidth="1.2" />
          <path d="M0 -60 L0 50" stroke={bandes} strokeWidth="3" />
          {foils && [-46, 46].map((x) => <path key={`f${x}`} d={`M${x} 0 L${x + (x > 0 ? 12 : -12)} 6`} stroke="#ffd166" strokeWidth="3" strokeLinecap="round" />)}
        </>
      ) : (
        <>
          {/* monocoque : étrave fine (IMOCA) ou ronde de « scow » (Class40) */}
          <path
            d={class40 ? 'M-20 -70 Q0 -84 20 -70 Q28 -20 26 80 L-26 80 Q-28 -20 -20 -70 Z' : 'M0 -92 Q26 -50 28 20 L26 82 L-26 82 L-28 20 Q-26 -50 0 -92 Z'}
            fill={coque}
            stroke="#9fb3c8"
            strokeWidth="1.2"
          />
          <path d={class40 ? 'M-14 -50 L14 -50 L16 60 L-16 60 Z' : 'M0 -60 L16 0 L16 60 L-16 60 L-16 0 Z'} fill={pont} opacity="0.35" />
          <path d="M-24 40 L24 40" stroke={bandes} strokeWidth="4" />
          {foils && [-1, 1].map((s) => <path key={s} d={`M${s * 27} 0 Q${s * 46} 4 ${s * 50} 16`} fill="none" stroke="#ffd166" strokeWidth="4" strokeLinecap="round" />)}
          {(famille === 'imoca_derives' || famille === 'vintage_monocoque') && [-1, 1].map((s) => <path key={s} d={`M${s * 27} 4 L${s * 33} 6`} stroke="#9fb3c8" strokeWidth="3" strokeLinecap="round" />)}
          {class40 && [-1, 1].map((s) => <path key={s} d={`M${s * 16} 80 L${s * 16} 92`} stroke="#9fb3c8" strokeWidth="3" />)}
        </>
      )}
      {/* mât (goélette : mât de misaine à l'avant et grand mât) */}
      {goelette ? [-34, 22].map((y) => <circle key={y} cx="0" cy={y} r="4" fill="#cfd8e3" />) : <circle cx="0" cy={tri ? 0 : -6} r="4" fill="#cfd8e3" />}
      {numero && <text x="0" y={tri ? 58 : 66} textAnchor="middle" fontSize="11" fontWeight="700" fill={coque === '#1f2a36' ? '#e6eef5' : '#1f2a36'}>{numero}</text>}
    </svg>
  );
}

/**
 * Le bateau en 3D dans le hangar, avec SON échelle de Beaufort (demande du porteur de projet, 10/11/2026) : au curseur,
 * la mer grossit, le ciel se charge de nuages, le bateau réduit sa toile, jusqu'au démâtage et au naufrage (monocoque) ou
 * au chavirage (multicoque). On tourne autour à la souris (ou au doigt), on zoome à la molette ; on peut aussi choisir
 * une autre allure et une autre voile que celles de la table.
 */
/** Vitesse de chaque type par rapport à la table de Beaufort de sa famille (monocoques : celle de l'IMOCA à foils). */
const VITESSE_RELATIVE: Record<string, number> = { imoca: 1, imoca_derives: 0.85, class40: 0.7, ultim: 1.3, ultim_ancien: 1.15, ocean_fifty: 1 };

function Vue3D({ nom, coque, bandes, spi, numero, modele, classe }: { nom: string; coque: string; bandes: string; spi: string; numero: string; modele: string; classe: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [force, setForce] = useState(4);
  const [choix, setChoix] = useState<{ allure: AllureKey; forme: Forme } | null>(null);
  const [modelesPrets, setModelesPrets] = useState(false);
  useEffect(() => {
    setModelesPrets(false);
    chargerModeles(modelesAcharger([modele])).then(() => setModelesPrets(true));
  }, [modele]);
  useEffect(() => setChoix(null), [force, modele]);
  const dispo = useMemo(() => Scene3D.disponible(), []);
  useEffect(() => {
    if (!dispo || !wrap.current || !labels.current) return;
    let s: Scene3D;
    try {
      s = new Scene3D(wrap.current, labels.current);
    } catch {
      return;
    }
    scene.current = s;
    return () => s.detruire();
  }, [dispo]);
  const v = voilureBeaufort(modele)[force];
  const fb = BEAUFORT[force];
  const allure = choix?.allure ?? v.allure;
  const forme = choix?.forme ?? v.forme;
  const vitesse = v.vitesse * (VITESSE_RELATIVE[modele] ?? (classe === 'VINTAGE' ? 0.7 : 1));
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.afficher([{
      nom, moi: true, coque, bandes, spi, numero, allure, forme, cote: 1, off: [0, 0], vitesse, modele, classe,
      ris: v.ris, sansVoileAvant: choix ? false : v.sansVoile, etat: v.etat,
    }], force);
    s.demarrer();
  }, [nom, coque, bandes, spi, numero, allure, forme, modele, classe, force, choix, modelesPrets]);
  const noms = nomsVoiles(modele);
  return (
    <div className="beaufort">
      {dispo ? (
        <div className="hangar-3d">
          <div ref={wrap} className="scene" />
          <div ref={labels} className="etiquettes" />
        </div>
      ) : <div className="muted" style={{ padding: 12 }}>Vue 3D indisponible sur cet appareil (accélération graphique désactivée).</div>}
      <div className="hangar-3d-commandes">
            <label className="champ" style={{ minWidth: 220, flex: 1 }}>
              <span className="lbl">🌬️ Échelle de Beaufort · force {force} : {fb.terme}</span>
              <input type="range" min={0} max={12} step={1} value={force} onChange={(e) => setForce(Number(e.target.value))} aria-label="Force du vent (échelle de Beaufort)" />
            </label>
            <div className="segment">
              {([['pres', 'Près'], ['travers', 'Travers'], ['largue', 'Largue'], ['arriere', 'Vent arrière']] as [AllureKey, string][]).map(([k, t]) => (
                <button key={k} disabled={!!v.etat} aria-pressed={allure === k} onClick={() => setChoix({ allure: k, forme })}>{t}</button>
              ))}
            </div>
            <div className="segment">
              {(['tourmentin', 'j3', 'j2', 'fro', 'a3', 'a2', 'sgt'] as Forme[]).filter((k) => k !== 'sgt' || planDe(modele).voiles.sgt > 0).map((k) => (
                <button key={k} disabled={!!v.etat} aria-pressed={!v.sansVoile || choix ? forme === k : false} onClick={() => setChoix({ allure, forme: k })}>{noms[k].replace(' (J2)', '')}</button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Faites glisser la vue pour tourner autour, molette pour zoomer.</span>
      </div>
      <table className="tableau-info" style={{ marginTop: 6 }}>
        <tbody>
          <tr><th>Vent</th><td>{texteVent(fb)}</td></tr>
          <tr><th>Vagues</th><td>{fb.vague} m (hauteur probable)</td></tr>
          <tr><th>La mer</th><td>{fb.mer}</td></tr>
          <tr><th>Le ciel</th><td>{fb.ciel}</td></tr>
          {fb.avis && <tr><th>Météo</th><td>{fb.avis}</td></tr>}
          <tr><th>À bord</th><td>{choix ? `Votre choix : ${noms[forme]}, ${({ pres: 'au près', travers: 'au travers', largue: 'au largue', arriere: 'au vent arrière' } as Record<AllureKey, string>)[allure]}. Conseillé : ${v.texte}` : v.texte}</td></tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 11.5, margin: '4px 0 0' }}>
        Sources : Met Office (vents, vagues, état de la mer) ; Environnement et Changement climatique Canada (termes) ;
        seuils des avis de Météo-France. Voilure et vitesses indicatives.
      </p>
    </div>
  );
}

function Pastille({ niveau }: { niveau: number }) {
  const r = RISQUES[niveau];
  return <span className="risque" style={{ background: r.couleur, color: r.texte }} title={r.libelle}>{r.icone} {r.court}</span>;
}

/** Conseils tactiques déduits des effets de la famille d'architecture. */
function conseils(famille: string): string[] {
  const f = familleDef(famille);
  const out: string[] = [];
  for (const e of f.effets) {
    const si = e.si ?? {};
    const quand = [
      si.allures ? `au ${si.allures.map((a: number) => (a === 45 ? 'près' : a === 90 ? 'travers' : a === 135 ? 'largue' : 'vent arrière')).join(' et au ')}` : '',
      si.force_min ? `dès force ${si.force_min}` : '',
    ].filter(Boolean).join(', ');
    if (e.type === 'distance' && e.valeur > 0) out.push(`Point fort ${quand} : cherchez les routes qui vous y placent.`);
    if (e.type === 'distance' && e.valeur < 0) out.push(`Point faible ${quand} : évitez de passer de longs bords dans ces conditions.`);
    if (e.type === 'risque' && e.valeur > 0) out.push(`Plus fragile ${quand} : réduisez la toile un cran plus tôt que vos adversaires.`);
    if (e.type === 'risque' && e.valeur < 0) out.push(`Plus robuste ${quand} : vous pouvez garder plus de toile quand les autres réduisent.`);
  }
  if (f.profil_allure?.['180'] && f.profil_allure['180'] < 0) out.push('Lent au plein vent arrière : au portant, tirez des bords de largue plutôt que de viser droit.');
  if (f.multicoque ?? (f.classe === 'ULTIM' || f.classe === 'OCEAN_FIFTY')) out.push('Multicoque : trop de toile ou une tempête, c\'est le chavirage, et la fin de course.');
  return out;
}

/**
 * Les types de bateaux du hangar : un par famille d'architecture (décision du 10/11/2026), puis la classe Vintage en
 * deux familles, monocoques et multicoques (décision du 10/11/2026). Chaque bateau de légende aura son modèle 3D :
 * Pen Duick III est le premier.
 */
const TYPES: { famille: string; titre: string; vintage?: boolean }[] = [
  { famille: 'imoca_foiler', titre: 'IMOCA à foils' },
  { famille: 'imoca_derives', titre: 'IMOCA à dérives droites' },
  { famille: 'class40', titre: 'Class40' },
  { famille: 'ocean_fifty', titre: 'Ocean Fifty' },
  { famille: 'ultim', titre: 'Ultim volant' },
  { famille: 'ultim_ancien', titre: 'Ultim ancienne génération' },
  { famille: 'vintage_monocoque', titre: 'Monocoques de légende', vintage: true },
  { famille: 'vintage_multicoque', titre: 'Multicoques de légende', vintage: true },
].filter((t) => D.familles.some((f) => f.id === t.famille) && D.skippers.some((s) => bateauDef(s.bateau_id).famille === t.famille));

/** Un skipper qui court sur un bateau de cette famille (de préférence un bateau qui a son propre modèle 3D) : il sert d'exemple. */
function exemple(famille: string) {
  const liste = D.skippers.filter((s) => bateauDef(s.bateau_id).famille === famille);
  return liste.find((s) => bateauDef(s.bateau_id).modele_3d) ?? liste[0] ?? D.skippers[0];
}

export default function Hangar({ onRetour }: { onRetour: () => void }) {
  const [famille, setFamille] = useState(TYPES[0].famille);
  const [compare, setCompare] = useState<string>('');
  const [vu, setVu] = useState<string>(''); // skipper dont le bateau est montré en 3D
  const f = familleDef(famille);
  const bateaux = D.skippers.filter((s) => bateauDef(s.bateau_id).famille === famille);
  const sk = bateaux.find((s) => s.id === vu) ?? exemple(famille);
  const bt = bateauDef(sk.bateau_id);
  const modele = modeleDuBateau(famille, bt.modele_3d);
  const provisoire = f.classe === 'VINTAGE' && !bt.modele_3d;
  const voiles = D.regles.voiles_depart;
  const titre = (fam: string) => TYPES.find((t) => t.famille === fam)?.titre ?? familleDef(fam).nom;

  const tableau = useMemo(
    () => ALLURES.map((a) => FORCES.map((force) => ({
      moi: meilleure(famille, voiles, a.cap, force),
      lui: compare ? meilleure(compare, voiles, a.cap, force) : null,
    }))),
    [famille, compare, voiles],
  );

  return (
    <div className="ecran hangar">
      <div className="contenu">
        <div className="lbl">Ton hangar à bateaux · préparer sa tactique</div>
        <h1>Les types de bateaux de la Route du Rhum</h1>

        <div className="hangar-grille">
          <div className="hangar-flotte">
            {TYPES.map((t, i) => {
              const e = exemple(t.famille);
              return (
                <div key={t.famille} style={{ display: 'contents' }}>
                  {t.vintage && !TYPES[i - 1]?.vintage && <div className="lbl" style={{ marginTop: 8 }}>⚓ Vintage · bateaux de légende</div>}
                  <button className="hangar-carte" aria-pressed={t.famille === famille} onClick={() => { setFamille(t.famille); setCompare(''); setVu(''); }}>
                    <Silhouette famille={t.famille} coque={e.couleurs.coque} bandes={e.couleurs.bandes} taille={70} />
                    <span>
                      <b>{t.titre}</b>
                      <span className="muted">{nomClasse(familleDef(t.famille).classe)}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hangar-fiche panneau">
            <Vue3D nom={f.classe === 'VINTAGE' ? bt.nom : titre(famille)} coque={sk.couleurs.coque} bandes={sk.couleurs.bandes} spi={sk.couleurs.spi} numero={sk.numero_voile} modele={modele} classe={f.classe} />
            {provisoire && <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>Modèle 3D provisoire (celui d'un type moderne proche) : chaque bateau de légende aura son propre modèle, comme Pen Duick III.</p>}
            <div className="hangar-entete">
              <Silhouette famille={famille} coque={sk.couleurs.coque} bandes={sk.couleurs.bandes} numero={sk.numero_voile} taille={200} goelette={modele === 'pen_duick_3'} />
              <div>
                <h2 style={{ margin: 0 }}>{titre(famille)}</h2>
                <p className="muted" style={{ margin: '4px 0' }}>{nomClasse(f.classe)} · {D.classes.find((c) => c.id === f.classe)?.longueur}</p>
                <div className="hangar-choix">
                  <div className="effet heureux">▲ {f.bonus}</div>
                  <div className="effet dommage">▼ {f.malus}</div>
                  {f.profil_note && <div className="muted" style={{ fontSize: 12.5 }}>{f.profil_note}</div>}
                </div>
                <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 4px' }}>Dans le jeu (cliquez pour voir le bateau) :</p>
                <div className="segment" style={{ flexWrap: 'wrap' }}>
                  {bateaux.map((s) => (
                    <button key={s.id} aria-pressed={s.id === sk.id} onClick={() => setVu(s.id)} title={`${bateauDef(s.bateau_id).nom}, ${s.nom_affiche}`}>
                      {bateauDef(s.bateau_id).nom} <span className="muted">({s.nom_affiche})</span>
                    </button>
                  ))}
                </div>
                {f.classe === 'VINTAGE' && (
                  <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
                    {bt.nom} : {bt.annee}, plans {bt.architecte}. Source : base du site Mémoire du large (histoiredeshalfs.com).
                  </p>
                )}
              </div>
            </div>

            {!provisoire && <PlanVoilure modele={modele} />}


            <h3>Vitesse et risque selon l'allure et le vent</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
              Distance d'un tour en pleine mer, avec la voile la plus rapide sans casse assurée (calcul du moteur du jeu, sans compétence de skipper).
            </p>
            <label className="champ" style={{ maxWidth: 360 }}>
              <span className="lbl">Comparer avec</span>
              <select value={compare} onChange={(e) => setCompare(e.target.value)}>
                <option value="">Aucun</option>
                {TYPES.filter((t) => t.famille !== famille).map((t) => <option key={t.famille} value={t.famille}>{t.titre}</option>)}
              </select>
            </label>
            <div className="hangar-tableau-defile">
              <table className="tableau hangar-tableau">
                <thead>
                  <tr><th>Allure</th>{FORCES.map((fo) => <th key={fo}>Force {fo} · {nomBeaufort(D, fo).toLowerCase()}</th>)}</tr>
                </thead>
                <tbody>
                  {ALLURES.map((a, i) => (
                    <tr key={a.angle}>
                      <td><b>{a.nom}</b></td>
                      {tableau[i].map(({ moi, lui }, j) => (
                        <td key={j}>
                          {moi ? (
                            <>
                              <b>{moi.mn} mn</b> <span className="muted">{nomVoile(moi.voile)}</span> <Pastille niveau={moi.risque} />
                              {lui && (
                                <div className={`ecart ${moi.mn > lui.mn ? 'plus' : moi.mn < lui.mn ? 'moins' : ''}`}>
                                  {moi.mn === lui.mn ? 'égalité' : `${moi.mn > lui.mn ? '+' : '−'}${Math.abs(moi.mn - lui.mn)} mn`} contre {titre(compare)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="muted">— (aucune voile sûre)</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Risque de chaque voile selon le vent</h3>
            <div className="hangar-tableau-defile">
              <table className="tableau hangar-tableau">
                <thead>
                  <tr><th>Voile</th>{FORCES.map((fo) => <th key={fo}>F{fo}</th>)}</tr>
                </thead>
                <tbody>
                  {voiles.map((v) => (
                    <tr key={v}>
                      <td>{nomVoile(v)}</td>
                      {FORCES.map((fo) => <td key={fo}><Pastille niveau={calculerRisque(D, carte, profil(famille), v, { direction: 0, force: fo }).risque} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Tactique</h3>
            <ul className="hangar-conseils">
              {conseils(famille).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>

        <div className="barre-actions barre-fixe">
          <button className="btn" onClick={onRetour}>← Accueil</button>
        </div>
      </div>
    </div>
  );
}
