import type { Bereich } from './rohschnitt'

/**
 * Effekte im Schnitt (ROADMAP E.2): kombinierbare Bausteine statt fester Effektliste. Zeiten stehen im geschnittenen
 * Video („Schnittzeit“). Tempo und Einfrieren verändern die Zeitleiste; alles andere (Zoom, Wackeln, Farbe, Blitz,
 * Übergang, Text, Bild, Geräusch, Zensur) läuft danach auf der „Endzeit“ – dafür gibt es die Zeitabbildung.
 */

export type Effekt =
  | { art: 'tempo'; von: number; bis: number; faktor: number }
  | { art: 'einfrieren'; bei: number; dauer: number }
  | { art: 'zoom'; von: number; bis: number; faktor: number; x?: number; y?: number }
  | { art: 'wackeln'; von: number; bis: number; staerke?: number }
  | { art: 'farbe'; von: number; bis: number; saettigung?: number; kontrast?: number; helligkeit?: number; schwarzweiss?: boolean; ton?: 'warm' | 'kalt' | 'rot' | 'gruen' | 'blau' }
  | { art: 'blitz'; bei: number; dauer?: number; farbe?: 'weiss' | 'schwarz' }
  | { art: 'uebergang'; bei: number; dauer?: number; farbe?: 'weiss' | 'schwarz' }
  | { art: 'text'; von: number; bis: number; text: string; lage?: 'oben' | 'mitte' | 'unten'; farbe?: string; groesse?: number; animation?: 'pop' | 'fest' }
  | { art: 'bild'; von: number; bis: number; datei: string; lage?: 'oben' | 'mitte' | 'unten' | 'links' | 'rechts'; groesse?: number }
  | { art: 'geraeusch'; bei: number; klang: string; lautstaerke?: number }
  | { art: 'zensur'; von: number; bis: number }
  | { art: 'lautstaerke'; von: number; bis: number; faktor: number }

export const EFFEKT_ARTEN = ['tempo', 'einfrieren', 'zoom', 'wackeln', 'farbe', 'blitz', 'uebergang', 'text', 'bild', 'geraeusch', 'zensur', 'lautstaerke'] as const

/** Stück der neuen Zeitleiste: normal (ggf. mit Tempo) oder ein eingefrorenes Standbild */
export type Stueck = { a: number; b: number; faktor: number } | { frieren: number; dauer: number }

export interface Zeitleiste {
  stuecke: Stueck[]
  /** Schnittzeit → Endzeit */
  endzeit: (t: number) => number
  laenge: number
  /** true, wenn Tempo oder Einfrieren die Zeitleiste verändern */
  veraendert: boolean
}

const klemme = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x))

/** Zeitleiste aus Tempo- und Einfrier-Effekten. Überlappende Tempo-Bereiche: der später genannte gewinnt. */
export function zeitleiste(effekte: Effekt[], laenge: number): Zeitleiste {
  const tempo = effekte.filter((e): e is Extract<Effekt, { art: 'tempo' }> => e.art === 'tempo' && e.bis > e.von && e.faktor > 0)
  const frieren = effekte
    .filter((e): e is Extract<Effekt, { art: 'einfrieren' }> => e.art === 'einfrieren' && e.dauer > 0)
    .map((e) => ({ bei: klemme(e.bei, 0, laenge), dauer: e.dauer }))
    .sort((x, y) => x.bei - y.bei)
  const punkte = [...new Set([0, laenge, ...tempo.flatMap((e) => [klemme(e.von, 0, laenge), klemme(e.bis, 0, laenge)]), ...frieren.map((f) => f.bei)])].sort((x, y) => x - y)
  const faktorBei = (t: number): number => {
    let f = 1
    for (const e of tempo) if (t >= e.von && t < e.bis) f = klemme(e.faktor, 0.1, 8)
    return f
  }
  const stuecke: Stueck[] = []
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i]!
    const b = punkte[i + 1]!
    for (const f of frieren) if (f.bei === a) stuecke.push({ frieren: a, dauer: f.dauer })
    if (b - a > 1e-6) stuecke.push({ a, b, faktor: faktorBei((a + b) / 2) })
  }
  for (const f of frieren) if (f.bei >= laenge) stuecke.push({ frieren: laenge, dauer: f.dauer })
  const endzeit = (t: number): number => {
    let s = 0
    for (const st of stuecke) {
      if ('frieren' in st) {
        if (st.frieren < t) s += st.dauer // ein Ereignis genau am Standbild beginnt mit dem Standbild
        continue
      }
      if (t <= st.a) break
      s += (Math.min(t, st.b) - st.a) / st.faktor
      if (t <= st.b) break
    }
    return s
  }
  const neu = stuecke.reduce((s, st) => s + ('frieren' in st ? st.dauer : (st.b - st.a) / st.faktor), 0)
  return { stuecke, endzeit, laenge: neu, veraendert: tempo.length > 0 || frieren.length > 0 }
}

