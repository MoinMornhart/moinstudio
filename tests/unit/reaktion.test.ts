import { describe, expect, it } from 'vitest'
import { GEFUEHLE, gefuehlAus, naechstePose, seiteFuer } from '../../src/main/thumbnail/reaktion'

describe('Reaction-Thumbnails (Stilbuch 14)', () => {
  it('versteht Philips Gefühl in eigenen Worten', () => {
    expect(gefuehlAus('bin total schockiert')).toBe('schockiert')
    expect(gefuehlAus('lach mich tot')).toBe('lachend')
    expect(gefuehlAus('voll cringe')).toBe('cringe')
    expect(gefuehlAus('Das ist doch fake')).toBe('skeptisch')
    expect(gefuehlAus('muede')).toBe('muede')
    expect(gefuehlAus('wuetend')).toBe('wuetend')
    expect(gefuehlAus(undefined)).toBeNull()
  })

  it('wählt jedes Mal eine neue Pose', () => {
    const k = GEFUEHLE['schockiert']!.posen
    expect(naechstePose(k, [])).toBe('neutral')
    expect(naechstePose(k, ['neutral'])).toBe('panik')
    expect(naechstePose(k, ['neutral', 'panik'])).toBe('schreck')
  })

  it('beginnt bei jedem Gefühl mit einer Pose ohne Hände (Stilbuch 14.3)', () => {
    for (const g of Object.values(GEFUEHLE)) expect(g.posen[0]).toBe('neutral')
  })

  it('stellt die Figur immer gegenüber dem wichtigen Punkt auf', () => {
    expect(seiteFuer('rechts', [0.6, 0.4])).toBe('links')
    expect(seiteFuer('links', [0.3, 0.4])).toBe('rechts')
    expect(seiteFuer('rechts', [0.5, 0.4])).toBe('rechts')
    expect(seiteFuer(undefined, undefined)).toBe('links')
  })
})
