/**
 * Premiere-Export mit Effekten echt (ROADMAP E.6): Effekte aus test-output/schnitt-wuensche/03 („Mehr Action!“) auf das
 * Testprojekt „sprache“, Vorschau rendern (erzeugt die Text-Bilder), Sequenz schreiben und mit Pythons XML-Parser prüfen.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/premiere-effekte.test.ts
 */
import { execFileSync } from 'node:child_process'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import type { JobContext } from '../../src/main/jobs/queue'
import { premiereDateien } from '../../src/main/adobe/premiere-export'
import { vorschauJob } from '../../src/main/schnitt/vorschau'

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const FFMPEG = join(LOKAL, 'ffmpeg', '9.0', 'bin', 'ffmpeg.exe')
const PYTHON = join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe')
const DATEN = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/iCloudDrive/MoinStudio'
const ID = '779d0e67'

const kontext = (): JobContext<unknown> =>
  ({ id: 'p', checkpoint: undefined, save: async () => undefined, progress: () => undefined, yield: async () => undefined, signal: new AbortController().signal, track: () => undefined }) as unknown as JobContext<unknown>

it('schreibt eine Premiere-Sequenz mit Zoom-Keyframes, Textspur und Effekt-Markern', { timeout: 600_000 }, async () => {
  const ordner = join(DATEN, 'schnitt', ID)
  const beispiel = JSON.parse(await readFile(join(ROOT, 'test-output', 'schnitt-wuensche', '03', 'ergebnis.json'), 'utf8')) as { effekte: unknown[] }
  await copyFile(join(ordner, 'schnitt.basis.json'), join(ordner, 'schnitt.json'))
  await writeFile(join(ordner, 'effekte.json'), JSON.stringify(beispiel.effekte, null, 2))
  const hilfe = { ffmpeg: FFMPEG, python: PYTHON, textSkript: join(ROOT, 'blender', 'text_bild.py'), lokal: LOKAL }
  await vorschauJob({ daten: DATEN, projekt: ID, ffmpeg: FFMPEG, hilfe }, kontext())
  const { xml } = await premiereDateien(DATEN, ID)
  const pruefung = `
import sys, xml.etree.ElementTree as ET
seq = ET.parse(sys.argv[1]).getroot().find('sequence')
spuren = seq.findall('media/video/track')
texte = spuren[1].findall('clipitem') if len(spuren) > 1 else []
keys = seq.findall(".//parameter[parameterid='scale']/keyframe")
marker = [m.findtext('name') for m in seq.findall('marker')]
print(len(spuren), len(texte), len(keys), sum(1 for m in marker if m.startswith('Effekt:')), all(t.find('file/pathurl') is not None for t in texte))
`
  const aus = execFileSync(PYTHON, ['-c', pruefung, xml], { encoding: 'utf8' }).trim()
  console.log('Premiere-Sequenz:', xml, aus)
  const [spuren, texte, keys, effektMarker, pfade] = aus.split(' ')
  expect(Number(spuren)).toBe(2)
  expect(Number(texte)).toBeGreaterThanOrEqual(3)
  expect(Number(keys)).toBeGreaterThan(4)
  expect(Number(effektMarker)).toBeGreaterThanOrEqual(15)
  expect(pfade).toBe('True')
})
