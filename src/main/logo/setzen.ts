import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LogoGroesse, LogoPosition } from '@shared/app'
import { runBlender } from '../jobs/blender'
import type { JobContext } from '../jobs/queue'
import { koerperUnter, platzHinweise, pngGroesse, waehleLogoPlatz, wichtigeBoxen, type Box } from './platz'

/**
 * Gemeinsamer letzter Schritt aller Thumbnail-Arten (Minecraft, Reaction, Gaming, Spiele-Vorlage, Änderung): Ist ein
 * Logo gewählt, kommt es in eine freie Ecke des fertigen Bilds (blender/logo_setzen.py, reine Pixelarbeit). Das Bild
 * ohne Logo bleibt liegen – für Änderungen und die Photoshop-Ebene „Logo“.
 */

export interface LogoWahl {
  /** PNG mit Transparenz (aus der Bibliothek im Datenordner) */
  datei: string
  name: string
  position: LogoPosition
  groesse: LogoGroesse
}

/** Logo einer fertigen Variante: Wahl, gewählte Box und das Bild ohne Logo */
export interface VarianteLogo extends LogoWahl {
  box: Box
  ohneLogo: string
}

const POSITIONEN: LogoPosition[] = ['auto', 'oben_links', 'oben_rechts', 'unten_links', 'unten_rechts']
const GROESSEN: LogoGroesse[] = ['winzig', 'klein', 'mittel', 'gross', 'riesig']

export async function logoAufsetzen(
  o: { bild: string; logo: LogoWahl; sperren: Box[]; ausgabe: string; blender: { exe: string; mesa: boolean }; blenderDir: string },
  ctx: JobContext<unknown>
): Promise<{ bild: string; logo: VarianteLogo | null; warnungen: string[] }> {
  const [bild, logo] = await Promise.all([readFile(o.bild).catch(() => null), readFile(o.logo.datei).catch(() => null)])
  const gb = bild && pngGroesse(bild)
  const gl = logo && pngGroesse(logo)
  if (!gb || !gl) return { bild: o.bild, logo: null, warnungen: [gl ? 'Logo konnte nicht gesetzt werden (Bild nicht lesbar).' : `Das Logo „${o.logo.name}“ fehlt in der Bibliothek.`] }
  const platz = waehleLogoPlatz({ sperren: o.sperren, logoVerhaeltnis: gl.breite / gl.hoehe, bildVerhaeltnis: gb.breite / gb.hoehe, groesse: o.logo.groesse, position: o.logo.position })
  const r = await runBlender({ exe: o.blender.exe, mesa: o.blender.mesa, script: join(o.blenderDir, 'logo_setzen.py'), args: [o.bild, o.logo.datei, platz.box.join(','), o.ausgabe] }, ctx)
  if (r.code !== 0 || !r.output.includes('MOIN_LOGO')) return { bild: o.bild, logo: null, warnungen: ['Logo konnte nicht gesetzt werden.'] }
  return { bild: o.ausgabe, logo: { ...o.logo, box: platz.box, ohneLogo: o.bild }, warnungen: platzHinweise(platz, o.logo.position) }
}

/**
 * Belegte Stellen einer Spiele-Vorlage: Philips Kopf und Körper (Bericht), Freunde (Kopf aus der Spezifikation), Titel,
 * Logos und Gegenstand aus Claudes Analyse der Vorlage. Riesige Hintergrund-Logos (mehr als ein Drittel des Bilds) zählen
 * nicht, sonst fände das Logo nie Platz.
 */
