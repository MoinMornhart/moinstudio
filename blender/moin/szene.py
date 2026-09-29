"""Szenen-Bauer (ROADMAP 4): baut aus einer Szenenbeschreibung (JSON) das Bild nach dem Stilbuch.

Beschreibung (alle Längen in Blöcken, Winkel in Grad):
{
  "welt": {"art": "wiese" | "klippe" | "meeresklippe" | "schlucht" | "dorf" | "hoehle" | "nether", "kante": 0, "tiefe": 20, "seed": 7,
           "grund": "lava" | "water" | null},
  "himmel": "tag" | "abend" | "nacht",
  "figuren": [{"id": "ich", "skin": "<pfad>", "slim": null, "pose": "zeigen", "posen_korrektur": {…},
               "position": [x, y], "blick": 0, "item": {"name": "diamond_sword", "hand": "l", "winkel": 40}}],
  "mobs": [{"art": "zombie", "position": [x, y], "hoehe": 0, "blick": 0 | "<figur-id>", "groesse": 1, "pose": "stand" | "angriff"}],
  "kamera": {"hoehe": 10 (optional, Grad), "linse": 24 (optional), "modus": "nah", "seite": "links", "thema": [x, y, z], "ueber_abgrund": false},
  "render": {"breite": 1280, "hoehe": 720, "samples": 48, "blende": 4}
}
Die erste Figur ist die Hauptfigur (Philip); die Kamera rahmt ihren Kopf.
"""
import json
import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix as mathutils_Matrix, Vector

from . import figur as mfigur
from . import himmel as mhimmel
from . import items as mitems
from . import kamera as mkamera
from . import look as mlook
from . import mobs as mmobs
from . import welt as mwelt
from . import bloecke
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


def _spiegeln(p):
    """Pose seitenverkehrt: für Figuren, die nach −X schauen (Gegner rechts im Bild). Links und rechts tauschen,
    Drehungen und seitliche Neigungen umkehren – so bleibt die Waffe in der kameranahen Hand."""
    neu = {}
    for k, v in p.items():
        ziel = k.replace("_r", "_X").replace("_l", "_r").replace("_X", "_l") if k[-2:] in ("_r", "_l") else k
        if isinstance(v, dict):
            v = {n: (-w if n in ("drehen", "neigen") else w) for n, w in v.items()}
        elif k == "kippen_seite":
            v = -v
        neu[ziel] = v
    return neu


def _welt(w, texturen, himmel="tag"):
    art = w.get("art", "wiese")
    bloecke.DUNST.update(farbe=mhimmel.VARIANTEN.get(himmel, {}).get("dunst", (0.42, 0.66, 1.0)), halbwert=160.0)
    seed = w.get("seed", 7)
    aend = w.get("bloecke")  # frei gesetzte oder weggenommene Blöcke (Wand, Grube, Säulen …)
    if art == "wiese":
        return mwelt.baue_klippe(texturen, aend, seed=seed, kante=200, tiefe=6, gegenseite=True)
    if art == "meeresklippe":
        return mwelt.baue_klippe(texturen, aend, seed=seed, kante=w.get("kante", 0), tiefe=w.get("tiefe", 20), gegenseite=False)
    if art in ("klippe", "schlucht"):
        return mwelt.baue_klippe(texturen, aend, seed=seed, kante=w.get("kante", 0), tiefe=w.get("tiefe", 20), gegenseite=True)
    if art == "dorf":
        return mwelt.baue_dorf(texturen, aend, seed=seed, haeuser=w.get("haeuser", 5))
    if art == "end":
        bloecke.DUNST.update(farbe=(0.06, 0.03, 0.09), halbwert=120.0)
        return mwelt.baue_endwelt(texturen, aend, seed=seed)
    if art in ("lavameer", "meer"):
        if art == "lavameer":
            bloecke.DUNST.update(farbe=(0.9, 0.35, 0.08), halbwert=90.0)
        return mwelt.baue_meerwelt(texturen, "lava" if art == "lavameer" else "water", aend)
    if art in mwelt.RAUM_ARTEN:
        # geschlossener Raum: dunkler bzw. roter Dunst statt Himmelsblau
        bloecke.DUNST.update({"hoehle": {"farbe": (0.015, 0.02, 0.03), "halbwert": 70.0},
                              "nether": {"farbe": (0.30, 0.05, 0.02), "halbwert": 45.0}}[art])
        return mwelt.baue_raum(texturen, art, aend, seed=seed, grund=w.get("grund", "lava"))
    raise ValueError(f"Unbekannte Welt-Art „{art}“ (bekannt: wiese, klippe, meeresklippe, schlucht, dorf, lavameer, meer, end, "
                     f"{', '.join(mwelt.RAUM_ARTEN)})")


