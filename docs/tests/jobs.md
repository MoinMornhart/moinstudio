# Test: Job-System mit Pause (ROADMAP 2.8)

Datum: 2026-09-26 · Rechner: Entwicklungs-VM

## Automatische Tests (`tests/unit/jobs.test.ts`, 4 Läufe hintereinander grün)

| Fall | Ergebnis |
|------|----------|
| Jobs laufen nacheinander (nie zwei gleichzeitig), Ergebnis wird gespeichert | ✅ |
| Pause am nächsten Pausenpunkt, danach Fortsetzen bis zum Ende | ✅ |
| Abbruch eines laufenden Jobs, danach startet der nächste | ✅ |
| Fehler werden mit Text gemeldet | ✅ |
| Nach einem simulierten Absturz setzt ein neuer Start ab dem letzten Checkpoint fort (Schritte werden nicht wiederholt) | ✅ |
| Claude-Abo-Limit: Job wartet bis zum Zeitpunkt, startet dann selbst neu mit Checkpoint | ✅ |
| „Rechenlast pausieren“ hält alles an – auch über einen Neustart hinweg | ✅ |
| Angemeldete Kindprozesse werden per `NtSuspendProcess` wirklich angehalten und per `NtResumeProcess` fortgesetzt | ✅ |

## Echter Durchlauf mit Blender (`MoinStudio --moin-probe`)

```
0.0s  Job gestartet (Probebild, Blender 4.5.9 Workbench über Mesa, 960×540)
1.6s  pausiert: paused      ← Blender-Prozess angehalten
4.7s  fortgesetzt: running  ← Blender läuft weiter
13.2s Ende: done            ← Bild gespeichert
```

**Gefundene Test-Fehler (nicht im Code):** Zwei Tests waren auf der langsamen VM zeitkritisch. Einer wartete zu kurz auf das Speichern des Checkpoints, im anderen beendete sich der Kindprozess nach Wandzeit statt nach Arbeitsschritten. Beide warten jetzt auf echte Ereignisse.
