import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  angleAllure, appliquer, bateau, heuresParTour, classement, categorie, categoriesPartie, NOM_CATEGORIE, coteVent, creerPartie, distanceRestante, formaterTemps, humainsAttendus, vecteur,
  NOMS_DIR, NOMS_DIR_LONGS, nomBeaufort, nomSkipper, trajectoirePrevue, ventCourant, frontSur, DELAI_CHOIX_S, DELAI_DECISION_S,
} from '@cal/engine';
import type { Action, Case, Choix, EtatPartie, Evenement, JoueurSalon, Vent } from '@cal/engine';
import { bateauDef, courseDef, D, definirCourseActive, Lancement, nomClasse, skipper, posExacte } from '../commun';
import Carte from '../jeu/Carte';
import TableauBord, { Girouette, PastilleRisque } from '../jeu/TableauBord';
import type { ApercuChoix } from '../jeu/TableauBord';
import { EcranPassation, ModaleQuiz, ModaleRelance, ModaleReparation } from '../jeu/Modales';
import { AllureKey, BateauScene, chargerModeles, Forme, modelesAcharger, modeleDuBateau, Scene3D } from '../jeu/scene3d';
import { bilanVent, DesVent, DeEvenement, DeRisque, DeSpecial, EtatDeRisque, EtatDeSpecial, Phase } from '../jeu/Des';
import ModaleCarteEvenement from '../jeu/CarteEvenement';
import RecapBateau from '../jeu/RecapBateau';
import Apercu3D from '../jeu/Apercu3D';
import Coach from '../jeu/Coach';
import JournalMouvements from '../jeu/JournalMouvements';
import Regles from './Regles';
import Briefing, { CLE_BRIEFING } from '../jeu/Briefing';
import { ecrireStockage, lireStockage } from '../commun';

/** Mode réseau : l'état vient du serveur de salons, les actions lui sont envoyées. */
export interface ModeReseau {
  etat: EtatPartie;
  moi: string | null;
  ontChoisi: string[];
  joueurs: JoueurSalon[];
  hote: boolean;
  connecte: boolean;
  envoyer: (a: Action) => void;
  confierIA: (bateauId: string) => void;
  /** Refus du serveur (action impossible), affiché pendant la course (13/11/2026, audit C5). */
  erreur?: string | null;
  effacerErreur?: () => void;
  /** Heure locale (ms) à laquelle le serveur jouera pour les joueurs attendus (13/11/2026, audit C2). */
  echeance?: number | null;
}

interface Props {
  lancement: Lancement;
  onQuitter: () => void;
  onFin: (e: EtatPartie) => void;
  reseau?: ModeReseau;
  /** Reprise après un plantage de l'affichage : la partie repart de cet état, sans rejouer l'historique. */
  reprise?: EtatPartie;
}

/** Dernier état connu de la partie en cours, pour la reprendre si l'affichage plante (12/11/2026). */
export const derniereSauvegarde: { etat?: EtatPartie } = {};

/** Durée d'une scène 3D de course à la vitesse normale (10 s le 10/11/2026, 8 s le 13/11/2026 : demandes du porteur de projet). */
const DUREE_SCENE_3D = 8000;
/** Dé du large lancé tout seul (option du joueur, mémorisée sur l'appareil, 13/11/2026). */
const CLE_DE_AUTO = 'cal-de-large-auto';
const allure3d = (a: number): AllureKey => (a < 67 ? 'pres' : a < 112 ? 'travers' : a < 157 ? 'largue' : 'arriere');

