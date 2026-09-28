import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findReference } from '../../scripts/vergleich.mts'

describe('Vergleichswerkzeug (ROADMAP 3.3)', () => {
  const root = mkdtempSync(join(tmpdir(), 'moin-ref-'))
  mkdirSync(join(root, 'gommehd'))
  mkdirSync(join(root, 'castcrafter'))
  writeFileSync(join(root, 'gommehd', '01-bcmEo2NBFLI.jpg'), '')
  writeFileSync(join(root, 'gommehd', '12-abcdEFGhijk.jpg'), '')
  writeFileSync(join(root, 'castcrafter', '03_w3pi2vsqqFI.jpg'), '')

  it('findet Vorbilder über Nummer oder Video-ID, auch mit Unterstrich im Dateinamen', () => {
    expect(findReference('gommehd/1', root)).toMatch(/01-bcmEo2NBFLI\.jpg$/)
    expect(findReference('gommehd/12', root)).toMatch(/12-abcdEFGhijk\.jpg$/)
    expect(findReference('gommehd/bcmEo2NBFLI', root)).toMatch(/01-bcmEo2NBFLI\.jpg$/)
    expect(findReference('castcrafter/3', root)).toMatch(/03_w3pi2vsqqFI\.jpg$/)
  })

  it('meldet verständlich, wenn etwas fehlt', () => {
    expect(() => findReference('gommehd', root)).toThrow(/<kanal>\/<nummer-oder-id>/)
    expect(() => findReference('paluten/1', root)).toThrow(/Kein Vorbild-Ordner/)
    expect(() => findReference('gommehd/99', root)).toThrow(/nicht gefunden/)
  })
})
