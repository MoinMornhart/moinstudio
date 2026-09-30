import { spawn } from 'node:child_process'
import { appendFile, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import type { ThumbnailVariante } from './job'
import { MIMIKEN, posenBeispiele, posenNamen } from './reaktion'
import { sicherePakete, sichereUmgebung } from '../python'
import { sichereMcAssets } from './minecraft'
import { logoAufsetzen, sperrenVorlage, type LogoWahl } from '../logo/setzen'

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
  /** Logo aus der Bibliothek – kommt zuletzt in eine freie Ecke */
  logo?: LogoWahl
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
  /** Kasten um die ganze Person samt Armen, Beinen und Gehaltenem */
  box?: Box
  kopf: [number, number]
  kopf_anteil: number
  pose?: string
  winkel?: Record<string, unknown>
  ansicht?: 'vorn' | 'hinten'
  blick?: number
}

/** Verbindung zwischen zwei Personen der Vorlage (Kette, Seil …); „ich“ = Philip, „freund0“ … = weitere[0] … */
export interface Verbindung {
  von: string
  zu: string
  art: 'kette' | 'seil' | 'leine'
  von_punkt?: 'huefte' | 'hand_r' | 'hand_l' | 'hals' | 'fuss_r' | 'fuss_l'
  zu_punkt?: 'huefte' | 'hand_r' | 'hand_l' | 'hals' | 'fuss_r' | 'fuss_l'
  /** Kasten um die Verbindung im Bild (wird entfernt und neu gezeichnet) */
  box?: Box
}

export interface VorlagenAnalyse {
  inhalt: string
  /** Kasten um die Person, die Philip ersetzt */
  box?: Box
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
  verbindungen?: Verbindung[]
  titel_boxen?: Box[]
  logo_boxen?: Box[]
}