const z = (x: number): string => x.toFixed(3)
const zwischen = (a: number, b: number): string => `between(t\\,${z(a)}\\,${z(b)})`
/** 0 → 1 → 0 mit weicher Rampe: Gewicht eines Bereichs zur Zeit t */
const rampe = (a: number, b: number, r = 0.3): string => `min(1\\,max(0\\,(t-${z(a)})/${z(r)}))*min(1\\,max(0\\,(${z(b)}-t)/${z(r)}))`

/** atempo kann je Stufe nur 0,5–2: größere Faktoren als Kette */
export function atempoKette(f: number): string {
  const teile: string[] = []
  let rest = f
  while (rest < 0.5) {
    teile.push('atempo=0.5')
    rest /= 0.5
  }
  while (rest > 2) {
    teile.push('atempo=2')
    rest /= 2
  }
  if (Math.abs(rest - 1) > 1e-3) teile.push(`atempo=${Number(rest.toFixed(4))}`)
  return teile.join(',') || 'anull'
}

export interface EffektEingabe {
  /** Argumente für ffmpeg vor diesem -i (z. B. -loop 1 -t 3) */
  vor: string[]
  datei: string
}

export interface EffektGraph {
  /** Filter ab [vc]/[ac] bis [v]/[a] */
  graph: string
  /** zusätzliche Eingaben ab Index 1 */
  eingaben: EffektEingabe[]
  /** Länge des fertigen Videos */
  laenge: number
  /** Schnittzeit → Endzeit (für Untertitel und automatische Zooms) */
  endzeit: (t: number) => number
}

export interface EffektOptionen {
  effekte: Effekt[]
  /** Länge des geschnittenen Videos (Schnittzeit) */
  laenge: number
  breite: number
  hoehe: number
  fps: number
  audio: boolean
  /** automatische Zooms (Schnittzeit), wie bisher */
  autoZooms: Bereich[]
  /** fertige Text-Bilder je Effekt-Index (PNG in Minecraft-Schrift) */
  textBilder: Record<number, { datei: string; breite: number; hoehe: number }>
  /** Geräusch-Dateien je Klang */
  klaenge: Record<string, string>
  untertitel: string | null
}

