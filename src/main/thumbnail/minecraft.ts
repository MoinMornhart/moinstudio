import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Echte Minecraft-Texturen, Schrift und Modelle für die Thumbnails: aus der offiziellen, kostenlos von Mojang
 * bereitgestellten Client-Datei (wie der Launcher sie lädt), geprüft per SHA1. Entpackt werden nur Texturen und
 * Schrift in den Datenordner des Nutzers – nie ins Repo. Philip braucht dafür kein eigenes Minecraft-Konto.
 */

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export interface McAssets {
  version: string
  /** …/assets/minecraft (enthält textures/ und font/) */
  assets: string
  textures: string
}

interface Manifest {
  latest: { release: string; snapshot: string }
  versions: { id: string; url: string; sha1: string }[]
}

async function sha1(pfad: string): Promise<string> {
  const h = createHash('sha1')
  for await (const teil of createReadStream(pfad)) h.update(teil as Buffer)
  return h.digest('hex')
}

async function json<T>(url: string, fetcher: typeof fetch): Promise<T> {
  const res = await fetcher(url)
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`)
  return (await res.json()) as T
}

/** Entpackt Teile eines ZIP/JAR mit dem in Windows 10/11 enthaltenen tar (bsdtar kann ZIP). */
export function entpacke(archiv: string, ziel: string, pfade: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tar = process.platform === 'win32' ? join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    const child = spawn(tar, ['-xf', archiv, '-C', ziel, ...pfade], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Entpacken fehlgeschlagen (${code}): ${err.trim()}`))))
  })
}

/**
 * Wo die Spieldateien liegen: lokal in %LOCALAPPDATA%\MoinStudio\mc wie Blender und Python – nicht im Datenordner.
 * Im iCloud-Datenordner blockierten die ~14.000 kleinen Dateien die Synchronisierung (Philip, 02.10.: „warum sind die
 * Sachen noch nicht auf iCloud“); sie lassen sich jederzeit neu von Mojang laden. `MOIN_MC_DIR` überschreibt das.
 */
export function mcOrdner(datenOrdner: string): string {
  if (process.env['MOIN_MC_DIR']) return process.env['MOIN_MC_DIR']
  return process.env['LOCALAPPDATA'] ? join(process.env['LOCALAPPDATA'], 'MoinStudio', 'mc') : join(datenOrdner, 'mc')
}

export function mcPfade(datenOrdner: string, version: string): McAssets {
  const assets = join(mcOrdner(datenOrdner), version, 'extracted', 'assets', 'minecraft')
  return { version, assets, textures: join(assets, 'textures') }
}

/**
 * Liefert die Texturen der neuesten Version (auch Snapshots); lädt und entpackt sie beim ersten Mal (ca. 30 MB).
 * `vorhanden` = bereits entpackte Version, die ohne Internet weiter genutzt wird.
 */
export async function sichereMcAssets(datenOrdner: string, o: { fetcher?: typeof fetch; onProgress?: (text: string) => void } = {}): Promise<McAssets> {
  const fetcher = o.fetcher ?? fetch
  const merker = join(mcOrdner(datenOrdner), 'aktuell.json')
  await mkdir(mcOrdner(datenOrdner), { recursive: true })
  let version: string | null = null
  try {
    const manifest = await json<Manifest>(MANIFEST, fetcher)
    // Philip: immer das Neueste, auch Snapshots (neue Blöcke und Mobs vor dem offiziellen Release)
    version = manifest.latest.snapshot || manifest.latest.release
    const pfade = mcPfade(datenOrdner, version)
    if (existsSync(join(pfade.textures, 'block', 'stone.png')) && existsSync(join(pfade.assets, 'models', 'block', 'stone.json'))) {
      await writeFile(merker, JSON.stringify({ version }))
      return pfade
    }
    // schon im alten Ort (Datenordner) entpackt: einmal herüberkopieren statt neu laden
    const altOrdner = join(datenOrdner, 'mc', version)
    if (altOrdner !== join(mcOrdner(datenOrdner), version) && existsSync(join(altOrdner, 'extracted', 'assets', 'minecraft', 'models', 'block', 'stone.json'))) {
      o.onProgress?.('Übernehme die Minecraft-Texturen aus dem Datenordner …')
      await cp(join(altOrdner, 'extracted'), join(mcOrdner(datenOrdner), version, 'extracted'), { recursive: true })
      await writeFile(merker, JSON.stringify({ version }))
      return pfade
    }
    const eintrag = manifest.versions.find((v) => v.id === version)
    if (!eintrag) throw new Error(`Version ${version} fehlt im Manifest`)
    const info = await json<{ downloads: { client: { url: string; sha1: string } } }>(eintrag.url, fetcher)
    const ordner = join(mcOrdner(datenOrdner), version)
    await mkdir(join(ordner, 'extracted'), { recursive: true })
    const jar = join(ordner, 'client.jar')
    if (!existsSync(jar) || (await sha1(jar)) !== info.downloads.client.sha1) {
      o.onProgress?.(`Lade Minecraft ${version} (Texturen) von Mojang …`)
      const res = await fetcher(info.downloads.client.url)
      if (!res.ok) throw new Error(`Download der Spieldatei fehlgeschlagen (${res.status})`)
      await writeFile(`${jar}.teil`, Buffer.from(await res.arrayBuffer()))
      if ((await sha1(`${jar}.teil`)) !== info.downloads.client.sha1) {
        await rm(`${jar}.teil`, { force: true })
        throw new Error('Spieldatei beschädigt (SHA1 stimmt nicht)')
      }
      await rename(`${jar}.teil`, jar)
    }
    o.onProgress?.('Entpacke Texturen und Schrift …')
    await entpacke(jar, join(ordner, 'extracted'), ['assets/minecraft/textures', 'assets/minecraft/font', 'assets/minecraft/models', 'assets/minecraft/blockstates'])
    await writeFile(merker, JSON.stringify({ version }))
    return pfade
  } catch (err) {
    // offline oder Mojang nicht erreichbar: zuletzt genutzte Version weiterverwenden
    const alt = JSON.parse(await readFile(merker, 'utf8').catch(() => '{}')) as { version?: string }
    if (alt.version && existsSync(join(mcPfade(datenOrdner, alt.version).textures, 'block', 'stone.png'))) return mcPfade(datenOrdner, alt.version)
    throw err instanceof Error ? err : new Error(String(err))
  }
}
