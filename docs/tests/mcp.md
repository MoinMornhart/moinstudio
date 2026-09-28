# Test: MCP-Server für Claude Desktop und Claude Code (ROADMAP 2.10)

Datum: 2026-09-26 · Rechner: Entwicklungs-VM · Claude Code 2.1.283 (Abo: Max)

## Aufbau

Claude Desktop / `claude -p` → startet `MoinStudio.exe <app.asar>\out\main\mcp.js` (mit `ELECTRON_RUN_AS_NODE=1`) → MCP über stdio → Named Pipe `\.\pipe\moinstudio-<benutzer>` mit Zufalls-Token → laufende App. Läuft die App nicht, startet der MCP-Server sie selbst.

Werkzeuge: `status`, `jobs_list`, `job_get`, `job_control`, `job_image` (Bild verkleinert als JPEG + Pfad), `render_probe`.

## Ergebnisse

| Prüfung | Ergebnis |
|---------|----------|
| Unit-Tests (`tests/unit/mcp.test.ts`): Konfig-Merge (andere Server bleiben, BOM, Fehlformat), MSIX-Pfaderkennung mit Backup, Pipe (parallel, Fehler, falsches Token), Werkzeuge über den offiziellen MCP-Client | ✅ 9/9 |
| Gepackte App: `MoinStudio.exe …\app.asar\out\main\mcp.js` beantwortet `initialize` und `tools/list` | ✅ „moinstudio 0.0.19“, 6 Werkzeuge |
| **Echter Ende-zu-Ende-Test:** App läuft, `claude -p` (Haiku, Abo) mit `--mcp-config` ruft `mcp__moinstudio__status` auf | ✅ Antwort „Version 0.0.19, Video-Encoder libx264“, 2 Turns, 6 368 Cache-Tokens |

## Nicht automatisch getestet

- Eintrag in Claude Desktop (`claude_desktop_config.json`): Die Funktion ist per Unit-Test geprüft, auf diesem Rechner aber bewusst nicht ausgeführt, um Philips Claude-Desktop-Konfiguration nicht mit einem Entwicklungspfad zu belegen. In der installierten App: Einstellungen → Claude → „Mit Claude Desktop verbinden“, danach Claude Desktop komplett neu starten.
- `.mcpb`-Paket (Desktop Extension) als alternativer Installationsweg: später (ROADMAP 2.10, optional).
