# MoinStudio – Technik-Recherche

Stand: 2026-09-26. Alle Quellen wurden am **2026-09-26** abgerufen (Liste am Ende, Verweise im Text als [Qn]).
Versionsangaben stammen von npm/PyPI/GitHub-Releases vom selben Tag.

**Kennzeichnung:**
- ohne Markierung = durch Quelle belegt
- **[Einschätzung]** = eigene Bewertung/Erfahrungswissen, nicht direkt belegt, vor Umsetzung verifizieren
- **[Lizenz-Warnung]** = Nutzung in einem monetarisierten YouTube-Kanal (= kommerziell) problematisch

**Randbedingungen:** Entwicklungs-VM ohne GPU, 9 GB RAM, ~11 GB frei, keine Admin-Rechte, kein Rust/MSVC, Node 24, Python 3.12 via uv, git/gh.
Zielrechner: PC + Laptop mit GPU (Hersteller unbekannt). Installation per-user ohne Admin. KI nur über das Claude-Abo (Claude Code CLI headless + lokaler MCP-Server für Claude Desktop), keine API-Keys.

---

## 1. Desktop-Framework

### 1.1 Aktuelle Versionen

| Paket | Version (26.09.2026) | Quelle |
|---|---|---|
| Electron | 44.4.5 (npm `latest`); die drei neuesten Major-Versionen werden unterstützt, alle 8 Wochen kommt eine neue | [Q1][Q2] |
| electron-builder | npm-`latest` = 26.15.3; GitHub-Release **26.17.0** (Tag `v26`, heute veröffentlicht); 27.0.0-alpha.9 (`next`, Breaking Changes: natives ESM, Node ≥ 22.12) | [Q3][Q4] |
| electron-updater | npm 6.8.9, GitHub-Release 6.8.10 (heute); 7.0.0-alpha.8 | [Q4] |
| electron-vite | 5.0.0 stabil, 6.0.0-beta.1 | [Q5] |
| Tauri | 2.11.5 (Crate, 01.07.2026), tauri-cli 2.11.4 | [Q6] |
| Wails | v3 weiterhin Beta (v3.0.0-beta.9) | [Q7] |

Hinweis: Electron 44 hat die Windows-ia32-Builds entfernt. Für MoinStudio spielt das keine Rolle, da nur x64 gebaut wird [Q8].

### 1.2 Build-Voraussetzungen unter Windows

- **Tauri 2** braucht: Microsoft C++ Build Tools („Desktop development with C++“), WebView2 (unter Win10 1803+ und Win11 vorinstalliert) und Rust über `rustup` mit MSVC-Toolchain [Q9]. **Auf der Entwicklungs-VM (kein Rust/MSVC, keine Admin-Rechte, 11 GB frei) ist das praktisch nicht machbar.** Die Build Tools brauchen in der Regel Admin-Rechte und mehrere GB Platz **[Einschätzung]**.
- **Electron** braucht nur Node/npm. Native Module (sharp, @napi-rs/canvas, skia-canvas, koffi) bringen vorkompilierte Binaries mit, dadurch entfällt node-gyp/MSVC. @napi-rs/canvas wirbt ausdrücklich mit „0 System dependencies“ [Q10]. **[Einschätzung]** Solange kein Modul ohne Prebuild dazukommt, reicht die VM zum Bauen.
- **Wails** braucht die Go-Toolchain und nutzt WebView2; v3 ist noch Beta [Q7]. **Neutralino** nutzt ebenfalls die System-Webview und bindet Backends über Extensions per IPC an [Q11]. Beide haben kein eingebautes, mit electron-updater vergleichbares Update-/Installer-Ökosystem **[Einschätzung]**.

### 1.3 Installer (per-user, ohne Admin)

**electron-builder NSIS** (Standard-Target unter Windows), Defaults laut Quellcode [Q12]:
- `oneClick: true`, das heißt One-Click-Installer. Mit `oneClick: false` wird er zum „assisted“ Installer mit Seiten.
- `perMachine: false`, also per-user. Bei `oneClick:false` + `perMachine:false` erscheint eine Seite zur Wahl des Installationsmodus. Für „nur per-user“ `perMachine:false` lassen und ggf. `oneClick:true` nutzen.
- Der per-user-Installationspfad ist `$LocalAppData\Programs\<App>` (Template `multiUser.nsh`) [Q13].
- `createDesktopShortcut: true`, `createStartMenuShortcut: true`, `runAfterFinish: true` [Q12].
- `allowElevation: true` gilt nur für den assisted-Modus, `allowToChangeInstallationDirectory: false` [Q12].
- Auto-Update ist nur mit dem NSIS-Target unterstützt, nicht mit Squirrel.Windows [Q14].
- **MSI** gibt es als electron-builder-Target, ist für Auto-Update aber nicht vorgesehen. **Empfehlung: NSIS.**

**Tauri** bietet NSIS mit `installMode: "currentUser"` (Default, installiert nach `%LOCALAPPDATA%`, ohne Admin) sowie `perMachine`/`both` (beide mit Admin). Daneben gibt es MSI über WiX v3 (nur auf Windows baubar) [Q15].

### 1.4 Autostart
`app.setLoginItemSettings({ openAtLogin, path, args, enabled, name })`. Unter Windows schreibt `enabled` den „StartupApproved“-Registry-Schlüssel, sodass die App im Task-Manager bzw. in den Einstellungen erscheint. `name` ist standardmäßig die AppUserModelId [Q16]. Das funktioniert per-user in HKCU ohne Admin **[Einschätzung]**. `app.requestSingleInstanceLock()` sorgt dafür, dass nur eine Instanz läuft [Q16].

### 1.5 Auto-Update über GitHub Releases (electron-updater)
- Mit `publish: { provider: "github", owner, repo }` erzeugt electron-builder `latest.yml` und lädt die Datei zusammen mit Installer und Blockmap ins Release hoch [Q14].
- Die GitHub-API erlaubt 5000 Requests pro Stunde, ein Update-Check braucht bis zu 3 Requests. Private Repos funktionieren nur mit `GH_TOKEN` und sind laut Doku „nicht für alle Nutzer geeignet“ [Q14]. **→ Das Release-Repo sollte öffentlich sein** (oder es gibt ein separates öffentliches Repo nur für Releases). Einen Token in der App auszuliefern wäre ein Secret-Leak.
- **Funktioniert es unsigniert?** Ja. `NsisUpdater.verifySignature()` liest `publisherName` aus `app-update.yml`. Fehlt der Eintrag (weil nicht signiert gebaut wurde), wird die Authenticode-Prüfung **übersprungen**. Im aktuellen Master loggt electron-updater dabei eine Warnung. Diese „fail-open“-Logik ist als *deprecated* markiert: **ab electron-builder v28 soll ein fehlender `publisherName` als Verifikationsfehler gelten (fail-closed)** [Q17][Q18]. Die SHA-512-Prüfung aus `latest.yml` bleibt aktiv [Q14].
  → Für v26/v27 funktioniert Auto-Update unsigniert. **Vor dem Umstieg auf v28 muss das neu bewertet werden** (signieren oder eine explizite Opt-out-Option prüfen).
- **SmartScreen:** Seit 2024 bringen auch EV-Zertifikate keine sofortige Reputation mehr. Reputation baut sich über Datei-Hash und Publisher-Zertifikat auf. „Unsigned files must rebuild reputation for every new hash“, das heißt: **jede neue unsignierte Version kann beim ersten Download die SmartScreen-Warnung auslösen** [Q19][Q17].
  **[Einschätzung]** Beim Self-Update lädt electron-updater per Node-HTTP herunter, nicht über den Browser. Dadurch fehlt vermutlich das Mark-of-the-Web, und SmartScreen greift beim Update seltener als beim Erst-Download. Das muss getestet werden.
