"""Blöcke mit echten Minecraft-Texturen (ROADMAP 4.3).

Ein Block ist 16 Skin-Pixel groß (0,9 m), passend zur Figur aus figur.py. Welten werden als Raster
{(x, y, z): blockname} beschrieben (z = Höhe, der Block (x, y, 0) liegt direkt unter der Standfläche z = 0).
Es werden nur Flächen gebaut, die an Luft oder durchsichtige Blöcke grenzen.

Texturen kommen immer aus der Spieldatei (`textures/block/*.png`), nie selbst erzeugt. Animierte Texturen
(Wasser, Lava) sind Streifen; es wird das erste Bild verwendet.
"""
import os

import bpy

from .figur import PX

BLOCK = 16 * PX  # Meter je Block

def _linear(c):
    """sRGB (wie im Spiel angegeben) → linear (Blender-Farbeingänge)"""
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# Einfärbung wie im Spiel (Ebenen-Biom): Gras #91BD59, Laub #77AB2F, Wasser #3F76E4
GRAS = _linear((0.569, 0.741, 0.349))
LAUB = _linear((0.467, 0.671, 0.184))
WASSER = _linear((0.247, 0.463, 0.894))

# Block → Texturen je Seite und Eigenschaften. Namen wie im Spiel.
ARTEN = {
    "grass_block": {"oben": ("grass_block_top", GRAS), "unten": ("dirt", None), "seite": ("grass_block_side", None), "overlay": ("grass_block_side_overlay", GRAS)},
    "dirt": {"alle": ("dirt", None)},
    "coarse_dirt": {"alle": ("coarse_dirt", None)},
    "stone": {"alle": ("stone", None)},
    "andesite": {"alle": ("andesite", None)},
    "gravel": {"alle": ("gravel", None)},
    "sand": {"alle": ("sand", None)},
    "sandstone": {"oben": ("sandstone_top", None), "unten": ("sandstone_bottom", None), "seite": ("sandstone", None)},
    "deepslate": {"oben": ("deepslate_top", None), "unten": ("deepslate_top", None), "seite": ("deepslate", None)},
    "cobblestone": {"alle": ("cobblestone", None)},
    "mossy_cobblestone": {"alle": ("mossy_cobblestone", None)},
    "oak_log": {"oben": ("oak_log_top", None), "unten": ("oak_log_top", None), "seite": ("oak_log", None)},
    "oak_planks": {"alle": ("oak_planks", None)},
    "oak_leaves": {"alle": ("oak_leaves", LAUB), "durchsichtig": True},
    "water": {"alle": ("water_still", WASSER), "fluessig": True, "durchsichtig": True},
    "lava": {"alle": ("lava_still", None), "fluessig": True, "leuchtet": 3.0},
    "snow_block": {"alle": ("snow", None)},
    "ice": {"alle": ("ice", None), "durchsichtig": True},
    "netherrack": {"alle": ("netherrack", None)},
    "obsidian": {"alle": ("obsidian", None)},
    "bedrock": {"alle": ("bedrock", None)},
    "tnt": {"oben": ("tnt_top", None), "unten": ("tnt_bottom", None), "seite": ("tnt_side", None)},
}

SEITEN = {
    # Richtung: (Normale, Ecken im Einheitswürfel unten-links, unten-rechts, oben-rechts, oben-links von außen gesehen)
    "vorn": ((0, -1, 0), [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)]),
    "hinten": ((0, 1, 0), [(1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1)]),
    "rechts": ((-1, 0, 0), [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)]),
    "links": ((1, 0, 0), [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),
    "oben": ((0, 0, 1), [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]),
    "unten": ((0, 0, -1), [(0, 1, 0), (1, 1, 0), (1, 0, 0), (0, 0, 0)]),
}


def _rgba(node, name):
    """Farb-Anschluss des Mix-Knotens nach Name (A, B, Result) – die Nummern unterscheiden sich je Blender-Version."""
    for sock in list(node.inputs) + list(node.outputs):
        if sock.name == name and sock.type == "RGBA":
            return sock
    raise KeyError(name)


# Luftperspektive (Stilbuch 6/7): Oberflächen mischen sich mit der Entfernung zur Kamera in Dunstfarbe.
# Ohne Volumen – so bleibt das Sonnenlicht voll und die Renderzeit gleich.
DUNST = {"farbe": (0.42, 0.66, 1.0), "halbwert": 160.0}


