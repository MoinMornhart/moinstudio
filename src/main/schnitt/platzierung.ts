import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runClaudeInJob } from '../claude/run'
import type { JobContext } from '../jobs/queue'
import { liesMitKonfliktkopien, writeJsonAtomic } from '../data/jsonfile'
import { bibVerweis, ladeBibliothek, type BibEffekt } from './bibliothek'
import { pruefeEffekte, zuSchnittzeit, type Effekt } from './effekte'
import { lauteMomente } from './highlights'
import { ladeProjekt, projektOrdner } from './projekt'
import type { Bereich, Schnittliste } from './rohschnitt'
import { liesAbschnitte, type Abschnitt } from './transkript'
import type { VideoTyp } from './regeln'

/**
 * Effekte aus der Bibliothek automatisch setzen (Philip, 05.10.). Nach dem Rohschnitt entscheidet jeder Effekt nach
 * seinen Knöpfen, ob er in dieses Video gehört (Kanal, Typ, Häufigkeit), und wohin: fester Zeitpunkt oder „KI
 * entscheidet“. Die KI hält sich an feste Grenzen: nicht im Hook, nicht auf Höhepunkten, nie zwei Effekte gleichzeitig,
 * nicht zu dicht hintereinander. Antwortet Claude nicht oder falsch, verteilt eine Regel die Effekte.
 */

/** Hook: in den ersten Sekunden des fertigen Videos kein Bibliotheks-Effekt */
export const HOOK = 15
/** Mindestabstand zwischen zwei automatisch gesetzten Bibliotheks-Effekten (fertiges Video) */
export const ABSTAND = 20
/** Rund um laute Momente (Höhepunkte) frei lassen */
const HOEHEPUNKT_PUFFER = 3

/** Wie lange ein Bibliotheks-Effekt sichtbar/hörbar ist */
export function bibDauer(e: BibEffekt): number {
  return Math.max(e.video?.dauer ?? 0, e.bild?.dauer ?? 0, e.sound?.dauer ?? 0) || 3
}

/** Schnittzeit → Originalzeit (Gegenstück zu zuSchnittzeit) */
export function zuOriginalzeit(t: number, behalten: Bereich[]): number | null {
  let vorher = 0
  for (const b of behalten) {
    const l = b.ende - b.start
    if (t <= vorher + l) return b.start + Math.max(0, t - vorher)
    vorher += l
  }
  return null
}

/** Kleine, stabile Zahl aus einer Projekt-ID (für „X % der Videos“: dasselbe Video entscheidet immer gleich) */
function streuwert(id: string): number {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) % 100
}

/** Gehört der Effekt in dieses Video? `nr` = wie vielte passende Video (0, 1, 2 …) für „jedes n-te“. */
export function gehoertRein(e: BibEffekt, kanal: string, typ: VideoTyp | undefined, projektId: string, nr: number): boolean {
  if (!e.kanaele.includes(kanal)) return false
  if (typ && !e.typen.includes(typ)) return false
  const h = e.haeufigkeit
  if (h.modus === 'immer') return true
  if (h.modus === 'manuell') return false
  if (h.prozent) return streuwert(projektId) < h.prozent
  return nr % Math.max(2, h.jedes ?? 3) === 0
}

/** Bibliotheks-Effekt an Stelle `bei` (Originalzeit) als Bausteine für die Effektliste */
export function bibBausteine(e: BibEffekt, bei: number, auto: boolean): Effekt[] {
  const bib = { id: e.id, name: e.name, ...(auto ? { auto: true } : {}) }
  const groesse = e.lage === 'voll' ? 1 : e.groesse
  const aus: Effekt[] = []
  if (e.video) aus.push({ art: 'video', bei, datei: bibVerweis(e.id, e.video.datei), lage: e.lage, groesse, ton: e.video.ton, ...(e.chroma ? { chroma: e.chroma } : {}), bib })
  else if (e.bild) aus.push({ art: 'bild', von: bei, bis: bei + e.bild.dauer, datei: bibVerweis(e.id, e.bild.datei), lage: e.lage, groesse, bib })
  // Bild zusätzlich zum Video ergibt keinen Sinn im Bild – dann zählt das Video; der Sound läuft immer mit
  if (e.sound) aus.push({ art: 'geraeusch', bei, klang: bibVerweis(e.id, e.sound.datei), lautstaerke: e.sound.lautstaerke, bib })
  return aus
}