/** Filtergraph für alle Effekte: Zeitleiste (Tempo, Einfrieren), dann Bild, Einblendungen, Ton. */
export function effektGraph(o: EffektOptionen): EffektGraph {
  const zl = zeitleiste(o.effekte, o.laenge)
  const E = zl.endzeit
  const teile: string[] = []
  const eingaben: EffektEingabe[] = []
  let v = 'vc'
  let a = 'ac'
  // 1. Zeitleiste: Stücke zerlegen, Tempo/Standbild anwenden, wieder zusammensetzen
  if (zl.veraendert) {
    const n = zl.stuecke.length
    teile.push(`[vc]split=${n}${zl.stuecke.map((_, i) => `[vs${i}]`).join('')}`)
    if (o.audio) teile.push(`[ac]aresample=48000,aformat=channel_layouts=stereo,asplit=${n}${zl.stuecke.map((_, i) => `[as${i}]`).join('')}`)
    zl.stuecke.forEach((st, i) => {
      if ('frieren' in st) {
        const p = Math.max(0, st.frieren - 1 / o.fps)
        teile.push(`[vs${i}]trim=start=${z(p)}:end=${z(p + 1 / o.fps)},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${z(st.dauer)},trim=duration=${z(st.dauer)}[vt${i}]`)
        if (o.audio) teile.push(`[as${i}]atrim=start=0:end=0.001,asetpts=PTS-STARTPTS,apad=whole_dur=${z(st.dauer)},volume=0[at${i}]`)
      } else {
        teile.push(`[vs${i}]trim=start=${z(st.a)}:end=${z(st.b)},setpts=(PTS-STARTPTS)/${st.faktor}[vt${i}]`)
        if (o.audio) teile.push(`[as${i}]atrim=start=${z(st.a)}:end=${z(st.b)},asetpts=PTS-STARTPTS,${atempoKette(st.faktor)}[at${i}]`)
      }
    })
    teile.push(`${zl.stuecke.map((_, i) => `[vt${i}]${o.audio ? `[at${i}]` : ''}`).join('')}concat=n=${n}:v=1:a=${o.audio ? 1 : 0}[vz]${o.audio ? '[az]' : ''}`)
    v = 'vz'
    a = o.audio ? 'az' : a
  }
  const kette: string[] = []
  // 2. Zoom und Wackeln: ein scale+crop mit Ausdrücken über die Endzeit
  const zooms = [
    ...o.autoZooms.map((b) => ({ a: E(b.start), b: E(b.ende), f: 1.12, x: 0.5, y: 0.5 })),
    ...o.effekte.filter((e): e is Extract<Effekt, { art: 'zoom' }> => e.art === 'zoom').map((e) => ({ a: E(e.von), b: E(e.bis), f: klemme(e.faktor, 1, 4), x: klemme(e.x ?? 0.5, 0, 1), y: klemme(e.y ?? 0.5, 0, 1) }))
  ]
  const wackeln = o.effekte.filter((e): e is Extract<Effekt, { art: 'wackeln' }> => e.art === 'wackeln').map((e) => ({ a: E(e.von), b: E(e.bis), s: klemme(e.staerke ?? 0.5, 0.1, 1) * o.breite * 0.02 }))
  if (zooms.length || wackeln.length) {
    const gewicht = zooms.map((q) => `(${z(q.f - 1)})*${rampe(q.a, q.b, Math.min(0.35, (q.b - q.a) / 3))}`)
    const rand = wackeln.map((w) => `${z((2 * w.s) / o.breite)}*${zwischen(w.a, w.b)}`)
    const faktor = `1+${[...gewicht, ...rand].join('+')}`
    const summe = zooms.length ? `min(1\\,${zooms.map((q) => rampe(q.a, q.b, Math.min(0.35, (q.b - q.a) / 3))).join('+')})` : '0'
    const lage = (k: 'x' | 'y'): string => (zooms.length ? `(${zooms.map((q) => `${z(q[k] - 0.5)}*${rampe(q.a, q.b, Math.min(0.35, (q.b - q.a) / 3))}`).join('+')})` : '0')
    const zitter = (k: 'x' | 'y'): string => (wackeln.length ? `+${wackeln.map((w, i) => `${z(w.s)}*${k === 'x' ? 'sin' : 'cos'}(t*${47 + i * 7})*${zwischen(w.a, w.b)}`).join('+')}` : '')
    kette.push(`scale=w='iw*(${faktor})':h=-2:eval=frame`)
    kette.push(`crop=${o.breite}:${o.hoehe}:x='clip((in_w-out_w)*(0.5+${lage('x')}/max(0.001\\,${summe}))${zitter('x')}\\,0\\,in_w-out_w)':y='clip((in_h-out_h)*(0.5+${lage('y')}/max(0.001\\,${summe}))${zitter('y')}\\,0\\,in_h-out_h)'`)
  }
  // 3. Farbe: je Bereich eigene Filter mit enable
  for (const e of o.effekte) {
    if (e.art !== 'farbe') continue
    const en = `enable='${zwischen(E(e.von), E(e.bis))}'`
    if (e.saettigung !== undefined || e.kontrast !== undefined || e.helligkeit !== undefined)
      kette.push(`eq=saturation=${z(klemme(e.saettigung ?? 1, 0, 3))}:contrast=${z(klemme(e.kontrast ?? 1, 0.3, 2.5))}:brightness=${z(klemme(e.helligkeit ?? 0, -0.6, 0.6))}:${en}`)
    if (e.schwarzweiss) kette.push(`hue=s=0:${en}`)
    // Ton auf Schatten, Mitteltöne und Lichter (nur Schatten wäre kaum sichtbar)
    const ton3 = (r: number, g: number, b: number): string => ['s', 'm', 'h'].map((k) => `r${k}=${r}:g${k}=${g}:b${k}=${b}`).join(':')
    const toene: Record<string, string> = { warm: ton3(0.12, 0.02, -0.12), kalt: ton3(-0.12, 0, 0.14), rot: ton3(0.3, -0.12, -0.12), gruen: ton3(-0.1, 0.25, -0.1), blau: ton3(-0.1, -0.05, 0.3) }
    const ton = e.ton ? toene[e.ton] : undefined
    if (ton) kette.push(`colorbalance=${ton}:${en}`)
  }
  // 4. Blitz und Übergänge: Helligkeit rauf (weiß) oder runter (schwarz), weich ein und aus
  const hell = o.effekte
    .filter((e): e is Extract<Effekt, { art: 'blitz' | 'uebergang' }> => e.art === 'blitz' || e.art === 'uebergang')
    .map((e) => {
      const d = klemme(e.dauer ?? (e.art === 'blitz' ? 0.25 : 0.6), 0.05, 3)
      const m = E(e.bei)
      const vz = (e.farbe ?? (e.art === 'blitz' ? 'weiss' : 'schwarz')) === 'weiss' ? 1 : -1
      return `${vz}*max(0\\,1-abs(t-${z(m)})/${z(d / 2)})`
    })
  if (hell.length) kette.push(`eq=brightness='${hell.join('+')}':eval=frame`)
  // 5. Zensur: Unschärfe
  for (const e of o.effekte) if (e.art === 'zensur') kette.push(`boxblur=20:5:enable='${zwischen(E(e.von), E(e.bis))}'`)
  // 6. Untertitel (Zeiten sind beim Schreiben schon auf die Endzeit umgerechnet)
  if (o.untertitel) kette.push(`subtitles=${o.untertitel}`)
  teile.push(`[${v}]${kette.length ? kette.join(',') : 'null'}[vf]`)
  v = 'vf'
  // 7. Text und Bilder als Einblendungen
  o.effekte.forEach((e, i) => {
    if (e.art !== 'text' && e.art !== 'bild') return
    const tb = e.art === 'text' ? o.textBilder[i] : null
    const datei = e.art === 'text' ? tb?.datei : e.datei
    if (!datei) return
    const von = E(e.von)
    const bis = Math.max(von + 0.2, E(e.bis))
    const idx = eingaben.length + 1
    eingaben.push({ vor: ['-loop', '1', '-framerate', String(o.fps), '-t', z(bis + 0.1)], datei })
    // Größe: Text als Anteil der Bildhöhe je Zeile, Bild als Anteil der Breite
    const breite = e.art === 'text' ? Math.round(o.hoehe * klemme(e.groesse ?? 0.12, 0.04, 0.4) * ((tb?.breite ?? 1) / Math.max(1, (tb?.hoehe ?? 1) / Math.max(1, e.text.split('\n').length)))) : Math.round(o.breite * klemme(e.groesse ?? 0.3, 0.05, 1))
    const pop = e.art === 'text' && (e.animation ?? 'pop') === 'pop' ? `*(0.55+0.45*min(1\\,max(0\\,(t-${z(von)})/0.12)))` : ''
    const lage = e.lage ?? (e.art === 'text' ? 'oben' : 'rechts')
    const x = lage === 'links' ? 'W*0.05' : lage === 'rechts' ? 'W*0.95-w' : '(W-w)/2'
    const y = lage === 'oben' ? 'H*0.08' : lage === 'unten' ? 'H*0.78-h' : '(H-h)/2'
    teile.push(`[${idx}:v]format=rgba,scale=w='${Math.min(o.breite, breite)}${pop}':h=-1:eval=frame,fade=t=in:st=${z(von)}:d=0.1:alpha=1,fade=t=out:st=${z(bis - 0.15)}:d=0.15:alpha=1[ov${i}]`)
    teile.push(`[${v}][ov${i}]overlay=x='${x}':y='${y}':enable='${zwischen(von, bis)}':eof_action=pass[vo${i}]`)
    v = `vo${i}`
  })
  teile.push(`[${v}]format=yuv420p[v]`)
  // 8. Ton: Lautstärke, Zensur-Stille, Geräusche dazumischen
  if (o.audio) {
    const lauter = o.effekte
      .filter((e): e is Extract<Effekt, { art: 'lautstaerke' | 'zensur' }> => e.art === 'lautstaerke' || e.art === 'zensur')
      .map((e) => `volume=${e.art === 'zensur' ? 0 : z(klemme(e.faktor, 0, 4))}:enable='${zwischen(E(e.von), E(e.bis))}'`)
    const geraeusche = o.effekte
      .map((e, i) => ({ e, i }))
      .filter((x): x is { e: Extract<Effekt, { art: 'geraeusch' }>; i: number } => x.e.art === 'geraeusch' && !!o.klaenge[x.e.klang])
    // Zensur bekommt automatisch ein Piep
    const piepe = o.effekte.filter((e): e is Extract<Effekt, { art: 'zensur' }> => e.art === 'zensur' && !!o.klaenge['piep'])
    teile.push(`[${a}]${lauter.length ? lauter.join(',') : 'anull'}[al]`)
    const mix: string[] = ['[al]']
    for (const { e, i } of geraeusche) {
      const idx = eingaben.length + 1
      eingaben.push({ vor: [], datei: o.klaenge[e.klang]! })
      const ms = Math.round(E(e.bei) * 1000)
      teile.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}:all=1,volume=${z(klemme(e.lautstaerke ?? 1, 0, 3))}[g${i}]`)
      mix.push(`[g${i}]`)
    }
    piepe.forEach((e, j) => {
      const idx = eingaben.length + 1
      eingaben.push({ vor: ['-stream_loop', '-1', '-t', z(Math.max(0.1, E(e.bis) - E(e.von)))], datei: o.klaenge['piep']! })
      teile.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(E(e.von) * 1000)}:all=1[p${j}]`)
      mix.push(`[p${j}]`)
    })
    teile.push(mix.length > 1 ? `${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first[a]` : '[al]anull[a]')
  }
  return { graph: teile.join(';\n'), eingaben, laenge: zl.laenge, endzeit: E }
}

