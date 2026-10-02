import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { IPC, type SchnittProjekt, type SchnittEffekt } from '@shared/app'
import type { SettingsStore } from '../data/settings'
import type { JobQueue } from '../jobs/queue'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY, FFMPEG, UV } from '../tools/specs'
import { ladeSkins } from '../thumbnail/ipc'
import type { HardwareController } from '../hardware/controller'
import { ProfileStore } from '../hardware/profile'
import { localRoot } from '../tools/ipc'
import { resourceDir } from '../resources'
import { liesAbschnitte, transkriptJob, type Abschnitt, type TranskriptPayload } from './transkript'
import { rohschnittJob, type RohschnittPayload, type Schnittliste } from './rohschnitt'
import { findClaudeCli } from '../claude/cli'
import { bereichSetzen, umschalten, wunschJob, type WunschPayload } from './bearbeiten'
import { einstellungen, vorschauJob, type VorschauPayload } from './vorschau'
import { exportJob, kapitelText, type ExportErgebnis, type ExportPayload } from './export'
import { clipsJob, highlightJob, type ClipsPayload, type Highlight, type HighlightPayload } from './highlights'
import { readdir } from 'node:fs/promises'
import { copyFile } from 'node:fs/promises'
import { importJob, type ImportPayload } from './import'
import { medienUrl } from './medien'
import type { EffektHilfe } from './effekt-vorbereitung'
import { aendereProjekt, ladeProjekt, ladeProjekte, loescheProjekt, projektOrdner, speichereProjekt, type Projekt } from './projekt'
import { liesMitKonfliktkopien } from '../data/jsonfile'
import { videoDateiname, videoName } from '../dateinamen'
import { aendereKarte, ladeKarten } from '../planung/karten'

/** Schnitt-Reiter (ROADMAP 6.x): Projekte, Import, Vorschau. */

async function datenOrdner(settings: SettingsStore): Promise<string> {
  if (process.env['MOIN_TEST_DATEN']) return process.env['MOIN_TEST_DATEN']
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
}

export const VIDEO_ENDUNGEN = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'ts']

/** Pfade für Effekte (ROADMAP E.2): Python für Texte in Minecraft-Schrift, Ordner für Geräusche */
const effektHilfe = (ffmpeg: string): EffektHilfe => ({ ffmpeg, python: join(localRoot(), 'py', 'vorlage', 'Scripts', 'python.exe'), textSkript: join(resourceDir('blender'), 'text_bild.py'), lokal: localRoot() })

/** Dazu Blender und Philips Skin für Skin-Stings im Intro (M10, A.3) – fehlt eins davon, gibt es den Sting ohne Figur */
async function effektHilfeMitSting(ffmpeg: string, daten: string, tools: ToolManager, hardware: HardwareController): Promise<EffektHilfe> {
  const hilfe = effektHilfe(ffmpeg)
  try {
    const ich = (await ladeSkins(daten)).find((s) => s.rolle === 'ich')
    const profile = await hardware.profiles.load()
    if (!ich || !profile) return hilfe
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((s) => s.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) return hilfe
    return {
      ...hilfe,
      sting: {
        blender: { exe, mesa: config.blenderMesa, geraet: config.final.engine === 'CYCLES' ? config.final.device : 'CPU' },
        blenderDir: resourceDir('blender'),
        figur: { skin: join(daten, 'skins', ich.datei), slim: ich.slim },
        samples: Math.max(12, Math.min(32, Math.round(config.final.samples / 2)))
      }
    }
  } catch {
    return hilfe
  }
}

