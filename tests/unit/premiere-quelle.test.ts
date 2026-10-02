import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { quelleFuerPremiere } from '../../src/main/adobe/premiere-export'

describe('Rohvideo für Premiere auf jedem Gerät („Media offline“)', () => {
  it('kopiert ein Video von außerhalb des Datenordners ins Projekt und nimmt danach die Kopie', async () => {
    const daten = await mkdtemp(join(tmpdir(), 'moin-daten-'))
    const aussen = await mkdtemp(join(tmpdir(), 'moin-aussen-'))
    const ordner = join(daten, 'schnitt', 'p1')
    await mkdir(ordner, { recursive: true })
    const video = join(aussen, 'aufnahme.MP4')
    await writeFile(video, 'x'.repeat(100))
    const erst = await quelleFuerPremiere(daten, ordner, video, 100)
    expect(erst).toBe(join(ordner, 'quelle', 'video.mp4'))
    // anderes Gerät: Originalpfad gibt es nicht, die Kopie im (iCloud-)Projektordner schon
    expect(await quelleFuerPremiere(daten, ordner, 'C:/Users/Anders/Videos/aufnahme.MP4', 100)).toBe(erst)
  })

  it('übersetzt Pfade im Datenordner eines anderen Geräts', async () => {
    const daten = await mkdtemp(join(tmpdir(), 'moin-daten-'))
    const ordner = join(daten, 'schnitt', 'p2')
    await mkdir(ordner, { recursive: true })
    await writeFile(join(ordner, 'roh.mp4'), 'y'.repeat(50))
    expect(await quelleFuerPremiere(daten, ordner, 'C:/Users/Laptop/iCloudDrive/MoinStudio/schnitt/p2/roh.mp4', 50)).toBe(join(daten, 'schnitt', 'p2', 'roh.mp4'))
  })

  it('meldet verständlich, wenn das Video nirgends ist', async () => {
    const daten = await mkdtemp(join(tmpdir(), 'moin-daten-'))
    await expect(quelleFuerPremiere(daten, join(daten, 'schnitt', 'p3'), 'D:/weg/clip.mp4', 10)).rejects.toThrow(/nicht da/)
  })
})