/** Belegte Bereiche im fertigen Video (Schnittzeit) aus vorhandenen Effekten mit Bild oder Ton */
function belegt(effekte: Effekt[], behalten: Bereich[]): { von: number; bis: number }[] {
  const aus: { von: number; bis: number }[] = []
  for (const e of effekte) {
    if (e.art === 'video' || e.art === 'geraeusch' || e.art === 'bild') {
      const von = zuSchnittzeit('von' in e ? e.von : e.bei, behalten, 'anfang')
      if (von === null) continue
      const bis = 'bis' in e ? (zuSchnittzeit(e.bis, behalten, 'ende') ?? von + 1) : von + (e.art === 'video' ? 3 : 1)
      aus.push({ von, bis })
    }
  }
  return aus
}

export interface Platz {
  id: string
  /** Schnittzeit (fertiges Video) */
  bei: number
}

/**
 * Prüft einen Platz gegen die Grenzen. `frei` = schon belegte Bereiche (Schnittzeit), `laut` = Höhepunkte (Schnittzeit).
 * Bibliotheks-Effekte halten Abstand zueinander, alle Effekte überschneiden sich nicht.
 */
export function platzOk(bei: number, dauer: number, o: { laenge: number; belegt: { von: number; bis: number }[]; bib: number[]; laut: number[] }): boolean {
  if (bei < HOOK || bei + dauer > o.laenge - 1) return false
  if (o.belegt.some((b) => bei < b.bis + 0.5 && bei + dauer > b.von - 0.5)) return false
  if (o.bib.some((t) => Math.abs(t - bei) < ABSTAND)) return false
  if (o.laut.some((t) => t > bei - HOEHEPUNKT_PUFFER && t < bei + dauer + HOEHEPUNKT_PUFFER)) return false
  return true
}

/**
 * Regel-Verteilung (ohne Claude oder als Rettung): Kandidaten sind Satzenden im fertigen Video; jeder Effekt bekommt den
 * freien Kandidaten, der seinem Zielpunkt am nächsten liegt (gleichmäßig verteilt, nicht vor 30 s).
 */
export function regelPlaetze(effekte: { id: string; dauer: number }[], o: { laenge: number; satzenden: number[]; belegt: { von: number; bis: number }[]; laut: number[]; bib?: number[] }): Platz[] {
  const bib = [...(o.bib ?? [])]
  const belegt = [...o.belegt]
  const kandidaten = o.satzenden.length ? o.satzenden : Array.from({ length: Math.floor(o.laenge / 5) }, (_, i) => i * 5)
  const plaetze: Platz[] = []
  effekte.forEach((e, k) => {
    const ziel = Math.max(30, (o.laenge * (k + 1)) / (effekte.length + 1))
    const passend = kandidaten.filter((t) => platzOk(t, e.dauer, { laenge: o.laenge, belegt, bib, laut: o.laut })).sort((a, b) => Math.abs(a - ziel) - Math.abs(b - ziel))
    const t = passend[0]
    if (t === undefined) return
    plaetze.push({ id: e.id, bei: t })
    bib.push(t)
    belegt.push({ von: t, bis: t + e.dauer })
  })
  return plaetze
}

const SCHEMA = {
  type: 'object',
  required: ['plaetze'],
  properties: { plaetze: { type: 'array', items: { type: 'object', required: ['id', 'bei'], properties: { id: { type: 'string' }, bei: { type: 'number' }, warum: { type: 'string' } } } } }
} as const

