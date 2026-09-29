import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaude, runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import { ladeKatalog } from './katalog'
import { sichereMcAssets } from './minecraft'
import {
  ernsteWarnungen,
  korrekturPrompt,
  ladeVorbilder,
  liesPlan,
  PLAN_SCHEMA,
  plane,
  pruefeSzene,
  SZENE_SCHEMA,
  type Plan,
  type PlanFigur,
  type Szene
} from './planung'

/**
 * Job „Thumbnail“ (ROADMAP 5): Beschreibung → Claude plant Varianten mit Vorbild → Blender rendert jede Variante →
 * Selbstprüfung; bei ernsten Fehlern korrigiert Claude die Szene anhand des Prüfberichts (ROADMAP 5.3) → Text in
 * Minecraft-Schrift. Fortsetzbar: fertige Schritte stehen im Checkpoint.
 */

/** Höchstens so viele Korrekturen je Variante durch Claude nach der Bildprüfung */
const KORREKTUREN = 2
const ZEILENUMBRUCH = /\r?\n/
const JSON_OBJEKT = /\{[\s\S]*\}/

export interface ThumbnailFigur extends PlanFigur {
  skin: string
  slim?: boolean | null
}

export interface ThumbnailPayload {
  beschreibung: string
  kanal: string
  figuren: ThumbnailFigur[]
  anzahl: number
  /** Blender-Aufruf laut Hardware-Profil */
  blender: { exe: string; mesa: boolean; geraet: string; samples: number }
  claudeCli: string
  datenOrdner: string
  blenderDir: string
  minecraftDir: string
  configDir: string
  promptDatei: string
  ausgabe: string
}

export interface ThumbnailVariante {
  titel: string
  vorbild: string
  warum: string
  bild: string | null
  szene: string
  warnungen: string[]
  fehler?: string
  /** Wie oft Claude die Szene nach der Bildprüfung korrigiert hat */
  korrekturen?: number
}

interface Checkpoint {
  claudeSession?: string
  claudePrompted?: boolean
  plan?: Plan
  fertig?: ThumbnailVariante[]
}

