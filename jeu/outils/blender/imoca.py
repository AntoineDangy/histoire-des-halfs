# IMOCA à foils construit par Blender, puis exporté en glTF pour le jeu.
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/imoca.py               → IMOCA à foils (design de MACIF Santé Prévoyance)
#   blender -b --python jeu/outils/blender/imoca.py -- derives    → IMOCA à dérives (design de Macif 2011, Gabart)
# Sortie : jeu/packages/client/public/modeles/imoca.glb ou imoca_derives.glb
#
# IMOCA à dérives (décision du porteur de projet, 10/11/2026) : Macif de François Gabart, vainqueur du Vendée Globe
# 2012-2013 (VPLP et Guillaume Verdier, Green Marine et CDK Technologies, 2011 ; puis SMA, Banque Populaire X,
# Monnoyeur, Café Joyeux). Cotes (fiche VPLP, Wikipédia « IMOCA 60 Macif ») : 18,28 m × 5,70 m, tirant d'eau 4,50 m,
# tirant d'air 29 m. Photos libres de Wikimedia Commons (Sylvain NGR, jakez29120, Jean-Pierre Bazard 2012 ; Jug81
# 2025-2026) : franc-bord bas et tonture plate, étrave fine et droite, long bout-dehors, deux dérives droites
# légèrement inclinées (relevées, elles dépassent d'environ 2,5 m du pont), petit rouf, grand cockpit ouvert,
# safrans sous la coque.
#
# Design de référence (décision du porteur de projet, 10/11/2026) : MACIF Santé Prévoyance (Charlie Dalin, mis à l'eau
# le 24 juin 2023). Cotes officielles (macif.fr, programme IMOCA) : longueur 18,28 m, largeur 5,5 m, tirant d'eau 4,50 m,
# 8 t. Jauge IMOCA (imoca.org) : tirant d'air 29 m au plus, mât-aile, quête du mât de 2 à 6°, aileron de quille monotype
# en acier et bulbe de 2,2 à 2,85 t, cinq appendices au plus (une quille pendulaire, deux safrans, deux foils).
# Formes relevées sur des photos libres de Wikimedia Commons (CC BY-SA 4.0, Jug81 2023-2024, MFonzatti 2024) :
# étrave haute et arrondie, bouchain marqué, pont bombé, long rouf vitré fermé, cockpit arrière ouvert, deux safrans
# relevables suspendus au tableau arrière, foils dont le puits ressort au-dessus du pont en avant du mât.
# Pièces séparées et nommées : le jeu les accroche à ses éléments animés (quille qui bascule, foil au vent relevé,
# bôme qui suit la grand-voile). Matériaux nommés : le jeu repeint coque, rouf et bande (bande = liston et safrans).
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF la met vers -z, comme dans le jeu.
import math
import os

import sys

import bmesh
import bpy
from mathutils import Vector

DERIVES = 'derives' in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
L, B = 18.28, (5.7 if DERIVES else 5.5)
MAT_Y = 1.0                       # pied de mât à 1 m en avant du milieu (jeu : MAST_Z = -1)
S, K = 90, 140
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packages', 'client', 'public', 'modeles', 'imoca_derives.glb' if DERIVES else 'imoca.glb')


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
def demi(t):
    """Demi-largeur au pont ; t = 0 au tableau arrière, 1 à l'étrave (avant le nez arrondi)."""
    if DERIVES:  # étrave fine (Macif 2011)
        return (B / 2) * (0.86 + 0.14 * math.sin(math.pi * min(1, t / 0.45))) * (1 - 0.97 * max(0.0, (t - 0.45) / 0.55) ** 1.5) + 0.02
    return (B / 2) * (0.9 + 0.1 * math.sin(math.pi * min(1, t / 0.45))) * (1 - 0.72 * max(0.0, (t - 0.5) / 0.5) ** 1.7)


def haut(t):
    if DERIVES:
        return 1.35 + 0.5 * t ** 1.8      # franc-bord bas, tonture longue et plate (photos de 2012)
    return 1.45 + 0.95 * t ** 1.8          # franc-bord : étrave très haute (photos)


