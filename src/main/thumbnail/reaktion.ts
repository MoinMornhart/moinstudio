import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import type { ThumbnailVariante } from './job'

/**
 * Reaction-Thumbnails (Stilbuch 14, Vorbilder BastiGHGs Zweitkanal „Bastian“ und Zarbex): Philip lädt das Thumbnail
 * des Originalvideos hoch; Claude erkennt das Wichtigste darin, wählt Seite, Wort und Ausdruck; Blender baut das Bild
 * mit Philips echtem Skin (nie gezeichnet). Die Pose wechselt jedes Mal (zuletzt benutzte werden gemerkt).
 */

export interface ReaktionPayload {
  original: string
  skin: string
  slim?: boolean | null
  kanal: string
  /** Philips Gefühlslage in eigenen Worten (optional, z. B. „schockiert“, „lachend“) */
  gefuehl?: string
  /** eigenes Wort (optional), sonst schlägt Claude eins vor */
  wort?: string
  /** Gaming-Video (Bastian-Stil): Bild ist ein Spielmotiv, Spielname kommt als Logo in die Ecke */
  spiel?: string
  claudeCli: string
  blender: { exe: string; mesa: boolean; geraet: string; samples: number }
  blenderDir: string
  datenOrdner: string
  ausgabe: string
}

/** Mimik und passende Posen je Gefühl; die erste Pose ohne Hände ist Stilbuch-Standard (14.3). */
export const GEFUEHLE: Record<string, { mimik: string; posen: string[] }> = {
  schockiert: { mimik: 'erschrocken', posen: ['neutral', 'panik', 'schreck', 'zeigen'] },
  lachend: { mimik: 'froh', posen: ['neutral', 'jubeln', 'zeigen', 'siegesfaust'] },
  begeistert: { mimik: 'froh', posen: ['neutral', 'siegesfaust', 'jubeln', 'zeigen'] },
  wuetend: { mimik: 'wuetend', posen: ['neutral', 'genervt', 'zeigen', 'achselzucken'] },
  traurig: { mimik: 'traurig', posen: ['neutral', 'muede', 'blick_runter', 'achselzucken'] },
  cringe: { mimik: 'skeptisch', posen: ['neutral', 'genervt', 'kopfkratzen', 'achselzucken'] },
  skeptisch: { mimik: 'skeptisch', posen: ['neutral', 'nachdenken', 'genervt', 'kopfkratzen'] },
  muede: { mimik: 'muede', posen: ['neutral', 'muede', 'kopfkratzen'] },
  neugierig: { mimik: 'neutral', posen: ['neutral', 'nachdenken', 'blick_zum_ding', 'zeigen', 'winken'] }
}

/** Freie Worte („bin schockiert“, „lach mich tot“) auf ein Gefühl abbilden. */
export function gefuehlAus(text: string | undefined): string | null {
  if (!text) return null
  const t = text.toLowerCase().replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')
  const regeln: [RegExp, string][] = [
    [/schock|entsetz|krass|omg|fassungslos/, 'schockiert'],
    [/lach|witzig|lustig|haha|lol/, 'lachend'],
    [/begeister|hype|geil|freu/, 'begeistert'],
    [/wut|wüt|sauer|aggro/, 'wuetend'],
    [/traurig|wein|schade/, 'traurig'],
    [/cringe|peinlich|fremdschäm/, 'cringe'],
    [/skeptisch|fake|zweifel|sus/, 'skeptisch'],
    [/müde|gähn|langweil/, 'muede'],
    [/neugierig|spannend|was ist/, 'neugierig']
  ]
  return regeln.find(([re]) => re.test(t))?.[1] ?? null
}

/**
 * Seite der Figur: immer gegenüber dem wichtigen Punkt, damit Pfeil und Inhalt nie hinter Philips Kopf liegen
 * (Claudes Wahl gilt nur, wenn der Punkt genau in der Mitte liegt).
 */
export function seiteFuer(vorschlag: string | undefined, wichtig: number[] | undefined): 'links' | 'rechts' {
  const u = wichtig?.length === 2 ? wichtig[0]! : undefined
  if (u !== undefined && Math.abs(u - 0.5) > 0.04) return u > 0.5 ? 'links' : 'rechts'
  return vorschlag === 'rechts' ? 'rechts' : 'links'
}

/** Nächste Pose: erste passende, die unter den letzten fünf nicht vorkam. */
export function naechstePose(kandidaten: string[], zuletzt: string[]): string {
  return kandidaten.find((p) => !zuletzt.slice(-5).includes(p)) ?? kandidaten[zuletzt.length % kandidaten.length]!
}

const SCHEMA = {
  type: 'object',
  required: ['inhalt', 'wichtig', 'seite', 'wort', 'gefuehl'],
  properties: {
    inhalt: { type: 'string' },
    wichtig: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    seite: { type: 'string', enum: ['links', 'rechts'] },
    wort: { type: 'string' },
    gefuehl: { type: 'string', enum: Object.keys(GEFUEHLE) },
    gaming: { type: 'boolean' }
  }
} as const

