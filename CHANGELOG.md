# Changelog

Alle nennenswerten Änderungen an MoinStudio. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Neue Einträge kommen unter „Unreleased“. `node scripts/release.mts` macht daraus eine Version; die Zeile mit `>` ist die Kurzbeschreibung für die README.

## [Unreleased]

## [0.52.0] - 2026-10-05

> Schnitt: Timeline, Export in 1080p/60 fps mit YouTube-Lautheit

### Added

- Schnitt: Timeline über der ganzen Aufnahme – oben der Schnitt (grün bleibt, rot fliegt raus; Klick auf Rot lässt die Stelle doch drin und zurück), darunter Spuren für Bibliotheks-Effekte, Bild & Text, Kamera & Tempo und Ton. Klick auf einen Effekt springt hin und schaltet ihn an/aus oder löscht ihn; Zoom-Regler für lange Streams. Timeline und Effektliste bleiben gleich.

### Changed

- Export mindestens in 1080p (kleinere Aufnahmen werden hochskaliert), Gaming-Videos immer mit 60 fps, sonst mindestens 30 fps.
- Export-Ton auf YouTube-Lautheit gebracht (−14 LUFS, Spitzen höchstens −1 dBTP), damit das Video weder zu leise ist noch von YouTube heruntergeregelt wird.
- Effekt-Bibliothek nimmt die ganze Breite ein.

## [0.51.0] - 2026-10-05

> Schnitt: Effekte aus der Bibliothek automatisch und per Wunsch

### Added

- Schnitt: Effekte aus der Bibliothek werden nach dem Rohschnitt automatisch gesetzt – je nach ihren Knöpfen (Kanal, Videotyp, in jedem Video / jedes n-te / X % der Videos). „Fester Zeitpunkt“ landet genau dort (z. B. 10 s vor dem Ende), „KI entscheidet“ sucht Claude eine passende Stelle aus dem Transkript. Feste Grenzen: nicht im Hook (erste 15 s), nicht auf lauten Höhepunkten, nie zwei Effekte gleichzeitig, mindestens 20 s Abstand. Passt Claudes Vorschlag nicht, verteilt eine Regel den Effekt auf ein Satzende. Mit „Bibliotheks-Effekte neu verteilen“ geht das jederzeit noch einmal; von Hand gesetzte Effekte bleiben.
- Wünsche in Worten kennen die Bibliothek: „Füge bei 2:14 den Vine-Boom ein“ oder „Pack die Abo-Animation in dieses Video“ setzt genau diesen Effekt mit seinen gespeicherten Einstellungen. In der Effektliste stehen Bibliotheks-Effekte mit ihrem Namen.

### Fixed

- Effekt-Bibliothek: Quelltext wieder im Projektstil formatiert.

## [0.50.1] - 2026-10-05

> Abhängigkeiten aktualisiert (Electron 44.5.1)

### Changed

- Abhängigkeiten aktualisiert: Electron 44.5.1, eslint 10.12, @types/node 26.6.4, @modelcontextprotocol/client und /server 2.3. Weiter zurückgestellt: vite 8, @vitejs/plugin-react 6 und TypeScript 7, weil electron-vite 5.0.0 nur vite bis 7 und typescript-eslint 8.71 TypeScript nur bis < 6.1 unterstützt.

## [0.50.0] - 2026-10-05

> Schnitt: eigene Effekt-Bibliothek mit Greenscreen-Entfernung

### Added

- Schnitt: Effekt-Bibliothek. Eigene Effekte mit Namen anlegen (z. B. „Abonnieren-Animation“, „Vine-Boom“) aus Video mit Transparenz, Greenscreen-Video, Bild und/oder Sound. Alles per Knopf: Häufigkeit (in jedem Video / nur in manchen – jedes n-te oder X % / nur manuell), Kanal, Videotyp, Platzierung (fester Zeitpunkt nach dem Start oder vor dem Ende / KI entscheidet), Position im Bild und Größe. Die Bibliothek liegt im Datenordner, PC und Laptop teilen sie.
- Greenscreen entfernen ohne Adobe: Die Hintergrundfarbe wird beim Hochladen automatisch erkannt, sonst per Pipette im Bild gewählt. Regler für Toleranz, Kantenweichheit und Spill (Grünstich am Rand) mit Live-Vorschau über einem Standbild aus deinem neuesten Projekt. Einstellungen werden pro Effekt gespeichert und beim Rendern genutzt; Videos mit Transparenz (WebM) behalten ihren Alphakanal.

## [0.49.0] - 2026-10-05

> Schnitt: Kanal und Videotyp per Knopf, Regeln für Reaction und Gaming

### Added

- Schnitt: Nach dem Hochladen legst du per Knopf fest, was das Video ist – Kanal (MoinMornhart / MoinMorni) und Videotyp (Reaction / Gaming; bei MoinMornhart automatisch Gaming). Erst dann wird „Schneiden starten“ aktiv; die KI rät den Typ nicht.
- Schnitt-Regeln je Videotyp nach Recherche erfolgreicher Creator (Hook, Rhythmus, Stream-Leerlauf, Reaktionen betonen, Highlights, Text und Sounds). Rohschnitt, Effekt-Wünsche und Highlight-Suche halten sich daran; Pausen werden bei Reaction ab 0,5 s, bei Gaming ab 0,6 s gekürzt (vorher 0,8 s), mit knapperem Puffer.

## [0.48.3] - 2026-10-04

> Videos werden auf jedem Gerät gefunden

### Fixed

- Video „nicht gefunden“ auf dem anderen Gerät: Ein auf dem Laptop importiertes Video (Benutzer „pmorn“) suchte der PC unter genau diesem Pfad, obwohl der Benutzer dort „Morni“ heißt. MoinStudio überträgt Pfade jetzt beim Laden jedes Projekts auf dieses Gerät – für iCloud, OneDrive und alle Ordner unter dem Windows-Benutzer (Videos, Desktop …) – und findet sonst eine Kopie im Projektordner. Gilt für Vorschau, Export, Transkript, Highlights und Premiere, mit iCloud-Datenordner und mit lokalem. Videos, die schon in iCloud liegen, kopiert der Premiere-Export nicht mehr doppelt.

## [0.48.2] - 2026-10-04

> Vorschau und Export langer Videos laufen durch

### Fixed

- Vorschau und Export langer Videos brachen mit „FFmpeg … Cannot allocate memory“ ab: Bei vielen Schnitten (30-Minuten-Aufnahme, 180 Stücke) wurde der Auswahl-Ausdruck für FFmpeg zu lang. Er ist jetzt ein flacher Baum und funktioniert auch bei tausend Schnitten. Texteinblendungen werden außerdem nur noch erzeugt, solange sie zu sehen sind, statt ab Sekunde 0 – das spart bei vielen Texten viel Speicher.

### Changed

- Jede Version bekommt jetzt ein Installationspaket, auch reine Fehlerbehebungen – „Nach Updates suchen“ findet sie sofort.

## [0.48.1] - 2026-10-03

> Transkript bricht bei Verbindungsproblemen nicht mehr ab

### Fixed

- Transkript brach mit „Server disconnected without sending a response“ ab: Das Sprachmodell fragte bei jedem Transkript den Download-Server, auch wenn es längst heruntergeladen war. Jetzt wird ein vorhandenes Modell ohne Internet geladen; nur ein fehlendes wird heruntergeladen, mit bis zu fünf Versuchen.

## [0.48.0] - 2026-10-02

> iCloud ohne Fehlermeldungen, Premiere-Projekte auf jedem Gerät

### Fixed

- iCloud ohne Fehlermeldungen: Während iCloud Dateien hoch- oder herunterlädt, sperrt es sie kurz – die App zeigte dann Fehler. Lesen, Schreiben, Kopieren und Löschen im Datenordner warten solche Sperren jetzt bis zu zehn Sekunden ab. Außerdem stellt MoinStudio den Datenordner beim Start auf „Immer auf diesem Gerät behalten“, damit keine Platzhalter-Dateien mehr Blender, FFmpeg oder Premiere stören.

## [0.47.2] - 2026-10-02

> Premiere-Projekte auf jedem Gerät direkt öffnen

### Fixed

- Premiere ohne „Media offline“ auf jedem Gerät: Beim Start prüft MoinStudio alle Premiere-Sequenzen im Datenordner und schreibt sie neu, wenn sie auf Dateien eines anderen Geräts zeigen. Alte Sequenzen desselben Projekts unter anderem Namen werden entfernt. Die XML im Projektordner lässt sich so auf PC und Laptop direkt öffnen.

## [0.47.1] - 2026-10-02

> Premiere: kein „Media offline“ mehr auf dem zweiten Gerät

### Fixed

- Premiere zeigte „Media offline“: Die Sequenz verlinkte das Rohvideo am Pfad des Geräts, auf dem es importiert wurde – auf einem anderen Gerät gab es ihn nicht. Liegt das Video außerhalb des Datenordners, kommt beim Premiere-Export jetzt eine Kopie in den Projektordner (`quelle/`), die mit iCloud auf jedes Gerät wandert; die Sequenz wird bei jedem Export mit den Pfaden des aktuellen Geräts geschrieben. Auf dem anderen Gerät daher in MoinStudio erneut „In Premiere öffnen“ wählen statt die alte XML direkt zu öffnen.

## [0.47.0] - 2026-10-02

> Premiere-Brücke: Plugin für Premiere Pro (ungetestet)

### Added

- Premiere-Brücke (M12, ungetestet): UXP-Plugin „MoinStudio Bridge“ für Premiere Pro (`premiere-plugin/`) und ein eigener kleiner WebSocket-Server in MoinStudio (nur 127.0.0.1). Das Plugin kennt nur feste Befehle (Projekt anlegen/öffnen, importieren, Sequenzen, speichern, exportieren) und führt sie nur mit dem Zufallsschlüssel aus, den MoinStudio bei jedem Start lokal ablegt.

## [0.46.1] - 2026-10-02

> Bessere Thumbnail-Auswahl, kein Hängenbleiben mehr

### Fixed

