# Ocean Fifty (trimaran de 50 pieds) construit par Blender, puis exporté en glTF pour le jeu.
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/oceanfifty.py
# Sortie : jeu/packages/client/public/modeles/ocean_fifty.glb
#
# Jauge Ocean Fifty (Wikipédia, article « Ocean Fifty ») : longueur 15,24 m, largeur 15,24 m au plus, tirant d'eau 3,50 m,
# tirant d'air 23,77 m, deux foils monotypes, quatre safrans et dérives au plus.
# Architecture (décision du porteur de projet, 10/11/2026) : celle de Solidaires en Peloton (dessin VPLP envoyé par le
# porteur de projet), préférée à la « structure en K » des derniers VPLP : deux bras en arche, avant et arrière, bras courbe
# partant du milieu du bras arrière vers l'arrière de la coque centrale, filets entre les bras, cellule de vie dans la coque centrale, dérives pour foils dans les flotteurs, trois safrans. Photos libres de Wikimedia Commons (CC BY 4.0 et CC BY-SA
# 4.0 : Koesio par Stephan Sprinz 2023, Primonial 2019, Le Rire médecin et Viabilis par Jug81 2023, Mon Bonnet Rose 2024) :
# flotteurs fins coupés net à l'arrière, bras en arche, C-foil sous le flotteur, safrans droits, mât-aile très haut.
# Construit en vraie grandeur puis agrandi de 32/15,24 : le jeu dessine ses trimarans dans le repère d'un Ultim de 32 m
# et réduit ensuite l'Ocean Fifty. Pièces séparées et nommées, accrochées aux éléments animés du jeu.
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF la met vers -z, comme dans le jeu.
import math
import os

import bmesh
import bpy
from mathutils import Vector

K_JEU = 32 / 15.24
LC, LF = 15.24, 14.6
FX = 7.1                       # axe des flotteurs : largeur hors tout 15,24 m
FY = -0.3                      # flotteurs un peu reculés
MAT_Y = 1.2                    # pied de mât, en avant du milieu (jeu : MAST_Z = -1,2 m)
BRAS_AV = 1.6                  # bras avant
MAT_H = 21.6                   # tirant d'air 23,77 m : 21,6 m au-dessus du pont
PONT_MAT = 1.5 + 0.4 * 0.6 ** 2 + 0.15 / K_JEU
S, K = 90, 110
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packages', 'client', 'public', 'modeles', 'ocean_fifty.glb')


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


class Forme:
    def __init__(self, L, demi, haut, creux, n, x0=0.0, y0=0.0):
        self.L, self.demi, self.haut, self.creux, self.n, self.x0, self.y0 = L, demi, haut, creux, n, x0, y0

    def y(self, t):
        return self.y0 + t * self.L - self.L / 2


CENTRALE = Forme(LC,
                 demi=lambda t: 1.0 * (0.8 + 0.2 * math.sin(math.pi * min(1, t / 0.55))) * (1 - max(0.0, (t - 0.5) / 0.5) ** 1.7) + 0.02,
                 haut=lambda t: 1.5 + 0.4 * t * t,
                 creux=lambda t: 0.75 * math.sin(math.pi * min(1.0, 0.12 + 0.88 * t)) + 0.08 - 0.3 * max(0.0, (t - 0.72) / 0.28) ** 2,
                 n=2.2)


def flotteur(sx):
    # fins, coupés net à l'arrière (tableau vertical), étrave fine qui se relève (photos de Koesio et Primonial)
    return Forme(LF,
                 demi=lambda t: 0.52 * (0.85 + 0.15 * math.sin(math.pi * min(1, t / 0.5))) * (1 - max(0.0, (t - 0.45) / 0.55) ** 1.8) + 0.02,
                 haut=lambda t: 1.1 + 0.35 * t * t,
                 creux=lambda t: 0.5 * math.sin(math.pi * min(1.0, 0.25 + 0.75 * t)) + 0.1 - 0.35 * max(0.0, (t - 0.7) / 0.3) ** 2,
                 n=2.4, x0=sx * FX, y0=FY)


