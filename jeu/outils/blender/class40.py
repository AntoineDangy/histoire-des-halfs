# Coque de Class40 construite par Blender à partir des cotes de la jauge, puis exportée en glTF pour le jeu.
# Usage (sans ouvrir Blender) :
#   blender -b --python jeu/outils/blender/class40.py
# Sortie : jeu/packages/client/public/modeles/class40.glb
#
# Cotes de la jauge Class40 : longueur 12,19 m, largeur maximale 4,50 m. Forme d'un Class40 récent (« scow ») :
# étrave large et arrondie, bouchain vif, fond plat qui remonte vers l'avant, francbord plus haut à l'avant.
# Repère du jeu : y vers le haut, l'étrave vers -z. Dans Blender (Z en haut), on construit avec l'étrave vers +Y :
# l'export glTF (+Y en haut) donne alors l'étrave vers -z, comme dans le jeu.
# Les matériaux portent un nom (coque, bande, fond, pont, rouf, cockpit) : le jeu les repeint aux couleurs du skipper.
import math
import os

import bmesh
import bpy
from mathutils import Vector

L = 12.19
B = 4.50
NEZ = 0.06        # léger arrondi de la pointe de l'étrave (m)
N_SECTION = 6.0   # exposant de la superellipse des sections : flancs presque verticaux, bouchain vif, fond plat (photos 2025)
S, K = 60, 96     # stations le long de la coque, points par section (fin près du pont pour un liston net)

SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packages', 'client', 'public', 'modeles', 'class40.glb')


def demi_largeur(t):
    """t = 0 au tableau arrière, t = 1 à l'étrave (avant le nez arrondi)."""
    # Étrave pointue en plan, mais aux lignes pleines (bombées) jusqu'à l'avant (rendu de Crédit Mutuel, 10/11/2026) :
    # les bordés se rejoignent à l'étrave, là où part le bout-dehors.
    # Plan de François Chevalier (2020) : presque toute la largeur jusqu'aux trois quarts, puis ogive courte et pleine.
    u = max(0.0, (t - 0.68) / 0.32)
    return (B / 2) * (0.95 + 0.05 * math.sin(math.pi * min(1, t / 0.6))) * max(0.0, 1 - u ** 1.9) ** 0.62


def francbord(t):
    return 1.32 + 0.38 * t * t  # franc-bord haut, encore plus à l'étrave (photo du SNSM 209, 2025)


def tirant(t):
    """Profondeur du fond sous la flottaison (négatif : fond au-dessus de l'eau, à l'étrave)."""
    return 0.40 * (1 - ((t - 0.45) / 0.55) ** 2) - 0.38 * max(0.0, (t - 0.68) / 0.32) ** 2


def stations():
    out = []
    for i in range(S + 1):
        t = i / S
        out.append((t * (L - NEZ) - L / 2, demi_largeur(t), francbord(t), tirant(t)))
    # Nez arrondi de l'étrave : la largeur se referme en quart de cercle.
    hb1, top1, dep1 = demi_largeur(1), francbord(1), tirant(1)
    for j in range(1, 13):
        a = j / 12
        # Étrave de scow (rendu de Crédit Mutuel, 10/11/2026) : PAS en cuillère : face avant large et presque verticale,
        # angles arrondis en plan ; le fond remonte avant l'étrave (tirant négatif), la face se dresse au-dessus de l'eau.
        out.append((L / 2 - NEZ + NEZ * math.sin(a * math.pi / 2), max(0.02, hb1 * math.cos(a * math.pi / 2)),
                    top1, dep1 - 0.12 * a * a))
    return out


def materiau(nom, couleur, rugosite=0.4):
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*couleur, 1)
    bsdf.inputs['Roughness'].default_value = rugosite
    return m


