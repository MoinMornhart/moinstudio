import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { luecken, plusTage, rhythmusAus, tagVon } from '@shared/kalender'
import { writeJsonAtomic } from '../data/jsonfile'
import { aendereKarte, KANAELE, ladeKarten, loescheKarte, neueKarte, pruefeAenderung, SPALTEN, verschiebeKarte, type Kanal, type Karte, type Spalte } from './karten'

/**
 * Planung aus Claude Desktop (ROADMAP 7.7): alle Aktionen des MCP-Werkzeugs `planning`. Ohne Electron, damit der
 * MCP-Server sie auch direkt im Datenordner ausführen kann, wenn MoinStudio nicht läuft.
 */

export const PLANUNG_AKTIONEN = ['liste', 'kalender', 'anlegen', 'aendern', 'verschieben', 'loeschen', 'rhythmus', 'rhythmus_setzen', 'ideen', 'titel', 'wochenplan', 'ergebnis'] as const
export type PlanungAktion = (typeof PLANUNG_AKTIONEN)[number]

export interface PlanungArgs {
  aktion: PlanungAktion
  kanal?: string
  spalte?: string
  karte?: string
  titel?: string
  notizen?: string
  termin?: string | null
  checkliste?: { text: string; erledigt: boolean }[]
  index?: number
  von?: string
  bis?: string
  wunsch?: string
  auftrag?: string
  rhythmus?: unknown
}

/** Claude-Aufträge gibt es nur in der laufenden App */
export interface PlanungClaudeZugang {
  starte(art: 'ideen' | 'titel' | 'woche', o: { kanal?: string; wunsch?: string; karte?: string }): Promise<string>
  stand(auftrag: string): Promise<unknown>
}

const kurz = (k: Karte): Record<string, unknown> => ({
  id: k.id,
  kanal: k.kanal,
  stand: k.spalte,
  titel: k.titel,
  termin: k.termin,
  notizen: k.notizen || undefined,
  checkliste: k.checkliste.length ? k.checkliste : undefined,
  schnittProjekt: k.schnitt ?? undefined,
  thumbnail: k.thumbnail?.bild ? { bild: k.thumbnail.bild, gewaehlt: k.thumbnail.gewaehlt } : undefined,
  youtube: k.youtube ?? undefined
})

const kanalAus = (k: unknown): Kanal => {
  if (!KANAELE.includes(k as Kanal)) throw new Error(`kanal muss ${KANAELE.join(' oder ')} sein.`)
  return k as Kanal
}
const spalteAus = (s: unknown): Spalte => {
  if (!SPALTEN.includes(s as Spalte)) throw new Error(`spalte muss eine von ${SPALTEN.join(', ')} sein.`)
  return s as Spalte
}
const terminAus = (t: unknown): string | null => {
  if (t === null || t === '') return null
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(t)) throw new Error('termin im Format 2026-10-03T17:00 (oder null zum Entfernen).')
  return t.length === 10 ? `${t}T17:00` : t
}

async function rhythmusLesen(daten: string): Promise<ReturnType<typeof rhythmusAus>> {
  try {
    return rhythmusAus(JSON.parse(await readFile(join(daten, 'planning', 'rhythmus.json'), 'utf8')))
  } catch {
    return {}
  }
}

