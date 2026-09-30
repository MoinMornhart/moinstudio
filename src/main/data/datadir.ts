import { mkdir, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'
import { readJson, writeJsonAtomic } from './jsonfile'

/** Unterordner des Datenordners. Alles, was PC und Laptop teilen, liegt hier. */
export const DATA_LAYOUT = [
  'skins',
  'friends',
  'props',
  'references',
  'thumbnails',
  'projects',
  'planning/cards'
] as const

export const MARKER_FILE = 'moinstudio-data.json'
export const SUBFOLDER_NAME = 'MoinStudio'

const MarkerSchema = z.object({ format: z.literal(1), createdAt: z.string() })

export async function isDataDir(dir: string): Promise<boolean> {
  return (await readJson(join(dir, MARKER_FILE), MarkerSchema)).ok
}

async function isEmptyDir(dir: string): Promise<boolean> {
  try {
    return (await readdir(dir)).filter((n) => n !== 'desktop.ini' && n !== 'Thumbs.db').length === 0
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw err
  }
}

/**
 * Entscheidet, wo die Daten landen: Ein vorhandener MoinStudio-Datenordner oder ein leerer Ordner
 * wird direkt genutzt. In einem Ordner mit fremden Dateien (z. B. dem OneDrive-Hauptordner)
 * wird stattdessen ein Unterordner „MoinStudio“ verwendet, damit nichts durcheinandergerät.
 */
export async function resolveDataDir(chosen: string): Promise<string> {
  if ((await isDataDir(chosen)) || (await isEmptyDir(chosen))) return chosen
  return join(chosen, SUBFOLDER_NAME)
}

/** Legt Markierungsdatei und alle Unterordner an (idempotent). */
export async function ensureDataLayout(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  if (!(await isDataDir(dir))) {
    await writeJsonAtomic(join(dir, MARKER_FILE), { format: 1, createdAt: new Date().toISOString() })
  }
  for (const sub of DATA_LAYOUT) await mkdir(join(dir, sub), { recursive: true })
}

export interface SyncConflict {
  /** Originaldatei relativ zum Datenordner */
  original: string
  /** Konfliktkopie relativ zum Datenordner, z. B. `planning/cards/abc-LAPTOP.json` */
  copy: string
}

const SYNCED_EXT = /\.(json|yaml|yml)$/i
/** Ordner, die MoinStudio nur herunterlädt oder zwischenspeichert – dort gibt es keine echten Konfliktkopien */
const NICHT_SYNCHRON = new Set(['mc', 'node_modules', '.cache'])

/**
 * Welche Datei ist das Original einer Konfliktkopie? OneDrive hängt „-GERÄTENAME“ (evtl. mit
 * Zähler „-2“) an; der Gerätename kann selbst Bindestriche enthalten („DESKTOP-AB12“).
 * Deshalb wird jede Bindestrich-Position als Trennstelle probiert.
 */
export function conflictOriginal(name: string, siblings: ReadonlySet<string>): string | null {
  const ext = SYNCED_EXT.exec(name)?.[0]
  if (!ext) return null
  const stem = name.slice(0, -ext.length)
  for (let i = stem.indexOf('-'); i > 0; i = stem.indexOf('-', i + 1)) {
    const candidate = `${stem.slice(0, i)}${ext}`
    if (siblings.has(candidate)) return candidate
  }
  return null
}

/**
 * Findet Konfliktkopien, die OneDrive anlegt, wenn dieselbe Datei auf zwei Geräten geändert
 * wurde („karte-LAPTOP.json“ neben „karte.json“). Geprüft werden nur JSON/YAML-Dateien.
 */
export async function findSyncConflicts(dir: string, maxDepth = 4): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = []
  async function walk(current: string, depth: number): Promise<void> {
    let names: string[]
    try {
      names = await readdir(current)
    } catch {
      return
    }
    const files = new Set<string>()
    for (const name of names) {
      const full = join(current, name)
      const info = await stat(full).catch(() => null)
      if (!info) continue
      if (info.isDirectory()) {
        // Downloads und Caches (Minecraft-Daten, Mob-Import) werden nie auf zwei Geräten bearbeitet
        if (depth < maxDepth && !NICHT_SYNCHRON.has(name)) await walk(full, depth + 1)
      } else {
        files.add(name)
      }
    }
    for (const name of files) {
      const original = conflictOriginal(name, files)
      if (original) {
        conflicts.push({ original: relative(dir, join(current, original)), copy: relative(dir, join(current, name)) })
      }
    }
  }
  await walk(dir, 0)
  return conflicts.sort((a, b) => a.copy.localeCompare(b.copy))
}
