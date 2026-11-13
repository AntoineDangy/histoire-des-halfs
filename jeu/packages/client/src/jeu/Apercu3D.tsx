import { useEffect, useMemo, useRef, useState } from 'react';
import { angleAllure, bateau, coteVent, heuresParTour, NOMS_DIR_LONGS, norm, ventCourant } from '@cal/engine';
import type { EtatPartie } from '@cal/engine';
import { bateauDef, courseDef, D, skipper } from '../commun';
import { AllureKey, chargerModeles, Forme, modelesAcharger, modeleDuBateau, Scene3D } from './scene3d';

const allure3d = (a: number): AllureKey => (a < 67 ? 'pres' : a < 112 ? 'travers' : a < 157 ? 'largue' : 'arriere');

/**
 * Aperçu 3D du bateau du joueur, dans le volet de droite sur grand écran (essai d'interface du 12/11/2026, demande du
 * porteur de projet) : le bateau sous la voile choisie (ou la dernière voile portée), au cap choisi, dans le vent de sa
 * zone. Il suit les choix du joueur pendant la décision. La scène tourne seulement quand le volet est visible.
 */
export default function Apercu3D({ etat, bateauId, cap, voile, actif }: {
  etat: EtatPartie;
  bateauId: string;
  /** Cap choisi (null : dernier cap suivi). */
  cap: number | null;
  /** Voile choisie (undefined : pas encore choisie, on montre la dernière voile portée ; null : à sec de toile). */
  voile: string | null | undefined;
  /** Faux pendant une scène 3D de course, pour ne pas faire tourner deux scènes à la fois. */
  actif: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [pret, setPret] = useState(0);
  // Grand écran seulement : sur téléphone, la vue 3D n'est pas créée (économie de batterie et de mémoire graphique).
  const dispo = useMemo(() => Scene3D.disponible() && window.matchMedia('(min-width: 861px)').matches, []);
  const b = bateau(etat, bateauId);
  const modele = modeleDuBateau(b.famille, bateauDef(b.bateauId)?.modele_3d);

  useEffect(() => {
    if (!dispo || !wrap.current || !labels.current) return;
    let s: Scene3D;
    try {
      s = new Scene3D(wrap.current, labels.current);
    } catch {
      return;
    }
    scene.current = s;
    setPret((x) => x + 1);
    return () => {
      scene.current = null;
      s.detruire();
    };
  }, [dispo]);
  useEffect(() => {
    void chargerModeles(modelesAcharger([modele])).then(() => setPret((x) => x + 1));
  }, [modele]);

  const vent = ventCourant(etat, b.x, b.y);
  const capVu = cap ?? b.dernierCap ?? b.choix?.cap ?? norm(vent.direction + 6);
  // Voile montrée : la voile choisie, sinon la dernière portée, sinon le solent (ou la première voile à bord).
  const voileVue = voile !== undefined ? voile : b.choix?.voile ?? (b.voiles.includes('solent') ? 'solent' : b.voiles[0] ?? null);
  const def = voileVue ? D.voiles.find((v) => v.id === voileVue) : null;
  const ang = Math.max(45, angleAllure(capVu, vent.direction));
  const mpc = courseDef(etat.params.courseId).milles_par_case ?? 1;
  const vitesse = ((b.distanceDernierTour || 6) * mpc) / heuresParTour(D, etat);
  const s = skipper(b.skipperId);
  const classe = D.familles.find((f) => f.id === b.famille)?.classe;

  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    sc.afficher([{
      nom: '', moi: true, coque: s.couleurs.coque, bandes: s.couleurs.bandes, spi: s.couleurs.spi, numero: s.numero_voile,
      allure: allure3d(ang), forme: (def?.forme_3d ?? 'j2') as Forme, sansVoileAvant: !def, ris: voileVue === 'reduite' ? 2 : 0,
      cote: coteVent(capVu, vent.direction) || 1, off: [0, 0], vitesse, modele, classe,
    }], vent.force);
    if (actif) sc.demarrer();
    else sc.arreter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, ang, voileVue, capVu, vent.force, vent.direction, modele, actif]);

  if (!dispo) return null;
  return (
    <div className="panneau apercu-3d">
      <div className="apercu-3d-scene">
        <div ref={wrap} className="scene" />
        <div ref={labels} className="etiquettes" />
      </div>
      <div className="apercu-3d-legende">
        <b>{def ? def.nom : 'À sec de toile'}</b>
        <span className="muted"> · {NOMS_DIR_LONGS[vent.direction]} F{vent.force} · {D.regles.beaufort[vent.force].toLowerCase()}</span>
      </div>
    </div>
  );
}
