import { basename } from 'node:path'
import type { Bereich, Schnittliste } from '../schnitt/rohschnitt'
import { sauber, zeitAbbildung } from '../schnitt/render'

/**
 * Premiere (ROADMAP 8.3, ungetestet): der Schnitt als FCP7-XML (xmeml Version 5). Premiere übernimmt daraus Schnitte,
 * Spuren, Sequenz-Marker und Bewegungs-Keyframes (docs/research/adobe.md §5). Die Clips zeigen auf das Original, nicht
 * auf die Vorschau. Zooms werden wie im Render (1,12-fach, 0,35 s Rampe) zu Keyframes des Effekts „Basic Motion“.
 */

export interface PremiereQuelle {
  pfad: string
  dauer: number
  breite: number
  hoehe: number
  fps: number
  audio: boolean
}

export interface PremiereOptionen {
  name: string
  quelle: PremiereQuelle
  liste: Schnittliste
  /** Zeiten im geschnittenen Video */
  zooms: Bereich[]
  /** Kapitel (Zeit im geschnittenen Video) → Sequenz-Marker */
  kapitel: { zeit: number; titel: string }[]
}

export const ZOOM = { faktor: 1.12, rampe: 0.35 } as const

/** Zeitbasis wie in FCP7: 29,97 → 30 mit NTSC, 25 → 25 ohne. */
export function zeitbasis(fps: number): { timebase: number; ntsc: boolean; echt: number } {
  const rund = Math.round(fps)
  const ntsc = Math.abs(fps - (rund * 1000) / 1001) < 0.01 && Math.abs(fps - rund) > 0.01
  return { timebase: rund || 30, ntsc, echt: ntsc ? (rund * 1000) / 1001 : rund || 30 }
}

/** Datei-URL für Premiere: file://localhost/C:/Ordner/Datei%20mit%20Leerzeichen.mp4 */
export function dateiUrl(pfad: string): string {
  const teile = pfad.replace(/\\/g, '/').split('/')
  return `file://localhost/${teile.map((t, i) => (i === 0 && /^[A-Za-z]:$/.test(t) ? t : encodeURIComponent(t))).join('/')}`
}

const x = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Zoomfaktor zur Zeit t im geschnittenen Video (gleiche Formel wie der FFmpeg-Render) */
export function zoomBei(zooms: Bereich[], t: number): number {
  const summe = zooms.reduce((s, z) => s + Math.min(1, Math.max(0, (t - z.start) / ZOOM.rampe)) * Math.min(1, Math.max(0, (z.ende - t) / ZOOM.rampe)), 0)
  return 1 + (ZOOM.faktor - 1) * summe
}

/** Keyframes (Zeit im Schnitt, Skalierung in Prozent) für einen Clip von a bis b; leer, wenn kein Zoom hineinfällt. */
export function zoomKeyframes(zooms: Bereich[], a: number, b: number): { t: number; wert: number }[] {
  const rein = zooms.filter((z) => z.ende > a && z.start < b)
  if (!rein.length) return []
  const punkte = new Set<number>([a, b])
  for (const z of rein) for (const t of [z.start, z.start + ZOOM.rampe, z.ende - ZOOM.rampe, z.ende]) if (t > a && t < b) punkte.add(t)
  return [...punkte].sort((p, q) => p - q).map((t) => ({ t, wert: Math.round(zoomBei(zooms, t) * 1000) / 10 }))
}

function rate(zb: ReturnType<typeof zeitbasis>): string {
  return `<rate><timebase>${zb.timebase}</timebase><ntsc>${zb.ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`
}

