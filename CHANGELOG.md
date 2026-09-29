# Changelog

Alle nennenswerten Änderungen an MoinStudio. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Neue Einträge kommen unter „Unreleased“. `node scripts/release.mts` macht daraus eine Version; die Zeile mit `>` ist die Kurzbeschreibung für die README.

## [Unreleased]

### Hinzugefügt
- Echte Mobs in Blender (ROADMAP 4.6): 31 Mobs mit Originalmodell (Mojangs bedrock-samples) und Originaltextur aus der Spieldatei – Zombie, Skelett, Creeper, Enderman, Warden, Ghast, Blaze, Hexe, Dorfbewohner, Golems, Tiere und mehr. Im Szenen-Bauer mit Position, Größe und Blick zu einer Figur; der Bericht nennt die Bildfläche jedes Mobs.
- Neue Welten Höhle und Nether (ROADMAP 4.3): geschlossene Räume aus echten Blöcken mit Erzen, Tiefenschiefer, Lava- oder Wasserbecken, Glowstone, Magma und Seelensand; warmes Beckenlicht und passender Dunst.
- Mobs stellen sich automatisch auf den Boden (auch in Höhlen, nicht aufs Dach).
- Selbstprüfung im Szenenbericht: Warnungen, wenn der Kopf am Rand angeschnitten ist, ein Item oder Mob kaum sichtbar ist oder die Kamera das Stilbuch verfehlt; die Kamera hält den ganzen Kopf im Bild.

### Geändert
- Look näher an den Vorbildern: Hintergrund unschärfer (Blende 2,0), weiche Randabdunklung (Blender 4 und 5) und Randlicht immer hinter der Figur aus Kamerasicht; Gras und Blumen direkt vor der Linse werden entfernt, Lampen sind für die Kamera unsichtbar.
- Pose „Schreck“: zurückweichen mit beiden Händen neben dem Kopf, damit Gesicht und Mobs frei bleiben; Wiese mit weniger dichtem Gras.

## [0.2.0] - 2026-09-29

> Vorbilder und Stilbuch aus über 290 Thumbnails großer Kanäle; Blender-Neubau mit echter Welt, Himmel, Posen und Schwert.

### Hinzugefügt
- Stilbuch aus 196 Thumbnails großer Minecraft-Kanäle (BastiGHG, GommeHD, Paluten, Castcrafter, Papaplatte): Posen mit Winkeln, Items, Kamera, Licht, Welt, Gesichter, Text, Abnahme-Checkliste (`docs/research/stilbuch.md`).
- Vergleichswerkzeug: unser Bild neben ein Vorbild-Thumbnail (`scripts/vergleich.mts`).
- Stilbuch Abschnitt 14: Reactions und Gaming nach BastiGHGs Zweitkanal und Zarbex (96 Thumbnails), immer mit echtem Skin.
- Blender-Neubau (Teil 1): Figur aus dem Skin mit zweiter Ebene und Gelenken, Posen aus dem Stilbuch, Blockwelt mit echten Texturen (Wiese, Klippe, Meer, Gras, Blumen, Bäume), Himmel mit Wolken, Entfernungsdunst, Kamera-Automatik nach Stilbuch, Items aus echter Textur (Schwert diagonal und flach zur Kamera), Szenen-Bauer aus einer JSON-Beschreibung, Farbkorrektur für Blender 4 und 5.

## [0.1.0] - 2026-09-28

> Neustart: das App-Fundament – Installer, Updates, Einrichtung, Hardware-Test, Aufgaben, Claude- und Blender-Anbindung.

### Hinzugefügt
- Electron-App mit den Reitern Thumbnail, Schnitt, Planung und Einstellungen (Thumbnail und Schnitt werden neu aufgebaut).
- Installer ohne Admin-Rechte mit Startmenü, Desktop-Verknüpfung und optionalem Autostart; Selbst-Update aus den GitHub-Releases.
- Einrichtungsassistent: Datenordner, Claude, Werkzeuge, Hardware, Adobe.
- Hardware-Test pro Gerät mit Blender-Messung und Rückfällen für Rechner ohne GPU.
- Werkzeuge (Blender, FFmpeg, Python/uv) lädt die App selbst, geprüft per SHA256.
- Aufgaben-Warteschlange mit Fortschritt, Pause, Abbruch und Fortsetzen nach Neustart.
- Claude über das eigene Abo (Claude Code headless, MCP-Server für Claude Desktop), nie mit API-Key.
- Frei wählbarer Datenordner (z. B. OneDrive) mit OneDrive-sicherem Speichern.
