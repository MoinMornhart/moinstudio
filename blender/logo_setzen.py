"""Einstieg für die App: blender -b --factory-startup --python blender/logo_setzen.py -- <bild.png> <logo.png> <x0,y0,x1,y1> <ausgabe.png>

Setzt ein Logo in die (von der App frei gewählte) Box des fertigen Thumbnails. Schreibt „MOIN_LOGO {…}“.
"""
import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

args = sys.argv[sys.argv.index("--") + 1:]
bild, logo_pfad, box, ausgabe = args[:4]
try:
    from moin import logo

    ergebnis = logo.setze_logo(bild, logo_pfad, [float(z) for z in box.split(",")], ausgabe)
    print("MOIN_LOGO", json.dumps(ergebnis, ensure_ascii=False))
except Exception as err:
    print("MOIN_FEHLER", err)
    traceback.print_exc()
    sys.exit(1)
