import { describe, expect, it } from 'vitest'
import { dauerAus, zeit } from '../../src/main/thumbnail/video'

describe('Video-Vorschläge (ROADMAP 5.5)', () => {
  it('liest die Videolänge aus der FFmpeg-Ausgabe', () => {
    expect(dauerAus('  Duration: 00:12:34.56, start: 0.000000, bitrate: 5000 kb/s')).toBeCloseTo(754.56)
    expect(dauerAus('  Duration: 01:00:00.00,')).toBe(3600)
    expect(dauerAus('kein Video')).toBeNull()
  })

  it('formatiert Zeitpunkte als Minuten:Sekunden', () => {
    expect(zeit(0)).toBe('0:00')
    expect(zeit(75.4)).toBe('1:15')
    expect(zeit(754)).toBe('12:34')
  })
})
