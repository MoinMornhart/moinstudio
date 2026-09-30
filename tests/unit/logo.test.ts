import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { koerperUnter, pngGroesse, ueberlappung, waehleLogoPlatz, wichtigeBoxen, ZEITSTEMPEL, type Box } from '../../src/main/logo/platz'
import { logoAusAntwort, type LogoWahl } from '../../src/main/logo/setzen'
import { aendereLogo, ladeLogos, logoFuerAuftrag, neuesLogo } from '../../src/main/logo/bibliothek'
import { aufQuadrat, exportGroesse, freistellen, hatTransparenz, zuschneiden } from '../../src/main/logo/bild'
import { findeName, pruefeLogoSpec, type Vorrat } from '../../src/main/logo/job'
import { logoEbene } from '../../src/main/adobe/psd'

const frei = (box: Box, sperren: Box[]): boolean => sperren.every((s) => ueberlappung(box, s) === 0)
const imBild = (b: Box): boolean => b[0] >= 0 && b[1] >= 0 && b[2] <= 1 && b[3] <= 1

describe('Logo-Platz im Thumbnail', () => {
  it('nimmt ohne Hindernisse die bevorzugte Ecke unten links und bleibt im Bild', () => {
    const p = waehleLogoPlatz({ sperren: [], logoVerhaeltnis: 3, groesse: 'mittel', position: 'auto' })
    expect(p.ecke).toBe('unten_links')
    expect(p.frei).toBe(true)
    expect(imBild(p.box)).toBe(true)
  })

  it('steht nie über einer Figur (Kopf mit Körper) links', () => {
    const kopf: Box = [0.05, 0.2, 0.35, 0.7]
    const sperren = [kopf, koerperUnter(kopf)]
    const p = waehleLogoPlatz({ sperren, logoVerhaeltnis: 2, groesse: 'gross', position: 'auto' })
    expect(p.frei).toBe(true)
    expect(frei(p.box, sperren)).toBe(true)
    expect(p.ecke).toBe('oben_rechts')
  })

  it('meidet unten rechts (YouTube-Videolänge), außer Philip will es ausdrücklich', () => {
    const sperren: Box[] = [[0, 0, 0.6, 1]]
    const auto = waehleLogoPlatz({ sperren, logoVerhaeltnis: 1, groesse: 'klein', position: 'auto' })
    expect(auto.ecke).toBe('oben_rechts')
    expect(ueberlappung(auto.box, ZEITSTEMPEL)).toBe(0)
    const gewollt = waehleLogoPlatz({ sperren, logoVerhaeltnis: 1, groesse: 'klein', position: 'unten_rechts' })
    expect(gewollt.ecke).toBe('unten_rechts')
    expect(gewollt.ausgewichen).toBe(false)
  })

  it('weicht aus, wenn Philips Ecke belegt ist, und sagt es', () => {
    const sperren: Box[] = [[0, 0, 0.5, 0.5]]
    const p = waehleLogoPlatz({ sperren, logoVerhaeltnis: 2, groesse: 'mittel', position: 'oben_links' })
    expect(p.ausgewichen).toBe(true)
    expect(p.ecke).not.toBe('oben_links')
    expect(frei(p.box, sperren)).toBe(true)
  })

  it('rückt an der Kante nach innen oder wird kleiner, bevor es etwas verdeckt', () => {
    // nur ein schmaler Kopf in der Ecke oben links, sonst alles voll bis auf einen Streifen oben
    const sperren: Box[] = [[0, 0, 0.1, 0.25], [0, 0.3, 1, 1]]
    const p = waehleLogoPlatz({ sperren, logoVerhaeltnis: 3, groesse: 'mittel', position: 'oben_links' })
    expect(p.frei).toBe(true)
    expect(frei(p.box, sperren)).toBe(true)
  })

  it('meldet, wenn es nirgends frei ist (kleinste Größe)', () => {
    const p = waehleLogoPlatz({ sperren: [[0, 0, 1, 1]], logoVerhaeltnis: 1, groesse: 'mittel', position: 'auto' })
    expect(p.frei).toBe(false)
    expect(p.verkleinert).toBe(true)
  })

  it('größer heißt größer', () => {
    const f = (g: 'klein' | 'mittel' | 'gross'): number => {
      const b = waehleLogoPlatz({ sperren: [], logoVerhaeltnis: 2, groesse: g, position: 'auto' }).box
      return (b[2] - b[0]) * (b[3] - b[1])
    }
    expect(f('klein')).toBeLessThan(f('mittel'))
    expect(f('mittel')).toBeLessThan(f('gross'))
  })

  it('liest die Boxen aus den Berichten aller Generatoren', () => {
    const minecraft = { figuren: { ich: { box: [0.1, 0.1, 0.4, 1], kopf_box: [0.2, 0.1, 0.3, 0.3] } }, items: { ich: { box: [0.4, 0.4, 0.5, 0.6] } }, mobs: [{ art: 'zombie', box: [0.6, 0.2, 0.8, 0.9] }] }
    expect(wichtigeBoxen(minecraft)).toHaveLength(4)
    const reaktion = { kopf_box: [0.1, 0.2, 0.3, 0.6], boxen: [[0.5, 0.1, 0.9, 0.3]] }
    const r = wichtigeBoxen(reaktion)
    expect(r).toContainEqual(koerperUnter([0.1, 0.2, 0.3, 0.6]))
    expect(r).toContainEqual([0.5, 0.1, 0.9, 0.3])
    expect(wichtigeBoxen({ texte: [{ box: [0.1, 0.03, 0.5, 0.2] }], sperren: [[1, 2, 3]] })).toEqual([[0.1, 0.03, 0.5, 0.2]])
    expect(wichtigeBoxen(null)).toEqual([])
  })

  it('liest die Größe aus dem PNG-Kopf', () => {
    const kopf = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(kopf)
    kopf.writeUInt32BE(1280, 16)
    kopf.writeUInt32BE(720, 20)
    expect(pngGroesse(kopf)).toEqual({ breite: 1280, hoehe: 720 })
    expect(pngGroesse(Buffer.from('kein png'))).toBeNull()
  })
})

