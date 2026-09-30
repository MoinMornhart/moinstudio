import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import { sichereMcAssets } from '../thumbnail/minecraft'

/**
 * Logo erstellen (Philip, 30.09.: „füge einen weiteren Tab ein, wo man Logos erstellen kann“). Ohne Bildgenerator:
 * Claude plant Text, Stil, Farben, Kontur und ein Symbol (Block, Item oder Kopf aus der echten Spieldatei), Blender baut
 * daraus das Logo (blender/logo_bauen.py) – 2D-Blockschrift oder echter 3D-Blocktext, immer mit transparentem Hintergrund.
 * Änderungen in Worten stehen wie beim Thumbnail als Verlauf unter dem Auftrag.
 */

export interface LogoSpec {
  titel: string
  text: string
  untertitel?: string
  stil: '2d' | '3d'
  fuellung: { art: 'textur'; block: string } | { art: 'verlauf'; oben: string; unten: string }
  kontur: string
  kontur_dicke: 'keine' | 'duenn' | 'mittel' | 'dick'
  schatten: boolean
  symbol?: { art: 'kopf' | 'block' | 'item'; name: string; platz: 'links' | 'rechts' | 'oben'; datei?: string }
  neigung: number
  untertitel_farbe?: string
}

export interface LogoVariante {
  titel: string
  bild: string | null
  /** Bauplan (JSON), für Änderungen */
  szene: string
  warnungen: string[]
  fehler?: string
}

interface Gemeinsam {
  claudeCli: string
  blender: { exe: string; mesa: boolean; geraet: string; samples: number }
  blenderDir: string
  datenOrdner: string
  ausgabe: string
  /** Köpfe von Philip und seinen Freunden (Skin-Dateien) */
  koepfe: { name: string; datei: string }[]
}

export interface LogoPayload extends Gemeinsam {
  beschreibung: string
  kanal: string
  anzahl: number
}

export interface LogoAenderungPayload extends Gemeinsam {
  wunsch: string
  /** Ursprungsauftrag (Verlauf) und geänderte Variante */
  eltern: string
  basis: { job: string; variante: number }
  bild: string
  szene: string
}

/** Mob-Köpfe mit dem gleichen Kopf-Layout wie ein Skin (8×8×8 bei 0,0) */
export const MOB_KOEPFE: Record<string, string> = {
  creeper: 'entity/creeper/creeper.png',
  zombie: 'entity/zombie/zombie.png',
  husk: 'entity/zombie/husk.png',
  drowned: 'entity/zombie/drowned.png',
  skeleton: 'entity/skeleton/skeleton.png',
  wither_skeleton: 'entity/skeleton/wither_skeleton.png',
  stray: 'entity/skeleton/stray.png',
  enderman: 'entity/enderman/enderman.png',
  steve: 'entity/player/wide/steve.png',
  alex: 'entity/player/slim/alex.png'
}

const BEISPIEL_BLOECKE = ['gold_block', 'diamond_block', 'emerald_block', 'iron_block', 'redstone_block', 'lapis_block', 'netherite_block', 'amethyst_block', 'copper_block', 'stone', 'cobblestone', 'deepslate', 'obsidian', 'netherrack', 'oak_planks', 'grass_block', 'tnt', 'crafting_table', 'sand', 'snow_block', 'glowstone']
const BEISPIEL_ITEMS = ['diamond_sword', 'netherite_sword', 'diamond_pickaxe', 'golden_apple', 'ender_pearl', 'totem_of_undying', 'iron_chain', 'compass', 'clock', 'bow', 'trident', 'mace', 'fishing_rod', 'emerald', 'diamond']

const HEX = /^#[0-9a-f]{6}$/i

