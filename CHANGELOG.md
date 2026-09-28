# Changelog

Alle nennenswerten Änderungen an MoinStudio. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Neue Einträge kommen unter „Unreleased“. `node scripts/release.mts` macht daraus eine Version; die Zeile mit `>` ist die Kurzbeschreibung für die README.

## [Unreleased]

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
