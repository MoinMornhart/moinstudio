/**
 * Mob-Modelle (ROADMAP 4.6): Geometrie aus Mojangs offiziellen bedrock-samples in `resources/minecraft/mobs.json`.
 * Nur Maße und Texturbereiche – die Texturen kommen zur Laufzeit aus der Spieldatei des Nutzers, nie ins Repo.
 *
 *   node scripts/mobs-import.mts
 *
 * Tabellenformat je Mob: { texture, tex_size, height_px, scale?, parts: [{ name, parent, pivot, rotation, boxes:
 * [{ origin, size, uv, inflate, mirror }] }] } in Bedrock-Koordinaten (y oben, Blick nach −z, rechte Seite −x, Pixel).
 * Berücksichtigt: bind_pose_rotation, Würfel mit eigener Drehung (eigener Kind-Knochen), Einzelflächen-UVs mit
 * Vergrößerung (Ghast), Grundhaltung aus Animationsdateien (Wächter-Stacheln), Anheben unter den Boden ragender Mobs.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

const GEO = 'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/models/entity/'
const ANIM = 'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/animations/'
const AUSGABE = 'resources/minecraft/mobs.json'
const TEXTUREN = join(process.env['LOCALAPPDATA'] ?? '', 'MoinStudio', 'mc', '26.3', 'extracted', 'assets', 'minecraft', 'textures')

type Vec = [number, number, number]
interface Box { origin: Vec; size: Vec; uv: [number, number]; inflate: number; mirror: boolean }
interface Part { name: string; parent: string | null; pivot: Vec; rotation: Vec; boxes: Box[] }
interface Spec {
  key: string
  geo: string
  id?: string
  texture: string
  scale?: number
  /** ausgeblendete Knochen (z. B. verschränkte Arme, wenn Einzelarme sichtbar) */
  hide?: string[]
  /** Grundhaltung aus einer Animationsdatei; `ziel`: Animationen, deren Position die Würfelmitte angibt */
  anim?: { datei: string; namen: string[]; ziel?: string[]; vars?: Record<string, number> }
  /** Drehungen aus dem Spielcode (Körper von Vierbeinern) */
  rot?: Record<string, Vec>
  /** alle Knochen unabhängig (Beine drehen nicht mit dem Körper) */
  flach?: boolean
  /** unter den Boden ragende Teile anheben (Ghast-Tentakel) */
  anheben?: boolean
  /** Würfel einzelner Knochen verschieben (Lage aus dem Spielcode, z. B. Blaze-Stäbe, Enderman-Kopf) */
  versatz?: Record<string, Vec>
  /** Datei mit der Elterngeometrie bei `geometry.a:geometry.b` (Hexe erbt vom Dorfbewohner) */
  erbt?: string
}

/** Blaze-Stäbe in Ruhe (Spielcode BlazeModel, Zeit 0): drei Ringe zu je vier Stäben; Java-y zeigt nach unten. */
function blazeStaebe(): Record<string, Vec> {
  const v: Record<string, Vec> = {}
  const ring = (von: number, start: number, radius: number, y: (i: number) => number): void => {
    let f = start
    for (let i = von; i < von + 4; i++, f++) v[`upper_body_parts${i}`] = [Math.cos(f) * radius, -y(i), Math.sin(f) * radius]
  }
  ring(0, 0, 9, (i) => -2 + Math.cos(i * 2 * 0.25))
  ring(4, Math.PI / 4, 7, (i) => 2 + Math.cos(i * 2 * 0.25))
  ring(8, 0.47123894, 5, (i) => 11 + Math.cos(i * 1.5 * 0.5))
  return v
}