export function registerSchnittIpc(
  queue: JobQueue,
  settings: SettingsStore,
  tools: ToolManager,
  hardware: HardwareController,
  getWindow: () => BrowserWindow | undefined,
  starteVideo: (video: string, kanal: string, titel?: string) => Promise<string>
): { starteImport: (video: string, kanal?: string) => Promise<string>; starteWunsch: (id: string, wunsch: string) => Promise<string>; aufruf: (kanal: string, ...a: unknown[]) => Promise<unknown> } {
  queue.register('schnitt-import', importJob)
  // Jede Schnitt-Funktion ist über IPC (Oberfläche) und über aufruf() (Claude Desktop, ROADMAP 6.9) erreichbar
  const methoden = new Map<string, (...a: unknown[]) => Promise<unknown>>()
  const biete = <A extends unknown[]>(kanal: string, fn: (...a: A) => unknown): void => {
    const f = async (...a: unknown[]): Promise<unknown> => fn(...(a as A))
    methoden.set(kanal, f)
    ipcMain.handle(kanal, (_e, ...a: unknown[]) => f(...a))
  }
  queue.register('schnitt-transkript', transkriptJob)
  queue.register('schnitt-rohschnitt', rohschnittJob)
  queue.register('schnitt-wunsch', wunschJob)
  queue.register('schnitt-vorschau', vorschauJob)
  queue.register('schnitt-export', exportJob)
  queue.register('schnitt-highlights', highlightJob)
  queue.register('schnitt-clips', clipsJob)

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
      einstellungen: einstellungen(p),
      exportiert: !!p.export,
      highlights: p.highlights ?? null,
      clipsStand: p.clips ?? null,
      antwort: p.antwort ?? null,
      vorschauUrl: p.vorschau ? `${medienUrl(join(ordner, 'vorschau.mp4'))}?v=${p.vorschau}` : null,
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

  biete(IPC.schnittProjekte, async (): Promise<SchnittProjekt[]> => {
    const daten = await datenOrdner(settings)
    return (await ladeProjekte(daten)).map((p) => alsAnsicht(daten, p))
  })
  biete(IPC.schnittImport, async (kanal: unknown): Promise<string | null> => {
    const win = getWindow()
    const opts = { title: 'Rohvideo wählen', filters: [{ name: 'Video', extensions: VIDEO_ENDUNGEN }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    return starteImport(wahl.filePaths[0], typeof kanal === 'string' ? kanal : undefined)
  })
  biete(IPC.schnittWellenform, async (id: unknown): Promise<{ aufloesung: number; werte: number[] } | null> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (!p?.wellenform) return null
    return JSON.parse(await readFile(join(projektOrdner(daten, p.id), 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }
  })
  biete(IPC.schnittTranskript, async (id: unknown): Promise<Abschnitt[] | null> => {
    const daten = await datenOrdner(settings)
    const text = await readFile(join(projektOrdner(daten, String(id)), 'transkript.jsonl'), 'utf8').catch(() => null)
    return text === null ? null : liesAbschnitte(text)
  })
  biete(IPC.schnittTranskriptStart, async (id: unknown) => starteTranskript(String(id)))
  biete(IPC.schnittRohschnittStart, async (id: unknown) => starteRohschnitt(String(id)))
  // Schnitt ändern (ROADMAP 6.5): direkt in der Schnittliste, Wunsch in Worten als Auftrag
  const aendereListe = async (id: string, f: (l: Schnittliste) => Schnittliste): Promise<Schnittliste> => {
    const daten = await datenOrdner(settings)
    const datei = join(projektOrdner(daten, id), 'schnitt.json')
    const neu = f(JSON.parse(await liesMitKonfliktkopien(datei)) as Schnittliste)
    await writeFile(datei, JSON.stringify(neu, null, 1))
    return neu
  }
  biete(IPC.schnittUmschalten, (id: unknown, index: unknown) => aendereListe(String(id), (l) => umschalten(l, Number(index))))
  biete(IPC.schnittBereich, (id: unknown, start: unknown, ende: unknown, raus: unknown, text: unknown) =>
    aendereListe(String(id), (l) => bereichSetzen(l, Number(start), Number(ende), raus === true, typeof text === 'string' ? text : undefined))
  )
  const starteWunsch = async (id: unknown, wunsch: unknown): Promise<string> => {
    const text = typeof wunsch === 'string' ? wunsch.trim() : ''
    if (!text) throw new Error('Bitte schreib, was geändert werden soll.')
    const daten = await datenOrdner(settings)
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude ist nicht verbunden (Einstellungen → Mit Claude verbinden).')
    const payload: WunschPayload = { daten, projekt: String(id), wunsch: text, claudeCli: cli, ffmpeg: (await tools.exePath(FFMPEG)) ?? undefined }
    const auftrag = await queue.enqueue('schnitt-wunsch', `Schnitt: ${text.slice(0, 40)}`, payload)
    await aendereProjekt(daten, String(id), (p) => ({ auftraege: [...(p.auftraege ?? []), auftrag] }))
    // danach gleich die Vorschau, damit Philip das Ergebnis sieht
    void queue.waitFor(auftrag).then((j) => (j.state === 'done' ? starteVorschau(id) : null)).catch(() => undefined)
    return auftrag
  }
  biete(IPC.schnittWunsch, (id: unknown, wunsch: unknown) => starteWunsch(id, wunsch))
  biete(IPC.schnittEinstellungen, async (id: unknown, patch: unknown) => {
    const daten = await datenOrdner(settings)
    const q = (patch ?? {}) as { untertitel?: string; zooms?: boolean }
    await aendereProjekt(daten, String(id), (p) => ({
      einstellungen: {
        ...p.einstellungen,
        ...(q.untertitel === 'aus' || q.untertitel === 'an' || q.untertitel === 'karaoke' ? { untertitel: q.untertitel } : {}),
        ...(typeof q.zooms === 'boolean' ? { zooms: q.zooms } : {})
      }
    }))
  })
  const starteVorschau = async (id: unknown): Promise<string> => {
    const daten = await datenOrdner(settings)
    const ffmpeg = await tools.exePath(FFMPEG)
    if (!ffmpeg) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
    const p = await ladeProjekt(daten, String(id))
    if (!p) throw new Error('Projekt nicht gefunden.')
    const payload: VorschauPayload = { daten, projekt: p.id, ffmpeg, hilfe: await effektHilfeMitSting(ffmpeg, daten, tools, hardware) }
    const auftrag = await queue.enqueue('schnitt-vorschau', `Schnitt: ${p.name} Vorschau`, payload)
    await aendereProjekt(daten, p.id, (x) => ({ auftraege: [...(x.auftraege ?? []), auftrag] }))
    return auftrag
  }
  biete(IPC.schnittVorschau, starteVorschau)
  // Effektliste (ROADMAP E.5): so wie gespeichert (Originalzeit), auch ausgeschaltete
  const effektDatei = async (id: unknown): Promise<string> => join(projektOrdner(await datenOrdner(settings), String(id)), 'effekte.json')
  biete(IPC.schnittEffekte, async (id: unknown): Promise<SchnittEffekt[]> => JSON.parse(await liesMitKonfliktkopien(await effektDatei(id)).catch(() => '[]')) as SchnittEffekt[])
  biete(IPC.schnittEffektAendern, async (id: unknown, index: unknown, aenderung: unknown): Promise<SchnittEffekt[]> => {
    const datei = await effektDatei(id)
    const liste = JSON.parse(await liesMitKonfliktkopien(datei).catch(() => '[]')) as SchnittEffekt[]
    const i = Number(index)
    if (!liste[i]) throw new Error('Effekt nicht gefunden.')
    if (aenderung === null) liste.splice(i, 1)
    else liste[i] = { ...liste[i], aus: !!(aenderung as { aus?: boolean }).aus }
    await writeFile(datei, JSON.stringify(liste, null, 1))
    return liste
  })
  // Export für YouTube (ROADMAP 6.7)
  biete(IPC.schnittExport, async (id: unknown): Promise<string> => {
    const daten = await datenOrdner(settings)
    const ffmpeg = await tools.exePath(FFMPEG)
    if (!ffmpeg) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
    const p = await ladeProjekt(daten, String(id))
    if (!p) throw new Error('Projekt nicht gefunden.')
    const profile = await hardware.profiles.load()
    const payload: ExportPayload = { daten, projekt: p.id, ffmpeg, ffprobe: join(dirname(ffmpeg), 'ffprobe.exe'), encoder: profile ? ProfileStore.effective(profile).encoder : 'libx264', claudeCli: await findClaudeCli(), hilfe: await effektHilfeMitSting(ffmpeg, daten, tools, hardware) }
    const auftrag = await queue.enqueue('schnitt-export', `Schnitt: ${p.name} exportieren`, payload)
    await aendereProjekt(daten, p.id, (x) => ({ auftraege: [...(x.auftraege ?? []), auftrag] }))
    return auftrag
  })
  biete(IPC.schnittExportInfo, async (id: unknown) => {
    const daten = await datenOrdner(settings)
    const text = await readFile(join(projektOrdner(daten, String(id)), 'export.json'), 'utf8').catch(() => null)
    if (!text) return null
    const e = JSON.parse(text) as ExportErgebnis
    const p = await ladeProjekt(daten, String(id))
    return { ...e, url: `${medienUrl(e.datei)}?v=${p?.export ?? 0}`, kapitelText: kapitelText(e.kapitel) }
  })
  biete(IPC.schnittExportSpeichern, async (id: unknown): Promise<string | null> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (!p?.export) return null
    const win = getWindow()
    const opts = { title: 'Fertiges Video speichern', defaultPath: videoDateiname(videoName({ name: p.name, quelle: p.quelle?.pfad }), 'mp4'), filters: [{ name: 'Video', extensions: ['mp4'] }] }
    const wahl = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (wahl.canceled || !wahl.filePath) return null
    await copyFile(join(projektOrdner(daten, p.id), 'export.mp4'), wahl.filePath)
    // Titel, Beschreibung und Kapitel gleich benannt daneben (Video.mp4 → Video.txt), fertig zum Einfügen bei YouTube
    const e = JSON.parse(await readFile(join(projektOrdner(daten, p.id), 'export.json'), 'utf8').catch(() => 'null')) as ExportErgebnis | null
    if (e) {
      const text = [e.titel[0] ?? p.name, '', e.beschreibung, ...(e.kapitel.length ? ['', kapitelText(e.kapitel)] : [])].join('\r\n')
      await writeFile(wahl.filePath.replace(/\.[^.\\/]+$/, '') + '.txt', text, 'utf8')
    }
    return wahl.filePath
  })
  // Übergabe ans Thumbnail: Claude sieht sich das fertige Video an und schlägt Thumbnails vor
  biete(IPC.schnittThumbnail, async (id: unknown): Promise<string> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (!p?.quelle) throw new Error('Projekt nicht gefunden.')
    const titel = p.export ? ((JSON.parse(await readFile(join(projektOrdner(daten, p.id), 'export.json'), 'utf8')) as ExportErgebnis).titel[0] ?? p.name) : p.name
    return starteVideo(p.export ? join(projektOrdner(daten, p.id), 'export.mp4') : p.quelle.pfad, p.kanal, titel)
  })
  // Stream-Highlights und Shorts (ROADMAP 6.8)
  const neuerAuftrag = async (daten: string, id: string, art: string, titel: string, payload: unknown): Promise<string> => {
    const auftrag = await queue.enqueue(art, titel, payload)
    await aendereProjekt(daten, id, (x) => ({ auftraege: [...(x.auftraege ?? []), auftrag] }))
    return auftrag
  }
  biete(IPC.schnittHighlightsStart, async (id: unknown): Promise<string> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    if (!p) throw new Error('Projekt nicht gefunden.')
    const payload: HighlightPayload = { daten, projekt: p.id, claudeCli: await findClaudeCli() }
    return neuerAuftrag(daten, p.id, 'schnitt-highlights', `Schnitt: ${p.name} Höhepunkte`, payload)
  })
  biete(IPC.schnittHighlights, async (id: unknown): Promise<Highlight[] | null> => {
    const daten = await datenOrdner(settings)
    const text = await readFile(join(projektOrdner(daten, String(id)), 'highlights.json'), 'utf8').catch(() => null)
    return text === null ? null : (JSON.parse(text) as Highlight[])
  })
  biete(IPC.schnittClips, async (id: unknown, auswahl: unknown): Promise<string> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    const ffmpeg = await tools.exePath(FFMPEG)
    const uv = await tools.exePath(UV)
    if (!p || !ffmpeg || !uv) throw new Error('Projekt, FFmpeg oder uv fehlt.')
    const profile = await hardware.profiles.load()
    const liste = (Array.isArray(auswahl) ? auswahl : []).filter((a): a is { index: number; art: 'clip' | 'short' } => typeof a?.index === 'number' && (a.art === 'clip' || a.art === 'short'))
    if (!liste.length) throw new Error('Nichts ausgewählt.')
    const payload: ClipsPayload = { daten, projekt: p.id, ffmpeg, encoder: profile ? ProfileStore.effective(profile).encoder : 'libx264', uv, pyDir: join(localRoot(), 'py', 'vorlage'), facecamSkript: join(resourceDir('blender'), 'facecam.py'), auswahl: liste }
    return neuerAuftrag(daten, p.id, 'schnitt-clips', `Schnitt: ${p.name} ${liste.length} Clip(s)`, payload)
  })
  biete(IPC.schnittClipDateien, async (id: unknown): Promise<{ name: string; url: string }[]> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    const ordner = join(projektOrdner(daten, String(id)), 'clips')
    const namen = (await readdir(ordner).catch(() => [] as string[])).filter((n) => n.endsWith('.mp4')).sort()
    return namen.map((n) => ({ name: n, url: `${medienUrl(join(ordner, n))}?v=${p?.clips ?? 0}` }))
  })
  biete(IPC.schnittClipOrdner, async (id: unknown): Promise<void> => {
    const daten = await datenOrdner(settings)
    await shell.openPath(join(projektOrdner(daten, String(id)), 'clips'))
  })
  biete(IPC.schnittListe, async (id: unknown): Promise<Schnittliste | null> => {
    const daten = await datenOrdner(settings)
    const text = await liesMitKonfliktkopien(join(projektOrdner(daten, String(id)), 'schnitt.json')).catch(() => null)
    return text === null ? null : (JSON.parse(text) as Schnittliste)
  })
  // Umbenennen (Philip, 30.09.2026): der Name gilt für Export, Shorts und Premiere; ein gewählter Namensvorschlag wird
  // zusätzlich YouTube-Titel – im letzten Export und in der verknüpften Planungskarte
  biete(IPC.schnittUmbenennen, async (id: unknown, name: unknown, youtube: unknown): Promise<SchnittProjekt> => {
    const neu = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    if (!neu) throw new Error('Bitte einen Namen eingeben.')
    const daten = await datenOrdner(settings)
    const p = await aendereProjekt(daten, String(id), () => ({ name: neu, ...(youtube === true ? { youtubeTitel: neu } : {}) }))
    if (!p) throw new Error('Projekt nicht gefunden.')
    if (youtube === true) {
      const datei = join(projektOrdner(daten, p.id), 'export.json')
      const e = JSON.parse(await readFile(datei, 'utf8').catch(() => 'null')) as ExportErgebnis | null
      if (e) await writeFile(datei, JSON.stringify({ ...e, titel: [neu, ...e.titel.filter((t) => t !== neu)] }, null, 1))
      const karte = (await ladeKarten(daten)).find((k) => k.schnitt === p.id)
      if (karte?.youtube) await aendereKarte(daten, karte.id, { youtube: { ...karte.youtube, titel: neu } })
    }
    return alsAnsicht(daten, p)
  })
  biete(IPC.schnittLoeschen, async (id: unknown): Promise<void> => {
    const daten = await datenOrdner(settings)
    const p = await ladeProjekt(daten, String(id))
    for (const a of p?.auftraege ?? []) await queue.remove(a)
    await loescheProjekt(daten, String(id))
  })
  const aufruf = async (kanal: string, ...a: unknown[]): Promise<unknown> => {
    const f = methoden.get(kanal)
    if (!f) throw new Error(`Unbekannte Schnitt-Funktion: ${kanal}`)
    return f(...a)
  }
  return { starteImport, starteWunsch, aufruf }
}
