import { ipcMain, shell } from 'electron'
import type { SettingsStore } from '../data/settings'
import { premiereDateien } from './premiere-export'
import { IPC, type AdobeStatus } from '@shared/app'
import { findeAdobe } from './erkennung'

/** Adobe (ROADMAP M8, ungetestet): Erkennung für die Einstellungen; das Ergebnis wird bis zum nächsten „Neu suchen“ gemerkt. */
export function registerAdobeIpc(settings: SettingsStore): void {
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