- Thumbnail-Auswahl bevorzugte den letzten Versuch: Er bekam keine Bildprüfung durch Claude und hatte deshalb fast immer die wenigsten Warnungen, auch wenn ein früherer Versuch viel besser war (Creeper-Test: großer Creeper im ersten Versuch, im Ergebnis kaum sichtbar). Jetzt wird jeder Versuch gleich geprüft, gemessene Fehler wiegen dreifach.
- Ein hängender Claude-Aufruf blockierte einen Auftrag stundenlang: Jeder Aufruf hat jetzt ein Zeitlimit (Bildprüfung 5 Minuten, sonst 30), danach geht es ohne ihn weiter.
- „Fällt fast runter“: Claude nimmt die Klippen-Kamera mit sichtbarem Abgrund statt der engen Kampf-Kamera.

### Changed

- ROADMAP: neue Blöcke „Clips-Werkstatt“ (M11) und „Premiere als Schnitt-Motor“ mit Schalter „Zuschauen“ (M12).

## [0.46.0] - 2026-10-02

> Abo-Animation und andere Videos im Schnitt einblenden

### Added

- Neuer Baustein „Video-Einblendung“ im Schnitt: Videos mit durchsichtigem Hintergrund (z. B. deine eigene Abo-Animation) laufen an einer Stelle einmal durch, mit ihrem Ton. Claude kennt ihn – „blend den Abo-Balken ein, wenn ich Abo sage“.
- Testschalter `--moin-schnitt-export=<projekt>`: Export mit allen Effekten ohne Oberfläche.

## [0.45.1] - 2026-10-02

> Ghast im Nether wieder weiß

### Fixed

- Weiße Mobs im Nether (Ghast) waren lachsfarben: Ist das Kamera-Thema ein Punkt statt eines Mobs, bekommt jetzt der nächste Mob das eigene Licht; im Nether neutral von vorn und mit schwächerem Gegenlicht in Biomfarbe.

## [0.45.0] - 2026-10-02

> Skin-Intro: deine Figur springt ins Bild, darunter dein Kanalname

### Added

- Skin-Intro im Schnitt: Neuer Intro-Teil „Sting“ – deine Minecraft-Figur springt ins Bild und reckt die Faust (oder winkt, oder schlägt mit dem Schwert zur Kamera), darunter erscheint dein Kanalname mit Wusch, Knall und Ding. Sag einfach „mach ein Intro mit mir“; wie bei großen Kanälen kommt erst der stärkste Moment, der Sting dauert höchstens 3 Sekunden.

## [0.44.0] - 2026-10-02

> Grundlage für Intros: bewegte Szenen mit deinem Skin

### Added

- Grundlage für Intros und Animationen (M10): Blender rendert kurze bewegte Szenen mit Philips Skin – Schlüsselposen werden weich ineinander überblendet, Mimik wechselt, die Kamera fährt, Rand- und Gesichtslicht laufen mit. Hintergrund durchsichtig (für den Schnitt) oder eine Thumbnail-Welt; Ausgabe als Bildfolge für Videos mit Alphakanal (ProRes 4444, VP9).

## [0.43.3] - 2026-10-02

> Bogen gespannt und gut sichtbar

### Fixed

- Bogen beim Zielen: gespannt mit Pfeil (echte Spieltextur), aufrecht mit der Fläche zur Kamera und in der Mitte gegriffen – vorher sah man ihn nur von der Kante als dunklen Zacken. Verdeckt er das Gesicht, rückt er zur Seite.

## [0.43.2] - 2026-10-02

> Hotbar hinter Philip, Werkzeug im Licht, Lava weniger grell

### Fixed

- Die Spiel-Leiste (Hotbar, Herzen, XP) lag über Philips Körper – jetzt steht er davor wie auf einer eigenen Ebene.
- Werkzeuge und Waffen in der Hand bekommen ein eigenes weiches Licht von vorn und verschwinden nicht mehr im Schatten.
- Lava leuchtet etwas schwächer: Ein großer Lavasee überstrahlte das Bild und färbte alles rot.

## [0.43.1] - 2026-10-02

> Thumbnail-Aufträge laufen auch mit iCloud-Platzhaltern

### Fixed

- Thumbnail-Aufträge brachen auf dem Laptop ab („unknown error, copyfile“): Die einmalige Übernahme der Minecraft-Dateien aus dem iCloud-Datenordner scheiterte an Dateien, die nur als iCloud-Platzhalter da waren. Jetzt wird dann einfach frisch von Mojang geladen, und eine abgebrochene Kopie gilt nie als vollständig.
- Philip winzig oder in die Ecke gequetscht: Die Bildprüfung meldet einen zu kleinen Kopf (unter 10 % der Bildhöhe, außer bei weiten Einstellungen) und einen Kopf direkt am Bildrand; die Kamerawahl meidet solche Einstellungen.

## [0.43.0] - 2026-10-02

> Laternen, Lagerfeuer und Co. in echter Form, keine schwebenden Blöcke

### Added

- Blöcke mit eigener Form werden gebaut wie im Spiel – aus den Blockmodellen der Spieldatei statt als Würfel: Laternen, Lagerfeuer, Sculk-Sensor und -Kreischer, Fackeln, Treppen, Zäune und jeder andere Block mit eigener Form.

### Fixed

- Schwebende Blöcke: Einzelblöcke ohne Drehung stehen auf dem Boden darunter (vorher hingen z. B. Seelenlaternen als Würfel über dem Kopf); nur Fliegendes wie explodierendes TNT schwebt.
- Durchsichtige Stellen (Glas, Laub, Flammen, Ranken) bekamen im Entfernungsdunst ein bläuliches Rechteck.
- Claude stellt keine Leuchtblöcke mehr als „Lampe“ vor die Figuren und hält den Vordergrund frei.

## [0.42.0] - 2026-10-02

> Thumbnails veredelt wie bei großen Kanälen, Schwert sitzt richtig in der Faust

### Added

- Thumbnails werden nach dem Render veredelt wie im Photoshop-Schritt großer Kanäle: Hintergrund weicher und etwas dunkler, Figuren und Mobs knackiger und farbiger, Randlicht in der Farbe der Umgebung und eine feine helle Kante – die Figuren stehen jetzt klar vor dem Hintergrund statt darin zu verschwimmen.
- ROADMAP: neue Blöcke „Thumbnail in Spitzenklasse“ (M5b) und „Video: Animation und Intros“ (M10).

### Fixed

- Schwerter und Werkzeuge saßen nicht in der Faust: Bei Übergröße (Kampf, Mob, weite Einstellungen) wuchs das Item um seine Mitte, der Griff rutschte aus der Hand und das Schwert stand oben auf der Faust. Jetzt wächst es um den Griff.
- Beim Hieb drehte das Handgelenk die Klinge nach unten hinten – Waffen zeigen jetzt mit der Spitze nach oben wie bei den Vorbildern.
- Die Figurenmaske (für Photoshop-Ebenen und das Veredeln) zählte durchsichtige Texturstellen mit, z. B. den leeren Kasten um die Ohren des Wardens oder die zweite Skin-Ebene.
- Photoshop-Datei: Die Text-Ebene enthält nur noch den Text, nicht die Veredelung.

## [0.41.5] - 2026-10-02

> Minecraft-Spieldateien lokal – iCloud synchronisiert wieder

### Changed

- Minecraft-Spieldateien und Mob-Tabellen liegen jetzt lokal unter %LOCALAPPDATA%\MoinStudio\mc (wie Blender und Python) statt im Datenordner. Im iCloud-Datenordner blockierten die rund 14.000 kleinen Dateien die Synchronisierung; jedes Gerät lädt sie selbst oder übernimmt sie einmal aus dem alten Ort.

## [0.41.4] - 2026-10-02

> Keine falschen Sync-Konflikte mehr im Datenordner

### Fixed

- Datenordner meldete Hunderte falsche Sync-Konflikte: Eigene Zwischenstände der Thumbnails (Runden wie „v2-r1“ und ihre Prüfberichte) galten als Konfliktkopien. Jetzt erscheinen dort nur noch echte Kopien, die OneDrive beim gleichzeitigen Bearbeiten auf zwei Geräten anlegt.

## [0.41.3] - 2026-10-01

> Beine fließen nicht mehr ineinander

### Fixed

- Beine flossen ineinander: Der Winkel „seitlich“ hatte bei den Beinen das falsche Vorzeichen – gespreizte Beine kreuzten sich zu den Füßen hin und schoben sich übereinander. Jetzt spreizen sie nach außen, mit sauberem Spalt; die Innenseiten liegen im Schatten wie bei echten Beinen.

## [0.41.2] - 2026-10-01

> Axt und Spitzhacke zeigen ihre Form statt nur der Kante

### Fixed

- Werkzeuge, die man nur von der Kante sah (Axt beim Sturmangriff, Spitzhacke beim Stoß), werden um den eigenen Stiel zur Kamera gedreht – die Spitze bleibt, wo sie ist, alle anderen Haltungen bleiben unverändert.

## [0.41.1] - 2026-10-01

> Werkzeuge wieder wie vorher, Beine fließen nicht mehr ineinander, Fackel und Brot gut sichtbar

### Fixed

- Werkzeuge wieder wie in v0.39: Die Zusatzregeln von heute (Fläche zur Kamera, größere Werkzeuge in Nahaufnahmen) haben Axt und Hacke verdreht und zurückgenommen; der Fix für die linke Hand und der Dreizack bleiben.
- Beine: Die Hosen-Ebene ist an der Innenseite nicht mehr aufgebläht – zwischen den Füßen flimmert nichts mehr, und die Beine fließen nicht ineinander.
- Flache Items wie Fackel, Brot oder Blumen werden aufrecht vor der Faust gehalten, mit der Fläche zur Kamera – vorher zeigten sie mit der Spitze zur Kamera und waren kaum zu sehen.

## [0.41.0] - 2026-10-01

> Schöne Gesichtsausdrücke, neue Posen, Blockgelenke statt Gummibeine, Planung erkennt Videos im Schnitt, Spiele-Vorlagen mit echten Handpositionen

