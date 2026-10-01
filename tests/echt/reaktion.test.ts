/**
 * Reaction-/Gaming-Testreihe (Philip, 01.10.: „das ganze Gebiet bis heute Abend fertig“): typische Fälle für den
 * Zweitkanal – Reaktion auf ein fremdes Thumbnail, Gaming mit Spielname, mit Freund, eigener Posen-Wunsch, ohne Extras.
 * Originale sind die lokalen Vorlagen aus test-output/vorlagen/, Ergebnisse in test-output/reaktion/ (nie im Repo),
 * Auswertung in docs/tests/reaktion.md.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/reaktion.test.ts   (MOIN_NUR=2,4 für einzelne Fälle)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findClaudeCli } from '../../src/main/claude/cli'
import type { JobContext } from '../../src/main/jobs/queue'
import { reaktionJob, type ReaktionPayload } from '../../src/main/thumbnail/reaktion'

type Checkpoint = Parameters<typeof reaktionJob>[1] extends JobContext<infer C> ? C : never

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const BLENDER = join(LOKAL, 'bl', '4.5.9', 'blender.exe')
const PYTHON = join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe')
const VORLAGEN = join(ROOT, 'test-output', 'vorlagen')
const AUS = join(ROOT, 'test-output', 'reaktion')
const DATEN_ORDNER = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/Downloads/MorniStudio'
const ICH = join(LOKAL, 'test-skins', 'MoinMornhart.png')
const FREUND = { skin: join(LOKAL, 'test-skins', 'SimPell.png'), slim: null, name: 'SimPell' }

type Fall = { datei: string; was: string } & Partial<Pick<ReaktionPayload, 'gefuehl' | 'wort' | 'spiel' | 'wunsch' | 'ohneExtras'>> & { freund?: boolean }

export const FAELLE: Fall[] = [
  { datei: '381210.jpg', was: 'Reaktion: schockiert auf Dead by Daylight', gefuehl: 'schockiert' },
  { datei: '1097150.jpg', was: 'Reaktion: lachend, eigenes Wort', gefuehl: 'lachend', wort: 'LOL' },
  { datei: '1966720.jpg', was: 'Gaming: Lethal Company mit Spielname', spiel: 'Lethal Company' },
  { datei: '2567870.jpg', was: 'Gaming mit Freund: Chained Together', spiel: 'Chained Together', freund: true },
  { datei: '990080.jpg', was: 'Eigenes Bild: Pose per Wunsch', wunsch: 'Ich zeige mit beiden Händen begeistert auf das Schloss' },
  { datei: '814380.jpg', was: 'Ohne Extras: nur Skin und Hintergrund', ohneExtras: true }
]

function kontext(nr: number): JobContext<Checkpoint> {
  let checkpoint: Checkpoint | undefined
  return {
    id: `reaktion-${nr}`,
    get checkpoint() {
      return checkpoint
    },
    save: async (c) => {
      checkpoint = c
    },
    progress: (_p, text) => text && console.log(`  ${nr}: ${text}`),
    yield: async () => undefined,
    signal: new AbortController().signal,
    track: () => undefined,
    waitUntil: () => {
      throw new Error('Claude-Limit erreicht')
    }
  } as JobContext<Checkpoint>
}

it(
  'Reaction-/Gaming-Thumbnails: jeder Fall ergibt ein Bild',
  async () => {
    const cli = await findClaudeCli()
    expect(cli, 'Claude Code fehlt').toBeTruthy()
    expect(existsSync(BLENDER), 'Blender 4.5.9 fehlt').toBe(true)
    const nur = process.env['MOIN_NUR']?.split(',').map(Number)
    for (const [i, f] of FAELLE.entries()) {
      const nr = i + 1
      if (nur && !nur.includes(nr)) continue
      const ordner = join(AUS, String(nr).padStart(2, '0'))
      await mkdir(ordner, { recursive: true })
      const start = Date.now()
      let ergebnis: unknown
      try {
        ergebnis = await reaktionJob(
          {
            original: join(VORLAGEN, f.datei),
            skin: ICH,
            slim: null,
            kanal: 'MoinMorni',
            gefuehl: f.gefuehl,
            wort: f.wort,
            spiel: f.spiel,
            wunsch: f.wunsch,
            ohneExtras: f.ohneExtras,
            freunde: f.freund ? [FREUND] : [],
            claudeCli: cli!,
            blender: { exe: BLENDER, mesa: false, geraet: 'CPU', samples: 24 },
            blenderDir: join(ROOT, 'blender'),
            datenOrdner: DATEN_ORDNER,
            ausgabe: ordner
          },
          kontext(nr)
        )
      } catch (err) {
        ergebnis = { fehler: err instanceof Error ? err.message : String(err) }
      }
      const sek = Math.round((Date.now() - start) / 1000)
      await writeFile(join(ordner, 'ergebnis.json'), JSON.stringify({ ...(ergebnis as object), sek, fall: f }, null, 1))
      const v = (ergebnis as { varianten?: { bild?: string | null }[] }).varianten?.[0]
      if (v?.bild) {
        const skript = `from PIL import Image
a=Image.open(r"${join(VORLAGEN, f.datei)}").convert("RGB").resize((960,540)); b=Image.open(r"${v.bild}").convert("RGB").resize((960,540))
c=Image.new("RGB",(1920,540)); c.paste(a,(0,0)); c.paste(b,(960,0)); c.save(r"${join(ordner, 'vergleich.jpg')}", quality=82)`
        spawnSync(PYTHON, ['-c', skript])
      }
      console.log(`${nr}: ${f.was} – ${sek} s – ${v?.bild ? 'Bild' : `FEHLER ${(ergebnis as { fehler?: string }).fehler ?? ''}`}`)
    }

    const zeilen: string[] = []
    for (const [i, f] of FAELLE.entries()) {
      const e = JSON.parse(await readFile(join(AUS, String(i + 1).padStart(2, '0'), 'ergebnis.json'), 'utf8').catch(() => '{}')) as {
        varianten?: { bild?: string | null; warnungen?: string[]; fehler?: string }[]
        fehler?: string
        sek?: number
      }
      const v = e.varianten?.[0]
      zeilen.push(`| ${i + 1} | ${f.was} | ${e.fehler ?? v?.fehler ?? (v?.bild ? 'Bild' : '–')} | ${(v?.warnungen ?? []).join('; ') || 'keine'} | ${e.sek ?? '–'} s |`)
    }
    await writeFile(
      join(ROOT, 'docs', 'tests', 'reaktion.md'),
      ['# Reaction-/Gaming-Testreihe', '', 'Echter Durchlauf (Claude-Abo, Blender). Originale: lokale Spiele-Vorlagen; Bilder nie im Repo.', '', '| Nr | Fall | Ergebnis | Hinweise | Zeit |', '|---|---|---|---|---|', ...zeilen, ''].join('\n')
    )
  },
  4 * 60 * 60 * 1000
)
