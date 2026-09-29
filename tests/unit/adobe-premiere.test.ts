import { describe, expect, it } from 'vitest'
import { dateiUrl, premiereXml, srt, zeitbasis, zoomKeyframes } from '../../src/main/adobe/premiere'

/** Wohlgeformtheit: jedes geöffnete Element wird in der richtigen Reihenfolge geschlossen. */
function wohlgeformt(xml: string): boolean {
  const stapel: string[] = []
  for (const m of xml.replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    const [, zu, name, leer] = m
    if (leer) continue
    if (zu) {
      if (stapel.pop() !== name) return false
    } else stapel.push(name!)
  }
  return stapel.length === 0
}
const zaehle = (xml: string, tag: string): number => (xml.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length

describe('Premiere: Sequenz als FCP7-XML (ROADMAP 8.3, ungetestet in Premiere)', () => {
  it('erkennt NTSC-Bildraten', () => {
    expect(zeitbasis(29.97)).toMatchObject({ timebase: 30, ntsc: true })
    expect(zeitbasis(30)).toMatchObject({ timebase: 30, ntsc: false })
    expect(zeitbasis(59.94)).toMatchObject({ timebase: 60, ntsc: true })
    expect(zeitbasis(25)).toMatchObject({ timebase: 25, ntsc: false })
  })

  it('schreibt Windows-Pfade als Datei-URL', () => {
    expect(dateiUrl('D:\\Aufnahmen\\Folge 1 & Co.mp4')).toBe('file://localhost/D:/Aufnahmen/Folge%201%20%26%20Co.mp4')
  })

  it('setzt Zoom-Keyframes nur dort, wo ein Zoom liegt, mit Rampe wie im Render', () => {
    expect(zoomKeyframes([{ start: 10, ende: 14 }], 0, 5)).toEqual([])
    expect(zoomKeyframes([{ start: 10, ende: 14 }], 8, 20)).toEqual([
      { t: 8, wert: 100 },
      { t: 10, wert: 100 },
      { t: 10.35, wert: 112 },
      { t: 13.65, wert: 112 },
      { t: 14, wert: 100 },
      { t: 20, wert: 100 }
    ])
    // Zoom über einen Schnitt hinweg: der Clip beginnt schon vergrößert
    expect(zoomKeyframes([{ start: 10, ende: 14 }], 12, 20)[0]).toEqual({ t: 12, wert: 112 })
  })

  it('baut eine Sequenz mit allen behaltenen Stücken, Ton, Zoom und Kapitel-Markern', () => {
    const xml = premiereXml({
      name: 'Creeper <Test> & Co',
      quelle: { pfad: 'D:\\Aufnahmen\\roh.mp4', dauer: 60, breite: 1920, hoehe: 1080, fps: 30, audio: true },
      liste: { version: 1, dauer: 60, behalten: [{ start: 0, ende: 10 }, { start: 15, ende: 30 }, { start: 40, ende: 60 }], entfernt: [] },
      zooms: [{ start: 12, ende: 16 }],
      kapitel: [{ zeit: 0, titel: 'Intro' }, { zeit: 25, titel: 'Der Creeper {kommt}' }]
    })
    expect(wohlgeformt(xml)).toBe(true)
    expect(xml).toContain('<xmeml version="5">')
    expect(xml).toContain('<name>Creeper &lt;Test&gt; &amp; Co</name>')
    expect(zaehle(xml, 'clipitem')).toBe(6) // 3 Bild + 3 Ton
    expect(zaehle(xml, 'file')).toBe(6)
    expect(xml.match(/<pathurl>/g)).toHaveLength(1) // Datei nur einmal voll beschrieben
    // lückenlose Zeitleiste in Frames: 0–300, 300–750, 750–1350; in/out aus dem Original
    expect(xml).toContain('<start>0</start><end>300</end><in>0</in><out>300</out>')
    expect(xml).toContain('<start>300</start><end>750</end><in>450</in><out>900</out>')
    expect(xml).toContain('<start>750</start><end>1350</end><in>1200</in><out>1800</out>')
    expect(xml).toContain('<duration>1350</duration>')
    // Zoom 12–16 s im Schnitt liegt im zweiten Stück (Schnitt 10–25 s = Quelle 15–30 s): Keyframes in Quell-Frames
    expect(zaehle(xml, 'effect')).toBe(1)
    expect(xml).toContain('<keyframe><when>510</when><value>100</value></keyframe>')
    expect(xml).toContain('<keyframe><when>620</when><value>112</value></keyframe>')
    expect(xml).toContain('<marker><name>Der Creeper kommt</name><comment>Kapitel</comment><in>750</in><out>-1</out></marker>')
  })

  it('lässt ohne Ton die Tonspur weg', () => {
    const xml = premiereXml({ name: 'x', quelle: { pfad: 'C:\\a.mp4', dauer: 5, breite: 1280, hoehe: 720, fps: 29.97, audio: false }, liste: { version: 1, dauer: 5, behalten: [{ start: 0, ende: 5 }], entfernt: [] }, zooms: [], kapitel: [] })
    expect(wohlgeformt(xml)).toBe(true)
    expect(xml).not.toContain('<audio>')
    expect(xml).toContain('<timebase>30</timebase><ntsc>TRUE</ntsc>')
    expect(xml).toContain('<out>150</out>')
  })

  it('schreibt Untertitel als SRT', () => {
    expect(srt([{ start: 1.5, ende: 3.25, text: 'Oh nein!' }, { start: 3661.001, ende: 3662, text: 'Weiter' }])).toBe('1\n00:00:01,500 --> 00:00:03,250\nOh nein!\n\n2\n01:01:01,001 --> 01:01:02,000\nWeiter\n')
  })
})