def coque(f, prefixe):
    grille, st = [], []
    for i in range(S + 1):
        t = i / S
        hb, top, dep, y = f.demi(t), f.haut(t), f.creux(t), f.y(t)
        st.append((y, hb, top))
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            c, s = math.cos(th), math.sin(th)
            z = top - (top + dep) * abs(s) ** (2 / f.n)
            evase = 0.85 + 0.15 * max(0.0, min(1.0, (z + dep) / (top + dep)))
            ligne.append((f.x0 + hb * evase * math.copysign(abs(c) ** (2 / f.n), c), y, z))
        grille.append(ligne)
    parts = {'coque': bmesh.new(), 'fond': bmesh.new()}
    for i in range(S):
        for k in range(K):
            q = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            bm = parts['fond' if sum(p[2] for p in q) / 4 < 0.05 else 'coque']
            bm.faces.new([bm.verts.new(p) for p in q])
    bm = parts['coque']
    centre = bm.verts.new((f.x0, st[0][0], st[0][2] * 0.4))
    tab = [bm.verts.new(p) for p in grille[0]]
    for k in range(K):
        bm.faces.new([centre, tab[k + 1], tab[k]])
    for bm in parts.values():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet(prefixe + '_coque', parts['coque'], MAT['coque'])
    objet(prefixe + '_fond', parts['fond'], MAT['fond'])
    bm = bmesh.new()
    J = 8
    rangs = [[bm.verts.new((f.x0 + (-1 + 2 * j / J) * hb * 0.99, y, top + 0.04 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            bm.faces.new([rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]])
    objet(prefixe + '_pont', bm, MAT['pont'])
    bm = bmesh.new()
    for sx in (-1, 1):
        h = [bm.verts.new((f.x0 + sx * (hb + 0.006), y, top - 0.02)) for (y, hb, top) in st]
        b = [bm.verts.new((f.x0 + sx * (hb + 0.006), y, top - 0.2)) for (y, hb, top) in st]
        for i in range(len(st) - 1):
            bm.faces.new([h[i], b[i], b[i + 1], h[i + 1]])
    objet(prefixe + '_bande', bm, MAT['bande'])


def pont(f, y):
    t = min(1.0, max(0.0, (y - f.y0 + f.L / 2) / f.L))
    return f.haut(t)


# ---------------------------------------------------------------- Pièces profilées
def catmull(pts, n=10):
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


def section_naca(c, ep, P=26):
    pts = []
    for k in range(P):
        a = 2 * math.pi * k / P
        x = (1 - math.cos(a)) / 2
        yt = 5 * ep * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        pts.append(((0.3 - x) * c, math.copysign(yt * c, math.sin(a) if k else 1)))
    return pts


def section_ellipse(c, ep, P=20):
    return [((c / 2) * math.cos(2 * math.pi * k / P), (ep / 2) * math.sin(2 * math.pi * k / P)) for k in range(P)]


def balayer(nom, pts, corde, epaisseur, dir_corde, section=section_naca, mat=None, origine=(0, 0, 0)):
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


# ---------------------------------------------------------------- Bras (structure de Solidaires en Peloton)
BRAS_AR = -4.0                 # bras arrière (jeu : BEAM_A = +4,0 m)


def arche(y, corde, ep, haut):
    """Bras en arche d'un flotteur à l'autre : monte depuis le flotteur puis redescend vers la coque centrale."""
    fl = flotteur(1)
    zc, zf = pont(CENTRALE, y) - 0.05, pont(fl, y) - 0.05
    pts = [Vector((x, y, zc + (zf - zc) * abs(x) / FX + haut * math.sin(math.pi * abs(x) / FX) ** 1.2)) for x in [-FX + 2 * FX * i / 60 for i in range(61)]]
    balayer('bras', pts, lambda s: corde * (1 - 0.3 * abs(2 * s - 1)), lambda s: ep, (0, 1, 0), mat=MAT['bras'])
    return lambda x: zc + (zf - zc) * abs(x) / FX + haut * math.sin(math.pi * abs(x) / FX) ** 1.2


def bras():
    # Solidaires en Peloton (dessin envoyé par le porteur de projet, 10/11/2026) : deux bras en arche, avant et arrière,
    # larges et profilés, filets tendus entre eux de chaque côté de la coque centrale.
    # carénages profilés en aile (dessin), corde 1 m et 0,85 m
    za = arche(BRAS_AV, 1.0, 0.22, 0.65)  # corde réduite à 1 m (porteur de projet : bras trop larges)
    zr = arche(BRAS_AR, 0.85, 0.22, 0.6)
    # bras courbe derrière le bras arrière (dessin de Solidaires en Peloton) : part du milieu du bras arrière, de chaque côté,
    # et rejoint l'arrière de la coque centrale en arc de cercle (précision du porteur de projet, 10/11/2026)
    xm = FX * 0.5
    zc = pont(CENTRALE, -LC / 2 + 0.6) + 0.05
    # il passe au-dessus du cockpit, à mi-chemin entre le bras arrière et le tableau (comparaison au dessin, 10/11/2026)
    zc = pont(CENTRALE, -5.6) + 0.45
    pts = catmull([(-xm, BRAS_AR - 0.2, zr(xm) - 0.05), (-xm * 0.7, -5.1, (zr(xm) + zc) / 2 + 0.05), (0, -5.7, zc),
                   (xm * 0.7, -5.1, (zr(xm) + zc) / 2 + 0.05), (xm, BRAS_AR - 0.2, zr(xm) - 0.05)], 12)
    balayer('bras_courbe', pts, lambda s: 0.6, lambda s: 0.28, (0, 0, 1), section=section_ellipse, mat=MAT['bras'])
    for sx in (-1, 1):
        bm = bmesh.new()
        N = 14
        rangs = []
        for i in range(N + 1):
            x = sx * (1.0 + (FX - 1.45) * i / N)
            rangs.append([bm.verts.new((x, BRAS_AV - 0.45, za(x) - 0.12)), bm.verts.new((x, BRAS_AR + 0.4, zr(x) - 0.12))])
        for i in range(N):
            bm.faces.new([rangs[i][0], rangs[i + 1][0], rangs[i + 1][1], rangs[i][1]])
        objet('filet', bm, MAT['filet'], lisse=False)


def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


def dome(nom, centre, rx, ry, rz, mat):
    """Demi-ellipsoïde (casquette arrondie)."""
    bm = bmesh.new()
    N, P = 16, 32
    anneaux = []
    for i in range(N + 1):
        phi = (math.pi / 2) * i / N
        anneaux.append([bm.verts.new((centre[0] + rx * math.cos(phi) * math.cos(2 * math.pi * k / P), centre[1] + ry * math.cos(phi) * math.sin(2 * math.pi * k / P),
                                      centre[2] + rz * math.sin(phi))) for k in range(P)])
    for i in range(N):
        for k in range(P):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % P], anneaux[i + 1][(k + 1) % P], anneaux[i + 1][k]])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat)


