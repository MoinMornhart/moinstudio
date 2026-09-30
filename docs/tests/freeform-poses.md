# Freiform-Test: 50 ungewöhnliche Beschreibungen

Stand 30.09.2026, Version 0.29.5 (VM ohne GPU, Cycles auf der CPU mit 16 Samples, Claude über das Abo).

Nach Philips Regel muss das Thumbnail jede frei formulierte Beschreibung umsetzen können. Keine feste Posen-, Orts- oder Requisitenliste darf die Grenze sein. Deshalb liefen 50 ungewöhnliche Beschreibungen aus seinen echten Inhalten durch den **echten Thumbnail-Auftrag**: Claude plant frei, Blender rendert, danach Selbstprüfung und Korrekturschleife. Die Beschreibungen umfassen:

- seltene Biome und Strukturen
- ungewöhnliche Posen und Handlungen
- Mobs
- Szenen mit SimPell
- Reaktionen

Jedes Bild habe ich selbst angesehen und streng bewertet:

- **gut**: Die Beschreibung ist auf einen Blick zu erkennen.
- **mittel**: Die Beschreibung ist erkennbar, aber etwas Wichtiges fehlt oder ist schwach.
- **schwach**: Der Kern der Beschreibung fehlt.

Bilder und Szenen liegen nur lokal unter `test-output/freeform/`, nie im Repo. Der Test lässt sich mit `npx vitest run -c vitest.echt.config.ts tests/echt/freeform.test.ts` wiederholen.

**Ergebnis: 28 gut, 21 mittel, 1 schwach.** Kein Fall bricht mehr ab. Im Schnitt dauert ein Fall 120 s mit einer Variante. Insgesamt gab es 25 Korrekturen durch die Selbstprüfung.

## Verlauf

Der erste Durchlauf (vereinfachter Test ohne Korrekturschleife) war schlecht. Etwa 5 von 24 Bildern trafen die Beschreibung. Gefundene Fehler und ihre Behebung:

| Fehler | Ursache | Behebung (Version) |
|---|---|---|
| Kirschblüten grün, Mooshroom als normale Kuh, Creaking als Enderman | Claude sah nur 60 Beispiel-Blöcke und kannte die Regel „nie ersetzen“ nicht | vollständige Blockliste, typische Blöcke je Ort als Beispiele, Mobs nie ersetzen (0.29.2) |
| Yoga als „taumeln“, Handstand schwebt | `posen_korrektur` war Claude nicht erklärt | freie Posen mit allen Gelenken und `kippen` erklärt (0.29.2) |
| nur ein großer Kopf, Ort und Handlung unsichtbar | Kamera-Modus „nah“ für alles | neuer Modus „ganz“ für Orte und Körperhaltungen, Gesten mit „brust“ (0.29.2, 0.29.5) |
| weißes Bild (Eisspitzen, Wüstentempel) | Kamera auf helle Fläche, keine Prüfung | Bildprüfung „überstrahlt/leer“ als ernster Fehler mit Korrektur (0.29.2) |
| `pink_petals`, `waxed_copper_grate`, `glass_pane`, `pointed_dripstone` unbekannt oder Absturz | Blockliste aus Modellen statt Blockstates, neues `sprite`-Format, leere Modellvorlagen | Blockstates als Quelle; alle 1288 Blöcke der Spieldatei geprüft, nur `barrier`, `light` und `structure_void` bleiben ausgeschlossen, weil sie im Spiel unsichtbar sind (0.29.2–0.29.4) |
| Blütenblätter als schwarze Würfel | Bodendecker als Würfel ohne Transparenz | flach wie Pflanzen (0.29.4) |
| Handstand über statt auf dem Creeper | Claude muss Höhen selbst schätzen | Feld `auf` (Figur steht auf Mob oder Objekt, Höhe automatisch) (0.29.3) |
| keine Kürbis-Verkleidung | Block auf dem Kopf nicht möglich | Feld `kopf`, Blöcke mit Vorderseite (Kürbisgesicht) (0.29.3) |
| Wölfe hinter Philip versteckt | Prüfung kannte nur „im Bild“, nicht „verdeckt“ | Sichtstrahlen je Mob-Art, verdeckt = ernster Fehler (0.29.4) |
| Facepalm galt als Fehler | Regel „Gesicht immer frei“ | Ausnahme mit `gesicht_frei: false` (0.29.5) |
| Absturz bei Position `[x, y, z]` und Entity ohne Geometrie | fehlende Absicherung | dritter Wert als Höhe, leere Entities übersprungen (0.29.5) |
| Warden in der Nacht unsichtbar | Fülllicht für Themen-Mobs zu schwach | Fülllicht verstärkt (0.29.6) |