- **Smart App Control (Win11):** Im Enforcement-Modus blockiert SAC „unknown, unsigned code“ **standardmäßig**. SAC ist nur auf Clean-Installs aktiv und schaltet sich bei Entwicklern oft selbst ab [Q20]. **→ Auf beiden Zielrechnern in Windows-Sicherheit › App- & Browsersteuerung prüfen.** Steht SAC auf „Ein“, läuft eine unsignierte App gar nicht. Dann bleibt nur Signieren (z. B. Azure Trusted Signing, electron-builder unterstützt `win.sign.type: "azure"` [Q17]; kostenpflichtig) oder SAC abschalten (lässt sich nur mit Neuinstallation wieder einschalten).
- **Tauri-Updater:** Er braucht zwingend ein Schlüsselpaar: „This cannot be disabled“. Das ist ein eigener Minisign-artiger Schlüssel, kein Code-Signing-Zertifikat, und damit kostenlos. Installationsmodi `passive` (Default), `basicUi` und `quiet` [Q21].

### 1.6 Empfehlung
**Electron 44 + electron-vite 5 + electron-builder 26.x (NSIS, `oneClick:true`, `perMachine:false`) + electron-updater mit `provider: github`.**
Begründung:
1. Es ist auf der Entwicklungs-VM ohne Rust/MSVC/Admin baubar.
2. Node ist im Main-Prozess eingebaut. Damit lassen sich MCP-SDK, Child-Prozesse, sharp/canvas und FFmpeg-Steuerung in derselben Sprache schreiben.
3. Chromium bringt eine konsistente Rendering-Engine mit (wichtig für WYSIWYG beim Thumbnail-Editor und für die Video-Vorschau).
4. Auto-Update funktioniert unsigniert.

Der Nachteil ist die Größe (Installer grob 80–120 MB **[Einschätzung]**). Bei einer Ein-Nutzer-App ist das irrelevant.

---

## 2. Child-Prozess-Orchestrierung

### 2.1 Werkzeuge
- **Blender 5.2.2 LTS** (15.09.2026), Windows-Portable-ZIP 386 MB [Q22]. Aufruf headless:
  `blender.exe -b scene.blend --factory-startup -P render.py --python-exit-code 1 -o //out_#### -F PNG -f 1 -- --cycles-device OPTIX`
  - `--cycles-device` akzeptiert `CPU CUDA OPTIX HIP ONEAPI METAL`; mit `+CPU` rendert Blender hybrid.
  - Reihenfolge beachten: `-o` muss **vor** `-f` stehen [Q23].
  - Blender ist GPL. **Die App sollte Blender nicht mitliefern**, sondern eine vorhandene Installation nutzen oder das Portable-ZIP beim Setup nach `%LOCALAPPDATA%\MoinStudio\tools\blender` laden **[Einschätzung]**.
- **FFmpeg:** siehe Abschnitt 9.
- **Python-Worker:** siehe 2.3.

### 2.2 Prozesssteuerung aus Electron (Main-Prozess oder `utilityProcess`)
- `child_process.spawn` mit `windowsHide: true`, dazu stdout/stderr zeilenweise parsen:
  - **FFmpeg:** `-progress pipe:1 -nostats` liefert `out_time_us=…`, `progress=continue|end` als Key/Value-Zeilen **[Einschätzung, Standard-Option]**.
  - **Blender:** Den Fortschritt am besten selbst aus dem Python-Script ausgeben (Handler `render_pre`/`render_post`, `print(json)`). Das ist robuster als das Parsen der Cycles-Logzeilen **[Einschätzung]**.
  - **Python-Worker:** JSON-Lines-Protokoll über stdin/stdout (`{"id":…, "progress":0.42}`).
- **Priorität:** `os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL)` entspricht unter Windows `BELOW_NORMAL_PRIORITY_CLASS` und braucht kein Admin. Nur `PRIORITY_HIGHEST` braucht erhöhte Rechte [Q24]. Die CPU-Priorität drosselt **nicht** die GPU-Last. Für die GPU hilft nur, weniger parallel zu arbeiten: max. 1 GPU-Job gleichzeitig, bei Blender weniger Samples bzw. Denoiser, NVENC statt x264 für den Export **[Einschätzung]**.
- **Beenden:** `child.kill()` beendet unter Windows nicht den Prozessbaum. `taskkill /PID <pid> /T /F` nutzen **[Einschätzung, bekanntes Verhalten]**.

### 2.3 Pausieren/Fortsetzen
| Weg | Bewertung |
|---|---|
| **Kooperativ über Job-Queue** (Jobs in kleine Einheiten zerlegen: Blender pro Frame/Variante, FFmpeg pro Segment, Whisper pro Chunk; Pause = nach aktueller Einheit keine neue starten) | **Empfohlen.** Keine Hacks, der VRAM wird freigegeben, und es überlebt einen App-Neustart (Queue-Zustand auf Disk). |
| `NtSuspendProcess`/`NtResumeProcess` (ntdll) per FFI, z. B. **koffi** 3.3.1 (MIT, prebuilt, kein Compiler nötig) [Q25] | Möglich als „Sofort-Pause“ für eigene Kindprozesse (gleicher Benutzer, kein Admin nötig **[Einschätzung]**). Das API ist undokumentiert. Ein angehaltener GPU-Prozess **hält seinen VRAM belegt**. Als Option „hart pausieren“ akzeptabel. |
| **PsSuspend** (Sysinternals) [Q26] | Dieselbe Technik als externes Tool. Die Weitergabe unterliegt der Sysinternals-Lizenz (Mitliefern vorher prüfen). Wird nicht gebraucht, wenn koffi genutzt wird. |

