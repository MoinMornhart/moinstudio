import { spawn } from 'node:child_process'
import { appendFile, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import type { ThumbnailVariante } from './job'
import { MIMIKEN, posenBeispiele, posenNamen } from './reaktion'

/**
 * Spiele-Vorlage (Philip, 27.09.): Philip in ein vorhandenes Spiele-Thumbnail anderer Creator setzen, genau an die
 * Stelle der Person darin. Ablauf: Claude sieht sich die Vorlage an (Pose, Gegenstand, Titel, Licht) → rembg entfernt
 * die Person und füllt die Lücke → das gehaltene Ding kommt als echtes CC0-Modell von Poly Haven → Blender rendert
 * Philips Skin an der Stelle → der Titel der Vorlage wird wieder obendrauf gelegt.
 * Vorlagen und Ergebnisse bleiben im Datenordner, nie im öffentlichen Repo.
 */

export interface SpielvorlagePayload {
  vorlage: string
  skin: string
  slim?: boolean | null
  /** optional: Philips eigene Worte, was anders sein soll (z. B. „ich halte ein Schwert statt der Pistole“) */
  wunsch?: string
  /** Freunde: ersetzen weitere Personen der Vorlage, sonst stehen sie neben Philip */
  freunde?: { skin: string; slim?: boolean | null; name: string }[]
  claudeCli: string
  blender: { exe: string; mesa: boolean; geraet: string; samples: number }
  /** uv.exe zum Einrichten der Python-Umgebung (rembg, OpenCV) */
  uv: string
  /** Ordner der Python-Umgebung, z. B. %LOCALAPPDATA%\MoinStudio\py\vorlage */
  pyDir: string
  blenderDir: string
  datenOrdner: string
  ausgabe: string
}

type Box = [number, number, number, number]

export interface Person {
  kopf: [number, number]
  kopf_anteil: number
  pose?: string
  winkel?: Record<string, unknown>
  ansicht?: 'vorn' | 'hinten'
  blick?: number
}

export interface VorlagenAnalyse {
  inhalt: string
  kopf: [number, number]
  kopf_anteil: number
  pose?: string
  winkel?: Record<string, unknown>
  mimik?: string
  licht_seite?: 'links' | 'rechts'
  ansicht?: 'vorn' | 'hinten'
  ziel?: [number, number]
  blick?: number
  gegenstand?: { box: Box; suchwort: string; hand?: 'r' | 'l' }
  /** Titel und Logos, die über der Person liegen, mit ihrer Textfarbe */
  titel?: { box: Box; farbe: string }[]
  /** weitere Personen (von links nach rechts), die Freunde ersetzen */
  weitere?: Person[]
  titel_boxen?: Box[]
  logo_boxen?: Box[]
}

const BOX = { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }
const SCHEMA = {
  type: 'object',
  required: ['inhalt', 'kopf', 'kopf_anteil'],
  properties: {
    inhalt: { type: 'string' },
    kopf: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    kopf_anteil: { type: 'number' },
    pose: { type: 'string' },
    winkel: { type: 'object' },
    mimik: { type: 'string' },
    licht_seite: { type: 'string', enum: ['links', 'rechts'] },
    ansicht: { type: 'string', enum: ['vorn', 'hinten'] },
    ziel: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    blick: { type: 'number' },
    gegenstand: { type: 'object', properties: { box: BOX, suchwort: { type: 'string' }, hand: { type: 'string', enum: ['r', 'l'] } } },
    titel: { type: 'array', items: { type: 'object', required: ['box', 'farbe'], properties: { box: BOX, farbe: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } } } },
    weitere: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kopf', 'kopf_anteil'],
        properties: { kopf: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, kopf_anteil: { type: 'number' }, pose: { type: 'string' }, winkel: { type: 'object' }, ansicht: { type: 'string', enum: ['vorn', 'hinten'] }, blick: { type: 'number' } }
      }
    }
  }
} as const

function lauf(exe: string, args: string[], ctx: JobContext<unknown>, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: env ?? process.env })
    ctx.track(child)
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out = (out + d.toString()).slice(-20000)))
    child.stderr.on('data', (d: Buffer) => (out = (out + d.toString()).slice(-20000)))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`${exe.split(/[\\/]/).pop()} Exit ${code}: ${out.trim().split(/\r?\n/).slice(-2).join(' ')}`))))
  })
}