def dunst_einbauen(mat):
    """Hängt den Entfernungsdunst vor den Material-Ausgang (Cycles und Eevee, Blender 4 und 5)."""
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    link = next((lk for lk in nt.links if lk.to_socket == out.inputs["Surface"]), None)
    if link is None:
        return
    shader = link.from_socket
    cam = nt.nodes.new("ShaderNodeCameraData")
    teil = nt.nodes.new("ShaderNodeMath")
    teil.operation = "DIVIDE"
    teil.inputs[1].default_value = DUNST["halbwert"] / 0.693
    nt.links.new(cam.outputs["View Distance"], teil.inputs[0])
    expo = nt.nodes.new("ShaderNodeMath")
    expo.operation = "EXPONENT"
    neg = nt.nodes.new("ShaderNodeMath")
    neg.operation = "MULTIPLY"
    neg.inputs[1].default_value = -1.0
    nt.links.new(teil.outputs[0], neg.inputs[0])
    nt.links.new(neg.outputs[0], expo.inputs[0])
    faktor = nt.nodes.new("ShaderNodeMath")
    faktor.operation = "SUBTRACT"
    faktor.inputs[0].default_value = 1.0
    nt.links.new(expo.outputs[0], faktor.inputs[1])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*DUNST["farbe"], 1)
    em.inputs["Strength"].default_value = 1.0
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(faktor.outputs[0], mix.inputs[0])
    nt.links.new(shader, mix.inputs[1])
    nt.links.new(em.outputs["Emission"], mix.inputs[2])
    nt.links.remove(link)
    nt.links.new(mix.outputs[0], out.inputs["Surface"])


class Texturen:
    """Lädt Blocktexturen aus der entpackten Spieldatei und baut Materialien (einmal je Textur/Einfärbung)."""

    def __init__(self, ordner):
        self.ordner = ordner
        self.cache = {}

    def bild(self, name):
        pfad = os.path.join(self.ordner, "block", f"{name}.png")
        if not os.path.exists(pfad):
            raise FileNotFoundError(f"Textur {name} fehlt in der Spieldatei ({pfad})")
        img = bpy.data.images.load(pfad, check_existing=True)
        img.alpha_mode = "STRAIGHT"
        return img

    def material(self, name, farbe=None, overlay=None, durchsichtig=False, leuchtet=0.0):
        key = (name, farbe, overlay, durchsichtig, leuchtet)
        if key in self.cache:
            return self.cache[key]
        img = self.bild(name)
        mat = bpy.data.materials.new(f"mc.{name}")
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Roughness"].default_value = 0.72
        for k in ("Specular IOR Level", "Specular"):
            if k in bsdf.inputs:
                bsdf.inputs[k].default_value = 0.12
                break
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Closest"
        farbe_out = tex.outputs["Color"]
        if farbe:
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs[0].default_value = 1.0
            nt.links.new(farbe_out, _rgba(mul, "A"))
            _rgba(mul, "B").default_value = (*farbe, 1)
            farbe_out = _rgba(mul, "Result")
        if overlay:
            # Gras an der Seite: eingefärbte Deckschicht über der Erdseite
            ov_img = self.bild(overlay[0])
            ov = nt.nodes.new("ShaderNodeTexImage")
            ov.image = ov_img
            ov.interpolation = "Closest"
            tint = nt.nodes.new("ShaderNodeMix")
            tint.data_type = "RGBA"
            tint.blend_type = "MULTIPLY"
            tint.inputs[0].default_value = 1.0
            nt.links.new(ov.outputs["Color"], _rgba(tint, "A"))
            _rgba(tint, "B").default_value = (*overlay[1], 1)
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            nt.links.new(ov.outputs["Alpha"], mix.inputs[0])
            nt.links.new(farbe_out, _rgba(mix, "A"))
            nt.links.new(_rgba(tint, "Result"), _rgba(mix, "B"))
            farbe_out = _rgba(mix, "Result")
        nt.links.new(farbe_out, bsdf.inputs["Base Color"])
        if durchsichtig:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            if hasattr(mat, "blend_method"):
                mat.blend_method = "HASHED"
        if leuchtet:
            key_e = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            nt.links.new(farbe_out, bsdf.inputs[key_e])
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = leuchtet
        dunst_einbauen(mat)
        self.cache[key] = mat
        return mat


def _seiten_textur(art, seite):
    d = ARTEN[art]
    if "alle" in d:
        return d["alle"], None
    if seite == "oben":
        return d["oben"], None
    if seite == "unten":
        return d["unten"], None
    return d["seite"], d.get("overlay")


