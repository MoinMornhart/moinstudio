import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import type { ThumbStart } from '@shared/app'
import type { JobQueue } from '../jobs/queue'
import { medienUrl } from '../schnitt/medien'
import { ladeProjekt } from '../schnitt/projekt'
import type { ThumbnailVariante } from '../thumbnail/job'
import { naechsteSpalte, verbindePlanung } from './verbindung'
import { findClaudeCli } from '../claude/cli'
import { resourceDir } from '../resources'
import { planungClaudeJob, type PlanungClaudeArt, type PlanungClaudeErgebnis, type PlanungClaudePayload } from './ideen'
import { rhythmusAus, type Rhythmus } from '@shared/kalender'
import { writeJsonAtomic } from '../data/jsonfile'
import { IPC, type PlanungClaudeStand, type PlanungKarte, type PlanungThumbStand } from '@shared/app'
import type { SettingsStore } from '../data/settings'
import { aendereKarte, beobachteKarten, kartenOrdner, ladeKarten, type Karte, loescheKarte, neueKarte, verschiebeKarte, type KartenAenderung, type Kanal, type Spalte } from './karten'

/** Planung (ROADMAP 7.3): Karten für die Oberfläche; Änderungen im Ordner (auch vom anderen Gerät) werden gemeldet. */

async function datenOrdner(settings: SettingsStore): Promise<string> {
  if (process.env['MOIN_TEST_DATEN']) return process.env['MOIN_TEST_DATEN']
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
}

const VIDEO_ENDUNGEN = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'ts']

/** Pfad relativ zum Datenordner, nur wenn die Datei wirklich darin liegt */
const imDaten = (d: string, pfad: string): string | null => {
  const r = relative(d, pfad)
  return r && !r.startsWith('..') && !isAbsolute(r) ? r.replace(/\\/g, '/') : null
}

export interface PlanungVerbindung {
  queue: JobQueue
  starteThumbnail: (start: ThumbStart) => Promise<string>
  starteImport: (video: string, kanal?: string) => Promise<string>
}