def creux(t):
    if DERIVES:
        return 0.55 + 0.05 * math.sin(t / 0.6 * math.pi) if t < 0.6 else 0.55 - 0.75 * ((t - 0.6) / 0.4) ** 1.6
    d = 0.5 + 0.05 * math.sin(t / 0.55 * math.pi) if t < 0.55 else 0.5 - 1.15 * ((t - 0.55) / 0.45) ** 1.6
    return max(d, -0.65)                   # le fond remonte au-dessus de l'eau à l'étrave


NEZ = 0.12 if DERIVES else 0.45


def stations():
    out = [(t * L - L / 2, demi(t), haut(t), creux(t)) for t in (i / S for i in range(S + 1))]
    y1, hb1, h1, c1 = out[-1]
    for j in range(1, 7):
        a = j / 6
        out.append((L / 2 + NEZ * math.sin(a * math.pi / 2), max(0.02, hb1 * math.cos(a * math.pi / 2)), h1, c1 - (h1 + c1) * 0.4 * a * a))
    return out


def coque():
    st = stations()
    grille = []
    for (y, hb, top, dep) in st:
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            c, s = math.cos(th), math.sin(th)
            n = 3.0 if DERIVES else 4.5     # Macif 2011 : carène plus ronde, sans bouchain vif
            z = top - (top + dep) * abs(s) ** (2 / n)
            r = max(0.0, min(1.0, (z + dep) / (top + dep)))
            evase = 0.86 + 0.14 * min(1.0, r / 0.45)   # bouchain : flanc évasé au-dessus, carène plus étroite dessous
            x = hb * (1.0 if DERIVES else evase) * math.copysign(abs(c) ** (2 / n), c)
            ligne.append((x, y, z))
        grille.append(ligne)
    parts = {'coque': bmesh.new(), 'fond': bmesh.new()}
    for i in range(len(grille) - 1):
        for k in range(K):
            q = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            bm = parts['fond' if sum(p[2] for p in q) / 4 < 0.05 else 'coque']
            bm.faces.new([bm.verts.new(p) for p in q])
    bm = parts['coque']
    centre = bm.verts.new((0, st[0][0], st[0][2] * 0.45))
    tab = [bm.verts.new(p) for p in grille[0]]
    for k in range(K):
        bm.faces.new([centre, tab[k + 1], tab[k]])
    for bm in parts.values():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('coque', parts['coque'], MAT['coque'])
    objet('fond', parts['fond'], MAT['fond'])
    # liston
    bm = bmesh.new()
    for sx in (-1, 1):
        hautv = [bm.verts.new((sx * (hb + 0.006), y, top - 0.02)) for (y, hb, top, _d) in st]
        basv = [bm.verts.new((sx * (hb + 0.006), y, top - 0.22)) for (y, hb, top, _d) in st]
        for i in range(len(st) - 1):
            bm.faces.new([hautv[i], basv[i], basv[i + 1], hautv[i + 1]])
    objet('bande', bm, MAT['bande'])
    # pont bombé (le cockpit arrière reste ouvert)
    bm = bmesh.new()
    J = 14
    rangs = [[bm.verts.new(((-1 + 2 * j / J) * hb * 0.985, y, top + 0.18 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top, _d) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            q = [rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]]
            cx, cy = sum(v.co.x for v in q) / 4, sum(v.co.y for v in q) / 4
            if cy < COCKPIT_Y and abs(cx) < 1.6:
                continue
            bm.faces.new(q)
    objet('pont', bm, MAT['pont'])


COCKPIT_Y = MAT_Y - 4.7 if DERIVES else -L / 2 + 2.4   # Macif 2011 : grand cockpit ouvert


def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


def rouf_et_cockpit():
    # Long rouf fermé et vitré, du mât jusqu'au cockpit arrière (photos du port de Lorient).
    y1, y0 = MAT_Y - 0.4, COCKPIT_Y + 0.1
    z = haut(0.4) + 0.12
    if DERIVES:  # petit rouf bas devant le cockpit
        y0 = MAT_Y - 4.4
        boite('rouf', -1.2, 1.2, y0, y1, z, z + 0.5, avant_bas=0.25, mat=MAT['rouf'])
        boite('vitre', -1.22, 1.22, y0 + 0.4, y1 - 0.4, z + 0.22, z + 0.38, avant_bas=0.12, mat=MAT['vitre'])
        zc = haut(0.1) - 0.5
        boite('cockpit', -1.6, 1.6, -L / 2 + 0.05, COCKPIT_Y, zc, zc + 0.05, mat=MAT['cockpit'])
        return
    boite('rouf', -1.45, 1.45, y0, y1, z, z + 0.72, avant_bas=0.3, mat=MAT['rouf'])
    boite('vitre', -1.47, 1.47, y0 + 0.5, y1 - 0.5, z + 0.36, z + 0.56, avant_bas=0.15, mat=MAT['vitre'])
    zc = haut(0.05) - 0.5
    boite('cockpit', -1.6, 1.6, -L / 2 + 0.05, COCKPIT_Y, zc, zc + 0.05, mat=MAT['cockpit'])


# ---------------------------------------------------------------- Pièces profilées (appendices, mât, bôme)
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


def section_naca(c, ep, P=28):
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


def bulbe(nom, centre, longueur, diametre, parent):
    """Bulbe en torpille (fuseau), rattaché à la quille."""
    bm = bmesh.new()
    N, P = 40, 24
    anneaux = []
    for i in range(N + 1):
        u = i / N
        r = (diametre / 2) * math.sqrt(max(0.0, 1 - (2 * u - 1) ** 2)) ** 0.9 * (1 - 0.35 * max(0.0, (u - 0.6) / 0.4))
        y = centre[1] + longueur * (0.45 - u)
        anneaux.append([bm.verts.new((centre[0] + r * math.cos(2 * math.pi * k / P), y, centre[2] + r * 0.85 * math.sin(2 * math.pi * k / P))) for k in range(P)])
    for i in range(N):
        for k in range(P):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % P], anneaux[i + 1][(k + 1) % P], anneaux[i + 1][k]])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = objet(nom, bm, MAT['carbone'])
    ob.parent = parent
    return ob


