import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ladeKatalog } from '../../src/main/thumbnail/katalog'
import { ernsteWarnungen, ladeVorbilder, plane, planeThumbnail, pruefeSzene, type Szene } from '../../src/main/thumbnail/planung'

const ROOT = resolve(__dirname, '../..')
const FAKE = resolve(__dirname, '../fixtures/fake-claude.mjs')
const katalog = () => ladeKatalog(join(ROOT, 'blender'), join(ROOT, 'resources', 'minecraft'))

describe('Thumbnail-Katalog', () => {
  it('liest Posen, Kamera, Himmel, Mobs und Blöcke aus dem Blender-Code', async () => {
    const k = await katalog()
    expect(k.posen.map((p) => p.name)).toEqual(expect.arrayContaining(['sturmangriff', 'getroffen', 'kreuzen', 'schreck']))
    expect(k.posen.find((p) => p.name === 'sturmangriff')?.hinweis).toMatch(/Sturmangriff/)
    expect(k.posen.map((p) => p.name)).toEqual(expect.arrayContaining(['jubeln', 'kopfkratzen', 'achselzucken']))
    expect(k.mimiken).toEqual(['neutral', 'wuetend', 'traurig', 'erschrocken', 'muede', 'skeptisch', 'froh', 'schreiend'])
    expect(k.kameraModi).toEqual(expect.arrayContaining(['nah', 'kampf', 'gefahr']))
    expect(k.himmel).toEqual(expect.arrayContaining(['tag', 'blutrot', 'gewitter']))
    expect(k.mobs).toEqual(expect.arrayContaining(['zombie', 'creeper', 'enderman']))
    expect(k.bloecke).toEqual(expect.arrayContaining(['tnt', 'bedrock', 'lava']))
  })
})

describe('Thumbnail-Planung', () => {
  it('baut den Prompt mit Beschreibung, Figuren, Katalog und Vorbildern', async () => {
    const vorlage = await readFile(join(ROOT, 'resources', 'prompts', 'thumbnail-planung.md'), 'utf8')
    const p = plane(vorlage, {
      beschreibung: 'Ich kämpfe gegen SimPell, er fällt fast von der Klippe',
      kanal: 'MoinMornhart',
      figuren: [{ id: 'ich', name: 'Philip' }, { id: 'simpell', name: 'SimPell' }],
      anzahl: 3,
      katalog: await katalog(),
      vorbilder: await ladeVorbilder(join(ROOT, 'config'))
    })
    expect(p).toContain('er fällt fast von der Klippe')
    expect(p).toContain('id „simpell“')
    expect(p).toContain('gomme-helden3-schmockyyy')
    expect(p).toContain('sturmangriff')
    expect(p).not.toMatch(/\{\{\w+\}\}/)
  })

  it('findet ungültige Szenen und repariert Kleinigkeiten', async () => {
    const k = await katalog()
    const s: Szene = {
      welt: { art: 'mond', bloecke: [{ art: 'kaese', von: [0, 0, 0] }] },
      himmel: 'regenbogen',
      figuren: [{ id: 'ich', pose: 'tanzen', item: { name: 'diamond_sword', hand: 'x' } }],
      mobs: [{ art: 'drache' }],
      kamera: { modus: 'irgendwas', thema: 'niemand' }
    }
    const fehler = pruefeSzene(s, k, ['ich'])
    expect(fehler.join('\n')).toMatch(/Welt „mond“/)
    expect(fehler.join('\n')).toMatch(/Block „kaese“/)
    expect(fehler.join('\n')).toMatch(/Pose „tanzen“/)
    expect(fehler.join('\n')).toMatch(/Mob „drache“/)
    expect(fehler.join('\n')).toMatch(/Kamera-Thema/)
    // Mob als Thema ist erlaubt
    const mitMob: Szene = { welt: { art: 'wiese' }, figuren: [{ id: 'ich', pose: 'schreck' }], mobs: [{ art: 'ghast' }], kamera: { thema: 'mob:0' } }
    expect(pruefeSzene(mitMob, k, ['ich'])).toEqual([])
    expect(s.himmel).toBe('tag')
    expect(s.kamera?.modus).toBe('nah')
    expect(s.figuren[0]!.item!.hand).toBe('l')
  })

  it('stuft Warnungen der Bildprüfung ein: nur ernste lösen einen Neubau aus', () => {
    expect(
      ernsteWarnungen([
        'Kamera trifft das Stilbuch nicht (Abweichung 0.16) – Thema näher an die Figur legen',
        'Kamera trifft das Stilbuch nicht (Abweichung 0.91) – Thema näher an die Figur legen',
        'Item von ich kaum sichtbar (80 % im Bild)',
        'Item von ich kaum sichtbar (30 % im Bild)',
        'Gesicht von simpell verdeckt oder abgewandt (0 % sichtbar)',
        'Etwas versperrt die Sicht (40 % des Bildes liegen vor der Hauptfigur)'
      ])
    ).toEqual([
      'Kamera trifft das Stilbuch nicht (Abweichung 0.91) – Thema näher an die Figur legen',
      'Item von ich kaum sichtbar (30 % im Bild)',
      'Gesicht von simpell verdeckt oder abgewandt (0 % sichtbar)',
      'Etwas versperrt die Sicht (40 % des Bildes liegen vor der Hauptfigur)'
    ])
  })

  it('plant über Claude und lässt einen fehlerhaften Plan korrigieren', async () => {
    const work = await mkdtemp(join(tmpdir(), 'planung-'))
    const { plan, fehler } = await planeThumbnail({
      beschreibung: 'Ich kämpfe gegen SimPell',
      kanal: 'MoinMornhart',
      figuren: [{ id: 'ich', name: 'Philip' }, { id: 'simpell', name: 'SimPell' }],
      katalog: await katalog(),
      vorbilder: await ladeVorbilder(join(ROOT, 'config')),
      vorlage: await readFile(join(ROOT, 'resources', 'prompts', 'thumbnail-planung.md'), 'utf8'),
      claude: { cli: process.execPath, cliPrefix: [FAKE], workDir: work }
    })
    expect(fehler).toEqual([])
    expect(plan.varianten[0]!.vorbild).toBe('gomme-helden3-schmockyyy')
    expect(plan.varianten[0]!.szene.figuren[0]!.pose).toBe('sturmangriff')
    expect(plan.varianten[0]!.szene.himmel).toBe('tag')
  })
})