def _objekte(liste, texturen):
    """Frei platzierte Einzelblöcke (fliegendes TNT, herumliegende Blöcke): {"block": "tnt", "position": [x, y, z],
    "drehung": [rx, ry, rz], "groesse": 1}. Position in Blöcken (Mitte des Blocks), Drehung in Grad."""
    import math as _m
    tex = bloecke.Texturen(texturen)
    for i, o in enumerate(liste or []):
        halb = 0.5 * BLOCK
        ob = bloecke.baue({(0, 0, 1): o["block"]}, tex, f"objekt{i}", versatz=(-halb, -halb, -halb))
        x, y, z = o.get("position", (3, 3, 2))
        ob.location = (x * BLOCK, y * BLOCK, z * BLOCK)
        ob.rotation_euler = [_m.radians(g) for g in o.get("drehung", (0, 0, 0))]
        s = o.get("groesse", 1.0)
        ob.scale = (s, s, s)


def _randlicht(scene, figur, cam, seite="links", staerke=650, farbe=(1.0, 1.0, 1.0)):
    """Randlicht hinter der Figur, von der Kamera aus gesehen, leicht zur Außenseite versetzt
    (Stilbuch 6: helle Kante an Kopf und Schulter, die die Figur vom Hintergrund löst)."""
    rand = bpy.data.lights.new("rand", "AREA")
    rand.energy = staerke
    rand.size = 1.0
    rand.color = farbe
    ro = bpy.data.objects.new("rand", rand)
    scene.collection.objects.link(ro)
    ro.visible_camera = False
    kopf = figur.kopf_mitte()
    von_kamera = kopf - cam.matrix_world.translation
    von_kamera.z = 0
    von_kamera.normalize()
    rechts = Vector((von_kamera.y, -von_kamera.x, 0))  # Bild-rechts aus Kamerasicht
    aussen = -rechts if seite == "links" else rechts
    ro.location = kopf + von_kamera * 2.2 + aussen * 1.3 + Vector((0, 0, 1.2))
    ro.rotation_euler = (kopf - ro.location).to_track_quat("-Z", "Y").to_euler()


