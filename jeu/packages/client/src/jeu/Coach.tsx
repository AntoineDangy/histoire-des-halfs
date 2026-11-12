// Tutoriel (cahier des charges, écran E9) : une course d'initiation guidée. Le coach affiche une bulle
// d'aide qui suit ce que fait le joueur : choisir un cap, une voile, comprendre le vent, le risque,
// la réparation… Chaque explication contextuelle n'apparaît qu'une fois.
import { useEffect, useRef, useState } from 'react';

export interface ContexteCoach {
  phaseChoix: boolean;
  capChoisi: boolean;
  voileChoisie: boolean;
  louvoyage: boolean;
  desVent: boolean;
  deEvenement: boolean;
  carteDuLarge: boolean;
  jetRisque: boolean;
  quiz: boolean;
  reparation: boolean;
  dansFront: boolean;
  frontAnnonce: boolean;
  tour: number;
  fini: boolean;
}

interface Bulle {
  id: string;
  etape?: string;
  titre: string;
  texte: string;
}

// Textes mis à jour le 11/11/2026 pour suivre les règles en vigueur (dé du large, usure, case noire, réparation,
// bouton « Valider » sur la carte, vent jusqu'à la tempête, marques de parcours, départage à l'arrivée). Avaries et
// réparations : explication générale ici, le détail est donné dans la fenêtre de la carte (12/11/2026).
function bulleCourante(c: ContexteCoach, vues: Set<string>): Bulle | null {
  if (c.fini) return { id: 'fin', titre: 'Arrivée !', texte: "Bravo, vous avez bouclé votre première course. Si plusieurs bateaux coupent la ligne au même tour, on les départage au taux de bonnes réponses au quiz, puis au nombre de bonnes réponses, puis au moins de milles parcourus. Depuis « Jouer », choisissez maintenant votre classe, votre course et vos adversaires." };
  if (c.reparation) return { id: 'reparation', etape: '5/5', titre: 'La carte réparation', texte: "Une avarie vous frappe. Une carte réparation permet d'en limiter l'impact : la fenêtre vous dit ce qu'elle change, à vous de choisir. Vous n'en avez que quelques-unes : gardez-en une pour le gros temps." };
  if (c.quiz) return { id: 'quiz', etape: '4/5', titre: 'Question de culture marine', texte: "Le dé du large est tombé sur 2 ou 3 : une question. Bonne réponse, bonne manœuvre. Mauvaise réponse : la voile hissée s'use de 20 %. Vos réponses comptent aussi pour départager les arrivées au même tour." };
  if (c.jetRisque && !vues.has('risque')) return { id: 'risque', etape: '4/5', titre: 'Case noire !', texte: "Le vent a forci après votre choix et votre voile était trop fragile pour lui : elle explose (un multicoque chavire). Chaque voile s'use aussi à chaque tour, plus vite par vent fort : surveillez la barre sous la voile et changez-en à temps." };
  if (c.carteDuLarge && !vues.has('carte')) return { id: 'carte', titre: 'Une carte du large !', texte: "Le dé du large est tombé sur 4, 5 ou 6 : une carte. Un tiers de bonnes nouvelles (dauphins, belle risée), un tiers d'histoires de mer sans effet, un tiers d'avaries (OFNI, nuit sans sommeil…)." };
  if (c.deEvenement && !vues.has('de-evenement')) return { id: 'de-evenement', titre: 'Le dé du large', texte: "Après le vent, vous lancez le dé du large : 1, rien ; 2 ou 3, une question de culture marine ; 4, 5 ou 6, une carte du large." };
  if (c.desVent && !vues.has('des')) return { id: 'des', etape: '3/5', titre: 'Le vent change !', texte: "Vous avez choisi AVANT les dés. Dé bleu (rond) : la direction du vent ; dé orange (carré) : sa force, qui peut monter jusqu'à la tempête (au-delà de F8, le dé tempête entre en jeu). Votre bateau avance avec le NOUVEAU vent : c'est là que se joue la course." };
  if (c.dansFront && !vues.has('front')) return { id: 'front', titre: 'Vous êtes dans un front', texte: 'Gros vent ! Les petites voiles (J3, tourmentin) y vont vite et prennent peu de risques ; le spi y est un vrai pari.' };
  if (c.frontAnnonce && c.phaseChoix && !vues.has('annonce')) return { id: 'annonce', titre: 'Un front est annoncé', texte: "Le bulletin annonce une dépression : sa trajectoire est en pointillés rouges. L'éviter, l'attaquer, vous abriter ou vous placer pour la bascule du vent : à vous de choisir." };
  if (c.phaseChoix) {
    if (!c.capChoisi && c.tour <= 2) return { id: 'cap', etape: '1/5', titre: 'Choisissez un cap', texte: "La flèche orange montre d'où vient le vent. Touchez une direction sur la rose. Visez l'ouest pour sortir de la Manche, puis le sud-ouest vers les Antilles. Les marques de parcours (pointillés) sont à passer du bon côté : à l'arrivée, la Guadeloupe se laisse à bâbord." };
    if (c.capChoisi && !c.voileChoisie && c.tour <= 2) return { id: 'voile', etape: '2/5', titre: 'Choisissez une voile', texte: "Chaque voile affiche sa distance en milles et son risque. Une voile grisée est trop fragile pour le vent du moment : on ne peut pas la choisir. L'encadré explique ce qui change si le vent tourne ou forcit. Pour commencer, le Solent est un bon compromis." };
    if (c.louvoyage && !vues.has('louvoyage')) return { id: 'louvoyage', titre: 'Le louvoyage', texte: "Ce cap est face au vent : le bateau tirera des bords (zigzag sur la carte) et n'avancera qu'à 60 % de sa distance au près. Utile pour sortir d'une mauvaise passe." };
    if (c.voileChoisie && c.tour <= 2) return { id: 'valider', titre: 'Vérifiez et validez', texte: "Les pointillés blancs montrent où vous irez avec le vent actuel, dérive du courant comprise. Le bouton « Conseil du routeur » propose un choix si vous hésitez. Puis touchez « Valider », en bas à droite de la carte." };
  }
  return null;
}

export default function Coach({ contexte, onQuitter }: { contexte: ContexteCoach; onQuitter: () => void }) {
  const vues = useRef(new Set<string>());
  const [, rafraichir] = useState(0);
  const bulle = bulleCourante(contexte, vues.current);
  // Une explication contextuelle vue n'est plus répétée (sauf les étapes du premier tour).
  useEffect(() => {
    if (bulle && !vues.current.has(bulle.id)) {
      const t = window.setTimeout(() => {
        vues.current.add(bulle.id);
        rafraichir((n) => n + 1);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [bulle?.id]);
  if (!bulle) return null;
  return (
    <div className="coach" role="status" aria-live="polite">
      <div className="coach-tete">
        <span className="coach-avatar" aria-hidden>🧑‍✈️</span>
        <div>
          <div className="lbl">Tutoriel{bulle.etape ? ` · étape ${bulle.etape}` : ''}</div>
          <b>{bulle.titre}</b>
        </div>
      </div>
      <p>{bulle.texte}</p>
      <div className="coach-actions">
        {bulle.id === 'fin' ? (
          <button className="btn btn-principal btn-petit" onClick={onQuitter}>Retour à l'accueil</button>
        ) : (
          <button className="btn btn-petit" onClick={onQuitter}>Quitter le tutoriel</button>
        )}
      </div>
    </div>
  );
}
