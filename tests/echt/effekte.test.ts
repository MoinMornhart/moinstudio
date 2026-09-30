/**
 * Effekt-Bausteine echt rendern (ROADMAP E.2): alle Bausteine auf das Testvideo „sprache“, danach Länge prüfen und
 * Standbilder zum Ansehen nach test-output/effekte/ schreiben.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/effekte.test.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { effektGraph, type Effekt } from '../../src/main/schnitt/effekte'
import { sichereKlaenge } from '../../src/main/schnitt/klaenge'
import { filterGraph, renderArgs, type RenderOptionen } from '../../src/main/schnitt/render'
import type { Schnittliste } from '../../src/main/schnitt/rohschnitt'

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const FFMPEG = join(LOKAL, 'ffmpeg', '9.0', 'bin', 'ffmpeg.exe')
const FFPROBE = join(LOKAL, 'ffmpeg', '9.0', 'bin', 'ffprobe.exe')
const PYTHON = join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe')
const DATEN = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/iCloudDrive/MoinStudio'
const ASSETS = join(DATEN, 'mc', '26.4-snapshot-2', 'extracted', 'assets', 'minecraft')
const AUS = join(ROOT, 'test-output', 'effekte')

it('rendert alle Effekt-Bausteine auf das Testvideo', async () => {
  await mkdir(AUS, { recursive: true })
  const liste = JSON.parse(await readFile(join(DATEN, 'schnitt', '779d0e67', 'schnitt.json'), 'utf8')) as Schnittliste
  const projekt = JSON.parse(await readFile(join(DATEN, 'schnitt', '779d0e67', 'projekt.json'), 'utf8')) as { quelle: { pfad: string } }
  const effekte: Effekt[] = [
    { art: 'text', von: 0.3, bis: 2.5, text: 'CREEPER-ALARM', lage: 'oben', farbe: '#55ff55' },
    { art: 'geraeusch', bei: 0.3, klang: 'plopp' },
    { art: 'zoom', von: 3, bis: 6, faktor: 1.5, x: 0.7, y: 0.4 },
    { art: 'wackeln', von: 7, bis: 8.5, staerke: 1 },
    { art: 'geraeusch', bei: 7, klang: 'boom' },
    { art: 'blitz', bei: 7 },
    { art: 'tempo', von: 9, bis: 11, faktor: 0.5 },
    { art: 'farbe', von: 12, bis: 15, schwarzweiss: true },
    { art: 'einfrieren', bei: 16, dauer: 1.5 },
    { art: 'text', von: 16, bis: 17.4, text: 'WAS?!', lage: 'mitte', farbe: '#ff5555', groesse: 0.2 },
    { art: 'geraeusch', bei: 16, klang: 'ding' },
    { art: 'uebergang', bei: 20, farbe: 'schwarz', dauer: 0.8 },
    { art: 'tempo', von: 21, bis: 24, faktor: 2 },
    { art: 'zensur', von: 25, bis: 26 },
    { art: 'farbe', von: 26, bis: 28, ton: 'rot', saettigung: 1.6 }
  ]
  const klaenge = await sichereKlaenge(FFMPEG, join(LOKAL, 'klaenge'))
  const textBilder: Record<number, { datei: string; breite: number; hoehe: number }> = {}
  for (const [i, e] of effekte.entries()) {
    if (e.art !== 'text') continue
    const datei = join(AUS, `text${i}.png`)
    const out = execFileSync(PYTHON, [join(ROOT, 'blender', 'text_bild.py'), ASSETS, datei, e.text, e.farbe ?? '#ffffff', '8']).toString()
    const [, b, h] = /MOIN_TEXTBILD (\d+) (\d+)/.exec(out)!
    textBilder[i] = { datei, breite: Number(b), hoehe: Number(h) }
  }
  const o: RenderOptionen = { quelle: projekt.quelle.pfad, liste, zooms: [], untertitel: null, breite: 1280, hoehe: 720, fps: 25, audio: true, encoder: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'], ausgabe: join(AUS, 'effekte.mp4'), effekte: { liste: effekte, textBilder, klaenge } }
  await writeFile(join(AUS, 'filter.txt'), filterGraph(o))
  execFileSync(FFMPEG, ['-y', '-v', 'error', ...renderArgs(o, join(AUS, 'filter.txt'))], { stdio: 'inherit' })
  const erwartet = effektGraph({ effekte, laenge: liste.behalten.reduce((s, b) => s + b.ende - b.start, 0), breite: 1280, hoehe: 720, fps: 25, audio: true, autoZooms: [], textBilder, klaenge, untertitel: null })
  const dauer = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', o.ausgabe]).toString())
  console.log('Länge', dauer, 'erwartet', erwartet.laenge)
  expect(Math.abs(dauer - erwartet.laenge)).toBeLessThan(0.3)
  // Standbilder an den Effekt-Zeiten (Endzeit)
  const zeiten: [string, number][] = [['text', 1], ['zoom', erwartet.endzeit(4.8)], ['blitz-wackeln', erwartet.endzeit(7.05)], ['zeitlupe', erwartet.endzeit(10)], ['schwarzweiss', erwartet.endzeit(13)], ['standbild-text', erwartet.endzeit(16) + 0.6], ['uebergang', erwartet.endzeit(20)], ['zensur', erwartet.endzeit(25.5)], ['rot', erwartet.endzeit(27)]]
  for (const [name, t] of zeiten) execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', t.toFixed(2), '-i', o.ausgabe, '-frames:v', '1', '-vf', 'scale=640:-2', join(AUS, `bild-${name}.jpg`)])
}, 600_000)
