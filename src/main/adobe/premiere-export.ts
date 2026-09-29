import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExportErgebnis } from '../schnitt/export'
import { ladeProjekt, projektOrdner } from '../schnitt/projekt'
import { sauber, untertitelGruppen, zoomsAus } from '../schnitt/render'
import type { Schnittliste } from '../schnitt/rohschnitt'
import { liesAbschnitte } from '../schnitt/transkript'
import { einstellungen } from '../schnitt/vorschau'
import { premiereXml, srt } from './premiere'

/** Schreibt Sequenz (FCP7-XML) und Untertitel (SRT) eines Schnitt-Projekts nach <Projekt>/premiere/ (ROADMAP 8.3). */
export async function premiereDateien(daten: string, id: string): Promise<{ xml: string; srt: string | null }> {
  const p = await ladeProjekt(daten, id)
  if (!p?.quelle || !p.rohschnitt) throw new Error('Erst Import und Rohschnitt abwarten.')
  const ordner = projektOrdner(daten, p.id)
  const liste = JSON.parse(await readFile(join(ordner, 'schnitt.json'), 'utf8')) as Schnittliste
  const abschnitte = liesAbschnitte(await readFile(join(ordner, 'transkript.jsonl'), 'utf8').catch(() => ''))
  const wellen = p.wellenform ? (JSON.parse(await readFile(join(ordner, 'wellenform.json'), 'utf8')) as { aufloesung: number; werte: number[] }) : null
  const exp = p.export ? (JSON.parse(await readFile(join(ordner, 'export.json'), 'utf8').catch(() => 'null')) as ExportErgebnis | null) : null
  // ohne Emojis und verbotene Zeichen: Dateiname und Sequenzname müssen überall funktionieren
  const name =
    (exp?.titel[0] ?? p.name)
      .replace(/\p{Extended_Pictographic}|️|[\\/:*?"<>|]/gu, '')
      .replace(/\s+/g, ' ')
      .trim() || p.id
  const ziel = join(ordner, 'premiere')
  await mkdir(ziel, { recursive: true })
  const xml = join(ziel, `${name}.xml`)
  await writeFile(xml, premiereXml({ name, quelle: p.quelle, liste, zooms: einstellungen(p).zooms ? zoomsAus(abschnitte, liste, wellen) : [], kapitel: exp?.kapitel ?? [] }))
  const zeilen = untertitelGruppen(abschnitte, liste, 7).map((g) => ({ start: g.start, ende: g.ende, text: g.woerter.map((w) => sauber(w.wort)).join(' ') }))
  let srtPfad: string | null = null
  if (zeilen.length) {
    srtPfad = join(ziel, `${name}.srt`)
    await writeFile(srtPfad, srt(zeilen))
  }
  return { xml, srt: srtPfad }
}
