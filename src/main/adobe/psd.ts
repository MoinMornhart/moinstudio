/**
 * Photoshop (ROADMAP 8.4, ungetestet in Photoshop): PSD mit Ebenen schreiben, ohne Photoshop und ohne Zusatzpaket.
 * Format nach der Adobe-Spezifikation „Photoshop File Formats“: Version 1, RGB, 8 Bit, unkomprimiert. Die Ebenen stehen
 * von unten nach oben in der Datei; dazu das zusammengesetzte Bild für Programme, die keine Ebenen lesen.
 */

export interface PsdEbene {
  name: string
  /** RGBA, nicht vormultipliziert, Breite × Höhe × 4 */
  rgba: Uint8Array
  sichtbar?: boolean
}

class Schreiber {
  private teile: Buffer[] = []
  private laenge = 0
  u8(v: number): this {
    return this.roh(Buffer.from([v & 0xff]))
  }
  u16(v: number): this {
    const b = Buffer.alloc(2)
    b.writeInt16BE(v)
    return this.roh(b)
  }
  u32(v: number): this {
    const b = Buffer.alloc(4)
    b.writeUInt32BE(v >>> 0)
    return this.roh(b)
  }
  i32(v: number): this {
    const b = Buffer.alloc(4)
    b.writeInt32BE(v)
    return this.roh(b)
  }
  text(t: string): this {
    return this.roh(Buffer.from(t, 'latin1'))
  }
  roh(b: Buffer): this {
    this.teile.push(b)
    this.laenge += b.length
    return this
  }
  get groesse(): number {
    return this.laenge
  }
  buffer(): Buffer {
    return Buffer.concat(this.teile, this.laenge)
  }
}

/** Ein Kanal (0 = R, 1 = G, 2 = B, 3 = A) als eigene Fläche */
function kanal(rgba: Uint8Array, k: number, pixel: number): Buffer {
  const b = Buffer.alloc(pixel)
  for (let i = 0; i < pixel; i++) b[i] = rgba[i * 4 + k]!
  return b
}

/** Ebenenname als Pascal-String, auf ein Vielfaches von 4 aufgefüllt (inklusive Längenbyte) */
function pascal(name: string): Buffer {
  const t = Buffer.from(name.normalize('NFC').replace(/[^\x20-\xff]/g, '_').slice(0, 255), 'latin1')
  const l = Math.ceil((t.length + 1) / 4) * 4
  const b = Buffer.alloc(l)
  b[0] = t.length
  t.copy(b, 1)
  return b
}

/** Unicode-Name (Zusatzinfo „luni“), damit Umlaute in Photoshop richtig erscheinen */
function luni(name: string): Buffer {
  const w = new Schreiber().u32(name.length)
  for (const c of name) w.u16(c.charCodeAt(0))
  let daten = w.buffer()
  if (daten.length % 2) daten = Buffer.concat([daten, Buffer.alloc(1)])
  return new Schreiber().text('8BIM').text('luni').u32(daten.length).roh(daten).buffer()
}

export function schreibePsd(breite: number, hoehe: number, ebenen: PsdEbene[], gesamt: Uint8Array): Buffer {
  const pixel = breite * hoehe
  for (const e of [...ebenen.map((x) => x.rgba), gesamt]) if (e.length !== pixel * 4) throw new Error('Ebene hat die falsche Größe.')
  const w = new Schreiber()
  // Kopf
  w.text('8BPS').u16(1).roh(Buffer.alloc(6)).u16(3).u32(hoehe).u32(breite).u16(8).u16(3)
  w.u32(0) // Farbmodusdaten
  w.u32(0) // Bildressourcen
  // Ebenen: Datensätze (unten zuerst), danach die Kanaldaten in derselben Reihenfolge
  const info = new Schreiber().u16(ebenen.length)
  const kanaele = new Schreiber()
  const kanalLaenge = 2 + pixel
  for (const e of ebenen) {
    info.i32(0).i32(0).i32(hoehe).i32(breite).u16(4)
    // Reihenfolge R, G, B, Alpha: Photoshop liest nach Kennung, manche Leser (Pillow) nach Reihenfolge
    for (const id of [0, 1, 2, -1]) info.u16(id).u32(kanalLaenge)
    const zusatz = Buffer.concat([new Schreiber().u32(0).u32(0).buffer(), pascal(e.name), luni(e.name)])
    info
      .text('8BIM')
      .text('norm')
      .u8(255) // Deckkraft
      .u8(0) // Beschneidung
      .u8(e.sichtbar === false ? 2 : 0) // Bit 1: ausgeblendet
      .u8(0)
      .u32(zusatz.length)
      .roh(zusatz)
    for (const k of [0, 1, 2, 3]) kanaele.u16(0).roh(kanal(e.rgba, k, pixel))
  }
  let ebenenInfo = Buffer.concat([info.buffer(), kanaele.buffer()])
  if (ebenenInfo.length % 2) ebenenInfo = Buffer.concat([ebenenInfo, Buffer.alloc(1)])
  const abschnitt = new Schreiber().u32(ebenenInfo.length).roh(ebenenInfo).u32(0) // + globale Ebenenmaske (leer)
  w.u32(abschnitt.groesse).roh(abschnitt.buffer())
  // Zusammengesetztes Bild: R, G, B nacheinander
  w.u16(0)
  for (const k of [0, 1, 2]) w.roh(kanal(gesamt, k, pixel))
  return w.buffer()
}

