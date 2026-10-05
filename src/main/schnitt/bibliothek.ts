import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { writeJsonAtomic, liesMitKonfliktkopien } from '../data/jsonfile'
import type { VideoTyp } from './regeln'

/**
 * Effekt-Bibliothek (Philip, 05.10.): eigene Effekte anlegen und benennen – „Abonnieren-Animation“, „Vine-Boom“,
 * „Meme-Einblendung“ … aus Video mit Transparenz, Greenscreen-Video, Bild und/oder Sound. Ablage im Datenordner
 * (<Daten>/effekte/<id>/effekt.json plus Dateien), damit PC und Laptop dieselbe Bibliothek haben. In Projekten stehen
 * nur Verweise „bib:<id>/<datei>“; der Pfad wird erst beim Rendern auf dem jeweiligen Gerät aufgelöst.
 */

export const LAGEN = ['oben-links', 'oben', 'oben-rechts', 'links', 'mitte', 'rechts', 'unten-links', 'unten', 'unten-rechts', 'voll'] as const
export type Lage = (typeof LAGEN)[number]

export interface Chroma {
  /** Key-Farbe als #rrggbb (automatisch erkannt oder per Pipette) */
  farbe: string
  /** 0–1: wie weit Farben um die Key-Farbe mit entfernt werden */
  toleranz: number
  /** 0–1: weiche Kante */
  weichheit: number
  /** 0–1: Grünstich an den Rändern entfernen */
  spill: number
}

export interface BibEffekt {
  id: string
  name: string
  /** Video mit Transparenz (Alpha) oder mit grünem/blauem Hintergrund (dann `chroma`) */
  video?: { datei: string; greenscreen: boolean; ton: boolean; /** Sekunden */ dauer?: number }
  bild?: { datei: string; dauer: number }
  sound?: { datei: string; lautstaerke: number; dauer?: number }
  chroma?: Chroma
  haeufigkeit: { modus: 'immer' | 'manchmal' | 'manuell'; /** jedes n-te Video */ jedes?: number; /** oder Prozent der Videos */ prozent?: number }
  kanaele: string[]
  typen: VideoTyp[]
  platzierung: { modus: 'fest' | 'ki'; /** fester Zeitpunkt: Sekunden ab Start oder vor dem Ende des fertigen Videos */ bezug?: 'start' | 'ende'; sekunden?: number }
  lage: Lage
  /** Anteil der Bildbreite (0,1–1; 1 = ganzes Bild) */
  groesse: number
  erstellt: string
  /** wie oft der Effekt automatisch eingesetzt wurde (für „jedes n-te Video“) */
  zaehler?: number
  /** Projekte, für die schon entschieden wurde (für „jedes n-te Video“, neu verteilen zählt nicht doppelt) */
  gesehen?: string[]
}

export const STANDARD_CHROMA: Chroma = { farbe: '#00ff00', toleranz: 0.3, weichheit: 0.1, spill: 0.5 }

export const bibOrdner = (daten: string): string => join(daten, 'effekte')
const effektOrdner = (daten: string, id: string): string => join(bibOrdner(daten), id)

const klemme = (x: unknown, a: number, b: number, std: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : std)

