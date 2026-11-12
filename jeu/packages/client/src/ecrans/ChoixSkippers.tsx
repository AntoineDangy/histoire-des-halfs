import { useState } from 'react';
import type { ParticipantParams } from '@cal/engine';
import { bateauDef, competenceDef, D, familleDef, Lancement, Reglages } from '../commun';
import { courseDef, nomClasse, skippersDe } from '../commun';

interface Props {
  reglages: Reglages;
  onRetour: () => void;
  onLancer: (l: Lancement) => void;
}

function Polaire({ valeurs }: { valeurs: Record<string, number> }) {
  // Diagramme polaire simplifié en 4 allures (demi-cercle tribord).
  const angles = [45, 90, 135, 180];
  const pts = angles.map((a) => {
    const r = (valeurs[String(a)] / 6) * 46;
    const rad = (a * Math.PI) / 180;
    return [10 + Math.sin(rad) * r, 54 - Math.cos(rad) * r];
  });
  return (
    <svg width="72" height="108" style={{ flexShrink: 0 }} viewBox="0 0 72 108" aria-label="Diagramme polaire simplifié">
      <path d="M10 8 A46 46 0 0 1 10 100" fill="none" stroke="#1f3d5a" />
      <line x1="10" y1="8" x2="10" y2="100" stroke="#1f3d5a" />
      <polyline points={`10,54 ${pts.map((p) => p.join(',')).join(' ')}`} fill="rgba(61,214,245,.18)" stroke="#3dd6f5" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#3dd6f5" />
      ))}
      <text x="12" y="6" fontSize="8" fill="#8fa6bc">vent</text>
    </svg>
  );
}