### 2.4 Python mitliefern oder zur Laufzeit installieren
- **uv** 0.12.19 (Apache-2.0), `uv-x86_64-pc-windows-msvc.zip` = 17 MB [Q27]. Standard-Speicherorte unter Windows: verwaltete Pythons in `%APPDATA%\uv\data`, Cache in `%LOCALAPPDATA%\uv\cache`. Beide lassen sich über `UV_PYTHON_INSTALL_DIR` bzw. `UV_CACHE_DIR` umlenken [Q28].
- **python-build-standalone** (MPL-2.0) ist die Quelle der uv-Pythons. `cpython-3.12.14 … install_only_stripped` = 21 MB [Q29][Q30].
- **Empfehlung:** `uv.exe` im Installer mitliefern (klein). Beim ersten Start von `%LOCALAPPDATA%\MoinStudio\py\` aus `uv sync --locked` ausführen, mit `UV_PYTHON_INSTALL_DIR` und `UV_CACHE_DIR` auf den App-Ordner gesetzt (per-user, kein Admin). **Schwere Extras (torch/CUDA, ComfyUI) nur bei Bedarf** als optionale Feature-Pakete laden.
  Begründung: Der Installer bleibt klein, Updates von Python-Abhängigkeiten laufen über den Lockfile, und die GPU-spezifischen Wheels hängen vom Zielrechner ab, nicht vom Build-Rechner **[Einschätzung]**.

---

## 3. MCP-Server (Node/TypeScript)

### 3.1 SDK-Stand
- Seit dem MCP-Spec-Release **2026-07-28** ist **v2 die stabile Linie**, mit geteilten Paketen `@modelcontextprotocol/server` (2.1.0, 23.09.2026) und `@modelcontextprotocol/client`. v1 (`@modelcontextprotocol/sdk`, aktuell 1.30.1) bekommt noch mindestens 6 Monate Bugfixes [Q31][Q32].
- Schemas laufen über Standard Schema (Zod v4, Valibot, ArkType). stdio-Server:
  ```ts
  import { McpServer } from '@modelcontextprotocol/server';
  import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
  ```
  [Q31]
- **Bild-Rückgabe:** Tool-Result-Content vom Typ `{ type: "image", data: <base64>, mimeType: "image/png" }`. Bilder vorher auf Vorschaugröße skalieren (z. B. 1280×720 JPEG), damit das Kontextfenster klein bleibt **[Einschätzung]**.
- **Empfehlung:** Neu mit **v2 (`@modelcontextprotocol/server`)** starten.

### 3.2 Claude Desktop einbinden
Konfiguration in `%APPDATA%\Claude\claude_desktop_config.json` → `mcpServers.<name>.{command,args,env}`. Die Logs landen in `%APPDATA%\Claude\logs\mcp-server-<name>.log` (stderr des Servers). Pfade müssen absolut sein [Q33].

### 3.3 Wie spricht der MCP-Server mit der laufenden App?
| Variante | Pro | Contra |
|---|---|---|
| **A: `MoinStudio.exe --mcp`** (volle Electron-App als stdio-Server) | ein Binary | Startet Chromium pro MCP-Session. Kollidiert mit `requestSingleInstanceLock`. GUI-Subsystem-Prozess mit stdio ist fehleranfällig **[Einschätzung]**. |
| **B: Kleiner Node-Prozess (`mcp.js`) als stdio-Server, gestartet mit `MoinStudio.exe` + `ELECTRON_RUN_AS_NODE=1`**, spricht über **Named Pipe** `\\.\pipe\moinstudio-<user>` (oder `127.0.0.1:<port>` + Token-Datei) mit der laufenden App | Kein separates Node nötig: `ELECTRON_RUN_AS_NODE` „starts the process as a normal Node.js process“ [Q34]. Leichtgewichtig. Läuft die App nicht, kann der Server sie starten oder read-only direkt auf den Datenordner zugreifen. | Die Fuse `runAsNode` muss **aktiviert bleiben** (Default: an) [Q35]. Das ist ein kleiner Sicherheits-Trade-off (Electron-Binary als Node-Interpreter missbrauchbar), für eine private App akzeptabel **[Einschätzung]**. |

**Empfehlung: Variante B.**
Config-Beispiel:
```json
"moinstudio": {
  "command": "C:\\Users\\<u>\\AppData\\Local\\Programs\\MoinStudio\\MoinStudio.exe",
  "args": ["C:\\Users\\<u>\\AppData\\Local\\Programs\\MoinStudio\\resources\\mcp\\mcp.js"],
  "env": { "ELECTRON_RUN_AS_NODE": "1" }
}
```
Die App schreibt diesen Eintrag auf Knopfdruck selbst (vorher JSON mergen und ein Backup anlegen). **[Einschätzung]** `mcp.js` liegt dafür außerhalb von `app.asar` (`extraResources`) oder `asarUnpack`.

### 3.4 Claude Code CLI headless aus der App
- `claude -p "<prompt>" --output-format stream-json --verbose` liefert NDJSON-Events, das letzte ist `result` [Q36].
- `--output-format json --json-schema '<schema>'` liefert strukturierte Ausgabe im Feld `structured_output` [Q36].
- `--mcp-config <datei>` bindet denselben MoinStudio-MCP-Server auch für die CLI ein. Mit `--allowedTools "mcp__moinstudio__*"` bzw. `--permission-mode dontAsk` sind unbeaufsichtigte Läufe möglich [Q36].
- **Wichtig:** `--bare` **nicht** verwenden, weil der Bare-Modus kein OAuth/Abo-Login liest und `ANTHROPIC_API_KEY` braucht [Q36]. Stattdessen mit einem eigenen leeren Arbeitsverzeichnis starten, damit keine fremden `.mcp.json`/Hooks geladen werden (unter `-p` gibt es keinen Trust-Dialog) [Q36].
- Abbrechen: SIGINT beendet den Turn sauber, SIGTERM führt zu Exit 143 [Q36].

---

## 4. Bildverarbeitung/Compositing und Schriften

### 4.1 Bibliotheken
| Option | Lizenz | Stärken | Schwächen |
|---|---|---|---|
| **sharp** 0.35.4 (libvips) | Apache-2.0 | Sehr schnell für Resize/Composite/Format. Text über Pango mit `fontfile` [Q37]. | Effekte wie Outline, Glow und Pfeile nur über SVG-Overlay (librsvg). Font-Handling unter Windows über fontconfig ist hakelig **[Einschätzung]**. |
| **@napi-rs/canvas** 1.0.9 (Skia) | MIT | Keine Systemabhängigkeiten, `GlobalFonts.registerFromPath` [Q10]. Canvas-API: `strokeText` (Outline), `shadowBlur`/`shadowColor` (Glow/Schatten), Pfade (Pfeile). | – |
| **skia-canvas** 3.0.8 | MIT | CSS-`filter`, Textumbruch, Laden eigener Fonts, optional GPU [Q38] | etwas schwerer |
| Pillow 12.3 / OpenCV | MIT-CMU / Apache-2.0 | gut für Analyse (Paletten, Masken) im Python-Worker | Text-Effekte umständlich |
| **Chromium im Renderer** (HTML/CSS/Canvas, Export per `webContents.capturePage` oder Offscreen-Canvas) | – | **Vorschau = Export (WYSIWYG).** CSS `-webkit-text-stroke`, `text-shadow`, `filter: drop-shadow`, SVG-Pfeile. | Export-Auflösung bewusst setzen (1280×720 bzw. 1920×1080) **[Einschätzung]** |

**Empfehlung:** Den Thumbnail-Editor als Layer-Modell (JSON) aufbauen, gerendert mit **@napi-rs/canvas** im Main/Worker. Dieselbe Canvas-API läuft im Renderer für die Live-Vorschau. Damit ist ein einziger Render-Code für Vorschau, Export und MCP-Tool nutzbar. **sharp** übernimmt Resize, Format, Kompression (YouTube-Limit beachten) und schnelle Composites. Python/Pillow/OpenCV nur für die Analyse **[Einschätzung]**.

### 4.2 Schriften (geprüft mit fontTools auf Glyphen `ÄÖÜäöüß ẞ € „“ –`)
| Font | Lizenz (Google Fonts) | Umlaute/ß | ẞ (U+1E9E) |
|---|---|---|---|
| Anton | OFL | ✔ | ✔ |
| Bebas Neue | OFL | ✔ | ✔ |
| Bangers | OFL | ✔ | ✔ |
| Luckiest Guy | **Apache-2.0** (nicht OFL) | ✔ | ✘ |
| Lilita One | OFL | ✔ | ✘ |
| Archivo Black | OFL | ✔ | ✘ |
| Titan One | OFL | ✔ | ✘ |

Quelle Lizenz/Subsets: `METADATA.pb` im Repo google/fonts [Q39]; die Glyphen-Prüfung erfolgte lokal am 26.09.2026 mit den TTFs aus demselben Repo.
Alle Fonts dürfen in der App mitgeliefert und für kommerzielle Thumbnails genutzt werden. Bei OFL müssen Lizenztext und Copyright mitgeliefert werden, der Font darf nicht allein verkauft werden. Das große ẞ fehlt bei vier Fonts. Bei Versal-Titeln deshalb „SS“ oder das kleine ß nutzen (im Editor ggf. Warnung anzeigen) **[Einschätzung]**.

---

## 5. Freistellen/Segmentierung (lokal)

| Modell | Lizenz | Größe (ONNX) | CPU-tauglich? |
|---|---|---|---|
| rembg 2.0.85 (Tool) | MIT [Q40] | – | ja (`rembg[cpu]`), GPU über `rembg[gpu]` (CUDA) bzw. `[rocm]` [Q41] |
| u2net / u2netp | Apache-2.0 (U-2-Net-Repo) | u2net ≈ 168 MB | ja |
| isnet-general-use | Apache-2.0 (DIS-Repo) | ≈ 170 MB | ja |
| **BiRefNet** (general) | **MIT** [Q42] | 928 MB (fp32) / 467 MB (fp16); rembg-Variante ≈ 928 MB | langsam |
| **BiRefNet_lite** | **MIT** | 214 MB / 109 MB fp16 [Q43] | **ja**: 1024² ≈ 2,4 s, 512² ≈ 0,6 s (~1,3 GB Peak) auf Core Ultra 9 185H mit der dynamischen Export-Variante [Q44] |
| bria-rmbg (**rembg-Default!**) / RMBG-2.0 | **CC BY-NC 4.0** [Q45] | ~1 GB | **[Lizenz-Warnung]** nicht kommerziell nutzbar. **In rembg explizit ein anderes Modell wählen.** |
| SAM 2.1 (hiera-tiny …) | Apache-2.0 [Q46] | klein (tiny) | ja, braucht aber Prompts (Punkt/Box). Eher für interaktives Nachschärfen. |

**Empfehlung:** **BiRefNet_lite (ONNX, fp16) über onnxruntime** (1.30.0, MIT) im Python-Worker. Auf den Zielrechnern kann optional `onnxruntime-directml` genutzt werden (herstellerunabhängig auf Windows) **[Einschätzung zur Performance]**. u2netp dient als schneller Fallback. Für Blender-Renders mit *Film › Transparent* ist kein Freistellen nötig.

---

## 6. Referenz-Thumbnail analysieren

### 6.1 Posen
| Option | Lizenz | CPU | Ausgabe |
|---|---|---|---|
| **MediaPipe Pose Landmarker** (`mediapipe` 1.0.1) | Apache-2.0 | ja (MobileNetV2-ähnlich, Varianten Lite/Full/Heavy) | 33 Landmarks + **WorldLandmarks (3D, metrisch, Hüfte als Ursprung)** + optionale Segmentierungsmaske [Q47] |
| **RTMPose/RTMW über `rtmlib`** (0.0.16) | Apache-2.0 [Q48] | ja (onnxruntime/OpenVINO), keine mmcv-Installation nötig | 2D, Body (17/26) oder Wholebody 133 inkl. Hände/Gesicht, optional im OpenPose-Format |
| DWPose | Apache-2.0 (Repo; seit 2023 inaktiv) | ja (ONNX) | 2D Wholebody. Über rtmlib abgedeckt. |
| ViTPose | Apache-2.0 | mäßig | 2D |
| **OpenPose (CMU)** | **Nur nicht-kommerzielle Forschung** [Q49] | – | **[Lizenz-Warnung] nicht verwenden** |
| 4D-Humans / HMR2.0 | Code MIT, **braucht das SMPL-Modell** [Q50] | langsam | 3D-Mesh |
| SMPLer-X | braucht SMPL/SMPL-X [Q51] | GPU | 3D-Mesh |
| SMPL-Modell | **„any use for commercial purposes is prohibited“** (kommerziell nur über Meshcapade) [Q52] | – | **[Lizenz-Warnung]** |

**Empfehlung:** **MediaPipe Pose (WorldLandmarks)** für die 3D-Richtung der Gliedmaßen, dazu optional **rtmlib/RTMW** für genauere 2D-Keypoints inkl. Hände. Das Retargeting auf ein Minecraft-Rig ist einfach, weil Minecraft-Figuren starre Glieder haben: Pro Knochen (Kopf, Arme, Beine, Torso) wird eine Rotation aus dem Richtungsvektor Gelenk → Gelenk berechnet (Schulter → Handgelenk usw.) und als Euler/Quaternion in Blender per Python gesetzt. Den Kopf-Yaw/Pitch liefert die Face-Landmarker-Transformationsmatrix **[Einschätzung, Verfahren]**. SMPL-basierte Verfahren wegen der Lizenz meiden.

### 6.2 Gesichtsausdruck
- **MediaPipe Face Landmarker** liefert **52 Blendshape-Scores** (z. B. `mouthSmile`, `jawOpen`, `browInnerUp`) und eine Transformationsmatrix [Q53]. Das reicht, um „überrascht / lacht / schockiert“ regelbasiert abzuleiten und auf Minecraft-Gesichtstexturen bzw. Augen/Mund-Varianten zu mappen **[Einschätzung]**.
- Alternativen: EmotiEffLib (Apache-2.0) [Q54], `fer` (MIT) [Q54].

### 6.3 OCR
| Option | Lizenz | Hinweise |
|---|---|---|
| **PaddleOCR 3.7 (PP-OCRv5)** | Apache-2.0 | 106 Sprachen inkl. Deutsch, Mobile-Modelle CPU-tauglich [Q55][Q56] |
| RapidOCR (ONNX-Port der Paddle-Modelle) | Apache-2.0 [Q54] | leichtgewichtiger, kein PaddlePaddle-Framework nötig |
| EasyOCR 1.7.2 | Apache-2.0 | PyTorch-basiert (schwer) |
| Tesseract | Apache-2.0 | schwach bei stilisierten Thumbnail-Fonts **[Einschätzung]** |
| **Windows.Media.Ocr** | OS-API | Kein Download nötig. Liefert Zeilen/Wörter mit Position. Sprachen hängen von installierten Sprachpaketen ab (`AvailableRecognizerLanguages`) [Q57]. Aus Node nur über eine WinRT-Brücke/PowerShell erreichbar **[Einschätzung]**. |

**Empfehlung:** **RapidOCR** (oder PaddleOCR) im Python-Worker. Windows.Media.Ocr als Zero-Install-Fallback.

### 6.4 Farbpalette, Logo/Wasserzeichen
- Palette: k-means (OpenCV `cv2.kmeans`) oder Median-Cut (Pillow `quantize`) im Python-Worker, bzw. `color-thief` (MIT) in JS [Q54] **[Einschätzung, Standardverfahren]**.
- Logo/Wasserzeichen: Ein fertiges Open-Source-Modell mit kommerziell nutzbarer Lizenz wurde nicht verifiziert. **Ultralytics YOLO ist AGPL-3.0** [Q54] → **[Lizenz-Warnung]**. Pragmatisch reicht OCR-Text in Ecken plus Template-Matching gegen bekannte Logos (eigene Kanal-Logos). Alternativ kann Claude das Bild über das MCP-Bild-Tool beurteilen, was über das Abo erlaubt ist **[Einschätzung]**.

---

## 7. Lokale Bildmodelle (optional, nur auf Nutzer-GPU)

- **ComfyUI** v0.37.0 (21.09.2026), **GPL-3.0**. Portable-Builds für Windows [Q58]:
  - `nvidia` (1836 MB, Python 3.13, PyTorch CUDA 13.0, RTX 20xx+)
  - `nvidia_cu126` (für GTX 10xx)
  - `amd` (1521 MB)
  - `intel` (1442 MB)
  
  Es gibt eine lokale API für Workflows. `--disable-api-nodes` hält alles offline, ohne die kostenpflichtigen API-Nodes [Q58]. Die Portable-Version gehört nach `%LOCALAPPDATA%\MoinStudio\tools\comfyui` und wird **nicht** mitgeliefert (GPL, Größe). Die App lädt sie auf Wunsch und spricht per HTTP/WebSocket mit ihr **[Einschätzung zur Integration]**.
- **Modell-Lizenzen (kommerzielle YouTube-Nutzung):**
  | Modell | Lizenz | Kommerziell? |
  |---|---|---|
  | FLUX.1 [schnell] | Apache-2.0 [Q59] | ja |
  | **FLUX.2 [klein] 4B** | Apache-2.0, ~13 GB VRAM, T2I + Editing + Multi-Referenz [Q60] | ja |
  | FLUX.1 [dev] / FLUX.2 [dev] | „other“ (BFL Non-Commercial) [Q59] | **[Lizenz-Warnung]** Lizenztext prüfen |
  | SDXL base 1.0 | CreativeML OpenRAIL++-M [Q59] | ja (mit Nutzungsbeschränkungen) |
  | SD 3.5 Large/Medium | Stability Community License: kostenlos kommerziell bis **1 Mio. USD Jahresumsatz**, Outputs gehören dem Nutzer [Q61] | ja (unter der Schwelle) |
  | Qwen-Image | Apache-2.0 [Q59] | ja |
- **Upscaling:**
  - **Real-ESRGAN** (BSD-3). Die `realesrgan-ncnn-vulkan`-Portable (43 MB) läuft auf **Intel/AMD/NVIDIA** ohne CUDA/PyTorch [Q62]. **→ Ideal, weil der GPU-Hersteller unbekannt ist.**
  - **4x-UltraSharp** steht unter **CC BY-NC-SA 4.0** [Q59] → **[Lizenz-Warnung]**.
- **IC-Light** (Relighting): Code Apache-2.0 [Q54], ComfyUI-Nodes Apache-2.0 [Q54]. Basiert auf SD1.5-Checkpoints, deren Lizenz ist CreativeML OpenRAIL-M **[Einschätzung]**.
- **GPU/VRAM ermitteln (ohne Admin):**
  1. `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader`, nur bei NVIDIA vorhanden **[Einschätzung, Standard-Tool]**.
  2. **WMI `Win32_VideoController.AdapterRAM` ist `uint32`** [Q63]. Werte ≥ 4 GB werden daher falsch (gekappt/übergelaufen) angezeigt, **nicht verwenden**.
  3. DXGI `IDXGIAdapter1::GetDesc1().DedicatedVideoMemory` (SIZE_T, 64-bit) über koffi, oder Registry `HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000X\HardwareInformation.qwMemorySize` (lesbar ohne Admin) **[Einschätzung]**.
  4. Electron `app.getGPUInfo('complete')` liefert Vendor-/Device-IDs (0x10DE NVIDIA, 0x1002 AMD, 0x8086 Intel) **[Einschätzung]**.

---

## 8. Transkription und Analyse

### 8.1 Whisper-Implementierungen
| | faster-whisper 1.2.1 | whisper.cpp v1.9.4 |
|---|---|---|
| Lizenz | MIT | MIT |
| CPU (13 min Audio, Modell „small“, i7-12700K, 8 Threads) | int8: 1m42s / 1477 MB; `batch_size=8`: 51 s [Q64] | fp32: 2m05s / 1049 MB [Q64] |
| GPU | CUDA 12 + cuDNN 9 (unter Windows DLLs über Purfview-Archiv) [Q64] | Windows-Binaries: `whisper-bin-x64` (CPU), `whisper-blas-bin-x64`, **`whisper-cublas-12.4.0-bin-x64`** (Assets auf den `b…`-Build-Releases, nicht im v1.9.4-Tag) [Q65]. **Vulkan** wird unterstützt [Q66], ein fertiges Windows-Vulkan-Binary wurde in den Releases nicht gefunden. |
| Wort-Zeitstempel | `word_timestamps=True` [Q64] | ja (Token-Timestamps) **[Einschätzung]** |
| VAD | Silero integriert (`vad_filter=True`, Default entfernt nur Stille > 2 s) [Q64] | VAD-Support im README [Q66] |

Modellgrößen (whisper.cpp): tiny 75 MiB, base 142 MiB, small 466 MiB, medium 1,5 GiB, large 2,9 GiB [Q66]. `large-v3-turbo` (MIT) ist der übliche Kompromiss. Für Deutsch gibt es `primeline/whisper-large-v3-turbo-german` (Apache-2.0) [Q59].
**Empfehlung:** **faster-whisper** im Python-Worker: `large-v3-turbo`, auf der VM `small`/`medium` mit int8-CPU, auf den Zielrechnern CUDA (falls NVIDIA). Liegt keine NVIDIA-GPU vor, ist **whisper.cpp** der Fallback (Vulkan müsste man selbst bauen bzw. später prüfen) **[Einschätzung]**.

### 8.2 Füllwörter („äh“, „ähm“)
- Whisper lässt Füllwörter häufig weg. Laut OpenAI-Doku ist das Erhalten von Füllwörtern ein Anwendungsfall für Prompting [Q67]. Der Prompt ist auf **224 Tokens** begrenzt, bei längeren zählen nur die letzten 224 [Q68].
  → `initial_prompt="Ähm, also, äh, ich hab halt, hm, sozusagen …"` in faster-whisper. Die Wirkung schwankt **[Einschätzung]**.
- **CrisperWhisper** (verbatim, markiert `[um]`/`[uh]`, Deutsch + Englisch) wäre fachlich ideal. Die offenen Gewichte stehen aber unter einer **non-commercial research license**, Pro-Modelle nur kommerziell [Q69] → **[Lizenz-Warnung]**.
- Robuste Ergänzung: **Lücken-Heuristik**. Wortlücken ≥ 300 ms, die laut Silero VAD Sprache enthalten, aber kein Wort ergeben, werden als „vermutliches Füllwort“ markiert und im UI angezeigt **[Einschätzung]**.

### 8.3 Stille, Szenen, Highlights
- **Stille:**
  - FFmpeg `silencedetect=n=-35dB:d=0.4` (Defaults: −60 dB, 2 s) loggt `silence_start/end` [Q70].
  - **Silero VAD** 6.2.3: MIT, ONNX-CPU, < 1 ms pro 30-ms-Chunk auf einem Thread [Q71].
  - Empfehlung: VAD (sprachbasiert) statt reinem Pegel.
- **Szenenwechsel:**
  - FFmpeg `scdet` (Threshold-Default 10, gute Werte 8–14) [Q70] oder `select='gt(scene,0.3)'`.
  - PySceneDetect 0.7.1 (BSD-3) mit ContentDetector, AdaptiveDetector, ThresholdDetector, HistogramDetector und HashDetector [Q72].
- **Highlights:**
  - Lautstärke-Peaks: FFmpeg `ebur128`/`astats` [Q70].
  - **YAMNet**: 521 AudioSet-Klassen inkl. „Laughter“, 16 kHz mono, Code Apache-2.0, Inhalte CC BY 4.0 [Q73]. Braucht TensorFlow, im Worker ggf. als ONNX/TFLite **[Einschätzung]**.
  - PANNs (`audioset_tagging_cnn`, MIT) [Q54].
  - Twitch-Chat-Dichte:
    - **TwitchDownloader CLI** (MIT) lädt den Chat von VODs/Clips als JSON [Q74].
    - **chat-downloader** (MIT) unterstützt Twitch und YouTube (Livestreams, vergangene Broadcasts) [Q75].
    - Nutzungsbedingungen von Twitch/YouTube separat beachten.

---

## 9. FFmpeg für den Schnitt

- **Zoom:**
  - `zoompan` ist primär für Standbilder gedacht. Er erzeugt pro Eingabebild `d` Frames (Default 90), Ausgabe-Default `hd720` @ 25 fps, zoom 1–10 [Q70]. Für Video fehleranfällig (Framerate/Größe explizit setzen, ruckelt bei langsamen Zooms) **[Einschätzung]**.
  - **Empfohlen: `scale` mit `eval=frame` + `crop`.** Bei `crop` werden w/h nur einmal ausgewertet, x/y aber **pro Frame** [Q70]. Also: skalieren (Zoomfaktor als Funktion von `t`), dann mit fester Ausgabegröße und zeitabhängigem x/y croppen.
- **Untertitel einbrennen:** Filter `subtitles` (libass, `fontsdir=` für mitgelieferte Fonts) [Q70]. ASS-Datei aus Wort-Zeitstempeln erzeugen (Karaoke-Tags `\k` für Wort-Highlight **[Einschätzung]**).
- **YouTube-Upload-Empfehlung (offiziell)** [Q76]:
  - MP4 mit moov-Atom vorne (Fast Start)
  - Audio AAC-LC oder Opus, 48 kHz
  - H.264 High Profile, 2 aufeinanderfolgende B-Frames, Closed GOP, 4:2:0
  - Framerate wie Aufnahme
  - SDR-Bitraten: 1080p 8 Mbit/s (HFR 12), 1440p 16 (24), 2160p 35–45 (53–68)
  - Farbraum BT.709, 16:9
  
  → FFmpeg: `-c:v libx264 -profile:v high -pix_fmt yuv420p -bf 2 -flags +cgop -b:v 12M -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -ar 48000 -movflags +faststart` **[Einschätzung zur Umsetzung]**. Auf den Zielrechnern alternativ `h264_nvenc`/`h264_amf`.
- **Kapitelmarken:** Erster Zeitstempel `00:00`, aufsteigend, **mindestens 3 Kapitel**, jedes **mindestens 10 s** [Q77]. → Beim Export validieren.
- **FCP7-XML (xmeml) für Premiere:** Premiere importiert FCP7-XML (xmeml) inkl. Basis-Motion/Opacity-Keyframes. FCPX-`.fcpxml` wird **nicht** unterstützt [Q78].
- **Live-Vorschau:**
  - HTML5 `<video>` im Renderer mit **Proxy-Dateien** (z. B. 540p H.264, kurzes GOP `-g 15` für schnelles Scrubbing) **[Einschätzung]**.
  - Der Schnitt ist eine EDL (JSON). Die Vorschau spielt Segmente per `currentTime`-Sprüngen ab, erst der Export rendert.
  - Timeline: **@xzdarcy/react-timeline-editor** 1.0.0 (MIT, letzte Aktivität 01/2026) [Q54] + **wavesurfer.js** 7.x/8.0.1 (BSD-3) für die Wellenform [Q54]. Wellenform-Peaks einmalig mit FFmpeg vorberechnen (JSON) statt Audio im Renderer zu dekodieren **[Einschätzung]**.
- **FFmpeg-Builds Windows:**
  - **gyan.dev**: essentials (release, 34 MB 7z/109 MB zip) mit libass und libx264, NVENC/AMF/QSV/D3D11 in allen Builds. **GPLv3.** Empfohlen werden git-master-Builds [Q79].
  - **BtbN**: GitHub-Releases, u. a. n8.1/n9.0/master, jeweils `gpl`/`lgpl`, static/shared, win64 ≈ 73–186 MB [Q80].
  
  **Empfehlung:** **GPL-Build (BtbN n8.1 oder n9.0 `win64-gpl`, static) beim ersten Start herunterladen** (SHA-256 prüfen) statt mitliefern. libx264/libass brauchen GPL. Ein Download entkoppelt die App-Lizenz von der GPL-Weitergabepflicht **[Einschätzung, keine Rechtsberatung]**.

---

## 10. Planungsdaten im (OneDrive-)Ordner

- **SQLite nicht in OneDrive:** SQLite verlässt sich auf korrektes Datei-Locking. Das ist bei Netzwerk-Dateisystemen fehleranfällig, und Kopien während einer Transaktion können korrupt sein. `-wal`/`-journal` müssen zusammen mit der DB bleiben [Q81]. Ein Sync-Client, der Dateien einzeln hochlädt, bricht genau diese Annahmen **[Einschätzung]**.
- **OneDrive-Konflikte:** Bei Nicht-Office-Dateien behält OneDrive beide Versionen. Die lokale Kopie erhält den **Gerätenamen im Dateinamen** (z. B. `Report-JOHNS-SURFACE.txt`) [Q82].
- **Empfehlung:**
  - **Eine JSON-Datei pro Karte** (`cards/<ulid>.json`) mit `id`, `rev` (Zähler), `updatedAt`, `updatedBy` (Gerätename).
  - Board-Reihenfolge als `order`-Feld (fraktionale Indizes) **in der Karte**, nicht in einer zentralen Datei. So berührt jeder Edit nur eine Datei.
  - **Atomar schreiben:** in `.<name>.tmp` schreiben, `fsync`, dann `rename`. Unter Windows ersetzt Node `fs.rename` die Zieldatei **[Einschätzung]**.
  - **Konflikterkennung:** per File-Watcher Dateien nach dem Muster `*-<GERÄT>.json` erkennen, beide Versionen im UI zeigen (Feld-Merge nach `updatedAt`).
  - **Lokaler Index/Cache** (z. B. SQLite unter `%LOCALAPPDATA%`, nicht im Sync-Ordner) wird bei jedem Start neu aus den JSON-Dateien aufgebaut.
- **UI:**
  - **dnd-kit** (MIT): `@dnd-kit/core` 6.3.1 stabil, `@dnd-kit/react` 0.5.0 als neue API [Q54].
  - **FullCalendar** 6.x: Standard-Pakete **MIT**, Premium-Plugins (Timeline/Resource, `fullcalendar-scheduler`) brauchen für For-Profit eine Lizenz [Q83]. Monats-/Wochen-/Listenansicht reichen und sind MIT.

---

## 11. Minecraft-Skins per Name

- **Name → UUID:**
  - `https://api.mojang.com/users/profiles/minecraft/{name}` (liefert laut Wiki gelegentlich zufällige 403)
  - Alternativen: `https://api.minecraftservices.com/minecraft/profile/lookup/name/{name}` oder `https://api.mojang.com/minecraft/profile/lookup/name/{name}` [Q84]
