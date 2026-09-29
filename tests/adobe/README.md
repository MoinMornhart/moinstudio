# Adobe-Test (ROADMAP 8.5/8.6)

Die Adobe-Funktionen von MoinStudio bleiben als **„ungetestet“** markiert, bis dieser Test auf einem Rechner mit Adobe bestanden ist. Das betrifft „Für Premiere“ im Schnitt und „Für Photoshop“ an jeder Thumbnail-Variante. Ohne Adobe läuft der Test trotzdem durch und meldet „übersprungen“.

## Einfach (ohne Entwicklerwerkzeuge)

1. MoinStudio öffnen → **Einstellungen → Adobe → „Selbsttest“**.
2. **Photoshop** wird automatisch geprüft:
   - Photoshop öffnet sich kurz, lädt eine Probedatei mit drei Ebenen und schließt sie wieder, ohne zu speichern.
   - Ergebnis: „bestanden“, „fehler“ oder „übersprungen“.
3. **Premiere:** Es öffnet sich der Ordner mit den Proben. Die Datei `premiere-checkliste.md` führt in fünf Minuten durch den Import und nennt die erwarteten Werte:
   - Länge der Sequenz
   - drei Clips
   - Zoom auf 112 %
   - zwei Marker
   - drei Untertitel
4. Ergebnis (und bei Fehlern ein Bildschirmfoto) an Claude geben. Erst dann wird „ungetestet“ entfernt.

Die Proben liegen lokal unter `%LOCALAPPDATA%\MoinStudio\adobe-test` und enthalten nur ein Testbild und einen Testton. Es ist nichts Privates dabei.

## Für Entwickler

```
npm run test:adobe
```

- Der Befehl erzeugt dieselben Proben unter `test-output/adobe/`.
- Er prüft Photoshop per COM (`Photoshop.Application`) und schreibt `ergebnis.json` und `premiere-checkliste.md`.
- Voraussetzung: MoinStudio war einmal gestartet, damit FFmpeg unter `%LOCALAPPDATA%\MoinStudio\ffmpeg` liegt.

## Was geprüft wird

| Programm | Datei | Prüfung |
|---|---|---|
| Photoshop | `ebenen.psd` (640×360, Ebenen Hintergrund, Figuren, Text) | automatisch: öffnen, Größe und Ebenennamen vergleichen, ohne Speichern schließen |
| Premiere | `sequenz.xml` (FCP7-XML), `untertitel.srt`, `testvideo.mp4` | Checkliste: Import, Länge, Clips ohne Lücke, Zoom-Keyframes, Marker, Untertitel |

Premiere lässt sich ohne Plugin nicht fernsteuern. ExtendScript läuft aus, und UXP-Plugins lassen sich nur mit installiertem Premiere entwickeln (siehe `docs/research/adobe.md`). Deshalb gibt es hier eine Checkliste.
