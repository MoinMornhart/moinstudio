import { describe, expect, it } from 'vitest'
import { analysePrompt, begrenzeWinkel, besterTreffer, kopfAnteil } from '../../src/main/thumbnail/spielvorlage'

describe('Spiele-Vorlage', () => {
  it('findet das passende Poly-Haven-Modell zum Suchwort', () => {
    const assets = {
      service_pistol: { name: 'Service Pistol', tags: ['gun', 'weapon', 'pistol'], categories: ['props'] },
      antique_katana_01: { name: 'Antique Katana', tags: ['sword', 'blade'], categories: ['props'] },
      wooden_chair: { name: 'Wooden Chair', tags: ['furniture'], categories: ['furniture'] }
    }
    expect(besterTreffer(assets, 'pistol')).toBe('service_pistol')
    expect(besterTreffer(assets, 'sword')).toBe('antique_katana_01')
    expect(besterTreffer(assets, 'controller')).toBeNull()
  })

  it('fragt Kopf, Pose, Gegenstand und Titel ab und übernimmt Philips Wunsch', () => {
    const p = analysePrompt('C:/x/vorlage.jpg', ['neutral', 'pistole'], 'pistole: { … }', 'schau wütender')
    for (const teil of ['C:/x/vorlage.jpg', 'kopf_anteil', 'pistole', 'gegenstand', 'titel_boxen', 'logo_boxen', 'schau wütender']) expect(p).toContain(teil)
  })

  it('macht den Kopf so groß, dass die Figur die entfernte Person abdeckt (höchstens +30 %)', () => {
    expect(kopfAnteil(0.2, { box: [0.1, 0.4, 0.42, 1] })).toBeCloseTo(0.26, 2)
    expect(kopfAnteil(0.4, { box: [0.4, 0, 0.5, 1] })).toBe(0.4)
    expect(kopfAnteil(undefined, {})).toBe(0.35)
  })

  it('begrenzt verdrehte Körper (Rückansicht nur über ansicht)', () => {
    expect(begrenzeWinkel({ blick: 30, koerper: { drehen: 155, vor: 4 }, arm_r: { heben: 80 } })).toEqual({ koerper: { drehen: 60, vor: 4 }, arm_r: { heben: 80 } })
  })
})