### Added

- Planung erkennt Videos im Schnitt von selbst: Kommt ein Video in den Schnitt, verknüpft MoinStudio es mit der passenden Karte (gleicher Kanal, ähnlicher Titel) und schiebt sie in „Schnitt“ – oder legt dort eine neue Karte mit lesbarem Titel an. Karten zeigen jetzt auf einen Blick „Im Schnitt“, „Thumbnail“ und „Text fertig“.
- Spiele-Vorlage: Claude gibt an, wo die Hände der Person im Bild sind, und die Arme der Figur werden genau dorthin gerichtet (Klettern, Greifen, Fliegen) – nie quer vors Gesicht.

### Changed

- Gesichtsausdrücke wie bei den Gesichts-Rigs großer Thumbnail-Künstler: schräge Augenbrauen, Glanzpunkte in den Augen, Lachaugen mit roten Wangen, Mundwinkel hoch oder runter, offener Mund mit Zähnen (und Zunge beim Schreien) – in Pixeln und in den Farben des jeweiligen Skins, auch für Skins ohne Mund.
- Werkzeuge erscheinen 1,2-fach so groß wie im Spiel (wie bei den Vorbildern), flache Items wie Brot noch etwas größer.
- Sieben neue Thumbnail-Posen nach dem Vorbild großer Kanäle: Hände in die Hüften, Facepalm, Ausschau halten, Gegenstand hochhalten, ängstlich abwehren, Werkzeug über der Schulter, zum Schlag ausholen. Arme lassen sich dafür jetzt auch um die eigene Achse drehen.
- Figuren: Knie und Ellbogen knicken wie Blockgelenke statt sich wie Gummi zu biegen; beim Sitzen und Knien laufen die Beine nicht mehr ineinander.

## [0.40.1] - 2026-10-01

> Werkzeuge sitzen in jeder Hand richtig, Reaction/Gaming halten Logos frei, Kamera nimmt wichtige Objekte mit ins Bild

### Fixed

- Reaction- und Gaming-Thumbnails: Philip verdeckt nicht mehr das Logo oder den Titel des Originals – die Figur wird kleiner und rückt an den Rand, bis es frei ist; der Kopf ragt nie über den Bildrand.
- Reaction/Gaming mit Freunden: Die Gruppe hält das Logo frei, ein vom Arm verdeckter Freund bekommt Platz (Philip nimmt dann die Pose ohne Hände), sein Kopf ist nie am Rand angeschnitten; der Spielname passt immer ganz ins Bild und das Wort liegt nicht mehr darüber.
- Werkzeuge in der linken Hand sitzen wieder in der Faust (vorher schwebte z. B. die Spitzhacke daneben – die Spiegelung für die linke Hand fehlte); gedrehte Werkzeuge zeigen ihre Fläche statt der Kante (Axt beim Sturmangriff war nur ein Strich).
- Der Dreizack wird wie im Spiel als 3D-Modell gehalten (langer Stab mit drei Zacken) statt als kleines Inventarbild.
- Minecraft-Thumbnails: Gegenstände, um die es geht (z. B. heranfliegende Blöcke), richtet die Kamera jetzt mit ins Bild aus, statt sie erst hinterher als angeschnitten zu melden.

## [0.40.0] - 2026-10-01

> Claude prüft jedes Thumbnail selbst (auch in Handygröße), geteilte Bilder im Streifenformat, Spiele-Vorlagen ohne Reste der alten Person

### Added

- Minecraft-Thumbnails: Claude prüft jedes gerenderte Bild selbst – in voller Größe und so klein, wie es auf dem Handy in der YouTube-Liste erscheint (erkennt man in unter einer Sekunde, worum es geht? Gesichter frei? Thema sichtbar? Grafikfehler?). Gefundene Probleme werden in der Szene korrigiert und neu gerendert.

### Fixed

- Spiele-Vorlage: Keine Reste der alten Person mehr (Hand mit Taschenlampe, Ärmel) – kleine Teile direkt an der Person werden mit entfernt, und der Rand wächst mit der Bildgröße.
- Spiele-Vorlage: Ist die Person unten angeschnitten (A Way Out), ragt auch die Figur unten hinaus, statt klein zu bleiben und zu schweben; über dem Kopf bleibt etwas Luft.
- Spiele-Vorlage: Sieht die Schlussprüfung noch Reste der alten Person (Hand, Gurt, Waffe), werden genau diese Stellen zusätzlich entfernt und neu aufgefüllt; Löcher in der Personenmaske (Gewehr zwischen den Armen) werden geschlossen.
- Spiele-Vorlage: Ist die Figur viel größer als die Person, wird sie auch verkleinert (Maßstab bei unten angeschnittenen Personen: der Kopf); Schusswaffen zielen schräg zum Betrachter statt genau in die Linse, so dass man ihre Länge sieht.
- Geteilte Bilder (Noob/Pro, 10€/100€/1000€): Jede Hälfte wird gleich im Format ihres Streifens gerendert – ganze Figur mit normalen Beinen statt aufgeblähter Beine am Bildrand, und das Thema bleibt im Streifen. Ganzkörperbilder nutzen 35 statt 30 mm.
- Spiele-Vorlage: Ist von der Person nur ein Teil zu sehen (Brustbild, sitzt im Topf, hinter Deckung), richtet sich die Größe der Figur nach dem Kopf – sie schrumpfte sonst auf Brustbild-Größe. Von vorn gesehene Figuren drehen sich höchstens so weit, dass das Gesicht im Dreiviertelprofil bleibt.
- Spiele-Vorlage: Ein dunkles Logo vor den Personen (Lethal Company) liegt wieder vor der Figur; nach der letzten Korrektur prüft Claude noch einmal, damit die gemeldeten offenen Punkte zum Endbild passen. Fliegende und fallende Figuren liegen schräg im Bild statt senkrecht zu hängen.
- Geteilte Bilder mit Freunden („ich gegen SimPell“): Die zweite Hälfte darf nur den Freund zeigen – vorher scheiterte die Planung daran.

## [0.39.0] - 2026-09-30

> Minecraft-Thumbnails wie bei BastiGHG: Grafik-Ebene, geteilte Bilder, Werkzeuge exakt wie im Spiel, Gegenüber mit Gesicht, alle Mobs geprüft

### Added

- Minecraft-Thumbnails: Grafik-Ebene wie bei BastiGHG – Hotbar mit Herzen, Hunger und XP, „Level 19“, Etiketten im Knopf-Stil, rote Lupe mit Pfeil, Haken-/Kreuz-/Zahl-Abzeichen und großer Regel-Text, alles aus den echten Texturen und der Schrift der Spieldatei. Dazu geteilte Bilder (10€/100€/1000€, Noob/Pro) und eine rote Markierung auf dem Boden.

### Changed

- Minecraft-Thumbnails: heller, sauberer Look; Köpfe in Nahaufnahmen kleiner und nie am Rand angeschnitten; das Thema (z. B. ein Riesen-Mob) bleibt im Bild.
- Werkzeuge und Waffen sind immer gut sichtbar: MoinStudio wählt die Haltung, bei der das Werkzeug ganz im Bild ist und das Gesicht frei bleibt, die Kamera bezieht die Hand mit ein, und bei weiten Einstellungen ist das Werkzeug größer.

### Fixed

- Minecraft-Thumbnails: Die Lupe zeigt auf das richtige Ding (Block, Werkzeug in der Hand) statt auf Philips Auge, liegt nie über einem Gesicht und zeigt bei großen Blöcken ein gutes Stück davon.
- Minecraft-Thumbnails: Text wird nach der Grafik gesetzt und weicht Hotbar, Lupe und Etiketten aus; unten rechts (Videolänge) bleibt frei.
- Minecraft-Thumbnails: Geteilte Bilder (Noob/Pro, 10€/100€/1000€) zeigen Figur und Thema nebeneinander – vorher verdeckte der Kopf das Haus.
- Werkzeuge landen nicht mehr im Kopf: Legt eine Pose die Hand an Kopf oder Brust (Kopfkratzen, Heldenpose, Panik …), wandert das Werkzeug in die freie Hand oder wird locker vor dem Körper gehalten.
- Duelle und Freunde im Bild: Die zweite Figur (z. B. SimPell) dreht sich nach der Kamerawahl so, dass man ihr Gesicht sieht und sie trotzdem Philip anschaut – vorher war sie oft nur von der Seite oder von hinten zu sehen. Die Kamera achtet dafür auch auf das Gesicht des Gegenübers.
- Verschränkte Arme (Heldenpose, „genervt“) liegen vor der Brust statt vor dem Gesicht.
- Text auf Thumbnails wird nie kleiner als 8,5 % der Bildhöhe (auf dem Handy etwa 8 Pixel); unter 10 % gibt es eine Warnung.
- Mobs: Piglin- und Hoglin-Ohren stehen wieder seitlich ab statt im Kopf zu stecken, Drachenflügel sind ausgebreitet (Drehrichtung beim Einlesen der Bedrock-Modelle war vertauscht); der Fuchs hat keinen schwarzen Schlafkopf-Kasten mehr, und Geschosse wie Pfeil, Schneeball oder Erfahrungsflasche tauchen nicht mehr als „Mob“ auf. Hauchdünne Flossen und Flügel (Kabeljau, Lachs, Kugelfisch, Kaulquappe) sind nicht mehr schwarz. Der Tropenfisch ist orange statt weiß. Das Schaf hat wieder Gesicht und Beine (Körper und Wolle wie im Java-Spiel), die Schildkröte keinen schwebenden Eierbauch mehr.
- Blender blieb manchmal nach dem fertigen Bild beim Photoshop-Maskenschritt hängen und renderte bei einem Absturz dort das ganze Bild ein zweites Mal.

### Fixed