const VIERBEINER = { rot: { body: [90, 0, 0] as Vec }, flach: true }
const MOBS: Spec[] = [
  { key: 'zombie', geo: 'zombie.geo.json', texture: 'entity/zombie/zombie.png' },
  { key: 'husk', geo: 'zombie.geo.json', texture: 'entity/zombie/husk.png', scale: 1.0625 },
  { key: 'drowned', geo: 'drowned.geo.json', texture: 'entity/zombie/drowned.png' },
  { key: 'skeleton', geo: 'skeleton.geo.json', texture: 'entity/skeleton/skeleton.png' },
  { key: 'stray', geo: 'skeleton.geo.json', texture: 'entity/skeleton/stray.png' },
  { key: 'wither_skeleton', geo: 'skeleton.geo.json', texture: 'entity/skeleton/wither_skeleton.png', scale: 1.2 },
  { key: 'creeper', geo: 'creeper.geo.json', texture: 'entity/creeper/creeper.png' },
  { key: 'spider', geo: 'spider.geo.json', texture: 'entity/spider/spider.png' },
  { key: 'enderman', geo: 'enderman.geo.json', texture: 'entity/enderman/enderman.png', versatz: { head: [0, 14, 0] }, anheben: true },
  { key: 'pillager', geo: 'pillager.geo.json', texture: 'entity/illager/pillager.png' },
  { key: 'vindicator', geo: 'vindicator.geo.json', texture: 'entity/illager/vindicator.png', hide: ['arms'] },
  { key: 'evoker', geo: 'evoker.geo.json', texture: 'entity/illager/evoker.png', hide: ['right_arm', 'left_arm'] },
  { key: 'witch', geo: 'witch.geo.json', texture: 'entity/witch.png', erbt: 'villager.geo.json' },
  { key: 'villager', geo: 'villager_v2.geo.json', texture: 'entity/villager/villager.png' },
  { key: 'iron_golem', geo: 'iron_golem.geo.json', texture: 'entity/iron_golem/iron_golem.png' },
  { key: 'snow_golem', geo: 'snow_golem.geo.json', texture: 'entity/snow_golem.png' },
  { key: 'piglin', geo: 'piglin.geo.json', texture: 'entity/piglin/piglin.png' },
  { key: 'blaze', geo: 'blaze.geo.json', texture: 'entity/blaze.png', versatz: blazeStaebe() },
  { key: 'ghast', geo: 'ghast.geo.json', texture: 'entity/ghast/ghast.png', anheben: true },
  { key: 'warden', geo: 'warden.geo.json', texture: 'entity/warden/warden.png' },
  { key: 'pig', geo: 'pig.v3.geo.json', texture: 'entity/pig/pig_temperate.png', flach: true },
  { key: 'cow', geo: 'cow.v2.geo.json', texture: 'entity/cow/cow_temperate.png', ...VIERBEINER },
  { key: 'wolf', geo: 'wolf.geo.json', texture: 'entity/wolf/wolf.png' },
  { key: 'chicken', geo: 'chicken.geo.json', texture: 'entity/chicken/chicken_temperate.png' },
  { key: 'bee', geo: 'bee.geo.json', texture: 'entity/bee/bee.png' },
  { key: 'horse', geo: 'horse_v3.geo.json', texture: 'entity/horse/horse_brown.png' },
  { key: 'ravager', geo: 'ravager.geo.json', texture: 'entity/illager/ravager.png' },
  { key: 'phantom', geo: 'phantom.geo.json', texture: 'entity/phantom.png' },
  { key: 'slime', geo: 'slime.geo.json', texture: 'entity/slime/slime.png' },
  { key: 'polar_bear', geo: 'polar_bear.geo.json', texture: 'entity/bear/polarbear.png', ...VIERBEINER },
  {
    key: 'guardian', geo: 'guardian.geo.json', texture: 'entity/guardian.png',
    anim: { datei: 'guardian.animation.json', namen: ['animation.guardian.setup', 'animation.guardian.spikes', 'animation.guardian.swim'], ziel: ['animation.guardian.spikes'] }
  }
]

function knochenName(roh: string, pivot: Vec): string {
  const s = roh.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
    .replace(/^rightarm$/, 'right_arm').replace(/^leftarm$/, 'left_arm').replace(/^rightleg$/, 'right_leg').replace(/^leftleg$/, 'left_leg')
  if (/^leg\d$/.test(s)) return `${pivot[0] < 0 ? 'right' : 'left'}_${pivot[2] < 0 ? 'front' : 'hind'}_leg`
  return s
}

function findeTextur(pfad: string): string | null {
  if (existsSync(join(TEXTUREN, pfad))) return pfad
  const gesucht = basename(pfad)
  const suche = (ordner: string): string | null => {
    for (const f of readdirSync(ordner)) {
      const voll = join(ordner, f)
      if (statSync(voll).isDirectory()) {
        const t = suche(voll)
        if (t) return t
      } else if (f === gesucht) return relative(TEXTUREN, voll).replace(/\\/g, '/')
    }
    return null
  }
  return suche(join(TEXTUREN, 'entity'))
}

