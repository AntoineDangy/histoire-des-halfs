# Pen Duick III (goélette d'Éric Tabarly, 1967), premier bateau de la classe Vintage, construit par Blender.
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/penduick3.py
# Sortie : jeu/packages/client/public/modeles/pen_duick_3.glb
#
# Cotes (Wikipédia, article « Pen Duick III ») : longueur hors tout 17,45 m, longueur de coque à la flottaison 13 m,
# largeur 4,21 m, tirant d'eau 2,75 m, déplacement 13,5 t, 152 m² au près ; goélette marconi ; coque en aluminium ;
# plans d'Éric Tabarly, chantiers et ateliers de la Perrière (Lorient), 1967.
# Formes relevées sur des photos libres de Wikimedia Commons (CC BY-SA 4.0 : MFonzatti 2025, Jug81 2023-2024 ;
# CC BY 4.0 : Jean-Pol Grandmont 2019) : coque noire longue et basse, pont clair, élancements avant et arrière, étrave
# droite inclinée, voûte arrière, pont plat avec petit rouf, cockpit arrière, deux mâts en aluminium (mât de misaine à
# environ 6 m de l'étrave, grand mât à environ 11 m, positions relevées sur photo).
# Mâts (correction du 10/11/2026, source bateaux.com, « Pen Duick III, la goélette de Tabarly conçue pour la Transat
# anglaise de 1968 ») : « deux mâts de hauteur identique », tirant d'air 18,80 m, soit 17,65 m au-dessus du pont
# (le premier modèle avait 15,5 m estimés sur photo, et un mât de misaine un peu plus court).
# Bômes : pièces séparées « pivot_bome_misaine » et « pivot_bome_grand », origine au vit-de-mulet, que le jeu fait pivoter.
# Quille et safran (non visibles sur les photos) : aileron de quille lesté et safran séparé, estimés.
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF la met vers -z, comme dans le jeu.
import math
import os

import bmesh
import bpy
from mathutils import Vector

LHT, LF, B = 17.45, 13.0, 4.21
EL_AV, EL_AR = 2.0, 2.45          # élancements avant et arrière (17,45 = 2,0 + 13 + 2,45)
S, K = 90, 90
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packages', 'client', 'public', 'modeles', 'pen_duick_3.glb')


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


# ---------------------------------------------------------------- Coque
def y_de(t):
    return t * LHT - LHT / 2


def demi(t):
    """Demi-largeur au pont : fine aux deux bouts, voûte arrière plus large que l'étrave."""
    if t < 0.12:                      # voûte arrière : tableau étroit
        return (B / 2) * (0.55 + 0.45 * math.sin(math.pi / 2 * t / 0.12) ** 1.2) * 0.88 + 0.08
    u = (t - 0.12) / 0.88
    return (B / 2) * math.sin(math.pi * min(1.0, 0.5 + 0.5 * u)) ** 0.75 * (0.9 + 0.1 * math.sin(math.pi * u)) + 0.02


def haut(t):
    return 1.05 + 0.25 * (t - 0.45) ** 2 * 4      # franc-bord bas, légère tonture (photos)


def creux(t):
    """Profondeur de la carène sous la flottaison ; les élancements sont hors de l'eau."""
    ya, yb = EL_AR / LHT, 1 - EL_AV / LHT
    if t < ya:
        return -0.45 * (1 - t / ya) ** 1.2 + 0.0                 # voûte qui remonte vers le tableau
    if t > yb:
        return -0.25 - 0.75 * ((t - yb) / (1 - yb)) ** 1.1       # étrave droite inclinée
    u = (t - ya) / (yb - ya)
    return 0.62 * math.sin(math.pi * u) ** 0.8 + 0.02


