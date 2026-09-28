# Stilbuch für Minecraft-Thumbnails

Stand: 28.09.2026. Dieses Stilbuch ist die verbindliche Grundlage für Posen, Kamera, Licht, Welt und Compositing in MoinStudio.
Es fasst fünf lokale Einzelanalysen zusammen. Jede Zahl stammt aus diesen Analysen, es wurde nichts ergänzt.

**Gewichtung:** BastiGHG, GommeHD und Paluten zählen am meisten. Castcrafter und der Minecraft-3D-Teil von Papaplatte ergänzen.
OliXP und Stegi sind bewusst **nicht** berücksichtigt.

**Kürzel und Belege:** `Basti 12` bedeutet Thumbnail Nr. 12 aus der BastiGHG-Analyse. Weitere Kürzel sind `Gomme`, `Palu` (Paluten), `Cast` (Castcrafter) und `Papa` (Papaplatte, Nummern wie `M66`, `G45`).
Die Video-ID zu jeder Nummer steht in Abschnitt 13. Die Bilder selbst liegen nur lokal und kommen nie ins Repo.

**Einheiten:** Die Brennweiten gelten für einen 36-mm-Sensor, wie in Blender. Bei den Armwinkeln bedeutet 0°, dass der Arm hängt, 90° waagerecht nach vorn und 180° senkrecht nach oben. Die Kopfbewegungen heißen Drehung (Yaw), Nicken (Pitch) und Neigung (Roll). Alle Winkel und Brennweiten wurden aus den Bildern geschätzt.

---

## 1. Kurzfassung: die 10 wichtigsten Regeln

1. **Die Hauptfigur ist groß und angeschnitten, das Thema steht daneben.** Bei Nahaufnahmen steht die Figur am linken oder rechten Rand. Ihr Kopf füllt 35–55 % der Bildhöhe (Gomme ca. 28 von 57, Cast 10 von 24, Basti 10 von 25). Die andere Bildhälfte gehört dem Thema, also Mob, Bauwerk, Item oder Gefahr. Figur und Thema überdecken sich nicht (Basti 04, 12, 18, 27, 30).
2. **Die Kamera ist ein Weitwinkel nah an der Figur.** Nahaufnahmen haben 20–28 mm, dabei wirken nahe Hände und Items groß. Das Standard-Brustbild hat 30–40 mm. Nahaufnahmen sind nie exakt frontal auf Augenhöhe (Basti 0 von 25).
3. **Der Kopf ist nie starr frontal.** Er ist 15–35° zum Thema gedreht und 5–20° geneigt (Palu 28 von 33, Basti 8 von 10 Nahaufnahmen). Der Rumpf steht in 3/4-Ansicht und ist 20–45° gedreht.
4. **Kopf, Rumpf und Arm zielen auf denselben Punkt** (Gomme alle P1- und P3-Fälle, Palu 18, 19, 29, Cast P1). Nichts schaut ins Leere.
5. **Jeder große Armwinkel braucht einen Grund,** etwa ein Item halten, zeigen, gefesselt sein oder sich abstützen. Pro Figur gibt es höchstens eine große Geste (Cast). Die beiden Arme sind nie spiegelgleich, außer beim frontalen Porträt oder Heldenstand. Zappelnde Glieder gibt es in 0 von 25 Bildern (Basti).
6. **Items liegen flach zur Kamera und diagonal.** Die Schwertklinge steht 30–50° diagonal in der Bildebene, die Spitze zeigt nach außen oder oben und weg vom Gesicht (Gomme, Palu). Ein Item verdeckt nie das Gesicht.
7. **Der Look ist ein sauberer Cycles-Render.** Dazu gehören weiche Sonne (Winkel 2–6°), ein blauer Himmel als Umgebungslicht und sichtbare AO. Jede Würfelkante hat eine feine helle Glanzkante von 1–2 px bei 1280 px Breite. Es gibt keinen farbigen Glow-Rand (alle fünf Kanäle).
8. **Der Hintergrund ist weich, aber nie leer.** Bei Nahaufnahmen gilt Blende f/2–4 mit Fokus auf dem Kopf (Gomme 46 von 57 deutlich unscharf). Ist die Welt selbst das Thema, bleibt sie scharf (f/5,6–8, Cast).
9. **Farbe:** AgX oder Filmic mit mittlerem bis hohem Kontrast und Sättigung +10–30 %. Der Himmel ist kräftiges Cyan-Blau. Grundidee ist ein Komplementärkontrast, also Türkis oder Blau gegen Rot oder Orange. Bloom gibt es nur an echten Lichtquellen.
10. **Text ist die Ausnahme.** Er fehlt bei Palu in 47 von 50 Bildern, bei Gomme in 50 von 57 (Logo nicht mitgezählt), bei Papa in 22 von 29 und bei Basti in 18 von 30. Wenn Text vorkommt, dann 1–3 Wörter, bevorzugt in Minecraft-Pixelschrift und in einer freien Ecke, nie über Gesicht, Item oder Mob. Pfeile und Kreise kommen höchstens einmal vor, rot und dick.

---

## 2. Bildtypen und Formate

### 2.1 Häufigkeit je Kanal

Die Zahlen beziehen sich auf gerenderte Bilder, sofern nichts anderes dasteht. Bei Basti sind es 25 Bilder mit Figur (30 insgesamt), bei Gomme 57, bei Palu 33 Renders (50 insgesamt), bei Cast 24 Renders und bei Papa 11 reine Renders plus 10 Hybride (29 Minecraft-Bilder). „–“ heißt, dass der Typ in der Analyse nicht vorkommt oder nicht gezählt wurde.

| Bildtyp | Basti | Gomme | Palu | Cast | Papa |
|---|---|---|---|---|---|
| **A Kopf-Nahaufnahme mit Thema** (Figur am Rand angeschnitten, Thema in der anderen Hälfte) | 10 von 25 | ca. 28 von 57 (Brustbild oder näher) | 15 von 33 am Rand angeschnitten | 10 von 24 (als Präsentator) | Hauptfigur „oft angeschnitten“ |
| **B Präsentator: zeigt auf ein Objekt oder hält es hin** | 4 von 25 (Item zur Kamera) | 9 von 57 (Zeigen) | 4 Zeigen + 3 Präsentieren | 10 von 24 | 10 Item präsentieren, 2 Zeigen (von 23 Figuren) |
| **C Totale, Figur in der Szene** (Welt ist der Star) | 10 von 25 | ca. 12 von 57 Ganzkörper | 12 von 33 Ganzkörper | 3 Rückenansichten + 5 Action | Ganzkörper nur als Teil einer Szene |
| **D Kampf oder Duell** | 0 | ca. 13 von 57 (01, 02, 09, 16, 22, 23, 24, 27, 39, 41, 44, 48, 56, aus der Tabelle gezählt) | 1 (12, Split-Duell) | 0 | 6 Lauf-, Sprung- und Ausfallposen |
| **E Split oder Vergleich** (vorher/nachher, VS) | 6 + 1 Raster | 0 echte Splits, 3 zweifarbige Hintergründe | 1 | 5 | – (VS-Layout nur bei Nicht-Minecraft-Spielen) |
| **F Gefahr, Abgrund, Falle, Lava** | 06, 18, 27 | 6 von 57 Gruben und Abgründe, dazu Lava 21, 25 | 36 (Falle), 45 (Wasser) | 19 (Loch), 26 (Hang) | – |
| **G Mob-Konfrontation** | echte Mobs in 8 von 30 | echte Mobs in 3 von 57 | Mobs oder Kreaturen in 30 von 50, davon Vanilla in 11 | 1 (22, Piglin-Brute) | echte Modelle (Wölfe, Schwein, Drachenei) |
| **H Gruppe oder Heldenreihe** | 4–5 Figuren in 4 | 4 oder mehr in 13 | 1 (12) | 6 von 24 | 3+ Figuren in 4 |
| **I Rückenansicht vor einem Ziel** | 1 (29) | 2 (19, 28) | 1 (29) | 3 (01, 04, 13) | – |
| **J Verstecken oder Hervorlugen** | 3 (12, 24, 28) | – | – | – | 1 (M70) |
| **K Gefesselt oder Ketten** | Ketten in 10 von 30 | 2 (08, 42) | – | – | – |
| **L Liegen, besiegt, Sturz** | 3 liegend, 2 gekippt | 4 liegend, 4 Sturz | 2 (23, 27) | – | 2 V-Arme im Fallen (G49, M65) |
| **M Egoperspektive mit HUD** | 3 (01, 03, 23) | – | nur rohe Screenshots, kein Vorbild | – | – |

**Nicht übernommen:** Bilder mit Facecam oder echter Person (Palu 11 und 2 von 50, Cast 6 von 30, Papa 18 von 29) und unbearbeitete Ingame-Screenshots (Palu 09, 39, 41, 49). Palu nennt diese Screenshots ausdrücklich „kein Vorbild“.

### 2.2 Wann welcher Typ passt