const VARIANTE = {
  type: 'object',
  required: ['titel', 'text', 'stil', 'fuellung'],
  properties: {
    titel: { type: 'string' },
    text: { type: 'string' },
    untertitel: { type: 'string' },
    stil: { type: 'string', enum: ['2d', '3d'] },
    fuellung: { type: 'object', properties: { art: { type: 'string', enum: ['textur', 'verlauf'] }, block: { type: 'string' }, oben: { type: 'string' }, unten: { type: 'string' } } },
    kontur: { type: 'string' },
    kontur_dicke: { type: 'string', enum: ['keine', 'duenn', 'mittel', 'dick'] },
    schatten: { type: 'boolean' },
    symbol: { type: 'object', properties: { art: { type: 'string', enum: ['kopf', 'block', 'item'] }, name: { type: 'string' }, platz: { type: 'string', enum: ['links', 'rechts', 'oben'] } } },
    neigung: { type: 'number' },
    untertitel_farbe: { type: 'string' }
  }
} as const
export const PLAN_SCHEMA = { type: 'object', required: ['varianten'], properties: { varianten: { type: 'array', items: VARIANTE } } } as const
const AENDERUNG_SCHEMA = { type: 'object', required: ['logo'], properties: { logo: VARIANTE } } as const

/** Was die Spieldatei hat: Blöcke (Blockstates oder Texturen) und Items */
export interface Vorrat {
  bloecke: Set<string>
  items: Set<string>
  /** Mob-Köpfe, deren Textur es gibt → Datei */
  mobs: Record<string, string>
  koepfe: { name: string; datei: string }[]
}

/** Name → vorhandener Name: genau, sonst „…_name“ (chain → iron_chain), sonst enthält den Namen. */
export function findeName(name: string, vorhanden: Set<string>): string | null {
  const n = name.trim().toLowerCase().replace(/^minecraft:/, '').replace(/[\s-]+/g, '_')
  if (!n) return null
  if (vorhanden.has(n)) return n
  const liste = [...vorhanden].sort((a, b) => a.length - b.length || a.localeCompare(b))
  return liste.find((x) => x.endsWith(`_${n}`)) ?? liste.find((x) => x.startsWith(`${n}_`)) ?? liste.find((x) => x.includes(n)) ?? null
}

/**
 * Claudes Bauplan prüfen und vervollständigen: Text kürzen, Farben prüfen, Blocktextur, Item oder Kopf in der Spieldatei
 * finden (sonst Verlauf bzw. ohne Symbol, mit Hinweis). Liefert immer einen baubaren Plan.
 */
