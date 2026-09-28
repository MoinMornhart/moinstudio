# Test: Windows-Installer (ROADMAP 2.2)

Datum: 2026-09-26 · Version: 0.0.7 (Build aus dem Arbeitsstand) · Rechner: Entwicklungs-VM (Windows 11 Pro 26200, kein Admin)

| Prüfung | Ergebnis |
|---------|----------|
| `npm run dist` baut `MoinStudio-Setup-<version>.exe` (NSIS, x64) + `.blockmap` + `latest.yml` | ✅ 112 MB |
| Stille Installation `/S /currentuser` ohne Admin-Rechte | ✅ Exit 0, nach `%LOCALAPPDATA%\Programs\MoinStudio` |
| Startmenü-Verknüpfung | ✅ |
| Desktop-Verknüpfung | ✅ |
| Eintrag unter „Apps & Features“ (HKCU Uninstall) | ✅ MoinStudio 0.0.7 |
| Installierte App startet, alle Reiter rendern (Screenshot-Modus) | ✅ |
| Autostart an (`--moin-autostart=on`) → Eintrag `MoinStudio` in `HKCU\…\Run` | ✅ |
| Schalter „Mit Windows starten“ zeigt den Zustand korrekt | ✅ (nach Fix: fester Eintragsname) |
| Autostart aus → Eintrag entfernt | ✅ |
| Stille Deinstallation → App-Ordner, Verknüpfungen, Uninstall-Eintrag entfernt | ✅ |

**Gefundener und behobener Fehler:** Der Autostart-Eintrag hieß beim Setzen `electron.app.MoinStudio`, abgefragt wurde aber ein anderer Name. Deshalb stand der Schalter immer auf „aus“. Jetzt gibt es einen festen Eintragsnamen `MoinStudio`, und die Abfrage läuft über `launchItems`.

**Nicht auf der VM prüfbar:** SmartScreen-Warnung beim Doppelklick-Start aus dem Browser-Download, Smart App Control. Das wird in ROADMAP 10.2 auf PC und Laptop geprüft.
