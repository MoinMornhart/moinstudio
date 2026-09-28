import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Schreibt JSON atomar: erst in eine temporäre Datei daneben, dann per Umbenennen ersetzen.
 * So findet OneDrive (oder ein Absturz) nie eine halb geschriebene Datei vor. Kurzzeitige
 * Sperren durch OneDrive/Virenscanner (EPERM/EBUSY) werden mit kurzen Wartezeiten wiederholt.
 */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, path)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      if (!RETRY_CODES.has(code) || attempt >= 8) {
        await rm(tmp, { force: true })
        throw err
      }
      await wait(50 * 2 ** Math.min(attempt, 4))
    }
  }
}

export type ReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'invalid-json' | 'invalid-schema'; detail?: string }

/** Liest und prüft eine JSON-Datei gegen ein Zod-Schema, ohne bei Fehlern zu werfen. */
export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<ReadResult<T>> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: false, reason: 'missing' }
    throw err
  }
  let raw: unknown
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch (err) {
    return { ok: false, reason: 'invalid-json', detail: (err as Error).message }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, reason: 'invalid-schema', detail: parsed.error.message }
  return { ok: true, value: parsed.data }
}