- Spiele-Vorlage: Gibt es das gehaltene Ding nicht als freies 3D-Modell, nimmt MoinStudio ein ähnliches (Gewehr statt Schrotflinte, Pistole statt Revolver) statt leerer Hände.
- Spiele-Vorlage: Lange Waffen (Gewehr, Schwert) haben ihre richtige Länge, Schusswaffen zielen nach vorn, und jedes 3D-Modell liegt richtig in der Hand; beim Einpassen bleibt der Kopf immer ganz im Bild.
- Spiele-Vorlage: Die Schlussprüfung kann eine Rückansicht nicht mehr versehentlich in eine Frontansicht drehen.
- Release-Skript: Zusammengeführte Zweige bringen das Hochladen nicht mehr durcheinander.

## [0.38.0] - 2026-09-30

> Logos, Spiele-Vorlage für alles, Namen

### Added

- Neuer Reiter „Logo“: Logos aus einer Beschreibung erstellen (Kanal-, Serien- oder Server-Logo). Claude plant, Blender baut sie aus echten Minecraft-Dateien – Minecraft-Schrift, Blocktexturen, Items, Mob-Köpfe oder dein eigener Kopf – als flache Blockschrift oder echten 3D-Blocktext, immer mit transparentem Hintergrund. Änderungen in Worten stehen als Verlauf darunter wie beim Thumbnail.
- Logo-Bibliothek im Datenordner: Logos hochladen (PNG, JPG, SVG; ohne Transparenz wird der Hintergrund entfernt), umbenennen, löschen, als Standard-Logo für einen Kanal festlegen und als PNG in 512, 1024 oder 2048 px oder als YouTube-Wasserzeichen (150×150) speichern.
- Thumbnail: In jedem Modus (Minecraft, Reaction, Gaming, Spiele-Vorlage) kann ein Logo mit aufs Bild – automatisch in einer freien Ecke oder in deiner Wunsch-Ecke, klein, mittel oder groß. Es steht nie über Figuren, Köpfen, Mobs, Text oder Titeln. Das Standard-Logo des Kanals ist vorausgewählt.
- Thumbnail-Änderungen behalten das Logo; „Logo kleiner“, „Logo nach links“ oder „Logo weg“ gehen in Worten. In der Photoshop-Datei ist das Logo eine eigene Ebene.
- Schnitt: Knopf „Namen vorschlagen“ im Projekt. Claude schlägt aus dem Transkript 5 Titel im Stil des Kanals vor, ein Klick übernimmt den Titel als Namen des Videos und als YouTube-Titel (im Export und in der verknüpften Planungskarte). Projekte lassen sich auch selbst umbenennen, auch aus Claude Desktop (`video_edit`, Aktion `umbenennen`).

### Changed

- Spiele-Vorlage neu für jede Art von Bild: Jede Person bekommt einen eigenen Umriss (Segment Anything + Personenmodell, auch für Spielfiguren, Comic, Roboter), jede Figur wird in ihren Umriss eingepasst (dein Skin und jeder Freund), keine Geister mehr. Ganzkörperposen mit Beinen (klettern, Hechtsprung, hängen, sitzen, knien, fallen, liegen), Verbindungen wie im Original (echte Minecraft-Kette, Seil, Leine). Zum Schluss vergleicht Claude Original und Ergebnis und korrigiert bis zu zweimal, bevor du das Bild siehst. Testreihe mit 17 echten Spiele-Motiven.
- Kämpfe: Du stehst nicht mehr automatisch riesig im Vordergrund. Beide Kämpfer gleich groß auf gleicher Höhe (Duell wie bei GommeHD), der Gegner rückt neben dich; bei Mobs genauso.
- Nether neu nach den Biom-Daten des Spiels: riesige offene Höhle mit Lavameer, Lavafällen, Glowstone und Glut, dazu die Biome Ödland, Karmesinwald, Wirrwald, Seelensandtal und Basaltdeltas mit ihren Nebelfarben; die Figur wird nicht mehr rot eingefärbt.
- Sprechende Dateinamen statt IDs: Thumbnails heißen beim Speichern `Thumbnail_2026-09-30_19-05.png` (Datum und Uhrzeit des Auftrags), mit `_V2` bei mehreren Varianten und `_Aenderung3` bei Änderungen. Gehört das Thumbnail zu einem Video oder einer Planungskarte, steht dessen Name vorne. Das gilt auch für die Photoshop-Datei.
- Schnitt: Das fertige Video, die Premiere-Dateien und Shorts heißen wie das Video (`<Video>.mp4`, `<Video>_Short_1.mp4`, `<Video>_Clip_2.mp4`). Beim Speichern liegen Titel, Beschreibung und Kapitel gleich benannt als `<Video>.txt` daneben.

### Fixed

- Beine wirkten bei manchen Thumbnails zu groß: Kamera von unten nicht mehr mit Weitwinkel (bläst nahe Beine auf), Knie beim Beugen schlanker.
- Bildwerkzeuge stürzten sporadisch ab (OpenCV 5.0, „Unknown C++ exception“): MoinStudio nutzt OpenCV 4 und stellt vorhandene Installationen selbst um.
- Äxte und andere Werkzeuge waren winzig: sie sind jetzt so lang wie ein Schwert und werden nie vors Gesicht gehalten.

## [0.37.0] - 2026-09-30

> Thumbnail-Änderungen als Verlauf

### Changed

- Thumbnail: Änderungen erscheinen jetzt als Verlauf wie in einem Chat unter ihrem Thumbnail statt als eigene Aufträge. Oben steht der Auftrag, darunter jede Änderung mit Wunsch und neuem Bild, ganz unten das Eingabefeld. Geändert wird das neueste Bild oder das per „Ändern“ gewählte. Wer den Auftrag löscht, löscht alle Änderungen mit; einzelne Änderungen lassen sich auch allein löschen.

### Fixed

- Thumbnail-Änderung: Neuer Text (z. B. „Schreib GIGANTISCH in Gelb“) kam nicht ins Bild, wenn die Variante vorher keinen Text hatte; bei einer Änderung an einer Änderung gingen die Texte verloren.

## [0.36.2] - 2026-09-30

> ContentStudio-Prompt: eigene Vorbilder

### Changed

- Doku: ContentStudio-Prompt – Nutzer können jederzeit eigene Vorbild-Thumbnails hinzufügen, für den ganzen Kanal oder nur für einen Auftrag.

## [0.36.1] - 2026-09-30

> Prompt für ContentStudio

### Added

- Doku: Prompt für ContentStudio (docs/contentstudio/PROMPT.md) – MoinStudio als öffentliche App für andere Creator, andere Plattformen und andere KI-Anbieter nachbauen und MoinStudio-Updates automatisch übernehmen.

## [0.36.0] - 2026-09-30

> Mobs und Posen nach Basti, Sicherheitsupdate

### Security

- vitest 5.0 behebt zwei gemeldete Lücken (GHSA-5xrq-8626-4rwp kritisch, GHSA-82fw-gwwq-j7x9 mittel); npm audit: 0 Schwachstellen.

### Changed

- Abhängigkeiten aktualisiert: @types/node 26, MCP-SDK 2.2, eslint-plugin-react-hooks 7.1, typescript-eslint 8.71, @eslint/js 10.0.1, koffi 3.3.2. Zurückgestellt: vite 8 und @vitejs/plugin-react 6 (electron-vite 5 unterstützt nur vite bis 7), TypeScript 7 (typescript-eslint unterstützt nur bis 6.0).
- Thumbnail: Mobs wie bei BastiGHG, GommeHD und Paluten (Vergleich mit 56 Vorbildern): Ein Thema-Mob rückt fast auf gleicher Tiefe neben Philip; kleine Mobs werden fürs Bild vergrößert; neuer Kamera-Modus „mob“ (Figur halbnah, Mob groß daneben); nachts brennen weiße Mobs nicht mehr aus; ist der Mob zu klein im Bild, korrigiert die Selbstprüfung.
- Thumbnail: neue Posen nach Bastis Bildern – kriechen (Bauchlage, Kopf groß vorn), zur_kamera (Gegenstand mit beiden Armen zur Kamera), hervorlugen.

## [0.35.1] - 2026-09-30

> Thumbnail: ohne Vorbild-Hinweis

### Changed

- Thumbnail: Der Hinweis „Orientiert sich an …“ unter den Varianten und in der Großansicht ist weg (Philips Wunsch).

## [0.35.0] - 2026-09-30

> Thumbnail: Boot, Objekte, Fixes

### Added

- Thumbnail: das echte Minecraft-Boot mit Rudern (Mob `boat`), nachgebaut aus dem Java-Modell des Spiels, weil Mojangs Bedrock-Daten es nicht enthalten; Philip sitzt darin in Fahrtrichtung.
- Mob-Import: eingebaute Geometrien für fest einprogrammierte Modelle (Umrechnung Java → Bedrock), Import läuft bei neuem Format von selbst neu.
- Thumbnail: Die Kamera kann auf ein Objekt zielen (`"objekt:0"`), und Objekte, um die es geht (`"wichtig": true`), müssen ganz im Bild sein – sonst korrigiert die Selbstprüfung.

### Fixed

- Thumbnail: „auf“ (auf einem Mob, Heuballen oder Boot stehen/sitzen) setzte die Figur oft an die falsche Stelle, weil die Position des Ziels vor dem Aktualisieren gelesen wurde.
- Thumbnail: Mobs, auf denen eine Figur sitzt, werden nicht mehr als „zu groß“ nach hinten geschoben.
- Einstellungen: Fehlalarm „OneDrive hat Konfliktkopien angelegt“ für mc/mobs/…/mobs-gesamt.json behoben – die Datei ist MoinStudios eigene Mob-Tabelle (heißt jetzt mobs_gesamt.json), der Download-Ordner „mc“ wird nicht mehr als Konflikt geprüft.
- Thumbnail: Weißes Buntglas und andere Graustufen-Texturen mit Transparenz waren undurchsichtig weiß (Cycles verlor beim Laden die Transparenz).

## [0.34.0] - 2026-09-30

> Thumbnail: Augen, Laser, Elytra

### Added

