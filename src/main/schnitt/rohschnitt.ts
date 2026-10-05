import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { aendereProjekt, ladeProjekt, projektOrdner } from './projekt'
import { liesAbschnitte, type Abschnitt } from './transkript'
import { regelText, typName, type VideoTyp } from './regeln'

/**
 * Automatischer Rohschnitt (ROADMAP 6.4). Ergebnis ist eine Schnittliste (EDL-JSON) in schnitt.json: welche Bereiche
 * des Originals bleiben und was mit welchem Grund rausfliegt. Das Original wird nie verändert.
 *
 * 1. Feste Regeln aus den Wortzeiten: lange Pausen kürzen – aber nur, wo auch das Spiel leise ist (stille Action
 *    bleibt drin), einzelne „ähm“/„äh“ raus, abgebrochener Satz vor seiner Wiederholung raus.
 * 2. Claude liest das Transkript und markiert Versprecher, Leerlauf und Wiederholungen, die Regeln nicht finden.
 */

export type Grund = 'pause' | 'aehm' | 'wiederholung' | 'versprecher' | 'leerlauf' | 'manuell'
export interface Bereich {
  start: number
  ende: number
}
export interface Entfernt extends Bereich {
  grund: Grund
  text?: string
  /** von Philip ausgeschaltet: bleibt im Video (ROADMAP 6.5) */
  aus?: boolean
}
export interface Schnittliste {
  version: 1
  dauer: number
  behalten: Bereich[]
  entfernt: Entfernt[]
}

export const EINSTELLUNGEN = {
  /** Pausen bis zu dieser Länge bleiben ganz */
  maxPause: 0.8,
  /** so viel Luft bleibt vor dem ersten und nach dem letzten Wort eines Redeblocks */
  vorlauf: 0.15,
  nachlauf: 0.3,
  /** Action nur, wenn die Pause lauter ist als dieser Anteil der Sprach-Lautstärke (und deutlich lauter als andere Pausen) */
  leiseAnteil: 0.35,
  /** kürzere Bereiche lohnen keinen Schnitt */
  minEntfernen: 0.35
}

/** Pausen-Schnitt je Typ (Recherche 05.10.): kürzere Pausen und knapperer Puffer als früher (0,8 s / 0,15 s / 0,3 s) */
export function schnittEinstellungen(typ: VideoTyp | undefined): typeof EINSTELLUNGEN {
  if (typ === 'reaction') return { ...EINSTELLUNGEN, maxPause: 0.5, vorlauf: 0.1, nachlauf: 0.15 }
  if (typ === 'gaming') return { ...EINSTELLUNGEN, maxPause: 0.6, vorlauf: 0.1, nachlauf: 0.15 }
  return EINSTELLUNGEN
}

const FUELLWOERTER =/^(ähm+|äh+|öhm+|ehm+|hm+|mhm)[.,!?…]*$/i

const normal = (t: string): string => t.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, '').replace(/\s+/g, ' ').trim()

/** Bereiche zusammenfassen und sortieren. */
export function vereinige<T extends Bereich>(liste: T[]): T[] {
  const s = [...liste].sort((a, b) => a.start - b.start)
  const aus: T[] = []
  for (const b of s) {
    const letzter = aus[aus.length - 1]
    if (letzter && b.start <= letzter.ende + 0.01) letzter.ende = Math.max(letzter.ende, b.ende)
    else aus.push({ ...b })
  }
  return aus
}

/** Mittlere Lautstärke (0–100) der Wellenform in [a, b]. */
function laut(wellen: { aufloesung: number; werte: number[] } | null, a: number, b: number): number {
  if (!wellen) return 0
  const i = Math.floor(a / wellen.aufloesung)
  const j = Math.max(i + 1, Math.ceil(b / wellen.aufloesung))
  const teil = wellen.werte.slice(i, j)
  return teil.length ? teil.reduce((x, y) => x + y, 0) / teil.length : 0
}

