import { describe, expect, it } from 'vitest'
import { aenderungsPrompt, normaleTexte, textDatei } from '../../src/main/thumbnail/aenderung'

describe('Änderung: Texte', () => {
  it('findet die Textdatei zur Variante und zur Änderung (auch in der Kette)', () => {
    expect(textDatei('C:/d/t/variante-1.v0.szene.json')).toBe('C:/d/t/variante-1.texte.json')
    expect(textDatei('C:/d/t/aenderung-x/aenderung.szene.json')).toBe('C:/d/t/aenderung-x/aenderung.texte.json')
  })

  it('bringt Texte in die Form [{text, farbe?}]', () => {
    expect(normaleTexte([{ text: 'GIGANTISCH', farbe: 'gelb' }])).toEqual([{ text: 'GIGANTISCH', farbe: 'gelb' }])
    expect(normaleTexte('KRASS')).toEqual([{ text: 'KRASS' }])
    expect(normaleTexte({ text: ' TAG 100 ' })).toEqual([{ text: 'TAG 100' }])
    expect(normaleTexte([])).toEqual([])
    expect(normaleTexte(undefined)).toEqual([])
    expect(normaleTexte([{ text: '' }, 5, null])).toEqual([])
  })

  it('erklärt Claude bei Minecraft-Szenen, wie Text dazukommt', () => {
    const p = aenderungsPrompt({ art: 'thumbnail', wunsch: 'Text GIGANTISCH in Gelb', bild: 'b.png', formatHilfe: '' }, '{}')
    expect(p).toContain('„texte“')
    expect(p).toContain('Leere Liste = kein Text')
    expect(aenderungsPrompt({ art: 'reaktion', wunsch: 'x', bild: 'b.png' }, '{}')).not.toContain('Leere Liste')
  })
})
