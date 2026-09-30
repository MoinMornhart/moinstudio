import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { LogoEintrag, ThumbLogoWahl } from '@shared/app'
import { readJson, writeJsonAtomic } from '../data/jsonfile'
import type { LogoWahl } from './setzen'

/**
 * Logo-Bibliothek im Datenordner (Philip, 30.09.): `logos/logos.json` plus je Logo eine PNG-Datei mit Transparenz.
 * Nie im Repo. Je Kanal kann ein Logo das Standard-Logo sein – das ist die Vorauswahl im Thumbnail-Reiter.
 */

const Daten = z.object({
  logos: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      datei: z.string(),
      quelle: z.enum(['erstellt', 'hochgeladen']),
      erstellt: z.string(),
      breite: z.number(),
      hoehe: z.number()
    })
  ),
  standard: z.record(z.string(), z.string()).default({})
})
type Daten = z.infer<typeof Daten>

export const logoOrdner = (dir: string): string => join(dir, 'logos')
const datei = (dir: string): string => join(logoOrdner(dir), 'logos.json')

async function lade(dir: string): Promise<Daten> {
  const r = await readJson(datei(dir), Daten)
  return r.ok ? r.value : { logos: [], standard: {} }
}

function mitStandard(d: Daten): LogoEintrag[] {
  return d.logos.map((l) => ({ ...l, standard: Object.entries(d.standard).filter(([, id]) => id === l.id).map(([k]) => k) }))
}

export async function ladeLogos(dir: string): Promise<LogoEintrag[]> {
  return mitStandard(await lade(dir))
}

/** Speichert ein fertiges PNG (mit Transparenz) als neues Logo. */
export async function neuesLogo(dir: string, png: Buffer, o: { name: string; quelle: LogoEintrag['quelle']; breite: number; hoehe: number }): Promise<LogoEintrag[]> {
  const d = await lade(dir)
  const id = randomUUID().slice(0, 8)
  await mkdir(logoOrdner(dir), { recursive: true })
  await writeFile(join(logoOrdner(dir), `${id}.png`), png)
  d.logos.push({ id, name: o.name.trim().slice(0, 60) || 'Logo', datei: `${id}.png`, quelle: o.quelle, erstellt: new Date().toISOString(), breite: o.breite, hoehe: o.hoehe })
  await writeJsonAtomic(datei(dir), d)
  return mitStandard(d)
}

/** Umbenennen, Standard-Logo eines Kanals an/aus, löschen (dann auch nicht mehr Standard). */
export async function aendereLogo(dir: string, id: string, patch: { name?: string; standard?: { kanal: string; an: boolean }; entfernen?: boolean }): Promise<LogoEintrag[]> {
  const d = await lade(dir)
  const l = d.logos.find((x) => x.id === id)
  if (!l) return mitStandard(d)
  if (patch.entfernen) {
    d.logos.splice(d.logos.indexOf(l), 1)
    for (const [k, v] of Object.entries(d.standard)) if (v === id) delete d.standard[k]
    await rm(join(logoOrdner(dir), l.datei), { force: true })
  } else {
    if (typeof patch.name === 'string' && patch.name.trim()) l.name = patch.name.trim().slice(0, 60)
    if (patch.standard?.kanal) {
      if (patch.standard.an) d.standard[patch.standard.kanal] = id
      else if (d.standard[patch.standard.kanal] === id) delete d.standard[patch.standard.kanal]
    }
  }
  await writeJsonAtomic(datei(dir), d)
  return mitStandard(d)
}

/** Pfad der Logo-Datei (nur Dateien aus der Bibliothek). */
export function logoPfad(dir: string, l: Pick<LogoEintrag, 'datei'>): string {
  return join(logoOrdner(dir), l.datei)
}

/**
 * Wahl aus der Oberfläche → Logo für den Auftrag. „standard“ = Standard-Logo des Kanals (gibt es keins, kommt kein Logo
 * aufs Bild); unbekannte IDs ebenso nicht.
 */
export async function logoFuerAuftrag(dir: string, wahl: ThumbLogoWahl | undefined | null, kanal: string): Promise<LogoWahl | undefined> {
  if (!wahl?.id) return undefined
  const d = await lade(dir)
  const id = wahl.id === 'standard' ? d.standard[kanal] : wahl.id
  const l = d.logos.find((x) => x.id === id)
  if (!l) return undefined
  return { datei: logoPfad(dir, l), name: l.name, position: wahl.position ?? 'auto', groesse: wahl.groesse ?? 'mittel' }
}