- Thumbnail: Mobs haben leuchtende Augen wie im Spiel (Phantom, Enderman, Spinne), aus den echten Augen-Texturen des Spiels.
- Thumbnail: Verbindungen zwischen Figuren, Gegenständen und Mobs – Angelschnur, Leine und der echte Wächter-Laser.
- Thumbnail: Elytra auf dem Rücken, angelegt oder zum Gleiten ausgebreitet (echtes Modell und echte Textur), dazu die Pose „gleiten“.
- Freiform-Test nachgebessert: 33 gut, 17 mittel, 0 schwach (vorher 29/20/1).

### Fixed

- Thumbnail: Mobs sind nachts und abends wieder ausgeleuchtet (das Fülllicht fehlte dort), kleine Mobs werden nicht mehr überstrahlt.
- Thumbnail: Kleine Mobs, die über den Bildrand ragen, lösen eine Korrektur aus (Phantom halb aus dem Bild).
- Tests: Die Unit-Tests räumen ihre Arbeitsordner im Temp wieder auf (vorher blieben Hunderte liegen und füllten die Festplatte).

## [0.33.0] - 2026-09-30

> Premiere: Effekte

### Added

- Premiere: Effekte kommen mit in die Sequenz – Zooms als Keyframes (auch auf einen Punkt), Texte als Bilder auf Spur V2, jeder Effekt als Marker mit Hinweis, was von Hand gesetzt werden muss (ROADMAP E.6, ungetestet in Premiere).
- Claude Desktop: `video_edit` listet Effekte, schaltet sie an/aus und löscht sie; „aendern“ versteht Effekte und Intros.
- Adobe-Selbsttest: Premiere-Probe und Checkliste prüfen Zoom auf einen Punkt, Text auf V2 und Effekt-Marker.

## [0.32.0] - 2026-09-30

> Schnitt: Wünsche und Effektliste

### Added

- Schnitt: Feld „Was soll passieren?“ – freie Wünsche wie „mach mir ein geiles Intro“ oder „Zeitlupe, wenn der Creeper explodiert“ setzt Claude mit den Effekt-Bausteinen um, danach entsteht die Vorschau von selbst (ROADMAP E.4).
- Schnitt: Claude sieht das Video über einen Bogen mit Standbildern und kennt Anfang und Ende des fertigen Schnitts.
- Schnitt: Effekt „Ausblenden/Einblenden“ – das Bild bleibt schwarz, der Ton geht mit.
- Schnitt: Effektliste unter dem fertigen Schnitt – nach Zeit sortiert, hinspringen, an/aus, löschen (ROADMAP E.5).
- Test: 30 freie Schnitt-Wünsche, Ergebnis in `docs/tests/schnitt-freiform.md` (27 gut, 3 mittel).

### Fixed

- Schnitt: Texteinblendungen sind nie mehr unleserlich klein.
- Datenordner in iCloud: Konfliktkopien wie „projekt 2.json“ werden beim Lesen erkannt und repariert, statt dass das Projekt verschwindet.

## [0.31.0] - 2026-09-30

> Schnitt: Intro-Baukasten

### Hinzugefügt

- Schnitt: Intro-Baukasten. Kurze Momente aus dem Video (auch in Zeitlupe) und Titelkarten in Minecraft-Schrift auf unscharfem Standbild, Schwarz oder einem Bild, mit automatischem Wusch und Knall (ROADMAP E.3).

## [0.30.0] - 2026-09-30

> Schnitt: Effekt-Bausteine

### Hinzugefügt

- Schnitt: Effekt-Bausteine für Vorschau und Export: Zeitlupe und Zeitraffer, Standbild, Zoom auf einen Punkt, Wackeln, Farbe (Töne, Schwarzweiß), Blitz, Übergang, Text in Minecraft-Schrift, Bild, Geräusch, Zensur mit Piep und Lautstärke. Geräusche werden lizenzfrei selbst erzeugt. Untertitel, Zooms und Kapitel passen sich an Zeitlupe und Standbild an (ROADMAP E.2).

## [0.29.8] - 2026-09-30

> Plan: Effekte per Sprache

### Dokumentation

- Plan für Effekte und Intros per Sprache im Schnitt (ROADMAP M6b): Effekte aus kombinierbaren Bausteinen, Claude setzt freie Wünsche wie „mach mir ein geiles Intro“ um.

## [0.29.7] - 2026-09-30

> Thumbnail: Reiten

### Behoben

- Thumbnail: Reiten (Pferd, Kamel, Schreiter …) setzt Philip jetzt wirklich auf das Tier. Freiform-Test: 29 gut, 20 mittel, 1 schwach.

## [0.29.6] - 2026-09-30

> Freiform-Test mit 50 Beschreibungen

### Behoben

- Thumbnail: stärkeres Fülllicht für Themen-Mobs in dunklen Szenen (z. B. Warden in der Nacht).

### Dokumentation

- Freiform-Test mit 50 ungewöhnlichen Beschreibungen aus Philips Inhalten durch den echten Thumbnail-Auftrag: 28 gut, 21 mittel, 1 schwach, kein Abbruch; alle gefundenen Fehler und ihre Behebung in `docs/tests/freeform-poses.md`.

## [0.29.5] - 2026-09-30

> Thumbnail: Gesten und Positionen

### Behoben

- Thumbnail: Gesten mit den Armen (Jubeln, Schulterzucken, Hände vors Gesicht) bekommen eine Kamera, in der die Arme zu sehen sind. Eine gewollte Facepalm-Geste gilt nicht mehr als verdecktes Gesicht. Positionen mit drei Werten [x, y, Höhe] führen nicht mehr zum Absturz.

## [0.29.4] - 2026-09-29

> Thumbnail: alle Blöcke, verdeckte Mobs

### Behoben

- Thumbnail: Alle 1288 Blöcke der Spieldatei lassen sich jetzt darstellen, auch neue Modellformate (`sprite`-Texturen) und Glasscheiben. Rosa Blütenblätter, Wildblumen und Laubstreu sind flache Bodendecker statt schwarzer Würfel. Die Selbstprüfung erkennt verdeckte Mobs, z. B. hinter Philip, und lässt die Szene korrigieren.

## [0.29.3] - 2026-09-29

> Thumbnail: auf etwas stehen, Kürbiskopf

### Behoben

- Thumbnail: Figuren können jetzt auf Mobs und Objekten stehen (`auf`, z. B. Handstand auf dem Creeper, Yoga auf dem Heuballen); MoinStudio rechnet die Höhe selbst aus. Ein Block auf dem Kopf (`kopf`, z. B. geschnitzter Kürbis) dreht mit dem Kopf. Blöcke mit eigenem Gesicht (Kürbis, Ofen) zeigen ihre Vorderseite. Tropfsteine, Entities ohne Geometrie und leere Modellvorlagen führen nicht mehr zum Absturz.

## [0.29.2] - 2026-09-29

> Thumbnail: ungewöhnliche Beschreibungen besser

### Behoben

- Thumbnail bei ungewöhnlichen Beschreibungen (Freiform-Test): Claude kennt jetzt jede Block-ID des Spiels (aus den Blockstates, auch gewachstes Kupfer und Rosa Blütenblätter), typische Blöcke für Biome und Strukturen, freie Posen über `posen_korrektur` und Gegenstände als Item. Es gibt einen neuen Kamera-Modus „ganz“ für Orte und Körperhaltungen. Überstrahlte oder leere Bilder gelten als ernster Fehler und werden korrigiert. Genannte Mobs werden nicht mehr durch andere ersetzt.

## [0.29.1] - 2026-09-29

> README und Aufräumen

### Geändert

- README mit dem aktuellen Stand aller drei Reiter, neuen Aufnahmen von Planung und Kalender und dem Adobe-Selbsttest (ROADMAP 9.1).

### Entfernt

- Veraltete Renders der alten Thumbnail-Pipeline aus `docs/assets/screenshots`. Sie zeigten die abgelehnte Optik und enthielten Minecraft-Texturen.

## [0.29.0] - 2026-09-29

> Adobe-Selbsttest

### Hinzugefügt

- Adobe-Selbsttest (Einstellungen → Adobe → „Selbsttest“, für Entwickler `npm run test:adobe`): erzeugt neutrale Proben, prüft Photoshop automatisch und öffnet eine Checkliste für Premiere. Ohne Adobe endet er mit „übersprungen“ (ROADMAP 8.5).

## [0.28.0] - 2026-09-29

> Thumbnail für Photoshop (ungetestet)

### Hinzugefügt

- Thumbnail für Photoshop (ungetestet): Knopf „Für Photoshop“ an jeder Variante speichert eine PSD mit den Ebenen Hintergrund, Figuren (freigestellt) und Text. Übereinander ergeben sie genau das fertige Thumbnail. Blender rendert dafür zusätzlich eine schnelle Figurenmaske (ROADMAP 8.4).

## [0.27.0] - 2026-09-29

> Schnitt für Premiere (ungetestet)

### Hinzugefügt

- Schnitt für Premiere (ungetestet): Knopf „Für Premiere“ im Schnitt schreibt die Sequenz als FCP7-XML (alle Schnitte aus dem Original, Zooms als Keyframes, Kapitel als Marker) und die Untertitel als SRT. In Premiere über Datei → Importieren weiterschneiden (ROADMAP 8.3).

## [0.26.0] - 2026-09-29

> Adobe-Erkennung (ungetestet)

### Hinzugefügt

- Adobe-Erkennung (ungetestet): Premiere, Photoshop und After Effects werden in den Programmordnern und in der Registry gefunden, mit Version und Beta-Kennzeichnung. Die Karte „Adobe“ in den Einstellungen zeigt das Ergebnis (ROADMAP 8.2).

## [0.25.1] - 2026-09-29

> Plan für die Adobe-Anbindung

### Dokumentation

- Plan für die Adobe-Anbindung (ROADMAP M8): Premiere-Sequenz als FCP7-XML und Photoshop-Datei mit Ebenen, ohne Plugin; alles bleibt „ungetestet“, bis es auf einem Rechner mit Adobe geprüft ist.

## [0.25.0] - 2026-09-29

> Planung: Verbindung zu Schnitt und Thumbnail, Ideen mit Claude, Claude Desktop

### Hinzugefügt

