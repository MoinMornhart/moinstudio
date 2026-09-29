import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { IPC, type SchnittProjekt } from '@shared/app'
import type { SettingsStore } from '../data/settings'
import type { JobQueue } from '../jobs/queue'
import type { ToolManager } from '../tools/manager'
import { FFMPEG } from '../tools/specs'
import { importJob, type ImportPayload } from './import'
import { medienUrl } from './medien'
import { ladeProjekt, ladeProjekte, loescheProjekt, projektOrdner, speichereProjekt, type Projekt } from './projekt'

/** Schnitt-Reiter (ROADMAP 6.x): Projekte, Import, Vorschau. */

async function datenOrdner(settings: SettingsStore): Promise<string> {
  if (process.env['MOIN_TEST_DATEN']) return process.env['MOIN_TEST_DATEN']
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
}

export const VIDEO_ENDUNGEN = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'ts']

export function registerSchnittIpc(
  queue: JobQueue,
  settings: SettingsStore,
  tools: ToolManager,
  getWindow: () => BrowserWindow | undefined
): { starteImport: (video: string, kanal?: string) => Promise<string> } {
  queue.register('schnitt-import', importJob)

  const alsAnsicht = (daten: string, p: Projekt): SchnittProjekt => {
    const ordner = projektOrdner(daten, p.id)
    const job = p.auftrag ? queue.get(p.auftrag) : undefined
    return {
      id: p.id,
      name: p.name,
      kanal: p.kanal,
      erstellt: p.erstellt,
      quelle: p.quelle ? { pfad: p.quelle.pfad, dauer: p.quelle.dauer, breite: p.quelle.breite, hoehe: p.quelle.hoehe, fps: p.quelle.fps, groesse: p.quelle.groesse, audio: p.quelle.audio } : null,
      proxyUrl: p.proxy ? medienUrl(join(ordner, 'proxy.mp4')) : null,
      leisteUrl: p.leiste ? medienUrl(join(ordner, 'leiste.jpg')) : null,
      wellenform: p.wellenform,
      auftrag: job && job.state !== 'done' ? { state: job.state, progress: job.progress, step: job.step, error: job.error ?? null } : null
    }
  }

  const starteImport = async (video: string, kanal = 'MoinMornhart'): Promise<string> => {
    const daten = await datenOrdner(settings)
    const ffmpeg = await tools.exePath(FFMPEG)
    if (!ffmpeg) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
    const id = randomUUID().slice(0, 8)
    const projekt: Projekt = {
      id,
      name: basename(video, extname(video)),
      kanal,
      erstellt: new Date().toISOString(),
      quelle: { pfad: video, groesse: 0, pruefsumme: '', dauer: 0, breite: 0, hoehe: 0, fps: 0, audio: false },
      proxy: false,
      wellenform: false,
      leiste: false
    }
    await speichereProjekt(daten, projekt)
    const payload: ImportPayload = { daten, projekt: id, ffmpeg, ffprobe: join(dirname(ffmpeg), 'ffprobe.exe') }
    const auftrag = await queue.enqueue('schnitt-import', `Schnitt: ${projekt.name} importieren`, payload)
    await speichereProjekt(daten, { ...projekt, auftrag })
    return id
  }

  ipcMain.handle(IPC.schnittProjekte, async (): Promise<SchnittProjekt[]> => {
    const daten = await datenOrdner(settings)
    return (await ladeProjekte(daten)).map((p) => alsAnsicht(daten, p))
  })
  ipcMain.handle(IPC.schnittImport, async (_e, kanal: unknown): Promise<string | null> => {
    const win = getWindow()
    const opts = { title: 'Rohvideo wählen', filters: [{ name: 'Video', extensions: VIDEO_ENDUNGEN }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    return starteImport(wahl.filePaths[0], typeof kanal === 'string' ? kanal : undefined)
  })
  ipcMain.handle(IPC.schnittWellenform, async (_e, id: unknown): Promise<{ aufloesung: number; werte: number[] } | null> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (!p?.wellenform) return null
    return JSON.parse(await readFile(join(projektOrdner(daten, p.id), 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }
  })
  ipcMain.handle(IPC.schnittLoeschen, async (_e, id: unknown): Promise<void> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (p?.auftrag) await queue.remove(p.auftrag)
    await loescheProjekt(daten, String(id))
  })
  return { starteImport }
}
