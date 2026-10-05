import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { konfliktMuster, liesMitKonfliktkopien } from '../../src/main/data/jsonfile'

let dir: string
let lokal: string
const altLokal = process.env['LOCALAPPDATA']
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moin-konflikt-'))
  lokal = await mkdtemp(join(tmpdir(), 'moin-lokal-'))
  process.env['LOCALAPPDATA'] = lokal
})
afterEach(async () => {
  process.env['LOCALAPPDATA'] = altLokal
  await rm(dir, { recursive: true, force: true })
  await rm(lokal, { recursive: true, force: true })
})

describe('iCloud-Konfliktkopien (Laptop 05.10.)', () => {
  it('erkennt alle Formen: „ 2“, „(1)“, „ (1)“ und „-GERÄT“', () => {
    const m = konfliktMuster('projekt.json')
    for (const n of ['projekt 2.json', 'projekt(1).json', 'projekt (1).json', 'projekt-LAPTOP.json']) expect(m.test(n)).toBe(true)
    for (const n of ['projekt.json', 'projekte.json', 'projekt 2.jsonx', 'schnitt.json']) expect(m.test(n)).toBe(false)
  })

  it('Original fehlt: neueste Kopie wird projekt.json, Felder der älteren ergänzt, Kopien gesichert statt gelöscht', async () => {
    const aelter = join(dir, 'projekt(1).json')
    const neuer = join(dir, 'projekt 2.json')
    await writeFile(aelter, JSON.stringify({ id: 'c9', typ: 'gaming', nurAlt: 1 }))
    await writeFile(neuer, JSON.stringify({ id: 'c9', typ: 'gaming', rohschnitt: true, vorschau: 5 }))
    await utimes(aelter, new Date(1000), new Date(1000))
    await utimes(neuer, new Date(2000), new Date(2000))
    const text = await liesMitKonfliktkopien(join(dir, 'projekt.json'))
    expect(JSON.parse(text)).toEqual({ id: 'c9', typ: 'gaming', rohschnitt: true, vorschau: 5, nurAlt: 1 })
    expect(JSON.parse(await readFile(join(dir, 'projekt.json'), 'utf8')).rohschnitt).toBe(true)
    expect(existsSync(aelter) || existsSync(neuer)).toBe(false)
    const sicherung = join(lokal, 'MoinStudio', 'konflikt-sicherung')
    const laeufe = await readdir(sicherung)
    expect((await readdir(join(sicherung, laeufe[0]!))).sort()).toHaveLength(2)
  })

  it('kaputte Kopie verliert gegen gültiges Original', async () => {
    await writeFile(join(dir, 'effekt.json'), JSON.stringify({ id: 'e1', name: 'Abo' }))
    await writeFile(join(dir, 'effekt 2.json'), '{ kaputt')
    expect(JSON.parse(await liesMitKonfliktkopien(join(dir, 'effekt.json')))).toEqual({ id: 'e1', name: 'Abo' })
  })
})

describe('Schnitt-Projekt: Stand aus den Dateien (05.10.)', () => {
  it('erkennt Fertiges vom anderen Gerät und setzt Fehlendes zurück', async () => {
    const { mitDateistand } = await import('../../src/main/schnitt/projekt')
    await writeFile(join(dir, 'schnitt.json'), '{}')
    await writeFile(join(dir, 'transkript.jsonl'), '{"start":0}\n')
    await writeFile(join(dir, 'export.mp4'), 'x')
    await writeFile(join(dir, 'export.json'), '{}')
    await writeFile(join(dir, 'vorschau.mp4'), 'x') // wird gerade geschrieben (jünger als 1 min)
    const alt = { id: 'c9', name: 'n', kanal: 'MoinMornhart', erstellt: '', quelle: null, proxy: false, wellenform: false, leiste: false, vorschau: undefined, export: undefined }
    const p = mitDateistand(alt, dir)
    expect(p.rohschnitt).toBe(true)
    expect(p.transkript).toBe(true)
    expect(p.export).toBeGreaterThan(0)
    expect(p.vorschau).toBeUndefined()
    expect(mitDateistand(alt, dir, Date.now() + 120_000).vorschau).toBeGreaterThan(0)
    // als fertig markiert, Datei weg → nicht mehr fertig
    await rm(join(dir, 'export.mp4'))
    expect(mitDateistand({ ...alt, export: 123 }, dir).export).toBeUndefined()
  })
})
