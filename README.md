<p align="center">
  <img src="docs/assets/banner.svg" alt="MoinStudio" width="100%">
</p>

<p align="center">
  <a href="https://github.com/MoinMornhart/moinstudio/releases"><img alt="Version" src="https://img.shields.io/github/v/tag/MoinMornhart/moinstudio?label=version&sort=semver&color=ffb000"></a>
  <a href="https://github.com/MoinMornhart/moinstudio/commits"><img alt="Letzter Commit" src="https://img.shields.io/github/last-commit/MoinMornhart/moinstudio?color=444"></a>
  <a href="LICENSE"><img alt="Lizenz" src="https://img.shields.io/github/license/MoinMornhart/moinstudio?color=444"></a>
  <img alt="Plattform" src="https://img.shields.io/badge/platform-Windows-0078d4">
  <img alt="Adobe" src="https://img.shields.io/badge/Adobe-ungetestet-lightgrey">
</p>

**MoinStudio** ist eine lokale Windows-Desktop-App für die YouTube-Kanäle **MoinMornhart** und **MoinMorni**. Sie erstellt Thumbnails mit dem eigenen Minecraft-Skin aus beliebigen Beschreibungen in normaler Sprache, schneidet Videos und plant Uploads. Die KI-Logik läuft ausschließlich über das eigene **Claude-Abo** (Claude Desktop per MCP und Claude Code per Abo-Login), ohne API-Key und ohne Cloud-Server.

> **Status – Neustart (28.09.2026):** Übrig ist nur das App-Fundament: Installer, Selbst-Update, Einrichtungsassistent, Hardware-Test, Aufgaben mit Pause, Claude-Anbindung über das Abo, MCP-Server und die Verbindung zu Blender. Thumbnail-Erstellung und Schnitt werden von Grund auf neu gebaut, Maßstab sind die Thumbnails sehr großer Minecraft-Kanäle. Fortschritt: [ROADMAP](ROADMAP.md).

<p align="center">
  <img src="docs/assets/screenshots/einrichtung.png" alt="Einrichtungsassistent" width="49%">
  <img src="docs/assets/screenshots/hardware-test.png" alt="Hardware-Test" width="49%">
</p>

## Was funktioniert

- **Installer ohne Admin-Rechte** mit Startmenü, Desktop-Verknüpfung und optionalem Autostart
- **Selbst-Update** aus den GitHub-Releases per Knopfdruck
- **Einrichtungsassistent** beim ersten Start: Datenordner, Claude, Werkzeuge, Hardware, Adobe
- **Hardware-Test pro Gerät:** misst Blender (Workbench/EEVEE/Cycles auf CPU und jeder GPU-Art), Video-Encoder und wählt automatisch die beste Einstellung, mit Rückfällen für Rechner ohne GPU oder mit älterer CPU
- **Werkzeuge** (Blender, FFmpeg, Python/uv) lädt die App selbst, geprüft per SHA256 und unsichtbar im Hintergrund
- **Aufgaben** mit Fortschritt, Pause (hält Blender/FFmpeg wirklich an), Abbruch und Fortsetzen nach Neustart; Knopf „Rechenlast pausieren“
- **Claude über dein Abo:** Claude Code headless mit Limit-Erkennung und automatischem Weitermachen nach dem Reset; MCP-Server für Claude Desktop
- **Datenordner** frei wählbar (z. B. OneDrive), OneDrive-sicheres Speichern, Konflikterkennung

## Die drei Reiter

| Reiter | Was er kann | Status |
|--------|-------------|--------|
| 🎨 **Thumbnail** | Beschreibung oder Video → Szene in Blender im Stil großer Minecraft-Kanäle → Varianten, jede mit ihrem Vorbild | Neuaufbau (ROADMAP M3–M5) |
| ✂️ **Schnitt** | Rohvideo rein, fertiges Video raus | Neuaufbau nach den Thumbnails |
| 🗂️ **Planung** | Board pro Kanal, Vorlagen je Videotyp, Kalender, Jobs direkt aus der Karte starten | geplant |

