"""Text auf dem Thumbnail (ROADMAP 5.2) mit der echten Minecraft-Schrift aus der Spieldatei.

Stilbuch 10: 1–3 Wörter, Minecraft-Pixelschrift, weiß (Zahlen gelb/gold) mit hartem schwarzem Schatten nach unten rechts,
oben mittig oder in einer freien Ecke – nie über Gesicht, Figur, gehaltenem Item oder Mob. Die Lage wird automatisch
aus dem Szenenbericht gewählt; passt nichts, wird der Text kleiner. Reine Pixel-Arbeit mit numpy (kein Rendern).
"""
import json
import os

import bpy
import numpy as np

FARBEN = {
    "weiss": (1.0, 1.0, 1.0),
    "gelb": (1.0, 0.87, 0.2),
    "gold": (1.0, 0.67, 0.0),
    "gruen": (0.33, 1.0, 0.33),
    "tuerkis": (0.33, 1.0, 1.0),
    "rot": (1.0, 0.33, 0.33),
}

# Reihenfolge der Plätze (Stilbuch: oben mittig, sonst freie Ecke oben rechts/links, dann unten)
PLAETZE = ["oben_mitte", "oben_rechts", "oben_links", "unten_rechts", "unten_links", "unten_mitte"]


def _bild_array(pfad):
    img = bpy.data.images.load(pfad, check_existing=True)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    return np.flipud(a), img  # Zeile 0 = oben


class Schrift:
    """Bitmap-Schrift nach assets/minecraft/font/include/default.json (Provider „bitmap“)."""

    def __init__(self, assets):
        self.glyphen = {}
        self.hoehe = 8
        for datei in ("include/default.json", "default.json"):
            pfad = os.path.join(assets, "font", datei)
            if not os.path.exists(pfad):
                continue
            with open(pfad, encoding="utf-8") as fh:
                for p in json.load(fh).get("providers", []):
                    if p.get("type") == "bitmap":
                        self._lade(assets, p)

    def _lade(self, assets, p):
        ns, name = p["file"].split(":") if ":" in p["file"] else ("minecraft", p["file"])
        pfad = os.path.join(assets, "textures", name)
        if not os.path.exists(pfad):
            return
        a, _ = _bild_array(pfad)
        zeilen = p["chars"]
        zh = a.shape[0] // len(zeilen)
        zb = a.shape[1] // max(len(z) for z in zeilen)
        for r, zeile in enumerate(zeilen):
            for c, ch in enumerate(zeile):
                if ch in self.glyphen or ch == "\u0000":
                    continue
                zelle = a[r * zh:(r + 1) * zh, c * zb:(c + 1) * zb, 3] > 0.5
                spalten = np.where(zelle.any(axis=0))[0]
                breite = int(spalten.max()) + 1 if len(spalten) else 4
                # auf 8 px Höhe normieren (ascent 7), Glyphen größerer Seiten runterrechnen
                self.glyphen[ch] = (zelle[:, :breite], zh, p.get("ascent", 7), p.get("height", 8))

    def satz(self, text):
        """Maske (bool, Höhe 8·k) für eine Zeile; 1 px Abstand zwischen Zeichen wie im Spiel."""
        teile = []  # (Maske, Oberlänge)
        for ch in text:
            g = self.glyphen.get(ch) or self.glyphen.get(ch.upper()) or self.glyphen.get("?")
            if ch == " " or g is None:
                teile.append((np.zeros((8, 4), dtype=bool), 7))
                continue
            maske, zh, ascent, hoehe = g
            if zh > hoehe and zh % hoehe == 0:  # hochaufgelöste Seiten auf die Nennhöhe herunterrechnen
                f = zh // hoehe
                maske = maske[::f, ::f]
            teile.append((maske, ascent))
            teile.append((np.zeros((maske.shape[0], 1), dtype=bool), ascent))
        # an der Grundlinie ausrichten (wie im Spiel über „ascent“)
        oben = max(a for _, a in teile)
        unten = max(m.shape[0] - a for m, a in teile)
        zeile = [np.pad(m, ((oben - a, unten - (m.shape[0] - a)), (0, 0))) for m, a in teile]
        return np.concatenate(zeile, axis=1)


def _ueberlappung(a, b):
    w = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    h = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    return w * h


