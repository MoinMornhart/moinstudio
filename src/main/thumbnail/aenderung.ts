import { spawn } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import type { ThumbnailVariante } from './job'
import { sichereMcAssets } from './minecraft'

/**
 * Änderungswunsch zu einem fertigen Thumbnail (Philip, 29.09.: „wenn man das Thumbnail unten sieht, auch Änderungen
 * schreiben können“). Claude sieht das Bild und die Szene, setzt den Wunsch in eine geänderte Szene um, Blender rendert
 * neu. Funktioniert für alle Arten: Minecraft-Szene, Reaction/Eigenes Bild und Spiele-Vorlage.
 */

export type AenderungsArt = 'thumbnail' | 'reaktion' | 'spielvorlage'

export interface AenderungPayload {
  art: AenderungsArt
  wunsch: string
  /** bisheriges Bild und Szene (Spezifikation) der Variante */
  bild: string
  szene: string
  claudeCli: string
  blender: { exe: string; mesa: boolean }
  blenderDir: string
  datenOrdner: string
  /** Anleitung zum Szenenformat für Claude (bei Minecraft-Szenen der Planungs-Prompt) */
  formatHilfe?: string
  /** Spiele-Vorlage: Python der Bildwerkzeuge (für den Titel) */
  python?: string
  ausgabe: string
}

const HILFE: Record<Exclude<AenderungsArt, 'thumbnail'>, string> = {
  reaktion: `Felder: seite (links|rechts: Seite der Figur), mimik (neutral, wuetend, traurig, erschrocken, muede, skeptisch, froh,
schreiend), pose (Posen-Name oder eigene Winkel {koerper{drehen,vor,neigen}, kopf{drehen,nicken,neigen}, arm_r/arm_l
{heben,seitlich,drehen,beugen}}), pose_fest (true = Pose nicht automatisch ersetzen), kopf_drehung (Grad zum Inhalt),
kopf_anteil (Kopfhöhe als Anteil der Bildhöhe, Standard 0.42), koerper_drehung, wort (ein Wort, leer = keins),
wort_farbe (weiss, gelb, orange, cyan, gruen, pink, rot – leer = passend zum Bild), wort_anteil (Texthöhe, Standard 0.2),
pfeil_ziel ([u, v] oder weglassen = kein Pfeil), sperren (Kästen, die Text nicht überdecken darf), spiel (Spielname
unten in der Ecke), hintergrund_hell (0–1), zufall (Zahl: neuer Wert = neuer Textplatz und neue Neigung).`,
  spielvorlage: `Felder: pose (Posen-Name oder eigene Winkel wie oben), blick (Körperdrehung, positiv = nach rechts), ansicht (vorn|hinten),
mimik, kopf ([u, v] Kopfmitte), kopf_anteil (Kopfhöhe als Anteil der Bildhöhe), kopf_drehung, licht_seite (links|rechts),
requisit ({gltf, hand, laenge_px} – laenge_px = Größe des Gegenstands, weglassen = ohne Gegenstand), linse (mm).`
}

export function aenderungsPrompt(p: Pick<AenderungPayload, 'art' | 'wunsch' | 'bild' | 'formatHilfe'>, szene: string): string {
  return `Philip möchte an seinem Thumbnail etwas ändern. Sieh dir das aktuelle Bild an: ${p.bild}

Sein Wunsch: „${p.wunsch}“

So ist die Szene gerade beschrieben (JSON):
${szene}

${p.art === 'thumbnail' ? `Das Szenenformat und die Regeln stehen in dieser Anleitung (Auszug aus der Planung):\n${p.formatHilfe ?? ''}` : HILFE[p.art]}

Ändere nur, was der Wunsch verlangt, alles andere bleibt genau so (Pfade, Skins, Größen, Kamera …). Wenn der Wunsch
den Text betrifft und die Szene Texte in einem Feld „texte“ hat, ändere die dort.
Antworte nur mit {"szene": <die vollständige geänderte Szene>}.`
}

const SCHEMA = { type: 'object', required: ['szene'], properties: { szene: { type: 'object' } } } as const

const existiert = (p: string): Promise<boolean> => stat(p).then(() => true, () => false)

function lauf(exe: string, args: string[], ctx: JobContext<unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: 'ignore' })
    ctx.track(child)
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))))
  })
}

