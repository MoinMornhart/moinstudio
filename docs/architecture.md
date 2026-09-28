# Architektur

Stand: 2026-09-26. Grundlage: [research/tech.md](research/tech.md), [research/adobe.md](research/adobe.md), [claude-integration.md](claude-integration.md), [environment.md](environment.md).

## 1. Framework-Entscheidung: Electron

**Gewählt: Electron 44 + electron-vite 5 + electron-builder 26.x (NSIS, per-user) + electron-updater.**

| Kriterium | Electron | Tauri 2 |
|-----------|----------|---------|
| Build auf dem Entwicklungsrechner (keine Admin-Rechte, kein Rust, keine MSVC Build Tools, ~11 GB frei) | ✅ nur Node nötig | ❌ Rust-Toolchain + MSVC Build Tools (Admin-Installer, mehrere GB) |
| Installer ohne Admin | ✅ NSIS `perMachine:false` → `%LOCALAPPDATA%\Programs\MoinStudio` | ✅ NSIS currentUser |
| Auto-Update über GitHub-Releases | ✅ electron-updater, funktioniert auch **unsigniert** (SHA-512-Prüfung bleibt) | ⚠️ Updater-Plugin braucht eigenes Signatur-Schlüsselpaar (machbar, aber zusätzlicher Aufwand) |
| MCP-Server im selben Programm | ✅ `MoinStudio.exe` mit `ELECTRON_RUN_AS_NODE=1` startet `mcp.js`, das offizielle MCP-SDK ist Node/TS | ⚠️ separates Node- oder Rust-MCP-Binary nötig |
| Node-Ökosystem für Bild/Video (sharp, @napi-rs/canvas, FFmpeg-Steuerung, MCP-SDK) | ✅ direkt | ⚠️ über Sidecars |
| Installer-Größe / RAM | ❌ ~80–120 MB, mehr RAM | ✅ klein |

**Begründung:** Die Größe ist bei einer App für eine Person egal. Entscheidend sind drei Punkte. Erstens lässt sich Electron auf dem vorhandenen Rechner ohne Admin-Rechte bauen. Zweitens laufen MCP-Server, Job-Runner und UI in einer Sprache (TypeScript) und in einem Programm. Drittens funktioniert das Auto-Update über GitHub-Releases ohne Signatur-Infrastruktur.

**Risiken und wie wir damit umgehen:**
- *Unsignierte App:* SmartScreen warnt bei jeder neuen Version („Weitere Informationen → Trotzdem ausführen“). Steht **Smart App Control** auf „Ein“, blockiert Windows die App ganz. Der Einrichtungsassistent und die README weisen darauf hin, und es wird auf PC und Laptop geprüft.
- *electron-builder v28* wird unsignierte Updates voraussichtlich ablehnen, deshalb bleibt die Version auf `26.x` gepinnt.

## 2. Prozesse

```
MoinStudio.exe (Electron Main, TypeScript)
 ├─ Renderer (React + Vite): Reiter Thumbnail | Schnitt | Planung, Einrichtungsassistent
 ├─ Job-System (persistente Queue, eine GPU-/CPU-Last zur Zeit, Pause/Fortsetzen)
 │    ├─ blender.exe -b --python moin_scene.py -- <scene.json>   (unsichtbar, kein Fenster)
 │    ├─ ffmpeg.exe / ffprobe.exe                                  (Schnitt, Proxies, Analyse)
 │    ├─ Python-Worker (uv-verwaltet, JSON-Lines über stdio)       (Whisper, VAD, Pose, OCR, Freistellen)
 │    ├─ claude -p … --output-format stream-json                   (Abo-Login, ohne API-Key)
 │    └─ optional: ComfyUI / realesrgan-ncnn-vulkan                (nur mit GPU)
 ├─ IPC-Server: Named Pipe \\.\pipe\moinstudio-<user> (JSON-RPC + Zufallstoken)
 └─ electron-updater (GitHub Releases)

Claude Desktop ──stdio──> MoinStudio.exe (ELECTRON_RUN_AS_NODE=1) resources/mcp.js
                               ├─ Pipe → laufende App (Jobs starten, Fortschritt)
                               └─ Fallback: direkter Zugriff auf den Datenordner (Planung lesen/schreiben)
```

