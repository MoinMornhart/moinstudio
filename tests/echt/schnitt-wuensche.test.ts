/**
 * Freiform-Test Schnitt (ROADMAP E.4): 30 ungewöhnliche Wünsche in Worten. Für jeden: Claude setzt ihn um (Schnitt +
 * Effekte), MoinStudio rendert die Vorschau, Standbilder an den Effekt-Stellen landen in test-output/schnitt-wuensche/.
 * Schnitt und Effekte werden vor jedem Wunsch auf den Ausgangsstand zurückgesetzt. Fertige Fälle werden übersprungen;
 * MOIN_NUR=3,17 wiederholt gezielt (vorher deren Ordner löschen).
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/schnitt-wuensche.test.ts
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findClaudeCli } from '../../src/main/claude/cli'
import type { JobContext } from '../../src/main/jobs/queue'
import { wunschJob } from '../../src/main/schnitt/bearbeiten'
import { effektGraph, effekteInSchnittzeit, type Effekt } from '../../src/main/schnitt/effekte'
import type { Schnittliste } from '../../src/main/schnitt/rohschnitt'
import { vorschauJob } from '../../src/main/schnitt/vorschau'

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const FFMPEG = join(LOKAL, 'ffmpeg', '9.0', 'bin', 'ffmpeg.exe')
const DATEN = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/iCloudDrive/MoinStudio'
const AUS = join(ROOT, 'test-output', 'schnitt-wuensche')
const PROJEKTE = { sprache: '779d0e67', stream: '1e83ac82' } as const

export const WUENSCHE: { projekt: keyof typeof PROJEKTE; wunsch: string }[] = [
  { projekt: 'sprache', wunsch: 'Mach mir ein geiles Intro' },
  { projekt: 'sprache', wunsch: 'Zeitlupe, wenn der Creeper explodiert' },
  { projekt: 'sprache', wunsch: 'Mehr Action!' },
  { projekt: 'sprache', wunsch: 'Mach es lustiger, so wie bei Paluten' },
  { projekt: 'sprache', wunsch: 'Wenn ich „Oh nein“ sage, soll das Bild wackeln und es soll knallen' },
  { projekt: 'sprache', wunsch: 'Am Anfang eine Schwarzweiß-Rückblende' },
  { projekt: 'sprache', wunsch: 'Friere das Bild ein, wenn der Creeper auftaucht, und schreib WAS?! drauf' },
  { projekt: 'sprache', wunsch: 'Blende am Ende langsam schwarz aus' },
  { projekt: 'sprache', wunsch: 'Zensier das erste Wort, das ich sage' },
  { projekt: 'sprache', wunsch: 'Den Teil mit den Fackeln doppelt so schnell' },
  { projekt: 'sprache', wunsch: 'Zoom auf mein Gesicht, wenn ich überrascht bin' },
  { projekt: 'sprache', wunsch: 'Pack einen Fail-Sound rein, wenn das Haus weg ist' },
  { projekt: 'sprache', wunsch: 'Titel am Anfang: Mein erstes Haus' },
  { projekt: 'sprache', wunsch: 'Mach alles rot, wenn es gefährlich wird' },
  { projekt: 'sprache', wunsch: 'Kinoreif: warme Farben und am Anfang eine Titelkarte' },
  { projekt: 'sprache', wunsch: 'Ein Trommelwirbel vor der Explosion' },
  { projekt: 'sprache', wunsch: 'Mach ein Intro wie bei BastiGHG' },
  { projekt: 'sprache', wunsch: 'Lass Emojis durchs Bild fliegen' },
  { projekt: 'sprache', wunsch: 'Mach das Video spannender, ohne etwas rauszuschneiden' },
  { projekt: 'sprache', wunsch: 'Die ersten zwei Sätze raus und dafür ein kurzes Intro' },
  { projekt: 'stream', wunsch: 'Mach ein Intro aus den besten Momenten des Streams' },
  { projekt: 'stream', wunsch: 'Zeitlupe bei der Explosion mit Knall und Wackeln' },
  { projekt: 'stream', wunsch: 'Schreib DIAMANTEN! wenn ich die Diamanten finde, mit Kaching' },
  { projekt: 'stream', wunsch: 'Mach die langweiligen Stellen schneller' },
  { projekt: 'stream', wunsch: 'Herzschlag, wenn es spannend wird' },
  { projekt: 'stream', wunsch: 'Mach es wie einen Horrorfilm' },
  { projekt: 'stream', wunsch: 'Kurze Blitze bei jedem lauten Moment' },
  { projekt: 'stream', wunsch: 'Am Anfang eine Titelkarte „Stream-Highlights“' },
  { projekt: 'stream', wunsch: 'Zensier die Stelle, wo ich fluche' },
  { projekt: 'stream', wunsch: 'Mach aus dem Ende einen Cliffhanger mit Standbild und Trommelwirbel' }
]

function kontext(id: string): JobContext<{ claudeSession?: string; claudePrompted?: boolean }> {
  let cp: { claudeSession?: string; claudePrompted?: boolean } | undefined
  return {
    id,
    get checkpoint() {
      return cp
    },
    save: async (c) => {
      cp = c
    },
    progress: () => undefined,
    yield: async () => undefined,
    signal: new AbortController().signal,
    track: () => undefined,
    waitUntil: () => {
      throw new Error('Claude-Limit erreicht')
    }
  }
}

it(
  `${WUENSCHE.length} Schnitt-Wünsche in Worten`,
  async () => {
    const cli = await findClaudeCli()
    expect(cli).toBeTruthy()
    const nur = process.env['MOIN_NUR']?.split(',').map(Number)
    const hilfe = { ffmpeg: FFMPEG, python: join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe'), textSkript: join(ROOT, 'blender', 'text_bild.py'), lokal: LOKAL }
    // Ausgangsstand sichern
    for (const id of Object.values(PROJEKTE)) {
      const o = join(DATEN, 'schnitt', id)
      if (!existsSync(join(o, 'schnitt.basis.json'))) await copyFile(join(o, 'schnitt.json'), join(o, 'schnitt.basis.json'))
    }
    for (const [i, w] of WUENSCHE.entries()) {
      const nr = i + 1
      if (nur && !nur.includes(nr)) continue
      const ziel = join(AUS, String(nr).padStart(2, '0'))
      if (existsSync(join(ziel, 'ergebnis.json'))) continue
      await mkdir(ziel, { recursive: true })
      const id = PROJEKTE[w.projekt]
      const ordner = join(DATEN, 'schnitt', id)
      await copyFile(join(ordner, 'schnitt.basis.json'), join(ordner, 'schnitt.json'))
      await rm(join(ordner, 'effekte.json'), { force: true })
      const start = Date.now()
      let ergebnis: Record<string, unknown>
      try {
        const r = await wunschJob({ daten: DATEN, projekt: id, wunsch: w.wunsch, claudeCli: cli!, ffmpeg: FFMPEG }, kontext(`w${nr}`))
        const effekte = JSON.parse(await readFile(join(ordner, 'effekte.json'), 'utf8')) as Effekt[]
        const liste = JSON.parse(await readFile(join(ordner, 'schnitt.json'), 'utf8')) as Schnittliste
        await vorschauJob({ daten: DATEN, projekt: id, ffmpeg: FFMPEG, hilfe }, kontext(`v${nr}`) as JobContext<unknown>)
        // Standbilder: an den Effekt-Stellen (Endzeit) plus Anfang
        const inSchnitt = effekteInSchnittzeit(effekte, liste.behalten)
        const laenge = liste.behalten.reduce((s, b) => s + b.ende - b.start, 0)
        const g = effektGraph({ effekte: inSchnitt, laenge, breite: 960, hoehe: 540, fps: 25, audio: true, autoZooms: [], textBilder: {}, klaenge: {}, untertitel: null })
        const zeiten = new Set<number>([0.5])
        for (const e of inSchnitt) {
          if (e.art === 'intro') zeiten.add(Math.min(g.endzeit(0) - 0.6, 3)).add(Math.max(0.1, g.endzeit(0) - 0.8))
          else if ('von' in e) zeiten.add(g.endzeit((e.von + e.bis) / 2))
          else zeiten.add(g.endzeit(e.bei) + 0.1)
        }
        const bilder = [...zeiten].sort((a, b) => a - b).slice(0, 8)
        for (const [k, t] of bilder.entries()) execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', join(ordner, 'vorschau.mp4'), '-frames:v', '1', '-vf', 'scale=480:-2', join(ziel, `bild${k}.jpg`)])
        ergebnis = { nr, wunsch: w.wunsch, projekt: w.projekt, antwort: r.antwort, effekte, schnittVorher: JSON.parse(await readFile(join(ordner, 'schnitt.basis.json'), 'utf8')).behalten.length, schnittNachher: liste.behalten.length, laengeEnde: g.laenge, bilder: bilder.map((t) => Math.round(t * 10) / 10), sekunden: Math.round((Date.now() - start) / 1000) }
      } catch (err) {
        ergebnis = { nr, wunsch: w.wunsch, projekt: w.projekt, fehler: String(err), sekunden: Math.round((Date.now() - start) / 1000) }
      }
      await writeFile(join(ziel, 'ergebnis.json'), JSON.stringify(ergebnis, null, 1))
    }
    // Ausgangsstand wiederherstellen
    for (const id of Object.values(PROJEKTE)) {
      const o = join(DATEN, 'schnitt', id)
      await copyFile(join(o, 'schnitt.basis.json'), join(o, 'schnitt.json'))
      await rm(join(o, 'effekte.json'), { force: true })
    }
  },
  6 * 60 * 60 * 1000
)
