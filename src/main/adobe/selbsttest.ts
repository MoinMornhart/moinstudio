import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { premiereXml, srt } from './premiere'
import { schreibePsd, type PsdEbene } from './psd'

/**
 * Adobe-Selbsttest (ROADMAP 8.5): erzeugt neutrale Proben (Testbild statt Minecraft, nichts Privates) und prüft
 * Photoshop automatisch über COM. Premiere lässt sich ohne Plugin nicht fernsteuern; dafür gibt es eine Checkliste
 * mit den erwarteten Werten. Ohne Adobe endet alles mit „übersprungen“, nie mit einem Fehler.
 */

export const PROBE = {
  video: { dauer: 20, fps: 30, breite: 1280, hoehe: 720 },
  behalten: [
    { start: 0, ende: 5 },
    { start: 8, ende: 14 },
    { start: 16, ende: 20 }
  ],
  /** Zeit im Schnitt: liegt im zweiten Stück */
  zooms: [{ start: 6, ende: 9 }],
  kapitel: [
    { zeit: 0, titel: 'Start' },
    { zeit: 5, titel: 'Mitte' }
  ],
  psd: { breite: 640, hoehe: 360, ebenen: ['Hintergrund', 'Figuren', 'Text'] }
} as const

export interface Erwartung {
  premiere: { sequenz: string; frames: number; clips: number; marker: string[]; zoomProzent: number; untertitel: number }
  photoshop: { breite: number; hoehe: number; ebenen: string[] }
}

/** Synthetische Ebenen: Verlauf, ein freigestelltes Quadrat, ein Textbalken */
export function probeEbenen(breite: number, hoehe: number): { ebenen: PsdEbene[]; gesamt: Uint8Array } {
  const px = breite * hoehe
  const hg = new Uint8Array(px * 4)
  const fig = new Uint8Array(px * 4)
  const text = new Uint8Array(px * 4)
  const gesamt = new Uint8Array(px * 4)
  for (let y = 0; y < hoehe; y++)
    for (let x = 0; x < breite; x++) {
      const o = (y * breite + x) * 4
      hg.set([Math.round((x / breite) * 255), 80, Math.round((y / hoehe) * 255), 255], o)
      const inFig = x > breite * 0.1 && x < breite * 0.4 && y > hoehe * 0.3
      const inText = x > breite * 0.5 && x < breite * 0.95 && y > hoehe * 0.08 && y < hoehe * 0.25
      if (inFig) fig.set([60, 200, 60, 255], o)
      if (inText) text.set([255, 220, 0, 255], o)
      gesamt.set(inText ? [255, 220, 0, 255] : inFig ? [60, 200, 60, 255] : hg.subarray(o, o + 4), o)
    }
  return {
    ebenen: [
      { name: 'Hintergrund', rgba: hg },
      { name: 'Figuren', rgba: fig },
      { name: 'Text', rgba: text }
    ],
    gesamt
  }
}

const lauf = (exe: string, args: string[], timeout = 120_000): Promise<{ code: number; out: string }> =>
  new Promise((resolve) => {
    execFile(exe, args, { windowsHide: true, timeout, maxBuffer: 10_000_000 }, (err, stdout, stderr) => resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, out: `${stdout}${stderr}` }))
  })

