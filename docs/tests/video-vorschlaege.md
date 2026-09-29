# Video → Thumbnail-Vorschläge (ROADMAP 5.5)

Ablauf: FFmpeg zieht 32 Standbilder über das ganze Video (4 Bögen × 8 Bilder mit Zeitstempel). Claude sieht nur diese
Bilder (Werkzeug `Read`, beschränkt auf den Auftragsordner), beschreibt den Inhalt und schlägt 3 Thumbnails mit
Zeitpunkt und passenden Freunden aus der Skin-Bibliothek vor. „Dieses Thumbnail erstellen“ startet den normalen Auftrag.

Integrationstest in der echten App: `node scripts/electron.mjs . --moin-video=<pfad.mp4>`

## Testlauf 29.09.2026 (3 Testvideos aus eigenen Renders, je 24–32 s)

| Video | Was Claude erkannt hat | Vorschläge (Auszug) | Passt? |
|---|---|---|---|
| PvP (Kampf-Renders) | roter Himmel mit Diamantschwert, Nachtszene mit Gegner, Wald mit Diamantaxt, Freund im dunklen Skin | „Ich stehe mit meinem Diamantschwert unter dem blutroten Himmel …“, „Ich werde nachts von einem Plünderer verfolgt …“ | ja; es merkt selbst an, dass der Freund nicht sicher SimPell ist |
| Höhle (Lava-Renders) | Zombie über dem Lavasee, Lava-Ozean mit Freund auf einem Block, Piglin im Nether | „Ein Zombie schleicht sich über dem Lavasee von hinten an …“, „Im Nether kommt ein Piglin auf mich zu …“ | ja, Zeitpunkte stimmen |
| Nacht (Grusel-Renders) | Enderman bei Nacht, Creeper direkt neben Philip mit Zombie und Skelett dahinter, Spinne mit roten Augen | „Ein Creeper steht direkt neben mir …“, „Nachts im Wald steht ein Enderman direkt hinter mir …“ | ja |

Ergebnis: Inhalt, Mobs, Orte und Stimmung werden richtig erkannt, die Vorschläge sind Action-Motive im Stil der
Vorbilder, Zeitpunkte stimmen. Offen: Test mit 5 echten Videos von Philip (Gameplay mit Bewegung und Ton) in der Abnahme 5.6.