- Planung mit Schnitt und Thumbnail verbunden: aus einer Karte das Rohvideo schneiden oder ein Thumbnail erstellen, Variante direkt in der Karte wählen. Die Karte rückt nach Import, Export und Thumbnail-Wahl von selbst weiter und übernimmt Titel, Beschreibung und Kapitel aus dem Export (ROADMAP 7.5).
- Ideen mit Claude: 10 Video-Ideen je Kanal (optional mit Wunsch), Titelvorschläge für eine Karte und ein Wochenplan, der Karten auf freie Upload-Termine verteilt (ROADMAP 7.6).
- Planung aus Claude Desktop: neues MCP-Werkzeug `planning` (Karten auflisten, anlegen, ändern, verschieben, Kalender, Rhythmus, Ideen). Funktioniert auch, wenn MoinStudio geschlossen ist (ROADMAP 7.7).

## [0.24.0] - 2026-09-29

> Planung: Kalender

### Hinzugefügt

- Planung: Kalender mit Monats- und Wochenansicht für beide Kanäle. Karten per Maus auf einen Tag ziehen, um sie einzuplanen oder zu verschieben. Upload-Rhythmus je Kanal (Wochentage und Uhrzeit); freie Upload-Termine erscheinen im Kalender (ROADMAP 7.4).

## [0.23.0] - 2026-09-29

> Planung: Board

### Hinzugefügt

- Planung: neuer Reiter mit Board je Kanal (Idee, Aufnahme, Schnitt, Thumbnail, Upload, Veröffentlicht). Karten lassen sich anlegen, per Maus verschieben und mit Notizen, Checkliste und Upload-Termin bearbeiten. Änderungen vom anderen Gerät erscheinen von selbst (ROADMAP 7.3).
- Aufnahme-Modus: frei beschreibbare Prüfschritte, mit denen Bedienabläufe in der echten App getestet werden.

## [0.22.0] - 2026-09-29

> Planung: Karten-Speicher

### Hinzugefügt

- Planung: Speicher für Planungskarten im Datenordner, eine Datei pro Karte. Gleichzeitige Änderungen auf PC und Laptop werden Feld für Feld zusammengeführt, statt sich zu überschreiben (ROADMAP 7.2).

## [0.21.1] - 2026-09-29

> Plan für die Planung

### Dokumentation

- Plan für den Reiter Planung (ROADMAP M7): Board je Kanal, Kalender mit Upload-Rhythmus, Verbindung zu Thumbnail und Schnitt, Ideen und Titel mit Claude, MCP-Werkzeug.

## [0.21.0] - 2026-09-29

> Schnitt aus Claude Desktop steuern

### Hinzugefügt

- Schnitt aus Claude Desktop steuern: neues MCP-Werkzeug `video_edit` mit denselben Funktionen wie der Schnitt-Reiter (Projekte, Import, Rohschnitt mit Transkript, Änderungswunsch, Vorschau, YouTube-Export, Highlights, Clips und Shorts) (ROADMAP 6.9).

## [0.20.0] - 2026-09-29

> Schnitt: Stream-Highlights und Shorts

### Hinzugefügt
- Stream-Highlights und Shorts (ROADMAP 6.8): „Höhepunkte finden“ – laute Spitzen plus Claude, das das Transkript in 10-Minuten-Blöcken liest und die stärksten Momente mit Titel und Bewertung wählt. Jeder Moment als Clip (16:9) oder Short (1080×1920): Facecam wird automatisch erkannt und oben eingesetzt, Gameplay darunter, Untertitel Wort für Wort; „Alle als Shorts“ und Ordner öffnen.

## [0.19.0] - 2026-09-29

> Schnitt: Export für YouTube

### Hinzugefügt
- Export für YouTube (ROADMAP 6.7): fertiges Video in voller Qualität aus dem Original nach YouTubes Upload-Empfehlung (H.264 High, 2 B-Frames, Closed GOP, BT.709, AAC 48 kHz, Fast Start, Bitrate nach Auflösung), Encoder aus dem Hardware-Profil (NVENC/AMF/QSV oder CPU). Claude schlägt 3 Titel, eine Beschreibung und Kapitel vor (nach YouTube-Regeln geprüft); die fertige Datei wird geprüft. Speichern unter und „Thumbnail-Vorschläge“ aus dem fertigen Video.

## [0.18.0] - 2026-09-29

> Schnitt: Untertitel, Zooms, geschnittene Vorschau

### Hinzugefügt
- Untertitel und Zooms (ROADMAP 6.6): Untertitel aus dem Transkript, klar oder Wort für Wort hervorgehoben, nur für behaltene Stellen; sanfte Zooms auf Höhepunkte (Ausrufe zuerst, höchstens alle 20 s). „Vorschau rendern“ zeigt den fertigen Schnitt im Reiter.

## [0.17.0] - 2026-09-29

> Schnitt prüfen und ändern

### Hinzugefügt
- Schnitt prüfen und ändern (ROADMAP 6.5): jede Schnittstelle mit einem Klick drinlassen oder wieder rausschneiden, jeden Satz im Transkript raus oder zurück, Änderungswunsch in Worten („lass die Stelle mit dem Creeper länger drin“) – Claude setzt ihn in der Schnittliste um und sagt, was es geändert hat.

## [0.16.0] - 2026-09-29

> Schnitt: automatischer Rohschnitt

### Hinzugefügt
- Automatischer Rohschnitt (ROADMAP 6.4): startet nach dem Transkript von selbst. Lange Pausen werden gekürzt – laute Action-Stellen ohne Sprache bleiben drin –, „ähm“ und abgebrochene Sätze vor ihrer Wiederholung fliegen raus, Claude findet zusätzlich Versprecher und Leerlauf. Ergebnis ist eine Schnittliste, das Original bleibt unverändert. Im Reiter: vorher/nachher, Streifen mit allen Schnitten, Liste mit Gründen, „geschnitten abspielen“.

### Behoben
- Schnitt-Projekte: gleichzeitige Änderungen (Import und neue Aufträge) überschreiben sich nicht mehr gegenseitig.

## [0.15.0] - 2026-09-29

> Schnitt: Transkript lokal mit Whisper

### Hinzugefügt
- Transkript im Schnitt-Reiter (ROADMAP 6.3): startet nach dem Import von selbst, läuft lokal mit faster-whisper (Grafikkarte, wenn möglich, sonst Prozessor), wortgenaue Zeiten, fortsetzbar nach Pause oder Neustart; beim ersten Einsatz wird die Geschwindigkeit gemessen und bei Bedarf ein kleineres Modell gewählt. Jeder Satz mit Zeit, Klick springt im Video hin.

### Geändert
- Gemeinsame Python-Einrichtung für Bild- und Tonwerkzeuge: Pakete kommen erst beim ersten Gebrauch dazu, ohne Paket-Cache.

## [0.14.0] - 2026-09-29

> Schnitt-Reiter: Projekte, Import, Vorschau, Wellenform

### Hinzugefügt
- Schnitt-Reiter neu (ROADMAP 6.2): Projekte anlegen, Rohvideo wählen (bleibt, wo es liegt; nur Pfad, Größe, Prüfsumme), Vorschau in 540p, Wellenform und Standbild-Leiste mit Fortschritt; Player im Reiter, Klick auf Wellenform oder Leiste springt an die Stelle; Projekte löschen.
- Eigenes Medien-Protokoll für Videos im Reiter (Springen per Range-Anfrage, nur Dateien aus dem Datenordner).

### Geändert
- Bildschirmaufnahmen für README und Selbstprüfung warten länger und wiederholen leere Aufnahmen.

## [0.13.1] - 2026-09-29

> Spiele-Vorlage: Hintergrund-Logos bleiben heil, sauberer Titel, kein Geist der alten Person

### Behoben
- Spiele-Vorlage mit großem Logo im Hintergrund (z. B. das goldene „007“ hinter Bond): das Logo wurde als Titel behandelt, teilweise entfernt und golden über die Figur gelegt – jetzt gelten nur Schriften vor der Person als Titel, riesige Logos werden nie angefasst.
- Spiele-Vorlage: Titel über der Person werden vor dem Auffüllen ganz entfernt und danach vollständig wiederhergestellt (kein zerstückeltes „F“ mehr).
- Spiele-Vorlage: Vorabprüfung per Sichtstrahlen, ob die Figur die entfernte Person abdeckt – sonst wird sie passend größer (kein „Geist“ der alten Person); Mindestgröße aus der erkannten Person; Hinweis, falls trotzdem eine Lücke bleibt.

## [0.13.0] - 2026-09-29

> Mit Claude verbinden per Knopf

### Hinzugefügt
- „Mit Claude verbinden“: ein Knopf in den Einstellungen, im Einrichtungsassistenten und oben im Thumbnail-Reiter, solange Claude fehlt. Fehlt Claude Code, richtet Anthropics offizieller Installer es ohne Admin-Rechte ein; danach öffnet sich die offizielle Anmeldung fest mit dem Abo (--claudeai). MoinStudio erkennt die Verbindung selbst, ohne „Erneut prüfen“.

## [0.12.0] - 2026-09-29

> Freunde auch bei Reaction, Gaming und Spiele-Vorlage

### Hinzugefügt
- Freunde auch bei Reaction, Gaming und Spiele-Vorlage (Philip: z. B. Chained Together mit einem Freund): Auswahl „Mit im Bild“ in jeder Karte. Bei Reaction und Gaming steht der Freund neben Philip zur Randseite, beide etwas kleiner, Text und Pfeil meiden beide. Bei Spiele-Vorlagen ersetzen Freunde weitere Personen der Vorlage (alle werden entfernt), sonst stehen sie neben Philip – Größe und Tiefe passend zur Vorlage.

## [0.11.0] - 2026-09-29

> Skin per Minecraft-Name, aufgeräumter Thumbnail-Reiter, bessere Spiele-Vorlagen

### Hinzugefügt
- Skin per Minecraft-Name: Namen eintippen, der aktuelle Skin kommt direkt von Mojang (ohne Anmeldung), inklusive dünner Arme; derselbe Name ersetzt den alten Skin.

