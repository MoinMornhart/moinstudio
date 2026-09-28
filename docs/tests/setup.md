# Test: Einrichtungsassistent (ROADMAP 2.11)

Datum: 2026-09-26 · Rechner: Entwicklungs-VM

Aufgenommen mit `MoinStudio --moin-screenshot=<ordner> --moin-screenshot-setup` (alle 6 Schritte), geprüft:

| Schritt | Inhalt | Ergebnis |
|---------|--------|----------|
| 1 Willkommen | Überblick, „jeder Schritt lässt sich überspringen“ | ✅ |
| 2 Datenordner | Ordnerwahl, Unterordner bei fremden Dateien, Konfliktanzeige | ✅ |
| 3 Claude | Claude Code gefunden (2.1.283), Anmeldung per Abo (Max), Knopf „Mit Claude-Konto anmelden“ (öffnet `claude auth login` im Terminal) nur wenn nötig, „Mit Claude Desktop verbinden“ bzw. Download-Link, falls Claude Desktop fehlt | ✅ |
| 4 Werkzeuge & Hardware | „Jetzt automatisch einrichten“ lädt uv, führt den Hardware-Test aus (inkl. Blender/FFmpeg-Download), Ergebnis mit Begründungen, installierter Rückfall Blender 4.5.9 sichtbar | ✅ |
| 5 Adobe | „Kein Adobe gefunden – alles gut“ (kein Fehler, Modus ohne Adobe) | ✅ |
| 6 Fertig | Hinweise zu Updates, SmartScreen/Smart App Control, Rechenlast-Pause, Usage Credits | ✅ |

Der Assistent erscheint, solange `setupCompleted` in `%APPDATA%\MoinStudio\settings.json` nicht gesetzt ist, und lässt sich über Einstellungen → „Einrichtung erneut starten“ wiederholen. Der Hardware-Test startet in der installierten App beim ersten Start automatisch im Hintergrund. Im Assistenten ist dann schon der Fortschritt zu sehen.
