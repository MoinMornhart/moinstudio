import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { IPC, type SchnittProjekt } from '@shared/app'
import type { SettingsStore } from '../data/settings'
import type { JobQueue } from '../jobs/queue'
import type { ToolManager } from '../tools/manager'
import { FFMPEG, UV } from '../tools/specs'
import type { HardwareController } from '../hardware/controller'
import { ProfileStore } from '../hardware/profile'
import { localRoot } from '../tools/ipc'
import { resourceDir } from '../resources'
import { liesAbschnitte, transkriptJob, type Abschnitt, type TranskriptPayload } from './transkript'
import { rohschnittJob, type RohschnittPayload, type Schnittliste } from './rohschnitt'
import { findClaudeCli } from '../claude/cli'
import { importJob, type ImportPayload } from './import'
import { medienUrl } from './medien'
import { aendereProjekt, ladeProjekt, ladeProjekte, loescheProjekt, projektOrdner, speichereProjekt, type Projekt } from './projekt'

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
  hardware: HardwareController,
  getWindow: () => BrowserWindow | undefined
): { starteImport: (video: string, kanal?: string) => Promise<string> } {
  queue.register('schnitt-import', importJob)
  queue.register('schnitt-transkript', transkriptJob)
  queue.register('schnitt-rohschnitt', rohschnittJob)

  const alsAnsicht = (daten: string, p: Projekt): SchnittProjekt => {
    const ordner = projektOrdner(daten, p.id)
    const job = (p.auftraege ?? []).map((a) => queue.get(a)).find((j) => j && j.state !== 'done' && j.state !== 'cancelled')
    return {
      id: p.id,
      name: p.name,
      kanal: p.kanal,
      erstellt: p.erstellt,
      quelle: p.quelle ? { pfad: p.quelle.pfad, dauer: p.quelle.dauer, breite: p.quelle.breite, hoehe: p.quelle.hoehe, fps: p.quelle.fps, groesse: p.quelle.groesse, audio: p.quelle.audio } : null,
      proxyUrl: p.proxy ? medienUrl(join(ordner, 'proxy.mp4')) : null,
      leisteUrl: p.leiste ? medienUrl(join(ordner, 'leiste.jpg')) : null,
      wellenform: p.wellenform,
      transkript: !!p.transkript,
      rohschnitt: !!p.rohschnitt,
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
    const importAuftrag = await queue.enqueue('schnitt-import', `Schnitt: ${projekt.name} importieren`, payload)
    await aendereProjekt(daten, id, () => ({ auftraege: [importAuftrag] }))
    // Rohvideo rein, fertiges Video raus: das Transkript startet direkt danach von selbst
    await starteTranskript(id)
    return id
  }

  const starteTranskript = async (id: string): Promise<string> => {
    const daten = await datenOrdner(settings)
    const projekt = await ladeProjekt(daten, id)
    if (!projekt) throw new Error('Projekt nicht gefunden.')
    const ffmpeg = await tools.exePath(FFMPEG)
    const uv = await tools.exePath(UV)
    if (!ffmpeg || !uv) throw new Error('FFmpeg oder uv fehlt (Einstellungen → Werkzeuge).')
    const profile = await hardware.profiles.load()
    const whisper = profile ? ProfileStore.effective(profile).whisper : { model: 'small' as const, device: 'cpu' as const, compute: 'int8' as const }
    const payload: TranskriptPayload = { daten, projekt: id, ffmpeg, uv, pyDir: join(localRoot(), 'py', 'vorlage'), skript: join(resourceDir('blender'), 'transkript.py'), whisper, lokal: localRoot() }
    const auftrag = await queue.enqueue('schnitt-transkript', `Schnitt: ${projekt.name} Transkript`, payload)
    await aendereProjekt(daten, id, (neu) => ({ auftraege: [...(neu.auftraege ?? []), auftrag] }))
    // danach der Rohschnitt, ebenfalls von selbst
    await starteRohschnitt(id)
    return auftrag
  }

  const starteRohschnitt = async (id: string): Promise<string> => {
    const daten = await datenOrdner(settings)
    const projekt = await ladeProjekt(daten, id)
    if (!projekt) throw new Error('Projekt nicht gefunden.')
    const payload: RohschnittPayload = { daten, projekt: id, claudeCli: await findClaudeCli() }
    const auftrag = await queue.enqueue('schnitt-rohschnitt', `Schnitt: ${projekt.name} Rohschnitt`, payload)
    await aendereProjekt(daten, id, (neu) => ({ auftraege: [...(neu.auftraege ?? []), auftrag] }))
    return auftrag
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
  ipcMain.handle(IPC.schnittTranskript, async (_e, id: unknown): Promise<Abschnitt[] | null> => {
    const daten = await datenOrdner(settings)
    const text = await readFile(join(projektOrdner(daten, String(id)), 'transkript.jsonl'), 'utf8').catch(() => null)
    return text === null ? null : liesAbschnitte(text)
  })
  ipcMain.handle(IPC.schnittTranskriptStart, async (_e, id: unknown) => starteTranskript(String(id)))
  ipcMain.handle(IPC.schnittRohschnittStart, async (_e, id: unknown) => starteRohschnitt(String(id)))
  ipcMain.handle(IPC.schnittListe, async (_e, id: unknown): Promise<Schnittliste | null> => {
    const daten = await datenOrdner(settings)
    const text = await readFile(join(projektOrdner(daten, String(id)), 'schnitt.json'), 'utf8').catch(() => null)
    return text === null ? null : (JSON.parse(text) as Schnittliste)
  })
  ipcMain.handle(IPC.schnittLoeschen, async (_e, id: unknown): Promise<void> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    for (const a of p?.auftraege ?? []) await queue.remove(a)
    await loescheProjekt(daten, String(id))
  })
  return { starteImport }
}