def _box_fuer(platz, bw, bh, rand=0.035):
    x = {"links": rand, "mitte": 0.5 - bw / 2, "rechts": 1 - rand - bw}[platz.split("_")[1]]
    y = rand if platz.startswith("oben") else 1 - rand - bh
    return [x, y, x + bw, y + bh]


def setze_text(bild_pfad, bericht, texte, assets, ausgabe):
    """`texte`: Liste von {"text": "ICH GEGEN SIMPELL", "farbe": "weiss", "platz": "auto"}. Schreibt das Bild mit Text
    und gibt die gewählten Boxen und Warnungen zurück."""
    a, img = _bild_array(bild_pfad)
    H, W = a.shape[:2]
    schrift = Schrift(assets)
    # Wichtiges: ganze Figuren, Items, Mobs (plus etwas Luft)
    wichtig = []
    for f in bericht.get("figuren", {}).values():
        wichtig.append(f.get("box", f.get("kopf_box")))
    wichtig += [i["box"] for i in bericht.get("items", {}).values()]
    wichtig += [m["box"] for m in bericht.get("mobs", [])]
    wichtig = [[b[0] - 0.01, b[1] - 0.01, b[2] + 0.01, b[3] + 0.01] for b in wichtig if b]
    ergebnis, warnungen, belegt = [], [], []
    for t in texte:
        zeilen = [z for z in t["text"].upper().split("\n") if z]
        masken = [schrift.satz(z) for z in zeilen]
        glyph_h = max(m.shape[0] for m in masken)
        breite_px = max(m.shape[1] for m in masken)
        wahl = None
        # Größe: Zeilenhöhe 16 % der Bildhöhe, bei Platzmangel schrittweise bis 7 %
        for anteil in (0.16, 0.14, 0.12, 0.10, 0.085, 0.07):
            k = max(1, int(round(anteil * H / glyph_h)))
            bw = (breite_px + 1) * k / W
            bh = (glyph_h * len(zeilen) + 1) * k * 1.15 / H
            if bw > 0.92:
                continue
            # Wunschplatz zuerst; ist er belegt, weicht der Text in einen anderen freien Platz aus
            plaetze = [t["platz"]] + [p for p in PLAETZE if p != t["platz"]] if t.get("platz", "auto") != "auto" else PLAETZE
            for p in plaetze:
                box = _box_fuer(p, bw, bh)
                stoert = sum(_ueberlappung(box, w) for w in wichtig + belegt)
                if stoert == 0:
                    wahl = (k, box, p)
                    break
            if wahl:
                break
        if not wahl:  # kein freier Platz: kleinste Größe, geringste Überdeckung, Warnung
            k = max(1, int(round(0.07 * H / glyph_h)))
            bw, bh = (breite_px + 1) * k / W, (glyph_h * len(zeilen) + 1) * k * 1.15 / H
            box, p = min(((_box_fuer(p, bw, bh), p) for p in PLAETZE), key=lambda bp: sum(_ueberlappung(bp[0], w) for w in wichtig))
            wahl = (k, box, p)
            warnungen.append(f"Text „{t['text']}“ findet keinen freien Platz und überdeckt Wichtiges")
        k, box, p = wahl
        belegt.append(box)
        farbe = np.array(FARBEN.get(t.get("farbe", "weiss"), FARBEN["weiss"]), dtype=np.float32)
        schatten = farbe * 0.25  # wie im Spiel: Schatten = Textfarbe auf ein Viertel
        y0 = int(box[1] * H)
        for zi, m in enumerate(masken):
            gross = np.kron(m, np.ones((k, k), dtype=bool))
            zx = int(box[0] * W + ((box[2] - box[0]) * W - gross.shape[1]) / 2)
            zy = y0 + int(zi * glyph_h * k * 1.15)
            for dx, dy, col in ((k, k, schatten), (0, 0, farbe)):
                ys, xs = np.nonzero(gross)
                ys, xs = ys + zy + dy, xs + zx + dx
                ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
                a[ys[ok], xs[ok], :3] = col
                a[ys[ok], xs[ok], 3] = 1.0
        ergebnis.append({"text": t["text"], "platz": p, "box": [round(v, 3) for v in box], "pixel": k})
    aus = bpy.data.images.new("mit_text", W, H, alpha=True)
    aus.pixels[:] = np.flipud(a).ravel()
    aus.filepath_raw = ausgabe
    aus.file_format = "PNG"
    aus.save()
    return {"texte": ergebnis, "warnungen": warnungen}