export function platzPrompt(o: {
  kanal: string
  typ?: VideoTyp
  laenge: number
  effekte: { id: string; name: string; dauer: number; art: string }[]
  saetze: { bei: number; text: string }[]
  laut: number[]
  belegt: { von: number; bis: number }[]
}): string {
  const t = (s: number): string => s.toFixed(1)
  return `Philip schneidet ein ${o.typ === 'reaction' ? 'Reaction' : 'Gaming'}-Video für seinen Kanal ${o.kanal}. Das fertige Video ist ${t(o.laenge)} s lang.
Setze diese Effekte aus seiner Bibliothek an gute Stellen (Zeiten = Sekunden im fertigen Video):
${o.effekte.map((e) => `- id ${e.id}: „${e.name}“ (${e.art}, ${t(e.dauer)} s)`).join('\n')}

Feste Grenzen:
- nicht in den ersten ${HOOK} s (Hook) und nicht in der letzten Sekunde
- nicht auf Höhepunkten (laute Momente ±${HOEHEPUNKT_PUFFER} s): ${o.laut.map(t).join(', ') || 'keine'}
- nie gleichzeitig mit einem anderen Effekt; schon belegt: ${o.belegt.map((b) => `${t(b.von)}–${t(b.bis)}`).join(', ') || 'nichts'}
- mindestens ${ABSTAND} s Abstand zwischen diesen Effekten
- am besten in einer kurzen Sprechpause nach einem abgeschlossenen Gedanken, nie mitten in einer Pointe
- passend zum Namen: eine Abo-/Like-Animation nach dem ersten Höhepunkt (30–90 s) oder kurz vor dem Ende, ein
  Meme-Sound direkt nach einer passenden Aussage, ein Übergang an einem Themenwechsel
- passt ein Effekt nirgends, lass ihn weg

Gesprochene Sätze (Ende im fertigen Video):
${o.saetze.map((s) => `[${t(s.bei)}] ${s.text}`).join('\n') || '(kein Transkript)'}

Antworte nur mit JSON nach dem Schema: plaetze = [{id, bei, warum}].`
}

export interface VerteilPayload {
  daten: string
  projekt: string
  claudeCli: string | null
}

/** Satzenden in Schnittzeit (nur Sätze, die im Video bleiben) */
function satzendenImSchnitt(abschnitte: Abschnitt[], behalten: Bereich[]): { bei: number; text: string }[] {
  return abschnitte
    .map((a) => ({ bei: zuSchnittzeit(a.ende, behalten, 'ende'), text: a.text, drin: behalten.some((b) => a.ende >= b.start && a.ende <= b.ende) }))
    .filter((s): s is { bei: number; text: string; drin: boolean } => s.drin && s.bei !== null)
    .map(({ bei, text }) => ({ bei: bei + 0.15, text }))
}

/**
 * Auftrag: Bibliotheks-Effekte in ein Projekt setzen. Vorher automatisch gesetzte (bib.auto) fliegen raus, von Hand oder
 * per Wunsch gesetzte bleiben. Zählt für „jedes n-te Video“ mit.
 */
