import { describe, expect, it } from 'vitest'
import { analysePrompt, begrenzeWinkel, besterTreffer, ersatzSuchwort, groesserBeiLuecke, freundePlaetze, gueltigeReste, gueltigeVerbindungen, korrigiere, kopfAnteil, personenArgumente, titelArgumente } from '../../src/main/thumbnail/spielvorlage'

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
    for (const teil of ['C:/x/vorlage.jpg', 'kopf_anteil', 'pistole', 'gegenstand', 'titel', 'farbe', 'schau wütender']) expect(p).toContain(teil)
  })

  it('macht den Kopf so groß, dass die Figur die entfernte Person abdeckt (höchstens +30 %)', () => {
    expect(kopfAnteil(0.2, { box: [0.1, 0.4, 0.42, 1] })).toBeCloseTo(0.23, 2)
    expect(kopfAnteil(0.4, { box: [0.4, 0, 0.5, 1] })).toBe(0.4)
    expect(kopfAnteil(undefined, {})).toBe(0.35)
    expect(kopfAnteil(0.15, { hoehe: 1 })).toBe(0.25)
  })

  it('baut Titel-Argumente mit Farbe und nimmt alte Kästen weiter an', () => {
    expect(titelArgumente({ titel: [{ box: [0.5, 0.1, 0.9, 0.3], farbe: '#111111' }, { box: [0, 0, 1, 1], farbe: 'schwarz' }], logo_boxen: [[0.1, 0.1, 0.2, 0.2]] })).toEqual([
      'farbe=#111111:0.5,0.1,0.9,0.3',
      'logo:0.1,0.1,0.2,0.2'
    ])
  })

  it('setzt Freunde an die Stelle weiterer Personen, sonst neben Philip', () => {
    const f = [{ skin: 'a.png' }, { skin: 'b.png' }]
    const plaetze = freundePlaetze({ kopf: [0.3, 0.4], kopf_anteil: 0.4, weitere: [{ kopf: [0.7, 0.35], kopf_anteil: 0.35, pose: 'jubeln' }] }, f)
    expect(plaetze[0]).toMatchObject({ skin: 'a.png', kopf: [0.7, 0.35], kopf_anteil: 0.35, pose: 'jubeln' })
    expect(plaetze[1]).toMatchObject({ skin: 'b.png', pose: 'neutral' })
    expect((plaetze[1]!['kopf'] as number[])[0]).toBeCloseTo(0.54, 2)
  })

  it('macht die Figur größer, wenn sie die alte Person nicht abdeckt', () => {
    expect(groesserBeiLuecke(0.3, 0.2)).toBe(0.48)
    expect(groesserBeiLuecke(0.3, 0.5)).toBe(0.36)
    expect(groesserBeiLuecke(0.3, 0.8)).toBe(0.3)
    expect(groesserBeiLuecke(0.65, 0.1)).toBe(0.7)
    expect(groesserBeiLuecke(0.3, undefined)).toBe(0.3)
  })

  it('ignoriert riesige Hintergrund-Logos als Titel', () => {
    expect(titelArgumente({ titel: [{ box: [0, 0.18, 0.94, 0.97], farbe: '#d8b46a' }, { box: [0.15, 0.81, 0.85, 0.92], farbe: '#ffffff' }] })).toEqual(['farbe=#ffffff:0.15,0.81,0.85,0.92'])
  })

  it('begrenzt verdrehte Körper (Rückansicht nur über ansicht)', () => {
    expect(begrenzeWinkel({ blick: 30, koerper: { drehen: 155, vor: 4 }, arm_r: { heben: 80 } })).toEqual({ koerper: { drehen: 60, vor: 4 }, arm_r: { heben: 80 } })
  })
})