def objet(nom, bm, mat):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(nom, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def coque():
    """Bordé en trois bandes de couleur : bande de liston, coque, fond (antifouling)."""
    st = stations()
    parts = {k: bmesh.new() for k in ('coque', 'bande', 'fond')}
    grille = []
    for (y, hb, top, dep) in st:
        ligne = []
        for k in range(K + 1):
            th = math.pi * k / K
            c, s = math.cos(th), math.sin(th)
            x = hb * math.copysign(abs(c) ** (2 / N_SECTION), c)
            z = top - (top + dep) * abs(s) ** (2 / N_SECTION)
            ligne.append((x, y, z))
        grille.append(ligne)
    for i in range(len(grille) - 1):
        for k in range(K):
            quad = [grille[i][k], grille[i + 1][k], grille[i + 1][k + 1], grille[i][k + 1]]
            zmoy = sum(p[2] for p in quad) / 4
            top = st[i][2]
            # liston : la première rangée de facettes sous le bord du pont, de chaque côté
            cle = 'fond' if zmoy < 0.05 else 'coque'
            bm = parts[cle]
            bm.faces.new([bm.verts.new(p) for p in quad])
    # Tableau arrière.
    bm = parts['coque']
    centre = bm.verts.new((0, st[0][0], st[0][2] * 0.4))
    tab = [bm.verts.new(p) for p in grille[0]]
    for k in range(K):
        bm.faces.new([centre, tab[k + 1], tab[k]])
    for cle, bm in parts.items():
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('coque', parts['coque'], MAT['coque'])
    objet('fond', parts['fond'], MAT['fond'])
    return st


def liston(st, hauteur=0.16):
    """Bande de couleur indépendante du maillage, collée au bordé juste sous le pont, de chaque côté."""
    bm = bmesh.new()
    for sx in (-1, 1):
        haut, bas = [], []
        for (y, hb, top, _dep) in st:
            x = sx * (hb + 0.006)
            haut.append(bm.verts.new((x, y, top - 0.01)))
            bas.append(bm.verts.new((x, y, top - hauteur)))
        for i in range(len(st) - 1):
            bm.faces.new([haut[i], bas[i], bas[i + 1], haut[i + 1]])
    objet('bande', bm, MAT['bande'])


def pont(st):
    """Pont légèrement bombé, entre les deux listons."""
    bm = bmesh.new()
    J = 12
    rangs = []
    for (y, hb, top, _dep) in st:
        rang = []
        for j in range(J + 1):
            u = -1 + 2 * j / J
            rang.append(bm.verts.new((u * hb * 0.985, y, top + 0.06 * (1 - u * u) - 0.01)))
        rangs.append(rang)
    for i in range(len(rangs) - 1):
        for j in range(J):
            q = [rangs[i][j], rangs[i][j + 1], rangs[i + 1][j + 1], rangs[i + 1][j]]
            cx = sum(v.co.x for v in q) / 4
            cy = sum(v.co.y for v in q) / 4
            if cy < COCKPIT_Y1 and abs(cx) < COCKPIT_X:
                continue  # ouverture du cockpit
            bm.faces.new(q)
    objet('pont', bm, MAT['pont'])


def boite(nom, x0, x1, y0, y1, z0, z1, avant_bas=0.0, mat=None):
    """Volume simple ; avant_bas abaisse le bord avant du dessus (rouf incliné)."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1 - avant_bas), (x0, y1, z1 - avant_bas)]]
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = objet(nom, bm, mat)
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


COCKPIT_X = 1.45                 # demi-largeur du cockpit ouvert
COCKPIT_Y1 = -L / 2 + 3.2        # le cockpit s'étend du tableau arrière jusqu'ici


def rouf():
    """Rouf des Class40 récents (modèle envoyé par le porteur de projet, 10/11/2026) : long, bas, presque triangulaire en
    plan ; il naît en pointe en avant du mât, s'élargit et monte jusqu'au cockpit ; flancs inclinés fondus dans le pont.
    Hublots sur les flancs, panneaux solaires sur le dessus."""
    yA, yR = 1.7, COCKPIT_Y1 + 0.02            # pointe avant, arrière (devant du cockpit)
    W, H = 1.35, 0.52                          # demi-largeur et hauteur à l'arrière
    N = 24
    bm = bmesh.new()
    anneaux = []
    for i in range(N + 1):
        u = i / N
        y = yA + (yR - yA) * u
        t = (y + L / 2) / (L - NEZ)
        z0 = francbord(t) + 0.035
        w, h = W * u ** 0.85 + 0.01, H * u ** 0.7
        anneaux.append([bm.verts.new(p) for p in [(-w, y, z0 - 0.02), (-0.62 * w, y, z0 + h), (0.62 * w, y, z0 + h), (w, y, z0 - 0.02)]])
    for i in range(N):
        for k in range(3):
            bm.faces.new([anneaux[i][k], anneaux[i][k + 1], anneaux[i + 1][k + 1], anneaux[i + 1][k]])
    bm.faces.new(list(reversed(anneaux[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    objet('rouf', bm, MAT['rouf'])

    def point(u, cote, frac):
        """Point du flanc incliné : u de l'avant (0) à l'arrière (1), frac de 0 (pont) à 1 (dessus)."""
        y = yA + (yR - yA) * u
        z0 = francbord((y + L / 2) / (L - NEZ)) + 0.035
        w, h = W * u ** 0.85 + 0.01, H * u ** 0.7
        x = cote * (w + (0.62 * w - w) * frac)
        return (x + cote * 0.012, y, z0 - 0.02 + (h + 0.02) * frac + 0.01)

    def vitre(pts):
        b2 = bmesh.new()
        b2.faces.new([b2.verts.new(p) for p in pts])
        bmesh.ops.recalc_face_normals(b2, faces=b2.faces)
        objet('vitre', b2, MAT['vitre'])
    for cote in (-1, 1):
        vitre([point(0.5, cote, 0.35), point(0.88, cote, 0.35), point(0.88, cote, 0.7), point(0.5, cote, 0.7)])
    # panneaux solaires sur le dessus, à l'arrière du rouf
    def dessus(u):
        y = yA + (yR - yA) * u
        return y, francbord((y + L / 2) / (L - NEZ)) + 0.035 + H * u ** 0.7 + 0.012, 0.62 * (W * u ** 0.85 + 0.01)
    (ya, za, wa), (yb, zb, wb) = dessus(0.62), dessus(0.95)
    vitre([(-wa * 0.8, ya, za), (wa * 0.8, ya, za), (wb * 0.8, yb, zb), (-wb * 0.8, yb, zb)])


def rouf_et_cockpit(st):
    top_mi = francbord(0.35)
    rouf()
    # Cockpit ouvert à l'arrière : plancher sombre en retrait du pont.
    fond_c = francbord(0.1) - 0.42
    boite('cockpit', -COCKPIT_X, COCKPIT_X, -L / 2 + 0.02, COCKPIT_Y1, fond_c, fond_c + 0.05, mat=MAT['cockpit'])
    # hiloires (parois du cockpit) et cloison avant, couleur du pont
    for sx in (-1, 1):
        boite('hiloire', sx * COCKPIT_X - 0.03, sx * COCKPIT_X + 0.03, -L / 2 + 0.02, COCKPIT_Y1, fond_c, francbord(0.2) + 0.03, mat=MAT['pont'])
    boite('cloison', -COCKPIT_X, COCKPIT_X, COCKPIT_Y1 - 0.03, COCKPIT_Y1 + 0.03, fond_c, francbord(0.27) + 0.03, mat=MAT['pont'])


# ---------------------------------------------------------------- Appendices, mât et bôme (10/11/2026)
# Design de référence : Crédit Mutuel (David Raison, 2019) ; profil et rendus envoyés par le porteur de projet, rendu de
# Team SNEF. Jauge Class40 (règles 2025, ffvoile.fr ; attestation de la classe) : dérives interdites, quille FIXE en
# navigation (pas de quille pendulaire, confirmé par le porteur de projet), tirant d'eau 3,00 m au plus ; tirant d'air
# 19 m (source secondaire). Deux safrans suspendus au tableau arrière, long bout-dehors avec sous-barbe, mât non tournant
# à deux étages de barres de flèche poussantes, sans outriggers.
# Construit en vraie grandeur ; le jeu agrandit le Class40 dans le repère de l'IMOCA puis le réduit (même échelle que la coque).
K_JEU = 18.28 / 12.19           # repère du jeu : celui d'un IMOCA


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
        s_ = i / (len(pts) - 1)
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        c = (d - t * d.dot(t)).normalized()
        e = t.cross(c)
        anneaux.append([bm.verts.new(p - o + c * u + e * v) for (u, v) in section(corde(s_), epaisseur(s_))])
    n = len(anneaux[0])
    for i in range(len(anneaux) - 1):
        for k in range(n):
            bm.faces.new([anneaux[i][k], anneaux[i][(k + 1) % n], anneaux[i + 1][(k + 1) % n], anneaux[i + 1][k]])
    bm.faces.new(anneaux[0])
    bm.faces.new(list(reversed(anneaux[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = objet(nom, bm, mat or MAT['carbone'])
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.location = o
    return ob


def bulbe(nom, centre, longueur, diametre):
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
    return objet(nom, bm, MAT['carbone'])


def appendices():
    # Quille fixe : voile de quille légèrement reculé et bulbe en torpille ; tirant d'eau 3,00 m (jauge).
    yq = 0.2                                         # sous le mât du jeu (repère IMOCA : groupe « keel » à 0,3 m en avant)
    balayer('app_quille', catmull([(0, yq, -0.2), (0, yq - 0.1, -1.4), (0, yq - 0.22, -2.65)], 8), lambda s: 0.72 - 0.16 * s, lambda s: 0.11,
            (0, 1, 0), mat=MAT['bande'])
    bulbe('app_quille_bulbe', (0, yq - 0.45, -2.78), 2.6, 0.46)
    # Deux safrans suspendus au tableau arrière (profil de Crédit Mutuel), couleur de la bande.
    for sx, cote in ((-1, 'babord'), (1, 'tribord')):
        x, y = sx * 1.35, -L / 2 - 0.12
        balayer('app_safran_' + cote, catmull([(x, y, 0.95), (x, y - 0.06, -0.4), (x, y - 0.2, -1.55)], 8), lambda s: 0.5 - 0.1 * s, lambda s: 0.12,
                (0, 1, 0), mat=MAT['bande'])
    # Long bout-dehors (tube rond) et sous-barbe ; son bout est le point d'amure des voiles d'avant du jeu.
    racine = Vector((0, L / 2 - 0.5, francbord(1) + 0.02))
    bout = Vector((0, L / 2 + 2.3 / K_JEU, 1.7))
    balayer('app_bout_dehors', [racine.lerp(bout, k / 12) for k in range(13)], lambda s: 0.13 - 0.05 * s, lambda s: 0.13 - 0.05 * s, (0, 0, 1),
            section=section_ellipse, mat=MAT['carbone'])
    pied = Vector((0, L / 2 - NEZ * 0.35, 0.5))   # sur l'étrave en cuillère, au-dessus de l'eau
    balayer('app_sous_barbe', [bout.lerp(pied, k / 6) for k in range(7)], lambda s: 0.02, lambda s: 0.02, (1, 0, 0), section=section_ellipse, mat=MAT['carbone'])


MAT_H = 27.0 / K_JEU             # 18 m au-dessus du pont (mât du jeu : 27 m dans le repère IMOCA) ; tirant d'air 19 m


def mat_et_bome():
    """Mât non tournant à deux étages de barres de flèche poussantes ; bôme. Origine au pied du mât (le jeu le place)."""
    pts = [Vector((0, 0, MAT_H * k / 30)) for k in range(31)]
    m = balayer('pivot_mat', pts, lambda s: 0.34 - 0.1 * s, lambda s: 0.62, (0, 1, 0), section=section_ellipse, mat=MAT['carbone'])
    for h, env in ((0.36, 1.25), (0.66, 0.95)):
        for sx in (-1, 1):
            b = balayer('pivot_mat_fleche', [Vector((0, 0, MAT_H * h)), Vector((sx * env, -0.45 * env, MAT_H * h + 0.05))], lambda s: 0.1, lambda s: 0.35,
                        (0, 1, 0), mat=MAT['carbone'])
            b.parent = m
    long_bome = 7.8 / K_JEU
    pts = [Vector((0, -0.15 - long_bome * k / 14, 1.25 / K_JEU)) for k in range(15)]
    balayer('pivot_bome', pts, lambda s: 0.24 - 0.06 * s, lambda s: 0.14, (0, 0, 1), section=section_ellipse, mat=MAT['carbone'])


bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {
    'coque': materiau('coque', (0.9, 0.9, 0.92), 0.35),
    'bande': materiau('bande', (0.1, 0.4, 0.8), 0.35),
    'fond': materiau('fond', (0.08, 0.09, 0.11), 0.6),
    'pont': materiau('pont', (0.55, 0.58, 0.62), 0.85),
    'rouf': materiau('rouf', (0.9, 0.9, 0.92), 0.35),
    'cockpit': materiau('cockpit', (0.16, 0.17, 0.19), 0.9),
    'carbone': materiau('carbone', (0.07, 0.08, 0.09), 0.45),
    'vitre': materiau('vitre', (0.04, 0.07, 0.11), 0.1),
}
st = coque()
liston(st)
pont(st)
rouf_et_cockpit(st)
appendices()
mat_et_bome()
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(SORTIE), export_format='GLB', export_yup=True, export_apply=True)
print('Modèle exporté :', os.path.abspath(SORTIE))
