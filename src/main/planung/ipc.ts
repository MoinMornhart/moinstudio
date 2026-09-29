import { ipcMain, type BrowserWindow } from 'electron'
import { mkdir } from 'node:fs/promises'
import { IPC, type PlanungKarte } from '@shared/app'
import type { SettingsStore } from '../data/settings'
import { aendereKarte, beobachteKarten, kartenOrdner, ladeKarten, loescheKarte, neueKarte, verschiebeKarte, type KartenAenderung, type Kanal, type Spalte } from './karten'

/** Planung (ROADMAP 7.3): Karten für die Oberfläche; Änderungen im Ordner (auch vom anderen Gerät) werden gemeldet. */

async function datenOrdner(settings: SettingsStore): Promise<string> {
  if (process.env['MOIN_TEST_DATEN']) return process.env['MOIN_TEST_DATEN']
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
}

export function registerPlanungIpc(settings: SettingsStore, getWindow: () => BrowserWindow | undefined): { aufruf: (kanal: string, ...a: unknown[]) => Promise<unknown> } {
  let beobachtet: { daten: string; stopp: () => void } | null = null
  const daten = async (): Promise<string> => {
    const d = await datenOrdner(settings)
    if (beobachtet?.daten !== d) {
      beobachtet?.stopp()
      await mkdir(kartenOrdner(d), { recursive: true })
      beobachtet = { daten: d, stopp: beobachteKarten(d, () => getWindow()?.webContents.send(IPC.planungGeaendert)) }
    }
    return d
  }

  // Wie beim Schnitt: jede Funktion über IPC (Oberfläche) und über aufruf() (Claude Desktop, ROADMAP 7.7)
  const methoden = new Map<string, (...a: unknown[]) => Promise<unknown>>()
  const biete = <A extends unknown[]>(kanal: string, fn: (...a: A) => unknown): void => {
    const f = async (...a: unknown[]): Promise<unknown> => fn(...(a as A))
    methoden.set(kanal, f)
    ipcMain.handle(kanal, (_e, ...a: unknown[]) => f(...a))
  }

  biete(IPC.planungKarten, async (): Promise<PlanungKarte[]> => ladeKarten(await daten()))
  biete(IPC.planungNeu, async (basis: { kanal: Kanal; titel: string; spalte?: Spalte; termin?: string | null; notizen?: string }): Promise<PlanungKarte> => {
    const titel = String(basis?.titel ?? '').trim()
    if (!titel) throw new Error('Bitte einen Titel eingeben.')
    return neueKarte(await daten(), { ...basis, titel })
  })
  biete(IPC.planungAendern, async (id: string, aenderung: KartenAenderung): Promise<PlanungKarte> => aendereKarte(await daten(), String(id), aenderung))
  biete(IPC.planungVerschieben, async (id: string, ziel: { spalte: Spalte; index: number; kanal?: Kanal }): Promise<PlanungKarte> => verschiebeKarte(await daten(), String(id), ziel))
  biete(IPC.planungLoeschen, async (id: string): Promise<void> => loescheKarte(await daten(), String(id)))

  const aufruf = async (kanal: string, ...a: unknown[]): Promise<unknown> => {
    const f = methoden.get(kanal)
    if (!f) throw new Error(`Unbekannte Planungs-Funktion: ${kanal}`)
    return f(...a)
  }
  return { aufruf }
}
