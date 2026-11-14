import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  angleAllure, appliquer, bateau, heuresParTour, classement, categorie, categoriesPartie, NOM_CATEGORIE, coteVent, creerPartie, distanceRestante, formaterTemps, humainsAttendus, vecteur,
  NOMS_DIR, NOMS_DIR_LONGS, nomBeaufort, nomSkipper, trajectoirePrevue, ventCourant, frontSur, DELAI_CHOIX_S, DELAI_DECISION_S, estMulticoque,
} from '@cal/engine';
import type { Action, Case, Choix, EtatPartie, Evenement, JoueurSalon, Vent } from '@cal/engine';
import { bateauDef, courseDef, D, definirCourseActive, Lancement, nomClasse, skipper, posExacte } from '../commun';
import Carte from '../jeu/Carte';
import TableauBord, { Girouette, PastilleRisque } from '../jeu/TableauBord';
import type { ApercuChoix } from '../jeu/TableauBord';
import { EcranPassation, ModaleQuiz, ModaleRelance, ModaleReparation } from '../jeu/Modales';
import { attenteAMontrer, cleAttente, etapeDuTour, NOM_ETAPE, recapIA, ventDuJoueur } from '../jeu/enchainement';
import { AllureKey, BateauScene, chargerModeles, Forme, modelesAcharger, modeleDuBateau, Scene3D } from '../jeu/scene3d';
import { bilanVent, BoussoleSpeciale, BoussolesLarge, DesVent, DeRisque, EtatDeRisque, EtatDeSpecial, Phase } from '../jeu/Des';
import ModaleCarteEvenement from '../jeu/CarteEvenement';
import RecapBateau from '../jeu/RecapBateau';
import Apercu3D from '../jeu/Apercu3D';
import Coach from '../jeu/Coach';
import JournalMouvements from '../jeu/JournalMouvements';
import Regles from './Regles';
import Briefing, { CLE_BRIEFING } from '../jeu/Briefing';
import { lireStockage } from '../commun';

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
  /** Dit au serveur que l'écran a fini de montrer les `n` premiers événements (le chrono peut partir, 13/11/2026). */
  lu?: (n: number) => void;
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
  // Dés du large de tous les joueurs, en boussoles qui tournent ensemble (13/11/2026).
  const [boussoles, setBoussoles] = useState<{ lancers: { nom: string; valeur: number }[]; phase: Phase } | null>(null);
  const [deRisque, setDeRisque] = useState<EtatDeRisque | null>(null);
  const [deSpecial, setDeSpecial] = useState<EtatDeSpecial | null>(null);
  const [carteVue, setCarteVue] = useState<{ carteId: string; bateauId: string } | null>(null);
  const [vitesse, setVitesse] = useState(1);
  const [passation, setPassation] = useState<string | null>(null);
  const [apercu, setApercu] = useState<ApercuChoix>({ cap: null, distance: 0, max: 0, choisir: null });
  const [centrer, setCentrer] = useState(0);
  const [dureeScene, setDureeScene] = useState({ id: 0, ms: 0 }); // barre de temps de la scène 3D
  const [vue3d, setVue3d] = useState<{
    bateauId: string; etape: number; texte: string; vent: { direction: number; force: number }; titre?: string;
    /** Scène en format carte, l'explication dessous (affalage, perte de voile, décision de réparation ; 13/11/2026). */
    carte?: boolean;
    /** Décision de réparation qui coûterait une voile : les deux choix sous la scène. */
    decision?: { reparer: string; endurer: string; explication: string };
  } | null>(null);
  /** Voile déjà vue lâcher dans la carte de la décision (« bateau:tour ») : sa scène n'est pas rejouée pour ce joueur. */
  const voileDejaMontree = useRef<string | null>(null);
  /** Moments de course racontés en 3D (au plus un par tour). */
  const momentFort = (ev: Evenement, humain: boolean): string | null => {
    switch (ev.type) {
      case 'depassement': return 'Dépassement !';
      case 'a_vue': return 'Navigation à vue';
      case 'voile_perdue': return 'Avarie de voile';
      // Événement qui contraint la course : toujours expliqué et animé (demande du porteur de projet, 12/11/2026).
      // Seule la voile inutilisable porte des données (voile, cap, vent) ; une carte du large qui immobilise n'en a pas
      // (13/11/2026, audit E1 : elle était présentée à tort comme une voile inutilisable).
      case 'bloque': return humain && ev.donnees ? ((ev.donnees as { nouvelle?: string }).nouvelle ? 'Changement de voile' : 'Voile inutilisable') : null;
      // Démâtage et chavirage (14/11/2026) : scène en format carte, rejouée pour les autres joueurs.
      case 'demate': return 'Démâtage !';
      case 'naufrage': return 'Chavirage !';
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
  const PRIORITE: Partial<Record<Evenement['type'], number>> = { voile_perdue: 4, bloque: 4, demate: 5, naufrage: 5, collision: 4, arrivee: 5, depassement: 3, a_vue: 2, debut: 1 };
  /** Moments de voile (perdue, inutilisable) : leur scène se joue au moment où ils arrivent, pas en fin de tour. */
  const sceneAuMoment = (ev: Evenement) => ev.type === 'voile_perdue' || ev.type === 'bloque' || ev.type === 'demate' || ev.type === 'naufrage';
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
  /** Tour dont le récapitulatif des IA au large a déjà été montré. */
  const recapFait = useRef(0);
  /** Décision à laquelle le joueur vient de répondre : sa fenêtre ne revient pas en attendant la réponse du serveur. */
  const [envoyee, setEnvoyee] = useState<string | null>(null);
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
    setAlerte(bloque ? (ev.donnees && !(ev.donnees as { nouvelle?: string }).nouvelle ? MESSAGE_BLOQUE : ev.texte) : null);
    if (bloque) duree = (ev.donnees ? 5000 : 2500) * k;
    if (ev.type !== 'vent') setDes(null);
    if (ev.type !== 'de_evenement') setBoussoles(null);
    if (ev.type !== 'jet_risque') setDeRisque(null);
    setDeSpecial(null);
    const fin = () => () => {
      annule = true;
      timers.forEach(clearTimeout);
    };
    // Audit de l'enchaînement (13/11/2026, validé par le porteur de projet) :
    // 1. Entre « Le large » et « La course » : ce que les IA ont fait au large, en une phrase (2,5 s).
    if (!rejouer && !depuisFile && recapFait.current !== ev.tour && etapeDuTour(etat.evenements, indexEv) === 'course'
      && etapeDuTour(etat.evenements, indexEv - 1) !== 'course') {
      recapFait.current = ev.tour;
      const r = recapIA(etat, ev.tour);
      if (r) {
        setAnnonce(r);
        timers.push(window.setTimeout(() => !annule && setRejoue((x) => x + 1), 2500 * k));
        return fin();
      }
    }
    const pourMoi = humain && (!reseau || ev.bateauId === reseau.moi);
    // 2. Temps écoulé en réseau : le serveur a choisi ou répondu à la place du joueur ; on le lui dit clairement (4 s).
    if (pourMoi && reseau && ev.type === 'info' && ev.texte.startsWith('Temps écoulé')) {
      const choix = etat.evenements.slice(indexEv + 1).find((x) => x.bateauId === ev.bateauId && x.tour === ev.tour && x.type === 'debut')?.donnees as { cap?: number; voile?: string | null } | undefined;
      const voileNom = choix?.voile ? D.voiles.find((v) => v.id === choix.voile)?.nom ?? choix.voile : null;
      setAnnonce(ev.texte.includes('routeur') && choix?.cap !== undefined
        ? `⏱ Temps écoulé : le routeur a choisi pour vous le cap ${NOMS_DIR[choix.cap]}${voileNom ? ` sous ${voileNom}` : ''}.`
        : `⏱ ${ev.texte}`);
      duree = 4000 * k;
    }
    // 3. Départ du bateau du joueur : la distance prévue au choix et la distance possible après les dés, avec la raison.
    if (pourMoi && ev.type === 'debut') {
      const dd = ev.donnees as { distance: number; prevu?: number; vent: Vent; ventPrevu?: Vent; max?: number };
      // Distance limitée par le joueur : on compare ce qu'il visait à ce qu'il pourra faire, chacun borné par sa limite.
      const plan = dd.prevu === undefined ? undefined : Math.min(dd.prevu, dd.max ?? Infinity);
      const reel = Math.min(dd.distance, dd.max ?? Infinity);
      if (plan !== undefined && Math.abs(plan - reel) >= Math.max(1, plan * 0.1)) {
        const raisons: string[] = [];
        if (dd.ventPrevu && dd.ventPrevu.force !== dd.vent.force) raisons.push(`le vent a ${dd.vent.force > dd.ventPrevu.force ? 'forci' : 'faibli'} (F${dd.ventPrevu.force} → F${dd.vent.force})`);
        if (dd.ventPrevu && dd.ventPrevu.direction !== dd.vent.direction) raisons.push(`il a tourné (${NOMS_DIR[dd.ventPrevu.direction]} → ${NOMS_DIR[dd.vent.direction]})`);
        setAnnonce(`🧭 ${noms[ev.bateauId!]} : ${Math.round(plan * mpc)} milles prévus au choix, ${Math.round(reel * mpc)} possibles${raisons.length ? ` : ${raisons.join(', ')}` : ''}.`);
        duree = 3000 * k;
      }
    }

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
      // Dés du large de tous les bateaux, lancés ensemble par le moteur (13/11/2026, demande du porteur de projet) : une
      // boussole par joueur, toutes ensemble, 3 s en tout, sans clic, au même moment pour tous en réseau. Les dés des IA ne
      // sont pas montrés : leurs cartes et leurs questions suivent.
      let j = curseur;
      const lancers: { nom: string; valeur: number }[] = [];
      for (; j < etat.evenements.length; j++) {
        const x = etat.evenements[j];
        if (x.type !== 'de_evenement' || x.tour !== ev.tour) break;
        if (etat.bateaux.find((o) => o.id === x.bateauId)?.type === 'humain') lancers.push({ nom: noms[x.bateauId!], valeur: (x.donnees as { de: number }).de });
      }
      if (!rejouer && !depuisFile) saut = Math.max(1, j - curseur);
      if (lancers.length && !rejouer && !depuisFile) {
        setBoussoles({ lancers, phase: 'apparition' });
        timers.push(window.setTimeout(() => !annule && setBoussoles({ lancers, phase: 'roule' }), 120 * k));
        timers.push(window.setTimeout(() => !annule && setBoussoles({ lancers, phase: 'resultat' }), 2400 * k));
        // Le résultat reste lisible 1,6 s (une seconde de plus le 14/11/2026, demande du porteur de projet).
        duree = 4000 * k;
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
    } else if (ev.type === 'voile_perdue' && voileDejaMontree.current === `${ev.bateauId}:${ev.tour}`) {
      // Le joueur a vu sa voile lâcher dans la carte de sa décision (13/11/2026) : pas de seconde scène pour lui.
      voileDejaMontree.current = null;
      duree = 1500 * k;
    } else if (avec3d && !tourMonde && !depuisFile && !rejouer && momentFort(ev, humain) && (humain || impliqueHumain(ev)) && !sceneAuMoment(ev)) {
      // Audit de l'enchaînement (13/11/2026, validé par le porteur de projet) : au plus une scène 3D par tour, jouée en fin
      // de tour, celle du moment le plus fort (coup de vent, dépassement, arrivée…). Les voiles perdues ou inutilisables
      // gardent la leur, au moment où elles arrivent.
      const p = PRIORITE[ev.type] ?? 0;
      const q = fileScenes.current[0];
      if (q === undefined || etat.evenements[q]?.tour !== ev.tour || p > (PRIORITE[etat.evenements[q].type] ?? 0)) fileScenes.current = [curseur];
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
          affalage: ev.type === 'bloque' && o.id === ev.bateauId && voileId
            ? ((D.voiles.find((v) => v.id === (ev.donnees as { nouvelle?: string })?.nouvelle)?.forme_3d as Forme | undefined) ?? plusPetite(D.voiles.find((v) => v.id === voileId)?.forme_3d as Forme))
            : undefined,
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
      const precedent = etat.evenements[indexEv - 1];
      const surtoile = ev.type === 'voile_perdue' && precedent?.type === 'jet_risque' && precedent.bateauId === ev.bateauId && !!(precedent.donnees as { noir?: boolean } | undefined)?.noir;
      setVue3d({
        bateauId: focus.id, etape: 2, texte: surtoile ? `${precedent.texte} ${ev.texte}` : ev.texte, vent, titre: surtoile ? 'Trop de toile !' : titre,
        carte: ev.type === 'bloque' || ev.type === 'voile_perdue' || ev.type === 'demate' || ev.type === 'naufrage',
      });
      // Démâtage : le mât casse sous les yeux du joueur ; chavirage : le bateau se couche (14/11/2026).
      if (ev.type === 'demate') timers.push(window.setTimeout(() => !annule && scene3dRef.current?.casserMat(), 1800 * k));
      if (ev.type === 'naufrage') timers.push(window.setTimeout(() => !annule && scene3dRef.current?.chavirerMaintenant(), 1500 * k));
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
          titre: `Dé de tempête · F${dt.force}`, valeur: dt.de, mauvais: !!dt.touche, faces: dt.faces ?? [],
          message: `${nomB} est au cœur d'une tempête de force ${dt.force} : son gréement souffre !`,
          regle: `${nomB} : ${multi ? 'chavirage' : 'démâtage'} si le dé fait ${(dt.faces ?? []).join(', ')}`,
          resultat: dt.touche ? (multi ? 'Chavirage !' : 'Démâtage !') : 'Le bateau tient bon.', phase: 'apparition',
        }
        : {
          titre: 'Dé du pot-au-noir', valeur: dt.de, mauvais: dt.de % 2 === 1, faces: [1, 3, 5],
          regle: `${nomB} est encalminé : pair, il repart ; impair, il passe son tour`,
          resultat: dt.de % 2 === 1 ? 'Impair : il reste encalminé.' : 'Pair : il attrape un souffle et repart !', phase: 'apparition',
        };
      setDeSpecial(base);
      // Boussole (14/11/2026) : elle tourne 2,3 s, puis le résultat reste lisible.
      timers.push(window.setTimeout(() => !annule && setDeSpecial({ ...base, phase: 'roule' }), 150 * k));
      timers.push(window.setTimeout(() => !annule && setDeSpecial({ ...base, phase: 'resultat' }), 2450 * k));
      duree = 5200 * k;
    } else if (ev.type === 'jet_risque' && humain) {
      // Le dé rouge de risque, montré comme les dés du vent : il roule, puis la règle et le résultat s'affichent.
      const dr = ev.donnees as { de?: number; seuil?: number; niveau: number; declenche?: boolean; noir?: boolean };
      // Trop de toile (14/11/2026) : plus de visuel « case noire » ; la scène 3D de la voile qui lâche raconte tout.
      if (dr.noir) duree = 300 * k;
      else {
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
      }
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
        // Les IA bougent ensemble en 1,2 s au moins, pour qu'on les voie (audit de l'enchaînement, 13/11/2026).
        const t2 = Math.max(humain ? 300 : 1200, (humain ? 140 : 70) * chemin.length) * k;
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
    // Fin du tour : seulement si le tour est complet (en réseau, la suite peut attendre la décision d'un joueur).
    const dernierDuTour = !depuisFile && (curseur + 1 >= etat.evenements.length ? etat.phase !== 'resolution' : etat.evenements[curseur + 1].tour !== ev.tour);
    if (dernierDuTour && fileScenes.current.length) {
      // Au plus une scène par tour : pas de scène de fin de tour moins forte qu'une scène de voile déjà jouée.
      if (!tourMonde) fileScenes.current = fileScenes.current.filter((i) => !(tour3d.current.tour === etat.evenements[i].tour && (PRIORITE[etat.evenements[i].type] ?? 0) <= tour3d.current.prio));
      if (fileScenes.current.length) finDeTour.current = true;
    }
    timers.push(window.setTimeout(() => { if (annule) return; if (rejouer || finDeTour.current) setRejoue((r) => r + 1); else setCurseur((c) => c + saut); }, duree));
    return () => {
      annule = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curseur, enRetard, vitesse, rejoue]);

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
  // Réseau : l'écran a fini de montrer le tour ; le serveur peut lancer le chrono du choix ou de la décision (audit de
  // l'enchaînement, 13/11/2026 : avant, il partait pendant l'animation et le routeur choisissait parfois à la place du joueur).
  useEffect(() => {
    if (reseau && aJour) reseau.lu?.(etat.evenements.length);
  }, [aJour, etat.evenements.length, !!reseau]);
  const joueurChoix = aJour && etat.phase === 'choix'
    ? (reseau ? humainsAttendus(etat).find((b) => b.id === reseau.moi) ?? null : humainsAttendus(etat)[0] ?? null)
    : null;
  const besoinPassation = !reseau && joueurChoix && plusieursHumains && passation !== `${etat.tour}:${joueurChoix.id}`;
  // Décision (question, relance, réparation) : à son moment, quand l'animation y arrive, et une seule fois, dans tous les
  // modes (audit de l'enchaînement, 13/11/2026). L'affichage d'avance en réseau (audit C1) montrait la carte du large
  // deux fois et les questions avant le dé qui les provoque.
  const attenteHumaine = attenteAMontrer(etat, curseur, reseau ? { moi: reseau.moi } : null, envoyee);
  /** Répond à une décision : la fenêtre se ferme tout de suite, sans revenir pendant que le serveur traite la réponse. */
  const repondre = (a: Action) => {
    setEnvoyee(cleAttente(etat));
    jouer(a);
  };
  // Même écran : la décision d'un joueur est précédée de « Je suis X », comme le choix du cap (audit E10).
  const [passationDecision, setPassationDecision] = useState<string | null>(null);
  const besoinPassationDecision = !reseau && plusieursHumains && !!attenteHumaine && passationDecision !== cleAttente(etat);

  // Décision de réparation qui coûterait une voile (13/11/2026, demande du porteur de projet) : la scène 3D, en format
  // carte, montre le bateau sous cette voile, avec l'explication et le choix dessous ; « Endurer » fait lâcher la voile.
  const decisionVoile = (() => {
    const a = etat.attente;
    if (!avec3d || !a || a.type !== 'reparation' || (reseau && a.bateauId !== reseau.moi)) return null;
    const b = bateau(etat, a.bateauId);
    if (b.type !== 'humain') return null;
    const carte = a.motif === 'evenement' ? D.evenements?.cartes.find((c) => c.id === a.carteId) : undefined;
    const voile = a.motif === 'evenement'
      ? carte?.effet.perte_voile?.find((v) => b.voiles.includes(v))
      : (a.motif === 'penalite' && a.penalite === 'perte_voile') || a.motif === 'voile_noire' ? b.choix?.voile ?? undefined : undefined;
    if (!voile) return null;
    // Au bon moment : la carte du large vient d'être tirée (lecture arrêtée sur elle), ou la lecture est arrivée au bout.
    const surLaCarte = !!carteVue && carteVue.bateauId === b.id && carteVue.carteId === a.carteId && curseur === etat.evenements.length - 1;
    if (!surLaCarte && (enRetard || !attenteHumaine)) return null;
    if (cleAttente(etat) === envoyee || besoinPassationDecision) return null;
    return { b, motif: a.motif, carte, voile, surLaCarte };
  })();
  const cleDecisionVoile = decisionVoile ? `${decisionVoile.b.id}:${etat.tour}:${decisionVoile.motif}:${decisionVoile.voile}` : null;
  useEffect(() => {
    if (!decisionVoile) return;
    const { b, voile, carte, motif } = decisionVoile;
    const vent = ventCourant(etat, b.x, b.y);
    const cap = b.choix?.cap ?? b.dernierCap ?? 12;
    const s = skipper(b.skipperId);
    const nomVoile = (D.voiles.find((v) => v.id === voile)?.nom ?? voile).toLowerCase();
    scene3dRef.current?.afficher([{
      nom: noms[b.id], moi: true, coque: s.couleurs.coque, bandes: s.couleurs.bandes, spi: s.couleurs.spi, numero: s.numero_voile,
      allure: allure3d(Math.max(45, angleAllure(cap, vent.direction))), forme: (D.voiles.find((v) => v.id === voile)?.forme_3d ?? 'j2') as Forme,
      sansVoileAvant: false, ris: 0, perteVoile: false, cote: coteVent(cap, vent.direction) || 1, off: [0, 0], vitesse: 8,
      modele: modeleDuBateau(b.famille, bateauDef(b.bateauId)?.modele_3d), classe: D.familles.find((f) => f.id === b.famille)?.classe,
    }], vent.force);
    scene3dRef.current?.demarrer();
    const n = b.reparations;
    const titre = carte ? `${carte.icone} ${carte.titre}` : motif === 'voile_noire' ? `Trop de toile : votre ${nomVoile} lâche !` : 'Avarie de voile';
    // Multicoque (14/11/2026, option A) : le largueur automatique évite le chavirage, la voile lâche quand même.
    const largueur = estMulticoque(D, b) ? 'Le largueur automatique choque l\'écoute : le multicoque ne chavire pas, mais la voile lâche. ' : '';
    const texte = carte ? carte.texte : motif === 'voile_noire' ? `${largueur || 'Le vent est trop fort pour cette voile : elle lâche. '}Ce tour, le bateau ne fait qu'un tiers de sa route, sans dé du large.` : `Incident : sans réparation, vous perdez votre ${nomVoile}.`;
    const decision = motif === 'voile_noire'
      ? { reparer: `🔧 Carte réparation : repêcher la voile (+40 % d'usure)`, endurer: 'Sans carte : la voile est perdue', explication: `Une carte réparation repêche la voile, réparée tant bien que mal. Il vous reste ${n} carte${n > 1 ? 's' : ''} réparation.` }
      : carte
      ? { reparer: '🔧 Réparer : garder la voile, sans avancer', endurer: `Endurer : perdre ${nomVoile.startsWith('spi') ? 'le' : 'la'} ${nomVoile}, avancer de moitié`, explication: `Il vous reste ${n} carte${n > 1 ? 's' : ''} réparation.` }
      : { reparer: '🔧 Jouer une réparation', endurer: 'Endurer : perdre la voile', explication: `Il vous reste ${n} carte${n > 1 ? 's' : ''} réparation.` };
    // La voile lâche d'abord sous les yeux du joueur, puis vient le choix de la carte réparation (14/11/2026, porteur de
    // projet) : la scène de la voile perdue n'est pas rejouée ensuite pour ce joueur.
    voileDejaMontree.current = `${b.id}:${etat.tour}`;
    setVue3d({ bateauId: b.id, etape: 2, titre, texte, vent, carte: true });
    const k = 1 / vitesse;
    const t1 = window.setTimeout(() => scene3dRef.current?.lacherVoile(), 1200 * k);
    const t2 = window.setTimeout(() => setVue3d((v) => (v && v.bateauId === b.id ? { ...v, decision } : v)), 3200 * k);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleDecisionVoile]);
  /** Choix fait dans la carte : réparer tout de suite ; endurer après avoir vu la voile lâcher (3 s). */
  const deciderVoile = (reparer: boolean) => {
    if (!decisionVoile || !vue3d?.decision) return;
    const { b, surLaCarte } = decisionVoile;
    // Avec ou sans carte réparation, le choix ferme la fenêtre (la voile a déjà lâché dans la scène).
    setVue3d(null);
    scene3dRef.current?.arreter();
    if (surLaCarte) { setCarteVue(null); setCurseur((c) => c + 1); }
    repondre({ type: 'JouerReparation', bateauId: b.id, jouer: reparer });
  };
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

  // Jamais de scène 3D pendant le choix du cap ou l'attente des autres (capture du porteur de projet du 13/11/2026 : titre
  // « Dépassement ! » resté affiché sous « en attente de »).
  useEffect(() => {
    if (!joueurChoix && !attenteAutres.length) return;
    setVue3d(null);
    scene3dRef.current?.arreter();
  }, [!!joueurChoix, attenteAutres.length]);

  // Démâté, le bateau du joueur rentre au port sous gréement de fortune : il n'a rien à choisir (14/11/2026).
  const rapatrie = recapIdAvant(etat, reseau?.moi ?? null);
  useEffect(() => {
    if (!enRetard && rapatrie?.rapatriement) setBandeau(`⚓ ${rapatrie.nom} rentre à ${rapatrie.rapatriement.nom} sous gréement de fortune, 250 milles par tour au plus.`);
  }, [enRetard, rapatrie?.id, rapatrie?.rapatriement?.nom, etat.tour]);
  useEffect(() => {
    if (joueurChoix && !besoinPassation) setBandeau(`Tour ${etat.tour} : ${plusieursHumains ? joueurChoix.nom + ', ' : ''}choisissez un cap (sur la rose, ou en touchant la mer) puis une voile.${resumeIA}`);
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
  // Vent du joueur à l'instant montré : le même sur la girouette de la carte et sous le bateau 3D (13/11/2026).
  const ventJoueur = ventDuJoueur(etat, curseur, recapId);
  const rang = classement(D, etat);
  // Flotte Vintage mêlant monocoques et multicoques : un classement par catégorie (décision du 10/11/2026).
  const cats = categoriesPartie(D, etat);
  const groupesRang = cats ? cats.map((c) => ({ titre: NOM_CATEGORIE[c], liste: rang.filter((b) => categorie(D, b) === c) })) : [{ titre: '', liste: rang }];
  const course = courseDef(etat.params.courseId);
  const tourAffiche = enRetard ? etat.evenements[curseur].tour : etat.tour;
  // Étape du tour annoncée à côté du numéro du tour (audit de l'enchaînement, 13/11/2026).
  // Pendant une décision (animation arrivée au bout, tour pas fini), l'étape reste celle du dernier événement montré.
  const etapeLue = enRetard ? etapeDuTour(etat.evenements, curseur) : etat.phase === 'resolution' ? etapeDuTour(etat.evenements, etat.evenements.length - 1) : null;
  const etapeAffichee = etapeLue ? NOM_ETAPE[etapeLue] : !enRetard && etat.phase === 'choix' ? 'Choix du cap' : null;
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
          <span className="puce garde">Tour <b>{tourAffiche}</b>{etapeAffichee && <> · <b>{etapeAffichee}</b></>}</span>
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
              <ResumeAttente etat={etat} vus={etat.evenements.slice(0, curseur)} enRetard={enRetard} noms={noms} onFin={() => onFin(etat)} moiId={recapId} vent={ventJoueur} />
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
          {/* Une seule zone de messages en bas de la carte : ils s'empilent au lieu de se recouvrir (audit de l'enchaînement,
              13/11/2026). */}
          <div className="zone-messages">
          {reseau && attenteAutres.length > 0 && (
            <div className="panneau attente-reseau">
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
            <div className="alerte-front annonce">
              ⏱ Plus que {resteEcheance} s : {joueurChoix ? 'ensuite le routeur choisira votre cap et votre voile pour ce tour.' : 'ensuite la réponse par défaut sera jouée.'}
            </div>
          )}
          {reseau && !reseau.connecte && <div className="alerte-front annonce">Connexion perdue : reconnexion en cours…</div>}
          {reseau?.erreur && (
            <div className="alerte-front annonce" role="alert" onClick={() => reseau.effacerErreur?.()} style={{ cursor: 'pointer' }}>
              Le serveur a refusé : {reseau.erreur} <span className="muted">(toucher pour fermer)</span>
            </div>
          )}
          </div>
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
          {bandeau && (des || boussoles || deRisque || deSpecial || !enRetard || (alerte && enRetard) || (annonce && enRetard)) && (
            <div className={`panneau bandeau ${des || boussoles || deRisque || deSpecial ? 'avec-des' : ''}`} role="status">
              {/* Dés du vent : un clic dessus passe au résultat suivant (13/11/2026, audit A2). */}
              {des && <div onClick={() => des.phase === 'resultat' && avancerDepuis(curseur)} style={{ cursor: des.phase === 'resultat' ? 'pointer' : undefined }}><DesVent {...des} /></div>}
              {boussoles && <div className="des-vent"><BoussolesLarge {...boussoles} /></div>}
              {deRisque && <div className="des-vent"><DeRisque {...deRisque} /></div>}
              {deSpecial && <div className="des-vent"><BoussoleSpeciale {...deSpecial} /></div>}
              {alerte && enRetard && <div className="alerte-lecture">⚠ {alerte}</div>}
              {annonce && enRetard && <div className="alerte-lecture">{annonce}</div>}
              {!des && !boussoles && !deRisque && !deSpecial && !annonce && bandeau}
              {des && des.phase === 'resultat' && (
                <button className="btn btn-petit" style={{ marginTop: 8 }} onClick={() => avancerDepuis(curseur)}>Continuer →</button>
              )}
            </div>
          )}
          {avec3d && (
            <>{vue3d?.carte && <div className="fond-carte3d" />}<div className={`vue3d ${vue3d?.carte ? 'en-carte' : ''}`} style={{ display: vue3d ? 'block' : 'none' }}>
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
                {vue3d?.decision ? (
                  <>
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{vue3d.decision.explication}</div>
                    <div className="barre-actions" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => deciderVoile(false)}>{vue3d.decision.endurer}</button>
                      <button className="btn btn-orange" onClick={() => deciderVoile(true)} autoFocus>{vue3d.decision.reparer}</button>
                    </div>
                  </>
                ) : decisionVoile ? null : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    {vue3d && <span key={dureeScene.id} className="barre-scene" style={{ animationDuration: `${dureeScene.ms / 1000}s` }} />}
                    <button className="btn btn-petit" onClick={passerScene3d}>Passer la scène ⏭</button>
                  </div>
                )}
              </div>
            </div></>
          )}
        </div>

        {/* Volet de droite (essai d'interface du 12/11/2026) : journal de bord, état du bateau, résolution du tour ; masquable. */}
        <aside className={`cote-droit ${coteOuvert ? '' : 'reduit'}`} aria-hidden={!coteOuvert}>
          {/* Aperçu 3D du bateau sous la voile choisie, dans le vent de sa zone (grand écran seulement). */}
          {recapId && !besoinPassation && (
            <Apercu3D etat={etat} bateauId={recapId} vent={ventJoueur} cap={joueurChoix?.id === recapId ? apercu.cap : null}
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
              deEvenement: !!boussoles,
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
      {besoinPassationDecision && attenteHumaine && !carteVue && (
        <EcranPassation nom={bateau(etat, attenteHumaine.bateauId).nom} onPret={() => setPassationDecision(cleAttente(etat))} />
      )}
      {attenteHumaine?.type === 'quiz' && !besoinPassationDecision && (
        <ModaleQuiz key={attenteHumaine.questionId} attente={attenteHumaine} delai={reglages.delaiQuiz} envoiAuto={!!reseau} nom={noms[attenteHumaine.bateauId]} onRepondre={(r) => repondre({ type: 'RepondreQuiz', bateauId: attenteHumaine.bateauId, reponse: r })} />
      )}
      {carteVue && !decisionVoile?.surLaCarte && (() => {
        const carte = D.evenements!.cartes.find((c) => c.id === carteVue.carteId)!;
        const b = bateau(etat, carteVue.bateauId);
        // Décision de réparation liée à CETTE carte (et non « dernier événement » : un message du serveur peut suivre la
        // carte, et la décision passait alors dans une seconde fenêtre qui remontrait la carte).
        const att = etat.attente;
        const decision = att?.type === 'reparation' && att.motif === 'evenement' && att.bateauId === b.id && att.carteId === carteVue.carteId
          && cleAttente(etat) !== envoyee && (!reseau || reseau.moi === b.id);
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
            onReparer={decision ? (j) => { fermer(); repondre({ type: 'JouerReparation', bateauId: b.id, jouer: j }); } : undefined}
            onContinuer={fermer}
          />
        );
      })()}
      {attenteHumaine?.type === 'reparation' && !carteVue && !besoinPassationDecision && !decisionVoile && (() => {
        const b = bateau(etat, attenteHumaine.bateauId);
        const carte = attenteHumaine.motif === 'evenement' && attenteHumaine.carteId ? D.evenements?.cartes.find((c) => c.id === attenteHumaine.carteId) : undefined;
        // Carte du large que l'animation n'a pas montrée (reconnexion, « Passer l'animation ») : la carte entière, avec son choix.
        return carte
          ? <ModaleCarteEvenement carte={carte} nom={noms[b.id]} couleur={skipper(b.skipperId).couleurs.spi} reparations={b.reparations} onReparer={(j) => repondre({ type: 'JouerReparation', bateauId: b.id, jouer: j })} />
          : <ModaleReparation attente={attenteHumaine} b={b} nom={noms[b.id]} onRepondre={(j) => repondre({ type: 'JouerReparation', bateauId: b.id, jouer: j })} />;
      })()}
      {attenteHumaine?.type === 'relance' && !besoinPassationDecision && (
        <ModaleRelance attente={attenteHumaine} b={bateau(etat, attenteHumaine.bateauId)} etat={etat} nom={noms[attenteHumaine.bateauId]} onRepondre={(r) => repondre({ type: 'RepondreRelance', bateauId: attenteHumaine.bateauId, relancer: r })} />
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
/** Bateau du joueur (réseau : le sien ; sinon le premier humain) : sert au message de rapatriement. */
function recapIdAvant(etat: EtatPartie, moi: string | null) {
  return etat.bateaux.find((b) => (moi ? b.id === moi : b.type === 'humain' && !b.arrive && !b.horsClassement)) ?? null;
}

const MESSAGE_BLOQUE = "Impossible d'avancer avec cette voile, vous allez tout casser !";

/** Voile d'avant plus petite hissée après l'affalage d'une voile inutilisable (animation seulement). */
function plusPetite(f: Forme | undefined): Forme {
  return f === 'j2' ? 'j3' : f === 'j3' || f === 'tourmentin' ? 'tourmentin' : 'j2';
}

function ResumeAttente({ etat, vus, enRetard, noms, onFin, moiId, vent }: { etat: EtatPartie; vus: Evenement[]; enRetard: boolean; noms: Record<string, string>; onFin: () => void; moiId?: string | null; vent: Vent }) {
  // Arrivée : le panneau « Voir les résultats » est posé sur la carte (toujours visible, même volet masqué).
  if (etat.phase === 'fin' && !enRetard) return null;
  // Seulement le joueur (13/11/2026, demande du porteur de projet) : le vent de sa zone (`vent`, le même que sous le bateau
  // 3D) et, une fois son départ montré dans ce tour, son risque ; plus le nom et le risque du dernier bateau parti.
  const tourLu = vus[vus.length - 1]?.tour;
  const dernier = moiId && enRetard ? [...vus].reverse().find((e) => e.type === 'debut' && e.bateauId === moiId && e.tour === tourLu) : undefined;
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