def baue(welt, texturen, name="welt", collection=None, versatz=(0.0, 0.0, 0.0)):
    """Baut ein Blockraster als ein Objekt. `welt`: {(x, y, z): art}. Gibt das Objekt zurück."""
    col = collection or bpy.context.scene.collection
    verts, faces, uvs, mat_idx = [], [], [], []
    mats, mat_nr = [], {}
    for (x, y, z), art in welt.items():
        info = ARTEN[art]
        for seite, ((nx, ny, nz), ecken) in SEITEN.items():
            nachbar = welt.get((x + nx, y + ny, z + nz))
            if nachbar is not None:
                n_info = ARTEN[nachbar]
                # verdeckt, außer ein durchsichtiger/flüssiger Nachbar einer anderen Art
                if not n_info.get("durchsichtig") or nachbar == art:
                    continue
            # Flüssigkeiten: nur die Oberseite ein Stück tiefer (wie im Spiel)
            tex, overlay = _seiten_textur(art, seite)
            key = (tex, overlay)
            if key not in mat_nr:
                mat_nr[key] = len(mats)
                mats.append(texturen.material(tex[0], tex[1], overlay, info.get("durchsichtig", False), info.get("leuchtet", 0.0)))
            base = len(verts)
            oben = 0.875 if info.get("fluessig") and welt.get((x, y, z + 1)) != art else 1.0
            for cx, cy, cz in ecken:
                verts.append(((x + cx) * BLOCK + versatz[0], (y + cy) * BLOCK + versatz[1], (z - 1 + cz * oben) * BLOCK + versatz[2]))
            faces.append((base, base + 1, base + 2, base + 3))
            # Streifen-Texturen (animiert): erstes Bild oben im Streifen
            img = mats[mat_nr[key]].node_tree.nodes.get("Image Texture").image
            w, h = img.size
            f = w / h if h > w else 1.0
            uvs.extend([(0, 1 - f), (1, 1 - f), (1, 1), (0, 1)])
            mat_idx.append(mat_nr[key])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    layer = me.uv_layers.new(name="uv")
    for poly in me.polygons:
        for li in poly.loop_indices:
            layer.data[li].uv = uvs[me.loops[li].vertex_index]
    for m in mats:
        me.materials.append(m)
    for poly, mi in zip(me.polygons, mat_idx):
        poly.material_index = mi
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


# Pflanzen (Stilbuch 7: Welt nie leer): gekreuzte Flächen mit echter Textur, eingefärbt wie im Spiel
PFLANZEN = {
    "short_grass": GRAS,
    "fern": GRAS,
    "tall_grass_bottom": GRAS,
    "tall_grass_top": GRAS,
    "dandelion": None,
    "poppy": None,
    "cornflower": None,
    "oxeye_daisy": None,
    "azure_bluet": None,
}


def baue_pflanzen(pflanzen, texturen, name="pflanzen", collection=None):
    """`pflanzen`: Liste (x, y, z, art) – die Pflanze steht im Luftblock (x, y, z) auf dem Block darunter."""
    col = collection or bpy.context.scene.collection
    verts, faces, uvs, mat_idx, mats, nr = [], [], [], [], [], {}
    for x, y, z, art in pflanzen:
        if art not in nr:
            nr[art] = len(mats)
            mats.append(texturen.material(art, PFLANZEN.get(art), None, True, 0.0))
        img = mats[nr[art]].node_tree.nodes.get("Image Texture").image
        w, h = img.size
        f = w / h if h > w else 1.0
        # leicht versetzt, damit Reihen nicht wie gestempelt wirken (fester Versatz je Position)
        ox = (((x * 73856093) ^ (y * 19349663)) % 7 - 3) * 0.04
        oy = (((x * 83492791) ^ (y * 2654435761)) % 7 - 3) * 0.04
        cx, cy = x + 0.5 + ox, y + 0.5 + oy
        z0, z1 = (z - 1) * BLOCK, z * BLOCK
        for (ax, ay), (bx, by) in (((-0.45, -0.45), (0.45, 0.45)), ((-0.45, 0.45), (0.45, -0.45))):
            b = len(verts)
            verts += [((cx + ax) * BLOCK, (cy + ay) * BLOCK, z0), ((cx + bx) * BLOCK, (cy + by) * BLOCK, z0),
                      ((cx + bx) * BLOCK, (cy + by) * BLOCK, z1), ((cx + ax) * BLOCK, (cy + ay) * BLOCK, z1)]
            faces.append((b, b + 1, b + 2, b + 3))
            uvs += [(0, 1 - f), (1, 1 - f), (1, 1), (0, 1)]
            mat_idx.append(nr[art])
    if not faces:
        return None
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    layer = me.uv_layers.new(name="uv")
    for poly in me.polygons:
        for li in poly.loop_indices:
            layer.data[li].uv = uvs[me.loops[li].vertex_index]
    for m in mats:
        me.materials.append(m)
    for poly, mi in zip(me.polygons, mat_idx):
        poly.material_index = mi
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob
