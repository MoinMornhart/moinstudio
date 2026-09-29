import { ipcMain } from 'electron'
import { IPC, type AdobeStatus } from '@shared/app'
import { findeAdobe } from './erkennung'

/** Adobe (ROADMAP M8, ungetestet): Erkennung für die Einstellungen; das Ergebnis wird bis zum nächsten „Neu suchen“ gemerkt. */
export function registerAdobeIpc(): void {
  let letzte: Promise<AdobeStatus> | null = null
  const suche = (): Promise<AdobeStatus> => (letzte = findeAdobe().then((programme) => ({ programme, gesucht: new Date().toISOString() })))
  ipcMain.handle(IPC.adobeStatus, (_e, neu: unknown) => (neu === true || !letzte ? suche() : letzte))
}
