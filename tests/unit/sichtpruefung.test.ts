import { describe, expect, it } from 'vitest'
import { ernsteWarnungen } from '../../src/main/thumbnail/planung'
import { liesSichtUrteil, SICHT_VORSILBE, sichtPrompt } from '../../src/main/thumbnail/sichtpruefung'

describe('Bildprüfung durch Claude', () => {
  it('nennt beide Bilder und die Bildidee im Prompt', () => {
    const t = sichtPrompt({ bild: 'C:/a/v0.png', handy: 'C:/a/v0.handy.png', beschreibung: 'Ich gegen SimPell', titel: 'Duell', warum: 'wie Gomme' })
    expect(t).toContain('C:/a/v0.png')
    expect(t).toContain('C:/a/v0.handy.png')
    expect(t).toContain('Ich gegen SimPell')
    expect(t).toContain('Duell – wie Gomme')
  })

  it('liest Probleme und verwirft leere Einträge', () => {
    expect(liesSichtUrteil({ passt: false, probleme: ['Creeper zu klein', ' ', 3] })).toEqual({ passt: false, probleme: ['Creeper zu klein'] })
  })

  it('„passt“ gewinnt über mitgeschickte Probleme, kaputte Antworten zählen als bestanden', () => {
    expect(liesSichtUrteil({ passt: true, probleme: ['Kleinigkeit'] })).toEqual({ passt: true, probleme: [] })
    expect(liesSichtUrteil(null)).toEqual({ passt: true, probleme: [] })
  })

  it('höchstens fünf Probleme', () => {
    expect(liesSichtUrteil({ passt: false, probleme: ['a', 'b', 'c', 'd', 'e', 'f'] }).probleme).toHaveLength(5)
  })

  it('Hinweise der Bildprüfung gelten als ernst und lösen eine Korrektur aus', () => {
    expect(ernsteWarnungen([SICHT_VORSILBE + 'Gesicht verdeckt'])).toHaveLength(1)
  })
})
