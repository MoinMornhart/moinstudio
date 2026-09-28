"""Probe für ROADMAP 4.3/4.4: Figur an der Klippe mit echter Blockwelt, Minecraft-Wolken und Stilbuch-Licht.

blender -b --factory-startup --python blender/probe_szene.py -- <skin.png> <texturen-ordner> <ausgabe.png> [pose]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moin import figur as mfigur  # noqa: E402
from moin import welt as mwelt  # noqa: E402
from moin import kamera as mkamera  # noqa: E402
from moin.bloecke import BLOCK  # noqa: E402
from moin.posen import POSEN  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
skin, tex, out = args[0], args[1], args[2]
pose_name = args[3] if len(args) > 3 else "blick_zum_ding"
env = os.environ.get

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

fig = mfigur.baue_figur("ich", skin)
mfigur.pose(fig, POSEN[pose_name])
mwelt.baue_klippe(tex, kante=int(env("MOIN_KANTE", "2")), tiefe=int(env("MOIN_TIEFE", "20")), gegenseite=env("MOIN_GEGENSEITE", "1") == "1")
mwelt.wolken(tex)

# Himmel: kräftiges Cyan-Blau, nach unten heller (Stilbuch 7.2)
world = bpy.data.worlds.new("himmel")
scene.world = world
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes["Background"]
sky = nt.nodes.new("ShaderNodeTexGradient")
coord = nt.nodes.new("ShaderNodeTexCoord")
mapping = nt.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, math.radians(-90), 0)
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.5
ramp.color_ramp.elements[0].color = (0.55, 0.78, 1.0, 1)
ramp.color_ramp.elements[1].position = 0.75
ramp.color_ramp.elements[1].color = (0.08, 0.38, 1.0, 1)
nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
nt.links.new(mapping.outputs["Vector"], sky.inputs["Vector"])
nt.links.new(sky.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = float(env("MOIN_HIMMEL", "1.2"))

# Sonne von vorn und von der Themenseite, Winkel 4°
sonne = bpy.data.lights.new("sonne", "SUN")
sonne.energy = float(env("MOIN_SONNE", "4.5"))
sonne.angle = math.radians(4)
sonne.color = (1.0, 0.95, 0.86)
so = bpy.data.objects.new("sonne", sonne)
scene.collection.objects.link(so)
so.rotation_euler = (math.radians(46), 0, math.radians(38))

# Randlicht hinten auf der abgewandten Seite
rand = bpy.data.lights.new("rand", "AREA")
rand.energy = 520
rand.size = 1.2
ro = bpy.data.objects.new("rand", rand)
scene.collection.objects.link(ro)
ro.location = (-1.8, 2.2, 2.6)
ro.rotation_euler = (Vector((0, 0, 1.6)) - ro.location).to_track_quat("-Z", "Y").to_euler()

# Kamera: Nahaufnahme, Figur links am Rand, Blick leicht von oben in den Abgrund rechts
kopf = fig.kopf_mitte()
cam_data = bpy.data.cameras.new("kamera")
cam = bpy.data.objects.new("kamera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
kante, tiefe = int(env("MOIN_KANTE", "2")), int(env("MOIN_TIEFE", "20"))
# Thema: ein Punkt unten im Abgrund, knapp hinter der Kante
thema = Vector(((kante + float(env("MOIN_TX", "10"))) * BLOCK, float(env("MOIN_TY", "9")) * BLOCK, -tiefe * float(env("MOIN_TZ", "0.7")) * BLOCK))
oben, unten = fig.kopf_punkte()
fehler = mkamera.rahme(scene, cam, oben, unten, thema, env("MOIN_MODUS", "gefahr"), gesicht=fig.gesicht_richtung())
print("MOIN_KAMERA", round(fehler, 4))
cam_data.dof.aperture_fstop = float(env("MOIN_BLENDE", "4"))
cam_data.clip_end = 400

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(env("MOIN_SAMPLES", "48"))
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
# Dunst in der Tiefe (Stilbuch 6): leichter Nebel über die Welt-Volumen wäre teuer – Mist-Pass fehlt noch, später
try:
    scene.view_settings.view_transform = env("MOIN_VIEW", "Standard")
    scene.view_settings.look = env("MOIN_LOOK", "Medium High Contrast")
except TypeError:
    pass
scene.view_settings.exposure = float(env("MOIN_BELICHTUNG", "-0.3"))
scene.render.filepath = out
if env("MOIN_NUR_KAMERA"):
    sys.exit(0)
bpy.ops.render.render(write_still=True)
print("MOIN_OK", out)
