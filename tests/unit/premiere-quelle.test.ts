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

describe('Premiere-Sequenzen beim Start auffrischen', () => {
  it('liest verlinkte Pfade aus der XML', async () => {
    const { verlinktePfade } = await import('../../src/main/adobe/premiere-auffrischen')
    expect(verlinktePfade('<pathurl>file://localhost/C:/A%20B/v.mp4</pathurl><pathurl>file://localhost/D:/x&amp;y.png</pathurl>')).toEqual(['C:/A B/v.mp4', 'D:/x&y.png'])
  })
})

describe('Rohvideo eines anderen Geräts (anderer Windows-Benutzer)', () => {
  it('überträgt C:\\Users\\<anderer>\\… auf den Benutzerordner dieses Geräts', async () => {
    const { dateiAufDiesemGeraet } = await import('../../src/main/schnitt/projekt')
    const heim = await mkdtemp(join(tmpdir(), 'moin-heim-'))
    await mkdir(join(heim, 'iCloudDrive', 'Aufnahmen'), { recursive: true })
    await writeFile(join(heim, 'iCloudDrive', 'Aufnahmen', 'folge 1.mkv'), 'z'.repeat(30))
    expect(dateiAufDiesemGeraet('C:\\Users\\pmorn\\iCloudDrive\\Aufnahmen\\folge 1.mkv', { heim, groesse: 30 })).toBe(join(heim, 'iCloudDrive', 'Aufnahmen', 'folge 1.mkv'))
    // falsche Größe: nicht nehmen
    expect(dateiAufDiesemGeraet('C:\\Users\\pmorn\\iCloudDrive\\Aufnahmen\\folge 1.mkv', { heim, groesse: 31 })).toBe('C:\\Users\\pmorn\\iCloudDrive\\Aufnahmen\\folge 1.mkv')
  })

  it('findet die Kopie im Projektordner, wenn das Original nur auf dem anderen Gerät liegt', async () => {
    const { dateiAufDiesemGeraet } = await import('../../src/main/schnitt/projekt')
    const ordner = await mkdtemp(join(tmpdir(), 'moin-proj-'))
    await mkdir(join(ordner, 'quelle'))
    await writeFile(join(ordner, 'quelle', 'video.mkv'), 'q'.repeat(12))
    expect(dateiAufDiesemGeraet('D:\\Aufnahmen\\roh.MKV', { ordner, groesse: 12 })).toBe(join(ordner, 'quelle', 'video.mkv'))
  })
})
