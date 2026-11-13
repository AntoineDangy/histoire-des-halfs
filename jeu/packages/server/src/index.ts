// Serveur de salons du jeu « Course au large » : un Worker Cloudflare qui crée les salons,
// et un Durable Object « Salon » par partie, qui garde l'état et arbitre la course.
import { DurableObject } from 'cloudflare:workers';
import { donneesBrutes } from '../../data/index';
import {
  angleAllure, appliquer, ATTENTE_ANIMATION_MAX_S, bateau, choisirIA, chronoPeutPartir, competence, creerPartie, decisionReparationIA, DELAI_CHOIX_S, DELAI_DECISION_S, humainsAttendus, masquerEtat, MAX_HUMAINS,
  NIVEAU_QUIZ_DEFAUT, niveauQuizValide, nomSkipper, reglagesSalonValides,
} from '../../engine/src/index';
import type { Action, Donnees, EtatPartie, JoueurSalon, MessageClient, MessageServeur, ParticipantParams, ReglagesSalon, VueSalon } from '../../engine/src/index';

const D = donneesBrutes as unknown as Donnees;

interface Env {
  SALONS: DurableObjectNamespace<Salon>;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

function codeAleatoire(): string {
  const lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => lettres[Math.floor(Math.random() * lettres.length)]).join('');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    // Création d'un salon : renvoie son code.
    if (url.pathname === '/api/salons' && req.method === 'POST') {
      const code = codeAleatoire();
      const reglages = (await req.json().catch(() => ({}))) as Partial<ReglagesSalon>;
      const stub = env.SALONS.get(env.SALONS.idFromName(code));
      await stub.initialiser(code, reglages);
      return Response.json({ code }, { headers: CORS });
    }
    // Connexion WebSocket à un salon : /api/salons/ABCD/ws
    const m = url.pathname.match(/^\/api\/salons\/([A-Z]{4})\/ws$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426, headers: CORS });
      const stub = env.SALONS.get(env.SALONS.idFromName(m[1]));
      return stub.fetch(req);
    }
    if (url.pathname === '/') return new Response('Serveur de salons « Course au large » : en ligne.', { headers: CORS });
    return new Response('Introuvable', { status: 404, headers: CORS });
  },
};

interface DonneesSalon {
  code: string;
  reglages: ReglagesSalon;
  /** bateauConfie : bateau confié à l'IA pendant l'absence du joueur, qu'il reprend en revenant (13/11/2026, audit C6). */
  joueurs: (JoueurSalon & { jeton: string; bateauConfie?: string })[];
  etat: EtatPartie | null;
  /**
   * Attente en cours (choix des caps, ou décision d'un joueur) et heure à laquelle le serveur jouera par défaut (audit C2).
   * Depuis le 13/11/2026 (audit de l'enchaînement) : `depuis` (début de l'attente) et `demarre` (le chrono ne part qu'une
   * fois l'animation finie sur les écrans des joueurs attendus) ; une attente enregistrée avant n'a ni l'un ni l'autre.
   */
  attente?: { cle: string; echeance: number; depuis?: number; demarre?: boolean } | null;
  /** Nombre d'événements de la partie que l'écran de chaque joueur (par jeton) a fini de montrer. */
  lus?: Record<string, number>;
}

/** Pièce jointe d'une connexion : jeton du joueur, heure d'arrivée, et si son appareil envoie des « ping » (13/11/2026). */
interface Attache {
  jeton?: string;
  depuis?: number;
  ping?: boolean;
}

/** Sans ping depuis ce délai, une connexion est tenue pour morte (13/11/2026, audit C5 ; le client pingue toutes les 20 s). */
const PING_MORT_MS = 60_000;

const REGLAGES_DEFAUT: ReglagesSalon = {
  nbBateaux: 4,
  niveauIA: 'moyen',
  options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  delaiQuiz: 30,
};

