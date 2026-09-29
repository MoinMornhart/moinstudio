# ROADMAP – MoinStudio

Die vollständige, abhakbare Masterliste. Es wird **immer nur ein Schritt** bearbeitet: umsetzen → testen → abhaken → Commit (Conventional Commits) → Tag → CHANGELOG → Push.

**Versionen:** Kleine Änderungen und Fixes erhöhen die letzte Stelle (0.1.3 → 0.1.4). Ist ein Meilenstein-Feature fertig, steigt die mittlere Stelle (0.2.0). Die erste stabile Version aller drei Reiter wird **1.0.0**. Ab 0.1.0 erscheint jede mittlere Version als GitHub-Release mit Installer.

**Legende pro Aufgabe:** 🎯 Ziel · 🛠️ Lösungsweg · 🧰 Tools · ⚠️ Risiken · ✅ Prüfmethode

**Grundlagen:** [Architektur](docs/architecture.md) · [Claude-Integration](docs/claude-integration.md) · [Adobe](docs/research/adobe.md) · [Technik](docs/research/tech.md) · [Umgebung](docs/environment.md)

**Neustart 28.09.2026 (Philip):** Alles außer der App selbst wurde gelöscht, auch die bisherige Versionsgeschichte (Neustart bei 0.1.0) (Thumbnail-Maschine, Blender-Szenenbau, Schnitt, Skins, Vorgaben, Recherchen, Tests). Übrig ist das App-Fundament (M0–M2) mit Claude- und Blender-Anbindung. Ab M3 wird alles neu gebaut, Maßstab sind die Thumbnails sehr großer Minecraft-Kanäle.

---

## Übersicht

| Meilenstein | Version | Inhalt | Status |
|---|---|---|---|
| M0 Setup | 0.0.1 | Repo, Umgebung, Secret-Scan | ✅ |
| M1 Recherche | 0.0.2–0.0.4 | Recherche, Architektur, ROADMAP | ✅ |
| M2 App-Fundament | 0.1.0 | Electron-App, Installer, Update, Datenordner, Einrichtungsassistent, Hardware-Test, Jobs, Claude-Anbindung, MCP | ✅ |
| M3 Vorbilder | → 0.2.0 | Thumbnails großer Minecraft-Kanäle sammeln, Stilbuch, Vergleichsgalerie | ⬜ |
| M4 Blender neu | → 0.3.0 | Figur, Posen, Welt, Grafik-Look, Kamera, Mobs/Items, Nachbau-Test | ⬜ |
| M5 Thumbnail neu | → 0.4.0 | Planung, Text, strenge Selbstprüfung, Reiter, Video-Upload mit Vorschlägen, Abnahme | ⬜ |
| M6 Schnitt | 0.14.0–0.21.0 | Import, Transkript, Rohschnitt, Untertitel, Export, Stream-Highlights | 🔄 (Abnahme offen) |
| M7 Planung | 0.22.0–0.25.0 | Board, Kalender, Verbindung zu Thumbnail und Schnitt, Ideen mit Claude | 🔄 (Abnahme offen) |
| M8 Adobe (ungetestet) | ab 0.26.0 | Erkennung, Premiere-Sequenz (FCP7-XML), Photoshop-Datei mit Ebenen, Testpaket | 🔄 |
| M9 Stabil | **1.0.0** | Politur, Release | ⬜ |

---

## M0 – Setup (Phase 0)

- [x] **0.1 Umgebung prüfen:** Windows, GPU, Python, Node, Rust, FFmpeg, git, gh, Claude Desktop, Claude-Code-Login, Adobe → [docs/environment.md](docs/environment.md)
- [x] **0.2 Lokales Repo:** `git init`, `.gitignore`, `.gitattributes`, README, erster Commit
- [x] **0.3 Öffentliches GitHub-Repo:** `MoinMornhart/moinstudio`, Tag `v0.0.1`
- [x] **0.4 Nichts Privates im Repo:** `.env.example`, gitleaks-`pre-push`-Hook, private Daten per `.gitignore` ausgeschlossen
- [x] **0.5 Kanal-Konfiguration:** [config/channels.yaml](config/channels.yaml)

## M1 – Recherche und Masterliste (Phase 1)

- [x] **1.1 Claude-Abo-Nutzung** (Claude Code headless und MCP ohne API-Key) → [docs/claude-integration.md](docs/claude-integration.md)
- [x] ~~**1.2 Thumbnail-Wissen**~~ – gelöscht beim Neustart, neu in M3
- [x] ~~**1.3 Musteranalyse**~~ – gelöscht beim Neustart, neu in M3
- [x] ~~**1.4 Posen-Steuerung**~~ – gelöscht beim Neustart, neu in M4
- [x] **1.5 Adobe-Automatisierung** → [docs/research/adobe.md](docs/research/adobe.md)
- [x] **1.6 Technik-Stack** (Framework, Segmentierung, Pose-Erkennung, Bildmodelle, Whisper, FFmpeg) → [docs/research/tech.md](docs/research/tech.md)
- [x] **1.7 Architektur und Framework-Wahl** → [docs/architecture.md](docs/architecture.md)
- [x] **1.8 ROADMAP** (diese Datei)