- **UUID → Textures:** `https://sessionserver.mojang.com/session/minecraft/profile/{uuid}`. `properties[].value` ist Base64-JSON mit `textures.SKIN.url` (+ `CAPE`). **`metadata.model = "slim"` nur beim Alex-Modell, beim Steve/classic fehlt `metadata`** [Q84].
- **Rate-Limits:** API allgemein ~200 Requests / 2 min pro IP. Sessionserver-Profile ~400 Requests / 10 s [Q84]. → Skins lokal cachen (Dateiname = Hash aus der Texture-URL), den Namen erst nach Ablauf eines TTL erneut auflösen **[Einschätzung]**.
- **Usage Guidelines (minecraft.net)** [Q85]:
  - Videos/Streams dürfen per Werbung monetarisiert werden, wenn sie frei ansehbar sind und genug eigenen Inhalt enthalten.
  - Kein Minecraft-Logo und kein Schriftzug im Stil des Logos.
  - Nichts, was nach „offiziell/approved/associated“ aussieht.
  - Screenshots eigener Kreationen auf Covern sind erlaubt, solange der Eindruck einer offiziellen Publikation vermieden wird.
  
  → In der Thumbnail-Vorlage **keinen Minecraft-Logo-Font** nachbauen.

---

## 12. Secret-Scan: gitleaks als pre-push-Hook