export async function reaktionJob(p: ReaktionPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ varianten: ThumbnailVariante[] }> {
  await mkdir(p.ausgabe, { recursive: true })
  const original = join(p.ausgabe, `original${extname(p.original).toLowerCase() || '.jpg'}`)
  await copyFile(p.original, original)

  ctx.progress(5, 'Claude sieht sich das Original an …')
  const vorgabe = gefuehlAus(p.gefuehl)
  const prompt = `Du hilfst Philip (YouTube-Kanal ${p.kanal}) bei einem Reaction-Thumbnail im Stil von BastiGHGs Zweitkanal und Zarbex.
${p.spiel ? `Es ist ein Gaming-Video über das Spiel „${p.spiel}“; das Bild ist ein Spielmotiv (kein fremdes Thumbnail).\n` : ''}Sieh dir das Bild an: ${original}
Philip wird als sein Minecraft-Skin am Rand einer Bildhälfte stehen (Kopf etwa 42 % der Bildhöhe, auf Hüfthöhe
angeschnitten) und das Original füllt das Bild dahinter.

Bestimme:
- inhalt: kurz, worum es im Original geht
- wichtig: [u, v] die Bildkoordinate (0–1, oben links = 0,0) des wichtigsten Details, auf das ein roter Pfeil zeigen soll
- seite: auf welche Seite Philip kommt ("links" oder "rechts") – die Seite, auf der im Original am wenigsten Wichtiges
  ist (Personen, Gesichter, Titel und das wichtige Detail müssen auf der anderen Seite frei bleiben)
- wort: genau ein kurzes deutsches Wort oder eine Zahl in Großbuchstaben (höchstens 10 Zeichen), das die Reaktion auf
  den Punkt bringt (z. B. KRASS, FAKE?, WAS?!, 1000€) – nicht einfach den Titel des Originals wiederholen
- gefuehl: ${vorgabe ? `„${vorgabe}“ (Philips Vorgabe)` : 'die passende Reaktion'} aus: ${Object.keys(GEFUEHLE).join(', ')}
- gaming: true, wenn es um ein Videospiel geht
${p.wort ? `Philip möchte das Wort „${p.wort}“ – übernimm es.` : ''}
Antworte nur mit JSON nach dem Schema.`
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt, workDir: join(p.datenOrdner, 'claude-work', 'reaktion'), tools: ['Read'], allowedTools: ['Read'], addDirs: [p.ausgabe], maxTurns: 6, jsonSchema: SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte das Original nicht auswerten: ${res.errors.join(' | ') || res.subtype}`)
  const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { inhalt?: string; wichtig?: number[]; seite?: string; wort?: string; gefuehl?: string }
  const gefuehl = vorgabe ?? (a.gefuehl && GEFUEHLE[a.gefuehl] ? a.gefuehl : 'schockiert')
  const g = GEFUEHLE[gefuehl]!
  const seite = seiteFuer(a.seite, a.wichtig)
  const wort = (p.wort ?? a.wort ?? '').toUpperCase().slice(0, 12)

  // Posen-Gedächtnis: jedes Mal eine neue Pose
  const gedaechtnis = join(p.datenOrdner, 'reaktionen', 'posen.json')
  const zuletzt = JSON.parse(await readFile(gedaechtnis, 'utf8').catch(() => '[]')) as string[]
  const pose1 = naechstePose(g.posen, zuletzt)
  const pose2 = naechstePose(g.posen.filter((x) => x !== pose1), [...zuletzt, pose1])
  await mkdir(join(p.datenOrdner, 'reaktionen'), { recursive: true })
  await writeFile(gedaechtnis, JSON.stringify([...zuletzt, pose1].slice(-20)))

  const varianten: ThumbnailVariante[] = []
  const plaene = [
    { titel: `${wort || 'Reaction'} – ${gefuehl}, Pose ${pose1}`, pose: pose1, seite, pfeil: true, kopf: 14 },
    // Zweite Variante: gleiche Seite (Claudes Wahl hält den Inhalt frei), andere Pose, Blick direkt in die Kamera
    { titel: `Variante: Blick in die Kamera, Pose ${pose2}`, pose: pose2, seite, pfeil: true, kopf: 0 }
  ]
  for (const [i, pl] of plaene.entries()) {
    await ctx.yield()
    ctx.progress(30 + i * 35, `Variante ${i + 1}/2: rendere …`)
    const spec = {
      hintergrund: original,
      skin: p.skin,
      slim: p.slim ?? null,
      seite: pl.seite,
      mimik: g.mimik,
      pose: pl.pose,
      kopf_drehung: pl.kopf,
      wort,
      schrift: 'C:/Windows/Fonts/ariblk.ttf',
      pfeil_ziel: pl.pfeil && a.wichtig?.length === 2 ? a.wichtig : undefined,
      spiel: p.spiel,
      samples: p.blender.samples,
      geraet: p.blender.geraet
    }
    const basis = join(p.ausgabe, `variante-${i + 1}`)
    await writeFile(`${basis}.spec.json`, JSON.stringify(spec, null, 1))
    const { code } = await runBlender(
      { exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, 'render_reaktion.py'), args: [`${basis}.spec.json`, `${basis}.png`, `${basis}.bericht.json`] },
      ctx as JobContext<unknown>
    )
    const bericht = JSON.parse(await readFile(`${basis}.bericht.json`, 'utf8').catch(() => '{}')) as { fehler?: string }
    varianten.push({
      titel: pl.titel,
      vorbild: 'reaction-zarbex-bastian',
      warum: a.inhalt ?? '',
      bild: code === 0 && !bericht.fehler ? `${basis}.png` : null,
      szene: `${basis}.spec.json`,
      warnungen: [],
      ...(code !== 0 || bericht.fehler ? { fehler: bericht.fehler ?? `Blender Exit ${code}` } : {})
    })
  }
  ctx.progress(100, 'Fertig')
  return { varianten }
}