const existiert = (p: string): Promise<boolean> => stat(p).then(() => true, () => false)

/** Python-Umgebung für Freistellen und Titel (rembg, OpenCV) beim ersten Gebrauch einrichten – läuft auf der CPU. */
export async function sicherePython(uv: string, pyDir: string, ctx: JobContext<unknown>): Promise<string> {
  const python = join(pyDir, 'Scripts', 'python.exe')
  await sichereLama(pyDir, ctx)
  if (await existiert(python)) return python
  ctx.progress(null, 'Richte die Bildwerkzeuge ein (einmalig, ca. 700 MB) …')
  await lauf(uv, ['venv', pyDir, '--python', '3.12'], ctx)
  await lauf(uv, ['pip', 'install', '--python', python, 'rembg==2.0.*', 'onnxruntime', 'opencv-python-headless', 'pillow'], ctx)
  return python
}

/** LaMa-Modell (Apache-2.0, 208 MB) zum sauberen Auffüllen, wo die Person war; ohne Modell füllt OpenCV weich auf. */
export const LAMA_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx'
export const lamaPfad = (pyDir: string): string => join(pyDir, '..', 'modelle', 'lama_fp32.onnx')
async function sichereLama(pyDir: string, ctx: JobContext<unknown>): Promise<void> {
  const ziel = lamaPfad(pyDir)
  if (await existiert(ziel)) return
  ctx.progress(null, 'Lade das Modell zum Auffüllen des Hintergrunds (einmalig, 208 MB) …')
  try {
    const r = await fetch(LAMA_URL)
    if (!r.ok) return
    await mkdir(join(ziel, '..'), { recursive: true })
    await writeFile(`${ziel}.teil`, Buffer.from(await r.arrayBuffer()))
    await rename(`${ziel}.teil`, ziel)
  } catch {
    // ohne Modell geht es mit OpenCV weiter
  }
}

/** Das beste CC0-Modell von Poly Haven zu einem Suchwort (Name, Tags, Kategorien), sonst null. */
export function besterTreffer(assets: Record<string, { name?: string; tags?: string[]; categories?: string[] }>, suchwort: string): string | null {
  const worte = suchwort.toLowerCase().split(/[\s,_-]+/).filter((w) => w.length > 2)
  let bester: [string, number] | null = null
  for (const [id, a] of Object.entries(assets)) {
    const felder = [id, a.name ?? '', ...(a.tags ?? []), ...(a.categories ?? [])].map((x) => x.toLowerCase())
    const punkte = worte.reduce((n, w) => n + (id.includes(w) ? 3 : 0) + felder.filter((f) => f.includes(w)).length, 0)
    if (punkte > 0 && (!bester || punkte > bester[1])) bester = [id, punkte]
  }
  return bester?.[0] ?? null
}

/** Lädt ein Poly-Haven-Modell (glTF 1k mit Texturen) in den Datenordner und trägt die Lizenz ins Log ein. */
export async function ladeRequisit(suchwort: string, props: string): Promise<string | null> {
  const liste = (await (await fetch('https://api.polyhaven.com/assets?t=models')).json()) as Record<string, { name?: string; tags?: string[]; categories?: string[] }>
  const id = besterTreffer(liste, suchwort)
  if (!id) return null
  const ordner = join(props, id)
  const dateien = (await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()) as { gltf?: Record<string, { gltf?: { url: string; include?: Record<string, { url: string }> } }> }
  const g = dateien.gltf?.['1k']?.gltf ?? dateien.gltf?.['2k']?.gltf
  if (!g) return null
  const ziel = join(ordner, g.url.split('/').pop()!)
  if (!(await existiert(ziel))) {
    const laden = async (url: string, pfad: string): Promise<void> => {
      await mkdir(join(pfad, '..'), { recursive: true })
      const r = await fetch(url)
      if (!r.ok) throw new Error(`Poly Haven: ${url} → ${r.status}`)
      await writeFile(pfad, Buffer.from(await r.arrayBuffer()))
    }
    await laden(g.url, ziel)
    for (const [pfad, datei] of Object.entries(g.include ?? {})) await laden(datei.url, join(ordner, ...pfad.split('/')))
    await appendFile(join(props, 'lizenzen.md'), `- ${id} – Poly Haven (polyhaven.com/a/${id}), CC0, geladen ${new Date().toISOString().slice(0, 10)} für eine Spiele-Vorlage\n`)
  }
  return ziel
}

