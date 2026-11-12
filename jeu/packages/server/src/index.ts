// Serveur de salons du jeu « Course au large » : un Worker Cloudflare qui crée les salons,
// et un Durable Object « Salon » par partie, qui garde l'état et arbitre la course.
import { DurableObject } from 'cloudflare:workers';
import { donneesBrutes } from '../../data/index';
import {
  angleAllure, appliquer, bateau, choisirIA, competence, creerPartie, decisionReparationIA, humainsAttendus, masquerEtat, MAX_HUMAINS,
  NIVEAU_QUIZ_DEFAUT, niveauQuizValide,
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
  joueurs: (JoueurSalon & { jeton: string })[];
  etat: EtatPartie | null;
}

const REGLAGES_DEFAUT: ReglagesSalon = {
  nbBateaux: 4,
  niveauIA: 'moyen',
  options: { quiz: true, bulletinMeteo: true, nomsReels: true, courseComplete: false },
  delaiQuiz: 30,
};

export class Salon extends DurableObject<Env> {
  private s: DonneesSalon | null = null;

  private async charger(): Promise<DonneesSalon | null> {
    if (!this.s) this.s = (await this.ctx.storage.get<DonneesSalon>('salon')) ?? null;
    return this.s;
  }

  private async sauver() {
    if (this.s) await this.ctx.storage.put('salon', this.s);
  }

  async initialiser(code: string, reglages: Partial<ReglagesSalon>) {
    this.s = { code, reglages: { ...REGLAGES_DEFAUT, ...reglages, options: { ...REGLAGES_DEFAUT.options, ...(reglages.options ?? {}) } }, joueurs: [], etat: null };
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
      if (msg.t === 'rejoindre') return await this.rejoindre(ws, msg.jeton, msg.nom, msg.niveauQuiz);
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
          s.reglages = { ...s.reglages, ...msg.reglages, nbBateaux: Math.max(2, Math.min(10, msg.reglages.nbBateaux)) };
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
        case 'confierIA': {
          if (!joueur.hote || !s.etat) throw new Error('Seul l\'hôte peut confier un bateau à l\'IA');
          this.confierIA(msg.bateauId);
          break;
        }
      }
      await this.sauver();
      this.diffuser();
    } catch (e) {
      this.envoyer(ws, { t: 'erreur', message: (e as Error).message });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const s = await this.charger();
    const jeton = (ws.deserializeAttachment() as { jeton?: string } | null)?.jeton;
    const j = s?.joueurs.find((x) => x.jeton === jeton);
    if (j && !this.ctx.getWebSockets().some((w) => w !== ws && (w.deserializeAttachment() as { jeton?: string } | null)?.jeton === jeton)) j.connecte = false;
    await this.sauver();
    this.diffuser();
  }

  private async rejoindre(ws: WebSocket, jeton: string, nom: string, niveauQuiz?: unknown) {
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
    ws.serializeAttachment({ jeton });
    await this.sauver();
    this.diffuser();
  }

  private lancer() {
    const s = this.s!;
    if (s.etat) throw new Error('Déjà lancée');
    if (s.joueurs.some((j) => !j.skipperId)) throw new Error('Tous les joueurs doivent choisir un skipper');
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
    if (j) j.bateauId = null;
    // Débloque une éventuelle décision en attente de ce bateau.
    for (let garde = 0; garde < 20 && e.attente?.bateauId === bateauId; garde++) {
      const a = e.attente;
      const action: Action =
        a.type === 'relance' ? { type: 'RepondreRelance', bateauId, relancer: angleAllure(b.choix?.cap ?? 0, a.ventLocal.direction) < 45 }
        : a.type === 'quiz' ? { type: 'RepondreQuiz', bateauId, reponse: Math.random() < 0.7 ? (D.questions.find((q) => q.id === a.questionId)?.reponse ?? 0) : -1 }
        : { type: 'JouerReparation', bateauId, jouer: decisionReparationIA(bateau(e, bateauId), a.motif === 'evenement' ? 'penalite' : a.motif, a.penalite ?? null) };
      e = appliquer(D, e, action);
    }
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