/** Feste Regeln: Pausen, Füllwörter, abgebrochene Sätze vor ihrer Wiederholung. */
export function regelSchnitt(abschnitte: Abschnitt[], dauer: number, wellen: { aufloesung: number; werte: number[] } | null = null, e = EINSTELLUNGEN): Entfernt[] {
  const woerter = abschnitte.flatMap((a) => a.woerter).sort((a, b) => a.start - b.start)
  const entfernt: Entfernt[] = []
  const pausen: Bereich[] = []
  const pause = (a: number, b: number): void => {
    const start = a + e.nachlauf
    const ende = b - e.vorlauf
    if (ende - start >= e.minEntfernen) pausen.push({ start, ende })
  }
  if (woerter.length) {
    if (woerter[0]!.start > e.maxPause) pause(-e.nachlauf, woerter[0]!.start)
    for (let i = 1; i < woerter.length; i++) if (woerter[i]!.start - woerter[i - 1]!.ende > e.maxPause) pause(woerter[i - 1]!.ende, woerter[i]!.start)
    if (dauer - woerter[woerter.length - 1]!.ende > e.maxPause) pause(woerter[woerter.length - 1]!.ende, dauer + e.vorlauf)
  }
  // Action statt Pause: deutlich lauter als die übrigen Pausen (Kampf, Explosion) und nicht bloß Hintergrundmusik –
  // solche Stellen bleiben drin. Gleichmäßige Spielmusik zählt nicht als Action.
  const sprache = woerter.length ? woerter.reduce((s, w) => s + laut(wellen, w.start, w.ende), 0) / woerter.length : 0
  const pegel = pausen.map((x) => laut(wellen, x.start, x.ende))
  const median = [...pegel].sort((a, b) => a - b)[Math.floor(pegel.length / 2)] ?? 0
  pausen.forEach((x, i) => {
    const action = !!wellen && pegel[i]! > Math.max(1.6 * median, e.leiseAnteil * sprache) && pegel[i]! > 8
    if (!action) entfernt.push({ ...x, grund: 'pause' })
  })
  for (const w of woerter) if (FUELLWOERTER.test(w.wort.trim())) entfernt.push({ start: w.start - 0.03, ende: w.ende + 0.05, grund: 'aehm', text: w.wort })
  // abgebrochener Satz, den der nächste Satz wiederholt („Ich geh jetzt in die. Ich geh jetzt in die Höhle rein.“)
  // Erkannt, wenn das Ende des Satzes (mind. 3 Wörter) genau der Anfang des nächsten Satzes ist
  for (let i = 0; i + 1 < abschnitte.length; i++) {
    const a = normal(abschnitte[i]!.text).split(' ')
    const b = normal(abschnitte[i + 1]!.text).split(' ')
    const wiederholt = a.length >= 3 && b.length > 3 && [...Array(Math.min(a.length, b.length - 1) - 2).keys()].some((j) => {
      const k = Math.min(a.length, b.length - 1) - j
      return a.slice(-k).join(' ') === b.slice(0, k).join(' ')
    })
    if (wiederholt) entfernt.push({ start: abschnitte[i]!.start - 0.05, ende: abschnitte[i + 1]!.start - 0.05, grund: 'wiederholung', text: abschnitte[i]!.text })
  }
  return entfernt.map((x) => ({ ...x, start: Math.max(0, x.start), ende: Math.min(dauer, x.ende) })).filter((x) => x.ende - x.start >= 0.05)
}

/** Aus entfernten Bereichen die Schnittliste bauen (behalten = Rest, sehr kurze Reste fallen weg). */
export function schnittliste(dauer: number, entfernt: Entfernt[]): Schnittliste {
  const weg = vereinige(entfernt.map((x) => ({ start: x.start, ende: x.ende })))
  const behalten: Bereich[] = []
  let t = 0
  for (const w of weg) {
    if (w.start - t >= 0.2) behalten.push({ start: t, ende: w.start })
    t = Math.max(t, w.ende)
  }
  if (dauer - t >= 0.2) behalten.push({ start: t, ende: dauer })
  return { version: 1, dauer, behalten, entfernt: [...entfernt].sort((a, b) => a.start - b.start) }
}

export const laenge = (behalten: Bereich[]): number => behalten.reduce((s, b) => s + (b.ende - b.start), 0)