| Worum es im Video geht | Typ | Beleg |
|---|---|---|
| Ein Ding, ein Mob, ein Bauwerk oder eine Mod steht im Mittelpunkt | A oder B: Figur am Rand, Blick oder Zeigearm zum Ding | Palu 11, 18, 19, 24; Gomme 12, 14, 34, 46; Cast 03, 07, 12, 19 |
| Kampf, Kill, Duell | D: zwei Figuren an den Bildseiten, die Mitte bleibt frei für Schwerter, Herzen oder Pfeil | Gomme 02, 05, 17, 41, 42, 48 |
| Challenge mit Welt oder Ort (Skyblock, Lava, Void) | C oder F, dazu Aufsicht | Gomme 21, 25, 27, 30; Basti 16, 25 |
| Angst, Horror, Bedrohung | A mit Blick zur Bedrohung, Nacht, Untersicht oder Verstecken | Basti 12, 28; Palu 02, 20; Gomme 55 |
| Vorher/Nachher, „X Stunden“, „Tag 1 / Tag 7“ | E | Basti 14, 19; Cast 06, 14, 17, 18 |
| „100 / 1000 Spieler“, Serienstart | H oder eine Menge | Cast 11, 16, 17, 22; Gomme 10, 36 |
| Großes Bauwerk ist fertig | I, Kamera tief | Cast 01, 13 |
| Gefangen, gefesselt, Strafe | K | Basti 05, 06, 09, 13, 27 |
| Tod, Niederlage | L mit X-Augen oder Lidern | Gomme 05, 09, 52; Basti 27 |

Grundsatz: **Jedes Render-Thumbnail erzählt genau eine Aktion, die man in 0,5 s liest** (Papa A1/A2). Die Geschichte tragen Requisiten und Situation, nicht Text (Gomme: TNT und Feuerzeug, Grube, Ketten, Herzen).

---

## 3. Posen-Katalog

Minecraft-Figuren haben keine Ellbogen und keine Knie. Gedreht wird nur an Hals, Schulter und Hüfte. Kein Kanal versucht, einen Ellbogen vorzutäuschen (Cast).

### 3.1 Posen

| # | Pose | Kopf | Rumpf | Arme (Schulter) | Beine | Bedeutung | Belege |
|---|---|---|---|---|---|---|---|
| 1 | **Blick zum Ding** (Nahaufnahme) | Drehung 20–35° zum Objekt, Nicken 5–10° nach unten, Neigung 0–10° | 30–45° zur Kamera gedreht, am Bildrand angeschnitten | hängend oder einer 30–60° nach vorn | nicht sichtbar | Staunen, Neugier, Bedrohung | Palu 02, 11, 20, 24 |
| 2 | **Präsentator / Zeigen** | Drehung 10–40° zum Ziel, Pupillen oder Kopf zum Objekt, Neigung 0–15° | 15–45° zur Seite des Objekts gedreht | Zeigearm 70–95° nach vorn und 30–60° zur Bildmitte, fast waagerecht und parallel zur Bildebene. Der andere Arm hängt (0–20°), ist aus dem Bild oder als Winkgeste 120–150° erhoben | nicht sichtbar | „Seht her“, Thema vorstellen | Gomme 11, 12, 14, 26, 34, 37, 43, 46, 50; Palu 18, 19, 29, 31; Cast 03, 05, 07, 09, 10, 12, 19, 23, 28, 29 |
| 3 | **Schwert oder Axt zur Kamera** | frontal oder bis 20° gedreht, Neigung 10–25°, oft Blick zur Kamera | 10–25° gedreht | Schwertarm 40–80° nach vorn und 20–40° nach innen, zweiter Arm 20–40° vor | – | Kampfbereit, Stärke | Gomme 02, 08, 17, 20, 22, 30, 47; Palu 12, 13, 15, 32, 33 |
| 4 | **Item vor sich betrachten** | 20–30° zum Item gedreht, 10° gesenkt | 3/4-Ansicht | Haltearm 60–80° nach vorn, 20° nach außen | – | Plan, Idee, „gleich passiert was“ | Gomme 04, 06, 51, 57; Papa M72 |
| 5 | **Item präsentieren** | Neigung 10–20°, Blick zur Kamera oder zum Objekt | 15–30° gedreht | Arm 45–90° nach vorn, Objekt auf Kopfhöhe neben dem Kopf, zweiter Arm angewinkelt vor der Brust oder seitlich | Schrittstellung | Neues Item oder Werkzeug | Palu 24, 25, 26; Papa M65, G56, G58; Basti 30 |
| 6 | **Waffe quer** | frontal, Blick leicht zur Seite oder nach unten | frontal | beide Arme 60–75° nach vorn, 20–30° gespreizt | – | Ausrüstung, Waffen-Mod | Palu 21, 22 |
| 7 | **Neutral frontal** (Porträt) | Drehung 0°, Neigung 0–5°, Blick in die Kamera | frontal | 10–25° seitlich und 10–20° nach vorn, nie ganz am Körper, nie T-Pose | gerade oder ca. 5° gespreizt | Nur wenn der Aufbau die Aussage trägt (Split, Kacheln) | Basti 14, 16, 19, 22, 26 |
| 8 | **Heldenstand frontal** | 0–5° | frontal | verschränkt (beide 80° vor, 45° nach innen) oder Hände hinter dem Rücken oder Schwert tief diagonal | ca. 5–10° gespreizt | Stärke, Serienstart | Gomme 20, 31, 33, 36; Palu 22, 34, 48; Papa M69, M74 |
| 9 | **Gefesselt stehend** | gerade oder im Duo 10–15° zueinander geneigt; einzeln Nicken 30–40° nach vorn | gerade | 0–5° am Körper, mit Ketten umwickelt | parallel geschlossen (0°) | Gefangen, Challenge-Strafe | Basti 05, 06, 09, 13, 25 |
| 10 | **Arme weit, Ketten reißen** (Stern) | frontal | frontal | beide 60–75° seitlich, ca. 15° nach vorn | 10–15° gespreizt, schwebend | Befreiung, Macht | Basti 17 (07, 10 als Varianten) |
| 11 | **Angriff im Ausfallschritt** | 10–20° geneigt, Blick zum Gegner | 15–25° nach vorn geneigt | Schlagarm 100–160° hoch zum Ausholen oder Faust 80–90° vor, Schwertarm hängt mit der Klinge nach unten hinten | vorderes Bein +30–45°, hinteres −30° | Angriff | Gomme 01, 23, 24, 56 |
| 12 | **Sprung** | leicht zum Ziel geneigt | 10–20° vor | beide 60–120° hoch, asymmetrisch | ein Bein +40°, eins −30 bis −50°, Figur schwebt | Kill, Überfall | Gomme 09, 41, 44 |
| 13 | **Sprint** | Blick in Laufrichtung | 15–25° vorgebeugt | gegenläufig ±60–80° | gegenläufig ±45–60° | Wettlauf, Flucht | Palu 12 (kleine Figuren), 45; Papa M64 (Kopf zurückgedreht) |
| 14 | **Schreck: Hand vor dem Mund** | frontal, 5–10° gesenkt | gerade | ein oder beide Arme 110–130° hoch und nach innen | – | „Oh nein“, Verlust | Gomme 43, 45 |
| 15 | **Hände an den Kopf** | gerade oder leicht zurück | – | beide 150–165° hoch, ca. 15° nach innen | eng | Schock, Staunen | Papa M76, M77 |
| 16 | **Hand am Hinterkopf** | Neigung 10–15° | leicht gedreht | ein Arm ca. 150° angewinkelt, Hand am Hinterkopf | – | „Oh oh“, Verlegenheit | Palu 37 |
| 17 | **Nachdenken: Hand am Kinn** | 10–15° seitlich geneigt | leicht gedreht | Arm 100–120° hoch, nach innen gedreht, andere Hand oft mit Item | – | Plan, Zweifel | Gomme 13, 51 |
| 18 | **Jubel: Arme als V** | Neigung 10–15° | frontal | beide 150–160° hoch, ±20–30° gespreizt | ca. 10° gespreizt | Sieg; bei Cast nur für Nebenfiguren | Palu 46; Cast 10, 28 (Nebenfigur) |
| 19 | **Liegen / besiegt** | Kopf zur Kamera gedreht, liegt auf der Wange, Neigung 15–20° | waagerecht am Boden | nach vorn gestreckt oder seitlich angekettet | gestreckt | Niederlage, Tod | Gomme 09, 18, 40, 44; Basti 27 |
| 20 | **Bauchlage an der Kante** | 3/4, ca. 20° gedreht, Pupillen zur Seite | verkürzt dahinter | beide ca. 90° nach vorn auf dem Boden | liegend | Abgrund, Entdeckung | Basti 18 |
| 21 | **Fallen / Sturz** | nach oben gerichtet | 20–30° nach hinten gekippt | beide 120–170° hoch und gespreizt | angezogen oder gespreizt | Fall ins Void oder in die Falle | Gomme 03, 27, 30, 49; Palu 23, 27 |
| 22 | **Verstecken / Hervorlugen** | ca. 15° geneigt, Blick zur Bedrohung | verdeckt oder 30° vorgebeugt | eine Hand am Rand oder Stamm | verdeckt oder ein Bein zurück | Angst | Basti 12, 28; Papa M70 |
| 23 | **Über die Schulter** | Kopf 60–90° zurück zur Kamera gedreht | Rücken zur Kamera | Schwertarm quer vor dem Körper, fast waagerecht | – | Finale, Blick zurück | Basti 29; Gomme 19 |
| 24 | **Rückenansicht vor einem Ziel** | 20–35° nach oben in den Nacken oder geradeaus | Rücken oder 3/4-Rücken | ein Arm hängt mit gesenkter Spitzhacke schräg nach vorn | Stand oder Laufschritt ±35° | Großes Bauwerk, Ziel | Cast 01, 13; Gomme 28 |
| 25 | **Trophäe hochhalten** | frontal | frontal | beide 90–110° seitlich hoch | Stand auf den Gegnern | Kills | Gomme 18 |
| 26 | **Gruppen-Hauptfigur** | Drehung 0–15° | frontal | ein Arm 40–70° vor zur Kamera, der andere 15–25° nach hinten; oder beide halten das Schwert diagonal quer | Schritt: vorn +15–25°, hinten −10–20° | Team, Start | Cast 06, 11, 14, 17, 18 |
| 27 | **Sitzen / Reiten** | frontal | aufrecht | 30–60° nach vorn | Hüfte 90° gebeugt, 20–30° gespreizt | Reittier, Fahrzeug | Palu 30, 06; Papa M79, M80 |
| 28 | **Ausholen zum Schlag** | – | 40° nach vorn gebeugt | ein Arm 45° vorn-unten, der andere 120° hoch | – | Buzzer, Knopf | Papa G45; Palu 38 (Hand auf Knopf, anderer Arm 140° hoch) |