/**
 * Ebenen eines Thumbnails: Hintergrund (ganzes Bild ohne Text), Figuren (Bild ohne Text, freigestellt über die Maske
 * aus Blender) und Text (genau die Pixel, in denen sich das fertige Bild vom Bild ohne Text unterscheidet).
 * Übereinander ergibt das pixelgleich das fertige Thumbnail.
 */
export function thumbnailEbenen(bilder: { fertig: Uint8Array; ohneText: Uint8Array | null; maske: Uint8Array | null }, pixel: number): PsdEbene[] {
  const { fertig, ohneText, maske } = bilder
  if (!ohneText) return [{ name: 'Thumbnail', rgba: deckend(fertig, pixel) }]
  const ebenen: PsdEbene[] = [{ name: 'Hintergrund', rgba: deckend(ohneText, pixel) }]
  if (maske) {
    const fig = new Uint8Array(pixel * 4)
    for (let i = 0; i < pixel; i++) {
      fig[i * 4] = ohneText[i * 4]!
      fig[i * 4 + 1] = ohneText[i * 4 + 1]!
      fig[i * 4 + 2] = ohneText[i * 4 + 2]!
      // weiß und sichtbar = Figur; min() passt für vormultipliziertes und normales Alpha
      fig[i * 4 + 3] = Math.min(maske[i * 4]!, maske[i * 4 + 3]!)
    }
    ebenen.push({ name: 'Figuren', rgba: fig })
  }
  const text = new Uint8Array(pixel * 4)
  let hatText = false
  for (let i = 0; i < pixel; i++) {
    const o = i * 4
    if (fertig[o] !== ohneText[o] || fertig[o + 1] !== ohneText[o + 1] || fertig[o + 2] !== ohneText[o + 2]) {
      text[o] = fertig[o]!
      text[o + 1] = fertig[o + 1]!
      text[o + 2] = fertig[o + 2]!
      text[o + 3] = 255
      hatText = true
    }
  }
  if (hatText) ebenen.push({ name: 'Text', rgba: text })
  return ebenen
}

/** Ebene „Logo“: genau die Pixel, in denen sich das fertige Bild vom Bild ohne Logo unterscheidet (samt Schatten). */
export function logoEbene(fertig: Uint8Array, ohneLogo: Uint8Array, pixel: number): PsdEbene | null {
  const logo = new Uint8Array(pixel * 4)
  let da = false
  for (let o = 0; o < pixel * 4; o += 4) {
    if (fertig[o] !== ohneLogo[o] || fertig[o + 1] !== ohneLogo[o + 1] || fertig[o + 2] !== ohneLogo[o + 2]) {
      logo[o] = fertig[o]!
      logo[o + 1] = fertig[o + 1]!
      logo[o + 2] = fertig[o + 2]!
      logo[o + 3] = 255
      da = true
    }
  }
  return da ? { name: 'Logo', rgba: logo } : null
}

function deckend(rgba: Uint8Array, pixel: number): Uint8Array {
  const b = Uint8Array.from(rgba)
  for (let i = 0; i < pixel; i++) b[i * 4 + 3] = 255
  return b
}
