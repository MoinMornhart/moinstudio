import type { Abschnitt } from './transkript'
import type { Bereich, Schnittliste } from './rohschnitt'

/**
 * Rendern des Schnitts (ROADMAP 6.6/6.7) in einem FFmpeg-Durchgang: behaltene Stellen auswählen (select/aselect),
 * sanfte Zooms auf Höhepunkte (scale mit eval=frame + crop – kein zoompan) und Untertitel (ASS) einbrennen.
 * Alle Zeiten von Zooms und Untertiteln sind Zeiten im geschnittenen Video.
 */

/** Originalzeit → Zeit im geschnittenen Video (null = liegt in einer entfernten Stelle). */
export function zeitAbbildung(behalten: Bereich[]): { imSchnitt: (t: number) => number | null; laenge: number } {
  const vorher: number[] = []
  let summe = 0
  for (const b of behalten) {
    vorher.push(summe)
    summe += b.ende - b.start
  }
  return {
    laenge: summe,
    imSchnitt: (t) => {
      for (let i = 0; i < behalten.length; i++) {
        const b = behalten[i]!
        if (t >= b.start && t <= b.ende) return vorher[i]! + (t - b.start)
      }
      return null
    }
  }
}

export interface UntertitelStil {
  breite: number
  hoehe: number
  /** Wort für Wort gelb hervorheben (Karaoke, vor allem für Shorts) */
  karaoke: boolean
  /** höchstens so viele Wörter pro Einblendung */
  woerter: number
}

const ass = (s: number): string => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sek = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${sek.toFixed(2).padStart(5, '0')}`
}
const sauber = (t: string): string => t.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()

/** Untertitel aus den Wortzeiten, nur für behaltene Wörter, kurze gut lesbare Einblendungen. */
export function untertitelAss(abschnitte: Abschnitt[], liste: Schnittliste, stil: UntertitelStil): string {
  const { imSchnitt } = zeitAbbildung(liste.behalten)
  const woerter = abschnitte
    .flatMap((a) => a.woerter)
    .map((w) => ({ ...w, a: imSchnitt((w.start + w.ende) / 2) === null ? null : imSchnitt(w.start) ?? imSchnitt((w.start + w.ende) / 2)!, b: imSchnitt(w.ende) }))
    .filter((w): w is typeof w & { a: number } => w.a !== null && sauber(w.wort) !== '')
  const gruppen: (typeof woerter)[] = []
  let g: typeof woerter = []
  for (const w of woerter) {
    const letzter = g[g.length - 1]
    if (letzter && (g.length >= stil.woerter || w.a - (letzter.b ?? letzter.a) > 0.6 || /[.!?…]$/.test(letzter.wort))) {
      gruppen.push(g)
      g = []
    }
    g.push(w)
  }
  if (g.length) gruppen.push(g)
  const groesse = Math.round(stil.hoehe * 0.058)
  const kopf = `[Script Info]
ScriptType: v4.00+
PlayResX: ${stil.breite}
PlayResY: ${stil.hoehe}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Moin,Arial,${groesse},${stil.karaoke ? '&H0000D7FF' : '&H00FFFFFF'},&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(groesse / 11))},0,2,${Math.round(stil.breite * 0.08)},${Math.round(stil.breite * 0.08)},${Math.round(stil.hoehe * 0.07)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const zeilen = gruppen.map((gr, i) => {
    const start = gr[0]!.a
    const naechster = gruppen[i + 1]?.[0]?.a
    const ende = Math.min((gr[gr.length - 1]!.b ?? gr[gr.length - 1]!.a) + 0.25, naechster ?? Infinity)
    const text = stil.karaoke
      ? gr.map((w, j) => `{\\k${Math.max(1, Math.round((((gr[j + 1]?.a ?? w.b ?? w.a + 0.3) as number) - w.a) * 100))}}${sauber(w.wort)}`).join(' ')
      : gr.map((w) => sauber(w.wort)).join(' ')
    return `Dialogue: 0,${ass(start)},${ass(Math.max(ende, start + 0.3))},Moin,,0,0,0,,${text}`
  })
  return kopf + zeilen.join('\n') + '\n'
}