### 3.2 Was eine Pose glaubwürdig macht (übereinstimmend)

- **Winkel sind versetzt:** Kopf, Rumpf und Arme haben immer unterschiedliche Winkel. Der Kopf ist 10–35° gegen den Rumpf versetzt (Palu). Die beiden Arme unterscheiden sich um mindestens 30° (Gomme Regel 11).
- **Gewicht:** Bei Aktion ist der Rumpf 10–25° zum Ziel geneigt (Gomme), beim Greifen oder Schlagen bis 40° (Papa).
- **Grenzen der Winkel:** Arme höchstens ca. 160–170°, Kopfneigung höchstens 25° (Gomme) bzw. 15° (Cast), Kopfdrehung gegen den Rumpf höchstens 45° (Gomme). Ausnahme ist der Blick über die Schulter.
- **Klare Silhouette:** Ein Arm steht deutlich vom Körper ab (mindestens 30°) oder liegt klar vor dem Körper. Er ist nie halb verdeckt im Profil (Palu).
- **Kontakt mit der Welt:** Die Füße stehen auf Blöcken, die Figur hängt an einer Kante oder liegt am Boden. Schweben gibt es nur beim Springen oder Fallen (Gomme). Bei Nahaufnahmen sind die Beine ganz aus dem Bild, dann gibt es kein Standproblem (Cast).
- **Die Pose passt zum Titel:** „Herz verloren“ zeigt Schreck (Gomme 43), „Falle“ eine Grube (Gomme 03, 06), „Kill“ einen Sprung (Gomme 44).
- **Emotion entsteht über Kopfneigung, Blick, Lider und Situation,** nicht über übertriebene Armwinkel (Basti).

### 3.3 Verboten oder lächerlich

| Fehler | Beleg |
|---|---|
| Frei zappelnde Arme ohne Zweck | 0 von 25 (Basti), bei Cast nie („fuchtelt nie ins Leere“) |
| Spiegelgleiche Arme, außer frontales Porträt, Heldenstand oder Kettenriss | Basti, Gomme, Papa |
| Angehobenes Bein ohne Grund, Karate- oder Jubelpose der Hauptfigur in einer ruhigen Szene | Basti 0 von 25; Beinbewegung nur bei Kampf, Sprung, Sprint oder Sturz (Gomme, Palu) |
| Mehr als eine große Geste pro Figur, also beide Arme und beide Beine gleichzeitig extrem | Cast (Ausnahme: jubelnde Nebenfiguren) |
| T-Pose | Basti, Cast |
| Kopfneigung über 25° oder Kopfdrehung über 45° gegen den Rumpf (außer beim Blick über die Schulter) | Gomme |
| Glieder, die in den Rumpf stechen, oder Hände mitten im Rumpf | Cast |
| Figur steif mit hängenden Armen in einer Action-Szene | Palu 47 als Negativbeispiel |
| Beide Arme hängend bei der Hauptfigur | Papa 0 von 23 |
| Schwebende Figur ohne Sprung oder Sturz | Gomme |
| Schwert genau in der Blickachse oder mit der Spitze auf die Kamera | Gomme, Palu |
| Vorgetäuschter Ellbogen oder gebogene Glieder | Cast |

**Widerspruch Beine:** Basti hat die Beine in ca. 20 von 25 Bildern gerade und parallel. Papa sagt dagegen, die Beine stehen „fast nie parallel“, sondern breit oder im Ausfallschritt. **Auflösung:** In ruhigen Szenen stehen die Beine gerade oder bis 10° gespreizt (Basti, Gomme P8, Palu P8). Schritt oder Ausfallschritt gibt es nur bei Aktion, also Kampf, Flucht oder Gruppen-Hauptfigur (Gomme P3, Cast P3, Papa).

**Widerspruch hängender Arm:** Bei Gomme P1 und Palu P1 darf der zweite Arm hängen, bei Papa hängen bei der Hauptfigur nie beide Arme. **Regel:** Ein Arm darf hängen, wenn der andere handelt. Zwei hängende Arme sind nur beim Gefesselt-Stand erlaubt (Basti P1).

---

## 4. Items in der Hand

| Item | Lage zur Bildebene | Größe | Lage zum Gesicht | Belege |
|---|---|---|---|---|
| **Schwert** | Klinge flach zur Kamera, sodass man die volle Klingenfläche sieht, 30–50° diagonal zur Bildhorizontalen. Griff in der Faust am unteren Ende des Armquaders, Klinge 90° zum Arm (typisch Minecraft) | Mit Item im Vordergrund (Weitwinkel) 2–3× Kopfgröße bei Gomme, 1,3–1,6× bei Palu | Spitze nach oben und außen, weg vom Gesicht, Abstand zum Gesicht mindestens 0,3 Kopfbreiten (Palu) | Gomme 02, 08, 17, 20, 22, 47; Palu 12, 13, 15, 32 |
| **Axt, Spitzhacke** (nah) | wie das Schwert, Kopf des Werkzeugs nah an der Kamera | ca. 1,5× (Palu 33) | seitlich unten | Palu 33; Gomme 46 (Spitzhacke schwebend, präsentiert) |
| **Spitzhacke** (Rückenansicht) | hängender Arm, gesenkt, schräg nach vorn | normal | – | Cast 01, 13 |
| **Gewehr, Waffe quer** | genau waagerecht, Mündung zur Bildseite | – | vor Hüfte oder Bauch, nie vor dem Gesicht | Palu 21, 22 |
| **Kleines Item** (Feuerzeug, Kohle, Diamant) | vor dem Körper auf Brusthöhe, Blick darauf | im Weitwinkel größer | Brusthöhe, neben dem Gesicht | Gomme 04, 06, 51, 57; Basti 30 |
| **Präsentiertes Objekt** (Tablet, Glas, Funkgerät) | frontal zur Kamera | ca. 1,3× Kopfgröße | auf Kopfhöhe neben dem Kopf | Palu 24, 25, 26 |
| **Schwebendes Schlüsselobjekt** (Core, Spitzhacke, Tierliste) | 1–2 Handlängen hinter der Hand | größer als die Figur | Zeigearm führt hin | Gomme 12, 37, 46 |
| **Schlüsselobjekt nah an der Kamera** (Ei, Buzzer, Pokal) | nächstes Element zur Kamera | 1,5–2× Kopfgröße | vor der Figur | Papa M68, G45, M65 |
| **Bogen** | kniend | – | – | Gomme 53 (einziger Fall, älter) |
| **Block** | Arme voller Blöcke | – | vor dem Körper | Gomme 38 (einziger Fall) |

Weitere Regeln:
- Figuren halten etwas bei Basti in 7 von 25 Bildern, bei Gomme eine Waffe in 23 von 57, bei Palu in 17 von 33 und bei Papa in 10 von 23. Das Diamantschwert ist bei Gomme in ca. 32 von 57 Bildern zu sehen.
- Extrudierte Voxel-Items bekommen dieselbe helle Kante wie die Figur (Gomme).
- Ein kleiner Funkelstern an Schwertspitzen oder Metallklingen kommt vor (Gomme 02, 17, 22, 41; Papa M64, G58), aber nur auf Metall.
- **Widerspruch Größe:** Gomme lässt das Schwert 2–3× so groß wie den Kopf wirken, Palu nur 1,3–1,6×. **Regel:** Ist das Schwert selbst das Thema (Gomme P2), gilt 2–3×. Wird das Item nur zusätzlich gehalten, gilt 1,3–1,6×.

---

## 5. Kamera