/** Eingaben aus der Oberfläche prüfen und mit Standardwerten auffüllen */
export function pruefeBibEffekt(roh: Partial<BibEffekt>, alt?: BibEffekt): BibEffekt {
  const b = { ...alt, ...roh } as Partial<BibEffekt>
  const name = String(b.name ?? '').trim().slice(0, 60)
  if (!name) throw new Error('Bitte gib dem Effekt einen Namen.')
  const modus = b.haeufigkeit?.modus && ['immer', 'manchmal', 'manuell'].includes(b.haeufigkeit.modus) ? b.haeufigkeit.modus : 'manuell'
  const kanaele = (b.kanaele ?? []).filter((k) => k === 'MoinMornhart' || k === 'MoinMorni')
  const typen = (b.typen ?? []).filter((t): t is VideoTyp => t === 'reaction' || t === 'gaming')
  const platz = b.platzierung?.modus === 'fest' ? 'fest' : 'ki'
  return {
    id: alt?.id ?? b.id ?? randomUUID().slice(0, 8),
    name,
    ...(b.video ? { video: { datei: b.video.datei, greenscreen: !!b.video.greenscreen, ton: !!b.video.ton, ...(b.video.dauer ? { dauer: klemme(b.video.dauer, 0.1, 600, 3) } : {}) } } : {}),
    ...(b.bild ? { bild: { datei: b.bild.datei, dauer: klemme(b.bild.dauer, 0.3, 30, 2) } } : {}),
    ...(b.sound ? { sound: { datei: b.sound.datei, lautstaerke: klemme(b.sound.lautstaerke, 0, 2, 1), ...(b.sound.dauer ? { dauer: klemme(b.sound.dauer, 0.1, 600, 1) } : {}) } } : {}),
    ...(b.video?.greenscreen ? { chroma: { farbe: /^#[0-9a-f]{6}$/i.test(b.chroma?.farbe ?? '') ? b.chroma!.farbe : STANDARD_CHROMA.farbe, toleranz: klemme(b.chroma?.toleranz, 0, 1, STANDARD_CHROMA.toleranz), weichheit: klemme(b.chroma?.weichheit, 0, 1, STANDARD_CHROMA.weichheit), spill: klemme(b.chroma?.spill, 0, 1, STANDARD_CHROMA.spill) } } : {}),
    haeufigkeit: { modus, ...(modus === 'manchmal' ? (b.haeufigkeit?.prozent ? { prozent: klemme(b.haeufigkeit.prozent, 1, 100, 50) } : { jedes: Math.round(klemme(b.haeufigkeit?.jedes, 2, 50, 3)) }) : {}) },
    kanaele: kanaele.length ? kanaele : ['MoinMornhart', 'MoinMorni'],
    typen: typen.length ? typen : ['reaction', 'gaming'],
    platzierung: platz === 'fest' ? { modus: 'fest', bezug: b.platzierung?.bezug === 'ende' ? 'ende' : 'start', sekunden: klemme(b.platzierung?.sekunden, 0, 36000, 30) } : { modus: 'ki' },
    lage: (LAGEN as readonly string[]).includes(b.lage ?? '') ? b.lage! : 'unten-rechts',
    groesse: klemme(b.groesse, 0.1, 1, 0.35),
    erstellt: alt?.erstellt ?? b.erstellt ?? new Date().toISOString(),
    ...(alt?.zaehler !== undefined ? { zaehler: alt.zaehler } : {}),
    ...(alt?.gesehen ? { gesehen: alt.gesehen } : {})
  }
}

export async function ladeBibliothek(daten: string): Promise<BibEffekt[]> {
  const ids = await readdir(bibOrdner(daten)).catch(() => [] as string[])
  const liste: BibEffekt[] = []
  for (const id of ids) {
    try {
      liste.push(JSON.parse(await liesMitKonfliktkopien(join(effektOrdner(daten, id), 'effekt.json'))) as BibEffekt)
    } catch {
      // halb angelegter oder fremder Ordner
    }
  }
  return liste.sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

export async function ladeBibEffekt(daten: string, id: string): Promise<BibEffekt | null> {
  return JSON.parse(await liesMitKonfliktkopien(join(effektOrdner(daten, id), 'effekt.json')).catch(() => 'null')) as BibEffekt | null
}

export async function speichereBibEffekt(daten: string, roh: Partial<BibEffekt>): Promise<BibEffekt> {
  const alt = roh.id ? await ladeBibEffekt(daten, roh.id) : null
  const e = pruefeBibEffekt(roh, alt ?? undefined)
  if (!e.video && !e.bild && !e.sound) throw new Error('Bitte lade mindestens eine Datei hoch (Video, Bild oder Sound).')
  await mkdir(effektOrdner(daten, e.id), { recursive: true })
  await writeJsonAtomic(join(effektOrdner(daten, e.id), 'effekt.json'), e)
  return e
}

export async function loescheBibEffekt(daten: string, id: string): Promise<void> {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Ungültige ID.')
  await rm(effektOrdner(daten, id), { recursive: true, force: true })
}

/** Datei in den Effekt-Ordner kopieren; gibt den Dateinamen im Ordner zurück (für `video.datei` usw.). */
export async function dateiInBibliothek(daten: string, id: string, rolle: 'video' | 'bild' | 'sound', quelle: string): Promise<string> {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Ungültige ID.')
  const name = `${rolle}${extname(quelle).toLowerCase() || '.bin'}`
  await mkdir(effektOrdner(daten, id), { recursive: true })
  for (const f of await readdir(effektOrdner(daten, id)).catch(() => [] as string[])) if (f.startsWith(`${rolle}.`) && f !== name) await rm(join(effektOrdner(daten, id), f), { force: true })
  await copyFile(quelle, join(effektOrdner(daten, id), name))
  return name
}

/** Verweis in Projekten → Pfad auf diesem Gerät */
export const bibVerweis = (id: string, datei: string): string => `bib:${id}/${datei}`
export function bibPfad(daten: string, verweis: string): string | null {
  const m = /^bib:([a-z0-9-]+)\/([\w.-]+)$/i.exec(verweis)
  if (!m) return null
  const p = join(effektOrdner(daten, m[1]!), m[2]!)
  return existsSync(p) ? p : null
}
export const dateiPfad = (daten: string, e: BibEffekt, datei: string): string => join(effektOrdner(daten, e.id), datei)
