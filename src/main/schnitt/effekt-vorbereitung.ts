import { execFile } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sichereMcAssets } from '../thumbnail/minecraft'
import { pruefeEffekte, zeitleiste, type Effekt } from './effekte'
import { sichereKlaenge } from './klaenge'

/** Was die Aufträge für Effekte brauchen (ROADMAP E.2) */
export interface EffektHilfe {
  ffmpeg: string
  /** Python aus der Vorlagen-Umgebung (Pillow, numpy) für Texte in Minecraft-Schrift */
  python: string
  /** blender/text_bild.py */
  textSkript: string
  /** %LOCALAPPDATA%\MoinStudio (dort liegen die Geräusche) */
  lokal: string
}

export interface VorbereiteteEffekte {
  liste: Effekt[]
  textBilder: Record<number, { datei: string; breite: number; hoehe: number }>
  klaenge: Record<string, string>
  endzeit: (t: number) => number
  laenge: number
}

export async function ladeEffekte(ordner: string, laenge: number): Promise<Effekt[]> {
  const roh = JSON.parse(await readFile(join(ordner, 'effekte.json'), 'utf8').catch(() => '[]')) as unknown
  return pruefeEffekte(roh, laenge).effekte.filter((e) => (e as { aus?: boolean }).aus !== true)
}

/** Lädt die Effekte eines Projekts und legt Text-Bilder und Geräusche an; null, wenn es keine Effekte gibt. */
export async function bereiteEffekteVor(daten: string, ordner: string, laenge: number, hilfe: EffektHilfe): Promise<VorbereiteteEffekte | null> {
  const liste = await ladeEffekte(ordner, laenge)
  if (!liste.length) return null
  const klaenge = await sichereKlaenge(hilfe.ffmpeg, join(hilfe.lokal, 'klaenge'))
  const textBilder: VorbereiteteEffekte['textBilder'] = {}
  const texte = liste.map((e, i) => ({ e, i })).filter((x): x is { e: Extract<Effekt, { art: 'text' }>; i: number } => x.e.art === 'text')
  if (texte.length) {
    const mc = await sichereMcAssets(daten)
    await mkdir(join(ordner, 'effekte'), { recursive: true })
    for (const { e, i } of texte) {
      const datei = join(ordner, 'effekte', `text${i}.png`)
      const aus = await new Promise<string>((resolve, reject) =>
        execFile(hilfe.python, [hilfe.textSkript, mc.assets, datei, e.text.replace(/\n/g, '\\n'), e.farbe ?? '#ffffff', '8'], { windowsHide: true, timeout: 60_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)))
      )
      const m = /MOIN_TEXTBILD (\d+) (\d+)/.exec(aus)
      if (m) textBilder[i] = { datei, breite: Number(m[1]), hoehe: Number(m[2]) }
    }
  }
  const zl = zeitleiste(liste, laenge)
  return { liste, textBilder, klaenge, endzeit: zl.endzeit, laenge: zl.laenge }
}