def appendices():
    car = MAT['carbone']
    # Quille pendulaire : pivot sous la coque (jeu : groupe « keel » en (0, -0,45, -0,3)), aileron monotype en acier,
    # bulbe en torpille ; tirant d'eau 4,50 m (fiche officielle).
    pivot = (0, 0.3, -0.45)
    q = balayer('pivot_quille', catmull([(0, 0.3, -0.2), (0, 0.15, -2.4), (0, 0.0, -4.15)], 8), lambda s: 0.85 - 0.25 * s, lambda s: 0.1,
                (0, 1, 0), mat=MAT['acier'], origine=pivot)
    bulbe('pivot_quille_bulbe', (0, 0.0 - 0.3, -4.2 + 0.45), 4.2, 0.62, q)   # coordonnées relatives au pivot
    if DERIVES:
        appendices_derives(q)
        return
    # Foils : sortent du bordé juste en arrière du mât, plongent vers l'extérieur, coude, extrémité qui remonte
    # (foils en C ; un seul axe de mobilité : le foil au vent coulisse dans son puits).
    yf = MAT_Y - 1.6
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        hb = demi((yf + L / 2) / L)
        chemin = catmull([(sx * (hb - 1.2), yf, 1.3), (sx * (hb - 0.2), yf, 0.2), (sx * (hb + 0.7), yf - 0.05, -0.75), (sx * (hb + 1.7), yf - 0.1, -1.45),
                          (sx * (hb + 2.7), yf - 0.15, -1.5), (sx * (hb + 3.5), yf - 0.2, -0.95), (sx * (hb + 3.9), yf - 0.25, -0.3)], 10)
        balayer(nom, chemin, lambda s: 0.62 - 0.27 * s, lambda s: 0.12, (0, 1, 0), mat=car)
    # Deux safrans relevables, suspendus au tableau arrière près des angles (photos) ; couleur de la bande.
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        x, y = sx * 1.75, -L / 2 - 0.18
        balayer('app_safran_' + cote, catmull([(x, y, 1.15), (x, y - 0.06, -0.6), (x, y - 0.25, -2.4)], 8), lambda s: 0.62 - 0.12 * s, lambda s: 0.12,
                (0, 1, 0), mat=MAT['bande'])
    bout_dehors()