export async function sperrenVorlage(berichtPfad: string, analysePfad: string, spec: Record<string, unknown>): Promise<Box[]> {
  const lies = async (p: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(p, 'utf8').catch(() => '{}')) as Record<string, unknown>
  const [bericht, a] = await Promise.all([lies(berichtPfad), lies(analysePfad)])
  const klein = (b: Box): boolean => (b[2] - b[0]) * (b[3] - b[1]) <= 0.33
  const titel = [...((a['titel'] as { box?: unknown }[] | undefined) ?? []).map((t) => t?.box), ...((a['titel_boxen'] as unknown[]) ?? []), ...((a['logo_boxen'] as unknown[]) ?? []), (a['gegenstand'] as { box?: unknown } | undefined)?.box]
  const freunde = ((spec['freunde'] as { kopf?: number[]; kopf_anteil?: number }[] | undefined) ?? []).flatMap((f): Box[] => {
    if (f.kopf?.length !== 2 || typeof f.kopf_anteil !== 'number') return []
    const h = f.kopf_anteil
    const w = (h * 9) / 16
    const kopf: Box = [f.kopf[0]! - w / 2, f.kopf[1]! - h / 2, f.kopf[0]! + w / 2, f.kopf[1]! + h / 2]
    return [kopf, koerperUnter(kopf)]
  })
  return [...wichtigeBoxen(bericht), ...wichtigeBoxen({ sperren: titel }).filter(klein), ...freunde]
}

/** Beschreibung für Claude bei Änderungen in Worten („Logo kleiner“, „Logo nach links“, „Logo weg“) */
export function logoHilfe(bibliothek: string[]): string {
  return `
Das Logo steht im Feld „logo“: {"name": …, "position": …, "groesse": …} oder null (kein Logo).
position: auto (freie Ecke), oben_links, oben_rechts, unten_links, unten_rechts – „nach links“ heißt die linke Ecke auf
gleicher Höhe, „nach oben“ die obere Ecke auf gleicher Seite. groesse (von klein nach groß): ${GROESSEN.join(', ')} –
„kleiner“/„größer“ ist eine Stufe. „Logo weg“ = null. Das Logo steht nie über Figuren, Köpfen, Text oder Wichtigem; ist die
gewünschte Ecke belegt, weicht es selbst aus.${bibliothek.length ? `\nLogos in Philips Bibliothek (für name): ${bibliothek.map((n) => `„${n}“`).join(', ')}.` : ''}
Soll ein Logo dazu, ohne dass Philip eins nennt, setze {"position": "auto", "groesse": "mittel"} (dann kommt sein Standard-Logo).`
}

/** Logo für Claude: nur Name, Platz und Größe (keine Pfade) */
export function logoFuerClaude(l: LogoWahl | undefined): { name: string; position: LogoPosition; groesse: LogoGroesse } | null {
  return l ? { name: l.name, position: l.position, groesse: l.groesse } : null
}

/**
 * Claudes geändertes Feld „logo“ → Logo für den neuen Render. null/false = kein Logo; ein Name aus der Bibliothek wählt
 * dieses Logo, sonst bleibt das bisherige (oder das Standard-Logo, wenn vorher keins da war). Unbekannte Werte fallen auf
 * die bisherigen zurück.
 */
export function logoAusAntwort(roh: unknown, bisher: LogoWahl | undefined, bibliothek: { name: string; datei: string }[], standard: LogoWahl | undefined): LogoWahl | undefined {
  if (roh === undefined) return bisher
  if (!roh || typeof roh !== 'object') return undefined
  const r = roh as { name?: unknown; position?: unknown; groesse?: unknown }
  const name = typeof r.name === 'string' ? r.name.trim().toLowerCase() : ''
  const ausBib = name ? bibliothek.find((b) => b.name.toLowerCase() === name) : undefined
  const basis = ausBib ? { datei: ausBib.datei, name: ausBib.name } : (bisher ?? standard)
  if (!basis) return undefined
  return {
    datei: basis.datei,
    name: basis.name,
    position: POSITIONEN.includes(r.position as LogoPosition) ? (r.position as LogoPosition) : (bisher?.position ?? 'auto'),
    groesse: GROESSEN.includes(r.groesse as LogoGroesse) ? (r.groesse as LogoGroesse) : (bisher?.groesse ?? 'mittel')
  }
}
