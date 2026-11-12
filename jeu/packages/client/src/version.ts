// Version du jeu et date de mise à jour, écrites au moment de la construction (packages/client/vite.config.ts).
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __DATE_VERSION__: string;

export const VERSION = __VERSION__;
/** Enregistrement git d'où vient la version (pour les développeurs). */
export const COMMIT = __COMMIT__;

/** « 12 novembre 2026 à 15 h 42 », heure de Paris. */
export function dateVersion(): string {
  const d = new Date(__DATE_VERSION__);
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ');
  const [h, m] = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).split(':');
  return `${jour} à ${Number(h)} h ${m}`;
}