export function pruefeLogoSpec(roh: unknown, vorrat: Vorrat): { spec: LogoSpec; warnungen: string[] } {
  const r = (roh ?? {}) as Record<string, unknown>
  const warnungen: string[] = []
  const text = String(r['text'] ?? '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'LOGO'
  const farbe = (x: unknown, standard: string): string => (typeof x === 'string' && HEX.test(x) ? x : standard)
  const f = (r['fuellung'] ?? {}) as Record<string, unknown>
  let fuellung: LogoSpec['fuellung'] = { art: 'verlauf', oben: farbe(f['oben'], '#ffd83a'), unten: farbe(f['unten'], '#ff8a00') }
  if (f['art'] === 'textur') {
    const block = typeof f['block'] === 'string' ? findeName(f['block'], vorrat.bloecke) : null
    if (block) fuellung = { art: 'textur', block }
    else warnungen.push(`Block „${String(f['block'] ?? '')}“ gibt es nicht – Farbverlauf statt Textur.`)
  }
  const s = r['symbol'] as Record<string, unknown> | undefined
  let symbol: LogoSpec['symbol']
  if (s && typeof s === 'object' && typeof s['name'] === 'string' && s['name'].trim()) {
    const platz = s['platz'] === 'rechts' || s['platz'] === 'oben' ? s['platz'] : 'links'
    const name = s['name'].trim()
    if (s['art'] === 'kopf') {
      const k = name.toLowerCase()
      const eigen = vorrat.koepfe.find((x) => x.name.toLowerCase() === k || (['ich', 'philip', 'moinmornhart', 'moinmorni', 'spieler'].includes(k) && x === vorrat.koepfe[0]))
      const mob = findeName(k, new Set(Object.keys(vorrat.mobs)))
      if (eigen) symbol = { art: 'kopf', name: eigen.name, platz, datei: eigen.datei }
      else if (mob) symbol = { art: 'kopf', name: mob, platz, datei: vorrat.mobs[mob] }
    } else if (s['art'] === 'item') {
      const item = findeName(name, vorrat.items)
      if (item) symbol = { art: 'item', name: item, platz }
    } else if (s['art'] === 'block') {
      const block = findeName(name, vorrat.bloecke)
      if (block) symbol = { art: 'block', name: block, platz }
    }
    if (!symbol) warnungen.push(`Symbol „${name}“ gibt es nicht – Logo ohne Symbol.`)
  }
  const dicken = ['keine', 'duenn', 'mittel', 'dick'] as const
  const untertitel = typeof r['untertitel'] === 'string' ? r['untertitel'].replace(/\s+/g, ' ').trim().slice(0, 32) : ''
  const neigung = typeof r['neigung'] === 'number' && Number.isFinite(r['neigung']) ? Math.max(-10, Math.min(10, r['neigung'])) : 0
  return {
    spec: {
      titel: String(r['titel'] ?? text).slice(0, 80),
      text,
      ...(untertitel ? { untertitel, untertitel_farbe: farbe(r['untertitel_farbe'], '#ffffff') } : {}),
      stil: r['stil'] === '3d' ? '3d' : '2d',
      fuellung,
      kontur: farbe(r['kontur'], '#16161c'),
      kontur_dicke: dicken.includes(r['kontur_dicke'] as (typeof dicken)[number]) ? (r['kontur_dicke'] as LogoSpec['kontur_dicke']) : 'mittel',
      schatten: r['schatten'] !== false,
      ...(symbol ? { symbol } : {}),
      neigung
    },
    warnungen
  }
}

/** Bauplan für Claude: ohne Dateipfade */
export function specFuerClaude(spec: LogoSpec): Record<string, unknown> {
  const { symbol, ...rest } = spec
  return { ...rest, ...(symbol ? { symbol: { art: symbol.art, name: symbol.name, platz: symbol.platz } } : {}) }
}

const REGELN = (vorrat: Vorrat): string => `Stil wie bei großen Minecraft-YouTubern: kurze, fette Blockschrift in der echten Minecraft-Schrift, dicke dunkle
Kontur, harter Schatten, kräftige Farben – gut lesbar, auch klein als Wasserzeichen. Kein Fließtext, keine Emojis.
Felder je Logo:
- titel: kurze Beschreibung der Idee (für Philip)
- text: der Schriftzug (höchstens 24 Zeichen, wird groß geschrieben); untertitel: optional eine kleine zweite Zeile
  (höchstens 32 Zeichen), untertitel_farbe als #rrggbb
- stil: "3d" (echte 3D-Blockbuchstaben aus Würfeln, gerendert) oder "2d" (flache Blockschrift mit Tiefe)
- fuellung: {"art": "textur", "block": <Blockname>} – die Buchstaben bekommen die echte Blocktextur – oder
  {"art": "verlauf", "oben": "#rrggbb", "unten": "#rrggbb"}. Gute Blöcke: ${BEISPIEL_BLOECKE.join(', ')} (jeder Block der
  Spieldatei geht)
- kontur: #rrggbb, kontur_dicke: keine, duenn, mittel, dick; schatten: true/false; neigung: -8 bis 8 Grad (0 = gerade)
- symbol (optional): {"art": "kopf" | "block" | "item", "name": …, "platz": "links" | "rechts" | "oben"}
  Köpfe: ${[...vorrat.koepfe.map((k) => k.name), ...Object.keys(vorrat.mobs)].join(', ')} (${vorrat.koepfe[0]?.name ?? 'der erste'} = Philips eigener Skin)
  Items z. B.: ${BEISPIEL_ITEMS.join(', ')} (jedes Item der Spieldatei geht); Blöcke wie oben.`

export function planPrompt(p: Pick<LogoPayload, 'beschreibung' | 'kanal' | 'anzahl'>, vorrat: Vorrat): string {
  return `Du gestaltest ein Logo für Philip (YouTube-Kanal ${p.kanal}, Minecraft und Gaming). Sein Wunsch: „${p.beschreibung}“

Plane ${p.anzahl} deutlich verschiedene Logo-Varianten (verschiedene Stile, Füllungen und Symbole; mindestens eine "3d",
falls mehr als eine Variante). Ist es ein Kanal-Logo, passt Philips eigener Kopf gut als Symbol; bei einer Serie ein
Symbol, das zur Serie passt (z. B. eine Kette für „Chained Together“).
${REGELN(vorrat)}

Antworte nur mit JSON nach dem Schema: {"varianten": [ … ]}.`
}

export function aenderungPrompt(wunsch: string, bild: string, spec: LogoSpec, vorrat: Vorrat): string {
  return `Philip möchte an seinem Logo etwas ändern. Sieh dir das aktuelle Logo an: ${bild}

Sein Wunsch: „${wunsch}“

So ist das Logo gerade gebaut (JSON):
${JSON.stringify(specFuerClaude(spec), null, 1)}

${REGELN(vorrat)}

Ändere nur, was der Wunsch verlangt, alles andere bleibt genau so. Antworte nur mit {"logo": <das vollständige geänderte Logo>}.`
}

/** Blöcke, Items und Mob-Köpfe der entpackten Spieldatei */
async function ladeVorrat(assets: string, koepfe: Gemeinsam['koepfe']): Promise<Vorrat> {
  const namen = async (ordner: string, endung: string): Promise<string[]> =>
    (await readdir(join(assets, ordner)).catch(() => [] as string[])).filter((d) => d.endsWith(endung)).map((d) => d.slice(0, -endung.length))
  const bloecke = new Set([...(await namen('blockstates', '.json')), ...(await namen(join('textures', 'block'), '.png'))])
  const items = new Set(await namen(join('textures', 'item'), '.png'))
  const mobs: Record<string, string> = {}
  for (const [name, rel] of Object.entries(MOB_KOEPFE)) {
    const pfad = join(assets, 'textures', ...rel.split('/'))
    if (await readFile(pfad).then(() => true, () => false)) mobs[name] = pfad
  }
  return { bloecke, items, mobs, koepfe }
}

async function baue(spec: LogoSpec, basis: string, assets: string, p: Gemeinsam, ctx: JobContext<unknown>): Promise<{ bild: string | null; fehler?: string; warnungen: string[] }> {
  const datei = spec.symbol?.art === 'item' ? { datei: join(assets, 'textures', 'item', `${spec.symbol.name}.png`) } : {}
  await writeFile(`${basis}.logo.json`, JSON.stringify({ ...spec, ...(spec.symbol ? { symbol: { ...spec.symbol, ...datei } } : {}), samples: p.blender.samples, geraet: p.blender.geraet }, null, 1))
  const r = await runBlender({ exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, 'logo_bauen.py'), args: [`${basis}.logo.json`, assets, `${basis}.png`, `${basis}.bericht.json`] }, ctx)
  const bericht = JSON.parse(await readFile(`${basis}.bericht.json`, 'utf8').catch(() => '{}')) as { fehler?: string; warnungen?: string[] }
  if (r.code !== 0 || bericht.fehler) return { bild: null, fehler: bericht.fehler ?? `Blender Exit ${r.code}`, warnungen: [] }
  return { bild: `${basis}.png`, warnungen: bericht.warnungen ?? [] }
}