| Modus | Brennweite | Höhe und Neigung | Abstand | Anschnitt | Kippung | Blende | Belege |
|---|---|---|---|---|---|---|---|
| **K1 Nahaufnahme am Rand** | 20–28 mm (Standard 24) | Brust- bis Augenhöhe, siehe Widerspruch unten | Basti 1,0–1,6 m vor dem Kopf (Figur 1,8 m); Palu 1,2–1,8 m; Cast 1,0–1,5 Kopfbreiten | Kopf 35–55 % der Bildhöhe, Figur 35–55 % der Bildbreite (Basti) bzw. 55–70 % der Bildhöhe (Palu). Oberkante des Kopfs 3–10 % vom Rand oder angeschnitten. Unten und seitlich angeschnitten | 0° bei neutralen Themen | f/2,0–4 | Basti, Gomme, Palu, Cast, Papa |
| **K2 Item zur Kamera** | 20–28 mm | Augen- bis Brusthöhe | Item 0,3–0,6 m vor der Kamera | wie K1 | 0° | f/2–2,8 | Gomme 02, 17, 20, 22 |
| **K3 Brustbild / halbnah** | 30–40 mm | Augen- bis Brusthöhe, 0–10° Untersicht | – | Hüfte bis Knie | 0° | f/2–4 | Gomme, Palu 21, 22, 32, 33 |
| **K4 Totale, Figur in der Szene** | Basti 50–70 mm; Gomme 35–50 mm (Gruppen); Palu 24–35 mm (Riesenmob); Papa 35 mm | Augenhöhe bis 20° von oben | – | Figur 15–35 % der Bildhöhe, mittig | 0° | f/8 oder ohne Unschärfe | Basti 05, 13, 16, 17, 19, 25 |
| **K5 Held oder Gruppe von unten** | 18–24 mm (Cast), Weitwinkel | Knie- bis Hüfthöhe, 5–25° nach oben. Heldenstand 10–15° (Gomme). Epik mit Riesenfigur 30–35° (Papa) | Hauptfigur 10–20 % näher als die Nebenfiguren | Nebenfiguren am Rand angeschnitten | 0° | leicht | Cast 11, 14, 17, 18; Gomme 33, 36; Papa M61 |
| **K6 Aufsicht** (Lava, Void, Grube, Menge) | 24–35 mm | 30–60° von oben (Gomme 35–55°, Papa 50–60°), bis fast senkrecht | – | Figur klein | 0–12° | f/5,6–8 (Welt ist das Thema) | Gomme 21, 25, 27, 30; Basti 07, 09, 10; Palu 01, 23 |
| **K7 Froschperspektive aus dem Schacht** | 16–20 mm | ganz unten, senkrecht nach oben | – | Figuren am oberen Rand | 0° | scharf | Gomme 35 |
| **K8 Rückenansicht** | 18–24 mm | Hüft- bis Schulterhöhe, 10–30° nach oben | – | Figur 20–30 % der Bildbreite, ab Knie oder Hüfte | 0° | Bauwerk scharf | Cast 01, 13 |

**Kippung (Dutch Angle):** Basti 6 von 25 (10–25°, auch die ganze Figur gekippt), Gomme 6 von 57 (5–12°, nur bei Aktion oder Sturz), Palu 3 von 33 (höchstens 5°), Cast nur bei Action. **Regel:** Normalerweise 0°. Bei Drama, Angst oder Sturz 6–12°, der Basti-Look erlaubt bis 20°.

**Widerspruch Kamerahöhe in der Nahaufnahme:**
- Basti: Kamera auf Brusthöhe (1,1–1,3 m), 5–15° nach **oben** geneigt, leichte Untersicht in ca. 9 von 25.
- Gomme: Augen- bis Brusthöhe, **Untersicht 0–10°** in ca. 40 von 57.
- Palu: Augenhöhe bis 0,3 m darunter. Untersicht 10–20° nur bei Bedrohung oder Macht (8 von 33).
- Cast: Kamera **über** Augenhöhe, 5–15° nach **unten**, sodass die Oberseite der Haare sichtbar ist (9 von 10).

**Regel:** Standard ist Augenhöhe bis leichte Untersicht von 3–10° (Basti, Gomme, Palu als Mehrheit). Die Aufsicht nach Cast ist eine Variante für den ruhigen Präsentator.

**Widerspruch Abstand:** Die Meterangaben von Basti und Palu (1,0–1,8 m) und die „1,0–1,5 Kopfbreiten“ von Cast passen nicht zusammen. Maßgeblich ist der Anschnitt: Der Kopf muss 35–55 % der Bildhöhe füllen.

**Widerspruch Tiefenunschärfe:** Gomme hat den Hintergrund in ca. 46 von 57 Bildern deutlich unscharf (f/1,8–2,8). Palu zeigt leichte bis mittlere Unschärfe in 25 von 33 (f/2,8–4), Formen bleiben erkennbar. Basti zeigt deutliche Unschärfe in 7 und leichte in 3 von 25, Cast nur in 7 von 24, Papa in ca. 60 %. **Regel:** Ist der Hintergrund Kulisse, gilt f/2–4. Ist die Welt oder das Bauwerk das Thema, gilt f/5,6–8 oder keine Unschärfe (Gomme Regel 4, Cast).

**Grundregel Anschnitt:** Die Hauptfigur ragt ins Bild hinein, statt darin zu „stehen“ (Cast). Sie ist am Rand angeschnitten bei Cast in 15 von 23, bei Palu in 15 von 33 und bei Gomme „fast immer“. Freigestellte Ganzfiguren mit Luft rundherum sind selten (Gomme 25, 38).

---

## 6. Licht und Grafik-Look

| Merkmal | Wert | Belege und Abweichungen |
|---|---|---|
| **Sonne: Höhe** | 35–55° Elevation | Basti 35–50, Gomme 35–45, Palu 40–55 (40–60 geschätzt), Papa 35–50 |
| **Sonne: Richtung** | **Widerspruch**, siehe unten | Basti vorn-oben-seitlich, Azimut 30–45° zur Kamera; Gomme 20–40° seitlich hinter der Kamera; Cast vorn-oben, 30–45° seitlich; Papa 30–45° seitlich vorn; **Palu schräg hinten, Azimut 120–160°** |
| **Sonne: Weichheit** | Winkel 2–5° | Basti 2–5, Gomme 3–6, Palu 2–4, Cast 2–3, Papa 1–2 |
| **Sonne: Stärke und Farbe** | Stärke 3–5, leicht warm 5200–5500 K | Basti 3–5, Cast 3–5 bei ca. 5500 K, Papa 3–4 bei 5200–5500 K |
| **Umgebungslicht** | Nishita-Himmel oder Himmel-HDRI, blau, Stärke ca. 1–1,5 | Cast. Schatten bleiben hell und bläulich. Die Schattenseite fällt nie unter ca. 25 % Helligkeit (Palu) |
| **Formlicht auf dem Kopf** | Frontfläche des Kopfs 15–25 % heller als die Seitenfläche | Gomme. Die Würfelform muss lesbar sein, das Gesicht voll ausgeleuchtet (Cast) |
| **Randlicht (Rim)** | Area-Light hinter der Figur, weiß bis leicht kühl (6500–8000 K), schmal | **Widerspruch Stärke:** Basti und Gomme 1,5–3× Hauptlicht, Palu 1,5–2× Sonne, Cast nur ca. 20 % der Sonne („dezent“). Bei Palu leuchten die Kanten in Materialfarbe (24 von 33) |
| **Farbiges Randlicht** | nur bei dunklem Hintergrund, Farbe aus dem Hintergrund, Sättigung ca. 0,6 | Gomme 8 von 57 (01, 04, 12, 20, 22, 41, 43, 55); Basti 29 blau, 30 rot. Auf Tag-Bildern neutral |
| **Kantenglanz** | Bevel 0,5–1 % der Kantenlänge, 2 Segmente, Specular 0,4–0,5, Roughness 0,35–0,45, wirkt als Lichtkante von 1–2 px bei 1280 px | Gomme („auffälligstes Qualitätsmerkmal“, 17, 21, 43, 47); Basti bei ca. 20 von 25 Figuren; Papa 1–2 px |
| **Weiße Kontur im Compositing** | **Widerspruch**, siehe unten | Palu dünne helle Kontur 2–4 px (Regel: 2–3 px); Basti 1–3 px oder Bevel-Glanz; Papa 1–2 px; **Cast 0 von 24**; Gomme „keine Outline“, nur Kantenglanz |
| **Ambient Occlusion** | an, sichtbar, dezent | Achseln, Hals, Armbeugen, Kettenwicklungen, Blockfugen, unter Mobs (Basti, Gomme, Palu, Cast) |
| **Dunst in der Tiefe** | gering: Volume-Dichte ca. 0,002–0,005 oder Mist-Pass | Gomme (neuere Bilder gering, ältere stark); Basti Horizont 20–40 % heller (05, 11, 13, 18); Cast 5–10 % Aufhellung; Palu in ca. 12 von 33, Farbe Himmelsblau. Stärker in Schnee- und Waldbiomen (Gomme) |
| **Tiefenunschärfe** | f/2–4 mit Fokus auf dem Kopf | siehe Kamera. Nebenfiguren in 2–5 m bleiben lesbar (Gomme) |
| **Tonemapping** | AgX oder Filmic, Look „Medium High Contrast“, „High Contrast“ oder „Punchy“ | alle fünf |
| **Belichtung** | Kopf-Weiß bei 90–95 %, Himmel brennt nicht aus, Lichter clippen nicht | Basti, Gomme, Papa |
| **Sättigung** | +10–30 % | Basti +10–20, Gomme +10–20, Papa +15–25, Palu +20–30, Cast +20–30 |
| **Kontrast** | mittel bis hoch | Basti: Schwarz echt schwarz. Cast: Schatten angehoben, keine schwarzen Löcher. Gomme: offene Tiefen |
| **Bloom** | nur an echten Lichtquellen, Schwelle ca. 1,0, Intensität gering | alle fünf. Die Figur selbst glüht nie (Gomme) |
| **Vignette** | nur in dunklen Szenen, ca. 15–20 % | Basti, Gomme, Papa |
| **Farbfilter** | keiner | Basti, Cast |
| **Farbkonzept** | Komplementärkontrast: Türkis oder Blau gegen Rot oder Orange, blauer Himmel gegen warme Figur | Gomme, Papa |
| **Skin-Schärfe** | Closest-Interpolation (Nearest Neighbor), Pixel gestochen scharf, leichtes Nachschärfen | Gomme, Palu, Cast |
| **Zweite Skin-Ebene** | eigene 3D-Hülle, Kopf +0,5 Skin-Pixel (8 → 9 px Hülle), Glieder +0,25 px. Sie wirft leichte Schatten auf die Grundschicht | Gomme, Palu (in allen Nahaufnahmen), Basti 04, 12, 18, 27, 28, Cast 05, 07, 09, 12, 29 |
| **Material** | leicht glänzend, weich beleuchtet, wenig Specular, keine Plastikoptik | Palu |

