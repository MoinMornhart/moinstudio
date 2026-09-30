/**
 * Pixelarbeit für hochgeladene Logos und den Export (Philip, 30.09.): Freistellen, wenn ein Logo keine Transparenz hat
 * (einfarbiger Hintergrund, von den Rändern her entfernt), Zuschneiden und Auffüllen auf ein Quadrat (YouTube-Wasserzeichen).
 * Pixel als 4 Bytes je Punkt (Reihenfolge der Farbkanäle egal, Alpha an Stelle 4), vormultipliziert wie bei Electron.
 */

export interface Pixel {
  px: Uint8Array
  breite: number
  hoehe: number
}

export function hatTransparenz(px: Uint8Array): boolean {
  for (let i = 3; i < px.length; i += 4) if (px[i]! < 250) return true
  return false
}

/** Häufigste Randfarbe (auf 8er-Stufen gerundet) = Hintergrund */
function randFarbe(b: Pixel): [number, number, number] {
  const zaehler = new Map<number, number>()
  const nimm = (x: number, y: number): void => {
    const o = (y * b.breite + x) * 4
    const k = ((b.px[o]! >> 3) << 10) | ((b.px[o + 1]! >> 3) << 5) | (b.px[o + 2]! >> 3)
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
  }
  for (let x = 0; x < b.breite; x++) {
    nimm(x, 0)
    nimm(x, b.hoehe - 1)
  }
  for (let y = 0; y < b.hoehe; y++) {
    nimm(0, y)
    nimm(b.breite - 1, y)
  }
  const k = [...zaehler.entries()].sort((a, z) => z[1] - a[1])[0]![0]
  return [((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4]
}

/**
 * Hintergrund entfernen: alles, was vom Rand aus zusammenhängend fast die Randfarbe hat, wird durchsichtig; am Übergang
 * weich (halbe Deckkraft je nach Abstand), damit keine Treppen entstehen. Innere Flächen in Hintergrundfarbe (das Loch
 * im „O“) bleiben nur stehen, wenn sie nicht mit dem Rand verbunden sind.
 */
export function freistellen(b: Pixel, toleranz = 38): Pixel {
  const { breite: w, hoehe: h } = b
  const px = Uint8Array.from(b.px)
  const [r, g, bl] = randFarbe(b)
  const abstand = (i: number): number => Math.hypot(px[i * 4]! - r, px[i * 4 + 1]! - g, px[i * 4 + 2]! - bl)
  const weg = new Uint8Array(w * h)
  const stapel: number[] = []
  const pruefe = (i: number): void => {
    if (!weg[i] && abstand(i) <= toleranz) {
      weg[i] = 1
      stapel.push(i)
    }
  }
  for (let x = 0; x < w; x++) {
    pruefe(x)
    pruefe((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    pruefe(y * w)
    pruefe(y * w + w - 1)
  }
  while (stapel.length) {
    const i = stapel.pop()!
    const x = i % w
    if (x > 0) pruefe(i - 1)
    if (x < w - 1) pruefe(i + 1)
    if (i >= w) pruefe(i - w)
    if (i < w * (h - 1)) pruefe(i + w)
  }
  for (let i = 0; i < w * h; i++) {
    let a = 255
    if (weg[i]) a = 0
    else {
      // Kante: Nachbar entfernt und Farbe nah am Hintergrund → teilweise durchsichtig
      const x = i % w
      const nachbar = (x > 0 && weg[i - 1]) || (x < w - 1 && weg[i + 1]) || (i >= w && weg[i - w]) || (i < w * (h - 1) && weg[i + w])
      if (nachbar) a = Math.round(255 * Math.min(1, Math.max(0.35, (abstand(i) - toleranz) / (toleranz * 2) + 0.35)))
    }
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round((px[i * 4 + c]! * a) / 255)
    px[i * 4 + 3] = a
  }
  return { px, breite: w, hoehe: h }
}

/** Durchsichtigen Rand abschneiden, `rand` Pixel Luft lassen. */
export function zuschneiden(b: Pixel, rand = 0): Pixel {
  let x0 = b.breite
  let y0 = b.hoehe
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < b.hoehe; y++)
    for (let x = 0; x < b.breite; x++)
      if (b.px[(y * b.breite + x) * 4 + 3]! > 8) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
  if (x1 < 0) return b
  x0 = Math.max(0, x0 - rand)
  y0 = Math.max(0, y0 - rand)
  x1 = Math.min(b.breite - 1, x1 + rand)
  y1 = Math.min(b.hoehe - 1, y1 + rand)
  const breite = x1 - x0 + 1
  const hoehe = y1 - y0 + 1
  const px = new Uint8Array(breite * hoehe * 4)
  for (let y = 0; y < hoehe; y++) px.set(b.px.subarray(((y0 + y) * b.breite + x0) * 4, ((y0 + y) * b.breite + x0 + breite) * 4), y * breite * 4)
  return { px, breite, hoehe }
}

/** Auf ein durchsichtiges Quadrat setzen (mittig), z. B. für das YouTube-Wasserzeichen. */
export function aufQuadrat(b: Pixel): Pixel {
  const s = Math.max(b.breite, b.hoehe)
  const px = new Uint8Array(s * s * 4)
  const x0 = Math.floor((s - b.breite) / 2)
  const y0 = Math.floor((s - b.hoehe) / 2)
  for (let y = 0; y < b.hoehe; y++) px.set(b.px.subarray(y * b.breite * 4, (y + 1) * b.breite * 4), ((y0 + y) * s + x0) * 4)
  return { px, breite: s, hoehe: s }
}

/** Zielgröße beim Export: längste Seite = n Pixel */
export function exportGroesse(breite: number, hoehe: number, n: number): { breite: number; hoehe: number } {
  const f = n / Math.max(breite, hoehe)
  return { breite: Math.max(1, Math.round(breite * f)), hoehe: Math.max(1, Math.round(hoehe * f)) }
}