describe('Logo bei Änderungen in Worten', () => {
  const bisher: LogoWahl = { datei: 'a.png', name: 'Kanal', position: 'auto', groesse: 'mittel' }
  const bib = [{ name: 'Kanal', datei: 'a.png' }, { name: 'Serie', datei: 'b.png' }]
  it('bleibt ohne Wunsch erhalten, „weg“ entfernt es', () => {
    expect(logoAusAntwort(undefined, bisher, bib, undefined)).toEqual(bisher)
    expect(logoAusAntwort(null, bisher, bib, undefined)).toBeUndefined()
  })
  it('kleiner und nach links', () => {
    expect(logoAusAntwort({ name: 'Kanal', position: 'unten_links', groesse: 'klein' }, bisher, bib, undefined)).toEqual({ ...bisher, position: 'unten_links', groesse: 'klein' })
  })
  it('anderes Logo aus der Bibliothek oder das Standard-Logo, wenn vorher keins da war', () => {
    expect(logoAusAntwort({ name: 'serie' }, bisher, bib, undefined)?.datei).toBe('b.png')
    expect(logoAusAntwort({ position: 'auto', groesse: 'mittel' }, undefined, bib, bisher)?.datei).toBe('a.png')
    expect(logoAusAntwort({ position: 'auto' }, undefined, bib, undefined)).toBeUndefined()
    expect(logoAusAntwort({ position: 'quer', groesse: 'xxl' }, bisher, bib, undefined)).toEqual(bisher)
  })
})

describe('Logo-Bibliothek im Datenordner', () => {
  let dir = ''
  afterEach(async () => dir && rm(dir, { recursive: true, force: true }))
  it('speichert, benennt um, setzt Standard je Kanal und löscht', async () => {
    dir = await mkdtemp(join(tmpdir(), 'moin-logo-'))
    let logos = await neuesLogo(dir, Buffer.from('png'), { name: '  Mein Logo ', quelle: 'hochgeladen', breite: 10, hoehe: 5 })
    const id = logos[0]!.id
    expect(logos[0]!.name).toBe('Mein Logo')
    expect(await readFile(join(dir, 'logos', `${id}.png`), 'utf8')).toBe('png')
    logos = await aendereLogo(dir, id, { name: 'Kanal-Logo', standard: { kanal: 'MoinMorni', an: true } })
    expect(logos[0]).toMatchObject({ name: 'Kanal-Logo', standard: ['MoinMorni'] })
    expect(await logoFuerAuftrag(dir, { id: 'standard', position: 'oben_links', groesse: 'klein' }, 'MoinMorni')).toMatchObject({ name: 'Kanal-Logo', position: 'oben_links', groesse: 'klein' })
    expect(await logoFuerAuftrag(dir, { id: 'standard', position: 'auto', groesse: 'mittel' }, 'MoinMornhart')).toBeUndefined()
    expect(await logoFuerAuftrag(dir, undefined, 'MoinMorni')).toBeUndefined()
    logos = await aendereLogo(dir, id, { entfernen: true })
    expect(logos).toEqual([])
    expect(await stat(join(dir, 'logos', `${id}.png`)).catch(() => null)).toBeNull()
    expect(await ladeLogos(dir)).toEqual([])
  })
})