function pngGroesse(datei: string): [number, number] {
  const b = readFileSync(datei)
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

interface FaceUv { uv: number[]; uv_size: number[] }
interface GeoBone { name: string; parent?: string; pivot?: number[]; rotation?: number[]; bind_pose_rotation?: number[]; neverRender?: boolean; mirror?: boolean; cubes?: { origin: number[]; size: number[]; uv: number[] | Record<string, FaceUv>; inflate?: number; mirror?: boolean; pivot?: number[]; rotation?: number[] }[] }

function geometrie(json: Record<string, unknown>, id?: string): { tex: [number, number]; bones: GeoBone[]; eltern?: string } {
  const neu = json['minecraft:geometry'] as { description: { identifier: string; texture_width?: number; texture_height?: number }; bones: GeoBone[] }[] | undefined
  if (neu) {
    const g = (id ? neu.find((m) => m.description.identifier === id) : undefined) ?? neu[0]!
    return { tex: [g.description.texture_width ?? 64, g.description.texture_height ?? 64], bones: g.bones }
  }
  const keys = Object.keys(json).filter((k) => k.startsWith('geometry.'))
  const key = (id && keys.find((k) => k.startsWith(id))) || keys.find((k) => !k.includes(':')) || keys[0]!
  const g = json[key] as { texturewidth?: number; textureheight?: number; bones: GeoBone[] }
  return { tex: [g.texturewidth ?? 64, g.textureheight ?? 64], bones: g.bones, eltern: key.split(':')[1] }
}

/** Knochen der Elterngeometrie übernehmen; gleichnamige Knochen des Kindes gewinnen. */
function erben(eltern: GeoBone[], kind: GeoBone[]): GeoBone[] {
  const eigene = new Set(kind.map((b) => b.name.toLowerCase()))
  return [...eltern.filter((b) => !eigene.has(b.name.toLowerCase())), ...kind]
}

function wandle(geo: { bones: GeoBone[] }, hide: string[], anheben: boolean): { parts: Part[]; scale: number } {
  const namen = new Map(geo.bones.map((b) => [b.name.toLowerCase(), knochenName(b.name, (b.pivot ?? [0, 0, 0]) as Vec)]))
  const parts: Part[] = []
  let scale = 1
  for (const b of geo.bones) {
    const name = namen.get(b.name.toLowerCase())!
    if (hide.includes(name)) continue
    const boxes: Box[] = []
    const extra: Part[] = []
    if (!b.neverRender)
      for (const c of b.cubes ?? []) {
        let uv: [number, number]
        if (Array.isArray(c.uv)) uv = [c.uv[0]!, c.uv[1]!]
        else {
          const nord = c.uv['north']
          if (!nord) continue
          const k = c.size[0]! > 0 && nord.uv_size[0] ? c.size[0]! / Math.abs(nord.uv_size[0]) : 1
          uv = [nord.uv[0]! - c.size[2]! / k, nord.uv[1]! - c.size[2]! / k]
          scale = k
        }
        const box: Box = { origin: c.origin as Vec, size: c.size as Vec, uv, inflate: c.inflate ?? 0, mirror: c.mirror ?? b.mirror ?? false }
        if (c.rotation && c.rotation.some((r) => r !== 0)) extra.push({ name: `${name}_w${extra.length}`, parent: name, pivot: (c.pivot ?? c.origin.map((o, i) => o + c.size[i]! / 2)) as Vec, rotation: c.rotation as Vec, boxes: [box] })
        else boxes.push(box)
      }
    const eltern = b.parent ? (namen.get(b.parent.toLowerCase()) ?? null) : null
    parts.push({ name, parent: eltern && !hide.includes(eltern) ? eltern : null, pivot: (b.pivot ?? [0, 0, 0]) as Vec, rotation: (b.rotation ?? b.bind_pose_rotation ?? [0, 0, 0]) as Vec, boxes }, ...extra)
  }
  const hoch = anheben ? -Math.min(0, ...parts.flatMap((p) => p.boxes.map((x) => x.origin[1] / scale))) : 0
  const f = (v: Vec, dy: number): Vec => [v[0] / scale, v[1] / scale + dy, v[2] / scale]
  for (const p of parts) {
    p.pivot = f(p.pivot, hoch)
    for (const x of p.boxes) {
      x.origin = f(x.origin, hoch)
      x.size = f(x.size, 0)
      x.inflate /= scale
    }
  }
  return { parts, scale }
}

/** Molang in Ruhe: query.* = 0, math.* in Grad, Variablen aus der Vorgabe, `this` = 0. */
function molang(e: string | number, vars: Record<string, number>): number {
  if (typeof e === 'number') return e
  const js = e.replace(/variable\.(\w+)/gi, (_, v: string) => String(vars[v.toLowerCase()] ?? 0)).replace(/query\.\w+/gi, '0').replace(/\bthis\b/gi, '0').replace(/math\.(\w+)/gi, 'M.$1')
  const M = { cos: (d: number) => Math.cos((d * Math.PI) / 180), sin: (d: number) => Math.sin((d * Math.PI) / 180), clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), abs: Math.abs, round: Math.round, random: () => 0 }
  return Number(new Function('M', `return (${js})`)(M)) || 0
}