### Geändert
- Thumbnail-Reiter aufgeräumt: oben „Was möchtest du machen?“ (Minecraft, Reaction, Gaming, Spiele-Vorlage mit Kanal), darunter nur das passende Formular; die Wahl wird gemerkt.

### Behoben
- Spiele-Vorlage: Vorlagen werden zuerst auf 16:9 gebracht (schwarze Balken weg, kleine Bilder hochskaliert) – der Titel liegt nie mehr doppelt oder versetzt; Titel werden in ihrer echten Farbe (auch schwarz) wiederhergestellt.
- Spiele-Vorlage: Kopf bleibt immer ganz im Bild, Figur nicht mehr übergroß; beidhändiges Zielen (zweite Hand greift an die Waffenhand); Reste des Original-Gegenstands verschwinden.

## [0.10.0] - 2026-09-29

> Lebendiger Text auch bei Minecraft-Thumbnails

### Hinzugefügt
- Lebendiger Text auch bei Minecraft-Thumbnails: Minecraft-Schrift an einer zufälligen freien Stelle (oben bevorzugt), leicht schräg (pixelscharf gedreht), Farbe passend zum Bild; kräftige Farben haben Vorrang vor Weiß.

## [0.9.1] - 2026-09-29

> Spiele-Vorlage: sauberer Hintergrund mit LaMa, Arm zielt automatisch aufs Ziel

### Behoben
- Spiele-Vorlage: Wo die Person war, füllt jetzt LaMa (lokales KI-Modell, Apache-2.0, CPU) echten Hintergrund auf statt einer verschmierten Fläche; Mündungsfeuer und Effekte werden mit entfernt.
- Spiele-Vorlage: Zielt die Person auf etwas, richtet Blender den Arm mit dem Gegenstand automatisch genau dorthin.

## [0.9.0] - 2026-09-29

> Änderungen unter jedem Thumbnail schreiben, Aufträge löschen, Spiele-Vorlage in der App, lebendiger Text, Reaction und Gaming getrennt

### Geändert
- Reaction und Gaming sind getrennte Karten (beide MoinMorni); Gaming vereint Spielbild/eigenen Hintergrund, Spielname und frei beschriebene Pose.
- Ohne Vorbild steht unter jedem Bild die Grundlage, auf der es entstanden ist.
- Spiele-Vorlagen und Änderungen erscheinen in der Auftragsliste.

### Behoben
- „Kein Bild“ bei Aufträgen im iCloud-Ordner: Bilder werden mehrfach gelesen und automatisch nachgeladen.

### Hinzugefügt
- Änderungswunsch unter jedem fertigen Thumbnail (z. B. „Text gelb, Kopf kleiner“): Claude passt die Szene an, Blender rendert eine neue Version als eigenen Auftrag – für Minecraft-Szenen, Reactions, Gaming und Spiele-Vorlagen.
- Aufträge löschen (samt ihren Bildern im Datenordner).
- Spiele-Vorlage als eigene Karte in der App: Spiele-Thumbnail wählen → Claude erkennt Pose, Gegenstand, Ansicht (auch von hinten) und Titel, rembg entfernt die Person, ein passendes CC0-Modell kommt automatisch von Poly Haven, Blender rendert Philip an der Stelle, der Titel kommt wieder obendrauf. Python-Umgebung wird beim ersten Gebrauch selbst eingerichtet.
- Lebendiger Text bei Reactions (Philip: „random rumfliegen, wo Platz ist, farblich anpassen“): zufälliger freier Platz, leicht schräg, Farbe passend zum Bild; wird kleiner statt abgeschnitten; meidet Figur, Hände, wichtiges Detail und Logos/Titel im Original.

## [0.8.0] - 2026-09-29

> Eigenes Bild: Hintergrund hochladen und Pose frei beschreiben; Serie „Minecraft durchspielen“ entfernt

### Hinzugefügt
- Eigenes Bild mit deinem Skin: Hintergrund hochladen, Pose frei beschreiben (z. B. „ich zeige erschrocken nach links“), Claude setzt sie in Winkel um, Blender rendert deinen echten Skin genau so; ohne Pfeil, Wort nur auf Wunsch.

### Entfernt
- Serien-Vorlagen „Minecraft durchspielen“ (Philip: „mach das raus“).

### Geändert
- Requisiten aus Poly Haven: nur das Hauptobjekt wird benutzt, Patronen, Magazine und Varianten fallen weg.
- Kommandozeilen-Tests können mit MOIN_TEST_DATEN einen eigenen Datenordner nutzen.

## [0.7.0] - 2026-09-29

> Spiele-Vorlagen: du an der Stelle der Person im Spiele-Thumbnail; neue Gesten; Reactions mit kleinerer Figur, freiem Gesicht und Pfeil

### Hinzugefügt
- Spiele-Vorlagen (erste Version): Person aus einem Spiele-Thumbnail automatisch entfernen und Hintergrund auffüllen, Philips Skin an ihrer Stelle mit Pose, Mimik und echtem 3D-Requisit (CC0, z. B. Pistole), Titel der Vorlage wird wieder obendrauf gelegt.
- Neue Gesten: müde, winken, nachdenken, Panik, Siegerfaust, genervt sowie beidhändig mit Pistole zielen; Reaction-Gefühle nutzen sie.

### Geändert
- Reaction: Figur steht immer gegenüber dem wichtigen Punkt; liegt er in der Mitte, rückt sie zum Rand und wird bei Bedarf kleiner, damit der Pfeil nie auf Philips Kopf zeigt.
- Reaction: Gesten werden verworfen, wenn sie das Gesicht verdecken oder eine Hand in Wort oder Pfeil ragt; steht die Figur rechts, werden Gesten gespiegelt und zeigen zum Inhalt.
- Reaction: Figur kleiner und näher am Rand (Kopf ~42 % statt 60 % der Bildhöhe), damit mehr vom Original zu sehen ist (Philip: „etwas weniger vom Skin“).
- Gefühle ohne Umlaute („muede“, „wuetend“) werden erkannt.
- Mimik: kein gezeichneter Mund mehr, der Mund aus dem Skin bleibt (nur Lider und Augenringe).

## [0.6.0] - 2026-09-29

> Gaming-Thumbnails mit Spielname, bessere Reaction-Posen, saubere Tiermodelle.

### Hinzugefügt
- Gaming-Thumbnails im Bastian-Stil: Spielbild statt Original, Spielname als Logo in der Ecke gegenüber der Figur.

### Geändert
- Tiere: liegende Körper nehmen Beine und Kopf nicht mehr mit (Schaf, Katze, Ozelot, Schildkröte); Ausrüstung wie Sattel und Taschen wird ausgeblendet; Zombiepferd, Skelettpferd, Esel und Maultier mit dem bewährten Pferdemodell und ihren Originaltexturen.
- Reaction: erste Pose ist immer ohne Hände (Stilbuch 14.3), die zweite Variante bleibt auf Claudes Seite und schaut in die Kamera.

## [0.5.0] - 2026-09-29

> Alle Mobs und Blöcke (immer die neuesten), Enderdrache und End, Mimik und Gesten, Serien-Vorlagen und Reaction-Thumbnails.

### Hinzugefügt
- Alle Mobs, immer die neuesten: automatischer Import aus Mojangs bedrock-samples-Vorschau bei jedem Auftrag (Geometrie, Texturen, Grundhaltung aus den setup-Animationen), derzeit 120 Figuren inklusive noch unveröffentlichter Mobs; die 31 geprüften Mobs behalten Vorrang.
- Reaction-Thumbnails (Stilbuch 14, Vorbilder BastiGHGs Zweitkanal und Zarbex): Original hochladen, Claude erkennt das Wichtigste, wählt Seite, Wort und Gefühl; das Original füllt weich das Bild, Philips Skin kommt groß mit Mimik dazu, ein Wort und ein roter Pfeil; die Pose wechselt jedes Mal (Gedächtnis der letzten Posen); zwei Varianten.
- Mimik (Philip): wütend, traurig, erschrocken, müde, skeptisch, froh, schreiend – Skin-Augen bleiben, dazu Lider mit schräger Kante, Augenringe und ein Mund im leichten Pixel-Stil; Augenzeile und Hautfarbe werden aus dem Skin gelesen. Neue Gesten: jubeln, kopfkratzen, achselzucken.
- Serien-Vorlagen: „Minecraft durchspielen“ mit 8 Folgen (erste Nacht bis Enderdrache); die Folgennummer kommt als Serien-Merkmal in Minecraft-Schrift aufs Bild und weicht aus, wenn ihr Platz belegt ist.
- Blöcke Netherportal (leuchtend, durchsichtig) und Netherziegel.
- Enderdrache, nach dem Spielcode aus den Originalteilen zusammengesetzt (5 Halssegmente, Kopf mit Kiefer, 12 Schwanzsegmente, Flügel mit Spitzen, Beine).
- Neue Welt „end“ (Endstein-Insel mit Obsidiansäulen) und Himmel „end“; bei dunklen Himmeln bekommt ein Thema-Mob eigenes Füll- und Randlicht.
- Alle Blöcke: jeder Block der Spieldatei wird aus seinem Blockmodell abgeleitet (Würfel, Säulen, Front, Kreuz-Pflanzen, Doppelpflanzen); die App lädt immer den neuesten Snapshot inklusive Blockmodellen.

## [0.4.1] - 2026-09-29

> Riesige Mobs passen automatisch ins Bild.

### Behoben
- Riesige Mobs als Thema (z. B. 5-facher Ghast) werden automatisch so weit nach hinten gestellt, dass sie ins Bild passen; ein angeschnittener Riesenmob, der einen guten Teil des Bildes füllt, gilt als sichtbar.

## [0.4.0] - 2026-09-29

> Thumbnail aus Beschreibung oder Video: Claude plant nach großen Vorbildern, Blender rendert, Selbstprüfung korrigiert, Text in Minecraft-Schrift.

