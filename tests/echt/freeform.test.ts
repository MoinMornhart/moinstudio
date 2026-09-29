/**
 * Freiform-Test (Philips Regel: vor der Fertig-Meldung mindestens 50 ungewöhnliche Beschreibungen): jede Beschreibung
 * läuft durch den echten Thumbnail-Auftrag (Claude plant frei, Blender rendert, Selbstprüfung, Korrekturschleife).
 * Bilder landen als JPG in test-output/freeform/ (nie im Repo), die Auswertung in docs/tests/freeform-poses.md.
 * Fertige Fälle werden übersprungen; MOIN_NUR=3,17 wiederholt gezielt (vorher deren Ordner löschen).
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/freeform.test.ts
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
const AUS = join(ROOT, 'test-output', 'freeform')
// Datenordner mit Minecraft-Dateien und Mob-Import (wie in der App); Skins kommen aus test-skins
const DATEN_ORDNER = process.env['MOIN_TEST_DATEN'] ?? 'C:/Users/Morni/iCloudDrive/MoinStudio'

const SKINS: Record<string, string> = { ich: join(LOKAL, 'test-skins', 'MoinMornhart.png'), simpell: join(LOKAL, 'test-skins', 'SimPell.png') }
const ICH: PlanFigur = { id: 'ich', name: 'Philip (Kanal MoinMornhart)' }
const SIMPELL: PlanFigur = { id: 'simpell', name: 'SimPell (Freund von Philip)' }

export const FREIFORM: { text: string; art: 'welt' | 'pose' | 'mob' | 'duo' | 'reaktion'; figuren: PlanFigur[] }[] = [
  { text: 'Ich stehe mitten in einer Ancient City im Deep Dark und der Sculk-Kreischer geht los', art: 'welt', figuren: [ICH] },
  { text: 'Ich lande mit der Elytra auf einer End City', art: 'welt', figuren: [ICH] },
  { text: 'Ich finde eine Pilzinsel mitten im Ozean mit Mooshrooms', art: 'welt', figuren: [ICH] },
  { text: 'Ich klettere auf die höchste Eisspitze im Eisspitzen-Biom', art: 'welt', figuren: [ICH] },
  { text: 'Ich entdecke den Portalraum in der Festung und setze das letzte Enderauge ein', art: 'welt', figuren: [ICH] },
  { text: 'Ich stehe im Kirschblütenhain und Blätter fallen um mich herum', art: 'welt', figuren: [ICH] },
  { text: 'Ich verirre mich im Pale Garden und ein Creaking steht hinter mir', art: 'welt', figuren: [ICH] },
  { text: 'Ich plündere den Wüstentempel und trete fast auf die TNT-Druckplatte', art: 'welt', figuren: [ICH] },
  { text: 'Ich stehe am Weltspawn auf dem ersten Grasblock nach dem Start', art: 'welt', figuren: [ICH] },
  { text: 'Ich finde eine Trial Chamber und der Breeze greift an', art: 'welt', figuren: [ICH] },
  { text: 'Ich schleiche durch eine Waldanwesenheit voller Magier', art: 'welt', figuren: [ICH] },
  { text: 'Ich stehe in den Tafelbergen der Badlands bei Sonnenuntergang', art: 'welt', figuren: [ICH] },
  { text: 'Ich schwimme in einem Mangrovensumpf und ein Frosch sitzt auf meinem Kopf', art: 'welt', figuren: [ICH] },
  { text: 'Ich stehe in einer üppigen Höhle mit Leuchtbeeren und Azaleen', art: 'welt', figuren: [ICH] },
  { text: 'Ich balanciere über Tropfsteine in einer Tropfsteinhöhle', art: 'welt', figuren: [ICH] },
  { text: 'Ich mache einen Handstand auf dem Kopf eines Creepers', art: 'pose', figuren: [ICH] },
  { text: 'Ich mache Yoga auf einem Heuballen im Dorf', art: 'pose', figuren: [ICH] },
  { text: 'Ich surfe mit einem Boot einen Wasserfall hinunter', art: 'pose', figuren: [ICH] },
  { text: 'Ich reite auf einem Schreiter über den Lavasee im Nether', art: 'pose', figuren: [ICH] },
  { text: 'Ich schlafe im Bett im Nether und es explodiert', art: 'pose', figuren: [ICH] },
  { text: 'Ich angle einen Warden aus dem Wasser', art: 'pose', figuren: [ICH] },
  { text: 'Ich klettere an einem Gerüstturm bis zur Bauhöhe', art: 'pose', figuren: [ICH] },
  { text: 'Ich springe mit einem Wassereimer aus 300 Blöcken Höhe (MLG)', art: 'pose', figuren: [ICH] },
  { text: 'Ich verkleide mich mit einem Kürbis als Enderman', art: 'pose', figuren: [ICH] },
  { text: 'Ich schiebe eine Lore mit TNT in eine Mine', art: 'pose', figuren: [ICH] },
  { text: 'Ich trage ein Schnüffler-Ei vorsichtig über eine Schlucht', art: 'pose', figuren: [ICH] },
  { text: 'Ich hänge mit einer Hand an der Kante des Ends über der Leere', art: 'pose', figuren: [ICH] },
  { text: 'Ich tanze mit einem Allay um eine Notenblock-Bühne', art: 'pose', figuren: [ICH] },
  { text: 'Ich baue ein Netherportal aus Holz und es funktioniert nicht', art: 'pose', figuren: [ICH] },
  { text: 'Ich esse einen goldenen Apfel während der Wither auf mich schießt', art: 'pose', figuren: [ICH] },
  { text: 'Der Enderdrache sitzt auf dem Portal und ich schieße mit dem Bogen', art: 'mob', figuren: [ICH] },
  { text: 'Ein Riesen-Schleim hüpft auf mich zu', art: 'mob', figuren: [ICH] },
  { text: 'Ein Rudel Wölfe beschützt mich vor Skeletten', art: 'mob', figuren: [ICH] },
  { text: 'Ich werde von einem Phantom in der Nacht angegriffen', art: 'mob', figuren: [ICH] },
  { text: 'Der Ältere Wächter feuert seinen Laser auf mich unter Wasser', art: 'mob', figuren: [ICH] },
  { text: 'Ein Piglin-Barbar jagt mich durch eine Bastion', art: 'mob', figuren: [ICH] },
  { text: 'Ich reite auf einem Kamel durch die Wüste und ein Husk jagt mich', art: 'mob', figuren: [ICH] },
  { text: 'Ein Ravager rammt meine Holzhütte', art: 'mob', figuren: [ICH] },
  { text: 'SimPell und ich fliegen mit Elytras um die Wette', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'SimPell zieht mich an einer Leine hinter einem Boot her', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'SimPell und ich stehen Rücken an Rücken umzingelt von Zombies', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'SimPell schubst mich in den Brunnen im Dorf', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'SimPell und ich bauen gleichzeitig ein Haus, seins ist viel schöner', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'Ich überrasche SimPell mit einer Torte zum Geburtstag', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'SimPell und ich spielen Verstecken und ich stecke im Heuhaufen', art: 'duo', figuren: [ICH, SIMPELL] },
  { text: 'Ich schlage die Hände vors Gesicht, weil mein Haus abgebrannt ist', art: 'reaktion', figuren: [ICH] },
  { text: 'Ich lache mich kaputt, weil SimPell in Lava gefallen ist', art: 'reaktion', figuren: [ICH, SIMPELL] },
  { text: 'Ich zeige schockiert auf einen leuchtenden Diamantblock', art: 'reaktion', figuren: [ICH] },
  { text: 'Ich zucke ratlos mit den Schultern vor einem kaputten Redstone-Apparat', art: 'reaktion', figuren: [ICH] },
  { text: 'Ich jubele mit beiden Armen oben, nachdem ich den Wither besiegt habe', art: 'reaktion', figuren: [ICH] }
]

function kontext(nr: number): JobContext<Checkpoint> {
  let checkpoint: Checkpoint | undefined
  return {
    id: `freeform-${nr}`,
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
  `${FREIFORM.length} ungewöhnliche Beschreibungen durch den echten Thumbnail-Auftrag`,
  async () => {
    const cli = await findClaudeCli()
    expect(cli, 'Claude Code CLI nicht gefunden').toBeTruthy()
    const nur = process.env['MOIN_NUR']?.split(',').map(Number)
    for (const [i, a] of FREIFORM.entries()) {
      const nr = i + 1
      if (nur && !nur.includes(nr)) continue
      const ordner = join(AUS, String(nr).padStart(2, '0'))
      if (existsSync(join(ordner, 'ergebnis.json'))) continue
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
            blender: { exe: BLENDER, mesa: true, geraet: 'CPU', samples: 16 },
            claudeCli: cli!,
            datenOrdner: DATEN_ORDNER,
            blenderDir: join(ROOT, 'blender'),
            minecraftDir: join(ROOT, 'resources', 'minecraft'),
            configDir: join(ROOT, 'config'),
            promptDatei: join(ROOT, 'resources', 'prompts', 'thumbnail-planung.md'),
            ausgabe: ordner
          },
          kontext(nr)
        )
        const v = r.varianten[0]!
        const szene: unknown = v.szene && existsSync(v.szene) ? JSON.parse(await readFile(v.szene, 'utf8')) : null
        if (v.bild && existsSync(v.bild)) {
          const skript = `from PIL import Image; Image.open(r"${v.bild}").convert("RGB").save(r"${join(ordner, 'bild.jpg')}", quality=85)`
          spawnSync(PYTHON, ['-c', skript])
        }
        // Platz sparen: Zwischenbilder weg
        for (const n of await readdir(ordner)) if (n.endsWith('.png')) await rm(join(ordner, n), { force: true })
        ergebnis = { nr, text: a.text, art: a.art, titel: v.titel, vorbild: v.vorbild, fehler: v.fehler ?? null, warnungen: v.warnungen, korrekturen: v.korrekturen ?? 0, sekunden: Math.round((Date.now() - start) / 1000), szene }
      } catch (err) {
        ergebnis = { nr, text: a.text, art: a.art, fehler: String(err), warnungen: [], sekunden: Math.round((Date.now() - start) / 1000) }
      }
      await writeFile(join(ordner, 'ergebnis.json'), JSON.stringify(ergebnis, null, 1))
    }
  },
  12 * 60 * 60 * 1000
)