- **gitleaks** v8.30.1 (MIT), `gitleaks_8.30.1_windows_x64.zip` [Q86]. `detect`/`protect` sind seit v8.19 deprecated, stattdessen `gitleaks git` (nutzt `git log -p`, steuerbar über `--log-opts`) und `gitleaks dir` [Q87].
- Git for Windows führt Hooks mit seiner `sh.exe` aus, ein POSIX-Script in `.git/hooks/pre-push` (bzw. versioniert unter `.githooks/` + `git config core.hooksPath .githooks`) funktioniert daher **[Einschätzung]**:
  ```sh
  #!/bin/sh
  # pre-push: stdin = <local ref> <local sha> <remote ref> <remote sha>
  z=0000000000000000000000000000000000000000
  while read lref lsha rref rsha; do
    [ "$lsha" = "$z" ] && continue            # Löschung
    if [ "$rsha" = "$z" ]; then range="$lsha"; else range="$rsha..$lsha"; fi
    gitleaks git --no-banner --redact --log-opts="$range" . || {
      echo "gitleaks: mögliche Secrets gefunden – Push abgebrochen"; exit 1; }
  done
  ```
  `gitleaks.exe` ohne Admin nach `%LOCALAPPDATA%\Programs\gitleaks\` entpacken und in den User-PATH aufnehmen. Zusätzlich lohnt sich die GitHub-Action `gitleaks-action` [Q87].

---

## 13. Empfohlene Gesamtarchitektur

### 13.1 Prozesse
```
MoinStudio.exe (Electron Main, Node/TS)
 ├─ Renderer (React + Vite): Tabs Thumbnail | Schnitt | Planung
 ├─ utilityProcess "jobs": Job-Queue (persistiert), Spawn/Progress/Pause/Priority
 │    ├─ blender.exe -b … (Render, Posen-Retargeting via bpy)
 │    ├─ ffmpeg.exe (Proxy, Analyse, Export, Untertitel)
 │    ├─ py-worker (uv-Python, JSON-Lines): faster-whisper, Silero VAD,
 │    │     BiRefNet-lite/onnxruntime, MediaPipe, rtmlib, RapidOCR, Palette
 │    ├─ claude -p … --output-format stream-json --mcp-config moin.json
 │    └─ optional: ComfyUI portable (HTTP-API, nur Ziel-GPU), realesrgan-ncnn-vulkan
 ├─ IPC-Server: Named Pipe \\.\pipe\moinstudio-<user> (JSON-RPC, Token)
 └─ electron-updater (GitHub Releases)

