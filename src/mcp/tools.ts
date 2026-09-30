/**
 * Werkzeuge des MoinStudio-MCP-Servers. Sie sprechen über eine Named Pipe mit der laufenden App
 * und starten sie bei Bedarf selbst. Logs nur auf stderr (stdout gehört dem MCP-Protokoll).
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { PipeInfo } from '@shared/rpc'
import { RpcClient } from '../main/rpc/pipe'
import { PLANUNG_AKTIONEN, planungAktion, type PlanungArgs } from '../main/planung/aktionen'

export const log = (...args: unknown[]): void => console.error('[moinstudio-mcp]', ...args)

function pipeFile(): string {
  return process.env['MOINSTUDIO_PIPE_FILE'] ?? join(process.env['APPDATA'] ?? '', 'MoinStudio', 'pipe.json')
}

async function readPipeInfo(): Promise<PipeInfo | null> {
  try {
    return JSON.parse(await readFile(pipeFile(), 'utf8')) as PipeInfo
  } catch {
    return null
  }
}

/** Startet die App (unsichtbar für den MCP-Kanal) – installiert: MoinStudio.exe, Entwicklung: electron.exe <projekt>. */
function launchApp(): void {
  const env = { ...process.env }
  delete env['ELECTRON_RUN_AS_NODE']
  const packaged = __dirname.includes('app.asar')
  const args = packaged ? [] : [resolve(__dirname, '..', '..')]
  log('starte MoinStudio …')
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', env, windowsHide: false })
  child.unref()
}

let client: RpcClient | null = null

async function connectApp(): Promise<RpcClient> {
  if (client?.connected) return client
  const tryConnect = async (): Promise<RpcClient | null> => {
    const info = await readPipeInfo()
    if (!info) return null
    const c = new RpcClient(info)
    try {
      await c.connect(2000)
      return c
    } catch {
      return null
    }
  }
  client = await tryConnect()
  if (client) return client
  if (process.env['MOINSTUDIO_NO_AUTOSTART'] === '1') throw new Error('MoinStudio läuft nicht.')
  launchApp()
  for (let i = 0; i < 60 && !client; i++) {
    await new Promise((r) => setTimeout(r, 500))
    client = await tryConnect()
  }
  if (!client) throw new Error('MoinStudio konnte nicht gestartet werden. Bitte die App einmal manuell öffnen.')
  return client
}

/** Läuft die App schon? (ohne sie zu starten) */
async function appLaeuft(): Promise<boolean> {
  if (client?.connected) return true
  const info = await readPipeInfo()
  if (!info) return false
  const c = new RpcClient(info)
  try {
    await c.connect(1500)
    client = c
    return true
  } catch {
    return false
  }
}

/** Datenordner aus den App-Einstellungen (liegen neben pipe.json) – für die Planung ohne laufende App */
async function datenOrdner(): Promise<string> {
  const s = JSON.parse(await readFile(join(dirname(pipeFile()), 'settings.json'), 'utf8').catch(() => '{}')) as { dataDir?: string | null }
  if (!s.dataDir) throw new Error('In MoinStudio ist noch kein Datenordner gewählt.')
  return s.dataDir
}

const CLAUDE_AKTIONEN = new Set(['ideen', 'titel', 'wochenplan', 'ergebnis'])

async function call<T = unknown>(method: string, params?: unknown): Promise<T> {
  return (await connectApp()).call<T>(method, params)
}

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
const text = (value: unknown): { content: Content[] } => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
})
const fail = (err: unknown): { content: Content[]; isError: true } => ({
  content: [{ type: 'text', text: `Fehler: ${err instanceof Error ? err.message : String(err)}` }],
  isError: true
})

