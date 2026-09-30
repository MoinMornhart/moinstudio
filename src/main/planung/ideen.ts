import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { luecken, plusTage, rhythmusAus, tagVon, WOCHENTAGE_KURZ, wochentag, type Rhythmus } from '@shared/kalender'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { liesAbschnitte } from '../schnitt/transkript'
import { ladeKarten, type Karte } from './karten'
import { ladeProjekt } from '../schnitt/projekt'

/**
 * Planung mit Claude (ROADMAP 7.6): Ideenfinder je Kanal, Titelvorschläge für eine Karte, Wochenplan.
 * Läuft als Auftrag über das Claude-Abo (kein API-Schlüssel), ohne Werkzeuge, mit festem JSON-Schema.
 */

export type PlanungClaudeArt = 'ideen' | 'titel' | 'woche'

export interface PlanungClaudePayload {
  art: PlanungClaudeArt
  daten: string
  claudeCli: string
  configDir: string
  kanal: string
  /** Wunsch in Worten, z. B. „Ideen mit SimPell“ (nur ideen) */
  wunsch?: string
  /** Karte (nur titel) */
  karte?: string
  /** Schnitt-Projekt (nur titel): Namensvorschläge fürs fertige Video statt für eine Karte */
  projekt?: string
  /** Heute als „2026-09-29“ (für Tests fest vorgebbar) */
  heute?: string
  /** Nur für Tests: Skript vor den Claude-Argumenten (Attrappe der CLI) */
  claudePrefix?: string[]
}

export interface Idee {
  titel: string
  idee: string
  warum: string
}
export interface TitelVorschlag {
  titel: string
  warum: string
}
export interface WochenPlan {
  plan: { karte: string; termin: string; grund: string }[]
  aufnehmen: { karte: string; grund: string }[]
  hinweis: string
}
export type PlanungClaudeErgebnis = { art: 'ideen'; ideen: Idee[] } | { art: 'titel'; titel: TitelVorschlag[] } | { art: 'woche'; woche: WochenPlan }

export const KANAL_BESCHREIBUNG: Record<string, string> = {
  MoinMornhart:
    'Minecraft-Kanal von Philip (deutsch). Let’s Plays, Challenges, Survival-Projekte, Kämpfe und Streiche mit Freunden. Maßstab sind große deutsche Minecraft-Kanäle wie BastiGHG, GommeHD, Paluten und Castcrafter: klare Aufhänger, Action, Spannung, echte Minecraft-Mobs und -Orte.',
  MoinMorni:
    'Zweitkanal von Philip (deutsch) für Stream-Highlights, Reactions (alle Themen) und Gaming (alle Spiele, auch Minecraft, oft mit Freunden, z. B. Chained Together). Vorbilder sind die Zweit- und Drittkanäle großer Streamer: ehrliche Reaktionen, lustige Momente, bekannte Spiele.'
}

/** Was auf den jeweiligen Kanal gehört – damit sich Haupt- und Zweitkanal nicht überschneiden */
export const KANAL_REGELN: Record<string, string> = {
  MoinMornhart: '- Nur Minecraft. Reactions und andere Spiele gehören auf MoinMorni.',
  MoinMorni:
    '- Mischung wie bei einem Streamer-Zweitkanal: mindestens 4 Ideen sind Reactions (auf Videos, Trends, Clips, Community-Einsendungen …), mindestens 3 sind Stream-Highlights oder andere Spiele als Minecraft (z. B. Koop-Spiele mit Freunden, Horror-Spiele, neue Releases), höchstens 2 sind Minecraft.\n- Keine Minecraft-Challenges, die genauso auf den Hauptkanal MoinMornhart passen würden.'
}