describe('Hochgeladene Logos und Export', () => {
  /** 6×4: weißer Hintergrund, rotes Quadrat 2×2 in der Mitte */
  const bild = (): { px: Uint8Array; breite: number; hoehe: number } => {
    const px = new Uint8Array(6 * 4 * 4).fill(255)
    for (const [x, y] of [[2, 1], [3, 1], [2, 2], [3, 2]]) px.set([255, 0, 0, 255], (y! * 6 + x!) * 4)
    return { px, breite: 6, hoehe: 4 }
  }
  it('stellt einfarbigen Hintergrund frei und schneidet zu', () => {
    const b = bild()
    expect(hatTransparenz(b.px)).toBe(false)
    const f = freistellen(b)
    expect(hatTransparenz(f.px)).toBe(true)
    expect(f.px[3]).toBe(0)
    const z = zuschneiden(f)
    expect([z.breite, z.hoehe]).toEqual([2, 2])
    expect(z.px[3]).toBeGreaterThan(200)
  })
  it('setzt das Wasserzeichen mittig auf ein Quadrat und rechnet Exportgrößen', () => {
    const q = aufQuadrat({ px: new Uint8Array(4 * 2 * 4).fill(255), breite: 4, hoehe: 2 })
    expect([q.breite, q.hoehe]).toEqual([4, 4])
    expect(q.px[3]).toBe(0)
    expect(q.px[(1 * 4) * 4 + 3]).toBe(255)
    expect(exportGroesse(2000, 500, 512)).toEqual({ breite: 512, hoehe: 128 })
  })
  it('legt das Logo als eigene Photoshop-Ebene an', () => {
    const ohne = new Uint8Array(8).fill(10)
    const mit = Uint8Array.from(ohne)
    mit[4] = 200
    const e = logoEbene(mit, ohne, 2)!
    expect(e.name).toBe('Logo')
    expect([e.rgba[3], e.rgba[7]]).toEqual([0, 255])
    expect(logoEbene(ohne, ohne, 2)).toBeNull()
  })
})

describe('Logo-Bauplan von Claude', () => {
  const vorrat: Vorrat = { bloecke: new Set(['gold_block', 'stone', 'grass_block']), items: new Set(['iron_chain', 'copper_chain', 'diamond_sword']), mobs: { creeper: 'creeper.png' }, koepfe: [{ name: 'MoinMornhart', datei: 'ich.png' }] }
  it('findet Namen auch ungefähr (chain → iron_chain)', () => {
    expect(findeName('chain', vorrat.items)).toBe('iron_chain')
    expect(findeName('Diamond Sword', vorrat.items)).toBe('diamond_sword')
    expect(findeName('laser', vorrat.items)).toBeNull()
  })
  it('macht aus jedem Plan ein baubares Logo', () => {
    const { spec, warnungen } = pruefeLogoSpec(
      { text: '  Chained   Together mit sehr langem Namen ', stil: '3d', fuellung: { art: 'textur', block: 'unobtainium' }, kontur: 'rot', symbol: { art: 'kopf', name: 'ich', platz: 'rechts' }, neigung: 40 },
      vorrat
    )
    expect(spec.text.length).toBeLessThanOrEqual(24)
    expect(spec.stil).toBe('3d')
    expect(spec.fuellung.art).toBe('verlauf')
    expect(spec.kontur).toMatch(/^#/)
    expect(spec.symbol).toMatchObject({ art: 'kopf', name: 'MoinMornhart', datei: 'ich.png', platz: 'rechts' })
    expect(spec.neigung).toBe(10)
    expect(warnungen).toHaveLength(1)
    expect(pruefeLogoSpec({ text: 'X', fuellung: { art: 'textur', block: 'gold_block' }, symbol: { art: 'item', name: 'laser' } }, vorrat).spec.symbol).toBeUndefined()
    expect(pruefeLogoSpec({ symbol: { art: 'kopf', name: 'Creeper' } }, vorrat).spec.symbol?.datei).toBe('creeper.png')
  })
})