### KI-Anbindung (nur Abo, keine API)
Details und Belege stehen in [claude-integration.md](claude-integration.md). Verbindliche Regeln:
1. Jeder Aufruf der Claude-Code-CLI entfernt `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` und ähnliche Variablen aus der Umgebung des Kindprozesses. `--bare` ist verboten.
2. Vor jedem Job prüft die App `claude auth status`: Exit-Code 0 und `authMethod = claude.ai`.
3. Jeder Aufruf kostet schon etwa 31.000 Tokens Grundlast. Deshalb macht die App wenige, große Aufrufe: eine Session pro Thumbnail-Job, fortgesetzt per `--resume`, statt vieler Einzelaufrufe. Sie setzt `--strict-mcp-config` und eine schmale Werkzeugliste.
4. Wird ein Limit erreicht (`rate_limit_event` / `error: rate_limit`), speichert der Job seinen Stand als Checkpoint und startet nach dem Reset von selbst weiter. Es läuft immer nur ein Claude-Prozess gleichzeitig.
5. Jede Funktion ist zusätzlich als MCP-Tool für Claude Desktop verfügbar. Das ist der zweite Weg, falls sich die Abrechnung von `claude -p` ändert.

### Hardware-Anpassung
MoinStudio setzt keine bestimmte Hardware voraus. Beim ersten Start auf jedem Gerät erkennt ein Hardware-Test CPU, RAM, GPUs und verfügbare Beschleuniger und misst kurz Blender-Engines, Video-Encoder, Whisper und ONNX-Provider. Daraus entsteht ein Geräteprofil in `%APPDATA%\MoinStudio\device-profile.json`, das nicht synchronisiert wird. Jede Funktion hat eine Rückfall-Kette bis zu einem reinen CPU-Weg. Neu getestet wird, sobald sich Hardware, Treiber, App- oder Blender-Version ändern, oder per Knopf in den Einstellungen.

## 3. Thumbnail-Pipeline

Neustart am 28.09.2026: Die bisherige Pipeline wurde vollständig gelöscht und entsteht ab ROADMAP M3 neu, Maßstab sind die Thumbnails sehr großer Minecraft-Kanäle. Dieser Abschnitt wird mit dem Neuaufbau neu geschrieben.

## 4. Repo-Struktur

```
src/main/        App-Lebenszyklus, Updater, IPC-Pipe, Einstellungen, Einrichtungsassistent, Hardware-Test, Werkzeuge, Aufgaben, Claude-Anbindung
src/renderer/    React-Oberfläche (Reiter Thumbnail, Schnitt, Planung, Einstellungen)
src/preload/     Sichere Brücke zwischen App und Oberfläche
src/shared/      Gemeinsame Typen
src/mcp/         MCP-Server (stdio) + Pipe-Client
blender/         Blender-Messskript für den Hardware-Test (Szenenbau folgt neu, ROADMAP M4)
tests/           Automatische Tests
config/          channels.yaml
docs/            Architektur, Recherche, Testberichte
```

## 5. Speicherorte

| Ort | Inhalt |
|-----|--------|
| `%LOCALAPPDATA%\Programs\MoinStudio\` | App (Installer) |
| `%LOCALAPPDATA%\MoinStudio\` | `tools\` (Blender, FFmpeg, optional ComfyUI), `py\` (uv-Python + venv), `models\`, `cache\`, `logs\`, `jobs\` |
| `%APPDATA%\MoinStudio\settings.json` | Geräte-Einstellungen, Pfad zum Datenordner |
| **Datenordner** (frei wählbar, z. B. OneDrive) | `skins\` (Main.png, …), `friends\`, `props\` (gelernte Requisiten), `planning\cards\<id>.json`, `projects\<slug>\…`, `thumbnails\…` |

Im Datenordner liegen nur Dateien, die sich gut synchronisieren lassen: JSON pro Objekt und atomare Schreibvorgänge, keine SQLite-Datenbank. Konfliktkopien von OneDrive (`name-GERÄT.json`) erkennt die App. Große Rohvideos bleiben am Aufnahmeort, im Projekt stehen nur Pfad und Hash.

## 6. Adobe

Die gesamte Adobe-Steuerung liegt im Modul `adobe/` hinter einer Schnittstelle (`detect()`, `connect()`, `premiere.*`, `photoshop.*`, `aftereffects.*`). Es gibt einen Dry-Run, der nur protokolliert, welche Befehle gesendet würden. Ohne erkannte Installation sind die Schalter „Adobe verwenden“ deaktiviert. Zukunftssicher ist UXP für Premiere Pro und Photoshop, ExtendScript nur noch für After Effects. Belege und Versionen: [research/adobe.md](research/adobe.md).

- **Premiere:** Der Schnitt kommt als FCP7-XML (xmeml) mit Markern und Motion-Keyframes (Zooms). Dazu ein UXP-Plugin für Import, Marker, Export und Transkription. Das Plugin kann nur Client sein, deshalb fragt es per **HTTP-Polling** bei einem lokalen Server von MoinStudio auf 127.0.0.1 nach. Kein WebSocket, denn unter Windows ist ein Absturz von Premiere gemeldet.
- **Photoshop:** UXP-Plugin mit `batchPlay`; Fallback sind `.jsx`-Skripte.
- **After Effects:** ExtendScript über `AfterFX.exe -r` und `aerender`. Auf UXP wird umgestellt, sobald Adobe es anbietet.
