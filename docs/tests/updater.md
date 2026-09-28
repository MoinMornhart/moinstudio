# Test: Release-Pipeline und Update-Funktion (ROADMAP 2.3 + 2.4)

Datum: 2026-09-26 · Rechner: Entwicklungs-VM (Windows 11 Pro 26200, kein Admin)

## Release-Pipeline (GitHub Actions)

| Prüfung | Ergebnis |
|---------|----------|
| `CI` läuft bei jedem Push auf `windows-latest` (Typen, Lint, Tests, Build) | ✅ |
| `Release` baut den Installer und veröffentlicht `MoinStudio-Setup-x.y.z.exe`, `.blockmap` und `latest.yml` | ✅ ab v0.0.12 |
| Genau **ein** Release pro Version | ✅ ab v0.0.12 (vorher doppelt, siehe unten) |
| Release-Notizen kommen aus dem CHANGELOG | ✅ |
| Version in `package.json` muss zum Tag passen | ✅ Prüfschritt im Workflow |

**Gefundener Fehler:** v0.0.9 bis v0.0.11 wurden doppelt angelegt. electron-builder lädt Installer und blockmap parallel hoch, jeder Upload sah „Release existiert nicht“ und legte ein eigenes an. Der erste Fix-Versuch in 0.0.11 (Override entfernen) war wirkungslos. Die echte Lösung kam in 0.0.12: Der Workflow legt das Release vorher als Entwurf an und veröffentlicht es am Ende. Die kaputten Test-Releases wurden gelöscht, die Tags blieben erhalten.

## Update-Funktion (echter Durchlauf)

1. v0.0.12 aus dem GitHub-Release heruntergeladen und still installiert (`/S /currentuser`) → ✅
2. `MoinStudio.exe --moin-update=check` → Log: „neueste Version 0.0.13, Update verfügbar: true“ → ✅
3. `MoinStudio.exe --moin-update=install` → heruntergeladen (SHA-512 geprüft), still installiert, ohne Admin → „Apps & Features“ zeigt 0.0.13, `MoinStudio.exe` hat Dateiversion 0.0.13 → ✅
4. Erneuter Check auf 0.0.13 → „Update verfügbar: false“ → ✅
5. Deinstallation → ✅

In der Oberfläche übernehmen dieselben Aufrufe das Banner „Neue Version verfügbar“ und die Karte „Updates“ in den Einstellungen.

**Offen:** SmartScreen- und Smart-App-Control-Verhalten auf PC und Laptop (ROADMAP 10.2).
