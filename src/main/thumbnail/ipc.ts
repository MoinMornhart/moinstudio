import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'
import { IPC, type ThumbAuftrag, type ThumbErgebnis, type ThumbSkin, type ThumbStart, type ThumbVideoErgebnis } from '@shared/app'
import { findClaudeCli } from '../claude/cli'
import { readJson, writeJsonAtomic } from '../data/jsonfile'
import type { SettingsStore } from '../data/settings'
import { ProfileStore } from '../hardware/profile'
import type { HardwareController } from '../hardware/controller'
import type { JobQueue } from '../jobs/queue'
import { resourceDir } from '../resources'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY, FFMPEG, UV } from '../tools/specs'
import { localRoot } from '../tools/ipc'
import { spielvorlageJob, type SpielvorlagePayload } from './spielvorlage'
import { aenderungJob, type AenderungPayload, type AenderungsArt } from './aenderung'
import { skinAusName } from './skinname'
import { z } from 'zod'
import { thumbnailJob, type ThumbnailPayload, type ThumbnailVariante } from './job'
import { ladeVorbilder } from './planung'
import { reaktionJob, type ReaktionPayload } from './reaktion'
import { videoVorschlaegeJob, type VideoPayload, type VideoVorschlag } from './video'

/**
 * Thumbnail-Reiter (ROADMAP 5.4): Skin-Bibliothek im Datenordner (Philip lädt seine Skins und die seiner Freunde selbst
 * hoch), Aufträge starten, Ergebnisse mit Vorbild ansehen und speichern.
 */

const SkinListe = z.array(z.object({ id: z.string(), name: z.string(), datei: z.string(), rolle: z.enum(['ich', 'freund']), slim: z.boolean().nullable().default(null) }))

async function datenOrdner(settings: SettingsStore): Promise<string> {
  // Integrationstests von der Kommandozeile schreiben in einen eigenen Ordner, nie in Philips echte Bibliothek
  if (process.env.MOIN_TEST_DATEN) return process.env.MOIN_TEST_DATEN
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
}

/** Freunde (Skin-IDs) → Skin-Dateien für Reaction, Gaming und Spiele-Vorlage */
async function freundeAus(dir: string, ids: string[] | undefined): Promise<{ skin: string; slim: boolean | null; name: string }[] | undefined> {
  if (!ids?.length) return undefined
  const skins = await ladeSkins(dir)
  return ids
    .map((id) => skins.find((s) => s.id === id && s.rolle === 'freund'))
    .filter((s): s is ThumbSkin => !!s)
    .map((s) => ({ skin: join(dir, 'skins', s.datei), slim: s.slim, name: s.name }))
}

async function ladeSkins(dir: string): Promise<ThumbSkin[]> {
  const res = await readJson(join(dir, 'skins', 'skins.json'), SkinListe)
  return res.ok ? res.value : []
}

async function speichereSkins(dir: string, skins: ThumbSkin[]): Promise<void> {
  await writeJsonAtomic(join(dir, 'skins', 'skins.json'), skins)
}

/** Nur Dateien innerhalb des Datenordners herausgeben (kein Lesen beliebiger Pfade über IPC). */
function imOrdner(dir: string, pfad: string): boolean {
  const r = resolve(pfad)
  return r.startsWith(resolve(dir) + sep)
}

