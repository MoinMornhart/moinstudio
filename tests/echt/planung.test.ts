/**
 * ROADMAP 5.1, echter Durchlauf: 20 Beschreibungen aus Philips Inhalten → Claude plant je 3 Varianten mit Vorbild →
 * Variante 1 wird in Blender gerendert. Ergebnis: test-output/planung/ und docs/tests/planung.md.
 * Start: npx vitest run -c vitest.echt.config.ts tests/echt/planung.test.ts  (optional MOIN_NUR=1,5,7)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { findClaudeCli } from '../../src/main/claude/cli'
import { ladeKatalog } from '../../src/main/thumbnail/katalog'
import { ladeVorbilder, planeThumbnail, type PlanFigur } from '../../src/main/thumbnail/planung'

const ROOT = resolve(__dirname, '../..')
const DATEN = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio')
const TEXTUREN = join(DATEN, 'mc', '26.3', 'extracted', 'assets', 'minecraft', 'textures')
const BLENDER = join(DATEN, 'bl', '4.5.9', 'blender.exe')
const AUS = join(ROOT, 'test-output', 'planung')

const SKINS: Record<string, string> = {
  ich: join(DATEN, 'test-skins', 'MoinMornhart.png'),
  simpell: join(DATEN, 'test-skins', 'SimPell.png')
}
const ERSATZ = join(TEXTUREN, 'entity', 'player', 'wide', 'steve.png')

const ICH: PlanFigur = { id: 'ich', name: 'Philip (Kanal MoinMornhart)' }
const SIMPELL: PlanFigur = { id: 'simpell', name: 'SimPell (Freund von Philip)' }

const AUFTRAEGE: { text: string; figuren: PlanFigur[] }[] = [
  { text: 'Ich kämpfe gegen SimPell, er fällt fast von der Klippe', figuren: [ICH, SIMPELL] },
  { text: 'Ich überlebe 100 Tage im Nether', figuren: [ICH] },
  { text: 'Ein Creeper schleicht sich an mich an', figuren: [ICH] },
  { text: 'Ich verteidige mein Dorf gegen eine Zombie-Armee', figuren: [ICH] },
  { text: 'SimPell verrät mich und klaut meine Diamanten', figuren: [ICH, SIMPELL] },
  { text: 'Ich finde Diamanten tief in einer Lava-Höhle', figuren: [ICH] },
  { text: 'Der Warden jagt mich durch die Höhle', figuren: [ICH] },
  { text: 'Ich sprenge die ganze Map mit TNT', figuren: [ICH] },
  { text: 'Duell um Mitternacht gegen SimPell', figuren: [ICH, SIMPELL] },
  { text: 'Ich baue die größte Grube in Minecraft', figuren: [ICH] },
  { text: 'Ein riesiger Ghast greift meine Basis an', figuren: [ICH] },
  { text: 'Ich zähme einen Wolf und wir kämpfen gegen Skelette', figuren: [ICH] },
  { text: 'Minecraft, aber jeder Mob ist 10 mal größer', figuren: [ICH] },
  { text: 'Ich springe mit der Axt auf SimPell', figuren: [ICH, SIMPELL] },
  { text: 'Ich stehe auf einer Säule im Lavasee und SimPell will mich runterschubsen', figuren: [ICH, SIMPELL] },
  { text: 'Ich treffe den Enderman in der Nacht', figuren: [ICH] },
  { text: 'Ich überlebe auf einer Insel mitten im Meer', figuren: [ICH] },
  { text: 'Villager haben mich verraten', figuren: [ICH] },
  { text: 'Blaze-Angriff in der Netherfestung', figuren: [ICH] },
  { text: 'SimPell und ich gegen einen Eisengolem', figuren: [ICH, SIMPELL] }
]

it('plant 20 Beschreibungen mit Vorbild und rendert je die erste Variante', async () => {
  const cli = await findClaudeCli()
  expect(cli, 'Claude Code CLI nicht gefunden').toBeTruthy()
  const katalog = await ladeKatalog(join(ROOT, 'blender'), join(ROOT, 'resources', 'minecraft'))
  const vorbilder = await ladeVorbilder(join(ROOT, 'config'))
  const vorlage = await readFile(join(ROOT, 'resources', 'prompts', 'thumbnail-planung.md'), 'utf8')
  const nur = process.env['MOIN_NUR']?.split(',').map(Number)
  const zeilen: string[] = []
  for (const [i, a] of AUFTRAEGE.entries()) {
    const nr = i + 1
    if (nur && !nur.includes(nr)) continue
    const ordner = join(AUS, String(nr).padStart(2, '0'))
    await mkdir(ordner, { recursive: true })
    const start = Date.now()
    const { plan, fehler } = await planeThumbnail({
      beschreibung: a.text,
      kanal: 'MoinMornhart',
      figuren: a.figuren,
      katalog,
      vorbilder,
      vorlage,
      claude: { cli: cli!, workDir: join(DATEN, 'claude-work', 'planung') }
    })
    const sek = Math.round((Date.now() - start) / 1000)
    await writeFile(join(ordner, 'plan.json'), JSON.stringify(plan, null, 1))
    // Variante 1 rendern
    const szene = structuredClone(plan.varianten[0]!.szene) as Record<string, unknown> & { figuren: { id: string; skin?: string }[] }
    for (const f of szene.figuren) f.skin = SKINS[f.id] ?? ERSATZ
    szene['render'] = { samples: 24 }
    const szenePfad = join(ordner, 'szene-1.json')
    await writeFile(szenePfad, JSON.stringify(szene, null, 1))
    const bild = join(ordner, 'variante-1.png')
    const bericht = join(ordner, 'bericht-1.json')
    let warnungen = '–'
    if (existsSync(BLENDER) && !process.env['MOIN_OHNE_RENDER']) {
      spawnSync(BLENDER, ['-b', '--factory-startup', '--python', join(ROOT, 'blender', 'render_szene.py'), '--', szenePfad, TEXTUREN, bild, bericht], { stdio: 'ignore', timeout: 20 * 60 * 1000 })
      const b = JSON.parse(await readFile(bericht, 'utf8').catch(() => '{}')) as { warnungen?: string[]; fehler?: string }
      warnungen = b.fehler ? `FEHLER: ${b.fehler}` : (b.warnungen ?? []).join('; ') || 'keine'
    }
    const vb = plan.varianten.map((v, j) => `${j + 1}. ${v.titel} → ${v.vorbild}`).join('<br>')
    zeilen.push(`| ${nr} | ${a.text} | ${vb} | ${fehler.length ? fehler.join('; ') : 'ok'} | ${warnungen} | ${sek} s |`)
    console.log(`${nr}: ${a.text} – ${plan.varianten.length} Varianten, Fehler: ${fehler.length}, Warnungen: ${warnungen}`)
  }
  const doku = [
    '# Planungstest (ROADMAP 5.1)',
    '',
    'Echter Durchlauf mit dem Claude-Abo: je Beschreibung 3 Varianten, jede nennt ihr Vorbild aus `config/vorbilder.json`.',
    'Variante 1 wurde in Blender gerendert, „Warnungen“ ist die Selbstprüfung aus dem Szenenbericht. Die Bilder liegen lokal',
    'unter `test-output/planung/` und auf der Werkstatt-Seite, nie im Repo.',
    '',
    '| # | Beschreibung | Varianten → Vorbild | Planprüfung | Warnungen Render 1 | Planungszeit |',
    '|---|---|---|---|---|---|',
    ...zeilen,
    ''
  ].join('\n')
  if (!nur) await writeFile(join(ROOT, 'docs', 'tests', 'planung.md'), doku)
  else await writeFile(join(AUS, 'teil.md'), doku)
})