---

## M2 – App-Fundament → 0.1.0

### 2.1 Electron-Grundgerüst
- [x] 🎯 Startfähige Electron-App mit drei leeren Reitern (Thumbnail, Schnitt, Planung) und Einstellungsseite.
  - 🛠️ electron-vite (React + TypeScript), Main/Preload/Renderer getrennt, `contextIsolation`, typisierte IPC-Brücke; Linting, Formatierung und Vitest einrichten.
  - 🧰 Electron 44, electron-vite 5, React, Zod, Vitest, ESLint
  - ⚠️ Speicherplatz der VM (`node_modules`) → schlanke Abhängigkeiten
  - ✅ `npm run build` und `npm test` laufen grün, die App startet, Screenshot aller Reiter

### 2.2 Windows-Installer (per-user)
- [x] 🎯 `.exe`-Installer ohne Admin-Rechte mit Startmenü-Eintrag, Desktop-Verknüpfung und optionalem Autostart.
  - 🛠️ electron-builder 26.x (gepinnt), NSIS `oneClick:false`, `perMachine:false`, `allowToChangeInstallationDirectory`, `createDesktopShortcut`; Autostart per `app.setLoginItemSettings` als Schalter in den Einstellungen.
  - 🧰 electron-builder
  - ⚠️ Unsigniert: SmartScreen-Warnung, Smart App Control blockiert → im Assistenten und in der README erklären
  - ✅ Auf der VM installieren und deinstallieren, Verknüpfungen und Autostart-Eintrag prüfen, Screenshots

### 2.3 Release-Pipeline über GitHub Actions
- [x] 🎯 Ein Tag `vX.Y.0` baut den Installer auf `windows-latest` und veröffentlicht ihn als GitHub-Release inklusive `latest.yml`.
  - 🛠️ Workflow `release.yml`: `npm ci` → Test → `electron-builder --publish always`; `GITHUB_TOKEN` stammt aus Actions, kein Secret im Repo.
  - 🧰 GitHub Actions, electron-builder
  - ⚠️ Kostenlose Actions-Minuten für öffentliche Repos (unbegrenzt) – ok
  - ✅ Test-Release `v0.1.0-rc` erscheint mit `.exe`, `.blockmap`, `latest.yml`

### 2.4 Update-Funktion
- [x] 🎯 Die App prüft GitHub-Releases auf neue Versionen, zeigt „Update verfügbar“ und installiert es auf Knopfdruck.
  - 🛠️ electron-updater (`autoDownload:false`), Dialog mit Changelog-Auszug, `quitAndInstall`
  - ⚠️ Unsignierte Updates: kein `publisherName` setzen, SHA-512-Prüfung bleibt aktiv
  - ✅ v0.1.0 installieren, v0.1.1 veröffentlichen, in der App aktualisieren → Versionsanzeige stimmt

### 2.5 Datenordner und Einstellungen
- [x] 🎯 Frei wählbarer Datenordner (z. B. OneDrive) für Skins, Freunde, Requisiten, Planung und Projekte; gerätespezifische Einstellungen bleiben lokal.
  - 🛠️ `%APPDATA%\MoinStudio\settings.json` mit Pfad zum Datenordner; Ordner-Layout anlegen; atomare JSON-Writes (temporäre Datei + Umbenennen); OneDrive-Konfliktkopien erkennen und melden.
  - ⚠️ Gleichzeitige Nutzung auf PC und Laptop → Konfliktdialog statt stillem Überschreiben
  - ✅ Unit-Tests für atomare Writes und Konflikterkennung, Ordnerwechsel in der App

### 2.6 Werkzeug-Manager (Blender, FFmpeg, Python)
- [x] 🎯 Die App lädt benötigte Werkzeuge selbst: Blender portable von blender.org, FFmpeg, uv-Python. Keine Admin-Rechte, alles unsichtbar.
  - 🛠️ Download mit SHA256-Prüfung (`blender-X.Y.Z.sha256`), Entpacken nach `%LOCALAPPDATA%\MoinStudio\bl` (kurzer Pfad wegen MAX_PATH), `BLENDER_USER_RESOURCES` isolieren. Welche Blender-Version und welche Zusatzdateien (z. B. Mesa) installiert werden, entscheidet der Hardware-Test (2.7). Blender-Skripte bleiben mit 4.5 LTS und 5.2 LTS kompatibel.
  - 🧰 Node-Streams, `yauzl`/7-Zip-Alternative, uv
  - ⚠️ Speicherplatz; Blender-API-Unterschiede 4.5 ↔ 5.2
  - ✅ Frischer Download auf der VM mit Fortschrittsbalken, SHA256 geprüft, kein Blender-Fenster