/** Bild als data:-URL. iCloud sperrt frisch geschriebene Dateien kurz zum Hochladen – deshalb mehrere Versuche. */
async function alsDataUrl(pfad: string): Promise<string | null> {
  for (let versuch = 0; versuch < 6; versuch++) {
    try {
      return `data:image/png;base64,${(await readFile(pfad)).toString('base64')}`
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return null
}

export function registerThumbnailIpc(
  queue: JobQueue,
  settings: SettingsStore,
  hardware: HardwareController,
  tools: ToolManager,
  getWindow: () => BrowserWindow | undefined
): {
  starteThumbnail: (start: ThumbStart) => Promise<string>
  starteVideo: (video: string, kanal: string, titel?: string) => Promise<string>
  starteReaktion: (original: string, o: { gefuehl?: string; wort?: string; kanal?: string; spiel?: string; wunsch?: string; ohneExtras?: boolean; freunde?: string[] }) => Promise<string>
  starteSpielvorlage: (vorlage: string, wunsch?: string, freunde?: string[]) => Promise<string>
  starteAenderung: (jobId: unknown, index: unknown, wunsch: unknown) => Promise<string>
} {
  queue.register('thumbnail', thumbnailJob)
  queue.register('video-vorschlaege', videoVorschlaegeJob)
  queue.register('reaktion', reaktionJob)
  queue.register('spielvorlage', spielvorlageJob)
  queue.register('aenderung', aenderungJob)

  // Änderungswunsch zu einer fertigen Variante (Philip, 29.09.): neuer Auftrag mit geänderter Szene
  const starteAenderung = async (jobId: unknown, index: unknown, wunsch: unknown): Promise<string> => {
    const text = typeof wunsch === 'string' ? wunsch.trim() : ''
    if (!text) throw new Error('Bitte schreib, was geändert werden soll.')
    const job = queue.get(String(jobId))
    const res = queue.result<{ varianten: ThumbnailVariante[] }>(String(jobId))
    const v = res?.varianten[Number(index)]
    if (!job || !v?.bild || !v.szene) throw new Error('Diese Variante gibt es nicht mehr.')
    const art: AenderungsArt =
      job.kind === 'aenderung' ? (queue.payload<AenderungPayload>(job.id)?.art ?? 'thumbnail') : job.kind === 'reaktion' ? 'reaktion' : job.kind === 'spielvorlage' ? 'spielvorlage' : 'thumbnail'
    const dir = await datenOrdner(settings)
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen (Einstellungen).')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((x) => x.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const eltern = job.kind === 'aenderung' ? (queue.payload<AenderungPayload>(job.id)?.eltern ?? job.id) : job.id
    const payload: AenderungPayload = {
      art,
      wunsch: text,
      eltern,
      basis: { job: job.id, variante: Number(index) },
      bild: v.bild,
      szene: v.szene,
      claudeCli: cli,
      blender: { exe, mesa: config.blenderMesa },
      blenderDir: resourceDir('blender'),
      datenOrdner: dir,
      formatHilfe: art === 'thumbnail' ? await readFile(join(resourceDir('prompts'), 'thumbnail-planung.md'), 'utf8').catch(() => '') : undefined,
      python: art === 'spielvorlage' ? join(localRoot(), 'py', 'vorlage', 'Scripts', 'python.exe') : undefined,
      ausgabe: join(dir, 'thumbnails', `aenderung-${randomUUID()}`)
    }
    return queue.enqueue('aenderung', `Änderung: ${text.slice(0, 50)}`, payload)
  }
  ipcMain.handle(IPC.thumbAendern, (_e, jobId: unknown, index: unknown, wunsch: unknown) => starteAenderung(jobId, index, wunsch))

  // Auftrag löschen (Philip, 29.09.): Eintrag und seine Bilder im Datenordner – beim Ursprungsauftrag mit allen
  // Änderungen aus seinem Verlauf (Philip, 30.09.)
  ipcMain.handle(IPC.thumbLoeschen, async (_e, jobId: unknown): Promise<void> => {
    const dir = await datenOrdner(settings)
    const id = String(jobId)
    const ids = [...queue.state().jobs.filter((j) => j.kind === 'aenderung' && queue.payload<AenderungPayload>(j.id)?.eltern === id).map((j) => j.id), id]
    for (const x of ids) {
      const payload = (await queue.remove(x)) as { ausgabe?: string } | undefined
      if (payload?.ausgabe && imOrdner(dir, payload.ausgabe) && resolve(payload.ausgabe) !== resolve(dir)) await rm(payload.ausgabe, { recursive: true, force: true })
    }
  })

  // Spiele-Vorlage (Philip, 27.09.): fremdes Spiele-Thumbnail wählen → Philip steht an der Stelle der Person
  const starteSpielvorlage = async (vorlage: string, wunsch?: string, freundIds?: string[]): Promise<string> => {
    const dir = await datenOrdner(settings)
    const ich = (await ladeSkins(dir)).find((x) => x.rolle === 'ich')
    if (!ich) throw new Error('Bitte zuerst deinen eigenen Skin hochladen (Skins → „Mein Skin“).')
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen (Einstellungen).')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((x) => x.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const uv = await tools.exePath(UV)
    if (!uv) throw new Error('uv (Python-Verwaltung) ist nicht installiert (Einstellungen → Werkzeuge).')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const payload: SpielvorlagePayload = {
      vorlage,
      skin: join(dir, 'skins', ich.datei),
      slim: ich.slim,
      wunsch: wunsch?.trim() || undefined,
      freunde: await freundeAus(dir, freundIds),
      claudeCli: cli,
      blender: { exe, mesa: config.blenderMesa, geraet: config.final.engine === 'CYCLES' ? config.final.device : 'CPU', samples: Math.max(32, Math.min(96, config.final.samples)) },
      uv,
      pyDir: join(localRoot(), 'py', 'vorlage'),
      blenderDir: resourceDir('blender'),
      datenOrdner: dir,
      ausgabe: join(dir, 'thumbnails', `spielvorlage-${randomUUID()}`)
    }
    return queue.enqueue('spielvorlage', `Spiele-Vorlage: ${basename(vorlage)}`, payload)
  }
  ipcMain.handle(IPC.thumbSpielvorlage, async (_e, raw: unknown) => {
    const win = getWindow()
    const opts = { title: 'Spiele-Thumbnail mit Person wählen', filters: [{ name: 'Bild', extensions: ['jpg', 'jpeg', 'png', 'webp'] }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    const o = (typeof raw === 'string' ? { wunsch: raw } : (raw ?? {})) as { wunsch?: string; freunde?: string[] }
    return starteSpielvorlage(wahl.filePaths[0], o.wunsch, o.freunde)
  })

  // Reaction-Thumbnail (Stilbuch 14): Original wählen, Claude wertet aus, Blender baut mit Philips Skin
  const starteReaktion = async (original: string, o: { gefuehl?: string; wort?: string; kanal?: string; spiel?: string; wunsch?: string; ohneExtras?: boolean; freunde?: string[] }): Promise<string> => {
    const dir = await datenOrdner(settings)
    const ich = (await ladeSkins(dir)).find((x) => x.rolle === 'ich')
    if (!ich) throw new Error('Bitte zuerst deinen eigenen Skin hochladen (Skins → „Mein Skin“).')
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen (Einstellungen).')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((x) => x.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const payload: ReaktionPayload = {
      original,
      skin: join(dir, 'skins', ich.datei),
      slim: ich.slim,
      kanal: o.kanal ?? 'MoinMorni',
      gefuehl: o.gefuehl?.trim() || undefined,
      wort: o.wort?.trim() || undefined,
      spiel: o.spiel?.trim() || undefined,
      wunsch: o.wunsch?.trim() || undefined,
      ohneExtras: o.ohneExtras || undefined,
      freunde: await freundeAus(dir, o.freunde),
      claudeCli: cli,
      blender: { exe, mesa: config.blenderMesa, geraet: config.final.engine === 'CYCLES' ? config.final.device : 'CPU', samples: Math.max(24, Math.min(64, config.final.samples)) },
      blenderDir: resourceDir('blender'),
      datenOrdner: dir,
      ausgabe: join(dir, 'thumbnails', `reaktion-${randomUUID()}`)
    }
    return queue.enqueue('reaktion', `${payload.wunsch ? `Gaming${payload.spiel ? `: ${payload.spiel}` : ''} (eigene Pose)` : payload.spiel ? `Gaming: ${payload.spiel}` : 'Reaction'}: ${basename(original)}`, payload)
  }
  ipcMain.handle(IPC.thumbReaktion, async (_e, raw: unknown) => {
    const win = getWindow()
    const opts = { title: 'Original-Thumbnail oder Spielbild wählen', filters: [{ name: 'Bild', extensions: ['jpg', 'jpeg', 'png', 'webp'] }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    return starteReaktion(wahl.filePaths[0], (raw ?? {}) as { gefuehl?: string; wort?: string; kanal?: string; spiel?: string; wunsch?: string; ohneExtras?: boolean; freunde?: string[] })
  })

  // Video hochladen → Vorschläge (ROADMAP 5.5)
  const starteVideo = async (video: string, kanal: unknown, titel?: unknown): Promise<string> => {
    const dir = await datenOrdner(settings)
    const ffmpeg = await tools.exePath(FFMPEG)
    if (!ffmpeg) throw new Error('FFmpeg ist nicht installiert (Einstellungen → Werkzeuge).')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const skins = await ladeSkins(dir)
    const id = randomUUID()
    const payload: VideoPayload = {
      video,
      kanal: typeof kanal === 'string' && kanal ? kanal : 'MoinMornhart',
      titel: typeof titel === 'string' && titel.trim() ? titel.trim() : undefined,
      ffmpeg,
      claudeCli: cli,
      ausgabe: join(dir, 'thumbnails', `video-${id}`),
      datenOrdner: dir,
      freunde: skins.filter((x) => x.rolle === 'freund').map((x) => x.name)
    }
    return queue.enqueue('video-vorschlaege', `Video ansehen: ${basename(video)}`, payload)
  }
  ipcMain.handle(IPC.thumbVideo, async (_e, kanal: unknown, titel: unknown) => {
    const win = getWindow()
    const opts = { title: 'Video wählen', filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm'] }], properties: ['openFile' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled || !wahl.filePaths[0]) return null
    return starteVideo(wahl.filePaths[0], kanal, titel)
  })

  ipcMain.handle(IPC.thumbVideoErgebnis, async (_e, jobId: unknown): Promise<ThumbVideoErgebnis | null> => {
    const dir = await datenOrdner(settings)
    const res = queue.result<{ inhalt: string; vorschlaege: VideoVorschlag[]; boegen: string[] }>(String(jobId))
    if (!res) return null
    const skins = await ladeSkins(dir)
    return {
      inhalt: res.inhalt,
      vorschlaege: res.vorschlaege.map((v) => ({ ...v, freunde: v.freunde.map((n) => skins.find((x) => x.name === n)?.id).filter((x): x is string => !!x) })),
      boegen: (await Promise.all(res.boegen.filter((b) => imOrdner(dir, b)).map(async (b) => (await readFile(b).catch(() => null))?.toString('base64')))).filter((b): b is string => !!b).map((b) => `data:image/jpeg;base64,${b}`)
    }
  })

  ipcMain.handle(IPC.thumbSkins, async () => ladeSkins(await datenOrdner(settings)))

  ipcMain.handle(IPC.thumbSkinAdd, async (_e, rolle: unknown) => {
    const dir = await datenOrdner(settings)
    const win = getWindow()
    const opts = { title: 'Minecraft-Skin wählen (PNG)', filters: [{ name: 'Skin', extensions: ['png'] }], properties: ['openFile' as const, 'multiSelections' as const] }
    const wahl = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (wahl.canceled) return ladeSkins(dir)
    const skins = await ladeSkins(dir)
    await mkdir(join(dir, 'skins'), { recursive: true })
    for (const f of wahl.filePaths) {
      const id = randomUUID().slice(0, 8)
      const datei = `${id}${extname(f).toLowerCase() || '.png'}`
      await copyFile(f, join(dir, 'skins', datei))
      const r = rolle === 'ich' ? 'ich' : 'freund'
      if (r === 'ich') for (const s of skins) if (s.rolle === 'ich') s.rolle = 'freund' // nur ein Hauptskin
      skins.push({ id, name: basename(f, extname(f)), datei, rolle: r, slim: null })
    }
    await speichereSkins(dir, skins)
    return skins
  })

  // Skin per Minecraft-Name (Mojang, ohne Anmeldung); gleicher Name ersetzt den alten Skin
  ipcMain.handle(IPC.thumbSkinName, async (_e, name: unknown, rolle: unknown) => {
    const dir = await datenOrdner(settings)
    const s = await skinAusName(String(name ?? ''))
    const skins = await ladeSkins(dir)
    await mkdir(join(dir, 'skins'), { recursive: true })
    const alt = skins.find((x) => x.name.toLowerCase() === s.name.toLowerCase())
    const id = alt?.id ?? randomUUID().slice(0, 8)
    const datei = `${id}.png`
    await writeFile(join(dir, 'skins', datei), s.png)
    const r = rolle === 'ich' ? 'ich' : 'freund'
    if (r === 'ich') for (const x of skins) if (x.rolle === 'ich') x.rolle = 'freund' // nur ein Hauptskin
    if (alt) Object.assign(alt, { datei, rolle: r, slim: s.slim })
    else skins.push({ id, name: s.name, datei, rolle: r, slim: s.slim })
    await speichereSkins(dir, skins)
    return skins
  })

  ipcMain.handle(IPC.thumbSkinUpdate, async (_e, id: unknown, patch: unknown) => {
    const dir = await datenOrdner(settings)
    const skins = await ladeSkins(dir)
    const s = skins.find((x) => x.id === id)
    const p = (patch ?? {}) as Partial<ThumbSkin> & { entfernen?: boolean }
    if (s && p.entfernen) {
      await rm(join(dir, 'skins', s.datei), { force: true })
      skins.splice(skins.indexOf(s), 1)
    } else if (s) {
      if (typeof p.name === 'string' && p.name.trim()) s.name = p.name.trim().slice(0, 40)
      if (p.rolle === 'ich') {
        for (const x of skins) if (x.rolle === 'ich') x.rolle = 'freund'
        s.rolle = 'ich'
      }
    }
    await speichereSkins(dir, skins)
    return skins
  })

  ipcMain.handle(IPC.thumbSkinBild, async (_e, id: unknown) => {
    const dir = await datenOrdner(settings)
    const s = (await ladeSkins(dir)).find((x) => x.id === id)
    return s ? alsDataUrl(join(dir, 'skins', s.datei)) : null
  })

  const starteThumbnail = async (start: ThumbStart): Promise<string> => {
    const beschreibung = String(start?.beschreibung ?? '').trim()
    if (beschreibung.length < 3) throw new Error('Bitte beschreibe das Thumbnail in ein paar Worten.')
    const dir = await datenOrdner(settings)
    const skins = await ladeSkins(dir)
    const ich = skins.find((s) => s.rolle === 'ich')
    if (!ich) throw new Error('Bitte zuerst deinen eigenen Skin hochladen (Skins → „Mein Skin“).')
    const freunde = (start.freunde ?? []).map((id) => skins.find((s) => s.id === id)).filter((s): s is ThumbSkin => !!s)
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen (Einstellungen).')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((s) => s.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const id = randomUUID()
    const fig = (s: ThumbSkin, i: number): ThumbnailPayload['figuren'][number] => ({
      id: i === 0 ? 'ich' : s.name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || `freund${i}`,
      name: i === 0 ? `Philip (${start.kanal ?? 'MoinMornhart'})` : s.name,
      skin: join(dir, 'skins', s.datei),
      slim: s.slim
    })
    const payload: ThumbnailPayload = {
      beschreibung,
      kanal: start.kanal ?? 'MoinMornhart',
      figuren: [ich, ...freunde].map(fig),
      anzahl: Math.min(4, Math.max(1, start.anzahl ?? 3)),
      blender: {
        exe,
        mesa: config.blenderMesa,
        geraet: config.final.engine === 'CYCLES' ? config.final.device : 'CPU',
        samples: Math.max(24, Math.min(64, config.final.samples))
      },
      claudeCli: cli,
      datenOrdner: dir,
      blenderDir: resourceDir('blender'),
      minecraftDir: resourceDir('minecraft'),
      configDir: resourceDir('config'),
      promptDatei: join(resourceDir('prompts'), 'thumbnail-planung.md'),
      ausgabe: join(dir, 'thumbnails', id)
    }
    return queue.enqueue('thumbnail', `Thumbnail: ${beschreibung.slice(0, 50)}`, payload)
  }
  ipcMain.handle(IPC.thumbStart, (_e, raw: unknown) => starteThumbnail(raw as ThumbStart))

  ipcMain.handle(IPC.thumbAuftraege, (): ThumbAuftrag[] =>
    queue
      .state()
      .jobs.filter((j) => ['thumbnail', 'reaktion', 'spielvorlage', 'aenderung', 'video-vorschlaege'].includes(j.kind))
      .map((j) => {
        const p = j.kind === 'aenderung' ? queue.payload<AenderungPayload>(j.id) : undefined
        return {
          id: j.id,
          art: j.kind === 'video-vorschlaege' ? ('video' as const) : ('thumbnail' as const),
          titel: j.title,
          state: j.state,
          progress: j.progress,
          step: j.step,
          error: j.error ?? null,
          createdAt: j.createdAt,
          eltern: p?.eltern ?? null,
          wunsch: p?.wunsch ?? null,
          basis: p?.basis ?? null
        }
      })
      .reverse()
  )

  ipcMain.handle(IPC.thumbErgebnis, async (_e, jobId: unknown): Promise<ThumbErgebnis | null> => {
    const dir = await datenOrdner(settings)
    const res = queue.result<{ varianten: ThumbnailVariante[] }>(String(jobId))
    if (!res) return null
    const vorbilder = await ladeVorbilder(resourceDir('config'))
    return {
      varianten: await Promise.all(
        res.varianten.map(async (v) => {
          const vb = vorbilder.find((x) => x.id === v.vorbild)
          return {
            titel: v.titel,
            warum: v.warum,
            vorbild: vb ? { kanal: vb.kanal, titel: vb.titel, url: `https://www.youtube.com/watch?v=${vb.video}` } : null,
            bild: v.bild && imOrdner(dir, v.bild) ? await alsDataUrl(v.bild) : null,
            warnungen: v.warnungen,
            fehler: v.fehler ?? null
          }
        })
      )
    }
  })

  ipcMain.handle(IPC.thumbSpeichern, async (_e, jobId: unknown, index: unknown) => {
    const dir = await datenOrdner(settings)
    const res = queue.result<{ varianten: ThumbnailVariante[] }>(String(jobId))
    const v = res?.varianten[Number(index)]
    if (!v?.bild || !imOrdner(dir, v.bild)) return null
    const win = getWindow()
    const opts = { title: 'Thumbnail speichern', defaultPath: `${v.titel.replace(/[\\/:*?"<>|]/g, '')}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] }
    const ziel = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (ziel.canceled || !ziel.filePath) return null
    await copyFile(v.bild, ziel.filePath)
    shell.showItemInFolder(ziel.filePath)
    return ziel.filePath
  })
  return { starteThumbnail, starteVideo, starteReaktion, starteSpielvorlage, starteAenderung }
}
