import { useState } from 'react';
import type { Modele3D } from './scene3d';
import { anneeVintage, grandVoile, MONOS_VINTAGE, MULTIS_VINTAGE, nomsVoiles, planDe } from './voilure';
import type { Forme } from './voilure';

/**
 * Plan de voilure dessiné de profil (hangar) : coque, mât, grand-voile à tête carrée et voile d'avant choisie, à leurs
 * vraies proportions et surfaces (plans de voilure de voilure.ts). Cotes de gréement : mêmes valeurs que les modèles 3D.
 * Goélette (Pen Duick III) : grand-voile sur le grand mât (arrière), misaine sur le mât de misaine (avant), voile d'avant
 * frappée en tête du mât de misaine.
 */
type Greement = { L: number; mat: number; pied: number; bome: number; bd: number; fb: number; nom: string; misaine?: { pied: number; bome: number } };
const GREEMENT: Record<string, Greement> = {
  imoca: { L: 18.28, mat: 27, pied: 0.45, bome: 7.4, bd: 2.3, fb: 1.8, nom: 'IMOCA à foils' },
  imoca_derives: { L: 18.28, mat: 27, pied: 0.45, bome: 7.4, bd: 2.5, fb: 1.6, nom: 'IMOCA à dérives' },
  class40: { L: 12.19, mat: 18, pied: 0.45, bome: 4.9, bd: 1.5, fb: 1.6, nom: 'Class40' },
  ultim: { L: 32, mat: 35, pied: 0.4, bome: 11.9, bd: 0, fb: 2.6, nom: 'Ultim' },
  ultim_ancien: { L: 31.5, mat: 33.5, pied: 0.4, bome: 11.9, bd: 0, fb: 2.5, nom: 'Ultim ancienne génération' },
  ocean_fifty: { L: 15.24, mat: 21.6, pied: 0.42, bome: 5.7, bd: 0, fb: 1.6, nom: 'Ocean Fifty' },
  pen_duick_3: { L: 17.45, mat: 17.65, pied: 10.9 / 17.45, bome: 5.6, bd: 1.2, fb: 1.15, nom: 'Pen Duick III (goélette)', misaine: { pied: 6.0 / 17.45, bome: 4.3 } },
};

const ESTIMEES: Record<string, Forme[]> = {
  imoca: ['tourmentin', 'j3', 'a3'], imoca_derives: ['tourmentin', 'j3', 'fro', 'a3'], class40: ['tourmentin', 'j3', 'fro', 'a3', 'a2'],
  ultim: ['tourmentin'], ultim_ancien: ['tourmentin', 'j3', 'fro'], ocean_fifty: ['tourmentin', 'j3', 'j2'],
  pen_duick_3: ['tourmentin', 'j3', 'j2', 'fro', 'a3', 'a2'],
};
const SOURCES: Record<string, string> = {
  imoca: 'Figaro Nautisme (2024), vvanat.fr', imoca_derives: 'fiche VPLP de Macif 2011 (300 m² au près, 550 au portant)',
  class40: 'jauge Class40 : 115 m² au plus au près (globe40.com)', ultim: 'fiche officielle de Banque Populaire XI',
  ultim_ancien: 'Wikipédia, Groupama 3 / IDEC Sport (411 m² au près, 678 au portant)', ocean_fifty: 'VPLP, bateaux.com (≈ 200 m² au près, 250 à 265 au portant)',
  pen_duick_3: "Wikipédia (152 m² au près) ; bateaux.com (tirant d'air 18,80 m, deux mâts de même hauteur, misaines de 36 et 93,60 m²). Grand-voile et génois estimés pour retrouver les 152 m² au près",
};

const fr = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

/** Monocoques de légende : gréement et sources tirés des cotes (modeles-vintage.json). */
for (const [id, v] of Object.entries(MONOS_VINTAGE)) {
  GREEMENT[id] = { L: v.longueur, mat: v.hauteur_mat, pied: 1 - v.pied_mat, bome: v.bome, bd: v.bout_dehors, fb: v.franc_bord, nom: v.nom };
  ESTIMEES[id] = (['tourmentin', 'j3', 'j2', 'fro', 'a3', 'a2'] as Forme[]).filter((f) => v.estimees.includes(f));
  SOURCES[id] = v.sources;
}
/** Multicoques de légende : idem (bôme du repère du jeu : 12,5 m pour 32 m de long). */
for (const [id, v] of Object.entries(MULTIS_VINTAGE)) {
  GREEMENT[id] = { L: v.longueur, mat: v.hauteur_mat, pied: 1 - v.pied_mat, bome: (12.5 * v.longueur) / 32, bd: v.bout_dehors, fb: 1.4 * (v.longueur / 18.28), nom: v.nom };
  ESTIMEES[id] = (['tourmentin', 'j3', 'j2', 'fro', 'a3', 'a2'] as Forme[]).filter((f) => v.estimees.includes(f));
  SOURCES[id] = v.sources;
}

