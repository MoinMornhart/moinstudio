import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kartenOrdner, ladeKarten, neueKarte } from '../../src/main/planung/karten'
import { naechsteSpalte } from '../../src/main/planung/verbindung'

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
})
