import type { LogoGroesse, LogoPosition } from '@shared/app'

/**
 * Wo das Logo im Thumbnail steht (Philip, 30.09.: „Logos überall einfügen, egal bei welchem Generator“). Das Logo kommt
 * in eine freie Ecke: nie über Köpfe, Figuren, Mobs, Items, Titel oder Text. Die Boxen liefern die Renderer ohnehin in
 * ihren Berichten (*.bericht.json). Alle Angaben in Bildanteilen 0–1, oben links = 0,0.
 */

export type Box = [number, number, number, number]
export type Ecke = Exclude<LogoPosition, 'auto'>

/** Fläche des Logos als Anteil der Bildfläche (so wirken breite Schriftzüge und runde Zeichen gleich groß) */
export const LOGO_FLAECHE: Record<LogoGroesse, number> = { winzig: 0.006, klein: 0.012, mittel: 0.022, gross: 0.04, riesig: 0.065 }
/** Abstand zum Bildrand als Anteil der Bildbreite */
const RAND = 0.025
/** YouTube zeigt unten rechts die Videolänge – dort landet das Logo nur, wenn Philip es ausdrücklich will */
export const ZEITSTEMPEL: Box = [0.84, 0.86, 1, 1]
/** Reihenfolge für „automatisch“: unten links wie die Spiel-Logos bei Bastian, dann oben, zuletzt unten rechts */
const REIHENFOLGE: Ecke[] = ['unten_links', 'oben_rechts', 'oben_links', 'unten_rechts']
/** Schrittweise kleiner, bevor ein Logo über Wichtigem landen würde */
const STUFEN = [1, 0.85, 0.7, 0.55]
/** Schritte (Anteil der Bildbreite), um die das Logo an der Kante entlang nach innen rückt, wenn die Ecke belegt ist */
const RUECKEN = [0, 0.06, 0.12, 0.18]

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
export function istBox(b: unknown): b is Box {
  return Array.isArray(b) && b.length === 4 && b.every(istZahl) && b[2] > b[0] && b[3] > b[1]
}

export function ueberlappung(a: Box, b: Box): number {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  return w * h
}

/** Körper unter einem Kopf: Minecraft-Figuren sind gut doppelt so breit wie der Kopf und reichen bis zum Bildrand unten */
export function koerperUnter(kopf: Box): Box {
  const w = kopf[2] - kopf[0]
  return [kopf[0] - w * 0.75, kopf[1], kopf[2] + w * 0.75, 1]
}

/**
 * Alles Wichtige aus einem Renderbericht, egal von welchem Generator: Figuren (box, sonst kopf_box mit Körper), Items,
 * Mobs, Text (texte), Kopf der Reaction/Vorlage (kopf_box), dazu freie Listen boxen und sperren (Titel, Logos,
 * Gesichter im Original).
 */
export function wichtigeBoxen(bericht: unknown): Box[] {
  if (!bericht || typeof bericht !== 'object') return []
  const b = bericht as Record<string, unknown>
  const boxen: Box[] = []
  const werte = (x: unknown): unknown[] => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : [])
  for (const f of werte(b['figuren'])) {
    const o = (f ?? {}) as { box?: unknown; kopf_box?: unknown }
    if (istBox(o.box)) boxen.push(o.box)
    if (istBox(o.kopf_box)) boxen.push(o.kopf_box)
  }
  for (const liste of [b['items'], b['mobs'], b['texte']]) for (const x of werte(liste)) if (istBox((x as { box?: unknown })?.box)) boxen.push((x as { box: Box }).box)
  if (istBox(b['kopf_box'])) boxen.push(b['kopf_box'], koerperUnter(b['kopf_box']))
  for (const liste of [b['boxen'], b['sperren']]) for (const x of werte(liste)) if (istBox(x)) boxen.push(x)
  return boxen
}

/** Box des Logos in einer Ecke; `ruecken` schiebt es an der waagerechten Kante zur Bildmitte. */
export function logoBox(ecke: Ecke, flaeche: number, logoVerhaeltnis: number, bildVerhaeltnis: number, ruecken = 0): Box {
  // w · h = Fläche, h = w · Bildverhältnis / Logoverhältnis (h als Anteil der Bildhöhe)
  let w = Math.sqrt((flaeche * logoVerhaeltnis) / bildVerhaeltnis)
  let h = (w * bildVerhaeltnis) / logoVerhaeltnis
  // sehr breite oder hohe Logos begrenzen
  const f = Math.min(1, 0.45 / w, 0.4 / h)
  w *= f
  h *= f
  const randY = RAND * bildVerhaeltnis
  const x = ecke.endsWith('links') ? RAND + ruecken : 1 - RAND - ruecken - w
  const y = ecke.startsWith('oben') ? randY : 1 - randY - h
  return [x, y, x + w, y + h].map((v) => Math.round(v * 10000) / 10000) as Box
}