export default function PlanVoilure({ modele }: { modele: Modele3D }) {
  const [forme, setForme] = useState<Forme>('j2');
  const g = GREEMENT[modele] ?? GREEMENT.imoca;
  const plan = planDe(modele);
  const NOMS = nomsVoiles(modele);
  const goelette = !!g.misaine && !!plan.misaine;
  const annee = anneeVintage(modele); // bateau de légende : voiles d'époque
  const W = 360, H = 420;
  const k = (H - 40) / (g.mat + g.fb + 1.5);
  const X = (m: number) => 20 + m * k;                    // m : distance depuis l'étrave (avant à gauche)
  const Y = (m: number) => H - 20 - m * k;                // m : hauteur au-dessus de l'eau
  const xMat = g.pied * g.L, yPont = g.fb, yBome = g.fb + 1.0;
  /** Voile bermudienne (vraie grandeur) sur un mât et sa bôme. */
  const bermudienne = (x0: number, aire: number, bome: number) => {
    const v = grandVoile(aire, g.mat - 1.6, bome, 0, annee);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      pts.push([x0 + bome + (v.tete - bome) * f + v.rond * Math.sin(Math.PI * f), yBome + v.P * f]);
    }
    return { d: `M ${X(x0)} ${Y(yBome)} L ${X(x0)} ${Y(yBome + v.P)} ` + pts.reverse().map(([x, y]) => `L ${X(x)} ${Y(y)}`).join(' ') + ' Z', P: v.P };
  };
  const gv = bermudienne(xMat, plan.gv, g.bome);
  // Goélette : misaine lattée sur le mât avant. La grande misaine à wishbone (portant) n'est pas dessinée : forme inconnue.
  const xMis = g.misaine ? g.misaine.pied * g.L : xMat;
  const misaineD = goelette ? bermudienne(xMis, plan.misaine!.pres, g.misaine!.bome).d : '';
  const aireMisaine = goelette ? plan.misaine!.pres : 0;
  // Voile d'avant : amure, têtière sur le mât (le mât avant d'une goélette), point d'écoute pour la surface
  const aire = plan.voiles[forme];
  const amure = forme === 'tourmentin' || forme === 'j3' ? 0.13 * g.L : forme === 'j2' || (annee && forme === 'fro') ? 0.03 * g.L : -g.bd;
  const haut = { tourmentin: 0.42, j3: 0.6, j2: annee ? 0.9 : 0.82, fro: annee ? 0.95 : 0.93, a3: 0.95, a2: 0.98, sgt: 0.8 }[forme] * g.mat + g.fb;
  const rond = { tourmentin: 1, j3: 1, j2: 1, fro: 1.05, a3: 1.2, a2: 1.3, sgt: 1.15 }[forme];
  // Goélette : spi symétrique amuré au bout du tangon (5,8 m, porté à 45° : 4,1 m en avant du mât de misaine, 2 m au-dessus du pont).
  const spiTangon = goelette && (forme === 'a3' || forme === 'a2' || forme === 'sgt');
  const tx = spiTangon ? xMis - 4.1 : amure, ty = spiTangon ? g.fb + 2.0 : g.fb + 0.3, hx = xMis - 0.3, hy = haut;
  const dirx = 1, diry = forme === 'a2' ? 0.18 : forme === 'a3' ? 0.06 : -0.06;
  const n = Math.hypot(dirx, diry);
  const cross = Math.abs((hx - tx) * (diry / n) - (hy - ty) * (dirx / n));
  const d = (2 * aire) / rond / Math.max(0.5, cross);
  const cx = tx + (d * dirx) / n, cy = Math.max(g.fb + 0.4, ty + (d * diry) / n);
  const spi = forme === 'a3' || forme === 'a2' || forme === 'sgt';
  const avantD = spi
    ? `M ${X(tx)} ${Y(ty)} Q ${X(tx - 0.08 * g.mat)} ${Y((ty + hy) / 2)} ${X(hx)} ${Y(hy)} Q ${X(cx + 0.05 * g.mat)} ${Y((hy + cy) / 2)} ${X(cx)} ${Y(cy)} Q ${X((tx + cx) / 2)} ${Y(ty - 0.5)} ${X(tx)} ${Y(ty)} Z`
    : `M ${X(tx)} ${Y(ty)} L ${X(hx)} ${Y(hy)} L ${X(cx)} ${Y(cy)} Z`;
  const total = plan.gv + aire + aireMisaine;
  const mats = goelette ? [xMis, xMat] : [xMat];
  const toile = annee ? 'rgba(236,233,224,0.9)' : 'rgba(60,70,82,0.85)'; // tergal ou Mylar clairs (bateaux de légende) ou carbone
  return (
    <div className="plan-voilure">
      <h3>Plan de voilure</h3>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Plan de voilure : ${g.nom}`} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, maxWidth: '100%' }}>
          <line x1="0" y1={Y(0)} x2={W} y2={Y(0)} stroke="#2f6f9f" strokeWidth="1.5" />
          {/* coque de profil : étrave à gauche */}
          <path d={`M ${X(0)} ${Y(g.fb + 0.2)} L ${X(g.L)} ${Y(g.fb)} L ${X(g.L)} ${Y(-0.2)} Q ${X(g.L * 0.5)} ${Y(-0.7)} ${X(0.08 * g.L)} ${Y(0.1)} Z`} fill={goelette ? '#1d2126' : '#cfd6dd'} stroke="#8a96a2" />
          {spiTangon && <line x1={X(xMis)} y1={Y(g.fb + 1.7)} x2={X(tx)} y2={Y(ty)} stroke="#555" strokeWidth="2" />}
          {g.bd > 0 && !goelette && <line x1={X(-g.bd)} y1={Y(g.fb + 0.3)} x2={X(0.05 * g.L)} y2={Y(g.fb + 0.25)} stroke="#555" strokeWidth="2" />}
          {/* mâts et bômes */}
          {mats.map((x) => <line key={x} x1={X(x)} y1={Y(yPont)} x2={X(x)} y2={Y(g.fb + g.mat)} stroke="#222" strokeWidth="3" />)}
          <line x1={X(xMat)} y1={Y(yBome)} x2={X(xMat + g.bome)} y2={Y(yBome)} stroke="#222" strokeWidth="2.5" />
          {goelette && <line x1={X(xMis)} y1={Y(yBome)} x2={X(xMis + g.misaine!.bome)} y2={Y(yBome)} stroke="#222" strokeWidth="2.5" />}
          {misaineD && <path d={misaineD} fill={toile} stroke="#6b7682" />}
          <path d={gv.d} fill={toile} stroke={goelette ? '#6b7682' : '#1d2228'} />
          <path d={avantD} fill={spi ? 'rgba(230,120,60,0.75)' : 'rgba(225,230,236,0.8)'} stroke="#6b7682" />
          <text x={X(xMat + g.bome * 0.45)} y={Y(yBome + gv.P * 0.45)} fill={goelette ? '#1d2228' : '#fff'} fontSize="12" textAnchor="middle">Grand-voile {plan.gv} m²</text>
          {misaineD && <text x={X(xMis + 2.2)} y={Y(yBome + gv.P * 0.62)} fill="#1d2228" fontSize="11" textAnchor="middle">Misaine {fr(aireMisaine)} m²</text>}
          <text x={Math.max(70, X((tx + hx + cx) / 3))} y={Y((ty + hy + cy) / 3)} fill={spi ? '#fff' : '#1d2228'} fontSize="11" textAnchor="middle">{NOMS[forme]} {aire} m²</text>
          <text x={W - 10} y={18} fill="#9fb3c6" fontSize="11" textAnchor="end">{goelette ? 'Deux mâts de' : 'Mât'} {fr(g.mat)} m au-dessus du pont · {fr(g.L)} m</text>
        </svg>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="segment" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(NOMS) as Forme[]).filter((f) => plan.voiles[f] > 0).map((f) => (
              <button key={f} aria-pressed={forme === f} onClick={() => setForme(f)}>{NOMS[f]}</button>
            ))}
          </div>
          <table className="tableau-info" style={{ marginTop: 8 }}>
            <tbody>
              <tr><th>Grand-voile</th><td>{plan.gv} m²{modele === 'class40' || goelette || (MONOS_VINTAGE[modele] ?? MULTIS_VINTAGE[modele])?.estimees.includes('gv') ? ' (estimée)' : ''}</td></tr>
              {goelette && (
                <>
                  <tr><th>Misaine lattée</th><td>{plan.misaine!.pres} m²</td></tr>
                  <tr><th>Grande misaine à wishbone (largue, vent arrière)</th><td>{fr(plan.misaine!.portant)} m² (non dessinée : forme inconnue)</td></tr>
                </>
              )}
              {(Object.keys(NOMS) as Forme[]).filter((f) => plan.voiles[f] > 0).map((f) => (
                <tr key={f} style={{ fontWeight: f === forme ? 700 : 400 }}><th>{NOMS[f]}</th><td>{plan.voiles[f]} m²{f === 'sgt' || (ESTIMEES[modele] ?? []).includes(f) ? ' (estimée)' : ''}</td></tr>
              ))}
              <tr><th>Total affiché</th><td>{fr(total)} m²</td></tr>
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 11.5 }}>Source : {SOURCES[modele] ?? '—'}. Les voiles marquées « estimée » n'ont pas de chiffre publié.</p>
        </div>
      </div>
    </div>
  );
}
