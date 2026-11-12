# Monocoques de légende (classe Vintage) construits par Blender, puis exportés en glTF pour le jeu.
# Un seul générateur, réglé bateau par bateau par les cotes de jeu/packages/data/config/modeles-vintage.json
# (sources et valeurs estimées dans ce fichier et dans jeu/conception/vintage-references.md).
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/vintage_mono.py                       → tous les monocoques
#   blender -b --python jeu/outils/blender/vintage_mono.py -- ecureuil_aquitaine_2 → un seul
# Sortie : jeu/packages/client/public/modeles/<id>.glb
#
# Formes communes aux 60 pieds de 1989 à 1999 (photos libres de Wikimedia Commons : Écureuil d'Aquitaine II, Groupe
# Sceta, PRB, Aquitaine Innovations, Bagages Superior) : étrave droite presque verticale, franc-bord bas et tonture
# plate, arrière large et ouvert, pont plat avec un petit rouf derrière le mât, cockpit arrière, quille à bulbe, un ou
# deux safrans. Crédit Agricole (1982) : étrave plus élancée et arrière plus fin (forme générique, faute de photo libre).
# Pièces nommées pour le jeu : « mat » et « mat_* » (mât, barres de flèche, écarteurs, regroupés pour le démâtage),
# « pivot_bome » (origine au vit-de-mulet : la bôme pivote avec la grand-voile). Matériaux : le jeu repeint « coque »
# et « bande » aux couleurs du skipper ; « rouf_clair » reste clair.
# Repère : dans Blender (Z en haut), l'étrave est vers +Y ; l'export glTF la met vers -z, comme dans le jeu.
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
COTES = json.load(open(os.path.join(ICI, '..', '..', 'packages', 'data', 'config', 'modeles-vintage.json'), encoding='utf-8'))['monocoques']
DEMANDES = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
S, K = 90, 96


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
    """Profil balayé le long d'une courbe. Les sommets sont exprimés par rapport à `origine`, qui devient l'origine de l'objet."""
    bm = bmesh.new()
    anneaux = []
    d = Vector(dir_corde).normalized()
    o = Vector(origine)
    for i, p in enumerate(pts):
        s = i / (len(pts) - 1)
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (Vector(b) - Vector(a)).normalized()
        c = (d - t * d.dot(t)).normalized()
        e = t.cross(c)
        anneaux.append([bm.verts.new(Vector(p) - o + c * u + e * v) for (u, v) in section(corde(s), epaisseur(s))])
    n = len(anneaux[0])
    for i in range(len(anneaux) - 1):
        for k in range(n):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % n], anneaux[i + 1][(k + 1) % n], anneaux[i + 1][k]])
    bm.faces.new(anneaux[0])
    bm.faces.new(list(reversed(anneaux[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = objet(nom, bm, mat)
    ob.location = o
    return ob


def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objet(nom, bm, mat, lisse=False)


def construire(ident, c):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MAT = {
        'coque': materiau('coque', (0.92, 0.93, 0.95), 0.35),
        'bande': materiau('bande', (0.15, 0.3, 0.6), 0.35),
        'fond': materiau('fond', (0.07, 0.07, 0.08), 0.6),
        'pont': materiau('pont', (0.86, 0.86, 0.84), 0.8),
        'rouf': materiau('rouf_clair', (0.9, 0.9, 0.88), 0.55),
        'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.1, 0.5),
        'cockpit': materiau('cockpit', (0.62, 0.62, 0.6), 0.85),
        'mat': materiau('mat_carbone', (0.08, 0.08, 0.09), 0.45, 0.2) if c['mat_carbone'] else materiau('alu', (0.78, 0.8, 0.82), 0.3, 0.8),
        'quille': materiau('appendices', (0.1, 0.1, 0.11), 0.5),
    }
    L, B, FB, T = c['longueur'], c['largeur'], c['franc_bord'], c['tirant_eau']
    tab, pe = c['tableau'], c['pied_etrave']

    def y_de(t):
        return t * L - L / 2

    def demi(t):
        """Demi-largeur au pont : largeur maximale vers 40 % de la longueur, arrière large (tableau), étrave fine."""
        if t < 0.4:
            return (B / 2) * (tab + (1 - tab) * math.sin(math.pi / 2 * t / 0.4))
        u = (t - 0.4) / 0.6
        return max(0.02, (B / 2) * math.cos(math.pi / 2 * u ** (1.25 if pe > 0.8 else 1.0)) ** 0.85)

    def haut(t):
        return FB + c['tonture'] * t ** 2            # franc-bord et tonture

    def creux(t):
        """Profondeur de la carène sous l'eau ; l'avant remonte à partir de pied_etrave (étrave droite si proche de 1)."""
        d = 0.55 + 0.05 * math.sin(math.pi * min(1, t / pe))
        if t < 0.06:
            d -= 0.4 * (1 - t / 0.06)                  # tableau arrière au ras de l'eau
        if t > pe:
            d -= (d + 0.35) * ((t - pe) / (1 - pe)) ** 1.3
        return d

    # ---------------------------------------------------------------- Coque, pont, liston
    st = []
    grille = []
    # Limite de l'antifouling : une même fraction de chaque section (ligne lisse qui remonte vers l'étrave).
    f_flottaison = haut(0.5) / (haut(0.5) + creux(0.5)) + 0.04
    for i in range(S + 1):
        t = i / S
        hb, top, dep, y = demi(t), haut(t), creux(t), y_de(t)
        st.append((y, hb, top, t))
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            cc, s = math.cos(th), math.sin(th)
            n = 3.4                                     # flancs droits et fond plat des années 1990
            z = top - (top + dep) * abs(s) ** (2 / n)
            ligne.append((hb * math.copysign(abs(cc) ** (2 / n), cc), y, z))
        grille.append(ligne)
    parts = {'coque': bmesh.new(), 'fond': bmesh.new()}
    for i in range(S):
        for k in range(K):
            q = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            fraction = abs(math.sin(math.pi * (k + 0.5) / K)) ** (2 / 3.4)
            bm = parts['fond' if fraction > f_flottaison else 'coque']
            bm.faces.new([bm.verts.new(p) for p in q])
    bm = parts['coque']
    centre = bm.verts.new((0, st[0][0], st[0][2] * 0.4))
    r = [bm.verts.new(p) for p in grille[0]]
    for k in range(K):
        bm.faces.new([centre, r[k + 1], r[k]])
    for bm in parts.values():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('coque', parts['coque'], MAT['coque'])
    objet('fond', parts['fond'], MAT['fond'])
    bm = bmesh.new()
    for sx in (-1, 1):
        h = [bm.verts.new((sx * (hb + 0.006), y, top - 0.02)) for (y, hb, top, _t) in st]
        b = [bm.verts.new((sx * (hb + 0.006), y, top - 0.18)) for (y, hb, top, _t) in st]
        for i in range(len(st) - 1):
            bm.faces.new([h[i], b[i], b[i + 1], h[i + 1]])
    objet('bande', bm, MAT['bande'])
    ck0, ck1 = c['cockpit']
    bm = bmesh.new()
    J = 12
    rangs = [[bm.verts.new(((-1 + 2 * j / J) * hb * 0.985, y, top + 0.1 * (1 - (-1 + 2 * j / J) ** 2) - 0.01)) for j in range(J + 1)] for (y, hb, top, _t) in st]
    for i in range(len(rangs) - 1):
        for j in range(J):
            q = [rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]]
            cx, ty = sum(v.co.x for v in q) / 4, (st[i][3] + st[i + 1][3]) / 2
            if ck0 < ty < ck1 and abs(cx) < B * 0.21:
                continue                                # cockpit ouvert
            bm.faces.new(q)
    objet('pont', bm, MAT['pont'])
    zc = haut((ck0 + ck1) / 2) - 0.45
    boite('cockpit', -B * 0.21, B * 0.21, y_de(ck0), y_de(ck1), zc, zc + 0.04, mat=MAT['cockpit'])

    # ---------------------------------------------------------------- Rouf
    r0, r1, rl, rh = c['rouf']
    zr = haut((r0 + r1) / 2) + 0.05
    boite('rouf', -rl / 2, rl / 2, y_de(r0), y_de(r1), zr - 0.05, zr + rh, avant_bas=rh * 0.35, mat=MAT['rouf'])
    boite('vitre', -rl / 2 - 0.02, rl / 2 + 0.02, y_de(r0) + 0.25, y_de(r1) - 0.3, zr + rh * 0.35, zr + rh * 0.7, avant_bas=rh * 0.2, mat=MAT['vitre'])

    # ---------------------------------------------------------------- Appendices
    yq = y_de(0.48)
    if c['bulbe']:
        balayer('app_quille', catmull([(0, yq + 0.25, -0.3), (0, yq + 0.1, -T * 0.5), (0, yq, -(T - 0.35))], 8), lambda s: 0.95 - 0.3 * s, lambda s: 0.1,
                (0, 1, 0), mat=MAT['quille'])
        balayer('app_bulbe', [Vector((0, yq + 1.6 - 3.4 * k / 16, -(T - 0.3))) for k in range(17)], lambda s: 0.62 * math.sin(math.pi * (0.04 + 0.92 * s)) ** 0.6,
                lambda s: 0.62 * math.sin(math.pi * (0.04 + 0.92 * s)) ** 0.6, (0, 0, 1), section=section_ellipse, mat=MAT['quille'])
    else:   # 1982 : aileron long, lesté, sans bulbe
        balayer('app_quille', catmull([(0, yq + 0.6, -0.3), (0, yq + 0.2, -T * 0.55), (0, yq - 0.4, -T)], 8), lambda s: 2.2 - 0.9 * s, lambda s: 0.12,
                (0, 1, 0), mat=MAT['quille'])
    ys = y_de(0.05)
    xs = [0.0] if c['safrans'] == 1 else [-B * 0.3, B * 0.3]
    for x in xs:
        balayer('app_safran', catmull([(x, ys + 0.1, -0.05), (x, ys, -1.0), (x, ys - 0.1, -2.0)], 6), lambda s: 0.7 - 0.15 * s, lambda s: 0.12,
                (0, 1, 0), mat=MAT['quille'])
    if c['bout_dehors']:
        yb = L / 2
        zb = haut(1) - 0.05
        balayer('bout_dehors', [Vector((0, yb - 0.6 + (c['bout_dehors'] + 0.6) * k / 8, zb)) for k in range(9)], lambda s: 0.14 - 0.05 * s, lambda s: 0.14 - 0.05 * s,
                (0, 0, 1), section=section_ellipse, mat=MAT['mat'])

    # ---------------------------------------------------------------- Mât, barres de flèche, écarteurs, bôme
    ym = y_de(c['pied_mat'])
    zm = haut(c['pied_mat']) + 0.08
    H = c['hauteur_mat']
    if c['mat_aile']:   # mât-aile : profil épais à grande corde
        balayer('mat', [Vector((0, ym, zm + H * k / 24)) for k in range(25)], lambda s: 0.62 - 0.25 * s, lambda s: 0.36, (0, 1, 0), mat=MAT['mat'])
    else:
        balayer('mat', [Vector((0, ym, zm + H * k / 24)) for k in range(25)], lambda s: 0.3 - 0.08 * s, lambda s: 0.2 - 0.05 * s, (0, 1, 0),
                section=section_ellipse, mat=MAT['mat'])
    for i in range(c['barres']):
        hh = (i + 1) / (c['barres'] + 1)
        env = 1.5 - 0.5 * hh
        balayer('mat_fleche', [Vector((-env, ym - 0.05, zm + H * hh)), Vector((env, ym - 0.05, zm + H * hh))], lambda s: 0.08, lambda s: 0.5, (0, 1, 0), mat=MAT['mat'])
    if c['ecarteurs']:  # barres de flèche-écarteurs sur le pont (Aquitaine Innovations)
        for sx in (-1, 1):
            balayer('mat_ecarteur', [Vector((sx * 0.8, ym + 0.3, zm)), Vector((sx * (B / 2 + c['ecarteurs']), ym + 0.6, zm + 0.5))], lambda s: 0.12, lambda s: 0.12,
                    (0, 0, 1), section=section_ellipse, mat=MAT['mat'])
    gx = Vector((0, ym - 0.2, zm + 0.95))   # vit-de-mulet
    balayer('pivot_bome', [Vector((0, gx.y - c['bome'] * k / 12, gx.z)) for k in range(13)], lambda s: 0.2, lambda s: 0.16, (0, 0, 1),
            section=section_ellipse, mat=MAT['mat'], origine=gx)

    sortie = os.path.abspath(os.path.join(ICI, '..', '..', 'packages', 'client', 'public', 'modeles', f'{ident}.glb'))
    bpy.ops.export_scene.gltf(filepath=sortie, export_format='GLB', export_yup=True, export_apply=True)
    print('Modèle exporté :', sortie)


for ident, c in COTES.items():
    if not DEMANDES or ident in DEMANDES:
        construire(ident, c)
