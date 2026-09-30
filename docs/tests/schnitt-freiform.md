# Schnitt: freie Wünsche (ROADMAP E.4)

Test: `tests/echt/schnitt-wuensche.test.ts` mit 30 frei formulierten Wünschen an zwei echten Testprojekten. Das Projekt
„sprache“ ist eine Minecraft-Aufnahme mit Sprache (53 s), das Projekt „stream“ ein Stream-Ausschnitt (≈ 95 s). Vor jedem
Wunsch wird der Ausgangsschnitt zurückgesetzt. Claude bekommt dafür:

- das Transkript
- die lauten Momente
- die aktuellen Effekte
- die Effekt-Bausteine
- einen Sichtbogen mit Standbildern

Danach wird die Vorschau gerendert und es werden zwei Bilder daraus geprüft. Die Ergebnisse liegen lokal in
`test-output/schnitt-wuensche/NN` (nicht im Repo).

Bewertung: **gut** = so umgesetzt, wie man es erwartet. **mittel** = sinnvoll umgesetzt, aber mit einer Schätzung oder
Einschränkung, die Claude in der Antwort offen nennt.

| Nr | Wunsch | Bausteine | Bewertung |
|---:|---|---|---|
| 1 | Mach mir ein geiles Intro | intro (3 Momente, Wusch, Titelkarte) | gut |
| 2 | Zeitlupe, wenn der Creeper explodiert | tempo, geraeusch, blitz, wackeln | mittel: Im Testvideo ist keine Explosion zu sehen, Claude legt die Zeitlupe auf „Schnell weg hier“ und sagt das |
| 3 | Mehr Action! | intro, text, geraeusch, zoom, blitz, wackeln, farbe, tempo | gut |
| 4 | Mach es lustiger, so wie bei Paluten | intro, text, geraeusch, zoom, einfrieren, farbe, wackeln, blitz, tempo | gut |
| 5 | Wenn ich „Oh nein“ sage, soll das Bild wackeln und es soll knallen | wackeln, geraeusch | gut |
| 6 | Am Anfang eine Schwarzweiß-Rückblende | farbe, text, uebergang, geraeusch | gut |
| 7 | Friere das Bild ein, wenn der Creeper auftaucht, und schreib WAS?! drauf | einfrieren, text, geraeusch | gut |
| 8 | Blende am Ende langsam schwarz aus | abblende | gut, nach Nachbesserung (siehe unten) |
| 9 | Zensier das erste Wort, das ich sage | zensur | gut |
| 10 | Den Teil mit den Fackeln doppelt so schnell | tempo | gut |
| 11 | Zoom auf mein Gesicht, wenn ich überrascht bin | zoom (auf die Facecam links) | gut |
| 12 | Pack einen Fail-Sound rein, wenn das Haus weg ist | Stelle zurückgeholt, geraeusch | gut |
| 13 | Titel am Anfang: Mein erstes Haus | text, geraeusch | gut |
| 14 | Mach alles rot, wenn es gefährlich wird | farbe | gut |
| 15 | Kinoreif: warme Farben und am Anfang eine Titelkarte | farbe, intro | gut |
| 16 | Ein Trommelwirbel vor der Explosion | geraeusch, zoom, blitz, wackeln | gut |
| 17 | Mach ein Intro wie bei BastiGHG | intro | gut |
| 18 | Lass Emojis durchs Bild fliegen | text, geraeusch, wackeln | mittel: Die Minecraft-Schrift hat keine Emojis, Claude weicht auf Ausruf-Texte aus und sagt das |
| 19 | Mach das Video spannender, ohne etwas rauszuschneiden | intro, geraeusch, text, zoom, blitz, wackeln, farbe, tempo | gut |
| 20 | Die ersten zwei Sätze raus und dafür ein kurzes Intro | Schnitt, intro | gut |
| 21 | Mach ein Intro aus den besten Momenten des Streams | intro | gut |
| 22 | Zeitlupe bei der Explosion mit Knall und Wackeln | tempo, geraeusch, blitz, wackeln | gut |
| 23 | Schreib DIAMANTEN! wenn ich die Diamanten finde, mit Kaching | Stelle zurückgeholt, text, geraeusch | gut |
| 24 | Mach die langweiligen Stellen schneller | tempo | gut |
| 25 | Herzschlag, wenn es spannend wird | geraeusch | gut |
| 26 | Mach es wie einen Horrorfilm | farbe, uebergang, geraeusch, text, zoom, blitz, wackeln | gut, nach Nachbesserung (Mindestgröße für Text) |
| 27 | Kurze Blitze bei jedem lauten Moment | blitz | gut |
| 28 | Am Anfang eine Titelkarte „Stream-Highlights“ | intro (Titelkarte) | gut |
| 29 | Zensier die Stelle, wo ich fluche | zensur | mittel: Im Transkript steht kein Schimpfwort, Claude zensiert die nicht mitgeschriebene Lücke und sagt das |
| 30 | Mach aus dem Ende einen Cliffhanger mit Standbild und Trommelwirbel | geraeusch, zoom, wackeln, farbe, einfrieren, text | gut |

**Ergebnis: 27 gut, 3 mittel, 0 schwach.** Alle 30 Wünsche wurden umgesetzt und gerendert.

## Gefundene Fehler und Behebung

- **#8 Ausblenden:** Es gab nur den Baustein `uebergang` (kurz dunkel, dann wieder hell). Neu ist der Baustein `abblende`
  mit `richtung aus|ein`: Das Bild bleibt schwarz, der Ton blendet mit aus. Beim ersten Versuch hielt Claude außerdem den
  letzten gesprochenen Satz für das Ende. Deshalb stehen jetzt die behaltenen Abschnitte samt echtem Anfang und Ende in der
  Anweisung, dazu die Regel „am Ende = Ende des fertigen Videos“. Nachmessung der Helligkeit: bis 26,5 s normal,
  bei 27,5 s halb, bei 28,7 s schwarz (Videolänge 28,9 s).
- **#26 winziger Text:** Die Textgröße ist jetzt mindestens 0,07 der Bildhöhe, 0,12 ist der Standard.
- **Explosion nicht erkennbar:** Claude sah vorher nur Text und Lautstärke. Jetzt bekommt es einen Sichtbogen mit 40 bzw.
  80 Standbildern und darf ihn ansehen.
- **iCloud-Konfliktkopien:** Die Wünsche 26–30 scheiterten zuerst, weil iCloud `projekt.json` in `projekt 2.json`
  umbenannt hatte. `liesMitKonfliktkopien` repariert das jetzt beim Lesen.
