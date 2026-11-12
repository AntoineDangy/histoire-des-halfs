# Rendu de contrôle d'une coque glTF : trois vues (trois quarts avant, profil, dessus) pour la comparer aux photos.
# Usage : blender -b --python jeu/outils/blender/apercu.py -- <modele.glb> <dossier de sortie> [échelle du cadrage]
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
modele, sortie = os.path.abspath(args[0]), os.path.abspath(args[1])
E = float(args[2]) if len(args) > 2 else 1.0  # 1 : Class40 ; environ 2,4 pour un Ultim
os.makedirs(sortie, exist_ok=True)
nom = os.path.splitext(os.path.basename(modele))[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=modele)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x, scene.render.resolution_y = 1100, 620
scene.world = bpy.data.worlds.new('fond')
scene.world.color = (0.75, 0.82, 0.88)

# Ligne de flottaison (plan bleu translucide à z = 0) pour juger l'assiette et l'étrave hors de l'eau.
bpy.ops.mesh.primitive_plane_add(size=30 * E, location=(0, 0, 0))
eau = bpy.context.object
m = bpy.data.materials.new('eau')
m.diffuse_color = (0.1, 0.35, 0.6, 0.45)
eau.data.materials.append(m)

cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def vue(nom_vue, position, ortho=None):
    cam.location = Vector(position) * E
    direction = Vector((0, 0, 0.6)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = ortho * E
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = 40
    scene.render.filepath = os.path.join(sortie, f'{nom}-{nom_vue}.png')
    bpy.ops.render.render(write_still=True)


# Dans Blender, l'étrave est vers +Y après l'import (glTF -z → Blender +Y).
vue('trois-quarts', (9, 13, 4.5))
vue('avant', (6, 15, 1.6))
vue('profil', (16, 0, 0.8), ortho=15)
vue('dessus', (0, 0.01, 20), ortho=15)
print('Vues écrites dans', sortie)