export async function logoJob(p: LogoPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean; plan?: unknown[]; fertig?: LogoVariante[] }>): Promise<{ varianten: LogoVariante[] }> {
  await mkdir(p.ausgabe, { recursive: true })
  ctx.progress(2, 'Minecraft-Texturen prüfen …')
  const mc = await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })
  const vorrat = await ladeVorrat(mc.assets, p.koepfe)
  let plan = ctx.checkpoint?.plan
  if (!plan) {
    ctx.progress(5, 'Claude plant die Logos …')
    const res = await runClaudeInJob({ cli: p.claudeCli, prompt: planPrompt(p, vorrat), workDir: join(p.datenOrdner, 'claude-work', 'logo'), tools: [], maxTurns: 3, jsonSchema: PLAN_SCHEMA }, ctx)
    if (!res.ok) throw new Error(`Claude-Planung fehlgeschlagen: ${res.errors.join(' | ') || res.subtype}`)
    const roh = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { varianten?: unknown[] }
    plan = (roh.varianten ?? []).slice(0, p.anzahl)
    if (!plan.length) throw new Error('Claude hat kein Logo geplant.')
    await ctx.save({ ...(ctx.checkpoint ?? {}), plan })
  }
  const fertig: LogoVariante[] = [...(ctx.checkpoint?.fertig ?? [])]
  for (let i = fertig.length; i < plan.length; i++) {
    await ctx.yield()
    const { spec, warnungen } = pruefeLogoSpec(plan[i], vorrat)
    ctx.progress(Math.round(10 + (i / plan.length) * 88), `Logo ${i + 1}/${plan.length}: ${spec.titel} …`)
    const basis = join(p.ausgabe, `logo-${i + 1}`)
    const r = await baue(spec, basis, mc.assets, p, ctx as JobContext<unknown>)
    fertig.push({ titel: spec.titel, bild: r.bild, szene: `${basis}.logo.json`, warnungen: [...warnungen, ...r.warnungen], ...(r.fehler ? { fehler: r.fehler } : {}) })
    await ctx.save({ ...(ctx.checkpoint ?? {}), plan, fertig })
  }
  ctx.progress(100, 'Fertig')
  return { varianten: fertig }
}

