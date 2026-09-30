import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { JobContext } from '../jobs/queue'
import { ffmpegMitFortschritt } from './import'
import { aendereProjekt, ladeProjekt, projektOrdner, type Projekt } from './projekt'
import { filterGraph, renderArgs, untertitelAss, zeitAbbildung, zoomsAus, type RenderOptionen } from './render'
import type { Schnittliste } from './rohschnitt'
import { liesAbschnitte } from './transkript'
import { bereiteEffekteVor, type EffektHilfe } from './effekt-vorbereitung'
import { liesMitKonfliktkopien } from '../data/jsonfile'

/**
 * Geschnittene Vorschau (ROADMAP 6.6): der Schnitt mit Untertiteln und Zooms aus dem 540p-Proxy – schnell genug, um
 * das Ergebnis vor dem Export anzusehen. Der Export (6.7) nutzt dieselben Bausteine mit dem Original.
 */

export type UntertitelArt = 'aus' | 'an' | 'karaoke'
export interface SchnittEinstellungen {
  untertitel: UntertitelArt
  zooms: boolean
}
export const STANDARD: SchnittEinstellungen = { untertitel: 'aus', zooms: true }

export const einstellungen = (p: Projekt): SchnittEinstellungen => ({ ...STANDARD, ...(p.einstellungen ?? {}) })

/** Untertitel, Zooms und Render-Optionen für ein Projekt – gemeinsam für Vorschau und Export. */
export async function renderPlan(daten: string, p: Projekt, ziel: { quelle: string; breite: number; hoehe: number; fps: number; encoder: string[]; ausgabe: string; untertitelDatei: string }, hilfe?: EffektHilfe): Promise<RenderOptionen> {
  const ordner = projektOrdner(daten, p.id)
  const liste = JSON.parse(await liesMitKonfliktkopien(join(ordner, 'schnitt.json'))) as Schnittliste
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  const wellen = p.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }) : null
  const e = einstellungen(p)
  // Effekte (ROADMAP E.2): Text-Bilder, Geräusche, neue Zeitleiste
  const eff = hilfe ? await bereiteEffekteVor(daten, ordner, liste, hilfe) : null
  let untertitel: string | null = null
  if (e.untertitel !== 'aus' && abschnitte.length) {
    await writeFile(join(ordner, ziel.untertitelDatei), untertitelAss(abschnitte, liste, { breite: ziel.breite, hoehe: ziel.hoehe, karaoke: e.untertitel === 'karaoke', woerter: e.untertitel === 'karaoke' ? 4 : 7 }, eff?.endzeit))
    untertitel = ziel.untertitelDatei
  }
  return {
    quelle: ziel.quelle,
    liste,
    zooms: e.zooms ? zoomsAus(abschnitte, liste, wellen) : [],
    untertitel,
    breite: ziel.breite,
    hoehe: ziel.hoehe,
    fps: ziel.fps,
    audio: !!p.quelle?.audio,
    encoder: ziel.encoder,
    ausgabe: ziel.ausgabe,
    ...(eff ? { effekte: { liste: eff.liste, textBilder: eff.textBilder, klaenge: eff.klaenge }, endzeit: eff.endzeit, laengeEnde: eff.laenge } : {})
  }
}

export interface VorschauPayload {
  daten: string
  projekt: string
  ffmpeg: string
  /** Effekte (ROADMAP E.2); fehlt bei alten Aufträgen */
  hilfe?: EffektHilfe
}

export async function vorschauJob(p: VorschauPayload, ctx: JobContext<unknown>): Promise<{ projekt: string; laenge: number }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.proxy || !pr.rohschnitt) throw new Error('Erst Import und Rohschnitt abwarten.')
  const ordner = projektOrdner(p.daten, p.projekt)
  const o = await renderPlan(p.daten, pr, {
    quelle: 'proxy.mp4',
    breite: 960,
    hoehe: 540,
    fps: Math.min(30, Math.round(pr.quelle?.fps || 30)),
    encoder: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26'],
    ausgabe: 'vorschau.mp4',
    untertitelDatei: 'vorschau.ass'
  }, p.hilfe)
  await writeFile(join(ordner, 'vorschau-filter.txt'), filterGraph(o))
  const laenge = o.laengeEnde ?? zeitAbbildung(o.liste.behalten).laenge
  await ffmpegMitFortschritt(p.ffmpeg, renderArgs(o, 'vorschau-filter.txt'), ctx, laenge, (a) => ctx.progress(a * 99, `Geschnittene Vorschau … ${Math.round(a * 100)} %`), ordner)
  await aendereProjekt(p.daten, p.projekt, () => ({ vorschau: Date.now() }))
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, laenge }
}
