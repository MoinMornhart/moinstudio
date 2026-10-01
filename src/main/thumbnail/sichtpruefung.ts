/**
 * Bildprüfung durch Claude (Checkliste im Thumbnail-Labor, Punkt 1): Claude sieht das gerenderte Bild groß und so
 * klein, wie es auf dem Handy in der YouTube-Liste erscheint, und nennt Probleme, die sich in der Szene beheben lassen.
 * Die Zahlen-Prüfung aus Blender findet Abstände und Ränder, aber nicht „man erkennt nicht, worum es geht“.
 */

export interface SichtUrteil {
  passt: boolean
  probleme: string[]
}

export const SICHT_SCHEMA = {
  type: 'object',
  required: ['passt', 'probleme'],
  properties: {
    passt: { type: 'boolean' },
    probleme: { type: 'array', items: { type: 'string' } }
  }
}

/** Vorsilbe, an der die Korrekturschleife Hinweise aus der Bildprüfung erkennt */
export const SICHT_VORSILBE = 'Bildprüfung: '

export function sichtPrompt(o: { bild: string; handy: string; beschreibung: string; titel: string; warum?: string }): string {
  return `Das ist ein gerendertes Minecraft-Thumbnail für YouTube (noch ohne Text und Grafik, die kommen später dazu).
Video: „${o.beschreibung}“
Bildidee: ${o.titel}${o.warum ? ` – ${o.warum}` : ''}

Bild in voller Größe: ${o.bild}
So klein erscheint es auf dem Handy in der YouTube-Liste: ${o.handy}

Sieh dir beide Bilder an und prüfe streng wie ein Thumbnail-Profi:
- Erkennt man auf dem KLEINEN Bild in unter einer Sekunde, worum es geht (Figur und Gegenstück/Thema)?
- Ist Philips Gesicht (die Hauptfigur) klar zu sehen – nicht verdeckt, nicht von hinten, nicht angeschnitten? Dasselbe für
  weitere Figuren, die zur Bildidee gehören.
- Ist das Thema (Mob, Bauwerk, Gegenstand) sichtbar, sofort erkennbar und nicht verdeckt oder an der falschen Stelle
  abgeschnitten?
- Hält eine Figur etwas: ist es gut zu sehen und sitzt es sinnvoll in der Hand?
- Grafikfehler: schwebende oder im Boden steckende Figuren, Teile in Wänden, schwarze Flächen, fehlende Körperteile,
  seltsame Farben. Muster, Farbflecken und Pixel auf den Skins der Figuren sind gewollt (eigene Skins) – kein Fehler.
- Ist das Bild zu dunkel, zu voll oder verschwimmt die Figur mit dem Hintergrund?

Ein Thumbnail muss nicht perfekt sein – melde nur, was ein Zuschauer wirklich bemerkt. Formuliere jedes Problem so, dass
man es in der Szene beheben kann (z. B. „Creeper zu klein und weit hinten – näher an Philip“, „Schwert verdeckt das
Gesicht – andere Hand oder andere Pose“).
Antworte nur mit JSON: {"passt": true|false, "probleme": ["kurz, auf Deutsch"]}.`
}

export function liesSichtUrteil(roh: unknown): SichtUrteil {
  const u = (roh ?? {}) as Partial<SichtUrteil>
  const probleme = Array.isArray(u.probleme) ? u.probleme.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 5) : []
  return { passt: u.passt === true || probleme.length === 0, probleme: u.passt === true ? [] : probleme }
}
