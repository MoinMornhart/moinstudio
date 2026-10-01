import { relative } from 'node:path'
import type { JobInfo } from '@shared/jobs'
import type { JobQueue } from '../jobs/queue'
import type { ExportErgebnis } from '../schnitt/export'
import { kapitelText } from '../schnitt/export'
import type { ThumbnailVariante } from '../thumbnail/job'
import { ladeProjekt, type Projekt } from '../schnitt/projekt'
import { aendereKarte, KANAELE, ladeKarten, neueKarte, type Kanal, type Karte, type KartenAenderung, type Spalte } from './karten'

/**
 * Planung ↔ Thumbnail und Schnitt (ROADMAP 7.5): Karten rücken von selbst weiter, sobald im Schnitt oder beim Thumbnail
 * etwas fertig wird, und übernehmen Titel, Beschreibung und Kapitel aus dem Export.
 */

export type Ereignis = 'import' | 'export' | 'thumbnail-gewaehlt'

const REIHE: Spalte[] = ['idee', 'aufnahme', 'schnitt', 'thumbnail', 'upload', 'veroeffentlicht']
const vor = (a: Spalte, b: Spalte): boolean => REIHE.indexOf(a) < REIHE.indexOf(b)

/** Wohin rückt eine Karte nach einem Ereignis? Nie zurück, nie über „Upload“ hinaus (hochladen macht Philip selbst). */
export function naechsteSpalte(karte: Pick<Karte, 'spalte' | 'thumbnail'>, ereignis: Ereignis, exportiert = false): Spalte {
  const ziel: Spalte =
    ereignis === 'import' ? 'schnitt' : ereignis === 'export' ? (karte.thumbnail?.gewaehlt ? 'upload' : 'thumbnail') : exportiert ? 'upload' : 'thumbnail'
  return vor(karte.spalte, ziel) ? ziel : karte.spalte
}

const FUELLWOERTER = new Set(['der', 'die', 'das', 'und', 'oder', 'ich', 'in', 'im', 'mit', 'mein', 'meine', 'ein', 'eine', 'aber', 'the', 'a', 'of', 'mp4', 'mov', 'mkv', 'final', 'video', 'aufnahme', 'folge'])

/** Lesbarer Titel aus einem Projekt- oder Dateinamen: ohne Endung, Datum, Uhrzeit, Unterstriche („2026-10-01_minecraft_aber_jedes_level.mp4“ → „Minecraft aber jedes Level“). */
export function titelAusName(name: string): string {
  const t = name
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/(?<!\d)\d{4}[-_.]\d{2}[-_.]\d{2}(?!\d)/g, ' ')
    .replace(/(?<!\d)\d{1,2}[-_.:]\d{2}([-_.:]\d{2})?(?!\d)/g, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t ? t[0]!.toUpperCase() + t.slice(1) : name
}

function woerter(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 1 && !FUELLWOERTER.has(w))
  )
}

/** Welche Karte gehört zu einem Video im Schnitt? Gleicher Kanal, noch nicht verknüpft, noch nicht hochgeladen, und der
 *  Titel passt (Wortüberschneidung ≥ 50 % der kürzeren Seite). Bei mehreren gewinnt die beste. */
export function passendeKarte(karten: Karte[], projekt: Pick<Projekt, 'name' | 'kanal'> & { youtubeTitel?: string }): Karte | null {
  const pw = woerter(`${projekt.youtubeTitel ?? ''} ${titelAusName(projekt.name)}`)
  if (!pw.size) return null
  let beste: { k: Karte; wert: number } | null = null
  for (const k of karten) {
    if (k.schnitt || k.kanal !== projekt.kanal || !vor(k.spalte, 'upload')) continue
    const kw = woerter(k.titel)
    if (!kw.size) continue
    const gemeinsam = [...kw].filter((w) => pw.has(w)).length
    const wert = gemeinsam / Math.min(kw.size, pw.size)
    if (wert >= 0.5 && (!beste || wert > beste.wert)) beste = { k, wert }
  }
  return beste?.k ?? null
}

