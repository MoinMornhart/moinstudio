import { nativeImage } from 'electron'
import { stat, writeFile } from 'node:fs/promises'
import { schreibePsd, thumbnailEbenen } from './psd'

/**
 * Thumbnail als Photoshop-Datei (ROADMAP 8.4, ungetestet in Photoshop). Sucht zum fertigen Bild das Bild ohne Text und
 * die Figurenmaske aus Blender (<szene>.png bzw. <szene>.roh.png und .maske.png) und schreibt eine PSD mit Ebenen.
 */

const gibtEs = async (p: string): Promise<boolean> => (await stat(p).catch(() => null))?.isFile() ?? false

/** PNG → RGBA (Electron liefert BGRA) */
function rgba(pfad: string, breite: number, hoehe: number): Uint8Array | null {
  const bild = nativeImage.createFromPath(pfad)
  if (bild.isEmpty()) return null
  const g = bild.getSize()
  if (g.width !== breite || g.height !== hoehe) return null
  const bgra = bild.toBitmap()
  const out = new Uint8Array(bgra.length)
  for (let i = 0; i < bgra.length; i += 4) {
    out[i] = bgra[i + 2]!
    out[i + 1] = bgra[i + 1]!
    out[i + 2] = bgra[i]!
    out[i + 3] = bgra[i + 3]!
  }
  return out
}

export async function thumbnailPsd(o: { bild: string; szene: string | null; ziel: string }): Promise<{ ebenen: string[] }> {
  const fertigBild = nativeImage.createFromPath(o.bild)
  if (fertigBild.isEmpty()) throw new Error('Das Bild ist nicht lesbar.')
  const { width: breite, height: hoehe } = fertigBild.getSize()
  const fertig = rgba(o.bild, breite, hoehe)!
  // Bild ohne Text: <basis>.roh.png (Änderung) oder <basis>.png (Variante), nie das fertige Bild selbst
  const basis = o.szene?.replace(/\.szene\.json$/, '') ?? null
  let ohneTextPfad: string | null = null
  for (const k of basis ? [`${basis}.roh.png`, `${basis}.png`] : []) {
    if (k.toLowerCase() !== o.bild.toLowerCase() && (await gibtEs(k))) {
      ohneTextPfad = k
      break
    }
  }
  const ohneText = ohneTextPfad ? rgba(ohneTextPfad, breite, hoehe) : null
  const maskePfad = ohneTextPfad ? ohneTextPfad.replace(/\.png$/, '.maske.png') : null
  const maske = maskePfad && (await gibtEs(maskePfad)) ? rgba(maskePfad, breite, hoehe) : null
  const ebenen = thumbnailEbenen({ fertig, ohneText, maske }, breite * hoehe)
  await writeFile(o.ziel, schreibePsd(breite, hoehe, ebenen, fertig))
  return { ebenen: ebenen.map((e) => e.name) }
}