### 2.7 Hardware-Test und Auto-Konfiguration beim ersten Start
- [x] 🎯 MoinStudio läuft auf **fast jedem Windows-Rechner**: von der schwachen CPU ohne GPU bis zum Gaming-PC. Beim **ersten Start auf jedem Gerät** läuft automatisch ein Test und stellt die beste Konfiguration ein, ohne dass Philip etwas wissen oder einstellen muss.
  - 🛠️ **1. Erkennen:** Windows-Version, CPU (Kerne, Befehlssätze wie AVX2 und RDTSCP), RAM, freier Speicher, alle GPUs mit Hersteller, VRAM (DXGI, `nvidia-smi`; nicht WMI `AdapterRAM`) und Treiber, Verfügbarkeit von CUDA/OptiX, HIP, oneAPI, Vulkan, DirectML und OpenGL, Akku- oder Netzbetrieb (Laptop).
  - 🛠️ **2. Kurz messen** (jeder Test mit Zeitlimit, ein Absturz zählt als „nicht verfügbar“, nie als App-Fehler):
    - Blender: Mini-Render mit Cycles GPU, Cycles CPU, EEVEE und Workbench, zuerst mit 5.2 LTS, bei Absturz mit 4.5 LTS; ohne OpenGL mit Mesa-Software-Rendering
    - FFmpeg: 3-Sekunden-Encode mit NVENC, AMF, QSV und x264
    - Whisper: vorerst Einstufung nach Hardware; Messung mit Mini-Clip beim ersten echten Einsatz (M7), damit der Test ohne Modell-Download unter 3 Minuten bleibt
    - ONNX (Freistellen, Pose): Messung beim ersten Einsatz (M6), vorerst Einstufung nach Hardware
    - Lokale Bildmodelle: Stufe nach VRAM (aus / klein / SDXL / FLUX)
  - 🛠️ **3. Festlegen:** Aus den Messwerten entsteht ein Geräteprofil `%APPDATA%\MoinStudio\device-profile.json`. Es gehört bewusst nicht in den synchronisierten Datenordner, weil PC und Laptop unterschiedlich sind. Darin stehen Blender-Version, Engine für Vorschau und Endbild, Samples, Vorschaugröße, Encoder, Whisper-Modell, Bildmodell-Stufe und Parallelität. Jede Funktion hat eine Rückfall-Kette bis zu einem reinen CPU-Weg, damit ohne GPU nichts wegfällt; es wird höchstens langsamer.
  - 🛠️ **4. Wiederholen:** Automatisch neu testen, wenn sich die Hardware, der Treiber, die App-Version oder die Blender-Version ändert (Fingerabdruck), plus Knopf „Hardware neu testen“ in den Einstellungen. Ergebnis als verständliche Übersicht („Rendern: GPU (NVIDIA RTX …), ca. 4 s pro Vorschau“), jede Wahl kann manuell überschrieben werden.
  - 🧰 Blender, FFmpeg, faster-whisper, onnxruntime, koffi/DXGI-Abfrage
  - ⚠️ Der Test darf nicht ewig dauern → Ziel unter 3 Minuten, Fortschrittsanzeige, lässt sich überspringen (dann sichere CPU-Standardwerte und späteres Nachholen); Treiberabstürze abfangen
  - ✅ Auf der VM entsteht ein CPU-Profil (Blender 4.5, Workbench/EEVEE über Mesa, x264, Whisper small int8). Unit-Tests mit simulierten Profilen für NVIDIA, AMD, Intel und „nur CPU“. Fingerabdruck-Änderung löst einen neuen Test aus. Auf PC und Laptop prüfen (10.2)

**Mindestanforderungen** (Ziel): Windows 10 22H2 oder 11, 64 Bit, 8 GB RAM, ca. 5 GB freier Speicher. GPU optional.

### 2.8 Job-System mit Pause
- [x] 🎯 Persistente Warteschlange für Render-, Schnitt- und KI-Jobs mit Fortschritt, Abbruch, Pause/Fortsetzen und Wiederaufnahme nach Neustart.
  - 🛠️ Jobs in Etappen mit Checkpoints (`jobs\<id>.json`); kooperative Pause zwischen Etappen, zusätzlich optional `NtSuspendProcess` über koffi; Prozesspriorität `BELOW_NORMAL`; globaler Knopf „GPU-Last pausieren“.
  - ⚠️ Blender und FFmpeg lassen sich nicht immer mitten im Frame pausieren → Etappen klein halten
  - ✅ Tests: Job pausieren, App beenden, neu starten → Job läuft am Checkpoint weiter

### 2.9 Claude-Code-Anbindung (Abo)
- [x] 🎯 Die App ruft die lokale Claude-Code-CLI headless mit Abo-Login auf; nie mit API-Key.
  - 🛠️ CLI finden (PATH, VS-Code-Erweiterung, `.local\bin`, npm global); `claude auth status` prüfen; Kind-Umgebung ohne `ANTHROPIC_API_KEY` und verwandte Variablen; nie `--bare`; `-p --output-format stream-json --strict-mcp-config --mcp-config … --allowedTools …`; Sessions per `--session-id`/`--resume`; Limit-Erkennung (`rate_limit_event`) → Checkpoint und automatische Fortsetzung nach dem Reset; nur ein Claude-Prozess gleichzeitig.
  - ⚠️ Ca. 31.000 Tokens Grundlast pro Aufruf → wenige, große Aufrufe; Abrechnungsänderungen bei `-p` → MCP-Weg als Alternative
  - ✅ Test mit gesetzter Dummy-Variable `ANTHROPIC_API_KEY` → wird entfernt; simulierter Limit-Event → Job pausiert und setzt fort

