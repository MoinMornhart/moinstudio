"""Gelände aus Blöcken (ROADMAP 4.3). Die Figur steht bei (0, 0) auf z = 0 und schaut nach −Y zur Kamera; das Thema
liegt auf der +X-Seite (Stilbuch: Figur am Rand, das Thema in der anderen Bildhälfte).

Bausteine statt fester Orte: Plateau, Kante mit Abgrund, Wasser/Lava am Grund, Hügel, Bäume, Wolken. Jede
Beschreibung setzt sich daraus zusammen.
"""
import math
import os
import random

import bpy

from . import bloecke
from .bloecke import BLOCK


def _rauschen(seed, skala):
    """Weiches Werterauschen 0..1 (ohne Zusatzpakete)."""
    rnd = random.Random(seed)
    gitter = {}

    def wert(ix, iy):
        if (ix, iy) not in gitter:
            gitter[(ix, iy)] = rnd.random()
        return gitter[(ix, iy)]

    def f(x, y):
        gx, gy = x / skala, y / skala
        x0, y0 = math.floor(gx), math.floor(gy)
        tx, ty = gx - x0, gy - y0
        sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = wert(x0, y0) + (wert(x0 + 1, y0) - wert(x0, y0)) * sx
        b = wert(x0, y0 + 1) + (wert(x0 + 1, y0 + 1) - wert(x0, y0 + 1)) * sx
        return a + (b - a) * sy

    return f


def _saeule(welt, x, y, oben, oberflaeche="grass_block", fuellung="dirt", tief=4, stein_bis=None):
    """Eine Geländesäule: Oberfläche bei z = oben, darunter Erde, dann Stein bis `stein_bis`."""
    welt[(x, y, oben)] = oberflaeche
    for z in range(oben - 1, oben - tief, -1):
        welt[(x, y, z)] = fuellung
    unten = stein_bis if stein_bis is not None else oben - tief - 1
    for z in range(oben - tief, unten - 1, -1):
        welt[(x, y, z)] = "stone" if (x * 7 + y * 13 + z * 3) % 11 else "andesite"


def baum(welt, x, y, boden, rnd):
    hoehe = rnd.randint(4, 6)
    for z in range(boden + 1, boden + 1 + hoehe):
        welt[(x, y, z)] = "oak_log"
    krone = boden + hoehe
    for dz, r in ((-1, 2), (0, 2), (1, 1), (2, 1)):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if abs(dx) == r and abs(dy) == r and (dz > 0 or rnd.random() < 0.5):
                    continue
                p = (x + dx, y + dy, krone + dz)
                if p not in welt:
                    welt[p] = "oak_leaves"


def klippe(seed=7, kante=2, tiefe=20, grund="water", gegenseite=True, breite=(-26, 44), laenge=(-14, 70)):
    """Plateau auf der Figurseite (x ≤ kante), dahinter der Abgrund nach +X bis zum Grund (Wasser/Lava/Stein).
    `gegenseite`: True = Schlucht mit Hügeln gegenüber, False = offenes Meer bis zum Horizont (Meeresklippe)."""
    rnd = random.Random(seed)
    welt = {}
    huegel = _rauschen(seed, 9.0)
    fern = _rauschen(seed + 1, 17.0)
    grund_z = -tiefe
    for x in range(breite[0], breite[1]):
        for y in range(laenge[0], laenge[1]):
            # Kante leicht unregelmäßig (echte Minecraft-Klippen sind nicht schnurgerade)
            k = kante + (1 if huegel(x, y * 1.7) > 0.72 and y > 3 else 0) - (1 if huegel(y, x) < 0.2 and y > 6 else 0)
            if x <= k:
                # Plateau: nah am Motiv flach (Standfläche), weiter hinten leicht wellig
                welle = 0 if abs(x) < 5 and y < 6 else int(round((huegel(x, y) - 0.45) * 5 * min(1.0, max(0.0, (y - 4) / 12))))
                oben = max(0, welle)
                # Kantenblock fällt senkrecht bis zum Grund ab (sichtbare Felswand)
                am_rand = x >= k - 1
                _saeule(welt, x, y, oben, stein_bis=grund_z if am_rand else oben - 7)
            else:
                # Gegenüberliegende Seite: Hügel, die zum Grund abfallen
                abstand = x - k
                if gegenseite and abstand > 14:
                    oben = int(round(-tiefe + 6 + fern(x, y) * 8 + max(0, y - 30) * 0.35))  # Gegenseite tiefer als das Plateau: freier Blick in den Abgrund
                    _saeule(welt, x, y, oben, tief=3, stein_bis=min(oben - 4, grund_z))
                else:
                    welt[(x, y, grund_z)] = "gravel" if huegel(x * 2, y * 2) > 0.5 else "sand"
                    if grund in ("water", "lava"):
                        for z in range(grund_z + 1, grund_z + 3):
                            welt[(x, y, z)] = grund
    # Bäume hinten auf dem Plateau und gegenüber
    for _ in range(26):
        x = rnd.randint(breite[0] + 3, breite[1] - 3)
        y = rnd.randint(10, laenge[1] - 4)
        oberste = max((z for z in range(-8, 16) if welt.get((x, y, z)) == "grass_block"), default=None)
        if oberste is not None:
            baum(welt, x, y, oberste, rnd)
    return welt


