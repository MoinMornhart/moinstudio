"""Farbkorrektur und Gesichtslicht nach Stilbuch 6 (ROADMAP 4.4).

- Sättigung +10–30 % und etwas mehr Kontrast im Compositor (Blender 4: scene.node_tree, Blender 5: eigene
  Compositor-Knotengruppe) – beide Versionen werden unterstützt.
- Gesichtslicht: weiche Flächenlampe nahe der Kamera, damit das Gesicht der hellste Teil des Bildes ist.
"""
import bpy
from mathutils import Vector


def _compositor_baum(scene):
    """Gibt den Compositor-Knotenbaum zurück (legt ihn an), für Blender 4.x und 5.x."""
    if hasattr(scene, "compositing_node_group"):  # Blender 5
        gruppe = scene.compositing_node_group
        if gruppe is None:
            gruppe = bpy.data.node_groups.new("MoinStudio Look", "CompositorNodeTree")
            scene.compositing_node_group = gruppe
        return gruppe, 5
    scene.use_nodes = True  # Blender 4
    return scene.node_tree, 4


def farbkorrektur(scene, saettigung=1.18, kontrast=1.06):
    baum, version = _compositor_baum(scene)
    for n in list(baum.nodes):
        baum.nodes.remove(n)
    ein = baum.nodes.new("CompositorNodeRLayers")
    hs = baum.nodes.new("CompositorNodeHueSat")
    # Sättigung/Wert: Blender 4 hat Eingänge, ältere Stände Eigenschaften
    if "Saturation" in hs.inputs:
        hs.inputs["Saturation"].default_value = saettigung
    else:
        hs.color_saturation = saettigung
    bc = baum.nodes.new("CompositorNodeBrightContrast")
    if "Contrast" in bc.inputs:
        bc.inputs["Contrast"].default_value = (kontrast - 1) * 100
    if version == 5:
        if not any(s.name == "Image" for s in baum.interface.items_tree):
            baum.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        aus = baum.nodes.new("NodeGroupOutput")
        ziel = aus.inputs[0]
    else:
        aus = baum.nodes.new("CompositorNodeComposite")
        ziel = aus.inputs["Image"]
    baum.links.new(ein.outputs["Image"], hs.inputs["Image"])
    baum.links.new(hs.outputs["Image"], bc.inputs["Image"])
    baum.links.new(bc.outputs["Image"], ziel)


def gesichtslicht(scene, cam, kopf, staerke=60.0):
    """Weiche Lampe leicht über und neben der Kamera, auf den Kopf gerichtet (Beauty-Licht der Vorbilder)."""
    licht = bpy.data.lights.new("gesicht", "AREA")
    licht.energy = staerke
    licht.size = 0.9
    licht.color = (1.0, 1.0, 1.0)  # neutral: warmes Gesichtslicht färbt Hauttöne gelb
    ob = bpy.data.objects.new("gesicht", licht)
    scene.collection.objects.link(ob)
    von = cam.matrix_world.translation
    richtung = (kopf - von)
    ob.location = von + Vector((0, 0, 0.45)) - richtung.normalized() * 0.2
    ob.rotation_euler = (kopf - ob.location).to_track_quat("-Z", "Y").to_euler()
    return ob
