import { spawn } from 'node:child_process'
import { open, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { ffmpegMitFortschritt } from './import'
import { aendereProjekt, ladeProjekt, projektOrdner } from './projekt'
import { filterGraph, renderArgs, zeitAbbildung } from './render'
import { liesAbschnitte } from './transkript'
import { renderPlan } from './vorschau'

/**
 * Export für YouTube (ROADMAP 6.7): volle Qualität aus dem Original, nach YouTubes Upload-Empfehlung (H.264 High,
 * 2 B-Frames, Closed GOP, 4:2:0, BT.709, AAC 48 kHz, Fast Start, Bitrate nach Auflösung). Encoder aus dem
 * Hardware-Profil (NVENC/AMF/QSV), sonst libx264 auf der CPU. Dazu Kapitel, Titel und Beschreibung von Claude und eine
 * Prüfung der fertigen Datei.
 */

/** Zielgröße: Auflösung der Aufnahme (gerade Zahlen, höchstens 4K), Bildrate wie aufgenommen (höchstens 60). */
export function zielFormat(breite: number, hoehe: number, fps: number): { breite: number; hoehe: number; fps: number } {
  const f = Math.min(1, 3840 / Math.max(breite, 1), 2160 / Math.max(hoehe, 1))
  const gerade = (x: number): number => Math.max(2, Math.round((x * f) / 2) * 2)
  return { breite: gerade(breite || 1920), hoehe: gerade(hoehe || 1080), fps: Math.min(60, Math.round(fps) || 30) }
}

/** YouTube-Bitrate (SDR) in Mbit/s nach Auflösung und Bildrate. */
export function youtubeBitrate(hoehe: number, fps: number): number {
  const hfr = fps > 30
  if (hoehe >= 2160) return hfr ? 60 : 40
  if (hoehe >= 1440) return hfr ? 24 : 16
  if (hoehe >= 1080) return hfr ? 12 : 8
  if (hoehe >= 720) return hfr ? 7.5 : 5
  return hfr ? 4 : 2.5
}

/** Encoder-Argumente nach YouTube-Vorgabe; Hardware-Encoder mit gleichen Eckwerten. */
export function encoderArgs(encoder: string, hoehe: number, fps: number): string[] {
  const mbit = youtubeBitrate(hoehe, fps)
  const rate = ['-b:v', `${mbit}M`, '-maxrate', `${Math.round(mbit * 1.5)}M`, '-bufsize', `${mbit * 2}M`]
  const gop = ['-g', String(Math.max(1, Math.round(fps / 2))), '-bf', '2']
  const farbe = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-pix_fmt', 'yuv420p']
  const je: Record<string, string[]> = {
    h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-profile:v', 'high', '-rc', 'vbr'],
    h264_amf: ['-c:v', 'h264_amf', '-quality', 'quality', '-profile:v', 'high', '-rc', 'vbr_peak'],
    h264_qsv: ['-c:v', 'h264_qsv', '-preset', 'slow', '-profile:v', 'high'],
    libx264: ['-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-flags', '+cgop']
  }
  return [...(je[encoder] ?? je['libx264']!), ...rate, ...gop, ...farbe]
}

export interface Kapitel {
  zeit: number
  titel: string
}

/** YouTube-Kapitel: beginnt bei 0:00, aufsteigend, mindestens 3, jedes mindestens 10 s. */
export function pruefeKapitel(k: Kapitel[], laenge: number): string[] {
  const fehler: string[] = []
  if (k.length < 3) fehler.push('weniger als 3 Kapitel')
  if (k[0]?.zeit !== 0) fehler.push('erstes Kapitel beginnt nicht bei 0:00')
  for (let i = 0; i < k.length; i++) {
    const bis = k[i + 1]?.zeit ?? laenge
    if (i > 0 && k[i]!.zeit <= k[i - 1]!.zeit) fehler.push(`Kapitel ${i + 1} nicht aufsteigend`)
    if (bis - k[i]!.zeit < 10) fehler.push(`Kapitel „${k[i]!.titel}“ kürzer als 10 s`)
  }
  return fehler
}

/** Kapitel reparieren: bei 0 beginnen, zu kurze zusammenlegen. */
export function repariereKapitel(k: Kapitel[], laenge: number): Kapitel[] {
  const s = [...k].filter((x) => x.zeit >= 0 && x.zeit < laenge).sort((a, b) => a.zeit - b.zeit)
  if (!s.length) return []
  s[0] = { ...s[0]!, zeit: 0 }
  const aus: Kapitel[] = []
  for (const x of s) if (!aus.length || x.zeit - aus[aus.length - 1]!.zeit >= 10) aus.push(x)
  while (aus.length > 1 && laenge - aus[aus.length - 1]!.zeit < 10) aus.pop()
  return aus.length >= 3 ? aus : []
}

export const kapitelText = (k: Kapitel[]): string =>
  k
    .map((x) => {
      const h = Math.floor(x.zeit / 3600)
      const m = Math.floor((x.zeit % 3600) / 60)
      const s = Math.floor(x.zeit % 60)
      return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s).padStart(2, '0')} ${x.titel}`
    })
    .join('\n')

export interface Pruefung {
  punkt: string
  ok: boolean
  wert: string
}

/** ffprobe-JSON + Fast-Start-Befund → Prüfliste nach YouTube-Empfehlung. */
export function youtubePruefung(probe: { streams?: Record<string, unknown>[]; format?: Record<string, unknown> }, faststart: boolean): Pruefung[] {
  const v = probe.streams?.find((s) => s['codec_type'] === 'video') ?? {}
  const a = probe.streams?.find((s) => s['codec_type'] === 'audio')
  const p: Pruefung[] = [
    { punkt: 'Video H.264', ok: v['codec_name'] === 'h264', wert: String(v['codec_name'] ?? '–') },
    { punkt: 'Profil High', ok: String(v['profile'] ?? '').toLowerCase().startsWith('high'), wert: String(v['profile'] ?? '–') },
    { punkt: 'Farbformat 4:2:0', ok: v['pix_fmt'] === 'yuv420p', wert: String(v['pix_fmt'] ?? '–') },
    { punkt: 'Farbraum BT.709', ok: v['color_primaries'] === 'bt709' || v['color_space'] === 'bt709', wert: String(v['color_primaries'] ?? v['color_space'] ?? '–') },
    { punkt: 'Fast Start (moov vorne)', ok: faststart, wert: faststart ? 'ja' : 'nein' }
  ]
  if (a) {
    p.push({ punkt: 'Ton AAC', ok: a['codec_name'] === 'aac', wert: String(a['codec_name']) })
    p.push({ punkt: 'Ton 48 kHz', ok: String(a['sample_rate']) === '48000', wert: `${String(a['sample_rate'])} Hz` })
  }
  return p
}

/** MP4-Atome am Dateianfang lesen: liegt „moov“ vor „mdat“? */
export async function istFaststart(datei: string): Promise<boolean> {
  const fh = await open(datei, 'r')
  try {
    let pos = 0
    const kopf = Buffer.alloc(16)
    for (let i = 0; i < 20; i++) {
      const { bytesRead } = await fh.read(kopf, 0, 16, pos)
      if (bytesRead < 8) return false
      let groesse = kopf.readUInt32BE(0)
      const typ = kopf.toString('latin1', 4, 8)
      if (typ === 'moov') return true
      if (typ === 'mdat') return false
      if (groesse === 1) groesse = Number(kopf.readBigUInt64BE(8))
      if (groesse < 8) return false
      pos += groesse
    }
    return false
  } finally {
    await fh.close()
  }
}

const SCHEMA = {
  type: 'object',
  required: ['titel', 'beschreibung', 'kapitel'],
  properties: {
    titel: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    beschreibung: { type: 'string' },
    kapitel: { type: 'array', items: { type: 'object', required: ['zeit', 'titel'], properties: { zeit: { type: 'number' }, titel: { type: 'string' } } } }
  }
} as const

export interface ExportPayload {
  daten: string
  projekt: string
  ffmpeg: string
  ffprobe: string
  encoder: string
  claudeCli: string | null
}

export interface ExportErgebnis {
  datei: string
  laenge: number
  titel: string[]
  beschreibung: string
  kapitel: Kapitel[]
  pruefung: Pruefung[]
}

function ausgabe(exe: string, args: string[], ctx: JobContext<unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
    ctx.track(child)
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`ffprobe Exit ${code}`))))
  })
}

export async function exportJob(p: ExportPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<ExportErgebnis> {
  const c = ctx as JobContext<unknown>
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr?.quelle || !pr.rohschnitt) throw new Error('Erst Import und Rohschnitt abwarten.')
  const ordner = projektOrdner(p.daten, p.projekt)
  const ziel = zielFormat(pr.quelle.breite, pr.quelle.hoehe, pr.quelle.fps)
  const plan = await renderPlan(p.daten, pr, { quelle: pr.quelle.pfad, ...ziel, encoder: encoderArgs(p.encoder, ziel.hoehe, ziel.fps), ausgabe: 'export.mp4', untertitelDatei: 'export.ass' })
  const { imSchnitt, laenge } = zeitAbbildung(plan.liste.behalten)

  // Kapitel, Titel und Beschreibung (Zeiten im geschnittenen Video)
  let text = { titel: [pr.name, pr.name, pr.name], beschreibung: '', kapitel: [] as Kapitel[] }
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  if (p.claudeCli && abschnitte.length) {
    ctx.progress(2, 'Claude schreibt Kapitel, Titel und Beschreibung …')
    const zeilen = abschnitte
      .map((a) => ({ t: imSchnitt(a.start), text: a.text }))
      .filter((a): a is { t: number; text: string } => a.t !== null)
      .map((a) => `[${Math.round(a.t)}] ${a.text}`)
    const prompt = `Philip veröffentlicht dieses Video auf YouTube (Kanal ${pr.kanal}, deutsch). Transkript des fertigen Schnitts, jede Zeile
mit Sekunde im Video:
${zeilen.join('\n')}

Schreibe:
- titel: 3 Vorschläge, knackig wie bei großen deutschen Minecraft-Kanälen (keine Clickbait-Lügen, höchstens 70 Zeichen)
- beschreibung: 2–4 Sätze auf Deutsch, locker, ohne Hashtag-Wand
- kapitel: ${laenge >= 60 ? 'YouTube-Kapitel {zeit (Sekunden), titel}, erstes bei 0, mindestens 3, jedes mindestens 10 s lang, kurze Titel' : 'leere Liste (Video zu kurz)'}
Antworte nur mit JSON nach dem Schema.`
    const res = await runClaudeInJob({ cli: p.claudeCli, prompt, workDir: join(p.daten, 'claude-work', 'schnitt'), tools: [], maxTurns: 2, jsonSchema: SCHEMA }, ctx)
    if (res.ok) {
      const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as Partial<typeof text>
      text = { titel: a.titel?.length ? a.titel : text.titel, beschreibung: a.beschreibung ?? '', kapitel: repariereKapitel(a.kapitel ?? [], laenge) }
    }
  }

  await ctx.yield()
  await writeFile(join(ordner, 'export-filter.txt'), filterGraph(plan))
  await ffmpegMitFortschritt(p.ffmpeg, renderArgs(plan, 'export-filter.txt'), c, laenge, (a) => ctx.progress(8 + a * 88, `Export (${ziel.hoehe}p, ${p.encoder}) … ${Math.round(a * 100)} %`), ordner)

  ctx.progress(97, 'Prüfe die Datei nach YouTube-Vorgaben …')
  const datei = join(ordner, 'export.mp4')
  const probe = JSON.parse(await ausgabe(p.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', datei], c))
  const pruefung = youtubePruefung(probe, await istFaststart(datei))
  if (text.kapitel.length) pruefung.push({ punkt: 'Kapitel', ok: pruefeKapitel(text.kapitel, laenge).length === 0, wert: `${text.kapitel.length} Kapitel` })
  const ergebnis: ExportErgebnis = { datei, laenge, ...text, pruefung }
  await writeFile(join(ordner, 'export.json'), JSON.stringify(ergebnis, null, 1))
  await aendereProjekt(p.daten, p.projekt, () => ({ export: Date.now() }))
  ctx.progress(100, 'Fertig')
  return ergebnis
}
