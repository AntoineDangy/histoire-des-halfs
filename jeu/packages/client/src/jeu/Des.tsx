import { nomBeaufort, NOMS_DIR_LONGS } from '@cal/engine';
import type { Vent } from '@cal/engine';
import { D, RISQUES } from '../commun';

/** Dé de DIRECTION (rond, bleu, boussole) et dé de FORCE (carré, orange, barres de vent) : deux dés bien distincts. */
export type Phase = 'apparition' | 'roule' | 'resultat';

/** Zone météo du bateau : son vent est celui que les dés font évoluer à l'écran (11/11/2026). */
export const NOMS_ZONES: Record<string, string> = {
  general: 'Vent de votre zone', alizes: 'Vent régulier de votre zone', front: 'Dans le front', traine: 'Dans la traîne du front',
  molle: 'Dans la molle', anticyclone: "Dans l'anticyclone",
};

/** Bilan des dés pour un bateau : le vent de SA zone avant et après (le vent d'une zone où il n'est pas ne s'affiche pas). */
export function bilanVent(avant: Vent, apres: Vent, zone?: string, de?: { force: number; direction: number }) {
  const d = ((apres.direction - avant.direction + 24) % 16) - 8;
  const dF = apres.force - avant.force;
  const tourne = d === 0 ? 'garde sa direction' : `tourne de ${String(Math.abs(d) * 22.5).replace('.', ',')}° ${d > 0 ? "dans le sens des aiguilles d'une montre" : "dans le sens inverse des aiguilles d'une montre"}`;
  const forceTxt = dF === 0 ? ' et garde sa force' : dF > 0 ? ` et forcit de ${dF}` : ` et mollit de ${-dF}`;
  // Vent régulier (alizés) : force et direction restent dans leurs limites, même si le dé dit plus (12/11/2026).
  const borne = de && zone === 'alizes' && de.force !== dF
    ? ` : le vent régulier des alizés ne sort pas de ses limites, il reste à F${apres.force}`
    : '';
  return { zone: NOMS_ZONES[zone ?? 'general'] ?? NOMS_ZONES.general, texte: `le vent ${tourne}${forceTxt}${borne}` };
}

