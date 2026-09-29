# Changelog

Alle nennenswerten Änderungen an MoinStudio. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Neue Einträge kommen unter „Unreleased“. `node scripts/release.mts` macht daraus eine Version; die Zeile mit `>` ist die Kurzbeschreibung für die README.

## [Unreleased]

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
