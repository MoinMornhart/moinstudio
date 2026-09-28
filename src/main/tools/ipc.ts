import { app, ipcMain, type BrowserWindow } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IPC, type ToolStatus } from '@shared/app'
import { ToolManager, type ToolProgress } from './manager'
import { smokeTest } from './smoke'
import { BLENDER_FALLBACK, DEFAULT_TOOLS, type ToolId } from './specs'

/** %LOCALAPPDATA%\MoinStudio – große, gerätespezifische Dateien (nicht im Roaming-Profil). */
export function localRoot(): string {
  return join(process.env['LOCALAPPDATA'] ?? app.getPath('userData'), 'MoinStudio')
}

export async function toolStatus(mgr: ToolManager): Promise<ToolStatus[]> {
  const rows: ToolStatus[] = await Promise.all(
    DEFAULT_TOOLS.map(async (spec) => {
      const exe = await mgr.exePath(spec)
      return {
        id: spec.id,
        label: spec.label,
        version: spec.version,
        installed: exe !== null,
        path: exe,
        sizeBytes: spec.sizeBytes
      }
    })
  )
  // Zusätzlich installierte Versionen (z. B. Blender-Rückfall 4.5 LTS aus dem Hardware-Test) mit anzeigen
  const extra = [BLENDER_FALLBACK].filter((s) => !DEFAULT_TOOLS.includes(s))
  for (const spec of extra) {
    const exe = await mgr.exePath(spec)
    if (exe) rows.push({ id: spec.id, label: `${spec.label} (Rückfall)`, version: spec.version, installed: true, path: exe, sizeBytes: spec.sizeBytes })
  }
  return rows
}

export function registerToolsIpc(mgr: ToolManager, getWindow: () => BrowserWindow | undefined): void {
  const running = new Map<ToolId, Promise<string>>()
  ipcMain.handle(IPC.toolsStatus, () => toolStatus(mgr))
  ipcMain.handle(IPC.toolsInstall, async (_e, id: unknown) => {
    const spec = DEFAULT_TOOLS.find((s) => s.id === id)
    if (!spec) throw new Error(`Unbekanntes Werkzeug: ${String(id)}`)
    let job = running.get(spec.id)
    if (!job) {
      job = mgr.install(spec, (p) => getWindow()?.webContents.send(IPC.toolsProgress, p))
      running.set(spec.id, job)
      job.finally(() => running.delete(spec.id)).catch(() => undefined)
    }
    await job.catch(() => undefined) // Fehler kommen über das Fortschritts-Ereignis „error“
    return toolStatus(mgr)
  })
}

/**
 * `--moin-tools=install`: installiert alle Standardwerkzeuge ohne Oberfläche, führt die
 * Starttests aus und protokolliert nach %APPDATA%\MoinStudio\logs\tools.log. Exit 0 = alles ok.
 */
export async function runToolsCli(mgr: ToolManager): Promise<number> {
  const log = (line: string): void => {
    console.log(line)
    try {
      const dir = app.getPath('logs')
      mkdirSync(dir, { recursive: true })
      appendFileSync(join(dir, 'tools.log'), `${new Date().toISOString()} ${line}\n`, 'utf8')
    } catch {
      // Protokoll ist optional
    }
  }
  let failed = 0
  for (const spec of DEFAULT_TOOLS) {
    let last = ''
    const onProgress = (p: ToolProgress): void => {
      const text = `${spec.label}: ${p.phase}${p.percent !== null ? ` ${p.percent}%` : ''}${p.message ? ` – ${p.message}` : ''}`
      // Download-Fortschritt nur in 10er-Schritten protokollieren
      const key = p.phase === 'download' && p.percent !== null ? `download${Math.floor(p.percent / 10)}` : p.phase
      if (key !== last) log(text)
      last = key
    }
    try {
      const exe = await mgr.install(spec, onProgress)
      const smoke = await smokeTest(spec.id, exe)
      log(`${spec.label}: Starttest ${smoke.ok ? 'ok' : 'FEHLER'} (${smoke.detail}, ${smoke.ms} ms)`)
      if (!smoke.ok) failed++
    } catch {
      failed++
    }
  }
  return failed === 0 ? 0 : 1
}
