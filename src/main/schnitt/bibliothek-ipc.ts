import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { dialog, ipcMain, Notification, type BrowserWindow } from 'electron'
import { IPC, type BibEffektDaten, type BibDateiErgebnis, type BibNeu } from '@shared/app'
import { beobachteOrdner, ladeOrdner, ordnerEntfernen, ordnerHinzu, pruefeOrdner, type NeuerEffekt } from './bib-ordner'
import { dateiInBibliothek, ladeBibliothek, loescheBibEffekt, speichereBibEffekt, STANDARD_CHROMA, type BibEffekt, type Chroma } from './bibliothek'
import { dauerVon, keyFarbeErkennen, pixelFarbe, vorschauBild } from './chroma'
import { ladeProjekte, projektOrdner } from './projekt'

/** Oberfläche ↔ Effekt-Bibliothek (Philip, 05.10.). Dateien liegen im Datenordner, Pfade werden hier aufgelöst. */
export function registerBibliothekIpc(o: { datenOrdner: () => Promise<string>; ffmpeg: () => Promise<string | null>; getWindow: () => BrowserWindow | undefined }): void {
  const ffmpeg = async (): Promise<string> => {
    const f = await o.ffmpeg()
    if (!f) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
    return f
  }
  // Ordner eines Effekts, auch wenn er noch nicht gespeichert ist (erste Datei hochgeladen, Name fehlt noch)
  const ordnerDatei = (daten: string, id: string, datei: string): string => join(daten, 'effekte', id, datei)

  ipcMain.handle(IPC.schnittBib, async (): Promise<BibEffektDaten[]> => (await ladeBibliothek(await o.datenOrdner())) as BibEffektDaten[])

  ipcMain.handle(IPC.schnittBibSpeichern, async (_e, roh: unknown): Promise<BibEffektDaten> => (await speichereBibEffekt(await o.datenOrdner(), roh as Partial<BibEffekt>)) as BibEffektDaten)

  ipcMain.handle(IPC.schnittBibLoeschen, async (_e, id: unknown): Promise<void> => loescheBibEffekt(await o.datenOrdner(), String(id)))

  ipcMain.handle(IPC.schnittBibDatei, async (_e, idRoh: unknown, rolle: unknown, greenscreen: unknown): Promise<BibDateiErgebnis | null> => {
    const r = rolle === 'bild' || rolle === 'sound' ? rolle : 'video'
    const endungen = r === 'video' ? ['mp4', 'mov', 'webm', 'mkv', 'avi', 'gif'] : r === 'bild' ? ['png', 'jpg', 'jpeg', 'webp', 'gif'] : ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
    const titel = r === 'video' ? (greenscreen ? 'Greenscreen-Video wählen' : 'Video mit Transparenz wählen') : r === 'bild' ? 'Bild wählen' : 'Sound wählen'
    const win = o.getWindow()
    const opts = { title: titel, filters: [{ name: titel.replace(' wählen', ''), extensions: endungen }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    const daten = await o.datenOrdner()
    const id = typeof idRoh === 'string' && /^[a-z0-9-]+$/i.test(idRoh) ? idRoh : randomUUID().slice(0, 8)
    const datei = await dateiInBibliothek(daten, id, r, wahl.filePaths[0])
    const pfad = ordnerDatei(daten, id, datei)
    const ff = await ffmpeg()
    const dauer = r === 'bild' ? 0 : await dauerVon(ff, pfad).catch(() => 0)
    // Greenscreen: Key-Farbe gleich erkennen; nicht eindeutig → Standard-Grün, Philip kann per Pipette nachhelfen
    const chroma: Chroma | null = r === 'video' && greenscreen ? { ...STANDARD_CHROMA, farbe: (await keyFarbeErkennen(ff, pfad).catch(() => null)) ?? STANDARD_CHROMA.farbe } : null
    return { id, datei, dauer, chroma, erkannt: !!chroma && chroma.farbe !== STANDARD_CHROMA.farbe }
  })

  ipcMain.handle(IPC.schnittBibVorschau, async (_e, id: unknown, opts: unknown): Promise<string | null> => {
    const daten = await o.datenOrdner()
    const v = (opts ?? {}) as { video?: string; bild?: string; chroma?: Chroma | null; zeit?: number; roh?: boolean }
    const pfad = (d?: string): string | undefined => (d && /^[\w.-]+$/.test(d) ? ordnerDatei(daten, String(id), d) : undefined)
    const video = pfad(v.video)
    const bild = pfad(v.bild)
    if (!video && !bild) return null
    // Beispielbild: ein Standbild aus dem neuesten Projekt (so sieht man den Effekt über echtem Gameplay)
    const projekt = (await ladeProjekte(daten)).filter((p) => p.proxy).sort((a, b) => b.erstellt.localeCompare(a.erstellt))[0]
    const proxy = projekt ? join(projektOrdner(daten, projekt.id), 'proxy.mp4') : null
    return vorschauBild(await ffmpeg(), { video, bild, chroma: v.chroma ?? null, zeit: v.zeit ?? 0.5, hintergrund: proxy && existsSync(proxy) ? proxy : null, roh: !!v.roh })
  })

  // Effekt-Ordner (Philip, 05.10.): beobachten, neue Dateien als Effekt anlegen und an die Oberfläche melden
  const melde = (neu: NeuerEffekt[]): void => {
    const liste: BibNeu[] = neu.map((n) => ({ effekt: n.effekt as BibEffektDaten, art: n.art, quelle: n.quelle }))
    o.getWindow()?.webContents.send(IPC.schnittBibNeu, liste)
    const fenster = o.getWindow()
    if (fenster && !fenster.isFocused() && Notification.isSupported()) {
      new Notification({ title: liste.length === 1 ? 'Neuer Effekt gefunden' : `${liste.length} neue Effekte gefunden`, body: `${liste.map((l) => l.effekt.name).join(', ')} – in MoinStudio einrichten` }).show()
    }
  }
  beobachteOrdner(o.datenOrdner, o.ffmpeg, melde)
  ipcMain.handle(IPC.schnittBibOrdner, async (): Promise<string[]> => (await ladeOrdner(await o.datenOrdner())).ordner)
  ipcMain.handle(IPC.schnittBibOrdnerHinzu, async (): Promise<string[]> => {
    const win = o.getWindow()
    const opts = { title: 'Ordner mit Effekten wählen', properties: ['openDirectory' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const daten = await o.datenOrdner()
    if (wahl.canceled || !wahl.filePaths[0]) return (await ladeOrdner(daten)).ordner
    const d = await ordnerHinzu(daten, wahl.filePaths[0])
    // gleich durchsehen: was schon im Ordner liegt, kommt sofort als Popup
    void ffmpeg()
      .then((ff) => pruefeOrdner(daten, ff))
      .then((neu) => neu.length && melde(neu))
      .catch((err: unknown) => console.error('Effekt-Ordner', err))
    return d.ordner
  })
  ipcMain.handle(IPC.schnittBibOrdnerEntfernen, async (_e, pfad: unknown): Promise<string[]> => (await ordnerEntfernen(await o.datenOrdner(), String(pfad))).ordner)

  ipcMain.handle(IPC.schnittBibPipette, async (_e, id: unknown, datei: unknown, x: unknown, y: unknown, zeit: unknown): Promise<string> => {
    const daten = await o.datenOrdner()
    if (typeof datei !== 'string' || !/^[\w.-]+$/.test(datei)) throw new Error('Ungültige Datei.')
    return pixelFarbe(await ffmpeg(), ordnerDatei(daten, String(id), datei), Number(x), Number(y), Number(zeit) || 0.5)
  })
}