export function premiereXml(o: PremiereOptionen): string {
  const zb = zeitbasis(o.quelle.fps)
  const f = (s: number): number => Math.round(s * zb.echt)
  const quelleFrames = f(o.quelle.dauer)
  const { laenge } = zeitAbbildung(o.liste.behalten)
  const dateiName = basename(o.quelle.pfad)
  const dateiVoll = `<file id="file-1"><name>${x(dateiName)}</name><pathurl>${x(dateiUrl(o.quelle.pfad))}</pathurl>${rate(zb)}<duration>${quelleFrames}</duration><media><video><samplecharacteristics>${rate(zb)}<width>${o.quelle.breite}</width><height>${o.quelle.hoehe}</height><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></video>${o.quelle.audio ? '<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>2</channelcount></audio>' : ''}</media></file>`

  // Stücke auf der Zeitleiste: Start im Schnitt aus aufsummierten Frames, damit keine Lücken durch Rundung entstehen
  let pos = 0
  const stuecke = o.liste.behalten.map((b, i) => {
    const inF = f(b.start)
    const outF = Math.max(inF + 1, f(b.ende))
    const start = pos
    pos += outF - inF
    const schnittStart = zeitAbbildung(o.liste.behalten.slice(0, i)).laenge
    return { i: i + 1, inF, outF, start, ende: pos, a: schnittStart, b: schnittStart + (b.ende - b.start) }
  })

  const video = stuecke
    .map((s) => {
      const kf = zoomKeyframes(o.zooms, s.a, s.b)
      // Keyframe-Zeiten in Frames der Quelle (relativ zum Medienanfang, wie in/out)
      const filter = kf.length
        ? `<filter><effect><name>Basic Motion</name><effectid>basic</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter authoringApp="PremierePro"><parameterid>scale</parameterid><name>Scale</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>100</value>${kf.map((k) => `<keyframe><when>${s.inF + f(k.t - s.a)}</when><value>${k.wert}</value></keyframe>`).join('')}</parameter></effect></filter>`
        : ''
      const links = o.quelle.audio ? `<link><linkclipref>clipitem-v${s.i}</linkclipref><mediatype>video</mediatype><trackindex>1</trackindex><clipindex>${s.i}</clipindex></link><link><linkclipref>clipitem-a${s.i}</linkclipref><mediatype>audio</mediatype><trackindex>1</trackindex><clipindex>${s.i}</clipindex></link>` : ''
      return `<clipitem id="clipitem-v${s.i}"><name>${x(dateiName)}</name><enabled>TRUE</enabled><duration>${quelleFrames}</duration>${rate(zb)}<start>${s.start}</start><end>${s.ende}</end><in>${s.inF}</in><out>${s.outF}</out>${s.i === 1 ? dateiVoll : '<file id="file-1"/>'}${filter}${links}</clipitem>`
    })
    .join('')
  const audio = o.quelle.audio
    ? `<audio><numOutputChannels>2</numOutputChannels><format><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></format><track>${stuecke
        .map(
          (s) =>
            `<clipitem id="clipitem-a${s.i}"><name>${x(dateiName)}</name><enabled>TRUE</enabled><duration>${quelleFrames}</duration>${rate(zb)}<start>${s.start}</start><end>${s.ende}</end><in>${s.inF}</in><out>${s.outF}</out><file id="file-1"/><sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack><link><linkclipref>clipitem-v${s.i}</linkclipref><mediatype>video</mediatype><trackindex>1</trackindex><clipindex>${s.i}</clipindex></link><link><linkclipref>clipitem-a${s.i}</linkclipref><mediatype>audio</mediatype><trackindex>1</trackindex><clipindex>${s.i}</clipindex></link></clipitem>`
        )
        .join('')}</track></audio>`
    : ''
  const marker = o.kapitel
    .filter((k) => k.zeit >= 0 && k.zeit <= laenge)
    .map((k) => `<marker><name>${x(sauber(k.titel))}</name><comment>Kapitel</comment><in>${f(k.zeit)}</in><out>-1</out></marker>`)
    .join('')
  const format = `<format><samplecharacteristics>${rate(zb)}<width>${o.quelle.breite}</width><height>${o.quelle.hoehe}</height><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5"><sequence id="sequence-1"><name>${x(o.name)}</name><duration>${pos}</duration>${rate(zb)}<timecode>${rate(zb)}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode><media><video>${format}<track>${video}</track></video>${audio}</media>${marker}</sequence></xmeml>
`
}

const srtZeit = (s: number): string => {
  const ms = Math.round(s * 1000)
  const z = (n: number, l = 2): string => String(n).padStart(l, '0')
  return `${z(Math.floor(ms / 3_600_000))}:${z(Math.floor(ms / 60_000) % 60)}:${z(Math.floor(ms / 1000) % 60)},${z(ms % 1000, 3)}`
}

/** Untertitel als SRT (Zeiten im geschnittenen Video), in Premiere als Untertitelspur importierbar */
export function srt(zeilen: { start: number; ende: number; text: string }[]): string {
  return zeilen.map((z, i) => `${i + 1}\n${srtZeit(z.start)} --> ${srtZeit(z.ende)}\n${z.text}\n`).join('\n')
}