## Neueste Änderungen

<!-- CHANGELOG:START -->
- **0.20.0** (2026-09-29): Schnitt: Stream-Highlights und Shorts
- **0.19.0** (2026-09-29): Schnitt: Export für YouTube
- **0.18.0** (2026-09-29): Schnitt: Untertitel, Zooms, geschnittene Vorschau
- **0.17.0** (2026-09-29): Schnitt prüfen und ändern
- **0.16.0** (2026-09-29): Schnitt: automatischer Rohschnitt
<!-- CHANGELOG:END -->

## Installation

1. Den neuesten `MoinStudio-Setup-x.y.z.exe` unter [Releases](https://github.com/MoinMornhart/moinstudio/releases) herunterladen. Fertige Funktionen erscheinen dort automatisch als Release mit Installer, die App aktualisiert sich danach selbst (Einstellungen → „Nach Updates suchen“).
2. Starten. Es sind keine Admin-Rechte nötig, MoinStudio wird nur für deinen Windows-Benutzer installiert.
3. Da die App nicht signiert ist, warnt Windows SmartScreen beim ersten Start: **„Weitere Informationen“ → „Trotzdem ausführen“**. Ist *Smart App Control* auf „Ein“ gestellt, blockiert Windows unsignierte Apps vollständig. Das lässt sich unter *Windows-Sicherheit → App- & Browsersteuerung* prüfen.

## Claude einrichten (dein Abo, kein API-Key)

1. **Claude Code** installieren ([claude.com/claude-code](https://claude.com/claude-code)) und einmal im Terminal `claude auth login` mit deinem Claude-Konto (Pro oder Max) ausführen. Der Einrichtungsassistent hat dafür einen Knopf.
2. **Claude Desktop** (optional): Einstellungen → Claude → „Mit Claude Desktop verbinden“, danach Claude Desktop komplett neu starten. Im Chat stehen dann die MoinStudio-Werkzeuge zur Verfügung (Status, Aufgaben, Renders ansehen …).
3. In claude.ai → Einstellungen → Nutzung die **Usage Credits ausgeschaltet** lassen. Dann entstehen nie Kosten über das Abo hinaus.

MoinStudio entfernt API-Key-Variablen aus der Umgebung von Claude Code und nutzt ausschließlich den Abo-Login. Details: [docs/claude-integration.md](docs/claude-integration.md).

## Adobe-Anbindung

Alle Adobe-Funktionen (Premiere Pro, After Effects, Photoshop) sind **ungetestet**. Sie stützen sich nur auf Recherche ([docs/research/adobe.md](docs/research/adobe.md)), bis die automatische Testsuite `tests/adobe/` auf einem Rechner mit Adobe erfolgreich gelaufen ist. Ohne Adobe ist MoinStudio vollständig nutzbar.

## Ordnerstruktur

```
src/main/      Electron-Hauptprozess
src/preload/   Sichere Brücke zwischen App und Oberfläche
src/renderer/  Oberfläche (React)
src/shared/    Gemeinsame Typen
blender/       Blender-Messskript für den Hardware-Test (Szenenbau folgt neu)
config/        Editierbare Konfiguration (z. B. channels.yaml)
docs/          Architektur, Recherche, Tests, Umgebung
tests/         Automatische Tests
scripts/       Hilfsskripte für Entwicklung und Release
.githooks/     Git-Hooks (Secret-Scan vor jedem Push)
```

Private Daten wie Skins, Freundes-Skins, Rohvideos und Referenz-Thumbnails liegen **nie** im Repo. Sie gehören in einen frei wählbaren Datenordner, zum Beispiel in OneDrive.

## Entwicklung

```powershell
git clone https://github.com/MoinMornhart/moinstudio.git
cd moinstudio
git config core.hooksPath .githooks   # gitleaks-Scan vor jedem Push
npm install
npm run check        # Typprüfung, Lint, Tests, Build
npm start            # App starten
npm run screenshot   # Screenshots aller Reiter nach test-output/screenshots
```

## Lizenz

[MIT](LICENSE)