const SCHEMA = {
  type: 'object',
  required: ['entfernen'],
  properties: {
    entfernen: {
      type: 'array',
      items: { type: 'object', required: ['nr', 'grund'], properties: { nr: { type: 'integer' }, grund: { type: 'string', enum: ['versprecher', 'wiederholung', 'leerlauf'] } } }
    }
  }
} as const

export function claudePrompt(abschnitte: Abschnitt[], kanal: string, typ?: VideoTyp): string {
  const zeilen = abschnitte.map((a, i) => `${i} [${a.start.toFixed(1)}–${a.ende.toFixed(1)}] ${a.text}`).join('\n')
  return `Du schneidest ein YouTube-Video von Philip (Kanal ${kanal}, deutsch, Videotyp ${typName(typ)}). So schneiden
erfolgreiche Creator diesen Typ – beachte vor allem, was rausfliegt:
${regelText(typ)}

Unten steht das Transkript,
ein Satz pro Zeile mit Nummer und Zeit. Markiere NUR Sätze, die im fertigen Video stören:
- versprecher: abgebrochener oder verhaspelter Satz, der gleich danach richtig gesagt wird
- wiederholung: derselbe Inhalt wird kurz danach noch einmal gesagt (die schwächere Fassung entfernen)
- leerlauf: inhaltsleeres Gemurmel ohne Bezug zum Geschehen (z. B. „mal schauen … hm … ja“), auch Stream-Leerlauf
  wie Chat vorlesen ohne Pointe, Warten, Laden, Werbung, „ich schau mir das jetzt an“
Nicht entfernen: Reaktionen („Oh nein!“, „Puh“, Lachen), Witze, Begrüßung, Verabschiedung, Abo-Hinweise –
die machen das Video lebendig. Im Zweifel drin lassen. Antworte nur mit JSON nach dem Schema.

${zeilen}`
}

export interface RohschnittPayload {
  daten: string
  projekt: string
  claudeCli: string | null
}

export async function rohschnittJob(p: RohschnittPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ projekt: string; vorher: number; nachher: number }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.quelle?.dauer) throw new Error('Das Video ist noch nicht importiert.')
  const ordner = projektOrdner(p.daten, p.projekt)
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  const wellen = pr.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }) : null
  ctx.progress(10, 'Pausen und „ähm“ finden …')
  const entfernt = regelSchnitt(abschnitte, pr.quelle.dauer, wellen, schnittEinstellungen(pr.typ))

  // Claude liest das Transkript (in Blöcken, damit auch Stunden-Streams passen); ohne Claude bleibt es beim Regelschnitt
  if (p.claudeCli && abschnitte.length) {
    const block = 400
    for (let i = 0; i < abschnitte.length; i += block) {
      await ctx.yield()
      ctx.progress(20 + (i / abschnitte.length) * 70, 'Claude liest das Transkript …')
      const teil = abschnitte.slice(i, i + block)
      const res = await runClaudeInJob(
        { cli: p.claudeCli, prompt: claudePrompt(teil, pr.kanal, pr.typ), workDir: join(p.daten, 'claude-work', 'schnitt'), tools: [], maxTurns: 2, jsonSchema: SCHEMA },
        ctx
      )
      if (!res.ok) continue
      const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { entfernen?: { nr: number; grund: Grund }[] }
      for (const x of a.entfernen ?? []) {
        const s = teil[x.nr]
        if (!s || entfernt.some((e) => e.grund !== 'pause' && e.grund !== 'aehm' && Math.abs(e.start - (s.start - 0.05)) < 0.2)) continue
        entfernt.push({ start: Math.max(0, s.start - 0.05), ende: Math.min(pr.quelle.dauer, s.ende + 0.1), grund: x.grund, text: s.text })
      }
    }
  }
  const liste = schnittliste(pr.quelle.dauer, entfernt)
  await writeFile(join(ordner, 'schnitt.json'), JSON.stringify(liste, null, 1))
  await aendereProjekt(p.daten, p.projekt, () => ({ rohschnitt: true }))
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, vorher: pr.quelle.dauer, nachher: Math.round(laenge(liste.behalten) * 10) / 10 }
}
