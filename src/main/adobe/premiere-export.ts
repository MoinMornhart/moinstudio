import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
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

/**
 * Rohvideo für Premiere auf diesem Gerät finden (Philip, 02.10.: „Media offline“ auf dem Laptop). Die Sequenz verlinkte
 * den Pfad des PCs, auf dem das Video importiert wurde (z. B. C:\Projekte\…\sprache.mp4) – auf einem anderen Gerät
 * gibt es ihn nicht. Reihenfolge: Kopie im Projektordner (quelle/), Originalpfad, gleicher Name im Projektordner.
 * Liegt das Video außerhalb des Datenordners, wird es einmal in den Projektordner kopiert, damit es mit iCloud auf
 * jedes Gerät kommt. Gleiche Prüfsumme-Größe = dieselbe Datei.
 */
export async function quelleFuerPremiere(daten: string, ordner: string, pfad: string, groesse: number): Promise<string> {
  const kopie = join(ordner, 'quelle', `video${extname(pfad).toLowerCase() || '.mp4'}`)
  const passt = async (f: string): Promise<boolean> => (await stat(f).catch(() => null))?.size === groesse
  if (await passt(kopie)) return kopie
  // im Datenordner oder in einem geteilten Ordner (iCloud, OneDrive): auf jedem Gerät da – nicht kopieren
  const imDatenordner = !relative(resolve(daten), resolve(pfad)).startsWith('..') || /[\\/](icloud ?drive|onedrive[^\\/]*)[\\/]/i.test(pfad)
  if (existsSync(pfad) && (await passt(pfad))) {
    if (imDatenordner) return pfad
    await mkdir(join(ordner, 'quelle'), { recursive: true })
    await copyFile(pfad, `${kopie}.teil`)
    await rename(`${kopie}.teil`, kopie)
    return kopie
  }
  // Pfad eines anderen Geräts im selben (iCloud-)Datenordner: den Teil ab „schnitt/<id>“ hier anhängen
  const teile = pfad.replace(/\\/g, '/').split('/')
  const ab = teile.lastIndexOf('schnitt')
  if (ab >= 0) {
    const hier = join(daten, ...teile.slice(ab))
    if (await passt(hier)) return hier
  }
  const gleichNamig = join(ordner, basename(pfad))
  if (await passt(gleichNamig)) return gleichNamig
  throw new Error(
    `Das Rohvideo „${basename(pfad)}“ ist auf diesem Gerät nicht da (${pfad}). Exportiere die Premiere-Dateien einmal auf dem Gerät, auf dem das Video liegt – dann landet eine Kopie im iCloud-Ordner des Projekts.`
  )
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
  // Pfade für dieses Gerät: Rohvideo (notfalls als Kopie im Projekt), Textbilder aus dem eigenen Projektordner
  const quelle = { ...p.quelle, pfad: await quelleFuerPremiere(daten, ordner, p.quelle.pfad, p.quelle.groesse) }
  await writeFile(xml, premiereXml({ name, quelle, liste, zooms: einstellungen(p).zooms ? zoomsAus(abschnitte, liste, wellen) : [], kapitel: exp?.kapitel ?? [], effekte, textBilder }))
  const zeilen = untertitelGruppen(abschnitte, liste, 7).map((g) => ({ start: g.start, ende: g.ende, text: g.woerter.map((w) => sauber(w.wort)).join(' ') }))
  let srtPfad: string | null = null
  if (zeilen.length) {
    srtPfad = join(ziel, `${name}.srt`)
    await writeFile(srtPfad, srt(zeilen))
  }
  return { xml, srt: srtPfad }
}