def coque():
    grille, st = [], []
    for i in range(S + 1):
        t = i / S
        hb, top, dep, y = demi(t), haut(t), creux(t), y_de(t)
        st.append((y, hb, top))
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            c, s = math.cos(th), math.sin(th)
            z = top - (top + dep) * abs(s) ** (2 / 2.2)            # carène ronde (bateau de 1967)
            ligne.append((hb * math.copysign(abs(c) ** (2 / 2.2), c), y, z))
        grille.append(ligne)
    parts = {'coque': bmesh.new(), 'fond': bmesh.new()}
    for i in range(S):
        for k in range(K):
            q = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            bm = parts['fond' if sum(p[2] for p in q) / 4 < 0.04 else 'coque']
            bm.faces.new([bm.verts.new(p) for p in q])
    for idx, fin in ((0, False), (S, True)):          # tableau arrière et étrave fermés
        bm = parts['coque']
        c = bm.verts.new((0, st[idx][0], st[idx][2] * 0.5))
        r = [bm.verts.new(p) for p in grille[idx]]
        for k in range(K):
            bm.faces.new([c, r[k], r[k + 1]] if fin else [c, r[k + 1], r[k]])
    for bm in parts.values():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('coque', parts['coque'], MAT['coque'])
    objet('fond', parts['fond'], MAT['fond'])
    bm = bmesh.new()
    J = 10
    rangs = [[bm.verts.new(((-1 + 2 * j / J) * hb * 0.985, y, top + 0.07 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            bm.faces.new([rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]])
    objet('pont', bm, MAT['pont'])
    bm = bmesh.new()
    for sx in (-1, 1):
        h = [bm.verts.new((sx * (hb + 0.006), y, top - 0.01)) for (y, hb, top) in st]
        b = [bm.verts.new((sx * (hb + 0.006), y, top - 0.09)) for (y, hb, top) in st]
        for i in range(len(st) - 1):
            bm.faces.new([h[i], b[i], b[i + 1], h[i + 1]])
    objet('bande', bm, MAT['bande'])


def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


Y_MISAINE = LHT / 2 - 6.0          # mât de misaine à environ 6 m de l'étrave (photo de 2025)
Y_GRAND = LHT / 2 - 10.9           # grand mât à environ 11 m


def pont_en(y):
    return haut((y + LHT / 2) / LHT) + 0.06


def rouf_et_cockpit():
    # petit rouf bas entre les deux mâts, cockpit arrière (photos du port de Lorient)
    z = pont_en(Y_GRAND + 1.5)
    boite('rouf', -0.85, 0.85, Y_GRAND + 0.7, Y_MISAINE - 1.0, z - 0.03, z + 0.35, avant_bas=0.12, mat=MAT['rouf'])
    boite('vitre', -0.87, 0.87, Y_GRAND + 1.0, Y_MISAINE - 1.3, z + 0.12, z + 0.25, avant_bas=0.06, mat=MAT['vitre'])
    zc = pont_en(-5.5) - 0.4
    boite('cockpit', -0.75, 0.75, -LHT / 2 + EL_AR + 0.4, Y_GRAND - 0.8, zc, zc + 0.05, mat=MAT['cockpit'])


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


def balayer(nom, pts, corde, epaisseur, dir_corde, section=section_naca, mat=None):
    bm = bmesh.new()
    anneaux = []
    d = Vector(dir_corde).normalized()
    for i, p in enumerate(pts):
        s = i / (len(pts) - 1)
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        c = (d - t * d.dot(t)).normalized()
        e = t.cross(c)
        anneaux.append([bm.verts.new(p + c * u + e * v) for (u, v) in section(corde(s), epaisseur(s))])
    n = len(anneaux[0])
    for i in range(len(anneaux) - 1):
        for k in range(n):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % n], anneaux[i + 1][(k + 1) % n], anneaux[i + 1][k]])
    bm.faces.new(anneaux[0])
    bm.faces.new(list(reversed(anneaux[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat or MAT['alu'])


def appendices():
    # Aileron de quille lesté à longue corde (estimé : tirant d'eau 2,75 m) et safran séparé à l'arrière.
    yq = 0.3
    balayer('app_quille', catmull([(0, yq + 0.4, -0.3), (0, yq, -1.5), (0, yq - 0.5, -2.7)], 8), lambda s: 2.4 - 1.0 * s, lambda s: 0.13,
            (0, 1, 0), mat=MAT['fond'])
    ys = -LHT / 2 + EL_AR + 0.9
    balayer('app_safran', catmull([(0, ys, -0.1), (0, ys - 0.1, -1.0), (0, ys - 0.25, -1.9)], 8), lambda s: 0.8 - 0.2 * s, lambda s: 0.12,
            (0, 1, 0), mat=MAT['fond'])


MAT_H = 17.65                      # hauteur des mâts au-dessus du pont : tirant d'air 18,80 m (bateaux.com)


def mats():
    for nom, y, h in (('mat_misaine', Y_MISAINE, MAT_H), ('mat_grand', Y_GRAND, MAT_H)):   # même hauteur (bateaux.com)
        z0 = pont_en(y)
        balayer(nom, [Vector((0, y, z0 + h * k / 24)) for k in range(25)], lambda s: 0.26 - 0.08 * s, lambda s: 0.18 - 0.05 * s, (0, 1, 0),
                section=section_ellipse, mat=MAT['alu'])
        for hh, env in ((0.45, 1.3), (0.75, 0.9)):        # barres de flèche
            balayer(nom + '_fleche', [Vector((-env, y - 0.05, z0 + h * hh)), Vector((env, y - 0.05, z0 + h * hh))], lambda s: 0.08, lambda s: 0.5, (0, 1, 0),
                    mat=MAT['alu'])
    # bômes : de misaine (jusqu'au grand mât) et de grand-voile (jusqu'à la voûte)
    # origine de chaque bôme au vit-de-mulet : le jeu la fait pivoter avec la voile
    for nom, y0, long_ in (('pivot_bome_misaine', Y_MISAINE - 0.15, Y_MISAINE - Y_GRAND - 0.6), ('pivot_bome_grand', Y_GRAND - 0.15, 5.6)):
        z = pont_en(y0) + 0.9
        ob = balayer(nom, [Vector((0, -long_ * k / 12, 0)) for k in range(13)], lambda s: 0.2, lambda s: 0.14, (0, 0, 1),
                     section=section_ellipse, mat=MAT['alu'])
        ob.location = (0, y0, z)
    # balcons avant et arrière (inox), petits
    for y in (LHT / 2 - 0.6, -LHT / 2 + 0.4):
        z = pont_en(y)
        balayer('balcon', catmull([(-0.5, y, z), (-0.45, y, z + 0.6), (0.45, y, z + 0.6), (0.5, y, z)], 6), lambda s: 0.035, lambda s: 0.035, (1, 0, 0),
                section=section_ellipse, mat=MAT['alu'])


bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {
    'coque': materiau('coque', (0.03, 0.03, 0.035), 0.35),       # coque noire (photos)
    'bande': materiau('bande', (0.85, 0.85, 0.85), 0.35),        # liseré clair sous le pont
    'fond': materiau('fond', (0.06, 0.06, 0.07), 0.6),
    'pont': materiau('pont', (0.86, 0.85, 0.8), 0.8),            # pont clair (photos)
    'rouf': materiau('rouf_clair', (0.88, 0.87, 0.83), 0.6),   # rouf clair (photos), pas repeint par le jeu
    'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.1, 0.5),
    'cockpit': materiau('cockpit', (0.6, 0.58, 0.54), 0.85),
    'alu': materiau('alu', (0.78, 0.8, 0.82), 0.3, 0.8),         # mâts en aluminium
}
coque()
rouf_et_cockpit()
appendices()
mats()
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(SORTIE), export_format='GLB', export_yup=True, export_apply=True)
print('Modèle exporté :', os.path.abspath(SORTIE))
