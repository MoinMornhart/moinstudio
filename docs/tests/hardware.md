# Test: Hardware-Test und Auto-Konfiguration (ROADMAP 2.7)

Datum: 2026-09-26 · Rechner: Entwicklungs-VM (QEMU, 4 Threads, 9,3 GB RAM, **keine GPU**, CPU ohne AVX/RDTSCP)

## Ablauf auf der VM (echter Lauf, `MoinStudio.exe --moin-hwtest`, installierte Variante)

| Schritt | Ergebnis |
|---------|----------|
| Hardware erkennen (PowerShell/WMI + Registry-VRAM) | „Microsoft Basic Display Adapter“, als nicht-physisch erkannt |
| Blender 5.2.2: Workbench / EEVEE | Absturz (kein OpenGL) → als „nicht verfügbar“ gewertet |
| Blender 5.2.2: Cycles CPU | Absturz `Illegal instruction` (RDTSCP fehlt) → erkannt |
| Rückfall: Blender 4.5.9 LTS automatisch geladen und getestet | Cycles CPU ✅ 4,6 s (480×270, 16 Samples) |
| Keine GPU → Mesa (Software-OpenGL) geladen, neben Blender gelegt | Workbench ✅ 2,7 s, EEVEE ✅ ~32 s |
| FFmpeg-Encoder | NVENC/AMF/QSV nicht verfügbar, libx264 ✅ ~51 fps |
| Entscheidung | Blender 4.5.9 + Mesa · Vorschau Workbench · Endbild Cycles CPU, 32 Samples (~140 s) · libx264 · Whisper small (CPU) · Bildmodelle aus |
| Dauer | 56–62 s (erster Lauf inkl. Download von Blender 4.5.9: 89 s) |

## Gefundene und behobene Fehler

1. **Mesa-Läufe brachen mit Exit-Code 87 ab.** Ursache: Mesa braucht `GALLIUM_DRIVER=llvmpipe`, sonst wählt es einen anderen Treiber. Die Variable wird jetzt bei jedem Blender-Aufruf mit Mesa gesetzt (Recherche-Doku ergänzt).
2. **Die Endbild-Wahl nahm EEVEE über Mesa mit geschätzten 34 Minuten**, obwohl Cycles CPU mit 32 Samples ~2,5 Minuten braucht. Jetzt werden die Kandidaten in Qualitätsreihenfolge gegen ein Zeitbudget (180 s) geprüft. Passt keiner, gewinnt der schnellste.
3. **Die Einstellungen zeigten lange „Lade …“**, weil die Prüfung auf Hardware-Änderung (PowerShell) vor der Antwort lief. Jetzt kommt das Profil sofort, die Prüfung läuft im Hintergrund.

## Automatische Tests (simulierte Geräte, `tests/unit/hardware.test.ts`)

Gaming-PC mit NVIDIA (Cycles OptiX, NVENC, Whisper large auf CUDA, FLUX) · AMD (Cycles HIP, AMF, SDXL) · Laptop mit Intel-Grafik (EEVEE, QSV, keine Bildmodelle) · Rechner ohne GPU (Mesa, Cycles CPU, x264) · VM mit Blender-Rückfall · „Cycles-Version vor neuerer Version ohne Cycles“ · Blender gar nicht lauffähig · Zeitbudget. Dazu Erkennung (Hersteller-IDs, VRAM als QWORD/REG_BINARY), Absturzcodes, FFmpeg-fps und der Fingerabdruck (neuer Test bei GPU-/Treiber-/Minor-Versions-Wechsel, nicht bei Patch-Updates).

## Noch offen

- Echte GPU-Rechner (NVIDIA/AMD/Intel) → auf Philips PC und Laptop (ROADMAP 10.2).
- Whisper und ONNX werden vorerst nach Hardware eingestuft und erst beim ersten echten Einsatz gemessen (M6/M7). Ein Modell-Download nur für den Test würde das Ziel von unter 3 Minuten sprengen.