Claude Desktop ──stdio──> MoinStudio.exe (ELECTRON_RUN_AS_NODE=1) mcp.js
                               └──Named Pipe──> laufende App (oder Direktzugriff auf Datenordner)
```

### 13.2 Repo-Struktur (Vorschlag)
```
moinstudio/
  package.json, electron.vite.config.ts, electron-builder.yml
  src/main/        # App-Lifecycle, Updater, IPC-Pipe, Settings
  src/jobs/        # Queue, Runner (blender/ffmpeg/python/claude), GPU-Detect
  src/renderer/    # React-UI (thumbnail/, edit/, plan/)
  src/shared/      # Typen, Zod-Schemas (EDL, Thumbnail-Layer, Karte)
  src/render/      # Thumbnail-Renderer (@napi-rs/canvas) – von Main & MCP genutzt
  src/mcp/         # mcp.js (@modelcontextprotocol/server, stdio) + Pipe-Client
  python/          # pyproject.toml + uv.lock, moin_worker/ (whisper, vad, seg, pose, ocr)
  blender/         # rig.blend, render.py, pose_apply.py
  resources/fonts/ # OFL/Apache-Fonts + Lizenztexte
  .githooks/pre-push
```

### 13.3 Datenordner
```
%LOCALAPPDATA%\Programs\MoinStudio\        # App (NSIS per-user)
%LOCALAPPDATA%\MoinStudio\
  tools\ffmpeg\  tools\blender\  tools\comfyui\  tools\realesrgan\
  py\  (uv: UV_PYTHON_INSTALL_DIR, UV_CACHE_DIR, .venv)
  models\ (whisper, birefnet, mediapipe, rtmw, ocr)
  cache\  (proxies, waveforms, skins, index.sqlite)
  logs\  jobs\queue.json