### 2.10 MCP-Server für Claude Desktop
- [x] 🎯 Alle Funktionen als MCP-Tools für die Claude-Desktop-App (Abo).
  - 🛠️ `@modelcontextprotocol/server` (stdio), gestartet als `MoinStudio.exe` mit `ELECTRON_RUN_AS_NODE=1 resources/mcp.js`; Named Pipe zur laufenden App; Installation per `.mcpb`-Erweiterung **und** automatischem Eintrag in `claude_desktop_config.json` (klassischer und MSIX-Pfad); Tools: `thumbnail_create`, `thumbnail_status`, `reference_analyze`, `video_edit`, `planning_read/write`, `adobe_*`.
  - ⚠️ MSIX-Pfad nicht offiziell dokumentiert; Bild-Rückgaben sind groß → verkleinerte Vorschau zurückgeben
  - ✅ Ende-zu-Ende mit Claude Code getestet (docs/tests/mcp.md). Weitere Werkzeuge (Thumbnail, Schnitt, Planung) kommen mit den jeweiligen Meilensteinen dazu.
  - [ ] Optional: zusätzlich als `.mcpb`-Erweiterung ausliefern (Installation per Doppelklick in Claude Desktop)

### 2.11 Einrichtungsassistent
- [x] 🎯 Beim ersten Start: Datenordner wählen; FFmpeg, Blender, GPU/Treiber, Claude Desktop und Claude Code (mit Abo-Login) prüfen und Fehlendes einrichten; Adobe erkennen (fehlt = Modus ohne Adobe, kein Fehler).
  - 🛠️ Prüfschritte mit Status, Knöpfe „Einrichten“; startet am Ende den Hardware-Test (2.7); Hinweis auf Smart App Control; Nachfrage vor jeder Installation mit Admin-Rechten.
  - ✅ Frisches Windows-Profil bzw. gelöschte Einstellungen → Assistent läuft komplett durch; Screenshots

### 2.12 Release-Werkzeuge
- [x] 🎯 Ein Befehl für Versionserhöhung, CHANGELOG-Eintrag, README-Abschnitt „Neueste Änderungen“ (letzte 5 Versionen, automatisch aus dem CHANGELOG), Tag und Push.
  - 🛠️ `scripts/release.mjs` (semver, Conventional Commits); gitleaks läuft vor dem Push.
  - ✅ Probelauf mit `--dry-run`

**→ 0.1.0 Release, sobald 2.1–2.12 erledigt sind.**

---

## M3 – Vorbilder: Thumbnails der großen Minecraft-Kanäle → 0.2.0

