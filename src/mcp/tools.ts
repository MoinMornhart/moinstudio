/**
 * Werkzeuge des MoinStudio-MCP-Servers. Sie sprechen über eine Named Pipe mit der laufenden App
 * und starten sie bei Bedarf selbst. Logs nur auf stderr (stdout gehört dem MCP-Protokoll).
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { PipeInfo } from '@shared/rpc'
import { RpcClient } from '../main/rpc/pipe'

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

  return server
}