describe('Spiele-Vorlage: mehrere Personen, Verbindungen, Schlussprüfung', () => {
  it('gibt je ersetzter Person einen Kasten an die Freistellung', () => {
    const a = { box: [0.4, 0.1, 0.9, 0.9] as [number, number, number, number], weitere: [{ box: [0.1, 0.3, 0.5, 1.2] as [number, number, number, number], kopf: [0.3, 0.4] as [number, number], kopf_anteil: 0.2 }] }
    expect(personenArgumente(a, 1)).toEqual(['--person=0.4,0.1,0.9,0.9', '--person=0.1,0.3,0.5,1'])
    expect(personenArgumente(a, 0)).toEqual(['--person=0.4,0.1,0.9,0.9'])
    expect(personenArgumente({ weitere: [] }, 0)).toEqual([])
  })

  it('zeichnet Verbindungen nur, wenn beide Enden ersetzt werden', () => {
    const a = { verbindungen: [{ von: 'ich', zu: 'freund0', art: 'kette' as const }, { von: 'ich', zu: 'freund1', art: 'seil' as const }, { von: 'ich', zu: 'ich', art: 'kette' as const }] }
    expect(gueltigeVerbindungen(a, 1).map((v) => v.zu)).toEqual(['freund0'])
    expect(gueltigeVerbindungen(a, 0)).toEqual([])
  })

  it('übernimmt nur erlaubte Korrekturen der Schlussprüfung', () => {
    const spec: Record<string, unknown> = { skin: 'a.png', kopf_anteil: 0.4, freunde: [{ skin: 'b.png', kopf_anteil: 0.2 }] }
    korrigiere(spec, { kopf_anteil: 0.95, skin: 'boese.png', pose: { koerper: { drehen: 200 } }, freunde: [{ kopf: [0.3, 0.4], skin: 'x.png' }] })
    expect(spec['skin']).toBe('a.png')
    expect(spec['kopf_anteil']).toBe(0.7)
    expect(spec['pose']).toEqual({ koerper: { drehen: 60 } })
    expect((spec['freunde'] as Record<string, unknown>[])[0]).toEqual({ skin: 'b.png', kopf_anteil: 0.2, kopf: [0.3, 0.4] })
  })

  it('beschreibt den ganzen Körper und Verbindungen im Analyse-Prompt', () => {
    const p = analysePrompt('v.png', ['klettern'], '', undefined, ['SimPell'])
    expect(p).toContain('bein_r/bein_l')
    expect(p).toContain('verbindungen')
    expect(p).toContain('box: [x0, y0, x1, y1] Kasten um die GANZE Person')
  })
})

describe('Spiele-Vorlage: Ersatz und Blick', () => {
  it('findet verwandte Modelle, wenn es das genaue nicht gibt', () => {
    expect(ersatzSuchwort('shotgun')).toBe('rifle')
    expect(ersatzSuchwort('Revolver')).toBe('pistol')
    expect(ersatzSuchwort('battle axe')).toBe('axe')
    expect(ersatzSuchwort('magic wand')).toBeNull()
  })

  it('begrenzt den Blick der Schlussprüfung auf −90 bis 90 Grad', () => {
    const spec: Record<string, unknown> = { ansicht: 'hinten', blick: 20, freunde: [{ blick: 0 }] }
    korrigiere(spec, { blick: 160, freunde: [{ blick: -170 }] })
    expect(spec['blick']).toBe(90)
    expect((spec['freunde'] as Record<string, unknown>[])[0]!['blick']).toBe(-90)
  })
})

describe('Reste der alten Person aus der Schlussprüfung', () => {
  it('nimmt nur gültige, nicht riesige Kästen, höchstens vier', () => {
    expect(gueltigeReste({ reste: [[0.08, 0.5, 0.2, 0.75], [0.5, 0.5, 0.4, 0.6], [0, 0, 1, 1], [0.1, 0.1, 0.2], 'x'] })).toEqual([[0.08, 0.5, 0.2, 0.75]])
    expect(gueltigeReste({ reste: Array(6).fill([0.1, 0.1, 0.2, 0.2]) })).toHaveLength(4)
    expect(gueltigeReste({})).toEqual([])
  })
})
