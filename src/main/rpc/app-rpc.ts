import { app, nativeImage } from 'electron'
import { rmSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { pipeName } from '@shared/rpc'
import { IPC, type SchnittEffekt } from '@shared/app'
import { effektText } from '@shared/effekt-text'
import { writeJsonAtomic } from '../data/jsonfile'
import type { SettingsStore } from '../data/settings'
import type { HardwareController } from '../hardware/controller'
import { ProfileStore } from '../hardware/profile'
import type { JobQueue } from '../jobs/queue'
import { RpcServer } from './pipe'
import { planungAktion, type PlanungArgs } from '../planung/aktionen'

export function pipeInfoFile(): string {
  return join(app.getPath('userData'), 'pipe.json')
}

/** Verkleinert ein Bild für Claude (max. Kantenlänge, JPEG) – Claude Desktop erlaubt ~1 MB pro Ergebnis. */
export function imageForClaude(path: string, maxEdge = 1280): { data: string; mimeType: string; width: number; height: number } | null {
  const img = nativeImage.createFromPath(path)
  if (img.isEmpty()) return null
  const { width, height } = img.getSize()
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const out = scale < 1 ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : img
  const size = out.getSize()
  return { data: out.toJPEG(82).toString('base64'), mimeType: 'image/jpeg', width: size.width, height: size.height }
}

export interface AppRpcDeps {
  settings: SettingsStore
  hardware: HardwareController
  jobs: JobQueue
  enqueueProbe: () => Promise<string>
  /** Schnitt (ROADMAP 6.9): gleiche Funktionen wie im Reiter */
  schnitt: { starteImport: (video: string, kanal?: string) => Promise<string>; aufruf: (kanal: string, ...a: unknown[]) => Promise<unknown> }
  /** Planung (ROADMAP 7.7) */
  planung: { aufruf: (kanal: string, ...a: unknown[]) => Promise<unknown>; daten: () => Promise<string> }
}

/** Startet den Pipe-Server der App und registriert die Methoden für den MCP-Server. */
export async function startAppRpc(deps: AppRpcDeps): Promise<RpcServer> {
  const rpc = new RpcServer(pipeName(userInfo().username))

  rpc.handle('status', async () => {
    const settings = await deps.settings.load()
    const profile = await deps.hardware.profiles.load()
    const config = profile ? ProfileStore.effective(profile) : null
    const queue = deps.jobs.state()
    return {
      version: app.getVersion(),
      dataDir: settings.dataDir,
      hardware: config
        ? {
            blender: config.blenderVersion,
            preview: `${config.preview.engine} ${config.preview.width}×${config.preview.height}`,
            final: `${config.final.engine} (${config.final.device}) ${config.final.width}×${config.final.height}`,
            encoder: config.encoder,
            notes: config.notes
          }
        : 'Hardware-Test noch nicht ausgeführt',
      queue: { paused: queue.paused, active: queue.jobs.filter((j) => !['done', 'failed', 'cancelled'].includes(j.state)).length }
    }
  })
  rpc.handle('jobs.list', () => deps.jobs.state())
  rpc.handle('jobs.get', (p) => {
    const id = String((p as { id?: unknown })?.id ?? '')
    const info = deps.jobs.get(id)
    if (!info) throw new Error(`Job ${id} nicht gefunden`)
    return { ...info, result: deps.jobs.result(id) ?? null }
  })
  rpc.handle('jobs.action', async (p) => {
    const { action, id } = (p ?? {}) as { action?: string; id?: string }
    if (action === 'pause') await deps.jobs.pause(String(id))
    else if (action === 'resume') await deps.jobs.resume(String(id))
    else if (action === 'cancel') await deps.jobs.cancel(String(id))
    else throw new Error(`Unbekannte Aktion: ${String(action)}`)
    return deps.jobs.get(String(id)) ?? null
  })
  rpc.handle('jobs.image', (p) => {
    const id = String((p as { id?: unknown })?.id ?? '')
    const result = deps.jobs.result<{ image?: string }>(id)
    if (!result?.image) throw new Error(`Job ${id} hat (noch) kein Bild`)
    const img = imageForClaude(result.image)
    if (!img) throw new Error('Bild konnte nicht gelesen werden')
    return { ...img, path: result.image }
  })
  rpc.handle('probe.render', () => deps.enqueueProbe())
  // Planung aus Claude Desktop (ROADMAP 7.7): planning
  rpc.handle('planung', async (p) =>
    planungAktion(await deps.planung.daten(), (p ?? {}) as PlanungArgs, {
      starte: async (art, o) => String(await deps.planung.aufruf(IPC.planungClaude, art, o)),
      stand: (auftrag) => deps.planung.aufruf(IPC.planungClaudeStand, auftrag)
    })
  )
  // Schnitt aus Claude Desktop (ROADMAP 6.9): video_edit
  rpc.handle('schnitt', async (p) => {
    const { aktion, projekt, pfad, kanal, wunsch, auswahl, index, aus, loeschen } = (p ?? {}) as { aktion?: string; projekt?: string; pfad?: string; kanal?: string; wunsch?: string; auswahl?: unknown; index?: number; aus?: boolean; loeschen?: boolean }
    // Effekte für Claude: Nummer, Zeit in der Originalaufnahme und Beschreibung in Worten (ROADMAP E.6)
    const effektListe = (l: SchnittEffekt[]): { index: number; beschreibung: string; von?: number; bis?: number; bei?: number; aus: boolean; daten: SchnittEffekt }[] =>
      l.map((e, i) => ({ index: i, beschreibung: effektText(e), von: e.von, bis: e.bis, bei: e.bei, aus: e.aus === true, daten: e }))
    const a = deps.schnitt.aufruf
    switch (aktion) {
      case 'projekte':
        return a(IPC.schnittProjekte)
      case 'importieren':
        if (!pfad) throw new Error('pfad fehlt')
        return { projekt: await deps.schnitt.starteImport(pfad, kanal ?? 'MoinMornhart'), hinweis: 'Import, Transkript und Rohschnitt laufen nacheinander von selbst.' }
      case 'schnitt': {
        const [liste, transkript] = (await Promise.all([a(IPC.schnittListe, projekt), a(IPC.schnittTranskript, projekt)])) as [{ dauer: number; behalten: { start: number; ende: number }[]; entfernt: { start: number; ende: number; grund: string; text?: string; aus?: boolean }[] } | null, { start: number; ende: number; text: string }[] | null]
        if (!liste) return { hinweis: 'Noch kein Rohschnitt – Import und Transkript abwarten.' }
        const nachher = liste.behalten.reduce((s, b) => s + b.ende - b.start, 0)
        return {
          vorher: Math.round(liste.dauer),
          nachher: Math.round(nachher),
          entfernt: liste.entfernt.filter((e) => !e.aus && e.grund !== 'pause').map((e) => ({ grund: e.grund, start: e.start, ende: e.ende, text: e.text })),
          pausenGekuerzt: liste.entfernt.filter((e) => !e.aus && e.grund === 'pause').length,
          transkript: (transkript ?? []).map((s) => ({ start: s.start, ende: s.ende, text: s.text }))
        }
      }
      case 'aendern':
        return { auftrag: await a(IPC.schnittWunsch, projekt, wunsch) }
      case 'effekte': {
        const l = effektListe((await a(IPC.schnittEffekte, projekt)) as SchnittEffekt[])
        return { effekte: l, hinweis: l.length ? 'Zeiten in Sekunden der Originalaufnahme. Nach effekt_aendern die Vorschau neu rendern.' : 'Noch keine Effekte – mit aendern z. B. „mach mir ein geiles Intro“.' }
      }
      case 'effekt_aendern': {
        if (typeof index !== 'number') throw new Error('index fehlt')
        if (loeschen !== true && typeof aus !== 'boolean') throw new Error('aus oder loeschen angeben')
        return { effekte: effektListe((await a(IPC.schnittEffektAendern, projekt, index, loeschen === true ? null : { aus })) as SchnittEffekt[]) }
      }
      case 'vorschau':
        return { auftrag: await a(IPC.schnittVorschau, projekt) }
      case 'export':
        return { auftrag: await a(IPC.schnittExport, projekt) }
      case 'export_info':
        return a(IPC.schnittExportInfo, projekt)
      case 'highlights':
        return { auftrag: await a(IPC.schnittHighlightsStart, projekt) }
      case 'highlights_liste':
        return a(IPC.schnittHighlights, projekt)
      case 'clips':
        return { auftrag: await a(IPC.schnittClips, projekt, auswahl) }
      default:
        throw new Error(`Unbekannte Aktion: ${String(aktion)}`)
    }
  })

  await rpc.listen()
  await writeJsonAtomic(pipeInfoFile(), rpc.info(app.getVersion()))
  app.once('will-quit', () => {
    rpc.close()
    rmSync(pipeInfoFile(), { force: true }) // synchron: beim Beenden bleibt keine Zeit für async
  })
  return rpc
}
