import type { SchnittEffekt } from './app'

const zahl = (x: unknown): string => (typeof x === 'number' ? String(Math.round(x * 100) / 100).replace('.', ',') : '')

/** Effekt in einfachen Worten (für Philip) */
export function effektText(e: SchnittEffekt): string {
  // aus der Effekt-Bibliothek: Philips eigener Name, automatisch gesetzt oder per Wunsch
  const bib = e['bib'] as { name?: string; auto?: boolean } | undefined
  if (bib?.name) return `„${bib.name}“${e.art === 'geraeusch' ? ' (Sound)' : ''}${bib.auto ? ' · automatisch' : ''}`
  switch (e.art) {
    case 'tempo':
      return (e['faktor'] as number) < 1 ? `Zeitlupe (×${zahl(e['faktor'])})` : `Zeitraffer (×${zahl(e['faktor'])})`
    case 'einfrieren':
      return `Standbild ${zahl(e['dauer'])} s`
    case 'zoom':
      return `Zoom ×${zahl(e['faktor'])}`
    case 'wackeln':
      return 'Wackeln'
    case 'farbe':
      return `Farbe: ${[e['schwarzweiss'] ? 'Schwarzweiß' : '', typeof e['ton'] === 'string' ? e['ton'] : '', e['saettigung'] !== undefined ? `Sättigung ${zahl(e['saettigung'])}` : '', e['kontrast'] !== undefined ? `Kontrast ${zahl(e['kontrast'])}` : ''].filter(Boolean).join(', ') || 'angepasst'}`
    case 'blitz':
      return e['farbe'] === 'schwarz' ? 'Schwarzer Blitz' : 'Blitz'
    case 'uebergang':
      return e['farbe'] === 'weiss' ? 'Weiße Blende' : 'Abblende'
    case 'abblende':
      return e['richtung'] === 'ein' ? 'Einblenden' : 'Ausblenden'
    case 'text':
      return `Text „${String(e['text'] ?? '')}“`
    case 'bild':
      return 'Bild-Einblendung'
    case 'geraeusch':
      return `Geräusch: ${String(e['klang'] ?? '')}`
    case 'zensur':
      return 'Zensur mit Piep'
    case 'lautstaerke':
      return `Lautstärke ×${zahl(e['faktor'])}`
    case 'intro': {
      const teile = (e['teile'] as { art: string; text?: string }[] | undefined) ?? []
      const karte = teile.find((t) => t.art === 'karte')
      return `Intro: ${teile.filter((t) => t.art === 'clip').length} Momente${karte ? ` + Titelkarte „${karte.text}“` : ''}`
    }
    default:
      return e.art
  }
}
