# Changelog

Alle nennenswerten Änderungen an MoinStudio. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

Neue Einträge kommen unter „Unreleased“. `node scripts/release.mts` macht daraus eine Version; die Zeile mit `>` ist die Kurzbeschreibung für die README.

## [Unreleased]

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