export async function aenderungJob(p: AenderungPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ varianten: ThumbnailVariante[] }> {
  const c = ctx as JobContext<unknown>
  await mkdir(p.ausgabe, { recursive: true })
  const alt = JSON.parse(await readFile(p.szene, 'utf8')) as Record<string, unknown>
  // Minecraft-Szenen: Texte liegen neben der Szene (variante-N.texte.json) und dürfen mitgeändert werden
  const basis = p.szene.replace(/\.v\d+\.szene\.json$/, '')
  const textDatei = `${basis}.texte.json`
  if (p.art === 'thumbnail' && (await existiert(textDatei))) alt['texte'] = JSON.parse(await readFile(textDatei, 'utf8'))

  ctx.progress(5, 'Claude setzt deinen Wunsch um …')
  const res = await runClaudeInJob(
    { cli: p.claudeCli, prompt: aenderungsPrompt(p, JSON.stringify(alt, null, 1)), workDir: join(p.datenOrdner, 'claude-work', 'aenderung'), tools: ['Read'], allowedTools: ['Read'], addDirs: [join(p.bild, '..')], maxTurns: 6, jsonSchema: SCHEMA },
    ctx
  )
  if (!res.ok) throw new Error(`Claude konnte den Wunsch nicht umsetzen: ${res.errors.join(' | ') || res.subtype}`)
  const neu = ((res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { szene?: Record<string, unknown> }).szene
  if (!neu || typeof neu !== 'object') throw new Error('Claude hat keine geänderte Szene geliefert.')
  // Skins und Pfade nie von Claude übernehmen
  for (const k of ['skin', 'hintergrund', 'mob_tabelle', 'render']) if (k in alt) neu[k] = alt[k]
  if (Array.isArray(alt['figuren']) && Array.isArray(neu['figuren'])) {
    const skins = new Map((alt['figuren'] as { id: string; skin?: string; slim?: boolean }[]).map((f) => [f.id, f]))
    for (const f of neu['figuren'] as { id: string; skin?: string; slim?: boolean }[]) {
      const a = skins.get(f.id)
      if (a) Object.assign(f, { skin: a.skin, slim: a.slim })
    }
  }
  const texte = neu['texte']
  delete neu['texte']

  await ctx.yield()
  ctx.progress(30, 'Blender rendert die geänderte Version …')
  const ziel = join(p.ausgabe, 'aenderung')
  await writeFile(`${ziel}.szene.json`, JSON.stringify(neu, null, 1))
  const blender = (script: string, args: string[]): ReturnType<typeof runBlender> => runBlender({ exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, script), args }, c)
  let bild: string | null = null
  let fehler: string | undefined
  if (p.art === 'thumbnail') {
    const mc = await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })
    const r = await blender('render_szene.py', [`${ziel}.szene.json`, mc.textures, `${ziel}.roh.png`, `${ziel}.bericht.json`])
    if (r.code === 0) {
      bild = `${ziel}.roh.png`
      if (Array.isArray(texte) && texte.length) {
        ctx.progress(85, 'Text setzen …')
        await writeFile(`${ziel}.texte.json`, JSON.stringify(texte))
        const t = await blender('text_setzen.py', [`${ziel}.roh.png`, `${ziel}.bericht.json`, `${ziel}.texte.json`, mc.assets, `${ziel}.png`])
        if (t.code === 0) bild = `${ziel}.png`
      }
    } else fehler = `Blender Exit ${r.code}`
  } else if (p.art === 'reaktion') {
    const r = await blender('render_reaktion.py', [`${ziel}.szene.json`, `${ziel}.png`, `${ziel}.bericht.json`])
    if (r.code === 0) bild = `${ziel}.png`
    else fehler = `Blender Exit ${r.code}`
  } else {
    const r = await blender('render_vorlage.py', [`${ziel}.szene.json`, `${ziel}.roh.png`, `${ziel}.bericht.json`])
    if (r.code === 0) {
      bild = `${ziel}.roh.png`
      // Titel der Vorlage wieder obendrauf (Kästen aus der ersten Analyse)
      const ordner = join(p.szene, '..')
      const analyse = JSON.parse(await readFile(join(ordner, 'analyse.json'), 'utf8').catch(() => '{}')) as { titel_boxen?: number[][]; logo_boxen?: number[][] }
      const boxen = [...(analyse.titel_boxen ?? []).map((b) => b.join(',')), ...(analyse.logo_boxen ?? []).map((b) => `logo:${b.join(',')}`)]
      const vorlage = ['vorlage.jpg', 'vorlage.png', 'vorlage.webp'].map((n) => join(ordner, n))
      const quelle = (await Promise.all(vorlage.map(existiert))).findIndex(Boolean)
      if (p.python && boxen.length && quelle >= 0) {
        await lauf(p.python, [join(p.blenderDir, 'vorlage_titel.py'), vorlage[quelle]!, bild, `${ziel}.png`, ...boxen], c).then(
          () => (bild = `${ziel}.png`),
          () => undefined
        )
      }
    } else fehler = `Blender Exit ${r.code}`
  }
  const bericht = JSON.parse(await readFile(`${ziel}.bericht.json`, 'utf8').catch(() => '{}')) as { fehler?: string; warnungen?: string[] }
  ctx.progress(100, 'Fertig')
  return {
    varianten: [
      {
        titel: `Geändert: ${p.wunsch}`.slice(0, 90),
        vorbild: '',
        warum: p.wunsch,
        bild: bericht.fehler ? null : bild,
        szene: `${ziel}.szene.json`,
        warnungen: bericht.warnungen ?? [],
        ...(bericht.fehler || fehler ? { fehler: bericht.fehler ?? fehler } : {})
      }
    ]
  }
}