/** Körper und Kopf nur in natürlichen Grenzen drehen (eine Rückansicht kommt über ansicht, nicht über einen verdrehten Rumpf). */
export function begrenzeWinkel(w: Record<string, unknown>): Record<string, unknown> {
  const grenze: Record<string, number> = { koerper: 60, kopf: 70 }
  const neu: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(w)) {
    if (k === 'blick') continue
    if (grenze[k] && v && typeof v === 'object') {
      const g = { ...(v as Record<string, number>) }
      if (typeof g.drehen === 'number') g.drehen = Math.max(-grenze[k]!, Math.min(grenze[k]!, g.drehen))
      neu[k] = g
    } else neu[k] = v
  }
  return neu
}

/**
 * Kopfgröße (Anteil der Bildhöhe): Claudes Schätzung, aber so groß, dass die Figur (etwa 2,2 Kopfbreiten breit) die
 * entfernte Person weitgehend abdeckt. Höchstens +15 % (die Personenbreite enthält oft den ausgestreckten Arm).
 */
export function kopfAnteil(geschaetzt: number | undefined, person: { box?: Box }): number {
  const basis = Math.min(0.7, Math.max(0.15, geschaetzt || 0.35))
  const b = person.box
  const ausBreite = b ? ((b[2] - b[0]) * 1280) / 2.2 / 720 : 0
  return Math.min(0.6, Math.max(basis, Math.min(ausBreite, basis * 1.15)))
}

/**
 * Wo die Freunde stehen: an der Stelle weiterer Personen der Vorlage, sonst neben Philip auf der Seite mit mehr Platz
 * (etwas kleiner, also weiter hinten).
 */
export function freundePlaetze(a: Pick<VorlagenAnalyse, 'kopf' | 'kopf_anteil' | 'weitere' | 'ansicht'>, freunde: { skin: string; slim?: boolean | null }[]): Record<string, unknown>[] {
  const [u, v] = a.kopf
  const seite = u < 0.5 ? 1 : -1
  return freunde.map((f, i) => {
    const w = a.weitere?.[i]
    if (w)
      return {
        skin: f.skin,
        slim: f.slim ?? null,
        kopf: w.kopf,
        kopf_anteil: Math.min(0.6, Math.max(0.1, w.kopf_anteil)),
        pose: w.winkel && Object.keys(w.winkel).length ? begrenzeWinkel(w.winkel) : w.pose ?? 'neutral',
        ansicht: w.ansicht ?? 'vorn',
        ...(typeof w.blick === 'number' ? { blick: w.blick } : {})
      }
    const versatz = (i - (a.weitere?.length ?? 0) + 1) * 0.24
    return { skin: f.skin, slim: f.slim ?? null, kopf: [Math.min(0.9, Math.max(0.1, u + seite * versatz)), v + 0.02], kopf_anteil: a.kopf_anteil * 0.85, pose: 'neutral', ansicht: a.ansicht ?? 'vorn', blick: -seite * 15 }
  })
}

