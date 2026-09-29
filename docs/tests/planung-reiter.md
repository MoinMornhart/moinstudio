# Test: Reiter Planung (ROADMAP 7.2–7.7)

Stand 29.09.2026, VM ohne GPU, Claude über das Abo. Die Abläufe wurden in der echten App mit Prüfschritten
(`MOIN_SCREENSHOT_SCHRITTE`) durchgeklickt. Bilder und Testdaten liegen nur lokal unter `test-output/`.

## Automatische Tests

| Datei | Inhalt | Tests |
|---|---|---|
| `planung-karten.test.ts` | Speichern, Ändern ohne Datenverlust, Reihenfolge, Neu-Durchzählen, Konfliktkopien OneDrive/iCloud, Ordner-Beobachtung | 9 |
| `planung-kalender.test.ts` | Tage über Zeitumstellung und Jahreswechsel, Monatsraster, Termin verschieben, freie Termine, Rhythmus lesen | 5 |
| `planung-verbindung.test.ts` | Weiterrücken nach Import, Export und Thumbnail-Wahl; nie zurück, nie über „Upload“ hinaus; alte Karten | 3 |
| `planung-ideen.test.ts` | Wiederholungen erkennen, Prompt je Kanal, Wochenplan prüfen, Ideen-Auftrag mit Claude-Attrappe | 4 |
| `mcp-planung.test.ts`, `mcp.test.ts` | Werkzeug `planning` mit und ohne laufende App | 6 |

## Durchlauf Karte → Schnitt → Thumbnail → Upload (7.5)

Testvideo „sprache“ (53 s, TTS) im Test-Datenordner:

1. Karte „Test: Ein Creeper überrascht mich in der Diamanthöhle“ in „Aufnahme“ angelegt, mit dem Schnitt-Projekt verbunden.
2. Export gestartet. Nach dem Export rückte die Karte von selbst nach „Thumbnail“. Titel („Creeper sprengt fast mein ganzes Haus! 😱 Minecraft“), Beschreibung und Kapitel wurden übernommen.
3. „Thumbnail erstellen“ aus der Karte: 3 Varianten nach 864 s (CPU-Render). Das erste Bild erschien als Vorschau auf der Kachel.
4. Variante gewählt: Die Karte rückte nach „Upload“.

Dabei gefunden und behoben: Im Aufnahme-Modus liefen keine Aufträge. Prüfabläufe starten die Aufgabenliste jetzt.

## Ideen, Titel und Wochenplan mit Claude (7.6)

| Anfrage | Dauer | Ergebnis |
|---|---|---|
| 10 Ideen MoinMornhart | 28 s | 10 verschiedene Formate (Challenge, Duell, Mythen, Speedrun, Streich, Survival), alle Minecraft, SimPell als einziger Mitspieler, keine Wiederholung der 8 vorhandenen Karten |
| 10 Ideen MoinMorni (1. Versuch) | 28 s | **Fehler:** 8 von 10 waren Minecraft-Challenges wie auf dem Hauptkanal |
| 10 Ideen MoinMorni (nach Korrektur) | ca. 30 s | 5 Reactions (Community-Tode, erste Streams, TikTok-Hacks, Fails mit SimPell, Fan-Art), 5 Stream-/Koop-Highlights (Phasmophobia, PEAK, R.E.P.O., Getting Over It, Split Fiction) |
| Ideen mit Wunsch „mit SimPell, eher kurze Challenges“ | 40 s | 10 kurze Challenges, alle mit SimPell |
| 5 Titel für „SimPell verrät mich …“ | 14 s | 5 Ansätze (Großschrift-Spannung, Frage, Zahl, Gegensatz, Ich-Perspektive) |
| Wochenplan | 10 s | 2 Karten auf freie Termine des richtigen Kanals, 3 Aufnahme-Empfehlungen, Hinweis auf fehlende MoinMorni-Ideen |

Korrektur: Claude bekommt jetzt feste Regeln je Kanal (MoinMornhart nur Minecraft; MoinMorni mindestens 4 Reactions,
mindestens 3 Stream-Highlights oder andere Spiele, höchstens 2 Minecraft). Außerdem sieht Claude die Karten des anderen
Kanals, damit sich Haupt- und Zweitkanal nicht wiederholen.

## Offen

- Abnahme durch Philip mit seinen echten Videos und Plänen (7.7).
