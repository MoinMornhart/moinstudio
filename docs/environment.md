# Entwicklungsumgebung

Stand: 2026-09-26 (Phase 0). Geprüft auf dem Rechner, auf dem MoinStudio aktuell entwickelt wird.

## System

| Punkt | Befund | Bewertung |
|-------|--------|-----------|
| Windows | Windows 11 Pro 10.0.26200 (Build 26200) | ok |
| Hardware | **QEMU-VM** (Q35 + ICH9), virtuelle CPU, 9,3 GB RAM | Entwicklungs-VM, nicht der Ziel-PC |
| GPU | **keine** (nur „Microsoft Basic Display Adapter“), kein `nvidia-smi` | GPU-Funktionen hier nicht testbar |
| Speicher | C: 11,5 GB frei (69,5 GB belegt) | knapp: Blender portable (~1–2 GB entpackt) passt, lokale Bildmodelle (5–20 GB) nicht |
| Admin-Rechte | **nein** (normaler Benutzer) | alles muss per-user installierbar sein |

## Werkzeuge

| Werkzeug | Version | Pfad / Hinweis | Status |
|----------|---------|----------------|--------|
| Node.js | 24.19.0 LTS | winget `OpenJS.NodeJS.LTS` | vorhanden |
| npm | 11.17.0 | | vorhanden |
| Python | 3.12.14 | über uv (`%USERPROFILE%\.local\bin\python3.12.exe`); `python` im PATH ist nur der Microsoft-Store-Stub | vorhanden (via uv) |
| uv | 0.12.13 | winget `astral-sh.uv` | vorhanden |
| Rust / Cargo | – | nicht installiert; MSVC Build Tools ebenfalls nicht | fehlt (für Electron nicht nötig, siehe `docs/architecture.md`) |
| FFmpeg | 9.0.2 (gyan.dev full build) | winget `Gyan.FFmpeg`, user scope | **in Phase 0 installiert** |
| git | 2.55.0.windows.3 | | vorhanden (globaler `user.name`/`user.email` nicht gesetzt → Repo-lokal gesetzt) |
| GitHub CLI | vorhanden | eingeloggt als `MoinMornhart` (Scopes: repo, workflow, gist, read:org) | ok |
| gitleaks | 8.30.1 | winget `Gitleaks.Gitleaks`, user scope | **in Phase 0 installiert** |
| Blender | – | wird von MoinStudio selbst als portable ZIP von blender.org geladen | fehlt (gewollt) |
| WebView2 | 153.0.4234.x | | vorhanden (für Electron nicht nötig) |

## Claude

| Punkt | Befund |
|-------|--------|
| Claude-Desktop-App | installiert, MSIX-Paket `Claude_1.49585.0.0_x64__pzs8sxrjxfjjc` |
| Claude-Desktop-MCP-Konfiguration | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` (MSIX-virtualisierter Pfad; der klassische Pfad `%APPDATA%\Claude\` existiert hier nicht) |
| Claude Code | 2.1.283, gebündelt in der VS-Code-Erweiterung (`%USERPROFILE%\.vscode\extensions\anthropic.claude-code-2.1.283-win32-x64\...\claude.exe`); **kein** `claude` im PATH |
| Claude-Code-Login | Anmeldedaten vorhanden (`%USERPROFILE%\.claude\.credentials.json`) → Abo-Login. Details und Regeln: `docs/claude-integration.md` |

## Adobe

Keine Adobe-Programme installiert (`C:\Program Files\Adobe` existiert nicht). MoinStudio läuft im Modus **ohne Adobe**; die Adobe-Anbindung wird nur anhand der Recherche gebaut (`docs/research/adobe.md`) und bleibt „ungetestet“.

## Folgen für die Entwicklung

1. **Framework:** Ohne Admin-Rechte und ohne MSVC/Rust ist Electron baubar, Tauri nicht ohne Weiteres. Begründung: `docs/architecture.md`.
2. **Rendern:** Blender kann hier nur auf der CPU rendern (Cycles CPU). Die Pipeline wird so gebaut, dass sie auf dem GPU-Rechner automatisch schneller rendert. Ob EEVEE ohne GPU läuft, wird getestet und dokumentiert.
3. **Lokale Bildmodelle** (ComfyUI, Inpainting, Upscaling) sind auf dieser VM nicht testbar. Sie sind im Konzept ohnehin nur ergänzend und werden als optionales Modul mit Hardware-Erkennung gebaut. Die Tests dafür laufen erst auf Philips PC/Laptop.
4. **Speicherplatz:** Große Downloads (Modelle, Whisper `large`) werden vermieden. Für Tests reichen kleine Modelle (`whisper small`/`base`).
5. **Claude Code CLI** liegt nicht im PATH. Die App sucht die CLI aktiv, unter anderem in den VS-Code-Erweiterungsordnern, in `%USERPROFILE%\.local\bin` und in npm global. Der Einrichtungsassistent bietet sonst die offizielle Installation an.
