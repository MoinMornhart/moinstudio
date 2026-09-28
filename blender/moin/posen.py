"""Posen-Katalog aus dem Stilbuch (docs/research/stilbuch.md, Abschnitt 3.1). Winkel in Grad, Mitte der dort
genannten Bereiche. Die Nummer entspricht der Zeile im Stilbuch."""

POSEN = {
    # 1 Blick zum Ding (Nahaufnahme): Kopf 20–35° zum Objekt, 5–10° nach unten, Rumpf 30–45° gedreht
    "blick_zum_ding": {
        "koerper": {"drehen": 35},
        "kopf": {"drehen": 25, "nicken": 8, "neigen": 6},
        "arm_r": {"heben": 40, "seitlich": 8},
        "arm_l": {"heben": 8, "seitlich": 6},
    },
    # 2 Präsentator / Zeigen: Zeigearm 70–95° vor, 30–60° zur Bildmitte; anderer Arm hängt
    "zeigen": {
        "koerper": {"drehen": 30},
        "kopf": {"drehen": 22, "nicken": 4, "neigen": 8},
        "arm_l": {"heben": 85, "seitlich": 0, "drehen": 20},
        "arm_r": {"heben": 10, "seitlich": 10},
    },
    # 3 Schwert oder Axt zur Kamera: Schwertarm 40–80° vor und 20–40° nach innen, zweiter Arm 20–40° vor
    "schwert": {
        "koerper": {"drehen": 15},
        "kopf": {"drehen": 8, "nicken": 3, "neigen": 16},
        "arm_r": {"heben": 60, "seitlich": -5, "drehen": 25},
        "arm_l": {"heben": 30, "seitlich": 12},
    },
    # 7 Neutral frontal: Arme 10–25° seitlich, 10–20° nach vorn, Beine gerade
    "neutral": {
        "kopf": {"neigen": 3},
        "arm_r": {"heben": 14, "seitlich": 16},
        "arm_l": {"heben": 12, "seitlich": 14},
        "bein_r": {"seitlich": 3},
        "bein_l": {"seitlich": 3},
    },
    # 8 Heldenstand: Arme verschränkt (beide ~80° vor, 45° nach innen), Beine 5–10° gespreizt
    "held": {
        "kopf": {"nicken": -3, "neigen": 3},
        "arm_r": {"heben": 80, "seitlich": -45},
        "arm_l": {"heben": 76, "seitlich": -45},
        "bein_r": {"seitlich": 6},
        "bein_l": {"seitlich": 6},
    },
    # 14 Schreck: Hand vor dem Mund (Arm 110–130° hoch, nach innen)
    "schreck": {
        "kopf": {"nicken": 7},
        "arm_r": {"heben": 120, "seitlich": -38},
        "arm_l": {"heben": 12, "seitlich": 10},
    },
}
