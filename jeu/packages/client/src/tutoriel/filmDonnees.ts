// Données du petit film « Comment ça marche » (écran des règles, décision du propriétaire du 14/11/2026), lues dans les
// réglages du jeu pour rester justes quand on rééquilibre. Testé dans client/test/tutoriel.test.ts.
import { forceMaxVoile } from '@cal/engine';
import type { Donnees } from '@cal/engine';

/** Les quatre voiles de la scène « Les voiles », de la plus grande à la plus petite. */
export const VOILES_FILM = ['spi', 'solent', 'j3', 'reduite'] as const;
/** Les forces de vent montrées par la jauge : petit temps, vent frais, coup de vent, tempête. */
export const FORCES_FILM = [3, 6, 8, 10] as const;

/** Pour chaque force de la jauge, les voiles qui tiennent encore (plages de force des voiles, voiles.json). */
export function niveauxVoiles(d: Pick<Donnees, 'voiles'>): { force: number; voiles: string[] }[] {
  return FORCES_FILM.map((force) => ({
    force,
    voiles: VOILES_FILM.filter((id) => {
      const v = d.voiles.find((x) => x.id === id);
      return !!v && force <= forceMaxVoile(v);
    }),
  }));
}
