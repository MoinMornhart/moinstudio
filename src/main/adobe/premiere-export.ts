import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExportErgebnis } from '../schnitt/export'
import { ladeProjekt, projektOrdner } from '../schnitt/projekt'
import { sauber, untertitelGruppen, zoomsAus } from '../schnitt/render'
import type { Schnittliste } from '../schnitt/rohschnitt'
import { liesAbschnitte } from '../schnitt/transkript'
import { einstellungen } from '../schnitt/vorschau'
import { premiereXml, srt } from './premiere'
import { liesMitKonfliktkopien } from '../data/jsonfile'
import { effekteInSchnittzeit } from '../schnitt/effekte'
import { ladeEffekte } from '../schnitt/effekt-vorbereitung'
import { sichererName, videoName } from '../dateinamen'

/** Breite und Höhe aus dem PNG-Kopf (IHDR); null, wenn es kein PNG ist */
export function pngGroesse(b: Buffer): { breite: number; hoehe: number } | null {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null
  return { breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) }
}

/** Schreibt Sequenz (FCP7-XML) und Untertitel (SRT) eines Schnitt-Projekts nach <Projekt>/premiere/ (ROADMAP 8.3). */
export async function premiereDateien(daten: string, id: string): Promise<{ xml: string; srt: string | null }> {
  const p = await ladeProjekt(daten, id)
  if (!p?.quelle || !p.rohschnitt) throw new Error('Erst Import und Rohschnitt abwarten.')
  const ordner = projektOrdner(daten, p.id)
  const liste = JSON.parse(await liesMitKonfliktkopien(join(ordner, 'schnitt.json'))) as Schnittliste
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  const wellen = p.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }) : null
  const exp = p.export ? (JSON.parse(await readFile(join(ordner, 'export.json'), 'utf8').catch(() => 'null')) as ExportErgebnis | null) : null
  // Name des Videos, ohne Emojis und verbotene Zeichen: Dateiname und Sequenzname müssen überall funktionieren
  const name = sichererName(videoName({ name: p.name, quelle: p.quelle.pfad }))
  const ziel = join(ordner, 'premiere')
  await mkdir(ziel, { recursive: true })
  const xml = join(ziel, `${name}.xml`)
  // Effekte (ROADMAP E.6) in Schnittzeit; Text-Bilder aus der letzten Vorschau, wenn sie nicht älter als die Effekte sind
  const effekte = effekteInSchnittzeit(await ladeEffekte(ordner, liste.dauer), liste.behalten)
  const stand = (await stat(join(ordner, 'effekte.json')).catch(() => null))?.mtimeMs ?? 0
  const textBilder: Record<string, { datei: string; breite: number; hoehe: number }> = {}
  for (const [i, e] of effekte.entries()) {
    if (e.art !== 'text') continue
    const datei = join(ordner, 'effekte', `text${i}.png`)
    const info = await stat(datei).catch(() => null)
    const groesse = info && info.mtimeMs >= stand ? pngGroesse(await readFile(datei)) : null
    if (groesse) textBilder[String(i)] = { datei, ...groesse }
  }
  await writeFile(xml, premiereXml({ name, quelle: p.quelle, liste, zooms: einstellungen(p).zooms ? zoomsAus(abschnitte, liste, wellen) : [], kapitel: exp?.kapitel ?? [], effekte, textBilder }))
  const zeilen = untertitelGruppen(abschnitte, liste, 7).map((g) => ({ start: g.start, ende: g.ende, text: g.woerter.map((w) => sauber(w.wort)).join(' ') }))
  let srtPfad: string | null = null
  if (zeilen.length) {
    srtPfad = join(ziel, `${name}.srt`)
    await writeFile(srtPfad, srt(zeilen))
  }
  return { xml, srt: srtPfad }
}