### Hinzugefügt
- Thumbnail aus Beschreibung (ROADMAP 5.1): Claude plant über das Abo mehrere Varianten nach Stilbuch und Action-Recherche, jede nennt ihr Vorbild-Thumbnail (config/vorbilder.json); der Baukasten (Posen, Welten, Mobs, Blöcke, Kamera, Himmel) wird direkt aus dem Blender-Code gelesen; ungültige Pläne werden automatisch zur Korrektur zurückgegeben.
- Text in echter Minecraft-Schrift aus der Spieldatei (ROADMAP 5.2): 1–3 Wörter, harter Schatten, Umlaute auf der Grundlinie, Platz automatisch so gewählt, dass nie Figur, Item oder Mob verdeckt wird.
- Strenge Selbstprüfung mit Neubau (ROADMAP 5.3): Bei ernsten Fehlern (Gesicht verdeckt, Sicht versperrt, Gegner zu klein, Item unsichtbar) korrigiert Claude die Szene anhand des Prüfberichts, bis zu zweimal; neue Prüfung „Sicht versperrt“.
- Thumbnail-Reiter (ROADMAP 5.4): Beschreibung, Kanal, Freunde, Anzahl der Varianten; Skin-Bibliothek zum Hochladen; Aufträge mit Fortschritt; Varianten groß ansehen, Vorbild mit Link, Hinweise der Prüfung, Speichern.
- Video hochladen → Thumbnail-Vorschläge (ROADMAP 5.5): FFmpeg zieht 32 Standbilder über das ganze Video, Claude sieht sie sich an, beschreibt den Inhalt und schlägt 3 Thumbnail-Ideen mit Zeitpunkt vor; ein Klick startet den Auftrag.
- Skin-Kacheln zeigen das Gesicht (Kopf plus Hut-Ebene) statt der rohen Textur.
- Kamera kann auf einen Mob zielen („mob:0“, echte Mitte auch bei großen oder schwebenden Mobs).
- Planungstest mit 20 Beschreibungen (docs/tests/planung.md), Video-Test (docs/tests/video-vorschlaege.md) und Integrationstests der App (--moin-thumbnail, --moin-video).
- Minecraft-Texturen lädt die App selbst aus der offiziellen Spieldatei von Mojang (SHA1 geprüft, nur Texturen und Schrift entpackt); Szenen rendern auf der GPU, wenn der Hardware-Test eine gefunden hat.

## [0.3.0] - 2026-09-29

> Blender von Grund auf neu: echte Mobs, Welten, Kampfszenen wie GommeHD, Ellbogen und Knie, Kamera mit Selbstprüfung.

### Hinzugefügt
- Echte Mobs in Blender (ROADMAP 4.6): 31 Mobs mit Originalmodell (Mojangs bedrock-samples) und Originaltextur aus der Spieldatei – Zombie, Skelett, Creeper, Enderman, Warden, Ghast, Blaze, Hexe, Dorfbewohner, Golems, Tiere und mehr. Im Szenen-Bauer mit Position, Größe und Blick zu einer Figur; der Bericht nennt die Bildfläche jedes Mobs.
- Neue Welten Höhle und Nether (ROADMAP 4.3): geschlossene Räume aus echten Blöcken mit Erzen, Tiefenschiefer, Lava- oder Wasserbecken, Glowstone, Magma und Seelensand; warmes Beckenlicht und passender Dunst.
- Neue Welt Dorf: Häuser mit Bruchstein-Sockel, Stamm-Ecken, Glasfenstern, Tür und Fichtendach, Wege, Brunnen, Weizenfeld mit Wasserrinne, Heuballen.
- Blick „auto“: Die Kamera sucht auch die Drehung der Hauptfigur, damit Gesicht im Dreiviertelprofil und Thema zusammen ins Bild passen; das Gesicht schaut immer zur Bildmitte.
- Mobs stellen sich automatisch auf den Boden (auch in Höhlen, nicht aufs Dach).
- Selbstprüfung im Szenenbericht: Warnungen, wenn der Kopf am Rand angeschnitten ist, ein Item oder Mob kaum sichtbar ist oder die Kamera das Stilbuch verfehlt; die Kamera hält den ganzen Kopf im Bild.

- Kampfszenen nach GommeHD „Minecraft Helden“: Posen Sturmangriff, Hieb, Parieren, Getroffen und Rennen (Körper zum Gegner, Kopf zur Kamera, Ausfallschritt, Waffe in der kameranahen Hand), Kamera-Modus „kampf“ (Kamera immer vor beiden Gegnern), Gegner als Thema der Kamera, Figuren mit Höhe (in der Luft) und automatischem Bodenkontakt.

- Kampf-Look nach Recherche von 72 Action-Thumbnails (GommeHD Helden u. a.): Himmel „blutrot“ und „gewitter“, Farbduell im Randlicht (Held kühl, Gegner warm), gekippte Kamera, Schwerter nah an der Kamera 1,4-fach, Held groß vorn und Gegner dahinter.
- Selbstprüfung: Warnung, wenn ein Item das Gesicht einer anderen Figur verdeckt oder der Gegner im Kampf zu klein ist.
- Kamera mit Bildprüfung: Die Kamera liefert bis zu sechs gute Vorschläge; gewählt wird der mit den wenigsten Warnungen (Schwert im Bild, Gesichter frei, Gegner groß genug). Kamerahöhe, Linse und Kopfgröße lassen sich je Szene anpassen.

- Ellbogen und Knie: Arme und Beine lassen sich in der Mitte beugen („beugen“ in jeder Pose). Die Glieder biegen sich weich um die Innenkante, die Pixeltextur geht mit und am Gelenk entsteht keine Lücke. Gehaltene Items folgen dem gebeugten Unterarm; alle Posen haben passende Beugungen.

- Weitere Kampfposen aus der Recherche: Schwerter kreuzen, Sprungangriff, Stoß, Weggeschleudert, Bogen spannen.
- Gegner rechts im Bild bekommen die Pose automatisch gespiegelt (Waffe in der kameranahen Hand, Brust und Gesicht zur Kamera); abschaltbar mit „spiegeln“.
- Echte Sichtprüfung der Gesichter: Strahlen von der Kamera auf jedes Gesicht erkennen, ob ein Arm, ein Schwert oder ein Mob es verdeckt oder ob es abgewandt ist; fließt in die Wahl des Kamera-Vorschlags ein.

- Blöcke frei setzen oder wegnehmen in jeder Welt („bloecke“: Bedrock-Wand, Grube mit automatischen Steinwänden, Säulen), frei fliegende gedrehte Einzelblöcke („objekte“, z. B. TNT), neue Welten Lavameer und Meer; Items mit Blocktextur (Fackel) werden gefunden.
- Nachbau-Test mit 10 Vorbildern von GommeHD, BastiGHG, Paluten, Castcrafter und TriDan (ROADMAP 4.7, docs/tests/nachbau-test.md).

### Geändert
- Figuren über einem Abgrund bleiben auf Höhe der Kante (statt auf den Grund gestellt zu werden).
- Kippen der Figur: positiv heißt jetzt wie beschrieben nach hinten (war vertauscht).
- Selbstprüfung strenger: Items müssen zu 90 % im Bild sein, der Kopf der Hauptfigur vollständig.
- Look näher an den Vorbildern: Hintergrund unschärfer (Blende 2,0), weiche Randabdunklung (Blender 4 und 5) und Randlicht immer hinter der Figur aus Kamerasicht; Gras und Blumen direkt vor der Linse werden entfernt, Lampen sind für die Kamera unsichtbar.
- Pose „Schreck“: zurückweichen mit beiden Händen neben dem Kopf, damit Gesicht und Mobs frei bleiben; Wiese mit weniger dichtem Gras.

## [0.2.0] - 2026-09-29

> Vorbilder und Stilbuch aus über 290 Thumbnails großer Kanäle; Blender-Neubau mit echter Welt, Himmel, Posen und Schwert.

### Hinzugefügt
- Stilbuch aus 196 Thumbnails großer Minecraft-Kanäle (BastiGHG, GommeHD, Paluten, Castcrafter, Papaplatte): Posen mit Winkeln, Items, Kamera, Licht, Welt, Gesichter, Text, Abnahme-Checkliste (`docs/research/stilbuch.md`).
- Vergleichswerkzeug: unser Bild neben ein Vorbild-Thumbnail (`scripts/vergleich.mts`).
- Stilbuch Abschnitt 14: Reactions und Gaming nach BastiGHGs Zweitkanal und Zarbex (96 Thumbnails), immer mit echtem Skin.
- Blender-Neubau (Teil 1): Figur aus dem Skin mit zweiter Ebene und Gelenken, Posen aus dem Stilbuch, Blockwelt mit echten Texturen (Wiese, Klippe, Meer, Gras, Blumen, Bäume), Himmel mit Wolken, Entfernungsdunst, Kamera-Automatik nach Stilbuch, Items aus echter Textur (Schwert diagonal und flach zur Kamera), Szenen-Bauer aus einer JSON-Beschreibung, Farbkorrektur für Blender 4 und 5.

## [0.1.0] - 2026-09-28

> Neustart: das App-Fundament – Installer, Updates, Einrichtung, Hardware-Test, Aufgaben, Claude- und Blender-Anbindung.

### Hinzugefügt
- Electron-App mit den Reitern Thumbnail, Schnitt, Planung und Einstellungen (Thumbnail und Schnitt werden neu aufgebaut).
- Installer ohne Admin-Rechte mit Startmenü, Desktop-Verknüpfung und optionalem Autostart; Selbst-Update aus den GitHub-Releases.
- Einrichtungsassistent: Datenordner, Claude, Werkzeuge, Hardware, Adobe.
- Hardware-Test pro Gerät mit Blender-Messung und Rückfällen für Rechner ohne GPU.
- Werkzeuge (Blender, FFmpeg, Python/uv) lädt die App selbst, geprüft per SHA256.
- Aufgaben-Warteschlange mit Fortschritt, Pause, Abbruch und Fortsetzen nach Neustart.
- Claude über das eigene Abo (Claude Code headless, MCP-Server für Claude Desktop), nie mit API-Key.
- Frei wählbarer Datenordner (z. B. OneDrive) mit OneDrive-sicherem Speichern.