export default function Jeu({ lancement, onQuitter, onFin, reseau, reprise }: Props) {
  const { reglages } = lancement;
  const [etat, setEtat] = useState<EtatPartie>(() =>
    reprise ?? (reseau ? reseau.etat : creerPartie(D, { courseId: reglages.courseId ?? 'route-du-rhum', classe: reglages.classe ?? 'IMOCA', graine: lancement.graine, participants: lancement.participants, options: reglages.options })),
  );
  useEffect(() => { derniereSauvegarde.etat = etat; }, [etat]);
  // En réseau, on ne rejoue pas l'historique à l'arrivée (reconnexion) : on part des événements déjà connus.
  const [curseur, setCurseur] = useState(() => (reprise ? reprise.evenements.length : reseau ? reseau.etat.evenements.length : 0));
  const reseauRef = useRef(reseau);
  reseauRef.current = reseau;
  useEffect(() => {
    if (reseau) setEtat(reseau.etat);
  }, [reseau?.etat]);
  const [positions, setPositions] = useState<Record<string, [number, number]>>(() => Object.fromEntries(etat.bateaux.map((b) => [b.id, posExacte(b)])));
  const [bandeau, setBandeau] = useState<string | null>(null);
  // Volet de droite (journal de bord et état du bateau), masquable (essai d'interface du 12/11/2026) : ouvert d'office sur grand écran.
  const [coteOuvert, setCoteOuvert] = useState(() => window.innerWidth >= 1100);
  const [animPts, setAnimPts] = useState<{ id: string; pts: [number, number][] } | null>(null);
  const [enteteReduite, setEnteteReduite] = useState(() => window.innerWidth < 860);
  const [des, setDes] = useState<{ force: number; direction: number; phase: Phase; avant: Vent; apres: Vent; zone?: string; autres?: { nom: string; avant: Vent; apres: Vent; zone: string }[] } | null>(null);
  const [deEvt, setDeEvt] = useState<{ valeur: number; phase: Phase; nom: string; attente?: boolean } | null>(null);
  const [deRisque, setDeRisque] = useState<EtatDeRisque | null>(null);
  const [deSpecial, setDeSpecial] = useState<EtatDeSpecial | null>(null);
  const [carteVue, setCarteVue] = useState<{ carteId: string; bateauId: string } | null>(null);
  const [vitesse, setVitesse] = useState(1);
  const [passation, setPassation] = useState<string | null>(null);
  const [apercu, setApercu] = useState<ApercuChoix>({ cap: null, distance: 0, max: 0, choisir: null });
  const [centrer, setCentrer] = useState(0);
  const [dureeScene, setDureeScene] = useState({ id: 0, ms: 0 }); // barre de temps de la scène 3D
  const [vue3d, setVue3d] = useState<{ bateauId: string; etape: number; texte: string; vent: { direction: number; force: number }; titre?: string } | null>(null);
  /** Moments de course racontés en 3D (au plus un par tour). */
  const momentFort = (ev: Evenement, humain: boolean): string | null => {
    switch (ev.type) {
      case 'depassement': return 'Dépassement !';
      case 'a_vue': return 'Navigation à vue';
      case 'voile_perdue': return 'Avarie de voile';
      // Événement qui contraint la course : toujours expliqué et animé (demande du porteur de projet, 12/11/2026).
      // Seule la voile inutilisable porte des données (voile, cap, vent) ; une carte du large qui immobilise n'en a pas
      // (13/11/2026, audit E1 : elle était présentée à tort comme une voile inutilisable).
      case 'bloque': return humain && ev.donnees ? 'Voile inutilisable' : null;
      case 'collision': return 'Collision dans la brume';
      case 'arrivee': return (ev.donnees as { ligne?: string[] } | undefined)?.ligne ? "Ligne d'arrivée" : null;
      case 'debut': {
        if (!humain) return null;
        const dd = ev.donnees as { louvoyage?: boolean; vent?: Vent };
        if (dd.louvoyage) return 'Louvoyage face au vent';
        if ((dd.vent?.force ?? 0) >= 7) return 'Coup de vent';
        if ((dd.vent?.force ?? 9) <= 2) return 'Petit temps';
        return null;
      }
      default: return null;
    }
  };
  /** Priorité d'un moment : la scène 3D du tour est réservée au moment le plus fort (une voile perdue avant un petit temps). */
  const PRIORITE: Partial<Record<Evenement['type'], number>> = { voile_perdue: 4, bloque: 4, collision: 4, arrivee: 5, depassement: 3, a_vue: 2, debut: 1 };
  const impliqueHumain = (ev: Evenement) => {
    const d = (ev.donnees ?? {}) as { autre?: string; autres?: string[]; ligne?: string[] };
    if (d.ligne) return true; // la ligne d'arrivée est toujours montrée
    return etat.bateaux.some((o) => o.type === 'humain' && (d.autre === o.id || d.autres?.includes(o.id)));
  };
  const [erreur, setErreur] = useState<string | null>(null);
  /** Alerte du moment pendant la lecture du tour (voile inutilisable…), affichée dans le bandeau. */
  const [alerte, setAlerte] = useState<string | null>(null);
  /** Annonce brève pendant la lecture (carte du large d'un autre joueur en réseau…), sans clic (13/11/2026). */
  const [annonce, setAnnonce] = useState<string | null>(null);
  const [deAuto, setDeAuto] = useState(() => lireStockage(CLE_DE_AUTO, false));
  const [journalOuvert, setJournalOuvert] = useState(false);
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [briefing, setBriefing] = useState(() => !lancement.tutoriel && !lireStockage(CLE_BRIEFING, { masque: false }).masque);
  const humains = useMemo(() => etat.bateaux.filter((b) => b.type === 'humain'), [etat.bateaux]);
  const plusieursHumains = humains.length > 1;
  const dispo3d = useMemo(() => Scene3D.disponible(), []);
  const [panne3d, setPanne3d] = useState(false);
  const avec3d = reglages.vue3d && dispo3d && !panne3d;
  // Si la vue 3D ne peut pas s'afficher sur cet appareil, on le dit (au lieu de l'escamoter en silence).
  const [avis3d, setAvis3d] = useState<'absente' | 'perdue' | null>(() => (reglages.vue3d && !dispo3d ? 'absente' : null));
  definirCourseActive(etat.params.courseId);
  const mpc = courseDef(etat.params.courseId).milles_par_case ?? 1;

  const noms = useMemo(() => Object.fromEntries(etat.bateaux.map((b) => [b.id, nomSkipper(D, etat, b) + (b.type === 'humain' && plusieursHumains ? ` (${b.nom})` : '')])), [etat, plusieursHumains]);

  // ---------- Vue 3D (créée une seule fois)
  const scene3dRef = useRef<Scene3D | null>(null);
  /** Scène 3D déjà montrée : tour et priorité du moment (un moment plus fort peut encore avoir la sienne). */
  const tour3d = useRef({ tour: 0, prio: 0 });
  // Scène 3D de début de tour (coup de vent, louvoyage…) retardée après le dé de risque (12/11/2026, bug signalé par le
  // porteur de projet : on voyait le bateau naviguer avant de savoir s'il risquait de perdre sa voile).
  const sceneDifferee = useRef<number | null>(null);
  const [rejoue, setRejoue] = useState(0);
  const enRejeu = useRef(false);
  // Tours du monde (12/11/2026, demande du porteur de projet) : le tour se lit d'abord en déplacement sur le globe,
  // puis les scènes 3D du tour, avant le retour à la carte plate pour le tour suivant.
  const tourMonde = !!courseDef(etat.params.courseId).distance_reelle;
  const fileScenes = useRef<number[]>([]);
  const finDeTour = useRef(false);
  const conteneur3d = useRef<HTMLDivElement>(null);
  const etiquettes3d = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!avec3d || !conteneur3d.current || !etiquettes3d.current) return;
    let s: Scene3D;
    try {
      // modèles des bateaux de la course (bateaux de légende : un modèle par bateau, chargé à la demande)
      void chargerModeles(modelesAcharger(etat.bateaux.map((b) => modeleDuBateau(b.famille, bateauDef(b.bateauId)?.modele_3d))));
      s = new Scene3D(conteneur3d.current, etiquettes3d.current);
    } catch (e) {
      console.error('Vue 3D impossible :', e);
      setPanne3d(true);
      setAvis3d('absente');
      return;
    }
    s.surPerte = () => {
      setPanne3d(true);
      setAvis3d('perdue');
    };
    scene3dRef.current = s;
    return () => s.detruire();
  }, [avec3d]);

  const jouer = useCallback((a: Action) => {
    if (reseauRef.current) {
      reseauRef.current.envoyer(a);
      return;
    }
    setEtat((e) => {
      try {
        return appliquer(D, e, a);
      } catch (err) {
        setErreur((err as Error).message);
        return e;
      }
    });
  }, []);

  /** Un moment plus fort arrive-t-il plus tard dans le même tour ? Alors on lui garde la scène 3D. */
  const momentPlusFortApres = (i: number): boolean => {
    const ev = etat.evenements[i];
    const p = PRIORITE[ev.type] ?? 0;
    for (let j = i + 1; j < etat.evenements.length && etat.evenements[j].tour === ev.tour; j++) {
      const x = etat.evenements[j];
      const bx = x.bateauId ? etat.bateaux.find((o) => o.id === x.bateauId) : undefined;
      const hx = bx?.type === 'humain';
      if ((PRIORITE[x.type] ?? 0) > p && momentFort(x, hx) && (hx || impliqueHumain(x))) return true;
    }
    return false;
  };

  // ---------- Lecture animée des événements
  const enRetard = curseur < etat.evenements.length;
  useEffect(() => {
    if (!enRetard) return;
    let ev: Evenement = etat.evenements[curseur];
    let rejouer = false;
    let indexEv = curseur;
    let depuisFile = false;
    if (finDeTour.current) {
      // Fin d'un tour du monde : les scènes 3D gardées pendant les déplacements se jouent maintenant, l'une après l'autre.
      const i = fileScenes.current.shift();
      if (i === undefined) {
        finDeTour.current = false;
        setCurseur((c) => c + 1);
        return;
      }
      ev = etat.evenements[i];
      indexEv = i;
      depuisFile = true;
      rejouer = true;
    } else if (sceneDifferee.current !== null) {
      const e0 = etat.evenements[sceneDifferee.current];
      const memeTour = e0 && e0.bateauId === ev.bateauId && e0.tour === ev.tour;
      if (!memeTour || ev.type !== 'jet_risque') {
        // Le dé de risque est passé : la scène retardée se joue maintenant (sauf si un moment plus fort a la sienne).
        const plusFort = momentFort(ev, ev.bateauId ? etat.bateaux.find((x) => x.id === ev.bateauId)?.type === 'humain' : false);
        sceneDifferee.current = null;
        if (memeTour && !plusFort) { ev = e0; rejouer = true; }
      }
    }
    enRejeu.current = rejouer;
    // Un dé de risque suit-il ce début de tour, pour ce bateau ?
    const risqueApres = (i: number) => {
      const e = etat.evenements[i];
      for (let j = i + 1; j < etat.evenements.length && etat.evenements[j].tour === e.tour; j++) {
        const x = etat.evenements[j];
        if (x.bateauId !== e.bateauId) continue;
        if (x.type === 'jet_risque') return true;
        if (x.type === 'deplacement') return false;
      }
      return false;
    };
    const b = ev.bateauId ? etat.bateaux.find((x) => x.id === ev.bateauId) : undefined;
    const humain = b?.type === 'humain';
    const k = 1 / vitesse;
    // Les moments des IA qui ne montrent rien (début de tour, usure…) passent presque sans attendre (13/11/2026, audit A4).
    let duree = (humain ? 900 : 120) * k;
    /** Nombre d'événements lus d'un coup (déplacements des IA groupés). */
    let saut = 1;
    let annule = false;
    const timers: number[] = [];
    setBandeau(ev.texte);
    setAnnonce(null);
    // Voile inutilisable : message explicite, même sans vue 3D (téléphone, vue 3D coupée). Une carte du large qui
    // immobilise le bateau (événement sans données) a son propre message, plus court (13/11/2026, audit E1).
    const bloque = ev.type === 'bloque' && humain;
    setAlerte(bloque ? (ev.donnees ? MESSAGE_BLOQUE : ev.texte) : null);
    if (bloque) duree = (ev.donnees ? 5000 : 2500) * k;
    if (ev.type !== 'vent') setDes(null);
    if (ev.type !== 'de_evenement') setDeEvt(null);
    if (ev.type !== 'jet_risque') setDeRisque(null);
    setDeSpecial(null);

    if (ev.type === 'vent') {
      // Les dés roulent 1,2 s, puis le résultat reste affiché assez longtemps pour être lu (cliquer pour passer).
      const d = ev.donnees as { des: { force: number; direction: number }; avant: Vent; apres: Vent; locaux?: Record<string, { avant: Vent; apres: Vent; zone: string }> };
      // Le joueur voit le vent de SA zone (alizés, front, molle…), pas le vent général d'une zone où il n'est pas
      // (11/11/2026, demande du porteur de projet). En même écran, les autres joueurs humains sont listés dessous.
      const ids: string[] = reseau ? (reseau.moi ? [reseau.moi] : []) : etat.bateaux.filter((b) => b.type === 'humain' && !b.arrive).map((b) => b.id);
      const locs = ids.filter((id) => d.locaux?.[id]).map((id) => ({ id, ...d.locaux![id] }));
      const moiL = locs[0];
      const base = moiL
        ? { ...d.des, avant: moiL.avant, apres: moiL.apres, zone: moiL.zone, autres: locs.slice(1).map((x) => ({ nom: noms[x.id], avant: x.avant, apres: x.apres, zone: x.zone })) }
        : { ...d.des, avant: d.avant, apres: d.apres };
      if (moiL) {
        const bv = bilanVent(moiL.avant, moiL.apres, moiL.zone, d.des);
        setBandeau(`${bv.zone}, ${bv.texte} : ${NOMS_DIR_LONGS[moiL.apres.direction]}, force ${moiL.apres.force}.`);
      }
      // Plus court (13/11/2026, audit A2) : résultat à 1,2 s, suite à 3,5 s ; « Continuer », un clic sur les dés ou la
      // barre d'espace passent plus tôt.
      setDes({ ...base, phase: 'apparition' });
      timers.push(window.setTimeout(() => !annule && setDes({ ...base, phase: 'roule' }), 400 * k));
      timers.push(window.setTimeout(() => !annule && setDes({ ...base, phase: 'resultat' }), 1200 * k));
      duree = 3500 * k;
    } else if (ev.type === 'de_evenement') {
      const d = ev.donnees as { de: number; declenche: boolean };
      // En réseau, seul le joueur concerné lance son dé ; chez les autres, le dé roule tout seul (11/11/2026, bug signalé
      // par le porteur de projet : à trois joueurs, il fallait cliquer trois fois).
      if (humain && reseau && ev.bateauId !== reseau.moi) {
        const base = { valeur: d.de, nom: noms[ev.bateauId!] };
        setDeEvt({ ...base, phase: 'apparition' });
        timers.push(window.setTimeout(() => !annule && setDeEvt({ ...base, phase: 'roule' }), 600 * k));
        timers.push(window.setTimeout(() => !annule && setDeEvt({ ...base, phase: 'resultat' }), 1900 * k));
        duree = 4000 * k;
      } else if (humain && deAuto) {
        // Option « lancer tout seul » (13/11/2026, audit A3) : le dé roule sans attendre de clic.
        const base = { valeur: d.de, nom: noms[ev.bateauId!] };
        setDeEvt({ ...base, phase: 'apparition' });
        timers.push(window.setTimeout(() => !annule && setDeEvt({ ...base, phase: 'roule' }), 300 * k));
        timers.push(window.setTimeout(() => !annule && setDeEvt({ ...base, phase: 'resultat' }), 1000 * k));
        duree = 2000 * k;
      } else if (humain) {
        const nomB = noms[ev.bateauId!];
        // Le joueur lance lui-même le dé du large (11/11/2026) : la lecture attend son clic.
        setDeEvt({ valeur: d.de, phase: 'apparition', nom: nomB, attente: true });
        return () => {
          annule = true;
          timers.forEach(clearTimeout);
        };
      } else duree = 150 * k;
    } else if (ev.type === 'carte_evenement') {
      const d = ev.donnees as { carteId: string };
      if (humain && reseau && ev.bateauId !== reseau.moi) {
        // Carte d'un autre joueur en réseau : annoncée 2 s, sans clic (13/11/2026, audit C4).
        const titre = D.evenements?.cartes.find((c) => c.id === d.carteId)?.titre ?? 'carte du large';
        setAnnonce(`🃏 ${noms[ev.bateauId!]} tire la carte « ${titre} »`);
        duree = 2000 * k;
      } else if (humain) {
        // Pause : la carte reste affichée jusqu'au clic du joueur.
        setCarteVue({ carteId: d.carteId, bateauId: ev.bateauId! });
        return () => {
          annule = true;
          timers.forEach(clearTimeout);
        };
      } else duree = 150 * k;
    } else if (avec3d && !tourMonde && ev.type === 'debut' && !rejouer && momentFort(ev, humain) && humain && risqueApres(curseur)) {
      sceneDifferee.current = curseur;
      duree = 400 * k;
    } else if (avec3d && momentFort(ev, humain) && (humain || impliqueHumain(ev)) && (tour3d.current.tour !== ev.tour || (PRIORITE[ev.type] ?? 0) > tour3d.current.prio || ev.type === 'voile_perdue') && !momentPlusFortApres(indexEv) && tourMonde && !depuisFile) {
      // Tour du monde : la scène attend la fin des déplacements du tour.
      tour3d.current = { tour: ev.tour, prio: PRIORITE[ev.type] ?? 0 };
      fileScenes.current.push(curseur);
    } else if (avec3d && (depuisFile || (momentFort(ev, humain) && (humain || impliqueHumain(ev)) && (tour3d.current.tour !== ev.tour || (PRIORITE[ev.type] ?? 0) > tour3d.current.prio || ev.type === 'voile_perdue') && !momentPlusFortApres(indexEv)))) {
      // En principe un seul moment 3D par tour, le plus fort. Mais la suite du tour n'est pas toujours connue
      // (décision du joueur en cours, jeu en réseau) : un moment plus fort qui arrive ensuite a quand même sa scène.
      tour3d.current = { tour: ev.tour, prio: PRIORITE[ev.type] ?? 0 };
      // La vue 3D raconte un moment de course : un dépassement, une flotte à vue, une voile perdue.
      const d = (ev.donnees ?? {}) as { autre?: string; autres?: string[]; voile?: string; ligne?: string[] };
      const focus = d.ligne ? etat.bateaux.find((o) => o.id === d.ligne![0])! : humain ? b! : etat.bateaux.find((o) => o.type === 'humain' && (d.autre === o.id || d.autres?.includes(o.id)))!;
      const impliques = new Set<string>([ev.bateauId!, ...(d.autre ? [d.autre] : []), ...(d.autres ?? [])]);
      const titre = momentFort(ev, humain)!;
      const dernierDebut = (id: string) =>
        [...etat.evenements.slice(0, indexEv + 1)].reverse().find((x) => x.type === 'debut' && x.bateauId === id && x.tour === ev.tour)?.donnees as
          | { cap: number; voile: string | null; vent: Vent }
          | undefined;
      // Voile inutilisable : pas de début de tour (le bateau n'avance pas) ; cap, voile et vent viennent de l'événement.
      const ref = dernierDebut(focus.id) ?? (ev.type === 'bloque' ? (ev.donnees as { cap: number; voile: string | null; vent: Vent }) : undefined);
      const vent = ref?.vent ?? etat.vent;
      const capFocus = ref?.cap ?? focus.dernierCap ?? focus.choix?.cap ?? 12;
      const [fx, fy] = vecteur(capFocus);
      const p0 = positions[focus.id] ?? posExacte(focus);
      const scene: BateauScene[] = [];
      let rangLateral = 0;
      // Écart entre deux bateaux qui passent la ligne au même tour : tous la franchissent pendant la scène.
      // Écart d'une longueur et demie de coque ; vitesse de scène assez forte pour que le dernier coupe la ligne avant la fin
      // de la scène (8 s depuis le 13/11/2026).
      const classeFocus = D.familles.find((f) => f.id === focus.famille)?.classe;
      const longueur = classeFocus === 'ULTIM' ? 32 : classeFocus === 'OCEAN_FIFTY' ? 15.2 : classeFocus === 'CLASS40' ? 12.2 : 18.3;
      const nLigne = d.ligne?.length ?? 1;
      const espacementLigne = nLigne > 1 ? 1.5 * longueur : 0;
      const vitLigne = Math.max(0.514 * Math.max(6, (((dernierDebut(focus.id) as { distance?: number } | undefined)?.distance ?? 6) * mpc) / heuresParTour(D, etat)), (espacementLigne * (nLigne - 1)) / 5);
      for (const o of etat.bateaux) {
        if (!impliques.has(o.id) && o.id !== focus.id) continue;
        const s = skipper(o.skipperId);
        const info = dernierDebut(o.id);
        const cap = o.id === focus.id ? capFocus : (info?.cap ?? o.choix?.cap ?? capFocus);
        const ang = Math.max(45, angleAllure(cap, vent.direction));
        const perdue = ev.type === 'voile_perdue' && o.id === ev.bateauId;
        // La voile perdue est d'abord montrée hissée, puis elle lâche pendant la scène.
        const voileId = perdue && d.voile ? d.voile : (ev.type === 'bloque' && o.id === ev.bateauId ? ref?.voile : undefined) ?? info?.voile ?? o.choix?.voile ?? 'solent';
        let off: [number, number] = [0, 0];
        if (d.ligne) {
          // Ligne d'arrivée : les bateaux se suivent dans l'ordre du départage, le premier en tête, en quinconce.
          const r = d.ligne.indexOf(o.id);
          off = [r === 0 ? 0 : (r % 2 ? 1 : -1) * 14 * Math.ceil(r / 2), r * espacementLigne];
        } else if (o.id !== focus.id) {
          rangLateral++;
          if (ev.type === 'depassement') {
            // Celui qui double passe juste devant l'autre, à une longueur de distance.
            const devant = ev.bateauId !== focus.id;
            off = [rangLateral % 2 ? 26 : -26, devant ? -22 : 22];
          } else {
            const p = positions[o.id] ?? posExacte(o);
            const rx = p[0] - p0[0], ry = p[1] - p0[1];
            off = [Math.max(-70, Math.min(70, (rx * -fy + ry * fx) * 40 || (rangLateral % 2 ? 30 : -30))), Math.max(-90, Math.min(90, -(rx * fx + ry * fy) * 40))];
          }
        }
        scene.push({
          nom: noms[o.id],
          moi: o.id === focus.id,
          coque: s.couleurs.coque,
          bandes: s.couleurs.bandes,
          spi: s.couleurs.spi,
          numero: s.numero_voile,
          allure: allure3d(ang),
          forme: (voileId ? D.voiles.find((v) => v.id === voileId)?.forme_3d : 'j2') as Forme,
          sansVoileAvant: !voileId,
          ris: voileId === 'reduite' ? 2 : 0, // voilure réduite : tourmentin et deux ris
          perteVoile: perdue,
          affalage: ev.type === 'bloque' && o.id === ev.bateauId && voileId ? plusPetite(D.voiles.find((v) => v.id === voileId)?.forme_3d as Forme) : undefined,
          cote: coteVent(cap, vent.direction) || 1,
          off,
          // Vitesse en nœuds : milles parcourus ce tour divisés par la durée d'un tour.
          vitesse: d.ligne ? vitLigne / 0.514 : (((info as { distance?: number } | undefined)?.distance ?? 6) * mpc) / heuresParTour(D, etat),
          modele: modeleDuBateau(o.famille, bateauDef(o.bateauId)?.modele_3d),
          classe: D.familles.find((f) => f.id === o.famille)?.classe,
        });
      }
      scene3dRef.current?.afficher(scene, vent.force);
      if (d.ligne) scene3dRef.current?.ligneArrivee(d.ligne.length, vitLigne * 2.5, espacementLigne);
      scene3dRef.current?.demarrer();
      setVue3d({ bateauId: focus.id, etape: 2, texte: ev.texte, vent, titre });
      // 8 secondes par scène à la vitesse normale (demande du porteur de projet, 13/11/2026) ; bouton « Passer la scène ».
      duree = DUREE_SCENE_3D * k;
      const ms = duree;
      setDureeScene((x) => ({ id: x.id + 1, ms }));
      timers.push(window.setTimeout(() => {
        if (annule) return;
        setVue3d(null);
        scene3dRef.current?.arreter();
      }, duree - 50));
    } else if (humain && (ev.type === 'tempete' || (ev.type === 'meteo' && typeof (ev.donnees as { de?: number } | undefined)?.de === 'number' && (ev.donnees as { pot?: boolean }).pot))) {
      // Dé de tempête (F9 et plus) et dé du pot-au-noir, montrés comme le dé de risque (12/11/2026).
      const dt = ev.donnees as { de: number; faces?: number[]; touche?: boolean; force?: number };
      const nomB = noms[ev.bateauId!];
      const multi = !!b && ['ultim', 'ultim_ancien', 'ocean_fifty', 'vintage_multicoque'].includes(b.famille);
      const base: EtatDeSpecial = ev.type === 'tempete'
        ? {
          titre: `Dé de tempête · F${dt.force}`, valeur: dt.de, mauvais: !!dt.touche,
          regle: `${nomB} : ${multi ? 'chavirage' : 'démâtage'} si le dé fait ${(dt.faces ?? []).join(', ')}`,
          resultat: dt.touche ? (multi ? 'Chavirage !' : 'Démâtage !') : 'Le bateau tient bon.', phase: 'apparition',
        }
        : {
          titre: 'Dé du pot-au-noir', valeur: dt.de, mauvais: dt.de % 2 === 1,
          regle: `${nomB} est encalminé : pair, il repart ; impair, il passe son tour`,
          resultat: dt.de % 2 === 1 ? 'Impair : il reste encalminé.' : 'Pair : il attrape un souffle et repart !', phase: 'apparition',
        };
      setDeSpecial(base);
      timers.push(window.setTimeout(() => !annule && setDeSpecial({ ...base, phase: 'roule' }), 600 * k));
      timers.push(window.setTimeout(() => !annule && setDeSpecial({ ...base, phase: 'resultat' }), 1700 * k));
      duree = 4200 * k;
    } else if (ev.type === 'jet_risque' && humain) {
      // Le dé rouge de risque, montré comme les dés du vent : il roule, puis la règle et le résultat s'affichent.
      const dr = ev.donnees as { de?: number; seuil?: number; niveau: number; declenche?: boolean; noir?: boolean };
      const base: EtatDeRisque = {
        valeur: dr.de ?? 0, seuil: dr.seuil ?? 0, niveau: dr.niveau, declenche: !!dr.declenche, noir: !!dr.noir,
        phase: 'apparition', nom: noms[ev.bateauId!], quiz: !!etat.params.options.quiz,
      };
      setDeRisque(base);
      if (!base.noir) {
        timers.push(window.setTimeout(() => !annule && setDeRisque({ ...base, phase: 'roule' }), 600 * k));
        timers.push(window.setTimeout(() => !annule && setDeRisque({ ...base, phase: 'resultat' }), 1700 * k));
      } else timers.push(window.setTimeout(() => !annule && setDeRisque({ ...base, phase: 'resultat' }), 300 * k));
      duree = 3800 * k;
      setVue3d((v) => (v && v.bateauId === ev.bateauId ? { ...v, etape: 2, texte: ev.texte } : v));
    } else if (ev.type === 'deplacement' || ev.type === 'port') {
      setVue3d(null);
      scene3dRef.current?.arreter();
      // Déplacements des IA qui se suivent sans concerner un joueur : animés tous ensemble (13/11/2026, audit A5).
      // On s'arrête au premier événement d'un joueur, au vent, à la fin du tour ou à un moment raconté en 3D.
      const groupe: Evenement[] = [ev];
      if (!humain && !rejouer && !depuisFile && !tourMonde) {
        let j = curseur + 1;
        for (; j < etat.evenements.length; j++) {
          const x = etat.evenements[j];
          const bx = x.bateauId ? etat.bateaux.find((o) => o.id === x.bateauId) : undefined;
          if (x.tour !== ev.tour || !bx || bx.type === 'humain' || x.type === 'vent' || x.type === 'fin' || (avec3d && momentFort(x, false) && impliqueHumain(x))) break;
          if (x.type === 'deplacement' || x.type === 'port') groupe.push(x);
        }
        saut = j - curseur;
      }
      setAnimPts(null);
      let total = 0;
      for (const e2 of groupe) {
        // Déplacement animé le long du trajet réellement suivi (bords de louvoyage, dérive), calculé par le moteur (11/11/2026).
        const d = e2.donnees as { de?: Case; chemin?: Case[]; vers?: Case; finExacte?: [number, number]; sommets?: [number, number][] };
        const chemin: Case[] = d.chemin ?? (d.vers ? [d.vers] : []);
        const depart = positions[e2.bateauId!] ?? d.de;
        const arrivee = chemin[chemin.length - 1];
        const t2 = Math.max(300, (humain ? 140 : 70) * chemin.length) * k;
        total = Math.max(total, t2);
        if (!depart || !arrivee) continue;
        const images = Math.max(2, Math.round(t2 / 40));
        const poly: [number, number][] = [[depart[0], depart[1]], ...(d.sommets ? d.sommets.slice(1) : d.finExacte ? [d.finExacte] : [[arrivee[0], arrivee[1]] as [number, number]])];
        const longs = poly.slice(1).map((q, i) => Math.hypot(q[0] - poly[i][0], q[1] - poly[i][1]));
        const L = longs.reduce((x, y) => x + y, 0) || 1;
        for (let i = 1; i <= images; i++) {
          let reste = (L * i) / images, k2 = 0;
          while (k2 < longs.length - 1 && reste > longs[k2]) reste -= longs[k2++];
          const f = longs[k2] ? Math.min(1, reste / longs[k2]) : 1;
          const pos: [number, number] = [poly[k2][0] + (poly[k2 + 1][0] - poly[k2][0]) * f, poly[k2][1] + (poly[k2 + 1][1] - poly[k2][1]) * f];
          const passes = poly.slice(1, k2 + 1);
          timers.push(window.setTimeout(() => {
            if (annule) return;
            setPositions((p) => ({ ...p, [e2.bateauId!]: pos }));
            // Trace du trajet : seulement pour un bateau seul (plusieurs IA ensemble : pas de trace).
            if (groupe.length === 1) setAnimPts({ id: e2.bateauId!, pts: passes });
          }, (t2 * i) / images));
        }
      }
      duree = Math.max(duree * 0.5, total + 150 * k);
    } else if (ev.type === 'fin') {
      duree = 400;
    }
    // Après une scène retardée, l'événement courant (celui qui suit le dé) est lu à son tour : on ne fait pas avancer le curseur.
    // Tour du monde : au dernier événement du tour, on joue les scènes 3D gardées avant de passer au tour suivant.
    const dernierDuTour = !depuisFile && (curseur + 1 >= etat.evenements.length || etat.evenements[curseur + 1].tour !== ev.tour);
    if (tourMonde && dernierDuTour && fileScenes.current.length) finDeTour.current = true;
    timers.push(window.setTimeout(() => { if (annule) return; if (rejouer || finDeTour.current) setRejoue((r) => r + 1); else setCurseur((c) => c + saut); }, duree));
    return () => {
      annule = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseur, enRetard, vitesse, rejoue, deAuto]);

  /** Passe à l'événement suivant, seulement si la lecture en est toujours à l'événement `i` (13/11/2026, audit E2 :
   *  une minuterie restée en route après « Passer » ou un changement de vitesse sautait l'événement suivant). */
  const avancerDepuis = (i: number) => setCurseur((c) => (c === i ? c + 1 : c));

  // Dés du vent : la barre d'espace ou Entrée passent au résultat suivant (13/11/2026, audit A2).
  useEffect(() => {
    if (des?.phase !== 'resultat') return;
    const i = curseur;
    const touche = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); avancerDepuis(i); }
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [des?.phase, curseur]);

  // Résumé des IA du tour précédent, ajouté à la consigne (13/11/2026, audit A4) : leurs cartes et questions passent vite.
  const resumeIA = useMemo(() => {
    const ia = new Set(etat.bateaux.filter((b) => b.type === 'ia').map((b) => b.id));
    const evs = etat.evenements.filter((e) => e.tour === etat.tour - 1 && e.bateauId && ia.has(e.bateauId));
    const cartes = evs.filter((e) => e.type === 'carte_evenement').length, questions = evs.filter((e) => e.type === 'quiz').length;
    const parts = [cartes ? `${cartes} carte${cartes > 1 ? 's' : ''} du large` : '', questions ? `${questions} question${questions > 1 ? 's' : ''}` : ''].filter(Boolean);
    return parts.length ? ` (IA au tour précédent : ${parts.join(', ')}.)` : '';
  }, [etat.tour, etat.evenements.length]);

  // Une fois l'animation rattrapée : positions exactes, vue 3D fermée hors décision.
  useEffect(() => {
    if (enRetard) return;
    setPositions(Object.fromEntries(etat.bateaux.map((b) => [b.id, posExacte(b)])));
    setDes(null);
    if (!etat.attente) {
      setVue3d(null);
      scene3dRef.current?.arreter();
    }
  }, [enRetard, etat]);

  /** Passe la scène 3D en cours : la lecture du tour reprend à l'événement suivant. */
  const passerScene3d = () => {
    setVue3d(null);
    scene3dRef.current?.arreter();
    if (enRejeu.current) { enRejeu.current = false; setRejoue((r) => r + 1); } // scène retardée : l'événement courant reste à lire
    else setCurseur((c) => Math.min(c + 1, etat.evenements.length));
  };

  const passerAnimation = () => {
    fileScenes.current = [];
    finDeTour.current = false;
    setCarteVue(null);
    setCurseur(etat.evenements.length);
    setVue3d(null);
    scene3dRef.current?.arreter();
  };

  // ---------- Qui joue ?
  const aJour = !enRetard;
  const joueurChoix = aJour && etat.phase === 'choix'
    ? (reseau ? humainsAttendus(etat).find((b) => b.id === reseau.moi) ?? null : humainsAttendus(etat)[0] ?? null)
    : null;
  const besoinPassation = !reseau && joueurChoix && plusieursHumains && passation !== `${etat.tour}:${joueurChoix.id}`;
  // En réseau, la décision (question, relance, réparation) s'affiche dès que le serveur la demande, sans attendre la fin
  // de l'animation : les autres joueurs attendaient chaque fois cette animation (13/11/2026, audit C1).
  const attenteHumaine = (aJour || !!reseau) && etat.attente && (!reseau || etat.attente.bateauId === reseau.moi) ? etat.attente : null;
  // Échéance du serveur (13/11/2026, audit C2) : il choisit ou répond à la place des joueurs attendus.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!reseau?.echeance) return;
    const t = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [reseau?.echeance]);
  const resteEcheance = reseau?.echeance ? Math.max(0, Math.round((reseau.echeance - maintenant) / 1000)) : null;
  const moiId = reseau ? reseau.moi : joueurChoix?.id ?? attenteHumaine?.bateauId ?? (humains.length === 1 ? humains[0].id : null);
  // En réseau : qui doit encore jouer ?
  const attenteAutres = reseau && aJour
    ? etat.phase === 'choix'
      ? etat.bateaux.filter((b) => b.type === 'humain' && !b.arrive && b.passeTours === 0 && b.id !== reseau.moi && !reseau.ontChoisi.includes(b.id))
      : etat.attente && etat.attente.bateauId !== reseau.moi ? etat.bateaux.filter((b) => b.id === etat.attente!.bateauId) : []
    : [];

  useEffect(() => {
    if (joueurChoix && !besoinPassation) setBandeau(`Tour ${etat.tour} : ${plusieursHumains ? joueurChoix.nom + ', ' : ''}choisissez un cap puis une voile.${resumeIA}`);
  }, [joueurChoix?.id, besoinPassation, etat.tour, plusieursHumains, resumeIA]);

  const trajectoire = useMemo(() => {
    if (!joueurChoix || besoinPassation || apercu.cap === null || !apercu.distance) return null;
    return { ...trajectoirePrevue(D, etat, joueurChoix.id, apercu.cap, apercu.distance), louvoyage: angleAllure(apercu.cap, ventCourant(etat, joueurChoix.x, joueurChoix.y).direction) < 45 };
  }, [joueurChoix, besoinPassation, apercu, etat]);

  // Réglage de la distance sur la carte : trajet complet de la voile choisie, du bateau jusqu'au bout de sa distance.
  const reglageDistance = useMemo(() => {
    if (!joueurChoix || besoinPassation || apercu.cap === null || !apercu.choisir || apercu.max < 2) return null;
    const p0 = positions[joueurChoix.id] ?? [joueurChoix.x, joueurChoix.y];
    const depart: [number, number] = [p0[0] + 0.5, p0[1] + 0.5];
    // Trajet tracé par le moteur pour une distance donnée (bords de louvoyage, dérive, arrêt sur la terre).
    const trajetPour = (k: number): [number, number][] => {
      const t = trajectoirePrevue(D, etat, joueurChoix.id, apercu.cap!, k);
      const fin = t.chemin[t.chemin.length - 1];
      return [depart, ...(t.sommets && t.sommets.length > 1 ? t.sommets.slice(1) : fin ? [[fin[0] + 0.5, fin[1] + 0.5] as [number, number]] : [])];
    };
    // Un repère par case : le point d'arrivée exact pour chaque distance possible (le trajet s'arrête parfois sur la terre).
    const reperes = Array.from({ length: apercu.max }, (_, i) => { const t = trajetPour(i + 1); return t[t.length - 1]; });
    return { trajet: trajetPour(apercu.max), reperes, max: apercu.max, valeur: apercu.distance, choisir: apercu.choisir };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joueurChoix, besoinPassation, apercu, etat]);

  const valider = (c: Choix) => {
    setApercu({ cap: null, distance: 0, max: 0, choisir: null });
    jouer({ type: 'ChoisirCapEtVoile', bateauId: joueurChoix!.id, choix: c });
  };

  const recapId = moiId ?? (humains[0]?.id ?? null);
  const rang = classement(D, etat);
  // Flotte Vintage mêlant monocoques et multicoques : un classement par catégorie (décision du 10/11/2026).
  const cats = categoriesPartie(D, etat);
  const groupesRang = cats ? cats.map((c) => ({ titre: NOM_CATEGORIE[c], liste: rang.filter((b) => categorie(D, b) === c) })) : [{ titre: '', liste: rang }];
  const course = courseDef(etat.params.courseId);
  const tourAffiche = enRetard ? etat.evenements[curseur].tour : etat.tour;
  const heures = (tourAffiche - 1) * heuresParTour(D, etat);
  // Traces (11/11/2026) : un déplacement pas encore joué n'est pas dessiné ; celui qui se joue se dessine au fil du bateau.
  const coupes: Record<string, { n: number; pts: [number, number][] }> = {};
  for (let i = curseur; i < etat.evenements.length; i++) {
    const e = etat.evenements[i];
    const n = (e.donnees as { nTrace?: number } | undefined)?.nTrace;
    if (e.type === 'deplacement' && e.bateauId && typeof n === 'number' && !(e.bateauId in coupes)) coupes[e.bateauId] = { n, pts: [] };
  }
  if (animPts && coupes[animPts.id]) coupes[animPts.id].pts = animPts.pts;
  // Journal de bord (11/11/2026) : les événements utiles restent affichés, le plus récent en haut ; on les relit à son rythme.
  const idsHumains = new Set(etat.bateaux.filter((x) => x.type === 'humain').map((x) => x.id));
  const evsJournal = etat.evenements.slice(0, curseur).map((ev, i) => ({ ev, i, moi: !!ev.bateauId && idsHumains.has(ev.bateauId) }))
    .filter(({ ev, moi }) => moi || !['deplacement', 'debut', 'de_evenement', 'a_vue', 'usure'].includes(ev.type))
    .slice(-40).reverse();

  return (
    <div className="jeu">
      <header className={`entete ${enteteReduite ? 'reduite' : ''}`}>
        <button className="btn btn-petit bascule-entete" onClick={() => setEnteteReduite((r) => !r)} aria-label={enteteReduite ? 'Afficher le menu' : 'Masquer le menu'}>{enteteReduite ? '☰' : '✕'}</button>
        <h1>COURSE AU LARGE</h1>
        <span className="sep" />
        <span className="muted">{course.nom} · <b style={{ color: 'var(--texte)' }}>{nomClasse(etat.params.classe)}</b></span>
        <div className="droite">
          <span className="puce garde">Tour <b>{tourAffiche}</b></span>
          <span className="puce">Temps de course <b>J+{Math.floor(heures / 24)} · {String(Math.floor(heures % 24)).padStart(2, '0')} h</b></span>
          <button className="btn btn-petit" onClick={() => setVitesse(vitesse === 1 ? 2 : vitesse === 2 ? 4 : 1)} title="Vitesse des animations">×{vitesse}</button>
          {enRetard && <button className="btn btn-petit garde" onClick={passerAnimation}>Passer l'animation</button>}
          <button className="btn btn-petit" onClick={() => setBriefing(true)} title="Explications du jeu">Aide</button>
          <button className="btn btn-petit" onClick={() => setReglesOuvertes(true)} title="Les règles du jeu, illustrées">Règles</button>
          <button className="btn btn-petit" onClick={() => setJournalOuvert(true)} title="Bêta : journal de tous les mouvements et contrôle des calculs">Journal</button>
          <button className="btn btn-petit" onClick={() => setCentrer((c) => c + 1)}>Centrer</button>
          <button className="btn btn-petit" onClick={() => confirm('Quitter la partie ?') && onQuitter()}>Quitter</button>
        </div>
      </header>

      <div className={`corps ${coteOuvert ? "" : "sans-cote"}`}>
        <div className={`zone-carte ${joueurChoix && !besoinPassation ? 'avec-commandes' : ''}`}>
          <Carte etat={etat} positions={positions} trajectoire={trajectoire} moiId={moiId} centrer={centrer} noms={noms} coupes={coupes} lecture={enRetard}
            enChoix={!!joueurChoix && !besoinPassation} reglageDistance={reglageDistance}
            roseCaps={joueurChoix && !besoinPassation ? apercu.rose ?? null : null} />
          {/* Météo sur la carte : celle du tableau de bord pendant le choix (portail), sinon la girouette de la résolution du tour,
              qui tourne avec le vent pendant la lecture (demande du porteur de projet, 12/11/2026). */}
          <div id="meteo-carte">
            {!(joueurChoix && !besoinPassation) && (
              <ResumeAttente etat={etat} vus={etat.evenements.slice(0, curseur)} enRetard={enRetard} noms={noms} onFin={() => onFin(etat)} moiId={reseau?.moi ?? etat.bateaux.find((x) => x.type === 'humain')?.id} />
            )}
          </div>
          {!coteOuvert && (
            <button className="btn btn-petit languette-cote" onClick={() => setCoteOuvert(true)} aria-label="Afficher le journal de bord" title="Journal de bord et état du bateau">
              📜<span> Journal</span>
            </button>
          )}
          {/* Commandes du bateau (essai d'interface du 12/11/2026) : rose des caps autour du bateau, voiles en bas de la carte. */}
          {joueurChoix && !besoinPassation && (
            <TableauBord etat={etat} bateauId={joueurChoix.id} onApercu={setApercu} onValider={valider}
              entete={plusieursHumains ? `À vous, ${joueurChoix.nom} (${nomSkipper(D, etat, joueurChoix)})` : undefined} />
          )}
          {reseau && attenteAutres.length > 0 && (
            <div className="panneau attente-reseau attente-carte">
              <div className="lbl">{etat.phase === 'choix' ? 'Vous avez choisi · en attente de' : 'Décision en cours'}</div>
              {attenteAutres.map((b) => {
                const j = reseau.joueurs.find((x) => x.bateauId === b.id);
                // « Confier à l'IA » : joueur déconnecté, ou attendu depuis plus d'une minute (13/11/2026, audit C2).
                const longue = resteEcheance !== null && resteEcheance <= (etat.phase === 'choix' ? DELAI_CHOIX_S : DELAI_DECISION_S) - 60;
                return (
                  <div key={b.id} className="ligne-attente">
                    <span className={`point ${j?.connecte ? 'en-ligne' : ''}`} />
                    <span>{noms[b.id]}{j && !j.connecte ? ' (déconnecté)' : ''}</span>
                    {reseau.hote && j && (!j.connecte || longue) && (
                      <button className="btn btn-petit" onClick={() => reseau.confierIA(b.id)}>Confier à l'IA</button>
                    )}
                  </div>
                );
              })}
              {resteEcheance !== null && (
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  ⏱ {etat.phase === 'choix' ? 'Le routeur choisira pour eux' : 'Réponse par défaut'} dans {resteEcheance} s
                </div>
              )}
            </div>
          )}
          {/* Mon propre choix en réseau : le temps restant s'affiche dans la dernière minute (13/11/2026, audit C2). */}
          {reseau && (joueurChoix || attenteHumaine) && resteEcheance !== null && resteEcheance <= 60 && (
            <div className="alerte-front annonce attente-carte">
              ⏱ Plus que {resteEcheance} s : {joueurChoix ? 'ensuite le routeur choisira votre cap et votre voile pour ce tour.' : 'ensuite la réponse par défaut sera jouée.'}
            </div>
          )}
          {reseau && !reseau.connecte && <div className="alerte-front annonce attente-carte">Connexion perdue : reconnexion en cours…</div>}
          {reseau?.erreur && (
            <div className="alerte-front annonce attente-carte" role="alert" onClick={() => reseau.effacerErreur?.()} style={{ cursor: 'pointer' }}>
              Le serveur a refusé : {reseau.erreur} <span className="muted">(toucher pour fermer)</span>
            </div>
          )}
          {etat.phase === 'fin' && !enRetard && (
            <div className="panneau fin-carte">
              <h2>🏁 Arrivée !</h2>
              <p className="muted">{etat.evenements[etat.evenements.length - 1]?.texte}</p>
              <button className="btn btn-principal" onClick={() => onFin(etat)} autoFocus>Voir les résultats</button>
            </div>
          )}
          <div className="panneau classement" aria-live="polite">
            <div className="lbl">Classement · distance restante</div>
            {groupesRang.map((g) => (
            <div key={g.titre}>
            {g.titre && <div className="classement-cat">{g.titre === 'multicoques' ? 'Multicoques' : 'Monocoques'}</div>}
            <ol>
              {g.liste.map((b, i) => (
                <li key={b.id} className={b.id === moiId ? 'moi' : ''}>
                  <span className="muted">{i + 1}</span>
                  <span className="pastille-couleur" style={{ background: skipper(b.skipperId).couleurs.pion }} />
                  <span>
                    {noms[b.id]}
                    {b.type === 'ia' && <span className="muted"> · IA</span>}
                    {b.voilesPerdues.length > 0 && <span className="etat-badge">AVARIE</span>}
                    {b.passeTours > 0 && <span className="etat-badge">IMMOBILE</span>}
                    {b.choix?.cap === null && <span className="etat-badge">ABRI</span>}
                  </span>
                  <b>{b.arrive ? '🏁' : `${Math.round(distanceRestante(D, etat, b) * mpc)} mn`}</b>
                </li>
              ))}
            </ol>
            </div>
            ))}
          </div>
          {/* Pendant la lecture d'un tour, le texte de l'événement n'est plus répété ici : le journal de bord suffit (12/11/2026,
              demande du porteur de projet). Le bandeau ne sert plus qu'aux dés et à la consigne du tour. */}
          {bandeau && (des || deEvt || deRisque || deSpecial || !enRetard || (alerte && enRetard) || (annonce && enRetard)) && (
            <div className={`panneau bandeau ${des || deEvt || deRisque || deSpecial ? 'avec-des' : ''}`} role="status">
              {/* Dés du vent : un clic dessus passe au résultat suivant (13/11/2026, audit A2). */}
              {des && <div onClick={() => des.phase === 'resultat' && avancerDepuis(curseur)} style={{ cursor: des.phase === 'resultat' ? 'pointer' : undefined }}><DesVent {...des} /></div>}
              {deEvt && (
                <div className="des-vent" style={{ flexDirection: 'column', alignItems: 'center' }}>
                  <DeEvenement {...deEvt} />
                  {deEvt.attente && (
                    <>
                      <button className="btn btn-principal" style={{ marginTop: 8 }} onClick={() => {
                        // Plus court (13/11/2026, audit A3) : résultat à 0,7 s, suite à 1,7 s. La suite ne vaut que si la
                        // lecture en est toujours à ce dé (audit E2).
                        const k = 1 / vitesse, i = curseur;
                        setDeEvt({ ...deEvt, attente: false, phase: 'roule' });
                        window.setTimeout(() => setDeEvt((x) => x && { ...x, phase: 'resultat' }), 700 * k);
                        window.setTimeout(() => avancerDepuis(i), 1700 * k);
                      }}>🎲 Lancer le dé du large</button>
                      <label className="muted" style={{ marginTop: 6, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" checked={deAuto} onChange={(e) => { setDeAuto(e.target.checked); ecrireStockage(CLE_DE_AUTO, e.target.checked); }} />
                        Lancer mon dé tout seul les prochaines fois
                      </label>
                    </>
                  )}
                </div>
              )}
              {deRisque && <div className="des-vent"><DeRisque {...deRisque} /></div>}
              {deSpecial && <div className="des-vent"><DeSpecial {...deSpecial} /></div>}
              {alerte && enRetard && <div className="alerte-lecture">⚠ {alerte}</div>}
              {annonce && enRetard && <div className="alerte-lecture">{annonce}</div>}
              {!des && !deEvt && !deRisque && !deSpecial && !annonce && bandeau}
              {des && des.phase === 'resultat' && (
                <button className="btn btn-petit" style={{ marginTop: 8 }} onClick={() => avancerDepuis(curseur)}>Continuer →</button>
              )}
            </div>
          )}
          {avec3d && (
            <div className="vue3d" style={{ display: vue3d ? 'block' : 'none' }}>
              <div className="scene" ref={conteneur3d} />
              <div className="etiquettes" ref={etiquettes3d} />
              <div className="haut">
                <div className="panneau etapes">
                  <b>Tour {tourAffiche} · {vue3d?.titre ?? 'En course'}</b>
                </div>
                <div className="panneau" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Girouette direction={(vue3d?.vent ?? etat.vent).direction} taille={32} />
                  <div>
                    <div className="lbl">Nouveau vent</div>
                    <b>{NOMS_DIR_LONGS[(vue3d?.vent ?? etat.vent).direction]} · F{(vue3d?.vent ?? etat.vent).force}</b>
                  </div>
                </div>
              </div>
              <div className="panneau bas">
                <div className="lbl">{vue3d?.titre}</div>
                {alerte && <div className="alerte-lecture" style={{ marginTop: 6 }}>⚠ {alerte}</div>}
                <div style={{ marginTop: 6, fontWeight: 600 }}>{vue3d?.texte}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  {vue3d && <span key={dureeScene.id} className="barre-scene" style={{ animationDuration: `${dureeScene.ms / 1000}s` }} />}
                  <button className="btn btn-petit" onClick={passerScene3d}>Passer la scène ⏭</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Volet de droite (essai d'interface du 12/11/2026) : journal de bord, état du bateau, résolution du tour ; masquable. */}
        <aside className={`cote-droit ${coteOuvert ? '' : 'reduit'}`} aria-hidden={!coteOuvert}>
          {/* Aperçu 3D du bateau sous la voile choisie, dans le vent de sa zone (grand écran seulement). */}
          {recapId && !besoinPassation && (
            <Apercu3D etat={etat} bateauId={recapId} cap={joueurChoix?.id === recapId ? apercu.cap : null}
              voile={joueurChoix?.id === recapId ? apercu.voile : undefined} actif={coteOuvert && !vue3d} />
          )}
          {/* Puis la fiche du bateau, et le journal de bord dessous (demande du porteur de projet, 12/11/2026). */}
          {recapId && !besoinPassation && <RecapBateau etat={etat} bateauId={recapId} nom={noms[recapId]} sansVoiles />}
          <div className="cote-tete">
            <span className="lbl">Journal de bord</span>
            <button className="btn btn-petit fermer-cote" onClick={() => setCoteOuvert(false)} aria-label="Masquer le journal de bord" title="Masquer (plus de place pour la carte)">✕</button>
          </div>
          <ol className="journal-bord" aria-live="polite">
            {evsJournal.length === 0 && <li>Bon vent !</li>}
            {evsJournal.map((e, i) => (
              <li key={e.i} className={`${i === 0 ? 'recent' : ''} ${e.moi ? 'moi' : ''}`}>
                <span className="muted">T{e.ev.tour}</span> {e.ev.texte}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {lancement.tutoriel && (() => {
        const moi = humains[0];
        const evCourant = enRetard ? etat.evenements[curseur] : null;
        const front = moi ? frontSur(etat, moi.x, moi.y) : null;
        return (
          <Coach
            onQuitter={onQuitter}
            contexte={{
              phaseChoix: !!joueurChoix && !besoinPassation,
              capChoisi: apercu.cap !== null,
              voileChoisie: apercu.cap !== null && apercu.distance > 0,
              louvoyage: apercu.cap !== null && moi ? angleAllure(apercu.cap, ventCourant(etat, moi.x, moi.y).direction) < 45 : false,
              desVent: !!des,
              deEvenement: !!deEvt,
              carteDuLarge: !!carteVue,
              jetRisque: evCourant?.type === 'jet_risque' && evCourant.bateauId === moi?.id,
              quiz: attenteHumaine?.type === 'quiz',
              reparation: attenteHumaine?.type === 'reparation',
              dansFront: !!front && front.front.type !== 'molle' && front.zone === 'front',
              frontAnnonce: (etat.fronts ?? []).some((f) => f.annonce > 0),
              tour: etat.tour,
              fini: etat.phase === 'fin' && !enRetard,
            }}
          />
        );
      })()}
      {reglesOuvertes && (
        <div className="voile-fond regles-fond" role="dialog" aria-modal="true" aria-label="Règles du jeu">
          <div className="regles-modale">
            <Regles onRetour={() => setReglesOuvertes(false)} />
          </div>
        </div>
      )}
      {journalOuvert && <JournalMouvements etat={etat} onFermer={() => setJournalOuvert(false)} />}
      {briefing && <Briefing etat={etat} onFermer={() => setBriefing(false)} />}
      {besoinPassation && joueurChoix && <EcranPassation nom={joueurChoix.nom} onPret={() => setPassation(`${etat.tour}:${joueurChoix.id}`)} />}
      {attenteHumaine?.type === 'quiz' && (
        <ModaleQuiz key={attenteHumaine.questionId} attente={attenteHumaine} delai={reglages.delaiQuiz} envoiAuto={!!reseau} nom={noms[attenteHumaine.bateauId]} onRepondre={(r) => jouer({ type: 'RepondreQuiz', bateauId: attenteHumaine.bateauId, reponse: r })} />
      )}
      {carteVue && (() => {
        const carte = D.evenements!.cartes.find((c) => c.id === carteVue.carteId)!;
        const b = bateau(etat, carteVue.bateauId);
        const dernier = curseur === etat.evenements.length - 1;
        const decision = dernier && etat.attente?.type === 'reparation' && etat.attente.motif === 'evenement' && etat.attente.bateauId === b.id && (!reseau || reseau.moi === b.id);
        const fermer = () => {
          setCarteVue(null);
          setCurseur((c) => c + 1);
        };
        return (
          <ModaleCarteEvenement
            carte={carte}
            nom={noms[b.id]}
            couleur={skipper(b.skipperId).couleurs.spi}
            reparations={b.reparations}
            onReparer={decision ? (j) => { fermer(); jouer({ type: 'JouerReparation', bateauId: b.id, jouer: j }); } : undefined}
            onContinuer={fermer}
          />
        );
      })()}
      {attenteHumaine?.type === 'reparation' && !carteVue && (
        <ModaleReparation attente={attenteHumaine} b={bateau(etat, attenteHumaine.bateauId)} nom={noms[attenteHumaine.bateauId]} onRepondre={(j) => jouer({ type: 'JouerReparation', bateauId: attenteHumaine.bateauId, jouer: j })} />
      )}
      {attenteHumaine?.type === 'relance' && (
        <ModaleRelance attente={attenteHumaine} b={bateau(etat, attenteHumaine.bateauId)} etat={etat} nom={noms[attenteHumaine.bateauId]} onRepondre={(r) => jouer({ type: 'RepondreRelance', bateauId: attenteHumaine.bateauId, relancer: r })} />
      )}
      {avis3d && (
        <div className="voile-fond" onClick={() => setAvis3d(null)}>
          <div className="modale" onClick={(e) => e.stopPropagation()}>
            <div className="lbl">Vue 3D</div>
            <h2>{avis3d === 'perdue' ? "La vue 3D s'est interrompue" : "La vue 3D ne peut pas s'afficher sur cet appareil"}</h2>
            {avis3d === 'perdue' ? (
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                La carte graphique a retiré la vue 3D au navigateur (mémoire graphique insuffisante, autre application, mise en veille). Elle
                est coupée pour cette partie, qui reste jouable sur la carte ; recharger la page la rétablit.
              </p>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                Votre navigateur n'a pas accès à l'accélération graphique (WebGL), indispensable aux animations des bateaux en 3D. Le jeu reste
                jouable sur la carte. Pour l'activer dans Chrome ou Edge : <b>Paramètres › Système › « Utiliser l'accélération graphique si
                disponible »</b>, puis redémarrer le navigateur. Vérification possible sur la page <b>chrome://gpu</b> (ligne « WebGL »).
              </p>
            )}
            <button className="btn btn-principal" onClick={() => setAvis3d(null)}>Compris</button>
          </div>
        </div>
      )}
      {erreur && (
        <div className="voile-fond" onClick={() => setErreur(null)}>
          <div className="modale"><h2>Action impossible</h2><p>{erreur}</p><button className="btn" onClick={() => setErreur(null)}>OK</button></div>
        </div>
      )}
    </div>
  );
}


/** Message affiché quand la voile choisie devient inutilisable (demande du porteur de projet, 12/11/2026). */
const MESSAGE_BLOQUE = "Impossible d'avancer avec cette voile, vous allez tout casser !";

/** Voile d'avant plus petite hissée après l'affalage d'une voile inutilisable (animation seulement). */
function plusPetite(f: Forme | undefined): Forme {
  return f === 'j2' ? 'j3' : f === 'j3' || f === 'tourmentin' ? 'tourmentin' : 'j2';
}

function ResumeAttente({ etat, vus, enRetard, noms, onFin, moiId }: { etat: EtatPartie; vus: Evenement[]; enRetard: boolean; noms: Record<string, string>; onFin: () => void; moiId?: string }) {
  // Arrivée : le panneau « Voir les résultats » est posé sur la carte (toujours visible, même volet masqué).
  if (etat.phase === 'fin' && !enRetard) return null;
  const dernier = [...vus].reverse().find((e) => e.type === 'debut');
  // Toujours le vent de la zone où se trouve le joueur (alizés, front, molle…), jamais le vent général.
  const dv = [...vus].reverse().find((e) => e.type === 'vent')?.donnees as { apres?: Vent; locaux?: Record<string, { apres: Vent }> } | undefined;
  const ventVu = dv ? (moiId && dv.locaux?.[moiId]?.apres) || dv.apres : undefined;
  const bMoi = moiId ? etat.bateaux.find((x) => x.id === moiId) : undefined;
  const vent = enRetard && ventVu ? ventVu : bMoi ? ventCourant(etat, bMoi.x, bMoi.y) : etat.vent;
  return (
    <div className="meteo-sur-carte" title={`${nomBeaufort(D, vent.force)}. Les bateaux se déplacent dans l'ordre inverse du classement : le dernier bouge en premier.`}>
      <div className="girouette"><Girouette direction={vent.direction} force={vent.force} /></div>
      <div className="meteo-texte">
        <div className="meteo-vent">{NOMS_DIR[vent.direction]} · F{vent.force} <span className="muted">{nomBeaufort(D, vent.force).toLowerCase()}</span></div>
        <div className="meteo-ligne muted">
          {enRetard ? 'Résolution du tour' : 'En attente'}
          {dernier?.donnees && typeof dernier.donnees.risque === 'number' && (
            <> · {noms[dernier.bateauId!]} <PastilleRisque niveau={dernier.donnees.risque as number} /></>
          )}
        </div>
      </div>
    </div>
  );
}

export { formaterTemps };
