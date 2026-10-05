import type { Abschnitt } from './transkript'
import type { Bereich, Schnittliste } from './rohschnitt'
import { effektGraph, type Effekt, type EffektGraph } from './effekte'

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
  /** Abstand der Untertitel vom unteren Rand (Anteil der Höhe); Shorts: höher, über dem Gameplay */
  unten?: number
}

const ass = (s: number): string => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sek = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${sek.toFixed(2).padStart(5, '0')}`
}
export const sauber = (t: string): string => t.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()

export interface UntertitelWort {
  wort: string
  /** Zeiten im geschnittenen Video */
  a: number
  b: number | null
}

/** Behaltene Wörter zu kurzen, gut lesbaren Einblendungen gruppiert (für ASS zum Einbrennen und SRT für Premiere). */
export function untertitelGruppen(abschnitte: Abschnitt[], liste: Schnittliste, maxWoerter: number, endzeit: (t: number) => number = (t) => t): { woerter: UntertitelWort[]; start: number; ende: number }[] {
  const abb = zeitAbbildung(liste.behalten)
  // Schnittzeit, bei Effekten (Zeitlupe, Standbild) weiter auf die Endzeit umgerechnet
  const imSchnitt = (t: number): number | null => {
    const s = abb.imSchnitt(t)
    return s === null ? null : endzeit(s)
  }
  const woerter = abschnitte
    .flatMap((a) => a.woerter)
    .map((w) => ({ wort: w.wort, a: imSchnitt((w.start + w.ende) / 2) === null ? null : imSchnitt(w.start) ?? imSchnitt((w.start + w.ende) / 2)!, b: imSchnitt(w.ende) }))
    .filter((w): w is UntertitelWort => w.a !== null && sauber(w.wort) !== '')
  const gruppen: UntertitelWort[][] = []
  let g: UntertitelWort[] = []
  for (const w of woerter) {
    const letzter = g[g.length - 1]
    if (letzter && (g.length >= maxWoerter || w.a - (letzter.b ?? letzter.a) > 0.6 || /[.!?…]$/.test(letzter.wort))) {
      gruppen.push(g)
      g = []
    }
    g.push(w)
  }
  if (g.length) gruppen.push(g)
  return gruppen.map((gr, i) => {
    const start = gr[0]!.a
    const naechster = gruppen[i + 1]?.[0]?.a
    const ende = Math.min((gr[gr.length - 1]!.b ?? gr[gr.length - 1]!.a) + 0.25, naechster ?? Infinity)
    return { woerter: gr, start, ende: Math.max(ende, start + 0.3) }
  })
}

/** Untertitel aus den Wortzeiten, nur für behaltene Wörter, kurze gut lesbare Einblendungen. */
export function untertitelAss(abschnitte: Abschnitt[], liste: Schnittliste, stil: UntertitelStil, endzeit?: (t: number) => number): string {
  const gruppen = untertitelGruppen(abschnitte, liste, stil.woerter, endzeit)
  const groesse = Math.round(stil.hoehe * 0.058)
  const kopf = `[Script Info]