export function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'moinstudio', version })

  server.registerTool(
    'status',
    {
      title: 'MoinStudio-Status',
      description:
        'Zeigt Version, Datenordner, Hardware-Konfiguration (Blender, Render-Engine, Encoder) und laufende Aufgaben von MoinStudio.'
    },
    async () => {
      try {
        return text(await call('status'))
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'jobs_list',
    { title: 'Aufgaben auflisten', description: 'Listet alle Aufgaben (Render, Schnitt, Analyse) mit Status und Fortschritt.' },
    async () => {
      try {
        return text(await call('jobs.list'))
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'job_get',
    {
      title: 'Aufgabe abfragen',
      description: 'Status, Fortschritt und Ergebnis einer Aufgabe.',
      inputSchema: z.object({ id: z.string().describe('Aufgaben-ID') })
    },
    async ({ id }) => {
      try {
        return text(await call('jobs.get', { id }))
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'job_control',
    {
      title: 'Aufgabe steuern',
      description: 'Pausiert, setzt fort oder bricht eine Aufgabe ab.',
      inputSchema: z.object({ id: z.string(), action: z.enum(['pause', 'resume', 'cancel']) })
    },
    async ({ id, action }) => {
      try {
        return text(await call('jobs.action', { id, action }))
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'job_image',
    {
      title: 'Ergebnisbild ansehen',
      description: 'Liefert das Ergebnisbild einer fertigen Aufgabe (verkleinert) zum Ansehen und Bewerten.',
      inputSchema: z.object({ id: z.string() })
    },
    async ({ id }) => {
      try {
        const img = await call<{ data: string; mimeType: string; width: number; height: number; path: string }>('jobs.image', { id })
        return {
          content: [
            { type: 'image', data: img.data, mimeType: img.mimeType },
            { type: 'text', text: `${img.width}×${img.height}, Original: ${img.path}` }
          ]
        }
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'render_probe',
    {
      title: 'Probebild rendern',
      description: 'Rendert mit Blender eine Testszene (prüft, ob Rendern auf diesem Gerät funktioniert). Liefert die Aufgaben-ID.'
    },
    async () => {
      try {
        const id = await call<string>('probe.render')
        return text({ jobId: id, hinweis: 'Mit job_get den Fortschritt abfragen, danach job_image für das Bild.' })
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'planning',
    {
      title: 'Videos planen',
      description:
        'Planung in MoinStudio: Board je Kanal (Spalten idee, aufnahme, schnitt, thumbnail, upload, veroeffentlicht) und Upload-Kalender. Aktionen: liste (optional kanal, spalte), kalender (von, bis als 2026-10-01; Termine, freie Upload-Termine laut Rhythmus, Karten ohne Termin), anlegen (kanal, titel, optional spalte, notizen, termin), aendern (karte, titel/notizen/termin/checkliste/spalte/kanal), verschieben (karte, spalte, optional index), loeschen (karte), rhythmus, rhythmus_setzen (rhythmus: {"MoinMornhart":[{"tag":3,"zeit":"17:00"}]} mit tag 0=So … 6=Sa), ideen (kanal, optional wunsch), titel (karte), wochenplan, ergebnis (auftrag – holt Ideen, Titel oder Wochenplan ab). Termine als 2026-10-03T17:00. Funktioniert auch, wenn MoinStudio geschlossen ist (außer ideen, titel, wochenplan).',
      inputSchema: z.object({
        aktion: z.enum(PLANUNG_AKTIONEN),
        kanal: z.enum(['MoinMornhart', 'MoinMorni']).optional(),
        spalte: z.enum(['idee', 'aufnahme', 'schnitt', 'thumbnail', 'upload', 'veroeffentlicht']).optional(),
        karte: z.string().optional().describe('Karten-ID (aus liste)'),
        titel: z.string().optional(),
        notizen: z.string().optional(),
        termin: z.string().nullable().optional().describe('2026-10-03T17:00, null entfernt den Termin'),
        checkliste: z.array(z.object({ text: z.string(), erledigt: z.boolean() })).optional(),
        index: z.number().int().optional().describe('Position in der Spalte (0 = oben)'),
        von: z.string().optional(),
        bis: z.string().optional(),
        wunsch: z.string().optional().describe('nur ideen: z. B. „mit SimPell“'),
        auftrag: z.string().optional().describe('nur ergebnis'),
        rhythmus: z.record(z.string(), z.array(z.object({ tag: z.number().int(), zeit: z.string() }))).optional()
      })
    },
    async (args) => {
      try {
        // Läuft die App, geht alles über sie (Oberfläche aktualisiert sich); sonst direkt im Datenordner
        if (CLAUDE_AKTIONEN.has(args.aktion) || (await appLaeuft())) return text(await call('planung', args))
        return text(await planungAktion(await datenOrdner(), args as PlanungArgs))
      } catch (err) {
        return fail(err)
      }
    }
  )

  server.registerTool(
    'video_edit',
    {
      title: 'Videos schneiden',
      description:
        'Schnitt in MoinStudio (Rohvideo rein, fertiges Video raus). Aktionen: projekte (alle Schnitt-Projekte), importieren (pfad, kanal – startet Import, Transkript und Rohschnitt von selbst), schnitt (projekt – Rohschnitt mit Transkript und entfernten Stellen), aendern (projekt, wunsch – Schnitt und Effekte in Worten, z. B. „mach mir ein geiles Intro“, „Zeitlupe, wenn der Creeper explodiert“, „am Ende schwarz ausblenden“, „lass die Stelle mit dem Creeper drin“; danach entsteht die Vorschau von selbst), effekte (projekt – alle Effekte mit Nummer, Zeit und Beschreibung), effekt_aendern (projekt, index, aus: true/false oder loeschen: true), vorschau, export (YouTube-Export mit Titel, Beschreibung, Kapiteln), export_info, highlights (Höhepunkte aus Streams suchen), highlights_liste, clips (projekt, auswahl: [{index, art: clip|short}]), umbenennen (projekt, name – Name des Videos und YouTube-Titel; danach heißen Export, Shorts und Premiere-Dateien). Aufträge laufen im Hintergrund – mit job_get den Fortschritt abfragen.',
      inputSchema: z.object({
        aktion: z.enum(['projekte', 'importieren', 'schnitt', 'aendern', 'effekte', 'effekt_aendern', 'vorschau', 'export', 'export_info', 'highlights', 'highlights_liste', 'clips', 'umbenennen']),
        projekt: z.string().optional().describe('Projekt-ID (aus projekte)'),
        name: z.string().optional().describe('Neuer Name des Videos (nur umbenennen)'),
        pfad: z.string().optional().describe('Rohvideo (nur importieren)'),
        kanal: z.enum(['MoinMornhart', 'MoinMorni']).optional(),
        wunsch: z.string().optional().describe('Änderungswunsch in Worten (nur aendern)'),
        index: z.number().int().optional().describe('Effekt-Nummer aus effekte (nur effekt_aendern)'),
        aus: z.boolean().optional().describe('Effekt aus- (true) oder einschalten (false) (nur effekt_aendern)'),
        loeschen: z.boolean().optional().describe('Effekt löschen (nur effekt_aendern)'),
        auswahl: z.array(z.object({ index: z.number().int(), art: z.enum(['clip', 'short']) })).optional().describe('nur clips')
      })
    },
    async (args) => {
      try {
        return text(await call('schnitt', args))
      } catch (err) {
        return fail(err)
      }
    }
  )

  return server
}

