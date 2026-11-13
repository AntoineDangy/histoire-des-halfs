import { GREEMENT } from './PlanVoilure';
import { anneeVintage, grandVoile, MULTIS_VINTAGE, planDe } from './voilure';
import type { Forme } from './voilure';

/**
 * Petit plan de voilure de profil pour les boutons de voiles (essai d'interface du 12/11/2026, demande du porteur de projet :
 * des dessins réalistes selon la voile et le bateau). Mêmes cotes et mêmes surfaces que le plan de voilure du hangar
 * (PlanVoilure.tsx, voilure.ts) : coque, mât, bout-dehors, grand-voile (arisée pour la voilure réduite) et voile d'avant à
 * sa vraie taille ; goélette (Pen Duick III) avec sa misaine ; voiles d'époque claires pour les bateaux de légende.
 * Étrave à gauche. Sans voile (à sec de toile) : le mât seul.
 */
export default function IconeVoile({ forme, modele, ris = false, spi = '#e8783c', taille = 44 }: {
  forme: string | null;
  modele: string;
  ris?: boolean;
  spi?: string;
  taille?: number;
}) {
  const g = GREEMENT[modele] ?? GREEMENT.imoca;
  const plan = planDe(modele);
  const annee = anneeVintage(modele);
  const multi = /ultim|ocean_fifty/.test(modele) || modele in MULTIS_VINTAGE;
  const W = 48, H = 50;
  // Échelle : le mât et la coque tiennent dans le cadre (avec la place d'un spi devant l'étrave).
  const avantMax = g.bd + 0.12 * g.L;
  const k = Math.min((H - 5) / (g.mat + g.fb + 1.2), (W - 3) / (g.L + avantMax));
  const X = (m: number) => 1.5 + (avantMax + m) * k;
  const Y = (m: number) => H - 3 - m * k;
  const xMat = g.pied * g.L, yBome = g.fb + 1.0;
  const goelette = !!g.misaine && !!plan.misaine;
  const xMis = g.misaine ? g.misaine.pied * g.L : xMat;

  const bermudienne = (x0: number, aire: number, bome: number, nRis: number) => {
    const v = grandVoile(aire, g.mat - 1.6, bome, nRis, annee);
    const pts: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      pts.push(`L ${X(x0 + bome + (v.tete - bome) * f + v.rond * Math.sin(Math.PI * f)).toFixed(1)} ${Y(yBome + v.P * f).toFixed(1)}`);
    }
    return `M ${X(x0).toFixed(1)} ${Y(yBome).toFixed(1)} L ${X(x0).toFixed(1)} ${Y(yBome + v.P).toFixed(1)} ${pts.reverse().join(' ')} Z`;
  };

  // Voile d'avant : même construction que le plan de voilure du hangar (amure, têtière, point d'écoute pour la surface).
  let avant: { d: string; spi: boolean } | null = null;
  if (forme) {
    const f = forme as Forme;
    const aire = plan.voiles[f] || plan.voiles.j2 * 0.5;
    const amure = f === 'tourmentin' || f === 'j3' ? 0.13 * g.L : f === 'j2' || (annee && f === 'fro') ? 0.03 * g.L : -g.bd;
    const haut = ({ tourmentin: 0.42, j3: 0.6, j2: annee ? 0.9 : 0.82, fro: annee ? 0.95 : 0.93, a3: 0.95, a2: 0.98, sgt: 0.8 }[f] ?? 0.8) * g.mat + g.fb;
    const rond = { tourmentin: 1, j3: 1, j2: 1, fro: 1.05, a3: 1.2, a2: 1.3, sgt: 1.15 }[f] ?? 1;
    const spiTangon = goelette && (f === 'a3' || f === 'a2' || f === 'sgt');
    const tx = spiTangon ? xMis - 4.1 : amure, ty = spiTangon ? g.fb + 2.0 : g.fb + 0.3, hx = xMis - 0.3, hy = haut;
    const diry = f === 'a2' ? 0.18 : f === 'a3' ? 0.06 : -0.06;
    const n = Math.hypot(1, diry);
    const cross = Math.abs((hx - tx) * (diry / n) - (hy - ty) * (1 / n));
    const d = (2 * aire) / rond / Math.max(0.5, cross);
    const cx = tx + d / n, cy = Math.max(g.fb + 0.4, ty + (d * diry) / n);
    const estSpi = f === 'a3' || f === 'a2' || f === 'sgt';
    avant = {
      spi: estSpi,
      d: estSpi
        ? `M ${X(tx)} ${Y(ty)} Q ${X(tx - 0.08 * g.mat)} ${Y((ty + hy) / 2)} ${X(hx)} ${Y(hy)} Q ${X(cx + 0.05 * g.mat)} ${Y((hy + cy) / 2)} ${X(cx)} ${Y(cy)} Q ${X((tx + cx) / 2)} ${Y(ty - 0.5)} ${X(tx)} ${Y(ty)} Z`
        : `M ${X(tx)} ${Y(ty)} L ${X(hx)} ${Y(hy)} L ${X(cx)} ${Y(cy)} Z`,
    };
  }
  const toileGv = annee ? 'rgba(236,233,224,0.92)' : 'rgba(70,80,92,0.95)';
  const toileAvant = annee ? 'rgba(240,237,228,0.95)' : 'rgba(225,230,236,0.92)';
  const mats = goelette ? [xMis, xMat] : [xMat];
  return (
    <svg className="icone-voile" width={taille} height={(taille * H) / W} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <line x1="0" y1={Y(0)} x2={W} y2={Y(0)} stroke="#2f6f9f" strokeWidth="0.8" />
      {/* coque de profil (multicoque : coque centrale haute sur l'eau) */}
      <path d={`M ${X(0)} ${Y(g.fb + 0.2)} L ${X(g.L)} ${Y(g.fb)} L ${X(g.L)} ${Y(multi ? 0.6 : -0.2)} Q ${X(g.L * 0.5)} ${Y(multi ? 0.2 : -0.7)} ${X(0.08 * g.L)} ${Y(multi ? 0.8 : 0.1)} Z`}
        fill={goelette ? '#2a3038' : '#d5dce3'} stroke="#8a96a2" strokeWidth="0.5" />
      {g.bd > 0 && !goelette && <line x1={X(-g.bd)} y1={Y(g.fb + 0.3)} x2={X(0.05 * g.L)} y2={Y(g.fb + 0.25)} stroke="#9aa5b0" strokeWidth="0.9" />}
      {mats.map((x) => <line key={x} x1={X(x)} y1={Y(g.fb)} x2={X(x)} y2={Y(g.fb + g.mat)} stroke="#dfe6ec" strokeWidth="1.1" />)}
      {forme !== null && (
        <>
          {goelette && <path d={bermudienne(xMis, plan.misaine!.pres, g.misaine!.bome, ris ? 2 : 0)} fill={toileGv} stroke="#8d99a5" strokeWidth="0.4" />}
          <path d={bermudienne(xMat, plan.gv, g.bome, ris ? 2 : 0)} fill={toileGv} stroke="#a5b2bf" strokeWidth="0.4" />
          <line x1={X(xMat)} y1={Y(yBome)} x2={X(xMat + g.bome)} y2={Y(yBome)} stroke="#dfe6ec" strokeWidth="0.9" />
        </>
      )}
      {avant && <path d={avant.d} fill={avant.spi ? spi : toileAvant} fillOpacity={avant.spi ? 0.92 : 1} stroke="#6b7682" strokeWidth="0.4" />}
    </svg>
  );
}
