"""Spiele-Vorlage: den Titel der Vorlage (z. B. „007 FIRST LIGHT“) wieder über den fertigen Render legen.

    python vorlage_titel.py <vorlage.jpg> <render.png> <ausgabe.png> <x0,y0,x1,y1> [logo:x0,y0,x1,y1 …]

Im Titelbereich werden helle, fast farblose Pixel (weiße Schrift) übernommen, in den Logo-Bereichen zusätzlich helle
Gold- und Farbtöne, die sich deutlich vom dunklen Grund abheben. Weiche Kanten und ein leichter Schlagschatten wie im
Original, damit der Titel auf dem neuen Bild genauso lesbar bleibt.
"""
import sys

import cv2
import numpy as np


def maske(bild, box, logo=False):
    h, w = bild.shape[:2]
    x0, y0, x1, y1 = (int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))
    teil = bild[y0:y1, x0:x1].astype(np.float32)
    hell = teil.min(axis=2)
    bunt = teil.max(axis=2) - hell
    if logo:
        a = np.clip((teil.max(axis=2) - 120) / 60, 0, 1) * np.clip((bunt - 30) / 40 + (hell > 190), 0, 1)
    else:
        a = np.clip((hell - 175) / 50, 0, 1) * np.clip((70 - bunt) / 40, 0, 1)
        # nur Flächen in Buchstabenhöhe behalten (Lichtreflexe, Uhren, Knöpfe der alten Person fallen weg)
        anzahl, beschr, werte, _ = cv2.connectedComponentsWithStats((a > 0.3).astype(np.uint8), 8)
        klein = [i for i in range(1, anzahl) if werte[i, cv2.CC_STAT_HEIGHT] < 0.35 * (y1 - y0)]
        a[np.isin(cv2.dilate(beschr.astype(np.float32), np.ones((3, 3))).astype(np.int32), klein)] = 0
    m = np.zeros((h, w), np.float32)
    m[y0:y1, x0:x1] = a
    return m


def main(vorlage, render, ausgabe, boxen):
    o = cv2.imread(vorlage)
    r = cv2.imread(render)
    o = cv2.resize(o, (r.shape[1], r.shape[0]), interpolation=cv2.INTER_AREA)
    m = np.zeros(r.shape[:2], np.float32)
    for b in boxen:
        logo = b.startswith("logo:")
        m = np.maximum(m, maske(o, [float(z) for z in b.split(":")[-1].split(",")], logo))
    m = cv2.GaussianBlur(m, (0, 0), 0.6)
    schatten = cv2.GaussianBlur(np.roll(m, (3, 3), axis=(0, 1)), (0, 0), 3) * 0.6
    ergebnis = r.astype(np.float32) * (1 - schatten[..., None])
    ergebnis = ergebnis * (1 - m[..., None]) + o.astype(np.float32) * m[..., None]
    cv2.imwrite(ausgabe, np.clip(ergebnis, 0, 255).astype(np.uint8))
    print("MOIN_TITEL", ausgabe)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:])