/** Schreibt Testvideo, Premiere-Sequenz, Untertitel, PSD und die erwarteten Werte in `ordner`. */
export async function erzeugeProben(ordner: string, ffmpeg: string): Promise<Erwartung> {
  await mkdir(ordner, { recursive: true })
  const v = PROBE.video
  const video = join(ordner, 'testvideo.mp4')
  const r = await lauf(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${v.breite}x${v.hoehe}:rate=${v.fps}`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', String(v.dauer), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', video])
  if (r.code !== 0) throw new Error(`Testvideo ließ sich nicht erzeugen: ${r.out.trim().slice(-300)}`)
  const liste = { version: 1 as const, dauer: v.dauer, behalten: PROBE.behalten.map((b) => ({ ...b })), entfernt: [] }
  const sequenz = 'MoinStudio Adobe-Test'
  await writeFile(join(ordner, 'sequenz.xml'), premiereXml({ name: sequenz, quelle: { pfad: video, ...v, audio: true }, liste, zooms: PROBE.zooms.map((z) => ({ ...z })), kapitel: PROBE.kapitel.map((k) => ({ ...k })) }))
  const zeilen = [
    { start: 0.5, ende: 2.5, text: 'Erster Untertitel' },
    { start: 6, ende: 8, text: 'Zweiter Untertitel' },
    { start: 12, ende: 14, text: 'Dritter Untertitel' }
  ]
  await writeFile(join(ordner, 'untertitel.srt'), srt(zeilen))
  const { breite, hoehe } = PROBE.psd
  const p = probeEbenen(breite, hoehe)
  await writeFile(join(ordner, 'ebenen.psd'), schreibePsd(breite, hoehe, p.ebenen, p.gesamt))
  const frames = PROBE.behalten.reduce((s, b) => s + Math.round(b.ende * v.fps) - Math.round(b.start * v.fps), 0)
  const erwartung: Erwartung = {
    premiere: { sequenz, frames, clips: PROBE.behalten.length, marker: PROBE.kapitel.map((k) => k.titel), zoomProzent: 112, untertitel: zeilen.length },
    photoshop: { breite, hoehe, ebenen: [...PROBE.psd.ebenen] }
  }
  await writeFile(join(ordner, 'erwartung.json'), JSON.stringify(erwartung, null, 2))
  return erwartung
}

export interface PruefErgebnis {
  status: 'ok' | 'fehler' | 'übersprungen'
  details: string
}

/** Photoshop per COM: PSD öffnen, Größe und Ebenen mit der Erwartung vergleichen, ohne Speichern schließen. */
export async function pruefePhotoshop(psd: string, erwartet: Erwartung['photoshop']): Promise<PruefErgebnis> {
  const skript = `
$ErrorActionPreference = 'Stop'
try { $ps = New-Object -ComObject Photoshop.Application } catch { Write-Output 'MOIN_PS_FEHLT'; exit 0 }
$alt = $ps.Preferences.RulerUnits
$ps.Preferences.RulerUnits = 1
$ps.DisplayDialogs = 3
try {
  $doc = $ps.Open('${psd.replace(/'/g, "''")}')
  $namen = @()
  foreach ($l in $doc.ArtLayers) { $namen += $l.Name }
  [array]::Reverse($namen)
  Write-Output ('MOIN_PS ' + (@{ breite = [int]$doc.Width; hoehe = [int]$doc.Height; ebenen = $namen } | ConvertTo-Json -Compress))
  $doc.Close(2)
} finally { $ps.Preferences.RulerUnits = $alt }
`
  const r = await lauf('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', skript], 180_000)
  if (r.out.includes('MOIN_PS_FEHLT')) return { status: 'übersprungen', details: 'Photoshop ist nicht installiert.' }
  const m = /MOIN_PS (\{.*\})/.exec(r.out)
  if (!m) return { status: 'fehler', details: `Photoshop hat die Datei nicht geöffnet: ${r.out.trim().slice(-300)}` }
  const ist = JSON.parse(m[1]!) as { breite: number; hoehe: number; ebenen: string[] | string }
  const ebenen = Array.isArray(ist.ebenen) ? ist.ebenen : [ist.ebenen]
  const ok = ist.breite === erwartet.breite && ist.hoehe === erwartet.hoehe && JSON.stringify(ebenen) === JSON.stringify(erwartet.ebenen)
  return { status: ok ? 'ok' : 'fehler', details: `Größe ${ist.breite}×${ist.hoehe}, Ebenen ${ebenen.join(', ')} (erwartet ${erwartet.breite}×${erwartet.hoehe}, ${erwartet.ebenen.join(', ')})` }
}

/** Checkliste für Premiere mit den erwarteten Werten (Premiere lässt sich ohne Plugin nicht fernsteuern). */
export function premiereCheckliste(e: Erwartung['premiere'], ordner: string): string {
  const sek = (e.frames / PROBE.video.fps).toFixed(0)
  return `# Adobe-Selbsttest: Premiere

Ordner: ${ordner}

1. Premiere öffnen, neues Projekt anlegen.
2. Datei → Importieren → sequenz.xml wählen.
3. Prüfen:
   - [ ] Es gibt eine Sequenz „${e.sequenz}“ mit ${sek} Sekunden (${e.frames} Frames bei 30 fps).
   - [ ] Auf V1 und A1 liegen je ${e.clips} Clips ohne Lücke (Testbild mit Zähler, Ton 440 Hz).
   - [ ] Beim zweiten Clip zoomt das Bild sanft auf ${e.zoomProzent} % und wieder zurück (Effekteinstellungen → Bewegung → Skalierung mit Keyframes).
   - [ ] Sequenz-Marker: ${e.marker.join(', ')}.
4. Datei → Importieren → untertitel.srt, auf die Sequenz ziehen:
   - [ ] ${e.untertitel} Untertitel erscheinen zur richtigen Zeit.

Wenn alles stimmt, in MoinStudio unter Einstellungen → Adobe „Premiere geprüft“ melden (oder Claude Bescheid geben).
Wenn etwas nicht stimmt: Bildschirmfoto an Claude schicken.
`
}
