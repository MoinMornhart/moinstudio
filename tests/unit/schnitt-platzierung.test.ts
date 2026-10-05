import { describe, expect, it } from 'vitest'
import { ABSTAND, HOOK, bibAufloesen, bibBausteine, gehoertRein, platzOk, regelPlaetze, zuOriginalzeit } from '../../src/main/schnitt/platzierung'
import { zuSchnittzeit } from '../../src/main/schnitt/effekte'
import type { BibEffekt } from '../../src/main/schnitt/bibliothek'

const effekt = (x: Partial<BibEffekt> = {}): BibEffekt => ({
  id: 'abo1',
  name: 'Abo-Animation',
  video: { datei: 'video.webm', greenscreen: false, ton: true, dauer: 3 },
  haeufigkeit: { modus: 'immer' },
  kanaele: ['MoinMornhart', 'MoinMorni'],
  typen: ['reaction', 'gaming'],
  platzierung: { modus: 'ki' },
  lage: 'unten-rechts',
  groesse: 0.35,
  erstellt: '2026-10-05T00:00:00Z',
  ...x
})

describe('Bibliotheks-Effekte verteilen', () => {
  it('rechnet Schnittzeit in Originalzeit zurück', () => {
    const behalten = [
      { start: 0, ende: 10 },
      { start: 20, ende: 30 }
    ]
    expect(zuOriginalzeit(5, behalten)).toBe(5)
    expect(zuOriginalzeit(12, behalten)).toBe(22)
    expect(zuSchnittzeit(zuOriginalzeit(17, behalten)!, behalten, 'anfang')).toBe(17)
    expect(zuOriginalzeit(25, behalten)).toBeNull()
  })

  it('entscheidet nach Kanal, Typ und Häufigkeit', () => {
    expect(gehoertRein(effekt(), 'MoinMorni', 'reaction', 'p1', 0)).toBe(true)
    expect(gehoertRein(effekt({ kanaele: ['MoinMornhart'] }), 'MoinMorni', 'reaction', 'p1', 0)).toBe(false)
    expect(gehoertRein(effekt({ typen: ['gaming'] }), 'MoinMorni', 'reaction', 'p1', 0)).toBe(false)
    expect(gehoertRein(effekt({ haeufigkeit: { modus: 'manuell' } }), 'MoinMorni', 'reaction', 'p1', 0)).toBe(false)
    const jedes3 = effekt({ haeufigkeit: { modus: 'manchmal', jedes: 3 } })
    expect([0, 1, 2, 3, 4, 5].map((n) => gehoertRein(jedes3, 'MoinMorni', 'gaming', 'p', n))).toEqual([true, false, false, true, false, false])
    // X %: über viele Projekte ungefähr der Anteil, je Projekt immer gleich
    const halb = effekt({ haeufigkeit: { modus: 'manchmal', prozent: 50 } })
    const treffer = Array.from({ length: 400 }, (_, i) => gehoertRein(halb, 'MoinMorni', 'gaming', `projekt-${i}`, 0)).filter(Boolean).length
    expect(treffer).toBeGreaterThan(140)
    expect(treffer).toBeLessThan(260)
    expect(gehoertRein(halb, 'MoinMorni', 'gaming', 'x', 0)).toBe(gehoertRein(halb, 'MoinMorni', 'gaming', 'x', 5))
  })

  it('hält Hook, Höhepunkte, Abstand und Überschneidung frei', () => {
    const o = { laenge: 300, belegt: [{ von: 100, bis: 104 }], bib: [200], laut: [60] }
    expect(platzOk(HOOK - 1, 3, o)).toBe(false)
    expect(platzOk(30, 3, o)).toBe(true)
    expect(platzOk(58, 3, o)).toBe(false) // Höhepunkt bei 60
    expect(platzOk(102, 3, o)).toBe(false) // überschneidet
    expect(platzOk(200 + ABSTAND - 1, 3, o)).toBe(false) // zu nah am anderen Bibliotheks-Effekt
    expect(platzOk(298, 3, o)).toBe(false) // läuft übers Ende
  })

  it('verteilt per Regel auf Satzenden, nie gleichzeitig', () => {
    const satzenden = Array.from({ length: 60 }, (_, i) => i * 5 + 2)
    const p = regelPlaetze(
      [
        { id: 'a', dauer: 3 },
        { id: 'b', dauer: 3 },
        { id: 'c', dauer: 3 }
      ],
      { laenge: 300, satzenden, belegt: [], laut: [] }
    )
    expect(p).toHaveLength(3)
    const zeiten = p.map((x) => x.bei).sort((a, b) => a - b)
    for (let i = 1; i < zeiten.length; i++) expect(zeiten[i]! - zeiten[i - 1]!).toBeGreaterThanOrEqual(ABSTAND)
    expect(zeiten[0]).toBeGreaterThanOrEqual(HOOK)
    for (const t of zeiten) expect(satzenden).toContain(t)
  })

  it('baut Video, Bild und Sound als Effekte mit Verweis', () => {
    const e = effekt({ sound: { datei: 'sound.mp3', lautstaerke: 0.8 }, chroma: { farbe: '#00ff00', toleranz: 0.3, weichheit: 0.1, spill: 0.5 } })
    const b = bibBausteine(e, 42, true)
    expect(b).toEqual([
      { art: 'video', bei: 42, datei: 'bib:abo1/video.webm', lage: 'unten-rechts', groesse: 0.35, ton: true, chroma: e.chroma, bib: { id: 'abo1', name: 'Abo-Animation', auto: true } },
      { art: 'geraeusch', bei: 42, klang: 'bib:abo1/sound.mp3', lautstaerke: 0.8, bib: { id: 'abo1', name: 'Abo-Animation', auto: true } }
    ])
    const bild = bibBausteine(effekt({ video: undefined, bild: { datei: 'bild.png', dauer: 2 }, lage: 'voll' }), 10, false)
    expect(bild).toEqual([{ art: 'bild', von: 10, bis: 12, datei: 'bib:abo1/bild.png', lage: 'voll', groesse: 1, bib: { id: 'abo1', name: 'Abo-Animation' } }])
  })

  it('löst „bib“-Bausteine aus einem Wunsch auf (auch per Name)', () => {
    const vine = effekt({ id: 'vine', name: 'Vine-Boom', video: undefined, sound: { datei: 'sound.mp3', lautstaerke: 1 } })
    const r = bibAufloesen(
      [
        { art: 'zoom', von: 1, bis: 2, faktor: 1.2 },
        { art: 'bib', bei: 134, name: 'vine-boom' },
        { art: 'bib', bei: 5, id: 'gibtsnicht' }
      ],
      [vine]
    )
    expect(r.effekte).toEqual([{ art: 'zoom', von: 1, bis: 2, faktor: 1.2 }, { art: 'geraeusch', bei: 134, klang: 'bib:vine/sound.mp3', lautstaerke: 1, bib: { id: 'vine', name: 'Vine-Boom' } }])
    expect(r.fehler).toHaveLength(1)
  })
})
