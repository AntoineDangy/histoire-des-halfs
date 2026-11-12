import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { alizeApres, alizeEn, dansAlize, frontSur, ventCourant } from '@cal/engine';
import { ANGLE_MIN, angleAllure, apercuCap, bateau, usureParTour, choisirIA, demiCapsPermis, NB_DIR, nomAllure, nomCap, NOMS_ALLURES, NOMS_DIR, NOMS_DIR_LONGS, norm, peutRecoudre, surCaseAbri } from '@cal/engine';
import type { Choix, EtatPartie } from '@cal/engine';
import { competenceDef, D, DE_LARGE, faces, RISQUES } from '../commun';
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

/** Barre d'usure d'une voile : actuelle, plus ce que le tour va coûter avec le vent actuel. */
function BarreUsure({ usure, ajout }: { usure: number; ajout: number }) {
  const seuil = D.regles.usure?.seuil ?? 100;
  const u = Math.min(100, (usure / seuil) * 100), a = Math.min(100 - u, (ajout / seuil) * 100);
  const couleur = u + a >= 100 ? '#ff5d5d' : u >= 60 ? '#ffb347' : '#4cc38a';
  return (
    <span className="barre-usure" title={`Usure ${Math.round(u)} % · ce tour : +${Math.round(a)} %`}>
      <span style={{ width: `${u}%`, background: couleur }} />
      <span style={{ width: `${a}%`, background: couleur, opacity: 0.45 }} />
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

interface Props {
  etat: EtatPartie;
  bateauId: string;
  onApercu: (cap: number | null, distance: number) => void;
  onValider: (c: Choix) => void;
}

export default function TableauBord({ etat, bateauId, onApercu, onValider }: Props) {
  const b = bateau(etat, bateauId);
  // Vent qui souffle là où est le bateau (vent général, ou vent du front).
  const vent = ventCourant(etat, b.x, b.y);
  const front = frontSur(etat, b.x, b.y);
  const annonce = etat.fronts?.find((f) => f.annonce > 0);
  const dansLesAlizes = !front && dansAlize(etat, b.x, b.y);
  const [cap, setCap] = useState<number | null>(null);
  const [voileId, setVoileId] = useState<string | null | undefined>(undefined);
  const [distanceMax, setDistanceMax] = useState<number | null>(null);
  const [recoudre, setRecoudre] = useState<string | null>(null);
  const comp = competenceDef(b.competence);
  const classe = D.classes.find((c) => c.id === etat.params.classe);
  const bulletin = etat.params.options.bulletinMeteo && classe?.bulletin_meteo;

  useEffect(() => {
    setCap(null);
    setVoileId(undefined);
    setDistanceMax(null);
    setRecoudre(null);
  }, [bateauId, etat.tour]);

  const apercu = useMemo(() => (cap === null ? null : apercuCap(D, etat, bateauId, cap)), [etat, bateauId, cap]);
  const ligne = apercu && voileId !== undefined ? apercu.voiles.find((v) => v.voile === voileId) ?? null : null;
  let distance = ligne?.distance ?? 0;
  if (recoudre && distance) distance = Math.max(1, Math.floor(distance / 2));
  const distEffective = ligne && ligne.voile !== null && distanceMax ? Math.min(distanceMax, distance) : distance;

  useEffect(() => {
    onApercu(cap, distEffective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, distEffective]);

  const choisirCap = (c: number) => {
    setCap(c);
    setDistanceMax(null);
    // Conserver la voile si elle reste utilisable, sinon la désélectionner.
    const a = apercuCap(D, etat, bateauId, c);
    if (voileId !== undefined && !a.voiles.find((v) => v.voile === voileId && v.distance !== null)) setVoileId(undefined);
  };

  const sansVoile = b.voiles.length === 0;
  // Bouton Valider posé sur la carte, toujours visible (11/11/2026, porteur de projet) : grisé tant que les choix manquent.
  const [cibleValider, setCibleValider] = useState<HTMLElement | null>(null);
  useEffect(() => setCibleValider(document.getElementById('valider-carte')), []);
  const [cibleMeteo, setCibleMeteo] = useState<HTMLElement | null>(null);
  useEffect(() => setCibleMeteo(document.getElementById('meteo-carte')), []);
  const pret = cap !== null && voileId !== undefined && ligne !== null && ligne.distance !== null;
  const bouton = (
    <button
      className="btn btn-principal btn-valider-flottant"
      disabled={!pret}
      onClick={() => onValider({ cap, voile: voileId ?? null, distanceMax: ligne?.voile !== null ? distanceMax : null, ...(recoudre ? { recoudre } : {}) })}
    >
      Valider
    </button>
  );
  const demiCaps = demiCapsPermis(D, etat, b);
  // La tendance n'est connue que d'un skipper météo, et elle reste une probabilité, pas une certitude.
  const tendanceTexte = !bulletin || !voitTendance(D, b) ? null : etat.tendance === 0 ? 'vent attendu stable' : `rotation attendue vers ${NOMS_DIR[norm(vent.direction + 2 * etat.tendance)]} (non certaine)`;
  const mpc = D.courses.find((c) => c.id === etat.params.courseId)?.milles_par_case ?? 1;
  const mn = (cases: number) => `${Math.round(cases * mpc)} mn`;

  const meteo = (
        <div className="meteo-sur-carte" title={D.regles.beaufort[vent.force]}>
          <div className="girouette"><Girouette direction={vent.direction} force={vent.force} /></div>
          <div className="meteo-texte">
            <div className="meteo-vent">{NOMS_DIR[vent.direction]} · F{vent.force} <span className="muted">{D.regles.beaufort[vent.force].toLowerCase()}</span></div>
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

  return (
    <>
      {front && (
        <div className={`alerte-front ${front.zone}`}>
          {front.front.type === 'anticyclone'
            ? `🔵 Vous êtes dans ${front.front.nom ? `l'${front.front.nom.charAt(0).toLowerCase()}${front.front.nom.slice(1)}` : "l'anticyclone"} : vent faible au centre, qui tourne autour dans le sens ${front.front.hemisphere === 'S' ? "inverse des aiguilles d'une montre (hémisphère sud)" : "des aiguilles d'une montre"} (ici ${NOMS_DIR_LONGS[vent.direction]} F${vent.force}). Contournez-le !`
            : front.front.type === 'molle'
            ? `🌫 Vous êtes dans la molle : vent faible (F${vent.force}) et instable. Patience… ou cherchez à en sortir !`
            : front.zone === 'front'
            ? `⛈ Vous êtes dans le front : vent de secteur ${NOMS_DIR_LONGS[front.front.direction]} force ${front.front.force}. Réduisez la toile… ou attaquez !`
            : `🌤 Vous êtes dans la traîne du front : le vent a basculé au ${NOMS_DIR_LONGS[vent.direction]}, force ${vent.force}.`}
        </div>
      )}
      {dansLesAlizes && (
        <div className="alerte-front alize">
          {/* Zones de vent régulier (12/11/2026) : alizés, et sur les tours du monde vents d'ouest, anticyclone… */}
          🌬 {(() => { const az = alizeEn(etat, b.x, b.y); return !az?.nom || /^Alizés/.test(az.nom) ? 'Vous êtes dans les alizés' : `Vous êtes dans la zone « ${az.nom} »`; })()} : ici {NOMS_DIR_LONGS[vent.direction]} F{vent.force}. Les dés le font tourner, sans sortir de sa plage ({(() => { const az = alizeEn(etat, b.x, b.y); return az ? `${NOMS_DIR_LONGS[az.directions[0]]} à ${NOMS_DIR_LONGS[az.directions[1]]}, force ${az.forces[0]} à ${az.forces[1]}` : ''; })()}). {(() => { const az = alizeEn(etat, b.x, b.y); if (az?.nom && !/^Alizés/.test(az.nom)) return ''; return (az?.directions[1] ?? 0) >= 8 ? 'Caps Ouest, Nord-Ouest et Nord favorisés' : 'Caps Sud, Sud-Ouest et Ouest favorisés'; })()}
          (+1 point, environ +75 milles par tour).
        </div>
      )}
      {!front && annonce && (
        <div className="alerte-front annonce">
          📡 Bulletin : un front arrive dans {annonce.annonce} tour{annonce.annonce > 1 ? 's' : ''} (vent de secteur {NOMS_DIR_LONGS[annonce.direction]} F{annonce.force}, puis bascule au {NOMS_DIR_LONGS[norm(annonce.direction + annonce.bascule)]}). Sa trajectoire est en pointillés sur la carte : l'éviter, l'attaquer, vous abriter ou jouer la bascule ?
        </div>
      )}
      {/* Météo actuelle posée sur la carte (12/11/2026, demande du porteur de projet : plus facile à voir et à comprendre). */}
      {cibleMeteo ? createPortal(meteo, cibleMeteo) : meteo}

      <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="resume-choix">
          <div>
            <div className="lbl">Votre cap</div>
            <div style={{ fontWeight: 700 }}>
              {cap === null ? 'Touchez une direction' : angleAllure(cap, vent.direction) < ANGLE_MIN ? `Cap ${nomCap(cap)} · Louvoyage face au vent (${Math.round((D.regles.louvoyage?.coefficient ?? 0.6) * 100)} % de la distance au près)` : `Cap ${nomCap(cap)} · ${nomAllure(angleAllure(cap, vent.direction))} ${String(angleAllure(cap, vent.direction)).replace('.', ',')}°`}
            </div>
          </div>
          {pret && <div className="gros">{mn(distEffective)}</div>}
        </div>
        <div className="rose16" role="group" aria-label="Rose des 16 caps">
          <svg className="rose-fond" viewBox="-100 -100 200 200" aria-hidden>
            <circle r="62" fill="none" stroke="#1f3d5a" />
            <circle r="34" fill="#0a2033" stroke="#1f3d5a" />
            <g style={{ transform: `rotate(${vent.direction * 22.5}deg)` }}>
              <path d="M0 -60 L0 -40" stroke="#ff9f43" strokeWidth="4" strokeLinecap="round" />
              <path d="M-7 -48 L0 -38 L7 -48" fill="none" stroke="#ff9f43" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            </g>
            {demiCaps && (
              // Rosace des demi-caps (essai du 11/11/2026) : à moins de 500 milles de l'arrivée, 16 pointes entre les 16 caps.
              <g className="rosace-demi">
                {Array.from({ length: NB_DIR }, (_, c) => (
                  <g key={c} style={{ transform: `rotate(${(c + 0.5) * 22.5}deg)` }}>
                    <path d="M0 -36 L4.5 -58 L0 -80 Z" fill="#7d93a8" />
                    <path d="M0 -36 L-4.5 -58 L0 -80 Z" fill="#4d6378" />
                  </g>
                ))}
              </g>
            )}
            <g style={{ transform: `rotate(${(cap ?? 0) * 22.5}deg)` }} opacity={cap === null ? 0.35 : 1}>
              <path d="M0 -24 Q9 -6 7 18 L-7 18 Q-9 -6 0 -24 Z" fill="#3dd6f5" stroke="#fff" strokeWidth="1.5" />
            </g>
          </svg>
          {demiCaps && Array.from({ length: NB_DIR }, (_, k) => {
            const c = k + 0.5;
            const a = angleAllure(c, vent.direction);
            const rad = (c * 22.5 * Math.PI) / 180;
            const r = 27;
            return (
              <button
                key={`demi-${k}`}
                className={`demi-cap ${a < ANGLE_MIN ? 'louvoyage' : ''}`}
                style={{ left: `${50 + Math.sin(rad) * r}%`, top: `${50 - Math.cos(rad) * r}%` }}
                aria-pressed={cap === c}
                aria-label={`${nomCap(c, true)} (demi-cap)`}
                onClick={() => choisirCap(c)}
                title={`${nomCap(c, true)} · ${a < ANGLE_MIN ? 'louvoyage face au vent' : nomAllure(a)}`}
              />
            );
          })}
          {Array.from({ length: NB_DIR }, (_, c) => {
            const a = angleAllure(c, vent.direction);
            const rad = (c * 22.5 * Math.PI) / 180;
            const r = 41;
            return (
              <button
                key={c}
                className={`cap16 ${c % 2 ? 'secondaire' : ''} ${a < ANGLE_MIN ? 'louvoyage' : ''}`}
                style={{ left: `${50 + Math.sin(rad) * r}%`, top: `${50 - Math.cos(rad) * r}%` }}
                aria-pressed={cap === c}
                onClick={() => choisirCap(c)}
                title={`${NOMS_DIR_LONGS[c]} · ${a < ANGLE_MIN ? 'louvoyage face au vent' : NOMS_ALLURES[a]}`}
              >
                {NOMS_DIR[c]}
              </button>
            );
          })}
        </div>
        <button
          className="btn btn-petit"
          title="Propose le cap et la voile que choisirait un routeur (l'IA de niveau moyen)"
          onClick={() => {
            const c = choisirIA(D, structuredClone(etat), bateauId, { utilisableMaintenant: true });
            if (c.cap !== null) {
              setCap(c.cap);
              setVoileId(c.voile);
              setDistanceMax(null);
            }
          }}
        >
          💡 Conseil du routeur
        </button>
        <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Flèche orange : d'où vient le vent</div>
        {surCaseAbri(D, etat, b) && vent.force >= 6 && (
          <button className="btn btn-petit" onClick={() => onValider({ cap: null, voile: null, distanceMax: null })}>
            ⛱ Rester à l'abri de la côte ce tour
          </button>
        )}
      </div>

      {apercu && (
        <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="lbl">Voiles</span>
            <span className="lbl">Risque d'incident · distance</span>
          </div>
          <div className="voiles">
            {apercu.voiles.map((v) => {
              const def = v.voile ? D.voiles.find((x) => x.id === v.voile)! : null;
              const perdue = v.voile !== null && b.voilesPerdues.includes(v.voile);
              const absente = v.voile !== null && !b.voiles.includes(v.voile) && !perdue;
              if (v.voile === null && !sansVoile) return null;
              const tropFort = !absente && !perdue && v.distance !== null && v.risque >= 5;
              const raison = absente ? 'Laissée à quai' : perdue ? 'Voile perdue' : tropFort ? `Vent trop fort (force ${vent.force}) : elle ne tiendrait pas` : v.distance === null ? v.details[0]?.libelle ?? 'Inutilisable à cette allure' : def?.detail ?? 'Obligé d\'aller au bout';
              const desactive = absente || perdue || v.distance === null || tropFort; // plus de « case noire » : voile interdite (11/11/2026)
              return (
                <button key={v.voile ?? 'sec'} className="ligne-voile" aria-pressed={voileId === v.voile} disabled={desactive} onClick={() => setVoileId(v.voile)}>
                  <div>
                    <div className="n">{def ? def.nom : 'À sec de toile'}</div>
                    <div className="s">{raison}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {!desactive && v.risque >= 5 && <span className="effet dommage">Case noire</span>}
                    {!desactive && v.voile && v.risque < 5 && <BarreUsure usure={b.usure?.[v.voile] ?? 0} ajout={usureParTour(D, etat, v.voile, vent.force, b.famille)} />}
                  </div>
                  <div className="dist">{desactive ? '—' : <>{Math.round(v.distance! * mpc)}<small> mn</small></>}</div>
                </button>
              );
            })}
          </div>
          {/* distance max juste sous le choix des voiles, avant l'explication des risques (11/11/2026, porteur de projet) */}
          {pret && ligne!.voile !== null && (
            <div className="reglage">
              <span>Distance max</span>
              <div className="stepper">
                <button className="btn" aria-label="Moins" onClick={() => setDistanceMax(Math.max(1, (distanceMax ?? distance) - 1))}>−</button>
                <b style={{ minWidth: 92, textAlign: 'center' }}>{distanceMax && distanceMax < distance ? mn(distanceMax) : `Max (${mn(distance)})`}</b>
                <button className="btn" aria-label="Plus" onClick={() => setDistanceMax(distanceMax && distanceMax + 1 < distance ? distanceMax + 1 : null)}>+</button>
              </div>
            </div>
          )}
          <div className="muted legende-risque">
            La barre donne l'usure de chaque voile d'avant : en clair, ce que le tour va lui coûter avec le vent actuel. À 100 %, la voile explose.
          </div>
          {ligne && ligne.distance !== null && (
            <ExplicationVoile
              nomVoile={ligne.voile ? D.voiles.find((x) => x.id === ligne.voile)?.nom_court ?? '' : 'À sec de toile'}
              usure={ligne.voile ? b.usure?.[ligne.voile] ?? 0 : 0}
              ajout={usureParTour(D, etat, ligne.voile, vent.force, b.famille)}
              noir={ligne.risque >= 5}
              quiz={!!etat.params.options.quiz}
              reparations={b.reparations}
              force={vent.force}
            />
          )}
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

      <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {peutRecoudre(D, etat, b) && (
          <label className="case-cocher">
            <input type="checkbox" checked={!!recoudre} onChange={(e) => setRecoudre(e.target.checked ? b.voilesPerdues[0] : null)} />
            ✂ Recoudre {D.voiles.find((v) => v.id === b.voilesPerdues[0])?.nom_court} (mi-distance)
          </label>
        )}
        {cibleValider ? createPortal(bouton, cibleValider) : bouton}
      </div>
    </>
  );
}