%APPDATA%\MoinStudio\settings.json          # inkl. Pfad zum Projekt-/Planungsordner
<frei wählbarer Ordner, z. B. OneDrive>\MoinStudio\
  planning\cards\<ulid>.json   planning\boards.json (nur selten geändert)
  projects\<slug>\project.json  edl.json  transcript.json  chapters.json
  projects\<slug>\thumbnails\<id>.json (+ Export-PNGs)
  skins\ (optional geteilte Skins)
```
**[Einschätzung]** Große Mediendateien (Rohvideos, Proxies) gehören nicht in OneDrive. Im Projekt nur Pfade/Hashes speichern.

### 13.4 Komponenten-Tabelle

| Komponente | Wahl | Alternative | Lizenz | Größe | GPU nötig? |
|---|---|---|---|---|---|
| Desktop-Framework | Electron 44 + electron-vite 5 | Tauri 2 (braucht Rust/MSVC) | MIT | Installer ~80–120 MB [Einsch.] | nein |
| Installer/Update | electron-builder 26.x NSIS per-user + electron-updater (GitHub) | Tauri NSIS + Updater (Signaturschlüssel) | MIT | – | nein |
| MCP | @modelcontextprotocol/server 2.1 (stdio) via ELECTRON_RUN_AS_NODE | @modelcontextprotocol/sdk 1.30 (v1) | MIT | klein | nein |
| KI | Claude Code CLI `-p` stream-json (Abo, ohne `--bare`) | Claude Desktop über MCP | proprietär (Abo) | – | nein |
| Thumbnail-Render | @napi-rs/canvas 1.0.9 + sharp 0.35 | skia-canvas 3.0.8 / Chromium capturePage | MIT / Apache-2.0 | ~30–50 MB [Einsch.] | nein |
| 3D-Render | Blender 5.2.2 LTS (headless, Download) | – | GPL | 386 MB (ZIP) | nein (CPU langsam), GPU empfohlen |
| Fonts | Anton, Bebas Neue, Bangers (+ Lilita One, Luckiest Guy) | Archivo Black, Titan One | OFL / Apache-2.0 | < 1 MB | nein |
| Freistellen | BiRefNet_lite ONNX fp16 (onnxruntime) | u2netp, SAM 2.1 tiny | MIT | 109 MB | nein |
| Pose | MediaPipe Pose Landmarker (World) + rtmlib RTMW | ViTPose; **nicht** OpenPose/SMPL | Apache-2.0 | ~10–30 MB bzw. ~100–200 MB [Einsch.] | nein |
| Gesicht | MediaPipe Face Landmarker (52 Blendshapes) | EmotiEffLib | Apache-2.0 | klein | nein |
| OCR | RapidOCR / PaddleOCR PP-OCRv5 mobile | Windows.Media.Ocr, Tesseract | Apache-2.0 | ~20 MB [Einsch.] | nein |
| Bildgenerierung | ComfyUI portable + FLUX.2 klein 4B / FLUX.1 schnell | SDXL, SD3.5 (<1 Mio USD) | GPL-3.0 (ComfyUI), Apache-2.0 (Modelle) | 1,4–1,8 GB + Modelle | **ja** (~13 GB VRAM für FLUX.2 klein) |
| Upscaling | realesrgan-ncnn-vulkan | 4x-UltraSharp (**NC**) | BSD-3 | 43 MB | Vulkan-GPU (jeder Hersteller) |
| Transkription | faster-whisper 1.2.1 (large-v3-turbo; VM: small int8) | whisper.cpp 1.9.4 (CPU/cuBLAS/Vulkan) | MIT | 0,5–3 GB Modell | nein (CPU langsam), CUDA optional |
| VAD/Stille | Silero VAD 6.2.3 + FFmpeg silencedetect | – | MIT / FFmpeg | ~2 MB [Einsch.] | nein |
| Füllwörter | initial_prompt + Lücken-Heuristik | CrisperWhisper (**NC**) | MIT | – | nein |
| Szenen | FFmpeg scdet / PySceneDetect 0.7.1 | – | BSD-3 | klein | nein |
| Highlights | ebur128-Peaks + YAMNet (Lachen) + Twitch-Chat (TwitchDownloader CLI) | PANNs, chat-downloader | Apache-2.0 / MIT | ~15 MB [Einsch.] | nein |
| Video-Engine | FFmpeg BtbN win64-gpl (Download beim Setup) | gyan.dev essentials | GPL-3.0 | ~185 MB (zip) | nein (NVENC/AMF optional) |
| Timeline-UI | @xzdarcy/react-timeline-editor + wavesurfer.js | eigene Canvas-Timeline | MIT / BSD-3 | klein | nein |
| Planung-Speicher | JSON pro Karte, atomare Writes, Konflikt-Scan | SQLite nur lokal als Index | – | – | nein |
| Kanban/Kalender | dnd-kit + FullCalendar (MIT-Teile) | – | MIT | klein | nein |
| Python-Runtime | uv 0.12 (mitgeliefert) + python-build-standalone 3.12 | eingebettetes Python mitliefern | Apache-2.0 / MPL-2.0 | 17 MB + 21 MB | nein |
| Pause | Job-Queue kooperativ (+ optional NtSuspendProcess via koffi) | PsSuspend | MIT | klein | nein |
| Skins | Mojang API + Sessionserver, lokaler Cache | – | – | – | nein |
| Secret-Scan | gitleaks 8.30.1 pre-push | pre-commit-Framework | MIT | ~10 MB [Einsch.] | nein |

### 13.5 Offene Punkte / Risiken
1. **Smart App Control** auf den Zielrechnern prüfen. Steht es auf „Ein“, läuft die App unsigniert nicht (siehe 1.5).
2. **electron-builder v28** wird Updates ohne `publisherName` voraussichtlich ablehnen. Solange die App unsigniert bleibt, auf v26/v27 pinnen.
3. **GPU-Hersteller** der Zielrechner ermitteln (Abschnitt 7). Davon hängen CUDA-Pfade (faster-whisper, ComfyUI-Variante) ab. Herstellerneutral sind Vulkan (realesrgan, whisper.cpp) und DirectML (onnxruntime).
4. **Lizenzfallen** vermeiden: rembg-Default `bria-rmbg`, OpenPose, SMPL/HMR2/SMPLer-X, CrisperWhisper, 4x-UltraSharp, FLUX-dev, Ultralytics (AGPL).
5. **Festplattenplatz auf der VM (~11 GB):** Nur kleine Modelle (whisper small, BiRefNet_lite fp16), Blender/ComfyUI nicht lokal installieren. GPU-Features auf der VM per Feature-Flag deaktivieren.

---

## Quellen (alle abgerufen am 2026-09-26)

- [Q1] https://www.npmjs.com/package/electron (npm view: 44.4.5)
- [Q2] https://www.electronjs.org/docs/latest/tutorial/electron-timelines · https://endoflife.date/electron
- [Q3] https://www.npmjs.com/package/electron-builder (dist-tags)
- [Q4] https://github.com/electron-userland/electron-builder/releases
- [Q5] https://www.npmjs.com/package/electron-vite · https://github.com/alex8088/electron-vite/releases
- [Q6] https://docs.rs/crate/tauri/latest · https://v2.tauri.app/release/
- [Q7] https://github.com/wailsapp/wails/issues/5844 · https://v3.wails.io/status/
- [Q8] https://github.com/electron-userland/electron-builder/blob/master/website/docs/nsis.md
- [Q9] https://v2.tauri.app/start/prerequisites/
- [Q10] https://github.com/Brooooooklyn/canvas
- [Q11] https://neutralino.js.org/docs/
- [Q12] https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/targets/win/nsis/nsisOptions.ts · …/src/options/CommonWindowsInstallerConfiguration.ts
- [Q13] https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/templates/nsis/multiUser.nsh
- [Q14] https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/auto-update.md
- [Q15] https://v2.tauri.app/distribute/windows-installer/
- [Q16] https://www.electronjs.org/docs/latest/api/app
- [Q17] https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/code-signing/code-signing-win.md
- [Q18] https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/NsisUpdater.ts · https://github.com/electron-userland/electron-builder/blob/master/.changeset/publisher-name-verification-guard.md
- [Q19] https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/distribution-feature-status
- [Q20] https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview
- [Q21] https://v2.tauri.app/plugin/updater/
- [Q22] https://www.blender.org/download/
- [Q23] https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- [Q24] https://nodejs.org/api/os.html
- [Q25] https://www.npmjs.com/package/koffi
- [Q26] https://learn.microsoft.com/en-us/sysinternals/downloads/pssuspend
- [Q27] https://github.com/astral-sh/uv/releases
- [Q28] https://docs.astral.sh/uv/reference/storage/
- [Q29] https://github.com/astral-sh/python-build-standalone/releases (Release 20260924)
- [Q30] https://gregoryszorc.com/docs/python-build-standalone/main/running.html
- [Q31] https://github.com/modelcontextprotocol/typescript-sdk (README, main = v2)
- [Q32] https://www.npmjs.com/package/@modelcontextprotocol/sdk · https://www.npmjs.com/package/@modelcontextprotocol/server
- [Q33] https://modelcontextprotocol.io/docs/develop/connect-local-servers
- [Q34] https://www.electronjs.org/docs/latest/api/environment-variables
- [Q35] https://www.electronjs.org/docs/latest/tutorial/fuses
- [Q36] https://code.claude.com/docs/en/headless
- [Q37] https://sharp.pixelplumbing.com/api-constructor
- [Q38] https://github.com/samizdatco/skia-canvas
- [Q39] https://github.com/google/fonts (ofl/anton, ofl/bebasneue, apache/luckiestguy, ofl/bangers, ofl/lilitaone, ofl/archivoblack, ofl/titanone – METADATA.pb)
- [Q40] https://github.com/danielgatis/rembg (Lizenz MIT, Release v2.0.85)
- [Q41] https://github.com/danielgatis/rembg (README: Modelle, Installation)
- [Q42] https://huggingface.co/ZhengPeng7/BiRefNet · https://github.com/ZhengPeng7/BiRefNet
- [Q43] https://huggingface.co/onnx-community/BiRefNet_lite-ONNX · https://huggingface.co/onnx-community/BiRefNet-ONNX
- [Q44] https://huggingface.co/senty-au/BiRefNet_lite-ONNX-dynamic
- [Q45] https://huggingface.co/briaai/RMBG-2.0
- [Q46] https://huggingface.co/facebook/sam2.1-hiera-tiny · https://github.com/facebookresearch/sam2
- [Q47] https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- [Q48] https://github.com/Tau-J/rtmlib
- [Q49] https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/LICENSE
- [Q50] https://github.com/shubham-goel/4D-Humans
- [Q51] https://github.com/MotrixLab/SMPLer-X
- [Q52] https://smpl.is.tue.mpg.de/modellicense.html
- [Q53] https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- [Q54] GitHub-Repo-Metadaten (Lizenz/Aktivität via GitHub-API): sb-ai-lab/EmotiEffLib, justinshenk/fer, RapidAI/RapidOCR, lokesh/color-thief, ultralytics/ultralytics, lllyasviel/IC-Light, kijai/ComfyUI-IC-Light, qiuqiangkong/audioset_tagging_cnn, xzdarcy/react-timeline-editor, katspaugh/wavesurfer.js, clauderic/dnd-kit; npm: @dnd-kit/core, @dnd-kit/react, wavesurfer.js, @xzdarcy/react-timeline-editor
- [Q55] https://github.com/PaddlePaddle/PaddleOCR · https://pypi.org/project/paddleocr/
- [Q56] https://huggingface.co/blog/baidu/ppocrv5
- [Q57] https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine
- [Q58] https://github.com/Comfy-Org/ComfyUI (README, Release v0.37.0)
- [Q59] Hugging-Face-API-Metadaten: black-forest-labs/FLUX.1-schnell, FLUX.1-dev, FLUX.2-dev, stabilityai/stable-diffusion-xl-base-1.0, stable-diffusion-3.5-large/-medium, Qwen/Qwen-Image, Kim2091/UltraSharp, openai/whisper-large-v3-turbo, primeline/whisper-large-v3-turbo-german
- [Q60] https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- [Q61] https://stability.ai/community-license-agreement
- [Q62] https://github.com/xinntao/Real-ESRGAN
- [Q63] https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-videocontroller
- [Q64] https://github.com/SYSTRAN/faster-whisper (README)
- [Q65] https://github.com/ggml-org/whisper.cpp/releases
- [Q66] https://github.com/ggml-org/whisper.cpp (README)
- [Q67] https://developers.openai.com/api/docs/guides/speech-to-text
- [Q68] https://developers.openai.com/cookbook/examples/whisper_prompting_guide
- [Q69] https://github.com/nyrahealth/CrisperWhisper · https://huggingface.co/nyralabs/CrisperWhisper2.0_large
- [Q70] https://ffmpeg.org/ffmpeg-filters.html (zoompan, crop, scale, subtitles, silencedetect, scdet, ebur128, select)
- [Q71] https://github.com/snakers4/silero-vad
- [Q72] https://www.scenedetect.com/docs/latest/api/detectors.html
- [Q73] https://www.tensorflow.org/hub/tutorials/yamnet
- [Q74] https://github.com/lay295/TwitchDownloader
- [Q75] https://github.com/xenova/chat-downloader
- [Q76] https://support.google.com/youtube/answer/1722171?hl=en
- [Q77] https://support.google.com/youtube/answer/9884579?hl=en
- [Q78] https://helpx.adobe.com/premiere-pro/using/importing-xml-project-files-final.html (Suchergebnis-Auszug; direkter Abruf 403)
- [Q79] https://www.gyan.dev/ffmpeg/builds/
- [Q80] https://github.com/BtbN/FFmpeg-Builds/releases
- [Q81] https://www.sqlite.org/howtocorrupt.html
- [Q82] https://support.microsoft.com/en-us/office/duplicate-files-in-onedrive-fd47ce5e-8dd0-465e-9e3a-461e1a3cf613 · https://learn.microsoft.com/en-us/troubleshoot/sharepoint/sync/troubleshoot-sync-issues
- [Q83] https://fullcalendar.io/license
- [Q84] https://minecraft.wiki/w/Mojang_API
- [Q85] https://www.minecraft.net/en-us/usage-guidelines
- [Q86] https://github.com/gitleaks/gitleaks/releases
- [Q87] https://github.com/gitleaks/gitleaks (README)