export default function ChoixSkippers({ reglages, onRetour, onLancer }: Props) {
  const [choix, setChoix] = useState<string[]>([]);
  const [voileLaissee, setVoileLaissee] = useState<Record<string, string>>({});
  // Course en double (décision du 10/11/2026) : chaque joueur choisit son skipper, puis son co-skipper.
  const double = !!courseDef(reglages.courseId).double;
  const parJoueur = double ? 2 : 1;
  const joueur = Math.floor(choix.length / parJoueur);
  const coSkipper = double && choix.length % 2 === 1;
  const fini = joueur >= reglages.humains.length;
  const skipperDe = (i: number) => choix[i * parJoueur];
  const competenceDuSkipper = coSkipper ? D.skippers.find((s) => s.id === choix[choix.length - 1])!.competence : null;
  const noms = reglages.options.nomsReels;

  const lancer = () => {
    const libres = [...skippersDe(reglages.classe).map((s) => s.id).filter((id) => !choix.includes(id))].sort(() => Math.random() - 0.5);
    const nbIA = Math.max(0, (reglages.nbBateaux ?? 4) - reglages.humains.length);
    const ia = libres.slice(0, nbIA);
    // Équipages de l'IA : un co-skipper d'une autre compétence quand c'est possible.
    const reserve = libres.slice(nbIA);
    const coIA = (id: string) => {
      const comp = D.skippers.find((s) => s.id === id)!.competence;
      const k = Math.max(0, reserve.findIndex((x) => D.skippers.find((s) => s.id === x)!.competence !== comp));
      return reserve.splice(k, 1)[0];
    };
    const participants: ParticipantParams[] = [
      ...reglages.humains.map((h, i) => ({
        nom: h.nom.trim(),
        type: 'humain' as const,
        niveauQuiz: h.niveauQuiz,
        skipperId: skipperDe(i),
        ...(double ? { coSkipperId: choix[i * 2 + 1] } : {}),
        voileLaissee: voileLaissee[skipperDe(i)],
      })),
      ...ia.map((id) => ({
        nom: 'IA',
        type: 'ia' as const,
        niveauIA: reglages.niveauIA,
        niveauQuiz: 2 as const,
        skipperId: id,
        ...(double ? { coSkipperId: coIA(id) } : {}),
      })),
    ];
    onLancer({ reglages, participants, graine: Math.floor(Math.random() * 1e9) });
  };

  return (
    <div className="ecran">
      <div className="contenu">
        <div className="lbl">Choix du skipper et du bateau</div>
        <h1>{fini ? 'Équipages prêts' : `${reglages.humains[joueur].nom}, choisissez votre ${coSkipper ? 'co-skipper' : 'skipper'}`}</h1>
        <p className="muted">{double
          ? <>Course en double : le bateau du <b>skipper</b> fait la course ; le <b>co-skipper</b> embarque avec lui. Leurs bonus s'additionnent, leurs compromis aussi. Le co-skipper doit avoir une autre compétence que le skipper. L'IA forme ses équipages parmi les autres marins ({reglages.nbBateaux ?? 4} bateaux en course).</>
          : <>Chaque skipper navigue sur son bateau. L'IA complète la flotte avec des skippers tirés au hasard parmi les autres ({reglages.nbBateaux ?? 4} bateaux en course).</>}</p>
        <div className="cartes">
          {skippersDe(reglages.classe).map((s) => {
            const b = bateauDef(s.bateau_id);
            const f = familleDef(b.famille);
            const c = competenceDef(s.competence);
            const pris = choix.indexOf(s.id);
            const memeCompetence = competenceDuSkipper === s.competence;
            return (
              <button
                key={s.id}
                className="carte-choix"
                aria-pressed={pris >= 0}
                disabled={fini || pris >= 0 || memeCompetence}
                title={memeCompetence ? 'Même compétence que votre skipper : choisissez un marin complémentaire' : undefined}
                onClick={() => setChoix([...choix, s.id])}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="lbl">{s.rang_saison ? `Rang ${s.rang_saison} · ` : ''}{nomClasse(s.classe)}</span>
                  {pris >= 0 && <span className="tag-joueur">{reglages.humains[Math.floor(pris / parJoueur)].nom}{double ? (pris % 2 ? ' · co-skipper' : ' · skipper') : ''}</span>}
                </div>
                <div className="nom">
                  <span className="pastille-couleur" style={{ background: s.couleurs.pion }} />
                  {noms ? s.nom_affiche : s.nom_generique}
                </div>
                <div className="competence">
                  <span className="icone-comp">{c.icone}</span> {c.nom}
                </div>
                <div className="bonus" style={{ fontSize: 13 }}>▲ {c.bonus}</div>
                <div className="compromis" style={{ fontSize: 13 }}>◇ {c.malus}</div>
                <hr style={{ border: 0, borderTop: '1px solid var(--bord)', width: '100%', margin: '4px 0' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Polaire valeurs={f.polaire} />
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <b>{noms ? b.nom : b.nom_generique}</b>
                    <span className="muted">{f.nom} · {b.annee}</span>
                    <span className="bonus">▲ {f.bonus}</span>
                    <span className="compromis">◇ {f.malus}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {choix
          .filter((_, i) => i % parJoueur === 0)
          .filter((id) => competenceDef(D.skippers.find((s) => s.id === id)!.competence).speciaux.voile_en_moins)
          .map((id) => (
            <div key={id} className="panneau" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>🔧 Bricoleur : quelle voile laissez-vous à quai pour embarquer l'outillage ?</span>
              <div className="segment">
                {D.voiles.map((v) => (
                  <button key={v.id} aria-pressed={(voileLaissee[id] ?? 'code0') === v.id} onClick={() => setVoileLaissee({ ...voileLaissee, [id]: v.id })}>
                    {v.nom_court}
                  </button>
                ))}
              </div>
            </div>
          ))}

        <div className="barre-actions barre-fixe">
          <button className="btn" onClick={() => (choix.length ? setChoix(choix.slice(0, -1)) : onRetour())}>← {choix.length ? 'Annuler le dernier choix' : 'Retour'}</button>
          <button className="btn btn-principal" disabled={!fini} onClick={lancer}>Larguer les amarres ⛵</button>
        </div>
      </div>
    </div>
  );
}
