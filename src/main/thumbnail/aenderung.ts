import { spawn } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import type { ThumbnailVariante } from './job'
import { sichereMcAssets } from './minecraft'
import { titelArgumente } from './spielvorlage'
import { wichtigeBoxen, type Box } from '../logo/platz'
import { logoAufsetzen, logoAusAntwort, logoFuerClaude, logoHilfe, sperrenVorlage, type LogoWahl, type VarianteLogo } from '../logo/setzen'

/**
 * Änderungswunsch zu einem fertigen Thumbnail (Philip, 29.09.: „wenn man das Thumbnail unten sieht, auch Änderungen
 * schreiben können“). Claude sieht das Bild und die Szene, setzt den Wunsch in eine geänderte Szene um, Blender rendert
 * neu. Funktioniert für alle Arten: Minecraft-Szene, Reaction/Eigenes Bild und Spiele-Vorlage.
 */

export type AenderungsArt = 'thumbnail' | 'reaktion' | 'spielvorlage'

export interface AenderungPayload {
  art: AenderungsArt
  wunsch: string
  /** Ursprungsauftrag: alle Änderungen hängen im Verlauf unter ihm und werden mit ihm gelöscht (Philip, 30.09.) */
  eltern?: string
  /** Auftrag und Variante, die geändert wurden */
  basis?: { job: string; variante: number }
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
  /** Logo der geänderten Variante (bleibt erhalten, in Worten änderbar), Philips Logo-Bibliothek und Standard-Logo */
  logo?: LogoWahl
  logoBibliothek?: { name: string; datei: string }[]
  logoStandard?: LogoWahl
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
requisit ({gltf, hand, laenge_px} – laenge_px = Größe des Gegenstands, weglassen = ohne Gegenstand), ziel ([u, v]: dorthin zeigt
der Arm mit dem Gegenstand), linse (mm).`
}

const TEXT_HILFE = `
Texte im Bild stehen im Feld „texte“ als Liste, z. B. [{"text": "GIGANTISCH", "farbe": "gelb"}] (farbe optional: weiss,
gelb, gold, gruen, tuerkis, rot). Leere Liste = kein Text. Soll Text dazu, weg oder anders sein, ändere nur dieses Feld.`

export function aenderungsPrompt(p: Pick<AenderungPayload, 'art' | 'wunsch' | 'bild' | 'formatHilfe' | 'logoBibliothek'>, szene: string): string {
  return `Philip möchte an seinem Thumbnail etwas ändern. Sieh dir das aktuelle Bild an: ${p.bild}

Sein Wunsch: „${p.wunsch}“

So ist die Szene gerade beschrieben (JSON):
${szene}

${p.art === 'thumbnail' ? `Das Szenenformat und die Regeln stehen in dieser Anleitung (Auszug aus der Planung):\n${p.formatHilfe ?? ''}` : HILFE[p.art]}

Ändere nur, was der Wunsch verlangt, alles andere bleibt genau so (Pfade, Skins, Größen, Kamera …).${p.art === 'thumbnail' ? TEXT_HILFE : ''}${logoHilfe((p.logoBibliothek ?? []).map((b) => b.name))}
Antworte nur mit {"szene": <die vollständige geänderte Szene>}.`
}

const SCHEMA = { type: 'object', required: ['szene'], properties: { szene: { type: 'object' } } } as const

const existiert = (p: string): Promise<boolean> => stat(p).then(() => true, () => false)

/** Texte zur Szene: variante-N.v0.szene.json → variante-N.texte.json, aenderung.szene.json → aenderung.texte.json */
export function textDatei(szene: string): string {
  return `${szene.replace(/(\.v\d+)?\.szene\.json$/, '')}.texte.json`
}

async function ladeTexte(szene: string): Promise<{ text: string; farbe?: string }[]> {
  const datei = textDatei(szene)
  return (await existiert(datei)) ? normaleTexte(JSON.parse(await readFile(datei, 'utf8'))) : []
}

/** Claude liefert Texte manchmal als „text“ oder als einzelnes Wort: immer in die Liste [{text, farbe?}] bringen */
export function normaleTexte(roh: unknown): { text: string; farbe?: string }[] {
  const liste = Array.isArray(roh) ? roh : roh === undefined || roh === null || roh === '' ? [] : [roh]
  return liste.flatMap((t: unknown) => {
    if (typeof t === 'string') return t.trim() ? [{ text: t.trim() }] : []
    if (t && typeof t === 'object' && typeof (t as { text?: unknown }).text === 'string' && (t as { text: string }).text.trim()) {
      const { text, farbe } = t as { text: string; farbe?: unknown }
      return [{ text: text.trim(), ...(typeof farbe === 'string' && farbe ? { farbe } : {}) }]
    }
    return []
  })
}

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
  // Minecraft-Szenen: Texte liegen neben der Szene (variante-N.texte.json bzw. aenderung.texte.json) und dürfen
  // mitgeändert werden. Das Feld ist immer da, damit Claude auch neuen Text hinzufügen kann.
  if (p.art === 'thumbnail') alt['texte'] = await ladeTexte(p.szene)
  // Logo als eigenes Feld, damit „Logo kleiner“, „Logo nach links“ oder „Logo weg“ gehen
  alt['logo'] = logoFuerClaude(p.logo)

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
  const texte = normaleTexte(neu['texte'] ?? neu['text'])
  const logo = logoAusAntwort(neu['logo'], p.logo, p.logoBibliothek ?? [], p.logoStandard)
  delete neu['logo']
  delete neu['texte']
  if (p.art === 'thumbnail') delete neu['text']

  await ctx.yield()
  ctx.progress(30, 'Blender rendert die geänderte Version …')
  const ziel = join(p.ausgabe, 'aenderung')
  await writeFile(`${ziel}.szene.json`, JSON.stringify(neu, null, 1))
  const blender = (script: string, args: string[]): ReturnType<typeof runBlender> => runBlender({ exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, script), args }, c)
  let bild: string | null = null
  let fehler: string | undefined
  /** belegte Stellen für das Logo (Text, Titel der Vorlage …); Figuren kommen aus dem Bericht */
  const sperren: Box[] = []
  if (p.art === 'thumbnail') {
    const mc = await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })
    const r = await blender('render_szene.py', [`${ziel}.szene.json`, mc.textures, `${ziel}.roh.png`, `${ziel}.bericht.json`])
    // MOIN_BILD_OK: Bild fertig, nur die Maske für Photoshop ist gescheitert
    if (r.code === 0 || r.output.includes('MOIN_BILD_OK')) {
      bild = `${ziel}.roh.png`
      if (texte.length) {
        ctx.progress(85, 'Text setzen …')
        await writeFile(`${ziel}.texte.json`, JSON.stringify(texte))
        const t = await blender('text_setzen.py', [`${ziel}.roh.png`, `${ziel}.bericht.json`, `${ziel}.texte.json`, mc.assets, `${ziel}.png`])
        if (t.code === 0) bild = `${ziel}.png`
        const zeile = /MOIN_TEXT (.*)/.exec(t.output)?.[1]
        if (zeile) sperren.push(...wichtigeBoxen({ texte: (JSON.parse(zeile) as { texte?: unknown }).texte }))
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
      const analyse = JSON.parse(await readFile(join(ordner, 'analyse.json'), 'utf8').catch(() => '{}')) as Parameters<typeof titelArgumente>[0]
      const boxen = [...titelArgumente(analyse), `--maske=${join(ordner, 'maske.png')}`]
      const vorlage = ['vorlage.png', 'vorlage.jpg', 'vorlage.webp'].map((n) => join(ordner, n))
      const quelle = (await Promise.all(vorlage.map(existiert))).findIndex(Boolean)
      if (p.python && boxen.length > 1 && quelle >= 0) {
        await lauf(p.python, [join(p.blenderDir, 'vorlage_titel.py'), vorlage[quelle]!, bild, `${ziel}.png`, ...boxen], c).then(
          () => (bild = `${ziel}.png`),
          () => undefined
        )
      }
    } else fehler = `Blender Exit ${r.code}`
  }
  const bericht = JSON.parse(await readFile(`${ziel}.bericht.json`, 'utf8').catch(() => '{}')) as { fehler?: string; warnungen?: string[] }
  const warnungen = [...(bericht.warnungen ?? [])]
  let logoInfo: VarianteLogo | null = null
  if (bild && !bericht.fehler && logo) {
    ctx.progress(92, 'Logo setzen …')
    if (p.art === 'spielvorlage') sperren.push(...(await sperrenVorlage(`${ziel}.bericht.json`, join(p.szene, '..', 'analyse.json'), neu)))
    else sperren.push(...wichtigeBoxen(bericht), ...wichtigeBoxen({ sperren: neu['sperren'] }))
    const l = await logoAufsetzen({ bild, logo, sperren, ausgabe: `${ziel}.logo.png`, blender: p.blender, blenderDir: p.blenderDir }, c)
    bild = l.bild
    logoInfo = l.logo
    warnungen.push(...l.warnungen)
  }
  ctx.progress(100, 'Fertig')
  return {
    varianten: [
      {
        titel: `Geändert: ${p.wunsch}`.slice(0, 90),
        vorbild: '',
        warum: p.wunsch,
        bild: bericht.fehler ? null : bild,
        szene: `${ziel}.szene.json`,
        warnungen,
        ...(logoInfo ? { logo: logoInfo } : {}),
        ...(bericht.fehler || fehler ? { fehler: bericht.fehler ?? fehler } : {})
      }
    ]
  }
}
