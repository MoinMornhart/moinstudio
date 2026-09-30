import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sichereMcAssets } from '../thumbnail/minecraft'
import { effekteInSchnittzeit, introDauer, pruefeEffekte, zeitleiste, type Effekt } from './effekte'
import type { Bereich } from './rohschnitt'
import { sichereKlaenge } from './klaenge'
import { liesMitKonfliktkopien } from '../data/jsonfile'

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
  textBilder: Record<string, { datei: string; breite: number; hoehe: number }>
  klaenge: Record<string, string>
  endzeit: (t: number) => number
  laenge: number
}

/** Effekte des Projekts in Originalzeit (wie gespeichert), ohne ausgeschaltete */
export async function ladeEffekte(ordner: string, dauer: number): Promise<Effekt[]> {
  const roh = JSON.parse(await liesMitKonfliktkopien(join(ordner, 'effekte.json')).catch(() => '[]')) as unknown
  return pruefeEffekte(roh, dauer).effekte.filter((e) => (e as { aus?: boolean }).aus !== true)
}

/** Lädt die Effekte eines Projekts und legt Text-Bilder und Geräusche an; null, wenn es keine Effekte gibt. */
export async function bereiteEffekteVor(daten: string, ordner: string, schnitt: { dauer: number; behalten: Bereich[] }, hilfe: EffektHilfe): Promise<VorbereiteteEffekte | null> {
  // gespeichert in Originalzeit, gerendert in Schnittzeit
  const liste = effekteInSchnittzeit(await ladeEffekte(ordner, schnitt.dauer), schnitt.behalten)
  const laenge = schnitt.behalten.reduce((s, b) => s + b.ende - b.start, 0)
  if (!liste.length) return null
  const klaenge = await sichereKlaenge(hilfe.ffmpeg, join(hilfe.lokal, 'klaenge'))
  const textBilder: VorbereiteteEffekte['textBilder'] = {}
  // Texte der Effekte (Schlüssel „i“) und der Intro-Karten (Schlüssel „i.j“)
  const texte: { schluessel: string; text: string; farbe?: string }[] = []
  liste.forEach((e, i) => {
    if (e.art === 'text') texte.push({ schluessel: String(i), text: e.text, farbe: e.farbe })
    if (e.art === 'intro') e.teile.forEach((t, j) => t.art === 'karte' && texte.push({ schluessel: `${i}.${j}`, text: t.text, farbe: t.farbe ?? '#ffdd33' }))
  })
  if (texte.length) {
    const mc = await sichereMcAssets(daten)
    await mkdir(join(ordner, 'effekte'), { recursive: true })
    for (const { schluessel, text, farbe } of texte) {
      const datei = join(ordner, 'effekte', `text${schluessel}.png`)
      const aus = await new Promise<string>((resolve, reject) =>
        execFile(hilfe.python, [hilfe.textSkript, mc.assets, datei, text.replace(/\n/g, '\\n'), farbe ?? '#ffffff', '8'], { windowsHide: true, timeout: 60_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)))
      )
      const m = /MOIN_TEXTBILD (\d+) (\d+)/.exec(aus)
      if (m) textBilder[schluessel] = { datei, breite: Number(m[1]), hoehe: Number(m[2]) }
    }
  }
  // gleiche Zeitabbildung wie im Graphen (Intro davor, dann Tempo/Standbild)
  const zl = zeitleiste(liste, laenge)
  const intro = liste.find((e): e is Extract<Effekt, { art: 'intro' }> => e.art === 'intro')
  const vorspann = (intro?.teile ?? []).reduce((s, t) => s + introDauer(t), 0)
  return { liste, textBilder, klaenge, endzeit: (t) => vorspann + zl.endzeit(t), laenge: vorspann + zl.laenge }
}
