import { ipcMain, type BrowserWindow } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC } from '@shared/app'
import { benchScriptPath, type HardwareController } from '../hardware/controller'
import { ProfileStore } from '../hardware/profile'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY } from '../tools/specs'
import { probeRenderJob, type ProbeRenderPayload } from './blender'
import { registerJobsIpc } from './ipc'
import type { SettingsStore } from '../data/settings'
import { JobQueue } from './queue'

/**
 * Legt die Warteschlange an, registriert Job-Arten und IPC. Fundament (Neustart 28.09.): nur der Probe-Render als
 * Verbindung zu Blender; Thumbnail, Schnitt und Planung werden von Grund auf neu gebaut.
 */
export function setupJobs(
  root: string,
  tools: ToolManager,
  hardware: HardwareController,
  _settings: SettingsStore,
  getWindow: () => BrowserWindow | undefined
): { queue: JobQueue; enqueueProbe: () => Promise<string> } {
  const queue = new JobQueue(join(root, 'jobs'))
  queue.register('probe-render', probeRenderJob)
  registerJobsIpc(queue, getWindow)

  const enqueueProbe = async (): Promise<string> => {
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen.')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((s) => s.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const payload: ProbeRenderPayload = {
      exe,
      mesa: config.blenderMesa,
      script: benchScriptPath(),
      setting: config.preview,
      outDir: join(root, 'renders', 'probe')
    }
    return queue.enqueue('probe-render', 'Probebild rendern', payload)
  }
  ipcMain.handle(IPC.hwProbe, () => enqueueProbe())

  ipcMain.handle(IPC.jobsImage, async (_e, id: unknown) => {
    const result = queue.result<{ image?: string }>(String(id))
    if (!result?.image) return null
    try {
      return `data:image/png;base64,${(await readFile(result.image)).toString('base64')}`
    } catch {
      return null
    }
  })
  return { queue, enqueueProbe }
}
