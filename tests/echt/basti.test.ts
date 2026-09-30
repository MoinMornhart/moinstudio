/**
 * Basti-Testreihe (Philip, 30.09.: „bei den Minecraft-Thumbnails ein richtiges Update, mit YouTube vergleichen“):
 * typische Challenge-Ideen, wie BastiGHG sie bebildert – mit Grafik-Ebene (Level, Hotbar, Etikett, Lupe, Abzeichen,
 * großer Text), geteilten Bildern und Bodenmarkierung. Läuft direkt über den Thumbnail-Auftrag (nicht über die
 * Warteschlange der App). Bilder in test-output/basti/ (nie im Repo), Auswertung in docs/tests/basti.md.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/basti.test.ts   (MOIN_NUR=3,5 für einzelne Fälle)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findClaudeCli } from '../../src/main/claude/cli'
import type { JobContext } from '../../src/main/jobs/queue'
import { thumbnailJob } from '../../src/main/thumbnail/job'
import type { PlanFigur } from '../../src/main/thumbnail/planung'

type Checkpoint = Parameters<typeof thumbnailJob>[1] extends JobContext<infer C> ? C : never

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const BLENDER = join(LOKAL, 'bl', '4.5.9', 'blender.exe')
const PYTHON = join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe')
const AUS = join(ROOT, 'test-output', 'basti')
const DATEN_ORDNER = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/Downloads/MorniStudio'
const SKINS: Record<string, string> = { ich: join(LOKAL, 'test-skins', 'MoinMornhart.png'), simpell: join(LOKAL, 'test-skins', 'SimPell.png') }
const ICH: PlanFigur = { id: 'ich', name: 'Philip (Kanal MoinMornhart)' }
const SIMPELL: PlanFigur = { id: 'simpell', name: 'SimPell (Freund von Philip)' }

export const IDEEN: { text: string; erwartet: string; figuren: PlanFigur[] }[] = [
  { text: 'Minecraft, aber jedes Level macht die Welt größer – ich bin schon bei Level 19', erwartet: 'level', figuren: [ICH] },
  { text: 'Ich spiele Minecraft mit nur einem Herz und einer Holzspitzhacke', erwartet: 'hud', figuren: [ICH] },
  { text: 'Ich kaufe ein Minecraft-Haus für 10€, 100€ und 1000€', erwartet: 'split', figuren: [ICH] },
  { text: 'Minecraft, aber ich darf nicht angreifen, nicht abbauen und nicht schlafen', erwartet: 'grosstext', figuren: [ICH] },
  { text: 'Ich finde den versteckten Diamanten in der Höhle – fast hätte ich ihn übersehen', erwartet: 'lupe', figuren: [ICH] },
  { text: 'Echter Creeper oder Fake-Creeper? Ich muss den richtigen finden', erwartet: 'abzeichen', figuren: [ICH] },
  { text: 'Ich überlebe 100 Tage in der Wüste nur mit einem Brot', erwartet: 'hud/etikett', figuren: [ICH] },
  { text: 'Wer baut die größere Burg: ich oder SimPell?', erwartet: 'abzeichen/split', figuren: [ICH, SIMPELL] },
  { text: 'Minecraft Speedrun: Ich töte den Enderdrachen in 10 Minuten', erwartet: 'etikett', figuren: [ICH] },
  { text: 'Ich bin in einem roten Quadrat gefangen und eine Zombie-Horde kommt', erwartet: 'markierung', figuren: [ICH] },
  { text: 'Noob-Haus gegen Pro-Haus in Minecraft', erwartet: 'split', figuren: [ICH] },
  { text: 'Ich verstecke mich vor dem Warden in der Ancient City', erwartet: 'keine Grafik (Stimmung)', figuren: [ICH] }
]

function kontext(nr: number): JobContext<Checkpoint> {
  let checkpoint: Checkpoint | undefined
  return {
    id: `basti-${nr}`,
    get checkpoint() {
      return checkpoint
    },
    save: async (c) => {
      checkpoint = c
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
  `${IDEEN.length} Challenge-Ideen im Basti-Stil durch den echten Thumbnail-Auftrag`,
  async () => {
    const cli = await findClaudeCli()
    expect(cli, 'Claude Code CLI nicht gefunden').toBeTruthy()
    const uv = join(LOKAL, 'uv', (await readdir(join(LOKAL, 'uv')))[0]!, 'uv.exe')
    const nur = process.env['MOIN_NUR']?.split(',').map(Number)
    for (const [i, a] of IDEEN.entries()) {
      const nr = i + 1
      if (nur && !nur.includes(nr)) continue
      const ordner = join(AUS, String(nr).padStart(2, '0'))
      if (!nur && existsSync(join(ordner, 'ergebnis.json'))) continue
      await rm(ordner, { recursive: true, force: true })
      await mkdir(ordner, { recursive: true })
      const start = Date.now()
      let ergebnis: Record<string, unknown>
      try {
        const r = await thumbnailJob(
          {
            beschreibung: a.text,
            kanal: 'MoinMornhart',
            figuren: a.figuren.map((f) => ({ ...f, skin: SKINS[f.id]! })),
            anzahl: 1,
            blender: { exe: BLENDER, mesa: false, geraet: 'CPU', samples: 16 },
            claudeCli: cli!,
            datenOrdner: DATEN_ORDNER,
            blenderDir: join(ROOT, 'blender'),
            minecraftDir: join(ROOT, 'resources', 'minecraft'),
            configDir: join(ROOT, 'config'),
            promptDatei: join(ROOT, 'resources', 'prompts', 'thumbnail-planung.md'),
            uv,
            grafikPyDir: join(LOKAL, 'py', 'grafik'),
            ausgabe: ordner
          },
          kontext(nr)
        )
        const v = r.varianten[0]!
        const plan = JSON.parse(JSON.stringify(v)) as Record<string, unknown>
        if (v.bild && existsSync(v.bild)) {
          const skript = `from PIL import Image; Image.open(r"${v.bild}").convert("RGB").save(r"${join(ordner, 'bild.jpg')}", quality=85)`
          spawnSync(PYTHON, ['-c', skript])
        }
        for (const n of await readdir(ordner)) if (n.endsWith('.png')) await rm(join(ordner, n), { force: true })
        const grafik = existsSync(join(ordner, 'variante-1.grafik.json')) ? JSON.parse(await readFile(join(ordner, 'variante-1.grafik.json'), 'utf8')) : []
        ergebnis = { nr, text: a.text, erwartet: a.erwartet, titel: v.titel, vorbild: v.vorbild, fehler: v.fehler ?? null, warnungen: v.warnungen, korrekturen: v.korrekturen ?? 0, grafik, split: existsSync(join(ordner, 'variante-1.teil2.szene.json')), sekunden: Math.round((Date.now() - start) / 1000), plan }
      } catch (err) {
        ergebnis = { nr, text: a.text, erwartet: a.erwartet, fehler: String(err), warnungen: [], sekunden: Math.round((Date.now() - start) / 1000) }
      }
      await writeFile(join(ordner, 'ergebnis.json'), JSON.stringify(ergebnis, null, 1))
      console.log(`${nr}: ${a.text} – ${ergebnis['fehler'] ?? 'Bild'} (${ergebnis['sekunden']} s)`)
    }
  },
  12 * 60 * 60 * 1000
)
