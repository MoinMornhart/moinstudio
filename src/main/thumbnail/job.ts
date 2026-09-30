import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaude, runClaudeInJob } from '../claude/run'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import { ladeKatalog } from './katalog'
import { sichereMcAssets } from './minecraft'
import { lauf, sicherePakete, sichereUmgebung } from '../python'
import { sichereMobs } from './mobimport'
import { logoAufsetzen, type LogoWahl, type VarianteLogo } from '../logo/setzen'
import { wichtigeBoxen } from '../logo/platz'
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
  /** Fester Text (z. B. Folgennummer) – kommt auf jede Variante, Claudes eigener Text entfällt dann */
  merkmal?: { text: string; farbe?: string; platz?: string }[]
  /** Logo aus der Bibliothek (Philip, 30.09.) – kommt zuletzt in eine freie Ecke */
  logo?: LogoWahl
  /** Name des Videos, zu dem das Thumbnail gehört (nur für den Dateinamen beim Speichern) */
  videoName?: string
  /** uv.exe und Ordner der kleinen Python-Umgebung für die Grafik-Ebene (nur Pillow, entsteht beim ersten Gebrauch) */
  uv?: string
  grafikPyDir?: string
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
  /** Logo im Bild (Platz, Größe, Bild ohne Logo) */
  logo?: VarianteLogo
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
  // Alle Mobs der neuesten Vorschau (geprüfte behalten Vorrang)
  const mobs = await sichereMobs(p.datenOrdner, { onProgress: (t) => ctx.progress(null, t), kuratiert: { tabelle: join(p.minecraftDir, 'mobs.json'), texturen: mc.textures } })
  const katalog = await ladeKatalog(p.blenderDir, mobs.tabelle, join(mc.assets, 'models', 'block'))
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

    // Geteiltes Bild: jede Teil-Szene mit der Hauptsache in der Bildmitte (wird später als senkrechter Streifen genutzt)
    const mitte = (s: Szene): Szene => ({ ...s, kamera: { ...(s.kamera as object), kopf_uv: [0.5, 0.5], thema_uv: [0.5, 0.3] } as Szene['kamera'] })
    if (v.split) v.szene = mitte(v.szene)
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
      szene['mob_tabelle'] = mobs.tabelle
      await writeFile(`${pfad}.szene.json`, JSON.stringify(szene, null, 1))
      const { code, output } = await renderAufruf('render_szene.py', [`${pfad}.szene.json`, mc.textures, `${pfad}.png`, `${pfad}.bericht.json`])
      const bericht = JSON.parse(await readFile(`${pfad}.bericht.json`, 'utf8').catch(() => '{}')) as { warnungen?: string[]; fehler?: string }
      // MOIN_BILD_OK: Bild und Bericht sind fertig; scheitert danach nur die Maske für Photoshop, zählt das nicht
      if ((code !== 0 && !output.includes('MOIN_BILD_OK')) || bericht.fehler) {
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
      if (v.split) {
        // weitere Teile je einmal rendern und mit schrägen Trennlinien zusammensetzen
        ctx.progress(anteil(0.8), `Variante ${i + 1}: weitere Bildteile …`)
        const teilBilder: [string, string][] = [[bild, v.split.teile[0]!.etikett ?? '-']]
        for (const [n, teil] of v.split.teile.slice(1).entries()) {
          const tpfad = `${basis}.teil${n + 2}`
          const tszene = structuredClone(mitte(teil.szene)) as Szene & { figuren: { id: string; skin?: string; slim?: boolean | null }[] }
          for (const f of tszene.figuren) {
            const s = skins.get(f.id)
            f.skin = s?.skin ?? join(mc.textures, 'entity', 'player', 'wide', 'steve.png')
            if (s?.slim !== undefined && s.slim !== null) f.slim = s.slim
          }
          tszene['render'] = { ...(tszene['render'] as object | undefined), samples: p.blender.samples, geraet: p.blender.geraet }
          tszene['mob_tabelle'] = mobs.tabelle
          await writeFile(`${tpfad}.szene.json`, JSON.stringify(tszene, null, 1))
          const r = await renderAufruf('render_szene.py', [`${tpfad}.szene.json`, mc.textures, `${tpfad}.png`, `${tpfad}.bericht.json`])
          if (r.code === 0 || r.output.includes('MOIN_BILD_OK')) teilBilder.push([`${tpfad}.png`, teil.etikett ?? '-'])
          else warnungen.push(`Bildteil ${n + 2} konnte nicht gerendert werden`)
        }
        if (teilBilder.length >= 2 && p.uv && p.grafikPyDir) {
          try {
            const python = await sichereUmgebung(p.uv, p.grafikPyDir, ctx as JobContext<unknown>)
            await sicherePakete(p.uv, python, 'PIL', ['pillow'], ctx as JobContext<unknown>, 'Richte die Grafik-Werkzeuge ein (einmalig, klein) …')
            await lauf(python, [join(p.blenderDir, 'split_setzen.py'), mc.assets, `${basis}.split.png`, ...teilBilder.flat()], ctx as JobContext<unknown>)
            bild = `${basis}.split.png`
          } catch (err) {
            warnungen.push(`Geteiltes Bild konnte nicht zusammengesetzt werden: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`)
          }
        }
      }
      const texte = v.split ? [] : p.merkmal?.length ? p.merkmal : (v.text ?? [])
      let textBoxen: unknown = []
      if (texte.length) {
        ctx.progress(anteil(0.9), `Variante ${i + 1}: Text setzen …`)
        await writeFile(`${basis}.texte.json`, JSON.stringify(texte))
        const t = await renderAufruf('text_setzen.py', [`${pfad}.png`, `${pfad}.bericht.json`, `${basis}.texte.json`, mc.assets, `${basis}.png`])
        const zeile = /MOIN_TEXT (.*)/.exec(t.output)?.[1]
        if (t.code === 0 && zeile) {
          bild = `${basis}.png`
          const gesetzt = JSON.parse(zeile) as { warnungen?: string[]; texte?: unknown }
          warnungen.push(...(gesetzt.warnungen ?? []))
          textBoxen = gesetzt.texte ?? []
        } else warnungen.push('Text konnte nicht gesetzt werden')
      }
      const grafik = v.split ? [] : (v.grafik ?? [])
      if (grafik.length && p.uv && p.grafikPyDir) {
        ctx.progress(anteil(0.93), `Variante ${i + 1}: Grafik setzen …`)
        try {
          const python = await sichereUmgebung(p.uv, p.grafikPyDir, ctx as JobContext<unknown>)
          await sicherePakete(p.uv, python, 'PIL', ['pillow'], ctx as JobContext<unknown>, 'Richte die Grafik-Werkzeuge ein (einmalig, klein) …')
          await writeFile(`${basis}.grafik.json`, JSON.stringify(grafik))
          const aus = await lauf(python, [join(p.blenderDir, 'grafik_setzen.py'), bild, `${pfad}.bericht.json`, `${basis}.grafik.json`, mc.assets, `${basis}.grafik.png`], ctx as JobContext<unknown>)
          const zeile = /MOIN_GRAFIK (.*)/.exec(aus)?.[1]
          bild = `${basis}.grafik.png`
          textBoxen = [...(Array.isArray(textBoxen) ? textBoxen : []), ...((zeile ? (JSON.parse(zeile) as { boxen?: unknown[] }).boxen : []) ?? []).map((box) => ({ box }))]
        } catch (err) {
          warnungen.push(`Grafik konnte nicht gesetzt werden: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`)
        }
      }
      let logo: VarianteLogo | undefined
      if (p.logo) {
        ctx.progress(anteil(0.95), `Variante ${i + 1}: Logo setzen …`)
        const bericht = JSON.parse(await readFile(`${pfad}.bericht.json`, 'utf8').catch(() => '{}')) as unknown
        const l = await logoAufsetzen({ bild, logo: p.logo, sperren: [...wichtigeBoxen(bericht), ...wichtigeBoxen({ texte: textBoxen })], ausgabe: `${basis}.logo.png`, blender: p.blender, blenderDir: p.blenderDir }, ctx as JobContext<unknown>)
        bild = l.bild
        logo = l.logo ?? undefined
        warnungen.push(...l.warnungen)
      }
      fertig.push({ titel: v.titel, vorbild: v.vorbild, warum: v.warum, bild, szene: `${pfad}.szene.json`, warnungen, korrekturen: bestes.versuch, ...(logo ? { logo } : {}) })
    }
    await ctx.save({ ...(ctx.checkpoint ?? {}), plan, fertig })
  }
  ctx.progress(100, 'Fertig')
  return { varianten: fertig }
}