const SCHEMAS: Record<PlanungClaudeArt, object> = {
  ideen: {
    type: 'object',
    required: ['ideen'],
    properties: { ideen: { type: 'array', items: { type: 'object', required: ['titel', 'idee', 'warum'], properties: { titel: { type: 'string' }, idee: { type: 'string' }, warum: { type: 'string' } } } } }
  },
  titel: {
    type: 'object',
    required: ['titel'],
    properties: { titel: { type: 'array', items: { type: 'object', required: ['titel', 'warum'], properties: { titel: { type: 'string' }, warum: { type: 'string' } } } } }
  },
  woche: {
    type: 'object',
    required: ['plan', 'aufnehmen', 'hinweis'],
    properties: {
      plan: { type: 'array', items: { type: 'object', required: ['karte', 'termin', 'grund'], properties: { karte: { type: 'string' }, termin: { type: 'string' }, grund: { type: 'string' } } } },
      aufnehmen: { type: 'array', items: { type: 'object', required: ['karte', 'grund'], properties: { karte: { type: 'string' }, grund: { type: 'string' } } } },
      hinweis: { type: 'string' }
    }
  }
}

const STAND: Record<string, string> = { idee: 'Idee', aufnahme: 'Aufnahme', schnitt: 'Schnitt', thumbnail: 'Thumbnail', upload: 'Upload', veroeffentlicht: 'veröffentlicht' }