export function DesVent({ direction, force, phase, avant, apres, zone, autres }: { direction: number; force: number; phase: Phase; avant: Vent; apres: Vent; zone?: string; autres?: { nom: string; avant: Vent; apres: Vent; zone: string }[] }) {
  const bilan = bilanVent(avant, apres, zone, { force, direction });
  const roule = phase !== 'resultat';
  // Pas de caractères ↻ ↺ : certaines polices ne les dessinent pas. Les flèches sont tracées en SVG.
  const sens = direction === 0 ? 'Ne tourne pas' : direction > 0 ? 'Tourne de 45°, sens horaire' : 'Tourne de 45°, sens antihoraire';
  return (
    <div className="des-vent">
      <div className="de-bloc">
        <div className="lbl">Dé de direction</div>
        <div className={`de-direction ${phase === 'roule' ? 'roule' : ''} ${phase === 'apparition' ? 'apparait' : ''}`} aria-label={roule ? 'Le dé roule' : sens}>
          {roule ? (
            <span className="boussole">🧭</span>
          ) : (
            <svg viewBox="-30 -30 60 60" width="54" height="54" aria-hidden>
              {direction === 0 ? (
                <>
                  <path d="M-16 0 H8" stroke="#04121f" strokeWidth="5" fill="none" strokeLinecap="round" />
                  <path d="M17 0 L4 -9 L4 9 Z" fill="#04121f" />
                </>
              ) : (
                // Arc de cercle aux trois quarts, parcouru dans le sens des aiguilles d'une montre, avec une pointe
                // pleine dans l'axe de la courbe ; retourné en miroir pour le sens antihoraire.
                <g className="fleche-rotation" transform={direction > 0 ? undefined : 'scale(-1,1)'}>
                  <path d="M-13.9 8 A16 16 0 1 1 9.7 12.9" stroke="#04121f" strokeWidth="5" fill="none" strokeLinecap="round" />
                  <path d="M1.9 17.4 L12.7 18.1 L6.7 7.7 Z" fill="#04121f" stroke="#04121f" strokeWidth="1.5" strokeLinejoin="round" />
                </g>
              )}
            </svg>
          )}
        </div>
        <div className="de-resultat">{roule ? '…' : direction === 0 ? '0°' : `${direction > 0 ? '+' : '−'}45°`}</div>
        <div className="de-legende">{roule ? '' : sens}</div>
      </div>
      <div className="de-bloc">
        <div className="lbl">Dé de force</div>
        <div className={`de-force ${phase === 'roule' ? 'roule' : ''} ${phase === 'apparition' ? 'apparait' : ''}`}>
          {roule ? '?' : force > 0 ? `+${force}` : force === 0 ? '0' : `−${-force}`}
          {!roule && (
            <span className="barres" aria-hidden>
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} className={i < apres.force ? 'pleine' : ''} style={{ height: 4 + i * 2 }} />
              ))}
            </span>
          )}
        </div>
        <div className="de-resultat">{roule ? '…' : `F${avant.force} → F${apres.force}`}</div>
        <div className="de-legende">{roule ? '' : nomBeaufort(D, apres.force)}</div>
      </div>
      <div className="de-bilan">
        {phase === 'apparition' && <>Jet des dés du vent…</>}
        {phase === 'roule' && <>Les dés roulent…</>}
        {phase === 'resultat' && (
          <>
            {bilan.zone}, {bilan.texte} : il passe de <b>{NOMS_DIR_LONGS[avant.direction]} F{avant.force}</b> à{' '}
            <b>{NOMS_DIR_LONGS[apres.direction]} F{apres.force}</b> ({nomBeaufort(D, apres.force).toLowerCase()}).
            {zone === 'alizes' && (direction !== 0 || force !== 0) && <> Les dés jouent sans faire sortir le vent de sa plage.</>}
            {(autres ?? []).map((x) => (
              <div key={x.nom} style={{ marginTop: 4, fontSize: '0.92em' }}>
                {x.nom} ({(NOMS_ZONES[x.zone] ?? '').toLowerCase()}) : {NOMS_DIR_LONGS[x.avant.direction]} F{x.avant.force} → <b>{NOMS_DIR_LONGS[x.apres.direction]} F{x.apres.force}</b>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Troisième dé : le dé ÉVÉNEMENT (violet, étoile). Sur un 6, on tire une carte du large. */
export function DeEvenement({ valeur, phase, nom }: { valeur: number; phase: Phase; nom: string }) {
  const roule = phase !== 'resultat';
  const r = D.regles.de_du_large ?? { carte: [6], question: [] };
  const six = !roule && r.carte.includes(valeur);
  const question = !roule && r.question.includes(valeur);
  return (
    <div className="de-bloc">
      <div className="lbl">Dé du large</div>
      <div className={`de-evenement ${phase === 'roule' ? 'roule' : ''} ${phase === 'apparition' ? 'apparait' : ''} ${six ? 'six' : ''}`}>
        <span className="etoile">★</span>
        {roule ? '?' : valeur}
      </div>
      <div className="de-regle">{r.carte.join("-")} : carte du large · {r.question.join("-") || "—"} : question · {[1, 2, 3, 4, 5, 6].filter((x) => !r.carte.includes(x) && !r.question.includes(x)).join("-")} : rien</div>
      <div className="de-bilan">{phase === 'resultat' ? (six ? `${valeur} ! ${nom} tire une carte du large.` : question ? `${valeur} : question de culture marine pour ${nom}.` : `${valeur} : rien à signaler à bord de ${nom}.`) : `Dé du large de ${nom}…`}</div>
    </div>
  );
}

/**
 * Dé ROUGE de risque (comme dans le jeu de 1987) : selon la couleur de la case de la voile, un incident se
 * déclenche si le dé fait de 1 au seuil. Bleu 1-2, vert 1-3, jaune 1-4, rouge 1-5 ; case noire : pas de dé, casse.
 */
export interface EtatDeRisque {
  valeur: number;
  seuil: number;
  niveau: number;
  declenche: boolean;
  noir: boolean;
  phase: Phase;
  nom: string;
  quiz: boolean;
}

export function DeRisque({ valeur, seuil, niveau, declenche, noir, phase, nom, quiz }: EtatDeRisque) {
  const roule = phase !== 'resultat';
  const r = RISQUES[niveau] ?? RISQUES[0];
  const regle = noir ? 'Case noire : trop de toile pour ce vent' : `Risque ${r.court.toLowerCase()} : incident si le dé fait 1${seuil > 1 ? ` à ${seuil}` : ''}`;
  return (
    <div className="de-bloc">
      <div className="lbl">Dé de risque</div>
      <div className={`de-risque ${phase === 'roule' && !noir ? 'roule' : ''} ${phase === 'apparition' ? 'apparait' : ''} ${!roule && (declenche || noir) ? 'declenche' : ''}`}>
        {noir ? '✖' : roule ? '?' : valeur}
      </div>
      <div className="de-regle">
        <span className="risque" style={{ background: r.couleur, color: r.texte }}>{r.icone} {r.court}</span> {regle}
      </div>
      <div className="de-bilan">
        {noir
          ? `${nom} : la voile va exploser. Réparation : il la sauve mais n'avance pas ; sinon il la perd et avance de moitié.`
          : phase !== 'resultat'
            ? `${nom} lance le dé de risque…`
            : declenche
              ? quiz
                ? `${valeur} : incident ! ${nom} doit répondre à une question pour l'écarter.`
                : `${valeur} : incident ! ${nom} subit une avarie.`
              : `${valeur} : ${nom} passe sans encombre.`}
      </div>
    </div>
  );
}

/**
 * Dé de tempête et dé du pot-au-noir (12/11/2026, bug signalé par le porteur de projet : on ne les voyait pas, alors
 * qu'ils expliquent le jeu). Même présentation que le dé de risque : il roule, puis la règle et le résultat s'affichent.
 */
export interface EtatDeSpecial {
  titre: string;
  valeur: number;
  regle: string;
  resultat: string;
  mauvais: boolean;
  phase: Phase;
}

export function DeSpecial({ titre, valeur, regle, resultat, mauvais, phase }: EtatDeSpecial) {
  const roule = phase !== 'resultat';
  return (
    <div className="de-bloc">
      <div className="lbl">{titre}</div>
      <div className={`de-risque ${phase === 'roule' ? 'roule' : ''} ${phase === 'apparition' ? 'apparait' : ''} ${!roule && mauvais ? 'declenche' : ''}`}>
        {roule ? '?' : valeur}
      </div>
      <div className="de-regle">{regle}</div>
      {!roule && <div className="de-regle" style={{ fontWeight: 700 }}>{resultat}</div>}
    </div>
  );
}
