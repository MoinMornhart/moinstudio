import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { sicherePakete, sichereUmgebung } from '../python'
import { encoderArgs } from './export'
import { ffmpegMitFortschritt } from './import'
import { aendereProjekt, ladeProjekt, projektOrdner } from './projekt'
import { filterGraph, renderArgs, untertitelAss, zeitAbbildung, type RenderOptionen } from './render'
import type { Bereich, Schnittliste } from './rohschnitt'
import { liesAbschnitte, type Abschnitt } from './transkript'
import { liesMitKonfliktkopien } from '../data/jsonfile'

/**
 * Stream-Highlights und Shorts (ROADMAP 6.8, MoinMorni): Höhepunkte aus langen Streams finden (laute Spitzen +
 * Claude liest das Transkript in 10-Minuten-Blöcken) und als einzelne Clips (16:9) oder Shorts (9:16, Facecam oben,
 * Wort-für-Wort-Untertitel) exportieren. Gekürzte Pausen aus dem Rohschnitt gelten auch in den Clips.
 */

export interface Highlight extends Bereich {
  titel: string
  grund: string
  /** 1–10, wie stark der Moment ist */
  wert: number
}

/** Laute Momente: Sekunden, in denen die Lautstärke deutlich über dem Üblichen liegt (Explosion, Schreien, Lachen). */
export function lauteMomente(wellen: { aufloesung: number; werte: number[] } | null): number[] {
  if (!wellen || !wellen.werte.length) return []
  const proSek = Math.max(1, Math.round(1 / wellen.aufloesung))
  const sek: number[] = []
  for (let i = 0; i < wellen.werte.length; i += proSek) sek.push(Math.max(...wellen.werte.slice(i, i + proSek)))
  const sortiert = [...sek].sort((a, b) => a - b)
  const median = sortiert[Math.floor(sortiert.length / 2)] ?? 0
  const schwelle = Math.max(median * 1.8, sortiert[Math.floor(sortiert.length * 0.95)] ?? 0)
  const momente: number[] = []
  sek.forEach((v, i) => {
    if (v >= schwelle && v > 20 && (!momente.length || i - momente[momente.length - 1]! > 15)) momente.push(i)
  })
  return momente
}

/** Überlappende Highlights zusammenfassen (der stärkere behält Titel), Länge 8–75 s, stärkste zuerst. */
export function ordneHighlights(h: Highlight[], dauer: number, max = 10): Highlight[] {
  const sauber = h
    .map((x) => ({ ...x, start: Math.max(0, x.start), ende: Math.min(dauer, Math.max(x.ende, x.start + 8)) }))
    .map((x) => ({ ...x, ende: Math.min(x.ende, x.start + 75) }))
    .sort((a, b) => b.wert - a.wert)
  const aus: Highlight[] = []
  for (const x of sauber) {
    const treffer = aus.find((y) => x.start < y.ende && x.ende > y.start)
    if (treffer) {
      treffer.start = Math.min(treffer.start, x.start)
      treffer.ende = Math.min(Math.max(treffer.ende, x.ende), treffer.start + 75)
    } else if (aus.length < max) aus.push({ ...x })
  }
  return aus
}

const SCHEMA = {
  type: 'object',
  required: ['highlights'],
  properties: {
    highlights: {
      type: 'array',
      items: { type: 'object', required: ['start', 'ende', 'titel', 'grund', 'wert'], properties: { start: { type: 'number' }, ende: { type: 'number' }, titel: { type: 'string' }, grund: { type: 'string' }, wert: { type: 'integer' } } }
    }
  }
} as const

export function highlightPrompt(abschnitte: Abschnitt[], laut: number[], kanal: string): string {
  return `Du schneidest Highlights aus einem Livestream von Philip (Kanal ${kanal}, deutsch, Gaming/Minecraft). Unten das
Transkript (Sekunde im Stream) und laute Momente (Explosionen, Schreien, Lachen). Finde die besten Momente für
Highlight-Clips und Shorts: lustig, spannend, überraschend, emotional – nicht Begrüßung, nicht Leerlauf.
Jeder Moment 15–60 s, mit etwas Anlauf vor dem Höhepunkt und kurz danach enden. Pro Moment: start, ende (Sekunden),
titel (kurz, deutsch, wie ein Short-Titel), grund (warum stark), wert (1–10). Lieber wenige starke als viele schwache.
Antworte nur mit JSON nach dem Schema.

Laute Momente: ${laut.length ? laut.map((s) => `${s}s`).join(', ') : 'keine'}

${abschnitte.map((a) => `[${Math.round(a.start)}–${Math.round(a.ende)}] ${a.text}`).join('\n')}`
}

export interface HighlightPayload {
  daten: string
  projekt: string
  claudeCli: string | null
}