/** Wörter eines Titels ohne Füllwörter, klein, ohne Satzzeichen */
function woerter(titel: string): Set<string> {
  const weg = new Set(['ich', 'in', 'im', 'mit', 'und', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'mich', 'mein', 'meine', 'aber', 'minecraft', 'auf', 'von', 'zu', 'für', 'ist', 'wird', 'alle', 'jeder'])
  return new Set(
    titel
      .toLowerCase()
      .replace(/[^a-zäöüß0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !weg.has(w))
  )
}

/** Ähnlichkeit zweier Titel (Anteil gemeinsamer Wörter, 0–1) */
export function aehnlichkeit(a: string, b: string): number {
  const x = woerter(a)
  const y = woerter(b)
  if (!x.size || !y.size) return 0
  let gemeinsam = 0
  for (const w of x) if (y.has(w)) gemeinsam++
  return gemeinsam / Math.min(x.size, y.size)
}

/** Entfernt Ideen, die es schon gibt (als Karte) oder die sich untereinander wiederholen. */
export function ohneWiederholung(ideen: Idee[], vorhanden: string[]): Idee[] {
  const behalten: Idee[] = []
  for (const i of ideen) {
    const t = i.titel.trim()
    if (!t) continue
    if ([...vorhanden, ...behalten.map((b) => b.titel)].some((v) => aehnlichkeit(t, v) >= 0.75)) continue
    behalten.push({ titel: t, idee: i.idee.trim(), warum: i.warum.trim() })
  }
  return behalten
}

function kartenListe(karten: Karte[]): string {
  return karten.length ? karten.map((k) => `- [${STAND[k.spalte]}] ${k.titel}`).join('\n') : '(noch keine)'
}

export function ideenPrompt(o: { kanal: string; karten: Karte[]; andere?: Karte[]; freunde: string[]; vorbilder: string[]; wunsch?: string; heute: string; anzahl: number }): string {
  const monat = new Date(`${o.heute}T12:00`).toLocaleString('de-DE', { month: 'long', year: 'numeric' })
  return `Du bist Ideen-Partner für den YouTube-Kanal ${o.kanal}.
${KANAL_BESCHREIBUNG[o.kanal] ?? ''}

Finde ${o.anzahl} neue Video-Ideen. Heute ist ${monat}.${o.wunsch ? `\nPhilips Wunsch dazu: ${o.wunsch}` : ''}

Regeln:
- Jede Idee passt zum Kanal und ist mit einem normalen Minecraft-Server, einer Welt oder einem Spiel realistisch umsetzbar.
${KANAL_REGELN[o.kanal] ?? ''}
- Nur Spielmechaniken, die es wirklich gibt – nichts erfinden.
- Keine Wiederholung: nichts, was es unten schon als Karte gibt, und keine zwei Ideen mit demselben Kern.
- Abwechslung bei den Formaten (Challenge, Kampf/Duell, Survival-Projekt, Streich, „Minecraft, aber …“, Mythos testen, Speedrun, mit Freunden …).
- Titel wie bei großen deutschen Minecraft-Kanälen: kurz (höchstens 60 Zeichen), neugierig machend, gern mit Zahl oder Gegensatz, Großschreibung sparsam, kein Clickbait, der nicht stimmt. Nicht die Beispiel-Titel unten kopieren.
- Mitspieler nur aus dieser Liste nennen: ${o.freunde.length ? o.freunde.join(', ') : '(keine festen Mitspieler bekannt)'}
- „idee“: 2–3 Sätze, was im Video passiert und was der Aufhänger in den ersten Sekunden ist.
- „warum“: ein Satz, warum das gerade klicken könnte.

Titel großer Kanäle nur als Stil-Beispiel:
${o.vorbilder.map((v) => `- ${v}`).join('\n')}

Schon geplante oder veröffentlichte Videos von ${o.kanal}:
${kartenListe(o.karten)}
${o.andere?.length ? `\nVideos des anderen Kanals (nicht wiederholen):\n${kartenListe(o.andere)}\n` : ''}
Antworte nur mit JSON: {"ideen":[{"titel":"…","idee":"…","warum":"…"}]}`
}

export function titelPrompt(o: { karte: { kanal: string; titel: string; notizen: string }; transkript: string; vorbilder: string[]; andere: string[]; ganz?: boolean }): string {
  return `Schlage 5 YouTube-Titel für ein Video auf dem Kanal ${o.karte.kanal} vor.
${KANAL_BESCHREIBUNG[o.karte.kanal] ?? ''}

Arbeitstitel: ${o.karte.titel}${o.ganz ? ' (oft nur der Dateiname der Aufnahme – dann ignorieren)' : ''}
Notizen: ${o.karte.notizen.trim() || '(keine)'}
${o.transkript ? `${o.ganz ? 'Transkript des fertigen Videos (Ausschnitte über die ganze Länge)' : 'Anfang des Transkripts'}:\n${o.transkript}\n` : ''}
Regeln: deutsch, höchstens 60 Zeichen, unterschiedliche Ansätze (Frage, Zahl, Gegensatz, Ich-Perspektive, Spannung), nur was im Video wirklich passiert. Nicht wie diese Titel klingen, die Philip schon hat: ${o.andere.slice(0, 15).join(' | ') || '(keine)'}
Stil-Beispiele großer Kanäle (nicht kopieren): ${o.vorbilder.slice(0, 8).join(' | ')}
„warum“: ein kurzer Satz.

Antworte nur mit JSON: {"titel":[{"titel":"…","warum":"…"}]}`
}

export function wochenPrompt(o: { karten: Karte[]; frei: { kanal: string; tag: string; zeit: string }[]; heute: string }): string {
  const tag = (t: string): string => `${WOCHENTAGE_KURZ[wochentag(t)]} ${t.slice(8)}.${t.slice(5, 7)}.`
  return `Du planst die nächsten zwei Wochen für Philips YouTube-Kanäle. Heute ist ${tag(o.heute)} (${o.heute}).
${Object.entries(KANAL_BESCHREIBUNG)
  .map(([k, b]) => `${k}: ${b}`)
  .join('\n')}

Freie Upload-Termine laut Rhythmus:
${o.frei.map((f) => `- ${f.kanal}: ${tag(f.tag)} ${f.zeit} → Termin "${f.tag}T${f.zeit}"`).join('\n') || '(keine)'}

Karten ohne Termin (id: Kanal, Stand, Titel):
${o.karten.map((k) => `- ${k.id}: ${k.kanal}, ${STAND[k.spalte]}, ${k.titel}`).join('\n') || '(keine)'}

Aufgabe:
- „plan“: Ordne Karten freien Terminen desselben Kanals zu. Videos, die schon weiter sind (Upload, Thumbnail, Schnitt), zuerst; eine Idee braucht noch Aufnahme und Schnitt, also frühestens in 5 Tagen. Nur Termine aus der Liste, jede Karte und jeder Termin höchstens einmal.
- „aufnehmen“: bis zu 3 Karten, die Philip diese Woche aufnehmen sollte, damit die Termine klappen.
- „hinweis“: ein Satz, z. B. wenn Ideen fehlen.
- „grund“: kurz, warum.

Antworte nur mit JSON: {"plan":[{"karte":"id","termin":"2026-10-03T17:00","grund":"…"}],"aufnehmen":[{"karte":"id","grund":"…"}],"hinweis":"…"}`
}

/** Prüft den Wochenplan: nur bekannte Karten, nur freie Termine des richtigen Kanals, alles höchstens einmal. */
export function pruefeWoche(roh: WochenPlan, karten: Karte[], frei: { kanal: string; tag: string; zeit: string }[]): WochenPlan {
  const karteVon = new Map(karten.map((k) => [k.id, k]))
  const genutzt = new Set<string>()
  const plan = roh.plan.filter((p) => {
    const k = karteVon.get(p.karte)
    const passt = !!k && frei.some((f) => f.kanal === k.kanal && `${f.tag}T${f.zeit}` === p.termin)
    if (!passt || genutzt.has(p.karte) || genutzt.has(p.termin + k.kanal)) return false
    genutzt.add(p.karte).add(p.termin + k.kanal)
    return true
  })
  const aufnehmen = roh.aufnehmen.filter((a, i, alle) => karteVon.has(a.karte) && alle.findIndex((x) => x.karte === a.karte) === i).slice(0, 3)
  return { plan, aufnehmen, hinweis: roh.hinweis ?? '' }
}

/** Sätze gleichmäßig über das ganze Video verteilt, zusammen höchstens `max` Zeichen (Stunden-Streams passen sonst nicht) */
export function transkriptProbe(saetze: string[], max: number): string {
  const alle = saetze.filter(Boolean)
  const ganz = alle.join(' ')
  if (ganz.length <= max) return ganz
  const schnitt = ganz.length / alle.length
  const schritt = Math.ceil(alle.length / Math.max(1, Math.floor(max / schnitt)))
  const probe: string[] = []
  let laenge = 0
  for (let i = 0; i < alle.length; i += schritt) {
    if (laenge + alle[i]!.length + 5 > max) break
    probe.push(alle[i]!)
    laenge += alle[i]!.length + 5
  }
  return probe.join(' … ')
}

async function freundeAus(daten: string): Promise<string[]> {
  try {
    const skins = JSON.parse(await readFile(join(daten, 'skins', 'skins.json'), 'utf8')) as { name: string; rolle: string }[]
    return skins.filter((s) => s.rolle === 'freund').map((s) => s.name)
  } catch {
    return []
  }
}

async function vorbildTitel(configDir: string): Promise<string[]> {
  try {
    const v = JSON.parse(await readFile(join(configDir, 'vorbilder.json'), 'utf8')) as { vorbilder: { kanal: string; titel: string }[] }
    return v.vorbilder.map((x) => `${x.kanal}: ${x.titel}`)
  } catch {
    return []
  }
}

async function rhythmus(daten: string): Promise<Rhythmus> {
  try {
    return rhythmusAus(JSON.parse(await readFile(join(daten, 'planning', 'rhythmus.json'), 'utf8')))
  } catch {
    return {}
  }
}

export async function planungClaudeJob(p: PlanungClaudePayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<PlanungClaudeErgebnis> {
  const heute = p.heute ?? tagVon(new Date())
  const karten = await ladeKarten(p.daten)
  const vorbilder = await vorbildTitel(p.configDir)
  let prompt: string
  let woche: { karten: Karte[]; frei: { kanal: string; tag: string; zeit: string }[] } | null = null
  if (p.art === 'ideen') {
    ctx.progress(10, 'Claude sucht Ideen …')
    prompt = ideenPrompt({ kanal: p.kanal, karten: karten.filter((k) => k.kanal === p.kanal), andere: karten.filter((k) => k.kanal !== p.kanal), freunde: await freundeAus(p.daten), vorbilder, wunsch: p.wunsch?.trim() || undefined, heute, anzahl: 12 })
  } else if (p.art === 'titel' && p.projekt) {
    // Namensvorschläge im Schnitt: Inhalt aus dem ganzen Transkript, verknüpfte Karte (falls da) liefert die Notizen
    const pr = await ladeProjekt(p.daten, p.projekt)
    if (!pr) throw new Error('Projekt nicht gefunden.')
    ctx.progress(10, 'Claude schreibt Namen fürs Video …')
    const karte = karten.find((k) => k.schnitt === pr.id)
    const texte = liesAbschnitte(await readFile(join(p.daten, 'schnitt', pr.id, 'transkript.jsonl'), 'utf8').catch(() => '')).map((a) => a.text.trim())
    prompt = titelPrompt({ karte: { kanal: pr.kanal, titel: pr.name, notizen: karte?.notizen ?? '' }, transkript: transkriptProbe(texte, 5000), vorbilder, andere: karten.filter((k) => k.kanal === pr.kanal && k.id !== karte?.id).map((k) => k.titel), ganz: true })
  } else if (p.art === 'titel') {
    const karte = karten.find((k) => k.id === p.karte)
    if (!karte) throw new Error('Karte nicht gefunden.')
    ctx.progress(10, 'Claude schreibt Titel …')
    const jsonl = karte.schnitt ? await readFile(join(p.daten, 'schnitt', karte.schnitt, 'transkript.jsonl'), 'utf8').catch(() => '') : ''
    const transkript = liesAbschnitte(jsonl)
      .map((a) => a.text.trim())
      .join(' ')
      .slice(0, 2500)
    prompt = titelPrompt({ karte, transkript, vorbilder, andere: karten.filter((k) => k.kanal === karte.kanal && k.id !== karte.id).map((k) => k.titel) })
  } else {
    ctx.progress(10, 'Claude plant die Woche …')
    const frei = luecken(await rhythmus(p.daten), karten, heute, plusTage(heute, 13), heute)
    const ohne = karten.filter((k) => !k.termin && k.spalte !== 'veroeffentlicht')
    woche = { karten: ohne, frei }
    prompt = wochenPrompt({ karten: ohne, frei, heute })
  }
  const res = await runClaudeInJob({ cli: p.claudeCli, cliPrefix: p.claudePrefix, prompt, workDir: join(p.daten, 'claude-work', 'planung'), tools: [], maxTurns: 2, jsonSchema: SCHEMAS[p.art] }, ctx)
  if (!res.ok) throw new Error(`Claude hat nicht geantwortet: ${res.errors.join(', ') || res.subtype}`)
  const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as Record<string, unknown>
  ctx.progress(100, 'Fertig')
  if (p.art === 'ideen') return { art: 'ideen', ideen: ohneWiederholung((a['ideen'] as Idee[]) ?? [], karten.filter((k) => k.kanal === p.kanal).map((k) => k.titel)).slice(0, 10) }
  if (p.art === 'titel') return { art: 'titel', titel: ((a['titel'] as TitelVorschlag[]) ?? []).filter((t) => t.titel?.trim()).slice(0, 5) }
  return { art: 'woche', woche: pruefeWoche({ plan: (a['plan'] as WochenPlan['plan']) ?? [], aufnehmen: (a['aufnehmen'] as WochenPlan['aufnehmen']) ?? [], hinweis: String(a['hinweis'] ?? '') }, woche!.karten, woche!.frei) }
}