## Alle 50 Fälle (Endstand)

| # | Beschreibung | Art | Bewertung | Bemerkung |
|---|---|---|---|---|
| 1 | Ancient City im Deep Dark, Sculk-Kreischer geht los | Welt | mittel | Sculk, Kreischer, Warden da; sehr dunkel, Kopf groß |
| 2 | Landung mit der Elytra auf einer End City | Welt | gut | Purpur, Endstein, Flugpose |
| 3 | Pilzinsel mit Mooshrooms | Welt | gut | rote Mooshrooms, Myzel, Ozean |
| 4 | Klettern auf die höchste Eisspitze | Welt | gut | Eisspitzen, Kletterpose |
| 5 | Portalraum, letztes Enderauge | Welt | gut | Endportalrahmen, Enderauge in der Hand |
| 6 | Kirschblütenhain, Blätter fallen | Welt | gut | rosa Laub und Blütenblätter |
| 7 | Pale Garden, Creaking hinter mir | Welt | gut | Creaking, blasse Eichen |
| 8 | Wüstentempel, TNT-Druckplatte | Welt | mittel | Tempel erkennbar, sehr hell |
| 9 | Weltspawn, erster Grasblock | Welt | gut | Tag-1-Stimmung |
| 10 | Trial Chamber, Breeze greift an | Welt | mittel | Kupfer und Tuff da, Breeze kaum erkennbar |
| 11 | Waldanwesen voller Magier | Welt | mittel | Magier da, Laterne nah am Gesicht |
| 12 | Tafelberge der Badlands bei Sonnenuntergang | Welt | gut | Terrakotta-Schichten |
| 13 | Mangrovensumpf, Frosch auf dem Kopf | Welt | mittel | Frosch auf dem Kopf; Sumpf wenig typisch |
| 14 | üppige Höhle mit Leuchtbeeren und Azaleen | Welt | gut | Leuchtbeeren, Moos, Azaleen |
| 15 | Balancieren über Tropfsteine | Welt | mittel | Pose da, Tropfsteine kaum sichtbar |
| 16 | Handstand auf dem Kopf eines Creepers | Pose | gut | steht kopfüber auf dem Creeper |
| 17 | Yoga auf einem Heuballen im Dorf | Pose | mittel | Yoga im Dorf, nicht auf dem Heuballen |
| 18 | mit dem Boot einen Wasserfall hinunter | Pose | mittel | Wasserfall da, Boot nur als Gegenstand |
| 19 | auf einem Schreiter über den Lavasee | Pose | mittel | Schreiter und Lava da, Philip reitet nicht |
| 20 | Bett im Nether explodiert | Pose | mittel | Explosion wirft Philip, Bett kaum sichtbar |
| 21 | Warden aus dem Wasser angeln | Pose | mittel | Warden und Angel da (nach stärkerem Fülllicht) |
| 22 | Klettern am Gerüstturm | Pose | gut | Kletterpose am Turm |
| 23 | MLG mit dem Wassereimer | Pose | gut | Fall von oben, Eimer |
| 24 | mit Kürbis als Enderman verkleidet | Pose | gut | Kürbiskopf zwischen Endermen |
| 25 | Lore mit TNT in eine Mine schieben | Pose | gut | Lore, TNT, Minengang |
| 26 | Schnüffler-Ei über eine Schlucht tragen | Pose | gut | Ei, Brücke, Schnüffler |
| 27 | mit einer Hand an der Kante des Ends | Pose | mittel | End da, Hängen nicht klar |
| 28 | Tanz mit dem Allay an der Notenblock-Bühne | Pose | gut | Allay, Notenblöcke |
| 29 | Netherportal aus Holz funktioniert nicht | Pose | gut | Holzrahmen, Feuerzeug |
| 30 | goldener Apfel, Wither schießt | Pose | gut | Apfel, Wither, rote Stimmung |
| 31 | Enderdrache auf dem Portal, Bogen | Mob | gut | Drache und Bogen |
| 32 | Riesen-Schleim hüpft auf mich zu | Mob | mittel | großer Schleim, nicht riesig nah |
| 33 | Wolfsrudel beschützt mich vor Skeletten | Mob | mittel | Wölfe da, Skelett teils verdeckt |
| 34 | Phantom greift in der Nacht an | Mob | **schwach** | Phantom nur als dunkle Silhouette |
| 35 | Älterer Wächter feuert Laser | Mob | mittel | Wächter da, kein Laser |
| 36 | Piglin-Barbar in der Bastion | Mob | gut | Barbar, Bastion, Lava |
| 37 | Kamelritt in der Wüste, Husk jagt | Mob | gut | Kamel, Husk, Wüste |
| 38 | Ravager rammt die Holzhütte | Mob | gut | Ravager an der Hütte |
| 39 | Elytra-Wettflug mit SimPell | Duo | mittel | beide in der Luft, Elytras nicht sichtbar |
| 40 | SimPell zieht mich an der Leine hinter dem Boot | Duo | mittel | Leine und Wasser, Boot aus Blöcken |
| 41 | Rücken an Rücken gegen Zombies | Duo | gut | Kampf, Zombies ringsum |
| 42 | SimPell schubst mich in den Brunnen | Duo | gut | Dorfbrunnen, Schubser |
| 43 | Wettbauen, SimPells Haus schöner | Duo | gut | Haus, SimPell jubelt |
| 44 | Torte zum Geburtstag | Duo | gut | Torte, SimPell |
| 45 | Verstecken im Heuhaufen | Duo | mittel | Heu und SimPell, Philip nicht im Heu |
| 46 | Hände vors Gesicht, Haus abgebrannt | Reaktion | gut | Facepalm vor brennendem Haus |
| 47 | Lachen, SimPell in der Lava | Reaktion | mittel | Lava da, SimPell kaum sichtbar |
| 48 | schockiert auf leuchtenden Diamantblock zeigen | Reaktion | mittel | Diamantblock am Rand |
| 49 | Schulterzucken vor kaputtem Redstone | Reaktion | mittel | Redstone da, Geste klein |
| 50 | Jubel mit beiden Armen nach dem Wither | Reaktion | gut | Arme oben, Wither im Hintergrund |

## Bekannte Schwächen (werden weiter verbessert)

- **Dunkle Mobs am Nachthimmel** (Phantom): trotz Fülllicht nur als Silhouette. Möglicher Ansatz ist Mondlicht als Randlicht auf fliegende Mobs.
- **„Auf etwas sitzen oder reiten“** bei Tieren (Schreiter, Kamel): Das Feld `auf` wird noch nicht immer genutzt.
- **Fahrzeuge und Betten:** Boot und Bett erscheinen nur als Gegenstand in der Hand oder als Block-Nachbau.
- Claude wählt oft die Nahaufnahme. Das passt zum Stil großer Kanäle, lässt aber Nebenmobs klein wirken.
