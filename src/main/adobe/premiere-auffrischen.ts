import { readdir, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { premiereDateien } from './premiere-export'

/** Datei-Pfade aus den <pathurl>-Einträgen einer FCP7-XML (file://localhost/C:/… → C:/…). */
export function verlinktePfade(xml: string): string[] {
  return [...xml.matchAll(/<pathurl>file:\/\/localhost\/([^<]+)<\/pathurl>/g)].map((m) => decodeURIComponent(m[1]!.replace(/&amp;/g, '&')))
}

/**
 * Philip, 02.10.: „das alles immer im Ordner gespeichert wird, dass ich nur das Projekt öffnen muss und dann ab dafür“.
 * Beim Start prüft MoinStudio jede Premiere-Sequenz im Datenordner: Zeigt sie auf Dateien, die es auf diesem Gerät nicht
 * gibt (Pfade des anderen Geräts), wird sie mit den Pfaden dieses Geräts neu geschrieben. Ältere Sequenzen desselben
 * Projekts unter anderem Namen (nach Umbenennen des Videos) werden entfernt, damit nur eine im Ordner liegt.
 */
export async function premiereAuffrischen(daten: string, melde: (text: string) => void = () => undefined): Promise<number> {
  const schnitt = join(daten, 'schnitt')
  let erneuert = 0
  for (const id of await readdir(schnitt).catch(() => [] as string[])) {
    const ordner = join(schnitt, id, 'premiere')
    const xmls = (await readdir(ordner).catch(() => [] as string[])).filter((n) => n.endsWith('.xml'))
    if (!xmls.length) continue
    const kaputt = await Promise.all(xmls.map(async (n) => verlinktePfade(await readFile(join(ordner, n), 'utf8').catch(() => '')).some((p) => !existsSync(p))))
    if (!kaputt.some(Boolean) && xmls.length === 1) continue
    try {
      const neu = await premiereDateien(daten, id)
      for (const n of xmls) {
        const pfad = join(ordner, n)
        if (pfad !== neu.xml) {
          await rm(pfad, { force: true })
          await rm(pfad.replace(/\.xml$/, '.srt'), { force: true })
        }
      }
      erneuert++
      melde(`Premiere-Sequenz für dieses Gerät erneuert: ${neu.xml}`)
    } catch (err) {
      melde(`Premiere-Sequenz ${id} nicht erneuert: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return erneuert
}