/** Argumente für vorlage_titel.py aus der Analyse (neue Form mit Farbe, ältere Kästen weiter unterstützt). */
export function titelArgumente(a: Pick<VorlagenAnalyse, 'titel' | 'titel_boxen' | 'logo_boxen'>): string[] {
  return [
    ...(a.titel ?? []).filter((t) => t.box?.length === 4 && /^#[0-9a-f]{6}$/i.test(t.farbe)).map((t) => `farbe=${t.farbe}:${t.box.join(',')}`),
    ...(a.titel_boxen ?? []).map((b) => b.join(',')),
    ...(a.logo_boxen ?? []).map((b) => `logo:${b.join(',')}`)
  ]
}

export function analysePrompt(bild: string, posen: string[], beispiele: string, wunsch?: string, freunde: string[] = []): string {
  return `Du hilfst Philip (YouTube-Kanal MoinMorni): Er möchte als sein Minecraft-Skin in dieses Spiele-Thumbnail eines anderen
Creators, genau an die Stelle der Person darin. Sieh dir das Bild an: ${bild}

Bestimme (Bildkoordinaten 0–1, oben links = 0,0):
- inhalt: kurz, was das Thumbnail zeigt
- kopf: [u, v] Mitte des Kopfes der Person
- kopf_anteil: wie hoch der Kopf samt Haaren/Mütze ist, als Anteil der Bildhöhe (Philips Minecraft-Kopf bekommt diese Höhe)
- pose: die passende Pose aus dieser Liste, falls eine genau passt: ${posen.join(', ')}
- winkel: sonst eigene Winkel (ohne blick – die Drehung des ganzen Körpers steht in blick, die Rückansicht in ansicht) wie in diesen Beispielen (drehen positiv = zur rechten Bildseite, heben 90 = nach vorn,
  90 mit drehen 0 zeigt genau in die Kamera; zur Seite zeigen braucht drehen 40–70):
${beispiele}
- mimik: ${MIMIKEN.join(', ')}
- ansicht: "vorn", wenn man das Gesicht der Person sieht, "hinten", wenn man sie von hinten sieht (z. B. Third-Person-Spiel)
- blick: wohin der Körper gedreht ist, in Grad: 0 = frontal zur Kamera (bzw. bei hinten: gerade ins Bild hinein),
  positiv = zur rechten Bildseite, negativ = zur linken (z. B. 40, wenn die Person nach rechts zielt)
- ziel: [u, v], falls die Person auf etwas zielt oder zeigt (z. B. den Gegner) – der Arm mit dem Gegenstand wird
  automatisch genau dorthin gerichtet; sonst weglassen
- licht_seite: von welcher Seite das Hauptlicht auf die Person fällt
- gegenstand: falls die Person etwas in der Hand hält: box [x0, y0, x1, y1] um den Gegenstand samt Effekten wie Mündungsfeuer
  (ohne Hand), suchwort
  (englisch, ein bis zwei Wörter, z. B. "pistol", "sword", "controller", "camera") und hand ("r" = die im Bild linke
  Hand der Person, "l" = die im Bild rechte)
- titel: alle Titel, Schriftzüge und Logos im Bild als Liste {box: [x0, y0, x1, y1], farbe: "#rrggbb"} – die Farbe
  ist die Farbe der Buchstaben selbst (z. B. "#111111" für schwarze, "#ffffff" für weiße Schrift); je Farbe ein Eintrag
${freunde.length ? `- weitere: Philip bringt ${freunde.join(' und ')} mit. Sind weitere Personen im Bild, gib sie hier an (die wichtigsten
  zuerst, höchstens ${freunde.length}): kopf, kopf_anteil, pose oder winkel, ansicht, blick wie oben – sie werden durch die Freunde ersetzt
` : ''}${wunsch ? `\nPhilip wünscht zusätzlich: „${wunsch}“ – berücksichtige das bei Pose, Mimik und Gegenstand.\n` : ''}
Antworte nur mit JSON nach dem Schema.`
}

export async function spielvorlageJob(p: SpielvorlagePayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ varianten: ThumbnailVariante[] }> {
  const c = ctx as JobContext<unknown>
  await mkdir(p.ausgabe, { recursive: true })
  const original = join(p.ausgabe, `original${extname(p.vorlage).toLowerCase() || '.jpg'}`)
  await copyFile(p.vorlage, original)
  const python = await sicherePython(p.uv, p.pyDir, c)
  // Vorlage auf 16:9 bringen (schwarze Balken weg, kleine Bilder hochskaliert) – alle Schritte nutzen genau dieses Bild
  ctx.progress(4, 'Bereite die Vorlage vor …')
  const vorlage = join(p.ausgabe, 'vorlage.png')
  await lauf(python, [join(p.blenderDir, 'vorlage_vorbereiten.py'), original, vorlage], c)

  ctx.progress(8, 'Claude sieht sich die Vorlage an …')
  const prompt = analysePrompt(vorlage, await posenNamen(p.blenderDir), await posenBeispiele(p.blenderDir, ['pistole', 'zeigen', 'panik', 'jubeln', 'nachdenken']), p.wunsch, (p.freunde ?? []).map((f) => f.name))
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt, workDir: join(p.datenOrdner, 'claude-work', 'spielvorlage'), tools: ['Read'], allowedTools: ['Read'], addDirs: [p.ausgabe], maxTurns: 6, jsonSchema: SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte die Vorlage nicht auswerten: ${res.errors.join(' | ') || res.subtype}`)
  const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as VorlagenAnalyse
  await writeFile(join(p.ausgabe, 'analyse.json'), JSON.stringify(a, null, 1))

  await ctx.yield()
  ctx.progress(25, 'Entferne die Person aus der Vorlage …')
  const extra = a.gegenstand?.box ? [a.gegenstand.box.join(',')] : []
  const ersetzt = Math.min(p.freunde?.length ?? 0, a.weitere?.length ?? 0)
  await lauf(python, [join(p.blenderDir, 'freistellen.py'), vorlage, p.ausgabe, ...extra, `--personen=${1 + ersetzt}`], c, { ...process.env, MOIN_LAMA: lamaPfad(p.pyDir) })

  const person = JSON.parse(await readFile(join(p.ausgabe, 'person.json'), 'utf8').catch(() => '{}')) as { box?: Box }
  let requisit: string | null = null
  if (a.gegenstand?.suchwort) {
    ctx.progress(40, `Suche ein echtes 3D-Modell: ${a.gegenstand.suchwort} …`)
    requisit = await ladeRequisit(a.gegenstand.suchwort, join(p.datenOrdner, 'props')).catch(() => null)
  }

  await ctx.yield()
  ctx.progress(50, 'Blender rendert dich an der Stelle der Person …')
  const spec = {
    hintergrund: join(p.ausgabe, 'hintergrund.png'),
    skin: p.skin,
    slim: p.slim ?? null,
    pose: a.winkel && Object.keys(a.winkel).length ? begrenzeWinkel(a.winkel) : a.pose ?? 'neutral',
    mimik: a.mimik && MIMIKEN.includes(a.mimik) ? a.mimik : undefined,
    kopf: a.kopf,
    kopf_anteil: kopfAnteil(a.kopf_anteil, person),
    licht_seite: a.licht_seite ?? 'rechts',
    ansicht: a.ansicht ?? 'vorn',
    ...(a.ziel?.length === 2 ? { ziel: a.ziel } : {}),
    ...(typeof a.blick === 'number' ? { blick: Math.max(-90, Math.min(90, a.blick)) } : {}),
    requisit: requisit ? { gltf: requisit, hand: a.gegenstand?.hand ?? 'r', laenge_px: 10 } : undefined,
    ...(p.freunde?.length ? { freunde: freundePlaetze(a, p.freunde) } : {}),
    samples: p.blender.samples,
    geraet: p.blender.geraet
  }
  const render = join(p.ausgabe, 'render.png')
  await writeFile(join(p.ausgabe, 'spec.json'), JSON.stringify(spec, null, 1))
  const { code } = await runBlender(
    { exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, 'render_vorlage.py'), args: [join(p.ausgabe, 'spec.json'), render, join(p.ausgabe, 'bericht.json')] },
    c
  )
  const bericht = JSON.parse(await readFile(join(p.ausgabe, 'bericht.json'), 'utf8').catch(() => '{}')) as { fehler?: string }
  let bild: string | null = code === 0 && !bericht.fehler ? render : null
  const boxen = titelArgumente(a)
  if (bild && boxen.length) {
    ctx.progress(90, 'Lege den Titel der Vorlage wieder obendrauf …')
    const fertig = join(p.ausgabe, 'fertig.png')
    await lauf(python, [join(p.blenderDir, 'vorlage_titel.py'), vorlage, render, fertig, ...boxen, `--maske=${join(p.ausgabe, 'maske.png')}`], c)
    bild = fertig
  }
  ctx.progress(100, 'Fertig')
  return {
    varianten: [
      {
        titel: `Spiele-Vorlage: ${a.inhalt ?? ''}`.slice(0, 80),
        vorbild: 'spiele-vorlage',
        warum: requisit ? `Mit echtem 3D-Modell (${a.gegenstand?.suchwort}) von Poly Haven` : a.inhalt ?? '',
        bild,
        szene: join(p.ausgabe, 'spec.json'),
        warnungen: [],
        ...(bild ? {} : { fehler: bericht.fehler ?? `Blender Exit ${code}` })
      }
    ]
  }
}