export async function verteilJob(p: VerteilPayload, ctx: JobContext<{ claudeSession?: string; claudePrompted?: boolean }>): Promise<{ projekt: string; gesetzt: string[] }> {
  const pr = await ladeProjekt(p.daten, p.projekt)
  if (!pr) throw new Error('Projekt nicht gefunden.')
  const ordner = projektOrdner(p.daten, p.projekt)
  const liste = JSON.parse(await liesMitKonfliktkopien(join(ordner, 'schnitt.json'))) as Schnittliste
  const roh = JSON.parse(await liesMitKonfliktkopien(join(ordner, 'effekte.json')).catch(() => '[]')) as unknown
  const alle = pruefeEffekte(roh, liste.dauer).effekte
  const bleiben = alle.filter((e) => !('bib' in e && e.bib?.auto))
  const laenge = liste.behalten.reduce((s, b) => s + b.ende - b.start, 0)

  ctx.progress(10, 'Effekte aus der Bibliothek auswählen …')
  const bibliothek = await ladeBibliothek(p.daten)
  const gewaehlt: BibEffekt[] = []
  for (const e of bibliothek) {
    if (!e.kanaele.includes(pr.kanal) || (pr.typ && !e.typen.includes(pr.typ)) || e.haeufigkeit.modus === 'manuell') continue
    // Zähler je Effekt und Projekt nur einmal – ein neu verteiltes Projekt zählt nicht doppelt
    const gesehen = e.gesehen ?? []
    const nr = gesehen.includes(p.projekt) ? gesehen.indexOf(p.projekt) : gesehen.length
    if (gehoertRein(e, pr.kanal, pr.typ, p.projekt, nr)) gewaehlt.push(e)
    if (!gesehen.includes(p.projekt)) {
      const neu = { ...e, gesehen: [...gesehen, p.projekt].slice(-200), zaehler: (e.zaehler ?? 0) + (gehoertRein(e, pr.kanal, pr.typ, p.projekt, nr) ? 1 : 0) }
      await writeJsonAtomic(join(p.daten, 'effekte', e.id, 'effekt.json'), neu)
    }
  }

  const wellen = pr.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8').catch(() => 'null')) as { aufloesung: number; werte: number[] } | null) : null
  const laut = lauteMomente(wellen)
    .map((t) => zuSchnittzeit(t, liste.behalten, 'anfang'))
    .filter((t): t is number => t !== null)
  const saetze = satzendenImSchnitt(liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => '')), liste.behalten)
  const belegtListe = belegt(bleiben, liste.behalten)
  const neu: Effekt[] = []
  const bibZeiten: number[] = []
  const setze = (e: BibEffekt, schnittzeit: number): void => {
    const orig = zuOriginalzeit(schnittzeit, liste.behalten)
    if (orig === null) return
    neu.push(...bibBausteine(e, orig, true))
    bibZeiten.push(schnittzeit)
    belegtListe.push({ von: schnittzeit, bis: schnittzeit + bibDauer(e) })
  }

  // 1. feste Zeitpunkte (Philip hat es so gewollt – nur gegen Überschneidung prüfen; liegt dort schon etwas, rückt
  //    der Effekt direkt dahinter bzw. beim Bezug „Ende“ davor)
  for (const e of gewaehlt.filter((x) => x.platzierung.modus === 'fest')) {
    const s = e.platzierung.sekunden ?? 30
    const d = bibDauer(e)
    const vomEnde = e.platzierung.bezug === 'ende'
    let t = vomEnde ? laenge - s - d : s
    for (let i = 0; i < 20; i++) {
      const stoss = belegtListe.find((b) => t < b.bis + 0.3 && t + d > b.von - 0.3)
      if (!stoss) break
      t = vomEnde ? stoss.von - 0.3 - d : stoss.bis + 0.3
    }
    if (t >= 0 && t + 0.2 < laenge) setze(e, t)
  }
  // 2. KI entscheidet
  const ki = gewaehlt.filter((x) => x.platzierung.modus === 'ki')
  if (ki.length) {
    let plaetze: Platz[] = []
    if (p.claudeCli) {
      ctx.progress(40, 'Claude sucht gute Stellen für die Effekte …')
      const res = await runClaudeInJob(
        {
          cli: p.claudeCli,
          prompt: platzPrompt({
            kanal: pr.kanal,
            typ: pr.typ,
            laenge,
            effekte: ki.map((e) => ({ id: e.id, name: e.name, dauer: bibDauer(e), art: e.video ? (e.video.greenscreen ? 'Greenscreen-Video' : 'Video') : e.bild ? 'Bild' : 'Sound' })),
            saetze,
            laut,
            belegt: belegtListe
          }),
          workDir: join(p.daten, 'claude-work', 'schnitt'),
          tools: [],
          maxTurns: 2,
          jsonSchema: SCHEMA
        },
        ctx
      ).catch(() => null)
      if (res?.ok) {
        const a = (res.structured ?? JSON.parse(/\{[\s\S]*\}/.exec(res.text)?.[0] ?? '{}')) as { plaetze?: Platz[] }
        plaetze = a.plaetze ?? []
      }
    }
    // Claudes Vorschläge gegen die Grenzen prüfen; was nicht passt, setzt die Regel
    const offen: BibEffekt[] = []
    for (const e of ki) {
      const v = plaetze.find((x) => x.id === e.id && Number.isFinite(x.bei))
      if (v && platzOk(v.bei, bibDauer(e), { laenge, belegt: belegtListe, bib: bibZeiten, laut })) setze(e, v.bei)
      else offen.push(e)
    }
    for (const r of regelPlaetze(
      offen.map((e) => ({ id: e.id, dauer: bibDauer(e) })),
      { laenge, satzenden: saetze.map((s) => s.bei), belegt: belegtListe, laut, bib: bibZeiten }
    )) {
      const e = offen.find((x) => x.id === r.id)
      if (e) setze(e, r.bei)
    }
  }

  await writeFile(join(ordner, 'effekte.json'), JSON.stringify([...bleiben, ...neu], null, 1))
  const gesetzt = [...new Set(neu.flatMap((e) => ('bib' in e && e.bib ? [e.bib.name] : [])))]
  ctx.progress(100, gesetzt.length ? `Effekte gesetzt: ${gesetzt.join(', ')}` : 'Keine Bibliotheks-Effekte für dieses Video')
  return { projekt: p.projekt, gesetzt }
}