/** Video im Schnitt ohne Karte (Philip, 01.10.: „automatisch erkennen, wenn ein Format gerade im Schnitt ist, und es
 *  gleich bei Planung haben“): passende Karte verknüpfen oder eine neue in der Spalte „Schnitt“ anlegen. */
export async function videoInPlanung(daten: string, projektId: string): Promise<Karte | null> {
  const karten = await ladeKarten(daten)
  const schon = karten.find((k) => k.schnitt === projektId)
  if (schon) return schon
  const projekt = await ladeProjekt(daten, projektId)
  if (!projekt) return null
  const kanal: Kanal = (KANAELE as readonly string[]).includes(projekt.kanal) ? (projekt.kanal as Kanal) : 'MoinMornhart'
  const passend = passendeKarte(karten, { ...projekt, kanal })
  if (passend) return aendereKarte(daten, passend.id, { schnitt: projektId, spalte: naechsteSpalte(passend, 'import') })
  return neueKarte(daten, {
    kanal,
    titel: projekt.youtubeTitel || titelAusName(projekt.name),
    spalte: 'schnitt',
    schnitt: projektId,
    notizen: 'Automatisch angelegt, weil das Video in den Schnitt kam.'
  })
}

/** Beobachtet die Aufgabenliste und aktualisiert verknüpfte Karten, wenn Import, Export oder Thumbnail fertig sind. */
export function verbindePlanung(queue: JobQueue, daten: () => Promise<string>, geaendert: () => void): void {
  // Aufgaben, die schon vor dem Start fertig waren, nicht noch einmal auswerten
  const gesehen = new Set(queue.state().jobs.filter((j) => j.state === 'done').map((j) => j.id))
  const bearbeite = async (j: JobInfo): Promise<void> => {
    const d = await daten()
    const karten = await ladeKarten(d)
    if (j.kind === 'schnitt-import' || j.kind === 'schnitt-export') {
      const projekt = queue.payload<{ projekt: string }>(j.id)?.projekt
      const karte = karten.find((k) => k.schnitt && k.schnitt === projekt)
      if (!karte) {
        // noch keine Karte: passende verknüpfen oder neue anlegen
        if (projekt && (await videoInPlanung(d, projekt))) geaendert()
        return
      }
      if (j.kind === 'schnitt-import') {
        await aendereKarte(d, karte.id, { spalte: naechsteSpalte(karte, 'import') })
      } else {
        const e = queue.result<ExportErgebnis>(j.id)
        const aenderung: KartenAenderung = { spalte: naechsteSpalte(karte, 'export') }
        if (e) aenderung.youtube = { titel: e.titel[0] ?? karte.titel, beschreibung: e.beschreibung, kapitel: kapitelText(e.kapitel) }
        await aendereKarte(d, karte.id, aenderung)
      }
    } else if (j.kind === 'thumbnail') {
      const karte = karten.find((k) => k.thumbnail?.auftrag === j.id)
      const bild = queue.result<{ varianten: ThumbnailVariante[] }>(j.id)?.varianten.find((v) => v.bild)?.bild
      // Das erste Bild dient als Vorschau; weiter rückt die Karte erst, wenn Philip eine Variante wählt
      if (karte?.thumbnail && !karte.thumbnail.bild && bild) await aendereKarte(d, karte.id, { thumbnail: { ...karte.thumbnail, bild: relative(d, bild).replace(/\\/g, '/') } })
    } else {
      return
    }
    geaendert()
  }
  queue.on('change', (state: { jobs: JobInfo[] }) => {
    for (const j of state.jobs) {
      if (j.state !== 'done' || gesehen.has(j.id)) continue
      gesehen.add(j.id)
      if (['schnitt-import', 'schnitt-export', 'thumbnail'].includes(j.kind)) void bearbeite(j).catch(() => undefined)
    }
  })
}
