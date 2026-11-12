# Plateforme d'Ultim « volant » (trimaran de 32 m) construite par Blender, puis exportée en glTF pour le jeu.
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/ultim.py               → Ultim volant (design de Banque Populaire XI)
#   blender -b --python jeu/outils/blender/ultim.py -- ancien     → Ultim ancienne génération (design d'IDEC Sport)
# Sortie : jeu/packages/client/public/modeles/ultim.glb ou ultim_ancien.glb
#
# Ultim ancienne génération (décision du porteur de projet, 10/11/2026) : design d'IDEC Sport, ex-Groupama 3 (VPLP,
# Multiplast, 2006). Cotes (Wikipédia, article « Groupama 3 ») : longueur 31,5 m, largeur 22,5 m, tirant d'eau 5,70 m,
# mât ramené à 33,5 m. Traits relevés sur photo : bras droits (pas d'arche), flotteurs plus volumineux et plus hauts,
# pas de vol : dérives courbes dans les flotteurs, safrans sans plan porteur. Longueur des flotteurs non publiée (estimée).
#
# Design de référence (décision du porteur de projet, 10/11/2026) : Maxi Banque Populaire XI (VPLP, CDK Technologies, 2021).
# Cotes de la fiche officielle (voile.banquepopulaire.fr/bateaux/maxi-banque-populaire-xi/) : longueur 32 m, largeur 23 m,
# flotteurs de 32 m, casquette de 12 m, foils de 9 m (déployés à plat), dérive en T de 5 m, trois safrans à plan porteur
# en T. Autres proportions (jauge Ultim 32/23, prototype 3D validé, photos) : coque centrale 3,2 m de large, flotteurs fins.
# Formes relues sur des photos libres de Wikimedia Commons (CC BY-SA 4.0) : SVR Lazartigue (JMCunin, 2021),
# Gitana 17 (Jug81, 2022), Banque Populaire XI (Jug81, 2021-2022), Sodebo Ultim 3 (Jug81, 2022) :
# coque centrale haute et étroite, étraves droites, flotteurs presque aussi longs que la coque, bras en arche
# profilés comme des ailes, rouf vitré en arrière du mât, filets entre les bras.
# Le mât, le gréement, les foils, les safrans et les voiles restent générés par le jeu (scene3d.ts).
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF (+Y en haut) la met vers -z, comme dans le jeu.
# Matériaux nommés (coque, bande, fond, pont, bras, rouf, vitre, filet) : le jeu repeint coque, bras, rouf et bande.
import math
import os

import sys

import bmesh
import bpy

ANCIEN = 'ancien' in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

if ANCIEN:
    LC, LF = 31.5, 29.0       # IDEC Sport : 31,5 m ; flotteurs un peu plus courts que la coque (photo, estimé)
    FX = 22.5 / 2 - 0.8       # largeur hors tout 22,5 m
    FY = -0.8
else:
    LC, LF = 32.0, 32.0       # coque centrale et flotteurs : 32 m (fiche officielle de Banque Populaire XI)
    FX = 23.0 / 2 - 0.95      # écart des flotteurs (axe), largeur hors tout 23 m
    FY = 0.0                  # flotteurs aussi longs que la coque, à sa hauteur
ARCHE = 0.25 if ANCIEN else 1.2  # hauteur de l'arche des bras : droits sur IDEC Sport, en arche marquée sur Banque Populaire XI
MAT_Y = 3.2                   # pied de mât, en avant du milieu
BRAS = [(2.4, 1.7, 0.55), (-7.2, 1.4, 0.50)]  # (position, corde, épaisseur) des bras avant et arrière
S, K = 100, 120  # finesse : stations le long des coques, points par section (limite de l'antifouling nette)

SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packages', 'client', 'public', 'modeles', 'ultim_ancien.glb' if ANCIEN else 'ultim.glb')