/**
 * „bib“-Bausteine aus Claudes Antwort (Wunsch in Worten, z. B. „Füge bei 2:14 den Vine-Boom ein“) in echte Effekte
 * umwandeln. Unbekannte Effekte fallen mit Fehlermeldung raus, damit Claude korrigieren kann.
 */
export function bibAufloesen(roh: unknown, bibliothek: BibEffekt[]): { effekte: unknown[]; fehler: string[] } {
  const effekte: unknown[] = []
  const fehler: string[] = []
  for (const x of Array.isArray(roh) ? roh : []) {
    const e = x as Record<string, unknown>
    if (e?.['art'] !== 'bib') {
      effekte.push(x)
      continue
    }
    const name = String(e['name'] ?? e['id'] ?? '')
    const b = bibliothek.find((y) => y.id === e['id']) ?? bibliothek.find((y) => y.name.toLowerCase() === name.toLowerCase())
    if (!b || typeof e['bei'] !== 'number') {
      fehler.push(`Bibliotheks-Effekt „${name}“ ${b ? 'ohne Zeit' : 'gibt es nicht'}`)
      continue
    }
    effekte.push(...bibBausteine(b, e['bei'], false))
  }
  return { effekte, fehler }
}

/** Beschreibung der Bibliothek für den Wunsch-Prompt */
export function bibText(bibliothek: BibEffekt[]): string {
  if (!bibliothek.length) return ''
  return `- bib {bei, id}: Effekt aus Philips Bibliothek einfügen (bringt Datei, Lage, Größe, Greenscreen-Einstellung und Ton selbst mit). Vorhanden:
${bibliothek.map((e) => `  - id ${e.id}: „${e.name}“ (${[e.video ? (e.video.greenscreen ? 'Greenscreen-Video' : 'Video') : null, e.bild ? 'Bild' : null, e.sound ? 'Sound' : null].filter(Boolean).join(' + ')}, ${bibDauer(e).toFixed(1)} s)`).join('\n')}
  Nennt Philip einen dieser Effekte beim Namen (auch ungefähr, z. B. „den Vine-Boom“, „die Abo-Animation“), nimm genau diesen.
  In der Liste „Aktuelle Effekte“ erscheinen eingefügte Bibliotheks-Effekte als video/bild/geraeusch mit „bib“ – lass sie so stehen.`
}
