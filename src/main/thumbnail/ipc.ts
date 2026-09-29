import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'
import { IPC, type ThumbAuftrag, type ThumbErgebnis, type ThumbSerie, type ThumbSkin, type ThumbStart, type ThumbVideoErgebnis } from '@shared/app'
import { findClaudeCli } from '../claude/cli'
import { readJson, writeJsonAtomic } from '../data/jsonfile'
import type { SettingsStore } from '../data/settings'
import { ProfileStore } from '../hardware/profile'
import type { HardwareController } from '../hardware/controller'
import type { JobQueue } from '../jobs/queue'
import { resourceDir } from '../resources'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY, FFMPEG } from '../tools/specs'
import { z } from 'zod'
import { thumbnailJob, type ThumbnailPayload, type ThumbnailVariante } from './job'
import { ladeVorbilder } from './planung'
import { videoVorschlaegeJob, type VideoPayload, type VideoVorschlag } from './video'

/**
 * Thumbnail-Reiter (ROADMAP 5.4): Skin-Bibliothek im Datenordner (Philip lädt seine Skins und die seiner Freunde selbst
 * hoch), Aufträge starten, Ergebnisse mit Vorbild ansehen und speichern.
 */

const SkinListe = z.array(z.object({ id: z.string(), name: z.string(), datei: z.string(), rolle: z.enum(['ich', 'freund']), slim: z.boolean().nullable().default(null) }))

async function datenOrdner(settings: SettingsStore): Promise<string> {
  const dir = (await settings.load()).dataDir
  if (!dir) throw new Error('Bitte zuerst in den Einstellungen einen Datenordner wählen.')
  return dir
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

async function alsDataUrl(pfad: string): Promise<string | null> {
  try {
    return `data:image/png;base64,${(await readFile(pfad)).toString('base64')}`
  } catch {
    return null
  }
}

export function registerThumbnailIpc(
  queue: JobQueue,
  settings: SettingsStore,
  hardware: HardwareController,
  tools: ToolManager,
  getWindow: () => BrowserWindow | undefined
): { starteThumbnail: (start: ThumbStart) => Promise<string>; starteVideo: (video: string, kanal: string, titel?: string) => Promise<string> } {
  queue.register('thumbnail', thumbnailJob)
  const vorlagen = async (): Promise<ThumbSerie[]> =>
    ((JSON.parse(await readFile(join(resourceDir('config'), 'vorlagen.json'), 'utf8')) as { serien?: ThumbSerie[] }).serien ?? [])
  ipcMain.handle(IPC.thumbVorlagen, () => vorlagen())
  queue.register('video-vorschlaege', videoVorschlaegeJob)

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
      merkmal: await (async () => {
        if (!start.serie) return undefined
        const serie = (await vorlagen()).find((x) => x.id === start.serie!.id)
        const texte = [{ text: `#${start.serie.nr}`, farbe: serie?.merkmal.farbe ?? 'gelb', platz: serie?.merkmal.platz ?? 'unten_rechts' }]
        if (start.serie.wort) texte.push({ text: start.serie.wort, farbe: 'weiss', platz: 'auto' })
        return texte
      })(),
      ausgabe: join(dir, 'thumbnails', id)
    }
    return queue.enqueue('thumbnail', `Thumbnail: ${beschreibung.slice(0, 50)}`, payload)
  }
  ipcMain.handle(IPC.thumbStart, (_e, raw: unknown) => starteThumbnail(raw as ThumbStart))

  ipcMain.handle(IPC.thumbAuftraege, (): ThumbAuftrag[] =>
    queue
      .state()
      .jobs.filter((j) => j.kind === 'thumbnail' || j.kind === 'video-vorschlaege')
      .map((j) => ({ id: j.id, art: j.kind === 'thumbnail' ? ('thumbnail' as const) : ('video' as const), titel: j.title, state: j.state, progress: j.progress, step: j.step, error: j.error ?? null, createdAt: j.createdAt }))
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
  return { starteThumbnail, starteVideo }
}