export async function thumbnailJob(p: ThumbnailPayload, ctx: JobContext<Checkpoint>): Promise<{ varianten: ThumbnailVariante[] }> {
  await mkdir(p.ausgabe, { recursive: true })
  ctx.progress(2, 'Minecraft-Texturen prüfen …')
  const mc = await sichereMcAssets(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t) })
  const katalog = await ladeKatalog(p.blenderDir, p.minecraftDir)
  const vorbilder = await ladeVorbilder(p.configDir)
  const vorlage = await readFile(p.promptDatei, 'utf8')
  const ids = p.figuren.map((f) => f.id)
  const workDir = join(p.datenOrdner, 'claude-work', 'thumbnail')

  let plan = ctx.checkpoint?.plan
  if (!plan) {
    ctx.progress(5, 'Claude plant die Varianten …')
    const prompt = plane(vorlage, { beschreibung: p.beschreibung, kanal: p.kanal, figuren: p.figuren, anzahl: p.anzahl, katalog, vorbilder })
    const res = await runClaudeInJob({ cli: p.claudeCli, prompt, workDir, tools: [], maxTurns: 3, jsonSchema: PLAN_SCHEMA }, ctx)
    if (!res.ok) throw new Error(`Claude-Planung fehlgeschlagen: ${res.errors.join(' | ') || res.subtype}`)
    const gelesen = liesPlan(res.structured, res.text, katalog, ids, vorbilder)
    // Varianten mit unlösbaren Fehlern fallen weg, statt den ganzen Auftrag scheitern zu lassen
    const kaputt = new Set(gelesen.fehler.map((f) => Number(/^Variante (\d+)/.exec(f)?.[1] ?? 0) - 1))
    plan = { varianten: gelesen.plan.varianten.filter((_, i) => !kaputt.has(i)) }
    if (!plan.varianten.length) throw new Error(`Claude hat keine gültige Szene geplant: ${gelesen.fehler.join('; ')}`)
    await ctx.save({ ...(ctx.checkpoint ?? {}), plan })
  }

  const fertig: ThumbnailVariante[] = [...(ctx.checkpoint?.fertig ?? [])]
  const skins = new Map(p.figuren.map((f) => [f.id, f]))
  const renderAufruf = (script: string, args: string[]): ReturnType<typeof runBlender> =>
    runBlender({ exe: p.blender.exe, mesa: p.blender.mesa, script: join(p.blenderDir, script), args }, ctx as JobContext<unknown>)

  for (let i = fertig.length; i < plan.varianten.length; i++) {
    await ctx.yield()
    const v = plan.varianten[i]!
    const anzahl = plan.varianten.length
    const anteil = (x: number): number => Math.round(10 + ((i + x) / anzahl) * 88)
    const basis = join(p.ausgabe, `variante-${i + 1}`)

    let szeneAktuell: Szene = v.szene
    let bestes: { versuch: number; ernst: string[]; warnungen: string[] } | null = null
    let renderFehler: string | null = null
    for (let versuch = 0; versuch <= KORREKTUREN; versuch++) {
      await ctx.yield()
      ctx.progress(anteil(versuch * 0.25), `Variante ${i + 1}/${anzahl}: ${v.titel} – ${versuch ? `Korrektur ${versuch}` : 'rendere'} …`)
      const pfad = `${basis}.v${versuch}`
      const szene = structuredClone(szeneAktuell) as Szene & { figuren: { id: string; skin?: string; slim?: boolean | null }[] }
      for (const f of szene.figuren) {
        const s = skins.get(f.id)
        f.skin = s?.skin ?? join(mc.textures, 'entity', 'player', 'wide', 'steve.png')
        if (s?.slim !== undefined && s.slim !== null) f.slim = s.slim
      }
      szene['render'] = { ...(szene['render'] as object | undefined), samples: p.blender.samples, geraet: p.blender.geraet }
      await writeFile(`${pfad}.szene.json`, JSON.stringify(szene, null, 1))
      const { code, output } = await renderAufruf('render_szene.py', [`${pfad}.szene.json`, mc.textures, `${pfad}.png`, `${pfad}.bericht.json`])
      const bericht = JSON.parse(await readFile(`${pfad}.bericht.json`, 'utf8').catch(() => '{}')) as { warnungen?: string[]; fehler?: string }
      if (code !== 0 || bericht.fehler) {
        renderFehler = bericht.fehler ?? `Blender Exit ${code}: ${output.trim().split(ZEILENUMBRUCH).slice(-1)[0]}`
        break
      }
      const warnungen = bericht.warnungen ?? []
      const ernst = ernsteWarnungen(warnungen)
      if (!bestes || ernst.length < bestes.ernst.length) bestes = { versuch, ernst, warnungen }
      if (!ernst.length || versuch === KORREKTUREN) break
      // Claude korrigiert die Szene anhand des Prüfberichts
      try {
        const prompt = korrekturPrompt(vorlage, { beschreibung: p.beschreibung, kanal: p.kanal, figuren: p.figuren, katalog, vorbilder }, { ...v, szene: szeneAktuell }, ernst, bericht)
        const res = await runClaude({ cli: p.claudeCli, prompt, workDir, tools: [], maxTurns: 3, jsonSchema: SZENE_SCHEMA, ctx: ctx as JobContext<unknown> })
        const roh = res.structured ?? JSON.parse(JSON_OBJEKT.exec(res.text)?.[0] ?? '{}')
        const neu = (roh as { szene?: Szene }).szene
        if (!neu || pruefeSzene(neu, katalog, ids).length) break
        szeneAktuell = neu
      } catch {
        break // ohne Korrektur weiter mit dem besten Stand
      }
    }

    if (!bestes) {
      fertig.push({ titel: v.titel, vorbild: v.vorbild, warum: v.warum, bild: null, szene: `${basis}.v0.szene.json`, warnungen: [], fehler: renderFehler ?? 'Render fehlgeschlagen' })
    } else {
      const pfad = `${basis}.v${bestes.versuch}`
      let bild = `${pfad}.png`
      const warnungen = [...bestes.warnungen]
      const texte = v.text ?? []
      if (texte.length) {
        ctx.progress(anteil(0.9), `Variante ${i + 1}: Text setzen …`)
        await writeFile(`${basis}.texte.json`, JSON.stringify(texte))
        const t = await renderAufruf('text_setzen.py', [`${pfad}.png`, `${pfad}.bericht.json`, `${basis}.texte.json`, mc.assets, `${basis}.png`])
        const zeile = /MOIN_TEXT (.*)/.exec(t.output)?.[1]
        if (t.code === 0 && zeile) {
          bild = `${basis}.png`
          warnungen.push(...((JSON.parse(zeile) as { warnungen?: string[] }).warnungen ?? []))
        } else warnungen.push('Text konnte nicht gesetzt werden')
      }
      fertig.push({ titel: v.titel, vorbild: v.vorbild, warum: v.warum, bild, szene: `${pfad}.szene.json`, warnungen, korrekturen: bestes.versuch })
    }
    await ctx.save({ ...(ctx.checkpoint ?? {}), plan, fertig })
  }
  ctx.progress(100, 'Fertig')
  return { varianten: fertig }
}