export interface LogoPlatz {
  box: Box
  ecke: Ecke
  /** false: nirgends frei, das Logo überdeckt etwas (kleinste Größe, geringste Überdeckung) */
  frei: boolean
  /** kleiner als gewünscht, damit es frei steht */
  verkleinert: boolean
  /** Philips Ecke war belegt, das Logo steht woanders */
  ausgewichen: boolean
}

/**
 * Wählt den Platz: gewünschte Ecke (oder alle Ecken der Reihe nach), an der Kante entlang nach innen, dann schrittweise
 * kleiner. Ist Philips Ecke auch klein belegt, weicht das Logo in eine freie Ecke aus.
 */
export function waehleLogoPlatz(o: { sperren: Box[]; logoVerhaeltnis: number; bildVerhaeltnis?: number; groesse: LogoGroesse; position: LogoPosition }): LogoPlatz {
  const bildV = o.bildVerhaeltnis ?? 16 / 9
  const logoV = istZahl(o.logoVerhaeltnis) && o.logoVerhaeltnis > 0 ? o.logoVerhaeltnis : 1
  const flaeche = LOGO_FLAECHE[o.groesse] ?? LOGO_FLAECHE.mittel
  const auto = o.position === 'auto'
  // etwas Luft um alles Wichtige
  const sperren = o.sperren.filter(istBox).map((b): Box => [b[0] - 0.012, b[1] - 0.02, b[2] + 0.012, b[3] + 0.02])
  const alle = auto ? [...sperren, ZEITSTEMPEL] : sperren
  const ecken = auto ? REIHENFOLGE : [o.position as Ecke]
  const belegt = (b: Box): number => alle.reduce((n, s) => n + ueberlappung(b, s), 0)
  for (const [i, stufe] of STUFEN.entries()) {
    for (const ecke of ecken) {
      for (const r of RUECKEN) {
        const box = logoBox(ecke, flaeche * stufe, logoV, bildV, r)
        if (belegt(box) === 0) return { box, ecke, frei: true, verkleinert: i > 0, ausgewichen: false }
      }
    }
  }
  if (!auto) {
    const anders = waehleLogoPlatz({ ...o, position: 'auto' })
    return { ...anders, ausgewichen: anders.frei || anders.ausgewichen }
  }
  // Nirgends frei: kleinste Stufe mit der geringsten Überdeckung
  const kleinste = flaeche * STUFEN[STUFEN.length - 1]!
  let beste: { box: Box; ecke: Ecke; wert: number } | null = null
  for (const ecke of ecken)
    for (const r of RUECKEN) {
      const box = logoBox(ecke, kleinste, logoV, bildV, r)
      const wert = belegt(box)
      if (!beste || wert < beste.wert) beste = { box, ecke, wert }
    }
  return { box: beste!.box, ecke: beste!.ecke, frei: false, verkleinert: true, ausgewichen: false }
}

/** Breite und Höhe aus dem PNG-Kopf (IHDR), ohne das Bild zu dekodieren */
export function pngGroesse(daten: Uint8Array): { breite: number; hoehe: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (daten.length < 24 || sig.some((b, i) => daten[i] !== b)) return null
  const dv = new DataView(daten.buffer, daten.byteOffset, daten.byteLength)
  return { breite: dv.getUint32(16), hoehe: dv.getUint32(20) }
}

const ECKEN_NAMEN: Record<Ecke, string> = { oben_links: 'oben links', oben_rechts: 'oben rechts', unten_links: 'unten links', unten_rechts: 'unten rechts' }

/** Hinweise für Philip, wenn das Logo nicht wie gewünscht stehen konnte */
export function platzHinweise(p: LogoPlatz, gewuenscht: LogoPosition): string[] {
  if (!p.frei) return ['Das Logo findet keinen ganz freien Platz und überdeckt etwas – schreib unten z. B. „Logo kleiner“ oder „Logo weg“.']
  const h: string[] = []
  if (p.ausgewichen && gewuenscht !== 'auto') h.push(`${ECKEN_NAMEN[gewuenscht]} ist belegt – das Logo steht ${ECKEN_NAMEN[p.ecke]}.`)
  else if (p.verkleinert) h.push('Das Logo ist etwas kleiner als gewünscht, damit es nichts Wichtiges verdeckt.')
  return h
}