export async function logoAenderungJob(p: LogoAenderungPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ varianten: LogoVariante[] }> {
  await mkdir(p.ausgabe, { recursive: true })
  const mc = await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })
  const vorrat = await ladeVorrat(mc.assets, p.koepfe)
  const alt = pruefeLogoSpec(JSON.parse(await readFile(p.szene, 'utf8')), vorrat).spec
  ctx.progress(5, 'Claude setzt deinen Wunsch um …')
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt: aenderungPrompt(p.wunsch, p.bild, alt, vorrat), workDir: join(p.datenOrdner, 'claude-work', 'logo'), tools: ['Read'], allowedTools: ['Read'], addDirs: [join(p.bild, '..')], maxTurns: 6, jsonSchema: AENDERUNG_SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte den Wunsch nicht umsetzen: ${res.errors.join(' | ') || res.subtype}`)
  const roh = ((res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { logo?: unknown }).logo
  if (!roh || typeof roh !== 'object') throw new Error('Claude hat kein geändertes Logo geliefert.')
  const { spec, warnungen } = pruefeLogoSpec(roh, vorrat)
  await ctx.yield()
  ctx.progress(30, 'Blender baut das geänderte Logo …')
  const basis = join(p.ausgabe, 'logo')
  const r = await baue(spec, basis, mc.assets, p, ctx as JobContext<unknown>)
  ctx.progress(100, 'Fertig')
  return { varianten: [{ titel: `Geändert: ${p.wunsch}`.slice(0, 90), bild: r.bild, szene: `${basis}.logo.json`, warnungen: [...warnungen, ...r.warnungen], ...(r.fehler ? { fehler: r.fehler } : {}) }] }
}
