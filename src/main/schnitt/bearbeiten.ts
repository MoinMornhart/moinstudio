import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { ladeProjekt, projektOrdner } from './projekt'
import { schnittliste, type Entfernt, type Schnittliste } from './rohschnitt'
import { liesAbschnitte } from './transkript'

/**
 * Schnitt prüfen und ändern (ROADMAP 6.5): Schnittstellen an/aus, Sätze raus oder zurück, Änderungswunsch in Worten.
 * Ausgeschaltete Stellen bleiben in der Liste (aus = true), damit man sie jederzeit wieder einschalten kann.
 */

/** Behalten-Bereiche aus den aktiven (nicht ausgeschalteten) Schnitten neu berechnen. */
export function neuBerechnen(liste: Schnittliste): Schnittliste {
  const aktiv = liste.entfernt.filter((e) => !e.aus)
  return { ...schnittliste(liste.dauer, aktiv), entfernt: [...liste.entfernt].sort((a, b) => a.start - b.start) }
}

/** Eine Schnittstelle an- oder ausschalten. */
export function umschalten(liste: Schnittliste, index: number): Schnittliste {
  const entfernt = liste.entfernt.map((e, i) => (i === index ? { ...e, aus: !e.aus } : e))
  return neuBerechnen({ ...liste, entfernt })
}

/**
 * Bereich rausnehmen (raus = true) oder zurückholen (raus = false). Zurückholen schaltet alle Schnitte im Bereich aus;
 * ragt ein von Hand gesetzter Schnitt nur teilweise hinein, wird er gekürzt.
 */
export function bereichSetzen(liste: Schnittliste, start: number, ende: number, raus: boolean, text?: string): Schnittliste {
  const a = Math.max(0, Math.min(start, ende))
  const b = Math.min(liste.dauer, Math.max(start, ende))
  if (b - a < 0.05) return liste
  let entfernt: Entfernt[]
  if (raus) {
    entfernt = [...liste.entfernt, { start: a, ende: b, grund: 'manuell', ...(text ? { text } : {}) }]
  } else {
    entfernt = liste.entfernt.flatMap((e): Entfernt[] => {
      if (e.aus || e.ende <= a || e.start >= b) return [e]
      if (e.grund === 'manuell' && (e.start < a || e.ende > b)) {
        const teile: Entfernt[] = []
        if (e.start < a) teile.push({ ...e, ende: a })
        if (e.ende > b) teile.push({ ...e, start: b })
        return teile
      }
      return [{ ...e, aus: true }]
    })
  }
  return neuBerechnen({ ...liste, entfernt })
}

export interface WunschPayload {
  daten: string
  projekt: string
  wunsch: string
  claudeCli: string
}

const SCHEMA = {
  type: 'object',
  required: ['schritte'],
  properties: {
    schritte: {
      type: 'array',
      items: { type: 'object', required: ['art', 'von', 'bis'], properties: { art: { type: 'string', enum: ['entfernen', 'zurueck'] }, von: { type: 'number' }, bis: { type: 'number' }, warum: { type: 'string' } } }
    },
    antwort: { type: 'string' }
  }
} as const

export function wunschPrompt(wunsch: string, liste: Schnittliste, saetze: { start: number; ende: number; text: string }[]): string {
  const t = (s: number): string => s.toFixed(2)
  return `Philip schneidet ein Video. Sein Wunsch: „${wunsch}“

Transkript (Zeit im Original in Sekunden):
${saetze.map((s) => `[${t(s.start)}–${t(s.ende)}] ${s.text}`).join('\n')}

Gerade entfernte Stellen (Grund, Zeit, ggf. Text):
${liste.entfernt.filter((e) => !e.aus).map((e) => `- ${e.grund} [${t(e.start)}–${t(e.ende)}]${e.text ? ` ${e.text}` : ''}`).join('\n') || '- keine'}

Setze den Wunsch in Schritte um: „entfernen“ nimmt [von, bis] raus, „zurueck“ holt [von, bis] wieder rein.
Zeiten immer im Original (nicht im geschnittenen Video). Nur ändern, was der Wunsch verlangt.
Antworte nur mit JSON nach dem Schema; in „antwort“ ein kurzer deutscher Satz, was du geändert hast.`
}

export async function wunschJob(p: WunschPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ projekt: string; antwort: string }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr) throw new Error('Projekt nicht gefunden.')
  const ordner = projektOrdner(p.daten, p.projekt)
  let liste = JSON.parse(await readFile(join(ordner, 'schnitt.json'), 'utf8')) as Schnittliste
  const saetze = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  ctx.progress(10, 'Claude setzt deinen Wunsch um …')
  const res = await runClaudeInJob({ cli: p.claudeCli, prompt: wunschPrompt(p.wunsch, liste, saetze), workDir: join(p.daten, 'claude-work', 'schnitt'), tools: [], maxTurns: 2, jsonSchema: SCHEMA }, ctx)
  if (!res.ok) throw new Error(`Claude konnte den Wunsch nicht umsetzen: ${res.errors.join(' | ') || res.subtype}`)
  const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { schritte?: { art: 'entfernen' | 'zurueck'; von: number; bis: number; warum?: string }[]; antwort?: string }
  for (const s of a.schritte ?? []) liste = bereichSetzen(liste, s.von, s.bis, s.art === 'entfernen', s.warum)
  await writeFile(join(ordner, 'schnitt.json'), JSON.stringify(liste, null, 1))
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, antwort: a.antwort ?? 'Erledigt.' }
}