const BOX = { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 }
const PUNKTE = ['huefte', 'hand_r', 'hand_l', 'hals', 'fuss_r', 'fuss_l']
const SCHEMA = {
  type: 'object',
  required: ['inhalt', 'kopf', 'kopf_anteil'],
  properties: {
    inhalt: { type: 'string' },
    box: BOX,
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
        properties: { box: BOX, kopf: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, kopf_anteil: { type: 'number' }, pose: { type: 'string' }, winkel: { type: 'object' }, ansicht: { type: 'string', enum: ['vorn', 'hinten'] }, blick: { type: 'number' } }
      }
    },
    verbindungen: {
      type: 'array',
      items: {
        type: 'object',
        required: ['von', 'zu', 'art'],
        properties: { von: { type: 'string' }, zu: { type: 'string' }, art: { type: 'string', enum: ['kette', 'seil', 'leine'] }, von_punkt: { type: 'string', enum: PUNKTE }, zu_punkt: { type: 'string', enum: PUNKTE }, box: BOX }
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
  await sichereLama(pyDir, ctx)
  const python = await sichereUmgebung(uv, pyDir, ctx)
  await sicherePakete(uv, python, 'rembg, cv2, PIL', ['rembg==2.0.*', 'onnxruntime', 'opencv-python-headless', 'pillow'], ctx, 'Richte die Bildwerkzeuge ein (einmalig, ca. 700 MB) …')
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
export function kopfAnteil(geschaetzt: number | undefined, person: { box?: Box; hoehe?: number }): number {
  // Untergrenze aus der erkannten Person: ein Minecraft-Kopf ist ein Viertel der Figurhöhe (ein Mensch ~⅐), bei einer
  // ganz sichtbaren Person muss der Kopf also größer sein als ihr echter, damit der Körper sie abdeckt
  const basis = Math.min(0.7, Math.max(0.15, geschaetzt || 0.35, (person.hoehe ?? 0) * 0.25))
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

/** Urteil der Schlussprüfung: passt es, was stimmt nicht, und die Korrektur als Teil der Szene */
export interface Pruefung {
  passt: boolean
  probleme?: string[]
  korrektur?: Record<string, unknown>
}

const PRUEF_SCHEMA = {
  type: 'object',
  required: ['passt'],
  properties: { passt: { type: 'boolean' }, probleme: { type: 'array', items: { type: 'string' } }, korrektur: { type: 'object' } }
} as const

/** Felder der Szene, die die Schlussprüfung ändern darf (Pfade, Skins und Masken nie) */
const KORRIGIERBAR = ['kopf', 'kopf_anteil', 'pose', 'mimik', 'blick', 'ansicht', 'ziel', 'licht_seite', 'kopf_drehung', 'verbindungen']
const KORRIGIERBAR_FREUND = ['kopf', 'kopf_anteil', 'pose', 'blick', 'ansicht']

/** Korrektur der Schlussprüfung übernehmen: nur erlaubte Felder, Freunde je Index. */
export function korrigiere(spec: Record<string, unknown>, k: Record<string, unknown>): void {
  for (const feld of KORRIGIERBAR) if (feld in k && k[feld] !== undefined) spec[feld] = feld === 'pose' && k[feld] && typeof k[feld] === 'object' ? begrenzeWinkel(k[feld] as Record<string, unknown>) : k[feld]
  if (typeof spec['kopf_anteil'] === 'number') spec['kopf_anteil'] = Math.min(0.7, Math.max(0.08, spec['kopf_anteil']))
  if (Array.isArray(k['freunde']) && Array.isArray(spec['freunde'])) {
    const freunde = spec['freunde'] as Record<string, unknown>[]
    ;(k['freunde'] as (Record<string, unknown> | null)[]).forEach((fk, i) => {
      if (!fk || !freunde[i]) return
      for (const feld of KORRIGIERBAR_FREUND) if (feld in fk && fk[feld] !== undefined) freunde[i]![feld] = feld === 'pose' && fk[feld] && typeof fk[feld] === 'object' ? begrenzeWinkel(fk[feld] as Record<string, unknown>) : fk[feld]
    })
  }
}

export function pruefPrompt(vorlage: string, ergebnis: string, spec: Record<string, unknown>, wunsch?: string): string {
  const zeigen = { ...spec }
  for (const k of ['hintergrund', 'skin', 'maske', 'texturen', 'samples', 'geraet', 'requisit']) delete zeigen[k]
  return `Philip wurde als Minecraft-Figur in ein Spiele-Thumbnail gesetzt, an die Stelle der Person(en) darin.
Original: ${vorlage}
Ergebnis: ${ergebnis}
${wunsch ? `Philips Wunsch dazu: „${wunsch}“\n` : ''}
Sieh dir beide Bilder an und prüfe streng, ob das Ergebnis dem Original entspricht:
- Steht jede Figur genau dort, wo die Person stand, in derselben Größe (Minecraft-Figuren sind kopflastiger – der
  Körper muss die Person trotzdem etwa ausfüllen) und nicht abgeschnitten, wo die Person es nicht war?
- Stimmt die Haltung des GANZEN Körpers (Arme, Beine, Neigung, Sprung, Klettern, Sitzen) und die Blickrichtung?
- Sind Personen verbunden (Kette, Seil), ist die Verbindung da und hängt an den richtigen Stellen?
- Sind Reste der alten Personen sichtbar (Geist, Hand, Kopf)?
- Wirkt es wie ein fertiges Thumbnail (Figur gut sichtbar, Gesicht frei, nichts Seltsames)?

Die Szene (Bildkoordinaten 0–1, oben links = 0,0; pose = Posen-Name oder Winkel arm_r/arm_l {heben, seitlich, drehen,
beugen}, bein_r/bein_l {vor, seitlich, beugen}, koerper {drehen, vor, neigen}, kopf {drehen, nicken, neigen}, kippen,
kippen_seite; blick = Körperdrehung in Grad, positiv = zur rechten Bildseite; kopf_anteil = Kopfhöhe als Anteil der
Bildhöhe; freunde = weitere Figuren mit denselben Feldern; verbindungen = [{von, zu, art, von_punkt, zu_punkt}] mit
"ich"/"freund0"…, Punkte huefte, hand_r, hand_l, hals, fuss_r, fuss_l):
${JSON.stringify(zeigen, null, 1)}

Antworte nur mit JSON: {"passt": true|false, "probleme": ["kurz, auf Deutsch"], "korrektur": {nur die Felder, die sich
ändern müssen – z. B. "kopf_anteil", "kopf", "pose", "blick", "freunde": [{…} je Freund oder null], "verbindungen"}}.
Größer machen = kopf_anteil erhöhen. Passt alles, "passt": true und keine Korrektur.`
}

/** Lage einer Person nach dem Freistellen (person.json, je Person eine Maske) */
export interface FreigestelltePerson {
  box?: Box
  kopf?: [number, number]
  hoehe?: number
  unten_angeschnitten?: boolean
  maske?: string
}

/** Kästen der Personen, die ersetzt werden (Philip zuerst, dann so viele weitere, wie Freunde mitkommen) → freistellen.py */
export function personenArgumente(a: Pick<VorlagenAnalyse, 'box' | 'weitere'>, ersetzt: number): string[] {
  if (!a.box || a.box.length !== 4) return []
  const boxen = [a.box, ...(a.weitere ?? []).slice(0, ersetzt).map((w) => w.box)]
  if (boxen.some((b) => !b || b.length !== 4)) return [`--person=${a.box.join(',')}`]
  return boxen.map((b) => `--person=${b!.map((z) => Math.min(1, Math.max(0, z))).join(',')}`)
}

/** Nur Verbindungen, deren beide Enden ersetzt werden – sonst bleibt die Verbindung der Vorlage im Bild. */
export function gueltigeVerbindungen(a: Pick<VorlagenAnalyse, 'verbindungen'>, ersetzt: number): Verbindung[] {
  const da = new Set(['ich', ...Array.from({ length: ersetzt }, (_, i) => `freund${i}`)])
  return (a.verbindungen ?? []).filter((v) => da.has(v.von) && da.has(v.zu) && v.von !== v.zu && ['kette', 'seil', 'leine'].includes(v.art))
}

/** Deckt die Figur weniger als 55 % der entfernten Person ab, wird sie um 20 % größer (höchstens Kopf 70 % der Bildhöhe). */
export function groesserBeiLuecke(kopfAnteil: number, deckung: number | undefined): number {
  if (deckung === undefined || deckung >= 0.55) return kopfAnteil
  // Fläche wächst mit dem Quadrat der Größe: Faktor √(0,65 / Deckung), mindestens 1,2, höchstens 1,6
  const faktor = Math.min(1.6, Math.max(1.2, Math.sqrt(0.65 / Math.max(deckung, 0.01))))
  return Math.min(0.7, Math.round(kopfAnteil * faktor * 1000) / 1000)
}

/** Argumente für vorlage_titel.py aus der Analyse (neue Form mit Farbe, ältere Kästen weiter unterstützt). */
/**
 * Titel, die wirklich über der Person liegen: gültige Farbe und höchstens ein Drittel der Bildfläche. Riesige Logos
 * (z. B. das goldene „007“ hinter Bond) sind Hintergrund – die dürfen weder entfernt noch über die Figur gelegt werden.
 */
export function echteTitel(a: Pick<VorlagenAnalyse, 'titel'>): { box: Box; farbe: string }[] {
  return (a.titel ?? []).filter((t) => t.box?.length === 4 && /^#[0-9a-f]{6}$/i.test(t.farbe) && (t.box[2] - t.box[0]) * (t.box[3] - t.box[1]) <= 0.33)
}

export function titelArgumente(a: Pick<VorlagenAnalyse, 'titel' | 'titel_boxen' | 'logo_boxen'>): string[] {
  return [
    ...echteTitel(a).map((t) => `farbe=${t.farbe}:${t.box.join(',')}`),
    ...(a.titel_boxen ?? []).map((b) => b.join(',')),
    ...(a.logo_boxen ?? []).map((b) => `logo:${b.join(',')}`)
  ]
}

export function analysePrompt(bild: string, posen: string[], beispiele: string, wunsch?: string, freunde: string[] = []): string {
  return `Du hilfst Philip (YouTube-Kanal MoinMorni): Er möchte als sein Minecraft-Skin in dieses Spiele-Thumbnail eines anderen
Creators, genau an die Stelle der Person darin. Sieh dir das Bild an: ${bild}

Das Bild kann alles zeigen: echte Menschen, gerenderte Spielfiguren, Comic, Roboter, Tiere mit Körper; eine oder mehrere
Personen; von vorn, von der Seite oder von hinten; stehend, springend, kletternd, hängend, sitzend, liegend, fallend.
Die Person, die Philip ersetzt, ist die wichtigste (meist die größte oder die im Vordergrund).

Bestimme (Bildkoordinaten 0–1, oben links = 0,0):
- inhalt: kurz, was das Thumbnail zeigt
- box: [x0, y0, x1, y1] Kasten um die GANZE Person – mit Kopf, ausgestreckten Armen, Beinen und dem, was sie hält; lieber
  etwas zu groß als zu klein (alles darin wird entfernt und durch Philip ersetzt)
- kopf: [u, v] Mitte des Kopfes der Person
- kopf_anteil: wie hoch der Kopf samt Haaren/Mütze ist, als Anteil der Bildhöhe (Philips Minecraft-Kopf bekommt diese Höhe)
- pose: die passende Pose aus dieser Liste, falls eine genau passt: ${posen.join(', ')}
- winkel: sonst eigene Winkel für den GANZEN Körper (ohne blick – die Drehung des ganzen Körpers steht in blick, die
  Rückansicht in ansicht): arm_r/arm_l {heben, seitlich, drehen, beugen}, bein_r/bein_l {vor, seitlich, beugen},
  koerper {drehen, vor, neigen}, kopf {drehen, nicken, neigen}, kippen (ganzer Körper nach hinten +, nach vorn −, z. B.
  −40 für einen Hechtsprung), kippen_seite. Beine gehören immer dazu, wenn die Person nicht einfach steht (springt,
  klettert, rennt, sitzt, fällt). Beispiele (drehen positiv = zur rechten Bildseite, heben 90 = nach vorn,
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
- titel: nur Titel, Schriftzüge und Logos, die VOR der Person liegen oder sie teilweise überdecken, als Liste
  {box: [x0, y0, x1, y1], farbe: "#rrggbb"} – die Farbe ist die der Buchstaben selbst (z. B. "#111111" für schwarze,
  "#ffffff" für weiße Schrift); je Farbe ein Eintrag. Große Logos oder Buchstaben im Hintergrund HINTER der Person
  (z. B. ein riesiges „007“, vor dem sie steht) gehören nicht dazu – sonst leere Liste
${freunde.length ? `- weitere: Philip bringt ${freunde.join(' und ')} mit. Sind weitere Personen im Bild, gib sie hier an (die wichtigsten
  zuerst, höchstens ${freunde.length}): box, kopf, kopf_anteil, pose oder winkel (mit Beinen), ansicht, blick wie oben –
  sie werden durch die Freunde ersetzt, in genau ihrer Größe und Haltung
- verbindungen: sind Personen miteinander verbunden (Kette, Seil, Leine), je Verbindung {von, zu, art, von_punkt,
  zu_punkt, box}: "ich" = die Person, die Philip ersetzt, "freund0", "freund1" … = weitere[0], weitere[1] …; punkt:
  huefte, hand_r, hand_l, hals, fuss_r, fuss_l (wo die Verbindung an der Person hängt); box = Kasten um die Verbindung
  im Bild. Die Verbindung gehört dann NICHT in gegenstand – sie wird zwischen den Figuren neu gezeichnet
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
  const prompt = analysePrompt(vorlage, await posenNamen(p.blenderDir), await posenBeispiele(p.blenderDir, ['pistole', 'zeigen', 'panik', 'hechtsprung', 'klettern', 'sitzen', 'rennen']), p.wunsch, (p.freunde ?? []).map((f) => f.name))
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt, workDir: join(p.datenOrdner, 'claude-work', 'spielvorlage'), tools: ['Read'], allowedTools: ['Read'], addDirs: [p.ausgabe], maxTurns: 6, jsonSchema: SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte die Vorlage nicht auswerten: ${res.errors.join(' | ') || res.subtype}`)
  const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as VorlagenAnalyse
  await writeFile(join(p.ausgabe, 'analyse.json'), JSON.stringify(a, null, 1))

  await ctx.yield()
  ctx.progress(25, 'Entferne die Person aus der Vorlage …')
  const ersetzt = Math.min(p.freunde?.length ?? 0, a.weitere?.length ?? 0)
  const verbindungen = gueltigeVerbindungen(a, ersetzt)
  const extra = [...(a.gegenstand?.box ? [a.gegenstand.box] : []), ...verbindungen.flatMap((v) => (v.box ? [v.box] : []))].map((b) => b.join(','))
  const freistellen = (): Promise<string> =>
    lauf(python, [join(p.blenderDir, 'freistellen.py'), vorlage, p.ausgabe, ...extra, `--personen=${1 + ersetzt}`, ...personenArgumente(a, ersetzt), ...echteTitel(a).map((t) => `--titel=${t.farbe}:${t.box.join(',')}`)], c, { ...process.env, MOIN_LAMA: lamaPfad(p.pyDir) })
  // Bei knappem Arbeitsspeicher scheitern OpenCV/ONNX gelegentlich („Unknown C++ exception“, „bad allocation“) – kurz
  // warten und noch einmal
  await freistellen().catch(async () => {
    ctx.progress(null, 'Freistellen hat nicht geklappt – versuche es noch einmal …')
    await new Promise((r) => setTimeout(r, 5000))
    return freistellen()
  })

  const person = JSON.parse(await readFile(join(p.ausgabe, 'person.json'), 'utf8').catch(() => '{}')) as FreigestelltePerson & { personen?: FreigestelltePerson[] }
  const mitMaske = (x?: FreigestelltePerson): FreigestelltePerson | undefined => (x?.maske ? { ...x, maske: join(p.ausgabe, x.maske) } : x)
  const texturen = verbindungen.length ? (await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })).textures : undefined
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
    ...(p.freunde?.length ? { freunde: freundePlaetze(a, p.freunde).map((f, i) => (i < ersetzt && person.personen?.[i + 1] ? { ...f, person: mitMaske(person.personen[i + 1]) } : f)) } : {}),
    ...(person.personen ? { person: mitMaske(person.personen[0]) } : {}),
    ...(verbindungen.length ? { verbindungen, texturen } : {}),
    maske: join(p.ausgabe, 'maske.png'),
    samples: p.blender.samples,
    geraet: p.blender.geraet
  }
  const render = join(p.ausgabe, 'render.png')
  // Vorabprüfung (schnell, ohne Render): deckt die Figur die entfernte Person genug ab? Sonst bleibt deren aufgefüllter
  // Umriss als „Geist“ sichtbar – dann wird die Figur größer (höchstens dreimal, Kopf bleibt im Bild). Mit getrennten
  // Personen passt Blender jede Figur selbst in ihren Umriss ein (_einpassen), dann entfällt diese Schleife.
  for (let versuch = 0; versuch < (person.personen ? 0 : 3); versuch++) {
    await writeFile(join(p.ausgabe, 'pruefung.json'), JSON.stringify({ ...spec, nur_pruefen: true }, null, 1))
    await runBlender({ exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, 'render_vorlage.py'), args: [join(p.ausgabe, 'pruefung.json'), render, join(p.ausgabe, 'pruefung.bericht.json')] }, c)
    const pruefung = JSON.parse(await readFile(join(p.ausgabe, 'pruefung.bericht.json'), 'utf8').catch(() => '{}')) as { deckung?: number }
    const neu = groesserBeiLuecke(spec.kopf_anteil, pruefung.deckung)
    if (neu === spec.kopf_anteil) break
    ctx.progress(50 + versuch * 3, `Figur deckt die alte Person nur zu ${Math.round((pruefung.deckung ?? 0) * 100)} % ab – größer …`)
    spec.kopf_anteil = neu
  }
  const boxen = titelArgumente(a)
  const rendern = async (fortschritt: number): Promise<{ bild: string | null; code: number | null; bericht: { fehler?: string; deckung?: number } }> => {
    await writeFile(join(p.ausgabe, 'spec.json'), JSON.stringify(spec, null, 1))
    ctx.progress(fortschritt, 'Blender rendert …')
    const { code } = await runBlender(
      { exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, 'render_vorlage.py'), args: [join(p.ausgabe, 'spec.json'), render, join(p.ausgabe, 'bericht.json')] },
      c
    )
    const bericht = JSON.parse(await readFile(join(p.ausgabe, 'bericht.json'), 'utf8').catch(() => '{}')) as { fehler?: string; deckung?: number }
    let bild: string | null = code === 0 && !bericht.fehler ? render : null
    if (bild && boxen.length) {
      ctx.progress(fortschritt + 4, 'Lege den Titel der Vorlage wieder obendrauf …')
      const fertig = join(p.ausgabe, 'fertig.png')
      await lauf(python, [join(p.blenderDir, 'vorlage_titel.py'), vorlage, render, fertig, ...boxen, `--maske=${join(p.ausgabe, 'maske.png')}`], c)
      bild = fertig
    }
    return { bild, code, bericht }
  }
  let { bild, code, bericht } = await rendern(62)

  // Schlussprüfung (Philip, 30.09.: „Es kann nicht sein, dass ich dir immer schreiben muss, weil das Thumbnail nicht
  // passt“): Claude legt Original und Ergebnis nebeneinander und korrigiert, was nicht passt – höchstens zweimal
  const probleme: string[] = []
  for (let runde = 0; runde < 2 && bild; runde++) {
    await ctx.yield()
    ctx.progress(75 + runde * 10, 'Claude vergleicht mit dem Original …')
    await ctx.save({ ...(ctx.checkpoint ?? {}), claudePrompted: false, claudeSession: undefined })
    const pr = await runClaudeInJob(
      { cli: p.claudeCli, prompt: pruefPrompt(vorlage, bild, spec, p.wunsch), workDir: join(p.datenOrdner, 'claude-work', 'spielvorlage'), tools: ['Read'], allowedTools: ['Read'], addDirs: [p.ausgabe], maxTurns: 6, jsonSchema: PRUEF_SCHEMA },
      ctx
    ).catch(() => null)
    if (!pr?.ok) break
    const urteil = (pr.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(pr.text)?.[0] ?? '{}')) as Pruefung
    await writeFile(join(p.ausgabe, `pruefung-${runde + 1}.json`), JSON.stringify(urteil, null, 1))
    probleme.splice(0, probleme.length, ...(urteil.probleme ?? []))
    if (urteil.passt || !urteil.korrektur || !Object.keys(urteil.korrektur).length) break
    korrigiere(spec, urteil.korrektur)
    ;({ bild, code, bericht } = await rendern(78 + runde * 10))
  }
  const warnungen = [
    ...(bericht.deckung !== undefined && bericht.deckung < 0.45 ? [`Deine Figur deckt die alte Person nur zu ${Math.round(bericht.deckung * 100)} % ab – schreib unten z. B. „Figur größer“.`] : []),
    ...probleme.map((x) => `Noch offen: ${x}`)
  ]
  const logo = bild && p.logo ? await logoAufsetzen({ bild, logo: p.logo, sperren: await sperrenVorlage(join(p.ausgabe, 'bericht.json'), join(p.ausgabe, 'analyse.json'), spec), ausgabe: join(p.ausgabe, 'mit-logo.png'), blender: p.blender, blenderDir: p.blenderDir }, c) : null
  ctx.progress(100, 'Fertig')
  return {
    varianten: [
      {
        titel: `Spiele-Vorlage: ${a.inhalt ?? ''}`.slice(0, 80),
        vorbild: 'spiele-vorlage',
        warum: requisit ? `Mit echtem 3D-Modell (${a.gegenstand?.suchwort}) von Poly Haven` : a.inhalt ?? '',
        bild: logo?.bild ?? bild,
        szene: join(p.ausgabe, 'spec.json'),
        warnungen: [...warnungen, ...(logo?.warnungen ?? [])],
        ...(logo?.logo ? { logo: logo.logo } : {}),
        ...(bild ? {} : { fehler: bericht.fehler ?? `Blender Exit ${code}` })
      }
    ]
  }
}