def materiau(nom, couleur, rugosite=0.4, metal=0.0):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*couleur, 1)
    bsdf.inputs['Roughness'].default_value = rugosite
    bsdf.inputs['Metallic'].default_value = metal
    return m


def objet(nom, bm, mat, lisse=True):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = lisse
    return ob


# ---------------------------------------------------------------- Coques (centrale et flotteurs)
class Forme:
    """Coque définie par sa demi-largeur, son franc-bord et son tirant d'eau le long de t (0 : arrière, 1 : étrave)."""

    def __init__(self, L, demi, haut, creux, n, x0=0.0, y0=0.0, z0=0.0):
        self.L, self.demi, self.haut, self.creux, self.n = L, demi, haut, creux, n
        self.x0, self.y0, self.z0 = x0, y0, z0

    def y(self, t):
        return self.y0 + t * self.L - self.L / 2


CENTRALE = Forme(
    LC,
    # large à l'arrière (cockpit), pleine au milieu, étrave fine et droite
    demi=lambda t: 1.6 * (0.80 + 0.20 * math.sin(math.pi * min(1, t / 0.55))) * (1 - max(0.0, (t - 0.5) / 0.5) ** 1.7) + 0.02,
    haut=lambda t: 2.4 + 0.6 * t * t,                     # franc-bord haut, qui monte vers l'étrave
    # fond qui remonte vers l'étrave (pied d'étrave dégagé, photos de Gitana 17 et SVR Lazartigue)
    creux=lambda t: 0.95 * math.sin(math.pi * min(1.0, 0.12 + 0.88 * t)) + 0.1 - 0.45 * max(0.0, (t - 0.72) / 0.28) ** 2,
    n=2.3,
)


def flotteur(sx):
    return Forme(
        LF,
        # flotteurs fins, en lame (image de Banque Populaire XI, 10/11/2026) : 1,25 m de large au plus
        demi=lambda t: (0.8 if ANCIEN else 0.62) * (0.72 + 0.28 * math.sin(math.pi * min(1, t / 0.5))) * (1 - max(0.0, (t - 0.45) / 0.55) ** 1.8) + 0.02,
        # nettement plus bas que la coque centrale (photos), étrave qui se relève
        haut=(lambda t: 1.6 + 1.0 * t ** 2.5) if ANCIEN else (lambda t: 1.2 + 0.5 * t * t),
        creux=lambda t: 0.7 * math.sin(math.pi * min(1.0, 0.15 + 0.85 * t)) + 0.06 - 0.5 * max(0.0, (t - 0.7) / 0.3) ** 2,
        n=2.4, x0=sx * FX, y0=FY, z0=0.15,
    )