/** Prüft eine Effektliste (von Claude oder aus der Datei): unbekannte Arten und unmögliche Werte fliegen raus. */
export function pruefeEffekte(roh: unknown, laenge: number): { effekte: Effekt[]; fehler: string[] } {
  const effekte: Effekt[] = []
  const fehler: string[] = []
  for (const [i, x] of (Array.isArray(roh) ? roh : []).entries()) {
    const e = x as Record<string, unknown>
    const art = String(e?.['art'] ?? '')
    if (!(EFFEKT_ARTEN as readonly string[]).includes(art)) {
      fehler.push(`Effekt ${i + 1}: unbekannte Art „${art}“`)
      continue
    }
    const zeit = (k: string): number | null => (typeof e[k] === 'number' && Number.isFinite(e[k]) ? klemme(e[k] as number, 0, laenge) : null)
    const bereich = 'von' in e ? [zeit('von'), zeit('bis')] : null
    if (bereich && (bereich[0] === null || bereich[1] === null || bereich[1]! <= bereich[0]!)) {
      fehler.push(`Effekt ${i + 1} (${art}): ungültiger Bereich`)
      continue
    }
    if ('bei' in e && zeit('bei') === null) {
      fehler.push(`Effekt ${i + 1} (${art}): ungültige Zeit`)
      continue
    }
    if (art === 'text' && !String(e['text'] ?? '').trim()) {
      fehler.push(`Effekt ${i + 1}: Text fehlt`)
      continue
    }
    effekte.push({ ...(e as object), ...(bereich ? { von: bereich[0]!, bis: bereich[1]! } : {}), ...('bei' in e ? { bei: zeit('bei')! } : {}) } as Effekt)
  }
  return { effekte, fehler }
}
