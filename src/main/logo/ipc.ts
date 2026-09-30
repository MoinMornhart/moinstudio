import { dialog, ipcMain, nativeImage, shell, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { IPC, type LogoEintrag, type LogoErgebnis, type LogoExportGroesse, type LogoQuelle, type LogoStart, type ThumbAuftrag } from '@shared/app'
import { findClaudeCli } from '../claude/cli'
import type { SettingsStore } from '../data/settings'
import type { HardwareController } from '../hardware/controller'
import { ProfileStore } from '../hardware/profile'
import type { JobQueue } from '../jobs/queue'
import { resourceDir } from '../resources'
import type { ToolManager } from '../tools/manager'
import { BLENDER_FALLBACK, BLENDER_PRIMARY } from '../tools/specs'
import { alsDataUrl, datenOrdner, imOrdner, ladeSkins } from '../thumbnail/ipc'
import { aendereLogo, ladeLogos, logoPfad, neuesLogo } from './bibliothek'
import { aufQuadrat, exportGroesse, freistellen, hatTransparenz, zuschneiden, type Pixel } from './bild'
import { logoAenderungJob, logoJob, type LogoAenderungPayload, type LogoPayload, type LogoVariante } from './job'

/**
 * Reiter „Logo“ (Philip, 30.09.): Logos erstellen und ändern (Aufträge mit Verlauf wie beim Thumbnail), hochladen,
 * Bibliothek im Datenordner (umbenennen, löschen, Standard je Kanal) und Export als PNG in mehreren Größen.
 */

const EXPORT_NAMEN: Record<string, string> = { '512': '512', '1024': '1024', '2048': '2048', wasserzeichen: 'wasserzeichen-150' }

function pixelAus(bild: Electron.NativeImage): Pixel {
  const g = bild.getSize()
  return { px: Uint8Array.from(bild.toBitmap()), breite: g.width, hoehe: g.height }
}
const alsBild = (p: Pixel): Electron.NativeImage => nativeImage.createFromBitmap(Buffer.from(p.px), { width: p.breite, height: p.hoehe })

export function registerLogoIpc(
  queue: JobQueue,
  settings: SettingsStore,
  hardware: HardwareController,
  tools: ToolManager,
  getWindow: () => BrowserWindow | undefined
): { starteLogo: (start: LogoStart) => Promise<string>; starteLogoAenderung: (jobId: unknown, index: unknown, wunsch: unknown) => Promise<string> } {
  queue.register('logo', logoJob)
  queue.register('logo-aenderung', logoAenderungJob)

  /** Blender, Claude und Köpfe (Philip zuerst, dann Freunde) für einen Auftrag */
  const grundlage = async (): Promise<Omit<LogoPayload, 'beschreibung' | 'kanal' | 'anzahl' | 'ausgabe'>> => {
    const dir = await datenOrdner(settings)
    const profile = await hardware.profiles.load()
    if (!profile) throw new Error('Bitte zuerst den Hardware-Test ausführen (Einstellungen).')
    const config = ProfileStore.effective(profile)
    const spec = [BLENDER_PRIMARY, BLENDER_FALLBACK].find((x) => x.version === config.blenderVersion)
    const exe = spec ? await tools.exePath(spec) : null
    if (!exe) throw new Error('Blender ist auf diesem Gerät nicht lauffähig oder nicht installiert.')
    const cli = await findClaudeCli()
    if (!cli) throw new Error('Claude Code ist nicht eingerichtet (Einstellungen → Claude).')
    const skins = (await ladeSkins(dir)).sort((a, b) => (a.rolle === 'ich' ? -1 : b.rolle === 'ich' ? 1 : 0))
    return {
      claudeCli: cli,
      blender: { exe, mesa: config.blenderMesa, geraet: config.final.engine === 'CYCLES' ? config.final.device : 'CPU', samples: Math.max(16, Math.min(48, config.final.samples)) },
      blenderDir: resourceDir('blender'),
      datenOrdner: dir,
      koepfe: skins.map((s) => ({ name: s.name, datei: join(dir, 'skins', s.datei) }))
    }
  }

  const starteLogo = async (start: LogoStart): Promise<string> => {
    const beschreibung = String(start?.beschreibung ?? '').trim()
    if (beschreibung.length < 2) throw new Error('Bitte beschreibe das Logo in ein paar Worten.')
    const g = await grundlage()
    const payload: LogoPayload = { ...g, beschreibung, kanal: start.kanal ?? 'MoinMornhart', anzahl: Math.min(4, Math.max(1, start.anzahl ?? 3)), ausgabe: join(g.datenOrdner, 'logos', 'auftraege', randomUUID()) }
    return queue.enqueue('logo', `Logo: ${beschreibung.slice(0, 50)}`, payload)
  }
  ipcMain.handle(IPC.logoStart, (_e, raw: unknown) => starteLogo(raw as LogoStart))

  const starteLogoAenderung = async (jobId: unknown, index: unknown, wunsch: unknown): Promise<string> => {
    const text = typeof wunsch === 'string' ? wunsch.trim() : ''
    if (!text) throw new Error('Bitte schreib, was geändert werden soll.')
    const job = queue.get(String(jobId))
    const v = queue.result<{ varianten: LogoVariante[] }>(String(jobId))?.varianten[Number(index)]
    if (!job || !v?.bild) throw new Error('Diese Variante gibt es nicht mehr.')
    const g = await grundlage()
    const eltern = job.kind === 'logo-aenderung' ? (queue.payload<LogoAenderungPayload>(job.id)?.eltern ?? job.id) : job.id
    const payload: LogoAenderungPayload = { ...g, wunsch: text, eltern, basis: { job: job.id, variante: Number(index) }, bild: v.bild, szene: v.szene, ausgabe: join(g.datenOrdner, 'logos', 'auftraege', `aenderung-${randomUUID()}`) }
    return queue.enqueue('logo-aenderung', `Logo-Änderung: ${text.slice(0, 50)}`, payload)
  }
  ipcMain.handle(IPC.logoAendern, (_e, jobId: unknown, index: unknown, wunsch: unknown) => starteLogoAenderung(jobId, index, wunsch))

  ipcMain.handle(IPC.logoAuftraege, (): ThumbAuftrag[] =>
    queue
      .state()
      .jobs.filter((j) => j.kind === 'logo' || j.kind === 'logo-aenderung')
      .map((j) => {
        const p = j.kind === 'logo-aenderung' ? queue.payload<LogoAenderungPayload>(j.id) : undefined
        return { id: j.id, art: 'thumbnail' as const, titel: j.title, state: j.state, progress: j.progress, step: j.step, error: j.error ?? null, createdAt: j.createdAt, eltern: p?.eltern ?? null, wunsch: p?.wunsch ?? null, basis: p?.basis ?? null }
      })
      .reverse()
  )

  ipcMain.handle(IPC.logoErgebnis, async (_e, jobId: unknown): Promise<LogoErgebnis | null> => {
    const dir = await datenOrdner(settings)
    const res = queue.result<{ varianten: LogoVariante[] }>(String(jobId))
    if (!res) return null
    return {
      varianten: await Promise.all(
        res.varianten.map(async (v) => ({ titel: v.titel, bild: v.bild && imOrdner(dir, v.bild) ? await alsDataUrl(v.bild) : null, warnungen: v.warnungen, fehler: v.fehler ?? null }))
      )
    }
  })

  // Löschen wie beim Thumbnail: Ursprungsauftrag mit allen Änderungen aus seinem Verlauf
  ipcMain.handle(IPC.logoLoeschen, async (_e, jobId: unknown): Promise<void> => {
    const dir = await datenOrdner(settings)
    const id = String(jobId)
    const ids = [...queue.state().jobs.filter((j) => j.kind === 'logo-aenderung' && queue.payload<LogoAenderungPayload>(j.id)?.eltern === id).map((j) => j.id), id]
    for (const x of ids) {
      const payload = (await queue.remove(x)) as { ausgabe?: string } | undefined
      if (payload?.ausgabe && imOrdner(dir, payload.ausgabe) && resolve(payload.ausgabe) !== resolve(dir)) await rm(payload.ausgabe, { recursive: true, force: true })
    }
  })

  // Bibliothek
  ipcMain.handle(IPC.logoListe, async (): Promise<LogoEintrag[]> => ladeLogos(await datenOrdner(settings)))
  ipcMain.handle(IPC.logoBild, async (_e, id: unknown) => {
    const dir = await datenOrdner(settings)
    const l = (await ladeLogos(dir)).find((x) => x.id === id)
    return l ? alsDataUrl(logoPfad(dir, l)) : null
  })
  ipcMain.handle(IPC.logoEintrag, async (_e, id: unknown, patch: unknown) => aendereLogo(await datenOrdner(settings), String(id), (patch ?? {}) as Parameters<typeof aendereLogo>[2]))

  // Hochladen: die Oberfläche schickt ein PNG (SVG und JPG hat sie schon umgewandelt); ohne Transparenz wird freigestellt
  ipcMain.handle(IPC.logoHochladen, async (_e, name: unknown, png: unknown) => {
    const dir = await datenOrdner(settings)
    const daten = typeof png === 'string' ? png.replace(/^data:image\/\w+;base64,/, '') : ''
    const bild = nativeImage.createFromBuffer(Buffer.from(daten, 'base64'))
    if (bild.isEmpty()) throw new Error('Das Bild ließ sich nicht lesen.')
    let p = pixelAus(bild)
    if (!hatTransparenz(p.px)) p = freistellen(p)
    p = zuschneiden(p, 2)
    return neuesLogo(dir, alsBild(p).toPNG(), { name: String(name ?? 'Logo'), quelle: 'hochgeladen', breite: p.breite, hoehe: p.hoehe })
  })

  const variantenBild = (quelle: { job: string; variante: number }): string | null => queue.result<{ varianten: LogoVariante[] }>(quelle.job)?.varianten[quelle.variante]?.bild ?? null

  ipcMain.handle(IPC.logoMerken, async (_e, jobId: unknown, index: unknown, name: unknown) => {
    const dir = await datenOrdner(settings)
    const pfad = variantenBild({ job: String(jobId), variante: Number(index) })
    if (!pfad || !imOrdner(dir, pfad)) throw new Error('Dieses Logo gibt es nicht mehr.')
    const bild = nativeImage.createFromPath(pfad)
    const g = bild.getSize()
    return neuesLogo(dir, await readFile(pfad), { name: String(name ?? 'Logo'), quelle: 'erstellt', breite: g.width, hoehe: g.height })
  })

  // Export: längste Seite 512/1024/2048 oder YouTube-Wasserzeichen (150×150, quadratisch, durchsichtig)
  ipcMain.handle(IPC.logoExport, async (_e, quelle: LogoQuelle, groesse: LogoExportGroesse) => {
    const dir = await datenOrdner(settings)
    let pfad: string | null = null
    let name = 'logo'
    if ('logo' in quelle) {
      const l = (await ladeLogos(dir)).find((x) => x.id === quelle.logo)
      if (l) {
        pfad = logoPfad(dir, l)
        name = l.name
      }
    } else pfad = variantenBild(quelle)
    if (!pfad || !imOrdner(dir, pfad)) return null
    let bild = nativeImage.createFromPath(pfad)
    if (bild.isEmpty()) return null
    if (groesse === 'wasserzeichen') bild = alsBild(aufQuadrat(pixelAus(bild))).resize({ width: 150, height: 150, quality: 'best' })
    else {
      const g = bild.getSize()
      bild = bild.resize({ ...exportGroesse(g.width, g.height, Number(groesse)), quality: 'best' })
    }
    const win = getWindow()
    const opts = { title: 'Logo speichern', defaultPath: `${name.replace(/[\\/:*?"<>|]/g, '')}-${EXPORT_NAMEN[String(groesse)] ?? groesse}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] }
    // Prüfabläufe (MOIN_TEST_ZIEL) speichern ohne Dialog
    const test = process.env['MOIN_TEST_ZIEL']
    const ziel = test ? { canceled: false, filePath: test } : win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (ziel.canceled || !ziel.filePath) return null
    await writeFile(ziel.filePath, bild.toPNG())
    if (!test) shell.showItemInFolder(ziel.filePath)
    return ziel.filePath
  })

  return { starteLogo, starteLogoAenderung }
}