def coque(f, prefixe):
    """Bordé en deux matériaux (coque au-dessus de la flottaison, fond en dessous), tableau arrière, pont, liston."""
    grille, st = [], []
    for i in range(S + 1):
        t = i / S
        hb, top, dep, y = f.demi(t), f.haut(t) + f.z0, f.creux(t) - f.z0, f.y(t)
        st.append((y, hb, top))
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            c, s = math.cos(th), math.sin(th)
            z = top - (top + dep) * abs(s) ** (2 / f.n)
            evase = 0.82 + 0.18 * max(0.0, min(1.0, (z + dep) / (top + dep)))  # bordé évasé vers le pont
            x = f.x0 + hb * evase * math.copysign(abs(c) ** (2 / f.n), c)
            ligne.append((x, y, z))
        grille.append(ligne)
    parts = {'coque': bmesh.new(), 'fond': bmesh.new()}
    for i in range(S):
        for k in range(K):
            quad = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            bm = parts['fond' if sum(p[2] for p in quad) / 4 < 0.05 else 'coque']
            bm.faces.new([bm.verts.new(p) for p in quad])
    # tableau arrière
    bm = parts['coque']
    centre = bm.verts.new((f.x0, st[0][0], st[0][2] * 0.5))
    tab = [bm.verts.new(p) for p in grille[0]]
    for k in range(K):
        bm.faces.new([centre, tab[k + 1], tab[k]])
    for bm in parts.values():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet(prefixe + '_coque', parts['coque'], MAT['coque'])
    objet(prefixe + '_fond', parts['fond'], MAT['fond'])
    # pont légèrement bombé
    bm = bmesh.new()
    J = 8
    rangs = [[bm.verts.new((f.x0 + (-1 + 2 * j / J) * hb * 0.99, y, top + 0.05 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            bm.faces.new([rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]])
    objet(prefixe + '_pont', bm, MAT['pont'])
    # liston de couleur sous le pont
    bm = bmesh.new()
    for sx in (-1, 1):
        haut = [bm.verts.new((f.x0 + sx * (hb + 0.008), y, top - 0.02)) for (y, hb, top) in st]
        bas = [bm.verts.new((f.x0 + sx * (hb + 0.008), y, top - 0.30)) for (y, hb, top) in st]
        for i in range(len(st) - 1):
            bm.faces.new([haut[i], bas[i], bas[i + 1], haut[i + 1]])
    objet(prefixe + '_bande', bm, MAT['bande'])


def pont_en(f, y):
    t = min(1.0, max(0.0, (y - f.y0 + f.L / 2) / f.L))
    return f.haut(t) + f.z0


# ---------------------------------------------------------------- Bras en arche (profil d'aile)
def bras(y0, corde, ep):
    zc = pont_en(CENTRALE, y0) - 0.15
    zf = pont_en(flotteur(1), y0) - 0.10
    N, P = 60, 20
    bm = bmesh.new()
    anneaux = []
    for i in range(N + 1):
        x = -FX + 2 * FX * i / N
        u = abs(x) / FX
        z = zc + (zf - zc) * u + ARCHE * math.sin(math.pi * u) ** 1.3   # arche : monte du flotteur puis redescend vers la coque
        cr = corde * (1 - 0.25 * u)                                    # corde qui s'affine vers le flotteur
        anneau = []
        for k in range(P):
            a = 2 * math.pi * k / P
            # profil : nez arrondi vers l'avant (+Y), bord de fuite plus fin vers l'arrière
            yy = y0 + (cr / 2) * math.cos(a)
            zz = z + (ep / 2) * math.sin(a) * (0.55 + 0.45 * (1 + math.cos(a)) / 2)
            anneau.append(bm.verts.new((x, yy, zz)))
        anneaux.append(anneau)
    for i in range(N):
        for k in range(P):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % P], anneaux[i + 1][(k + 1) % P], anneaux[i + 1][k]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('bras', bm, MAT['bras'])
    return lambda x: zc + (zf - zc) * abs(x) / FX + ARCHE * math.sin(math.pi * abs(x) / FX) ** 1.3


def filets(z_avant, z_arriere):
    """Trampolines entre les bras, de chaque côté de la coque centrale."""
    (ya, ca, _), (yr, cr, _) = BRAS
    for sx in (-1, 1):
        bm = bmesh.new()
        N = 16
        rangs = []
        for i in range(N + 1):
            x = sx * (1.9 + (FX - 2.9) * i / N)
            rangs.append([bm.verts.new((x, ya - ca * 0.4, z_avant(x) - 0.12)), bm.verts.new((x, yr + cr * 0.4, z_arriere(x) - 0.12))])
        for i in range(N):
            bm.faces.new([rangs[i][0], rangs[i + 1][0], rangs[i + 1][1], rangs[i][1]])
        objet('filet', bm, MAT['filet'], lisse=False)


# ---------------------------------------------------------------- Rouf vitré et cockpit
def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


def rouf():
    # Rouf en arrière du mât (Banque Populaire XI, Sodebo Ultim 3) : bas, incliné vers l'avant, bandeau vitré.
    y1, y0 = (MAT_Y - 0.9, MAT_Y - 6.9) if ANCIEN else (MAT_Y - 0.9, MAT_Y - 12.9)  # casquette de 12 m (fiche officielle de BP XI)
    z = pont_en(CENTRALE, (y0 + y1) / 2)
    boite('rouf', -1.15, 1.15, y0, y1, z, z + 0.85, avant_bas=0.35, mat=MAT['rouf'])
    boite('vitre', -1.17, 1.17, y0 + 0.6, y1 - 0.4, z + 0.42, z + 0.66, avant_bas=0.2, mat=MAT['vitre'])
    # cockpit arrière ouvert (plancher sombre en retrait)
    zc = pont_en(CENTRALE, -LC / 2 + 2) - 0.45
    boite('cockpit', -1.05, 1.05, -LC / 2 + 0.3, y0 - 0.2, zc, zc + 0.05, mat=MAT['cockpit'])


# ---------------------------------------------------------------- Appendices, mât et bôme (demande du 10/11/2026)
# Pièces séparées et nommées : le jeu les accroche à ses éléments animés (foil sous le vent descendu, foil au vent
# relevé, mât-aile qui pivote, bôme qui suit la grand-voile). Les cotes exactes ne sont pas publiées par les équipes :
# formes d'après les descriptions (foils en L sous les flotteurs, trois safrans à plan porteur, dérive centrale à
# plan porteur, mât-aile tournant à barres de flèche) et proportions relevées sur les photos ; tirant d'air limité
# par la jauge à 120 % de la longueur (38,4 m).
from mathutils import Vector

PONT_MAT = 2.4 + 0.6 * 0.6 ** 2 + 0.15   # hauteur du pied de mât (même valeur que le jeu : deckY)
MAT_H = 33.5 if ANCIEN else 35.0         # IDEC Sport : mât de 33,5 m (Wikipédia) ; Ultim volant : 35 m (prototype validé)


def catmull(pts, n=10):
    """Courbe lisse passant par les points (Catmull-Rom), n pas par segment."""
    P = [Vector(p) for p in pts]
    P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out


def section_naca(c, ep, P=28):
    """Profil symétrique (NACA 00xx) : (u le long de la corde, bord d'attaque vers +u ; v l'épaisseur)."""
    pts = []
    for k in range(P):
        a = 2 * math.pi * k / P
        x = (1 - math.cos(a)) / 2          # 0 bord d'attaque → 1 bord de fuite → 0
        yt = 5 * ep * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        pts.append(((0.3 - x) * c, math.copysign(yt * c, math.sin(a) if k else 1)))
    return pts


def section_ellipse(c, ep, P=20):
    return [((c / 2) * math.cos(2 * math.pi * k / P), (ep / 2) * math.sin(2 * math.pi * k / P)) for k in range(P)]


def balayer(nom, pts, corde, epaisseur, dir_corde, section=section_naca, mat=None, origine=(0, 0, 0)):
    """Pièce profilée le long d'un chemin : corde(s) et épaisseur(s) relatives données en fonction de s (0 → 1)."""
    bm = bmesh.new()
    anneaux = []
    o = Vector(origine)
    d = Vector(dir_corde).normalized()
    for i, p in enumerate(pts):
        s = i / (len(pts) - 1)
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        c = (d - t * d.dot(t)).normalized()
        e = t.cross(c)
        anneaux.append([bm.verts.new(p - o + c * u + e * v) for (u, v) in section(corde(s), epaisseur(s))])
    n = len(anneaux[0])
    for i in range(len(anneaux) - 1):
        for k in range(n):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % n], anneaux[i + 1][(k + 1) % n], anneaux[i + 1][k]])
    bm.faces.new(anneaux[0])
    bm.faces.new(list(reversed(anneaux[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = objet(nom, bm, mat or MAT['carbone'])
    ob.location = o
    return ob


def appendices_ancien():
    """IDEC Sport : dérives courbes dans les flotteurs (relevées au vent), dérive centrale droite, safrans sans plan porteur.
    Tirant d'eau 5,70 m (Wikipédia)."""
    car = MAT['carbone']
    yf = BRAS[0][0] - 0.6
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        x0 = sx * FX
        chemin = catmull([(x0, yf, 1.5), (x0, yf, -2.4), (x0 - sx * 0.35, yf + 0.05, -4.4), (x0 - sx * 0.9, yf + 0.1, -5.6)], 12)
        balayer(nom, chemin, lambda s: 0.85 - 0.3 * s, lambda s: 0.12, (0, 1, 0), mat=car)
    def safran(nom, x, y, z_haut, prof):
        balayer(nom, catmull([(x, y, z_haut), (x, y - 0.12, z_haut - prof * 0.5), (x, y - 0.3, z_haut - prof)], 8),
                lambda s: 0.95 - 0.3 * s, lambda s: 0.12, (0, 1, 0), mat=car)
    safran('app_safran_centre', 0, -LC / 2 + 0.7, 1.6, 4.8)
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        safran('app_safran_' + cote, sx * FX, FY - LF / 2 + 0.8, 1.4, 4.2)
    yd = MAT_Y - 1.5
    balayer('app_derive', catmull([(0, yd, 0.6), (0, yd - 0.1, -2.6), (0, yd - 0.25, -5.7)], 8), lambda s: 1.3 - 0.35 * s, lambda s: 0.12, (0, 1, 0), mat=car)


def appendices():
    if ANCIEN:
        return appendices_ancien()
    car = MAT['carbone']
    # Foils en L sous les flotteurs, au droit du bras avant : puits vertical, coude arrondi, aile tournée vers l'intérieur.
    yf = BRAS[0][0] - 0.6  # même place que dans le jeu (bras avant + 0,6 m vers l'arrière)
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        x0 = sx * FX
        # Grande courbe continue en C (photo de Banque Populaire XI chaviré, 2022) : puits vertical, coude à grand rayon,
        # aile qui file vers la coque centrale en se relevant légèrement au bout.
        # 9 m de foil déployé à plat (fiche officielle) : puits de 2,1 m, coude, aile de 4,8 m d'envergure.
        chemin = catmull([(x0, yf, 1.3), (x0, yf, -0.8), (x0 - sx * 0.3, yf + 0.03, -2.2), (x0 - sx * 1.1, yf + 0.08, -3.3),
                          (x0 - sx * 2.3, yf + 0.12, -3.8), (x0 - sx * 3.6, yf + 0.18, -3.75), (x0 - sx * 4.8, yf + 0.25, -3.4)], 12)
        balayer(nom, chemin, lambda s: 0.58 if s < 0.35 else 0.58 - 0.28 * (s - 0.35) / 0.65, lambda s: 0.13 if s < 0.35 else 0.11,
                (0, 1, 0), mat=car)
    # Safrans à plan porteur en T : un sur la coque centrale, un sur chaque flotteur.
    def safran(nom, x, y, z_haut, prof, env):
        balayer(nom, catmull([(x, y, z_haut), (x, y - 0.12, z_haut - prof * 0.5), (x, y - 0.3, z_haut - prof)], 8),
                lambda s: 0.85 - 0.25 * s, lambda s: 0.12, (0, 1, 0), mat=car)
        balayer(nom + '_plan', catmull([(x - env / 2, y - 0.25, z_haut - prof + 0.08), (x, y - 0.3, z_haut - prof + 0.02), (x + env / 2, y - 0.25, z_haut - prof + 0.08)], 8),
                lambda s: 0.6 - 0.25 * abs(2 * s - 1), lambda s: 0.1, (0, 1, 0), mat=car)
    safran('app_safran_centre', 0, -LC / 2 + 0.7, 1.6, 4.9, 2.2)
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        # la tête du safran dépasse d'environ 1 m au-dessus du pont du flotteur (image de Banque Populaire XI)
        safran('app_safran_' + cote, sx * FX, FY - LF / 2 + 0.8, 2.45, 5.2, 1.8)
    # Dérive centrale à plan porteur, en arrière du mât.
    yd = MAT_Y - 1.5
    # dérive en T de 5 m (fiche officielle)
    balayer('app_derive', catmull([(0, yd, 0.6), (0, yd - 0.1, -1.9), (0, yd - 0.25, -4.4)], 8), lambda s: 1.25 - 0.3 * s, lambda s: 0.12, (0, 1, 0), mat=car)
    balayer('app_derive_plan', catmull([(-1.6, yd - 0.15, -4.25), (0, yd - 0.25, -4.38), (1.6, yd - 0.15, -4.25)], 8),
            lambda s: 0.7 - 0.3 * abs(2 * s - 1), lambda s: 0.1, (0, 1, 0), mat=car)
    # Pas de bout-dehors sur les Ultim volants : la voile d'avant est amurée à l'étrave (image de Banque Populaire XI).


def mat_et_bome():
    car = MAT['carbone']
    pied = (0, MAT_Y, PONT_MAT)
    # Mât-aile tournant : profil épais (corde 0,95 m au pied, 0,45 m en tête), bord d'attaque vers l'avant.
    pts = [Vector((0, MAT_Y, PONT_MAT + MAT_H * k / 40)) for k in range(41)]
    balayer('pivot_mat', pts, lambda s: 0.95 - 0.5 * s ** 1.5, lambda s: 0.34, (0, 1, 0), mat=car, origine=pied)
    # Barres de flèche (losanges), à 55 % de la hauteur, légèrement reculées.
    zf = PONT_MAT + MAT_H * 0.55
    for sx in (-1, 1):
        b = balayer('pivot_mat_fleche', [Vector((0, MAT_Y - 0.1, zf)), Vector((sx * 2.6, MAT_Y - 0.6, zf + 0.15))], lambda s: 0.22 - 0.08 * s, lambda s: 0.3, (0, 1, 0), mat=car, origine=pied)
        b.parent = bpy.data.objects['pivot_mat']
        b.location = (0, 0, 0)
    # Bôme : section haute et étroite, du vit-de-mulet vers l'arrière (12,5 m), à 0,75 m au-dessus du pont.
    pts = [Vector((0, MAT_Y - 0.3 - 12.2 * k / 20, PONT_MAT + 0.75)) for k in range(21)]
    balayer('pivot_bome', pts, lambda s: 0.62 - 0.25 * s, lambda s: 0.55, (0, 0, 1), section=section_ellipse, mat=car, origine=pied)


bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {
    'carbone': materiau('carbone', (0.07, 0.08, 0.09), 0.45, 0.2),
    'coque': materiau('coque', (0.9, 0.9, 0.92), 0.35),
    'bande': materiau('bande', (0.1, 0.4, 0.8), 0.35),
    'fond': materiau('fond', (0.08, 0.09, 0.11), 0.6),
    'pont': materiau('pont', (0.55, 0.58, 0.62), 0.85),
    'bras': materiau('bras', (0.9, 0.9, 0.92), 0.35),
    'rouf': materiau('rouf', (0.9, 0.9, 0.92), 0.35),
    'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.08, 0.6),
    'cockpit': materiau('cockpit', (0.16, 0.17, 0.19), 0.9),
    'filet': materiau('filet', (0.2, 0.22, 0.25), 0.95),
}
coque(CENTRALE, 'centrale')
for sx in (-1, 1):
    coque(flotteur(sx), 'flotteur')
za = bras(*BRAS[0])
zr = bras(*BRAS[1])
filets(za, zr)
rouf()
appendices()
mat_et_bome()
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(SORTIE), export_format='GLB', export_yup=True, export_apply=True)
print('Modèle exporté :', os.path.abspath(SORTIE))
