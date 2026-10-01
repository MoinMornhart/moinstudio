/**
 * Spiele-Vorlagen-Testreihe (Philip, 30.09.: „mach das jetzt einmal für jede erdenkliche Möglichkeit“): echte
 * Spiele-Motive mit einer oder mehreren Personen, verbunden oder nicht, von vorn und hinten, springend, kletternd,
 * sitzend, winzig oder bildfüllend, Menschen, Comic, Roboter und Bohnen. Jeder Fall läuft durch den echten Auftrag
 * (Claude-Analyse, Freistellen je Person, Einpassen, Verbindungen, Schlussprüfung mit Korrektur).
 * Vorlagen liegen lokal in test-output/vorlagen/ (Steam-Titelbilder, Referenzen), Ergebnisse in test-output/spielvorlage/,
 * die Auswertung in docs/tests/spielvorlage.md – Bilder nie im Repo.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/spielvorlage.test.ts   (MOIN_NUR=3,5 für einzelne Fälle)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findClaudeCli } from '../../src/main/claude/cli'
import type { JobContext } from '../../src/main/jobs/queue'
import { spielvorlageJob } from '../../src/main/thumbnail/spielvorlage'

type Checkpoint = Parameters<typeof spielvorlageJob>[1] extends JobContext<infer C> ? C : never

const ROOT = resolve(__dirname, '../..')
const LOKAL = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const BLENDER = join(LOKAL, 'bl', '4.5.9', 'blender.exe')
const PYTHON = join(LOKAL, 'py', 'vorlage', 'Scripts', 'python.exe')
const VORLAGEN = join(ROOT, 'test-output', 'vorlagen')
const AUS = join(ROOT, 'test-output', 'spielvorlage')
const DATEN_ORDNER = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/Downloads/MorniStudio'
const ICH = join(LOKAL, 'test-skins', 'MoinMornhart.png')
const FREUND = { skin: join(LOKAL, 'test-skins', 'SimPell.png'), slim: null, name: 'SimPell' }

export const FAELLE: { datei: string; was: string; freund?: boolean; wunsch?: string }[] = [
  { datei: 'olixp-chained.jpg', was: 'Zwei Personen mit Kette: einer springt, einer klettert (OliXP)', freund: true },
  { datei: '2567870.jpg', was: 'Chained Together Titelbild: zwei Personen nah, mit Kette', freund: true },
  { datei: '2567870-ss.jpg', was: 'Spielszene von hinten, mehrere Personen an Ketten, klein', freund: true },
  { datei: '1222700.jpg', was: 'A Way Out: zwei Männer stehen nebeneinander', freund: true },
  { datei: '1222700.jpg', was: 'A Way Out ohne Freund: nur Philip ersetzt einen, der andere bleibt' },
  { datei: '1426210.jpg', was: 'It Takes Two: zwei kleine Puppen fliegen durchs Bild', freund: true },
  { datei: '1203620.jpg', was: 'Enshrouded: Gruppe von hinten/seitlich mit Waffen', freund: true },
  { datei: '381210.jpg', was: 'Dead by Daylight: mehrere Überlebende, Killer im Hintergrund', freund: true },
  { datei: '007-a.jpg', was: 'Eine Person zielt mit Pistole (YouTube-Thumbnail)' },
  { datei: '1174180.jpg', was: 'Red Dead: Cowboy mit Schrotflinte, nah' },
  { datei: '814380.jpg', was: 'Sekiro: Figur von hinten mit Schwert' },
  { datei: '990080.jpg', was: 'Hogwarts Legacy: kleine Figur von hinten in weiter Landschaft' },
  { datei: '240720.jpg', was: 'Getting Over It: winziger Mann sitzt im Topf' },
  { datei: '1097150.jpg', was: 'Fall Guys: Bohnen statt Menschen' },
  { datei: '2881650.jpg', was: 'Content Warning: Figuren mit Kameras' },
  { datei: '1966720.jpg', was: 'Lethal Company: dunkle Silhouetten unter dem Logo' },
  { datei: '271590.jpg', was: 'GTA V: Collage aus vielen Bildern' }
]

function kontext(nr: number): JobContext<Checkpoint> {
  let checkpoint: Checkpoint | undefined
  return {
    id: `spielvorlage-${nr}`,
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
  'Spiele-Vorlagen: jeder Fall wird ersetzt, eingepasst und geprüft',
  async () => {
    const cli = await findClaudeCli()
    expect(cli, 'Claude Code fehlt').toBeTruthy()
    expect(existsSync(BLENDER), 'Blender 4.5.9 fehlt').toBe(true)
    const uv = join(LOKAL, 'uv', (await readdir(join(LOKAL, 'uv')))[0]!, 'uv.exe')
    const nur = process.env['MOIN_NUR']?.split(',').map(Number)
    for (const [i, f] of FAELLE.entries()) {
      const nr = i + 1
      if (nur && !nur.includes(nr)) continue
      const ordner = join(AUS, String(nr).padStart(2, '0'))
      if (!nur && existsSync(join(ordner, 'ergebnis.json'))) continue
      await mkdir(ordner, { recursive: true })
      const start = Date.now()
      let ergebnis: unknown
      try {
        ergebnis = await spielvorlageJob(
          {
            vorlage: join(VORLAGEN, f.datei),
            skin: ICH,
            slim: null,
            wunsch: f.wunsch,
            freunde: f.freund ? [FREUND] : [],
            claudeCli: cli!,
            blender: { exe: BLENDER, mesa: false, geraet: 'CPU', samples: 24 },
            uv,
            pyDir: join(LOKAL, 'py', 'vorlage'),
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
      // Vergleichsbild: Original links, Ergebnis rechts
      const v = (ergebnis as { varianten?: { bild?: string | null }[] }).varianten?.[0]
      if (v?.bild) {
        const skript = `from PIL import Image
a=Image.open(r"${join(ordner, 'vorlage.png')}").convert("RGB").resize((960,540)); b=Image.open(r"${v.bild}").convert("RGB").resize((960,540))
c=Image.new("RGB",(1920,540)); c.paste(a,(0,0)); c.paste(b,(960,0)); c.save(r"${join(ordner, 'vergleich.jpg')}", quality=82)`
        spawnSync(PYTHON, ['-c', skript])
      }
      console.log(`${nr}: ${f.was} – ${sek} s – ${v?.bild ? 'Bild' : 'FEHLER'}`)
    }

    // Auswertung
    const zeilen: string[] = []
    for (const [i, f] of FAELLE.entries()) {
      const ordner = join(AUS, String(i + 1).padStart(2, '0'))
      const e = JSON.parse(await readFile(join(ordner, 'ergebnis.json'), 'utf8').catch(() => '{}')) as {
        varianten?: { bild?: string | null; warnungen?: string[]; fehler?: string }[]
        fehler?: string
        sek?: number
      }
      const v = e.varianten?.[0]
      const pruefungen = await Promise.all([1, 2, 3].map((r) => readFile(join(ordner, `pruefung-${r}.json`), 'utf8').then((t) => JSON.parse(t) as { passt: boolean }, () => null)))
      const runden = pruefungen.filter(Boolean).map((x) => (x!.passt ? 'passt' : 'korrigiert')).join(' → ') || '–'
      zeilen.push(`| ${i + 1} | ${f.was} | ${f.freund ? 'ja' : 'nein'} | ${e.fehler ?? v?.fehler ?? (v?.bild ? 'Bild' : '–')} | ${runden} | ${(v?.warnungen ?? []).join('; ') || 'keine'} | ${e.sek ?? '–'} s |`)
    }
    await writeFile(
      join(ROOT, 'docs', 'tests', 'spielvorlage.md'),
      [
        '# Spiele-Vorlagen-Testreihe',
        '',
        'Echter Durchlauf (Claude-Abo, SAM-Freistellung je Person, Blender, Schlussprüfung mit Korrektur). Vorlagen: Steam-Titelbilder',
        'und YouTube-Thumbnails, nur lokal. Vergleichsbilder (Original | Ergebnis) liegen unter `test-output/spielvorlage/<nr>/vergleich.jpg`.',
        '',
        '| # | Fall | Freund | Ergebnis | Schlussprüfung | Hinweise | Zeit |',
        '|---|---|---|---|---|---|---|',
        ...zeilen,
        ''
      ].join('\n')
    )
  },
  12 * 60 * 60 * 1000
)
