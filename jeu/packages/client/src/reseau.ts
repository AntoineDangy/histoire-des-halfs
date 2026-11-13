// Connexion au serveur de salons (jeu en réseau).
import type { Action, EtatPartie, MessageClient, MessageServeur, NiveauQuiz, ReglagesSalon, VueSalon } from '@cal/engine';

/**
 * Adresse du serveur de salons. Par défaut, celui de la version officielle ; pour un autre déploiement ou en local,
 * la changer à la construction : `VITE_SERVEUR=https://mon-serveur.workers.dev npm run build` (voir README.md).
 */
export const SERVEUR: string = (import.meta.env.VITE_SERVEUR as string | undefined) || 'https://course-au-large-serveur.antoine-dangy.workers.dev';

export async function creerSalon(reglages: ReglagesSalon): Promise<string> {
  const r = await fetch(`${SERVEUR}/api/salons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reglages) });
  if (!r.ok) throw new Error('Le serveur de salons ne répond pas');
  return ((await r.json()) as { code: string }).code;
}

/** Jeton gardé sur l'appareil pour un salon : il permet de reprendre sa place depuis un autre onglet (13/11/2026, audit C6). */
const cleAppareil = (code: string) => `cal-jeton-appareil-${code}`;

/** Jeton du joueur pour un salon : il permet de retrouver sa place après une coupure. */
function jetonPour(code: string): string {
  const cle = `cal-jeton-${code}`;
  try {
    // Mémorisé par onglet : recharger la page garde sa place ; deux onglets = deux joueurs.
    const j = sessionStorage.getItem(cle);
    if (j) return j;
    const n = crypto.randomUUID();
    sessionStorage.setItem(cle, n);
    return n;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Cet onglet a-t-il déjà rejoint ce salon ? Alors la page rechargée s'y reconnecte toute seule (audit C6). Un autre onglet
 * ou un autre jour passe par « Rejoindre », qui reprend la place gardée sur l'appareil si la course a commencé.
 */
export function dejaRejoint(code: string): boolean {
  try {
    return !!sessionStorage.getItem(`cal-jeton-${code}`);
  } catch {
    return false;
  }
}

export interface EtatConnexion {
  salon: VueSalon | null;
  moiIndex: number;
  etat: EtatPartie | null;
  moi: string | null;
  ontChoisi: string[];
  erreur: string | null;
  connecte: boolean;
  /** Heure locale (ms) à laquelle le serveur jouera pour les joueurs attendus (audit C2). */
  echeance: number | null;
}

/** Intervalle des « ping », et silence au-delà duquel la connexion est tenue pour morte (13/11/2026, audit C5). */
const PING_MS = 20_000;
const SILENCE_MAX_MS = 45_000;

/**
 * Connexion WebSocket avec reconnexion automatique. Depuis le 13/11/2026 (audit C5) : « ping » régulier pour repérer une
 * connexion morte, reconnexion immédiate au retour sur l'onglet ou du réseau, et messages gardés pendant une coupure,
 * envoyés au retour.
 */
export class Connexion {
  private ws: WebSocket | null = null;
  private ferme = false;
  private essais = 0;
  private relance: number | null = null;
  private minuterie: number;
  private dernierMessage = Date.now();
  private file: MessageClient[] = [];
  jeton: string;
  etat: EtatConnexion = { salon: null, moiIndex: -1, etat: null, moi: null, ontChoisi: [], erreur: null, connecte: false, echeance: null };

  constructor(readonly code: string, private nom: string, private surChange: (e: EtatConnexion) => void, private niveauQuiz?: NiveauQuiz) {
    this.jeton = jetonPour(code);
    this.ouvrir();
    this.minuterie = window.setInterval(() => this.verifier(), PING_MS);
    document.addEventListener('visibilitychange', this.auRetour);
    window.addEventListener('online', this.auRetour);
  }

  /** Retour sur l'onglet ou du réseau : on se reconnecte tout de suite si la connexion est tombée. */
  private auRetour = () => {
    if (this.ferme || document.visibilityState === 'hidden') return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) this.reconnecter(0);
    else this.verifier();
  };

  /** Ping, et fermeture d'une connexion restée silencieuse trop longtemps (le serveur répond « pong »). */
  private verifier() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.dernierMessage > SILENCE_MAX_MS) {
      this.ws.close();
      return;
    }
    this.ws.send('ping');
  }

  private reconnecter(delai: number) {
    if (this.relance !== null) window.clearTimeout(this.relance);
    this.relance = window.setTimeout(() => {
      this.relance = null;
      if (!this.ferme) this.ouvrir();
    }, delai);
  }

  private ouvrir() {
    const ws = new WebSocket(`${SERVEUR.replace(/^http/, 'ws')}/api/salons/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.essais = 0;
      this.dernierMessage = Date.now();
      this.maj({ connecte: true, erreur: null });
      ws.send(JSON.stringify({ t: 'rejoindre', jeton: this.jeton, nom: this.nom, niveauQuiz: this.niveauQuiz, ping: true } satisfies MessageClient));
      // Messages gardés pendant la coupure.
      const file = this.file;
      this.file = [];
      for (const m of file) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.dernierMessage = Date.now();
      if (e.data === 'pong') return;
      const m = JSON.parse(e.data as string) as MessageServeur;
      if (m.t === 'salon') {
        this.maj({ salon: m.salon, moiIndex: m.moi, echeance: m.salon.echeanceDans != null ? Date.now() + m.salon.echeanceDans : null });
        // Place obtenue : jeton gardé sur l'appareil, pour la reprendre depuis un autre onglet (audit C6).
        if (m.moi >= 0) {
          try {
            localStorage.setItem(cleAppareil(this.code), this.jeton);
          } catch {
            /* sans conséquence */
          }
        }
      } else if (m.t === 'etat') this.maj({ etat: m.etat, moi: m.moi, ontChoisi: m.ontChoisi });
      else if (m.t === 'erreur') {
        // Course commencée sans place pour ce jeton : on reprend la place gardée sur l'appareil, s'il y en a une.
        let autre: string | null = null;
        try {
          autre = localStorage.getItem(cleAppareil(this.code));
        } catch {
          /* sans conséquence */
        }
        if (m.message === 'La course a déjà commencé' && autre && autre !== this.jeton) {
          this.jeton = autre;
          try {
            sessionStorage.setItem(`cal-jeton-${this.code}`, autre);
          } catch {
            /* sans conséquence */
          }
          ws.send(JSON.stringify({ t: 'rejoindre', jeton: autre, nom: this.nom, niveauQuiz: this.niveauQuiz, ping: true } satisfies MessageClient));
          return;
        }
        this.maj({ erreur: m.message });
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.maj({ connecte: false });
      if (this.ferme) return;
      this.reconnecter(Math.min(10000, 1000 * 2 ** this.essais++));
    };
  }

  private maj(p: Partial<EtatConnexion>) {
    this.etat = { ...this.etat, ...p };
    this.surChange(this.etat);
  }

  envoyer(m: MessageClient) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'rejoindre') this.file.push(m); // envoyé au retour de la connexion (audit C5)
  }

  action(a: Action) {
    this.envoyer({ t: 'action', action: a });
  }

  effacerErreur() {
    this.maj({ erreur: null });
  }

  fermer() {
    this.ferme = true;
    window.clearInterval(this.minuterie);
    if (this.relance !== null) window.clearTimeout(this.relance);
    document.removeEventListener('visibilitychange', this.auRetour);
    window.removeEventListener('online', this.auRetour);
    this.ws?.close();
  }
}
