"""Szenen-Bauer (ROADMAP 4): baut aus einer Szenenbeschreibung (JSON) das Bild nach dem Stilbuch.

Beschreibung (alle Längen in Blöcken, Winkel in Grad):
{
  "welt": {"art": "wiese" | "klippe" | "meeresklippe" | "schlucht", "kante": 0, "tiefe": 20, "seed": 7},
  "himmel": "tag" | "abend" | "nacht",
  "figuren": [{"id": "ich", "skin": "<pfad>", "slim": null, "pose": "zeigen", "posen_korrektur": {…},
               "position": [x, y], "blick": 0, "item": {"name": "diamond_sword", "hand": "l", "winkel": 40}}],
  "kamera": {"modus": "nah", "seite": "links", "thema": [x, y, z], "ueber_abgrund": false},
  "render": {"breite": 1280, "hoehe": 720, "samples": 48, "blende": 4}
}
Die erste Figur ist die Hauptfigur (Philip); die Kamera rahmt ihren Kopf.
"""
import json
import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

from . import figur as mfigur
from . import himmel as mhimmel
from . import items as mitems
from . import kamera as mkamera
from . import welt as mwelt
from .bloecke import BLOCK
from .posen import POSEN


def _mische(basis, korrektur):
    neu = {k: (dict(v) if isinstance(v, dict) else v) for k, v in basis.items()}
    for k, v in (korrektur or {}).items():
        if isinstance(v, dict):
            neu.setdefault(k, {}).update(v)
        else:
            neu[k] = v
    return neu


def _welt(w, texturen):
    art = w.get("art", "wiese")
    seed = w.get("seed", 7)
    if art == "wiese":
        return mwelt.baue_klippe(texturen, seed=seed, kante=200, tiefe=6, gegenseite=True)
    if art == "meeresklippe":
        return mwelt.baue_klippe(texturen, seed=seed, kante=w.get("kante", 0), tiefe=w.get("tiefe", 20), gegenseite=False)
    if art in ("klippe", "schlucht"):
        return mwelt.baue_klippe(texturen, seed=seed, kante=w.get("kante", 0), tiefe=w.get("tiefe", 20), gegenseite=True)
    raise ValueError(f"Unbekannte Welt-Art „{art}“")


def _randlicht(scene, figur):
    """Randlicht hinten auf der abgewandten Seite (Stilbuch 6: helle Kante an Kopf und Schulter)."""
    rand = bpy.data.lights.new("rand", "AREA")
    rand.energy = 520
    rand.size = 1.2
    ro = bpy.data.objects.new("rand", rand)
    scene.collection.objects.link(ro)
    kopf = figur.kopf_mitte()
    ro.location = kopf + Vector((-1.8, 2.2, 1.0))
    ro.rotation_euler = (kopf - ro.location).to_track_quat("-Z", "Y").to_euler()


def _bildpunkt(scene, cam, p):
    v = world_to_camera_view(scene, cam, p)
    return [round(v.x, 3), round(1 - v.y, 3)]  # Bildkoordinaten: 0,0 oben links


def baue(szene, texturen, ausgabe=None, bericht=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    r = szene.get("render", {})
    scene.render.resolution_x = r.get("breite", 1280)
    scene.render.resolution_y = r.get("hoehe", 720)

    _welt(szene.get("welt", {}), texturen)
    mhimmel.baue(scene, szene.get("himmel", "tag"))

    figuren = []
    for f in szene["figuren"]:
        fig = mfigur.baue_figur(f["id"], f["skin"], slim=f.get("slim"))
        x, y = f.get("position", (0, 0))
        fig.wurzel.location = (x * BLOCK, y * BLOCK, 0)
        p = _mische(POSEN[f.get("pose", "neutral")], f.get("posen_korrektur"))
        p["blick"] = f.get("blick", p.get("blick", 0))
        mfigur.pose(fig, p)
        figuren.append((f, fig))
    haupt = figuren[0][1]
    _randlicht(scene, haupt)

    k = szene.get("kamera", {})
    cam_data = bpy.data.cameras.new("kamera")
    cam = bpy.data.objects.new("kamera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.clip_end = 5000
    oben, unten = haupt.kopf_punkte()
    thema = Vector([c * BLOCK for c in k.get("thema", (8, 6, 0))])
    kante = szene.get("welt", {}).get("kante", 0)
    erlaubt = (lambda pos: pos.x > (kante + 2.5) * BLOCK) if k.get("ueber_abgrund") else None
    fehler = mkamera.rahme(scene, cam, oben, unten, thema, k.get("modus", "nah"), seite=k.get("seite", "links"),
                           gesicht=haupt.gesicht_richtung(), erlaubt=erlaubt)
    cam_data.dof.aperture_fstop = r.get("blende", 4)

    gehalten = {}
    for f, fig in figuren:
        it = f.get("item")
        if it:
            ob = mitems.baue_item(it["name"], texturen)
            mitems.in_die_hand(ob, fig, it.get("hand", "l"), cam, it.get("winkel", 40))
            gehalten[f["id"]] = ob

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = r.get("samples", 48)
    scene.cycles.use_denoising = True
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = r.get("belichtung", -0.3)

    info = {"kamera_abweichung": round(fehler, 4), "linse": cam_data.lens, "figuren": {}, "items": {}}
    bpy.context.view_layer.update()
    for f, fig in figuren:
        o, u = fig.kopf_punkte()
        info["figuren"][f["id"]] = {"kopf": _bildpunkt(scene, cam, (o + u) / 2), "kopf_oben": _bildpunkt(scene, cam, o), "kopf_unten": _bildpunkt(scene, cam, u)}
    for fid, ob in gehalten.items():
        pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
        xs = [_bildpunkt(scene, cam, p) for p in pts[:: max(1, len(pts) // 60)]]
        info["items"][fid] = {"box": [min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs), max(p[1] for p in xs)]}
    if ausgabe:
        scene.render.filepath = ausgabe
        bpy.ops.render.render(write_still=True)
    if bericht:
        with open(bericht, "w", encoding="utf-8") as fh:
            json.dump(info, fh, ensure_ascii=False, indent=1)
    return info