ScriptType: v4.00+
PlayResX: ${stil.breite}
PlayResY: ${stil.hoehe}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Moin,Arial,${groesse},${stil.karaoke ? '&H0000D7FF' : '&H00FFFFFF'},&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(groesse / 11))},0,2,${Math.round(stil.breite * 0.08)},${Math.round(stil.breite * 0.08)},${Math.round(stil.hoehe * (stil.unten ?? 0.07))},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const zeilen = gruppen.map(({ woerter: gr, start, ende }) => {
    const text = stil.karaoke
      ? gr.map((w, j) => `{\\k${Math.max(1, Math.round((((gr[j + 1]?.a ?? w.b ?? w.a + 0.3) as number) - w.a) * 100))}}${sauber(w.wort)}`).join(' ')
      : gr.map((w) => sauber(w.wort)).join(' ')
    return `Dialogue: 0,${ass(start)},${ass(ende)},Moin,,0,0,0,,${text}`
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
  /** Hochformat (Shorts, 1080×1920): Facecam oben (Anteile x0,y0,x1,y1 im Original), Gameplay darunter; ohne Facecam mittiger Ausschnitt */
  hoch?: { cam: [number, number, number, number] | null }
  /** Video-Encoder-Argumente (z. B. libx264 -preset … oder h264_nvenc …) */
  encoder: string[]
  ausgabe: string
  /** Effekte (ROADMAP E.2) mit fertigen Text-Bildern und Geräuschen; Zeiten im geschnittenen Video */
  effekte?: { liste: Effekt[]; textBilder: Record<string, { datei: string; breite: number; hoehe: number }>; klaenge: Record<string, string>; stingVideos?: Record<string, string> }
  /** Mit Effekten: Schnittzeit → Endzeit und Länge des fertigen Videos */
  endzeit?: (t: number) => number
  laengeEnde?: number
  /** Ton auf YouTube-Lautheit bringen (−14 LUFS, Spitzen höchstens −1 dBTP) – nur beim Export */
  lautheit?: boolean
  /** „Zuschauen“ (Philip, 05.10.): Dateiname im Arbeitsordner, in den FFmpeg jede Sekunde das aktuelle Bild schreibt */
  live?: string
}

/** Effektteil des Graphen (nur ohne Hochformat): gleiche Eingaben für filterGraph und renderArgs */
function effektTeil(o: RenderOptionen): EffektGraph | null {
  if (!o.effekte?.liste.length || o.hoch) return null
  const laenge = o.liste.behalten.reduce((s, b) => s + b.ende - b.start, 0)
  return effektGraph({ effekte: o.effekte.liste, laenge, breite: o.breite, hoehe: o.hoehe, fps: o.fps, audio: o.audio, autoZooms: o.zooms, textBilder: o.effekte.textBilder, klaenge: o.effekte.klaenge, untertitel: o.untertitel, stingVideos: o.effekte.stingVideos })
}

const zahl = (x: number): string => x.toFixed(3)

/**
 * Auswahl der behaltenen Stücke als FFmpeg-Ausdruck. Als ausgeglichener Baum (if(lt(t,Mitte),links,rechts)) statt einer
 * langen Summe: Mit 180 Stücken (30-Minuten-Aufnahme) brach FFmpegs Ausdrucks-Leser ab und meldete irreführend
 * „Cannot allocate memory“ (Philip, 04.10.). Der Baum ist auch bei tausend Stücken nur ~10 Ebenen tief.
 */
export function auswahlAusdruck(stuecke: { start: number; ende: number }[]): string {
  const s = [...stuecke].sort((a, b) => a.start - b.start)
  const baum = (von: number, bis: number): string => {
    if (bis - von === 1) return `between(t\\,${zahl(s[von]!.start)}\\,${zahl(s[von]!.ende)})`
    const mitte = Math.floor((von + bis) / 2)
    return `if(lt(t\\,${zahl(s[mitte]!.start)})\\,${baum(von, mitte)}\\,${baum(mitte, bis)})`
  }
  return s.length ? baum(0, s.length) : '0'
}

/** Filtergraph (kommt in eine Datei – bei Stunden-Streams wäre er für die Windows-Befehlszeile zu lang). */
export function filterGraph(o: RenderOptionen): string {
  const roh = filterGraphRoh(o)
  // Zuschauen: das fertige Bild zusätzlich einmal pro Sekunde klein als Live-Bild ausgeben
  const g = o.live ? `${roh.split('[v]').join('[vfertig]')};[vfertig]split=2[v][vl];[vl]fps=1,scale=640:-2[vlive]` : roh
  // [a] ist immer nur Ausgang des Graphen: umbenennen und die Lautheits-Normalisierung dahinter hängen
  // Nur die Marke „[a]“ ersetzen – /[a]/ ohne Backslashes traf jedes einzelne „a“ (scale → sc[aroh]le) und jeder Export
  // mit Lautheit scheiterte (Laptop 05.10.)
  return o.lautheit && o.audio ? `${g.split('[a]').join('[aroh]')};[aroh]loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[a]` : g
}

function filterGraphRoh(o: RenderOptionen): string {
  const auswahl = auswahlAusdruck(o.liste.behalten)
  const zoom = o.zooms.length
    ? `,scale=w='iw*(1+0.12*(${o.zooms.map((z) => `min(1\\,max(0\\,(t-${zahl(z.start)})/0.35))*min(1\\,max(0\\,(${zahl(z.ende)}-t)/0.35))`).join('+')}))':h=-2:eval=frame,crop=${o.breite}:${o.hoehe}`
    : ''
  const ende = `${o.untertitel ? `,subtitles=${o.untertitel}` : ''},format=yuv420p[v]`
  const basis = `[0:v]select='${auswahl}',setpts=N/FRAME_RATE/TB,fps=${o.fps}`
  const eff = effektTeil(o)
  if (eff) {
    // Schnitt als [vc]/[ac], danach die Effektkette (Zooms und Untertitel laufen dort mit)
    const ton = o.audio ? `;[0:a]aselect='${auswahl}',asetpts=N/SR/TB[ac]` : ''
    return `${basis},scale=${o.breite}:${o.hoehe}:force_original_aspect_ratio=increase,crop=${o.breite}:${o.hoehe},setsar=1[vc]${ton};\n${eff.graph}`
  }
  let video: string
  if (o.hoch?.cam) {
    // Short: Facecam oben (ein Drittel), Gameplay mittig darunter
    const [x0, y0, x1, y1] = o.hoch.cam
    const camH = Math.round(o.hoehe / 3 / 2) * 2
    video = `${basis},split=2[g][c];[c]crop=iw*${zahl(x1 - x0)}:ih*${zahl(y1 - y0)}:iw*${zahl(x0)}:ih*${zahl(y0)},scale=${o.breite}:${camH}:force_original_aspect_ratio=increase,crop=${o.breite}:${camH}[cam];[g]scale=-2:${o.hoehe - camH},crop=${o.breite}:${o.hoehe - camH}[spiel];[cam][spiel]vstack${ende}`
  } else {
    video = `${basis},scale=${o.breite}:${o.hoehe}:force_original_aspect_ratio=increase,crop=${o.breite}:${o.hoehe}${o.hoch ? '' : zoom}${ende}`
  }
  const ton = o.audio ? `;[0:a]aselect='${auswahl}',asetpts=N/SR/TB[a]` : ''
  return video + ton
}

export function renderArgs(o: RenderOptionen, graphDatei: string): string[] {
  const eingaben = (effektTeil(o)?.eingaben ?? []).flatMap((e) => [...e.vor, '-i', e.datei])
  const live = o.live ? ['-map', '[vlive]', '-update', '1', '-q:v', '5', '-f', 'image2', o.live] : []
  return ['-i', o.quelle, ...eingaben, '-/filter_complex', graphDatei, '-map', '[v]', ...(o.audio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []), ...o.encoder, '-movflags', '+faststart', o.ausgabe, ...live]
}
