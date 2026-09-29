import { describe, expect, it } from 'vitest'
import { schreibePsd, thumbnailEbenen } from '../../src/main/adobe/psd'

/** Liest Kopf, Ebenen (Name, Sichtbarkeit, Kanäle) und das zusammengesetzte Bild einer unkomprimierten PSD. */
function lies(b: Buffer): { breite: number; hoehe: number; ebenen: { name: string; sichtbar: boolean; alpha: number[]; rot: number[] }[]; gesamtRot: number[] } {
  expect(b.toString('latin1', 0, 4)).toBe('8BPS')
  const hoehe = b.readUInt32BE(14)
  const breite = b.readUInt32BE(18)
  const pixel = breite * hoehe
  let o = 26
  o += 4 + b.readUInt32BE(o) // Farbmodus
  o += 4 + b.readUInt32BE(o) // Ressourcen
  const abschnittEnde = o + 4 + b.readUInt32BE(o)
  o += 4
  o += 4 // Länge Ebeneninfo
  const anzahl = b.readInt16BE(o)
  o += 2
  const saetze: { name: string; sichtbar: boolean; kanaele: { id: number; laenge: number }[] }[] = []
  for (let i = 0; i < anzahl; i++) {
    o += 16
    const k = b.readUInt16BE(o)
    o += 2
    const kanaele = []
    for (let j = 0; j < k; j++) {
      kanaele.push({ id: b.readInt16BE(o), laenge: b.readUInt32BE(o + 2) })
      o += 6
    }
    expect(b.toString('latin1', o, o + 8)).toBe('8BIMnorm')
    const flags = b[o + 10]!
    o += 12
    const zusatz = b.readUInt32BE(o)
    o += 4
    const ende = o + zusatz
    o += 4 + b.readUInt32BE(o) // Maske
    o += 4 + b.readUInt32BE(o) // Mischbereiche
    const name = b.toString('latin1', o + 1, o + 1 + b[o]!)
    o = ende
    saetze.push({ name, sichtbar: (flags & 2) === 0, kanaele })
  }
  const ebenen = saetze.map((s) => {
    const daten: Record<number, number[]> = {}
    for (const k of s.kanaele) {
      expect(b.readUInt16BE(o)).toBe(0)
      daten[k.id] = [...b.subarray(o + 2, o + 2 + pixel)]
      o += k.laenge
    }
    return { name: s.name, sichtbar: s.sichtbar, alpha: daten[-1]!, rot: daten[0]! }
  })
  o = abschnittEnde
  expect(b.readUInt16BE(o)).toBe(0)
  return { breite, hoehe, ebenen, gesamtRot: [...b.subarray(o + 2, o + 2 + pixel)] }
}

const bild = (pixel: number[][]): Uint8Array => Uint8Array.from(pixel.flat())

describe('Photoshop: PSD mit Ebenen (ROADMAP 8.4, ungetestet in Photoshop)', () => {
  // 3 × 2 Pixel: links Figur, rechts oben Text
  const ohneText = bild([[10, 0, 0, 255], [20, 0, 0, 255], [30, 0, 0, 255], [40, 0, 0, 255], [50, 0, 0, 255], [60, 0, 0, 255]])
  const fertig = bild([[10, 0, 0, 255], [20, 0, 0, 255], [255, 255, 0, 255], [40, 0, 0, 255], [50, 0, 0, 255], [60, 0, 0, 255]])
  const maske = bild([[255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 0], [255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 0]])

  it('trennt Hintergrund, Figuren und Text so, dass übereinander das fertige Bild entsteht', () => {
    const e = thumbnailEbenen({ fertig, ohneText, maske }, 6)
    expect(e.map((x) => x.name)).toEqual(['Hintergrund', 'Figuren', 'Text'])
    expect([...e[1]!.rgba].filter((_, i) => i % 4 === 3)).toEqual([255, 0, 0, 255, 0, 0])
    expect([...e[2]!.rgba].filter((_, i) => i % 4 === 3)).toEqual([0, 0, 255, 0, 0, 0])
    // Zusammensetzen (deckende Ebenen): oberste sichtbare gewinnt
    for (let p = 0; p < 6; p++) {
      const oben = [...e].reverse().find((x) => x.rgba[p * 4 + 3]! > 0)!
      expect(oben.rgba.slice(p * 4, p * 4 + 3)).toEqual(fertig.slice(p * 4, p * 4 + 3))
    }
  })

  it('kommt ohne Maske und ohne Bild ohne Text aus', () => {
    expect(thumbnailEbenen({ fertig, ohneText, maske: null }, 6).map((x) => x.name)).toEqual(['Hintergrund', 'Text'])
    expect(thumbnailEbenen({ fertig, ohneText: null, maske: null }, 6).map((x) => x.name)).toEqual(['Thumbnail'])
    expect(thumbnailEbenen({ fertig: ohneText, ohneText, maske }, 6).map((x) => x.name)).toEqual(['Hintergrund', 'Figuren'])
  })

  it('schreibt eine gültige PSD mit Ebenen, Namen und Gesamtbild', () => {
    const ebenen = thumbnailEbenen({ fertig, ohneText, maske }, 6)
    const psd = lies(schreibePsd(3, 2, [...ebenen, { name: 'Übersicht', rgba: fertig, sichtbar: false }], fertig))
    expect(psd).toMatchObject({ breite: 3, hoehe: 2 })
    expect(psd.ebenen.map((x) => [x.name, x.sichtbar])).toEqual([
      ['Hintergrund', true],
      ['Figuren', true],
      ['Text', true],
      ['Übersicht', false]
    ])
    expect(psd.ebenen[1]!.alpha).toEqual([255, 0, 0, 255, 0, 0])
    expect(psd.ebenen[2]!.rot).toEqual([0, 0, 255, 0, 0, 0])
    expect(psd.gesamtRot).toEqual([10, 20, 255, 40, 50, 60])
  })

  it('lehnt Ebenen mit falscher Größe ab', () => {
    expect(() => schreibePsd(3, 2, [{ name: 'x', rgba: new Uint8Array(4) }], fertig)).toThrow('falsche Größe')
  })
})