function grundhaltung(parts: Part[], anims: Record<string, { bones?: Record<string, { rotation?: (string | number)[]; position?: (string | number)[] }> }>, namen: string[], vars: Record<string, number>, ziel: string[]): void {
  const nachName = new Map(parts.map((p) => [p.name, p]))
  const nachfahren = (wurzel: string): Part[] => parts.filter((p) => { for (let q: Part | undefined = p; q; q = q.parent ? nachName.get(q.parent) : undefined) if (q.name === wurzel) return true; return false })
  for (const n of namen)
    for (const [knochen, k] of Object.entries(anims[n]?.bones ?? {})) {
      const teil = nachName.get(knochenName(knochen, [0, 0, 0]))
      if (!teil) continue
      if (k.rotation) {
        const v = k.rotation.map((e) => molang(e, vars))
        teil.rotation = teil.rotation.map((r, i) => r + v[i]!) as Vec
      }
      if (k.position) {
        const d = k.position.map((e) => molang(e, vars))
        const b0 = teil.boxes[0]
        const mitte = ziel.includes(n) && b0 ? b0.origin.map((o, i) => o + b0.size[i]! / 2) : [0, 0, 0]
        const off: Vec = [d[0]! - mitte[0]!, d[1]! - mitte[1]!, d[2]! - mitte[2]!]
        for (const q of nachfahren(teil.name)) {
          q.pivot = [q.pivot[0] + off[0], q.pivot[1] + off[1], q.pivot[2] + off[2]]
          for (const x of q.boxes) x.origin = [x.origin[0] + off[0], x.origin[1] + off[1], x.origin[2] + off[2]]
        }
      }
    }
}

const tabelle: Record<string, unknown> = {
  _hinweis: 'Geometrie aus Mojangs bedrock-samples (nur Maße und Texturbereiche); Texturen kommen zur Laufzeit aus der Spieldatei.'
}
const bericht: string[] = []
for (const m of MOBS) {
  const tex = findeTextur(m.texture)
  if (!tex) {
    bericht.push(`✗ ${m.key}: Textur ${m.texture} fehlt im Spiel`)
    continue
  }
  const [tw, th] = pngGroesse(join(TEXTUREN, tex))
  const res = await fetch(GEO + m.geo)
  if (!res.ok) {
    bericht.push(`✗ ${m.key}: ${m.geo} nicht ladbar (${res.status})`)
    continue
  }
  const geo = geometrie((await res.json()) as Record<string, unknown>, m.id)
  if (m.erbt && geo.eltern) {
    const basis = geometrie((await (await fetch(GEO + m.erbt)).json()) as Record<string, unknown>, geo.eltern)
    geo.bones = erben(basis.bones, geo.bones)
  }
  const { parts, scale } = wandle(geo, m.hide ?? [], !!m.anheben)
  if (m.anim) {
    const a = (await (await fetch(ANIM + m.anim.datei)).json()) as { animations: Parameters<typeof grundhaltung>[1] }
    grundhaltung(parts, a.animations, m.anim.namen, m.anim.vars ?? {}, m.anim.ziel ?? [])
  }
  for (const [k, d] of Object.entries(m.versatz ?? {})) {
    const t = parts.find((p) => p.name === k)
    if (t) for (const x of t.boxes) x.origin = [x.origin[0] + d[0], x.origin[1] + d[1], x.origin[2] + d[2]]
  }
  for (const [k, r] of Object.entries(m.rot ?? {})) {
    const t = parts.find((p) => p.name === k)
    if (t) t.rotation = r
  }
  if (m.flach) for (const p of parts) p.parent = null
  // Altes 64×32-Layout im neuen 64×64-Bild (Zombie, Husk): obere Hälfte identisch – Pixel-UVs passen weiter
  if (tw === geo.tex[0] && th === geo.tex[1] * 2) geo.tex = [tw, th]
  if (tw / geo.tex[0] !== th / geo.tex[1]) {
    bericht.push(`✗ ${m.key}: Seitenverhältnis passt nicht (Modell ${geo.tex.join('×')}, Spiel ${tw}×${th})`)
    continue
  }
  const hoehe = Math.max(...parts.flatMap((p) => p.boxes.map((b) => b.origin[1] + b.size[1])), 1)
  const s = Math.round(scale * (m.scale ?? 1) * 1000) / 1000
  tabelle[m.key] = { texture: tex, tex_size: geo.tex, height_px: Math.round(hoehe * 100) / 100, ...(s !== 1 ? { scale: s } : {}), quelle: `bedrock-samples/${m.geo}`, parts }
  bericht.push(`✓ ${m.key}: ${parts.length} Teile, ${tex} (${tw}×${th})`)
}
writeFileSync(AUSGABE, `${JSON.stringify(tabelle, null, 1)}\n`)
console.log(bericht.join('\n'))