def cellule():
    # Dessin de Solidaires en Peloton : casquette arrondie entre le mât et le bras arrière, posée sur un cockpit creux qui
    # s'ouvre vers l'arrière jusqu'au bras courbe ; le reste de la coque centrale est ponté.
    yc = (MAT_Y - 0.8 + BRAS_AR + 0.6) / 2
    z = pont(CENTRALE, yc)
    dome('rouf', (0, yc + 0.6, z - 0.05), 0.9, 1.7, 0.6, MAT['rouf'])
    dome('vitre', (0, yc + 1.35, z + 0.05), 0.7, 0.9, 0.42, MAT['vitre'])
    zc = z - 0.45
    boite('cockpit', -0.8, 0.8, BRAS_AR - 1.6, yc + 0.2, zc, zc + 0.05, mat=MAT['cockpit'])


def appendices():
    car = MAT['carbone']
    # C-foils monotypes dans les flotteurs, au droit du bras avant (le foil au vent est relevé par le jeu)
    yf = BRAS_AV - 0.6
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        x0 = sx * FX
        # la tête dépasse d'environ 1 m au-dessus du pont du flotteur (dessin)
        chemin = catmull([(x0, yf, pont(flotteur(sx), yf) + 1.0), (x0, yf, -0.6), (x0 - sx * 0.2, yf + 0.03, -1.5), (x0 - sx * 0.8, yf + 0.06, -2.15), (x0 - sx * 1.7, yf + 0.1, -2.35)], 12)
        balayer(nom, chemin, lambda s: 0.42 - 0.14 * s, lambda s: 0.12, (0, 1, 0), mat=MAT['bande'])
    # trois safrans droits, sous les tableaux arrière (dessin de Solidaires en Peloton, photo de Koesio)
    def safran(nom, x, y, z_haut, prof):
        balayer(nom, catmull([(x, y, z_haut), (x, y - 0.06, z_haut - prof * 0.5), (x, y - 0.18, z_haut - prof)], 8),
                lambda s: 0.48 - 0.12 * s, lambda s: 0.12, (0, 1, 0), mat=MAT['bande'])
    safran('app_safran_centre', 0, -LC / 2 + 0.45, 1.0, 3.0)
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        safran('app_safran_' + cote, sx * FX, FY - LF / 2 + 0.4, 0.9, 2.6)
    # dérive centrale droite, juste en arrière du mât ; tirant d'eau 3,50 m au plus (gardée à la demande du porteur de projet)
    yd = MAT_Y - 1.0
    balayer('app_derive', catmull([(0, yd, 0.4), (0, yd - 0.05, -1.5), (0, yd - 0.15, -3.45)], 8), lambda s: 0.7 - 0.2 * s, lambda s: 0.12, (0, 1, 0), mat=car)