export async function highlightJob(p: HighlightPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ projekt: string; anzahl: number }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.quelle?.dauer || !pr.transkript) throw new Error('Erst Import und Transkript abwarten.')
  const ordner = projektOrdner(p.daten, p.projekt)
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8'))
  const wellen = pr.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }) : null
  const laut = lauteMomente(wellen)
  let gefunden: Highlight[] = []
  if (p.claudeCli) {
    const block = 600
    for (let t = 0; t < pr.quelle.dauer; t += block) {
      await ctx.yield()
      ctx.progress(5 + (t / pr.quelle.dauer) * 90, 'Claude sucht die Höhepunkte …')
      const teil = abschnitte.filter((a) => a.start >= t - 30 && a.start < t + block)
      if (!teil.length) continue
      const res = await runClaudeInJob({ cli: p.claudeCli, prompt: highlightPrompt(teil, laut.filter((s) => s >= t && s < t + block), pr.kanal), workDir: join(p.daten, 'claude-work', 'schnitt'), tools: [], maxTurns: 2, jsonSchema: SCHEMA }, ctx)
      if (!res.ok) continue
      const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { highlights?: Highlight[] }
      gefunden.push(...(a.highlights ?? []))
    }
  }
  // ohne Claude (oder zusätzlich): laute Momente mit etwas Anlauf
  if (!gefunden.length) gefunden = laut.map((s) => ({ start: s - 12, ende: s + 8, titel: `Moment bei ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, grund: 'laut', wert: 5 }))
  const highlights = ordneHighlights(gefunden, pr.quelle.dauer)
  await writeFile(join(ordner, 'highlights.json'), JSON.stringify(highlights, null, 1))
  await aendereProjekt(p.daten, p.projekt, () => ({ highlights: highlights.length }))
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, anzahl: highlights.length }
}

// ---------- Clips und Shorts exportieren ----------

/** Schnittliste nur für den Clip: Clip-Bereich geschnitten mit den behaltenen Stellen des Rohschnitts. */
export function clipListe(liste: Schnittliste | null, h: Bereich, dauer: number): Schnittliste {
  const behalten = (liste?.behalten ?? [{ start: 0, ende: dauer }])
    .map((b) => ({ start: Math.max(b.start, h.start), ende: Math.min(b.ende, h.ende) }))
    .filter((b) => b.ende - b.start >= 0.2)
  return { version: 1, dauer, behalten, entfernt: [] }
}

export interface ClipsPayload {
  daten: string
  projekt: string
  ffmpeg: string
  encoder: string
  uv: string
  pyDir: string
  facecamSkript: string
  /** Indizes der Highlights; art: clip (16:9) oder short (9:16) */
  auswahl: { index: number; art: 'clip' | 'short' }[]
}

async function findeFacecam(p: ClipsPayload, pfad: string, dauer: number, ctx: JobContext<unknown>): Promise<[number, number, number, number] | null> {
  const python = await sichereUmgebung(p.uv, p.pyDir, ctx)
  await sicherePakete(p.uv, python, 'rembg, cv2, PIL', ['rembg==2.0.*', 'onnxruntime', 'opencv-python-headless', 'pillow'], ctx, 'Richte die Personenerkennung ein (einmalig) …')
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(python, [p.facecamSkript, pfad, String(dauer), p.ffmpeg], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    ctx.track(child)
    let o = ''
    child.stdout.on('data', (d: Buffer) => (o += d.toString()))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve(o) : reject(new Error(`Facecam-Erkennung Exit ${code}`))))
  })
  const m = /MOIN_FACECAM ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/.exec(out)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : null
}

export async function clipsJob(p: ClipsPayload, ctx: JobContext<unknown>): Promise<{ projekt: string; dateien: string[] }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.quelle) throw new Error('Projekt nicht gefunden.')
  const ordner = projektOrdner(p.daten, p.projekt)
  await mkdir(join(ordner, 'clips'), { recursive: true })
  const highlights = JSON.parse(await readFile(join(ordner, 'highlights.json'), 'utf8')) as Highlight[]
  const liste = pr.rohschnitt ? (JSON.parse(await liesMitKonfliktkopien(join(ordner, 'schnitt.json'))) as Schnittliste) : null
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  let cam = pr.facecam === undefined ? undefined : pr.facecam
  if (p.auswahl.some((a) => a.art === 'short') && cam === undefined) {
    ctx.progress(2, 'Suche die Facecam …')
    cam = await findeFacecam(p, pr.quelle.pfad, pr.quelle.dauer, ctx).catch(() => null)
    await aendereProjekt(p.daten, p.projekt, () => ({ facecam: cam ?? null }))
  }
  const dateien: string[] = []
  for (const [n, a] of p.auswahl.entries()) {
    await ctx.yield()
    const h = highlights[a.index]
    if (!h) continue
    const kurz = clipListe(liste, h, pr.quelle.dauer)
    const hoch = a.art === 'short'
    const breite = hoch ? 1080 : Math.min(1920, pr.quelle.breite || 1920)
    const hoehe = hoch ? 1920 : Math.round((breite * 9) / 16 / 2) * 2
    const fps = Math.min(60, Math.round(pr.quelle.fps) || 30)
    const name = `${String(a.index + 1).padStart(2, '0')}-${a.art}`
    let untertitel: string | null = null
    if (hoch && abschnitte.length) {
      untertitel = `clips/${name}.ass`
      await writeFile(join(ordner, untertitel), untertitelAss(abschnitte, kurz, { breite, hoehe, karaoke: true, woerter: 3, unten: 0.28 }))
    }
    const o: RenderOptionen = { quelle: pr.quelle.pfad, liste: kurz, zooms: [], untertitel, breite, hoehe, fps, audio: pr.quelle.audio, encoder: encoderArgs(p.encoder, hoehe, fps), ausgabe: `clips/${name}.mp4`, ...(hoch ? { hoch: { cam: cam ?? null } } : {}) }
    await writeFile(join(ordner, 'clips', `${name}.filter.txt`), filterGraph(o))
    const { laenge } = zeitAbbildung(kurz.behalten)
    await ffmpegMitFortschritt(p.ffmpeg, renderArgs(o, `clips/${name}.filter.txt`), ctx, laenge, (x) => ctx.progress(5 + ((n + x) / p.auswahl.length) * 94, `${hoch ? 'Short' : 'Clip'} ${n + 1}/${p.auswahl.length}: ${h.titel}`), ordner)
    dateien.push(join(ordner, o.ausgabe))
  }
  await aendereProjekt(p.daten, p.projekt, () => ({ clips: Date.now() }))
  ctx.progress(100, 'Fertig')
  return { projekt: p.projekt, dateien }
}