Neustart (Philip, 28.09.2026): Alles Bisherige zur Thumbnail-Erstellung ist gelöscht. Maßstab sind ausschließlich die Thumbnails sehr großer Minecraft-Kanäle. Beispielbilder liegen nur lokal (`%LOCALAPPDATA%\MoinStudio\stil-referenzen\`), nie im Repo.

- [x] **3.1 Referenzsammlung:** Minecraft-Thumbnails laden und einzeln ansehen. Schwerpunkt (Philip, 28.09.): BastiGHG, GommeHD und Paluten mit je mindestens 45 Thumbnails; dazu Castcrafter, Papaplatte, TheJoCraft und Rewinside mit je mindestens 25. Stegi ist raus (überwiegend Collagen mit Facecam und Comicfigur). ✅ Je Kanal eine Analyse mit Häufigkeiten (Posen, Kamera, Licht, Welt, Aufbau, Text, Gesichter)
- [x] **3.1b Reaction- und Gaming-Vorbilder** (Philip, 28.09.): Für Reactions und Nicht-Minecraft-Gaming (MoinMorni) Zweit- und Drittkanal von BastiGHG sowie Zarbex und Co. auswerten. Immer Philips echter Minecraft-Skin in Pose und Gestik, nie gezeichnete Figuren; Server-Thumbnails folgen den Minecraft-Hauptkanälen. ✅ Analyse mit Gesten-Katalog je Emotion → erledigt: 96 Thumbnails (Bastian, BastiGHG Bonus, Mr. Geil, zarbexLIVE), Regeln im Stilbuch Abschnitt 14
- [x] **3.2 Stilbuch:** Aus den Analysen ein Regelwerk mit Zahlen (Posenwinkel, Brennweiten, Lichtaufbau, Farblook, Weltdetails, Textregeln). Jede Regel verweist auf konkrete Vorbild-Thumbnails. ✅ `docs/research/stilbuch.md`, jede Regel mit Beleg
- [x] **3.3 Vergleichsgalerie:** Die besten 20–30 Vorbilder als fester Qualitätsmaßstab; Vergleich „unser Bild neben Vorbild“ als Werkzeug. ✅ Galerie lokal, Vergleichsbild entsteht per Befehl → erledigt: 32 Vorbilder (BastiGHG, GommeHD, Paluten, Castcrafter) auf der Werkstatt-Seite, `node scripts/vergleich.mts <unser-bild> <kanal>/<nummer-oder-id>` legt unser Bild neben das Vorbild

## M4 – Blender von Grund auf neu → 0.3.0

- [x] **4.1 Figur aus dem Skin:** Classic und Slim, zweite Skin-Ebene plastisch, pixelscharf, Gesicht bleibt der echte Skin. ✅ Render neben Vorbild-Figur — erledigt: Classic/Slim, zweite Ebene, Fase, dazu Ellbogen und Knie mit weicher Biegung.
- [x] **4.2 Posen wie bei den Vorbildern:** Posen-Bibliothek aus dem Stilbuch (Präsentieren, Zeigen, Item halten, Kampfbereit, Über die Schulter, Liegen, Fallen …), Kopf- und Körperdrehung, keine zappelnden Glieder. ✅ Jede Pose neben ihrem Vorbild — erledigt: 18 Posen inkl. 10 Kampfposen aus 72 Action-Vorbildern, Spiegelung für Gegner, Beugung.
- [x] **4.3 Welt-Baukasten:** Echte Minecraft-Texturen, Gelände, Klippen und Abgründe mit sichtbarer Tiefe, Meer, Höhlen, Nether, End, Dörfer und Bauwerke, Weitblick mit Dunst. ✅ 10 Umgebungen neben Vorbildern — erledigt: Wiese, Klippe/Schlucht, Meeresklippe, Meer, Lavameer, Höhle, Nether, Dorf, frei gesetzte und weggegrabene Blöcke, fliegende Blöcke. Offen: End.
- [x] **4.4 Grafik-Look wie die Vorbilder:** Licht, Schatten, Ambient Occlusion, Himmel und Wolken, Tiefenunschärfe, Farbkorrektur. ✅ Seite-an-Seite-Vergleich, Philips Abnahme — erledigt: Tiefenunschärfe, Randabdunklung, Randlicht nach Kamera, Farbduell, Kampf-Himmel (blutrot, gewitter). Philips Abnahme läuft über die Werkstatt-Seite.
- [x] **4.5 Kamera:** Nahaufnahme mit Weitwinkel, Totale, Untersicht, Kippung – wie im Stilbuch. ✅ Vergleich mit Vorbildern — erledigt: Modi nah, gefahr, tiefe, klippe, abgrund, held, brust, kampf; gekippte Kamera; bis zu 6 Vorschläge mit Bildprüfung (Kopf, Items, Gegnergröße, Gesichter per Strahl).
- [x] **4.6 Mobs und Items:** Echte Modelle und Texturen aus den Spieldateien; Waffen und Werkzeuge gut sichtbar in der Hand wie bei den Vorbildern. ✅ Nahaufnahme je Item-Art — erledigt: 31 Mobs aus Originalmodell und -textur, Items aus echter Textur, übergroße Waffen im Kampf, Item folgt dem gebeugten Arm.
- [x] **4.7 Nachbau-Test:** 10 Vorbild-Thumbnails möglichst nah nachbauen (eigener Skin, eigene Texte) und neben das Original legen. ✅ Philip beurteilt die Paare — erledigt: 10 Nachbauten, siehe docs/tests/nachbau-test.md.

## M5 – Thumbnail-Erstellung neu → 0.4.0

- [x] **5.1 Planung durch Claude:** Beschreibung → Szene nach dem Stilbuch, mit Angabe des Vorbild-Thumbnails, an dem sich jede Variante orientiert. ✅ 20 Beschreibungen, jede Variante nennt ihr Vorbild — erledigt: 20 Beschreibungen, alle 60 Varianten gültig, jede nennt ihr Vorbild (docs/tests/planung.md).
- [x] **5.2 Text, Pfeile, Rahmen:** Nur was die Vorbilder machen, Text nie über Figur oder Wichtigem. ✅ Automatische Prüfung — erledigt: echte Minecraft-Schrift, Platz automatisch frei von Figur, Item und Mob, sonst kleiner plus Warnung.
- [x] **5.3 Strenge Selbstprüfung:** Jedes Bild wird neben sein Vorbild gelegt und kritisch bewertet (fehlende Umgebung, schwebende Figuren, falsche Skins, schlechte Posen) und bei Fehlern neu gebaut. ✅ Absichtlich fehlerhafte Bilder werden erkannt — erledigt: Bildprüfung (Gesicht per Strahl, Sicht versperrt, Gegner zu klein, Item, Kamera) → Claude korrigiert bis zu zweimal; in der App bewiesen (vorher/nachher auf der Werkstatt-Seite).
- [x] **5.4 Reiter Thumbnail:** Beschreibung, Skins und Freunde, Varianten groß ansehen und ändern, Speichern. ✅ Screenshot — erledigt: Reiter mit Beschreibung, Kanal, Freunden, Varianten, Skin-Bibliothek, Großansicht und Speichern.
- [x] **5.5 Video hochladen → Thumbnail-Vorschläge** (Philip, 28.09.): Video in den Reiter ziehen, die KI analysiert Inhalt, Höhepunkte und Stimmung und schlägt passende Thumbnails vor. ✅ 5 Testvideos, Vorschläge passen zum Inhalt — erledigt: 3 Testvideos richtig erkannt (docs/tests/video-vorschlaege.md); 5 echte Videos von Philip folgen in 5.6.
- [ ] **5.6 Abnahme:** 30 echte Aufträge von Philips Kanälen, jeweils neben Vorbild; Philip gibt frei. ✅ Freigabe

## M6 – Schnitt (Neuaufbau)

Ziel (Philip): **Rohvideo rein, fertiges Video raus** – ohne dass er dabei sein muss. Maßstab sind seine echten Inhalte:
Minecraft-Videos für MoinMornhart (Let's Plays, Challenges, Kämpfe) und Stream-Highlights und Reactions für MoinMorni.
Alles läuft lokal und kostenlos (FFmpeg, faster-whisper, Claude über das Abo), auf jeder Hardware mit CPU-Rückfall.
Rohvideos bleiben, wo sie liegen; im Projekt stehen nur Pfad, Größe und Prüfsumme. Grundlage: [Technik §8–9](docs/research/tech.md).

- [x] **6.1 Neu planen.** ✅ Plan steht hier (29.09.2026, selbst geplant nach Philips Vorgabe „alles ohne mich“).
- [x] **6.2 Projekt und Import:** Schnitt-Reiter mit Projektliste; Rohvideo wählen → ffprobe-Daten, Vorschau-Proxy (540p), Wellenform, Standbild-Leiste; Player im Reiter. 🧰 FFmpeg · ✅ die 3 Testvideos laden, Proxy und Wellenform stimmen mit der Länge überein — erledigt: Import mit Videodaten, Prüfsumme, 540p-Vorschau, Wellenform und Standbild-Leiste, Player im Reiter über das Medien-Protokoll mit Springen; getestet mit 4 Videos (eins mit Sprache).
- [x] **6.3 Transkript lokal:** faster-whisper im eigenen Python-Umfeld (uv), Modell nach Hardware-Profil, beim ersten Einsatz gemessen; Wortzeiten; pausierbar pro Abschnitt. ✅ deutsches Testvideo richtig transkribiert, Zeiten ±0,3 s — erledigt: faster-whisper (Modell nach Profil, Messung beim ersten Einsatz: small auf der VM 0,37× Echtzeit), Ton in 10-Minuten-Stücken über FFmpeg, fortsetzbar, Minecraft-Begriffe als bevorzugte Wörter, „ähm“ und Wiederholungen bleiben erhalten; startet nach dem Import von selbst.
- [x] **6.4 Automatischer Rohschnitt:** Stille und lange Pausen raus (Lautstärke + Wortlücken), Versprecher, Wiederholungen und Leerlauf erkennt Claude im Transkript; Ergebnis ist eine Schnittliste (EDL-JSON), nie das Original verändert. ✅ Testvideos werden kürzer, kein Satz wird mitten im Wort geschnitten — erledigt: Testvideo 53,5 s → 30,1 s; Pausen (nur wo das Spiel leise ist), „ähm“ und der abgebrochene Satz vor seiner Wiederholung werden gefunden, Claude prüft zusätzlich auf Versprecher und Leerlauf; Reaktionen bleiben; startet nach dem Transkript von selbst.
- [x] **6.5 Schnitt prüfen und ändern:** Segmentliste mit Vorschau, Segmente an/aus, Ränder verschieben; Änderungswunsch in Worten wie bei Thumbnails („lass die Stelle mit dem Creeper drin“). ✅ Änderung per Text landet richtig in der Schnittliste — erledigt: jede Schnittstelle an/aus, jeder Satz raus/zurück, Wunsch in Worten über Claude („Lass das ähm drin, und schneide den Satz Puh, das war knapp raus“ → genau so umgesetzt); ausgeschaltete Stellen bleiben sichtbar.
- [x] **6.6 Untertitel und Zooms:** Untertitel aus dem Transkript (ASS, gut lesbar, optional Minecraft-Schrift), sparsame Zooms auf Höhepunkte – keine KI-Effekte. ✅ Untertitel synchron, Zoom ruckelt nicht — erledigt: Untertitel aus den Wortzeiten in Schnittzeit (klar oder Wort für Wort), sanfte Zooms (112 %, 0,35 s Übergang) zuerst auf Ausrufe, höchstens alle 20 s; geschnittene Vorschau in einem FFmpeg-Durchgang (Filtergraph als Datei, auch für Stunden-Streams).
- [x] **6.7 Export für YouTube:** Rendern mit dem Encoder aus dem Hardware-Profil nach YouTube-Vorgaben, Kapitel, Titel- und Beschreibungsvorschlag; Prüfung der Datei; Übergabe ans Thumbnail (Video-Vorschläge aus demselben Projekt). ✅ Export besteht die YouTube-Prüfung (Codec, Farbraum, Ton, Kapitel) — erledigt: Export aus dem Original mit Encoder aus dem Hardware-Profil nach YouTube-Empfehlung, alle 7 Prüfpunkte grün im Testvideo; Kapitel (repariert auf YouTube-Regeln), Titel und Beschreibung von Claude; Speichern unter; Thumbnail-Vorschläge aus dem fertigen Video.
- [x] **6.8 Stream-Highlights und Shorts (MoinMorni):** Lange Streams → Höhepunkte (Lautstärkespitzen, Lachen, Transkript/Claude) → einzelne Clips und 9:16-Shorts mit Facecam-Layout. ✅ In einem langen Test-Stream werden die markierten Höhepunkte gefunden — erledigt: Test-Stream (98 s, Facecam, Explosion) → genau die beiden eingebauten Höhepunkte gefunden (Creeper-Panik 9/10, Diamanten 8/10), Facecam automatisch erkannt, Short 1080×1920 mit Facecam oben, Gameplay unten und Untertiteln Wort für Wort; gekürzte Pausen gelten auch in Clips.
- [ ] **6.9 MCP und Abnahme:** ✓ MCP-Werkzeug `video_edit` für Claude Desktop (Projekte, Import, Schnitt ansehen, Änderung in Worten, Vorschau, Export, Highlights, Clips); offen: Abnahme mit Philips echten Videos. ✅ Freigabe.

## M7 – Planung

Ziel: Philip sieht auf einen Blick, **welches Video wo steht** (Idee → Aufnahme → Schnitt → Thumbnail → Upload → veröffentlicht)
und **wann was hochgeladen wird**, getrennt für MoinMornhart und MoinMorni. Die Planung ist mit den anderen Reitern verbunden:
Aus einer Karte entsteht mit einem Klick das Thumbnail oder das Schnitt-Projekt, und fertige Schritte schieben die Karte selbst weiter.
Alles liegt im Datenordner (PC und Laptop teilen ihn über iCloud/OneDrive), eine Datei pro Karte, keine Cloud-Dienste und kein YouTube-Login.
Grundlage: [Technik §10](docs/research/tech.md).

- [x] **7.1 Neu planen.** ✅ Plan steht hier (29.09.2026, selbst geplant nach Philips Vorgabe „alles ohne mich“).
- [x] **7.2 Karten-Speicher:** eine JSON-Datei pro Karte in `planning/cards` (Titel, Kanal, Spalte, Reihenfolge als Bruchzahl, Termin, Notizen, Checkliste, Verknüpfungen zu Thumbnail/Schnitt, `rev`, `updatedAt`, `updatedBy`); atomar schreiben; Konfliktkopien (OneDrive „-GERÄT“, iCloud „ 2“) erkennen und zusammenführen (neueste Änderung je Feld); Ordner beobachten, damit Änderungen vom anderen Gerät sofort erscheinen. ✅ Unit-Tests für Speichern, Reihenfolge und Zusammenführen von Konflikten — erledigt: 8 Tests (Anlegen, Ändern, Verschieben, Neu-Durchzählen, Konfliktkopien von OneDrive und iCloud Feld für Feld zusammengeführt und aufgeräumt, defekte Kopien bleiben liegen, Ordner-Beobachtung).
- [x] **7.3 Board:** Reiter „Planung“ mit Board je Kanal (Spalten Idee, Aufnahme, Schnitt, Thumbnail, Upload, Veröffentlicht); Karten anlegen, ziehen (auch zwischen Spalten), bearbeiten, löschen; Kartendetails mit Notizen, Checkliste und Termin. ✅ Karten per Ziehen verschieben, nach Neustart ist alles gleich; Aufnahme des Reiters — erledigt: Board je Kanal mit Zähler, Ziehen mit Einfügemarke, Kartendetails (Titel, Kanal, Stand, Termin, Notizen, Checkliste, Löschen mit Rückfrage), Termine überfällig rot; in der App geprüft (Anlegen, Ziehen, Abhaken, Kanalwechsel, Dateien danach richtig). Dabei gefunden und behoben: eine Änderung hat Notizen und Termin gelöscht.
- [x] **7.4 Kalender:** Monats- und Wochenansicht der Upload-Termine beider Kanäle; Termin per Ziehen verschieben; Upload-Rhythmus je Kanal (z. B. Mi und Sa 17 Uhr) mit Hinweis auf Lücken; Karten ohne Termin am Rand zum Einplanen. ✅ Termine erscheinen an den richtigen Tagen, Lücken im Rhythmus werden angezeigt — erledigt: Monat und Woche, beide Kanäle farbig und einzeln ausblendbar, Ziehen auf einen Tag (Uhrzeit bleibt, sonst Rhythmus-Zeit), Karten ohne Termin am Rand, Rhythmus je Kanal mit freien Terminen im Kalender und Zählung für 4 Wochen; 5 Tests (auch Zeitumstellung), in der App geprüft.
- [x] **7.5 Verbindung zu Thumbnail und Schnitt:** Aus einer Karte „Thumbnail erstellen“ (Titel und Idee als Beschreibung) und „Rohvideo schneiden“; Karte zeigt Thumbnail-Bild und Schnitt-Stand; Karte rückt selbst weiter (Schnitt exportiert → Thumbnail, Thumbnail gewählt → Upload); Titel, Beschreibung und Kapitel aus dem Export landen in der Karte. ✅ Durchlauf Karte → Schnitt → Thumbnail → Upload mit einem Testvideo. — erledigt: Karte startet Schnitt (Rohvideo wählen oder vorhandenes Projekt verbinden) und Thumbnail (Titel und Notizen als Beschreibung), Variante in der Karte wählen, Vorschaubild auf der Kachel auf jedem Gerät; Karte rückt nach Import, Export und Thumbnail-Wahl selbst weiter; YouTube-Titel, Beschreibung und Kapitel zum Kopieren; Sprung ins Schnitt-Projekt. Durchlauf mit Testvideo bestanden ([Bericht](docs/tests/planung-reiter.md)).
- [x] **7.6 Ideen und Titel mit Claude:** Ideenfinder je Kanal (aus bisherigen Karten, Serien und dem Stil großer Minecraft-Kanäle), Titelvorschläge für eine Karte, Wochenplan-Vorschlag („was nehme ich diese Woche auf“); über das Claude-Abo. ✅ 10 Ideen je Kanal, jede passt zum Kanal und ist keine Wiederholung. — erledigt: je Kanal 10 passende Ideen ohne Wiederholung (MoinMorni erst nach Korrektur der Kanalregeln), Titel in 14 s, Wochenplan nur auf freie Termine des richtigen Kanals ([Bericht](docs/tests/planung-reiter.md)).
- [ ] **7.7 MCP und Abnahme:** ✓ MCP-Werkzeug `planning` (auch ohne laufende App), offen: Abnahme mit Philip. MCP-Werkzeug `planning` für Claude Desktop (Karten auflisten, anlegen, verschieben, Termin setzen), mit Rückfall auf den Datenordner, wenn die App nicht läuft; Abnahme mit Philip. ✅ Freigabe.

## M8 – Adobe (ungetestet)

Ziel: Wer lieber in Adobe weiterarbeitet, bekommt die Ergebnisse von MoinStudio **fertig zum Weiterbearbeiten**.
Der Rohschnitt geht als Sequenz nach Premiere, das Thumbnail als Photoshop-Datei mit Ebenen.
MoinStudio braucht Adobe nie. Ohne Adobe ist nichts ausgegraut außer den Adobe-Knöpfen.
Weg ohne Plugin und ohne Scripting, weil Premiere-ExtendScript ausläuft und UXP-Plugins nur mit installiertem Adobe entwickelt werden können: FCP7-XML für Premiere und PSD mit Ebenen für Photoshop.
UXP-Plugins folgen erst, wenn die Abnahme auf einem Rechner mit Adobe gelaufen ist.
Alles bleibt als **„ungetestet“** markiert, bis `tests/adobe/` auf einem Rechner mit Adobe erfolgreich war.
Grundlage: [Adobe-Recherche](docs/research/adobe.md).

- [x] **8.1 Neu planen.** ✅ Plan steht hier (29.09.2026, selbst geplant nach Philips Vorgabe „alles ohne mich“; auf diesem Rechner ist kein Adobe installiert).
- [ ] **8.2 Erkennung:** Premiere, Photoshop und After Effects finden (Programmordner und Registry, Version aus der exe, Beta markieren); Anzeige in den Einstellungen mit Hinweis „ungetestet“. ✅ Unit-Tests mit nachgebauten Ordnern und Versionen.
- [ ] **8.3 Premiere: Sequenz als FCP7-XML:** Aus dem Schnitt-Projekt eine Sequenz mit allen behaltenen Stücken aus dem Original, Zooms als Bewegungs-Keyframes, Kapitel als Sequenz-Marker, Untertitel als SRT daneben; Knopf „Für Premiere exportieren“ im Schnitt. ✅ XML gegen die FCP7-Struktur geprüft (Unit-Tests), Import in eine freie Software (z. B. Kdenlive/Shotcut, falls ohne Admin installierbar) oder Strukturvergleich; Premiere-Import in `tests/adobe/`.
- [ ] **8.4 Photoshop: Thumbnail mit Ebenen:** Thumbnail als PSD mit getrennten Ebenen (Hintergrund, Figuren, Text), damit Philip in Photoshop nachbessern kann; Knopf „Als Photoshop-Datei speichern“. ✅ PSD mit Python öffnen und Ebenen prüfen; zusammengesetzt pixelgleich zum PNG.
- [ ] **8.5 Adobe-Testpaket:** `tests/adobe/` mit Prüfskripten (Premiere: XML importieren, Sequenz und Marker zählen; Photoshop: PSD öffnen, Ebenen zählen) und einer Anleitung für den Rechner mit Adobe. ✅ Skripte laufen ohne Adobe sauber durch („übersprungen“).
- [ ] **8.6 Abnahme auf einem Rechner mit Adobe** (Philip). ✅ `tests/adobe/` grün, erst dann entfällt „ungetestet“.

## M9 – Stabil → 1.0.0

- [ ] **9.1 Politur, README mit Screenshots, Release.**
