import { describe, expect, it } from 'vitest'
import { annahmeSchluessel, leseRahmen, textRahmen } from '../../src/main/premiere/websocket'

describe('Premiere-Brücke: WebSocket (M12)', () => {
  it('berechnet den Annahme-Schlüssel nach RFC 6455', () => {
    // Beispiel aus RFC 6455, Abschnitt 1.3
    expect(annahmeSchluessel('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
  })

  it('liest maskierte Client-Rahmen und schreibt Server-Rahmen, auch lange', () => {
    const text = 'Hallo Premiere'
    const maske = Buffer.from([1, 2, 3, 4])
    const daten = Buffer.from(text)
    const masked = Buffer.from(daten.map((b, i) => b ^ maske[i % 4]!))
    const rahmen = Buffer.concat([Buffer.from([0x81, 0x80 | daten.length]), maske, masked])
    const { rahmen: r, rest } = leseRahmen(Buffer.concat([rahmen, Buffer.from([0x81])]))
    expect(r[0]!.daten.toString()).toBe(text)
    expect(rest.length).toBe(1) // halber nächster Rahmen bleibt liegen
    const lang = 'x'.repeat(70_000)
    expect(leseRahmen(textRahmen(lang)).rahmen[0]!.daten.toString()).toBe(lang)
  })
})