def appendices_derives(quille):
    """Macif 2011 : deux dérives droites légèrement inclinées (la dérive au vent est relevée par le jeu), deux safrans
    sous la coque, long bout-dehors."""
    car = MAT['carbone']
    yd = MAT_Y - 1.6
    hb = demi((yd + L / 2) / L)
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        x0 = sx * (hb - 0.35)
        balayer(nom, [Vector((x0, yd, 1.6)), Vector((x0 - sx * 0.25, yd - 0.05, -1.0)), Vector((x0 - sx * 0.55, yd - 0.12, -3.3))],
                lambda s: 0.62 - 0.12 * s, lambda s: 0.12, (0, 1, 0), mat=MAT['derive'])
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        x, y = sx * 1.6, -L / 2 + 1.1
        balayer('app_safran_' + cote, catmull([(x, y, 0.4), (x, y - 0.05, -0.9), (x, y - 0.15, -2.3)], 8), lambda s: 0.6 - 0.12 * s, lambda s: 0.12,
                (0, 1, 0), mat=car)
    bout_dehors()


def bout_dehors():
    """Bout-dehors (correction du 10/11/2026) : tube rond en carbone (16 cm à l'emplanture, 10 cm au bout) qui sort du pont
    à l'étrave, presque à l'horizontale, tenu par une sous-barbe (câble du bout vers l'étrave, près de l'eau).
    Son extrémité est le point d'amure des voiles d'avant du jeu : 2,3 m devant l'étrave, à 2,2 m de hauteur."""
    car = MAT['carbone']
    racine = Vector((0, L / 2 - 0.7, haut(1) - 0.1))
    bout = Vector((0, L / 2 + 2.3, 2.2))
    pts = [racine.lerp(bout, k / 12) for k in range(13)]
    balayer('app_bout_dehors', pts, lambda s: 0.16 - 0.06 * s, lambda s: 0.16 - 0.06 * s, (0, 0, 1), section=section_ellipse, mat=car)
    pied = Vector((0, L / 2 + NEZ * 0.5, 0.45))
    balayer('app_sous_barbe', [bout.lerp(pied, k / 6) for k in range(7)], lambda s: 0.025, lambda s: 0.025, (1, 0, 0), section=section_ellipse, mat=car)


PONT_MAT = 1.45 + 0.75 * 0.55 ** 1.8 + 0.1     # hauteur du pied de mât dans le jeu (deckY)
MAT_H = 27.0                                    # tirant d'air 29 m au plus (jauge) : 27 m au-dessus du pont


def mat_et_bome():
    car = MAT['carbone']
    pied = (0, MAT_Y, PONT_MAT)
    q = 0.0  # mât droit dans son repère : la quête de 4° (jauge : 2 à 6°) est appliquée par le jeu, avec la bôme et la grand-voile
    pts = [Vector((0, MAT_Y - math.sin(q) * MAT_H * k / 36, PONT_MAT + math.cos(q) * MAT_H * k / 36)) for k in range(37)]
    balayer('pivot_mat', pts, lambda s: 0.62 - 0.27 * s ** 1.4, lambda s: 0.42, (0, 1, 0), mat=car, origine=pied)
    pts = [Vector((0, MAT_Y - 0.2 - 7.6 * k / 16, PONT_MAT + 1.25)) for k in range(17)]
    balayer('pivot_bome', pts, lambda s: 0.36 - 0.12 * s, lambda s: 0.55, (0, 0, 1), section=section_ellipse, mat=car, origine=pied)


bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {
    'coque': materiau('coque', (0.9, 0.9, 0.92), 0.35),
    'bande': materiau('bande', (0.1, 0.4, 0.8), 0.35),
    'fond': materiau('fond', (0.08, 0.09, 0.11), 0.6),
    'pont': materiau('pont', (0.55, 0.58, 0.62), 0.85),
    'rouf': materiau('rouf', (0.9, 0.9, 0.92), 0.35),
    'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.08, 0.6),
    'cockpit': materiau('cockpit', (0.16, 0.17, 0.19), 0.9),
    'carbone': materiau('carbone', (0.07, 0.08, 0.09), 0.45, 0.2),
    'acier': materiau('acier', (0.55, 0.57, 0.6), 0.3, 0.8),
    'derive': materiau('derive', (0.92, 0.92, 0.9), 0.4),     # dérives blanches (photos)
}
coque()
rouf_et_cockpit()
appendices()
mat_et_bome()
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(SORTIE), export_format='GLB', export_yup=True, export_apply=True)
print('Modèle exporté :', os.path.abspath(SORTIE))