export async function planungAktion(daten: string, a: PlanungArgs, claude?: PlanungClaudeZugang): Promise<unknown> {
  const karten = (): Promise<Karte[]> => ladeKarten(daten)
  const ohneClaude = (): never => {
    throw new Error('Dafür muss MoinStudio laufen (Claude-Auftrag). Bitte die App öffnen.')
  }
  switch (a.aktion) {
    case 'liste': {
      const alle = (await karten()).filter((k) => (!a.kanal || k.kanal === a.kanal) && (!a.spalte || k.spalte === a.spalte))
      return { karten: alle.sort((x, y) => SPALTEN.indexOf(x.spalte) - SPALTEN.indexOf(y.spalte) || x.ordnung - y.ordnung).map(kurz) }
    }
    case 'kalender': {
      const heute = tagVon(new Date())
      const von = a.von ?? heute
      const bis = a.bis ?? plusTage(von, 27)
      const alle = await karten()
      const termine = alle.filter((k) => k.termin && k.termin.slice(0, 10) >= von && k.termin.slice(0, 10) <= bis).sort((x, y) => x.termin!.localeCompare(y.termin!))
      return {
        von,
        bis,
        termine: termine.map(kurz),
        freieTermine: luecken(await rhythmusLesen(daten), alle, von, bis, heute),
        ohneTermin: alle.filter((k) => !k.termin && k.spalte !== 'veroeffentlicht').map(kurz)
      }
    }
    case 'anlegen': {
      const titel = String(a.titel ?? '').trim()
      if (!titel) throw new Error('titel fehlt.')
      const k = await neueKarte(daten, { kanal: kanalAus(a.kanal ?? 'MoinMornhart'), titel, spalte: a.spalte ? spalteAus(a.spalte) : 'idee', notizen: a.notizen ?? '', termin: a.termin === undefined ? null : terminAus(a.termin) }, 'Claude Desktop')
      return kurz(k)
    }
    case 'aendern': {
      if (!a.karte) throw new Error('karte (ID) fehlt.')
      const roh: Record<string, unknown> = {}
      if (a.titel !== undefined) roh['titel'] = a.titel
      if (a.notizen !== undefined) roh['notizen'] = a.notizen
      if (a.termin !== undefined) roh['termin'] = terminAus(a.termin)
      if (a.checkliste !== undefined) roh['checkliste'] = a.checkliste
      if (a.kanal !== undefined) roh['kanal'] = kanalAus(a.kanal)
      if (a.spalte !== undefined) roh['spalte'] = spalteAus(a.spalte)
      return kurz(await aendereKarte(daten, a.karte, pruefeAenderung(roh), 'Claude Desktop'))
    }
    case 'verschieben': {
      if (!a.karte) throw new Error('karte (ID) fehlt.')
      return kurz(await verschiebeKarte(daten, a.karte, { spalte: spalteAus(a.spalte), index: a.index ?? Number.MAX_SAFE_INTEGER, kanal: a.kanal ? kanalAus(a.kanal) : undefined }, 'Claude Desktop'))
    }
    case 'loeschen': {
      if (!a.karte) throw new Error('karte (ID) fehlt.')
      const k = (await karten()).find((x) => x.id === a.karte)
      if (!k) throw new Error('Karte nicht gefunden.')
      await loescheKarte(daten, k.id)
      return { geloescht: k.titel }
    }
    case 'rhythmus':
      return rhythmusLesen(daten)
    case 'rhythmus_setzen': {
      const r = rhythmusAus(a.rhythmus)
      await writeJsonAtomic(join(daten, 'planning', 'rhythmus.json'), r)
      return r
    }
    case 'ideen':
      return { auftrag: await (claude ?? ohneClaude()).starte('ideen', { kanal: a.kanal ?? 'MoinMornhart', wunsch: a.wunsch }), hinweis: 'Ergebnis mit aktion "ergebnis" und dieser auftrag-ID abholen (dauert etwa eine Minute).' }
    case 'titel':
      if (!a.karte) throw new Error('karte (ID) fehlt.')
      return { auftrag: await (claude ?? ohneClaude()).starte('titel', { karte: a.karte }), hinweis: 'Ergebnis mit aktion "ergebnis" abholen.' }
    case 'wochenplan':
      return { auftrag: await (claude ?? ohneClaude()).starte('woche', {}), hinweis: 'Ergebnis mit aktion "ergebnis" abholen; Termine danach mit aktion "aendern" setzen.' }
    case 'ergebnis':
      if (!a.auftrag) throw new Error('auftrag fehlt.')
      return (await (claude ?? ohneClaude()).stand(a.auftrag)) ?? { fehler: 'Auftrag unbekannt.' }
    default:
      throw new Error(`Unbekannte Aktion: ${String((a as { aktion?: unknown }).aktion)}`)
  }
}
