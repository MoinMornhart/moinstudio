import { spawn } from 'node:child_process'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'

/**
 * Video hochladen → Thumbnail-Vorschläge (ROADMAP 5.5, Philips Wunsch vom 28.09.): FFmpeg zieht Standbilder über das
 * ganze Video, setzt sie zu Bildbögen zusammen, und Claude (Abo, darf nur diese Bilder lesen) erkennt Inhalt,
 * Höhepunkte und Stimmung und schlägt Thumbnail-Beschreibungen vor. Jeder Vorschlag lässt sich als normaler
 * Thumbnail-Auftrag starten.
 */

export interface VideoPayload {
  video: string
  kanal: string
  titel?: string
  ffmpeg: string
  claudeCli: string
  ausgabe: string
  datenOrdner: string
  /** Namen der Freunde aus der Skin-Bibliothek, damit Claude sie zuordnen kann */
  freunde: string[]
}

export interface VideoVorschlag {
  beschreibung: string
  warum: string
  freunde: string[]
  zeitpunkt?: string
}

const SCHEMA = {
  type: 'object',
  required: ['inhalt', 'vorschlaege'],
  properties: {
    inhalt: { type: 'string' },
    vorschlaege: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['beschreibung', 'warum'],
        properties: { beschreibung: { type: 'string' }, warum: { type: 'string' }, freunde: { type: 'array', items: { type: 'string' } }, zeitpunkt: { type: 'string' } }
      }
    }
  }
} as const

function ffmpeg(exe: string, args: string[], ctx: JobContext<unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ['-hide_banner', '-y', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    ctx.track(child)
    let out = ''
    child.stderr.on('data', (d: Buffer) => (out = (out + d.toString()).slice(-20000)))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`FFmpeg Exit ${code}: ${out.trim().split(/\r?\n/).slice(-1)[0]}`))))
  })
}

/** Länge in Sekunden aus der FFmpeg-Ausgabe („Duration: 00:12:34.56“). */
export function dauerAus(text: string): number | null {
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null
}

export function zeit(sek: number): string {
  const m = Math.floor(sek / 60)
  return `${m}:${String(Math.floor(sek % 60)).padStart(2, '0')}`
}

export async function videoVorschlaegeJob(p: VideoPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ inhalt: string; vorschlaege: VideoVorschlag[]; boegen: string[] }> {
  await mkdir(p.ausgabe, { recursive: true })
  ctx.progress(5, 'Video wird angesehen …')
  const info = await ffmpeg(p.ffmpeg, ['-i', p.video, '-f', 'null', '-t', '0.1', '-'], ctx as JobContext<unknown>).catch((e: Error) => e.message)
  const dauer = dauerAus(info) ?? 600
  // 32 Standbilder gleichmäßig über das Video, vier Bögen mit je 8 Bildern (Zeitstempel eingeblendet)
  const anzahl = 32
  const intervall = Math.max(1, dauer / anzahl)
  ctx.progress(20, `Ziehe ${anzahl} Standbilder aus ${zeit(dauer)} min Video …`)
  await ffmpeg(
    p.ffmpeg,
    ['-i', p.video, '-vf', `fps=1/${intervall.toFixed(3)},scale=480:-2,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=4x2`, '-frames:v', '4', join(p.ausgabe, 'bogen-%d.jpg')],
    ctx as JobContext<unknown>
  ).catch(async () => {
    // ohne drawtext (FFmpeg ohne Schrift-Unterstützung)
    await ffmpeg(p.ffmpeg, ['-i', p.video, '-vf', `fps=1/${intervall.toFixed(3)},scale=480:-2,tile=4x2`, '-frames:v', '4', join(p.ausgabe, 'bogen-%d.jpg')], ctx as JobContext<unknown>)
  })
  const boegen = (await readdir(p.ausgabe)).filter((f) => /^bogen-\d+\.jpg$/.test(f)).map((f) => join(p.ausgabe, f))
  if (!boegen.length) throw new Error('Aus dem Video konnten keine Standbilder gelesen werden.')

  ctx.progress(50, 'Claude sieht sich das Video an und sucht Thumbnail-Ideen …')
  const prompt = `Du hilfst Philip, ein YouTube-Thumbnail für seinen Kanal ${p.kanal} zu finden. Sieh dir diese Standbilder aus seinem
Video an (je Bogen 8 Bilder in zeitlicher Reihenfolge, Zeit oben links): ${boegen.map((b) => `\n- ${b}`).join('')}
${p.titel ? `\nGeplanter Videotitel: „${p.titel}“` : ''}
${p.freunde.length ? `\nFreunde mit Skin in MoinStudio: ${p.freunde.join(', ')}` : ''}

1. Beschreibe kurz, worum es im Video geht (Ort, Mobs, Gegner, Höhepunkte, Stimmung).
2. Schlage 3 verschiedene Thumbnail-Ideen vor, wie sie große Minecraft-Kanäle (GommeHD, BastiGHG, Paluten) machen würden:
   Action und der stärkste Moment des Videos, Philip groß vorn. Jede Idee ist eine kurze Beschreibung in Philips Worten
   (z. B. „Ich kämpfe gegen den Warden in der Deep Dark“), dazu warum sie passt, welche Freunde dabei sein sollen (nur
   aus der Liste) und der Zeitpunkt im Video, auf den sie sich bezieht.
Antworte nur mit JSON nach dem Schema.`
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt, workDir: join(p.datenOrdner, 'claude-work', 'video'), tools: ['Read'], allowedTools: ['Read'], addDirs: [p.ausgabe], maxTurns: 8, jsonSchema: SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte das Video nicht auswerten: ${res.errors.join(' | ') || res.subtype}`)
  const roh = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { inhalt?: string; vorschlaege?: VideoVorschlag[] }
  const vorschlaege = (roh.vorschlaege ?? []).map((v) => ({ ...v, freunde: (v.freunde ?? []).filter((f) => p.freunde.includes(f)) }))
  if (!vorschlaege.length) throw new Error('Claude hat keine Vorschläge geliefert.')
  ctx.progress(100, 'Fertig')
  return { inhalt: roh.inhalt ?? '', vorschlaege, boegen }
}
