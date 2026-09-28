"""Erzeugt build/icon.png (1024 px) im Yin-Yang-Blockstil des MoinStudio-Logos.
Aufruf: uv run --with pillow scripts/make-icon.py"""
from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
r = 160
# Farbverlauf-Rahmen (gelb → orange)
for i in range(S):
    t = i / (S - 1)
    c = (255, int(210 - 88 * t), int(63 - 37 * t), 255)
    d.line([(i, 0), (i, S)], fill=c)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], r, fill=255)
img.putalpha(mask)
d = ImageDraw.Draw(img)
m, W, B = 64, (244, 244, 244, 255), (17, 17, 17, 255)
inner = [m, m, S - m, S - m]
d.rounded_rectangle(inner, r - m, fill=W)
h = (S - 2 * m) // 2
q = h // 2
# Vier Viertel: oben links weiß, oben rechts schwarz, unten links schwarz, unten rechts weiß
tile = Image.new("RGBA", (S - 2 * m, S - 2 * m), W)
td = ImageDraw.Draw(tile)
td.rectangle([h, 0, 2 * h, h], fill=B)
td.rectangle([0, h, h, 2 * h], fill=B)
# Pixel-Punkte: in jedem Viertel mittig ein Block in der Gegenfarbe
dot = q // 2
for qx, qy, col in [(0, 0, B), (h, 0, W), (0, h, W), (h, h, B)]:
    x0, y0 = qx + q - dot // 2, qy + q - dot // 2
    td.rectangle([x0, y0, x0 + dot, y0 + dot], fill=col)
tmask = Image.new("L", tile.size, 0)
ImageDraw.Draw(tmask).rounded_rectangle([0, 0, tile.size[0] - 1, tile.size[1] - 1], r - m, fill=255)
img.paste(tile, (m, m), tmask)
img.save("build/icon.png")
img.resize((256, 256), Image.LANCZOS).save("build/icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("build/icon.png + build/icon.ico geschrieben")
