import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sichereMcAssets } from '../../src/main/thumbnail/minecraft'

let dir: string
const VERSION = '26.4-test'
/** Mojang-Manifest mit einer Version; alles Weitere (Spieldatei) schlägt fehl – es soll ja nie geladen werden */
const fetcher = (async (url: string) => {
  if (url.includes('version_manifest')) {
    return new Response(JSON.stringify({ latest: { release: VERSION, snapshot: VERSION }, versions: [{ id: VERSION, url: 'https://x/v.json', sha1: '' }] }))
  }
  return new Response('nein', { status: 503 })
}) as typeof fetch

async function entpackt(basis: string): Promise<void> {
  const a = join(basis, VERSION, 'extracted', 'assets', 'minecraft')
  await mkdir(join(a, 'textures', 'block'), { recursive: true })
  await mkdir(join(a, 'models', 'block'), { recursive: true })
  await writeFile(join(a, 'textures', 'block', 'stone.png'), 'png')
  await writeFile(join(a, 'models', 'block', 'stone.json'), '{}')
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moin-mc-'))
  process.env['MOIN_MC_DIR'] = join(dir, 'lokal')
})
afterEach(async () => {
  delete process.env['MOIN_MC_DIR']
  await rm(dir, { recursive: true, force: true })
})

describe('sichereMcAssets: Übernahme aus dem alten Datenordner', () => {
  it('kopiert einmal aus dem Datenordner statt neu zu laden', async () => {
    const daten = join(dir, 'daten')
    await entpackt(join(daten, 'mc'))
    const mc = await sichereMcAssets(daten, { fetcher })
    expect(mc.version).toBe(VERSION)
    expect(existsSync(join(mc.textures, 'block', 'stone.png'))).toBe(true)
    expect(existsSync(join(dir, 'lokal', VERSION, 'kopie-laeuft'))).toBe(false)
  })

  it('verwirft eine abgebrochene Kopie, statt sie als vollständig zu nehmen (Laptop 02.10.)', async () => {
    const daten = join(dir, 'daten')
    await entpackt(join(dir, 'lokal'))
    await writeFile(join(dir, 'lokal', VERSION, 'kopie-laeuft'), '')
    // kein alter Datenordner, Mojang nicht erreichbar: lieber ein Fehler als eine halbe Texturensammlung
    await expect(sichereMcAssets(daten, { fetcher })).rejects.toThrow()
    expect(existsSync(join(dir, 'lokal', VERSION, 'extracted'))).toBe(false)
  })
})