def mat_et_bome():
    car = MAT['carbone']
    pied = (0, MAT_Y, PONT_MAT)
    pts = [Vector((0, MAT_Y, PONT_MAT + MAT_H * k / 36)) for k in range(37)]
    balayer('pivot_mat', pts, lambda s: 0.7 - 0.35 * s ** 1.4, lambda s: 0.36, (0, 1, 0), mat=car, origine=pied)
    zf = PONT_MAT + MAT_H * 0.55
    for sx in (-1, 1):
        b = balayer('pivot_mat_fleche', [Vector((0, MAT_Y - 0.05, zf)), Vector((sx * 1.6, MAT_Y - 0.4, zf + 0.1))], lambda s: 0.16 - 0.05 * s, lambda s: 0.3, (0, 1, 0), mat=car, origine=pied)
        b.parent = bpy.data.objects['pivot_mat']
        b.location = (0, 0, 0)
    # bôme : 12,5 m dans le repère du jeu, soit environ 6 m
    long_bome = 12.5 / K_JEU
    pts = [Vector((0, MAT_Y - 0.15 - long_bome * k / 16, PONT_MAT + 0.75 / K_JEU)) for k in range(17)]
    balayer('pivot_bome', pts, lambda s: 0.3 - 0.1 * s, lambda s: 0.18, (0, 0, 1), section=section_ellipse, mat=car, origine=pied)


bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {
    'coque': materiau('coque', (0.9, 0.9, 0.92), 0.35),
    'bande': materiau('bande', (0.1, 0.4, 0.8), 0.35),
    'fond': materiau('fond', (0.08, 0.09, 0.11), 0.6),
    'pont': materiau('pont', (0.55, 0.58, 0.62), 0.85),
    'bras': materiau('bras', (0.9, 0.9, 0.92), 0.35),
    'rouf': materiau('rouf', (0.9, 0.9, 0.92), 0.35),
    'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.08, 0.6),
    'cockpit': materiau('cockpit', (0.16, 0.17, 0.19), 0.9),
    'filet': materiau('filet', (0.62, 0.64, 0.68), 0.95),   # filets gris clair (dessin)
    'carbone': materiau('carbone', (0.07, 0.08, 0.09), 0.45, 0.2),
}
coque(CENTRALE, 'centrale')
for sx in (-1, 1):
    coque(flotteur(sx), 'flotteur')
bras()
cellule()
appendices()
mat_et_bome()
# Mise à l'échelle du repère du jeu (Ultim de 32 m) : le jeu réduira ensuite le bateau de 15,24/32.
for ob in bpy.data.objects:
    if ob.parent is None:
        ob.location = ob.location * K_JEU
        ob.scale = (K_JEU, K_JEU, K_JEU)
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(SORTIE), export_format='GLB', export_yup=True, export_apply=True)
print('Modèle exporté :', os.path.abspath(SORTIE))
