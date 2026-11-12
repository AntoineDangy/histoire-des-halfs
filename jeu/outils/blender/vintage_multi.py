# Multicoques de légende (classe Vintage) construits par Blender, puis exportés en glTF pour le jeu.
# Un seul générateur, réglé bateau par bateau par les cotes de jeu/packages/data/config/modeles-vintage.json
# (section « multicoques » ; sources et valeurs estimées dans ce fichier et dans jeu/conception/vintage-references.md).
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/vintage_multi.py                  → tous les multicoques
#   blender -b --python jeu/outils/blender/vintage_multi.py -- primagaz      → un seul
# Sortie : jeu/packages/client/public/modeles/<id>.glb
#
# Formes des trimarans de 60 pieds de 1988 à 1998 et du 50 pieds Fauve (photos libres de Wikimedia Commons : Nokia,
# ex-Fleury Michon IX, 2005 ; Défi Cancale, ex-Elf Aquitaine III, 2010 ; Olmix, ex-Fauve, 2016) : coque centrale fine
# et haute, flotteurs presque aussi longs, à étrave droite ; deux bras de liaison droits (tubes des années 1980) ou
# profilés et légèrement cintrés (années 1990), filets entre les bras ; mât-aile rotatif sans barre de flèche, ou mât
# haubané (Fauve) ; petite casquette derrière le mât et cockpit ouvert à l'arrière. Jet Services V est un catamaran :
# deux coques, trois bras (avant, de mât, arrière), filet entre les coques, mât posé au milieu du bras de mât.
# Rien de moderne : ni foils, ni bras en arche, ni bras courbe arrière (ceux de l'Ocean Fifty).
# Pièces nommées pour le jeu (comme l'Ocean Fifty) : « pivot_mat » (origine au pied du mât, le mât-aile pivote),
# « pivot_bome » (origine au pied du mât), « app_foil_babord » / « app_foil_tribord » (dérives de flotteur ou de coque,
# relevées au vent par le jeu ; objets vides s'il n'y en a pas), « app_safran_* » et « app_derive » (fixes).
# Matériaux : le jeu repeint « coque », « rouf » et « bras » à la couleur du skipper, « bande » à sa seconde couleur.
# Construit en vraie grandeur puis agrandi de 32/longueur : le jeu dessine ses multicoques dans le repère d'un Ultim de
# 32 m et réduit ensuite le bateau à sa vraie taille.
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF la met vers -z, comme dans le jeu.
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
COTES = json.load(open(os.path.join(ICI, '..', '..', 'packages', 'data', 'config', 'modeles-vintage.json'), encoding='utf-8'))['multicoques']
DEMANDES = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
S, K = 90, 64
MAT = {}


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

    def t(self, y):
        return min(1.0, max(0.0, (y - self.y0 + self.L / 2) / self.L))