**Widerspruch Sonnenrichtung:** Bei Basti, Gomme, Cast und Papa kommt die Sonne von vorn-seitlich (Azimut ca. 20–45° zur Kamera), bei Palu von schräg hinten (120–160°). Dann leuchten die Kanten stark und die Vorderseite liegt im Himmelslicht. **Regel:** Standard ist vorn-seitlich. Für den Palu-Look Gegenlicht mit starkem Randlicht, wobei die Schattenseite mindestens 25 % hell bleiben muss.

**Widerspruch weiße Kontur:** Palu und Basti nutzen eine feine helle Kante bzw. dünne Kontur, Cast hat keine sichtbare, Gomme nur Kantenglanz aus dem Render. **Regel:** Die Kante entsteht zuerst im Render durch Bevel und Randlicht. Eine zusätzliche Compositing-Kontur ist erlaubt, aber höchstens 2–3 px hell. Ein farbiger Glow-Rand ist bei allen fünf ausgeschlossen.

### 6.1 Varianten

| Variante | Einstellungen | Belege |
|---|---|---|
| **Tag, Standard** | wie oben, kräftig cyan-blauer Himmel | Basti 15 von 30, Gomme 27 von 57, Palu 24 von 33, Cast 19 von 24, Papa 10× |
| **Sonnenuntergang** | kräftig orange, Himmel 20–35° zur Sonne, Pixelwolken | Gomme 40, 42, 44, 46 |
| **Nacht / dramatisch** | Welt dunkel (Weltstärke 0,05–0,1, dunkellila oder blau). Warmes Key-Area-Light von 3500–4000 K von vorn-seitlich. Kühles Randlicht (Cyan #4FD8FF, 2–3× Key, von hinten-oben 120–150° versetzt). Bodennebel mit Volume-Dichte 0,02–0,05 in den unteren 1–2 Blöcken. Dazu eine motivierte Lichtquelle im Bild (Taschenlampe, Schwert). Mond als weicher Lichtfleck, Sterne | Papa (Regel 6), Basti 12, 29, 30; Gomme 02, 41, 43 |
| **Horror** | entsättigt mit roten Akzenten, Himmel schwarz-rot, roter Nebel, Filmkorn | Palu 02, 15, 20, 31, 36; Gomme 55 |
| **Sturm / Regen** | Gewitterhimmel, Regen, zweifarbig rot und blau | Gomme 05, 22, 39; Basti 20 |
| **Warm / Lava** | orange, Funken, echte Lava-Textur | Basti 06; Gomme 20, 21, 25 |
| **Schnee** | grau-türkis, Partikel, stärkerer Dunst | Basti 05, 21; Gomme 54 |
| **Studio / abstrakt** | weiß mit Spiegelboden, grau oder dunkle Farbfläche | Basti 04, 10; Gomme 9 von 57 (z. B. 37, 50) |

---

## 7. Welt und Hintergrund

- **Detailgrad:** Die Welt ist nie leer (Basti, Papa). Bei Gomme gibt es in neueren Bildern **wenige, große, klare Elemente**: Grasblöcke in Nahaufnahme, eine Grube, eine Wand. Die Welt ist nur so detailliert, wie die Geschichte es braucht, und wird durch Unschärfe beruhigt. Bei Basti ist sie detailreich mit Tiefe bis zum Horizont, bei Palu mittel bis hoch, als einfache, gut lesbare Kulisse. Bei Cast ist oft ein riesiges, detailreiches Bauwerk das Hauptmotiv (12 von 24).
- **Echte Texturen:** Gras, Erde, Stein, Holz, Laub, Bedrock, Lava, TNT, Endstein, Obsidian und Tiefenschiefer, in hoher Vergrößerung und pixelscharf (Gomme, Palu, Papa).
- **Drei Tiefenebenen:** Vordergrund-Item oder -Figur, Hauptfigur scharf (0–2 m), Objekt oder Mob in 4–10 m und ein weicher, dunstiger Hintergrund in 30–200 m (Palu Regel 7, bei Palu in ca. 22 von 33; Gomme). Unscharfe Vordergrund-Objekte als Rahmen gibt es bei Gomme 24, 29, 53 und Basti 09, 12, 24, 28.
- **Hintergrund heller oder unschärfer als die Figur,** damit die Figur vorne „klebt“ (Basti).

### 7.1 Typische Orte

| Ort | Belege |
|---|---|
| Plains, Wiese, Gras-Plateau, Wald | Gomme (die meisten), Palu 12 von 33 Graslandschaft, Basti 08, 24 |
| Klippe, Grube, Schacht, Void | Gomme 03, 06, 27, 30, 35, 49; Basti 18; Cast 19 |
| Lava-See, Lavafall | Gomme 21, 25, 28; Basti 06 |
| Höhle, Bedrock-Höhle | Palu 11; Gomme 28 |
| Dorf | Palu 5 von 33 (19, 29, 38); Basti 05 |
| Nacht-Wald | Palu 4 von 33; Basti 12 |
| Nether | Cast 22 (rot-orange, Dunst, Glut) |
| End | Basti 06 (End-Landschaft mit Lava-Decke); Cast 18 (violetter Nebel); Papa (Endstein) |
| Wüste, Mesa, Birkenwald, verschneite Taiga, Eisspitzen, Meer | Gomme 52, 34, 47, 54; Palu 13 (Eis), 45, 46 (Meer); Basti 13 (Wüste) |
| Skyblock / Himmel | Basti 16, 25; Gomme 38 |
| Innenräume, Bauten | Gomme 7 von 57 (Lobby 14, TNT-Raum 32, brennende Basis 45) |

Palu hat Nether und End in der Stichprobe nie als Hauptkulisse.

### 7.2 Himmel und Wolken

**Widerspruch:**
- **Palu:** in 14 von 33 stilisierte **Minecraft-Blockwolken** (groß, flach, hellblau-weiß) auf kräftigem Blauverlauf (oben #1E7BE0, Horizont #8FD3FF). Realistische Wolken **nie**.
- **Cast:** eckige Minecraft-Wolken, weiß, weich, oft leicht unscharf. Die eckige Minecraft-Sonne ist sichtbar (03, 13).
- **Gomme:** entweder weiche Cumulus-Wolken oder unscharfe Minecraft-Pixelwolken (48, 49, 51, 52). Volumenwolken nur in älteren Bildern (53).
- **Basti:** kräftiges Cyan-Blau (ca. #3fa0e8 bis #8fd0ff) mit weißen Kumuluswolken, **oft realistisch und nicht im Minecraft-Stil** (15 von 30 Tagbilder).

**Regel:** Beide Wolkenarten sind durch die großen Kanäle gedeckt. Für den Palu- und Cast-Look nimmt man Blockwolken, für den Basti-Look realistische Wolken. Der Blauverlauf ist immer gesättigt: Zenit kräftig, Horizont heller.

---

## 8. Mobs und Objekte

- **Nur echte Modelle mit Originaltextur.** Gomme zeigt Mobs in 3 von 57 immer als Originalmodell (26 Warden und Creeper, 38 Ghast und Warden, 57 Creeper). Basti hat echte Mobs in 8 von 30. Palu zeigt Vanilla-Mobs in 11 von 50 (z. B. 48 Mob-Armee, 32 Villager, 33 Piglin-Brutes). Papa zeigt echte Wölfe, ein Schwein und das Drachenei.
- **Absichtliche Veränderung nur für den Gag:** Basti 08 hat einen rot eingefärbten Creeper, 12 einen Enderman mit leuchtendem Maul, 28 einen Dorfbewohner mit drei Köpfen und sechs Armen. Mobs bekommen Ausdruck über Augenbrauen (Basti 28). Bei Cast 22 leuchten die Piglin-Augen leicht.
- **Größenverhältnisse:**
  - Normaler Gegner oder Mob mittelgroß im Mittelgrund. Die Hauptfigur ist vorn groß (Palu).
  - „Riesige“ Gegner sind 2–3× so hoch wie die Figur (Palu 30, 44).
  - Größenkontrast als Stilmittel: Die Hintergrundfigur ist 2,5–4× skaliert, das Schlüsselobjekt 1,5–2× so groß wie der Kopf (Papa M61, M66, M68).
  - Nebenfiguren (Spieler) haben 40–60 % der Kopfgröße der Hauptfigur (Gomme 03, 06, 10, 11, 26, 32, 49, 51).
- **Anordnung:**
  - Mob oder Thema auf der Gegenseite der Figur (Basti, Palu Regel 6).
  - Ein Mob groß im Vordergrund angeschnitten als Rahmen (Basti 09 Enderman, 24 Eisengolem).
  - Umzingelung: Die Figur steht mittig, Mobs ringsum (Palu 32 sechs Villager, 33 Piglin-Brutes, 46 Haie, 48 Armee links und rechts; Basti 07 Zombie-Meer).
  - Eine Menge, die den Titel wörtlich zeigt („100 Villager“ Palu 38; Cast 16, 17, 22, 26).
  - Mobs unscharf im Hintergrund in großer Zahl (Gomme 57 Creeper).
- **Requisiten mit Geschichte:**
  - Ketten: Basti 10 von 30, Gomme 2.
  - TNT: Gomme 6, Palu 18, 38.
  - Feuerzeug mit echtem Feuer: Gomme 3.
  - Herz-Anzeige als Spielgrafik: Gomme 8 von 57.
  - Fliegende oder explodierende Items: Basti 16, 19; Gomme 38; Cast 27.
  - Kronen: Gomme 7.
- **Foto-Elemente** wie Flammen, Explosionswolken und Funken werden eingesetzt und nicht aus Blöcken nachgebaut (Papa G58, M74, M79).

---

## 9. Gesichter

**Nie verändert:**
- Die Skin-Augen, also das Minecraft-Pixelgesicht, bleiben erhalten. Palu verändert sie in 32 von 33 Bildern nicht, Gomme in 50 von 57, Cast in allen 23.
- **Kein zusätzlicher Mund.** Basti fügt in 0 von 25 einen hinzu. Gezeichnete menschliche Münder gibt es nur in einem älteren Gomme-Bild (53). Einen Mund, den der Skin selbst hat, behalten Gomme und Cast.
- Keine Comic-Augen und keine aufgemalten großen Augen bei der Hauptfigur (Basti, Palu, Papa).

**Erlaubt, sparsam und pixelbasiert:**

| Änderung | Bedeutung | Häufigkeit und Belege |
|---|---|---|
| Obere Lidkante schräg abgeschnitten, zur Außenseite nach unten | traurig, ängstlich | Basti 5 von 25 (12, 19, 20, 27, 28) |
| Halb geschlossene Augen | gelangweilt | Basti 19 |
| Weiche dunkle Augenringe | Angst, Erschöpfung | Basti 12, 27, 28 |
| Pupillen-Pixel zum Thema verschoben | Blickrichtung | Basti 3 von 25 (08, 18, 29); Gomme 03, 11 |
| Schräge Pixel-Augenbrauen | Wut, Entschlossenheit | Gomme 01, 04, 44; Papa G38 (Basti-Skin) |
| X-Augen | tot, besiegt | Gomme 05, 52 (Hauptfigur), 18, 40 (Gegner) |
| Veilchen, Schmutz, Narben, Staub | verprügelt, erschöpft | Gomme 01, 04, 43; Papa G47; Cast 14 |
| Andere Augenfarbe oder Leuchtaugen | Teufel, dunkle Szene | Basti 30; Papa M61 (je einmal) |

- Emotion entsteht in erster Linie über **Kopfneigung, Blickrichtung (Kopfdrehung), Pose, Situation und Licht** (Palu, Cast, Gomme).
- Gegner werden bei Gomme stärker übertrieben (Zahnreihen, dicke Brauen, Comic-Augen: 05, 07, 08). Das gilt nicht für die eigene Hauptfigur.

---

## 10. Text, Logos, Pfeile, Kreise, Umrandung

| Element | Basti (30) | Gomme (57) | Palu (50) | Cast (24 Renders) | Papa (29 Minecraft) |
|---|---|---|---|---|---|
| **Kein Text** | 18 | 50 (ohne Logos und Namensschilder) | 47 | 11 | 22 |
| Freier Text | 12 | 5 + 2 Tierlisten | 3 | 13 | 7 |
| Pixelschrift-Anteil | 9 von 12 | Pixelschrift oder Leuchtwort | 1 von 3 (45) | 3 von 13 (Stil B) | nur Namensschilder und „IN MINECRAFT“ |
| Serien-Logo | – (einmal ein Logo-Schild, 02) | 39 | 8 | 7 | 11 |
| Namensschild (Nametag) | vereinzelt (15) | 10 | 7 | 4 | 5 |
| Pfeile | 3 | 1 | 3 | 3 | 1 (M69) |
| Kreise | 3 | 0 | 2 (nur Facecam-Bilder) | 0 | 0 |
| Umrandung ums Bild oder dicke Figurenkontur | 0 | 0 | 0 (ein Kreis bzw. eine Kontur um eine Nebenfigur, 25) | 0 | 0 |

**Regeln für Text:**
- **Länge:** 1–3 Wörter (Basti 10 von 12, Cast), höchstens 4 (Papa). Beliebt sind Zahlen und Beträge wie „x400“, „30 Sekunden“, „1000€“, „Level 19“, „TAG 1 / TAG 7“.
- **Lage:** oben mittig (Basti 05, 09, 11, 13, 23), als Etikett über dem jeweiligen Split-Teil (Basti 02, 14, 15; Cast) oder in einer freien Ecke unten links oder oben rechts (Palu, Cast). **Nie über Gesicht, gehaltenem Item, Zeigehand oder Mob** (Basti, Gomme, Palu, Cast, Papa).
- **Schrift:**
  - *Minecraft-Pixelschrift*, bevorzugt bei Basti (9 von 12) und Gomme. Weiß mit hartem schwarzem Schatten nach unten rechts, als Level-Anzeige XP-Grün mit dunkelgrünem Schatten über dem XP-Balken, oder weiß auf grauem Minecraft-Knopf. Schlüsselwort farbig (Gomme 13). Farben: weiß, gelb oder gold für Zahlen, grün für Geld, Diamant-Türkis (Cast).
  - *Fette Sans*: schmal im Stil von Bebas Neue (Basti 10, 14, 19) oder rund und fett mit dunkler Kontur und Schlagschatten, weiß oder mit Gelb-Verlauf (Cast, bei Vorher/Nachher). Bei Papa leicht kursiv mit weichem Schatten.
  - **Widerspruch:** Basti bevorzugt Pixelschrift, Cast häufiger runde fette Schrift (6 zu 3), Papa fast nur runde Schrift. Mehrheit der Hauptkanäle: Pixelschrift.
- **Namensschild:** weiße Pixelschrift auf einem schwarzen Balken mit ca. 60 % Deckkraft (Gomme), bei Papa auch schräg gestellt.
- **Serien-Logo:** in einer freien Ecke, unten links oder unten rechts (Gomme 15 bzw. 14 von 39), ca. 25–35 % der Bildbreite, nie über Gesichtern (Gomme, Papa).
- **Pfeile:** rot, dick, gebogen oder geschwungen, mit weißem oder dunklem Rand. Höchstens einer pro Bild. Er zeigt auf die Figur oder ins „Nachher“ (Basti 07, 14, 19; Gomme 40; Palu 01, 37, 43; Cast 06, 22, 26).
- **Kreise:** nur rot, als Lupe mit weißem Rand (Basti 07) oder als Zahl-, Haken- oder X-Kreis (Basti 04, 08). Bei Gomme und Cast kommen keine vor.
- **Split-Trennlinie:** weiß, 6–10 px, 5–10° schräg (Cast 07, 14, 17, 18).
- **Minecraft-UI-Elemente als Grafik:** Item-Slots, Herzen, XP-Balken, Effekt-Kacheln (Basti 12 von 30; Gomme Herzen 8). Dazu Chat-Overlay (Cast 10, 28) und Bewertungssterne (Cast 09, 12, 29).

---

## 11. Unterschiede zwischen den Kanälen

| Merkmal | BastiGHG-Look | GommeHD-Look | Paluten-Look |
|---|---|---|---|
| Kern | Challenge-Situation mit Requisiten (Ketten, UI-Kacheln), oft Split | sauberer, heller „Clean Render“, riesige Figur, Kampf und Requisiten-Geschichte | eine Figur und ein Ding, klare einfache Aussage |
| Figur | 1 Figur in 15 von 25, oft Nahaufnahme am linken Rand | fast immer mit Gegnern (44 von 57 mit 2+ Figuren), Kopf 35–55 % | 1 Hauptfigur in 29 von 33, Kopf oft über 30 % der Breite |
| Posen | ruhig: gefesselt, liegend, versteckt, **keine Sprünge** | Action: Ausfallschritt, Sprung, Sturz, Schwert zur Kamera | Blick zum Ding, Zeigen, Item diagonal |
| Kamera | Nahaufnahme 24–28 mm, Totale 50–70 mm; Dutch Angle erlaubt (bis ca. 20°) | 20–40 mm, Untersicht 3–10°, Dutch Angle 6–12° nur bei Aktion | 24–35 mm, Roll höchstens 5°, Dynamik über Kopfneigung |
| Unschärfe | nur in 7–10 von 25 | stark (46 von 57, f/2–2,8) | leicht bis mittel (f/2,8–4) |
| Licht | Sonne vorn-seitlich, realistische Wolken | weiches, helles Frontlicht, starke Kantenglanz-Fase | Gegenlicht von schräg hinten, Kanten in Materialfarbe, Blockwolken |
| Sättigung | +10–20 % | +10–20 %, Türkis gegen Rot/Orange | +20–30 % |
| Text | 12 von 30, Pixelschrift, UI-Kacheln | fast nie, dafür Serien-Logo (39 von 57) | fast nie (3 von 50) |
| Gesicht | Lider, Augenringe, Pupillen | Brauen, X-Augen, Veilchen | unverändert |

**Wann welcher Look passt** (aus den Belegen abgeleitet):
- **Basti-Look:** Challenge-Videos mit Regel oder Strafe („Level = Block“, „Alles geteilt“, „Überall Lava“), Angst und Verstecken, Vorher/Nachher mit UI-Kacheln.
- **Gomme-Look:** PvP, Kämpfe, Kills, Serien mit mehreren Spielern (Helden, Risiko), Fallen und Abgründe, Lava- und Void-Aufsicht.
- **Paluten-Look:** Mod- und „Minecraft, aber …“-Videos mit einem klaren Objekt oder Mob, Mob-Armeen, Horror-Mods (mit Horror-Variante).
- **Ergänzend:** Castcrafter für Bauwerk-Präsentationen, Rückenansicht vor Riesenbauten und Mengen („1000 Spieler“). Papaplatte für Größenkontrast und Story-Metaphern (Marionette, Laser, Pokal) sowie das Nacht-Rezept mit Cyan-Randlicht.

---

## 12. Abnahme-Checkliste

Ein Thumbnail gilt nur als fertig, wenn **alle** Punkte erfüllt sind.

**Inhalt und Aufbau**
- [ ] Die beschriebene Umgebung ist sichtbar und erkennbar, als Ort oder Biom mit echten Minecraft-Texturen. Der Hintergrund ist nicht leer.
- [ ] Das Bild erzählt genau eine Aktion, die in 0,5 s lesbar ist.
- [ ] Figur und Thema (Mob, Item, Bauwerk, Gefahr) stehen nebeneinander und überdecken sich nicht.
- [ ] Die Hauptfigur ist das größte oder hellste Element oder durch Unschärfe klar vom Hintergrund getrennt.
- [ ] Nahaufnahme: Der Kopf füllt 35–55 % der Bildhöhe, die Figur ist an einem Rand angeschnitten. Totale: Die Figur füllt 15–35 % der Bildhöhe.
- [ ] Mobs und Items sind echte Modelle mit Originaltexturen. Veränderungen gibt es nur, wenn der Gag es verlangt.
- [ ] Die Größenverhältnisse sind stimmig: Nebenfiguren 40–60 % der Hauptfigur, Riesen-Mobs 2–3× so groß.

**Pose**
- [ ] Die Figur hat Bodenkontakt (Füße auf Blöcken, liegend, hängend) oder die Beine sind aus dem Bild. Sie schwebt nur beim Springen oder Fallen.
- [ ] Der Kopf ist nicht starr frontal: Drehung 15–35° oder Neigung 5–20°, außer bei Porträt oder Heldenstand.
- [ ] Die Kopfneigung ist höchstens 25°, die Kopfdrehung gegen den Rumpf höchstens 45° (außer beim Blick über die Schulter).
- [ ] Kopf, Rumpf und Arm zielen auf denselben Punkt.
- [ ] Die Arme sind nicht spiegelgleich (Unterschied mindestens 30°), außer bei Porträt, Heldenstand oder Kettenriss.
- [ ] Jeder Arm über 45° hat einen Grund. Es gibt höchstens eine große Geste pro Figur.
- [ ] Kein Bein ist ohne Grund gehoben. Schritt oder Sprung gibt es nur bei Kampf, Flucht oder Sturz.
- [ ] Kein Glied steckt im Rumpf, in einem anderen Glied oder im Boden.
- [ ] Die Pose passt zum Titel oder zur Beschreibung.

**Item**
- [ ] Das Item liegt flach zur Kamera und diagonal (Schwertklinge 30–50°). Die Spitze zeigt nach außen oder oben, nicht auf die Kamera.
- [ ] Der Griff liegt in der Faust, die Klinge steht 90° zum Arm.
- [ ] Das Item verdeckt das Gesicht nicht und hat mindestens 0,3 Kopfbreiten Abstand zum Gesicht.

**Kamera**
- [ ] Die Brennweite passt zum Modus (Nahaufnahme 20–28 mm, Brustbild 30–40 mm, Totale 35–70 mm).
- [ ] Eine Nahaufnahme ist nicht exakt frontal auf Augenhöhe.
- [ ] Der Horizont ist gerade, außer bei Drama oder Sturz (dann 6–12°, höchstens ca. 20°).
- [ ] Der Fokus liegt auf dem Kopf. Ist der Hintergrund Kulisse, ist er weich (f/2–4). Ist die Welt das Thema, ist sie scharf.

**Licht und Look**
- [ ] Die Sonne ist weich (Winkel 2–6°) und hat 35–55° Elevation. Blaues Umgebungslicht ist an. Die Schattenseite liegt bei mindestens 25 % Helligkeit.
- [ ] Die Würfelform des Kopfs ist lesbar: Front 15–25 % heller als die Seite.
- [ ] An den Kanten sitzt ein feiner heller Kantenglanz von 1–2 px. Es gibt keinen farbigen Glow-Rand. Farbiges Randlicht gibt es nur bei dunklem Hintergrund.
- [ ] AO ist in Achseln, Fugen und bei Kontaktschatten sichtbar.
- [ ] Skin und Texturen sind pixelscharf (Closest). Die zweite Skin-Ebene steht als 3D-Hülle ab.
- [ ] Kopf-Weiß liegt bei 90–95 %, der Himmel brennt nicht aus, Schwarz ist nicht abgesoffen.
- [ ] Die Sättigung ist kräftig, aber nicht neon. Es gibt keinen Farbfilter. Bloom gibt es nur an echten Lichtquellen.

**Gesicht**
- [ ] Die Skin-Augen sind erhalten. Es gibt keinen zusätzlichen Mund und keine Comic-Augen.
- [ ] Veränderungen sind nur pixelbasiert und passen zum Thema (Lider, Pupillen, Brauen, X-Augen, Veilchen).

**Grafik**
- [ ] Text ist nur vorhanden, wenn nötig: 1–3 Wörter (höchstens 4), in einer freien Fläche.
- [ ] Text, Logo, Pfeil und Namensschild verdecken weder Gesicht noch Skin, gehaltenes Item, Zeigehand, Mob oder Logo.
- [ ] Es gibt höchstens einen Pfeil und höchstens einen Kreis, beide rot. Das Logo steht in einer Ecke mit höchstens 35 % der Bildbreite.
- [ ] Es gibt keinen Rahmen ums Bild und keine dicke Figurenkontur. Eine helle Kontur ist höchstens 2–3 px breit.

---

## 13. Quellen

| Kanal | Ausgewertet | Zeitraum | Gewicht |
|---|---|---|---|
| BastiGHG (@BastiGHG) | 30 Thumbnails, davon 25 mit Figur | die 30 neuesten Videos ohne Shorts, ca. 3 Monate bis 28.09.2026 | hoch |
| GommeHD (@GommeHD) | 57 Thumbnails (52 neueste Minecraft-Videos ohne Shorts und Hytale, dazu 5 ältere, Nr. 53–57) | bis 09/2026; genauer Zeitraum nicht erfasst | hoch (Schwerpunkt) |
| Paluten (@Paluten) | 50 Minecraft-Thumbnails, davon 33 reine Renders | 2023–2025 (seit 2025 kaum noch Minecraft) | hoch (Schwerpunkt) |
| Castcrafter (@Castcrafter) | 30 Thumbnails, davon 24 reine Renders | die 30 neuesten Videos ohne Shorts; genauer Zeitraum nicht erfasst | ergänzend |
| Papaplatte (@PapaplatteGaming) | nur der Minecraft-Teil: 29 Thumbnails (11 reine Renders, 10 Hybride); Reaction- und Nicht-Minecraft-Teil nicht verwendet | Craft Attack 11–13 und neueste Videos; genauer Zeitraum nicht erfasst | ergänzend |

Nicht verwendet: OliXP, Stegi.

**Die Bilder und Einzelanalysen liegen nur lokal** unter `%LOCALAPPDATA%\MoinStudio\stil-referenzen\` und kommen nie ins Repo. Unten stehen nur die Video-IDs. Ein Thumbnail lässt sich über `https://i.ytimg.com/vi/<ID>/maxresdefault.jpg` bzw. das Video über `https://www.youtube.com/watch?v=<ID>` aufrufen.

### Zuordnung Nummer zu Video-ID

**BastiGHG:**
01 KeYbpE99aLI · 02 ApNthEpYDxU · 03 1wzwyuZb-Z4 · 04 X4euGKFMZOU · 05 1usI1WVDZaA · 06 3UCb0RnzeiQ · 07 V4Usuz7yS7A · 08 vM6Z512t1JY · 09 STlr6EIueGE · 10 vDN3kL7bHMM · 11 8Xpx1_INes0 · 12 WBncxLrU1_4 · 13 yahCECwHhzQ · 14 zbmdfWYXils · 15 tVWvx0lmfv4 · 16 xOGVy6YXE0s · 17 Livos4bfs5U · 18 Cof2CIoNpKk · 19 YpKyQNmcgXg · 20 jFzLL_9GMMQ · 21 hO1De1AKoDs · 22 i9ESJNFZ4EM · 23 fTnR5_YKDL8 · 24 -cBtPthYfmI · 25 Bi3yeRmaDRE · 26 HbknEPdm6iE · 27 zANLmx8_F0U · 28 lwnNIlKdvV4 · 29 2noBk-nEfKM · 30 YceOdKTXbuU

**GommeHD:**
01 bcmEo2NBFLI · 02 LZTR34FkVpk · 03 PODNyFC6SfI · 04 2ZmEy4BSD3Q · 05 4ieEHCCmLpI · 06 Vls7KP3Oh8Y · 07 9Q5frFLFoZM · 08 TVXgMyF3HnM · 09 SWgeyO5_usA · 10 l9uRbCAdJMo · 11 r1yu2MB7H4A · 12 pisLmETZb48 · 13 mPi95hUFVwc · 14 rnJIJTLwmN4 · 15 jmGmd5jG5XM · 16 WgRov5PvNKg · 17 Q5FxxgICqRI · 18 cOkA3yJsabk · 19 RA8JLnFAKjM · 20 PvBVFSgYJQM · 21 M2uh8Czcqkk · 22 KEUuvvCtRkA · 23 4G6BQs4QbJk · 24 -A02PKvLNAQ · 25 20ngE_uR39s · 26 Aj8ZU_s0ME4 · 27 wQBU1aqkRLE · 28 BwC2KbjtCYE · 29 zn69XE5j7XQ · 30 BvE8_EZGkl8 · 31 jQ6s5YSlejk · 32 kT6ml01aeTI · 33 BbtvdCMMjic · 34 hmXyDw-HEUw · 35 69coK_RL6co · 36 X6YFez4EW_4 · 37 FNjDpW8wysc · 38 KAyxLbaVRJU · 39 BSFt8Gwr_Dk · 40 6BRSn4fW-bA · 41 buP7iHnFyWs · 42 5L9tazaqqaE · 43 Mat84kJFuqI · 44 ptr2pwZ5W5I · 45 fkOnrb6UQGQ · 46 mQjLlcqJKgc · 47 gZFE9KM-xGI · 48 IXe97IKimFs · 49 JbzduHaqVq4 · 50 yXSC6sXob80 · 51 6bBfYVsciGQ · 52 7xRVPdr1Hs0 · 53 cNNVpr0oCMM · 54 e8i-V6a3eGo · 55 jANaJp7D88A · 56 cxD8-FO7cng · 57 sYWzxl4dr6o

**Paluten:**
01 QHrqKHR9bSY · 02 44W2ehTLQiU · 03 3NxHuOG8mY8 · 04 73KxQBvAQ_c · 05 vAqoxe3Etus · 06 QW5fV6q7LwY · 07 Aa-3eqjiJ8Y · 08 BHJWapLLiow · 09 fV0dmc6EqGg · 10 9VLCJFMPUW0 · 11 1eVByHiZAEo · 12 RpxtIRqJI2Q · 13 BB5oCML_VXQ · 14 zv61vQf3fbk · 15 DkVCSShl-cY · 16 Pi0igJbaO4E · 17 Z5xZM4f2Ql0 · 18 azAx-kD4rHw · 19 OfaNBVADmIc · 20 jbLzElfpUq4 · 21 fC2v80yNgq4 · 22 TB_8aROkFe0 · 23 dAofWTzpJ70 · 24 4frldFkA1aw · 25 3yB-AvuQgmY · 26 NJ2ynSvCE-4 · 27 9H3lwfvbFd8 · 28 vZMHC9cHtfc · 29 HZdItD0u-Ak · 30 MtWgw5G6IcM · 31 -eq1VZrEji4 · 32 mPI_9PVaKg8 · 33 xXKzbc32nLs · 34 x4fdMqzfyC8 · 35 oiHzS8TfEBs · 36 YdkrTLGADx0 · 37 nV1twPh7Z6U · 38 6Ujt_AWl8bo · 39 1nSbr5OQqZE · 40 llm9wbMFAE8 · 41 Zu9EHXHEJDY · 42 VIKEWThdCjA · 43 iIgiU9zWskM · 44 1VX6GMi46Ds · 45 j-UNwwz5sZo · 46 qhDlia0eoSA · 47 W1m1qOOxoIo · 48 eNe8fA-UgqY · 49 -FyHon_65SA · 50 l8UMptZDlOk

**Castcrafter:**
01 Ip-w-rs_oRg · 02 g_QeJj-LVHU · 03 w3pi2vsqqFI · 04 kod12HTGkJQ · 05 0wpB6hukGHk · 06 xyjAIdb4Aek · 07 -oYb2N5QyUE · 08 AjAh6AetQ1c · 09 Qg0ry43Dy1U · 10 MHvYLliXkqU · 11 pl2moQii4FE · 12 mYQT69uxT6o · 13 _USwA4axrQY · 14 KL9KdmLrsm8 · 15 2FkaDOYNqvg · 16 h3udWg8eCv0 · 17 qiNBtgdj93U · 18 36eVUWBDtCA · 19 RnIOyeooSWU · 20 GHD7jjgG6Zg · 21 yempsGclPk0 · 22 K5kgVaS6xRY · 23 we_QzyCti8w · 24 TtaK3spIKsY · 25 pUup8hfYVXQ · 26 vmdr_0_f6e8 · 27 g16Dh1OYE-E · 28 S0XiUflVBSM · 29 jT3Fu_U7YKs · 30 Z_KceRx_3YE

**Papaplatte (nur Minecraft und Minecraft-Skin):**
G38 9Y_bOd4miH8 · G45 qGJGglyFRmk · G47 CD_6BKaG-eI · G49 79qwBkLYqE4 · G51 pMGpR4lK2Gs · G52 ncVdXP4N35U · G55 Xnl0gVmrZdo · G56 GY-G9HaBVCw · G57 5X60JTZbeWM · G58 Qyn1D6HQKhs · G59 XT7cT73CNzk · M60 SRGr-XDcwnI · M61 iObCyF82YIE · M62 hTAMOALQjAo · M63 g41vL2NDe90 · M64 kGWEP5NxFPo · M65 2vRbNZqbT0A · M66 -7qHA1SuvPg · M67 3_nmd0z8axk · M68 lOnwbqwok90 · M69 DulTRY8vDFQ · M70 1C25DbqHEq8 · M71 2I3T0qKCtWw · M72 FAVJkWSqxTg · M73 Wdxfbs1dAho · M74 rvu_eq8fe6g · M75 3FNIXKXq7-g · M76 gxm4qAcQNls · M77 svUTDL46Aww · M78 WT2dunrPr8U · M79 SuIqbJroK9o · M80 OPL4GtZ5N6M · M81 FOMSbqkDiYA · M82 STcggSVj0w0

### Qualitätsmaßstab (beste Beispiele laut Einzelanalysen)

- **GommeHD:** 01 (Kampfpose), 53 (Shader-Look), 54 (Biom-Stimmung), 21 (Lava-Aufsicht), 04 (Requisiten-Geschichte), 35 (Froschperspektive), 28 (Rückenansicht), 03 (Größenkontrast), 57 (echte Mobs), 41 (Nacht-Sprung)
- **Paluten:** 48 (Mob-Armee), 24 (Blick zum Objekt), 19 (Zeigen in Untersicht), 18 (TNT-Explosion), 32 (Umzingelung), 46 (V-Pose), 20 (Nachtlicht), 12 (Split-Duell), 02 (Horror), 38 (Knopf und TNT)
- **Negativbeispiele Paluten:** 09, 39, 41, 47, 49 (rohe Screenshots, steife Collage)
