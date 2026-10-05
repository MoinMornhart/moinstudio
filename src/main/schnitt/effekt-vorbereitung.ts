import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sichereMcAssets } from '../thumbnail/minecraft'
import { effekteInSchnittzeit, introDauer, pruefeEffekte, zeitleiste, type Effekt, type IntroTeil } from './effekte'
import { renderSting, type StingFigur, type StingRender } from '../animation/sting'
import type { Bereich } from './rohschnitt'
import { sichereKlaenge } from './klaenge'
import { liesMitKonfliktkopien } from '../data/jsonfile'
import { bibPfad } from './bibliothek'

/** Was die Aufträge für Effekte brauchen (ROADMAP E.2) */
export interface EffektHilfe {
  ffmpeg: string
  /** Python aus der Vorlagen-Umgebung (Pillow, numpy) für Texte in Minecraft-Schrift */
  python: string
  /** blender/text_bild.py */
  textSkript: string
  /** %LOCALAPPDATA%\MoinStudio (dort liegen die Geräusche) */
  lokal: string
  /** Skin-Sting (M10): Blender und Philips Skin; fehlt, wenn Blender oder der Skin nicht da ist */
  sting?: Omit<StingRender, 'texturen' | 'cache' | 'ffmpeg'> & { figur: StingFigur; samples: number }
}

export interface VorbereiteteEffekte {
  liste: Effekt[]
  textBilder: Record<string, { datei: string; breite: number; hoehe: number }>
  stingVideos: Record<string, string>
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
export async function bereiteEffekteVor(daten: string, ordner: string, schnitt: { dauer: number; behalten: Bereich[] }, hilfe: EffektHilfe, format: { breite: number; hoehe: number; fps: number } = { breite: 1920, hoehe: 1080, fps: 30 }): Promise<VorbereiteteEffekte | null> {
  // gespeichert in Originalzeit, gerendert in Schnittzeit; Bibliotheks-Dateien („bib:<id>/<datei>“) auf diesem Gerät
  // auflösen – fehlt eine Datei (Effekt gelöscht), fällt der Effekt weg statt das Rendern abzubrechen
  const klaenge: Record<string, string> = { ...(await sichereKlaenge(hilfe.ffmpeg, join(hilfe.lokal, 'klaenge'))) }
  const liste = effekteInSchnittzeit(await ladeEffekte(ordner, schnitt.dauer), schnitt.behalten).flatMap((e): Effekt[] => {
    if ((e.art === 'video' || e.art === 'bild') && e.datei.startsWith('bib:')) {
      const pfad = bibPfad(daten, e.datei)
      return pfad ? [{ ...e, datei: pfad }] : []
    }
    if (e.art === 'geraeusch' && e.klang.startsWith('bib:')) {
      const pfad = bibPfad(daten, e.klang)
      if (!pfad) return []
      klaenge[e.klang] = pfad
    }
    return [e]
  })
  const laenge = schnitt.behalten.reduce((s, b) => s + b.ende - b.start, 0)
  if (!liste.length) return null
  const textBilder: VorbereiteteEffekte['textBilder'] = {}
  // Texte der Effekte (Schlüssel „i“) und der Intro-Karten (Schlüssel „i.j“)
  const texte: { schluessel: string; text: string; farbe?: string }[] = []
  liste.forEach((e, i) => {
    if (e.art === 'text') texte.push({ schluessel: String(i), text: e.text, farbe: e.farbe })
    if (e.art === 'intro')
      e.teile.forEach((t, j) => {
        if ((t.art === 'karte' || t.art === 'sting') && t.text) texte.push({ schluessel: `${i}.${j}`, text: t.text, farbe: t.farbe ?? '#ffdd33' })
      })
  })
  // Skin-Stings rendern (oder aus dem Zwischenspeicher); ohne Blender/Skin bleibt nur der Hintergrund mit Kanalname
  const stingVideos: Record<string, string> = {}
  const stings: { schluessel: string; t: Extract<IntroTeil, { art: 'sting' }> }[] = []
  liste.forEach((e, i) => e.art === 'intro' && e.teile.forEach((t, j) => t.art === 'sting' && stings.push({ schluessel: `${i}.${j}`, t })))
  if (stings.length && hilfe.sting) {
    const mc = await sichereMcAssets(daten)
    for (const { schluessel, t } of stings) {
      try {
        stingVideos[schluessel] = await renderSting(t.vorlage ?? 'sprung', hilfe.sting.figur, { dauer: introDauer(t), breite: format.breite, hoehe: format.hoehe, fps: format.fps, samples: hilfe.sting.samples }, { ...hilfe.sting, texturen: mc.textures, ffmpeg: hilfe.ffmpeg, cache: join(hilfe.lokal, 'stings') })
      } catch (err) {
        console.error('Sting', err)
      }
    }
  }
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
  return { liste, textBilder, stingVideos, klaenge, endzeit: (t) => vorspann + zl.endzeit(t), laenge: vorspann + zl.laenge }
}
