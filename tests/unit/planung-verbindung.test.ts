import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kartenOrdner, ladeKarten, neueKarte } from '../../src/main/planung/karten'
import { naechsteSpalte, passendeKarte, titelAusName, videoInPlanung } from '../../src/main/planung/verbindung'
import { speichereProjekt, type Projekt } from '../../src/main/schnitt/projekt'

const t = (gewaehlt: boolean) => ({ auftrag: 'a', bild: 'thumbnails/x/1.png', gewaehlt })

describe('Planung: Verbindung zu Schnitt und Thumbnail (ROADMAP 7.5)', () => {
  it('schiebt Karten nach Import, Export und Thumbnail-Wahl weiter', () => {
    expect(naechsteSpalte({ spalte: 'idee', thumbnail: null }, 'import')).toBe('schnitt')
    expect(naechsteSpalte({ spalte: 'aufnahme', thumbnail: null }, 'export')).toBe('thumbnail')
    expect(naechsteSpalte({ spalte: 'schnitt', thumbnail: t(true) }, 'export')).toBe('upload')
    expect(naechsteSpalte({ spalte: 'schnitt', thumbnail: t(false) }, 'export')).toBe('thumbnail')
    expect(naechsteSpalte({ spalte: 'thumbnail', thumbnail: t(true) }, 'thumbnail-gewaehlt', true)).toBe('upload')
    expect(naechsteSpalte({ spalte: 'idee', thumbnail: t(true) }, 'thumbnail-gewaehlt', false)).toBe('thumbnail')
  })

  it('schiebt nie zurück und nie über „Upload“ hinaus', () => {
    expect(naechsteSpalte({ spalte: 'upload', thumbnail: null }, 'import')).toBe('upload')
    expect(naechsteSpalte({ spalte: 'veroeffentlicht', thumbnail: t(true) }, 'export')).toBe('veroeffentlicht')
    expect(naechsteSpalte({ spalte: 'thumbnail', thumbnail: null }, 'import')).toBe('thumbnail')
  })

  it('liest Karten mit altem Thumbnail-Feld ohne Fehler', async () => {
    const d = await mkdtemp(join(tmpdir(), 'moin-verbindung-'))
    const k = await neueKarte(d, { kanal: 'MoinMornhart', titel: 'Alt', thumbnail: { auftrag: 'x', bild: null, gewaehlt: false } }, 'PC')
    await writeFile(join(kartenOrdner(d), `${k.id}.json`), JSON.stringify({ ...k, thumbnail: 'job-123' }))
    const [geladen] = await ladeKarten(d)
    expect(geladen).toMatchObject({ titel: 'Alt', thumbnail: null })
  })

  it('macht aus Dateinamen lesbare Titel', () => {
    expect(titelAusName('2026-10-01_minecraft_aber_jedes_level.mp4')).toBe('Minecraft aber jedes level')
    expect(titelAusName('Aufnahme 19-42-10 Chained Together.mkv')).toBe('Aufnahme Chained Together')
  })

  it('findet die passende Karte im selben Kanal, die noch nicht verknüpft und nicht hochgeladen ist', async () => {
    const d = await mkdtemp(join(tmpdir(), 'moin-passend-'))
    const a = await neueKarte(d, { kanal: 'MoinMornhart', titel: 'Minecraft, aber jedes Level macht die Welt größer' }, 'PC')
    await neueKarte(d, { kanal: 'MoinMorni', titel: 'Minecraft aber jedes Level' }, 'PC')
    await neueKarte(d, { kanal: 'MoinMornhart', titel: 'Ich baue eine Burg' }, 'PC')
    const karten = await ladeKarten(d)
    expect(passendeKarte(karten, { name: '2026-10-01_minecraft_aber_jedes_level.mp4', kanal: 'MoinMornhart' })?.id).toBe(a.id)
    expect(passendeKarte(karten, { name: 'Lethal Company mit SimPell.mp4', kanal: 'MoinMornhart' })).toBeNull()
  })

  it('Video im Schnitt ohne Karte: verknüpft eine passende oder legt eine neue in „Schnitt“ an', async () => {
    const d = await mkdtemp(join(tmpdir(), 'moin-auto-'))
    const idee = await neueKarte(d, { kanal: 'MoinMornhart', titel: 'Noob-Haus gegen Pro-Haus' }, 'PC')
    const projekt = (id: string, name: string) => ({ id, name, kanal: 'MoinMornhart', erstellt: '2026-10-01', quelle: null, proxy: false, wellenform: false, leiste: false }) as Projekt
    await speichereProjekt(d, projekt('p1', 'noob haus gegen pro haus.mp4'))
    await speichereProjekt(d, projekt('p2', '2026-10-01_lethal_company_mit_simpell.mp4'))
    const verknuepft = await videoInPlanung(d, 'p1')
    expect(verknuepft).toMatchObject({ id: idee.id, schnitt: 'p1', spalte: 'schnitt' })
    const neu = await videoInPlanung(d, 'p2')
    expect(neu).toMatchObject({ titel: 'Lethal company mit simpell', schnitt: 'p2', spalte: 'schnitt', kanal: 'MoinMornhart' })
    // zweiter Aufruf legt nichts doppelt an
    expect((await videoInPlanung(d, 'p2'))?.id).toBe(neu?.id)
    expect(await ladeKarten(d)).toHaveLength(2)
  })
})
