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
        # Waffenhand auf der Themenseite (+X), damit die Klinge in die freie Bildhälfte zeigt
        "arm_l": {"heben": 62, "seitlich": 8, "drehen": 10},
        "arm_r": {"heben": 28, "seitlich": 14},
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
    # 20 (Variante stehend) Blick in den Abgrund: Kopf 30–40° nach unten, Rumpf leicht vorgebeugt, Arme zur Balance
    "blick_runter": {
        "koerper": {"drehen": 20, "vor": 12},
        "kopf": {"drehen": 12, "nicken": 36, "neigen": 6},
        "arm_r": {"heben": 22, "seitlich": 24},
        "arm_l": {"heben": 12, "seitlich": 30},
    },
    # 21 Fallen/Taumeln an der Kante: Körper 15–25° nach hinten gekippt, beide Arme 120–160° hoch und gespreizt,
    # ein Bein angehoben (große Geste nur hier erlaubt, Stilbuch 3.2)
    "taumeln": {
        "kippen": 20,
        "koerper": {"vor": -8, "neigen": 6},
        "kopf": {"nicken": -14, "neigen": -8},
        # Arme weit seitlich, damit das Gesicht frei bleibt (Abnahme-Checkliste)
        "arm_r": {"heben": 140, "seitlich": 72},
        "arm_l": {"heben": 115, "seitlich": 80},
        "bein_l": {"vor": 34},
        "bein_r": {"vor": -4},
    },
    # 14 Schreck: Hand vor dem Mund (Arm 110–130° hoch, nach innen)
    "schreck": {  # zurückweichen, beide Hände neben dem Kopf – das Gesicht bleibt frei
        "koerper": {"vor": -7},
        "kopf": {"nicken": 4},
        "arm_r": {"heben": 165, "seitlich": 22},
        "arm_l": {"heben": 165, "seitlich": 22},
        "bein_r": {"vor": -14},
        "bein_l": {"vor": 10},
    },
    # --- Kampf (GommeHD „Minecraft Helden“): Körper zum Gegner (+X), Kopf zur Kamera gedreht, weiter Ausfallschritt,
    # ungleiche Arme. Die Figur bekommt dafür blick ≈ 60–75 (zum Gegner); die Posen drehen Brust und Kopf zurück zur Kamera.
    # Sturmangriff: nach vorn geneigt, freier Arm greift zum Gegner, Schwertarm holt hinten tief aus
    "sturmangriff": {
        "kippen": -16,
        "koerper": {"vor": 20, "drehen": -28, "neigen": -8},
        "kopf": {"drehen": -38, "nicken": -4, "neigen": -10},
        "arm_l": {"heben": 100, "seitlich": 8, "drehen": 30},
        # Schwertarm tief nach vorn zum Gegner: die Klinge zeigt zur Bildmitte (Recherche: Waffen treffen sich in der Mitte)
        "arm_r": {"heben": 28, "seitlich": 30, "drehen": 30},
        "bein_r": {"vor": 38},
        "bein_l": {"vor": -46},
    },
    # Hieb von oben: Schwert hoch über dem Kopf, anderer Arm nach vorn, Ausfallschritt
    "hieb": {
        "kippen": -6,
        "koerper": {"vor": 10, "drehen": -24, "neigen": 8},
        "kopf": {"drehen": -12, "nicken": -6, "neigen": -6},
        # Schwertarm hoch und nach außen (zur Kamera-Seite), damit er nie vor dem Gesicht liegt
        "arm_r": {"heben": 172, "seitlich": 48, "drehen": -25},
        "arm_l": {"heben": 72, "seitlich": -6, "drehen": 20},
        "bein_r": {"vor": 30},
        "bein_l": {"vor": -34},
    },
    # Parieren / Gegenangriff: Schwert quer vor dem Körper zum Gegner, geduckt
    "parieren": {
        "kippen": -4,
        "koerper": {"vor": 14, "drehen": -12},
        "kopf": {"drehen": -18, "nicken": 4, "neigen": 6},
        "arm_r": {"heben": 84, "seitlich": -24, "drehen": -18},
        "arm_l": {"heben": 48, "seitlich": 16},
        "bein_r": {"vor": 26},
        "bein_l": {"vor": -30},
    },
    # Getroffen: nach hinten geworfen, Arme hoch, Beine vorn – mit Höhe (in der Luft) in der Szene
    "getroffen": {
        "kippen": 30,
        "koerper": {"vor": -10, "neigen": -8},
        "kopf": {"nicken": -18, "neigen": 10, "drehen": -20},
        "arm_l": {"heben": 128, "seitlich": 46},
        "arm_r": {"heben": 105, "seitlich": 58},
        "bein_r": {"vor": 38},
        "bein_l": {"vor": 12},
    },
    # Rennen / Fliehen: vorgeneigt, Arme und Beine gegengleich
    "rennen": {
        "kippen": -10,
        "koerper": {"vor": 12, "drehen": -16},
        "kopf": {"drehen": -34, "nicken": -4},
        "arm_l": {"heben": 72, "seitlich": 8},
        "arm_r": {"heben": -48, "seitlich": 10},
        "bein_r": {"vor": -40},
        "bein_l": {"vor": 42},
    },
}
