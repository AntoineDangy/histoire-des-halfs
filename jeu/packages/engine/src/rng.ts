// Générateur aléatoire à graine (mulberry32). Son état est un entier stocké dans l'état de jeu :
// une partie se rejoue à l'identique à partir de la graine et de la liste des actions.

export function pas(etatRng: number): [number, number] {
  const s = (etatRng + 0x6d2b79f5) | 0;
  let r = Math.imul(s ^ (s >>> 15), 1 | s);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, s];
}

export interface PorteurRng {
  rng: number;
}

/** Nombre dans [0, 1[ ; fait avancer le générateur porté par l'objet. */
export function alea(p: PorteurRng): number {
  const [v, s] = pas(p.rng);
  p.rng = s;
  return v;
}

export function entier(p: PorteurRng, n: number): number {
  return Math.floor(alea(p) * n);
}

export function face<T>(p: PorteurRng, faces: T[]): T {
  return faces[entier(p, faces.length)];
}

export function d6(p: PorteurRng): number {
  return entier(p, 6) + 1;
}

export function tiragePondere<T extends { poids: number }>(p: PorteurRng, items: T[]): T {
  const total = items.reduce((s, i) => s + i.poids, 0);
  let r = alea(p) * total;
  for (const i of items) {
    r -= i.poids;
    if (r < 0) return i;
  }
  return items[items.length - 1];
}
