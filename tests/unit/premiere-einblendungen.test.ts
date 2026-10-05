import { describe, expect, it } from 'vitest'
import { premiereXml } from '../../src/main/adobe/premiere'

const basis = { name: 'Test', quelle: { pfad: 'C:/v/a.mp4', dauer: 20, breite: 1920, hoehe: 1080, fps: 30, audio: true }, liste: { version: 1 as const, dauer: 20, behalten: [{ start: 0, ende: 20 }], entfernt: [] }, zooms: [], kapitel: [] }

describe('Premiere: Bibliotheks-Effekte als echte Clips (05.10.)', () => {
  it('legt Einblendungen auf V3 und Töne auf A2, mit Größe, Lage und Lautstärke', () => {
    const xml = premiereXml({
      ...basis,
      einblendungen: [
        { datei: 'C:/daten/effekte/abo/video.mov', start: 5, dauer: 10.5, breite: 1920, hoehe: 1080, groesse: 1, lage: 'unten', standbild: false },
        { datei: 'C:/daten/effekte/logo/bild.png', start: 2, dauer: 3, breite: 400, hoehe: 200, groesse: 0.2, lage: 'oben-rechts', standbild: true }
      ],
      toene: [{ datei: 'C:/daten/schnitt/x/premiere/medien/boom.wav', start: 7, dauer: 1.2, lautstaerke: 1.5 }]
    })
    expect(xml.match(/<track>/g)).toHaveLength(4) // V1 Schnitt, V3 Einblendungen, A1 Original, A2 Töne
    expect(xml.indexOf('clipitem-e0')).toBeLessThan(xml.indexOf('<audio><numOutputChannels>'))
    expect(xml).toMatch(/clipitem-e0[\s\S]*?<start>150<\/start><end>465<\/end>/)
    expect(xml).toMatch(/clipitem-e1[\s\S]*?<value>96<\/value>/) // 1920 · 0,2 / 400 = 96 %
    expect(xml).toContain('file://localhost/C:/daten/effekte/abo/video.mov')
    expect(xml.indexOf('clipitem-g0')).toBeGreaterThan(xml.indexOf('<audio><numOutputChannels>'))
    expect(xml).toMatch(/clipitem-g0[\s\S]*?<start>210<\/start>[\s\S]*?<value>1.5<\/value>/)
  })

  it('ohne Ton im Original kommen die Töne trotzdem auf eine eigene Spur', () => {
    const xml = premiereXml({ ...basis, quelle: { ...basis.quelle, audio: false }, toene: [{ datei: 'C:/m/ding.wav', start: 1, dauer: 1, lautstaerke: 1 }] })
    expect(xml).toMatch(/<audio><numOutputChannels>2<\/numOutputChannels><track><clipitem id="clipitem-g0">/)
  })
})
