"""Handy-Vorschau eines Thumbnails: so groß, wie YouTube es in der Liste auf dem Handy zeigt (168×94 Punkte, auf
einem Retina-Display 336×188 Pixel). Claude prüft daran, ob man die Aussage in unter einer Sekunde erkennt.

python handy_vorschau.py <bild> <ausgabe.png>
"""
import sys

from PIL import Image


def main(bild, ausgabe):
    img = Image.open(bild).convert("RGB")
    img.resize((336, 188), Image.LANCZOS).save(ausgabe)
    print("MOIN_HANDY", ausgabe)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