export function registerPlanungIpc(settings: SettingsStore, getWindow: () => BrowserWindow | undefined, v: PlanungVerbindung): { aufruf: (kanal: string, ...a: unknown[]) => Promise<unknown>; daten: () => Promise<string> } {
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

  // Vorschaubild über das Medien-Protokoll (liegt im Datenordner, also auf jedem Gerät sichtbar)
  const mitBild = (d: string, k: Karte): PlanungKarte => {
    const rel = k.thumbnail?.bild
    const pfad = rel ? join(d, rel) : null
    return { ...k, bildUrl: pfad && imDaten(d, pfad) ? medienUrl(pfad) : null }
  }
  const meldeGeaendert = (): void => getWindow()?.webContents.send(IPC.planungGeaendert)
  verbindePlanung(v.queue, daten, meldeGeaendert)

  biete(IPC.planungKarten, async (): Promise<PlanungKarte[]> => {
    const d = await daten()
    return (await ladeKarten(d)).map((k) => mitBild(d, k))
  })
  biete(IPC.planungNeu, async (basis: { kanal: Kanal; titel: string; spalte?: Spalte; termin?: string | null; notizen?: string }): Promise<PlanungKarte> => {
    const titel = String(basis?.titel ?? '').trim()
    if (!titel) throw new Error('Bitte einen Titel eingeben.')
    const d = await daten()
    return mitBild(d, await neueKarte(d, { ...basis, titel }))
  })
  biete(IPC.planungAendern, async (id: string, aenderung: KartenAenderung): Promise<PlanungKarte> => {
    const d = await daten()
    return mitBild(d, await aendereKarte(d, String(id), aenderung))
  })
  biete(IPC.planungVerschieben, async (id: string, ziel: { spalte: Spalte; index: number; kanal?: Kanal }): Promise<PlanungKarte> => {
    const d = await daten()
    return mitBild(d, await verschiebeKarte(d, String(id), ziel))
  })

  // Verbindung zu Schnitt und Thumbnail (ROADMAP 7.5)
  const karte = async (d: string, id: string): Promise<Karte> => {
    const k = (await ladeKarten(d)).find((x) => x.id === String(id))
    if (!k) throw new Error('Karte nicht gefunden.')
    return k
  }
  biete(IPC.planungSchneiden, async (id: string): Promise<PlanungKarte | null> => {
    const d = await daten()
    const k = await karte(d, id)
    const win = getWindow()
    const opts = { title: `Rohvideo für „${k.titel}“`, filters: [{ name: 'Video', extensions: VIDEO_ENDUNGEN }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    const projekt = await v.starteImport(wahl.filePaths[0], k.kanal)
    return mitBild(d, await aendereKarte(d, k.id, { schnitt: projekt, spalte: naechsteSpalte(k, 'import') }))
  })
  biete(IPC.planungThumbnail, async (id: string): Promise<PlanungKarte> => {
    const d = await daten()
    const k = await karte(d, id)
    const notiz = k.notizen.trim()
    const beschreibung = (notiz ? `${k.titel}. ${notiz}` : k.titel).slice(0, 600)
    const auftrag = await v.starteThumbnail({ beschreibung, kanal: k.kanal })
    return mitBild(d, await aendereKarte(d, k.id, { thumbnail: { auftrag, bild: null, gewaehlt: false } }))
  })
  biete(IPC.planungThumbVarianten, async (id: string): Promise<PlanungThumbStand> => {
    const d = await daten()
    const k = await karte(d, id)
    const auftrag = k.thumbnail?.auftrag
    const job = auftrag ? v.queue.get(auftrag) : undefined
    const varianten = (auftrag ? (v.queue.result<{ varianten: ThumbnailVariante[] }>(auftrag)?.varianten ?? []) : [])
      .map((x) => ({ titel: x.titel, pfad: x.bild ? imDaten(d, x.bild) : null }))
      .filter((x): x is { titel: string; pfad: string } => !!x.pfad)
      .map((x) => ({ ...x, url: medienUrl(join(d, x.pfad)) }))
    return { auftrag: job ? { state: job.state, progress: job.progress, step: job.step, error: job.error ?? null } : null, varianten }
  })
  biete(IPC.planungThumbWaehlen, async (id: string, pfad: string): Promise<PlanungKarte> => {
    const d = await daten()
    const k = await karte(d, id)
    const rel = imDaten(d, join(d, String(pfad)))
    if (!rel) throw new Error('Das Bild liegt nicht im Datenordner.')
    const projekt = k.schnitt ? await ladeProjekt(d, k.schnitt) : null
    const exportiert = !k.schnitt || !!projekt?.export
    const thumbnail = { auftrag: k.thumbnail?.auftrag ?? null, bild: rel, gewaehlt: true }
    return mitBild(d, await aendereKarte(d, k.id, { thumbnail, spalte: naechsteSpalte({ ...k, thumbnail }, 'thumbnail-gewaehlt', exportiert) }))
  })
  // Upload-Rhythmus: eine kleine Datei für beide Kanäle, wird selten geändert
  const rhythmusDatei = (d: string): string => join(d, 'planning', 'rhythmus.json')
  biete(IPC.planungRhythmus, async (): Promise<Rhythmus> => {
    const text = await readFile(rhythmusDatei(await daten()), 'utf8').catch(() => null)
    try {
      return rhythmusAus(text ? JSON.parse(text) : {})
    } catch {
      return {}
    }
  })
  biete(IPC.planungRhythmusSetzen, async (roh: unknown): Promise<Rhythmus> => {
    const r = rhythmusAus(roh)
    await writeJsonAtomic(rhythmusDatei(await daten()), r)
    return r
  })
  // Planung mit Claude (ROADMAP 7.6): Ideen, Titel, Wochenplan als Auftrag über das Abo
  v.queue.register('planung-claude', planungClaudeJob)
  const ART_TITEL: Record<PlanungClaudeArt, string> = { ideen: 'Ideen', titel: 'Titelvorschläge', woche: 'Wochenplan' }
  biete(IPC.planungClaude, async (art: PlanungClaudeArt, o: { kanal?: string; wunsch?: string; karte?: string } = {}): Promise<string> => {
    if (!(art in ART_TITEL)) throw new Error('Unbekannte Anfrage.')
    const claudeCli = await findClaudeCli()
    if (!claudeCli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const payload: PlanungClaudePayload = { art, daten: await daten(), claudeCli, configDir: resourceDir('config'), kanal: o.kanal ?? 'MoinMornhart', wunsch: o.wunsch, karte: o.karte }
    return v.queue.enqueue('planung-claude', `Planung: ${ART_TITEL[art]}${art === 'ideen' ? ` für ${payload.kanal}` : ''}`, payload)
  })
  biete(IPC.planungClaudeStand, async (auftrag: string): Promise<PlanungClaudeStand | null> => {
    const job = v.queue.get(String(auftrag))
    if (!job) return null
    return { state: job.state, progress: job.progress, step: job.step, error: job.error ?? null, ergebnis: job.state === 'done' ? (v.queue.result<PlanungClaudeErgebnis>(job.id) ?? null) : null }
  })
  biete(IPC.planungLoeschen, async (id: string): Promise<void> => loescheKarte(await daten(), String(id)))

  const aufruf = async (kanal: string, ...a: unknown[]): Promise<unknown> => {
    const f = methoden.get(kanal)
    if (!f) throw new Error(`Unbekannte Planungs-Funktion: ${kanal}`)
    return f(...a)
  }
  return { aufruf, daten }
}
