"""Spiele-Vorlage (Philip, 27.09.): die Person aus einem fremden Thumbnail entfernen und den Hintergrund auffüllen.

Läuft in der eigenen Python-Umgebung (uv, rembg + OpenCV, CPU):
    python freistellen.py <vorlage.jpg> <ausgabe-ordner> [x0,y0,x1,y1 …]
Weitere Rechtecke (Bildkoordinaten 0–1) werden mit entfernt, z. B. ein Gegenstand, den die Person hält.
Schreibt hintergrund.png (Person entfernt, Lücke aufgefüllt), maske.png und person.json mit der Lage der Person
(Bildkoordinaten 0–1, oben links = 0,0): box, kopf (geschätzte Kopfmitte), hoehe.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove


# LaMa (Apache-2.0, Carve/LaMa-ONNX): füllt die Lücke mit echtem Hintergrund statt Verschmieren; CPU reicht
LAMA = os.environ.get("MOIN_LAMA") or os.path.join(os.environ.get("LOCALAPPDATA", ""), "MoinStudio", "py", "modelle", "lama_fp32.onnx")


def lama(arr, maske, groesse=512):
    """Füllt `maske` (255 = Loch) in `arr` (BGR) mit LaMa; arbeitet auf 512×512 und setzt nur das Loch zurück ins Bild."""
    try:
        import onnxruntime as ort

        h, w = arr.shape[:2]
        sitzung = ort.InferenceSession(LAMA, providers=["CPUExecutionProvider"])
        bild = cv2.resize(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB), (groesse, groesse), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        m = (cv2.resize(maske, (groesse, groesse), interpolation=cv2.INTER_NEAREST) > 127).astype(np.float32)
        aus = sitzung.run(None, {"image": bild.transpose(2, 0, 1)[None], "mask": m[None, None]})[0][0].transpose(1, 2, 0)
        if aus.max() <= 1.5:
            aus = aus * 255
        aus = cv2.cvtColor(np.clip(aus, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        return cv2.resize(aus, (w, h), interpolation=cv2.INTER_CUBIC)
    except Exception as fehler:  # Modell kaputt oder zu wenig Speicher: Rückfall auf OpenCV
        print("MOIN_LAMA_FEHLER", fehler)
        return None


def main(vorlage, ordner, dazu=()):
    os.makedirs(ordner, exist_ok=True)
    bild = Image.open(vorlage).convert("RGB")
    w, h = bild.size
    maske = remove(bild, session=new_session("u2net_human_seg"), only_mask=True)
    m = (np.array(maske) > 110).astype(np.uint8) * 255
    # größte zusammenhängende Fläche = die Person (kleine Flecken weg)
    anzahl, beschriftung, werte, _ = cv2.connectedComponentsWithStats(m, 8)
    if anzahl > 1:
        groesste = 1 + int(np.argmax(werte[1:, cv2.CC_STAT_AREA]))
        m = np.where(beschriftung == groesste, 255, 0).astype(np.uint8)
    ys, xs = np.nonzero(m)
    if not len(xs):
        raise SystemExit("Keine Person gefunden")
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # Kopf: Gesichtserkennung (OpenCV), größtes Gesicht innerhalb der Person; sonst oberer Teil der Person
    gesichter = []
    if hasattr(cv2, "CascadeClassifier"):  # nicht jede OpenCV-Ausgabe bringt die Gesichtserkennung mit
        grau = cv2.cvtColor(np.array(bild), cv2.COLOR_RGB2GRAY)
        kaskade = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
        gesichter = [g for g in kaskade.detectMultiScale(grau, 1.1, 5, minSize=(h // 12, h // 12)) if m[g[1] + g[3] // 2, g[0] + g[2] // 2] > 0]
    if len(gesichter):
        gx, gy, gw, gh = max(gesichter, key=lambda g: g[2] * g[3])
        kopf = [float((gx + gw / 2) / w), float((gy + gh / 2) / h)]
        kopf_hoehe = float(gh * 1.5 / h)  # Kopf mit Haaren/Kappe etwas größer als das Gesicht
    else:
        kopf_bis = y0 + int((y1 - y0) * 0.3)
        kx = xs[ys < kopf_bis]
        kopf = [float((kx.min() + kx.max()) / 2 / w) if len(kx) else float((x0 + x1) / 2 / w), float((y0 + kopf_bis) / 2 / h)]
        kopf_hoehe = float((kopf_bis - y0) / h)
    # Maske großzügig erweitern (Haare, Ränder, Schatten), dann auffüllen
    groesser = cv2.dilate(m, np.ones((25, 25), np.uint8), iterations=2)
    for x_0, y_0, x_1, y_1 in dazu:
        groesser[int(y_0 * h):int(y_1 * h), int(x_0 * w):int(x_1 * w)] = 255
    arr = cv2.cvtColor(np.array(bild), cv2.COLOR_RGB2BGR)
    gefuellt = lama(arr, groesser) if os.path.exists(LAMA) else None
    if gefuellt is None:
        # Rückfall ohne Modell: OpenCV füllt weich (verwaschen, aber immer verfügbar)
        klein = cv2.resize(arr, (w // 2, h // 2))
        mk = cv2.resize(groesser, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
        gefuellt = cv2.inpaint(klein, mk, 21, cv2.INPAINT_TELEA)
        gefuellt = cv2.resize(gefuellt, (w, h))
        gefuellt = cv2.GaussianBlur(gefuellt, (0, 0), 3)
    rand = cv2.GaussianBlur(groesser.astype(np.float32) / 255, (0, 0), 6)[..., None]
    ergebnis = (arr * (1 - rand) + gefuellt * rand).astype(np.uint8)
    cv2.imwrite(os.path.join(ordner, "hintergrund.png"), ergebnis)
    cv2.imwrite(os.path.join(ordner, "maske.png"), groesser)
    info = {"box": [float(x0 / w), float(y0 / h), float(x1 / w), float(y1 / h)], "kopf": kopf, "kopf_hoehe": kopf_hoehe, "hoehe": float((y1 - y0) / h), "breite": w, "hoehe_px": h}
    with open(os.path.join(ordner, "person.json"), "w", encoding="utf-8") as fh:
        json.dump(info, fh, indent=1)
    print("MOIN_PERSON", json.dumps(info))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], [tuple(float(z) for z in a.split(",")) for a in sys.argv[3:]])
