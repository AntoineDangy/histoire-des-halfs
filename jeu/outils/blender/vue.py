# Rendu d'un modèle glTF sous un angle donné, pour le comparer à une photo ou à un dessin.
# Usage : blender -b --python jeu/outils/blender/vue.py -- <modele.glb> <image.png> <cam x> <cam y> <cam z> [cible x y z] [focale]
# Repère Blender après import : étrave vers +Y, tribord vers +X, haut vers +Z.
import os
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
modele, sortie = os.path.abspath(a[0]), os.path.abspath(a[1])
cam_pos = Vector(tuple(float(v) for v in a[2:5]))
cible = Vector(tuple(float(v) for v in a[5:8])) if len(a) >= 8 else Vector((0, 0, 3))
focale = float(a[8]) if len(a) >= 9 else 40

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=modele)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_shadows = True
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 1000, 1000
sc.world = bpy.data.worlds.new('fond')
sc.world.color = (0.95, 0.95, 0.95)
cd = bpy.data.cameras.new('cam')
cd.lens = focale
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = cam_pos
cam.rotation_euler = (cible - cam_pos).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = sortie
bpy.ops.render.render(write_still=True)
print('Vue écrite :', sortie)
