import { app, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC, type McpStatus } from '@shared/app'
import { desktopConfigPaths, installIntoDesktopConfig, SERVER_NAME, writeCliMcpConfig, type McpServerEntry } from './config'

/** So startet Claude den MCP-Server: die App-EXE im Node-Modus mit dem gebündelten mcp.js. */
export function mcpEntry(): McpServerEntry {
  return {
    command: process.execPath,
    args: [join(__dirname, 'mcp.js')],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  }
}

export function cliMcpConfigPath(root: string): string {
  return join(root, 'claude-work', 'mcp.json')
}

async function status(): Promise<McpStatus> {
  const entry = mcpEntry()
  const configs = await Promise.all(
    (await desktopConfigPaths()).map(async (path) => {
      let installed = false
      let current = false
      try {
        const cfg = JSON.parse(await readFile(path, 'utf8')) as { mcpServers?: Record<string, McpServerEntry> }
        const e = cfg.mcpServers?.[SERVER_NAME]
        installed = !!e
        current = !!e && e.command === entry.command && e.args?.[0] === entry.args[0]
      } catch {
        // Datei fehlt oder ist leer
      }
      return { path, installed, current }
    })
  )
  return { configs, packaged: app.isPackaged }
}

export function registerMcpIpc(root: string): void {
  // Konfiguration für `claude -p` immer aktuell halten (Pfad der EXE ändert sich bei Updates nicht, bei Entwicklung schon)
  void writeCliMcpConfig(cliMcpConfigPath(root), mcpEntry()).catch(() => undefined)
  ipcMain.handle(IPC.mcpStatus, () => status())
  ipcMain.handle(IPC.mcpInstall, async () => {
    await installIntoDesktopConfig(mcpEntry())
    return status()
  })
}
