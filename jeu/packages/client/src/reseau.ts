// Connexion au serveur de salons (jeu en réseau).
import type { Action, EtatPartie, MessageClient, MessageServeur, ReglagesSalon, VueSalon } from '@cal/engine';

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

export interface EtatConnexion {
  salon: VueSalon | null;
  moiIndex: number;
  etat: EtatPartie | null;
  moi: string | null;
  ontChoisi: string[];
  erreur: string | null;
  connecte: boolean;
}

/** Connexion WebSocket avec reconnexion automatique. */
export class Connexion {
  private ws: WebSocket | null = null;
  private ferme = false;
  private essais = 0;
  readonly jeton: string;
  etat: EtatConnexion = { salon: null, moiIndex: -1, etat: null, moi: null, ontChoisi: [], erreur: null, connecte: false };

  constructor(readonly code: string, private nom: string, private surChange: (e: EtatConnexion) => void) {
    this.jeton = jetonPour(code);
    this.ouvrir();
  }

  private ouvrir() {
    const ws = new WebSocket(`${SERVEUR.replace(/^http/, 'ws')}/api/salons/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.essais = 0;
      this.maj({ connecte: true, erreur: null });
      this.envoyer({ t: 'rejoindre', jeton: this.jeton, nom: this.nom });
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string) as MessageServeur;
      if (m.t === 'salon') this.maj({ salon: m.salon, moiIndex: m.moi });
      else if (m.t === 'etat') this.maj({ etat: m.etat, moi: m.moi, ontChoisi: m.ontChoisi });
      else if (m.t === 'erreur') this.maj({ erreur: m.message });
    };
    ws.onclose = () => {
      this.maj({ connecte: false });
      if (this.ferme) return;
      const delai = Math.min(10000, 1000 * 2 ** this.essais++);
      setTimeout(() => !this.ferme && this.ouvrir(), delai);
    };
  }

  private maj(p: Partial<EtatConnexion>) {
    this.etat = { ...this.etat, ...p };
    this.surChange(this.etat);
  }

  envoyer(m: MessageClient) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  action(a: Action) {
    this.envoyer({ t: 'action', action: a });
  }

  fermer() {
    this.ferme = true;
    this.ws?.close();
  }
}