const AUSRUF = /\b(oh nein|nein+|krass|alter|was\?!|boah|wow|oh mein gott|hilfe|schnell|lauf)\b|!/i

/**
 * Höhepunkte für sanfte Zooms: Ausrufe („Oh nein!“) zuerst, dann laute Spitzen; höchstens alle 20 s, Zeiten im
 * geschnittenen Video. Lautstärke allein verliert gegen einen Ausruf in der Nähe.
 */
export function zoomsAus(abschnitte: Abschnitt[], liste: Schnittliste, wellen: { aufloesung: number; werte: number[] } | null): Bereich[] {
  const { imSchnitt } = zeitAbbildung(liste.behalten)
  const mittel = wellen && wellen.werte.length ? wellen.werte.reduce((x, y) => x + y, 0) / wellen.werte.length : 0
  const spitze = (x: number, y: number): number => {
    if (!wellen) return 0
    const teil = wellen.werte.slice(Math.floor(x / wellen.aufloesung), Math.ceil(y / wellen.aufloesung))
    return teil.length ? Math.max(...teil) : 0
  }
  const kandidaten: (Bereich & { wert: number })[] = []
  for (const ab of abschnitte) {
    const wert = (AUSRUF.test(ab.text) ? 2 : 0) + (mittel > 0 && spitze(ab.start, ab.ende) > Math.min(95, mittel * 2.2) ? 1 : 0)
    if (!wert) continue
    const st = imSchnitt(ab.start)
    const en = imSchnitt(ab.ende)
    if (st === null || en === null || en - st < 0.6) continue
    kandidaten.push({ start: st, ende: Math.min(en + 0.3, st + 6), wert })
  }
  const zooms: Bereich[] = []
  for (const k of kandidaten.sort((x, y) => y.wert - x.wert || x.start - y.start)) {
    if (zooms.some((z) => Math.abs(z.start - k.start) < 20)) continue
    zooms.push({ start: k.start, ende: k.ende })
  }
  return zooms.sort((x, y) => x.start - y.start)
}

export interface RenderOptionen {
  quelle: string
  liste: Schnittliste
  zooms: Bereich[]
  /** Dateiname der Untertitel im Arbeitsordner (FFmpeg läuft dort, damit Windows-Pfade im Filter kein Problem sind) */
  untertitel: string | null
  breite: number
  hoehe: number
  fps: number
  audio: boolean
  /** Video-Encoder-Argumente (z. B. libx264 -preset … oder h264_nvenc …) */
  encoder: string[]
  ausgabe: string
}

const zahl = (x: number): string => x.toFixed(3)

/** Filtergraph (kommt in eine Datei – bei Stunden-Streams wäre er für die Windows-Befehlszeile zu lang). */
export function filterGraph(o: RenderOptionen): string {
  const auswahl = o.liste.behalten.map((b) => `between(t\\,${zahl(b.start)}\\,${zahl(b.ende)})`).join('+') || '0'
  const zoom = o.zooms.length
    ? `,scale=w='iw*(1+0.12*(${o.zooms.map((z) => `min(1\\,max(0\\,(t-${zahl(z.start)})/0.35))*min(1\\,max(0\\,(${zahl(z.ende)}-t)/0.35))`).join('+')}))':h=-2:eval=frame,crop=${o.breite}:${o.hoehe}`
    : ''
  const video = `[0:v]select='${auswahl}',setpts=N/FRAME_RATE/TB,fps=${o.fps},scale=${o.breite}:${o.hoehe}:force_original_aspect_ratio=increase,crop=${o.breite}:${o.hoehe}${zoom}${o.untertitel ? `,subtitles=${o.untertitel}` : ''},format=yuv420p[v]`
  const ton = o.audio ? `;[0:a]aselect='${auswahl}',asetpts=N/SR/TB[a]` : ''
  return video + ton
}

export function renderArgs(o: RenderOptionen, graphDatei: string): string[] {
  return ['-i', o.quelle, '-/filter_complex', graphDatei, '-map', '[v]', ...(o.audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []), ...o.encoder, '-movflags', '+faststart', o.ausgabe]
}