def wolken(texturen_ordner, hoehe=34, zentrum=(10, 40), groesse=64, zelle=6, collection=None):
    """Echte Minecraft-Wolken aus `environment/clouds.png` (jedes Pixel = eine Wolkenzelle) als flache Quader."""
    pfad = os.path.join(texturen_ordner, "environment", "clouds.png")
    img = bpy.data.images.load(pfad, check_existing=True)
    w, h = img.size
    px = img.pixels[:]
    col = collection or bpy.context.scene.collection
    verts, faces = [], []
    d = 1.2 * BLOCK
    ox, oy = zentrum[0] * BLOCK, zentrum[1] * BLOCK
    for j in range(groesse):
        for i in range(groesse):
            a = px[(((j * 3) % h) * w + ((i * 3) % w)) * 4 + 3]
            if a < 0.5:
                continue
            x0 = ox + (i - groesse / 2) * zelle * BLOCK
            y0 = oy + (j - groesse / 2) * zelle * BLOCK
            x1, y1 = x0 + zelle * BLOCK, y0 + zelle * BLOCK
            z0, z1 = hoehe * BLOCK, hoehe * BLOCK + d
            b = len(verts)
            verts += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
            faces += [(b, b + 1, b + 2, b + 3), (b + 4, b + 7, b + 6, b + 5), (b, b + 4, b + 5, b + 1), (b + 1, b + 5, b + 6, b + 2), (b + 2, b + 6, b + 7, b + 3), (b + 3, b + 7, b + 4, b)]
    me = bpy.data.meshes.new("wolken")
    me.from_pydata(verts, [], faces)
    mat = bpy.data.materials.new("wolken")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    key_e = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
    bsdf.inputs[key_e].default_value = (1, 1, 1, 1)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.35
    me.materials.append(mat)
    ob = bpy.data.objects.new("wolken", me)
    col.objects.link(ob)
    return ob


def _erstes_bild(img):
    """Erstes Bild eines Animationsstreifens (Wasser, Lava) als eigenes, kachelbares Bild."""
    w, h = img.size
    if h <= w:
        return img
    px = img.pixels[:]
    oben = px[(h - w) * w * 4:]  # Blender speichert Zeilen von unten; das erste Bild liegt oben im Streifen
    neu = bpy.data.images.new(f"{img.name}.bild1", w, w, alpha=True)
    neu.pixels.foreach_set(oben)
    neu.update()
    return neu


def meer(texturen, tiefe, von_x, collection=None):
    """Offenes Meer bis zum Horizont: große Fläche mit der echten Wassertextur (gekachelt, eingefärbt wie im Spiel)
    auf Höhe des Wassers im Abgrund."""
    col = collection or bpy.context.scene.collection
    img = _erstes_bild(texturen.bild("water_still"))
    mat = bpy.data.materials.new("meer")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.08
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    tex.extension = "REPEAT"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs[0].default_value = 1.0
    nt.links.new(tex.outputs["Color"], bloecke._rgba(mul, "A"))
    bloecke._rgba(mul, "B").default_value = (*bloecke.WASSER, 1)
    nt.links.new(bloecke._rgba(mul, "Result"), bsdf.inputs["Base Color"])
    me = bpy.data.meshes.new("meer")
    z = (-tiefe + 3 - 0.125) * BLOCK
    s = 1200.0
    x0 = von_x * BLOCK
    me.from_pydata([(x0, -s, z), (s, -s, z), (s, s, z), (x0, s, z)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="uv")
    kachel = [(0, 0), ((s - x0) / BLOCK, 0), ((s - x0) / BLOCK, 2 * s / BLOCK), (0, 2 * s / BLOCK)]
    for li, (u, v) in enumerate(kachel):
        uv.data[li].uv = (u, v)
    me.materials.append(mat)
    ob = bpy.data.objects.new("meer", me)
    col.objects.link(ob)
    return ob


def dunst(von, bis, dichte=0.035, farbe=(0.62, 0.78, 1.0), collection=None):
    """Luftperspektive (Stilbuch 6/7): ein Volumen, das Tiefe sichtbar macht – z. B. im Abgrund unter der Kante.
    `von`/`bis`: Ecken in Blöcken."""
    col = collection or bpy.context.scene.collection
    lo = [v * BLOCK for v in von]
    hi = [v * BLOCK for v in bis]
    me = bpy.data.meshes.new("dunst")
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    verts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me.from_pydata(verts, [], faces)
    mat = bpy.data.materials.new("dunst")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*farbe, 1)
    vol.inputs["Density"].default_value = dichte
    nt.links.new(vol.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])
    me.materials.append(mat)
    ob = bpy.data.objects.new("dunst", me)
    col.objects.link(ob)
    return ob


def baue_klippe(texturen_ordner, **kw):
    tex = bloecke.Texturen(texturen_ordner)
    ob = bloecke.baue(klippe(**kw), tex, "klippe")
    kante, tiefe = kw.get("kante", 2), kw.get("tiefe", 20)
    if not kw.get("gegenseite", True):
        meer(tex, tiefe, von_x=kw.get("breite", (-26, 44))[1])
    # Dunst im Abgrund: wird nach unten dichter wahrgenommen, weil der Weg durch das Volumen länger ist
    dunst((kante + 1, -14, -tiefe + 1), (kante + 60, 70, -3), dichte=0.009)
    return ob