def _pflanzen_vor_kamera_weg(cam, ziel, abstand=0.8):
    """Gras und Blumen direkt vor der Linse entfernen: unscharf werden sie zu Flecken über dem Gesicht."""
    ob = bpy.data.objects.get("pflanzen")
    if not ob:
        return
    import bmesh
    von = cam.matrix_world.translation
    grenze = (ziel - von).length * abstand
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    weg = [f for f in bm.faces if (ob.matrix_world @ f.calc_center_median() - von).length < grenze]
    bmesh.ops.delete(bm, geom=weg, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()


def _boden_hoehe(scene, x, y, von=60.0, platz=2.0, nah_an=0.0):
    """Bodenfläche unter (x, y) in Metern: nach oben zeigende Fläche mit mindestens `platz` Metern Luft darüber
    (in Höhlen also der Boden, nicht das Dach). Bei mehreren die, die `nah_an` am nächsten liegt."""
    bpy.context.view_layer.update()
    tiefe = bpy.context.evaluated_depsgraph_get()
    treffer_liste, z = [], von
    for _ in range(40):
        treffer, ort, normale, *_ = scene.ray_cast(tiefe, Vector((x, y, z)), Vector((0, 0, -1)))
        if not treffer:
            break
        treffer_liste.append((ort.z, normale.z))
        z = ort.z - 1e-3
    boeden = []
    for i, (hz, nz) in enumerate(treffer_liste):
        oben_frei = hz + platz <= (treffer_liste[i - 1][0] if i > 0 else von) + 1e-6
        if nz > 0.5 and oben_frei and (i == 0 or treffer_liste[i - 1][1] < -0.5):
            boeden.append(hz)
    if not boeden:
        return nah_an
    naechster = min(boeden, key=lambda b: abs(b - nah_an))
    # über einem Abgrund (kein Boden in Reichweite): auf Höhe der Kante bleiben statt in die Tiefe zu fallen
    return naechster if abs(naechster - nah_an) < 3.0 else nah_an


def _auf_den_boden(scene, fig, hoehe=None):
    """Füße auf den Boden (Ausfallschritt und Kippen heben sie sonst an); `hoehe` in Blöcken = in der Luft."""
    bpy.context.view_layer.update()
    tief = min((o.matrix_world @ Vector(c)).z for o in fig.teile.values() for c in o.bound_box)
    w = fig.wurzel.location
    for o in fig.teile.values():  # die eigene Figur nicht als Boden treffen
        o.hide_viewport = True
    boden = _boden_hoehe(scene, w.x, w.y, nah_an=w.z)
    for o in fig.teile.values():
        o.hide_viewport = False
    ziel = boden + (hoehe or 0) * BLOCK
    fig.wurzel.location.z += ziel - tief
    bpy.context.view_layer.update()


def _riesen_zurueck(haupt, mobs, thema):
    """Riesige Mobs (Ghast, 10-fache Mobs) passen nur ins Bild, wenn sie weit genug hinten stehen – wie die
    Riesenspinne bei Paluten. Ist ein Mob das Kamera-Thema und höher als 60 % seines Abstands zur Hauptfigur, wird er
    auf der Linie Figur → Mob nach hinten geschoben, bis es passt."""
    for i, (m, mob) in enumerate(mobs):
        if not (thema == f"mob:{i}" or thema == m["art"]):
            continue
        bpy.context.view_layer.update()
        punkte = [o.matrix_world @ Vector(c) for o in mob.teile.values() for c in o.bound_box]
        hoehe = max(p.z for p in punkte) - min(0.0, min(p.z for p in punkte))
        kopf = haupt.kopf_mitte()
        weg = mob.wurzel.location - kopf
        weg.z = 0
        abstand = weg.length
        noetig = hoehe / 0.6
        if abstand < 1e-3 or abstand >= noetig:
            continue
        verschiebung = weg.normalized() * (noetig - abstand)
        mob.wurzel.location += verschiebung
        print("MOIN_RIESE", m["art"], "um", round(verschiebung.length, 1), "m nach hinten")
    bpy.context.view_layer.update()


def _im_bild(box):
    """Anteil einer Bildbox (x0, y0, x1, y1), der im Bild liegt."""
    x0, y0, x1, y1 = box
    flaeche = max(1e-6, (x1 - x0) * (y1 - y0))
    sichtbar = max(0.0, min(1, x1) - max(0, x0)) * max(0.0, min(1, y1) - max(0, y0))
    return sichtbar / flaeche


def _bildpunkt(scene, cam, p):
    v = world_to_camera_view(scene, cam, p)
    return [round(v.x, 3), round(1 - v.y, 3)]  # Bildkoordinaten: 0,0 oben links


def _items_anhaengen(figuren, texturen, cam, k):
    gehalten = {}
    for f, fig in figuren:
        it = f.get("item")
        if it:
            # Kampf: Waffen nah an der Kamera übergroß wie bei GommeHD (1,3–1,6-fach)
            groesse = it.get("groesse", 1.4 if k.get("modus") == "kampf" else 1.0)
            ob = mitems.baue_item(it["name"], texturen, pixel=mitems.ITEM_PIXEL * groesse)
            mitems.in_die_hand(ob, fig, it.get("hand", "l"), cam, it.get("winkel", 40))
            gehalten[f["id"]] = ob
    bpy.context.view_layer.update()
    return gehalten


def _gesicht_sichtbar(scene, cam, fig, raster=5):
    """Anteil der Gesichtsfläche, den die Kamera wirklich sieht: Strahlen auf ein Punktraster der Vorderseite des
    Kopfes. Ein Punkt zählt, wenn das Gesicht zur Kamera zeigt und der Strahl zuerst den eigenen Kopf trifft."""
    tiefe = bpy.context.evaluated_depsgraph_get()
    kopf = fig.teile["kopf"]
    mw = kopf.matrix_world
    von = cam.matrix_world.translation
    normale = (mw.to_3x3() @ Vector((0, -1, 0))).normalized()
    treffer = 0
    for a in range(raster):
        for b in range(raster):
            x = (-3.2 + 6.4 * a / (raster - 1)) * mfigur.PX
            z = (-3.2 + 6.4 * b / (raster - 1)) * mfigur.PX
            p = mw @ Vector((x, -4.05 * mfigur.PX, z))
            zur_kamera = von - p
            if normale.dot(zur_kamera) <= 0:
                continue
            richtung = (p - von)
            abstand = richtung.length
            ok, _, _, _, ob, _ = scene.ray_cast(tiefe, von, richtung.normalized(), distance=abstand + 0.05)
            if ok and ob is not None and ob.name.startswith(f"{fig.name}.kopf"):
                treffer += 1
    return treffer / (raster * raster)


def _sicht_versperrt(scene, cam, haupt, raster=12):
    """Anteil des Bildes, in dem Welt oder Objekte näher an der Kamera sind als 70 % des Abstands zur Hauptfigur
    (Figuren, Items und Mobs zählen nicht: die gehören ins Bild)."""
    tiefe = bpy.context.evaluated_depsgraph_get()
    von = cam.matrix_world.translation
    grenze = (haupt.kopf_mitte() - von).length * 0.7
    frame = [cam.matrix_world @ v for v in cam.data.view_frame(scene=scene)]  # oben rechts, unten rechts, unten links, oben links
    gesperrt = 0
    for a in range(raster):
        for b in range(raster):
            u, v = (a + 0.5) / raster, (b + 0.5) / raster
            oben = frame[3].lerp(frame[0], u)
            unten = frame[2].lerp(frame[1], u)
            p = oben.lerp(unten, v)
            ok, ort, _, _, ob, _ = scene.ray_cast(tiefe, von, (p - von).normalized(), distance=grenze)
            if ok and ob is not None and ob.name.split(".")[0] in ("klippe", "dorf", "meerwelt", "endwelt", "hoehle", "nether") or (ok and ob is not None and ob.name.startswith("objekt")):
                gesperrt += 1
    return gesperrt / (raster * raster)


def _messen(scene, cam, szene, figuren, mobs, gehalten, fehler):
    """Bildbericht mit Warnungen für die Selbstprüfung: Köpfe, Items, Mobs im Bild, keine verdeckten Gesichter."""
    info = {"kamera_abweichung": round(fehler, 4), "linse": cam.data.lens, "figuren": {}, "items": {}}
    bpy.context.view_layer.update()
    for f, fig in figuren:
        o, u = fig.kopf_punkte()
        ecken = [_bildpunkt(scene, cam, p) for p in fig.kopf_ecken()]
        koerper = [_bildpunkt(scene, cam, ob.matrix_world @ Vector(c)) for ob in fig.teile.values() for c in ob.bound_box]
        info["figuren"][f["id"]] = {"kopf": _bildpunkt(scene, cam, (o + u) / 2), "kopf_oben": _bildpunkt(scene, cam, o), "kopf_unten": _bildpunkt(scene, cam, u),
                                    "kopf_box": [min(e[0] for e in ecken), min(e[1] for e in ecken), max(e[0] for e in ecken), max(e[1] for e in ecken)],
                                    # ganze Figur (für den Textsatz: Text nie über dem Skin)
                                    "box": [min(e[0] for e in koerper), min(e[1] for e in koerper), max(e[0] for e in koerper), max(e[1] for e in koerper)]}
    info["mobs"] = []
    for m, mob in mobs:
        pts = [o.matrix_world @ Vector(c) for o in mob.teile.values() for c in o.bound_box]
        xs = [_bildpunkt(scene, cam, p) for p in pts]
        info["mobs"].append({"art": m["art"], "box": [min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs), max(p[1] for p in xs)]})
    for fid, ob in gehalten.items():
        pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
        xs = [_bildpunkt(scene, cam, p) for p in pts[:: max(1, len(pts) // 60)]]
        info["items"][fid] = {"box": [min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs), max(p[1] for p in xs)]}
    # Warnungen für die Selbstprüfung: Wichtiges muss im Bild sein
    warnungen = []
    for fid, f in info["figuren"].items():
        if fid == szene["figuren"][0]["id"] and (_im_bild(f["kopf_box"]) < 0.999 or min(f["kopf_box"][0], f["kopf_box"][1]) < 0.01 or max(f["kopf_box"][2], f["kopf_box"][3]) > 0.99):
            warnungen.append(f"Kopf von {fid} am Bildrand angeschnitten")
        elif _im_bild(f["kopf_box"]) < 0.6:
            warnungen.append(f"Kopf von {fid} kaum sichtbar")
        elif (szene.get("kamera", {}).get("modus") == "kampf" and fid != szene["figuren"][0]["id"]
              and f["kopf_box"][3] - f["kopf_box"][1] < 0.14):
            # Recherche: der Gegner füllt 45–70 % der Bildhöhe, sein Kopf also mindestens etwa 14 %
            warnungen.append(f"Gegner {fid} zu klein im Bild")
    for fid, it in info["items"].items():
        if _im_bild(it["box"]) < 0.9:
            warnungen.append(f"Item von {fid} kaum sichtbar ({int(_im_bild(it['box']) * 100)} % im Bild)")
    def ueberlappung(a, b):
        """Anteil von Box b, den Box a verdeckt."""
        w = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
        h = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
        return w * h / max(1e-6, (b[2] - b[0]) * (b[3] - b[1]))
    # Echte Sichtprüfung: Strahlen von der Kamera auf das Gesicht – verdeckt ein Arm, ein Schwert oder ein Mob?
    for i, (f, fig) in enumerate(figuren):
        anteil = _gesicht_sichtbar(scene, cam, fig)
        info["figuren"][f["id"]]["gesicht_sichtbar"] = round(anteil, 2)
        if anteil < (0.75 if i == 0 else 0.5):
            warnungen.append(f"Gesicht von {f['id']} verdeckt oder abgewandt ({int(anteil * 100)} % sichtbar)")
    # Versperrt etwas die Sicht? Strahlen durch ein Bildraster: trifft ein Strahl Welt oder Objekt deutlich vor der
    # Hauptfigur, steht es zwischen Kamera und Szene (z. B. ein Block direkt vor der Linse)
    verdeckt = _sicht_versperrt(scene, cam, figuren[0][1])
    info["sicht_versperrt"] = round(verdeckt, 2)
    if verdeckt > 0.12:
        warnungen.append(f"Etwas versperrt die Sicht ({int(verdeckt * 100)} % des Bildes liegen vor der Hauptfigur)")
    for m in info["mobs"]:
        b = m["box"]
        sichtbar = max(0.0, min(1, b[2]) - max(0, b[0])) * max(0.0, min(1, b[3]) - max(0, b[1]))
        # sichtbar = zur Hälfte im Bild, oder (Riesenmob, angeschnitten wie bei den Vorbildern) füllt mindestens 12 % des Bildes
        if _im_bild(b) < 0.5 and sichtbar < 0.12:
            warnungen.append(f"Mob {m['art']} kaum sichtbar")
    if fehler > 0.1:
        warnungen.append(f"Kamera trifft das Stilbuch nicht (Abweichung {fehler:.2f}) – Thema näher an die Figur legen")
    info["warnungen"] = warnungen
    return info


def baue(szene, texturen, ausgabe=None, bericht=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    r = szene.get("render", {})
    scene.render.resolution_x = r.get("breite", 1280)
    scene.render.resolution_y = r.get("hoehe", 720)

    _welt(szene.get("welt", {}), texturen, szene.get("himmel", "tag"))
    _objekte(szene.get("objekte"), texturen)
    mhimmel.baue(scene, szene.get("himmel", "tag"))

    figuren = []
    for f in szene["figuren"]:
        fig = mfigur.baue_figur(f["id"], f["skin"], slim=f.get("slim"))
        x, y = f.get("position", (0, 0))
        fig.wurzel.location = (x * BLOCK, y * BLOCK, 0)
        p = _mische(POSEN[f.get("pose", "neutral")], f.get("posen_korrektur"))
        blick = f.get("blick", p.get("blick", 0))
        # Blick nach −X (Gegner rechts, schaut zum Helden): Pose spiegeln, damit Brust, Kopf und Waffe zur Kamera zeigen
        if f.get("spiegeln", isinstance(blick, (int, float)) and blick < -30):
            p = _spiegeln(p)
        p["blick"] = 0 if blick == "auto" else blick
        mfigur.pose(fig, p)
        _auf_den_boden(scene, fig, f.get("hoehe"))
        figuren.append((f, fig))
    haupt = figuren[0][1]

    mobs = []
    if szene.get("mobs"):
        tab = mmobs.tabelle(szene.get("mob_tabelle"))
        for i, m in enumerate(szene["mobs"]):
            art = m["art"]
            if art not in tab:
                raise ValueError(f"Unbekannter Mob „{art}“ (bekannt: {', '.join(k for k in tab if not k.startswith('_'))})")
            mob = mmobs.baue_mob(art, tab[art], texturen, groesse=m.get("groesse", 1.0), pose=m.get("pose", "stand"), name=f"{art}{i}")
            x, y = m.get("position", (4, 2))
            z = m["hoehe"] * BLOCK if "hoehe" in m else _boden_hoehe(scene, x * BLOCK, y * BLOCK)
            mob.wurzel.location = (x * BLOCK, y * BLOCK, z)
            blick = m.get("blick", 0)
            if isinstance(blick, str):  # zu einer Figur schauen
                ziel = next((fig for f, fig in figuren if f["id"] == blick), haupt).kopf_mitte()
                d = ziel - mob.wurzel.location
                blick = math.degrees(math.atan2(d.x, -d.y))
            mob.wurzel.rotation_euler = (0, 0, math.radians(blick))
            mobs.append((m, mob))

    k = szene.get("kamera", {})
    _riesen_zurueck(haupt, mobs, k.get("thema"))
    cam_data = bpy.data.cameras.new("kamera")
    cam = bpy.data.objects.new("kamera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam_data.clip_end = 5000
    oben, unten = haupt.kopf_punkte()
    t = k.get("thema", (8, 6, 0))
    if isinstance(t, str) and (t.startswith("mob:") or any(m["art"] == t for m, _ in mobs)):
        # Thema ist ein Mob: Mitte seiner echten Ausdehnung (große oder schwebende Mobs wie Ghast, Riesenspinne)
        mob = mobs[int(t[4:])][1] if t.startswith("mob:") else next(mb for m, mb in mobs if m["art"] == t)
        punkte = [o.matrix_world @ Vector(c) for o in mob.teile.values() for c in o.bound_box]
        thema = sum(punkte, Vector()) / len(punkte)
    elif isinstance(t, str):  # Thema ist eine Figur (Gegner): ihr Kopf
        thema = next(fig for f, fig in figuren if f["id"] == t).kopf_mitte()
    else:
        thema = Vector([c * BLOCK for c in t])
    kante = szene.get("welt", {}).get("kante", 0)
    erlaubt = (lambda pos: pos.x > (kante + 2.5) * BLOCK) if k.get("ueber_abgrund") else None
    if k.get("modus") == "kampf":
        # Kampf: Kamera vor beiden Gegnern (Seite −Y), nie hinter einem von ihnen
        vorn = min(fig.kopf_mitte().y for f, fig in figuren) - 0.8
        links = haupt.kopf_mitte().x - 0.3  # nicht weit links: sonst verschwindet der Gegner hinter dem Helden
        erlaubt = lambda pos: pos.y < vorn and pos.x > links

    def rahmen(still=False):
        o, u = haupt.kopf_punkte()
        return mkamera.rahme(scene, cam, o, u, thema, k.get("modus", "nah"), seite=k.get("seite", "links"),
                             gesicht=haupt.gesicht_richtung(), erlaubt=erlaubt, kopf_ecken=haupt.kopf_ecken(), still=still,
                             anpassung={n: k[n] for n in ("hoehe", "linse", "kopf_anteil") if n in k})

    if szene["figuren"][0].get("blick") == "auto":
        # Wie ein Thumbnail-Künstler: die Figur so drehen, dass Gesicht (Dreiviertelprofil) und Thema zusammen passen
        versuche = []
        for grad in range(-45, 91, 15):
            haupt.wurzel.rotation_euler.z = math.radians(grad)
            versuche.append((rahmen(still=True), grad))
        beste_grad = min(versuche)[1]
        haupt.wurzel.rotation_euler.z = math.radians(beste_grad)
        print("MOIN_BLICK", beste_grad)
    fehler = rahmen()
    neigung = k.get("neigung", 8) if k.get("modus") == "kampf" else 0
    if any(f.get("item") for f in szene["figuren"]) or len(figuren) > 1:
        # Bildprüfung je Kamera-Vorschlag: der mit den wenigsten Warnungen gewinnt (Schwert im Bild, Gesichter frei)
        bewertet = []
        for kf, linse, matrix, az, el in list(mkamera.KANDIDATEN):
            cam_data.lens = linse
            cam.matrix_world = matrix @ mathutils_Matrix.Rotation(math.radians(neigung), 4, "Z")
            bpy.context.view_layer.update()
            probe = _items_anhaengen(figuren, texturen, cam, k)
            w = _messen(scene, cam, szene, figuren, mobs, probe, kf)["warnungen"]
            for ob in probe.values():
                bpy.data.objects.remove(ob, do_unlink=True)
            bewertet.append((len([x for x in w if not x.startswith("Kamera")]) + kf, kf, linse, matrix, az, w))
        if bewertet:
            _, fehler, linse, matrix, az, w = min(bewertet, key=lambda x: x[0])
            cam_data.lens = linse
            cam.matrix_world = matrix
            print("MOIN_KAMERA_WAHL azimut", az, "warnungen", len(w), "von", len(bewertet), "Vorschlägen")
    oben, unten = haupt.kopf_punkte()
    cam_data.dof.aperture_fstop = r.get("blende", 2.0)
    _pflanzen_vor_kamera_weg(cam, (oben + unten) / 2)
    _randlicht(scene, haupt, cam, k.get("seite", "links"), r.get("randlicht", 650),
               (0.3, 0.85, 1.0) if k.get("modus") == "kampf" and szene.get("himmel") in ("blutrot", "gewitter", "nacht")
               else mhimmel.VARIANTEN.get(szene.get("himmel", "tag"), {}).get("rand", (1.0, 1.0, 1.0)))
    variante = mhimmel.VARIANTEN.get(szene.get("himmel", "tag"), {})
    if k.get("modus") == "kampf":
        # Farbduell (GommeHD): Held mit kühlem, Gegner mit warmem Randlicht; bei Tag weißes Gegenlicht
        dunkel = szene.get("himmel") in ("blutrot", "gewitter", "nacht")
        for i, (f, fig) in enumerate(figuren[1:2]):
            farbe = (1.0, 0.22, 0.10) if dunkel else (1.0, 0.95, 0.9)
            _randlicht(scene, fig, cam, "rechts", r.get("randlicht", 650) * 0.8, farbe)
        # Kamera leicht kippen (Stilbuch-Recherche: 5–15° bei dynamischen Kampfbildern)
        cam.rotation_mode = "XYZ"
        cam.matrix_world = cam.matrix_world @ mathutils_Matrix.Rotation(math.radians(neigung), 4, "Z")
        bpy.context.view_layer.update()
    # Dunkle Himmel: das Thema-Mob (Drache, Enderman, Warden …) bekommt Fülllicht und eine helle Randkante,
    # sonst verschwindet es vor dem Hintergrund
    t_mob = k.get("thema")
    if variante.get("gesicht") and isinstance(t_mob, str) and (t_mob.startswith("mob:") or any(m["art"] == t_mob for m, _ in mobs)):
        mob = mobs[int(t_mob[4:])][1] if t_mob.startswith("mob:") else next(mb for m, mb in mobs if m["art"] == t_mob)
        punkte = [o.matrix_world @ Vector(c) for o in mob.teile.values() for c in o.bound_box]
        mitte = sum(punkte, Vector()) / len(punkte)
        groesse = max((p - mitte).length for p in punkte)
        for nr, (richtung, energie, farbe) in enumerate(((cam.matrix_world.translation - mitte, 150, (1.0, 1.0, 1.0)), (mitte - cam.matrix_world.translation, 3000, variante.get("rand", (1, 1, 1))))):
            l = bpy.data.lights.new(f"mob_licht{nr}", "AREA")
            l.energy = energie * max(1.0, groesse / 3) ** 2
            l.size = max(2.0, groesse)
            l.color = farbe
            lo = bpy.data.objects.new(l.name, l)
            scene.collection.objects.link(lo)
            lo.visible_camera = False
            d = richtung.normalized()
            lo.location = mitte + d * (groesse * 1.6) + Vector((0, 0, groesse * 0.6))
            lo.rotation_euler = (mitte - lo.location).to_track_quat("-Z", "Y").to_euler()
    staerke = r.get("gesichtslicht", variante.get("gesicht", 10.0))
    mlook.gesichtslicht(scene, cam, (oben + unten) / 2, staerke)
    for f, fig in figuren[1:]:  # Gegner und Freunde: eigenes, schwächeres Gesichtslicht
        if variante.get("gesicht"):
            mlook.gesichtslicht(scene, cam, fig.kopf_mitte(), staerke * 0.6)

    gehalten = _items_anhaengen(figuren, texturen, cam, k)

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    geraet = r.get("geraet", "CPU")  # aus dem Hardware-Test: OPTIX, CUDA, HIP, ONEAPI, METAL oder CPU
    if geraet != "CPU":
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = geraet
            prefs.refresh_devices() if hasattr(prefs, "refresh_devices") else prefs.get_devices()
            gefunden = False
            for d in prefs.devices:
                d.use = d.type == geraet
                gefunden = gefunden or d.use
            if gefunden:
                scene.cycles.device = "GPU"
        except (TypeError, KeyError, AttributeError):
            pass  # GPU in dieser Sitzung nicht verfügbar: CPU (funktioniert immer)
    scene.cycles.samples = r.get("samples", 48)
    scene.cycles.use_denoising = True
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = r.get("belichtung", -0.3)
    mlook.farbkorrektur(scene, r.get("saettigung", 1.08), r.get("kontrast", 1.06), r.get("vignette", 0.45))

    info = _messen(scene, cam, szene, figuren, mobs, gehalten, fehler)
    if ausgabe:
        scene.render.filepath = ausgabe
        bpy.ops.render.render(write_still=True)
    if bericht:
        with open(bericht, "w", encoding="utf-8") as fh:
            json.dump(info, fh, ensure_ascii=False, indent=1)
    return info
