import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import type { JobQueue } from '../jobs/queue'
import type { ThumbnailVariante } from '../thumbnail/job'
import { thumbnailPsd } from './photoshop'
import type { SettingsStore } from '../data/settings'
import { premiereDateien } from './premiere-export'
import { IPC, type AdobeStatus } from '@shared/app'
import { findeAdobe } from './erkennung'

/** Adobe (ROADMAP M8, ungetestet): Erkennung für die Einstellungen; das Ergebnis wird bis zum nächsten „Neu suchen“ gemerkt. */
export function registerAdobeIpc(settings: SettingsStore, queue: JobQueue, getWindow: () => BrowserWindow | undefined): void {
  // Photoshop (ROADMAP 8.4): Variante eines Thumbnail-Auftrags als PSD mit Ebenen speichern
  ipcMain.handle(IPC.thumbPhotoshop, async (_e, jobId: unknown, index: unknown) => {
    const v = queue.result<{ varianten: ThumbnailVariante[] }>(String(jobId))?.varianten[Number(index)]
    if (!v?.bild) return null
    const win = getWindow()
    const opts = { title: 'Als Photoshop-Datei speichern', defaultPath: `${v.titel.replace(/[\\/:*?"<>|]/g, '')}.psd`, filters: [{ name: 'Photoshop', extensions: ['psd'] }] }
    // Prüfabläufe (MOIN_TEST_ZIEL) speichern ohne Dialog
    const test = process.env['MOIN_TEST_ZIEL']
    const ziel = test ? { canceled: false, filePath: test } : win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (ziel.canceled || !ziel.filePath) return null
    const r = await thumbnailPsd({ bild: v.bild, szene: v.szene ?? null, ziel: ziel.filePath })
    shell.showItemInFolder(ziel.filePath)
    return { datei: ziel.filePath, ebenen: r.ebenen }
  })
  let letzte: Promise<AdobeStatus> | null = null
  const suche = (): Promise<AdobeStatus> => (letzte = findeAdobe().then((programme) => ({ programme, gesucht: new Date().toISOString() })))
  // Premiere (ROADMAP 8.3): Sequenz und Untertitel neben das Projekt legen und im Explorer zeigen
  ipcMain.handle(IPC.schnittPremiere, async (_e, id: unknown) => {
    const daten = process.env['MOIN_TEST_DATEN'] ?? (await settings.load()).dataDir
    if (!daten) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
    const r = await premiereDateien(daten, String(id))
    shell.showItemInFolder(r.xml)
    return r
  })
  ipcMain.handle(IPC.adobeStatus, (_e, neu: unknown) => (neu === true || !letzte ? suche() : letzte))
}
