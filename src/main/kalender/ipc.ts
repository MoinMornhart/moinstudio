import { ipcMain, safeStorage, type BrowserWindow } from 'electron'
import { IPC, type KalenderLink } from '@shared/app'
import { beobachteKarten } from '../planung/karten'
import { KalenderSync } from './sync'

/** Kalender-Abgleich (Philip, 05.10.) an die Oberfläche anbinden und im Hintergrund laufen lassen. */
export function registerKalenderIpc(o: { daten: () => Promise<string>; geraet: string; getWindow: () => BrowserWindow | undefined }): KalenderSync {
  const sync = new KalenderSync({
    daten: o.daten,
    geraet: o.geraet,
    // app-spezifisches Passwort mit Windows (DPAPI) verschlüsseln – lesbar nur für diesen Benutzer auf diesem Gerät
    verschluessele: (t) => (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(t).toString('base64') : Buffer.from(t).toString('base64')),
    entschluessele: (t) => (safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(t, 'base64')) : Buffer.from(t, 'base64').toString()),
    melde: () => o.getWindow()?.webContents.send(IPC.kalenderGeaendert)
  })
  ipcMain.handle(IPC.kalenderStand, () => sync.stand())
  ipcMain.handle(IPC.kalenderApple, (_e, benutzer: unknown, passwort: unknown) => sync.verbindeApple(String(benutzer ?? ''), String(passwort ?? '')))
  ipcMain.handle(IPC.kalenderAppleTrennen, () => sync.trenneApple())
  ipcMain.handle(IPC.kalenderEinstellen, (_e, e: { eintragen?: boolean; ausgeblendet?: string[]; links?: KalenderLink[] }) => sync.einstellen(e ?? {}))
  ipcMain.handle(IPC.kalenderLinkPruefen, (_e, url: unknown) => sync.pruefeLink(String(url ?? '')))
  ipcMain.handle(IPC.kalenderJetzt, () => sync.synchronisiere())

  // Kartenänderungen (auch vom anderen Gerät) kurz danach in den Kalender bringen
  let beobachtet: { daten: string; stopp: () => void } | null = null
  const beobachte = async (): Promise<void> => {
    const d = await o.daten().catch(() => null)
    if (!d || beobachtet?.daten === d) return
    beobachtet?.stopp()
    beobachtet = { daten: d, stopp: beobachteKarten(d, () => sync.anstossen(), 1_500) }
  }
  void beobachte()
  setInterval(() => void beobachte(), 60_000).unref()
  sync.start()
  return sync
}