export class Salon extends DurableObject<Env> {
  private s: DonneesSalon | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Ping des joueurs (13/11/2026, audit C5) : le serveur répond « pong » sans se réveiller, et note l'heure du dernier
    // ping de chaque connexion.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private async charger(): Promise<DonneesSalon | null> {
    if (!this.s) this.s = (await this.ctx.storage.get<DonneesSalon>('salon')) ?? null;
    return this.s;
  }

  private async sauver() {
    if (this.s) await this.ctx.storage.put('salon', this.s);
  }

  async initialiser(code: string, reglages: Partial<ReglagesSalon>) {
    // Course, classe et nombre de bateaux ramenés à une partie possible (Rhum, Transat Café L'Or, Fastnet ; 13/11/2026).
    const r = { ...REGLAGES_DEFAUT, ...reglages, options: { ...REGLAGES_DEFAUT.options, ...(reglages.options ?? {}) } };
    this.s = { code, reglages: reglagesSalonValides(D, r), joueurs: [], etat: null };
    await this.sauver();
  }

  async fetch(req: Request): Promise<Response> {
    const s = await this.charger();
    if (!s) return new Response('Salon inconnu', { status: 404 });
    const paire = new WebSocketPair();
    this.ctx.acceptWebSocket(paire[1]);
    return new Response(null, { status: 101, webSocket: paire[0] });
  }

  // ---------------------------------------------------------------- Messages

  async webSocketMessage(ws: WebSocket, brut: string | ArrayBuffer) {
    const s = await this.charger();
    if (!s) return;
    let msg: MessageClient;
    try {
      msg = JSON.parse(typeof brut === 'string' ? brut : new TextDecoder().decode(brut));
    } catch {
      return this.envoyer(ws, { t: 'erreur', message: 'Message illisible' });
    }
    try {
      if (msg.t === 'rejoindre') return await this.rejoindre(ws, msg.jeton, msg.nom, msg.niveauQuiz, msg.ping);
      const jeton = (ws.deserializeAttachment() as { jeton?: string } | null)?.jeton;
      const joueur = s.joueurs.find((j) => j.jeton === jeton);
      if (!joueur) return this.envoyer(ws, { t: 'erreur', message: 'Rejoignez d\'abord le salon' });
      switch (msg.t) {
        case 'skipper': {
          if (s.etat) throw new Error('La course est déjà lancée');
          if (s.joueurs.some((j) => j !== joueur && j.skipperId === msg.skipperId)) throw new Error('Ce skipper est déjà pris');
          if (!D.skippers.some((k) => k.id === msg.skipperId && k.classe === (s.reglages.classe ?? 'IMOCA'))) throw new Error('Skipper inconnu dans cette classe');
          joueur.skipperId = msg.skipperId;
          break;
        }
        case 'niveauQuiz': {
          // Chacun choisit le niveau de ses propres questions, jusqu'au départ (demande du porteur de projet, 12/11/2026).
          if (s.etat) throw new Error('La course est déjà lancée');
          const n = niveauQuizValide(msg.niveau);
          if (!n) throw new Error('Niveau de questions inconnu');
          joueur.niveauQuiz = n;
          break;
        }
        case 'reglages': {
          if (!joueur.hote) throw new Error('Seul l\'hôte règle la partie');
          if (s.etat) throw new Error('La course est déjà lancée');
          const avant = s.reglages.classe;
          s.reglages = reglagesSalonValides(D, { ...s.reglages, ...msg.reglages });
          // Nouvelle classe : les skippers déjà choisis n'en font plus partie, chacun rechoisit.
          if (s.reglages.classe !== avant) for (const j of s.joueurs) j.skipperId = null;
          break;
        }
        case 'lancer': {
          if (!joueur.hote) throw new Error('Seul l\'hôte lance la course');
          this.lancer();
          break;
        }
        case 'action': {
          if (!s.etat) throw new Error('La course n\'est pas lancée');
          if (msg.action.bateauId !== joueur.bateauId) throw new Error('Ce n\'est pas votre bateau');
          s.etat = appliquer(D, s.etat, msg.action);
          break;
        }
        case 'lu': {
          // L'écran du joueur a fini de montrer le tour (audit de l'enchaînement, 13/11/2026) : le chrono peut partir.
          if (!Number.isFinite(msg.n)) return;
          s.lus = { ...(s.lus ?? {}), [joueur.jeton]: Math.max(s.lus?.[joueur.jeton] ?? 0, msg.n) };
          const partiAvant = s.attente?.demarre;
          await this.planifier();
          await this.sauver();
          if (s.attente?.demarre && partiAvant === false) this.diffuser();
          return;
        }
        case 'confierIA': {
          if (!joueur.hote || !s.etat) throw new Error('Seul l\'hôte peut confier un bateau à l\'IA');
          this.confierIA(msg.bateauId);
          break;
        }
      }
      await this.planifier();
      await this.sauver();
      this.diffuser();
    } catch (e) {
      this.envoyer(ws, { t: 'erreur', message: (e as Error).message });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const s = await this.charger();
    if (!s) return;
    this.marquerDeconnecte((ws.deserializeAttachment() as Attache | null)?.jeton, ws);
    await this.sauver();
    this.diffuser();
  }

  /** Un joueur n'a plus aucune connexion ouverte : déconnecté. L'hôte qui part pendant la course passe son rôle (audit C2). */
  private marquerDeconnecte(jeton: string | undefined, exclue: WebSocket): boolean {
    const s = this.s!;
    const j = s.joueurs.find((x) => x.jeton === jeton);
    if (!j || this.ctx.getWebSockets().some((w) => w !== exclue && (w.deserializeAttachment() as Attache | null)?.jeton === jeton)) return false;
    j.connecte = false;
    if (j.hote && s.etat) {
      const autre = s.joueurs.find((x) => x !== j && x.connecte);
      if (autre) {
        j.hote = false;
        autre.hote = true;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- Délais et connexions mortes (13/11/2026)

  /** Note l'attente en cours (son échéance ne change pas tant que c'est la même) et programme le prochain réveil. */
  private async planifier() {
    const s = this.s!;
    const e = s.etat;
    let cle: string | null = null;
    let delai = 0;
    if (e && e.phase === 'choix' && humainsAttendus(e).length) {
      cle = `choix:${e.tour}`;
      delai = DELAI_CHOIX_S;
    } else if (e && e.attente && e.bateaux.find((b) => b.id === e.attente!.bateauId)?.type === 'humain') {
      cle = `attente:${e.evenements.length}:${e.attente.bateauId}:${e.attente.type}`;
      delai = DELAI_DECISION_S;
    }
    const maintenant = Date.now();
    if (!cle) s.attente = null;
    else {
      // Nouvelle attente : le chrono ne part pas tout de suite (au plus tard après ATTENTE_ANIMATION_MAX_S).
      if (s.attente?.cle !== cle) s.attente = { cle, depuis: maintenant, demarre: false, echeance: maintenant + (ATTENTE_ANIMATION_MAX_S + delai) * 1000 };
      const a = s.attente;
      // Il part quand l'écran de chaque joueur attendu (connecté) a fini de montrer le tour (audit de l'enchaînement, 13/11/2026).
      if (a.demarre === false && e) {
        const ids = new Set(e.phase === 'choix' ? humainsAttendus(e).map((b) => b.id) : e.attente ? [e.attente.bateauId] : []);
        const lus = s.joueurs.filter((j) => j.connecte && j.bateauId && ids.has(j.bateauId)).map((j) => s.lus?.[j.jeton]);
        if (chronoPeutPartir(a.depuis ?? maintenant, e.evenements.length, lus, maintenant)) {
          a.demarre = true;
          a.echeance = Math.min(a.echeance, maintenant + delai * 1000);
        }
      }
    }
    // Réveil à l'échéance, et au moins toutes les 30 s pendant la course pour repérer les connexions mortes.
    if (e && e.phase !== 'fin' && this.ctx.getWebSockets().length) {
      await this.ctx.storage.setAlarm(Math.min(s.attente?.echeance ?? Infinity, Date.now() + 30_000));
    }
  }

  async alarm() {
    const s = await this.charger();
    if (!s?.etat) return;
    let change = false;
    const maintenant = Date.now();
    // Connexions mortes (audit C5) : un appareil qui pingue et ne l'a plus fait depuis 60 s est déconnecté.
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attache | null;
      if (!att?.ping) continue;
      const dernier = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? att.depuis ?? maintenant;
      if (maintenant - Math.max(dernier, att.depuis ?? 0) <= PING_MORT_MS) continue;
      try {
        ws.close(1011, 'Connexion inactive');
      } catch {
        /* déjà fermée */
      }
      change = this.marquerDeconnecte(att.jeton, ws) || change;
    }
    // Échéance dépassée (audit C2) : le serveur joue pour les joueurs attendus.
    if (s.attente && maintenant >= s.attente.echeance) {
      this.jouerParDefaut();
      change = true;
    }
    const partiAvant = s.attente?.demarre;
    await this.planifier();
    // Chrono parti au réveil (écran resté muet plus de 2 minutes) : les joueurs voient le temps restant.
    if (s.attente?.demarre && partiAvant === false) change = true;
    await this.sauver();
    if (change) this.diffuser();
  }

  /** Temps écoulé : le routeur choisit le cap et la voile des joueurs attendus, ou la réponse par défaut est jouée. */
  private jouerParDefaut() {
    const s = this.s!;
    let e = s.etat!;
    if (e.phase === 'choix') {
      for (let garde = 0; garde < 12 && e.phase === 'choix'; garde++) {
        const b = humainsAttendus(e)[0];
        if (!b) break;
        e.evenements.push({ tour: e.tour, type: 'info', bateauId: b.id, texte: `Temps écoulé : le routeur choisit le cap et la voile de ${nomSkipper(D, e, b)} pour ce tour.` });
        e = appliquer(D, e, { type: 'ChoisirCapEtVoile', bateauId: b.id, choix: choisirIA(D, e, b.id) });
      }
    } else if (e.attente) {
      const b = bateau(e, e.attente.bateauId);
      e.evenements.push({ tour: e.tour, type: 'info', bateauId: b.id, texte: `Temps écoulé : réponse par défaut pour ${nomSkipper(D, e, b)}.` });
      e = this.repondre(e, b.id, 'delai');
    }
    s.etat = e;
  }

  /**
   * Répond à la décision en attente d'un bateau : comme l'IA (bateau confié), ou par défaut (temps écoulé : question
   * manquée, vent gardé, carte réparation jouée comme l'IA).
   */
  private repondre(e: EtatPartie, bateauId: string, mode: 'ia' | 'delai'): EtatPartie {
    const a = e.attente!;
    const b = bateau(e, bateauId);
    const action: Action =
      a.type === 'relance' ? { type: 'RepondreRelance', bateauId, relancer: mode === 'ia' && angleAllure(b.choix?.cap ?? 0, a.ventLocal.direction) < 45 }
      : a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId, reponse: mode === 'ia' && Math.random() < 0.7 ? (D.questions.find((q) => q.id === a.questionId)?.reponse ?? 0) : -1 }
      : { type: 'JouerReparation', bateauId, jouer: decisionReparationIA(b, a.motif === 'evenement' ? 'penalite' : a.motif, a.penalite ?? null) };
    return appliquer(D, e, action);
  }

  private async rejoindre(ws: WebSocket, jeton: string, nom: string, niveauQuiz?: unknown, ping?: boolean) {
    const s = this.s!;
    let j = s.joueurs.find((x) => x.jeton === jeton);
    if (!j) {
      if (s.etat) return this.envoyer(ws, { t: 'erreur', message: 'La course a déjà commencé' });
      if (s.joueurs.length >= MAX_HUMAINS) return this.envoyer(ws, { t: 'erreur', message: `Salon complet (${MAX_HUMAINS} joueurs au plus)` });
      j = {
        jeton, nom: (nom || 'Skipper').slice(0, 18), skipperId: null, connecte: true, hote: s.joueurs.length === 0, bateauId: null,
        niveauQuiz: niveauQuizValide(niveauQuiz) ?? NIVEAU_QUIZ_DEFAUT,
      };
      s.joueurs.push(j);
    }
    j.connecte = true;
    // Le joueur revient après que son bateau a été confié à l'IA : il reprend la barre (13/11/2026, audit C6).
    if (s.etat && !j.bateauId && j.bateauConfie) {
      const b = s.etat.bateaux.find((x) => x.id === j!.bateauConfie);
      if (b && b.type === 'ia' && !b.arrive) {
        b.type = 'humain';
        j.bateauId = b.id;
        s.etat.evenements.push({ tour: s.etat.tour, type: 'info', bateauId: b.id, texte: `${j.nom} reprend la barre de ${nomSkipper(D, s.etat, b)}.` });
      }
      j.bateauConfie = undefined;
    }
    ws.serializeAttachment({ jeton, depuis: Date.now(), ping: !!ping } satisfies Attache);
    await this.planifier();
    await this.sauver();
    this.diffuser();
  }

  private lancer() {
    const s = this.s!;
    if (s.etat) throw new Error('Déjà lancée');
    if (s.joueurs.some((j) => !j.skipperId)) throw new Error('Tous les joueurs doivent choisir un skipper');
    // Salons créés avant le 13/11/2026 : réglages anciens ramenés à une partie possible.
    s.reglages = reglagesSalonValides(D, s.reglages);
    if (s.joueurs.some((j) => D.skippers.find((k) => k.id === j.skipperId)?.classe !== s.reglages.classe)) throw new Error('Un skipper choisi n\'est pas de la classe de la course');
    const pris = new Set(s.joueurs.map((j) => j.skipperId!));
    const libres = D.skippers.filter((k) => k.classe === (s.reglages.classe ?? 'IMOCA')).map((k) => k.id).filter((id) => !pris.has(id)).sort(() => Math.random() - 0.5);
    const nb = Math.max(s.joueurs.length, Math.min(10, s.reglages.nbBateaux));
    // Course en double : en réseau, chaque équipage reçoit un co-skipper d'une autre compétence, tiré au hasard.
    const courseId = s.reglages.courseId ?? 'route-du-rhum';
    const double = !!D.courses.find((c) => c.id === courseId)?.double;
    const ia = libres.slice(0, nb - s.joueurs.length);
    const reserve = libres.slice(nb - s.joueurs.length);
    const co = (id: string) => {
      if (!double) return {};
      const comp = D.skippers.find((k) => k.id === id)!.competence;
      const k = Math.max(0, reserve.findIndex((x) => D.skippers.find((z) => z.id === x)!.competence !== comp));
      const c = reserve.splice(k, 1)[0];
      return c ? { coSkipperId: c } : {};
    };
    const participants: ParticipantParams[] = [
      ...s.joueurs.map((j) => ({ nom: j.nom, type: 'humain' as const, niveauQuiz: j.niveauQuiz ?? NIVEAU_QUIZ_DEFAUT, skipperId: j.skipperId!, ...co(j.skipperId!) })),
      ...ia.map((id) => ({ nom: 'IA', type: 'ia' as const, niveauIA: s.reglages.niveauIA, niveauQuiz: NIVEAU_QUIZ_DEFAUT, skipperId: id, ...co(id) })),
    ];
    s.etat = creerPartie(D, { courseId, classe: s.reglages.classe ?? 'IMOCA', graine: Math.floor(Math.random() * 1e9), participants, options: s.reglages.options });
    s.joueurs.forEach((j, i) => (j.bateauId = s.etat!.bateaux[i].id));
  }

  /** L'hôte confie à l'IA le bateau d'un joueur absent : l'IA joue à sa place jusqu'à la fin. */
  private confierIA(bateauId: string) {
    const s = this.s!;
    let e = s.etat!;
    const b = bateau(e, bateauId);
    b.type = 'ia';
    b.niveauIA = s.reglages.niveauIA;
    const j = s.joueurs.find((x) => x.bateauId === bateauId);
    if (j) {
      j.bateauId = null;
      j.bateauConfie = bateauId; // il pourra le reprendre en revenant (audit C6)
    }
    // Débloque une éventuelle décision en attente de ce bateau.
    for (let garde = 0; garde < 20 && e.attente?.bateauId === bateauId; garde++) e = this.repondre(e, bateauId, 'ia');
    // Si tous les humains restants ont déjà choisi, le tour peut partir : l'IA choisit pour ce bateau.
    if (e.phase === 'choix' && humainsAttendus(e).length === 0 && e.bateaux.some((x) => x.type === 'humain'))
      e = appliquer(D, e, { type: 'ChoisirCapEtVoile', bateauId, choix: choisirIA(D, e, bateauId) });
    if (e.phase === 'choix' && !e.bateaux.some((x) => x.type === 'humain' && !x.arrive)) {
      const premier = e.bateaux.find((x) => x.choix === null && !x.arrive);
      if (premier) e = appliquer(D, e, { type: 'ChoisirCapEtVoile', bateauId: premier.id, choix: choisirIA(D, e, premier.id) });
    }
    s.etat = e;
  }

  // ---------------------------------------------------------------- Diffusion

  private vue(): VueSalon {
    const s = this.s!;
    return {
      code: s.code, statut: s.etat ? 'course' : 'salon', reglages: s.reglages, maxHumains: MAX_HUMAINS,
      // Temps restant montré seulement une fois le chrono parti (audit de l'enchaînement, 13/11/2026).
      echeanceDans: s.attente && s.attente.demarre !== false ? Math.max(0, s.attente.echeance - Date.now()) : null,
      joueurs: s.joueurs.map(({ nom, skipperId, connecte, hote, bateauId, niveauQuiz }) => ({ nom, skipperId, connecte, hote, bateauId, niveauQuiz: niveauQuiz ?? NIVEAU_QUIZ_DEFAUT })),
    };
  }

  private diffuser() {
    const s = this.s!;
    const vue = this.vue();
    for (const ws of this.ctx.getWebSockets()) {
      const jeton = (ws.deserializeAttachment() as { jeton?: string } | null)?.jeton;
      const idx = s.joueurs.findIndex((j) => j.jeton === jeton);
      this.envoyer(ws, { t: 'salon', salon: vue, moi: idx });
      if (s.etat) {
        const moi = idx >= 0 ? s.joueurs[idx].bateauId : null;
        const b = moi ? s.etat.bateaux.find((x) => x.id === moi) : null;
        const sp = b ? competence(D, b.competence).speciaux : {};
        const { etat, ontChoisi } = masquerEtat(s.etat, moi, !!sp.voit_de_force, { force: !!sp.prevoit_force, direction: !!sp.prevoit_direction });
        this.envoyer(ws, { t: 'etat', etat, moi, ontChoisi });
      }
    }
  }

  private envoyer(ws: WebSocket, m: MessageServeur) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* connexion fermée */
    }
  }
}