def coque(f, prefixe):
    """Coque : sections en super-ellipse, flancs légèrement évasés vers le haut ; antifouling sous la flottaison."""
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
            evase = 0.88 + 0.12 * max(0.0, min(1.0, (z + dep) / (top + dep)))
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
    rangs = [[bm.verts.new((f.x0 + (-1 + 2 * j / J) * hb * 0.99, y, top + 0.05 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            bm.faces.new([rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]])
    objet(prefixe + '_pont', bm, MAT['pont'])
    bm = bmesh.new()
    for sx in (-1, 1):
        h = [bm.verts.new((f.x0 + sx * (hb + 0.006), y, top - 0.02)) for (y, hb, top) in st]
        b = [bm.verts.new((f.x0 + sx * (hb + 0.006), y, top - 0.18)) for (y, hb, top) in st]
        for i in range(len(st) - 1):
            bm.faces.new([h[i], b[i], b[i + 1], h[i + 1]])
    objet(prefixe + '_bande', bm, MAT['bande'])


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
    """Profil balayé le long d'une courbe ; les sommets sont exprimés par rapport à `origine`, origine de l'objet."""
    bm = bmesh.new()
    anneaux = []
    o = Vector(origine)
    d = Vector(dir_corde).normalized()
    pts = [Vector(p) for p in pts]
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


def boite(nom, x0, x1, y0, y1, z0, z1, mat):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


def dome(nom, centre, rx, ry, rz, mat):
    bm = bmesh.new()
    N, P = 12, 28
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


def vide(nom, pos):
    ob = bpy.data.objects.new(nom, None)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    return ob


def construire(ident, c):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MAT.clear()
    MAT.update({
        'coque': materiau('coque', (0.92, 0.93, 0.95), 0.35),
        'bande': materiau('bande', (0.15, 0.3, 0.6), 0.35),
        'fond': materiau('fond', (0.08, 0.09, 0.11), 0.6),
        'pont': materiau('pont', (0.84, 0.85, 0.85), 0.8),
        'bras': materiau('bras', (0.92, 0.93, 0.95), 0.35),
        'rouf': materiau('rouf', (0.92, 0.93, 0.95), 0.35),
        'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.08, 0.6),
        'cockpit': materiau('cockpit', (0.55, 0.56, 0.56), 0.9),
        'filet': materiau('filet', (0.2, 0.22, 0.25), 0.95),
        'carbone': materiau('carbone', (0.07, 0.08, 0.09), 0.45, 0.2),
    })
    L, LF, B, H = c['longueur'], c['longueur_flotteurs'], c['largeur'], c['hauteur_mat']
    cata = c['type'] == 'catamaran'
    s = L / 18.28                                           # proportions d'un 60 pieds, ramenées à la longueur

    def y_de(t):
        return t * L - L / 2

    if cata:
        # Deux coques identiques, plus volumineuses qu'un flotteur de trimaran, étrave droite.
        dh = 0.85
        FX = B / 2 - dh

        def forme(sx):
            return Forme(L,
                         demi=lambda t: dh * (0.8 + 0.2 * math.sin(math.pi * min(1, t / 0.5))) * (1 - max(0.0, (t - 0.5) / 0.5) ** 1.6) + 0.02,
                         haut=lambda t: 1.55 + 0.45 * t * t,
                         creux=lambda t: 0.8 * math.sin(math.pi * min(1.0, 0.15 + 0.85 * t)) + 0.1 - 0.35 * max(0.0, (t - 0.75) / 0.25) ** 2,
                         n=2.3, x0=sx * FX)
        coques = [forme(-1), forme(1)]
        for f in coques:
            coque(f, 'coque')
        haut_bras = coques[0].haut(0.55) + 0.25
    else:
        dc, df = 0.95 * s, 0.55 * s
        FX = B / 2 - df
        CENTRALE = Forme(L,
                         demi=lambda t: dc * (0.8 + 0.2 * math.sin(math.pi * min(1, t / 0.55))) * (1 - max(0.0, (t - 0.5) / 0.5) ** 1.6) + 0.02,
                         haut=lambda t: (1.35 + 0.4 * t * t) * s,
                         creux=lambda t: (0.7 * math.sin(math.pi * min(1.0, 0.12 + 0.88 * t)) + 0.08 - 0.3 * max(0.0, (t - 0.72) / 0.28) ** 2) * s,
                         n=2.2)

        def flotteur(sx):
            # flotteurs des années 1990 : plus pleins que ceux d'aujourd'hui, étrave droite, arrière coupé net
            return Forme(LF,
                         demi=lambda t: df * (0.82 + 0.18 * math.sin(math.pi * min(1, t / 0.5))) * (1 - max(0.0, (t - 0.5) / 0.5) ** 1.7) + 0.02,
                         haut=lambda t: (1.05 + 0.35 * t * t) * s,
                         creux=lambda t: (0.5 * math.sin(math.pi * min(1.0, 0.22 + 0.78 * t)) + 0.1 - 0.3 * max(0.0, (t - 0.72) / 0.28) ** 2) * s,
                         n=2.3, x0=sx * FX, y0=-0.02 * L)
        coque(CENTRALE, 'centrale')
        flotteurs = [flotteur(-1), flotteur(1)]
        for f in flotteurs:
            coque(f, 'flotteur')

    # ---------------------------------------------------------------- Bras de liaison et filets
    aile = c['bras_profil'] == 'aile'
    corde, ep = (0.95 * s, 0.26 * s) if aile else (0.42 * s, 0.42 * s)
    hauteurs = []
    for fr in c['bras']:
        y = y_de(fr)
        if cata:
            z0 = z1 = haut_bras
        else:
            z0 = CENTRALE.haut(CENTRALE.t(y)) - 0.1 * s
            z1 = flotteurs[1].haut(flotteurs[1].t(y)) - 0.1 * s
        arche = c['bras_arche'] * s

        def zb(x, z0=z0, z1=z1, arche=arche):
            return z0 + (z1 - z0) * abs(x) / FX + arche * math.sin(math.pi * abs(x) / FX)
        pts = [(x, y, zb(x)) for x in [-FX + 2 * FX * i / 48 for i in range(49)]]
        if aile:
            balayer('bras', pts, lambda u: corde * (1 - 0.25 * abs(2 * u - 1)), lambda u: ep, (0, 1, 0), mat=MAT['bras'])
        else:
            balayer('bras', pts, lambda u: corde, lambda u: ep, (0, 0, 1), section=section_ellipse, mat=MAT['bras'])
        hauteurs.append((y, zb))
    (ya, za), (yr, zr) = hauteurs[0], hauteurs[-1]
    marge = corde / 2 + 0.1
    for sx in ((-1, 1) if not cata else (0,)):
        bm = bmesh.new()
        N = 14
        rangs = []
        x_in = 0.0 if cata else dc + 0.15
        x_out = (FX - 0.75) if cata else (FX - df - 0.1)
        for i in range(N + 1):
            x = (-x_out + 2 * x_out * i / N) if cata else sx * (x_in + (x_out - x_in) * i / N)
            rangs.append([bm.verts.new((x, ya - marge, za(x) - 0.08)), bm.verts.new((x, yr + marge, zr(x) - 0.08))])
        for i in range(N):
            bm.faces.new([rangs[i][0], rangs[i + 1][0], rangs[i + 1][1], rangs[i][1]])
        objet('filet', bm, MAT['filet'], lisse=False)

    # ---------------------------------------------------------------- Mât, bôme, bout-dehors
    if cata:
        y_mat = y_de(c['bras'][1])
        pont_mat = haut_bras + 0.25
    else:
        y_mat = y_de(c['pied_mat'])
        pont_mat = CENTRALE.haut(CENTRALE.t(y_mat)) + 0.1 * s
    pied = (0, y_mat, pont_mat)
    pts = [(0, y_mat, pont_mat + H * k / 30) for k in range(31)]
    if c['mat_aile']:   # mât-aile rotatif, grande corde
        balayer('pivot_mat', pts, lambda u: (0.85 - 0.4 * u ** 1.3) * s, lambda u: 0.36, (0, 1, 0), origine=pied)
    else:               # mât haubané à barres de flèche
        balayer('pivot_mat', pts, lambda u: 0.32 - 0.1 * u, lambda u: 0.22 - 0.06 * u, (0, 1, 0), section=section_ellipse, origine=pied)
        for i in range(c['barres']):
            hh = (i + 1) / (c['barres'] + 1)
            env = 1.5 - 0.5 * hh
            b = balayer('pivot_mat_fleche', [(-env, y_mat - 0.05, pont_mat + H * hh), (env, y_mat - 0.05, pont_mat + H * hh)], lambda u: 0.08, lambda u: 0.45, (0, 1, 0), origine=pied)
            b.parent = bpy.data.objects['pivot_mat']
            b.location = (0, 0, 0)
    k_jeu = 32 / L
    long_bome = 12.5 / k_jeu        # bôme du repère du jeu (12,5 m pour un bateau de 32 m)
    pts = [(0, y_mat - 0.2 - long_bome * k / 16, pont_mat + 0.75 / k_jeu) for k in range(17)]
    balayer('pivot_bome', pts, lambda u: 0.26 - 0.08 * u, lambda u: 0.18, (0, 0, 1), section=section_ellipse, origine=pied)
    if c['bout_dehors'] and not cata:
        yb, zb0 = L / 2, CENTRALE.haut(1) - 0.05
        balayer('bout_dehors', [(0, yb - 0.6 + (c['bout_dehors'] + 0.6) * k / 8, zb0) for k in range(9)], lambda u: 0.16 - 0.06 * u, lambda u: 0.16 - 0.06 * u,
                (0, 0, 1), section=section_ellipse)
    if cata:   # poutre longitudinale sous le bras avant : point d'amure des voiles d'avant, au milieu
        balayer('poutre_avant', [(0, ya - 0.2, za(0) - 0.05), (0, ya + 1.2, za(0) - 0.1)], lambda u: 0.22, lambda u: 0.22, (0, 0, 1), section=section_ellipse)

    # ---------------------------------------------------------------- Cockpit et casquette
    if cata:
        for sx in (-1, 1):
            yc = y_de(0.2)
            z = coques[0].haut(0.2)
            dome('rouf', (sx * FX, yc + 0.8, z - 0.05), 0.55, 1.4, 0.45, MAT['rouf'])
            dome('vitre', (sx * FX, yc + 1.4, z + 0.02), 0.45, 0.7, 0.32, MAT['vitre'])
            boite('cockpit', sx * FX - 0.45, sx * FX + 0.45, y_de(0.06), yc - 0.3, z - 0.4, z - 0.36, MAT['cockpit'])
    else:
        yc = y_mat - 2.6 * s
        z = CENTRALE.haut(CENTRALE.t(yc))
        dome('rouf', (0, yc + 0.5 * s, z - 0.05), 0.75 * s, 1.5 * s, 0.5 * s, MAT['rouf'])
        dome('vitre', (0, yc + 1.1 * s, z + 0.03), 0.6 * s, 0.8 * s, 0.36 * s, MAT['vitre'])
        boite('cockpit', -0.65 * s, 0.65 * s, y_de(0.08), yc - 0.8 * s, z - 0.4 * s, z - 0.36 * s, MAT['cockpit'])

    # ---------------------------------------------------------------- Appendices
    def lame(nom, x, y, z_haut, prof, corde0, mat=None):
        return balayer(nom, catmull([(x, y, z_haut), (x, y - 0.05, z_haut - prof * 0.5), (x, y - 0.15, z_haut - prof)], 8),
                       lambda u: corde0 * (1 - 0.25 * u), lambda u: 0.12, (0, 1, 0), mat=mat)
    if cata:
        for sx, cote in ((-1, 'babord'), (1, 'tribord')):
            lame('app_safran_' + cote, sx * FX, y_de(0.03), 0.8, 2.4, 0.6)
    else:
        lame('app_safran_centre', 0, y_de(0.03), 0.9 * s, 2.6 * s, 0.55 * s)
        for sx, cote in ((-1, 'babord'), (1, 'tribord')):
            lame('app_safran_' + cote, sx * FX, flotteurs[0].y(0.03), 0.8 * s, 2.0 * s, 0.45 * s)
        if c['derive_centrale']:
            lame('app_derive', 0, y_mat - 0.9 * s, 0.4, 3.2 * s, 0.75 * s)
    for sx, nom in ((-1, 'app_foil_babord'), (1, 'app_foil_tribord')):
        if c['derives_flotteurs']:   # dérive droite dans le flotteur (ou la coque), au droit du bras avant
            yd = (ya - 1.0) if not cata else y_mat + 0.6
            lame(nom, sx * FX, yd, 1.2 * s, 3.4 * s, 0.6 * s)
        else:
            vide(nom, (sx * FX, ya, 0))

    # ---------------------------------------------------------------- Repère du jeu, export
    for ob in bpy.data.objects:
        if ob.parent is None:
            ob.location = ob.location * k_jeu
            ob.scale = (k_jeu, k_jeu, k_jeu)
    sortie = os.path.abspath(os.path.join(ICI, '..', '..', 'packages', 'client', 'public', 'modeles', f'{ident}.glb'))
    bpy.ops.export_scene.gltf(filepath=sortie, export_format='GLB', export_yup=True, export_apply=True)
    print('Modèle exporté :', sortie)


for ident, c in COTES.items():
    if not DEMANDES or ident in DEMANDES:
        construire(ident, c)
